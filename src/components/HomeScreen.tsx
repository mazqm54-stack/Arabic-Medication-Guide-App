import React, { useState } from 'react';
import { Pill, FileText, Image, AlertTriangle, Clock, X } from 'lucide-react';
import { MedicationHistoryItem } from '../types';
import { capturePhoto, pickPhoto } from '../services/nativeCamera';
import { RecentScansList } from './RecentScansList';

export interface HomeScreenProps {
  onImageSelected: (file: File) => void;
  onNavigateToPrescription: () => void;
  recentScans: MedicationHistoryItem[];
  onSelectRecentScan: (item: MedicationHistoryItem) => void;
  onClearHistory: () => void;
  disabled?: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onImageSelected,
  onNavigateToPrescription,
  recentScans,
  onSelectRecentScan,
  onClearHistory,
  disabled = false,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBoxCapture = async () => {
    if (disabled || isCapturing) return;
    setIsCapturing(true);
    setErrorMessage(null);
    try {
      const file = await capturePhoto();
      if (file) {
        onImageSelected(file);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'تعذر فتح الكاميرا حالياً. يمكنك تجربة اختيار صورة من الألبوم.';
      setErrorMessage(message);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleGalleryPick = async () => {
    if (disabled || isCapturing) return;
    setIsCapturing(true);
    setErrorMessage(null);
    try {
      const file = await pickPhoto();
      if (file) {
        onImageSelected(file);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'تعذر فتح ألبوم الصور حالياً.';
      setErrorMessage(message);
    } finally {
      setIsCapturing(false);
    }
  };

  const displayedScans = recentScans ? recentScans.slice(0, 5) : [];

  return (
    <div dir="rtl" className="w-full text-right space-y-5 animate-in fade-in duration-150 motion-reduce:transition-none">
      {/* Compact Senior Greeting (F37) */}
      <div className="text-right py-1">
        <h2 className="text-xl sm:text-2xl font-bold text-teal-900 dark:text-[#E6EEF0]">
          مرحباً بك في دليلي الدوائي
        </h2>
        {/* Hidden screen-reader text for backwards compatibility */}
        <span className="sr-only">أهلاً بكم في دليلي الدوائي</span>
        <p className="text-sm sm:text-base text-slate-600 dark:text-[#9FB3B8] mt-1 font-medium leading-relaxed">
          مساعدك الطبي الذكي لقراءة علب الأدوية والروشتات بالصوت والكتابة الواضحة.
        </p>
      </div>

      {/* Error alert for permissions or hardware issues */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-amber-50 dark:bg-[#3A2E12] border border-amber-300 dark:border-amber-600 text-amber-900 dark:text-[#F5D58A] rounded-2xl p-4 text-senior-base font-bold flex items-start justify-between gap-3 shadow-xs"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-[#F5D58A] flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-amber-800 dark:text-[#F5D58A] hover:text-amber-950 font-extrabold px-2 py-1 rounded-lg min-h-[48px] min-w-[48px] flex items-center justify-center"
            aria-label="إغلاق التنبيه"
          >
            <X className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* 2 Clean Action Cards (علبة دواء / روشتة) with Lucide Icons (Pill, FileText) (F37) */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5">
        {/* Card 1: علبة دواء */}
        <button
          type="button"
          disabled={disabled || isCapturing}
          onClick={handleBoxCapture}
          aria-label="صوّر علبة الدواء الآن"
          className="w-full min-h-[120px] bg-white dark:bg-[#162124] hover:bg-teal-50/50 dark:hover:bg-[#1D2B2F] active:scale-[0.98] disabled:opacity-60 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex items-center justify-between text-right shadow-sm hover:shadow-md transition-all duration-150 motion-reduce:transition-none group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-[#3DB8C4] border border-teal-100 dark:border-teal-800/40 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-150 motion-reduce:transition-none">
              <Pill className="w-7 h-7" strokeWidth={2} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-senior-xl font-extrabold text-teal-900 dark:text-[#E6EEF0]">
                صوّر علبة الدواء الآن
              </h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-[#9FB3B8] font-medium mt-1">
                التقط صورة لعلبة الدواء لمعرفة دواعي الاستعمال والتحذيرات
              </p>
            </div>
          </div>
        </button>

        {/* Card 2: روشتة */}
        <button
          type="button"
          disabled={disabled || isCapturing}
          onClick={onNavigateToPrescription}
          aria-label="صوّر روشتة"
          className="w-full min-h-[120px] bg-white dark:bg-[#162124] hover:bg-blue-50/50 dark:hover:bg-[#1D2B2F] active:scale-[0.98] disabled:opacity-60 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex items-center justify-between text-right shadow-sm hover:shadow-md transition-all duration-150 motion-reduce:transition-none group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800/40 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-150 motion-reduce:transition-none">
              <FileText className="w-7 h-7" strokeWidth={2} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-senior-xl font-extrabold text-blue-900 dark:text-[#E6EEF0]">
                صوّر روشتة
              </h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-[#9FB3B8] font-medium mt-1">
                قراءة الأدوية المكتوبة في الروشتة وتوضيح ما كتبه الطبيب
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Secondary Gallery Action */}
      <button
        type="button"
        disabled={disabled || isCapturing}
        onClick={handleGalleryPick}
        className="w-full min-h-[48px] bg-white dark:bg-[#162124] hover:bg-slate-50 dark:hover:bg-[#1D2B2F] active:scale-[0.98] disabled:opacity-60 text-slate-700 dark:text-[#E6EEF0] border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex items-center justify-center gap-2 text-sm font-bold shadow-xs transition-all duration-150 motion-reduce:transition-none"
        aria-label="اختيار صورة علبة دواء من الألبوم"
      >
        <Image className="w-5 h-5 text-slate-500 dark:text-[#9FB3B8]" strokeWidth={2} aria-hidden="true" />
        <span>أو اختر صورة من الألبوم</span>
      </button>

      {/* Compact Recent Scans List without large empty space (F37) */}
      {displayedScans.length > 0 ? (
        <RecentScansList
          scans={displayedScans}
          onSelectScan={onSelectRecentScan}
          onClearHistory={onClearHistory}
        />
      ) : (
        <div className="bg-white dark:bg-[#162124] border border-gray-100 dark:border-gray-800 rounded-2xl py-4 px-4 text-center text-slate-500 dark:text-[#9FB3B8] shadow-xs flex items-center justify-center gap-2.5">
          <Clock className="w-5 h-5 text-slate-400 dark:text-[#9FB3B8] flex-shrink-0" />
          <p className="text-sm font-medium">
            لا توجد أدوية مسجلة بعد. يمكنك تصوير علبة دواء للبدء.
          </p>
        </div>
      )}
    </div>
  );
};
