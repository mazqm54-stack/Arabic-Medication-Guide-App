import React, { useState } from 'react';
import { Home, Pill, Camera, FileText, History } from 'lucide-react';
import { TabKey } from '../types';

export interface BottomNavBarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  onCameraClick: () => Promise<void> | void;
  disabled?: boolean;
}

export const RTL_NAV_TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'home', label: 'الرئيسية', icon: 'Home' },
  { key: 'medicines', label: 'أدويتي', icon: 'Pill' },
  { key: 'camera', label: 'صوّر', icon: 'Camera' },
  { key: 'prescription', label: 'الروشتة', icon: 'FileText' },
  { key: 'history', label: 'السجل', icon: 'History' },
];

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  onCameraClick,
  disabled = false,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(10);
      } catch {
        // Ignore vibration errors on unsupported platforms
      }
    }
  };

  const handleTabClick = (key: TabKey) => {
    triggerHaptic();
    onSelectTab(key);
  };

  const handleCenterCameraClick = async () => {
    if (disabled || isCapturing) return;
    triggerHaptic();
    setIsCapturing(true);
    try {
      await onCameraClick();
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <nav
      dir="rtl"
      role="navigation"
      aria-label="شريط التنقل السفلي"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#162124] border-t-2 border-slate-200 dark:border-[#1D2B2F] shadow-lg pb-safe"
    >
      <div className="max-w-md mx-auto px-2 flex items-center justify-between min-h-[72px]">
        {/* Tab 1: الرئيسية (Home) */}
        <button
          type="button"
          role="tab"
          aria-label="الرئيسية"
          aria-selected={activeTab === 'home'}
          onClick={() => handleTabClick('home')}
          className={`min-h-[64px] min-w-[64px] flex-1 flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'home'
              ? 'bg-[#006D77]/15 dark:bg-[#3DB8C4]/20 text-[#006D77] dark:text-[#3DB8C4] rounded-full px-4 py-1'
              : 'text-slate-600 dark:text-[#9FB3B8] hover:text-teal-700 dark:hover:text-[#3DB8C4]'
          }`}
        >
          <Home className="w-7 h-7" aria-hidden="true" />
          <span className="text-base font-bold mt-1">الرئيسية</span>
        </button>

        {/* Tab 2: أدويتي (Medicines) */}
        <button
          type="button"
          role="tab"
          aria-label="أدويتي"
          aria-selected={activeTab === 'medicines'}
          onClick={() => handleTabClick('medicines')}
          className={`min-h-[64px] min-w-[64px] flex-1 flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'medicines'
              ? 'bg-[#006D77]/15 dark:bg-[#3DB8C4]/20 text-[#006D77] dark:text-[#3DB8C4] rounded-full px-4 py-1'
              : 'text-slate-600 dark:text-[#9FB3B8] hover:text-teal-700 dark:hover:text-[#3DB8C4]'
          }`}
        >
          <Pill className="w-7 h-7" aria-hidden="true" />
          <span className="text-base font-bold mt-1">أدويتي</span>
        </button>

        {/* Tab 3: Center Raised Camera Button (صوّر) */}
        <div className="relative flex flex-col items-center justify-center -mt-7 px-1">
          <button
            type="button"
            disabled={disabled || isCapturing}
            onClick={handleCenterCameraClick}
            aria-label="صوّر"
            className="w-[76px] h-[76px] rounded-full bg-[#006D77] dark:bg-[#0A8F9C] hover:bg-teal-800 dark:hover:bg-[#006D77] active:scale-[0.96] disabled:opacity-60 text-white flex flex-col items-center justify-center shadow-xl border-4 border-white dark:border-[#162124] transition-all z-60"
          >
            <Camera className="w-8 h-8 text-white" aria-hidden="true" />
            <span className="text-xs font-black text-white mt-0.5">صوّر</span>
          </button>
        </div>

        {/* Tab 4: الروشتة (Prescription) */}
        <button
          type="button"
          role="tab"
          aria-label="الروشتة"
          aria-selected={activeTab === 'prescription'}
          onClick={() => handleTabClick('prescription')}
          className={`min-h-[64px] min-w-[64px] flex-1 flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'prescription'
              ? 'bg-[#006D77]/15 dark:bg-[#3DB8C4]/20 text-[#006D77] dark:text-[#3DB8C4] rounded-full px-4 py-1'
              : 'text-slate-600 dark:text-[#9FB3B8] hover:text-teal-700 dark:hover:text-[#3DB8C4]'
          }`}
        >
          <FileText className="w-7 h-7" aria-hidden="true" />
          <span className="text-base font-bold mt-1">الروشتة</span>
        </button>

        {/* Tab 5: السجل (History) */}
        <button
          type="button"
          role="tab"
          aria-label="السجل"
          aria-selected={activeTab === 'history'}
          onClick={() => handleTabClick('history')}
          className={`min-h-[64px] min-w-[64px] flex-1 flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'history'
              ? 'bg-[#006D77]/15 dark:bg-[#3DB8C4]/20 text-[#006D77] dark:text-[#3DB8C4] rounded-full px-4 py-1'
              : 'text-slate-600 dark:text-[#9FB3B8] hover:text-teal-700 dark:hover:text-[#3DB8C4]'
          }`}
        >
          <History className="w-7 h-7" aria-hidden="true" />
          <span className="text-base font-bold mt-1">السجل</span>
        </button>
      </div>
    </nav>
  );
};
