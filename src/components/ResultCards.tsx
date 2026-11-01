import React, { useMemo } from 'react';
import { Pill, FileText, Clock, AlertTriangle, CheckCircle2, Info, Tag } from 'lucide-react';
import { MedicineAnalysisResult, FontSizePreference } from '../types';

export const HARDCODED_DISCLAIMER_LINE = 'هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي.';

export interface ResultCardsProps {
  result: MedicineAnalysisResult;
  fontSize: FontSizePreference;
  context?: 'box' | 'prescription';
}

export const ResultCards: React.FC<ResultCardsProps> = ({ result, fontSize, context = 'box' }) => {
  const isExtraLarge = fontSize === 'extra-large';

  const headingClass = isExtraLarge ? 'text-senior-2xl font-bold' : 'text-senior-xl font-bold';
  const bodyClass = isExtraLarge ? 'text-senior-lg leading-loose' : 'text-senior-base leading-relaxed';
  const iconSizeClass = isExtraLarge ? 'w-10 h-10' : 'w-8 h-8';

  // F21: Multi-tier safe fallback for how_and_when
  const safeHowAndWhen: string[] = useMemo(() => {
    const rawList = Array.isArray(result.how_and_when)
      ? result.how_and_when.filter((item): item is string => typeof item === 'string' && item.trim().length > 2)
      : [];

    const filtered = rawList.filter((item) => {
      const t = item.trim();
      const isGeneric = (
        /^(?:اتبع|يجب اتباع)\s+(?:بدقة\s+)?(?:توجيهات|تعليمات|إرشادات)\s+الطبيب/i.test(t) ||
        /^(?:راجع|استشر)\s+(?:الطبيب|الصيدلي)(?:\s+أو\s+(?:الصيدلي|الطبيب))?(?:\s+.*)?$/i.test(t) ||
        /^(?:اتبع\s+ما\s+كتبه\s+الطبيب|حسب\s+إرشادات\s+الطبيب)(?:\s+.*)?$/i.test(t) ||
        /^as\s+directed\s+by\s+(?:your\s+)?doctor/i.test(t) ||
        /^follow\s+(?:the\s+)?doctor/i.test(t)
      );
      return !isGeneric;
    });

    if (filtered.length === 0) {
      return [
        'يؤخذ عادة في أوقات منتظمة يومياً حسب توجيهات الصيدلي',
        'يفضل تناوله مع كوب ماء كامل بعد الطعام',
        'راجع طبيبك أو الصيدلي دائماً لتحديد الجرعة المناسبة لحالتك',
      ];
    }
    return filtered;
  }, [result.how_and_when]);

  // F22: Usage source badge resolution
  const usageSource: 'printed' | 'common' = result.usage_source === 'printed' ? 'printed' : 'common';

  const badgeLabel = usageSource === 'printed'
    ? (context === 'prescription' ? 'مكتوب في الروشتة' : 'مكتوب على العلبة')
    : 'الاستخدام الشائع';

  const badgeClasses = usageSource === 'printed'
    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
    : 'bg-blue-100 text-blue-800 border-blue-300';

  return (
    <div className="space-y-6 w-full" aria-label="نتائج تحليل علبة الدواء">
      {/* Card 1: اسم الدواء والمادة الفعالة */}
      <section
        tabIndex={0}
        aria-label="اسم الدواء والمادة الفعالة"
        className="card-senior bg-white border-3 border-teal-600 shadow-md"
      >
        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-teal-100">
          <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
            <Pill className={`${iconSizeClass} text-teal-700`} aria-hidden="true" />
          </div>
          <div>
            <span className="text-teal-700 font-bold text-sm block">البطاقة الأولى</span>
            <h2 className={`${headingClass} text-teal-900`}>
              اسم الدواء والمادة الفعالة
            </h2>
          </div>
        </div>

        <div className="space-y-3 pr-2">
          {result.medicine_name_ar && (
            <div>
              <span className="text-slate-600 text-sm font-semibold block mb-0.5">الاسم بالعربية:</span>
              <p className={`${isExtraLarge ? 'text-3xl' : 'text-2xl'} font-extrabold text-teal-800`}>
                {result.medicine_name_ar}
              </p>
            </div>
          )}

          {result.medicine_name_en && (
            <div dir="ltr" className="text-left bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 text-xs font-semibold block mb-0.5">Trade Name & Strength:</span>
              <p className="text-xl font-bold text-slate-800 font-mono">
                {result.medicine_name_en}
              </p>
            </div>
          )}

          {result.active_ingredient && (
            <div className="pt-2">
              <span className="text-slate-600 text-sm font-semibold block mb-0.5">المادة الفعالة:</span>
              <p className={`${bodyClass} font-bold text-slate-800 bg-teal-50/70 p-3 rounded-xl border border-teal-200`}>
                🧪 {result.active_ingredient}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Card 2: دواعي الاستعمال */}
      <section
        tabIndex={0}
        aria-label="دواعي الاستعمال"
        className="card-senior bg-white border-3 border-blue-600 shadow-md"
      >
        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-blue-100">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <FileText className={`${iconSizeClass} text-blue-700`} aria-hidden="true" />
          </div>
          <div>
            <span className="text-blue-700 font-bold text-sm block">البطاقة الثانية</span>
            <h2 className={`${headingClass} text-blue-900`}>
              دواعي الاستعمال (لماذا يُستخدم؟)
            </h2>
          </div>
        </div>

        {result.uses && result.uses.length > 0 ? (
          <ul className="space-y-3 pr-2">
            {result.uses.map((use, index) => (
              <li key={index} className="flex items-start gap-3">
                <CheckCircle2 className="w-7 h-7 text-blue-600 flex-shrink-0 mt-1" aria-hidden="true" />
                <span className={`${bodyClass} font-semibold text-slate-800`}>{use}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`${bodyClass} text-slate-700 pr-2`}>
            يرجى مراجعة النشرة الداخلية أو استشارة الطبيب لمعرفة كافة دواعي الاستعمال.
          </p>
        )}
      </section>

      {/* Card 3: طريقة الاستخدام وأفضل المواعيد (F21, F22, F23) */}
      <section
        tabIndex={0}
        aria-label="طريقة الاستخدام وأفضل المواعيد"
        className="card-senior bg-white border-3 border-emerald-600 shadow-md"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b-2 border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Clock className={`${iconSizeClass} text-emerald-700`} aria-hidden="true" />
            </div>
            <div>
              <span className="text-emerald-700 font-bold text-sm block">البطاقة الثالثة</span>
              <h2 className={`${headingClass} text-emerald-900`}>
                طريقة الاستخدام وأفضل المواعيد
              </h2>
            </div>
          </div>

          {/* F22: Usage Source Badge */}
          <span
            data-testid="usage-source-badge"
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${badgeClasses}`}
          >
            {usageSource === 'printed' ? (
              <Tag className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            ) : (
              <Info className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            )}
            <span>{badgeLabel}</span>
          </span>
        </div>

        {/* F21: Safe guaranteed non-empty instructions */}
        <ul className="space-y-3 pr-2 mb-4">
          {safeHowAndWhen.map((instruction, index) => (
            <li key={index} className="flex items-start gap-3 bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-base">
                {index + 1}
              </span>
              <span className={`${bodyClass} font-bold text-emerald-950`}>{instruction}</span>
            </li>
          ))}
        </ul>

        {/* F23: Hardcoded Arabic Disclaimer Line immediately below Card 3 */}
        <div
          data-testid="usage-disclaimer-container"
          className="mt-4 pt-3 border-t border-emerald-100 text-right"
          dir="rtl"
        >
          <p
            data-testid="usage-disclaimer-line"
            className={`text-slate-600 ${isExtraLarge ? 'text-lg' : 'text-base'} leading-relaxed font-medium`}
          >
            {HARDCODED_DISCLAIMER_LINE}
          </p>
        </div>
      </section>

      {/* Card 4: تنبيهات هامة */}
      <section
        tabIndex={0}
        aria-label="تنبيهات هامة واحتياطات"
        className="card-senior bg-[#FEF3C7] border-3 border-amber-500 shadow-md text-[#92400E]"
      >
        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-amber-300">
          <div className="w-12 h-12 rounded-xl bg-amber-200 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className={`${iconSizeClass} text-amber-800`} aria-hidden="true" />
          </div>
          <div>
            <span className="text-amber-800 font-bold text-sm block">البطاقة الرابعة</span>
            <h2 className={`${headingClass} text-amber-950`}>
              تنبيهات واحتياطات هامة
            </h2>
          </div>
        </div>

        {result.warnings && result.warnings.length > 0 ? (
          <ul className="space-y-3 pr-2">
            {result.warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="w-3 h-3 rounded-full bg-amber-700 flex-shrink-0 mt-3" aria-hidden="true" />
                <span className={`${bodyClass} font-bold text-amber-950`}>{warning}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`${bodyClass} font-semibold text-amber-900 pr-2`}>
            لا توجد تحذيرات استثنائية مسجلة على واجهة العلبة، يُرجى قراءة النشرة الداخلية دائماً.
          </p>
        )}
      </section>
    </div>
  );
};
