import { BoxAnalysisResult } from './testContracts';

export const sampleBoxPrintedUsage: BoxAnalysisResult = {
  is_clear: true,
  retake_message: '',
  confidence: 'high',
  evidence_text: 'PANADOL EXTRA Paracetamol 500mg, Caffeine 65mg. Take 1-2 tablets every 4-6 hours with water.',
  medicine_name_ar: 'بنادول إكسترا',
  medicine_name_en: 'Panadol Extra',
  active_ingredient: 'Paracetamol & Caffeine',
  uses: [
    'تسكين الآلام الحادة والصداع والصداع النصفي',
    'خفض درجة الحرارة وتخفيف آلام الجسم',
  ],
  how_and_when: [
    'قرص إلى قرصين كل 4 إلى 6 ساعات عند اللزوم',
    'يؤخذ مع كوب كامل من الماء بعد الطعام لتقليل تهيج المعدة',
  ],
  usage_source: 'printed',
  warnings: [
    'لا تتناول أدوية أخرى تحتوي على الباراسيتامول في نفس الوقت',
    'تجنب الإكثار من الشاي والقهوة بسبب احتوائه على الكافيين',
    'استشر الطبيب أو الصيدلي إذا لم يتحسن الألم خلال 3 أيام',
  ],
  audio_summary: 'بنادول إكسترا مسكن للصداع والحرارة. الاستخدام مكتوب على العلبة: قرص أو قرصين عند اللزوم بعد الأكل.',
};

export const sampleBoxCommonUsage: BoxAnalysisResult = {
  is_clear: true,
  retake_message: '',
  confidence: 'high',
  evidence_text: 'CONCOR 5mg Bisoprolol Fumarate. 30 Film-coated tablets.',
  medicine_name_ar: 'كونكور 5 مجم',
  medicine_name_en: 'Concor 5mg',
  active_ingredient: 'Bisoprolol Fumarate',
  uses: [
    'علاج ارتفاع ضغط الدم الشرياني',
    'تنظيم ضربات القلب وتخفيف العبء عن عضلة القلب',
  ],
  how_and_when: [
    'يؤخذ عادة مرة واحدة يومياً في نفس التوقيت كل يوم',
    'يفضل تناوله في الصباح قبل الإفطار أو بعده بقليل مع الماء',
    'لا توقف الدواء فجأة من تلقاء نفسك',
  ],
  usage_source: 'common',
  warnings: [
    'قد يسبب الشعور بالدوار عند الوقوف السريع',
    'أخبر الطبيب إذا كنت تعاني من الربو أو ضيق التنفس',
    'راجع طبيبك أو الصيدلي دائماً لتحديد الجرعة المناسبة لحالتك',
  ],
  audio_summary: 'كونكور لعلاج ضغط الدم وتنظيم ضربات القلب. يؤخذ عادة مرة واحدة صباحاً.',
};

export const sampleBoxUnclear: BoxAnalysisResult = {
  is_clear: false,
  retake_message: 'الصورة غير واضحة. يرجى التأكد من إضاءة الغرفة، وإظهار العلبة كاملة، وتثبيت الهاتف أثناء التصوير.',
  confidence: 'low',
  evidence_text: '',
  medicine_name_ar: '',
  medicine_name_en: '',
  active_ingredient: '',
  uses: [],
  how_and_when: [],
  usage_source: 'common',
  warnings: [],
  audio_summary: 'الصورة غير واضحة. يرجى إعادة التصوير باتباع النصائح.',
};

export const sampleBoxDetailsMetformin: BoxAnalysisResult = {
  is_clear: true,
  retake_message: '',
  confidence: 'high',
  evidence_text: 'Text lookup for Metformin Hydrochloride',
  medicine_name_ar: 'ميتفورمين (منظم السكر)',
  medicine_name_en: 'Metformin',
  active_ingredient: 'Metformin Hydrochloride',
  uses: [
    'علاج مرض السكري من النوع الثاني',
    'تحسين حساسية خلايا الجسم للأنسولين',
  ],
  how_and_when: [
    'يؤخذ عادة مع الوجبات أو بعدها مباشرة لتقليل اضطرابات الجهاز الهضمي',
    'يتم الالتزام بالمواعيد المحددة يومياً دون تفويت الوجبات',
  ],
  usage_source: 'common',
  warnings: [
    'يجب فحص وظائف الكلى دورياً عند استخدامه لفترات طويلة',
    'اشرب كميات كافية من الماء يومياً',
    'استشر طبيبك أو الصيدلي بانتظام للتأكد من استجابة سكر الدم',
  ],
  audio_summary: 'ميتفورمين منظم للسكر. يؤخذ مع الطعام لتقليل اضطراب المعدة.',
};
