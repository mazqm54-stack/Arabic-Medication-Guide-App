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

describe('Milestone M1 Challenger 2 Empirical Test Suite (tests/worker.challenge2_m1.test.ts)', () => {
  const secretKey = 'AIzaSyAdversarialVerificationKey12345';
  const baseEnv = {
    GEMINI_API_KEY: secretKey,
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    fallbackRateLimitMap.clear();
  });

  // =========================================================================
  // Challenge 1: The 5 Prescription Prompt Rules & Strict Schema Validation
  // =========================================================================
  describe('Challenge 1: Prescription Prompt Rules & Strict Schema Validation', () => {
    it('verifies PRESCRIPTION_SYSTEM_PROMPT contains and strictly enforces all 5 medical prescription rules', () => {
      // Rule 1: Read only what is actually written, never guess medicine names, mark unclear as low confidence
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/Read ONLY what is actually written on the prescription/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/NEVER guess or invent a medicine name from partial or unclear letters/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/confidence to 'low'/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/leave medicine_name_ar \/ medicine_name_en empty or write only the exact letters/i);

      // Rule 2: If whole image blurry, too dark, cropped, unreadable or not a prescription -> is_clear=false, items=[], warm retake_message
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/blurry, too dark, cropped, unreadable, or is NOT a medical prescription/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/is_clear=false/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/confidence='low'/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/items as an empty array \[\]/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/warm, friendly Arabic retake_message/i);

      // Rule 3: Copy dosage/frequency/duration EXACTLY into written_instructions, never invent, empty string if absent
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/written_instructions/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/EXACTLY into written_instructions/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/NEVER invent, assume, or complete instructions/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/empty string ""/);

      // Rule 4: One-sentence simple Arabic explanation for readable items; empty string for low-confidence items
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/short_explanation/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/one-sentence, very simple Arabic explanation/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/For low-confidence items, you MUST leave short_explanation as an empty string ""/i);

      // Rule 5: Maximum 10 items
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/maximum of 10 items/i);

      // Additional prompt requirements:
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/line_text_as_written/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/audio_summary/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/Return JSON only/i);
    });

    it('verifies PRESCRIPTION_RESPONSE_SCHEMA strictly enforces root and item properties and enums', () => {
      expect(PRESCRIPTION_RESPONSE_SCHEMA.type).toBe('OBJECT');
      expect(PRESCRIPTION_RESPONSE_SCHEMA.required).toEqual(
        expect.arrayContaining([
          'is_clear',
          'retake_message',
          'confidence',
          'evidence_text',
          'items',
          'audio_summary'
        ])
      );

      // Root confidence enum
      expect(PRESCRIPTION_RESPONSE_SCHEMA.properties.confidence.enum).toEqual(['high', 'medium', 'low']);

      // Items array schema
      const itemsProperty = PRESCRIPTION_RESPONSE_SCHEMA.properties.items;
      expect(itemsProperty.type).toBe('ARRAY');
      expect(itemsProperty.items.type).toBe('OBJECT');

      // Required fields in each prescription item (including M2 confirmation status)
      expect(itemsProperty.items.required).toEqual([
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

      // Item confidence enum
      expect(itemsProperty.items.properties.confidence.enum).toEqual(['high', 'medium', 'low']);
    });

    it('verifies prescription mode routing via /prescription, /api/prescription, and body.mode="prescription"', async () => {
      const mockPrescriptionData = {
        is_clear: true,
        retake_message: '',
        confidence: 'high',
        evidence_text: 'Amoxil 500mg 1x3',
        items: [
          {
            line_text_as_written: 'Amoxil 500mg 1x3',
            medicine_name_ar: 'أموكسيل',
            medicine_name_en: 'Amoxil',
            active_ingredient: 'أموكسيسيلين',
            confidence: 'high',
            written_instructions: 'كبسولة كل 8 ساعات',
            short_explanation: 'مضاد حيوي لعلاج العدوى البكتيرية'
          }
        ],
        audio_summary: 'روشتة تحتوي على أموكسيل مضاد حيوي'
      };

      const routesToTest = [
        { path: 'https://worker.local/prescription', body: { image: 'base64Payload' } },
        { path: 'https://worker.local/api/prescription', body: { image: 'base64Payload' } },
        { path: 'https://worker.local/api/analyze', body: { mode: 'prescription', image: 'base64Payload' } }
      ];

      for (const route of routesToTest) {
        let capturedUrl = '';
        let capturedBody: any = null;

        vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
          capturedUrl = String(url);
          capturedBody = JSON.parse(init.body);
          return new Response(JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify(mockPrescriptionData) }] } }]
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        });

        const req = new Request(route.path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(route.body)
        });

        const res = await worker.fetch(req, baseEnv);
        expect(res.status).toBe(200);

        // Uses GEMINI_MODEL_PRESCRIPTION (gemini-3.8-flash)
        expect(capturedUrl).toContain('/models/gemini-3.8-flash:generateContent');
        expect(capturedBody.generationConfig.responseSchema).toEqual(PRESCRIPTION_RESPONSE_SCHEMA);
        expect(capturedBody.systemInstruction.parts[0].text).toBe(PRESCRIPTION_SYSTEM_PROMPT);

        const data = await res.json() as any;
        expect(data.is_clear).toBe(true);
        expect(data.items).toHaveLength(1);
        expect(data.items[0].medicine_name_ar).toBe('أموكسيل');
        expect(data.items[0].confidence).toBe('high');
        expect(data.error_code).toBeNull();
      }
    });

    it('handles NO_CANDIDATE_TEXT and INVALID_JSON in prescription mode with safe fallback items=[] and confidence="low"', async () => {
      // 1. NO_CANDIDATE_TEXT
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ candidates: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      const req1 = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });
      const res1 = await worker.fetch(req1, baseEnv);
      const data1 = await res1.json() as any;
      expect(data1.is_clear).toBe(false);
      expect(data1.confidence).toBe('low');
      expect(data1.items).toEqual([]);
      expect(data1.error_code).toBe('NO_CANDIDATE_TEXT');
      expect(data1.retake_message).toContain('الروشتة');

      // 2. INVALID_JSON
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Corrupted text not matching json' }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      const req2 = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });
      const res2 = await worker.fetch(req2, baseEnv);
      const data2 = await res2.json() as any;
      expect(data2.is_clear).toBe(false);
      expect(data2.confidence).toBe('low');
      expect(data2.items).toEqual([]);
      expect(data2.error_code).toBe('INVALID_JSON');
      expect(data2.retake_message).toContain('الروشتة');
    });

    it('rejects prescription request without image with 400 BAD_REQUEST and Arabic prescription message', async () => {
      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const res = await worker.fetch(req, baseEnv);
      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error_code).toBe('BAD_REQUEST');
      expect(data.retake_message).toContain('صورة الروشتة');
    });
  });

  // =========================================================================
  // Challenge 2: Box Prompt Rule 6 and usage_source Schema
  // =========================================================================
  describe('Challenge 2: Box Prompt Rule 6 and usage_source Schema', () => {
    it('verifies PHARMACIST_SYSTEM_PROMPT Rule 6 mandates non-empty how_and_when, printed vs common, and forbids exact doses', () => {
      expect(PHARMACIST_SYSTEM_PROMPT).toMatch(/6\.\s*how_and_when must NEVER be empty/i);
      expect(PHARMACIST_SYSTEM_PROMPT).toMatch(/must not just say follow the doctor/i);
      expect(PHARMACIST_SYSTEM_PROMPT).toMatch(/usage_source='printed'/);
      expect(PHARMACIST_SYSTEM_PROMPT).toMatch(/usage_source='common'/);
      expect(PHARMACIST_SYSTEM_PROMPT).toMatch(/COMMON general usage/i);
      expect(PHARMACIST_SYSTEM_PROMPT).toMatch(/NEVER give exact mg or ml amounts, exact doses, or personal medical advice/i);
    });

    it('verifies GEMINI_RESPONSE_SCHEMA strictly defines usage_source as enum ["printed", "common"] and marks it required', () => {
      expect(GEMINI_RESPONSE_SCHEMA.properties.usage_source).toBeDefined();
      expect(GEMINI_RESPONSE_SCHEMA.properties.usage_source.type).toBe('STRING');
      expect(GEMINI_RESPONSE_SCHEMA.properties.usage_source.enum).toEqual(['printed', 'common']);
      expect(GEMINI_RESPONSE_SCHEMA.required).toContain('usage_source');
      expect(GEMINI_RESPONSE_SCHEMA.required).toContain('how_and_when');
    });

    it('normalizes usage_source in box mode: preserves "printed", defaults any invalid or omitted value to "common"', async () => {
      const createResponse = (sourceValue?: string) => ({
        is_clear: true,
        retake_message: '',
        confidence: 'high',
        evidence_text: 'PANADOL 500mg',
        medicine_name_ar: 'بانادول',
        medicine_name_en: 'Panadol',
        active_ingredient: 'باراسيتامول',
        uses: ['تسكين الألم'],
        how_and_when: ['قرص كل 6 ساعات عند اللزوم'],
        ...(sourceValue !== undefined ? { usage_source: sourceValue } : {}),
        warnings: ['لا تتناول أكثر من 8 أقراص يومياً'],
        audio_summary: 'بانادول مسكن للألم'
      });

      // 1. Valid "printed"
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(createResponse('printed')) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      let req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });
      let res = await worker.fetch(req, baseEnv);
      let data = await res.json() as any;
      expect(data.usage_source).toBe('printed');

      // 2. Valid "common"
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(createResponse('common')) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });
      res = await worker.fetch(req, baseEnv);
      data = await res.json() as any;
      expect(data.usage_source).toBe('common');

      // 3. Hallucinated / invalid value -> normalized safely to "common"
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(createResponse('hallucinated_source')) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });
      res = await worker.fetch(req, baseEnv);
      data = await res.json() as any;
      expect(data.usage_source).toBe('common');
    });

    it('verifies MEDICINE_DETAILS_SYSTEM_PROMPT specifies usage_source="common" and details mode returns it', async () => {
      expect(MEDICINE_DETAILS_SYSTEM_PROMPT).toMatch(/usage_source='common'/);
      expect(MEDICINE_DETAILS_SYSTEM_PROMPT).toMatch(/how_and_when: 2 to 3 short items about the COMMON general usage/i);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  is_clear: true,
                  retake_message: '',
                  confidence: 'high',
                  evidence_text: 'Verified database details for كيتوفان',
                  medicine_name_ar: 'كيتوفان',
                  medicine_name_en: 'Ketofan',
                  active_ingredient: 'كيتوبروفين',
                  uses: ['مسكن ومضاد للالتهاب'],
                  how_and_when: ['كبسولة بعد الأكل مع كوب ماء كبير'],
                  usage_source: 'common',
                  warnings: ['يؤخذ بحذر لمرضى قرحة المعدة'],
                  audio_summary: 'كيتوفان مسكن للألم ومضاد للالتهاب'
                })
              }]
            }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      const req = new Request('https://worker.local/api/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicine_name: 'كيتوفان' })
      });

      const res = await worker.fetch(req, baseEnv);
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.usage_source).toBe('common');
      expect(data.medicine_name_ar).toBe('كيتوفان');
    });
  });

  // =========================================================================
  // Challenge 3: thinkingConfig Behavior and Fallback
  // =========================================================================
  describe('Challenge 3: thinkingConfig Behavior and Fallback', () => {
    it('empirically tests model with thinkingConfig (gemini-3.8-flash) vs without thinkingConfig (gemini-3.5-flash-lite)', async () => {
      let capturedBody: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
        capturedBody = JSON.parse(init.body);
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'OK' }) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      // 1. gemini-3.8-flash (non-lite) in prescription mode: thinkingConfig present with thinkingLevel 'LOW'
      const reqRx = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });
      await worker.fetch(reqRx, {
        ...baseEnv,
        GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
      });
      expect(capturedBody.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
      expect(capturedBody.generationConfig.temperature).toBeUndefined();

      // 2. gemini-3.5-flash-lite (lite) in box mode: thinkingConfig omitted completely
      const reqBox = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });
      await worker.fetch(reqBox, {
        ...baseEnv,
        GEMINI_MODEL: 'gemini-3.5-flash-lite'
      });
      expect(capturedBody.generationConfig.thinkingConfig).toBeUndefined();
      expect(capturedBody.generationConfig.temperature).toBeUndefined();

      // 3. Legacy model (gemini-1.5-flash): temperature: 0 is explicitly set
      const reqLegacy = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });
      await worker.fetch(reqLegacy, {
        ...baseEnv,
        GEMINI_MODEL: 'gemini-1.5-flash'
      });
      expect(capturedBody.generationConfig.temperature).toBe(0);
    });

    it('retries without thinkingConfig when upstream returns HTTP 400 containing "thinking" (case-insensitive)', async () => {
      let callCount = 0;
      const capturedPayloads: any[] = [];
      const warnSpy = vi.spyOn(console, 'warn');

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
        callCount++;
        capturedPayloads.push(JSON.parse(init.body));
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
            content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'Recovered OK' }) }] }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });

      const res = await worker.fetch(req, baseEnv);
      expect(callCount).toBe(2);
      expect(capturedPayloads[0].generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
      expect(capturedPayloads[1].generationConfig.thinkingConfig).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('retrying without thinkingConfig'));
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.is_clear).toBe(true);
      expect(data.evidence_text).toBe('Recovered OK');
    });

    it('does NOT retry when upstream returns HTTP 400 that does not mention thinking', async () => {
      let callCount = 0;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        return new Response(JSON.stringify({
          error: {
            code: 400,
            message: 'Invalid argument: invalid inlineData encoding format.',
            status: 'INVALID_ARGUMENT'
          }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      });

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'corruptedBase64' })
      });

      const res = await worker.fetch(req, baseEnv);
      expect(callCount).toBe(1);
      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_BAD_REQUEST');
      expect(data.upstream_status).toBe(400);
    });

    it('handles failure of the retry request gracefully if the retry also returns an error', async () => {
      let callCount = 0;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({
            error: { code: 400, message: 'Unsupported thinkingConfig' }
          }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        // Retry returns 503
        return new Response(JSON.stringify({
          error: { code: 503, message: 'Model overloaded on retry' }
        }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      });

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });

      const res = await worker.fetch(req, baseEnv);
      expect(callCount).toBe(2);
      expect(res.status).toBe(503);
      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_OVERLOADED');
      expect(data.upstream_status).toBe(503);
    });
  });

  // =========================================================================
  // Challenge 4: Upstream Error Mappings (400, 403, 429, 500, 503) & Zero Secret Exposure
  // =========================================================================
  describe('Challenge 4: Upstream Gemini Error Mappings & Zero Secret Leaks', () => {
    it('correctly maps HTTP 400 to UPSTREAM_BAD_REQUEST with safe retake message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          error: { code: 400, message: 'Invalid field in generationConfig' }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      );

      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });

      const res = await worker.fetch(req, baseEnv);
      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error).toBe('UPSTREAM_BAD_REQUEST');
      expect(data.error_code).toBe('UPSTREAM_BAD_REQUEST');
      expect(data.upstream_status).toBe(400);
      expect(data.retake_message).toContain('خطأ في صياغة طلب التحليل');
    });

    it('correctly maps HTTP 403/400 location restrictions to UPSTREAM_LOCATION_RESTRICTED (403)', async () => {
      const geoBlockPhrases = [
        'User location is not supported for the API use.',
        'This country is not supported.',
        'Region blocked. FAILED_PRECONDITION.'
      ];

      for (const phrase of geoBlockPhrases) {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(JSON.stringify({
            error: { code: 400, message: phrase }
          }), { status: 400, headers: { 'Content-Type': 'application/json' } })
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

    it('correctly maps HTTP 429 to UPSTREAM_RATE_LIMIT (429) and preserves Retry-After header', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          error: { code: 429, message: 'Resource has been exhausted (e.g. check quota).' }
        }), { status: 429, headers: { 'Content-Type': 'application/json' } })
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
      expect(data.upstream_status).toBe(429);
      expect(data.retake_message).toContain('حد الطلبات لدى مزود الخدمة');
    });

    it('correctly maps HTTP 503 to UPSTREAM_OVERLOADED (503)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          error: { code: 503, message: 'The model is overloaded. Please try again later.' }
        }), { status: 503, headers: { 'Content-Type': 'application/json' } })
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
      expect(data.upstream_status).toBe(503);
      expect(data.retake_message).toContain('تحت ضغط مؤقت');
    });

    it('correctly maps HTTP 500 to UPSTREAM_API_ERROR (500)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          error: { code: 500, message: 'Internal server error at Google Generative Language service.' }
        }), { status: 500, headers: { 'Content-Type': 'application/json' } })
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
      expect(data.upstream_status).toBe(500);
      expect(data.retake_message).toContain('حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية');
    });

    it('correctly maps 25-second AbortController timeout to HTTP 504 UPSTREAM_TIMEOUT with 25s message', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
        return new Promise((_resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener('abort', () => {
              const timeoutErr = new DOMException('Upstream Gemini request timed out after 25 seconds', 'TimeoutError');
              reject(timeoutErr);
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
      await vi.advanceTimersByTimeAsync(25001);

      const res = await workerPromise;
      expect(res.status).toBe(504);
      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_TIMEOUT');
      expect(data.upstream_status).toBe(504);
      expect(data.retake_message).toContain('25 ثانية');

      vi.useRealTimers();
    });

    it('ADVERSARIAL SECRET LEAK CHALLENGE (Response Body & Console Logs): guarantees API keys, query keys, headers, and base64 payloads never leak', async () => {
      const leakedApiKey = 'AIzaSyAdversarialProductionKey999999999';
      const leakedBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

      const errorPayloadWithSecrets = JSON.stringify({
        error: {
          code: 500,
          message: `Backend failed connecting with key ${leakedApiKey} using ?key=${leakedApiKey} and x-goog-api-key: ${leakedApiKey} and authorization: Bearer ${leakedApiKey} with inlineData: {"data":"${leakedBase64}"}`
        }
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(errorPayloadWithSecrets, { status: 500, headers: { 'Content-Type': 'application/json' } })
      );

      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error');

      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64Sample' })
      });

      const res = await worker.fetch(req, baseEnv);
      const rawText = await res.text();

      // 1. Assert response body NEVER contains raw API key or raw image base64
      expect(rawText).not.toContain(leakedApiKey);
      expect(rawText).not.toContain(leakedBase64);
      expect(rawText).toContain('[REDACTED_KEY]');

      // 2. Assert console.error logs NEVER contain raw API key or raw image base64
      expect(consoleErrorSpy).toHaveBeenCalled();
      for (const callArgs of consoleErrorSpy.mock.calls) {
        const loggedString = callArgs.join(' ');
        expect(loggedString).not.toContain(leakedApiKey);
        expect(loggedString).not.toContain(leakedBase64);
      }

      // 3. Direct challenge on sanitizeMessage and parseUpstreamError functions
      const directSanitized = sanitizeMessage(`leak: ${leakedApiKey} and ${leakedBase64}`);
      expect(directSanitized).not.toContain(leakedApiKey);
      expect(directSanitized).not.toContain(leakedBase64);
      expect(directSanitized).toContain('[REDACTED_KEY]');

      const parsedError = parseUpstreamError(errorPayloadWithSecrets, 500);
      expect(parsedError.detail).not.toContain(leakedApiKey);
      expect(parsedError.detail).not.toContain(leakedBase64);
      expect(parsedError.isLocationBlocked).toBe(false);
    });

    it('ADVERSARIAL UNEXPECTED THROW CHALLENGE: verifies network error throwing URL with ?key=... is sanitized in catch block and logs', async () => {
      const liveKey = 'AIzaSyLiveSecretKeyEmbeddedInUrl123456';
      const consoleErrorSpy = vi.spyOn(console, 'error');

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        throw new TypeError(`Network error connecting to https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${liveKey}`);
      });

      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });

      const res = await worker.fetch(req, {
        ...baseEnv,
        GEMINI_API_KEY: liveKey
      });

      expect(res.status).toBe(500);
      const body = await res.text();

      // Ensure key is NOT in response body
      expect(body).not.toContain(liveKey);
      expect(body).toContain('[REDACTED_KEY]');

      // Ensure key is NOT in console.error log
      expect(consoleErrorSpy).toHaveBeenCalled();
      for (const callArgs of consoleErrorSpy.mock.calls) {
        const loggedString = callArgs.join(' ');
        expect(loggedString).not.toContain(liveKey);
        expect(loggedString).toContain('[REDACTED_KEY]');
      }
    });
  });

  // =========================================================================
  // Challenge 5: Dynamic Model Configuration & Details Mode Edge Cases
  // =========================================================================
  describe('Challenge 5: Dynamic Model Configuration & Details Mode Edge Cases', () => {
    it('allows overriding GEMINI_MODEL and GEMINI_MODEL_PRESCRIPTION via env without hardcoded fallback overrides', async () => {
      let capturedUrl = '';

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        capturedUrl = String(url);
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ is_clear: true, evidence_text: 'OK' }) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      // Custom models in env
      const customEnv = {
        GEMINI_API_KEY: 'test-key',
        GEMINI_MODEL: 'custom-box-model-v2',
        GEMINI_MODEL_PRESCRIPTION: 'custom-prescription-model-v3'
      };

      // 1. Box mode with custom model
      const boxReq = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });
      await worker.fetch(boxReq, customEnv);
      expect(capturedUrl).toContain('/models/custom-box-model-v2:generateContent');

      // 2. Prescription mode with custom model
      const rxReq = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64' })
      });
      await worker.fetch(rxReq, customEnv);
      expect(capturedUrl).toContain('/models/custom-prescription-model-v3:generateContent');
    });

    it('rejects details mode with empty or whitespace-only medicine_name', async () => {
      const invalidMedicineNames = ['', '   ', '\t\n'];

      for (const name of invalidMedicineNames) {
        const req = new Request('https://worker.local/api/details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ medicine_name: name })
        });

        const res = await worker.fetch(req, baseEnv);
        expect(res.status).toBe(400);
        const data = await res.json() as any;
        expect(data.error_code).toBe('BAD_REQUEST');
        expect(data.retake_message).toContain('اسم الدواء');
      }
    });

    it('processes 1600px/0.8 prescription image payload without error as long as within 4MB limit', async () => {
      // Create a 1.5MB base64 payload
      const mock1600pxPayload = 'A'.repeat(1500000);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  is_clear: true,
                  retake_message: '',
                  confidence: 'high',
                  evidence_text: 'Augmentin 1g',
                  items: [
                    {
                      line_text_as_written: 'Augmentin 1g 1x2',
                      medicine_name_ar: 'أوجمنتين',
                      medicine_name_en: 'Augmentin',
                      active_ingredient: 'أموكسيسيلين + كلافولانات',
                      confidence: 'high',
                      written_instructions: 'قرص كل 12 ساعة',
                      short_explanation: 'مضاد حيوي'
                    }
                  ],
                  audio_summary: 'أوجمنتين مضاد حيوي'
                })
              }]
            }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: mock1600pxPayload })
      });

      const res = await worker.fetch(req, baseEnv);
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.is_clear).toBe(true);
      expect(data.items).toHaveLength(1);
    });
  });
});
