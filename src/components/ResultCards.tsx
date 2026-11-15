import React, { useMemo, useState } from 'react';
import { Pill, FileText, Clock, AlertTriangle, CheckCircle2, Info, Tag, FlaskConical, ChevronDown, ChevronUp } from 'lucide-react';
import { MedicineAnalysisResult, FontSizePreference } from '../types';

export const HARDCODED_DISCLAIMER_LINE = 'هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي.';

export interface ResultCardsProps {
  result: MedicineAnalysisResult;
  fontSize: FontSizePreference;
  context?: 'box' | 'prescription';
}

export const ResultCards: React.FC<ResultCardsProps> = ({ result, fontSize, context = 'box' }) => {
  const isExtraLarge = fontSize === 'extra-large';
  const [isCard1Expanded, setIsCard1Expanded] = useState<boolean>(false);

  const headingClass = isExtraLarge ? 'text-senior-2xl font-bold' : 'text-senior-xl font-bold';
  const bodyClass = isExtraLarge ? 'text-senior-lg leading-loose' : 'text-senior-base leading-relaxed';
  const iconSizeClass = isExtraLarge ? 'w-8 h-8' : 'w-7 h-7';

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
    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
    : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700';

  const confidenceBadge = useMemo(() => {
    const conf = result.confidence || 'high';
    if (conf === 'high') {
      return {
        label: 'دقة عالية (واضح)',
        classes: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      };
    }
    if (conf === 'medium') {
      return {
        label: 'دقة متوسطة',
        classes: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    }
    return {
      label: 'دقة منخفضة',
      classes: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    };
  }, [result.confidence]);

  return (
    <div className="space-y-5 w-full" aria-label="نتائج تحليل علبة الدواء">
      {/* Card 1: اسم الدواء والمادة الفعالة (F33, F34) */}
      <section
        tabIndex={0}
        aria-label="اسم الدواء والمادة الفعالة"
        className="rounded-2xl bg-white dark:bg-[#162124] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md p-5 sm:p-6 transition-all duration-150 motion-reduce:transition-none"
      >
        <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-[#1D2B2F] flex items-center justify-center flex-shrink-0">
              <Pill className={`${iconSizeClass} text-teal-700 dark:text-[#3DB8C4]`} aria-hidden="true" />
            </div>
            <div>
              <span className="text-teal-700 dark:text-[#3DB8C4] font-bold text-xs block">البطاقة الأولى</span>
              <h2 className={`${headingClass} text-teal-900 dark:text-[#E6EEF0]`}>
                اسم الدواء والمادة الفعالة
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Confidence Chip (F34) */}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${confidenceBadge.classes}`}
            >
              {confidenceBadge.label}
            </span>

            {/* Expandable Chevron Toggle (F34) */}
            <button
              type="button"
              onClick={() => setIsCard1Expanded((prev) => !prev)}
              aria-expanded={isCard1Expanded}
              aria-label={isCard1Expanded ? 'إخفاء تفاصيل البطاقة الأولى' : 'عرض تفاصيل البطاقة الأولى'}
              className="min-h-[48px] min-w-[48px] rounded-xl text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-[#3DB8C4] hover:bg-slate-50 dark:hover:bg-[#1D2B2F] active:scale-95 transition-all flex items-center justify-center"
            >
              {isCard1Expanded ? (
                <ChevronUp className="w-5 h-5 text-teal-600 dark:text-[#3DB8C4]" strokeWidth={2} aria-hidden="true" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-3 pr-1">
          {result.medicine_name_ar && (
            <div>
              <span className="text-slate-500 dark:text-[#9FB3B8] text-xs font-semibold block mb-0.5">الاسم بالعربية:</span>
              <p className={`${isExtraLarge ? 'text-3xl' : 'text-2xl'} font-extrabold text-teal-800 dark:text-[#3DB8C4]`}>
                {result.medicine_name_ar}
              </p>
            </div>
          )}

          {result.medicine_name_en && (
            <div dir="ltr" className="text-left bg-slate-50 dark:bg-[#1D2B2F] p-3 rounded-xl border border-gray-100 dark:border-gray-800">
              <span className="text-slate-500 dark:text-[#9FB3B8] text-xs font-semibold block mb-0.5">Trade Name & Strength:</span>
              <p className="text-lg font-bold text-slate-800 dark:text-[#E6EEF0] font-mono">
                {result.medicine_name_en}
              </p>
            </div>
          )}

          {/* Muted "as written" text (F34) */}
          {result.evidence_text && (
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              النص المقروء من العلبة: {result.evidence_text}
            </p>
          )}

          {result.active_ingredient && (
            <div className="pt-1">
              <span className="text-slate-500 dark:text-[#9FB3B8] text-xs font-semibold block mb-0.5">المادة الفعالة:</span>
              <p className={`${bodyClass} font-bold text-slate-800 dark:text-[#E6EEF0] bg-teal-50/70 dark:bg-[#1D2B2F] p-3 rounded-xl border border-teal-100 dark:border-teal-800/50 flex items-center gap-2`}>
                <FlaskConical className="w-5 h-5 text-teal-600 dark:text-[#3DB8C4] flex-shrink-0" strokeWidth={2} aria-hidden="true" />
                <span>{result.active_ingredient}</span>
              </p>
            </div>
          )}

          {/* Expandable details when chevron is toggled */}
          {isCard1Expanded && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2 text-sm text-slate-600 dark:text-slate-300 animate-in fade-in duration-150 motion-reduce:transition-none">
              <p className="font-medium">
                <span className="font-bold text-slate-800 dark:text-[#E6EEF0]">إرشادات التحقق:</span> تم استخراج هذه البيانات عبر قراءة النصوص المطبوعة على واجهة العبوة بدقة بواسطة الذكاء الاصطناعي.
              </p>
              <div className="p-2.5 rounded-xl bg-teal-50/80 dark:bg-[#1D2B2F] border border-teal-200 dark:border-teal-800/60 text-xs text-teal-900 dark:text-[#3DB8C4]">
                احرص دائماً على مطابقة تركيز الدواء وشكله الصيدلي (أقراص/كبسولات/شراب) مع روشتة الطبيب.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Card 2: دواعي الاستعمال (F33, F34) */}
      <section
        tabIndex={0}
        aria-label="دواعي الاستعمال"
        className="rounded-2xl bg-white dark:bg-[#162124] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md p-5 sm:p-6 transition-all duration-150 motion-reduce:transition-none"
      >
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800/80">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center flex-shrink-0">
            <FileText className={`${iconSizeClass} text-blue-700 dark:text-blue-400`} aria-hidden="true" />
          </div>
          <div>
            <span className="text-blue-700 dark:text-blue-400 font-bold text-xs block">البطاقة الثانية</span>
            <h2 className={`${headingClass} text-blue-900 dark:text-[#E6EEF0]`}>
              دواعي الاستعمال (لماذا يُستخدم؟)
            </h2>
          </div>
        </div>

        {result.uses && result.uses.length > 0 ? (
          <ul className="space-y-3 pr-1">
            {result.uses.map((use, index) => (
              <li key={index} className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span className={`${bodyClass} font-semibold text-slate-800 dark:text-[#E6EEF0]`}>{use}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`${bodyClass} text-slate-700 dark:text-[#9FB3B8] pr-1`}>
            يرجى مراجعة النشرة الداخلية أو استشارة الطبيب لمعرفة كافة دواعي الاستعمال.
          </p>
        )}
      </section>

      {/* Card 3: طريقة الاستخدام وأفضل المواعيد (F21, F22, F23, F33, F34) */}
      <section
        tabIndex={0}
        aria-label="طريقة الاستخدام وأفضل المواعيد"
        className="rounded-2xl bg-white dark:bg-[#162124] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md p-5 sm:p-6 transition-all duration-150 motion-reduce:transition-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center flex-shrink-0">
              <Clock className={`${iconSizeClass} text-emerald-700 dark:text-emerald-400`} aria-hidden="true" />
            </div>
            <div>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs block">البطاقة الثالثة</span>
              <h2 className={`${headingClass} text-emerald-900 dark:text-[#E6EEF0]`}>
                طريقة الاستخدام وأفضل المواعيد
              </h2>
            </div>
          </div>

          {/* F22: Usage Source Badge */}
          <span
            data-testid="usage-source-badge"
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badgeClasses}`}
          >
            {usageSource === 'printed' ? (
              <Tag className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            ) : (
              <Info className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            )}
            <span>{badgeLabel}</span>
          </span>
        </div>

        {/* F21: Safe guaranteed non-empty instructions */}
        <ul className="space-y-3 pr-1 mb-4">
          {safeHowAndWhen.map((instruction, index) => (
            <li key={index} className="flex items-start gap-3 bg-emerald-50/60 dark:bg-[#1D2B2F] p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
              <span className="w-7 h-7 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white dark:text-[#0E1517] font-bold flex items-center justify-center flex-shrink-0 text-sm">
                {index + 1}
              </span>
              <span className={`${bodyClass} font-bold text-emerald-950 dark:text-[#E6EEF0]`}>{instruction}</span>
            </li>
          ))}
        </ul>

        {/* F23: Hardcoded Arabic Disclaimer Line immediately below Card 3 */}
        <div
          data-testid="usage-disclaimer-container"
          className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 text-right"
          dir="rtl"
        >
          <p
            data-testid="usage-disclaimer-line"
            className={`text-slate-600 dark:text-[#9FB3B8] ${isExtraLarge ? 'text-lg' : 'text-base'} leading-relaxed font-medium`}
          >
            {HARDCODED_DISCLAIMER_LINE}
          </p>
        </div>
      </section>

      {/* Card 4: تنبيهات هامة (F33, F34) */}
      <section
        tabIndex={0}
        aria-label="تنبيهات هامة واحتياطات"
        className="rounded-2xl bg-[#FEF3C7] dark:bg-[#3A2E12] border border-amber-300 dark:border-amber-700/60 shadow-sm hover:shadow-md text-[#92400E] dark:text-[#F5D58A] p-5 sm:p-6 transition-all duration-150 motion-reduce:transition-none"
      >
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-amber-300 dark:border-amber-700/60">
          <div className="w-10 h-10 rounded-xl bg-amber-200 dark:bg-amber-950/80 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className={`${iconSizeClass} text-amber-800 dark:text-[#F5D58A]`} aria-hidden="true" />
          </div>
          <div>
            <span className="text-amber-800 dark:text-[#F5D58A]/80 font-bold text-xs block">البطاقة الرابعة</span>
            <h2 className={`${headingClass} text-amber-950 dark:text-[#F5D58A]`}>
              تنبيهات واحتياطات هامة
            </h2>
          </div>
        </div>

        {result.warnings && result.warnings.length > 0 ? (
          <ul className="space-y-3 pr-1">
            {result.warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-700 dark:bg-[#F5D58A] flex-shrink-0 mt-2.5" aria-hidden="true" />
                <span className={`${bodyClass} font-bold text-amber-950 dark:text-[#F5D58A]`}>{warning}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`${bodyClass} font-semibold text-amber-900 dark:text-[#F5D58A] pr-1`}>
            لا توجد تحذيرات استثنائية مسجلة على واجهة العلبة، يُرجى قراءة النشرة الداخلية دائماً.
          </p>
        )}
      </section>
    </div>
  );
};
