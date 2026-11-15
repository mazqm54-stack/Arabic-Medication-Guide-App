import React from 'react';
import { Type } from 'lucide-react';
import { FontSizePreference } from '../types';

interface FontSizeToggleProps {
  currentSize: FontSizePreference;
  onToggle: (newSize: FontSizePreference) => void;
}

export const FontSizeToggle: React.FC<FontSizeToggleProps> = ({ currentSize, onToggle }) => {
  const handleToggle = () => {
    if (currentSize === 'normal') {
      onToggle('large');
    } else if (currentSize === 'large') {
      onToggle('extra-large');
    } else {
      onToggle('normal');
    }
  };

  const getLabel = () => {
    if (currentSize === 'extra-large') return 'خط كبير جداً (مفعّل)';
    if (currentSize === 'large') return 'خط كبير (مفعّل)';
    return 'خط عادي (مفعّل)';
  };

  const currentText = currentSize === 'extra-large' ? 'كبير جداً' : currentSize === 'large' ? 'كبير' : 'عادي';

  return (
    <div className="flex items-center justify-between bg-white dark:bg-[#162124] border-2 border-slate-300 dark:border-[#1D2B2F] rounded-2xl p-2.5 sm:p-3 shadow-sm mb-4">
      <div className="flex items-center gap-2 text-slate-800 dark:text-[#E6EEF0] pr-2">
        <Type className="w-6 h-6 text-teal-700 dark:text-[#3DB8C4]" aria-hidden="true" />
        <span className="font-bold text-senior-base">حجم الخط:</span>
      </div>

      <button
        type="button"
        onClick={handleToggle}
        className={`min-h-[48px] sm:min-h-[56px] px-4 sm:px-6 rounded-xl font-bold flex items-center justify-center gap-2 border-2 transition-all ${
          currentSize !== 'normal'
            ? 'bg-teal-700 hover:bg-teal-800 dark:bg-[#3DB8C4] dark:hover:bg-[#349fa8] text-white dark:text-[#0E1517] dark:font-extrabold border-teal-800 dark:border-[#3DB8C4] shadow-md ring-2 ring-teal-300 dark:ring-teal-700'
            : 'bg-teal-50 dark:bg-[#1D2B2F] text-teal-900 dark:text-[#3DB8C4] border-teal-600 dark:border-[#3DB8C4]/60 hover:bg-teal-100 dark:hover:bg-[#25373C]'
        }`}
        aria-label={`تغيير حجم الخط، الحجم الحالي ${currentText}`}
      >
        <span className="text-senior-lg">
          {getLabel()}
        </span>
      </button>
    </div>
  );
};
