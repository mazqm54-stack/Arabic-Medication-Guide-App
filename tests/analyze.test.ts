import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler, {
  _resetRateLimitStore,
  PHARMACIST_SYSTEM_PROMPT,
  GEMINI_RESPONSE_SCHEMA,
  VercelRequestLike,
  VercelResponseLike,
} from '../api/analyze';

// ============================================================================
// Test Mock Utilities
// ============================================================================

interface MockResponseRecord {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  ended: boolean;
}

function createMockReq(options: {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
  ip?: string;
} = {}): VercelRequestLike {
  const {
    method = 'POST',
    headers = { 'content-type': 'application/json' },
    body,
    ip = '127.0.0.1',
  } = options;

  return {
    method,
    headers: { ...headers },
    body,
    socket: { remoteAddress: ip },
  };
}

function createMockRes(): { res: VercelResponseLike; record: MockResponseRecord } {
  const record: MockResponseRecord = {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
  };

  const res: VercelResponseLike = {
    status(code: number) {
      record.statusCode = code;
      return res;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      record.headers[name.toLowerCase()] = String(value);
      return res;
    },
    json(data: any) {
      record.body = data;
      record.ended = true;
      return res;
    },
    end(chunk?: any) {
      if (chunk !== undefined) {
        record.body = chunk;
      }
      record.ended = true;
    },
  };

  return { res, record };
}

const SAMPLE_VALID_ANALYSIS = {
  is_clear: true,
  retake_message: '',
  confidence: 'high',
  evidence_text: 'Panadol Extra Paracetamol 500mg Caffeine 65mg',
  medicine_name_ar: 'بنادول إكسترا',
  medicine_name_en: 'Panadol Extra 500mg / 65mg',
  active_ingredient: 'باراسيتامول وكافيين',
  uses: ['تسكين الصداع الشديد', 'خفض الحرارة'],
  how_and_when: ['قرص إلى قرصين بعد الأكل عند اللزوم'],
  warnings: ['لا تتناول أدوية أخرى تحتوي على باراسيتامول', 'استشر الطبيب أو الصيدلي إذا لم تتحسن الأعراض'],
  audio_summary: 'هذا دواء بنادول إكسترا لتسكين الألم والصداع وخفض الحرارة.',
};

function createMockGeminiFetch(responseBody: any, status = 200) {
  const payload = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody),
            },
          ],
        },
      },
    ],
  };

  return vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(status === 200 ? JSON.stringify(payload) : JSON.stringify(responseBody), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  );
}

// ============================================================================
// Test Suite
// ============================================================================

describe('/api/analyze Serverless Endpoint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetRateLimitStore();
    process.env.GEMINI_API_KEY = 'test-mock-gemini-key-12345';
    process.env.GEMINI_MODEL = 'gemini-3.8-flash';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Suite 1: HTTP Method & CORS Preflight
  // --------------------------------------------------------------------------
  describe('CORS and HTTP Method Enforcement', () => {
    it('handles OPTIONS preflight request with HTTP 204 and CORS headers', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const req = createMockReq({ method: 'OPTIONS' });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(204);
      expect(record.headers['access-control-allow-origin']).toBe('*');
      expect(record.headers['access-control-allow-methods']).toContain('POST');
      expect(record.headers['access-control-allow-methods']).toContain('OPTIONS');
      expect(record.headers['access-control-allow-headers']).toContain('Content-Type');
      expect(record.headers['access-control-max-age']).toBe('86400');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects GET requests with HTTP 405 Method Not Allowed and Allow header', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const req = createMockReq({ method: 'GET' });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(405);
      expect(record.headers['allow']).toContain('POST');
      expect(record.headers['access-control-allow-origin']).toBe('*');
      expect(record.body?.error).toBe('METHOD_NOT_ALLOWED');
      expect(record.body?.retake_message).toContain('POST');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects PUT, DELETE, and PATCH with HTTP 405', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      for (const method of ['PUT', 'DELETE', 'PATCH']) {
        const req = createMockReq({ method });
        const { res, record } = createMockRes();

        await handler(req, res);

        expect(record.statusCode).toBe(405);
        expect(record.headers['allow']).toContain('POST');
        expect(record.body?.error).toBe('METHOD_NOT_ALLOWED');
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('attaches Access-Control-Allow-Origin: * to POST responses', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({
        method: 'POST',
        body: { image: 'validBase64SampleData' },
      });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.headers['access-control-allow-origin']).toBe('*');
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Request Payload & Size Validation
  // --------------------------------------------------------------------------
  describe('Payload & Size Validation', () => {
    it('returns HTTP 400 Bad Request when request body is missing or non-object', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const req = createMockReq({ body: null });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(400);
      expect(record.body?.error).toBe('BAD_REQUEST');
      expect(record.body?.retake_message).toContain('غير صالحة');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns HTTP 400 Bad Request when image property is missing', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const req = createMockReq({ body: { mimeType: 'image/jpeg' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(400);
      expect(record.body?.error).toBe('BAD_REQUEST');
      expect(record.body?.retake_message).toContain('لم يتم استلام صورة');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns HTTP 400 Bad Request when image is empty string or whitespace only', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const req = createMockReq({ body: { image: '   ' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(400);
      expect(record.body?.error).toBe('BAD_REQUEST');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns HTTP 413 Payload Too Large when base64 image exceeds 4MB', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      // 4MB = 4 * 1024 * 1024 = 4,194,304 characters
      const oversizedImage = 'a'.repeat(4 * 1024 * 1024 + 10);
      const req = createMockReq({ body: { image: oversizedImage } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(413);
      expect(record.body?.error).toBe('PAYLOAD_TOO_LARGE');
      expect(record.body?.retake_message).toContain('كبير جداً');
      expect(record.body?.retake_message).toContain('4 ميجابايت');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('cleanly strips data:image/jpeg;base64, prefix before processing', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const rawBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const prefixedImage = `data:image/jpeg;base64,${rawBase64}`;

      const req = createMockReq({
        body: { image: prefixedImage, mimeType: 'image/jpeg' },
      });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      expect(fetchMock).toHaveBeenCalled();
      const calledBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      const passedData = calledBody.contents[0].parts[1].inlineData.data;
      expect(passedData).toBe(rawBase64);
      expect(passedData).not.toContain('data:image');
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Per-IP Rate Limiting (20 Requests / Hour)
  // --------------------------------------------------------------------------
  describe('Per-IP Rate Limiting (20 req/hr)', () => {
    it('allows 20 requests within 1 hour and decrements X-RateLimit-Remaining from 19 to 0', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const testIp = '192.168.1.100';

      for (let i = 1; i <= 20; i++) {
        const req = createMockReq({
          body: { image: 'dummyImage' },
          ip: testIp,
        });
        const { res, record } = createMockRes();

        await handler(req, res);

        expect(record.statusCode).toBe(200);
        expect(record.headers['x-ratelimit-limit']).toBe('20');
        expect(record.headers['x-ratelimit-remaining']).toBe(String(20 - i));
        expect(record.headers['x-ratelimit-reset']).toBeDefined();
      }

      expect(fetchMock).toHaveBeenCalledTimes(20);
    });

    it('rejects the 21st request with HTTP 429, Retry-After header, and Arabic message', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const testIp = '10.0.0.50';

      // Exhaust 20 allowed requests
      for (let i = 0; i < 20; i++) {
        const req = createMockReq({ body: { image: 'dummyImage' }, ip: testIp });
        const { res } = createMockRes();
        await handler(req, res);
      }

      // 21st request
      const req21 = createMockReq({ body: { image: 'dummyImage' }, ip: testIp });
      const { res: res21, record: record21 } = createMockRes();

      await handler(req21, res21);

      expect(record21.statusCode).toBe(429);
      expect(record21.headers['x-ratelimit-remaining']).toBe('0');
      expect(record21.headers['retry-after']).toBeDefined();
      expect(Number(record21.headers['retry-after'])).toBeGreaterThan(0);
      expect(record21.body?.error).toBe('RATE_LIMIT_EXCEEDED');
      expect(record21.body?.retake_message).toContain('تم تجاوز حد الاستخدام المسموح');
      expect(record21.body?.retake_message).toContain('20');

      // Crucial: Upstream fetch was NOT called on the 21st request
      expect(fetchMock).toHaveBeenCalledTimes(20);
    });

    it('isolates rate limits between distinct IP addresses', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const ipA = '198.51.100.1';
      const ipB = '198.51.100.2';

      // Exhaust IP A
      for (let i = 0; i < 20; i++) {
        const req = createMockReq({ body: { image: 'dummyImage' }, ip: ipA });
        const { res } = createMockRes();
        await handler(req, res);
      }

      // IP A is now rate-limited
      const reqA21 = createMockReq({ body: { image: 'dummyImage' }, ip: ipA });
      const { res: resA21, record: recA21 } = createMockRes();
      await handler(reqA21, resA21);
      expect(recA21.statusCode).toBe(429);

      // IP B must succeed with full quota
      const reqB = createMockReq({ body: { image: 'dummyImage' }, ip: ipB });
      const { res: resB, record: recB } = createMockRes();
      await handler(reqB, resB);

      expect(recB.statusCode).toBe(200);
      expect(recB.headers['x-ratelimit-remaining']).toBe('19');
    });

    it('correctly parses client IP from multi-hop x-forwarded-for header', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({
        headers: {
          'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
        },
        body: { image: 'dummyImage' },
      });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      expect(record.headers['x-ratelimit-remaining']).toBe('19');
    });

    it('resets rate limit window after 1 hour', async () => {
      vi.useFakeTimers();
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const ip = '172.16.0.5';

      // Saturate quota
      for (let i = 0; i < 20; i++) {
        const req = createMockReq({ body: { image: 'dummyImage' }, ip });
        const { res } = createMockRes();
        await handler(req, res);
      }

      // Blocked at 429
      const reqBlocked = createMockReq({ body: { image: 'dummyImage' }, ip });
      const { res: resBlocked, record: recBlocked } = createMockRes();
      await handler(reqBlocked, resBlocked);
      expect(recBlocked.statusCode).toBe(429);

      // Fast forward time past 1 hour (3600 seconds + 10 seconds)
      vi.advanceTimersByTime(60 * 60 * 1000 + 10000);

      // Should now succeed again with refreshed quota
      const reqAfter = createMockReq({ body: { image: 'dummyImage' }, ip });
      const { res: resAfter, record: recAfter } = createMockRes();
      await handler(reqAfter, resAfter);

      expect(recAfter.statusCode).toBe(200);
      expect(recAfter.headers['x-ratelimit-remaining']).toBe('19');
    });
  });

  // --------------------------------------------------------------------------
  // Suite 4: Successful Analysis & Forwarding
  // --------------------------------------------------------------------------
  describe('Valid Payload Forwarding & Gemini Integration', () => {
    it('constructs accurate Gemini API request and forwards structured JSON response', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({
        body: {
          image: 'validBase64PayloadString',
          mimeType: 'image/jpeg',
        },
      });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      expect(record.body).toEqual(SAMPLE_VALID_ANALYSIS);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOptions] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
      expect(calledUrl).toContain('key=test-mock-gemini-key-12345');
      expect(calledOptions.method).toBe('POST');
      expect(calledOptions.headers['Content-Type']).toBe('application/json');

      const parsedBody = JSON.parse(calledOptions.body);
      expect(parsedBody.systemInstruction.parts[0].text).toBe(PHARMACIST_SYSTEM_PROMPT);
      expect(parsedBody.generationConfig.temperature).toBe(0);
      expect(parsedBody.generationConfig.responseMimeType).toBe('application/json');
      expect(parsedBody.generationConfig.responseSchema).toEqual(GEMINI_RESPONSE_SCHEMA);
      expect(parsedBody.contents[0].parts[1].inlineData).toEqual({
        mimeType: 'image/jpeg',
        data: 'validBase64PayloadString',
      });
    });

    it('uses custom model from process.env.GEMINI_MODEL', async () => {
      process.env.GEMINI_MODEL = 'gemini-exp-custom';
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({
        body: { image: 'sampleImage' },
      });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      const [calledUrl] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain('models/gemini-exp-custom:generateContent');
    });
  });

  // --------------------------------------------------------------------------
  // Suite 5: Thinking Latency Optimization
  // --------------------------------------------------------------------------
  describe('Thinking Latency Optimization', () => {
    it('injects thinkingConfig: { thinkingBudget: 0 } when model is 2.0 or 2.5', async () => {
      process.env.GEMINI_MODEL = 'gemini-2.0-flash';
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({
        body: { image: 'sampleImage' },
      });
      const { res } = createMockRes();

      await handler(req, res);

      const [, calledOptions] = fetchMock.mock.calls[0];
      const parsedBody = JSON.parse(calledOptions.body);
      expect(parsedBody.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    });

    it('omits thinkingConfig for gemini-1.5-flash to avoid upstream rejection', async () => {
      process.env.GEMINI_MODEL = 'gemini-3.8-flash';
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({
        body: { image: 'sampleImage' },
      });
      const { res } = createMockRes();

      await handler(req, res);

      const [, calledOptions] = fetchMock.mock.calls[0];
      const parsedBody = JSON.parse(calledOptions.body);
      expect(parsedBody.generationConfig.thinkingConfig).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Suite 6: Security & Server Configuration Guardrails
  // --------------------------------------------------------------------------
  describe('Server Security & Configuration', () => {
    it('returns HTTP 500 when GEMINI_API_KEY is not defined', async () => {
      delete process.env.GEMINI_API_KEY;
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const req = createMockReq({ body: { image: 'sample' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(500);
      expect(record.body?.error).toBe('SERVER_CONFIGURATION_ERROR');
      expect(record.body?.retake_message).toContain('غير مهيأة بالشكل الصحيح');
      // Verify no credential names or stack traces are leaked to the client
      expect(JSON.stringify(record.body)).not.toContain('GEMINI_API_KEY');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('defaults model to gemini-3.8-flash when GEMINI_MODEL is empty', async () => {
      delete process.env.GEMINI_MODEL;
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({ body: { image: 'sample' } });
      const { res } = createMockRes();

      await handler(req, res);

      const [calledUrl] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain('models/gemini-3.8-flash:generateContent');
    });
  });

  // --------------------------------------------------------------------------
  // Suite 7: Upstream Error Translation
  // --------------------------------------------------------------------------
  describe('Upstream Error Handling', () => {
    it('translates upstream Gemini HTTP 429 to HTTP 429 with Arabic message', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: 'Resource Exhausted' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      const req = createMockReq({ body: { image: 'sample' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(429);
      expect(record.body?.error).toBe('UPSTREAM_RATE_LIMIT');
      expect(record.body?.retake_message).toContain('مزود الخدمة الذكية');
    });

    it('translates upstream Gemini HTTP 500 to HTTP 500 with Arabic message', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: 'Internal Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      const req = createMockReq({ body: { image: 'sample' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(500);
      expect(record.body?.error).toBe('UPSTREAM_API_ERROR');
      expect(record.body?.retake_message).toContain('حدث خطأ أثناء معالجة الصورة');
    });

    it('returns friendly low-confidence fallback when Gemini returns empty parts', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ candidates: [{ content: { parts: [] } }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      const req = createMockReq({ body: { image: 'sample' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      expect(record.body?.is_clear).toBe(false);
      expect(record.body?.confidence).toBe('low');
      expect(record.body?.retake_message).toContain('لم نتمكن من التعرف على بيانات الدواء');
    });
  });
});
