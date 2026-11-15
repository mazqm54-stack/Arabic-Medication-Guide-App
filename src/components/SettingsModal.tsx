import React, { useEffect, useRef } from 'react';
import { Sun, Moon, Monitor, Type, X, Check, Settings } from 'lucide-react';
import { ThemePreference, FontSizePreference } from '../types';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  currentFontSize: FontSizePreference;
  onFontSizeChange: (size: FontSizePreference) => void;
  mockWidth?: number | null;
}

export const THEME_OPTIONS: Array<{
  key: ThemePreference;
  title: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    key: 'system',
    title: 'تلقائي',
    description: 'يتبع إعدادات الجهاز تلقائياً',
    icon: Monitor,
  },
  {
    key: 'light',
    title: 'فاتح',
    description: 'مظهر نهاري ساطع ومريح',
    icon: Sun,
  },
  {
    key: 'dark',
    title: 'داكن',
    description: 'مظهر ليلي مريح للعينين عالي التباين',
    icon: Moon,
  },
];

export const FONT_SIZE_OPTIONS: Array<{
  key: FontSizePreference;
  title: string;
  sizeLabel: string;
  description: string;
}> = [
  {
    key: 'normal',
    title: 'عادي',
    sizeLabel: '16 بكسل',
    description: 'الحجم القياسي المتوازن',
  },
  {
    key: 'large',
    title: 'كبير',
    sizeLabel: '19 بكسل',
    description: 'تكبير مريح ومناسب للقراءة',
  },
  {
    key: 'extra-large',
    title: 'كبير جداً',
    sizeLabel: '23 بكسل',
    description: 'أقصى درجات الوضوح والتكبير لكبار السن',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onThemeChange,
  currentFontSize,
  onFontSizeChange,
  mockWidth,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      style={mockWidth ? { width: `${mockWidth}px`, maxWidth: `${mockWidth}px`, left: 0, right: 'auto' } : undefined}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        dir="rtl"
        className="w-full max-w-lg bg-white dark:bg-[#162124] text-[#1D3557] dark:text-[#E6EEF0] rounded-3xl shadow-2xl border-2 border-teal-600 dark:border-[#1D2B2F] flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="bg-white dark:bg-[#162124] border-b-2 border-slate-200 dark:border-[#1D2B2F] p-4 sm:p-5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 dark:bg-[#3DB8C4] text-white dark:text-[#0E1517] flex items-center justify-center shadow-xs">
              <Settings className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="settings-modal-title"
                className="text-senior-xl font-black text-teal-900 dark:text-[#E6EEF0] leading-tight"
              >
                إعدادات التطبيق
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-[#9FB3B8]">
                تخصيص مظهر التطبيق وحجم الخط لراحتكم
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] min-w-[48px] rounded-2xl bg-slate-100 dark:bg-[#1D2B2F] hover:bg-slate-200 dark:hover:bg-[#25373C] active:scale-95 text-slate-700 dark:text-[#E6EEF0] flex items-center justify-center transition-all border border-slate-200 dark:border-slate-700"
            aria-label="إغلاق الإعدادات"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Section 1: المظهر والسمة (Theme) */}
          <section
            aria-labelledby="theme-section-title"
            className="space-y-3"
          >
            <div className="flex items-center gap-2 text-teal-800 dark:text-[#3DB8C4] border-b pb-2 border-slate-100 dark:border-[#1D2B2F]">
              <Sun className="w-5 h-5 text-teal-600 dark:text-[#3DB8C4]" aria-hidden="true" />
              <h3
                id="theme-section-title"
                className="text-senior-lg font-black"
              >
                المظهر والألوان
              </h3>
            </div>

            <div
              role="radiogroup"
              aria-labelledby="theme-section-title"
              className="grid grid-cols-1 gap-3"
            >
              {THEME_OPTIONS.map((opt) => {
                const isSelected = currentTheme === opt.key;
                const IconComponent = opt.icon;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onThemeChange(opt.key)}
                    className={`min-h-[56px] w-full p-4 rounded-2xl border-2 text-right flex items-center justify-between gap-3 transition-all ${
                      isSelected
                        ? 'bg-teal-50/80 dark:bg-[#1D2B2F] border-teal-600 dark:border-[#3DB8C4] shadow-sm ring-2 ring-teal-500/20'
                        : 'bg-white dark:bg-[#162124] border-slate-200 dark:border-[#1D2B2F] hover:bg-slate-50 dark:hover:bg-[#1D2B2F]/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isSelected
                            ? 'bg-teal-600 dark:bg-[#3DB8C4] text-white dark:text-[#0E1517]'
                            : 'bg-slate-100 dark:bg-[#1D2B2F] text-slate-600 dark:text-[#9FB3B8]'
                        }`}
                      >
                        <IconComponent className="w-6 h-6" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="text-senior-base font-extrabold text-[#1D3557] dark:text-[#E6EEF0]">
                          {opt.title}
                        </div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-[#9FB3B8]">
                          {opt.description}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? 'border-teal-600 dark:border-[#3DB8C4] bg-teal-600 dark:bg-[#3DB8C4] text-white dark:text-[#0E1517]'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 2: حجم الخط (Font Size) */}
          <section
            aria-labelledby="font-size-section-title"
            className="space-y-3"
          >
            <div className="flex items-center gap-2 text-teal-800 dark:text-[#3DB8C4] border-b pb-2 border-slate-100 dark:border-[#1D2B2F]">
              <Type className="w-5 h-5 text-teal-600 dark:text-[#3DB8C4]" aria-hidden="true" />
              <h3
                id="font-size-section-title"
                className="text-senior-lg font-black"
              >
                حجم الخط
              </h3>
            </div>

            <div
              role="radiogroup"
              aria-labelledby="font-size-section-title"
              className="grid grid-cols-1 gap-3"
            >
              {FONT_SIZE_OPTIONS.map((opt) => {
                const isSelected = currentFontSize === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onFontSizeChange(opt.key)}
                    className={`min-h-[56px] w-full p-4 rounded-2xl border-2 text-right flex items-center justify-between gap-3 transition-all ${
                      isSelected
                        ? 'bg-teal-50/80 dark:bg-[#1D2B2F] border-teal-600 dark:border-[#3DB8C4] shadow-sm ring-2 ring-teal-500/20'
                        : 'bg-white dark:bg-[#162124] border-slate-200 dark:border-[#1D2B2F] hover:bg-slate-50 dark:hover:bg-[#1D2B2F]/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                          isSelected
                            ? 'bg-teal-600 dark:bg-[#3DB8C4] text-white dark:text-[#0E1517]'
                            : 'bg-slate-100 dark:bg-[#1D2B2F] text-slate-600 dark:text-[#9FB3B8]'
                        }`}
                      >
                        Aa
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-senior-base font-extrabold text-[#1D3557] dark:text-[#E6EEF0]">
                            {opt.title}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1D2B2F] text-slate-600 dark:text-[#9FB3B8] font-bold">
                            {opt.sizeLabel}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-[#9FB3B8]">
                          {opt.description}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? 'border-teal-600 dark:border-[#3DB8C4] bg-teal-600 dark:bg-[#3DB8C4] text-white dark:text-[#0E1517]'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t-2 border-slate-200 dark:border-[#1D2B2F] bg-white dark:bg-[#162124]">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[56px] rounded-2xl bg-teal-600 hover:bg-teal-700 dark:bg-[#3DB8C4] dark:hover:bg-[#349fa8] text-white dark:text-[#0E1517] font-black text-senior-lg flex items-center justify-center gap-2 shadow-md active:scale-[0.99] transition-all"
            aria-label="حفظ وإغلاق نافذة الإعدادات"
          >
            <Check className="w-6 h-6 stroke-[3]" aria-hidden="true" />
            <span>تم وحفظ الإعدادات</span>
          </button>
        </div>
      </div>
    </div>
  );
};
