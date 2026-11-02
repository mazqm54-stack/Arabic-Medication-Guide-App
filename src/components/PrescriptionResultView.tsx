import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, AlertTriangle, ChevronLeft, RotateCcw } from 'lucide-react';
import { PrescriptionAnalysisResult, PrescriptionItem, FontSizePreference } from '../types';
import { speechController } from '../services/speechController';
import { DisclaimerBanner } from './DisclaimerBanner';
import { FontSizeToggle } from './FontSizeToggle';

export const PRESCRIPTION_ADVISORY_BANNER = 'راجع أسماء الأدوية قبل الاعتماد';
export const LOW_CONFIDENCE_AMBER_TEXT = 'غير واضح، اسأل الصيدلي';

export interface PrescriptionResultViewProps {
  result: PrescriptionAnalysisResult;
  fontSize: FontSizePreference;
  onRetake: () => void;
  onSelectMedicine: (item: PrescriptionItem) => void;
  onFontSizeChange?: (size: FontSizePreference) => void;
  onReset?: () => void;
}

export const PrescriptionResultView: React.FC<PrescriptionResultViewProps> = ({
  result,
  fontSize,
  onRetake,
  onSelectMedicine,
  onFontSizeChange,
  onReset,
}) => {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const handleResetAction = onRetake || onReset || (() => {});

  useEffect(() => {
    const unsubscribe = speechController.subscribe((state) => {
      setIsSpeaking(state.status === 'speaking');
    });
    return () => {
      unsubscribe();
      speechController.stop();
    };
  }, []);

  const handleToggleSpeech = () => {
    if (isSpeaking) {
      speechController.stop();
    } else {
      const summaryText =
        (result.audio_summary && result.audio_summary.trim().length > 0)
          ? result.audio_summary
          : (result.items && result.items.length > 0
              ? `الروشتة تحتوي على: ${result.items
                  .filter((i) => i.confidence !== 'low')
                  .map((i) => i.medicine_name_ar || i.medicine_name_en)
                  .join('، ')}`
              : 'لا توجد أدوية واضحة للقراءة');
      speechController.speak(summaryText);
    }
  };

  const isExtraLarge = fontSize === 'extra-large';
  const headingClass = isExtraLarge ? 'text-senior-2xl font-black' : 'text-senior-xl font-black';
  const bodyClass = isExtraLarge ? 'text-senior-lg leading-loose' : 'text-senior-base leading-relaxed';

  return (
    <div dir="rtl" className="w-full space-y-6 text-right animate-in fade-in duration-200">
      {/* 1. Top Advisory Banner (F17) */}
      <div
        role="region"
        aria-label="تنبيه الروشتة"
        className="bg-teal-50 dark:bg-[#162124] border-2 border-teal-200 dark:border-[#3DB8C4]/40 text-[#006D77] dark:text-[#3DB8C4] rounded-2xl p-4 flex items-center gap-3 shadow-xs"
      >
        <AlertTriangle className="w-7 h-7 text-[#006D77] dark:text-[#3DB8C4] flex-shrink-0" aria-hidden="true" />
        <p className="text-senior-base font-extrabold leading-normal">
          {PRESCRIPTION_ADVISORY_BANNER}
        </p>
      </div>

      {/* Font Size Toggle (if onFontSizeChange is provided) */}
      {onFontSizeChange && (
        <FontSizeToggle currentSize={fontSize} onToggle={onFontSizeChange} />
      )}

      {/* 2. Read-Aloud Toolbar / Button (F17) */}
      <button
        type="button"
        onClick={handleToggleSpeech}
        className={`w-full min-h-[64px] rounded-2xl p-4 flex items-center justify-center gap-3 font-extrabold text-senior-lg shadow-sm transition-all ${
          isSpeaking
            ? 'bg-amber-600 hover:bg-amber-700 text-white'
            : 'bg-teal-700 hover:bg-teal-800 dark:bg-[#3DB8C4] dark:hover:bg-[#349fa8] text-white dark:text-[#0E1517] dark:font-black'
        }`}
        aria-label={isSpeaking ? 'إيقاف القراءة' : 'استمع للروشتة كاملة'}
      >
        {isSpeaking ? (
          <>
            <VolumeX className="w-7 h-7" aria-hidden="true" />
            <span>إيقاف القراءة</span>
          </>
        ) : (
          <>
            <Volume2 className="w-7 h-7" aria-hidden="true" />
            <span>استمع للروشتة كاملة</span>
          </>
        )}
      </button>

      {/* 3. Multi-Item Card List (F15, F16, F20) */}
      <div className="space-y-4" role="feed" aria-label="أدوية الروشتة">
        {result.items && result.items.map((item, idx) => {
          const isLow = item.confidence === 'low';

          if (isLow) {
            // Low-Confidence Amber Card (F16)
            const lineText = (item.line_text_as_written && item.line_text_as_written.trim().length > 0)
              ? item.line_text_as_written
              : (item.written_instructions && item.written_instructions.trim().length > 0
                  ? item.written_instructions
                  : 'خط غير مقروء');

            return (
              <div
                key={`rx_item_${idx}`}
                role="article"
                aria-label="دواء غير واضح"
                className="bg-[#FEF3C7] dark:bg-[#3A2E12] border-2 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-[#F5D58A] rounded-2xl p-6 shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-200 dark:bg-amber-950/80 text-[#D97706] dark:text-[#F5D58A] flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-7 h-7 text-[#D97706] dark:text-[#F5D58A]" aria-hidden="true" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className={`${headingClass} text-amber-950 dark:text-[#F5D58A] font-black`}>
                      {LOW_CONFIDENCE_AMBER_TEXT}
                    </h3>
                    <div className="bg-amber-200/60 dark:bg-amber-900/40 p-3 rounded-xl border border-amber-300 dark:border-amber-700/60">
                      <span className="text-xs font-bold text-amber-800 dark:text-[#F5D58A]/80 block mb-0.5">
                        ما استطاع المعالج قراءته من الخط:
                      </span>
                      <p className="text-base font-mono font-bold text-amber-950 dark:text-[#F5D58A]" dir="ltr">
                        {lineText}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // Legible Prescription Card (F15, F20)
          return (
            <button
              key={`rx_item_${idx}`}
              type="button"
              onClick={() => onSelectMedicine(item)}
              aria-label={`دواء ${item.medicine_name_ar || item.medicine_name_en}، اضغط لعرض التفاصيل`}
              className="w-full text-right bg-white dark:bg-[#162124] hover:bg-teal-50/40 dark:hover:bg-[#1D2B2F] active:scale-[0.99] border-2 border-teal-600 dark:border-[#3DB8C4] rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 group max-w-full"
            >
              {/* Top row: Name & Badge */}
              <div className="flex items-start justify-between gap-3 w-full border-b border-teal-100 dark:border-[#1D2B2F] pb-3">
                <div>
                  <h3 className={`${headingClass} text-teal-900 dark:text-[#E6EEF0] leading-tight font-extrabold`}>
                    {item.medicine_name_ar || item.medicine_name_en}
                  </h3>
                  {item.medicine_name_en && (
                    <p className="text-sm font-mono font-bold text-slate-500 dark:text-[#9FB3B8] mt-0.5" dir="ltr">
                      {item.medicine_name_en}
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                    item.confidence === 'high'
                      ? 'bg-emerald-100 dark:bg-[#064E3B] text-emerald-800 dark:text-[#6EE7B7] border border-emerald-300 dark:border-emerald-700'
                      : 'bg-amber-100 dark:bg-[#451A03] text-amber-800 dark:text-[#FCD34D] border border-amber-300 dark:border-amber-700'
                  }`}
                >
                  {item.confidence === 'high' ? 'واضح' : 'غير مؤكد'}
                </span>
              </div>

              {/* Purpose */}
              {item.short_explanation && (
                <p className={`${bodyClass} font-semibold text-slate-700 dark:text-[#E6EEF0]`}>
                  {item.short_explanation}
                </p>
              )}

              {/* ما كتبه الطبيب */}
              <div className="bg-teal-50/80 dark:bg-[#1D2B2F] p-3.5 rounded-2xl border border-teal-200 dark:border-teal-800/60 w-full text-right">
                <span className="text-xs font-bold text-teal-800 dark:text-[#3DB8C4] block mb-1">
                  ما كتبه الطبيب:
                </span>
                <p className="text-senior-base font-extrabold text-teal-950 dark:text-[#E6EEF0] whitespace-pre-wrap">
                  {item.written_instructions || 'بدون تعليمات إضافية'}
                </p>
              </div>

              {/* Tap Prompt */}
              <div className="flex items-center justify-between text-teal-700 dark:text-[#3DB8C4] text-sm font-extrabold pt-1">
                <span>عرض التفاصيل والدواعي والتحذيرات</span>
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. Medical Disclaimer Banner (F08) */}
      <DisclaimerBanner />

      {/* 5. Sticky Retake Action Button */}
      <div className="sticky bottom-20 z-20 pt-2 pb-4 bg-gradient-to-t from-[#F8F9FA] dark:from-[#0E1517] via-[#F8F9FA]/90 dark:via-[#0E1517]/90 to-transparent">
        <button
          type="button"
          onClick={handleResetAction}
          className="btn-primary w-full min-h-[64px] sm:min-h-[72px] flex items-center justify-center gap-3 text-senior-xl font-extrabold shadow-xl bg-teal-700 hover:bg-teal-800 dark:bg-[#3DB8C4] dark:hover:bg-[#349fa8] text-white dark:text-[#0E1517]"
          aria-label="تصوير روشتة أخرى"
        >
          <RotateCcw className="w-7 h-7" />
          <span>🔄 تصوير روشتة أخرى</span>
        </button>
      </div>
    </div>
  );
};
