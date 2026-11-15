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

/**
 * Phase 1 Rebuild Fixture 1: Fully Confirmed Prescription (F06, F11)
 * Infection treatment with clear handwriting. Both medicines clearly read and confirmed.
 */
export const samplePhase1ConfirmedPrescription: PrescriptionAnalysisResult = {
  is_clear: true,
  retake_message: '',
  confidence: 'high',
  evidence_text: 'Augmentin 1g tab 1x2, Panadol Extra 500mg 1x3 prn',
  deduced_condition: 'التهاب بكتيري حاد بالجهاز التنفسي مصحوب بحمى وألم',
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
      short_explanation: 'مضاد حيوي لعلاج الالتهابات البكتيرية في الجهاز التنفسي.',
      visible_letters: 'Augmentin',
      suggested_medicines: [],
      warning_note: '',
    },
    {
      line_text_as_written: 'Panadol Extra 500mg 1x3 prn',
      is_confirmed: true,
      status: 'confirmed',
      medicine_name_ar: 'بنادول إكسترا 500 ملغ',
      medicine_name_en: 'Panadol Extra 500mg',
      active_ingredient: 'باراسيتامول + كافيين',
      confidence: 'high',
      written_instructions: 'قرص عند اللزوم كل 8 ساعات',
      short_explanation: 'مسكن للآلام وخافض لدرجة الحرارة.',
      visible_letters: 'Panadol Extra',
      suggested_medicines: [],
      warning_note: '',
    },
  ],
  audio_summary: 'تحتوي الروشتة على أوجمنتين مضاد حيوي وبنادول إكسترا لتسكين الألم وخفض الحرارة.',
};

/**
 * Phase 1 Rebuild Fixture 2: Mixed Prescription with Smart Suggestions (F06, F07, F08, F09)
 * Legible Augmentin provides clinical context of bacterial infection.
 * Unclear line "C...fl... 500" produces up to 2 suggestions with ZERO dosage and safety warning.
 */
export const samplePhase1MixedWithSuggestions: PrescriptionAnalysisResult = {
  is_clear: true,
  retake_message: '',
  confidence: 'medium',
  evidence_text: 'Augmentin 1g tab 1x2, C...fl... 500 ???',
  deduced_condition: 'عدوى بكتيرية حادة بالجهاز البولي أو التنفسي',
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
      short_explanation: 'مضاد حيوي فعال لعلاج الالتهابات البكتيرية.',
      visible_letters: 'Augmentin',
      suggested_medicines: [],
      warning_note: '',
    },
    {
      line_text_as_written: 'C...fl... 500',
      is_confirmed: false,
      status: 'suggested',
      medicine_name_ar: 'سيبروفلوكساسين 500 ملغ (محتمل)',
      medicine_name_en: 'Ciprofloxacin 500mg (possible)',
      active_ingredient: 'سيبروفلوكساسين',
      confidence: 'medium',
      written_instructions: '', // Strictly omitted (F09)
      short_explanation: '', // Low/suggested items omit explanation
      visible_letters: 'C...fl...',
      suggested_medicines: [
        { name_ar: 'سيبروفلوكساسين 500 ملغ', name_en: 'Ciprofloxacin 500mg', confidence: 'medium' },
        { name_ar: 'سيفالكسين 500 ملغ', name_en: 'Cephalexin 500mg', confidence: 'low' },
      ],
      warning_note: 'محتمل، غير مؤكد - اسأل الصيدلي للتأكد من الدواء والجرعة الصحيحة',
    },
  ],
  audio_summary: 'تحتوي الروشتة على أوجمنتين مؤكد، وسطر غير واضح يُحتمل أن يكون سيبروفلوكساسين. يجب مراجعة الصيدلي للتأكد.',
};

/**
 * Phase 1 Rebuild Fixture 3: Chronic Diabetes Prescription (F07, F08, F09)
 * Legible Metformin deduces diabetes mellitus context, matching unclear "G...cl..." to Gliclazide/Glimepiride.
 */
export const samplePhase1ChronicPrescription: PrescriptionAnalysisResult = {
  is_clear: true,
  retake_message: '',
  confidence: 'medium',
  evidence_text: 'Metformin 500mg 1x2, G...cl... 80mg',
  deduced_condition: 'داء السكري من النوع الثاني',
  items: [
    {
      line_text_as_written: 'Metformin 500mg 1x2',
      is_confirmed: true,
      status: 'confirmed',
      medicine_name_ar: 'ميتفورمين 500 ملغ',
      medicine_name_en: 'Metformin 500mg',
      active_ingredient: 'ميتفورمين هيدروكلوريد',
      confidence: 'high',
      written_instructions: 'قرص مرتين يومياً مع الوجبات',
      short_explanation: 'يساعد في تنظيم مستويات الجلوكوز في الدم.',
      visible_letters: 'Metformin',
      suggested_medicines: [],
      warning_note: '',
    },
    {
      line_text_as_written: 'G...cl... 80mg',
      is_confirmed: false,
      status: 'suggested',
      medicine_name_ar: 'جليكلازيد 80 ملغ (محتمل)',
      medicine_name_en: 'Gliclazide 80mg (possible)',
      active_ingredient: 'جليكلازيد',
      confidence: 'medium',
      written_instructions: '', // OMITTED!
      short_explanation: '',
      visible_letters: 'G...cl...',
      suggested_medicines: [
        { name_ar: 'جليكلازيد 80 ملغ', name_en: 'Gliclazide 80mg', confidence: 'medium' },
        { name_ar: 'جليميبيريد 2 ملغ', name_en: 'Glimepiride 2mg', confidence: 'low' },
      ],
      warning_note: 'محتمل، غير مؤكد - اسأل الصيدلي للتأكد من الدواء والجرعة الصحيحة',
    },
  ],
  audio_summary: 'الروشتة تحتوي على ميتفورمين للسكر ودواء محتمل يُرجى سؤال الصيدلي عنه.',
};

/**
 * Phase 1 Rebuild Fixture 4: Cardiovascular Prescription (F07, F08)
 * Legible Concor deduces hypertension context, matching unclear "A...lo..." to Amlodipine/Atenolol.
 */
export const samplePhase1CardiovascularPrescription: PrescriptionAnalysisResult = {
  is_clear: true,
  retake_message: '',
  confidence: 'medium',
  evidence_text: 'Concor 5mg 1x1, A...lo... 5mg',
  deduced_condition: 'ارتفاع ضغط الدم وأمراض القلب والشرايين',
  items: [
    {
      line_text_as_written: 'Concor 5mg 1x1',
      is_confirmed: true,
      status: 'confirmed',
      medicine_name_ar: 'كونكور 5 ملغ',
      medicine_name_en: 'Concor 5mg',
      active_ingredient: 'بيسوبرولول',
      confidence: 'high',
      written_instructions: 'قرص صباحاً مع قليل من الماء',
      short_explanation: 'لعلاج ارتفاع ضغط الدم وتنظيم ضربات القلب.',
      visible_letters: 'Concor',
      suggested_medicines: [],
      warning_note: '',
    },
    {
      line_text_as_written: 'A...lo... 5mg',
      is_confirmed: false,
      status: 'suggested',
      medicine_name_ar: 'أملوديبين 5 ملغ (محتمل)',
      medicine_name_en: 'Amlodipine 5mg (possible)',
      active_ingredient: 'أملوديبين',
      confidence: 'medium',
      written_instructions: '', // Strictly omitted!
      short_explanation: '',
      visible_letters: 'A...lo...',
      suggested_medicines: [
        { name_ar: 'أملوديبين 5 ملغ', name_en: 'Amlodipine 5mg', confidence: 'medium' },
        { name_ar: 'أتينولول 50 ملغ', name_en: 'Atenolol 50mg', confidence: 'low' },
      ],
      warning_note: 'محتمل، غير مؤكد - اسأل الصيدلي للتأكد من الدواء والجرعة الصحيحة',
    },
  ],
  audio_summary: 'تحتوي الروشتة على كونكور للضغط ودواء محتمل، يرجى استشارة الصيدلي.',
};

/**
 * Phase 1 Rebuild Fixture 5: Unclear Handwriting Fallback (F10)
 * Completely illegible scribble with no plausible match.
 * Status must be 'unclear', never presenting guesses as confirmed.
 */
export const samplePhase1UnclearFallback: PrescriptionAnalysisResult = {
  is_clear: true,
  retake_message: '',
  confidence: 'low',
  evidence_text: 'Augmentin 1g, ~~~~~~~~~~~~~',
  deduced_condition: 'عدوى بكتيرية محتملة',
  items: [
    {
      line_text_as_written: 'Augmentin 1g 1x2',
      is_confirmed: true,
      status: 'confirmed',
      medicine_name_ar: 'أوجمنتين 1 غرام',
      medicine_name_en: 'Augmentin 1g',
      active_ingredient: 'أموكسيسيلين + كلافولانات البوتاسيوم',
      confidence: 'high',
      written_instructions: 'قرص مرتين يومياً',
      short_explanation: 'مضاد حيوي للالتهابات.',
      visible_letters: 'Augmentin',
      suggested_medicines: [],
      warning_note: '',
    },
    {
      line_text_as_written: '~~~~~~~~~~~~~ illegible scribble',
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
      warning_note: 'خط الطبيب غير مقروء في هذا السطر - يرجى استشارة الصيدلي مباشرة ولا تتناول أي دواء غير مؤكد',
    },
  ],
  audio_summary: 'توجد قراءة واضحة لدواء أوجمنتين، وسطر آخر غير مقروء تماماً يجب عرضه على الصيدلي.',
};

/**
 * Phase 1 Rebuild Adversarial Fixture: Illegitimate Dosage on Suggested Item (Negative test case for F09)
 */
export const samplePhase1ViolatingDosageSuggestion: PrescriptionAnalysisResult = {
  is_clear: true,
  retake_message: '',
  confidence: 'medium',
  evidence_text: 'Augmentin 1g, C...fl... 500',
  deduced_condition: 'التهاب بكتيري',
  items: [
    {
      line_text_as_written: 'C...fl... 500',
      is_confirmed: false,
      status: 'suggested',
      medicine_name_ar: 'سيبروفلوكساسين (محتمل)',
      medicine_name_en: 'Ciprofloxacin (possible)',
      active_ingredient: 'سيبروفلوكساسين',
      confidence: 'medium',
      written_instructions: 'قرص مرتين يومياً لمدة 7 أيام', // VIOLATION OF F09!
      short_explanation: '',
      visible_letters: 'C...fl...',
      suggested_medicines: [
        { name_ar: 'سيبروفلوكساسين', name_en: 'Ciprofloxacin', confidence: 'medium' }
      ],
      warning_note: 'اسأل الصيدلي',
    },
  ],
  audio_summary: 'ملخص',
};

