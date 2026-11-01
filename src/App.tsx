import { useState, useEffect } from 'react';
import { Pill, RotateCcw } from 'lucide-react';
import {
  MedicineAnalysisResult,
  MedicationHistoryItem,
  FontSizePreference,
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
  purgeLegacyStoredApiKey,
} from './services/preferencesStorage';
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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [fontSize, setFontSize] = useState<FontSizePreference>(getStoredFontSize());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentResult, setCurrentResult] = useState<MedicineAnalysisResult | null>(null);
  const [recentScans, setRecentScans] = useState<MedicationHistoryItem[]>([]);
  const [myMedicines, setMyMedicines] = useState<MyMedicineItem[]>([]);
  const [lastFile, setLastFile] = useState<File | null>(null);

  // Load history and preferences on mount, and purge legacy secrets
  useEffect(() => {
    setRecentScans(getScanHistory());
    setMyMedicines(getMyMedicines());
    purgeLegacyStoredApiKey();
  }, []);

  const handleFontSizeChange = (newSize: FontSizePreference) => {
    setFontSize(newSize);
    setStoredFontSize(newSize);
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
      className={`min-h-screen bg-[#F8F9FA] text-[#1D3557] flex flex-col items-center justify-between font-cairo transition-all ${
        fontSize === 'extra-large' ? 'font-mode-extra-large' : 'font-mode-large'
      }`}
    >
      {/* Top Header Bar */}
      <header className="w-full bg-white border-b-2 border-teal-600 shadow-xs sticky top-0 z-30 px-4 py-3 sm:px-6 pt-safe">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
              <Pill className="w-7 h-7" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-senior-xl sm:text-senior-2xl font-black text-teal-800 leading-tight">
                دليلي الدوائي
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-500">
                مساعدك الطبي لقراءة علب الأدوية والروشتات
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area with bottom padding for fixed nav */}
      <main className="w-full max-w-2xl px-4 py-6 sm:py-8 flex-1 flex flex-col justify-start pb-28">
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
            <div className="bg-white border-2 border-teal-600 rounded-3xl p-6 shadow-xs">
              <h2 className="text-senior-xl font-bold text-teal-900 mb-2">💊 أدويتي المحفوظة</h2>
              <p className="text-senior-base text-slate-700">
                قائمة بجميع الأدوية التي قمت بحفظها لمراجعتها في أي وقت:
              </p>
            </div>

            {myMedicines.length === 0 ? (
              <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl p-8 text-center space-y-3">
                <Pill className="w-12 h-12 text-slate-400 mx-auto" />
                <h3 className="text-senior-lg font-bold text-slate-700">لا توجد أدوية محفوظة بعد</h3>
                <p className="text-senior-base text-slate-500">
                  يمكنك إضافة أي دواء إلى هذه القائمة بالضغط على "أضف لأدويتي" بعد قراءة الروشتة أو علبة الدواء.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {myMedicines.map((med) => (
                  <div
                    key={med.id}
                    className="bg-white border-2 border-teal-600 rounded-3xl p-5 shadow-xs flex flex-col gap-3 text-right"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-teal-100 pb-2">
                      <div>
                        <h3 className="text-senior-lg font-black text-teal-900">
                          {med.name_ar || med.name}
                        </h3>
                        {med.name_en && (
                          <p className="text-xs font-mono font-bold text-slate-500" dir="ltr">
                            {med.name_en}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMyMedicine(med.id)}
                        className="p-2 text-rose-600 hover:text-rose-800 rounded-xl hover:bg-rose-50 active:scale-95 transition-all text-sm font-bold"
                        aria-label={`حذف ${med.name_ar || med.name} من أدويتي`}
                      >
                        🗑️ حذف
                      </button>
                    </div>
                    {med.active_ingredient && (
                      <p className="text-senior-base font-semibold text-slate-700">
                        🧪 المادة الفعالة: {med.active_ingredient}
                      </p>
                    )}
                    {med.how_and_when && med.how_and_when.length > 0 && (
                      <div className="bg-teal-50/60 p-3 rounded-2xl border border-teal-200">
                        <span className="text-xs font-bold text-teal-800 block mb-1">الاستخدام والمواعيد:</span>
                        <p className="text-senior-base font-bold text-teal-950">
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
            <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 shadow-xs text-right">
              <h2 className="text-senior-xl font-bold text-slate-900 mb-2">🕒 سجل الأدوية السابقة</h2>
              <p className="text-senior-base text-slate-700">
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
                <div className="sticky bottom-20 z-20 pt-2 pb-4 bg-gradient-to-t from-[#F8F9FA] via-[#F8F9FA]/90 to-transparent">
                  <button
                    type="button"
                    onClick={handleResetToHome}
                    className="btn-primary w-full min-h-[64px] sm:min-h-[72px] flex items-center justify-center gap-3 text-senior-xl font-extrabold shadow-xl bg-teal-700 hover:bg-teal-800"
                    aria-label="العودة وتصوير دواء آخر"
                  >
                    <RotateCcw className="w-7 h-7" />
                    <span>🔄 تصوير دواء آخر</span>
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
      />
    </div>
  );
}
