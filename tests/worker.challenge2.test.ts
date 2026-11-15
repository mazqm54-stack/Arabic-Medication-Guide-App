import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, {
  PHARMACIST_SYSTEM_PROMPT,
  PRESCRIPTION_SYSTEM_PROMPT,
  MEDICINE_DETAILS_SYSTEM_PROMPT,
  GEMINI_RESPONSE_SCHEMA,
  PRESCRIPTION_RESPONSE_SCHEMA,
  fallbackRateLimitMap,
  sanitizeMessage,
  parseUpstreamError
} from '../worker/src/index';

describe('Milestone M1 Challenger 2: Adversarial Verification Harness', () => {
  const baseEnv = {
    GEMINI_API_KEY: 'AIzaSyEmpiricalChallenger2SecretKey123',
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    fallbackRateLimitMap.clear();
  });

  // =========================================================================
  // 1. Challenge the 5 Prescription Prompt Rules & Strict Schema Validation
  // =========================================================================
  describe('1. Challenge 5 Prescription Prompt Rules & Schema', () => {
    it('verifies PRESCRIPTION_SYSTEM_PROMPT strictly enforces all 5 medical prescription rules', () => {
      // Rule 1: Only read what is actually written, never guess, mark unclear as low confidence
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/Read ONLY what is actually written/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/NEVER guess or invent a medicine name/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/confidence to 'low'/i);

      // Rule 2: If whole image blurry/dark/cropped/unreadable, is_clear=false, items=[], warm retake_message
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/blurry, too dark, cropped, unreadable, or is NOT a medical prescription/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/is_clear=false/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/items as an empty array \[\]/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/retake_message/);

      // Rule 3: Copy dosage/frequency/duration EXACTLY into written_instructions, never invent
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/written_instructions/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/NEVER invent, assume, or complete instructions/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/empty string ""/);

      // Rule 4: One-sentence simple explanation for readable items; empty string for low-confidence
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/short_explanation/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/For low-confidence items, you MUST leave short_explanation as an empty string ""/i);

      // Rule 5: Maximum 10 items
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/maximum of 10 items/i);
    });

    it('verifies PRESCRIPTION_RESPONSE_SCHEMA strictly enforces root and item properties', () => {
      expect(PRESCRIPTION_RESPONSE_SCHEMA.type).toBe('OBJECT');
      expect(PRESCRIPTION_RESPONSE_SCHEMA.required).toContain('is_clear');
      expect(PRESCRIPTION_RESPONSE_SCHEMA.required).toContain('retake_message');
      expect(PRESCRIPTION_RESPONSE_SCHEMA.required).toContain('confidence');
      expect(PRESCRIPTION_RESPONSE_SCHEMA.required).toContain('evidence_text');
      expect(PRESCRIPTION_RESPONSE_SCHEMA.required).toContain('items');
      expect(PRESCRIPTION_RESPONSE_SCHEMA.required).toContain('audio_summary');

      // Validate items array schema
      const itemsSchema = PRESCRIPTION_RESPONSE_SCHEMA.properties.items;
      expect(itemsSchema.type).toBe('ARRAY');
      expect(itemsSchema.items.type).toBe('OBJECT');
      expect(itemsSchema.items.required).toEqual([
        'line_text_as_written',
        'is_confirmed',
        'status',
        'medicine_name_ar',
        'medicine_name_en',
        'active_ingredient',
        'confidence',
        'written_instructions',
        'short_explanation'
      ]);

      // Validate confidence enum in items
      expect(itemsSchema.items.properties.confidence.enum).toEqual(['high', 'medium', 'low']);
    });

    it('verifies prescription mode routing via /prescription, /api/prescription, and body.mode="prescription"', async () => {
      const mockPrescriptionResponse = {
        is_clear: true,
        retake_message: '',
        confidence: 'high',
        evidence_text: 'Augmentin 1g 1x2',
        items: [
          {
            line_text_as_written: 'Augmentin 1g 1x2',
            medicine_name_ar: 'أوجمنتين',
            medicine_name_en: 'Augmentin',
            active_ingredient: 'أموكسيسيلين + كلافولانات',
            confidence: 'high',
            written_instructions: 'قرص كل 12 ساعة بعد الأكل',
            short_explanation: 'مضاد حيوي واسع المجال'
          }
        ],
        audio_summary: 'روشتة تحتوي على أوجمنتين مضاد حيوي'
      };

      const testEndpoints = [
        { url: 'https://worker.local/prescription', body: { image: 'base64Prescription' } },
        { url: 'https://worker.local/api/prescription', body: { image: 'base64Prescription' } },
        { url: 'https://worker.local/api/analyze', body: { mode: 'prescription', image: 'base64Prescription' } }
      ];

      for (const endpoint of testEndpoints) {
        let capturedBody: any = null;
        let capturedUrl = '';

        vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
          capturedUrl = String(url);
          capturedBody = JSON.parse(init.body);
          return new Response(JSON.stringify({
            candidates: [{
              content: { parts: [{ text: JSON.stringify(mockPrescriptionResponse) }] }
            }]
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        });

        const req = new Request(endpoint.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(endpoint.body)
        });

        const res = await worker.fetch(req, baseEnv);
        expect(res.status).toBe(200);

        // Model must be GEMINI_MODEL_PRESCRIPTION (gemini-3.8-flash)
        expect(capturedUrl).toContain('/models/gemini-3.8-flash:generateContent');
        expect(capturedBody.generationConfig.responseSchema).toEqual(PRESCRIPTION_RESPONSE_SCHEMA);
        expect(capturedBody.systemInstruction.parts[0].text).toBe(PRESCRIPTION_SYSTEM_PROMPT);

        const data = await res.json() as any;
        expect(data.is_clear).toBe(true);
        expect(data.items.length).toBe(1);
        expect(data.items[0].medicine_name_ar).toBe('أوجمنتين');
        expect(data.error_code).toBeNull();
      }
    });

    it('handles NO_CANDIDATE_TEXT and INVALID_JSON in prescription mode with safe fallback items=[]', async () => {
      // 1. Empty candidate
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ candidates: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      const req1 = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64Data' })
      });

      const res1 = await worker.fetch(req1, baseEnv);
      const data1 = await res1.json() as any;
      expect(data1.is_clear).toBe(false);
      expect(data1.confidence).toBe('low');
      expect(data1.items).toEqual([]);
      expect(data1.error_code).toBe('NO_CANDIDATE_TEXT');
      expect(data1.retake_message).toContain('الروشتة');

      // 2. Corrupt JSON
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'NOT VALID JSON { ...' }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      const req2 = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64Data' })
      });

      const res2 = await worker.fetch(req2, baseEnv);
      const data2 = await res2.json() as any;
      expect(data2.is_clear).toBe(false);
      expect(data2.confidence).toBe('low');
      expect(data2.items).toEqual([]);
      expect(data2.error_code).toBe('INVALID_JSON');
      expect(data2.retake_message).toContain('الروشتة');
    });
  });

  // =========================================================================
  // 2. Challenge Box Prompt Rule 6 & usage_source Schema
  // =========================================================================
  describe('2. Challenge Box Prompt Rule 6 & usage_source', () => {
    it('verifies PHARMACIST_SYSTEM_PROMPT Rule 6 mandates non-empty how_and_when and usage_source', () => {
      expect(PHARMACIST_SYSTEM_PROMPT).toMatch(/how_and_when must NEVER be empty/i);
      expect(PHARMACIST_SYSTEM_PROMPT).toMatch(/must not just say follow the doctor/i);
      expect(PHARMACIST_SYSTEM_PROMPT).toMatch(/usage_source='printed'/);
      expect(PHARMACIST_SYSTEM_PROMPT).toMatch(/usage_source='common'/);
      expect(PHARMACIST_SYSTEM_PROMPT).toMatch(/COMMON general usage/i);
      expect(PHARMACIST_SYSTEM_PROMPT).toMatch(/NEVER give exact mg or ml amounts/i);
    });

    it('verifies GEMINI_RESPONSE_SCHEMA strictly specifies usage_source with enum ["printed", "common"]', () => {
      expect(GEMINI_RESPONSE_SCHEMA.properties.usage_source).toBeDefined();
      expect(GEMINI_RESPONSE_SCHEMA.properties.usage_source.type).toBe('STRING');
      expect(GEMINI_RESPONSE_SCHEMA.properties.usage_source.enum).toEqual(['printed', 'common']);
      expect(GEMINI_RESPONSE_SCHEMA.required).toContain('usage_source');
      expect(GEMINI_RESPONSE_SCHEMA.required).toContain('how_and_when');
    });

    it('normalizes usage_source in box mode: preserves "printed", defaults anything else to "common"', async () => {
      const makeMockResponse = (source: string) => ({
        is_clear: true,
        retake_message: '',
        confidence: 'high',
        evidence_text: 'PANADOL EXTRA',
        medicine_name_ar: 'بانادول إكسترا',
        medicine_name_en: 'Panadol Extra',
        active_ingredient: 'باراسيتامول + كافيين',
        uses: ['تسكين الصداع'],
        how_and_when: ['قرص بعد الأكل عند اللزوم'],
        usage_source: source,
        warnings: ['لا تتجاوز 8 أقراص يومياً'],
        audio_summary: 'بانادول إكسترا مسكن للصداع'
      });

      // Test "printed"
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(makeMockResponse('printed')) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      let req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64Image' })
      });
      let res = await worker.fetch(req, baseEnv);
      let data = await res.json() as any;
      expect(data.usage_source).toBe('printed');

      // Test unexpected/unrecognized value -> safely normalized to "common"
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(makeMockResponse('unknown_value')) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64Image' })
      });
      res = await worker.fetch(req, baseEnv);
      data = await res.json() as any;
      expect(data.usage_source).toBe('common');
    });
  });

  // =========================================================================
  // 3. Challenge ThinkingConfig Behavior & Fallback
  // =========================================================================
  describe('3. Challenge ThinkingConfig Behavior & Model Selection', () => {
    it('sends thinkingConfig for non-lite models (gemini-3.8-flash) and omits for lite models (gemini-3.5-flash-lite)', async () => {
      let capturedBody: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
        capturedBody = JSON.parse(init.body);
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'OK' }) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      // 1. Box mode with default gemini-3.5-flash-lite -> lite model omits thinkingConfig
      const boxReq = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });
      await worker.fetch(boxReq, baseEnv);
      expect(capturedBody.generationConfig.thinkingConfig).toBeUndefined();

      // 2. Prescription mode with gemini-3.8-flash -> non-lite sends thinkingConfig LOW
      const rxReq = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });
      await worker.fetch(rxReq, baseEnv);
      expect(capturedBody.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    });

    it('retries without thinkingConfig when upstream returns HTTP 400 mentioning "thinking"', async () => {
      let fetchCount = 0;
      const sentBodies: any[] = [];

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
        fetchCount++;
        sentBodies.push(JSON.parse(init.body));
        if (fetchCount === 1) {
          return new Response(JSON.stringify({
            error: {
              code: 400,
              message: 'Invalid argument: thinkingConfig is not supported on this model endpoint.'
            }
          }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({
          candidates: [{
            content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'Fallback OK' }) }] }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      const rxReq = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });

      const res = await worker.fetch(rxReq, baseEnv);
      expect(fetchCount).toBe(2);
      expect(sentBodies[0].generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
      expect(sentBodies[1].generationConfig.thinkingConfig).toBeUndefined();
      expect(res.status).toBe(200);
    });

    it('does NOT retry when upstream returns HTTP 400 not mentioning thinking', async () => {
      let fetchCount = 0;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        fetchCount++;
        return new Response(JSON.stringify({
          error: {
            code: 400,
            message: 'Invalid argument: image bytes could not be decoded.'
          }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      });

      const rxReq = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'badBase64' })
      });

      const res = await worker.fetch(rxReq, baseEnv);
      expect(fetchCount).toBe(1);
      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_BAD_REQUEST');
    });
  });

  // =========================================================================
  // 4. Challenge Upstream Error Mappings & Zero Secret Exposure
  // =========================================================================
  describe('4. Challenge Upstream Error Mappings & Secret Redaction', () => {
    it('maps HTTP 400 bad request to UPSTREAM_BAD_REQUEST', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 400, message: 'Invalid payload schema.' } }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });

      const res = await worker.fetch(req, baseEnv);
      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_BAD_REQUEST');
      expect(data.retake_message).toContain('خطأ في صياغة طلب التحليل');
    });

    it('maps HTTP 403 / 400 location block to UPSTREAM_LOCATION_RESTRICTED (403)', async () => {
      const locationErrors = [
        'User location is not supported for the API use.',
        'This country is restricted from using the Gemini API.',
        'Region not supported. FAILED_PRECONDITION.'
      ];

      for (const msg of locationErrors) {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(JSON.stringify({ error: { code: 400, message: msg } }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        );

        const req = new Request('https://worker.local/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: 'base64' })
        });

        const res = await worker.fetch(req, baseEnv);
        expect(res.status).toBe(403);
        const data = await res.json() as any;
        expect(data.error_code).toBe('UPSTREAM_LOCATION_RESTRICTED');
        expect(data.retake_message).toContain('النطاق الجغرافي');
      }
    });

    it('maps HTTP 429 rate limit to UPSTREAM_RATE_LIMIT with Retry-After header', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 429, message: 'Rate limit quota exhausted.' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });

      const res = await worker.fetch(req, baseEnv);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('60');
      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_RATE_LIMIT');
      expect(data.retake_message).toContain('حد الطلبات');
    });

    it('maps HTTP 503 overloaded to UPSTREAM_OVERLOADED (503)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 503, message: 'The model is currently overloaded.' } }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });

      const res = await worker.fetch(req, baseEnv);
      expect(res.status).toBe(503);
      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_OVERLOADED');
      expect(data.retake_message).toContain('تحت ضغط مؤقت');
    });

    it('maps HTTP 500 upstream internal error to UPSTREAM_API_ERROR (500)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 500, message: 'An internal error occurred.' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });

      const res = await worker.fetch(req, baseEnv);
      expect(res.status).toBe(500);
      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_API_ERROR');
      expect(data.retake_message).toContain('حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية');
    });

    it('maps 25-second AbortController timeout to HTTP 504 UPSTREAM_TIMEOUT', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
        return new Promise((_resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              const err = new DOMException('The operation was aborted', 'TimeoutError');
              reject(err);
            });
          }
        });
      });

      vi.useFakeTimers();

      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });

      const workerPromise = worker.fetch(req, baseEnv);

      // Fast forward past 25s
      await vi.advanceTimersByTimeAsync(25001);

      const res = await workerPromise;
      expect(res.status).toBe(504);
      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_TIMEOUT');
      expect(data.retake_message).toContain('25 ثانية');

      vi.useRealTimers();
    });

    it('ADVERSARIAL SECRET LEAK CHALLENGE: guarantees raw API keys, query keys, headers, and base64 are completely redacted', async () => {
      const rawSecretKey = 'AIzaSy123456789012345678901234567890123';
      const rawImageBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

      const hostileUpstreamPayload = JSON.stringify({
        error: {
          code: 500,
          message: `Failed connecting with key ${rawSecretKey} and url https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${rawSecretKey} using x-goog-api-key: ${rawSecretKey} and payload: {"inlineData":{"data":"${rawImageBase64}"}}`
        }
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(hostileUpstreamPayload, { status: 500, headers: { 'Content-Type': 'application/json' } })
      );

      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });

      const res = await worker.fetch(req, baseEnv);
      const responseBody = await res.text();

      // Verify NO leaks in the final client-facing JSON
      expect(responseBody).not.toContain(rawSecretKey);
      expect(responseBody).not.toContain(rawImageBase64);
      expect(responseBody).toContain('[REDACTED_KEY]');

      // Direct unit test of sanitizeMessage
      const sanitized = sanitizeMessage(`Leaked ${rawSecretKey} and ?key=${rawSecretKey} and ${rawImageBase64}`);
      expect(sanitized).not.toContain(rawSecretKey);
      expect(sanitized).not.toContain(rawImageBase64);

      // Direct unit test of parseUpstreamError
      const parsed = parseUpstreamError(hostileUpstreamPayload, 500);
      expect(parsed.detail).not.toContain(rawSecretKey);
      expect(parsed.detail).not.toContain(rawImageBase64);
    });
  });

  // =========================================================================
  // 5. Challenge Medicine Details Mode
  // =========================================================================
  describe('5. Challenge Medicine Details Mode', () => {
    it('handles medicine details mode via /details, /api/details, or body.mode="details"', async () => {
      const mockDetailsResponse = {
        is_clear: true,
        retake_message: '',
        confidence: 'high',
        evidence_text: 'Verified database details for كونكور',
        medicine_name_ar: 'كونكور',
        medicine_name_en: 'Concor',
        active_ingredient: 'بيسوبرولول',
        uses: ['علاج ارتفاع ضغط الدم', 'تنظيم ضربات القلب'],
        how_and_when: ['قرص واحد صباحاً مع أو بدون طعام'],
        usage_source: 'common',
        warnings: ['لا توقف الدواء فجأة دون استشارة الطبيب'],
        audio_summary: 'كونكور دواء لعلاج ضغط الدم'
      };

      const endpoints = [
        { url: 'https://worker.local/details', body: { medicine_name: 'كونكور' } },
        { url: 'https://worker.local/api/details', body: { medicine_name: 'كونكور' } },
        { url: 'https://worker.local/api/analyze', body: { mode: 'details', medicine_name: 'كونكور' } }
      ];

      for (const ep of endpoints) {
        let capturedBody: any = null;

        vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
          capturedBody = JSON.parse(init.body);
          return new Response(JSON.stringify({
            candidates: [{
              content: { parts: [{ text: JSON.stringify(mockDetailsResponse) }] }
            }]
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        });

        const req = new Request(ep.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ep.body)
        });

        const res = await worker.fetch(req, baseEnv);
        expect(res.status).toBe(200);

        // Details mode does NOT require image and uses MEDICINE_DETAILS_SYSTEM_PROMPT
        expect(capturedBody.systemInstruction.parts[0].text).toBe(MEDICINE_DETAILS_SYSTEM_PROMPT);
        expect(capturedBody.contents[0].parts[0].text).toContain('Provide detailed pharmaceutical information');
        expect(capturedBody.contents[0].parts[0].text).toContain('كونكور');

        const data = await res.json() as any;
        expect(data.medicine_name_ar).toBe('كونكور');
        expect(data.usage_source).toBe('common');
        expect(data.error_code).toBeNull();
      }
    });

    it('rejects details mode with HTTP 400 BAD_REQUEST when medicine_name is missing or empty', async () => {
      const invalidRequests = [
        {},
        { medicine_name: '' },
        { medicine_name: '   ' },
        { mode: 'details' },
        { mode: 'details', medicine_name: null }
      ];

      for (const body of invalidRequests) {
        const req = new Request('https://worker.local/api/details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const res = await worker.fetch(req, baseEnv);
        expect(res.status).toBe(400);
        const data = await res.json() as any;
        expect(data.error_code).toBe('BAD_REQUEST');
        expect(data.retake_message).toContain('اسم الدواء');
      }
    });
  });
});
