import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, AlertTriangle, ChevronLeft, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
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
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});

  const handleResetAction = onRetake || onReset || (() => {});

  const toggleItemExpanded = (idx: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setExpandedItems((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

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
    <div dir="rtl" className="w-full space-y-6 text-right animate-in fade-in duration-200 pb-36">
      {/* 1. Top Advisory Banner (F17 / F32) */}
      <div
        role="region"
        aria-label="تنبيه الروشتة"
        className="bg-teal-50 dark:bg-[#162124] border border-teal-200 dark:border-[#3DB8C4]/40 text-[#006D77] dark:text-[#3DB8C4] rounded-2xl p-4 flex items-center gap-3 shadow-xs"
      >
        <AlertTriangle className="w-6 h-6 text-[#006D77] dark:text-[#3DB8C4] flex-shrink-0" aria-hidden="true" />
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
        className={`w-full min-h-[48px] sm:min-h-[56px] rounded-2xl p-4 flex items-center justify-center gap-3 font-extrabold text-senior-lg shadow-sm transition-all duration-150 motion-reduce:transition-none ${
          isSpeaking
            ? 'bg-amber-600 hover:bg-amber-700 text-white'
            : 'bg-teal-700 hover:bg-teal-800 dark:bg-[#3DB8C4] dark:hover:bg-[#349fa8] text-white dark:text-[#0E1517] dark:font-black'
        }`}
        aria-label={isSpeaking ? 'إيقاف القراءة' : 'استمع للروشتة كاملة'}
      >
        {isSpeaking ? (
          <>
            <VolumeX className="w-6 h-6" aria-hidden="true" />
            <span>إيقاف القراءة</span>
          </>
        ) : (
          <>
            <Volume2 className="w-6 h-6" aria-hidden="true" />
            <span>استمع للروشتة كاملة</span>
          </>
        )}
      </button>

      {/* 3. Multi-Item Card List (F15, F16, F20, F33, F34) */}
      <div className="space-y-4" role="feed" aria-label="أدوية الروشتة">
        {result.items && result.items.map((item, idx) => {
          const isLow = item.confidence === 'low';
          const isExpanded = Boolean(expandedItems[idx]);

          if (isLow) {
            // Low-Confidence Amber Card (F16, F33, F34)
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
                className="bg-[#FEF3C7] dark:bg-[#3A2E12] border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-[#F5D58A] rounded-2xl p-5 shadow-sm space-y-3 transition-all duration-150 motion-reduce:transition-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-200 dark:bg-amber-950/80 text-[#D97706] dark:text-[#F5D58A] flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-6 h-6 text-[#D97706] dark:text-[#F5D58A]" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className={`${headingClass} text-amber-950 dark:text-[#F5D58A] font-black`}>
                        {LOW_CONFIDENCE_AMBER_TEXT}
                      </h3>
                      {/* Muted "as written" text */}
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                        النص كما كُتب بالروشتة: {lineText}
                      </p>
                    </div>
                  </div>
                  {/* Low confidence badge */}
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-[#F5D58A] border border-amber-400 dark:border-amber-600">
                    غير واضح
                  </span>
                </div>

                <div className="bg-amber-200/60 dark:bg-amber-900/40 p-3 rounded-xl border border-amber-300 dark:border-amber-700/60">
                  <span className="text-xs font-bold text-amber-800 dark:text-[#F5D58A]/80 block mb-0.5">
                    ما استطاع المعالج قراءته من الخط:
                  </span>
                  <p className="text-base font-mono font-bold text-amber-950 dark:text-[#F5D58A]" dir="ltr">
                    {lineText}
                  </p>
                </div>
              </div>
            );
          }

          // Legible Prescription Card with Modern Visual Styling (F33, F34)
          return (
            <div
              key={`rx_item_${idx}`}
              role="article"
              className="w-full text-right bg-white dark:bg-[#162124] border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-150 motion-reduce:transition-none flex flex-col gap-3 group max-w-full"
            >
              {/* Top row: Prominent Medicine Name, Confidence Chip & Expand Chevron */}
              <div className="flex items-start justify-between gap-3 w-full border-b border-gray-100 dark:border-gray-800/80 pb-3">
                <div className="flex-1">
                  <h3 className={`${headingClass} text-slate-900 dark:text-[#E6EEF0] leading-tight font-extrabold`}>
                    {item.medicine_name_ar || item.medicine_name_en}
                  </h3>
                  {item.medicine_name_en && (
                    <p className="text-sm font-mono font-bold text-slate-500 dark:text-[#9FB3B8] mt-0.5" dir="ltr">
                      {item.medicine_name_en}
                    </p>
                  )}
                  {/* Muted "as written" text (F34) */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">
                    النص كما كُتب: {item.line_text_as_written || item.written_instructions || 'بدون نص إضافي'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Confidence chip: color-coded badge */}
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      item.confidence === 'high'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {item.confidence === 'high' ? 'واضح' : 'غير مؤكد'}
                  </span>

                  {/* Expandable Chevron Toggle Button (F34) */}
                  <button
                    type="button"
                    onClick={(e) => toggleItemExpanded(idx, e)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'إخفاء تفاصيل الدواء' : 'عرض تفاصيل الدواء'}
                    className="min-h-[48px] min-w-[48px] rounded-xl text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-[#3DB8C4] hover:bg-slate-50 dark:hover:bg-[#1D2B2F] active:scale-95 transition-all flex items-center justify-center"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-teal-600 dark:text-[#3DB8C4]" strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" strokeWidth={2} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {/* Purpose / Short explanation */}
              {item.short_explanation && (
                <p className={`${bodyClass} font-semibold text-slate-700 dark:text-[#E6EEF0]`}>
                  {item.short_explanation}
                </p>
              )}

              {/* ما كتبه الطبيب */}
              <div className="bg-teal-50/70 dark:bg-[#1D2B2F] p-3.5 rounded-xl border border-teal-100 dark:border-teal-800/50 w-full text-right">
                <span className="text-xs font-bold text-teal-800 dark:text-[#3DB8C4] block mb-1">
                  ما كتبه الطبيب:
                </span>
                <p className="text-senior-base font-extrabold text-teal-950 dark:text-[#E6EEF0] whitespace-pre-wrap">
                  {item.written_instructions || 'بدون تعليمات إضافية'}
                </p>
              </div>

              {/* Expandable details content when chevron is clicked */}
              {isExpanded && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2 text-sm text-slate-600 dark:text-slate-300 animate-in fade-in duration-150 motion-reduce:transition-none">
                  {item.active_ingredient && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-[#E6EEF0]">المادة الفعالة:</span>
                      <span>{item.active_ingredient}</span>
                    </div>
                  )}
                  {item.written_instructions && (
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-slate-800 dark:text-[#E6EEF0] flex-shrink-0">الجرعة والتعليمات:</span>
                      <span>{item.written_instructions}</span>
                    </div>
                  )}
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-[#3A2E12]/40 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-[#F5D58A]">
                    تنبيه: التعليمات إرشادية وتأكد دائماً من الصيدلي قبل تناول أي جرعة.
                  </div>
                </div>
              )}

              {/* Tap button to open full details modal (F15) */}
              <button
                type="button"
                onClick={() => onSelectMedicine(item)}
                aria-label={`دواء ${item.medicine_name_ar || item.medicine_name_en}، اضغط لعرض التفاصيل`}
                className="w-full min-h-[48px] px-3 py-2 rounded-xl text-teal-700 dark:text-[#3DB8C4] hover:bg-teal-50/60 dark:hover:bg-[#1D2B2F] active:scale-[0.99] text-sm font-extrabold flex items-center justify-between transition-colors pt-1"
              >
                <span>عرض التفاصيل والدواعي والتحذيرات</span>
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </button>
            </div>
          );
        })}
      </div>

      {/* 4. Medical Disclaimer Banner (F08) */}
      <DisclaimerBanner />

      {/* 5. Sticky Retake Action Button (F29) */}
      <div className="sticky bottom-20 z-20 py-2 bg-gradient-to-t from-[#F8F9FA] dark:from-[#0E1517] via-[#F8F9FA]/80 dark:via-[#0E1517]/80 to-transparent">
        <button
          type="button"
          onClick={handleResetAction}
          className="w-full min-h-[48px] py-2.5 px-4 rounded-xl border border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300 bg-white dark:bg-[#162124] hover:bg-teal-50 dark:hover:bg-teal-900/30 font-bold text-sm sm:text-base shadow-sm transition-all duration-150 motion-reduce:transition-none flex items-center justify-center gap-2 active:scale-[0.98]"
          aria-label="تصوير روشتة أخرى"
        >
          <RotateCcw className="w-5 h-5" strokeWidth={2} />
          <span>تصوير روشتة أخرى</span>
        </button>
      </div>
    </div>
  );
};
