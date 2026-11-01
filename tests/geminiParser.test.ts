import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatPharmacistPrompt,
  cleanAndParseJson,
  parseMedicineAnalysisResult,
  validatePrescriptionJson,
  DEFAULT_COMMON_USAGE
} from '../src/services/geminiParser';
import {
  analyzePrescriptionImage,
  fetchMedicineDetails,
  AnalysisError
} from '../src/services/geminiVision';
import { clearDetailsCache } from '../src/services/detailsCache';

describe('Gemini Parser Service', () => {
  describe('1. Pharmacist Prompt & Box Parsing', () => {
    it('returns the required Arabic pharmacist system prompt with strict JSON instructions', () => {
      const prompt = formatPharmacistPrompt();
      expect(prompt).toContain('أنت صيدلي خبير ومساعد طبي ذكي مخصص لكبار السن');
      expect(prompt).toContain('is_clear');
      expect(prompt).toContain('medicine_name_ar');
      expect(prompt).toContain('medicine_name_en');
      expect(prompt).toContain('active_ingredient');
      expect(prompt).toContain('uses');
      expect(prompt).toContain('how_and_when');
      expect(prompt).toContain('warnings');
      expect(prompt).toContain('audio_summary');
      expect(prompt).toContain('لا تقدم جرعات طبية قطعية بل اذكر الإرشادات العامة');
    });

    it('correctly parses raw valid JSON response with usage_source pass-through', () => {
      const rawJson = JSON.stringify({
        is_clear: true,
        medicine_name_ar: 'بانادول',
        medicine_name_en: 'Panadol 500mg',
        active_ingredient: 'باراسيتامول',
        uses: ['مسكن للألم', 'خافض للحرارة'],
        how_and_when: ['قرص بعد الأكل عند اللزوم'],
        usage_source: 'printed',
        warnings: ['لا تتجاوز 8 أقراص يومياً'],
        audio_summary: 'دواء بانادول مسكن للألم يؤخذ بعد الأكل'
      });

      const parsed = cleanAndParseJson(rawJson);
      expect(parsed.is_clear).toBe(true);
      expect(parsed.medicine_name_ar).toBe('بانادول');
      expect(parsed.medicine_name_en).toBe('Panadol 500mg');
      expect(parsed.active_ingredient).toBe('باراسيتامول');
      expect(parsed.uses).toEqual(['مسكن للألم', 'خافض للحرارة']);
      expect(parsed.how_and_when).toEqual(['قرص بعد الأكل عند اللزوم']);
      expect(parsed.usage_source).toBe('printed');
      expect(parsed.warnings).toEqual(['لا تتجاوز 8 أقراص يومياً']);
      expect(parsed.audio_summary).toBe('دواء بانادول مسكن للألم يؤخذ بعد الأكل');
    });

    it('strips markdown code blocks and whitespace cleanly', () => {
      const wrappedMarkdown = `
      أهلاً بك، إليك النتيجة:
      \`\`\`json
      {
        "is_clear": true,
        "medicine_name_ar": "أسبرين",
        "medicine_name_en": "Aspirin 81mg",
        "active_ingredient": "حمض أستيل ساليسيليك",
        "uses": ["حماية القلب"],
        "how_and_when": ["قرص يومياً بعد الغداء"],
        "usage_source": "common",
        "warnings": ["قد يسبب سيولة"],
        "audio_summary": "أسبرين لحماية القلب يؤخذ بعد الغداء"
      }
      \`\`\`
      نتمنى لكم دوام الصحة والعافية.
      `;

      const parsed = cleanAndParseJson(wrappedMarkdown);
      expect(parsed.is_clear).toBe(true);
      expect(parsed.medicine_name_ar).toBe('أسبرين');
      expect(parsed.medicine_name_en).toBe('Aspirin 81mg');
      expect(parsed.usage_source).toBe('common');
    });

    it('handles is_clear = false and unclear image output gracefully', () => {
      const unclearJson = JSON.stringify({
        is_clear: false,
        medicine_name_ar: '',
        warnings: ['الصورة غير واضحة']
      });

      const parsed = cleanAndParseJson(unclearJson);
      expect(parsed.is_clear).toBe(false);
    });

    it('handles invalid or corrupted JSON with graceful fallback object', () => {
      const corrupted = 'هذه ليست استجابة JSON صالحة { غير مكتملة';
      const parsed = cleanAndParseJson(corrupted);
      expect(parsed.is_clear).toBe(false);
      expect(parsed.raw_error).toBeDefined();
      expect(parsed.raw_error).toContain('الصورة غير واضحة');
    });

    it('handles empty or blank input', () => {
      const parsed = cleanAndParseJson('');
      expect(parsed.is_clear).toBe(false);
      expect(parsed.raw_error).toBeDefined();
    });
  });

  describe('2. Multi-Tier Defense for how_and_when (R4)', () => {
    it('guarantees how_and_when is NEVER empty when backend returns empty array', () => {
      const emptyHowAndWhen = JSON.stringify({
        is_clear: true,
        medicine_name_ar: 'كونجستال',
        active_ingredient: 'باراسيتامول + سودوإيفيدرين',
        how_and_when: []
      });

      const parsed = parseMedicineAnalysisResult(emptyHowAndWhen);
      expect(parsed.is_clear).toBe(true);
      expect(parsed.how_and_when).toBeDefined();
      expect(parsed.how_and_when?.length).toBeGreaterThanOrEqual(2);
      expect(parsed.how_and_when).toEqual(DEFAULT_COMMON_USAGE);
      expect(parsed.usage_source).toBe('common');
    });

    it('replaces single generic "follow doctor" phrase with educational common usage', () => {
      const genericDeferral = JSON.stringify({
        is_clear: true,
        medicine_name_ar: 'أوجمنتين',
        active_ingredient: 'أموكسيسيلين + كلافولانات',
        how_and_when: ['اتبع بدقة توجيهات الطبيب المكتوبة على الوصفة الطبية'],
        usage_source: 'common'
      });

      const parsed = parseMedicineAnalysisResult(genericDeferral);
      expect(parsed.is_clear).toBe(true);
      expect(parsed.how_and_when).toEqual(DEFAULT_COMMON_USAGE);
      expect(parsed.usage_source).toBe('common');
    });

    it('preserves valid administration instructions and sets printed usage_source', () => {
      const validInstructions = JSON.stringify({
        is_clear: true,
        medicine_name_ar: 'أوجمنتين',
        active_ingredient: 'أموكسيسيلين',
        how_and_when: ['قرص كل 12 ساعة بعد الطعام مباشرة'],
        usage_source: 'printed'
      });

      const parsed = parseMedicineAnalysisResult(validInstructions);
      expect(parsed.is_clear).toBe(true);
      expect(parsed.how_and_when).toEqual(['قرص كل 12 ساعة بعد الطعام مباشرة']);
      expect(parsed.usage_source).toBe('printed');
    });

    it('filters out generic follow-doctor phrases when combined with real instructions', () => {
      const mixedInstructions = JSON.stringify({
        is_clear: true,
        medicine_name_ar: 'أوجمنتين',
        active_ingredient: 'أموكسيسيلين',
        how_and_when: [
          'اتبع تعليمات الطبيب بدقة',
          'قرص كل 12 ساعة بعد الطعام مباشرة'
        ],
        usage_source: 'printed'
      });

      const parsed = parseMedicineAnalysisResult(mixedInstructions);
      expect(parsed.is_clear).toBe(true);
      expect(parsed.how_and_when).toEqual(['قرص كل 12 ساعة بعد الطعام مباشرة']);
      expect(parsed.usage_source).toBe('printed');
    });

    it('filters out English generic follow-doctor phrases and injects common usage', () => {
      const englishGeneric = JSON.stringify({
        is_clear: true,
        medicine_name_ar: 'بانادول',
        active_ingredient: 'باراسيتامول',
        how_and_when: [
          'as directed by your doctor',
          'follow the doctor\'s instructions'
        ],
        usage_source: 'common'
      });

      const parsed = parseMedicineAnalysisResult(englishGeneric);
      expect(parsed.is_clear).toBe(true);
      expect(parsed.how_and_when).toEqual(DEFAULT_COMMON_USAGE);
      expect(parsed.usage_source).toBe('common');
    });

    it('forces usage_source to common when generic printed instruction is replaced by fallback', () => {
      const genericPrinted = JSON.stringify({
        is_clear: true,
        medicine_name_ar: 'أسبرين',
        active_ingredient: 'حمض أسيتيل ساليسيليك',
        how_and_when: ['حسب إرشادات الطبيب'],
        usage_source: 'printed'
      });

      const parsed = parseMedicineAnalysisResult(genericPrinted);
      expect(parsed.is_clear).toBe(true);
      expect(parsed.how_and_when).toEqual(DEFAULT_COMMON_USAGE);
      expect(parsed.usage_source).toBe('common');
    });

    it('guarantees how_and_when is non-empty when how_and_when is null or omitted', () => {
      const omittedHowAndWhen = JSON.stringify({
        is_clear: true,
        medicine_name_ar: 'بانادول',
        active_ingredient: 'باراسيتامول'
      });

      const parsed = parseMedicineAnalysisResult(omittedHowAndWhen);
      expect(parsed.is_clear).toBe(true);
      expect(parsed.how_and_when).toEqual(DEFAULT_COMMON_USAGE);
      expect(parsed.usage_source).toBe('common');
    });
  });

  describe('3. Prescription Schema Validation (validatePrescriptionJson) (R2)', () => {
    it('validates a complete readable prescription with high and medium confidence items', () => {
      const rawPrescription = {
        is_clear: true,
        confidence: 'high',
        evidence_text: 'Amoxicillin 500mg, Panadol Extra',
        items: [
          {
            line_text_as_written: 'Amoxil 500mg cap 1x3',
            medicine_name_ar: 'أموكسيل 500 مجم',
            medicine_name_en: 'Amoxil 500mg',
            active_ingredient: 'أموكسيسيلين',
            confidence: 'high',
            written_instructions: 'كبسولة 3 مرات يومياً',
            short_explanation: 'مضاد حيوي واسع المجال'
          },
          {
            line_text_as_written: 'Panadol tab 1x2',
            medicine_name_ar: 'بانادول',
            medicine_name_en: 'Panadol',
            active_ingredient: 'باراسيتامول',
            confidence: 'medium',
            written_instructions: 'قرص مرتين بعد الأكل',
            short_explanation: 'مسكن للحرارة والألم'
          }
        ],
        audio_summary: 'الروشتة تحتوي على أموكسيل وبانادول'
      };

      const result = validatePrescriptionJson(rawPrescription);
      expect(result.is_clear).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.items).toHaveLength(2);
      expect(result.items[0].medicine_name_ar).toBe('أموكسيل 500 مجم');
      expect(result.items[0].written_instructions).toBe('كبسولة 3 مرات يومياً');
      expect(result.items[0].short_explanation).toBe('مضاد حيوي واسع المجال');
      expect(result.items[1].confidence).toBe('medium');
    });

    it('enforces that low-confidence items have NO AI explanation (empty string)', () => {
      const prescriptionWithUnclearLine = {
        is_clear: true,
        confidence: 'medium',
        items: [
          {
            line_text_as_written: 'Unknown illegible scribble',
            medicine_name_ar: '',
            medicine_name_en: '',
            active_ingredient: '',
            confidence: 'low',
            written_instructions: '',
            short_explanation: 'AI attempted guess here'
          }
        ]
      };

      const result = validatePrescriptionJson(prescriptionWithUnclearLine);
      expect(result.is_clear).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].confidence).toBe('low');
      // Must be stripped to empty string
      expect(result.items[0].short_explanation).toBe('');
    });

    it('routes empty items array (items: []) to is_clear = false with friendly Arabic retake_message', () => {
      const emptyItemsResult = {
        is_clear: true,
        confidence: 'high',
        items: []
      };

      const result = validatePrescriptionJson(emptyItemsResult);
      expect(result.is_clear).toBe(false);
      expect(result.confidence).toBe('low');
      expect(result.items).toHaveLength(0);
      expect(result.retake_message).toContain('لم نتمكن من العثور على أدوية واضحة في الروشتة');
    });

    it('routes missing or non-array items to is_clear = false with friendly Arabic retake_message', () => {
      const missingItemsResult = {
        is_clear: true,
        confidence: 'medium'
      };

      const result = validatePrescriptionJson(missingItemsResult);
      expect(result.is_clear).toBe(false);
      expect(result.retake_message).toBeDefined();
    });

    it('enforces maximum 10 items limit on prescription lists', () => {
      const fourteenItems = Array.from({ length: 14 }, (_, i) => ({
        line_text_as_written: `Line ${i + 1}`,
        medicine_name_ar: `دواء ${i + 1}`,
        medicine_name_en: `Drug ${i + 1}`,
        active_ingredient: `Ingredient ${i + 1}`,
        confidence: 'high',
        written_instructions: '1x1',
        short_explanation: 'شرح مبسط'
      }));

      const result = validatePrescriptionJson({
        is_clear: true,
        confidence: 'high',
        items: fourteenItems
      });

      expect(result.is_clear).toBe(true);
      expect(result.items).toHaveLength(10);
      expect(result.items[9].medicine_name_ar).toBe('دواء 10');
    });

    it('preserves is_clear = false with retake_message and low confidence', () => {
      const unclearPrescription = {
        is_clear: false,
        retake_message: 'الصورة مظلمة وغير واضحة، يرجى تشغيل الفلاش أو الوقوف في ضوء أفضل.',
        confidence: 'low',
        items: []
      };

      const result = validatePrescriptionJson(unclearPrescription);
      expect(result.is_clear).toBe(false);
      expect(result.confidence).toBe('low');
      expect(result.retake_message).toContain('الصورة مظلمة');
      expect(result.items).toHaveLength(0);
    });

    it('handles raw JSON string input with markdown fences cleanly', () => {
      const rawString = `
      \`\`\`json
      {
        "is_clear": true,
        "confidence": "high",
        "items": [
          {
            "line_text_as_written": "Cataflam 50mg 1x3",
            "medicine_name_ar": "كاتافلام",
            "medicine_name_en": "Cataflam 50mg",
            "active_ingredient": "ديكلوفيناك بوتاسيوم",
            "confidence": "high",
            "written_instructions": "قرص 3 مرات بعد الأكل",
            "short_explanation": "مسكن ومضاد للالتهاب"
          }
        ]
      }
      \`\`\`
      `;

      const result = validatePrescriptionJson(rawString);
      expect(result.is_clear).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].medicine_name_ar).toBe('كاتافلام');
    });

    it('handles invalid or corrupted JSON gracefully with error_category invalid_json', () => {
      const corruptString = '{ broken json prescription';
      const result = validatePrescriptionJson(corruptString);
      expect(result.is_clear).toBe(false);
      expect(result.error_category).toBe('invalid_json');
      expect(result.error_code).toBe('INVALID_JSON');
    });

    it('handles empty or null input gracefully', () => {
      const result = validatePrescriptionJson(null);
      expect(result.is_clear).toBe(false);
      expect(result.error_category).toBe('invalid_json');
    });

    it('normalizes unrecognized or missing confidence values to medium', () => {
      const result = validatePrescriptionJson({
        is_clear: true,
        confidence: 'INVALID_CONFIDENCE_STRING',
        items: [
          {
            line_text_as_written: 'Medicine 1',
            confidence: 'unknown_level'
          },
          {
            line_text_as_written: 'Medicine 2',
            confidence: null
          }
        ]
      });

      expect(result.is_clear).toBe(true);
      expect(result.confidence).toBe('medium');
      expect(result.items[0].confidence).toBe('medium');
      expect(result.items[1].confidence).toBe('medium');
    });

    it('normalizes uppercase and mixed-case confidence levels', () => {
      const result = validatePrescriptionJson({
        is_clear: true,
        confidence: 'HIGH',
        items: [
          {
            line_text_as_written: 'Drug A',
            confidence: 'LOW'
          },
          {
            line_text_as_written: 'Drug B',
            confidence: 'Medium'
          }
        ]
      });

      expect(result.is_clear).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.items[0].confidence).toBe('low');
      expect(result.items[1].confidence).toBe('medium');
    });

    it('trims whitespace on all item fields and handles missing fields safely', () => {
      const result = validatePrescriptionJson({
        is_clear: true,
        confidence: 'high',
        evidence_text: '   Dr. Ahmed Rx   ',
        audio_summary: '   ملخص صوتي للروشتة   ',
        items: [
          {
            line_text_as_written: '   Line 1 as written   ',
            medicine_name_ar: '   كونجستال   ',
            medicine_name_en: '   Congestal   ',
            active_ingredient: '   باراسيتامول   ',
            confidence: 'high',
            written_instructions: '   قرص 3 مرات   ',
            short_explanation: '   علاج نزلات البرد   '
          },
          {
            // Missing optional string fields
            confidence: 'medium'
          }
        ]
      });

      expect(result.is_clear).toBe(true);
      expect(result.evidence_text).toBe('Dr. Ahmed Rx');
      expect(result.audio_summary).toBe('ملخص صوتي للروشتة');
      expect(result.items[0].line_text_as_written).toBe('Line 1 as written');
      expect(result.items[0].medicine_name_ar).toBe('كونجستال');
      expect(result.items[0].medicine_name_en).toBe('Congestal');
      expect(result.items[0].active_ingredient).toBe('باراسيتامول');
      expect(result.items[0].written_instructions).toBe('قرص 3 مرات');
      expect(result.items[0].short_explanation).toBe('علاج نزلات البرد');

      expect(result.items[1].line_text_as_written).toBe('');
      expect(result.items[1].medicine_name_ar).toBe('');
      expect(result.items[1].medicine_name_en).toBe('');
      expect(result.items[1].active_ingredient).toBe('');
      expect(result.items[1].written_instructions).toBe('');
      expect(result.items[1].short_explanation).toBe('');
    });

    it('routes empty prescription string or whitespace to is_clear: false with EMPTY_RESPONSE', () => {
      const emptyStrResult = validatePrescriptionJson('   ');
      expect(emptyStrResult.is_clear).toBe(false);
      expect(emptyStrResult.error_category).toBe('invalid_json');
      expect(emptyStrResult.error_code).toBe('EMPTY_RESPONSE');
      expect(emptyStrResult.items).toHaveLength(0);
    });

    it('routes non-object non-string primitives to invalid_json with INVALID_DATA', () => {
      const numResult = validatePrescriptionJson(12345);
      expect(numResult.is_clear).toBe(false);
      expect(numResult.error_category).toBe('invalid_json');
      expect(numResult.error_code).toBe('INVALID_DATA');
    });
  });

  describe('4. Prescription & Details Vision Services (R2)', () => {
    beforeEach(() => {
      clearDetailsCache();
      vi.restoreAllMocks();
    });

    afterEach(() => {
      clearDetailsCache();
      vi.restoreAllMocks();
    });

    it('analyzePrescriptionImage calls backend and parses valid prescription', async () => {
      const mockPrescription = {
        is_clear: true,
        confidence: 'high',
        evidence_text: 'Aspirin',
        items: [
          {
            line_text_as_written: 'Aspirin 81mg',
            medicine_name_ar: 'أسبرين',
            medicine_name_en: 'Aspirin 81mg',
            active_ingredient: 'حمض أسيتيل الساليسيليك',
            confidence: 'high',
            written_instructions: 'قرص بعد الغداء',
            short_explanation: 'حماية القلب'
          }
        ]
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPrescription
      }));

      const res = await analyzePrescriptionImage('valid_base64_img');
      expect(res.is_clear).toBe(true);
      expect(res.items).toHaveLength(1);
      expect(res.items[0].medicine_name_ar).toBe('أسبرين');
    });

    it('analyzePrescriptionImage throws network_timeout on HTTP 504 with distinct Arabic timeout message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 504,
        json: async () => ({
          error: 'UPSTREAM_TIMEOUT',
          error_code: 'UPSTREAM_TIMEOUT',
          retake_message: 'استغرقت عملية التحليل وقتاً أطول من المتوقع في الخادم (25 ثانية). يرجى المحاولة مرة أخرى.'
        })
      }));

      try {
        await analyzePrescriptionImage('test_image');
        expect.unreachable('Should have thrown AnalysisError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AnalysisError);
        expect(err.category).toBe('network_timeout');
        expect(err.message).toContain('استغرقت عملية التحليل وقتاً أطول من المتوقع في الخادم (25 ثانية). يرجى المحاولة مرة أخرى.');
      }
    });

    it('analyzePrescriptionImage rejects empty base64Image immediately', async () => {
      await expect(analyzePrescriptionImage('')).rejects.toThrow('يرجى التقاط صورة واضحة للروشتة أولاً.');
    });

    it('fetchMedicineDetails fetches from backend on cache miss and stores in cache', async () => {
      const mockDetails = {
        is_clear: true,
        medicine_name_ar: 'بانادول',
        medicine_name_en: 'Panadol',
        active_ingredient: 'باراسيتامول',
        uses: ['مسكن للألم'],
        how_and_when: ['قرص بعد الأكل عند اللزوم'],
        usage_source: 'common',
        warnings: ['لا تتجاوز 8 أقراص']
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockDetails
      });
      vi.stubGlobal('fetch', fetchSpy);

      // 1. First call: Cache miss -> calls network
      const res1 = await fetchMedicineDetails('بانادول');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(res1.is_clear).toBe(true);
      expect(res1.medicine_name_ar).toBe('بانادول');

      // 2. Second call: Cache hit -> 0 network calls!
      const res2 = await fetchMedicineDetails('بَانَادُولْ');
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Still 1!
      expect(res2.medicine_name_ar).toBe('بانادول');
    });

    it('fetchMedicineDetails throws network_timeout on HTTP 504', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 504,
        json: async () => ({
          error: 'UPSTREAM_TIMEOUT',
          error_code: 'UPSTREAM_TIMEOUT'
        })
      }));

      await expect(fetchMedicineDetails('دواء')).rejects.toThrow();
    });

    it('fetchMedicineDetails rejects empty medicine name', async () => {
      await expect(fetchMedicineDetails('')).rejects.toThrow('يرجى إدخال اسم الدواء لعرض التفاصيل.');
    });
  });
});

