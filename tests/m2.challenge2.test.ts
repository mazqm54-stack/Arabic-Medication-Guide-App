import { describe, it, expect } from 'vitest';
import {
  validatePrescriptionJson,
  parseMedicineAnalysisResult,
  cleanAndParsePrescriptionJson,
  parsePrescriptionAnalysisResult,
  cleanAndParseJson,
  isGenericFollowDoctor,
  DEFAULT_COMMON_USAGE
} from '../src/services/geminiParser';

describe('M2 Adversarial Challenge 2: Prescription Validation & Medication Usage Defense', () => {

  // =========================================================================
  // 1. Prescription JSON Schema Parsing & Validation (validatePrescriptionJson)
  // =========================================================================
  describe('1. Prescription JSON Schema Parsing & Robustness', () => {

    describe('1.1 Clamping Items to Maximum 10', () => {
      it('clamps items array to exactly 10 when backend returns 15 items', () => {
        const fifteenItems = Array.from({ length: 15 }, (_, i) => ({
          line_text_as_written: `Rx Line ${i + 1}`,
          medicine_name_ar: `دواء ${i + 1}`,
          medicine_name_en: `Drug ${i + 1}`,
          active_ingredient: `Ingredient ${i + 1}`,
          confidence: 'high',
          written_instructions: `Instructions ${i + 1}`,
          short_explanation: `Explanation ${i + 1}`
        }));

        const result = validatePrescriptionJson({
          is_clear: true,
          confidence: 'high',
          items: fifteenItems
        });

        expect(result.is_clear).toBe(true);
        expect(result.items).toHaveLength(10);
        expect(result.items[0].medicine_name_ar).toBe('دواء 1');
        expect(result.items[9].medicine_name_ar).toBe('دواء 10');
        // Items beyond index 9 must be excluded
        const names = result.items.map((it) => it.medicine_name_ar);
        expect(names).not.toContain('دواء 11');
        expect(names).not.toContain('دواء 15');
      });

      it('clamps items array to exactly 10 when backend returns 30 items', () => {
        const thirtyItems = Array.from({ length: 30 }, (_, i) => ({
          line_text_as_written: `Item ${i}`,
          medicine_name_ar: `دواء رقم ${i}`,
          confidence: 'medium'
        }));

        const result = validatePrescriptionJson({
          is_clear: true,
          items: thirtyItems
        });

        expect(result.items).toHaveLength(10);
        expect(result.items[9].medicine_name_ar).toBe('دواء رقم 9');
      });

      it('preserves all items without truncation when exactly 10 items are returned', () => {
        const tenItems = Array.from({ length: 10 }, (_, i) => ({
          line_text_as_written: `Item ${i + 1}`,
          medicine_name_ar: `عقار ${i + 1}`,
          confidence: 'high'
        }));

        const result = validatePrescriptionJson({
          is_clear: true,
          items: tenItems
        });

        expect(result.items).toHaveLength(10);
        expect(result.items[0].medicine_name_ar).toBe('عقار 1');
        expect(result.items[9].medicine_name_ar).toBe('عقار 10');
      });

      it('preserves all items without padding when fewer than 10 items are returned', () => {
        const threeItems = [
          { line_text_as_written: 'A', medicine_name_ar: 'دواء أ', confidence: 'high' },
          { line_text_as_written: 'B', medicine_name_ar: 'دواء ب', confidence: 'medium' },
          { line_text_as_written: 'C', medicine_name_ar: 'دواء ج', confidence: 'low' }
        ];

        const result = validatePrescriptionJson({
          is_clear: true,
          items: threeItems
        });

        expect(result.items).toHaveLength(3);
      });
    });

    describe('1.2 Confidence Level Handling & Short Explanation Stripping', () => {
      it('strictly strips short_explanation to empty string for low-confidence items', () => {
        const input = {
          is_clear: true,
          confidence: 'medium',
          items: [
            {
              line_text_as_written: 'Scribbled text ??? 500mg',
              medicine_name_ar: 'غير مؤكد',
              medicine_name_en: 'Uncertain 500mg',
              active_ingredient: 'باراسيتامول على الأرجح',
              confidence: 'low',
              written_instructions: 'غير مقروء',
              short_explanation: 'مسكن وخافض للحرارة قد يكون بانادول بناء على التخمين'
            }
          ]
        };

        const result = validatePrescriptionJson(input);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].confidence).toBe('low');
        // Crucial safety check: short_explanation must be stripped to prevent hallucination
        expect(result.items[0].short_explanation).toBe('');
      });

      it('normalizes uppercase or untrimmed "LOW " confidence to "low" and strips explanation', () => {
        const input = {
          is_clear: true,
          items: [
            {
              line_text_as_written: 'Messy line',
              medicine_name_ar: 'دواء غامض',
              confidence: ' LOW  ',
              short_explanation: 'شرح تخميني يجب حذفه'
            }
          ]
        };

        const result = validatePrescriptionJson(input);
        expect(result.items[0].confidence).toBe('low');
        expect(result.items[0].short_explanation).toBe('');
      });

      it('preserves short_explanation for medium and high confidence items', () => {
        const input = {
          is_clear: true,
          confidence: 'high',
          items: [
            {
              line_text_as_written: 'Augmentin 1g 1x2',
              medicine_name_ar: 'أوجمنتين 1 جم',
              medicine_name_en: 'Augmentin 1g',
              active_ingredient: 'أموكسيسيلين + كلافولانات',
              confidence: 'high',
              written_instructions: 'قرص كل 12 ساعة بعد الطعام',
              short_explanation: 'مضاد حيوي واسع المجال لعلاج العدوى البكتيرية'
            },
            {
              line_text_as_written: 'Cataflam 50mg',
              medicine_name_ar: 'كاتافلام 50 مجم',
              medicine_name_en: 'Cataflam 50mg',
              active_ingredient: 'ديكلوفيناك بوتاسيوم',
              confidence: 'medium',
              written_instructions: 'قرص عند اللزوم بعد الأكل',
              short_explanation: 'مسكن ومضاد للالتهاب'
            }
          ]
        };

        const result = validatePrescriptionJson(input);
        expect(result.items[0].confidence).toBe('high');
        expect(result.items[0].short_explanation).toBe('مضاد حيوي واسع المجال لعلاج العدوى البكتيرية');
        expect(result.items[1].confidence).toBe('medium');
        expect(result.items[1].short_explanation).toBe('مسكن ومضاد للالتهاب');
      });

      it('falls back to medium confidence for unrecognized confidence values and preserves explanation', () => {
        const input = {
          is_clear: true,
          items: [
            {
              line_text_as_written: 'Test med',
              confidence: 'very-high-experimental',
              short_explanation: 'شرح مهم'
            }
          ]
        };

        const result = validatePrescriptionJson(input);
        expect(result.items[0].confidence).toBe('medium');
        expect(result.items[0].short_explanation).toBe('شرح مهم');
      });
    });

    describe('1.3 Empty Items Array & Routing to Retake Screen', () => {
      it('routes empty items array (items: []) to is_clear: false with friendly Arabic retake_message', () => {
        const input = {
          is_clear: true,
          confidence: 'high',
          items: []
        };

        const result = validatePrescriptionJson(input);
        expect(result.is_clear).toBe(false);
        expect(result.confidence).toBe('low');
        expect(result.items).toEqual([]);
        expect(result.retake_message).toBeDefined();
        expect(result.retake_message).toContain('لم نتمكن من العثور على أدوية واضحة في الروشتة');
      });

      it('preserves custom retake_message if provided when items array is empty', () => {
        const input = {
          is_clear: true,
          retake_message: 'الروشتة تبدو بيضاء وخالية من الكتابة، يرجى تصوير وجه الروشتة المكتوب',
          items: []
        };

        const result = validatePrescriptionJson(input);
        expect(result.is_clear).toBe(false);
        expect(result.retake_message).toBe('الروشتة تبدو بيضاء وخالية من الكتابة، يرجى تصوير وجه الروشتة المكتوب');
      });

      it('routes missing items property to is_clear: false with friendly Arabic retake_message', () => {
        const input = {
          is_clear: true,
          confidence: 'medium'
        };

        const result = validatePrescriptionJson(input);
        expect(result.is_clear).toBe(false);
        expect(result.confidence).toBe('low');
        expect(result.items).toEqual([]);
        expect(result.retake_message).toBeDefined();
      });

      it('routes non-array items (string, object, number, null) to is_clear: false', () => {
        const testCases = [
          { is_clear: true, items: null },
          { is_clear: true, items: 'بانادول' },
          { is_clear: true, items: { 0: { name: 'Amoxil' } } },
          { is_clear: true, items: 12345 },
          { is_clear: true, items: false }
        ];

        for (const tc of testCases) {
          const result = validatePrescriptionJson(tc);
          expect(result.is_clear).toBe(false);
          expect(result.items).toEqual([]);
          expect(result.retake_message).toBeDefined();
        }
      });
    });

    describe('1.4 Resilient Defaults, Missing Fields, Null Values & Malformed Inputs', () => {
      it('handles prescription item with completely null or undefined properties without throwing', () => {
        const input = {
          is_clear: true,
          items: [
            {
              line_text_as_written: null,
              medicine_name_ar: null,
              medicine_name_en: null,
              active_ingredient: null,
              confidence: null,
              written_instructions: null,
              short_explanation: null
            }
          ]
        };

        const result = validatePrescriptionJson(input);
        expect(result.is_clear).toBe(true);
        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toEqual({
          line_text_as_written: '',
          medicine_name_ar: '',
          medicine_name_en: '',
          active_ingredient: '',
          confidence: 'medium', // null confidence defaults to medium
          written_instructions: '',
          short_explanation: ''
        });
      });

      it('coerces numeric and boolean item field values to string safely', () => {
        const input = {
          is_clear: true,
          items: [
            {
              line_text_as_written: 101,
              medicine_name_ar: 500,
              medicine_name_en: true,
              active_ingredient: 999,
              confidence: 'high',
              written_instructions: 3,
              short_explanation: 42
            }
          ]
        };

        const result = validatePrescriptionJson(input);
        expect(result.items[0].line_text_as_written).toBe('101');
        expect(result.items[0].medicine_name_ar).toBe('500');
        expect(result.items[0].medicine_name_en).toBe('true');
        expect(result.items[0].active_ingredient).toBe('999');
        expect(result.items[0].written_instructions).toBe('3');
        expect(result.items[0].short_explanation).toBe('42');
      });

      it('parses JSON wrapped in markdown json code fences', () => {
        const fenced = `
\`\`\`json
{
  "is_clear": true,
  "confidence": "high",
  "items": [
    {
      "line_text_as_written": "Panadol 1x3",
      "medicine_name_ar": "بانادول",
      "medicine_name_en": "Panadol",
      "active_ingredient": "باراسيتامول",
      "confidence": "high",
      "written_instructions": "قرص 3 مرات",
      "short_explanation": "مسكن للألم"
    }
  ]
}
\`\`\`
        `;

        const result = validatePrescriptionJson(fenced);
        expect(result.is_clear).toBe(true);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].medicine_name_ar).toBe('بانادول');
      });

      it('parses JSON wrapped in generic markdown code fences without language tag', () => {
        const fenced = `
\`\`\`
{
  "is_clear": true,
  "confidence": "high",
  "items": [
    {
      "line_text_as_written": "Brufen 400",
      "medicine_name_ar": "بروفين",
      "confidence": "high"
    }
  ]
}
\`\`\`
        `;

        const result = validatePrescriptionJson(fenced);
        expect(result.is_clear).toBe(true);
        expect(result.items[0].medicine_name_ar).toBe('بروفين');
      });

      it('extracts JSON when surrounded by conversational AI preambles and postambles', () => {
        const rawWithChitChat = `
مرحباً بك! لقد قمت بتحليل صورة الروشتة المرفقة بعناية، وإليك النتيجة بصيغة JSON:
{
  "is_clear": true,
  "confidence": "high",
  "items": [
    {
      "line_text_as_written": "Congestal 1x3",
      "medicine_name_ar": "كونجستال",
      "confidence": "high",
      "short_explanation": "لعلاج أعراض نزلات البرد"
    }
  ]
}
نتمنى لك الشفاء العاجل والسلامة دائماً!
        `;

        const result = validatePrescriptionJson(rawWithChitChat);
        expect(result.is_clear).toBe(true);
        expect(result.items[0].medicine_name_ar).toBe('كونجستال');
      });

      it('handles completely malformed or truncated JSON strings with graceful error fallback', () => {
        const truncated = '{"is_clear": true, "confidence": "high", "items": [{"line_text": "Amox';
        const result = validatePrescriptionJson(truncated);

        expect(result.is_clear).toBe(false);
        expect(result.confidence).toBe('low');
        expect(result.items).toEqual([]);
        expect(result.error_category).toBe('invalid_json');
        expect(result.error_code).toBe('INVALID_JSON');
      });

      it('handles empty string and whitespace-only string with EMPTY_RESPONSE fallback', () => {
        const emptyResult = validatePrescriptionJson('');
        expect(emptyResult.is_clear).toBe(false);
        expect(emptyResult.error_category).toBe('invalid_json');
        expect(emptyResult.error_code).toBe('EMPTY_RESPONSE');

        const wsResult = validatePrescriptionJson('    \n\t   ');
        expect(wsResult.is_clear).toBe(false);
        expect(wsResult.error_category).toBe('invalid_json');
        expect(wsResult.error_code).toBe('EMPTY_RESPONSE');
      });

      it('handles null and undefined input with EMPTY_RESPONSE fallback', () => {
        const nullResult = validatePrescriptionJson(null);
        expect(nullResult.is_clear).toBe(false);
        expect(nullResult.error_category).toBe('invalid_json');
        expect(nullResult.error_code).toBe('EMPTY_RESPONSE');

        const undefResult = validatePrescriptionJson(undefined);
        expect(undefResult.is_clear).toBe(false);
        expect(undefResult.error_code).toBe('EMPTY_RESPONSE');
      });

      it('handles primitive numbers, booleans, and non-object types safely', () => {
        const numResult = validatePrescriptionJson(42);
        expect(numResult.is_clear).toBe(false);
        expect(numResult.error_code).toBe('INVALID_DATA');

        const boolResult = validatePrescriptionJson(true);
        expect(boolResult.is_clear).toBe(false);
        expect(boolResult.error_code).toBe('INVALID_DATA');
      });

      it('aliases cleanAndParsePrescriptionJson and parsePrescriptionAnalysisResult correctly', () => {
        expect(cleanAndParsePrescriptionJson).toBe(validatePrescriptionJson);
        expect(parsePrescriptionAnalysisResult).toBe(validatePrescriptionJson);
      });
    });
  });


  // =========================================================================
  // 2. Medication Usage Defense & usage_source Badging (parseMedicineAnalysisResult)
  // =========================================================================
  describe('2. Medication Usage Defense & usage_source Badging', () => {

    describe('2.1 how_and_when Non-Empty Guarantee', () => {
      it('guarantees how_and_when is populated with DEFAULT_COMMON_USAGE when empty array []', () => {
        const input = {
          is_clear: true,
          medicine_name_ar: 'بانادول',
          how_and_when: []
        };

        const result = parseMedicineAnalysisResult(input);
        expect(result.is_clear).toBe(true);
        expect(result.how_and_when).toBeDefined();
        expect(result.how_and_when).toEqual(DEFAULT_COMMON_USAGE);
        expect(result.how_and_when?.length).toBeGreaterThanOrEqual(2);
        expect(result.usage_source).toBe('common');
      });

      it('guarantees how_and_when is populated with DEFAULT_COMMON_USAGE when how_and_when is omitted or null', () => {
        const inputNull = {
          is_clear: true,
          medicine_name_ar: 'أسبوسيد',
          how_and_when: null
        };
        const resultNull = parseMedicineAnalysisResult(inputNull);
        expect(resultNull.how_and_when).toEqual(DEFAULT_COMMON_USAGE);
        expect(resultNull.usage_source).toBe('common');

        const inputOmitted = {
          is_clear: true,
          medicine_name_ar: 'أسبوسيد'
        };
        const resultOmitted = parseMedicineAnalysisResult(inputOmitted);
        expect(resultOmitted.how_and_when).toEqual(DEFAULT_COMMON_USAGE);
        expect(resultOmitted.usage_source).toBe('common');
      });

      it('guarantees how_and_when is populated with DEFAULT_COMMON_USAGE when containing only empty or whitespace strings', () => {
        const input = {
          is_clear: true,
          medicine_name_ar: 'فيتامين سي',
          how_and_when: ['', '   ', '\t\n']
        };

        const result = parseMedicineAnalysisResult(input);
        expect(result.how_and_when).toEqual(DEFAULT_COMMON_USAGE);
        expect(result.usage_source).toBe('common');
      });

      it('normalizes single string how_and_when into an array of strings', () => {
        const input = {
          is_clear: true,
          medicine_name_ar: 'أوميبرازول',
          how_and_when: 'كبسولة واحدة صباحاً قبل الإفطار بنصف ساعة',
          usage_source: 'printed'
        };

        const result = parseMedicineAnalysisResult(input);
        expect(Array.isArray(result.how_and_when)).toBe(true);
        expect(result.how_and_when).toEqual(['كبسولة واحدة صباحاً قبل الإفطار بنصف ساعة']);
        expect(result.usage_source).toBe('printed');
      });
    });

    describe('2.2 Adversarial Doctor Deferrals in Arabic & English', () => {
      // Testing direct predicate isGenericFollowDoctor
      it('identifies standard Arabic generic deferral phrases via isGenericFollowDoctor', () => {
        expect(isGenericFollowDoctor('اتبع تعليمات الطبيب')).toBe(true);
        expect(isGenericFollowDoctor('اتبع بدقة توجيهات الطبيب')).toBe(true);
        expect(isGenericFollowDoctor('يجب اتباع إرشادات الطبيب')).toBe(true);
        expect(isGenericFollowDoctor('اتبع ما كتبه الطبيب')).toBe(true);
        expect(isGenericFollowDoctor('حسب إرشادات الطبيب')).toBe(true);
      });

      it('identifies standard English generic deferral phrases via isGenericFollowDoctor', () => {
        expect(isGenericFollowDoctor("Follow doctor's instructions")).toBe(true);
        expect(isGenericFollowDoctor("follow the doctor's instructions")).toBe(true);
        expect(isGenericFollowDoctor('as directed by doctor')).toBe(true);
        expect(isGenericFollowDoctor('as directed by your doctor')).toBe(true);
        expect(isGenericFollowDoctor("FOLLOW DOCTOR'S INSTRUCTIONS")).toBe(true);
        expect(isGenericFollowDoctor('  as directed by your doctor  ')).toBe(true);
      });

      it('stress-tests doctor deferrals specified in dispatch: "راجع الطبيب لمعرفة الجرعة" and "استشر الطبيب أو الصيدلي"', () => {
        // These are adversarial deferrals specifically targeted in the Challenger 2 dispatch
        const deferral1 = 'استشر الطبيب أو الصيدلي';
        const deferral2 = 'راجع الطبيب لمعرفة الجرعة';
        const deferral3 = 'استشر الطبيب';
        const deferral4 = 'راجع الطبيب';

        // Direct predicate test
        expect(isGenericFollowDoctor(deferral1)).toBe(true);
        expect(isGenericFollowDoctor(deferral2)).toBe(true);
        expect(isGenericFollowDoctor(deferral3)).toBe(true);
        expect(isGenericFollowDoctor(deferral4)).toBe(true);
      });

      it('filters out Arabic deferral "راجع الطبيب لمعرفة الجرعة" and replaces with DEFAULT_COMMON_USAGE and common source', () => {
        const input = {
          is_clear: true,
          medicine_name_ar: 'كابوتن',
          how_and_when: ['راجع الطبيب لمعرفة الجرعة'],
          usage_source: 'printed'
        };

        const result = parseMedicineAnalysisResult(input);
        expect(result.how_and_when).toEqual(DEFAULT_COMMON_USAGE);
        expect(result.usage_source).toBe('common');
      });

      it('filters out Arabic deferral "استشر الطبيب أو الصيدلي" and replaces with DEFAULT_COMMON_USAGE and common source', () => {
        const input = {
          is_clear: true,
          medicine_name_ar: 'كونكور',
          how_and_when: ['استشر الطبيب أو الصيدلي'],
          usage_source: 'printed'
        };

        const result = parseMedicineAnalysisResult(input);
        expect(result.how_and_when).toEqual(DEFAULT_COMMON_USAGE);
        expect(result.usage_source).toBe('common');
      });

      it('filters out English deferral "Follow doctor\'s instructions" and replaces with DEFAULT_COMMON_USAGE', () => {
        const input = {
          is_clear: true,
          medicine_name_ar: 'Lipitor',
          how_and_when: ["Follow doctor's instructions"],
          usage_source: 'printed'
        };

        const result = parseMedicineAnalysisResult(input);
        expect(result.how_and_when).toEqual(DEFAULT_COMMON_USAGE);
        expect(result.usage_source).toBe('common');
      });

      it('filters out multiple combined generic deferrals in Arabic and English', () => {
        const input = {
          is_clear: true,
          medicine_name_ar: 'أوجمنتين',
          how_and_when: [
            'اتبع تعليمات الطبيب بدقة',
            'as directed by your doctor',
            'حسب إرشادات الطبيب'
          ],
          usage_source: 'printed'
        };

        const result = parseMedicineAnalysisResult(input);
        expect(result.how_and_when).toEqual(DEFAULT_COMMON_USAGE);
        expect(result.usage_source).toBe('common');
      });
    });

    describe('2.3 Filtering Deferrals from Mixed Instructions', () => {
      it('strips doctor deferral while preserving genuine printed instruction', () => {
        const input = {
          is_clear: true,
          medicine_name_ar: 'أوجمنتين',
          how_and_when: [
            'اتبع تعليمات الطبيب بدقة',
            'قرص واحد كل 12 ساعة بعد الأكل مباشرة'
          ],
          usage_source: 'printed'
        };

        const result = parseMedicineAnalysisResult(input);
        expect(result.how_and_when).toEqual(['قرص واحد كل 12 ساعة بعد الأكل مباشرة']);
        // Since a genuine instruction survived, printed source is preserved
        expect(result.usage_source).toBe('printed');
      });

      it('strips English doctor deferral while preserving genuine instructions', () => {
        const input = {
          is_clear: true,
          medicine_name_ar: 'بانادول',
          how_and_when: [
            'as directed by your doctor',
            'قرص عند اللزوم كل 6 إلى 8 ساعات'
          ],
          usage_source: 'printed'
        };

        const result = parseMedicineAnalysisResult(input);
        expect(result.how_and_when).toEqual(['قرص عند اللزوم كل 6 إلى 8 ساعات']);
        expect(result.usage_source).toBe('printed');
      });
    });

    describe('2.4 Genuine Printed Instructions & usage_source Badging', () => {
      it('preserves genuine printed dosage instruction and usage_source: "printed"', () => {
        const input = {
          is_clear: true,
          medicine_name_ar: 'جلوكوفاج',
          how_and_when: ['قرص واحد يومياً مع وجبة العشاء'],
          usage_source: 'printed'
        };

        const result = parseMedicineAnalysisResult(input);
        expect(result.how_and_when).toEqual(['قرص واحد يومياً مع وجبة العشاء']);
        expect(result.usage_source).toBe('printed');
      });

      it('preserves genuine instruction and usage_source: "common" when model badges as common', () => {
        const input = {
          is_clear: true,
          medicine_name_ar: 'سيتال',
          how_and_when: ['ملعقة 5 مل 3 مرات يومياً عند ارتفاع الحرارة'],
          usage_source: 'common'
        };

        const result = parseMedicineAnalysisResult(input);
        expect(result.how_and_when).toEqual(['ملعقة 5 مل 3 مرات يومياً عند ارتفاع الحرارة']);
        expect(result.usage_source).toBe('common');
      });

      it('forces usage_source to "common" if usage_source was omitted or invalid', () => {
        const input = {
          is_clear: true,
          medicine_name_ar: 'بانادول',
          how_and_when: ['قرص بعد الأكل'],
          usage_source: 'unknown_source'
        };

        const result = parseMedicineAnalysisResult(input);
        expect(result.usage_source).toBe('common');
      });

      it('backward compatible cleanAndParseJson correctly calls parseMedicineAnalysisResult', () => {
        const input = JSON.stringify({
          is_clear: true,
          medicine_name_ar: 'كتافلام',
          how_and_when: ['قرص بعد الأكل'],
          usage_source: 'printed'
        });

        const result = cleanAndParseJson(input);
        expect(result.is_clear).toBe(true);
        expect(result.medicine_name_ar).toBe('كتافلام');
        expect(result.usage_source).toBe('printed');
      });
    });
  });
});
