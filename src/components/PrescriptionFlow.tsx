import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image, AlertTriangle, FileText } from 'lucide-react';
import {
  PrescriptionAnalysisResult,
  PrescriptionItem,
  FontSizePreference,
  ErrorCategory
} from '../types';
import { capturePhoto, pickPhoto } from '../services/nativeCamera';
import { compressPrescriptionImage } from '../utils/imageProcessor';
import { analyzePrescriptionImage, AnalysisError } from '../services/geminiVision';
import { speechController } from '../services/speechController';
import { LoadingSpinner } from './LoadingSpinner';
import { UnclearPhotoCard } from './UnclearPhotoCard';
import { PrescriptionResultView } from './PrescriptionResultView';
import { MedicineDetailsModal } from './MedicineDetailsModal';

export interface PrescriptionFlowProps {
  fontSize: FontSizePreference;
  onFontSizeChange: (size: FontSizePreference) => void;
  onImageSelected?: (file: File) => Promise<void> | void;
  disabled?: boolean;
}

export const PrescriptionFlow: React.FC<PrescriptionFlowProps> = ({
  fontSize,
  onFontSizeChange,
  onImageSelected,
  disabled = false,
}) => {
  const [status, setStatus] = useState<'idle' | 'processing' | 'result' | 'unclear'>('idle');
  const [result, setResult] = useState<PrescriptionAnalysisResult | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCategory, setErrorCategory] = useState<ErrorCategory | undefined>(undefined);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [selectedMedicine, setSelectedMedicine] = useState<PrescriptionItem | null>(null);

  // Initialize mock result if requested via URL
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location) {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('mock') === 'prescription_result') {
          setStatus('result');
          setResult({
            is_clear: true,
            confidence: 'medium',
            items: [
              {
                line_text_as_written: 'Concor 5mg tab 1x1',
                medicine_name_ar: 'كونكور 5 مجم',
                medicine_name_en: 'Concor 5mg',
                active_ingredient: 'بيسوبرولول',
                confidence: 'high',
                written_instructions: 'قرص واحد يومياً صباحاً قبل الإفطار',
                short_explanation: 'لعلاج ارتفاع ضغط الدم'
              },
              {
                line_text_as_written: '??? 500mg tid',
                medicine_name_ar: 'اسم غير واضح',
                medicine_name_en: 'Unclear Item',
                active_ingredient: 'غير محدد',
                confidence: 'low',
                written_instructions: 'يرجى مراجعة الصيدلي للتأكد من الاسم والجرعة',
                short_explanation: 'غير واضح، اسأل الصيدلي'
              }
            ],
            audio_summary: 'تحتوي الروشتة على دوائين، الأول كونكور بجرعة قرص صباحاً، والدواء الثاني غير واضح ويتطلب استشارة الصيدلي للتأكد منه.'
          });
        }
      } catch {
        // Ignore mock parsing errors
      }
    }
  }, []);

  // Camera mutex lock against double taps
  const isCapturingRef = useRef<boolean>(false);

  const processPrescriptionFile = async (file: File) => {
    speechController.stop();
    setStatus('processing');
    setLastFile(file);
    setErrorMessage(null);
    setErrorCategory(undefined);
    setErrorCode(undefined);

    try {
      if (onImageSelected) {
        await onImageSelected(file);
        return;
      }

      // High-res 1600px / 0.8 JPEG compression
      const compressed = await compressPrescriptionImage(file);

      // Edge prescription analysis
      const analysis = await analyzePrescriptionImage(compressed.base64);

      if (!analysis.is_clear || !analysis.items || analysis.items.length === 0) {
        setResult(analysis);
        setErrorCategory(analysis.error_category || 'unclear_image');
        setErrorCode(analysis.error_code);
        setErrorMessage(analysis.retake_message || analysis.raw_error || 'لم نتمكن من قراءة الروشتة بوضوح.');
        setStatus('unclear');
        return;
      }

      setResult(analysis);
      setStatus('result');
    } catch (err: unknown) {
      if (err instanceof AnalysisError) {
        setErrorCategory(err.category);
        setErrorCode(err.errorCode);
        setErrorMessage(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الروشتة.';
        const isTimeout = /timeout|30 ثانية|مهلة/i.test(msg);
        const isNetwork = /network|fetch|شبكة|اتصال/i.test(msg);

        if (isTimeout || isNetwork) {
          setErrorCategory('network_timeout');
          setErrorCode('CLIENT_TIMEOUT');
        } else {
          setErrorCategory('server_error');
        }
        setErrorMessage(msg);
      }
      setStatus('unclear');
    }
  };

  const handleCameraCapture = async () => {
    if (disabled || status === 'processing' || isCapturingRef.current) return;
    isCapturingRef.current = true;
    speechController.stop();

    try {
      const file = await capturePhoto();
      if (file) {
        await processPrescriptionFile(file);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'تعذر فتح الكاميرا');
    } finally {
      isCapturingRef.current = false;
    }
  };

  const handleGalleryPick = async () => {
    if (disabled || status === 'processing' || isCapturingRef.current) return;
    isCapturingRef.current = true;
    speechController.stop();

    try {
      const file = await pickPhoto();
      if (file) {
        await processPrescriptionFile(file);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'تعذر فتح ألبوم الصور');
    } finally {
      isCapturingRef.current = false;
    }
  };

  const handleReset = () => {
    speechController.stop();
    setStatus('idle');
    setResult(null);
    setLastFile(null);
    setErrorMessage(null);
    setSelectedMedicine(null);
  };

  const handleRetrySameImage = async () => {
    if (lastFile) {
      await processPrescriptionFile(lastFile);
    } else {
      handleReset();
    }
  };

  return (
    <div dir="rtl" className="w-full text-right space-y-6">
      {/* 1. Processing Loading State */}
      {status === 'processing' && (
        <LoadingSpinner />
      )}

      {/* 2. Unclear / Error State */}
      {status === 'unclear' && (
        <UnclearPhotoCard
          context="prescription"
          onRetry={handleRetrySameImage}
          onRetake={handleReset}
          errorMessage={errorMessage || undefined}
          errorCategory={errorCategory}
          errorCode={errorCode}
          hasLastImage={Boolean(lastFile)}
        />
      )}

      {/* 3. Idle State (Dual Buttons: Camera & Gallery) */}
      {status === 'idle' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border-2 border-blue-600 rounded-3xl p-6 shadow-xs">
            <h2 className="text-senior-xl font-bold text-blue-900 mb-2 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-700" strokeWidth={2} aria-hidden="true" />
              <span>قراءة الروشتة الطبية</span>
            </h2>
            <p className="text-senior-base text-slate-800 leading-relaxed font-medium">
              التقط صورة واضحة للروشتة أو اخترها من ألبوم الصور لقراءة أسماء الأدوية المكتوبة وشرح ما دونه الطبيب بدقة.
            </p>
          </div>

          {errorMessage && (
            <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 text-amber-600" />
              <p className="text-senior-base font-bold">{errorMessage}</p>
            </div>
          )}

          {/* Dual Action Controls (F09) */}
          <div className="space-y-4">
            {/* Primary Action: صوّر الروشتة بالكاميرا */}
            <button
              type="button"
              disabled={disabled}
              onClick={handleCameraCapture}
              className="w-full min-h-[96px] bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-3xl p-6 flex items-center justify-between shadow-md transition-all group"
              aria-label="صوّر الروشتة بالكاميرا"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Camera className="w-9 h-9 text-white" />
                </div>
                <div className="text-right">
                  <h3 className="text-senior-xl font-black">صوّر الروشتة بالكاميرا</h3>
                  <p className="text-sm text-blue-100 font-semibold mt-0.5">
                    استخدم الكاميرا لالتقاط صورة فورية للروشتة
                  </p>
                </div>
              </div>
            </button>

            {/* Secondary Action: اختر من المعرض */}
            <button
              type="button"
              disabled={disabled}
              onClick={handleGalleryPick}
              className="w-full min-h-[64px] bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-800 border-2 border-slate-300 rounded-2xl p-4 flex items-center justify-center gap-3 text-senior-base font-bold shadow-xs transition-all"
              aria-label="اختر من المعرض"
            >
              <Image className="w-6 h-6 text-slate-600" />
              <span>اختر من المعرض</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Result View */}
      {status === 'result' && result && (
        <PrescriptionResultView
          result={result}
          fontSize={fontSize}
          onRetake={handleReset}
          onSelectMedicine={(item) => setSelectedMedicine(item)}
          onFontSizeChange={onFontSizeChange}
        />
      )}

      {/* 5. Medicine Details Modal */}
      <MedicineDetailsModal
        item={selectedMedicine}
        isOpen={Boolean(selectedMedicine)}
        onClose={() => setSelectedMedicine(null)}
        fontSize={fontSize}
      />
    </div>
  );
};
