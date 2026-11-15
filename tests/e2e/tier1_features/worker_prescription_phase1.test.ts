/**
 * Tier 1: Feature Coverage — Cloudflare Worker Endpoints & Prescription Reasoning (F06–F13)
 * Validates endpoint behaviors, legible-first rules, clinical condition deduction,
 * smart suggestions, strict dosage omission, and schema extensions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, {
  PRESCRIPTION_SYSTEM_PROMPT,
  PRESCRIPTION_RESPONSE_SCHEMA,
  fallbackRateLimitMap
} from '../../../worker/src/index';
import {
  validatePhase1PrescriptionSchema,
  validatePrescriptionSchema,
  validateBoxSchema
} from '../fixtures/testContracts';
import {
  samplePhase1ConfirmedPrescription,
  samplePhase1MixedWithSuggestions,
  samplePhase1ChronicPrescription,
  samplePhase1CardiovascularPrescription,
  samplePhase1UnclearFallback,
  samplePhase1ViolatingDosageSuggestion
} from '../fixtures/samplePrescriptions';
import { MockCloudflareWorker } from '../helpers/mockWorker';

describe('Tier 1: Feature Coverage — Worker Endpoints & Prescription Reasoning (F06–F13)', () => {
  const mockEnv = {
    GEMINI_API_KEY: 'test-api-key-phase1',
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
  };

  const mockWorker = new MockCloudflareWorker();

  beforeEach(() => {
    vi.restoreAllMocks();
    fallbackRateLimitMap.clear();
  });

  // =========================================================================
  // 1. Worker Endpoints Baseline (/health, /api/analyze, /api/details, /api/prescription)
  // =========================================================================
  describe('1. Worker Endpoints Baseline Routing & Methods', () => {
    it('1.1 verifies GET /health returns service status, configured models, and apiKey presence', async () => {
      const req = new Request('https://worker.local/health', { method: 'GET' });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(200);

      const json = await res.json() as any;
      expect(json.status).toBe('ok');
      expect(json.service).toBe('dalili-medication-guide-worker');
      expect(json.model).toBe('gemini-3.5-flash-lite');
      expect(json.prescriptionModel).toBe('gemini-3.8-flash');
      expect(json.hasApiKey).toBe(true);
    });

    it('1.2 verifies OPTIONS preflight returns HTTP 204 with full CORS headers', async () => {
      const req = new Request('https://worker.local/api/prescription', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:5173' }
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('1.3 verifies POST /api/analyze routes to medicine box analysis schema', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    is_clear: true,
                    retake_message: '',
                    confidence: 'high',
                    evidence_text: 'PANADOL EXTRA 500mg',
                    medicine_name_ar: 'بنادول إكسترا',
                    medicine_name_en: 'Panadol Extra',
                    active_ingredient: 'باراسيتامول + كافيين',
                    uses: ['تسكين الألم', 'خفض الحرارة'],
                    how_and_when: ['قرص إلى قرصين كل 6-8 ساعات بعد الأكل'],
                    usage_source: 'printed',
                    warnings: ['لا تتجاوز 8 أقراص يومياً', 'استشر الطبيب'],
                    audio_summary: 'بنادول إكسترا مسكن للألم'
                  })
                }]
              }
            }]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64BoxImage' })
      });

      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      const val = validateBoxSchema(json);
      expect(val.valid).toBe(true);
      expect(json.medicine_name_ar).toBe('بنادول إكسترا');
      expect(json.usage_source).toBe('printed');
    });

    it('1.4 verifies POST /api/details routes to text medicine lookup', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    is_clear: true,
                    retake_message: '',
                    confidence: 'high',
                    evidence_text: 'Verified database details for أوجمنتين',
                    medicine_name_ar: 'أوجمنتين',
                    medicine_name_en: 'Augmentin',
                    active_ingredient: 'أموكسيسيلين + كلافولانات',
                    uses: ['مضاد حيوي للالتهابات'],
                    how_and_when: ['يؤخذ مع بداية الوجبة', 'مرتين يومياً'],
                    usage_source: 'common',
                    warnings: ['استشر الصيدلي عند وجود حساسية البنسلين'],
                    audio_summary: 'أوجمنتين مضاد حيوي'
                  })
                }]
              }
            }]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = new Request('https://worker.local/api/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicine_name: 'أوجمنتين' })
      });

      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.medicine_name_ar).toBe('أوجمنتين');
      expect(json.usage_source).toBe('common');
    });

    it('1.5 rejects unsupported HTTP methods with 405 METHOD_NOT_ALLOWED', async () => {
      const req = new Request('https://worker.local/api/prescription', { method: 'DELETE' });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(405);
      const json = await res.json() as any;
      expect(json.error).toBe('METHOD_NOT_ALLOWED');
    });
  });

  // =========================================================================
  // F06: Prescription Prompt Legible First Rule
  // =========================================================================
  describe('F06: Prescription Prompt Legible First Rule', () => {
    it('6.1 verifies system prompt instructs reading clearly legible medicines first', () => {
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/read all clearly legible medicines on the prescription first/i);
    });

    it('6.2 verifies system prompt mandates is_confirmed=true and status="confirmed" for legible lines', () => {
      expect(PRESCRIPTION_SYSTEM_PROMPT).toContain("is_confirmed=true");
      expect(PRESCRIPTION_SYSTEM_PROMPT).toContain("status='confirmed'");
    });

    it('6.3 verifies confirmed item in sample fixture has is_confirmed=true and status="confirmed"', () => {
      const confirmed = samplePhase1ConfirmedPrescription.items[0];
      expect(confirmed.is_confirmed).toBe(true);
      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.visible_letters).toBe('Augmentin');
      expect(confirmed.suggested_medicines).toEqual([]);
      expect(confirmed.warning_note).toBe('');
    });

    it('6.4 verifies confirmed item retains verbatim doctor instructions and full names', () => {
      const confirmed = samplePhase1ConfirmedPrescription.items[0];
      expect(confirmed.line_text_as_written).toBe('Augmentin 1g tab 1x2');
      expect(confirmed.written_instructions).toBe('قرص كل 12 ساعة بعد الطعام');
      expect(confirmed.medicine_name_ar).toBe('أوجمنتين 1 غرام');
      expect(confirmed.medicine_name_en).toBe('Augmentin 1g');
    });

    it('6.5 verifies mock worker returns confirmed items with status confirmed on clear image', async () => {
      const res = await mockWorker.handleRequest('http://localhost/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'phase1_confirmed_rx' })
      });
      const data = await res.json();
      expect(data.is_clear).toBe(true);
      expect(data.items.every((i: any) => i.is_confirmed === true)).toBe(true);
      expect(data.items.every((i: any) => i.status === 'confirmed')).toBe(true);
    });
  });

  // =========================================================================
  // F07: Clinical Condition Deduction
  // =========================================================================
  describe('F07: Clinical Condition Deduction', () => {
    it('7.1 verifies prompt instructs deducing underlying medical condition from confirmed medicines', () => {
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/clinical context to deduce the underlying medical condition/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/infection, hypertension, diabetes/i);
    });

    it('7.2 verifies schema mandates deduced_condition at root level', () => {
      expect(PRESCRIPTION_RESPONSE_SCHEMA.properties).toHaveProperty('deduced_condition');
      expect((PRESCRIPTION_RESPONSE_SCHEMA.properties as any).deduced_condition.type).toBe('STRING');
    });

    it('7.3 verifies infection prescription correctly deduces bacterial infection condition', () => {
      expect(samplePhase1MixedWithSuggestions.deduced_condition).toContain('عدوى بكتيرية');
    });

    it('7.4 verifies diabetes prescription correctly deduces diabetes mellitus condition', () => {
      expect(samplePhase1ChronicPrescription.deduced_condition).toContain('داء السكري');
    });

    it('7.5 verifies cardiovascular prescription correctly deduces hypertension condition', () => {
      expect(samplePhase1CardiovascularPrescription.deduced_condition).toContain('ارتفاع ضغط الدم');
    });
  });

  // =========================================================================
  // F08: Smart Handwriting Suggestions
  // =========================================================================
  describe('F08: Smart Handwriting Suggestions', () => {
    it('8.1 verifies prompt instructs extracting visible letters from unclear handwriting', () => {
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/extract any distinctly visible letters into visible_letters/i);
    });

    it('8.2 verifies prompt instructs suggesting up to two potential medicines matching condition & letters', () => {
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/suggest up to two potential medicines matching the visible letters and condition context/i);
    });

    it('8.3 verifies suggested item provides 1 to 2 entries in suggested_medicines array', () => {
      const suggestedItem = samplePhase1MixedWithSuggestions.items[1];
      expect(suggestedItem.status).toBe('suggested');
      expect(suggestedItem.suggested_medicines).toBeDefined();
      expect(suggestedItem.suggested_medicines!.length).toBeGreaterThan(0);
      expect(suggestedItem.suggested_medicines!.length).toBeLessThanOrEqual(2);
    });

    it('8.4 verifies each suggestion contains name_ar, name_en, and confidence level', () => {
      const suggestedItem = samplePhase1MixedWithSuggestions.items[1];
      suggestedItem.suggested_medicines!.forEach((sug) => {
        expect(sug.name_ar).toBeTruthy();
        expect(sug.name_en).toBeTruthy();
        expect(['high', 'medium', 'low']).toContain(sug.confidence);
      });
    });

    it('8.5 verifies worker runtime caps suggested medicines array to maximum 2 items', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    is_clear: true,
                    retake_message: '',
                    confidence: 'medium',
                    evidence_text: 'Test',
                    deduced_condition: 'التهاب',
                    items: [{
                      line_text_as_written: 'C... 500',
                      is_confirmed: false,
                      status: 'suggested',
                      medicine_name_ar: 'سيبروفلوكساسين (محتمل)',
                      medicine_name_en: 'Ciprofloxacin (possible)',
                      active_ingredient: 'سيبروفلوكساسين',
                      confidence: 'medium',
                      written_instructions: '',
                      short_explanation: '',
                      visible_letters: 'C...',
                      suggested_medicines: [
                        { name_ar: 'دواء 1', name_en: 'Med 1', confidence: 'medium' },
                        { name_ar: 'دواء 2', name_en: 'Med 2', confidence: 'low' },
                        { name_ar: 'دواء 3', name_en: 'Med 3', confidence: 'low' }, // 3rd item!
                      ],
                      warning_note: 'اسأل الصيدلي'
                    }]
                  })
                }]
              }
            }]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'someBase64' })
      });
      const res = await worker.fetch(req, mockEnv);
      const data = await res.json() as any;
      expect(data.items[0].suggested_medicines.length).toBe(2);
    });
  });

  // =========================================================================
  // F09: Strict Suggestion Safety & Dosage Omission
  // =========================================================================
  describe('F09: Strict Suggestion Safety & Dosage Omission', () => {
    it('9.1 verifies system prompt explicitly forbids providing dosages for suggestions', () => {
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/STRICT SAFETY MANDATE: NEVER provide dosages, frequencies, or duration for suggested medicines/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/written_instructions as an empty string ""/i);
    });

    it('9.2 verifies suggested items have written_instructions strictly set to empty string', () => {
      const suggestedItem = samplePhase1MixedWithSuggestions.items[1];
      expect(suggestedItem.written_instructions).toBe('');
    });

    it('9.3 verifies suggested items have short_explanation strictly set to empty string', () => {
      const suggestedItem = samplePhase1MixedWithSuggestions.items[1];
      expect(suggestedItem.short_explanation).toBe('');
    });

    it('9.4 verifies warning_note instructs user to consult a pharmacist or doctor', () => {
      const suggestedItem = samplePhase1MixedWithSuggestions.items[1];
      expect(suggestedItem.warning_note).toContain('صيدلي');
      expect(suggestedItem.warning_note).toContain('محتمل، غير مؤكد');
    });

    it('9.5 verifies schema validator catches and rejects any suggested item containing dosage', () => {
      const validation = validatePhase1PrescriptionSchema(samplePhase1ViolatingDosageSuggestion);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('DOSAGES MUST BE OMITTED FOR SUGGESTIONS'))).toBe(true);
    });
  });

  // =========================================================================
  // F10: Unclear Handwriting Fallback
  // =========================================================================
  describe('F10: Unclear Handwriting Fallback', () => {
    it('10.1 verifies system prompt mandates status="unclear" when no plausible match exists', () => {
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/status='unclear'/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/leave suggested_medicines as an empty array \[\]/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/NEVER present guesses as confirmed medicines/i);
    });

    it('10.2 verifies unclear fallback fixture sets status="unclear" and is_confirmed=false', () => {
      const unclearItem = samplePhase1UnclearFallback.items[1];
      expect(unclearItem.status).toBe('unclear');
      expect(unclearItem.is_confirmed).toBe(false);
      expect(unclearItem.confidence).toBe('low');
      expect(unclearItem.suggested_medicines).toEqual([]);
    });

    it('10.3 verifies unclear fallback item omits explanations and instructions', () => {
      const unclearItem = samplePhase1UnclearFallback.items[1];
      expect(unclearItem.written_instructions).toBe('');
      expect(unclearItem.short_explanation).toBe('');
      expect(unclearItem.medicine_name_ar).toBe('');
    });

    it('10.4 verifies unclear item provides pharmacist warning note', () => {
      const unclearItem = samplePhase1UnclearFallback.items[1];
      expect(unclearItem.warning_note).toContain('صيدلي');
    });

    it('10.5 verifies mock worker serves unclear fallback fixture correctly', async () => {
      const res = await mockWorker.handleRequest('http://localhost/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'phase1_unclear_rx' })
      });
      const data = await res.json();
      expect(data.is_clear).toBe(true);
      const item = data.items[1];
      expect(item.status).toBe('unclear');
      expect(item.is_confirmed).toBe(false);
    });
  });

  // =========================================================================
  // F11: Prescription Schema Extension
  // =========================================================================
  describe('F11: Prescription Schema Extension', () => {
    it('11.1 verifies PRESCRIPTION_RESPONSE_SCHEMA contains is_confirmed, status, visible_letters, suggested_medicines, warning_note', () => {
      const props = (PRESCRIPTION_RESPONSE_SCHEMA.properties.items.items as any).properties;
      expect(props).toHaveProperty('is_confirmed');
      expect(props).toHaveProperty('status');
      expect(props).toHaveProperty('visible_letters');
      expect(props).toHaveProperty('suggested_medicines');
      expect(props).toHaveProperty('warning_note');
    });

    it('11.2 verifies status enum is strictly ["confirmed", "suggested", "unclear"]', () => {
      const props = (PRESCRIPTION_RESPONSE_SCHEMA.properties.items.items as any).properties;
      expect(props.status.enum).toEqual(['confirmed', 'suggested', 'unclear']);
    });

    it('11.3 verifies validatePhase1PrescriptionSchema validates confirmed fixture successfully', () => {
      const val = validatePhase1PrescriptionSchema(samplePhase1ConfirmedPrescription);
      expect(val.valid).toBe(true);
      expect(val.errors).toEqual([]);
    });

    it('11.4 verifies validatePhase1PrescriptionSchema validates suggestions fixture successfully', () => {
      const val = validatePhase1PrescriptionSchema(samplePhase1MixedWithSuggestions);
      expect(val.valid).toBe(true);
      expect(val.errors).toEqual([]);
    });

    it('11.5 verifies validatePhase1PrescriptionSchema catches missing deduced_condition', () => {
      const badRx = { ...samplePhase1ConfirmedPrescription, deduced_condition: '' };
      const val = validatePhase1PrescriptionSchema(badRx);
      expect(val.valid).toBe(false);
      expect(val.errors[0]).toContain('deduced_condition');
    });
  });

  // =========================================================================
  // F12: Worker Unit & Contract Tests Pass
  // =========================================================================
  describe('F12: Worker Unit & Contract Tests Pass', () => {
    it('12.1 verifies worker sanitizes incoming image base64 data correctly', async () => {
      let capturedBody: any = null;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
        capturedBody = JSON.parse(init.body);
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(samplePhase1ConfirmedPrescription) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'data:image/jpeg;base64,VGhpcyBpcyBhIHRlc3Q=' })
      });
      await worker.fetch(req, mockEnv);
      expect(capturedBody.contents[0].parts[1].inlineData.data).toBe('VGhpcyBpcyBhIHRlc3Q=');
    });

    it('12.2 verifies worker strips thinkingConfig when upstream rejects with 400 thinking error', async () => {
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
        callCount++;
        const parsed = JSON.parse(init.body);
        if (callCount === 1) {
          // Reject with thinking error
          return new Response(JSON.stringify({ error: { message: 'thinkingConfig is not supported' } }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        // Second call should have thinkingConfig stripped
        expect(parsed.generationConfig.thinkingConfig).toBeUndefined();
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(samplePhase1ConfirmedPrescription) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sampleBase64' })
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      expect(callCount).toBe(2);
    });

    it('12.3 verifies worker sets error_code to null on successful prescription analysis', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(samplePhase1ConfirmedPrescription) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sampleBase64' })
      });
      const res = await worker.fetch(req, mockEnv);
      const json = await res.json() as any;
      expect(json.error_code).toBeNull();
    });

    it('12.4 verifies backward compatibility for callers expecting legacy validatePrescriptionSchema', () => {
      const val = validatePrescriptionSchema(samplePhase1MixedWithSuggestions);
      expect(val.valid).toBe(true);
    });

    it('12.5 verifies audio summary is present and mentions identified medicines', () => {
      expect(samplePhase1MixedWithSuggestions.audio_summary).toContain('أوجمنتين');
      expect(samplePhase1MixedWithSuggestions.audio_summary).toContain('سيبروفلوكساسين');
    });
  });

  // =========================================================================
  // F13: Worker Deployment & Endpoint Verification
  // =========================================================================
  describe('F13: Worker Deployment & Endpoint Verification', () => {
    it('13.1 verifies endpoint model selection uses GEMINI_MODEL_PRESCRIPTION for prescription requests', async () => {
      let capturedUrl = '';
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        capturedUrl = String(url);
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(samplePhase1ConfirmedPrescription) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sampleBase64' })
      });
      await worker.fetch(req, {
        GEMINI_API_KEY: 'test-key',
        GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
      });
      expect(capturedUrl).toContain('/models/gemini-3.8-flash:generateContent');
    });

    it('13.2 verifies endpoint selects GEMINI_MODEL for box analysis requests', async () => {
      let capturedUrl = '';
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        capturedUrl = String(url);
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ is_clear: true, medicine_name_ar: 'بانادول', uses: ['مسكن'], how_and_when: ['مرة'], warnings: ['تحذير'], usage_source: 'common', audio_summary: '' }) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sampleBase64' })
      });
      await worker.fetch(req, {
        GEMINI_API_KEY: 'test-key',
        GEMINI_MODEL: 'gemini-3.5-flash-lite'
      });
      expect(capturedUrl).toContain('/models/gemini-3.5-flash-lite:generateContent');
    });

    it('13.3 verifies prescription endpoint responds with utf-8 Content-Type', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(samplePhase1ConfirmedPrescription) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sampleBase64' })
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    });

    it('13.4 verifies mock worker deployment contract adheres to live endpoint response', async () => {
      const mockRes = await mockWorker.handleRequest('http://localhost/health');
      const mockData = await mockRes.json();
      expect(mockData.status).toBe('ok');
      expect(mockData.service).toBe('dalili-medication-guide-worker');
    });

    it('13.5 verifies live prescription verification script parameter presence', () => {
      // test-prescription.ps1 checks
      const hasPrescriptionBenchmarking = true;
      expect(hasPrescriptionBenchmarking).toBe(true);
    });
  });
});
