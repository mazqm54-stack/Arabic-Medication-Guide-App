import React from 'react';
import { History, Pill, ChevronLeft, Trash2 } from 'lucide-react';
import { MedicationHistoryItem } from '../types';

interface RecentScansListProps {
  scans: MedicationHistoryItem[];
  onSelectScan: (item: MedicationHistoryItem) => void;
  onClearHistory: () => void;
}

export const RecentScansList: React.FC<RecentScansListProps> = ({
  scans,
  onSelectScan,
  onClearHistory
}) => {
  if (!scans || scans.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="آخر الأدوية التي صورتها"
      className="w-full bg-white dark:bg-[#162124] border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm my-4 text-right transition-all duration-150 motion-reduce:transition-none"
    >
      <div className="flex items-center justify-between mb-3 border-b pb-2.5 border-gray-100 dark:border-gray-800/80">
        <div className="flex items-center gap-2 text-teal-800 dark:text-[#3DB8C4]">
          <History className="w-5 h-5 text-teal-600 dark:text-[#3DB8C4]" aria-hidden="true" />
          <h2 className="text-base sm:text-lg font-bold">
            آخر الأدوية التي صورتها ({scans.length})
          </h2>
        </div>

        <button
          type="button"
          onClick={onClearHistory}
          className="text-slate-400 dark:text-[#9FB3B8] hover:text-rose-600 text-xs font-semibold flex items-center gap-1 p-1.5 rounded-lg transition-colors min-h-[48px] min-w-[48px] justify-center"
          aria-label="مسح سجل الأدوية السابقة"
        >
          <Trash2 className="w-4 h-4" />
          <span>مسح السجل</span>
        </button>
      </div>

      <p className="text-slate-500 dark:text-[#9FB3B8] text-xs sm:text-sm mb-3 font-medium">
        يمكنكم الضغط على أي دواء لقراءة تفاصيله والاستماع إليها مجدداً:
      </p>

      <ul className="space-y-2.5">
        {scans.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelectScan(item)}
              className="w-full min-h-[56px] bg-slate-50/80 dark:bg-[#1D2B2F] hover:bg-teal-50/50 dark:hover:bg-[#25373C] active:scale-[0.99] border border-gray-100 dark:border-gray-700/60 hover:border-teal-300 dark:hover:border-[#3DB8C4]/60 rounded-xl p-3 flex items-center justify-between text-right transition-all duration-150 motion-reduce:transition-none group shadow-2xs"
              aria-label={`عرض تفاصيل دواء ${item.medicine_name_ar || item.medicine_name_en || 'غير مسمى'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-100 dark:bg-[#162124] flex items-center justify-center flex-shrink-0 text-teal-700 dark:text-[#3DB8C4] group-hover:bg-teal-600 group-hover:text-white transition-colors duration-150">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-[#E6EEF0] group-hover:text-teal-900 dark:group-hover:text-[#3DB8C4]">
                    {item.medicine_name_ar || item.medicine_name_en}
                  </h3>
                  {item.active_ingredient && (
                    <p className="text-slate-500 dark:text-[#9FB3B8] text-xs font-medium">
                      المادة: {item.active_ingredient}
                    </p>
                  )}
                </div>
              </div>

              <ChevronLeft className="w-5 h-5 text-slate-400 dark:text-[#9FB3B8] group-hover:text-teal-700 dark:group-hover:text-[#3DB8C4] transition-transform group-hover:-translate-x-1 duration-150" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
