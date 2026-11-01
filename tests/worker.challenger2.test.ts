import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, {
  fallbackRateLimitMap
} from '../worker/src/index';

describe('Empirical Verification Harness - Challenger 2 (Milestone 1)', () => {
  const defaultEnv = {
    GEMINI_API_KEY: 'AIzaSyTestKeyForEmpiricalVerification123',
    GEMINI_MODEL: 'gemini-3.8-flash'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    fallbackRateLimitMap.clear();
  });

  // =========================================================================
  // 1. Gemini Model Parameter Compliance
  // =========================================================================
  describe('1. Gemini Model Parameter Compliance', () => {
    it('ensures gemini-3.8-flash NEVER sends temperature or deprecated sampling params', async () => {
      let capturedBody: any = null;
      let capturedUrl = '';

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
                  how_and_when: ['قرص عند اللزوم'],
                  warnings: ['استشر الطبيب'],
                  audio_summary: 'بانادول مسكن'
                })
              }]
            }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'validBase64Sample' })
      });

      const response = await worker.fetch(request, defaultEnv);
      expect(response.status).toBe(200);

      // Verify URL
      expect(capturedUrl).toContain('/models/gemini-3.8-flash:generateContent');

      // Verify generationConfig parameters
      expect(capturedBody.generationConfig).toBeDefined();
      expect(capturedBody.generationConfig.temperature).toBeUndefined();
      expect(capturedBody.generationConfig.top_p).toBeUndefined();
      expect(capturedBody.generationConfig.top_k).toBeUndefined();
      expect(capturedBody.generationConfig.responseMimeType).toBe('application/json');
      expect(capturedBody.generationConfig.responseSchema).toBeDefined();

      const data = await response.json() as any;
      expect(data.error_code).toBeNull();
      expect(data.is_clear).toBe(true);
    });

    it('ensures Gemini 3 variants (gemini-3.8-pro, models/gemini-3.8-flash, gemini-3.0-flash) omit temperature', async () => {
      const modelsToTest = [
        'gemini-3.8-pro',
        'models/gemini-3.8-flash',
        'gemini-3.0-flash',
        'gemini-3-flash'
      ];

      for (const modelName of modelsToTest) {
        let capturedBody: any = null;
        let capturedUrl = '';

        vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
          capturedUrl = String(url);
          capturedBody = JSON.parse(init.body);
          return new Response(JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'OK' }) }] } }]
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        });

        const request = new Request('https://worker.local/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: 'validBase64Sample' })
        });

        const response = await worker.fetch(request, {
          GEMINI_API_KEY: 'test-key',
          GEMINI_MODEL: modelName
        });

        expect(response.status).toBe(200);
        expect(capturedUrl).not.toContain('/models/models/');
        expect(capturedBody.generationConfig.temperature).toBeUndefined();
      }
    });

    it('ensures default model (when GEMINI_MODEL is unset or empty) omits temperature', async () => {
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
        body: JSON.stringify({ image: 'validBase64Sample' })
      });

      // env without GEMINI_MODEL
      const response = await worker.fetch(request, { GEMINI_API_KEY: 'test-key' });
      expect(response.status).toBe(200);
      expect(capturedBody.generationConfig.temperature).toBeUndefined();
    });

    it('ensures non-Gemini 3 models retain temperature: 0 (e.g. gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash)', async () => {
      const nonGemini3Models = [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'models/gemini-1.5-flash',
        'gemini-2.0-flash',
        'gemini-2.5-flash'
      ];

      for (const modelName of nonGemini3Models) {
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
          body: JSON.stringify({ image: 'validBase64Sample' })
        });

        const response = await worker.fetch(request, {
          GEMINI_API_KEY: 'test-key',
          GEMINI_MODEL: modelName
        });

        expect(response.status).toBe(200);
        expect(capturedBody.generationConfig.temperature).toBe(0);
      }
    });

    it('ensures thinkingConfig: { thinkingLevel: "LOW" } is sent initially', async () => {
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
        body: JSON.stringify({ image: 'validBase64Sample' })
      });

      await worker.fetch(request, defaultEnv);
      expect(capturedBody.generationConfig.thinkingConfig).toBeDefined();
      expect(capturedBody.generationConfig.thinkingConfig.thinkingLevel).toBe('LOW');
    });

    it('retries without thinkingConfig when upstream returns HTTP 400 mentioning thinking', async () => {
      let callCount = 0;
      const capturedBodies: any[] = [];

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
        callCount++;
        capturedBodies.push(JSON.parse(init.body));
        if (callCount === 1) {
          return new Response(JSON.stringify({
            error: {
              code: 400,
              message: 'Invalid argument: thinkingConfig is not supported for this model version.',
              status: 'INVALID_ARGUMENT'
            }
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
                  evidence_text: 'ASPRIN 100mg',
                  medicine_name_ar: 'أسبرين',
                  medicine_name_en: 'Aspirin',
                  active_ingredient: 'حمض أسيتيل ساليسيليك',
                  uses: ['سيولة الدم'],
                  how_and_when: ['قرص يومياً'],
                  warnings: ['استشر الطبيب'],
                  audio_summary: 'أسبرين'
                })
              }]
            }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'validBase64Sample' })
      });

      const response = await worker.fetch(request, defaultEnv);
      expect(callCount).toBe(2);
      expect(capturedBodies[0].generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
      expect(capturedBodies[1].generationConfig.thinkingConfig).toBeUndefined();
      // Also confirm temperature remains undefined on retry for gemini-3.8-flash
      expect(capturedBodies[1].generationConfig.temperature).toBeUndefined();

      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.error_code).toBeNull();
      expect(data.is_clear).toBe(true);
      expect(data.medicine_name_ar).toBe('أسبرين');
    });

    it('does NOT retry when upstream returns HTTP 400 NOT mentioning thinking (e.g. invalid image)', async () => {
      let callCount = 0;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        return new Response(JSON.stringify({
          error: {
            code: 400,
            message: 'Invalid argument: image bytes are corrupted.',
            status: 'INVALID_ARGUMENT'
          }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      });

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'corruptedBase64' })
      });

      const response = await worker.fetch(request, defaultEnv);
      expect(callCount).toBe(1); // strictly 1 call, no redundant retry
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error_code).toBe('UPSTREAM_BAD_REQUEST');
      expect(data.is_clear).toBe(false);
    });

    it('preserves temperature: 0 on thinkingConfig retry for legacy non-Gemini 3 models', async () => {
      let callCount = 0;
      const capturedBodies: any[] = [];

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
        callCount++;
        capturedBodies.push(JSON.parse(init.body));
        if (callCount === 1) {
          return new Response(JSON.stringify({
            error: { code: 400, message: 'thinkingConfig unsupported' }
          }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'OK' }) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sample' })
      });

      await worker.fetch(request, {
        GEMINI_API_KEY: 'test-key',
        GEMINI_MODEL: 'gemini-1.5-flash'
      });

      expect(callCount).toBe(2);
      expect(capturedBodies[0].generationConfig.temperature).toBe(0);
      expect(capturedBodies[1].generationConfig.temperature).toBe(0);
      expect(capturedBodies[1].generationConfig.thinkingConfig).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. Upstream Error Code Mapping Verification
  // =========================================================================
  describe('2. Upstream Error Code Mapping Verification', () => {
    it('maps upstream HTTP 503 to UPSTREAM_OVERLOADED (HTTP 503)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          error: {
            code: 503,
            message: 'The model is overloaded. Please try again later.',
            status: 'UNAVAILABLE'
          }
        }), { status: 503, headers: { 'Content-Type': 'application/json' } })
      );

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'validBase64' })
      });

      const response = await worker.fetch(request, defaultEnv);
      expect(response.status).toBe(503);
      const data = await response.json() as any;

      expect(data.error_code).toBe('UPSTREAM_OVERLOADED');
      expect(data.error).toBe('UPSTREAM_OVERLOADED');
      expect(data.upstream_status).toBe(503);
      expect(data.is_clear).toBe(false);
      expect(data.detail).toContain('503');
      expect(data.detail).toContain('The model is overloaded');
      expect(data.retake_message).toContain('تحت ضغط مؤقت');
    });

    it('maps upstream HTTP 429 to UPSTREAM_RATE_LIMIT (HTTP 429 with Retry-After)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          error: {
            code: 429,
            message: 'Quota exceeded for quota metric "Generate Content API requests".',
            status: 'RESOURCE_EXHAUSTED'
          }
        }), { status: 429, headers: { 'Content-Type': 'application/json' } })
      );

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'validBase64' })
      });

      const response = await worker.fetch(request, defaultEnv);
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('60');

      const data = await response.json() as any;
      expect(data.error_code).toBe('UPSTREAM_RATE_LIMIT');
      expect(data.error).toBe('UPSTREAM_RATE_LIMIT');
      expect(data.upstream_status).toBe(429);
      expect(data.is_clear).toBe(false);
      expect(data.detail).toContain('429');
      expect(data.detail).toContain('Quota exceeded');
      expect(data.retake_message).toContain('حد الطلبات');
    });

    it('maps upstream location/region block (HTTP 400 or 403) to UPSTREAM_LOCATION_RESTRICTED (HTTP 403)', async () => {
      const locationErrorCases = [
        {
          status: 400,
          body: {
            error: {
              code: 400,
              message: 'User location is not supported for the API use.',
              status: 'FAILED_PRECONDITION'
            }
          }
        },
        {
          status: 403,
          body: {
            error: {
              code: 403,
              message: 'Location restricted: This service is unavailable in your region or country.',
              status: 'PERMISSION_DENIED'
            }
          }
        },
        {
          status: 400,
          body: {
            error: {
              code: 400,
              message: 'FAILED_PRECONDITION: Country not supported.',
              status: 'FAILED_PRECONDITION'
            }
          }
        }
      ];

      for (const c of locationErrorCases) {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(JSON.stringify(c.body), {
            status: c.status,
            headers: { 'Content-Type': 'application/json' }
          })
        );

        const request = new Request('https://worker.local/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: 'validBase64' })
        });

        const response = await worker.fetch(request, defaultEnv);
        expect(response.status).toBe(403);

        const data = await response.json() as any;
        expect(data.error_code).toBe('UPSTREAM_LOCATION_RESTRICTED');
        expect(data.error).toBe('UPSTREAM_LOCATION_RESTRICTED');
        expect(data.upstream_status).toBe(c.status);
        expect(data.is_clear).toBe(false);
        expect(data.retake_message).toContain('النطاق الجغرافي');
      }
    });

    it('maps upstream HTTP 400 (bad request, non-location) to UPSTREAM_BAD_REQUEST (HTTP 400)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          error: {
            code: 400,
            message: 'Invalid argument: Schema structure contains invalid enum.',
            status: 'INVALID_ARGUMENT'
          }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      );

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'validBase64' })
      });

      const response = await worker.fetch(request, defaultEnv);
      expect(response.status).toBe(400);

      const data = await response.json() as any;
      expect(data.error_code).toBe('UPSTREAM_BAD_REQUEST');
      expect(data.error).toBe('UPSTREAM_BAD_REQUEST');
      expect(data.upstream_status).toBe(400);
      expect(data.is_clear).toBe(false);
      expect(data.detail).toContain('400');
      expect(data.detail).toContain('Invalid argument');
      expect(data.retake_message).toContain('خطأ في صياغة طلب التحليل');
    });

    it('maps other upstream errors (500, 502, 504, 401, 404) to UPSTREAM_API_ERROR (HTTP 500)', async () => {
      const otherErrors = [
        { status: 500, message: 'Internal error encountered.' },
        { status: 502, message: 'Bad Gateway from upstream.' },
        { status: 504, message: 'Gateway Timeout connecting to backend.' },
        { status: 401, message: 'API key not valid. Please pass a valid API key.' },
        { status: 404, message: 'models/gemini-3.8-flash not found.' }
      ];

      for (const err of otherErrors) {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(JSON.stringify({
            error: {
              code: err.status,
              message: err.message
            }
          }), { status: err.status, headers: { 'Content-Type': 'application/json' } })
        );

        const request = new Request('https://worker.local/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: 'validBase64' })
        });

        const response = await worker.fetch(request, defaultEnv);
        expect(response.status).toBe(500);

        const data = await response.json() as any;
        expect(data.error_code).toBe('UPSTREAM_API_ERROR');
        expect(data.error).toBe('UPSTREAM_API_ERROR');
        expect(data.upstream_status).toBe(err.status);
        expect(data.is_clear).toBe(false);
        expect(data.detail).toContain(String(err.status));
        expect(data.retake_message).toContain('حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية');
      }
    });
  });

  // =========================================================================
  // 3. Sanitization, Privacy & Edge-Case Robustness
  // =========================================================================
  describe('3. Sanitization, Privacy & Edge-Case Robustness', () => {
    it('verifies that API keys and inline image payloads are NEVER exposed in error detail', async () => {
      const sensitiveLeak = 'Failed with AIzaSyD9876543210zyxwvutsrqponmlkjihgfed and inlineData payload /9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(sensitiveLeak, { status: 500, headers: { 'Content-Type': 'text/plain' } })
      );

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'validBase64' })
      });

      const response = await worker.fetch(request, defaultEnv);
      const data = await response.json() as any;

      expect(data.detail).not.toContain('AIzaSyD9876543210zyxwvutsrqponmlkjihgfed');
      expect(data.detail).not.toContain('2wBDAP//////////////////////////////////////////////////////////////////////////////////////');
      expect(data.detail).toContain('[REDACTED_KEY]');
    });

    it('returns 500 INTERNAL_SERVER_ERROR when fetch throws catastrophic network rejection', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch: DNS resolution failed'));

      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'validBase64' })
      });

      const response = await worker.fetch(request, defaultEnv);
      expect(response.status).toBe(500);

      const data = await response.json() as any;
      expect(data.error_code).toBe('INTERNAL_SERVER_ERROR');
      expect(data.error).toBe('INTERNAL_SERVER_ERROR');
      expect(data.is_clear).toBe(false);
      expect(data.detail).toContain('Failed to fetch');
    });

    it('returns 500 SERVER_CONFIGURATION_ERROR when GEMINI_API_KEY is not configured', async () => {
      const request = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'validBase64' })
      });

      const response = await worker.fetch(request, { GEMINI_API_KEY: '' });
      expect(response.status).toBe(500);

      const data = await response.json() as any;
      expect(data.error_code).toBe('SERVER_CONFIGURATION_ERROR');
      expect(data.detail).toContain('GEMINI_API_KEY is missing');
    });
  });
});
