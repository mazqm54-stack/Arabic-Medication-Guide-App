import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, {
  PRESCRIPTION_SYSTEM_PROMPT,
  PRESCRIPTION_RESPONSE_SCHEMA,
  fallbackRateLimitMap
} from '../worker/src/index';

describe('Cloudflare Worker — Milestone 2 Prescription Enhancement (R2)', () => {
  const mockEnv = {
    GEMINI_API_KEY: 'test-prescription-key-456',
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    fallbackRateLimitMap.clear();
  });

  describe('1. Enhanced Prescription Prompt Rules (PRESCRIPTION_SYSTEM_PROMPT)', () => {
    it('enforces legible-first reading rule for confirmed medicines', () => {
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/read all clearly legible medicines on the prescription first/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/is_confirmed=true/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/status='confirmed'/);
    });

    it('enforces clinical condition deduction from confirmed medicines', () => {
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/clinical context to deduce the underlying medical condition/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/deduced_condition/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/infection, hypertension, diabetes/i);
    });

    it('enforces visible letters extraction for unclear handwriting', () => {
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/extract any distinctly visible letters into visible_letters/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/visible_letters/);
    });

    it('enforces suggesting up to two potential medicines matching condition and letters', () => {
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/suggest up to two potential medicines matching the visible letters and condition context/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/suggested_medicines/);
    });

    it('enforces marking suggestions clearly as possible not confirmed with confidence ratings', () => {
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/status='suggested'/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/is_confirmed=false/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/محتمل، غير مؤكد/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/\(محتمل\)/);
    });

    it('strictly forbids providing dosages for suggested medicines and requires pharmacist consult', () => {
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/STRICT SAFETY MANDATE: NEVER provide dosages, frequencies, or duration for suggested medicines/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/written_instructions as an empty string ""/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/short_explanation as an empty string ""/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/consult a pharmacist or doctor/i);
    });

    it('enforces unclear status fallback when no plausible match exists', () => {
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/status='unclear'/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/leave suggested_medicines as an empty array \[\]/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/NEVER present guesses as confirmed medicines/i);
    });
  });

  describe('2. Enhanced Prescription Response Schema (PRESCRIPTION_RESPONSE_SCHEMA)', () => {
    it('includes root deduced_condition in properties', () => {
      expect(PRESCRIPTION_RESPONSE_SCHEMA.properties).toHaveProperty('deduced_condition');
      expect((PRESCRIPTION_RESPONSE_SCHEMA.properties as any).deduced_condition.type).toBe('STRING');
    });

    it('includes confirmation and suggestion properties in item schema', () => {
      const itemProps = (PRESCRIPTION_RESPONSE_SCHEMA.properties.items.items as any).properties;
      expect(itemProps).toHaveProperty('is_confirmed');
      expect(itemProps.is_confirmed.type).toBe('BOOLEAN');

      expect(itemProps).toHaveProperty('status');
      expect(itemProps.status.type).toBe('STRING');
      expect(itemProps.status.enum).toEqual(['confirmed', 'suggested', 'unclear']);

      expect(itemProps).toHaveProperty('visible_letters');
      expect(itemProps.visible_letters.type).toBe('STRING');

      expect(itemProps).toHaveProperty('suggested_medicines');
      expect(itemProps.suggested_medicines.type).toBe('ARRAY');
      expect(itemProps.suggested_medicines.items.type).toBe('OBJECT');
      expect(itemProps.suggested_medicines.items.required).toEqual(['name_ar', 'name_en', 'confidence']);

      expect(itemProps).toHaveProperty('warning_note');
      expect(itemProps.warning_note.type).toBe('STRING');
    });

    it('preserves backward compatibility with all required item fields', () => {
      const required = (PRESCRIPTION_RESPONSE_SCHEMA.properties.items.items as any).required;
      expect(required).toContain('line_text_as_written');
      expect(required).toContain('is_confirmed');
      expect(required).toContain('status');
      expect(required).toContain('medicine_name_ar');
      expect(required).toContain('medicine_name_en');
      expect(required).toContain('active_ingredient');
      expect(required).toContain('confidence');
      expect(required).toContain('written_instructions');
      expect(required).toContain('short_explanation');
    });
  });

  describe('3. Runtime Worker Endpoint Execution & Normalization (/api/prescription)', () => {
    it('correctly returns enhanced prescription response with confirmed and suggested items', async () => {
      const mockGeminiOutput = {
        is_clear: true,
        retake_message: '',
        confidence: 'high',
        evidence_text: 'Augmentin 1g 1x2, C...fl... 500',
        deduced_condition: 'التهاب بكتيري حاد بالجهاز التنفسي',
        items: [
          {
            line_text_as_written: 'Augmentin 1g tab 1x2',
            is_confirmed: true,
            status: 'confirmed',
            medicine_name_ar: 'أوجمنتين 1 غرام',
            medicine_name_en: 'Augmentin 1g',
            active_ingredient: 'أموكسيسيلين + كلافولانات البوتاسيوم',
            confidence: 'high',
            written_instructions: 'قرص كل 12 ساعة بعد الطعام',
            short_explanation: 'مضاد حيوي لعلاج الالتهابات البكتيرية',
            visible_letters: 'Augmentin',
            suggested_medicines: [],
            warning_note: ''
          },
          {
            line_text_as_written: 'C...fl... 500',
            is_confirmed: false,
            status: 'suggested',
            medicine_name_ar: 'سيبروفلوكساسين 500 ملغ (محتمل)',
            medicine_name_en: 'Ciprofloxacin 500mg (possible)',
            active_ingredient: 'سيبروفلوكساسين',
            confidence: 'medium',
            written_instructions: '1 tab daily', // upstream might mistakenly have sent dosage
            short_explanation: 'مضاد حيوي',
            visible_letters: 'C...fl...',
            suggested_medicines: [
              { name_ar: 'سيبروفلوكساسين 500 ملغ', name_en: 'Ciprofloxacin 500mg', confidence: 'medium' },
              { name_ar: 'سيفالكسين 500 ملغ', name_en: 'Cephalexin 500mg', confidence: 'low' },
              { name_ar: 'كلاريثروميسين', name_en: 'Clarithromycin', confidence: 'low' } // exceeds 2
            ],
            warning_note: 'محتمل، غير مؤكد - اسأل الصيدلي للتأكد من الدواء والجرعة الصحيحة'
          }
        ],
        audio_summary: 'روشتة تحتوي على أوجمنتين ودواء محتمل سيبروفلوكساسين'
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(mockGeminiOutput) }]
                }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const request = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'validBase64Data', mode: 'prescription' })
      });

      const response = await worker.fetch(request, mockEnv);
      expect(response.status).toBe(200);

      const data = await response.json() as any;
      expect(data.is_clear).toBe(true);
      expect(data.deduced_condition).toBe('التهاب بكتيري حاد بالجهاز التنفسي');
      expect(data.items.length).toBe(2);

      // Confirmed item checks
      const confirmedItem = data.items[0];
      expect(confirmedItem.is_confirmed).toBe(true);
      expect(confirmedItem.status).toBe('confirmed');
      expect(confirmedItem.medicine_name_ar).toBe('أوجمنتين 1 غرام');
      expect(confirmedItem.written_instructions).toBe('قرص كل 12 ساعة بعد الطعام');
      expect(confirmedItem.short_explanation).toBe('مضاد حيوي لعلاج الالتهابات البكتيرية');

      // Suggested item checks & safety enforcement
      const suggestedItem = data.items[1];
      expect(suggestedItem.is_confirmed).toBe(false);
      expect(suggestedItem.status).toBe('suggested');
      expect(suggestedItem.visible_letters).toBe('C...fl...');
      // Safety: dosage instructions MUST be stripped/empty for suggestions
      expect(suggestedItem.written_instructions).toBe('');
      expect(suggestedItem.short_explanation).toBe('');
      // Cap at maximum of 2 suggestions
      expect(suggestedItem.suggested_medicines.length).toBe(2);
      expect(suggestedItem.suggested_medicines[0].name_en).toBe('Ciprofloxacin 500mg');
      expect(suggestedItem.warning_note).toContain('محتمل، غير مؤكد');
    });

    it('correctly normalizes unclear handwriting items with zero guesses', async () => {
      const mockUnclearOutput = {
        is_clear: true,
        retake_message: '',
        confidence: 'medium',
        evidence_text: 'Metformin 500mg, illegible scribble',
        deduced_condition: 'داء السكري من النوع الثاني',
        items: [
          {
            line_text_as_written: 'Metformin 500mg 1x2',
            is_confirmed: true,
            status: 'confirmed',
            medicine_name_ar: 'ميتفورمين 500 ملغ',
            medicine_name_en: 'Metformin 500mg',
            active_ingredient: 'ميتفورمين',
            confidence: 'high',
            written_instructions: 'قرص بعد الأكل مرتين يومياً',
            short_explanation: 'تنظيم مستوى السكر في الدم'
          },
          {
            line_text_as_written: '~~~~ scribble ~~~~',
            confidence: 'low',
            written_instructions: '1x1'
          }
        ],
        audio_summary: 'روشتة تحتوي على دواء ميتفورمين وسطر غير واضح'
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(mockUnclearOutput) }]
                }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const request = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'validBase64Data', mode: 'prescription' })
      });

      const response = await worker.fetch(request, mockEnv);
      const data = await response.json() as any;

      expect(data.items.length).toBe(2);
      const unclearItem = data.items[1];
      expect(unclearItem.status).toBe('unclear');
      expect(unclearItem.is_confirmed).toBe(false);
      expect(unclearItem.confidence).toBe('low');
      expect(unclearItem.suggested_medicines).toEqual([]);
      expect(unclearItem.short_explanation).toBe('');
      expect(unclearItem.warning_note).toBe('غير واضح، اسأل الصيدلي');
    });

    it('raises confidence by at most ONE level and never raises low reading to high, preserving suggested status', async () => {
      const mockSuggestedOutput = {
        is_clear: true,
        retake_message: '',
        confidence: 'medium',
        evidence_text: 'Suggested Augmentin from partial letters',
        deduced_condition: 'التهاب بكتيري',
        items: [
          {
            line_text_as_written: 'Augm... 1x2',
            is_confirmed: false,
            status: 'suggested',
            medicine_name_ar: 'أوجمنتين (محتمل)',
            medicine_name_en: 'Augmentin',
            active_ingredient: 'أموكسيسيلين / كلافولانيك أسيد',
            confidence: 'low',
            visible_letters: 'Augm',
            suggested_medicines: ['Augmentin'],
            written_instructions: '',
            short_explanation: '',
            warning_note: 'محتمل، غير مؤكد - اسأل الصيدلي'
          }
        ],
        audio_summary: 'روشتة تحتوي على دواء مقترح'
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(mockSuggestedOutput) }]
                }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const request = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'validBase64Data', mode: 'prescription' })
      });

      const response = await worker.fetch(request, mockEnv);
      const data = await response.json() as any;

      expect(data.items.length).toBe(1);
      const item = data.items[0];
      // Confidence raised from 'low' to 'medium', but NEVER 'high':
      expect(item.confidence).toBe('medium');
      // Status must remain 'suggested', NOT forced to 'confirmed':
      expect(item.status).toBe('suggested');
      expect(item.is_confirmed).toBe(false);
      expect(item.warning_note).toBe('محتمل، غير مؤكد - اسأل الصيدلي');
      // Enriched with LNF Libyan brands:
      expect(item.libyan_brands).toContain('Augmentin');
    });

    it('includes deduced_condition in empty or invalid JSON prescription error response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'NOT VALID JSON' }] } }]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const request = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'base64Data', mode: 'prescription' })
      });

      const response = await worker.fetch(request, mockEnv);
      const data = await response.json() as any;
      expect(data.is_clear).toBe(false);
      expect(data.error_code).toBe('INVALID_JSON');
      expect(data.deduced_condition).toBe('');
      expect(data.items).toEqual([]);
    });
  });
});
