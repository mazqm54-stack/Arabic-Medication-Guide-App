/**
 * Interface Contracts and Runtime Validators for E2E Test Suite
 * Strictly derived from PROJECT.md § Interface Contracts and ORIGINAL_REQUEST.md
 */

export interface SuggestedMedicine {
  name_ar: string;
  name_en: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface PrescriptionItem {
  line_text_as_written: string;
  medicine_name_ar: string;
  medicine_name_en: string;
  active_ingredient: string;
  confidence: 'high' | 'medium' | 'low';
  written_instructions: string;
  short_explanation: string;
  // Phase 1 Rebuild enhancements (F06-F11)
  is_confirmed?: boolean;
  status?: 'confirmed' | 'suggested' | 'unclear';
  visible_letters?: string;
  suggested_medicines?: SuggestedMedicine[];
  warning_note?: string;
}

export interface PrescriptionAnalysisResult {
  is_clear: boolean;
  retake_message: string;
  confidence: 'high' | 'medium' | 'low';
  evidence_text: string;
  items: PrescriptionItem[];
  audio_summary: string;
  // Phase 1 Rebuild enhancement (F07)
  deduced_condition?: string;
}

export interface BoxAnalysisResult {
  is_clear: boolean;
  retake_message: string;
  confidence: 'high' | 'medium' | 'low';
  evidence_text: string;
  medicine_name_ar: string;
  medicine_name_en: string;
  active_ingredient: string;
  uses: string[];
  how_and_when: string[];
  usage_source: 'printed' | 'common';
  warnings: string[];
  audio_summary: string;
}

export interface WorkerErrorResponse {
  is_clear: false;
  error: 'UPSTREAM_TIMEOUT' | 'UPSTREAM_API_ERROR' | 'RATE_LIMIT_EXCEEDED' | 'PAYLOAD_TOO_LARGE' | 'BAD_REQUEST' | 'METHOD_NOT_ALLOWED';
  error_code: string;
  retake_message: string;
  detail?: string;
}

export type TabKey = 'home' | 'medicines' | 'camera' | 'prescription' | 'history';

export const RTL_NAV_TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'home', label: 'الرئيسية', icon: 'Home' },
  { key: 'medicines', label: 'أدويتي', icon: 'Pill' },
  { key: 'camera', label: 'صوّر', icon: 'Camera' },
  { key: 'prescription', label: 'الروشتة', icon: 'FileText' },
  { key: 'history', label: 'السجل', icon: 'History' },
];

export const HARDCODED_DISCLAIMER_LINE = 'هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي.';
export const PRESCRIPTION_ADVISORY_BANNER = 'راجع أسماء الأدوية قبل الاعتماد';
export const LOW_CONFIDENCE_AMBER_TEXT = 'غير واضح، اسأل الصيدلي';

/**
 * Validates whether an object adheres to the PrescriptionAnalysisResult schema
 */
export function validatePrescriptionSchema(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Response is not an object'] };
  }

  if (typeof data.is_clear !== 'boolean') errors.push('is_clear must be a boolean');
  if (typeof data.retake_message !== 'string') errors.push('retake_message must be a string');
  if (!['high', 'medium', 'low'].includes(data.confidence)) errors.push('confidence must be high, medium, or low');
  if (typeof data.evidence_text !== 'string') errors.push('evidence_text must be a string');
  if (typeof data.audio_summary !== 'string') errors.push('audio_summary must be a string');

  if (!Array.isArray(data.items)) {
    errors.push('items must be an array');
  } else {
    if (data.items.length > 10) {
      errors.push('items array exceeds maximum allowed 10 items');
    }
    data.items.forEach((item: any, idx: number) => {
      if (typeof item.line_text_as_written !== 'string') errors.push(`items[${idx}].line_text_as_written must be string`);
      if (typeof item.medicine_name_ar !== 'string') errors.push(`items[${idx}].medicine_name_ar must be string`);
      if (typeof item.medicine_name_en !== 'string') errors.push(`items[${idx}].medicine_name_en must be string`);
      if (typeof item.active_ingredient !== 'string') errors.push(`items[${idx}].active_ingredient must be string`);
      if (!['high', 'medium', 'low'].includes(item.confidence)) errors.push(`items[${idx}].confidence must be high, medium, or low`);
      if (typeof item.written_instructions !== 'string') errors.push(`items[${idx}].written_instructions must be string`);
      if (typeof item.short_explanation !== 'string') errors.push(`items[${idx}].short_explanation must be string`);
      
      // Rule 4: Low-confidence items must have no AI explanation
      if (item.confidence === 'low' && item.short_explanation.trim() !== '') {
        errors.push(`items[${idx}] has low confidence but provides short_explanation (must be empty)`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates whether an object adheres to the BoxAnalysisResult schema
 */
export function validateBoxSchema(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Response is not an object'] };
  }

  if (typeof data.is_clear !== 'boolean') errors.push('is_clear must be a boolean');
  if (typeof data.retake_message !== 'string') errors.push('retake_message must be a string');
  if (!['high', 'medium', 'low'].includes(data.confidence)) errors.push('confidence must be high, medium, or low');
  if (typeof data.evidence_text !== 'string') errors.push('evidence_text must be a string');
  if (typeof data.medicine_name_ar !== 'string') errors.push('medicine_name_ar must be a string');
  if (typeof data.medicine_name_en !== 'string') errors.push('medicine_name_en must be a string');
  if (typeof data.active_ingredient !== 'string') errors.push('active_ingredient must be a string');

  if (!Array.isArray(data.uses) || data.uses.length === 0) errors.push('uses must be a non-empty array');
  
  // Rule: how_and_when must NEVER be empty and must have 2-3 items
  if (!Array.isArray(data.how_and_when) || data.how_and_when.length === 0) {
    errors.push('how_and_when must NEVER be empty');
  } else if (data.how_and_when.some((i: string) => i.includes('اتبع تعليمات الطبيب') && data.how_and_when.length === 1)) {
    errors.push('how_and_when must not be a single generic "follow doctor" item');
  }

  if (!['printed', 'common'].includes(data.usage_source)) {
    errors.push('usage_source must be either "printed" or "common"');
  }

  if (!Array.isArray(data.warnings) || data.warnings.length === 0) errors.push('warnings must be a non-empty array');
  if (typeof data.audio_summary !== 'string') errors.push('audio_summary must be a string');

  return { valid: errors.length === 0, errors };
}

/**
 * Validates whether an object adheres to the enhanced Phase 1 Prescription schema (F06-F11)
 * Enforces clinical condition deduction, smart suggestions (max 2), strict dosage omission,
 * and clear distinction between confirmed and suggested/unclear medicines.
 */
export function validatePhase1PrescriptionSchema(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Response is not an object'] };
  }

  if (typeof data.is_clear !== 'boolean') errors.push('is_clear must be a boolean');
  if (typeof data.retake_message !== 'string') errors.push('retake_message must be a string');
  if (!['high', 'medium', 'low'].includes(data.confidence)) errors.push('confidence must be high, medium, or low');
  if (typeof data.evidence_text !== 'string') errors.push('evidence_text must be a string');
  if (typeof data.audio_summary !== 'string') errors.push('audio_summary must be a string');

  if (data.is_clear && Array.isArray(data.items) && data.items.length > 0) {
    if (typeof data.deduced_condition !== 'string' || !data.deduced_condition.trim()) {
      errors.push('Phase 1 prescription with items must provide non-empty deduced_condition (F07)');
    }
  }

  if (!Array.isArray(data.items)) {
    errors.push('items must be an array');
  } else {
    if (data.items.length > 10) {
      errors.push('items array exceeds maximum allowed 10 items');
    }
    data.items.forEach((item: any, idx: number) => {
      if (typeof item.line_text_as_written !== 'string') errors.push(`items[${idx}].line_text_as_written must be string`);
      if (typeof item.is_confirmed !== 'boolean') errors.push(`items[${idx}].is_confirmed must be a boolean (F11)`);
      if (!['confirmed', 'suggested', 'unclear'].includes(item.status)) {
        errors.push(`items[${idx}].status must be 'confirmed', 'suggested', or 'unclear' (F11)`);
      }

      if (item.status === 'confirmed') {
        if (!item.is_confirmed) {
          errors.push(`items[${idx}] status is 'confirmed' but is_confirmed is false`);
        }
        if (typeof item.medicine_name_ar !== 'string' || !item.medicine_name_ar.trim()) {
          errors.push(`items[${idx}] confirmed medicine must provide non-empty medicine_name_ar`);
        }
        if (typeof item.medicine_name_en !== 'string' || !item.medicine_name_en.trim()) {
          errors.push(`items[${idx}] confirmed medicine must provide non-empty medicine_name_en`);
        }
      } else if (item.status === 'suggested') {
        if (item.is_confirmed) {
          errors.push(`items[${idx}] status is 'suggested' but is_confirmed is true (must be false)`);
        }
        // F09: Strict Suggestion Safety & Dosage Omission
        if (item.written_instructions && item.written_instructions.trim() !== '') {
          errors.push(`items[${idx}] status is 'suggested' but provides written_instructions: "${item.written_instructions}". DOSAGES MUST BE OMITTED FOR SUGGESTIONS (F09)`);
        }
        // F08: Smart Handwriting Suggestions (up to 2 potential medicines)
        if (!Array.isArray(item.suggested_medicines) || item.suggested_medicines.length === 0 || item.suggested_medicines.length > 2) {
          errors.push(`items[${idx}] suggested item must provide suggested_medicines array with 1 to 2 entries (F08)`);
        } else {
          item.suggested_medicines.forEach((sug: any, sIdx: number) => {
            if (typeof sug.name_ar !== 'string' || !sug.name_ar.trim()) {
              errors.push(`items[${idx}].suggested_medicines[${sIdx}].name_ar must be non-empty string`);
            }
            if (typeof sug.name_en !== 'string' || !sug.name_en.trim()) {
              errors.push(`items[${idx}].suggested_medicines[${sIdx}].name_en must be non-empty string`);
            }
            if (!['high', 'medium', 'low'].includes(sug.confidence)) {
              errors.push(`items[${idx}].suggested_medicines[${sIdx}].confidence must be high, medium, or low`);
            }
          });
        }
        if (typeof item.warning_note !== 'string' || !item.warning_note.includes('صيدلي')) {
          errors.push(`items[${idx}] suggested item must provide warning_note instructing user to consult pharmacist (F09)`);
        }
      } else if (item.status === 'unclear') {
        if (item.is_confirmed) {
          errors.push(`items[${idx}] status is 'unclear' but is_confirmed is true (must be false)`);
        }
        if (item.written_instructions && item.written_instructions.trim() !== '') {
          errors.push(`items[${idx}] status is 'unclear' but provides written_instructions. Instructions must be empty (F10)`);
        }
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

