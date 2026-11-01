import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, {
  fallbackRateLimitMap,
  sanitizeMessage,
  parseUpstreamError,
  cleanAndParseJsonText
} from '../worker/src/index';

describe('Adversarial & Stress Challenges for Cloudflare Worker', () => {
  const mockEnv = {
    GEMINI_API_KEY: 'AIzaSyD1234567890abcdefghijklmnopqrstuv',
    GEMINI_MODEL: 'gemini-3.8-flash'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    fallbackRateLimitMap.clear();
  });

  // =========================================================================
  // Challenge Suite 1: sanitizeMessage Evasion & Boundary Tests
  // =========================================================================
  describe('Challenge 1: Secret & Payload Sanitization Evasion', () => {
    it('redacts Google API keys in query params regardless of preceding/trailing params', () => {
      const inputs = [
        'https://api.google.com?key=AIzaSyD1234567890abcdefghijklmnopqrstuv',
        'https://api.google.com?param1=val&key=AIzaSyD1234567890abcdefghijklmnopqrstuv&param2=val',
        'Error at ?key=AIzaSyD1234567890abcdefghijklmnopqrstuv in query',
        'https://api.google.com?key=custom_non_aiza_key_123456789&next=1',
        'https://api.google.com?foo=1&key=custom_key_xyz&bar=2'
      ];

      for (const input of inputs) {
        const sanitized = sanitizeMessage(input);
        expect(sanitized).not.toContain('AIzaSyD1234567890abcdefghijklmnopqrstuv');
        expect(sanitized).not.toContain('custom_non_aiza_key_123456789');
        expect(sanitized).not.toContain('custom_key_xyz');
        expect(sanitized).toContain('[REDACTED_KEY]');
      }
    });

    it('redacts Google API keys appearing anywhere in plain text, JSON, or stack traces', () => {
      const raw = JSON.stringify({
        error: {
          code: 400,
          message: 'API key AIzaSyD1234567890abcdefghijklmnopqrstuv is invalid. See console.'
        }
      });
      const sanitized = sanitizeMessage(raw);
      expect(sanitized).not.toContain('AIzaSyD1234567890abcdefghijklmnopqrstuv');
      expect(sanitized).toContain('[REDACTED_KEY]');
    });

    it('redacts x-goog-api-key and Authorization headers with various casing and spacing', () => {
      const headers = [
        'x-goog-api-key: secret-header-key-12345',
        'X-Goog-Api-Key = secret-header-key-67890',
        'x-goog-api-key:   secret-with-spaces',
        'authorization: bearer ya29.a0AfH6SM-token-xyz',
        'Authorization: Bearer my-secret-bearer-token'
      ];

      for (const header of headers) {
        const sanitized = sanitizeMessage(header);
        expect(sanitized).not.toContain('secret-header-key');
        expect(sanitized).not.toContain('ya29.a0AfH6SM');
        expect(sanitized).not.toContain('my-secret-bearer-token');
      }
    });

    it('redacts long base64 image strings and data URIs', () => {
      const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
      const sanitized = sanitizeMessage(dataUri);
      expect(sanitized).not.toContain('/9j/4AAQ');
      expect(sanitized).toContain('[REDACTED_BASE64]');
    });

    it('redacts raw base64 payload strings exceeding 80 characters', () => {
      const longPayload = 'A'.repeat(120);
      const text = `Failed payload content: ${longPayload} and done.`;
      const sanitized = sanitizeMessage(text);
      expect(sanitized).not.toContain(longPayload);
      expect(sanitized).toContain('[REDACTED_PAYLOAD]');
    });

    it('handles unicode, emojis, and Arabic strings safely without corrupting text', () => {
      const arabicError = 'خطأ في استدعاء الذكاء الاصطناعي: مفتاح AIzaSyD1234567890abcdefghijklmnopqrstuv غير صالح';
      const sanitized = sanitizeMessage(arabicError);
      expect(sanitized).toContain('خطأ في استدعاء الذكاء الاصطناعي');
      expect(sanitized).not.toContain('AIzaSyD1234567890abcdefghijklmnopqrstuv');
      expect(sanitized).toContain('[REDACTED_KEY]');
    });

    it('strictly caps output to at most 300 characters', () => {
      const giantText = 'X'.repeat(1000);
      const sanitized = sanitizeMessage(giantText);
      expect(sanitized.length).toBeLessThanOrEqual(300);
    });

    it('handles null, undefined, and empty string without throwing', () => {
      expect(sanitizeMessage('')).toBe('');
      expect(sanitizeMessage(null as any)).toBe('');
      expect(sanitizeMessage(undefined as any)).toBe('');
    });
  });

  // =========================================================================
  // Challenge Suite 2: Malformed & Adversarial Upstream Gemini Errors
  // =========================================================================
  describe('Challenge 2: Upstream Error Parsing Adversarial Robustness', () => {
    it('handles HTML error pages from upstream Cloudflare or Nginx proxies cleanly', () => {
      const htmlError = `
        <!DOCTYPE html>
        <html>
        <head><title>504 Gateway Time-out</title></head>
        <body>
          <h1>504 Gateway Time-out</h1>
          <p>The server encountered a temporary error and could not complete your request.</p>
          <script>alert("evil XSS")</script>
        </body>
        </html>
      `;

      const result = parseUpstreamError(htmlError, 504);
      expect(result.detail).toContain('504');
      // Must not contain raw html tags
      expect(result.detail).not.toContain('<h1>');
      expect(result.detail).not.toContain('<script>');
      expect(result.detail).not.toContain('</script>');
      expect(result.isLocationBlocked).toBe(false);
    });

    it('handles null bytes and binary control characters in upstream error body', () => {
      const malformedBinary = 'Error\0with\x00null\x01bytes\x1fand control chars';
      const result = parseUpstreamError(malformedBinary, 500);
      expect(result.detail).toContain('500');
      expect(typeof result.detail).toBe('string');
      expect(result.isLocationBlocked).toBe(false);
    });

    it('handles truncated / malformed JSON gracefully without crashing', () => {
      const truncatedJson = '{"error": {"code": 500, "message": "Incomplete error text that was cut of';
      const result = parseUpstreamError(truncatedJson, 500);
      expect(result.detail).toContain('500');
      expect(result.detail).toContain('Incomplete error text');
    });

    it('demonstrates behavior when upstream JSON error exceeds 300 characters', () => {
      const longJsonError = JSON.stringify({
        error: {
          code: 400,
          message: 'Invalid argument: The provided image format is unsupported or corrupted.',
          status: 'INVALID_ARGUMENT',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
              reason: 'IMAGE_DECODE_FAILED',
              domain: 'generativelanguage.googleapis.com',
              metadata: {
                service: 'generativelanguage.googleapis.com',
                consumer: 'projects/1234567890'
              }
            }
          ]
        }
      });

      expect(longJsonError.length).toBeGreaterThan(300);
      const result = parseUpstreamError(longJsonError, 400);

      // Note: Because sanitizeMessage truncates at 300 chars, JSON.parse fails and falls back to raw string
      expect(result.detail).toContain('400');
    });

    it('demonstrates risk: location keywords beyond 300 chars with words/spaces are truncated before isLocationBlocked evaluation', () => {
      // Realistic preamble with words and spaces so [A-Za-z0-9+/=]{80,} doesn't collapse it
      const wordsPreamble = 'Detailed diagnostic metadata and routing information from edge proxy gateway cluster. '.repeat(5);
      const lateLocationError = `{"error":{"metadata":"${wordsPreamble}","message":"User location is not supported for the API use."}}`;
      const result = parseUpstreamError(lateLocationError, 400);

      // When the preamble exceeds 300 characters across words, sanitizeMessage truncates before reaching "message"
      expect(result.isLocationBlocked).toBe(false); // Truncation caused false negative!
    });

    it('handles upstream JSON with unexpected types (e.g. error is string or number or array)', () => {
      const jsonErrorAsString = JSON.stringify({ error: 'Just a plain string error' });
      const result1 = parseUpstreamError(jsonErrorAsString, 400);
      expect(result1.detail).toContain('400');

      const jsonErrorWithArray = JSON.stringify({ error: ['an', 'array'] });
      const result2 = parseUpstreamError(jsonErrorWithArray, 400);
      expect(result2.detail).toContain('400');

      const jsonErrorWithMessageAsNumber = JSON.stringify({ error: { message: 99999 } });
      const result3 = parseUpstreamError(jsonErrorWithMessageAsNumber, 400);
      expect(result3.detail).toContain('400');
    });

    it('accurately identifies location/region restriction across different upstream formats', () => {
      const cases = [
        { text: 'User location is not supported for the API use.', status: 400, expected: true },
        { text: 'Location not supported: Region is restricted', status: 403, expected: true },
        { text: 'Country not allowed for the service', status: 400, expected: true },
        { text: 'FAILED_PRECONDITION: Precondition check failed for location', status: 400, expected: true },
        { text: 'Random 400 error about invalid format', status: 400, expected: false },
        { text: 'User location is not supported', status: 500, expected: false } // only 400 or 403
      ];

      for (const c of cases) {
        const res = parseUpstreamError(c.text, c.status);
        expect(res.isLocationBlocked).toBe(c.expected);
      }
    });

    it('verifies Worker integration returns HTTP 403 for location blocked errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 400,
              message: 'User location is not supported for the API use.',
              status: 'FAILED_PRECONDITION'
            }
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64test' })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(403);
      const data = await response.json() as any;
      expect(data.error_code).toBe('UPSTREAM_LOCATION_RESTRICTED');
      expect(data.retake_message).toContain('النطاق الجغرافي');
      expect(data.upstream_status).toBe(400);
    });
  });

  // =========================================================================
  // Challenge Suite 3: Gemini 200 Output Parsing & Boundary Cases
  // =========================================================================
  describe('Challenge 3: Gemini Candidate Parsing & Malformed Model Output', () => {
    it('handles empty candidates array (e.g. prompt blocked by safety filters)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            promptFeedback: {
              blockReason: 'SAFETY',
              safetyRatings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'HIGH' }]
            },
            candidates: []
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64test' })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.is_clear).toBe(false);
      expect(data.error_code).toBe('NO_CANDIDATE_TEXT');
      expect(data.retake_message).toBeTruthy();
    });

    it('handles candidate with empty parts or missing text', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [] } }]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64test' })
      });

      const response = await worker.fetch(request, mockEnv);
      const data = await response.json() as any;
      expect(data.is_clear).toBe(false);
      expect(data.error_code).toBe('NO_CANDIDATE_TEXT');
    });

    it('handles model returning conversational non-JSON text', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [{
              content: {
                parts: [{ text: 'I am sorry, I cannot read the packaging in this image because it is too dark.' }]
              }
            }]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64test' })
      });

      const response = await worker.fetch(request, mockEnv);
      const data = await response.json() as any;
      expect(data.is_clear).toBe(false);
      expect(data.error_code).toBe('INVALID_JSON');
    });

    it('extracts valid JSON even when wrapped in markdown code blocks with commentary', () => {
      const commentary = `Here is the analysis of the medicine box:
\`\`\`json
{
  "is_clear": true,
  "retake_message": "",
  "confidence": "high",
  "evidence_text": "CONCOR 5mg",
  "medicine_name_ar": "كونكور",
  "medicine_name_en": "Concor 5mg",
  "active_ingredient": "بيسوبرولول",
  "uses": ["علاج ضغط الدم"],
  "how_and_when": ["قرص صباحا"],
  "warnings": ["لا تتوقف فجأة"],
  "audio_summary": "كونكور لضغط الدم"
}
\`\`\`
Hope this helps!`;

      const parsed = cleanAndParseJsonText(commentary);
      expect(parsed).not.toBeNull();
      expect(parsed.is_clear).toBe(true);
      expect(parsed.medicine_name_ar).toBe('كونكور');
      expect(parsed.medicine_name_en).toBe('Concor 5mg');
    });

    it('extracts JSON when candidate text has braces inside JSON string values', () => {
      const jsonWithInnerBraces = JSON.stringify({
        is_clear: true,
        retake_message: '',
        confidence: 'high',
        evidence_text: 'TEST {BATCH-01} 500mg',
        medicine_name_ar: 'دواء {تجريبي}',
        medicine_name_en: 'Test {01}',
        active_ingredient: 'Active',
        uses: ['Uses {general}'],
        how_and_when: ['When'],
        warnings: ['Warnings'],
        audio_summary: 'Summary'
      });

      const parsed = cleanAndParseJsonText(jsonWithInnerBraces);
      expect(parsed).not.toBeNull();
      expect(parsed.evidence_text).toBe('TEST {BATCH-01} 500mg');
    });
  });

  // =========================================================================
  // Challenge Suite 4: High-Concurrency & Rate Limiting Simulation
  // =========================================================================
  describe('Challenge 4: Rate Limiting & High-Concurrency Simulation', () => {
    it('handles 50 concurrent requests from same IP: exactly 10 allowed, 40 rejected with 429', async () => {
      const ip = '192.168.10.99';

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
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
                  how_and_when: ['قرص'],
                  warnings: ['تحذير'],
                  audio_summary: 'بانادول'
                })
              }]
            }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      const createRequest = () => new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': ip
        },
        body: JSON.stringify({ image: 'base64sample' })
      });

      // Fire 50 requests concurrently using Promise.all
      const requests = Array.from({ length: 50 }, () => createRequest());
      const responses = await Promise.all(requests.map(req => worker.fetch(req, mockEnv)));

      const statuses = responses.map(r => r.status);
      const count200 = statuses.filter(s => s === 200).length;
      const count429 = statuses.filter(s => s === 429).length;

      expect(count200).toBe(10);
      expect(count429).toBe(40);

      // Verify all 429 responses have Retry-After header and RATE_LIMIT_EXCEEDED error_code
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      for (const res of rateLimitedResponses) {
        expect(res.headers.get('Retry-After')).toBe('60');
        const body = await res.json() as any;
        expect(body.error_code).toBe('RATE_LIMIT_EXCEEDED');
      }
    });

    it('allows concurrent requests from different distinct client IPs', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
        new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'OK' }) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      // 20 requests from 20 different IPs
      const ips = Array.from({ length: 20 }, (_, i) => `10.0.1.${i + 1}`);
      const requests = ips.map(ip => new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': ip
        },
        body: JSON.stringify({ image: 'base64sample' })
      }));

      const responses = await Promise.all(requests.map(req => worker.fetch(req, mockEnv)));
      const allPassed = responses.every(r => r.status === 200);
      expect(allPassed).toBe(true);
      expect(fallbackRateLimitMap.size).toBe(20);
    });

    it('resets fallback rate limit count after window (60 seconds) expires', async () => {
      vi.useFakeTimers();
      const ip = '192.168.1.55';

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
        new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'OK' }) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      // Consume 10 requests
      for (let i = 0; i < 10; i++) {
        const req = new Request('https://worker.local/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip },
          body: JSON.stringify({ image: 'base64sample' })
        });
        const res = await worker.fetch(req, mockEnv);
        expect(res.status).toBe(200);
      }

      // 11th request is blocked
      const reqBlocked = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip },
        body: JSON.stringify({ image: 'base64sample' })
      });
      const resBlocked = await worker.fetch(reqBlocked, mockEnv);
      expect(resBlocked.status).toBe(429);

      // Advance time by 61 seconds
      vi.advanceTimersByTime(61000);

      // 12th request should now be accepted as a new window opens
      const reqNewWindow = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip },
        body: JSON.stringify({ image: 'base64sample' })
      });
      const resNewWindow = await worker.fetch(reqNewWindow, mockEnv);
      expect(resNewWindow.status).toBe(200);

      vi.useRealTimers();
    });

    it('falls back to in-memory rate limiting gracefully when RATE_LIMITER binding throws', async () => {
      const brokenRateLimiter = {
        limit: vi.fn().mockRejectedValue(new Error('Cloudflare RateLimiter internal error'))
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
        new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'OK' }) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      const ip = '172.16.0.1';
      for (let i = 0; i < 10; i++) {
        const req = new Request('https://worker.local/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': ip
          },
          body: JSON.stringify({ image: 'base64sample' })
        });
        const res = await worker.fetch(req, { ...mockEnv, RATE_LIMITER: brokenRateLimiter });
        expect(res.status).toBe(200);
      }

      // 11th should be blocked by fallback
      const req11 = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': ip
        },
        body: JSON.stringify({ image: 'base64sample' })
      });
      const res11 = await worker.fetch(req11, { ...mockEnv, RATE_LIMITER: brokenRateLimiter });
      expect(res11.status).toBe(429);
      const data11 = await res11.json() as any;
      expect(data11.error_code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  // =========================================================================
  // Challenge Suite 5: Payload Edge Cases, HTTP Methods & CORS
  // =========================================================================
  describe('Challenge 5: Payload Validation, HTTP Methods & CORS', () => {
    it('rejects non-JSON malformed POST bodies with HTTP 400 BAD_REQUEST', async () => {
      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'NOT_VALID_JSON_AT_ALL{[['
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error_code).toBe('BAD_REQUEST');
      expect(data.retake_message).toContain('صيغة الطلب غير صالحة');
    });

    it('rejects image field with null, number, or whitespace-only string', async () => {
      const invalidPayloads = [
        { image: null },
        { image: 12345 },
        { image: '    ' },
        { image: '' },
        {}
      ];

      for (const payload of invalidPayloads) {
        const request = new Request('https://worker.local/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const response = await worker.fetch(request, mockEnv);
        expect(response.status).toBe(400);
        const data = await response.json() as any;
        expect(data.error_code).toBe('BAD_REQUEST');
      }
    });

    it('strips data URL prefix correctly (e.g. data:image/png;base64,)', async () => {
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
        body: JSON.stringify({
          image: 'data:image/jpeg;base64,AQIDBAUGBwgJCgsMDQ4PEA==',
          mimeType: 'image/jpeg'
        })
      });

      await worker.fetch(request, mockEnv);
      const inlineData = capturedBody.contents[0].parts[1].inlineData;
      expect(inlineData.data).toBe('AQIDBAUGBwgJCgsMDQ4PEA==');
      expect(inlineData.data).not.toContain('data:image');
    });

    it('includes full CORS headers on both successful and error responses', async () => {
      // Error response (e.g. 400 Bad Request)
      const errReq = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const errRes = await worker.fetch(errReq, mockEnv);
      expect(errRes.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(errRes.headers.get('Access-Control-Allow-Methods')).toContain('POST');

      // 405 Method Not Allowed response
      const getReq = new Request('https://worker.local/api/analyze', {
        method: 'DELETE'
      });
      const getRes = await worker.fetch(getReq, mockEnv);
      expect(getRes.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(getRes.status).toBe(405);
    });

    it('handles unexpected fetch exceptions without leaking stack trace or unhandled crash', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network connection abruptly closed with key AIzaSyD1234567890abcdefghijklmnopqrstuv'));

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64test' })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(500);
      const data = await response.json() as any;
      expect(data.error_code).toBe('INTERNAL_SERVER_ERROR');
      expect(data.detail).not.toContain('AIzaSyD1234567890abcdefghijklmnopqrstuv');
      expect(data.detail).toContain('[REDACTED_KEY]');
    });
  });
});
