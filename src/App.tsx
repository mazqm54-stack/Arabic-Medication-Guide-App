import { useState, useEffect } from 'react';
import { Pill, RotateCcw, Settings, Info, Trash2, FlaskConical, History } from 'lucide-react';
import {
  MedicineAnalysisResult,
  MedicationHistoryItem,
  FontSizePreference,
  ThemePreference,
  TabKey,
} from './types';
import {
  getScanHistory,
  saveScanItem,
  clearScanHistory,
} from './services/historyStorage';
import {
  getMyMedicines,
  removeMyMedicine,
  MyMedicineItem,
} from './services/myMedicinesStorage';
import {
  getStoredFontSize,
  setStoredFontSize,
  applyFontSizeToDOM,
  purgeLegacyStoredApiKey,
} from './services/preferencesStorage';
import {
  getStoredThemePreference,
  setStoredThemePreference,
  applyThemeToDOM,
} from './services/themeStorage';
import {
  analyzeMedicationImage,
  AnalysisError,
} from './services/geminiVision';
import { processAndValidateImage } from './utils/imageProcessor';
import { speechController } from './services/speechController';
import { capturePhoto } from './services/nativeCamera';

import { LoadingSpinner } from './components/LoadingSpinner';
import { ResultCards } from './components/ResultCards';
import { UnclearPhotoCard } from './components/UnclearPhotoCard';
import { AudioToolbar } from './components/AudioToolbar';
import { FontSizeToggle } from './components/FontSizeToggle';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { BottomNavBar } from './components/BottomNavBar';
import { HomeScreen } from './components/HomeScreen';
import { PrescriptionFlow } from './components/PrescriptionFlow';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [fontSize, setFontSize] = useState<FontSizePreference>(getStoredFontSize());
  const [theme, setTheme] = useState<ThemePreference>(getStoredThemePreference());
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentResult, setCurrentResult] = useState<MedicineAnalysisResult | null>(null);
  const [recentScans, setRecentScans] = useState<MedicationHistoryItem[]>([]);
  const [myMedicines, setMyMedicines] = useState<MyMedicineItem[]>([]);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [mockWidth] = useState<number | null>(() => {
    if (typeof window !== 'undefined' && window.location) {
      try {
        const params = new URLSearchParams(window.location.search);
        const val = params.get('mockWidth') || params.get('viewport')?.split('x')[0];
        if (val) {
          const num = parseInt(val, 10);
          if (!isNaN(num) && num > 0) return num;
        }
      } catch {
        // ignore
      }
    }
    return null;
  });

  // Load history and preferences on mount, and purge legacy secrets
  useEffect(() => {
    applyFontSizeToDOM(fontSize);
    applyThemeToDOM(theme);
    setRecentScans(getScanHistory());
    setMyMedicines(getMyMedicines());
    purgeLegacyStoredApiKey();

    if (mockWidth) {
      let styleEl = document.getElementById('dalili-screenshot-constraint') as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dalili-screenshot-constraint';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `
        html, body, #root {
          width: ${mockWidth}px !important;
          max-width: ${mockWidth}px !important;
          min-width: ${mockWidth}px !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow-x: hidden !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
        }
        nav[role="navigation"],
        header,
        div[role="dialog"] {
          width: ${mockWidth}px !important;
          max-width: ${mockWidth}px !important;
          left: 0 !important;
          right: auto !important;
        }
      `;
    }

    if (typeof window !== 'undefined' && window.location) {
      try {
        const params = new URLSearchParams(window.location.search);
        const themeParam = params.get('theme');
        if (themeParam === 'dark' || themeParam === 'light' || themeParam === 'system') {
          setTheme(themeParam);
          setStoredThemePreference(themeParam);
          applyThemeToDOM(themeParam);
        }

        const fontParam = params.get('fontSize');
        if (fontParam === 'normal' || fontParam === 'large' || fontParam === 'extra-large') {
          setFontSize(fontParam);
          setStoredFontSize(fontParam);
          applyFontSizeToDOM(fontParam);
        }

        const mockParam = params.get('mock');
        if (mockParam === 'settings') {
          setIsSettingsOpen(true);
        } else if (mockParam === 'medicine_result') {
          setCurrentResult({
            is_clear: true,
            confidence: 'high',
            medicine_name_ar: 'بانادول إكسترا',
            medicine_name_en: 'Panadol Extra 500mg',
            active_ingredient: 'باراسيتامول + كافيين',
            uses: ['تسكين آلام الصداع الشديد', 'خفض درجة الحرارة', 'تخفيف آلام المفاصل'],
            how_and_when: ['قرص واحد بعد الأكل عند اللزوم', 'لا تتجاوز 4 أقراص يومياً'],
            warnings: ['تجنب تناوله مع أدوية أخرى تحتوي على الباراسيتامول', 'استشر الطبيب لمرضى الضغط والكبد'],
            audio_summary: 'بانادول إكسترا مسكن للألم وخافض للحرارة. يؤخذ قرص واحد بعد الأكل عند اللزوم مع شرب الماء.'
          });
        } else if (mockParam === 'prescription_result') {
          setActiveTab('prescription');
        } else if (mockParam === 'unclear_photo') {
          setCurrentResult({
            is_clear: false,
            error_category: 'unclear_image',
            error_code: 'UNCLEAR_PHOTO',
            raw_error: 'الصورة الملتقطة غير واضحة أو مظلمة، يرجى إعادة التصوير في إضاءة جيدة.'
          });
        } else if (mockParam === 'medicines') {
          setActiveTab('medicines');
          setMyMedicines([
            {
              id: 'med-1',
              name: 'بانادول إكسترا',
              name_ar: 'بانادول إكسترا',
              name_en: 'Panadol Extra 500mg',
              active_ingredient: 'باراسيتامول',
              how_and_when: ['قرص واحد عند اللزوم'],
              addedAt: Date.now()
            },
            {
              id: 'med-2',
              name: 'كونكور 5 مجم',
              name_ar: 'كونكور 5 مجم',
              name_en: 'Concor 5mg',
              active_ingredient: 'بيسوبرولول',
              how_and_when: ['قرص واحد صباحاً قبل الإفطار'],
              addedAt: Date.now() - 86400000
            }
          ]);
        } else if (mockParam === 'history') {
          setActiveTab('history');
          setRecentScans([
            {
              id: 'hist-1',
              is_clear: true,
              confidence: 'high',
              medicine_name_ar: 'بانادول إكسترا',
              medicine_name_en: 'Panadol Extra 500mg',
              active_ingredient: 'باراسيتامول',
              uses: ['تسكين الآلام'],
              how_and_when: ['قرص واحد بعد الأكل'],
              warnings: ['لا تتجاوز الجرعة'],
              audio_summary: 'بانادول إكسترا',
              timestamp: Date.now()
            },
            {
              id: 'hist-2',
              is_clear: true,
              confidence: 'high',
              medicine_name_ar: 'أوجمنتين 1 جم',
              medicine_name_en: 'Augmentin 1g',
              active_ingredient: 'أموكسيسيلين + كلافولانات',
              uses: ['مضاد حيوي واسع المجال'],
              how_and_when: ['قرص كل 12 ساعة بعد الأكل'],
              warnings: ['يجب إكمال الكورس كاملاً'],
              audio_summary: 'أوجمنتين 1 جم',
              timestamp: Date.now() - 172800000
            }
          ]);
        } else if (mockParam === 'home') {
          setActiveTab('home');
          setCurrentResult(null);
          setIsSettingsOpen(false);
        }
      } catch {
        // Ignore URL parsing errors
      }
    }
  }, []);

  const handleFontSizeChange = (newSize: FontSizePreference) => {
    setFontSize(newSize);
    setStoredFontSize(newSize);
    applyFontSizeToDOM(newSize);
  };

  const handleToggleFontSize = () => {
    const nextSize: FontSizePreference =
      fontSize === 'normal' ? 'large' : fontSize === 'large' ? 'extra-large' : 'normal';
    handleFontSizeChange(nextSize);
  };

  const handleThemeChange = (newTheme: ThemePreference) => {
    setTheme(newTheme);
    setStoredThemePreference(newTheme);
  };

  const handleClearHistory = () => {
    if (window.confirm('هل تريد مسح سجل الأدوية السابقة؟')) {
      clearScanHistory();
      setRecentScans([]);
    }
  };

  const handleDeleteMyMedicine = (id: string) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف هذا الدواء من قائمتك؟')) {
      removeMyMedicine(id);
      setMyMedicines(getMyMedicines());
    }
  };

  const processImage = async (file: File) => {
    setIsLoading(true);
    setCurrentResult(null);
    speechController.stop();
    setLastFile(file); // Preserved for interactive retry!

    try {
      // 1. Android WebView safe clamp (max 1024px), white backdrop, JPEG 0.75 & verification
      const processed = await processAndValidateImage(file);

      // 2. Dispatch to zero-secret proxy with 30s timeout
      const result = await analyzeMedicationImage({
        imageBase64: processed.base64,
        mimeType: processed.mimeType
      });

      setCurrentResult(result);
      if (result.is_clear) {
        const updatedHistory = saveScanItem(result);
        setRecentScans(updatedHistory);
      }
    } catch (err: unknown) {
      if (err instanceof AnalysisError) {
        setCurrentResult({
          is_clear: false,
          error_category: err.category,
          error_code: err.errorCode,
          error_detail: err.detail,
          raw_error: err.message
        });
      } else {
        const errorMsg = err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الصورة.';
        const isTimeout = /timeout|30 ثانية|مهلة/i.test(errorMsg);
        const isNetwork = /network|fetch|شبكة|اتصال/i.test(errorMsg);
        const isUnclear = /الصورة الملتقطة تبدو مظلمة|أبعاد الصورة|شاشة سوداء/i.test(errorMsg);

        let error_category: MedicineAnalysisResult['error_category'] = 'server_error';
        if (isTimeout || isNetwork) {
          error_category = 'network_timeout';
        } else if (isUnclear) {
          error_category = 'unclear_image';
        }

        setCurrentResult({
          is_clear: false,
          error_category,
          error_code: isTimeout ? 'CLIENT_TIMEOUT' : undefined,
          raw_error: errorMsg
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelected = async (file: File) => {
    await processImage(file);
  };

  const handleCenterCameraClick = async () => {
    speechController.stop();
    const file = await capturePhoto();
    if (file) {
      setActiveTab('home');
      await processImage(file);
    }
  };

  const handleRetrySameImage = async () => {
    if (lastFile) {
      await processImage(lastFile);
    } else {
      handleResetToHome();
    }
  };

  const handleResetToHome = () => {
    speechController.stop();
    setCurrentResult(null);
    setIsLoading(false);
    setLastFile(null);
    setActiveTab('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectRecentScan = (item: MedicationHistoryItem) => {
    speechController.stop();
    setCurrentResult(item);
    setActiveTab('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (tab: TabKey) => {
    speechController.stop();
    setCurrentResult(null);
    setActiveTab(tab);
    if (tab === 'medicines') {
      setMyMedicines(getMyMedicines());
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      dir="rtl"
      id="app-root-container"
      style={mockWidth ? { width: `${mockWidth}px`, maxWidth: `${mockWidth}px`, minWidth: `${mockWidth}px`, position: 'absolute', left: 0, top: 0, overflowX: 'hidden' } : undefined}
      className={`min-h-screen bg-[#F8F9FA] dark:bg-[#0E1517] text-[#1D3557] dark:text-[#E6EEF0] flex flex-col items-center justify-between font-sans transition-all ${
        fontSize === 'extra-large'
          ? 'font-mode-extra-large font-size-extra-large'
          : fontSize === 'large'
          ? 'font-mode-large font-size-large'
          : 'font-mode-normal font-size-normal'
      }`}
    >
      {/* Top Header Bar */}
      <header
        style={mockWidth ? { width: `${mockWidth}px`, maxWidth: `${mockWidth}px`, left: 0, right: 'auto' } : undefined}
        className="w-full bg-white dark:bg-[#162124] border-b border-slate-200 dark:border-[#1D2B2F] shadow-xs sticky top-0 z-30 pt-safe"
      >
        <div
          style={mockWidth ? { width: '100%', maxWidth: `${mockWidth}px` } : undefined}
          className="max-w-2xl mx-auto px-4 py-2 sm:px-6 flex items-center justify-between min-h-[56px]"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 dark:bg-[#3DB8C4] text-white dark:text-[#0E1517] flex items-center justify-center shadow-xs">
              <Pill className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
            </div>
            <h1 className="text-lg font-black text-teal-800 dark:text-[#3DB8C4] leading-tight">
              دليلي الدوائي
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleFontSize}
              aria-label="تبديل حجم الخط (Aa)"
              className="min-h-[48px] min-w-[48px] rounded-xl bg-slate-100 dark:bg-[#1D2B2F] hover:bg-slate-200 dark:hover:bg-[#25373C] active:scale-95 text-slate-800 dark:text-slate-100 text-base font-bold flex items-center justify-center transition-all border border-slate-200 dark:border-slate-700/60"
            >
              Aa
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="إعدادات التطبيق"
              className="min-h-[48px] min-w-[48px] p-2.5 rounded-xl bg-teal-50 dark:bg-[#1D2B2F] text-teal-800 dark:text-[#3DB8C4] hover:bg-teal-100 dark:hover:bg-[#25373C] active:scale-95 transition-all flex items-center justify-center border border-teal-200 dark:border-teal-800/50"
            >
              <Settings className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
        {/* Slim One-Line Advisory Banner */}
        <div
          role="region"
          aria-label="تنبيه الأدوية"
          className="w-full bg-teal-50/90 dark:bg-[#1D2B2F] border-t border-teal-100 dark:border-teal-900/40 py-1.5 px-3 flex items-center justify-center gap-2 text-teal-900 dark:text-teal-200 text-xs sm:text-sm font-semibold"
        >
          <Info className="w-4 h-4 flex-shrink-0 text-teal-700 dark:text-teal-400" strokeWidth={2} aria-hidden="true" />
          <span>راجع أسماء الأدوية قبل الاعتماد</span>
        </div>
      </header>

      {/* Main Content Area with bottom padding for fixed nav */}
      <main
        style={mockWidth ? { width: `${mockWidth}px`, maxWidth: `${mockWidth}px` } : undefined}
        className="w-full max-w-2xl px-4 py-6 sm:py-8 flex-1 flex flex-col justify-start pb-28"
      >
        {/* Loading State */}
        {isLoading && <LoadingSpinner />}

        {/* Home Screen (Active Tab: Home & No Active Result & Not Loading) */}
        {!isLoading && !currentResult && activeTab === 'home' && (
          <HomeScreen
            onImageSelected={handleImageSelected}
            onNavigateToPrescription={() => handleTabChange('prescription')}
            recentScans={recentScans}
            onSelectRecentScan={handleSelectRecentScan}
            onClearHistory={handleClearHistory}
            disabled={isLoading}
          />
        )}

        {/* Medicines Screen (Active Tab: Medicines) */}
        {!isLoading && !currentResult && activeTab === 'medicines' && (
          <div className="w-full space-y-6 text-right animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#162124] border-2 border-teal-600 dark:border-[#3DB8C4] rounded-3xl p-6 shadow-xs">
              <h2 className="text-senior-xl font-bold text-teal-900 dark:text-[#E6EEF0] mb-2 flex items-center gap-2">
                <Pill className="w-6 h-6 text-teal-600 dark:text-[#3DB8C4]" strokeWidth={2} aria-hidden="true" />
                <span>أدويتي المحفوظة</span>
              </h2>
              <p className="text-senior-base text-slate-700 dark:text-[#9FB3B8]">
                قائمة بجميع الأدوية التي قمت بحفظها لمراجعتها في أي وقت:
              </p>
            </div>

            {myMedicines.length === 0 ? (
              <div className="bg-slate-50 dark:bg-[#162124] border-2 border-dashed border-slate-300 dark:border-[#1D2B2F] rounded-3xl p-8 text-center space-y-3">
                <Pill className="w-12 h-12 text-slate-400 mx-auto" />
                <h3 className="text-senior-lg font-bold text-slate-700 dark:text-[#E6EEF0]">لا توجد أدوية محفوظة بعد</h3>
                <p className="text-senior-base text-slate-500 dark:text-[#9FB3B8]">
                  يمكنك إضافة أي دواء إلى هذه القائمة بالضغط على "أضف لأدويتي" بعد قراءة الروشتة أو علبة الدواء.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {myMedicines.map((med) => (
                  <div
                    key={med.id}
                    className="bg-white dark:bg-[#162124] border-2 border-teal-600 dark:border-[#3DB8C4] rounded-3xl p-5 shadow-xs flex flex-col gap-3 text-right"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-teal-100 dark:border-[#1D2B2F] pb-2">
                      <div>
                        <h3 className="text-senior-lg font-black text-teal-900 dark:text-[#E6EEF0]">
                          {med.name_ar || med.name}
                        </h3>
                        {med.name_en && (
                          <p className="text-xs font-mono font-bold text-slate-500 dark:text-[#9FB3B8]" dir="ltr">
                            {med.name_en}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMyMedicine(med.id)}
                        className="p-2 text-rose-600 hover:text-rose-800 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-95 transition-all text-sm font-bold flex items-center gap-1"
                        aria-label={`حذف ${med.name_ar || med.name} من أدويتي`}
                      >
                        <Trash2 className="w-4 h-4 text-rose-600" strokeWidth={2} aria-hidden="true" />
                        <span>حذف</span>
                      </button>
                    </div>
                    {med.active_ingredient && (
                      <p className="text-senior-base font-semibold text-slate-700 dark:text-[#9FB3B8] flex items-center gap-1.5">
                        <FlaskConical className="w-4 h-4 text-teal-600 dark:text-[#3DB8C4]" strokeWidth={2} aria-hidden="true" />
                        <span>المادة الفعالة: {med.active_ingredient}</span>
                      </p>
                    )}
                    {med.how_and_when && med.how_and_when.length > 0 && (
                      <div className="bg-teal-50/60 dark:bg-[#1D2B2F] p-3 rounded-2xl border border-teal-200 dark:border-teal-800/60">
                        <span className="text-xs font-bold text-teal-800 dark:text-[#3DB8C4] block mb-1">الاستخدام والمواعيد:</span>
                        <p className="text-senior-base font-bold text-teal-950 dark:text-[#E6EEF0]">
                          {med.how_and_when.join(' • ')}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Prescription Screen (Active Tab: Prescription) */}
        {!isLoading && !currentResult && activeTab === 'prescription' && (
          <PrescriptionFlow
            fontSize={fontSize}
            onFontSizeChange={handleFontSizeChange}
            disabled={isLoading}
          />
        )}

        {/* History Screen (Active Tab: History) */}
        {!isLoading && !currentResult && activeTab === 'history' && (
          <div className="w-full space-y-6">
            <div className="bg-white dark:bg-[#162124] border-2 border-slate-300 dark:border-[#1D2B2F] rounded-3xl p-6 shadow-xs text-right">
              <h2 className="text-senior-xl font-bold text-slate-900 dark:text-[#E6EEF0] mb-2 flex items-center gap-2">
                <History className="w-6 h-6 text-slate-600 dark:text-[#9FB3B8]" strokeWidth={2} aria-hidden="true" />
                <span>سجل الأدوية السابقة</span>
              </h2>
              <p className="text-senior-base text-slate-700 dark:text-[#9FB3B8]">
                جميع عمليات الفحص السابقة مخزنة محلياً على جهازك لخصوصيتك الكاملة.
              </p>
            </div>
            <HomeScreen
              onImageSelected={handleImageSelected}
              onNavigateToPrescription={() => handleTabChange('prescription')}
              recentScans={recentScans}
              onSelectRecentScan={handleSelectRecentScan}
              onClearHistory={handleClearHistory}
              disabled={isLoading}
            />
          </div>
        )}

        {/* Results Screen */}
        {!isLoading && currentResult && (
          <div className="w-full space-y-6 animate-in fade-in duration-200">
            {/* If photo is unclear or failed */}
            {!currentResult.is_clear ? (
              <UnclearPhotoCard
                onRetry={handleRetrySameImage}
                onRetake={handleResetToHome}
                errorMessage={currentResult.raw_error}
                errorCategory={currentResult.error_category}
                errorCode={currentResult.error_code}
                hasLastImage={Boolean(lastFile)}
              />
            ) : (
              <>
                {/* Elderly-Friendly Interactive Controls */}
                <FontSizeToggle
                  currentSize={fontSize}
                  onToggle={handleFontSizeChange}
                />

                <AudioToolbar
                  audioSummary={currentResult.audio_summary}
                  medicineName={currentResult.medicine_name_ar || currentResult.medicine_name_en}
                />

                {/* 4 Structured Color-Coded Cards */}
                <ResultCards result={currentResult} fontSize={fontSize} />

                {/* Persistent Medical Disclaimer */}
                <DisclaimerBanner />

                {/* Sticky Reset Action Button */}
                <div className="sticky bottom-20 z-20 pt-2 pb-4 bg-gradient-to-t from-[#F8F9FA] dark:from-[#0E1517] via-[#F8F9FA]/90 dark:via-[#0E1517]/90 to-transparent">
                  <button
                    type="button"
                    onClick={handleResetToHome}
                    className="btn-primary w-full min-h-[64px] sm:min-h-[72px] flex items-center justify-center gap-3 text-senior-xl font-extrabold shadow-xl bg-teal-700 hover:bg-teal-800 dark:bg-[#3DB8C4] dark:hover:bg-[#349fa8] text-white dark:text-[#0E1517]"
                    aria-label="العودة وتصوير دواء آخر"
                  >
                    <RotateCcw className="w-6 h-6" strokeWidth={2} />
                    <span>تصوير دواء آخر</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Fixed RTL Bottom Navigation Bar */}
      <BottomNavBar
        activeTab={activeTab}
        onSelectTab={handleTabChange}
        onCameraClick={handleCenterCameraClick}
        disabled={isLoading}
        mockWidth={mockWidth}
      />

      {/* Accessible Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentTheme={theme}
        onThemeChange={handleThemeChange}
        currentFontSize={fontSize}
        onFontSizeChange={handleFontSizeChange}
        mockWidth={mockWidth}
      />
    </div>
  );
}
