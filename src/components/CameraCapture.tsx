import React, { useState } from 'react';
import { Camera, Image, Sparkles, AlertTriangle } from 'lucide-react';
import { capturePhoto, pickPhoto } from '../services/nativeCamera';

interface CameraCaptureProps {
  onImageSelected: (file: File) => void;
  disabled?: boolean;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageSelected, disabled = false }) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCameraCapture = async () => {
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

  const isButtonDisabled = disabled || isCapturing;

  return (
    <div className="w-full space-y-4 my-6">
      {/* Friendly error alert for permission denials or device issues */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-2xl p-4 text-senior-base font-bold flex items-start justify-between gap-3 shadow-xs"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-amber-800 hover:text-amber-950 font-extrabold px-2 py-1 rounded-lg"
            aria-label="إغلاق التنبيه"
          >
            ✕
          </button>
        </div>
      )}

      {/* Massive Primary Action Button - Native Rear Camera */}
      <button
        type="button"
        disabled={isButtonDisabled}
        onClick={handleCameraCapture}
        className="w-full min-h-[76px] sm:min-h-[84px] bg-teal-600 hover:bg-teal-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-3xl p-5 flex items-center justify-center gap-4 text-senior-xl sm:text-senior-2xl font-extrabold shadow-senior ring-4 ring-teal-100 transition-all border-2 border-teal-700"
        aria-label="صوّر علبة الدواء الآن باستخدام الكاميرا"
      >
        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <Camera className="w-8 h-8 text-white" aria-hidden="true" />
        </div>
        <span>📷 صوّر علبة الدواء الآن</span>
      </button>

      {/* Secondary Gallery Picker Option - Native Photos Picker */}
      <button
        type="button"
        disabled={isButtonDisabled}
        onClick={handleGalleryPick}
        className="w-full min-h-[64px] bg-white hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 border-2 border-slate-300 rounded-2xl p-4 flex items-center justify-center gap-3 text-senior-lg font-bold shadow-sm transition-all"
        aria-label="أو اختيار صورة محفوظة مسبقاً من الألبوم"
      >
        <Image className="w-7 h-7 text-slate-700" aria-hidden="true" />
        <span>📁 أو اختر صورة من الألبوم</span>
      </button>

      <div className="flex items-center justify-center gap-2 text-slate-600 text-senior-base pt-2">
        <Sparkles className="w-5 h-5 text-teal-600" />
        <span>التصوير المباشر يسهل قراءة الدواء فوراً</span>
      </div>
    </div>
  );
};
