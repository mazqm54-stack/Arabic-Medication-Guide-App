import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, {
  PHARMACIST_SYSTEM_PROMPT,
  GEMINI_RESPONSE_SCHEMA,
  PRESCRIPTION_SYSTEM_PROMPT,
  PRESCRIPTION_RESPONSE_SCHEMA,
  MEDICINE_DETAILS_SYSTEM_PROMPT,
  fallbackRateLimitMap
} from '../worker/src/index';

describe('Cloudflare Worker (/worker/src/index.ts)', () => {
  const mockEnv = {
    GEMINI_API_KEY: 'test-api-key-123',
    GEMINI_MODEL: 'gemini-3.8-flash'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    fallbackRateLimitMap.clear();
  });

  it('handles CORS OPTIONS preflight request with 204 and CORS headers', async () => {
    const request = new Request('https://worker.local/api/analyze', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST'
      }
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('handles GET health check cleanly', async () => {
    const request = new Request('https://worker.local/health', {
      method: 'GET'
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.status).toBe('ok');
    expect(data.hasApiKey).toBe(true);
  });

  it('rejects unsupported HTTP methods (e.g. PUT) with 405', async () => {
    const request = new Request('https://worker.local/api/analyze', {
      method: 'PUT'
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(405);
    const data = await response.json() as any;
    expect(data.error).toBe('METHOD_NOT_ALLOWED');
    expect(data.error_code).toBe('METHOD_NOT_ALLOWED');
  });

  it('validates request payload and rejects empty/missing image with 400', async () => {
    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(400);
    const data = await response.json() as any;
    expect(data.error).toBe('BAD_REQUEST');
    expect(data.error_code).toBe('BAD_REQUEST');
  });

  it('rejects payload exceeding 4MB with 413 PAYLOAD_TOO_LARGE', async () => {
    const hugeImage = 'A'.repeat(5 * 1024 * 1024);
    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: hugeImage })
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(413);
    const data = await response.json() as any;
    expect(data.error).toBe('PAYLOAD_TOO_LARGE');
    expect(data.error_code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('returns 500 if GEMINI_API_KEY is not configured in Worker secrets', async () => {
    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'valid-base64-string' })
    });

    const response = await worker.fetch(request, { GEMINI_API_KEY: '' });
    expect(response.status).toBe(500);
    const data = await response.json() as any;
    expect(data.error).toBe('SERVER_CONFIGURATION_ERROR');
    expect(data.error_code).toBe('SERVER_CONFIGURATION_ERROR');
    expect(data.detail).toContain('GEMINI_API_KEY');
  });

  it('verifies exact system prompt and schema definitions', () => {
    expect(PHARMACIST_SYSTEM_PROMPT).toContain('You are an expert pharmacist assistant for elderly Arabic-speaking users');
    expect(PHARMACIST_SYSTEM_PROMPT).toContain('STRICT RULES:');
    expect(PHARMACIST_SYSTEM_PROMPT).toContain('evidence_text');
    expect(GEMINI_RESPONSE_SCHEMA.properties.confidence.enum).toEqual(['high', 'medium', 'low']);
  });

  it('correctly normalizes models/ prefix, omits deprecated temperature for Gemini 3.8 Flash, and includes thinkingLevel LOW', async () => {
    let capturedUrl = '';
    let capturedBody: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(init.body);
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                is_clear: true,
                retake_message: '',
                confidence: 'high',
                evidence_text: 'PANADOL 500mg',
                medicine_name_ar: 'بانادول',
                medicine_name_en: 'Panadol',
                active_ingredient: 'باراسيتامول',
                uses: ['مسكن'],
                how_and_when: ['بعد الأكل'],
                warnings: ['استشر الطبيب'],
                audio_summary: 'بانادول مسكن للألم'
              })
            }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64sample' })
    });

    // Provide model with "models/" prefix
    const response = await worker.fetch(request, {
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: 'models/gemini-3.8-flash'
    });

    expect(response.status).toBe(200);
    // Verify no models/models/
    expect(capturedUrl).toContain('/models/gemini-3.8-flash:generateContent');
    expect(capturedUrl).not.toContain('/models/models/');
    // Verify temperature is omitted for Gemini 3.8 Flash and thinkingLevel LOW is set
    expect(capturedBody.generationConfig.temperature).toBeUndefined();
    expect(capturedBody.generationConfig.thinkingConfig.thinkingLevel).toBe('LOW');

    const data = await response.json() as any;
    expect(data.error_code).toBeNull();
  });

  it('retains temperature: 0 when using legacy non-Gemini 3 model (e.g. gemini-1.5-flash)', async () => {
    let capturedBody: any = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
      capturedBody = JSON.parse(init.body);
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'OK' }) }] } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64sample' })
    });

    await worker.fetch(request, {
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: 'gemini-1.5-flash'
    });

    expect(capturedBody.generationConfig.temperature).toBe(0);
  });

  it('translates upstream Gemini HTTP 503 to safe UPSTREAM_OVERLOADED error with upstream_status and detail', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        error: {
          code: 503,
          message: 'The model is overloaded. Please try again later.',
          status: 'UNAVAILABLE'
        }
      }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    });

    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64sample' })
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(503);
    const data = await response.json() as any;
    expect(data.is_clear).toBe(false);
    expect(data.error_code).toBe('UPSTREAM_OVERLOADED');
    expect(data.upstream_status).toBe(503);
    expect(data.detail).toContain('503');
    expect(data.detail).toContain('The model is overloaded');
    expect(data.retake_message).toContain('تحت ضغط مؤقت');
  });

  it('translates upstream Gemini HTTP 429 to safe UPSTREAM_RATE_LIMIT error with Retry-After', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        error: {
          code: 429,
          message: 'Resource has been exhausted (e.g. check quota).'
        }
      }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    });

    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64sample' })
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    const data = await response.json() as any;
    expect(data.error_code).toBe('UPSTREAM_RATE_LIMIT');
    expect(data.upstream_status).toBe(429);
    expect(data.detail).toContain('429');
    expect(data.retake_message).toContain('حد الطلبات');
  });

  it('detects upstream location restriction and returns UPSTREAM_LOCATION_RESTRICTED (403)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        error: {
          code: 400,
          message: 'User location is not supported for the API use.',
          status: 'FAILED_PRECONDITION'
        }
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    });

    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64sample' })
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(403);
    const data = await response.json() as any;
    expect(data.error_code).toBe('UPSTREAM_LOCATION_RESTRICTED');
    expect(data.upstream_status).toBe(400);
    expect(data.detail).toContain('User location is not supported');
    expect(data.retake_message).toContain('النطاق الجغرافي');
  });

  it('translates upstream Gemini HTTP 400 bad request to UPSTREAM_BAD_REQUEST error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        error: {
          code: 400,
          message: 'Invalid argument: invalid schema definition.',
          status: 'INVALID_ARGUMENT'
        }
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    });

    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64sample' })
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(400);
    const data = await response.json() as any;
    expect(data.is_clear).toBe(false);
    expect(data.error_code).toBe('UPSTREAM_BAD_REQUEST');
    expect(data.upstream_status).toBe(400);
    expect(data.detail).toContain('Invalid argument');
    expect(data.retake_message).toContain('خطأ في صياغة طلب التحليل');
  });

  it('sanitizes API keys, secrets, and image data from error detail without exposing them', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        'Error connecting with key AIzaSyD1234567890abcdefghijklmnopqrstuv and ?key=AIzaSyD9876543210zyxwvutsrqponmlkjihgfed and inlineData payload /9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        {
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        }
      );
    });

    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64sample' })
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(500);
    const data = await response.json() as any;
    expect(data.error_code).toBe('UPSTREAM_API_ERROR');
    expect(data.detail).not.toContain('AIzaSyD1234567890abcdefghijklmnopqrstuv');
    expect(data.detail).not.toContain('AIzaSyD9876543210zyxwvutsrqponmlkjihgfed');
    expect(data.detail).not.toContain('2wBDAP//////////////////////////////////////////////////////////////////////////////////////');
    expect(data.detail).toContain('[REDACTED_KEY]');
  });

  it('retries without thinkingConfig if Gemini returns 400 mentioning thinking', async () => {
    let callCount = 0;
    let capturedBodies: any[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
      callCount++;
      capturedBodies.push(JSON.parse(init.body));
      if (callCount === 1) {
        return new Response(JSON.stringify({
          error: { code: 400, message: 'Invalid argument: thinkingConfig is not supported' }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                is_clear: true,
                retake_message: '',
                confidence: 'high',
                evidence_text: 'PANADOL',
                medicine_name_ar: 'بانادول',
                medicine_name_en: 'Panadol',
                active_ingredient: 'باراسيتامول',
                uses: ['مسكن'],
                how_and_when: ['قرص'],
                warnings: ['تحذير'],
                audio_summary: 'ملخص'
              })
            }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64sample' })
    });

    const response = await worker.fetch(request, mockEnv);
    expect(callCount).toBe(2);
    expect(capturedBodies[0].generationConfig.thinkingConfig).toBeDefined();
    expect(capturedBodies[1].generationConfig.thinkingConfig).toBeUndefined();
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.is_clear).toBe(true);
    expect(data.error_code).toBeNull();
  });

  it('enforces Cloudflare rate limiter binding with 429 and Retry-After 60', async () => {
    const rateLimiterMock = {
      limit: vi.fn().mockResolvedValue({ success: false })
    };

    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-connecting-ip': '192.168.1.100'
      },
      body: JSON.stringify({ image: 'base64sample' })
    });

    const response = await worker.fetch(request, {
      ...mockEnv,
      RATE_LIMITER: rateLimiterMock
    });

    expect(rateLimiterMock.limit).toHaveBeenCalledWith({ key: '192.168.1.100' });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');

    const data = await response.json() as any;
    expect(data.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(data.retake_message).toContain('10 تحليلات في الدقيقة');
  });

  it('enforces in-memory fallback rate limit on 11th request per minute', async () => {
    const ip = '10.0.0.50';

    // Send 10 valid requests (mock upstream fetch)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                is_clear: true,
                retake_message: '',
                confidence: 'high',
                evidence_text: 'TEST 500mg',
                medicine_name_ar: 'دواء تجريبي',
                medicine_name_en: 'Test Med',
                active_ingredient: 'مادة تجريبية',
                uses: ['مسكن'],
                how_and_when: ['مرة يومياً'],
                warnings: ['استشر الطبيب'],
                audio_summary: 'دواء تجريبي'
              })
            }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    for (let i = 0; i < 10; i++) {
      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': ip
        },
        body: JSON.stringify({ image: 'base64sample' })
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(200);
    }

    // 11th request from same IP should be blocked
    const req11 = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-connecting-ip': ip
      },
      body: JSON.stringify({ image: 'base64sample' })
    });
    const res11 = await worker.fetch(req11, mockEnv);
    expect(res11.status).toBe(429);
    expect(res11.headers.get('Retry-After')).toBe('60');

    const data11 = await res11.json() as any;
    expect(data11.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(data11.retake_message).toContain('10 تحليلات في الدقيقة');
  });

  it('verifies box schema includes usage_source and Rule 6 allows common usage', () => {
    expect(PHARMACIST_SYSTEM_PROMPT).toContain('how_and_when must NEVER be empty');
    expect(PHARMACIST_SYSTEM_PROMPT).toContain("usage_source='printed'");
    expect(PHARMACIST_SYSTEM_PROMPT).toContain("usage_source='common'");
    expect(GEMINI_RESPONSE_SCHEMA.properties.usage_source.enum).toEqual(['printed', 'common']);
    expect(GEMINI_RESPONSE_SCHEMA.required).toContain('usage_source');
  });

  it('verifies prescription prompt and schema adhere to the 5 strict rules', () => {
    expect(PRESCRIPTION_SYSTEM_PROMPT).toContain('Read ONLY what is actually written on the prescription');
    expect(PRESCRIPTION_SYSTEM_PROMPT).toContain('NEVER guess or invent a medicine name');
    expect(PRESCRIPTION_SYSTEM_PROMPT).toContain('is_clear=false, set confidence=\'low\', leave items as an empty array []');
    expect(PRESCRIPTION_SYSTEM_PROMPT).toContain('written_instructions');
    expect(PRESCRIPTION_SYSTEM_PROMPT).toContain('short_explanation');
    expect(PRESCRIPTION_SYSTEM_PROMPT).toContain('Extract a maximum of 10 items');

    expect(PRESCRIPTION_RESPONSE_SCHEMA.properties.items.items.properties.confidence.enum).toEqual(['high', 'medium', 'low']);
    expect(PRESCRIPTION_RESPONSE_SCHEMA.properties.items.items.required).toContain('line_text_as_written');
    expect(PRESCRIPTION_RESPONSE_SCHEMA.properties.items.items.required).toContain('written_instructions');
    expect(PRESCRIPTION_RESPONSE_SCHEMA.properties.items.items.required).toContain('short_explanation');
    expect(PRESCRIPTION_RESPONSE_SCHEMA.required).toContain('items');
    expect(PRESCRIPTION_RESPONSE_SCHEMA.required).toContain('audio_summary');
  });

  it('verifies medicine details system prompt', () => {
    expect(MEDICINE_DETAILS_SYSTEM_PROMPT).toContain('return standard, safe pharmaceutical details for this medication');
    expect(MEDICINE_DETAILS_SYSTEM_PROMPT).toContain("Set usage_source='common'");
  });

  it('handles prescription route /api/prescription with valid image and returns prescription schema', async () => {
    let capturedUrl = '';
    let capturedBody: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(init.body);
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                is_clear: true,
                retake_message: '',
                confidence: 'high',
                evidence_text: 'Amoxicillin 500mg tid',
                items: [
                  {
                    line_text_as_written: 'Amoxicillin 500mg 1x3',
                    medicine_name_ar: 'أموكسيسيلين',
                    medicine_name_en: 'Amoxicillin 500mg',
                    active_ingredient: 'أموكسيسيلين',
                    confidence: 'high',
                    written_instructions: '1x3',
                    short_explanation: 'مضاد حيوي واسع المجال'
                  }
                ],
                audio_summary: 'روشتة تحتوي على أموكسيسيلين'
              })
            }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const request = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'prescription-base64-payload' })
    });

    const response = await worker.fetch(request, {
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
    });

    expect(response.status).toBe(200);
    expect(capturedUrl).toContain('/models/gemini-3.8-flash:generateContent');
    expect(capturedBody.generationConfig.thinkingConfig.thinkingLevel).toBe('LOW');
    expect(capturedBody.generationConfig.temperature).toBeUndefined();
    expect(capturedBody.systemInstruction.parts[0].text).toContain('doctor\'s medical prescription');

    const data = await response.json() as any;
    expect(data.is_clear).toBe(true);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].medicine_name_ar).toBe('أموكسيسيلين');
    expect(data.items[0].written_instructions).toBe('1x3');
    expect(data.error_code).toBeNull();
  });

  it('handles prescription mode via body mode="prescription" on /api/analyze', async () => {
    let capturedBody: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
      capturedBody = JSON.parse(init.body);
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                is_clear: true,
                retake_message: '',
                confidence: 'high',
                evidence_text: 'Congestal tab',
                items: [
                  {
                    line_text_as_written: 'Congestal tab 1x2',
                    medicine_name_ar: 'كونجستال',
                    medicine_name_en: 'Congestal',
                    active_ingredient: 'باراسيتامول، كلورفينيرامين، سودوإيفيدرين',
                    confidence: 'high',
                    written_instructions: 'قرص مرتين يومياً',
                    short_explanation: 'علاج أعراض نزلات البرد والاحتقان'
                  }
                ],
                audio_summary: 'روشتة تحتوي على كونجستال'
              })
            }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'prescription', image: 'prescription-base64-payload' })
    });

    const response = await worker.fetch(request, {
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: 'gemini-3.5-flash-lite',
      GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
    });

    expect(response.status).toBe(200);
    expect(capturedBody.systemInstruction.parts[0].text).toContain('doctor\'s medical prescription');
    const data = await response.json() as any;
    expect(data.is_clear).toBe(true);
    expect(data.items[0].medicine_name_ar).toBe('كونجستال');
  });

  it('handles medicine details mode via /api/details with text medicine_name without requiring an image', async () => {
    let capturedBody: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
      capturedBody = JSON.parse(init.body);
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                is_clear: true,
                retake_message: '',
                confidence: 'high',
                evidence_text: 'Verified database details for بانادول',
                medicine_name_ar: 'بانادول',
                medicine_name_en: 'Panadol',
                active_ingredient: 'باراسيتامول',
                uses: ['تسكين الآلام', 'خفض الحرارة'],
                how_and_when: ['يؤخذ بعد الأكل أو مع الماء', 'كل 6 إلى 8 ساعات عند اللزوم'],
                usage_source: 'common',
                warnings: ['لا تتجاوز الجرعة القصوى', 'استشر الصيدلي أو الطبيب'],
                audio_summary: 'بانادول مسكن للألم وخافض للحرارة'
              })
            }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const request = new Request('https://worker.local/api/details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicine_name: 'بانادول' })
    });

    const response = await worker.fetch(request, {
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: 'gemini-3.5-flash-lite'
    });

    expect(response.status).toBe(200);
    expect(capturedBody.contents[0].parts[0].text).toContain('Provide detailed pharmaceutical information in simple Arabic for the medicine: بانادول');
    // Ensure image inlineData is absent
    expect(capturedBody.contents[0].parts.some((p: any) => p.inlineData)).toBe(false);

    const data = await response.json() as any;
    expect(data.is_clear).toBe(true);
    expect(data.medicine_name_ar).toBe('بانادول');
    expect(data.usage_source).toBe('common');
    expect(data.how_and_when).toHaveLength(2);
  });

  it('rejects details mode with 400 BAD_REQUEST if medicine_name is missing or empty', async () => {
    const request = new Request('https://worker.local/api/details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const response = await worker.fetch(request, {
      GEMINI_API_KEY: 'test-key'
    });

    expect(response.status).toBe(400);
    const data = await response.json() as any;
    expect(data.error).toBe('BAD_REQUEST');
    expect(data.retake_message).toContain('يرجى إرسال اسم الدواء لعرض التفاصيل');
  });

  it('maps upstream fetch abort/timeout to HTTP 504 UPSTREAM_TIMEOUT with 25s error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      // Simulate timeout by throwing AbortError / TimeoutError
      const err = new DOMException('Upstream Gemini request timed out after 25 seconds', 'TimeoutError');
      throw err;
    });

    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64sample' })
    });

    const response = await worker.fetch(request, {
      GEMINI_API_KEY: 'test-key'
    });

    expect(response.status).toBe(504);
    const data = await response.json() as any;
    expect(data.is_clear).toBe(false);
    expect(data.error).toBe('UPSTREAM_TIMEOUT');
    expect(data.error_code).toBe('UPSTREAM_TIMEOUT');
    expect(data.upstream_status).toBe(504);
    expect(data.detail).toBe('Upstream Gemini request timed out after 25 seconds');
    expect(data.retake_message).toBe('استغرقت عملية التحليل وقتاً أطول من المتوقع في الخادم (25 ثانية). يرجى المحاولة مرة أخرى.');
  });

  it('ensures box mode returns usage_source in response', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                is_clear: true,
                retake_message: '',
                confidence: 'high',
                evidence_text: 'AUGMENTIN 1g',
                medicine_name_ar: 'أوجمنتين',
                medicine_name_en: 'Augmentin',
                active_ingredient: 'أموكسيسيلين + كلافولانات البوتاسيوم',
                uses: ['مضاد حيوي'],
                how_and_when: ['يؤخذ في بداية الوجبة', 'مرتين يومياً كل 12 ساعة'],
                usage_source: 'printed',
                warnings: ['استشر الطبيب للحساسية'],
                audio_summary: 'أوجمنتين مضاد حيوي'
              })
            }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64sample' })
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.usage_source).toBe('printed');
  });

  it('defaults usage_source to common if not printed', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                is_clear: true,
                retake_message: '',
                confidence: 'high',
                evidence_text: 'TEST 500mg',
                medicine_name_ar: 'دواء',
                medicine_name_en: 'Med',
                active_ingredient: 'مادة',
                uses: ['استخدام'],
                how_and_when: ['مرة يومياً'],
                warnings: ['تحذير'],
                audio_summary: 'ملخص'
              })
            }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64sample' })
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.usage_source).toBe('common');
  });

  it('omits thinkingConfig for gemini-3.5-flash-lite in box mode', async () => {
    let capturedBody: any = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
      capturedBody = JSON.parse(init.body);
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                is_clear: true,
                retake_message: '',
                confidence: 'high',
                evidence_text: 'TEST',
                medicine_name_ar: 'دواء',
                medicine_name_en: 'Med',
                active_ingredient: 'مادة',
                uses: ['استخدام'],
                how_and_when: ['مرة'],
                usage_source: 'common',
                warnings: ['تحذير'],
                audio_summary: 'ملخص'
              })
            }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const request = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64sample' })
    });

    const response = await worker.fetch(request, {
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: 'gemini-3.5-flash-lite'
    });

    expect(response.status).toBe(200);
    expect(capturedBody.generationConfig.thinkingConfig).toBeUndefined();
    expect(capturedBody.generationConfig.temperature).toBeUndefined();
  });
});

