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
      className="w-full bg-white border-2 border-slate-300 rounded-3xl p-5 sm:p-6 shadow-sm my-6 text-right"
    >
      <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-200">
        <div className="flex items-center gap-2 text-teal-800">
          <History className="w-7 h-7 text-teal-600" aria-hidden="true" />
          <h2 className="text-senior-xl font-bold">
            آخر الأدوية التي صورتها ({scans.length})
          </h2>
        </div>

        <button
          type="button"
          onClick={onClearHistory}
          className="text-slate-500 hover:text-red-600 text-sm font-semibold flex items-center gap-1 p-2 rounded-lg"
          aria-label="مسح سجل الأدوية السابقة"
        >
          <Trash2 className="w-4 h-4" />
          <span>مسح السجل</span>
        </button>
      </div>

      <p className="text-slate-600 text-senior-base mb-4">
        يمكنكم الضغط على أي دواء لقراءة تفاصيله والاستماع إليها مجدداً:
      </p>

      <ul className="space-y-3">
        {scans.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelectScan(item)}
              className="w-full min-h-[64px] bg-slate-50 hover:bg-teal-50 border-2 border-slate-200 hover:border-teal-500 rounded-2xl p-4 flex items-center justify-between text-right transition-all group shadow-xs"
              aria-label={`عرض تفاصيل دواء ${item.medicine_name_ar || item.medicine_name_en || 'غير مسمى'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                  <Pill className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-senior-lg text-slate-900 group-hover:text-teal-900">
                    {item.medicine_name_ar || item.medicine_name_en}
                  </h3>
                  {item.active_ingredient && (
                    <p className="text-slate-600 text-sm font-medium">
                      المادة: {item.active_ingredient}
                    </p>
                  )}
                </div>
              </div>

              <ChevronLeft className="w-6 h-6 text-slate-400 group-hover:text-teal-700 transition-transform group-hover:-translate-x-1" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
