import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, {
  PRESCRIPTION_SYSTEM_PROMPT,
  PRESCRIPTION_RESPONSE_SCHEMA,
  fallbackRateLimitMap
} from '../worker/src/index';

describe('Adversarial Stress Testing — Prescription Prompt & Defensive Normalizer', () => {
  const mockEnv = {
    GEMINI_API_KEY: 'test-adversarial-key-789',
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    fallbackRateLimitMap.clear();
  });

  const createMockGeminiFetch = (geminiOutput: any) => {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(geminiOutput) }]
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
  };

  const dispatchPrescriptionRequest = async (bodyOverrides: Record<string, any> = {}) => {
    const request = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: 'data:image/jpeg;base64,dGVzdA==',
        mode: 'prescription',
        ...bodyOverrides
      })
    });
    return worker.fetch(request, mockEnv);
  };

  describe('1. Adversarial Suggestions Capping & Malformed Suggestion Arrays', () => {
    it('strictly caps suggestions to 2 when LLM returns 3 or 4 suggestions', async () => {
      const mockPayload = {
        is_clear: true,
        retake_message: '',
        confidence: 'medium',
        evidence_text: 'Amox... 500',
        deduced_condition: 'التهاب بكتيري',
        items: [
          {
            line_text_as_written: 'Amox... 500',
            is_confirmed: false,
            status: 'suggested',
            medicine_name_ar: 'أموكسيسيلين (محتمل)',
            medicine_name_en: 'Amoxicillin (possible)',
            active_ingredient: 'أموكسيسيلين',
            confidence: 'medium',
            written_instructions: '',
            short_explanation: '',
            visible_letters: 'Amox...',
            suggested_medicines: [
              { name_ar: 'أموكسيسيلين 500', name_en: 'Amoxicillin 500mg', confidence: 'medium' },
              { name_ar: 'أموكسيل 500', name_en: 'Amoxil 500mg', confidence: 'medium' },
              { name_ar: 'أوجمنتين 500', name_en: 'Augmentin 500mg', confidence: 'low' },
              { name_ar: 'أمبيسيلين 500', name_en: 'Ampicillin 500mg', confidence: 'low' }
            ],
            warning_note: 'محتمل، غير مؤكد - اسأل الصيدلي'
          }
        ],
        audio_summary: 'روشتة'
      };

      createMockGeminiFetch(mockPayload);
      const res = await dispatchPrescriptionRequest();
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.items[0].suggested_medicines).toHaveLength(2);
      expect(data.items[0].suggested_medicines[0].name_en).toBe('Amoxicillin 500mg');
      expect(data.items[0].suggested_medicines[1].name_en).toBe('Amoxil 500mg');
    });

    it('safely handles non-array suggested_medicines (null, primitive string, number, boolean)', async () => {
      const mockPayload = {
        is_clear: true,
        retake_message: '',
        confidence: 'medium',
        evidence_text: 'Unclear line',
        deduced_condition: 'غير محدد',
        items: [
          {
            line_text_as_written: 'Scribble 1',
            status: 'suggested',
            suggested_medicines: 'Not an array!' // invalid type
          },
          {
            line_text_as_written: 'Scribble 2',
            status: 'suggested',
            suggested_medicines: null // null type
          },
          {
            line_text_as_written: 'Scribble 3',
            status: 'suggested',
            suggested_medicines: 12345 // number type
          }
        ],
        audio_summary: 'روشتة'
      };

      createMockGeminiFetch(mockPayload);
      const res = await dispatchPrescriptionRequest();
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.items[0].suggested_medicines).toEqual([]);
      expect(data.items[1].suggested_medicines).toEqual([]);
      expect(data.items[2].suggested_medicines).toEqual([]);
    });

    it('sanitizes malformed objects within suggested_medicines without throwing', async () => {
      const mockPayload = {
        is_clear: true,
        retake_message: '',
        confidence: 'medium',
        evidence_text: 'Amox...',
        deduced_condition: 'عدوى',
        items: [
          {
            line_text_as_written: 'Amox...',
            status: 'suggested',
            suggested_medicines: [
              null, // null entry in array
              { name_ar: null, name_en: undefined, confidence: 'SUPER_HIGH' }, // invalid confidence & null names
              { name_ar: 'دواء ثالث', name_en: 'Drug 3', confidence: 'low' }
            ]
          }
        ],
        audio_summary: 'روشتة'
      };

      createMockGeminiFetch(mockPayload);
      const res = await dispatchPrescriptionRequest();
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      const suggestions = data.items[0].suggested_medicines;
      expect(suggestions).toHaveLength(2); // capped at 2
      // First item from null
      expect(suggestions[0].name_ar).toBe('');
      expect(suggestions[0].name_en).toBe('');
      expect(suggestions[0].confidence).toBe('medium'); // defaulted from non-enum
      // Second item
      expect(suggestions[1].name_ar).toBe('');
      expect(suggestions[1].name_en).toBe('');
      expect(suggestions[1].confidence).toBe('medium'); // defaulted from invalid SUPER_HIGH
    });
  });

  describe('2. Adversarial Dosage Omission & Leakage Prevention', () => {
    it('strictly strips dosage, frequency, and instructions when LLM attempts to include them on suggested item', async () => {
      const mockPayload = {
        is_clear: true,
        retake_message: '',
        confidence: 'medium',
        evidence_text: 'Cipro 500mg tab 1x2',
        deduced_condition: 'التهاب المسالك البولية',
        items: [
          {
            line_text_as_written: 'C...fl... 500 1x2',
            is_confirmed: false,
            status: 'suggested',
            medicine_name_ar: 'سيبروفلوكساسين 500 ملغ (محتمل)',
            medicine_name_en: 'Ciprofloxacin 500mg (possible)',
            active_ingredient: 'سيبروفلوكساسين',
            confidence: 'medium',
            written_instructions: 'قرص كل 12 ساعة لمدة 7 أيام بعد الأكل', // Dangerous: dosage on suggested item!
            short_explanation: 'مضاد حيوي واسع المجال', // Explanation on suggested item
            visible_letters: 'C...fl...',
            suggested_medicines: [
              { name_ar: 'سيبروفلوكساسين', name_en: 'Ciprofloxacin', confidence: 'medium' }
            ],
            warning_note: 'محتمل، غير مؤكد - اسأل الصيدلي للتأكد من الدواء والجرعة الصحيحة'
          }
        ],
        audio_summary: 'روشتة'
      };

      createMockGeminiFetch(mockPayload);
      const res = await dispatchPrescriptionRequest();
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      const item = data.items[0];
      // Instructions and explanation MUST be forcibly stripped for suggested medicines
      expect(item.written_instructions).toBe('');
      expect(item.short_explanation).toBe('');
      expect(item.status).toBe('suggested');
    });

    it('strictly strips short_explanation for low confidence items or unclear items', async () => {
      const mockPayload = {
        is_clear: true,
        retake_message: '',
        confidence: 'low',
        evidence_text: 'scribble',
        deduced_condition: '',
        items: [
          {
            line_text_as_written: 'unknown scribble',
            is_confirmed: false,
            status: 'unclear',
            confidence: 'low',
            short_explanation: 'مسكن آلام افتراضي', // should be cleared
            written_instructions: ''
          }
        ],
        audio_summary: 'روشتة'
      };

      createMockGeminiFetch(mockPayload);
      const res = await dispatchPrescriptionRequest();
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.items[0].short_explanation).toBe('');
    });

    it('preserves written_instructions and short_explanation ONLY on confirmed items', async () => {
      const mockPayload = {
        is_clear: true,
        retake_message: '',
        confidence: 'high',
        evidence_text: 'Panadol Extra 2 tabs',
        deduced_condition: 'صداع حاد',
        items: [
          {
            line_text_as_written: 'Panadol Extra tab 1x3',
            is_confirmed: true,
            status: 'confirmed',
            medicine_name_ar: 'بنادول إكسترا',
            medicine_name_en: 'Panadol Extra',
            active_ingredient: 'باراسيتامول + كافيين',
            confidence: 'high',
            written_instructions: 'قرص كل 8 ساعات بعد الأكل',
            short_explanation: 'مسكن للآلام وخافض للحرارة',
            visible_letters: '',
            suggested_medicines: [],
            warning_note: ''
          }
        ],
        audio_summary: 'روشتة'
      };

      createMockGeminiFetch(mockPayload);
      const res = await dispatchPrescriptionRequest();
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      const item = data.items[0];
      expect(item.written_instructions).toBe('قرص كل 8 ساعات بعد الأكل');
      expect(item.short_explanation).toBe('مسكن للآلام وخافض للحرارة');
      expect(item.status).toBe('confirmed');
      expect(item.is_confirmed).toBe(true);
    });
  });

  describe('3. Pharmacist Warning Invariant & Fallback Injection', () => {
    it('injects default pharmacist warning note when warning_note is missing or empty on suggested item', async () => {
      const mockPayload = {
        is_clear: true,
        retake_message: '',
        confidence: 'medium',
        evidence_text: 'item',
        deduced_condition: '',
        items: [
          {
            line_text_as_written: 'Aspirin... ?',
            status: 'suggested',
            warning_note: '' // empty!
          },
          {
            line_text_as_written: 'Plavix... ?',
            status: 'suggested'
            // warning_note omitted completely!
          }
        ],
        audio_summary: 'روشتة'
      };

      createMockGeminiFetch(mockPayload);
      const res = await dispatchPrescriptionRequest();
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.items[0].warning_note).toContain('اسأل الصيدلي');
      expect(data.items[0].warning_note).toBe('محتمل، غير مؤكد - اسأل الصيدلي للتأكد من الدواء والجرعة الصحيحة');
      expect(data.items[1].warning_note).toBe('محتمل، غير مؤكد - اسأل الصيدلي للتأكد من الدواء والجرعة الصحيحة');
    });

    it('injects default unclear warning note when warning_note is missing on unclear item', async () => {
      const mockPayload = {
        is_clear: true,
        retake_message: '',
        confidence: 'low',
        evidence_text: 'scribble',
        deduced_condition: '',
        items: [
          {
            line_text_as_written: 'illegible scribble',
            status: 'unclear'
          }
        ],
        audio_summary: 'روشتة'
      };

      createMockGeminiFetch(mockPayload);
      const res = await dispatchPrescriptionRequest();
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.items[0].warning_note).toBe('غير واضح، اسأل الصيدلي');
    });

    it('preserves custom Arabic warning note provided by LLM if non-empty', async () => {
      const customNote = 'تنبيه: الدواء غير مؤكد إطلاقاً ويجب الرجوع للصيدلي المعتمد قبل الصرف';
      const mockPayload = {
        is_clear: true,
        retake_message: '',
        confidence: 'medium',
        evidence_text: 'test',
        deduced_condition: '',
        items: [
          {
            line_text_as_written: 'test line',
            status: 'suggested',
            warning_note: customNote
          }
        ],
        audio_summary: 'روشتة'
      };

      createMockGeminiFetch(mockPayload);
      const res = await dispatchPrescriptionRequest();
      const data = await res.json() as any;

      expect(data.items[0].warning_note).toBe(customNote);
    });
  });

  describe('4. Condition Deduction & Zero Confirmed Medicines Edge Cases', () => {
    it('handles zero confirmed medicines with empty deduced_condition gracefully', async () => {
      const mockPayload = {
        is_clear: true,
        retake_message: '',
        confidence: 'low',
        evidence_text: 'only illegible marks',
        deduced_condition: '', // No confirmed medicines to deduce condition from
        items: [
          {
            line_text_as_written: '~~~ squiggle ~~~',
            is_confirmed: false,
            status: 'unclear',
            medicine_name_ar: '',
            medicine_name_en: '',
            active_ingredient: '',
            confidence: 'low',
            written_instructions: '',
            short_explanation: '',
            visible_letters: '',
            suggested_medicines: [],
            warning_note: 'غير واضح، اسأل الصيدلي'
          }
        ],
        audio_summary: 'روشتة غير واضحة تحتوي على خط غير مقروء'
      };

      createMockGeminiFetch(mockPayload);
      const res = await dispatchPrescriptionRequest();
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.deduced_condition).toBe('');
      expect(data.items).toHaveLength(1);
      expect(data.items[0].status).toBe('unclear');
      expect(data.items[0].is_confirmed).toBe(false);
      expect(data.items[0].suggested_medicines).toEqual([]);
    });

    it('handles non-string deduced_condition (null, number, array) without crash', async () => {
      const mockPayload = {
        is_clear: true,
        retake_message: '',
        confidence: 'medium',
        evidence_text: 'sample',
        deduced_condition: null, // malformed upstream
        items: [],
        audio_summary: 'روشتة'
      };

      createMockGeminiFetch(mockPayload);
      const res = await dispatchPrescriptionRequest();
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.deduced_condition).toBe('');
      expect(data.items).toEqual([]);
    });

    it('handles completely unreadable photo with is_clear=false', async () => {
      const mockUnclearImage = {
        is_clear: false,
        retake_message: 'الصورة غير واضحة أو مظلمة، يرجى إعادة التصوير بإضاءة جيدة.',
        confidence: 'low',
        evidence_text: '',
        deduced_condition: '',
        items: [],
        audio_summary: 'الصورة غير واضحة'
      };

      createMockGeminiFetch(mockUnclearImage);
      const res = await dispatchPrescriptionRequest();
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.is_clear).toBe(false);
      expect(data.retake_message).toContain('الصورة غير واضحة');
      expect(data.items).toEqual([]);
      expect(data.deduced_condition).toBe('');
    });
  });

  describe('5. Unclear Handwriting Boundary Scenarios', () => {
    it('correctly maps unclear line with zero visible letters or zero plausible matches', async () => {
      const mockPayload = {
        is_clear: true,
        retake_message: '',
        confidence: 'medium',
        evidence_text: 'Augmentin 1g, illegible scribble',
        deduced_condition: 'عدوى بكتيرية',
        items: [
          {
            line_text_as_written: 'Augmentin 1g',
            is_confirmed: true,
            status: 'confirmed',
            medicine_name_ar: 'أوجمنتين 1 غرام',
            medicine_name_en: 'Augmentin 1g',
            active_ingredient: 'أموكسيسيلين + كلافولانات',
            confidence: 'high',
            written_instructions: '1x2',
            short_explanation: 'مضاد حيوي'
          },
          {
            line_text_as_written: '/// ???',
            is_confirmed: false,
            status: 'unclear',
            medicine_name_ar: '',
            medicine_name_en: '',
            active_ingredient: '',
            confidence: 'low',
            visible_letters: '', // zero visible letters
            suggested_medicines: [], // zero matches
            warning_note: 'غير واضح، اسأل الصيدلي'
          }
        ],
        audio_summary: 'روشتة تحتوي على أوجمنتين وسطر غير واضح'
      };

      createMockGeminiFetch(mockPayload);
      const res = await dispatchPrescriptionRequest();
      const data = await res.json() as any;

      expect(data.items).toHaveLength(2);
      const confirmed = data.items[0];
      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.is_confirmed).toBe(true);

      const unclear = data.items[1];
      expect(unclear.status).toBe('unclear');
      expect(unclear.is_confirmed).toBe(false);
      expect(unclear.visible_letters).toBe('');
      expect(unclear.suggested_medicines).toEqual([]);
      expect(unclear.warning_note).toBe('غير واضح، اسأل الصيدلي');
    });

    it('falls back safely if items is not an array or is missing entirely from upstream', async () => {
      const mockPayload = {
        is_clear: true,
        retake_message: '',
        confidence: 'high',
        evidence_text: 'some text',
        deduced_condition: 'عام',
        items: null, // missing items
        audio_summary: 'روشتة'
      };

      createMockGeminiFetch(mockPayload);
      const res = await dispatchPrescriptionRequest();
      expect(res.status).toBe(200);
      const data = await res.json() as any;

      expect(data.items).toEqual([]);
      expect(data.deduced_condition).toBe('عام');
    });
  });

  describe('6. Prompt & Schema Strict Invariants Check', () => {
    it('PRESCRIPTION_SYSTEM_PROMPT contains all R2 mandatory rules', () => {
      // 1. Read legible medicines first
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/read all clearly legible medicines on the prescription first/i);
      // 2. Deduce condition
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/deduce the underlying medical condition/i);
      // 3. Extract visible letters
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/extract any distinctly visible letters into visible_letters/i);
      // 4. Suggest up to two potential medicines
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/suggest up to two potential medicines/i);
      // 5. Mark suggestions clearly as possible not confirmed
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/محتمل، غير مؤكد/);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/\(محتمل\)/);
      // 6. Strict dosage omission for suggestions
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/STRICT SAFETY MANDATE: NEVER provide dosages, frequencies, or duration for suggested medicines/i);
      // 7. Unclear fallback with zero guesses
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/leave suggested_medicines as an empty array \[\]/i);
      expect(PRESCRIPTION_SYSTEM_PROMPT).toMatch(/NEVER present guesses as confirmed medicines/i);
    });

    it('PRESCRIPTION_RESPONSE_SCHEMA validates root and item level requirements', () => {
      expect(PRESCRIPTION_RESPONSE_SCHEMA.properties).toHaveProperty('deduced_condition');
      const itemProps = (PRESCRIPTION_RESPONSE_SCHEMA.properties.items.items as any).properties;
      expect(itemProps).toHaveProperty('is_confirmed');
      expect(itemProps).toHaveProperty('status');
      expect(itemProps).toHaveProperty('visible_letters');
      expect(itemProps).toHaveProperty('suggested_medicines');
      expect(itemProps).toHaveProperty('warning_note');
    });
  });
});
