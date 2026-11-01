import React from 'react';
import { AlertCircle } from 'lucide-react';

export const DisclaimerBanner: React.FC = () => {
  return (
    <aside
      role="note"
      aria-label="تنبيه طبي هام"
      className="w-full bg-slate-100 border-2 border-slate-300 rounded-2xl p-4 sm:p-5 flex items-start gap-4 text-slate-800 shadow-sm mt-6 mb-8"
    >
      <div className="flex-shrink-0 mt-1">
        <AlertCircle className="w-8 h-8 text-teal-700" aria-hidden="true" />
      </div>
      <div className="text-right">
        <p className="font-bold text-senior-lg text-teal-800 mb-1">
          تنبيه طبي هام:
        </p>
        <p className="text-senior-base leading-relaxed text-slate-700">
          هذه المعلومات إرشادية لتسهيل القراءة ولا تغني بأي حال عن تعليمات طبيبك المعالج أو استشارة الصيدلي.
        </p>
      </div>
    </aside>
  );
};
