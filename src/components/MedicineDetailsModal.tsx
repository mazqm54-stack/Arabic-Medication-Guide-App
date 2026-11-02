import React, { useEffect, useState } from 'react';
import { Pill, Plus, Check, AlertTriangle } from 'lucide-react';
import { PrescriptionItem, MedicineAnalysisResult, FontSizePreference } from '../types';
import { fetchMedicineDetails } from '../services/geminiVision';
import { saveMyMedicine, getMyMedicines } from '../services/myMedicinesStorage';
import { LoadingSpinner } from './LoadingSpinner';
import { ResultCards } from './ResultCards';
import { DisclaimerBanner } from './DisclaimerBanner';

export interface MedicineDetailsModalProps {
  item?: PrescriptionItem | null;
  medicineName?: string | null;
  isOpen?: boolean;
  onClose: () => void;
  fontSize: FontSizePreference;
  onAddedToMedicines?: () => void;
}

export const MedicineDetailsModal: React.FC<MedicineDetailsModalProps> = ({
  item,
  medicineName,
  isOpen,
  onClose,
  fontSize,
  onAddedToMedicines,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [details, setDetails] = useState<MedicineAnalysisResult | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // If isOpen is explicitly passed, use it; otherwise infer from presence of item or medicineName
  const modalOpen = isOpen !== undefined ? isOpen : Boolean(item || medicineName);
  const resolvedName = medicineName || (item ? (item.medicine_name_en || item.medicine_name_ar) : null);
  const arabicDisplayName = item?.medicine_name_ar || details?.medicine_name_ar || resolvedName || '';
  const englishDisplayName = item?.medicine_name_en || details?.medicine_name_en || '';

  useEffect(() => {
    if (!modalOpen || !resolvedName) {
      setDetails(null);
      setError(null);
      setIsSaved(false);
      return;
    }

    // Check if already saved in "أدويتي"
    const savedList = getMyMedicines();
    const alreadySaved = savedList.some(
      (m) =>
        (item?.medicine_name_ar && m.name_ar === item.medicine_name_ar) ||
        (item?.medicine_name_en && m.name_en === item.medicine_name_en) ||
        (resolvedName && (m.name === resolvedName || m.name_ar === resolvedName || m.name_en === resolvedName))
    );
    setIsSaved(alreadySaved);

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchMedicineDetails(resolvedName)
      .then((res) => {
        if (!isMounted) return;
        setDetails(res);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'تعذر تحميل تفاصيل الدواء');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [modalOpen, resolvedName, item]);

  if (!modalOpen || !resolvedName) return null;

  const handleAddToMyMedicines = () => {
    const success = saveMyMedicine({
      name_ar: item?.medicine_name_ar || details?.medicine_name_ar || resolvedName,
      name_en: item?.medicine_name_en || details?.medicine_name_en || resolvedName,
      name: item?.medicine_name_ar || details?.medicine_name_ar || resolvedName,
      active_ingredient: item?.active_ingredient || details?.active_ingredient,
      how_and_when: details?.how_and_when || (item?.written_instructions ? [item.written_instructions] : []),
    });
    if (success) {
      setIsSaved(true);
      if (onAddedToMedicines) {
        onAddedToMedicines();
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`تفاصيل دواء ${arabicDisplayName}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
    >
      <div
        dir="rtl"
        className="w-full max-w-2xl bg-[#F8F9FA] dark:bg-[#0E1517] rounded-3xl shadow-2xl border-2 border-teal-600 dark:border-[#1D2B2F] flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="bg-white dark:bg-[#162124] border-b-2 border-teal-600 dark:border-[#1D2B2F] p-4 sm:p-5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 dark:bg-[#3DB8C4] text-white dark:text-[#0E1517] flex items-center justify-center">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-senior-xl font-bold text-teal-900 dark:text-[#E6EEF0] leading-tight">
                {arabicDisplayName}
              </h2>
              {englishDisplayName && (
                <p className="text-xs font-mono text-slate-500 dark:text-[#9FB3B8]" dir="ltr">
                  {englishDisplayName}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-[#1D2B2F] hover:bg-slate-200 dark:hover:bg-[#25373C] active:scale-95 text-slate-700 dark:text-[#E6EEF0] flex items-center justify-center text-xl font-bold"
            aria-label="إغلاق نافذة التفاصيل"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Doctor's Prescription Note */}
          {item?.written_instructions && (
            <div className="bg-blue-50 dark:bg-[#1D2B2F] border-2 border-blue-400 dark:border-blue-600 rounded-2xl p-4 text-right">
              <span className="text-blue-900 dark:text-blue-300 text-sm font-bold block mb-1">
                ما كتبه الطبيب في الروشتة:
              </span>
              <p className="text-senior-base font-extrabold text-blue-950 dark:text-[#E6EEF0]">
                {item.written_instructions}
              </p>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-4">
              <LoadingSpinner />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-amber-50 dark:bg-[#3A2E12] border-2 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-[#F5D58A] rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 text-amber-600 dark:text-[#F5D58A]" />
              <p className="text-senior-base font-bold">{error}</p>
            </div>
          )}

          {/* 4 Cards */}
          {!loading && details && (
            <>
              <ResultCards result={details} fontSize={fontSize} context="prescription" />
              <DisclaimerBanner />
            </>
          )}

          {/* Add to "أدويتي" Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleAddToMyMedicines}
              disabled={isSaved}
              className={`w-full min-h-[64px] rounded-2xl p-4 flex items-center justify-center gap-3 text-senior-lg font-extrabold transition-all shadow-sm ${
                isSaved
                  ? 'bg-emerald-100 dark:bg-[#064E3B] text-emerald-900 dark:text-[#6EE7B7] border-2 border-emerald-400 dark:border-emerald-600 cursor-default'
                  : 'bg-teal-600 hover:bg-teal-700 dark:bg-[#3DB8C4] dark:hover:bg-[#349fa8] active:scale-[0.98] text-white dark:text-[#0E1517] dark:font-black'
              }`}
              aria-label={isSaved ? 'موجود في أدويتي' : 'أضف لأدويتي'}
            >
              {isSaved ? (
                <>
                  <Check className="w-7 h-7 text-emerald-700 dark:text-[#6EE7B7]" />
                  <span>تمت الإضافة لقائمة أدويتي ✓</span>
                </>
              ) : (
                <>
                  <Plus className="w-7 h-7" />
                  <span>أضف لأدويتي</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-white dark:bg-[#162124] border-t border-slate-200 dark:border-[#1D2B2F] p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[56px] rounded-2xl bg-slate-100 dark:bg-[#1D2B2F] hover:bg-slate-200 dark:hover:bg-[#25373C] text-slate-800 dark:text-[#E6EEF0] font-bold text-senior-base flex items-center justify-center"
          >
            العودة للروشتة
          </button>
        </div>
      </div>
    </div>
  );
};
