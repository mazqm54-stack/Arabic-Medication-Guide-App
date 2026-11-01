import { PrescriptionAnalysisResult } from './testContracts';

export const sampleClearPrescription: PrescriptionAnalysisResult = {
  is_clear: true,
  retake_message: '',
  confidence: 'high',
  evidence_text: 'Tab Metformin 500mg 1x2 pc, Tab Gliclazide 80mg 1x1 ac',
  items: [
    {
      line_text_as_written: 'Tab Metformin 500mg 1x2 pc',
      medicine_name_ar: 'ميتفورمين (سيدوفاج)',
      medicine_name_en: 'Metformin',
      active_ingredient: 'Metformin Hydrochloride',
      confidence: 'high',
      written_instructions: 'قرص مرتين يومياً بعد الأكل',
      short_explanation: 'يساعد في تنظيم وخفض مستوى السكر في الدم لمرضى السكري.',
    },
    {
      line_text_as_written: 'Tab Gliclazide 80mg 1x1 ac',
      medicine_name_ar: 'جليكلازيد (ديافانس)',
      medicine_name_en: 'Gliclazide',
      active_ingredient: 'Gliclazide',
      confidence: 'high',
      written_instructions: 'قرص مرة واحدة يومياً قبل الإفطار',
      short_explanation: 'يحفز البنكرياس لإفراز الأنسولين وتنظيم سكر الدم.',
    },
  ],
  audio_summary: 'تحتوي الروشتة على دوائين للسكر: ميتفورمين وجليكلازيد. يرجى مراجعة الصيدلي للتأكيد.',
};

export const sampleMixedPrescription: PrescriptionAnalysisResult = {
  is_clear: true,
  retake_message: '',
  confidence: 'medium',
  evidence_text: 'Tab Metformin 500mg, Tab Concor 5mg, ??? illegible scribble',
  items: [
    {
      line_text_as_written: 'Tab Metformin 500mg 1x2',
      medicine_name_ar: 'ميتفورمين',
      medicine_name_en: 'Metformin',
      active_ingredient: 'Metformin',
      confidence: 'high',
      written_instructions: 'قرص مرتين يومياً',
      short_explanation: 'يستخدم لتنظيم مستوى السكر في الدم.',
    },
    {
      line_text_as_written: 'Tab Concor 5mg 1x1',
      medicine_name_ar: 'كونكور',
      medicine_name_en: 'Concor',
      active_ingredient: 'Bisoprolol',
      confidence: 'medium',
      written_instructions: 'قرص صباحاً',
      short_explanation: 'يستخدم لعلاج ارتفاع ضغط الدم وتنظيم ضربات القلب.',
    },
    {
      line_text_as_written: 'Dr scribble ~~~ 10mg',
      medicine_name_ar: '',
      medicine_name_en: '',
      active_ingredient: '',
      confidence: 'low',
      written_instructions: '10mg',
      short_explanation: '', // Low confidence MUST have empty explanation
    },
  ],
  audio_summary: 'الروشتة تحتوي على دواء ميتفورمين ودواء كونكور، بالإضافة إلى سطر غير واضح نوصي بسؤال الصيدلي عنه.',
};

export const sampleEmptyItemsPrescription: PrescriptionAnalysisResult = {
  is_clear: false,
  retake_message: 'لم نتمكن من قراءة أدوية واضحة في الروشتة. يرجى التقاط الصورة في إضاءة جيدة والاقتراب من الورقة.',
  confidence: 'low',
  evidence_text: '',
  items: [],
  audio_summary: 'لم نتمكن من قراءة الروشتة. يرجى إعادة التصوير بوضوح.',
};

export const sampleTenItemsPrescription: PrescriptionAnalysisResult = {
  is_clear: true,
  retake_message: '',
  confidence: 'high',
  evidence_text: 'Prescription with exactly 10 emergency triage items',
  items: Array.from({ length: 10 }, (_, i) => ({
    line_text_as_written: `Med ${i + 1} 50mg 1x1`,
    medicine_name_ar: `دواء ${i + 1}`,
    medicine_name_en: `Medicine ${i + 1}`,
    active_ingredient: `Ingredient ${i + 1}`,
    confidence: i % 3 === 0 ? 'medium' : i % 3 === 1 ? 'high' : 'low',
    written_instructions: `قرص يومياً رقم ${i + 1}`,
    short_explanation: i % 3 === 2 ? '' : `استخدام مبسط للدواء رقم ${i + 1}.`,
  })),
  audio_summary: 'تحتوي الروشتة على عشرة أدوية مختلفة.',
};
