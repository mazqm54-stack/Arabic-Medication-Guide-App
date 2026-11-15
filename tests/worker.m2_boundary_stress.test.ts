import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, {
  fallbackRateLimitMap,
  sanitizeMessage,
  cleanAndParseJsonText,
  parseUpstreamError,
  PRESCRIPTION_SYSTEM_PROMPT,
  PRESCRIPTION_RESPONSE_SCHEMA
} from '../worker/src/index';

describe('Empirical Adversarial Stress Harness: M2 Worker Contract & Boundary Testing', () => {
  const secretApiKey = 'AIzaSyChallenger2BoundaryStressSecret999';
  const defaultEnv = {
    GEMINI_API_KEY: secretApiKey,
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    fallbackRateLimitMap.clear();
  });

  // =========================================================================
  // 1. Payload Limits & Malformed Input Robustness
  // =========================================================================
  describe('1. Payload Limits & Malformed Input Robustness', () => {
    it('accepts payload at exact 4MB limit (4 * 1024 * 1024 chars)', async () => {
      // 4MB string
      const exact4MbImage = 'A'.repeat(4 * 1024 * 1024);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: '4MB OK' }) }] } }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: exact4MbImage })
      });

      const response = await worker.fetch(request, defaultEnv);
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.is_clear).toBe(true);
      expect(data.evidence_text).toBe('4MB OK');
    });

    it('rejects payload exceeding 4MB by 1 char with HTTP 413 PAYLOAD_TOO_LARGE', async () => {
      const over4MbImage = 'A'.repeat(4 * 1024 * 1024 + 1);

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: over4MbImage })
      });

      const response = await worker.fetch(request, defaultEnv);
      expect(response.status).toBe(413);

      const data = await response.json() as any;
      expect(data.error).toBe('PAYLOAD_TOO_LARGE');
      expect(data.error_code).toBe('PAYLOAD_TOO_LARGE');
      expect(data.is_clear).toBe(false);
      expect(data.retake_message).toContain('4 ميجابايت');
    });

    it('rejects non-string and invalid image property types with HTTP 400 BAD_REQUEST', async () => {
      const invalidImagePayloads = [
        { image: null },
        { image: 123456 },
        { image: true },
        { image: false },
        { image: [] },
        { image: {} },
        { image: '' },
        { image: '   \n\t  ' }
      ];

      for (const payload of invalidImagePayloads) {
        const request = new Request('https://worker.local/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const response = await worker.fetch(request, defaultEnv);
        expect(response.status).toBe(400);

        const data = await response.json() as any;
        expect(data.error).toBe('BAD_REQUEST');
        expect(data.error_code).toBe('BAD_REQUEST');
        expect(data.is_clear).toBe(false);
        expect(data.retake_message).toContain('لم يتم استلام صورة علبة الدواء');
      }
    });

    it('returns prescription-specific retake message when image is missing on /api/prescription', async () => {
      const request = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'prescription' })
      });

      const response = await worker.fetch(request, defaultEnv);
      expect(response.status).toBe(400);

      const data = await response.json() as any;
      expect(data.error_code).toBe('BAD_REQUEST');
      expect(data.retake_message).toContain('لم يتم استلام صورة الروشتة');
    });

    it('returns HTTP 400 BAD_REQUEST when request body contains malformed JSON syntax', async () => {
      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ "image": "valid", "unclosed_bracket": '
      });

      const response = await worker.fetch(request, defaultEnv);
      expect(response.status).toBe(400);

      const data = await response.json() as any;
      expect(data.error).toBe('BAD_REQUEST');
      expect(data.error_code).toBe('BAD_REQUEST');
      expect(data.is_clear).toBe(false);
      expect(data.retake_message).toContain('صيغة الطلب غير صالحة');
    });

    it('validates /details endpoint requiring non-empty medicine_name', async () => {
      const invalidDetailsPayloads = [
        {},
        { medicine_name: '' },
        { medicine_name: '   ' },
        { medicine_name: 123 },
        { medicine_name: null }
      ];

      for (const payload of invalidDetailsPayloads) {
        const request = new Request('https://worker.local/api/details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const response = await worker.fetch(request, defaultEnv);
        expect(response.status).toBe(400);

        const data = await response.json() as any;
        expect(data.error_code).toBe('BAD_REQUEST');
        expect(data.retake_message).toContain('يرجى إرسال اسم الدواء لعرض التفاصيل');
      }
    });

    it('correctly defaults and sanitizes MIME types', async () => {
      let capturedInlineData: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
        const parsed = JSON.parse(init.body);
        capturedInlineData = parsed.contents[0].parts[1].inlineData;
        return new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'OK' }) }] } }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      // 1. Default when omitted
      const req1 = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64sample' })
      });
      await worker.fetch(req1, defaultEnv);
      expect(capturedInlineData.mimeType).toBe('image/jpeg');

      // 2. Custom valid mimeType
      const req2 = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64sample', mimeType: 'image/png' })
      });
      await worker.fetch(req2, defaultEnv);
      expect(capturedInlineData.mimeType).toBe('image/png');

      // 3. Empty or whitespace mimeType falls back safely to image/jpeg
      const req3 = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64sample', mimeType: '   ' })
      });
      await worker.fetch(req3, defaultEnv);
      expect(capturedInlineData.mimeType).toBe('image/jpeg');
    });

    it('handles HTTP methods properly: OPTIONS (204 CORS), GET /health (200), other non-POST (405)', async () => {
      // OPTIONS
      const optionsReq = new Request('https://worker.local/api/prescription', { method: 'OPTIONS' });
      const optionsRes = await worker.fetch(optionsReq, defaultEnv);
      expect(optionsRes.status).toBe(204);
      expect(optionsRes.headers.get('Access-Control-Allow-Methods')).toContain('POST');

      // GET /health
      const healthReq = new Request('https://worker.local/health', { method: 'GET' });
      const healthRes = await worker.fetch(healthReq, defaultEnv);
      expect(healthRes.status).toBe(200);
      const healthData = await healthRes.json() as any;
      expect(healthData.status).toBe('ok');
      expect(healthData.prescriptionModel).toBe('gemini-3.8-flash');
      expect(healthData.hasApiKey).toBe(true);

      // GET /api/analyze -> 405 Method Not Allowed
      const getReq = new Request('https://worker.local/api/analyze', { method: 'GET' });
      const getRes = await worker.fetch(getReq, defaultEnv);
      expect(getRes.status).toBe(405);
      expect(getRes.headers.get('Allow')).toContain('POST');
      const getData = await getRes.json() as any;
      expect(getData.error_code).toBe('METHOD_NOT_ALLOWED');
    });
  });

  // =========================================================================
  // 2. Concurrency & Rate Limiting (10 req/min)
  // =========================================================================
  describe('2. Concurrency & Rate Limiting (10 req/min)', () => {
    it('allows up to 10 requests per minute and blocks the 11th request with HTTP 429', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'OK' }) }] } }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const targetIp = '203.0.113.42';

      // Send 10 valid requests
      for (let i = 1; i <= 10; i++) {
        const req = new Request('https://worker.local/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': targetIp
          },
          body: JSON.stringify({ image: 'validSample' })
        });
        const res = await worker.fetch(req, defaultEnv);
        expect(res.status).toBe(200);
      }

      // 11th request must receive 429 RATE_LIMIT_EXCEEDED
      const blockedReq = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': targetIp
        },
        body: JSON.stringify({ image: 'validSample' })
      });
      const blockedRes = await worker.fetch(blockedReq, defaultEnv);
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get('Retry-After')).toBe('60');

      const data = await blockedRes.json() as any;
      expect(data.error_code).toBe('RATE_LIMIT_EXCEEDED');
      expect(data.retake_message).toContain('10 تحليلات في الدقيقة');
    });

    it('isolates rate limits per client IP (different IPs do not block each other)', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'OK' }) }] } }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const ip1 = '198.51.100.1';
      const ip2 = '198.51.100.2';

      // Exhaust IP1's quota
      for (let i = 0; i < 10; i++) {
        const req = new Request('https://worker.local/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip1 },
          body: JSON.stringify({ image: 'sample' })
        });
        await worker.fetch(req, defaultEnv);
      }

      // Verify IP1 is blocked
      const reqIp1Blocked = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip1 },
        body: JSON.stringify({ image: 'sample' })
      });
      const resIp1 = await worker.fetch(reqIp1Blocked, defaultEnv);
      expect(resIp1.status).toBe(429);

      // Verify IP2 is NOT blocked and succeeds cleanly
      const reqIp2 = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip2 },
        body: JSON.stringify({ image: 'sample' })
      });
      const resIp2 = await worker.fetch(reqIp2, defaultEnv);
      expect(resIp2.status).toBe(200);
    });

    it('handles concurrent bursts: exactly 10 succeed and excess are rate-limited', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        // small delay to simulate concurrent inflight processing
        await new Promise((r) => setTimeout(r, 5));
        return new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'Burst OK' }) }] } }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const burstIp = '10.0.0.99';
      const promises = Array.from({ length: 15 }, () => {
        const req = new Request('https://worker.local/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': burstIp },
          body: JSON.stringify({ image: 'burstSample' })
        });
        return worker.fetch(req, defaultEnv);
      });

      const responses = await Promise.all(promises);
      const statuses = responses.map((r) => r.status);
      const count200 = statuses.filter((s) => s === 200).length;
      const count429 = statuses.filter((s) => s === 429).length;

      expect(count200).toBe(10);
      expect(count429).toBe(5);
    });

    it('purges expired records when fallbackRateLimitMap exceeds 500 entries', async () => {
      const pastTime = Date.now() - 10000;
      // Seed map with 501 expired entries
      for (let i = 0; i < 505; i++) {
        fallbackRateLimitMap.set(`10.10.${Math.floor(i / 256)}.${i % 256}`, {
          count: 10,
          resetTime: pastTime
        });
      }

      expect(fallbackRateLimitMap.size).toBeGreaterThan(500);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'GC OK' }) }] } }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      // Next request will trigger map cleanup
      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
        body: JSON.stringify({ image: 'sample' })
      });

      const res = await worker.fetch(req, defaultEnv);
      expect(res.status).toBe(200);

      // Expired entries should have been pruned
      expect(fallbackRateLimitMap.size).toBe(1);
    });

    it('falls back seamlessly to in-memory rate limiter when env.RATE_LIMITER throws', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'OK' }) }] } }]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const faultyLimiterEnv = {
        ...defaultEnv,
        RATE_LIMITER: {
          limit: vi.fn().mockRejectedValue(new Error('Cloudflare RateLimiter internal binding failure'))
        }
      };

      const testIp = '192.168.1.50';

      // Send 10 requests that encounter limiter throw
      for (let i = 0; i < 10; i++) {
        const req = new Request('https://worker.local/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': testIp },
          body: JSON.stringify({ image: 'sample' })
        });
        const res = await worker.fetch(req, faultyLimiterEnv);
        expect(res.status).toBe(200);
      }

      // 11th request must be blocked by the in-memory fallback
      const req11 = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': testIp },
        body: JSON.stringify({ image: 'sample' })
      });
      const res11 = await worker.fetch(req11, faultyLimiterEnv);
      expect(res11.status).toBe(429);
      const data = await res11.json() as any;
      expect(data.error_code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  // =========================================================================
  // 3. Upstream Timeout (25s) & thinkingConfig Fallbacks
  // =========================================================================
  describe('3. Upstream Timeout (25s) & thinkingConfig Fallbacks', () => {
    it('returns HTTP 504 UPSTREAM_TIMEOUT when upstream aborts on timeout', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
        // Simulate fetch listening to signal and aborting
        const signal = init.signal as AbortSignal;
        return new Promise((_, reject) => {
          const timeoutErr = new DOMException('Upstream Gemini request timed out after 25 seconds', 'TimeoutError');
          if (signal?.aborted) {
            reject(timeoutErr);
          } else {
            signal?.addEventListener('abort', () => reject(timeoutErr));
            // Trigger abort immediately for test
            reject(timeoutErr);
          }
        });
      });

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sample', mode: 'prescription' })
      });

      const res = await worker.fetch(req, defaultEnv);
      expect(res.status).toBe(504);

      const data = await res.json() as any;
      expect(data.error).toBe('UPSTREAM_TIMEOUT');
      expect(data.error_code).toBe('UPSTREAM_TIMEOUT');
      expect(data.upstream_status).toBe(504);
      expect(data.is_clear).toBe(false);
      expect(data.detail).toContain('timed out after 25 seconds');
      expect(data.retake_message).toContain('25 ثانية');
    });

    it('retries without thinkingConfig when upstream HTTP 400 mentions thinking', async () => {
      let callCount = 0;
      const capturedPayloads: any[] = [];

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
        callCount++;
        const parsed = JSON.parse(init.body);
        capturedPayloads.push(parsed);

        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              error: {
                code: 400,
                message: 'Invalid argument: thinkingConfig is not supported for this model version',
                status: 'INVALID_ARGUMENT'
              }
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        is_clear: true,
                        deduced_condition: 'التهاب رئوي',
                        items: [
                          {
                            line_text_as_written: 'Clarithromycin 500',
                            is_confirmed: true,
                            status: 'confirmed',
                            medicine_name_ar: 'كلاريثروميسين',
                            medicine_name_en: 'Clarithromycin',
                            active_ingredient: 'كلاريثروميسين',
                            confidence: 'high',
                            written_instructions: 'قرص كل 12 ساعة',
                            short_explanation: 'مضاد حيوي'
                          }
                        ]
                      })
                    }
                  ]
                }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sample', mode: 'prescription' })
      });

      const res = await worker.fetch(req, defaultEnv);
      expect(callCount).toBe(2);
      expect(capturedPayloads[0].generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
      expect(capturedPayloads[1].generationConfig.thinkingConfig).toBeUndefined();

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.is_clear).toBe(true);
      expect(data.deduced_condition).toBe('التهاب رئوي');
      expect(data.items[0].medicine_name_ar).toBe('كلاريثروميسين');
    });

    it('does NOT include thinkingConfig for lite models (gemini-3.5-flash-lite)', async () => {
      let capturedPayload: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
        capturedPayload = JSON.parse(init.body);
        return new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'Lite OK' }) }] } }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sample' })
      });

      const liteEnv = {
        GEMINI_API_KEY: 'test-key',
        GEMINI_MODEL: 'gemini-3.5-flash-lite'
      };

      const res = await worker.fetch(req, liteEnv);
      expect(res.status).toBe(200);
      // For lite models, thinkingConfig should be completely omitted
      expect(capturedPayload.generationConfig.thinkingConfig).toBeUndefined();
    });

    it('does not retry when HTTP 400 is unrelated to thinkingConfig', async () => {
      let callCount = 0;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        return new Response(
          JSON.stringify({
            error: {
              code: 400,
              message: 'Invalid argument: Image decode failed',
              status: 'INVALID_ARGUMENT'
            }
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sample', mode: 'prescription' })
      });

      const res = await worker.fetch(req, defaultEnv);
      expect(callCount).toBe(1);
      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_BAD_REQUEST');
    });
  });

  // =========================================================================
  // 4. Secret Sanitization Under Adversarial Payloads
  // =========================================================================
  describe('4. Secret Sanitization Under Adversarial Payloads', () => {
    it('sanitizes URL query keys, raw API keys, Authorization headers, and base64 bloat', () => {
      const sensitiveInput = `
        Error in https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q
        Header: x-goog-api-key: AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q
        Auth: authorization: bearer ya29.a0AfH6SMCustomSecretOAuthTokenString
        Data: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==
        Inline: "inlineData": "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl9gYQ=="
      `;

      const sanitized = sanitizeMessage(sensitiveInput);

      expect(sanitized).not.toContain('AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q');
      expect(sanitized).not.toContain('ya29.a0AfH6SMCustomSecretOAuthTokenString');
      expect(sanitized).not.toContain('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ');
      expect(sanitized).toContain('[REDACTED_KEY]');
      expect(sanitized).toContain('[REDACTED_TOKEN]');
      expect(sanitized).toContain('[REDACTED_BASE64]');
      expect(sanitized.length).toBeLessThanOrEqual(300);
    });

    it('ensures API key in upstream 500 error response is never reflected to client', async () => {
      const upstreamErrorWithKey = JSON.stringify({
        error: {
          code: 500,
          message: `Internal backend failure for key AIzaSyChallenger2BoundaryStressSecret999 during processing`
        }
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(upstreamErrorWithKey, { status: 500, headers: { 'Content-Type': 'application/json' } })
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sample', mode: 'prescription' })
      });

      const res = await worker.fetch(req, defaultEnv);
      expect(res.status).toBe(500);

      const data = await res.json() as any;
      expect(data.detail).not.toContain('AIzaSyChallenger2BoundaryStressSecret999');
      expect(data.detail).toContain('[REDACTED_KEY]');
    });

    it('ensures API key in unexpected runtime exceptions is never reflected to client', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error(`Fetch failed connecting to Gemini with API key AIzaSyChallenger2BoundaryStressSecret999`)
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sample', mode: 'prescription' })
      });

      const res = await worker.fetch(req, defaultEnv);
      expect(res.status).toBe(500);

      const data = await res.json() as any;
      expect(data.error_code).toBe('INTERNAL_SERVER_ERROR');
      expect(data.detail).not.toContain('AIzaSyChallenger2BoundaryStressSecret999');
      expect(data.detail).toContain('[REDACTED_KEY]');
    });
  });

  // =========================================================================
  // 5. Upstream Status Code Mappings & Edge Cases
  // =========================================================================
  describe('5. Upstream Status Code Mappings & Edge Cases', () => {
    it('maps 503 to UPSTREAM_OVERLOADED (HTTP 503)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: 503, message: 'The model is overloaded' } }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sample', mode: 'prescription' })
      });

      const res = await worker.fetch(req, defaultEnv);
      expect(res.status).toBe(503);
      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_OVERLOADED');
      expect(data.upstream_status).toBe(503);
    });

    it('maps 429 to UPSTREAM_RATE_LIMIT (HTTP 429)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: 429, message: 'Resource exhausted: rate limit exceeded' } }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sample', mode: 'prescription' })
      });

      const res = await worker.fetch(req, defaultEnv);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('60');
      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_RATE_LIMIT');
      expect(data.upstream_status).toBe(429);
    });

    it('maps location restriction errors to UPSTREAM_LOCATION_RESTRICTED (HTTP 403)', async () => {
      const locationMsgs = [
        'User location is not supported for the API use',
        'Service is not available in your region or country',
        'Request failed_precondition: country not supported'
      ];

      for (const msg of locationMsgs) {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
          new Response(
            JSON.stringify({ error: { code: 400, message: msg } }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        );

        const req = new Request('https://worker.local/api/prescription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: 'sample', mode: 'prescription' })
        });

        const res = await worker.fetch(req, defaultEnv);
        expect(res.status).toBe(403);
        const data = await res.json() as any;
        expect(data.error_code).toBe('UPSTREAM_LOCATION_RESTRICTED');
      }
    });

    it('handles candidate text missing with NO_CANDIDATE_TEXT response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [] } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sample', mode: 'prescription' })
      });

      const res = await worker.fetch(req, defaultEnv);
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.is_clear).toBe(false);
      expect(data.error_code).toBe('NO_CANDIDATE_TEXT');
      expect(data.items).toEqual([]);
      expect(data.deduced_condition).toBe('');
    });

    it('handles unparseable candidate text with INVALID_JSON response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: 'Here is your prescription: { unclosed json ...' }] } }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sample', mode: 'prescription' })
      });

      const res = await worker.fetch(req, defaultEnv);
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.is_clear).toBe(false);
      expect(data.error_code).toBe('INVALID_JSON');
      expect(data.items).toEqual([]);
    });
  });

  // =========================================================================
  // 6. Prescription Normalization & Safety Bounds (M2 Strictness)
  // =========================================================================
  describe('6. Prescription Normalization & Safety Bounds (M2 Strictness)', () => {
    it('defensively strips dosages and explanations from suggested items even if upstream returns them', async () => {
      const maliciousUpstreamData = {
        is_clear: true,
        confidence: 'high',
        deduced_condition: 'ارتفاع ضغط الدم',
        items: [
          {
            line_text_as_written: 'Cap... 25',
            status: 'suggested',
            is_confirmed: false,
            medicine_name_ar: 'كابتوبريل (محتمل)',
            medicine_name_en: 'Captopril (possible)',
            active_ingredient: 'كابتوبريل',
            confidence: 'medium',
            written_instructions: 'Take 25mg twice daily before meals', // UPSTREAM LEAK!
            short_explanation: 'علاج ضغط الدم المرتفع', // UPSTREAM LEAK!
            visible_letters: 'Cap...',
            suggested_medicines: [
              { name_ar: 'كابتوبريل', name_en: 'Captopril', confidence: 'medium' }
            ]
          }
        ]
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify(maliciousUpstreamData) }] } }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sample', mode: 'prescription' })
      });

      const res = await worker.fetch(req, defaultEnv);
      const data = await res.json() as any;
      const item = data.items[0];

      // Defensively forced empty:
      expect(item.written_instructions).toBe('');
      expect(item.short_explanation).toBe('');
      expect(item.warning_note).toContain('محتمل، غير مؤكد - اسأل الصيدلي');
    });

    it('caps suggested_medicines array to maximum 2 items', async () => {
      const excessiveSuggestionsData = {
        is_clear: true,
        deduced_condition: 'عدوى بكتيرية',
        items: [
          {
            line_text_as_written: 'A... 500',
            status: 'suggested',
            is_confirmed: false,
            medicine_name_ar: 'أموكسيسيلين',
            medicine_name_en: 'Amoxicillin',
            active_ingredient: 'أموكسيسيلين',
            confidence: 'medium',
            visible_letters: 'A...',
            suggested_medicines: [
              { name_ar: 'أموكسيسيلين', name_en: 'Amoxicillin', confidence: 'medium' },
              { name_ar: 'أوجمنتين', name_en: 'Augmentin', confidence: 'medium' },
              { name_ar: 'أمبيسيلين', name_en: 'Ampicillin', confidence: 'low' },
              { name_ar: 'أزيثروميسين', name_en: 'Azithromycin', confidence: 'low' }
            ]
          }
        ]
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify(excessiveSuggestionsData) }] } }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sample', mode: 'prescription' })
      });

      const res = await worker.fetch(req, defaultEnv);
      const data = await res.json() as any;
      const item = data.items[0];

      expect(item.suggested_medicines.length).toBe(2);
      expect(item.suggested_medicines[0].name_en).toBe('Amoxicillin');
      expect(item.suggested_medicines[1].name_en).toBe('Augmentin');
    });

    it('handles markdown wrapped JSON with preamble and postamble cleanly', () => {
      const rawText = `
        Here is the JSON response:
        \`\`\`json
        {
          "is_clear": true,
          "confidence": "high",
          "evidence_text": "Amoxil 500",
          "items": [
            {
              "line_text_as_written": "Amoxil 500",
              "is_confirmed": true,
              "status": "confirmed",
              "medicine_name_ar": "أموكسيل",
              "medicine_name_en": "Amoxil",
              "active_ingredient": "أموكسيسيلين",
              "confidence": "high",
              "written_instructions": "1x3",
              "short_explanation": "مضاد حيوي"
            }
          ]
        }
        \`\`\`
        Hope this was helpful!
      `;

      const parsed = cleanAndParseJsonText(rawText);
      expect(parsed).toBeDefined();
      expect(parsed.is_clear).toBe(true);
      expect(parsed.items[0].medicine_name_en).toBe('Amoxil');
    });
  });

  // =========================================================================
  // 7. Prompt, Schema & Upstream Error Parser Direct Contract Stress
  // =========================================================================
  describe('7. Prompt, Schema & Upstream Error Parser Direct Contract Stress', () => {
    it('verifies parseUpstreamError boundary parsing (HTML, empty strings, non-string messages)', () => {
      // 1. Empty raw text
      const emptyRes = parseUpstreamError('', 502);
      expect(emptyRes.detail).toBe('Gemini API returned HTTP 502');
      expect(emptyRes.isLocationBlocked).toBe(false);

      // 2. HTML text
      const htmlRes = parseUpstreamError('<html><body><h1>502 Bad Gateway</h1></body></html>', 502);
      expect(htmlRes.detail).toContain('502 Bad Gateway');
      expect(htmlRes.detail).not.toContain('<');

      // 3. JSON with non-string message
      const nonStringRes = parseUpstreamError(JSON.stringify({ error: { message: 12345 } }), 400);
      expect(nonStringRes.detail).toContain('400');

      // 4. Location blocking detection
      const locRes = parseUpstreamError('User location is not supported for the api use', 400);
      expect(locRes.isLocationBlocked).toBe(true);
    });

    it('verifies PRESCRIPTION_SYSTEM_PROMPT safety clauses and clinical rules', () => {
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/Read ONLY what is actually written/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/STRICT SAFETY MANDATE: NEVER provide dosages/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/deduced_condition/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/suggest up to two potential medicines/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/status='unclear'/i);
    });

    it('verifies PRESCRIPTION_RESPONSE_SCHEMA includes M2 required properties', () => {
      expect(PRESCRIPTION_RESPONSE_SCHEMA.properties).toHaveProperty('deduced_condition');
      const itemProps = (PRESCRIPTION_RESPONSE_SCHEMA.properties.items.items as any).properties;
      expect(itemProps).toHaveProperty('is_confirmed');
      expect(itemProps).toHaveProperty('status');
      expect(itemProps.status.enum).toEqual(['confirmed', 'suggested', 'unclear']);
      expect(itemProps).toHaveProperty('suggested_medicines');
      expect(itemProps.suggested_medicines.items.required).toEqual(['name_ar', 'name_en', 'confidence']);
    });
  });
});

