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
      className="w-full bg-white dark:bg-[#162124] border-2 border-slate-300 dark:border-[#1D2B2F] rounded-3xl p-5 sm:p-6 shadow-sm my-6 text-right"
    >
      <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-200 dark:border-[#1D2B2F]">
        <div className="flex items-center gap-2 text-teal-800 dark:text-[#3DB8C4]">
          <History className="w-7 h-7 text-teal-600 dark:text-[#3DB8C4]" aria-hidden="true" />
          <h2 className="text-senior-xl font-bold">
            آخر الأدوية التي صورتها ({scans.length})
          </h2>
        </div>

        <button
          type="button"
          onClick={onClearHistory}
          className="text-slate-500 dark:text-[#9FB3B8] hover:text-red-600 text-sm font-semibold flex items-center gap-1 p-2 rounded-lg"
          aria-label="مسح سجل الأدوية السابقة"
        >
          <Trash2 className="w-4 h-4" />
          <span>مسح السجل</span>
        </button>
      </div>

      <p className="text-slate-600 dark:text-[#9FB3B8] text-senior-base mb-4">
        يمكنكم الضغط على أي دواء لقراءة تفاصيله والاستماع إليها مجدداً:
      </p>

      <ul className="space-y-3">
        {scans.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelectScan(item)}
              className="w-full min-h-[64px] bg-slate-50 dark:bg-[#1D2B2F] hover:bg-teal-50 dark:hover:bg-[#25373C] border-2 border-slate-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-[#3DB8C4] rounded-2xl p-4 flex items-center justify-between text-right transition-all group shadow-xs"
              aria-label={`عرض تفاصيل دواء ${item.medicine_name_ar || item.medicine_name_en || 'غير مسمى'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-[#162124] flex items-center justify-center flex-shrink-0 text-teal-700 dark:text-[#3DB8C4] group-hover:bg-teal-600 group-hover:text-white transition-colors">
                  <Pill className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-senior-lg text-slate-900 dark:text-[#E6EEF0] group-hover:text-teal-900 dark:group-hover:text-[#3DB8C4]">
                    {item.medicine_name_ar || item.medicine_name_en}
                  </h3>
                  {item.active_ingredient && (
                    <p className="text-slate-600 dark:text-[#9FB3B8] text-sm font-medium">
                      المادة: {item.active_ingredient}
                    </p>
                  )}
                </div>
              </div>

              <ChevronLeft className="w-6 h-6 text-slate-400 dark:text-[#9FB3B8] group-hover:text-teal-700 dark:group-hover:text-[#3DB8C4] transition-transform group-hover:-translate-x-1" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
