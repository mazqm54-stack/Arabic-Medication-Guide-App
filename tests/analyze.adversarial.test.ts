import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler, {
  _resetRateLimitStore,
  getClientIp,
  checkRateLimit,
  cleanAndParseJsonText,
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
// Adversarial & Stress Test Suite
// ============================================================================

describe('Adversarial & Stress Testing for /api/analyze', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetRateLimitStore();
    process.env.GEMINI_API_KEY = 'valid-test-key-for-stress-testing';
    process.env.GEMINI_MODEL = 'gemini-3.8-flash';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    vi.useRealTimers();
  });

  // ==========================================================================
  // 1. Boundary & Oversized Payload Stress Tests
  // ==========================================================================
  describe('Boundary & Payload Size Stress Tests', () => {
    it('accepts payload of EXACTLY 4MB (4,194,304 chars) and returns HTTP 200', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const exact4MB = 'A'.repeat(4 * 1024 * 1024);
      expect(exact4MB.length).toBe(4194304);

      const req = createMockReq({
        body: { image: exact4MB },
      });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      expect(record.body).toEqual(SAMPLE_VALID_ANALYSIS);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('accepts payload of 4MB minus 1 char (4,194,303 chars) and returns HTTP 200', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const under4MB = 'A'.repeat(4 * 1024 * 1024 - 1);
      const req = createMockReq({ body: { image: under4MB } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('rejects payload of 4MB plus 1 char (4,194,305 chars) with HTTP 413 and Arabic error', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const over4MB = 'A'.repeat(4 * 1024 * 1024 + 1);
      const req = createMockReq({ body: { image: over4MB } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(413);
      expect(record.body?.error).toBe('PAYLOAD_TOO_LARGE');
      expect(record.body?.is_clear).toBe(false);
      expect(record.body?.retake_message).toContain('حجم الصورة كبير جداً');
      expect(record.body?.retake_message).toContain('4 ميجابايت');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects boundary payload of 4.001MB (4,195,352 chars) with HTTP 413 and PAYLOAD_TOO_LARGE', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const size4_001MB = Math.floor(4.001 * 1024 * 1024);
      const image4_001MB = 'B'.repeat(size4_001MB);
      const req = createMockReq({ body: { image: image4_001MB } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(413);
      expect(record.body?.error).toBe('PAYLOAD_TOO_LARGE');
      expect(record.body?.is_clear).toBe(false);
      expect(record.body?.retake_message).toContain('كبير جداً');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('handles massive 10MB payload safely with HTTP 413 without OOM or crash', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const massivePayload = 'C'.repeat(10 * 1024 * 1024);
      const req = createMockReq({ body: { image: massivePayload } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(413);
      expect(record.body?.error).toBe('PAYLOAD_TOO_LARGE');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects data URI prefixed string if total length exceeds 4MB', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const prefix = 'data:image/jpeg;base64,';
      // 4MB - prefix.length + 1 makes total length > 4MB
      const imageWithPrefix = prefix + 'D'.repeat(4 * 1024 * 1024 - prefix.length + 1);
      const req = createMockReq({ body: { image: imageWithPrefix } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(413);
      expect(record.body?.error).toBe('PAYLOAD_TOO_LARGE');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 2. Malformed JSON, Bad Request & Input Variations
  // ==========================================================================
  describe('Malformed Requests and Body Variations', () => {
    it('returns HTTP 400 when body is an unparsed malformed JSON string', async () => {
      const req = createMockReq({ body: '{ "image": "abc", unclosed string ' as any });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(400);
      expect(record.body?.error).toBe('BAD_REQUEST');
      expect(record.body?.retake_message).toContain('صيغة الطلب غير صالحة');
    });

    it('returns HTTP 400 for primitive request bodies (number, boolean, string)', async () => {
      for (const primitiveBody of [12345, true, 'not-json-string']) {
        const req = createMockReq({ body: primitiveBody as any });
        const { res, record } = createMockRes();

        await handler(req, res);

        expect(record.statusCode).toBe(400);
        expect(record.body?.error).toBe('BAD_REQUEST');
      }
    });

    it('returns HTTP 400 when body is an array instead of object', async () => {
      const req = createMockReq({ body: [{ image: 'validBase64' }] as any });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(400);
      expect(record.body?.error).toBe('BAD_REQUEST');
    });

    it('returns HTTP 400 when image property is not a string (object, number, boolean, array)', async () => {
      const invalidImages = [
        { nested: 'image' },
        99999,
        false,
        ['base64part1', 'base64part2'],
      ];

      for (const invalidImage of invalidImages) {
        const req = createMockReq({ body: { image: invalidImage } });
        const { res, record } = createMockRes();

        await handler(req, res);

        expect(record.statusCode).toBe(400);
        expect(record.body?.error).toBe('BAD_REQUEST');
        expect(record.body?.retake_message).toContain('لم يتم استلام صورة علبة الدواء');
      }
    });

    it('returns HTTP 400 when image is whitespace, tabs, or newlines only', async () => {
      const req = createMockReq({ body: { image: '  \n\t\r   ' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(400);
      expect(record.body?.error).toBe('BAD_REQUEST');
    });

    it('sanitizes and defaults mimeType when empty or invalid', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({
        body: { image: 'validBase64', mimeType: '   ' },
      });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      const calledBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(calledBody.contents[0].parts[1].inlineData.mimeType).toBe('image/jpeg');
    });

    it('preserves non-jpeg mimeType when validly specified (e.g. image/png, image/webp)', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({
        body: { image: 'validBase64', mimeType: 'image/png' },
      });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      const calledBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(calledBody.contents[0].parts[1].inlineData.mimeType).toBe('image/png');
    });
  });

  // ==========================================================================
  // 3. Concurrent Requests & Rate Limiting Stress Tests
  // ==========================================================================
  describe('Concurrency & Rate Limiting Stress Tests', () => {
    it('strictly permits exactly 20 requests and rejects 10 when 30 concurrent requests are fired', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const testIp = '10.200.0.99';
      const totalRequests = 30;

      // Construct 30 concurrent requests
      const promises = Array.from({ length: totalRequests }, async (_, index) => {
        const req = createMockReq({
          body: { image: `sampleImage_${index}` },
          ip: testIp,
        });
        const { res, record } = createMockRes();
        await handler(req, res);
        return record;
      });

      const results = await Promise.all(promises);

      const successfulResponses = results.filter((r) => r.statusCode === 200);
      const rateLimitedResponses = results.filter((r) => r.statusCode === 429);

      // Verify exact counts
      expect(successfulResponses).toHaveLength(20);
      expect(rateLimitedResponses).toHaveLength(10);

      // Upstream Gemini API must have been called EXACTLY 20 times (never for 429s)
      expect(fetchMock).toHaveBeenCalledTimes(20);

      // Every rate-limited response must carry the required headers and Arabic message
      for (const limitedRes of rateLimitedResponses) {
        expect(limitedRes.headers['x-ratelimit-limit']).toBe('20');
        expect(limitedRes.headers['x-ratelimit-remaining']).toBe('0');
        expect(limitedRes.headers['retry-after']).toBeDefined();
        const retryAfterNum = Number(limitedRes.headers['retry-after']);
        expect(retryAfterNum).toBeGreaterThanOrEqual(1);
        expect(retryAfterNum).toBeLessThanOrEqual(3600);
        expect(limitedRes.body?.error).toBe('RATE_LIMIT_EXCEEDED');
        expect(limitedRes.body?.is_clear).toBe(false);
        expect(limitedRes.body?.retake_message).toContain('تم تجاوز حد الاستخدام المسموح');
      }
    });

    it('handles concurrent traffic from 10 distinct IPs (5 requests each = 50 concurrent requests) without cross-contamination', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const ipCount = 10;
      const reqPerIp = 5;

      const promises: Promise<MockResponseRecord>[] = [];
      for (let ipIndex = 0; ipIndex < ipCount; ipIndex++) {
        const ip = `192.0.2.${ipIndex + 1}`;
        for (let r = 0; r < reqPerIp; r++) {
          const req = createMockReq({
            body: { image: `image_ip_${ipIndex}_req_${r}` },
            ip,
          });
          const { res, record } = createMockRes();
          promises.push(
            handler(req, res).then(() => record)
          );
        }
      }

      const results = await Promise.all(promises);

      // All 50 should succeed
      expect(results.every((r) => r.statusCode === 200)).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(50);
    });

    it('cleans up expired records when rateLimitStore exceeds 500 entries', () => {
      vi.useFakeTimers();

      // Insert 550 records that have already expired
      for (let i = 0; i < 550; i++) {
        const ip = `expired.ip.${i}`;
        checkRateLimit(ip);
      }

      // Fast forward time past 1 hour so all 550 records expire
      vi.advanceTimersByTime(3600 * 1000 + 1000);

      // Trigger checkRateLimit on a new IP, which should trigger the cleanup sweep (> 500)
      const freshResult = checkRateLimit('fresh.new.ip');
      expect(freshResult.allowed).toBe(true);
      expect(freshResult.remaining).toBe(19);
    });

    it('Retry-After header accurately reflects remaining seconds until window reset', async () => {
      vi.useFakeTimers();
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const ip = '10.10.10.10';

      // Exhaust 20 requests at t=0
      for (let i = 0; i < 20; i++) {
        const req = createMockReq({ body: { image: 'sample' }, ip });
        const { res } = createMockRes();
        await handler(req, res);
      }

      // Check Retry-After at t=0 (should be 3600 seconds)
      const reqT0 = createMockReq({ body: { image: 'sample' }, ip });
      const { res: resT0, record: recT0 } = createMockRes();
      await handler(reqT0, resT0);
      expect(recT0.statusCode).toBe(429);
      expect(Number(recT0.headers['retry-after'])).toBe(3600);

      // Advance time by 30 minutes (1800 seconds)
      vi.advanceTimersByTime(1800 * 1000);

      // Check Retry-After at t=30min (should be 1800 seconds)
      const reqT30 = createMockReq({ body: { image: 'sample' }, ip });
      const { res: resT30, record: recT30 } = createMockRes();
      await handler(reqT30, resT30);
      expect(recT30.statusCode).toBe(429);
      expect(Number(recT30.headers['retry-after'])).toBe(1800);

      // Advance time by another 30 minutes + 1 second (total 3601s)
      vi.advanceTimersByTime(1801 * 1000);

      // Should now succeed with 200
      const reqT60 = createMockReq({ body: { image: 'sample' }, ip });
      const { res: resT60, record: recT60 } = createMockRes();
      await handler(reqT60, resT60);
      expect(recT60.statusCode).toBe(200);
      expect(recT60.headers['x-ratelimit-remaining']).toBe('19');
    });
  });

  // ==========================================================================
  // 4. IP Header Manipulations & Client IP Extraction
  // ==========================================================================
  describe('IP Header Manipulation and Spoofing Tests', () => {
    it('extracts first IP from multi-hop x-forwarded-for with whitespace and tabs', () => {
      const req = createMockReq({
        headers: {
          'x-forwarded-for': ' \t 203.0.113.195 \t , 70.41.3.18 , 150.172.238.178 ',
        },
      });
      expect(getClientIp(req)).toBe('203.0.113.195');
    });

    it('extracts first IP from x-forwarded-for provided as string array', () => {
      const req = createMockReq({
        headers: {
          'x-forwarded-for': [' 203.0.113.200 ', ' 70.41.3.18 '],
        },
      });
      expect(getClientIp(req)).toBe('203.0.113.200');
    });

    it('falls back to x-real-ip when x-forwarded-for is missing', () => {
      const req = createMockReq({
        headers: {
          'x-real-ip': '   198.51.100.25   ',
        },
      });
      expect(getClientIp(req)).toBe('198.51.100.25');
    });

    it('falls back to socket.remoteAddress when headers are absent', () => {
      const req = createMockReq({
        headers: {},
        ip: '172.20.10.5',
      });
      expect(getClientIp(req)).toBe('172.20.10.5');
    });

    it('falls back to 127.0.0.1 when headers and socket are completely undefined', () => {
      const req: VercelRequestLike = {
        headers: {},
        socket: undefined,
      };
      expect(getClientIp(req)).toBe('127.0.0.1');
    });

    it('handles IPv6 addresses cleanly in x-forwarded-for and x-real-ip', () => {
      const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const req = createMockReq({
        headers: {
          'x-forwarded-for': `${ipv6}, 10.0.0.1`,
        },
      });
      expect(getClientIp(req)).toBe(ipv6);
    });

    it('prevents rate limit bypass via IP rotation: distinct IPs have distinct buckets', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const attackerIp1 = '203.0.113.10';
      const attackerIp2 = '203.0.113.11';

      // Exhaust IP 1
      for (let i = 0; i < 20; i++) {
        const req = createMockReq({
          body: { image: 'sample' },
          headers: { 'x-forwarded-for': attackerIp1 },
        });
        const { res } = createMockRes();
        await handler(req, res);
      }

      // IP 1 is blocked
      const reqBlocked = createMockReq({
        body: { image: 'sample' },
        headers: { 'x-forwarded-for': attackerIp1 },
      });
      const { res: resBlocked, record: recBlocked } = createMockRes();
      await handler(reqBlocked, resBlocked);
      expect(recBlocked.statusCode).toBe(429);

      // IP 2 is not blocked
      const reqAllowed = createMockReq({
        body: { image: 'sample' },
        headers: { 'x-forwarded-for': attackerIp2 },
      });
      const { res: resAllowed, record: recAllowed } = createMockRes();
      await handler(reqAllowed, resAllowed);
      expect(recAllowed.statusCode).toBe(200);
    });
  });

  // ==========================================================================
  // 5. Verification of All Error Statuses & Localized Arabic Messages
  // ==========================================================================
  describe('Comprehensive Error Statuses and Arabic Localization', () => {
    it('verifies 400 Bad Request error contract', async () => {
      const req = createMockReq({ body: {} });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(400);
      expect(record.body?.error).toBe('BAD_REQUEST');
      expect(record.body?.is_clear).toBe(false);
      expect(typeof record.body?.retake_message).toBe('string');
      expect(record.body?.retake_message.length).toBeGreaterThan(10);
      // Arabic characters present
      expect(/[\u0600-\u06FF]/.test(record.body?.retake_message)).toBe(true);
    });

    it('verifies 405 Method Not Allowed error contract and headers', async () => {
      const req = createMockReq({ method: 'GET' });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(405);
      expect(record.headers['allow']).toBe('POST, OPTIONS');
      expect(record.body?.error).toBe('METHOD_NOT_ALLOWED');
      expect(record.body?.is_clear).toBe(false);
      expect(/[\u0600-\u06FF]/.test(record.body?.retake_message)).toBe(true);
    });

    it('verifies 413 Payload Too Large error contract', async () => {
      const req = createMockReq({ body: { image: 'x'.repeat(4 * 1024 * 1024 + 10) } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(413);
      expect(record.body?.error).toBe('PAYLOAD_TOO_LARGE');
      expect(record.body?.is_clear).toBe(false);
      expect(record.body?.retake_message).toContain('4 ميجابايت');
      expect(/[\u0600-\u06FF]/.test(record.body?.retake_message)).toBe(true);
    });

    it('verifies 429 Rate Limit Exceeded error contract with Retry-After and Arabic message', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const ip = '10.50.50.50';
      for (let i = 0; i < 20; i++) {
        const req = createMockReq({ body: { image: 'sample' }, ip });
        const { res } = createMockRes();
        await handler(req, res);
      }

      const req = createMockReq({ body: { image: 'sample' }, ip });
      const { res, record } = createMockRes();
      await handler(req, res);

      expect(record.statusCode).toBe(429);
      expect(record.headers['retry-after']).toBeDefined();
      expect(record.body?.error).toBe('RATE_LIMIT_EXCEEDED');
      expect(record.body?.is_clear).toBe(false);
      expect(record.body?.retake_message).toContain('20');
      expect(/[\u0600-\u06FF]/.test(record.body?.retake_message)).toBe(true);
    });

    it('verifies 500 Server Configuration Error contract when GEMINI_API_KEY missing', async () => {
      delete process.env.GEMINI_API_KEY;

      const req = createMockReq({ body: { image: 'sample' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(500);
      expect(record.body?.error).toBe('SERVER_CONFIGURATION_ERROR');
      expect(record.body?.is_clear).toBe(false);
      expect(/[\u0600-\u06FF]/.test(record.body?.retake_message)).toBe(true);
      // Ensures server secret name is NOT leaked in response
      expect(JSON.stringify(record.body)).not.toContain('GEMINI_API_KEY');
    });

    it('verifies 500 Upstream API Error contract when Gemini returns HTTP 503', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response('Service Unavailable', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          })
        )
      );

      const req = createMockReq({ body: { image: 'sample' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(500);
      expect(record.body?.error).toBe('UPSTREAM_API_ERROR');
      expect(record.body?.is_clear).toBe(false);
      expect(/[\u0600-\u06FF]/.test(record.body?.retake_message)).toBe(true);
    });

    it('verifies 500 Internal Server Error contract when fetch throws network error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('ECONNRESET connection destroyed'))
      );

      const req = createMockReq({ body: { image: 'sample' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(500);
      expect(record.body?.error).toBe('INTERNAL_SERVER_ERROR');
      expect(record.body?.is_clear).toBe(false);
      expect(record.body?.retake_message).toContain('حدث خطأ غير متوقع');
      expect(/[\u0600-\u06FF]/.test(record.body?.retake_message)).toBe(true);
    });
  });

  // ==========================================================================
  // 6. Upstream AI Candidate Edge Cases & Output Sanitization
  // ==========================================================================
  describe('Upstream AI Response Sanitization and Resilient Parsing', () => {
    it('parses JSON wrapped in markdown ```json code fences', async () => {
      const fencedOutput = '```json\n' + JSON.stringify(SAMPLE_VALID_ANALYSIS) + '\n```';
      const fetchMock = createMockGeminiFetch(fencedOutput);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({ body: { image: 'sample' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      expect(record.body).toEqual(SAMPLE_VALID_ANALYSIS);
    });

    it('extracts JSON surrounded by conversational preamble and postamble', async () => {
      const messyOutput =
        'Here is the extracted medicine information:\n' +
        JSON.stringify(SAMPLE_VALID_ANALYSIS) +
        '\nI hope this is helpful for the patient.';
      const fetchMock = createMockGeminiFetch(messyOutput);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({ body: { image: 'sample' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      expect(record.body).toEqual(SAMPLE_VALID_ANALYSIS);
    });

    it('returns graceful low-confidence fallback when Gemini returns invalid JSON text', async () => {
      const corruptedJson = '{"is_clear": true, "medicine_name_ar": "بنادول", unclosed syntax...';
      const fetchMock = createMockGeminiFetch(corruptedJson);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({ body: { image: 'sample' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      expect(record.body?.is_clear).toBe(false);
      expect(record.body?.confidence).toBe('low');
      expect(record.body?.retake_message).toContain('تعذر قراءة بيانات الدواء');
      expect(/[\u0600-\u06FF]/.test(record.body?.retake_message)).toBe(true);
    });

    it('returns fallback object when Gemini response contains empty candidates array', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ candidates: [] }), {
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

    it('retries without thinkingConfig when upstream Gemini 2.0 rejects thinkingConfig with HTTP 400', async () => {
      process.env.GEMINI_MODEL = 'gemini-2.0-flash';

      // First call fails with 400 thinking error, second call succeeds
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { message: 'thinkingConfig is not supported' } }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [{ text: JSON.stringify(SAMPLE_VALID_ANALYSIS) }],
                  },
                },
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );

      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({ body: { image: 'sample' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      expect(record.body).toEqual(SAMPLE_VALID_ANALYSIS);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // First request included thinkingConfig
      const firstPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(firstPayload.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });

      // Second request omitted thinkingConfig
      const secondPayload = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(secondPayload.generationConfig.thinkingConfig).toBeUndefined();
    });
  });

  // ==========================================================================
  // 7. Direct Helper & Contract Invariance Tests
  // ==========================================================================
  describe('Direct Helper and Contract Invariance Tests', () => {
    it('verifies PHARMACIST_SYSTEM_PROMPT contains all 10 strict pharmacist rules', () => {
      expect(PHARMACIST_SYSTEM_PROMPT).toContain('You are an expert pharmacist assistant');
      expect(PHARMACIST_SYSTEM_PROMPT).toContain('STRICT RULES:');
      for (let i = 1; i <= 10; i++) {
        expect(PHARMACIST_SYSTEM_PROMPT).toContain(`${i}.`);
      }
      expect(PHARMACIST_SYSTEM_PROMPT).toContain('confidence to \'high\' only if the name and the active ingredient are both clearly printed');
      expect(PHARMACIST_SYSTEM_PROMPT).toContain('Return JSON only, matching the schema. No markdown, no extra text.');
    });

    it('verifies GEMINI_RESPONSE_SCHEMA contains all 11 required fields with strict enum for confidence', () => {
      expect(GEMINI_RESPONSE_SCHEMA.type).toBe('OBJECT');
      expect(GEMINI_RESPONSE_SCHEMA.required).toHaveLength(11);
      expect(GEMINI_RESPONSE_SCHEMA.properties.confidence.enum).toEqual(['high', 'medium', 'low']);
      expect(GEMINI_RESPONSE_SCHEMA.properties.is_clear.type).toBe('BOOLEAN');
      expect(GEMINI_RESPONSE_SCHEMA.properties.uses.type).toBe('ARRAY');
    });

    it('cleanAndParseJsonText handles various edge cases correctly', () => {
      // Empty input
      expect(cleanAndParseJsonText('')).toBeNull();
      expect(cleanAndParseJsonText('   ')).toBeNull();

      // Simple valid JSON
      expect(cleanAndParseJsonText('{"key": "value"}')).toEqual({ key: 'value' });

      // Code fenced JSON with comments or whitespace
      expect(cleanAndParseJsonText('```\n{"a": 1}\n```')).toEqual({ a: 1 });
      expect(cleanAndParseJsonText('```json\n{"b": 2}\n```')).toEqual({ b: 2 });

      // Stray unbalanced braces in prefix cause JSON.parse failure and return null (safely triggering handler fallback)
      expect(cleanAndParseJsonText('Prefix { {"valid": true} } suffix')).toBeNull();

      // Normal text surrounding clean single JSON object
      expect(cleanAndParseJsonText('Prefix text {"valid": true} suffix text')).toEqual({ valid: true });

      // Invalid JSON syntax
      expect(cleanAndParseJsonText('{ invalid json string }')).toBeNull();
    });
  });
});

