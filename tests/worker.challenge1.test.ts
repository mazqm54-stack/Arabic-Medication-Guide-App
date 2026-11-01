import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, {
  fallbackRateLimitMap,
  sanitizeMessage,
  parseUpstreamError,
  cleanAndParseJsonText
} from '../worker/src/index';

describe('Worker Adversarial Challenge Suite 1 (Milestone M1)', () => {
  // A standard 39-character Google Gemini API key: 'AIza' + 35 chars
  const standardApiKey = 'AIzaSy' + 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R';
  const mockEnv = {
    GEMINI_API_KEY: standardApiKey,
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    fallbackRateLimitMap.clear();
  });

  // =========================================================================
  // Challenge 1: 25s Timeout & Adversarial Secret Leakage Prevention
  // =========================================================================
  describe('Challenge 1: 25s Timeout & Secret Leakage Prevention', () => {
    it('enforces 25s upstream timeout and returns HTTP 504 UPSTREAM_TIMEOUT without leaking secrets', async () => {
      // Simulate fetch aborting due to timeout
      vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          const signal = options?.signal as AbortSignal | undefined;
          if (signal) {
            signal.addEventListener('abort', () => {
              const abortErr = new DOMException('Upstream Gemini request timed out after 25 seconds', 'TimeoutError');
              reject(abortErr);
            });
          }
        });
      });

      // Use fake timers to advance 25s
      vi.useFakeTimers();

      const request = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'valid-base64-prescription-image' })
      });

      const workerPromise = worker.fetch(request, mockEnv);

      // Fast forward time by 25000ms
      await vi.advanceTimersByTimeAsync(25000);

      const response = await workerPromise;
      vi.useRealTimers();

      expect(response.status).toBe(504);
      const data = await response.json() as any;
      expect(data.error).toBe('UPSTREAM_TIMEOUT');
      expect(data.error_code).toBe('UPSTREAM_TIMEOUT');
      expect(data.upstream_status).toBe(504);
      expect(data.retake_message).toContain('25 ثانية');
      expect(data.detail).toContain('timed out after 25 seconds');

      // Verify no secrets or API key in response body
      const rawBody = JSON.stringify(data);
      expect(rawBody).not.toContain(mockEnv.GEMINI_API_KEY);
      expect(rawBody).not.toContain('AIzaSy');
      expect(rawBody).not.toContain('generativelanguage.googleapis.com');
    });

    it('redacts API key if upstream fetch throws an unexpected error containing the URL with key', async () => {
      const leakedUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${mockEnv.GEMINI_API_KEY}`;
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error(`Failed to fetch from ${leakedUrl}`));

      const request = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'valid-base64' })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(500);
      const data = await response.json() as any;
      expect(data.error).toBe('INTERNAL_SERVER_ERROR');

      const rawBody = JSON.stringify(data);
      expect(rawBody).not.toContain(mockEnv.GEMINI_API_KEY);
      expect(rawBody).not.toContain('A1B2C3D4E5');
      expect(data.detail).toContain('[REDACTED_KEY]');
    });

    it('redacts standard 39-character Gemini API keys in sanitizeMessage utility', () => {
      const keyString = `Error connecting to upstream with ?key=${mockEnv.GEMINI_API_KEY} and x-goog-api-key: ${mockEnv.GEMINI_API_KEY}`;
      const sanitized = sanitizeMessage(keyString);
      expect(sanitized).not.toContain(mockEnv.GEMINI_API_KEY);
      expect(sanitized).toContain('[REDACTED_KEY]');

      const hugePayload = 'data:image/jpeg;base64,' + 'A'.repeat(200);
      const sanitizedPayload = sanitizeMessage(hugePayload);
      expect(sanitizedPayload).toContain('[REDACTED_BASE64]');
      expect(sanitizedPayload).not.toContain('AAAAAA');
    });

    it('safely handles upstream HTTP 500 error containing sensitive key query parameter without leakage', async () => {
      const upstreamErrorBody = JSON.stringify({
        error: {
          code: 500,
          message: `Internal server error for request with ?key=${mockEnv.GEMINI_API_KEY}`
        }
      });

      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(upstreamErrorBody, { status: 500, headers: { 'Content-Type': 'application/json' } }))
      );

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sample-image' })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(500);
      const data = await response.json() as any;
      expect(data.error).toBe('UPSTREAM_API_ERROR');
      expect(data.error_code).toBe('UPSTREAM_API_ERROR');

      const rawBody = JSON.stringify(data);
      expect(rawBody).not.toContain(mockEnv.GEMINI_API_KEY);
      expect(data.detail).toContain('[REDACTED_KEY]');
    });

    it('aborts second attempt during thinkingConfig retry if 25s timeout occurs', async () => {
      vi.useFakeTimers();

      let fetchCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
        fetchCount++;
        if (fetchCount === 1) {
          // First attempt rejects thinkingConfig with 400
          return Promise.resolve(new Response(JSON.stringify({
            error: { message: 'thinkingConfig is not supported for this model' }
          }), { status: 400 }));
        }

        // Second attempt hangs until timeout aborts it
        return new Promise((_resolve, reject) => {
          const signal = options?.signal as AbortSignal | undefined;
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new DOMException('Upstream Gemini request timed out after 25 seconds', 'TimeoutError'));
            });
          }
        });
      });

      const request = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'valid-image' })
      });

      const workerPromise = worker.fetch(request, mockEnv);
      await vi.advanceTimersByTimeAsync(25000);

      const response = await workerPromise;
      vi.useRealTimers();

      expect(response.status).toBe(504);
      const data = await response.json() as any;
      expect(data.error_code).toBe('UPSTREAM_TIMEOUT');
    });
  });

  // =========================================================================
  // Challenge 2: Payload Boundary Conditions & Malformed Inputs
  // =========================================================================
  describe('Challenge 2: Payload Boundary Conditions & Malformed Inputs', () => {
    it('accepts payload exactly at boundary (4MB = 4194304 bytes)', async () => {
      const exact4MB = 'A'.repeat(4 * 1024 * 1024);

      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({
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
                  active_ingredient: 'Paracetamol',
                  uses: ['مسكن للألم'],
                  how_and_when: ['قرص بعد الأكل عند اللزوم'],
                  usage_source: 'common',
                  warnings: ['لا تتجاوز 4 جرام يومياً', 'استشر الطبيب أو الصيدلي'],
                  audio_summary: 'بانادول مسكن للألم'
                })
              }]
            }
          }]
        }), { status: 200 }))
      );

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: exact4MB })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.is_clear).toBe(true);
      expect(data.medicine_name_ar).toBe('بانادول');
    });

    it('rejects payload 1 byte over boundary (4MB + 1 byte) with 413 PAYLOAD_TOO_LARGE', async () => {
      const over4MB = 'A'.repeat((4 * 1024 * 1024) + 1);

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: over4MB })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(413);
      const data = await response.json() as any;
      expect(data.error).toBe('PAYLOAD_TOO_LARGE');
      expect(data.error_code).toBe('PAYLOAD_TOO_LARGE');
      expect(data.retake_message).toContain('4 ميجابايت');
    });

    it('rejects massive 10MB payload with 413 PAYLOAD_TOO_LARGE', async () => {
      const hugeImage = 'B'.repeat(10 * 1024 * 1024);

      const request = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: hugeImage })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(413);
      const data = await response.json() as any;
      expect(data.error_code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('rejects empty body string with HTTP 400 BAD_REQUEST', async () => {
      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: ''
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error_code).toBe('BAD_REQUEST');
      expect(data.retake_message).toContain('صيغة الطلب غير صالحة');
    });

    it('rejects malformed JSON syntax with HTTP 400 BAD_REQUEST', async () => {
      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ "image": "abc", broken: true '
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error_code).toBe('BAD_REQUEST');
    });

    it('handles non-object valid JSON (null, array, number, boolean) safely with 400', async () => {
      const testCases = ['null', '123', 'true', '["invalid", "array"]'];

      for (const payload of testCases) {
        const request = new Request('https://worker.local/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        });

        const response = await worker.fetch(request, mockEnv);
        expect(response.status).toBe(400);
        const data = await response.json() as any;
        expect(data.error_code).toBe('BAD_REQUEST');
      }
    });

    it('returns differentiated Arabic error message when image is missing in prescription vs box mode', async () => {
      const boxReq = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const boxRes = await worker.fetch(boxReq, mockEnv);
      const boxData = await boxRes.json() as any;
      expect(boxRes.status).toBe(400);
      expect(boxData.retake_message).toContain('صورة علبة الدواء');

      const rxReq = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const rxRes = await worker.fetch(rxReq, mockEnv);
      const rxData = await rxRes.json() as any;
      expect(rxRes.status).toBe(400);
      expect(rxData.retake_message).toContain('صورة الروشتة');
    });
  });

  // =========================================================================
  // Challenge 3: Details Mode Edge Cases
  // =========================================================================
  describe('Challenge 3: Details Mode Edge Cases', () => {
    it('rejects details mode with missing medicine_name with 400 and Arabic guidance', async () => {
      const request = new Request('https://worker.local/api/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error_code).toBe('BAD_REQUEST');
      expect(data.retake_message).toBe('يرجى إرسال اسم الدواء لعرض التفاصيل.');
    });

    it('rejects details mode with whitespace-only medicine_name with 400', async () => {
      const request = new Request('https://worker.local/api/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicine_name: '   \t\n  ' })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error_code).toBe('BAD_REQUEST');
    });

    it('rejects details mode with non-string medicine_name with 400', async () => {
      const request = new Request('https://worker.local/api/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicine_name: 12345 })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error_code).toBe('BAD_REQUEST');
    });

    it('successfully processes Arabic medicine_name and returns 4-card schema with usage_source common', async () => {
      let capturedPayload: any = null;
      vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
        capturedPayload = JSON.parse(init?.body as string);
        return Promise.resolve(new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  is_clear: true,
                  retake_message: '',
                  confidence: 'high',
                  evidence_text: 'Verified database details for أوجمنتين 1 جم',
                  medicine_name_ar: 'أوجمنتين',
                  medicine_name_en: 'Augmentin',
                  active_ingredient: 'Amoxicillin / Clavulanic Acid',
                  uses: ['مضاد حيوي لعلاج الالتهابات البكتيرية'],
                  how_and_when: ['يؤخذ مع بداية الوجبة لتقليل اضطراب المعدة', 'كل 12 ساعة بانتظام'],
                  usage_source: 'common',
                  warnings: ['أكمل الجرعة كاملة حتى لو شعرت بالتحسن', 'استشر الطبيب أو الصيدلي إذا ظهرت حساسية'],
                  audio_summary: 'أوجمنتين مضاد حيوي يؤخذ مع الطعام كل 12 ساعة'
                })
              }]
            }
          }]
        }), { status: 200 }));
      });

      const request = new Request('https://worker.local/api/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicine_name: '  أوجمنتين 1 جم  ' })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json() as any;

      expect(data.is_clear).toBe(true);
      expect(data.medicine_name_ar).toBe('أوجمنتين');
      expect(data.medicine_name_en).toBe('Augmentin');
      expect(data.usage_source).toBe('common');
      expect(data.how_and_when.length).toBeGreaterThan(0);
      expect(data.error_code).toBeNull();

      // Check user prompt sent to Gemini has trimmed medicine name
      expect(capturedPayload.contents[0].parts[0].text).toContain('أوجمنتين 1 جم');
      // Verify no inlineData image part was sent in details mode
      expect(capturedPayload.contents[0].parts[1]).toBeUndefined();
    });

    it('handles empty candidate text in details mode with specialized Arabic message and preserves medicine_name_ar', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '' }] } }] }), { status: 200 }))
      );

      const request = new Request('https://worker.local/api/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicine_name: 'كونجستال' })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.is_clear).toBe(false);
      expect(data.retake_message).toBe('لم نتمكن من العثور على معلومات الدواء المطلوب.');
      expect(data.medicine_name_ar).toBe('كونجستال');
      expect(data.error_code).toBe('NO_CANDIDATE_TEXT');
      expect(data.usage_source).toBe('common');
    });
  });

  // =========================================================================
  // Challenge 4: Prescription Route vs Body Mode & Fallback Handling
  // =========================================================================
  describe('Challenge 4: Prescription Route vs Body Mode & Fallback Handling', () => {
    const validPrescriptionJson = {
      is_clear: true,
      retake_message: '',
      confidence: 'high',
      evidence_text: 'Rx: Amoxicillin 500mg',
      items: [
        {
          line_text_as_written: 'Amox 500 tid',
          medicine_name_ar: 'أموكسيسيلين',
          medicine_name_en: 'Amoxicillin',
          active_ingredient: 'Amoxicillin',
          confidence: 'high',
          written_instructions: 'كبسولة 3 مرات يومياً',
          short_explanation: 'مضاد حيوي واسع المجال'
        }
      ],
      audio_summary: 'تم قراءة الروشتة وتحتوي على أموكسيسيلين'
    };

    it('handles prescription mode via URL /prescription without body mode', async () => {
      let capturedPayload: any = null;
      vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
        capturedPayload = JSON.parse(init?.body as string);
        return Promise.resolve(new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(validPrescriptionJson) }] } }]
        }), { status: 200 }));
      });

      const request = new Request('https://worker.local/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sample-prescription-base64' })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.items.length).toBe(1);
      expect(data.items[0].medicine_name_ar).toBe('أموكسيسيلين');

      // Verify prescription model was invoked
      expect(capturedPayload.generationConfig.responseSchema.properties.items).toBeDefined();
    });

    it('handles prescription mode via body mode on general endpoint /api/analyze', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(validPrescriptionJson) }] } }]
        }), { status: 200 }))
      );

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: 'sample-prescription-base64',
          mode: 'prescription'
        })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.items.length).toBe(1);
    });

    it('defaults unknown mode to box analysis mode safely', async () => {
      let capturedPayload: any = null;
      vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
        capturedPayload = JSON.parse(init?.body as string);
        return Promise.resolve(new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  is_clear: true,
                  retake_message: '',
                  confidence: 'high',
                  evidence_text: 'Aspirin',
                  medicine_name_ar: 'أسبرين',
                  medicine_name_en: 'Aspirin',
                  active_ingredient: 'Acetylsalicylic acid',
                  uses: ['مسكن'],
                  how_and_when: ['قرص يومياً'],
                  usage_source: 'common',
                  warnings: ['استشر الطبيب'],
                  audio_summary: 'أسبرين'
                })
              }]
            }
          }]
        }), { status: 200 }));
      });

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: 'box-image-base64',
          mode: 'unknown_mode_test'
        })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.medicine_name_ar).toBe('أسبرين');
      // Box schema does not have items property
      expect(capturedPayload.generationConfig.responseSchema.properties.items).toBeUndefined();
      expect(capturedPayload.generationConfig.responseSchema.properties.uses).toBeDefined();
    });

    it('respects body.mode=prescription even if URL path ends with trailing slash /api/prescription/', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(validPrescriptionJson) }] } }]
        }), { status: 200 }))
      );

      const request = new Request('https://worker.local/api/prescription/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: 'rx-image',
          mode: 'prescription'
        })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.items).toBeDefined();
      expect(data.items.length).toBe(1);
    });

    it('returns empty items array and low confidence when Gemini returns no candidate text in prescription mode', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '' }] } }] }), { status: 200 }))
      );

      const request = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'blurry-rx-image' })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.is_clear).toBe(false);
      expect(data.confidence).toBe('low');
      expect(data.items).toEqual([]);
      expect(data.retake_message).toContain('بيانات الروشتة');
      expect(data.error_code).toBe('NO_CANDIDATE_TEXT');
    });
  });

  // =========================================================================
  // Challenge 5: Rate Limiter & CORS Preflight Stress Testing
  // =========================================================================
  describe('Challenge 5: Rate Limiter & CORS Preflight Stress Testing', () => {
    it('allows 10 rapid sequential requests, blocks 11th request with 429 and Retry-After', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  is_clear: true,
                  retake_message: '',
                  confidence: 'high',
                  evidence_text: 'Test',
                  medicine_name_ar: 'دواء تجريبي',
                  medicine_name_en: 'Test Med',
                  active_ingredient: 'Test',
                  uses: ['اختبار'],
                  how_and_when: ['قرص واحد'],
                  usage_source: 'common',
                  warnings: ['تحذير'],
                  audio_summary: 'ملخص'
                })
              }]
            }
          }]
        }), { status: 200 }))
      );

      const clientIp = '192.168.1.100';

      // Execute 10 requests from the same IP
      for (let i = 1; i <= 10; i++) {
        const req = new Request('https://worker.local/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': clientIp
          },
          body: JSON.stringify({ image: 'valid-base64' })
        });
        const res = await worker.fetch(req, mockEnv);
        expect(res.status).toBe(200);
      }

      // 11th request MUST be blocked with 429
      const blockedReq = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': clientIp
        },
        body: JSON.stringify({ image: 'valid-base64' })
      });
      const blockedRes = await worker.fetch(blockedReq, mockEnv);
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get('Retry-After')).toBe('60');

      const data = await blockedRes.json() as any;
      expect(data.error).toBe('RATE_LIMIT_EXCEEDED');
      expect(data.error_code).toBe('RATE_LIMIT_EXCEEDED');
      expect(data.retake_message).toContain('10 تحليلات في الدقيقة');
    });

    it('isolates rate limits between distinct client IPs', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  is_clear: true,
                  retake_message: '',
                  confidence: 'high',
                  evidence_text: 'OK',
                  medicine_name_ar: 'دواء',
                  medicine_name_en: 'Med',
                  active_ingredient: 'Active',
                  uses: ['use'],
                  how_and_when: ['dose'],
                  usage_source: 'common',
                  warnings: ['warn'],
                  audio_summary: 'audio'
                })
              }]
            }
          }]
        }), { status: 200 }))
      );

      const ip1 = '10.0.0.1';
      const ip2 = '10.0.0.2';

      // Exhaust IP 1
      for (let i = 0; i < 10; i++) {
        await worker.fetch(new Request('https://worker.local/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip1 },
          body: JSON.stringify({ image: 'valid-base64' })
        }), mockEnv);
      }

      // IP 1 is blocked
      const resIp1 = await worker.fetch(new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip1 },
        body: JSON.stringify({ image: 'valid-base64' })
      }), mockEnv);
      expect(resIp1.status).toBe(429);

      // IP 2 must still succeed
      const resIp2 = await worker.fetch(new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip2 },
        body: JSON.stringify({ image: 'valid-base64' })
      }), mockEnv);
      expect(resIp2.status).toBe(200);
    });

    it('CORS preflight OPTIONS request is never rate limited even after IP limit reached', async () => {
      const clientIp = '172.16.0.5';

      // Exhaust IP
      for (let i = 0; i < 10; i++) {
        fallbackRateLimitMap.set(clientIp, { count: 10, resetTime: Date.now() + 60000 });
      }

      const preflightReq = new Request('https://worker.local/api/analyze', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://dalili.app',
          'Access-Control-Request-Method': 'POST',
          'cf-connecting-ip': clientIp
        }
      });

      const response = await worker.fetch(preflightReq, mockEnv);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('falls back to in-memory rate limiter if env.RATE_LIMITER binding throws', async () => {
      const failingRateLimiterEnv = {
        ...mockEnv,
        RATE_LIMITER: {
          limit: vi.fn().mockRejectedValue(new Error('Cloudflare KV binding failure'))
        }
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  is_clear: true,
                  retake_message: '',
                  confidence: 'high',
                  evidence_text: 'OK',
                  medicine_name_ar: 'دواء',
                  medicine_name_en: 'Med',
                  active_ingredient: 'Active',
                  uses: ['use'],
                  how_and_when: ['dose'],
                  usage_source: 'common',
                  warnings: ['warn'],
                  audio_summary: 'audio'
                })
              }]
            }
          }]
        }), { status: 200 }))
      );

      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'valid-image' })
      });

      const response = await worker.fetch(req, failingRateLimiterEnv);
      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // Challenge 6: Parser & Utility Resilience
  // =========================================================================
  describe('Challenge 6: Parser & Utility Resilience', () => {
    it('cleanAndParseJsonText extracts JSON cleanly from markdown code blocks with extra prose', () => {
      const rawText = `
Here is the JSON result:
\`\`\`json
{
  "is_clear": true,
  "medicine_name_ar": "كونجستال",
  "usage_source": "common"
}
\`\`\`
Hope this helps!`;
      const parsed = cleanAndParseJsonText(rawText);
      expect(parsed).not.toBeNull();
      expect(parsed.is_clear).toBe(true);
      expect(parsed.medicine_name_ar).toBe('كونجستال');
    });

    it('cleanAndParseJsonText returns null on corrupted or partial JSON', () => {
      expect(cleanAndParseJsonText('{ "incomplete": ')).toBeNull();
      expect(cleanAndParseJsonText('')).toBeNull();
      expect(cleanAndParseJsonText('   ')).toBeNull();
    });

    it('parseUpstreamError flags location-restricted errors across diverse error strings', () => {
      const error1 = parseUpstreamError('User location is not supported for the API use.', 400);
      expect(error1.isLocationBlocked).toBe(true);

      const error2 = parseUpstreamError('FAILED_PRECONDITION: Gemini API is not available in your region/country.', 403);
      expect(error2.isLocationBlocked).toBe(true);

      const error3 = parseUpstreamError('Invalid API key provided.', 400);
      expect(error3.isLocationBlocked).toBe(false);
    });
  });
});
