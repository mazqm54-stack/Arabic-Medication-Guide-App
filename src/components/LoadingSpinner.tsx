import React from 'react';
import { Loader2, HeartPulse } from 'lucide-react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-white dark:bg-[#162124] border-2 border-teal-500 dark:border-[#3DB8C4] rounded-3xl p-8 sm:p-12 shadow-senior flex flex-col items-center justify-center text-center my-8"
    >
      <div className="relative mb-6">
        <Loader2 className="w-20 h-20 text-teal-600 dark:text-[#3DB8C4] animate-spin" aria-hidden="true" />
        <div className="absolute inset-0 flex items-center justify-center">
          <HeartPulse className="w-8 h-8 text-teal-700 dark:text-[#3DB8C4] animate-pulse" aria-hidden="true" />
        </div>
      </div>

      <h2 className="text-senior-2xl font-bold text-teal-800 dark:text-[#E6EEF0] mb-3">
        جاري قراءة علبة الدواء...
      </h2>
      <p className="text-senior-lg text-slate-700 dark:text-[#9FB3B8] max-w-md leading-relaxed">
        يرجى الانتظار قليلاً، نقوم الآن بتحليل الصورة واستخراج التعليمات الطبية المبسطة لراحتكم.
      </p>

      <div className="mt-6 flex items-center gap-2 text-slate-500 dark:text-[#9FB3B8] text-senior-base">
        <span className="w-3 h-3 bg-teal-500 dark:bg-[#3DB8C4] rounded-full animate-ping" />
        <span>الفحص الذكي قيد العمل...</span>
      </div>
    </div>
  );
};
