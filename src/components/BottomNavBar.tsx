import React, { useState, useRef } from 'react';
import { Home, Pill, FileText, History, ScanLine } from 'lucide-react';
import { TabKey } from '../types';

export interface BottomNavBarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  onCameraClick: () => Promise<void> | void;
  disabled?: boolean;
  mockWidth?: number | null;
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
  mockWidth,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const isCameraActiveRef = useRef(false);

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
    if (disabled || isCapturing || isCameraActiveRef.current) return;
    isCameraActiveRef.current = true;
    triggerHaptic();
    setIsCapturing(true);
    try {
      await onCameraClick();
    } finally {
      setIsCapturing(false);
      isCameraActiveRef.current = false;
    }
  };

  return (
    <nav
      dir="rtl"
      role="navigation"
      aria-label="شريط التنقل السفلي"
      style={mockWidth ? { width: `${mockWidth}px`, maxWidth: `${mockWidth}px`, left: 0, right: 'auto' } : undefined}
      className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#162124] border-t-2 border-slate-200 dark:border-[#1D2B2F] shadow-lg pb-safe"
    >
      <div
        style={mockWidth ? { width: `${mockWidth}px`, maxWidth: `${mockWidth}px` } : undefined}
        className="max-w-md mx-auto grid grid-cols-5 items-center min-h-[64px] px-1"
      >
        {/* Tab 1: الرئيسية (Home) */}
        <button
          type="button"
          role="tab"
          aria-label="الرئيسية"
          aria-selected={activeTab === 'home'}
          onClick={() => handleTabClick('home')}
          className={`min-h-[48px] min-w-[48px] w-full flex-1 flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'home'
              ? 'bg-[#006D77]/15 dark:bg-[#3DB8C4]/20 text-[#006D77] dark:text-[#3DB8C4] rounded-full px-1.5'
              : 'text-slate-600 dark:text-[#9FB3B8] hover:text-teal-700 dark:hover:text-[#3DB8C4]'
          }`}
        >
          <Home className="w-6 h-6" strokeWidth={2} aria-hidden="true" />
          <span className="text-xs font-bold mt-0.5 truncate max-w-full px-0.5 whitespace-nowrap overflow-hidden text-ellipsis block text-center">
            الرئيسية
          </span>
        </button>

        {/* Tab 2: أدويتي (Medicines) */}
        <button
          type="button"
          role="tab"
          aria-label="أدويتي"
          aria-selected={activeTab === 'medicines'}
          onClick={() => handleTabClick('medicines')}
          className={`min-h-[48px] min-w-[48px] w-full flex-1 flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'medicines'
              ? 'bg-[#006D77]/15 dark:bg-[#3DB8C4]/20 text-[#006D77] dark:text-[#3DB8C4] rounded-full px-1.5'
              : 'text-slate-600 dark:text-[#9FB3B8] hover:text-teal-700 dark:hover:text-[#3DB8C4]'
          }`}
        >
          <Pill className="w-6 h-6" strokeWidth={2} aria-hidden="true" />
          <span className="text-xs font-bold mt-0.5 truncate max-w-full px-0.5 whitespace-nowrap overflow-hidden text-ellipsis block text-center">
            أدويتي
          </span>
        </button>

        {/* Tab 3: Center Raised Camera Button (صوّر) */}
        <div className="relative flex flex-col items-center justify-center -mt-6 px-1 col-span-1">
          <button
            type="button"
            disabled={disabled || isCapturing}
            onClick={handleCenterCameraClick}
            aria-label="صوّر"
            className="w-16 h-16 w-[64px] h-[64px] rounded-full bg-[#006D77] bg-gradient-to-b from-[#0A8F9C] to-[#006D77] ring-4 ring-white dark:ring-[#162124] shadow-[0_4px_16px_rgba(0,109,119,0.35)] dark:shadow-[0_4px_16px_rgba(61,184,196,0.3)] active:scale-95 duration-150 ease-out disabled:opacity-60 text-white flex flex-col items-center justify-center transition-all z-60"
          >
            <ScanLine className="w-7 h-7 text-white" strokeWidth={2} aria-hidden="true" />
            <span className="text-xs font-bold text-white mt-0.5">صوّر</span>
          </button>
        </div>

        {/* Tab 4: الروشتة (Prescription) */}
        <button
          type="button"
          role="tab"
          aria-label="الروشتة"
          aria-selected={activeTab === 'prescription'}
          onClick={() => handleTabClick('prescription')}
          className={`min-h-[48px] min-w-[48px] w-full flex-1 flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'prescription'
              ? 'bg-[#006D77]/15 dark:bg-[#3DB8C4]/20 text-[#006D77] dark:text-[#3DB8C4] rounded-full px-1.5'
              : 'text-slate-600 dark:text-[#9FB3B8] hover:text-teal-700 dark:hover:text-[#3DB8C4]'
          }`}
        >
          <FileText className="w-6 h-6" strokeWidth={2} aria-hidden="true" />
          <span className="text-xs font-bold mt-0.5 truncate max-w-full px-0.5 whitespace-nowrap overflow-hidden text-ellipsis block text-center">
            الروشتة
          </span>
        </button>

        {/* Tab 5: السجل (History) */}
        <button
          type="button"
          role="tab"
          aria-label="السجل"
          aria-selected={activeTab === 'history'}
          onClick={() => handleTabClick('history')}
          className={`min-h-[48px] min-w-[48px] w-full flex-1 flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'history'
              ? 'bg-[#006D77]/15 dark:bg-[#3DB8C4]/20 text-[#006D77] dark:text-[#3DB8C4] rounded-full px-1.5'
              : 'text-slate-600 dark:text-[#9FB3B8] hover:text-teal-700 dark:hover:text-[#3DB8C4]'
          }`}
        >
          <History className="w-6 h-6" strokeWidth={2} aria-hidden="true" />
          <span className="text-xs font-bold mt-0.5 truncate max-w-full px-0.5 whitespace-nowrap overflow-hidden text-ellipsis block text-center">
            السجل
          </span>
        </button>
      </div>
    </nav>
  );
};

