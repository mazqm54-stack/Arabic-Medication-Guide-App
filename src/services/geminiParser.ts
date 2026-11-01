import {
  MedicineAnalysisResult,
  PrescriptionAnalysisResult,
  PrescriptionItem,
  ItemConfidence
} from '../types';

export const PHARMACIST_SYSTEM_PROMPT = `أنت صيدلي خبير ومساعد طبي ذكي مخصص لكبار السن. مهمتك هي تحليل صورة علبة الدواء المرفقة بدقة عالية وإرجاع النتيجة باللغة العربية البسيطة والواضحة جداً بصيغة JSON فقط:
{
  "is_clear": true/false,
  "medicine_name_ar": "اسم الدواء بالعربية",
  "medicine_name_en": "Medicine Name & Concentration",
  "active_ingredient": "المادة الفعالة",
  "uses": ["استخدام 1", "استخدام 2"],
  "how_and_when": ["طريقة الاستخدام وأفضل وقت (مثال: قرص واحد بعد الأكل صباحاً ومساءً)"],
  "usage_source": "printed" | "common",
  "warnings": ["تحذير مبسط 1", "تحذير مبسط 2"],
  "audio_summary": "نص متصل ومبسط جداً باللغة العربية الفصحى السهلة لقراءته صوتياً للمريض يلخص اسم الدواء واستخدامه وموعده"
}
قواعد صارمة: إذا كانت الصورة غير واضحة أو ليست لدواء، اجعل is_clear = false واطلب من المستخدم إعادة التصوير في بيئة جيدة الإضاءة. لا تقدم جرعات طبية قطعية بل اذكر الإرشادات العامة وذكّر دائماً باستشارة الطبيب.`;

export function formatPharmacistPrompt(): string {
  return PHARMACIST_SYSTEM_PROMPT;
}

export const DEFAULT_COMMON_USAGE: string[] = [
  'يؤخذ القرص عبر الفم مع كوب ماء كامل',
  'يُفضل تناوله في نفس الموعد يومياً للحفاظ على فاعليته',
  'استشر الصيدلي أو الطبيب لتحديد المواعيد الأنسب لحالتك الصحية'
];

/**
 * Checks whether an instruction is merely a generic deferral to follow doctor.
 */
export function isGenericFollowDoctor(text: string): boolean {
  if (!text) return true;
  const t = text.trim();
  if (DEFAULT_COMMON_USAGE.includes(t)) {
    return false;
  }
  const genericPatterns = [
    /^(?:اتبع|يجب اتباع)\s+(?:بدقة\s+)?(?:توجيهات|تعليمات|إرشادات)\s+الطبيب/i,
    /^(?:راجع|استشر)\s+(?:الطبيب|الصيدلي)(?:\s+أو\s+(?:الصيدلي|الطبيب))?(?:\s+.*)?$/i,
    /^(?:اتبع\s+ما\s+كتبه\s+الطبيب|حسب\s+إرشادات\s+الطبيب)(?:\s+.*)?$/i,
    /^as\s+directed\s+by\s+(?:your\s+)?doctor(?:\s+.*)?$/i,
    /^follow\s+(?:the\s+)?doctor(?:'s)?\s+instructions(?:\s+.*)?$/i
  ];
  return genericPatterns.some((pattern) => pattern.test(t));
}

/**
 * Normalizes arrays to string arrays.
 */
function normalizeArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof val === 'string' && val.trim()) {
    return [val.trim()];
  }
  return [];
}

/**
 * Parses and normalizes medicine box analysis result with multi-tier defense for how_and_when.
 * Guarantees how_and_when is NEVER empty and NEVER a single generic "follow doctor".
 * Passes through usage_source: 'printed' | 'common'.
 */
export function parseMedicineAnalysisResult(input: string | any): MedicineAnalysisResult {
  if (!input) {
    return {
      is_clear: false,
      error_category: 'invalid_json',
      error_code: 'EMPTY_RESPONSE',
      raw_error: 'لم نتمكن من استلام إجابة من المعالج الذكي، يرجى إعادة المحاولة.'
    };
  }

  let parsed: any = input;
  if (typeof input === 'string') {
    let cleaned = input.trim();
    if (!cleaned) {
      return {
        is_clear: false,
        error_category: 'invalid_json',
        error_code: 'EMPTY_RESPONSE',
        raw_error: 'لم نتمكن من استلام إجابة من المعالج الذكي، يرجى إعادة المحاولة.'
      };
    }

    // Remove markdown code fences if present
    const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
    const match = cleaned.match(markdownRegex);
    if (match && match[1]) {
      cleaned = match[1].trim();
    }

    // Find the first '{' and last '}' to handle stray text outside JSON
    const startBrace = cleaned.indexOf('{');
    const endBrace = cleaned.lastIndexOf('}');
    if (startBrace !== -1 && endBrace !== -1 && endBrace > startBrace) {
      cleaned = cleaned.slice(startBrace, endBrace + 1);
    }

    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.warn('[GeminiParser] JSON parse error:', err, 'Raw text was:', input);
      return {
        is_clear: false,
        error_category: 'invalid_json',
        error_code: 'INVALID_JSON',
        raw_error: 'الصورة غير واضحة بدرجة كافية أو تعذر قراءة رد المعالج الذكي. يرجى إعادة المحاولة.'
      };
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      is_clear: false,
      error_category: 'invalid_json',
      error_code: 'INVALID_DATA',
      raw_error: 'بيانات الرد غير صالحة.'
    };
  }

  const isClear = typeof parsed.is_clear === 'boolean'
    ? parsed.is_clear
    : String(parsed.is_clear).toLowerCase() === 'true';

  const uses = normalizeArray(parsed.uses);
  const rawHowAndWhen = normalizeArray(parsed.how_and_when);
  const warnings = normalizeArray(parsed.warnings);

  if (!isClear) {
    return {
      is_clear: false,
      error_category: parsed.error_category || 'unclear_image',
      error_code: parsed.error_code || undefined,
      error_detail: parsed.detail || parsed.error_detail || undefined,
      raw_error: parsed.retake_message || parsed.raw_error || (warnings.length > 0 ? warnings.join(' • ') : undefined)
    };
  }

  // Multi-tier defense for how_and_when:
  // 1. Filter out single generic "follow doctor" deferrals
  const filteredHowAndWhen = rawHowAndWhen.filter((item) => !isGenericFollowDoctor(item));

  let finalHowAndWhen: string[];
  let finalUsageSource: 'printed' | 'common';

  if (filteredHowAndWhen.length === 0) {
    // If empty or contained only generic deferral, inject standard safe educational common usage
    finalHowAndWhen = [...DEFAULT_COMMON_USAGE];
    finalUsageSource = 'common';
  } else {
    finalHowAndWhen = filteredHowAndWhen;
    finalUsageSource = parsed.usage_source === 'printed' ? 'printed' : 'common';
  }

  return {
    is_clear: true,
    medicine_name_ar: parsed.medicine_name_ar ? String(parsed.medicine_name_ar).trim() : undefined,
    medicine_name_en: parsed.medicine_name_en ? String(parsed.medicine_name_en).trim() : undefined,
    active_ingredient: parsed.active_ingredient ? String(parsed.active_ingredient).trim() : undefined,
    uses: uses.length > 0 ? uses : undefined,
    how_and_when: finalHowAndWhen,
    usage_source: finalUsageSource,
    warnings: warnings.length > 0 ? warnings : undefined,
    audio_summary: parsed.audio_summary ? String(parsed.audio_summary).trim() : undefined
  };
}

/**
 * Backward compatible alias for parseMedicineAnalysisResult.
 */
export function cleanAndParseJson(rawText: string): MedicineAnalysisResult {
  return parseMedicineAnalysisResult(rawText);
}

/**
 * Validates and normalizes PrescriptionAnalysisResult from Gemini.
 * If items is empty or absent, sets is_clear: false with friendly Arabic retake_message.
 * Normalizes items array (max 10 items, default values, confidence mapping).
 */
export function validatePrescriptionJson(data: any): PrescriptionAnalysisResult {
  if (!data) {
    return {
      is_clear: false,
      retake_message: 'لم نتمكن من استلام إجابة صالحة لتحليل الروشتة. يرجى إعادة المحاولة.',
      confidence: 'low',
      items: [],
      error_category: 'invalid_json',
      error_code: 'EMPTY_RESPONSE'
    };
  }

  let parsed = data;
  if (typeof data === 'string') {
    let cleaned = data.trim();
    if (!cleaned) {
      return {
        is_clear: false,
        retake_message: 'لم نتمكن من استلام إجابة صالحة لتحليل الروشتة. يرجى إعادة المحاولة.',
        confidence: 'low',
        items: [],
        error_category: 'invalid_json',
        error_code: 'EMPTY_RESPONSE'
      };
    }

    const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
    const match = cleaned.match(markdownRegex);
    if (match && match[1]) {
      cleaned = match[1].trim();
    }
    const startBrace = cleaned.indexOf('{');
    const endBrace = cleaned.lastIndexOf('}');
    if (startBrace !== -1 && endBrace !== -1 && endBrace > startBrace) {
      cleaned = cleaned.slice(startBrace, endBrace + 1);
    }
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        is_clear: false,
        retake_message: 'الصورة غير واضحة بدرجة كافية أو تعذر قراءة رد المعالج الذكي. يرجى إعادة المحاولة.',
        confidence: 'low',
        items: [],
        raw_error: 'INVALID_JSON',
        error_category: 'invalid_json',
        error_code: 'INVALID_JSON'
      };
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      is_clear: false,
      retake_message: 'تعذر تحليل بيانات الروشتة. يرجى إعادة المحاولة.',
      confidence: 'low',
      items: [],
      error_category: 'invalid_json',
      error_code: 'INVALID_DATA'
    };
  }

  const isClear = typeof parsed.is_clear === 'boolean'
    ? parsed.is_clear
    : String(parsed.is_clear).toLowerCase() === 'true';

  const normalizeConfidence = (val: any): ItemConfidence => {
    const s = String(val || '').toLowerCase().trim();
    if (s === 'high' || s === 'medium' || s === 'low') return s;
    return 'medium';
  };

  const confidence = normalizeConfidence(parsed.confidence);
  const evidenceText = parsed.evidence_text ? String(parsed.evidence_text).trim() : undefined;
  const audioSummary = parsed.audio_summary ? String(parsed.audio_summary).trim() : undefined;

  // Handle unclear photos
  if (!isClear) {
    return {
      is_clear: false,
      retake_message: parsed.retake_message
        ? String(parsed.retake_message).trim()
        : 'صورة الروشتة غير واضحة. يرجى التأكد من إضاءة جيدة وتصوير كامل الورقة دون اهتزاز.',
      confidence: 'low',
      evidence_text: evidenceText,
      items: [],
      audio_summary: audioSummary,
      raw_error: parsed.raw_error,
      error_category: parsed.error_category,
      error_code: parsed.error_code,
      error_detail: parsed.error_detail || parsed.detail
    };
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

  // If items is empty or absent, set is_clear: false with friendly Arabic retake_message
  if (rawItems.length === 0) {
    return {
      is_clear: false,
      retake_message: parsed.retake_message
        ? String(parsed.retake_message).trim()
        : 'لم نتمكن من العثور على أدوية واضحة في الروشتة. يرجى التأكد من تصوير كامل الروشتة بوضوح.',
      confidence: 'low',
      evidence_text: evidenceText,
      items: [],
      audio_summary: audioSummary
    };
  }

  // Normalize items array (max 10 items, default values, confidence mapping)
  const items: PrescriptionItem[] = rawItems.slice(0, 10).map((item: any) => {
    const itemConf = normalizeConfidence(item.confidence);
    const lineText = item.line_text_as_written ? String(item.line_text_as_written).trim() : '';
    const medAr = item.medicine_name_ar ? String(item.medicine_name_ar).trim() : '';
    const medEn = item.medicine_name_en ? String(item.medicine_name_en).trim() : '';
    const active = item.active_ingredient ? String(item.active_ingredient).trim() : '';
    const instructions = item.written_instructions ? String(item.written_instructions).trim() : '';
    // For low-confidence items, no explanation is given
    const explanation = itemConf === 'low' ? '' : (item.short_explanation ? String(item.short_explanation).trim() : '');

    return {
      line_text_as_written: lineText,
      medicine_name_ar: medAr,
      medicine_name_en: medEn,
      active_ingredient: active,
      confidence: itemConf,
      written_instructions: instructions,
      short_explanation: explanation
    };
  });

  return {
    is_clear: true,
    retake_message: parsed.retake_message ? String(parsed.retake_message).trim() : undefined,
    confidence,
    evidence_text: evidenceText,
    items,
    audio_summary: audioSummary
  };
}

export const cleanAndParsePrescriptionJson = validatePrescriptionJson;
export const parsePrescriptionAnalysisResult = validatePrescriptionJson;
