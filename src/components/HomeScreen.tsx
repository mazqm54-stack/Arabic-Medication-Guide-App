import React, { useState } from 'react';
import { Camera, FileText, Image, AlertTriangle, Clock } from 'lucide-react';
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
    <div dir="rtl" className="w-full text-right space-y-6">
      {/* Friendly Senior Greeting */}
      <div className="bg-teal-50 dark:bg-[#162124] border-2 border-teal-500 dark:border-[#3DB8C4] rounded-3xl p-6 shadow-xs">
        <h2 className="text-senior-xl font-bold text-teal-900 dark:text-[#E6EEF0] mb-2">
          أهلاً بكم في دليلي الدوائي
        </h2>
        <p className="text-senior-base text-slate-800 dark:text-[#9FB3B8] leading-relaxed font-medium">
          مساعدك الطبي الذكي لقراءة علب الأدوية والروشتات بالصوت والكتابة الواضحة. اختر ما تريد تصويره للبدء فوراً.
        </p>
      </div>

      {/* Error alert for permissions or hardware issues */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-amber-50 dark:bg-[#3A2E12] border-2 border-amber-300 dark:border-amber-600 text-amber-900 dark:text-[#F5D58A] rounded-2xl p-4 text-senior-base font-bold flex items-start justify-between gap-3 shadow-xs"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-[#F5D58A] flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-amber-800 dark:text-[#F5D58A] hover:text-amber-950 font-extrabold px-2 py-1 rounded-lg"
            aria-label="إغلاق التنبيه"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2 Big Action Cards (F07) */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        {/* Card 1: صوّر علبة دواء */}
        <button
          type="button"
          disabled={disabled || isCapturing}
          onClick={handleBoxCapture}
          aria-label="صوّر علبة الدواء الآن"
          className="w-full min-h-[120px] bg-white dark:bg-[#162124] hover:bg-teal-50/60 dark:hover:bg-[#1D2B2F] active:scale-[0.98] disabled:opacity-60 border-2 border-teal-600 dark:border-[#3DB8C4] rounded-3xl p-6 flex items-center justify-between text-right shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-teal-600 dark:bg-[#3DB8C4] text-white dark:text-[#0E1517] flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Camera className="w-9 h-9" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-senior-xl font-extrabold text-teal-900 dark:text-[#E6EEF0]">
                صوّر علبة الدواء الآن
              </h3>
              <p className="text-senior-base text-slate-700 dark:text-[#9FB3B8] font-medium mt-1">
                التقط صورة لعلبة الدواء لمعرفة دواعي الاستعمال والتحذيرات
              </p>
            </div>
          </div>
        </button>

        {/* Card 2: صوّر روشتة */}
        <button
          type="button"
          disabled={disabled || isCapturing}
          onClick={onNavigateToPrescription}
          aria-label="صوّر روشتة"
          className="w-full min-h-[120px] bg-white dark:bg-[#162124] hover:bg-blue-50/60 dark:hover:bg-[#1D2B2F] active:scale-[0.98] disabled:opacity-60 border-2 border-blue-600 dark:border-blue-400 rounded-3xl p-6 flex items-center justify-between text-right shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 dark:bg-blue-500 text-white dark:text-[#0E1517] flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <FileText className="w-9 h-9" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-senior-xl font-extrabold text-blue-900 dark:text-[#E6EEF0]">
                صوّر روشتة
              </h3>
              <p className="text-senior-base text-slate-700 dark:text-[#9FB3B8] font-medium mt-1">
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
        className="w-full min-h-[64px] bg-white dark:bg-[#162124] hover:bg-slate-50 dark:hover:bg-[#1D2B2F] active:scale-[0.98] disabled:opacity-60 text-slate-800 dark:text-[#E6EEF0] border-2 border-slate-300 dark:border-[#1D2B2F] rounded-2xl p-4 flex items-center justify-center gap-3 text-senior-base font-bold shadow-xs transition-all"
        aria-label="اختيار صورة علبة دواء من الألبوم"
      >
        <Image className="w-6 h-6 text-slate-600 dark:text-[#9FB3B8]" aria-hidden="true" />
        <span>📁 أو اختر صورة من الألبوم</span>
      </button>

      {/* Uncluttered Recent Scans List (Clamped to 5) */}
      {displayedScans.length > 0 ? (
        <RecentScansList
          scans={displayedScans}
          onSelectScan={onSelectRecentScan}
          onClearHistory={onClearHistory}
        />
      ) : (
        <div className="bg-white dark:bg-[#162124] border-2 border-slate-200 dark:border-[#1D2B2F] rounded-3xl p-6 text-center text-slate-600 dark:text-[#9FB3B8]">
          <Clock className="w-8 h-8 text-slate-400 dark:text-[#9FB3B8] mx-auto mb-2" />
          <p className="text-senior-base font-medium">
            لا توجد أدوية مسجلة بعد. يمكنك تصوير علبة دواء للبدء.
          </p>
        </div>
      )}
    </div>
  );
};
