import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, { PHARMACIST_SYSTEM_PROMPT, GEMINI_RESPONSE_SCHEMA } from '../worker/src/index';

describe('Cloudflare Worker (/worker/src/index.ts)', () => {
  const mockEnv = {
    GEMINI_API_KEY: 'test-api-key-123',
    GEMINI_MODEL: 'gemini-3.8-flash'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
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
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
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

  it('sanitizes API keys and sensitive tokens from error detail without exposing them', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response('Error connecting with key AIzaSyD1234567890abcdefghijklmnopqrstuv in query', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
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
    expect(data.detail).toContain('[REDACTED_KEY]');
  });

  it('retries without thinkingConfig if Gemini returns 400 mentioning thinking', async () => {
    let callCount = 0;
    let capturedBodies: any[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
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
    expect(data.error_code).toBe('RATE_LIMIT_EXCEEDED');
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
    expect(data11.error_code).toBe('RATE_LIMIT_EXCEEDED');
    expect(data11.retake_message).toContain('10 تحليلات في الدقيقة');
  });
});
