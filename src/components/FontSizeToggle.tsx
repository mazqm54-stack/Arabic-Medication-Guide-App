import React from 'react';
import { Type } from 'lucide-react';
import { FontSizePreference } from '../types';

interface FontSizeToggleProps {
  currentSize: FontSizePreference;
  onToggle: (newSize: FontSizePreference) => void;
}

export const FontSizeToggle: React.FC<FontSizeToggleProps> = ({ currentSize, onToggle }) => {
  const isExtraLarge = currentSize === 'extra-large';

  const handleToggle = () => {
    onToggle(isExtraLarge ? 'large' : 'extra-large');
  };

  return (
    <div className="flex items-center justify-between bg-white border-2 border-slate-300 rounded-2xl p-2.5 sm:p-3 shadow-sm mb-4">
      <div className="flex items-center gap-2 text-slate-800 pr-2">
        <Type className="w-6 h-6 text-teal-700" aria-hidden="true" />
        <span className="font-bold text-senior-base">حجم الخط:</span>
      </div>

      <button
        type="button"
        onClick={handleToggle}
        className={`min-h-[56px] sm:min-h-[64px] px-4 sm:px-6 rounded-xl font-bold flex items-center justify-center gap-2 border-2 transition-all ${
          isExtraLarge
            ? 'bg-teal-700 text-white border-teal-800 shadow-md ring-2 ring-teal-300'
            : 'bg-teal-50 text-teal-900 border-teal-600 hover:bg-teal-100'
        }`}
        aria-label={`تغيير حجم الخط، الحجم الحالي ${isExtraLarge ? 'كبير جداً' : 'كبير'}`}
      >
        <span className="text-senior-lg">
          {isExtraLarge ? '🔍 خط كبير جداً (مفعّل)' : '🔍 تكبير الخط أكثر'}
        </span>
      </button>
    </div>
  );
};
