import React from 'react';
import { Pill, Sparkles } from 'lucide-react';

export interface SkeletonLoaderProps {
  type?: 'box' | 'prescription';
  count?: number;
  message?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type = 'box',
  count = 4,
  message,
}) => {
  const defaultMessage = type === 'prescription'
    ? 'جاري قراءة الروشتة بالذكاء الاصطناعي...'
    : 'جاري قراءة علبة الدواء بالذكاء الاصطناعي...';

  const cardCount = Math.max(1, count);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="جاري التحليل"
      dir="rtl"
      className="w-full space-y-4 my-4 animate-in fade-in duration-200"
    >
      {/* Reassuring status pill */}
      <div className="bg-teal-50/80 dark:bg-[#162124] border border-teal-200 dark:border-teal-800/60 rounded-2xl p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 dark:bg-[#3DB8C4] text-white dark:text-[#0E1517] flex items-center justify-center flex-shrink-0 animate-pulse motion-reduce:animate-none">
            <Pill className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-teal-900 dark:text-[#E6EEF0]">
              {message || defaultMessage}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#9FB3B8]">
              يرجى الانتظار قليلاً لاستخراج البيانات الطبية المبسطة
            </p>
          </div>
        </div>
        <Sparkles className="w-5 h-5 text-teal-600 dark:text-[#3DB8C4] animate-spin motion-reduce:animate-none" aria-hidden="true" />
      </div>

      {/* Pulsing Skeleton Cards matching final result card shapes */}
      <div className="space-y-4" data-testid="skeleton-cards-container">
        {Array.from({ length: cardCount }).map((_, idx) => (
          <div
            key={`skeleton_card_${idx}`}
            data-testid={`skeleton-card-${idx}`}
            className="w-full rounded-2xl bg-white dark:bg-[#162124] border border-gray-100 dark:border-gray-800 p-5 shadow-sm space-y-3 animate-pulse motion-reduce:animate-none"
          >
            {/* Header row skeleton: icon badge + title bar */}
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800/80 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse motion-reduce:animate-none flex-shrink-0" />
                <div className="space-y-1.5">
                  <div className="w-32 sm:w-44 h-5 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse motion-reduce:animate-none" />
                  <div className="w-20 sm:w-28 h-3.5 bg-slate-100 dark:bg-slate-800 rounded animate-pulse motion-reduce:animate-none" />
                </div>
              </div>
              {/* Optional chip skeleton */}
              <div className="w-16 h-6 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse motion-reduce:animate-none" />
            </div>

            {/* Staggered body line skeletons */}
            <div className="space-y-2 pt-1">
              <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse motion-reduce:animate-none" />
              <div className="w-4/5 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse motion-reduce:animate-none" />
              <div className="w-2/3 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
