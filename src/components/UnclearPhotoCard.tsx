import React from 'react';
import {
  AlertTriangle,
  RefreshCw,
  SunMedium,
  Focus,
  Smartphone,
  WifiOff,
  ServerCrash,
  FileCode,
  Camera,
  Home
} from 'lucide-react';
import { ErrorCategory } from '../types';

export interface UnclearPhotoCardProps {
  onRetry?: () => void;
  onRetake?: () => void;
  errorMessage?: string;
  errorCategory?: ErrorCategory;
  errorCode?: string;
  hasLastImage?: boolean;
  context?: 'box' | 'prescription';
  retakeButtonLabel?: string;
  isRetrying?: boolean;
}

export const UnclearPhotoCard: React.FC<UnclearPhotoCardProps> = ({
  onRetry,
  onRetake,
  errorMessage,
  errorCategory,
  errorCode,
  hasLastImage: _hasLastImage = false,
  context = 'box',
  retakeButtonLabel,
  isRetrying = false
}) => {
  // Infer category if not explicitly provided
  const category: ErrorCategory = errorCategory || (() => {
    if (errorMessage && (/timeout|30 ثانية|مهلة|network|fetch|شبكة|اتصال/i.test(errorMessage))) {
      return 'network_timeout';
    }
    if (errorMessage && (/خادم|server|500|502|503|504|UPSTREAM/i.test(errorMessage))) {
      return 'server_error';
    }
    if (errorMessage && (/JSON|قراءة رد|syntax/i.test(errorMessage))) {
      return 'invalid_json';
    }
    return 'unclear_image';
  })();

  const isPrescription = context === 'prescription' || (errorMessage && /روشتة/i.test(errorMessage));

  const handleRetry = onRetry || onRetake || (() => {});
  const handleRetake = onRetake || onRetry || (() => {});

  // State (a): Network / Timeout
  if (category === 'network_timeout') {
    return (
      <div
        role="alert"
        className="w-full bg-amber-50 dark:bg-[#3A2E12] border-3 border-amber-500 dark:border-amber-600 rounded-3xl p-6 sm:p-8 shadow-senior my-6 text-right animate-in fade-in duration-200"
      >
        <div className="flex items-center gap-3 mb-4 text-amber-800 dark:text-[#F5D58A]">
          <WifiOff className="w-10 h-10 text-amber-600 dark:text-[#F5D58A] flex-shrink-0" />
          <h2 className="text-senior-2xl font-bold">
            تعذر الاتصال بالشبكة أو انتهت مهلة الطلب
          </h2>
        </div>

        <p className="text-senior-lg text-slate-800 dark:text-[#E6EEF0] mb-6 leading-relaxed">
          {errorMessage || 'استغرق الاتصال بالخادم وقتاً أطول من المعتاد (أكثر من 30 ثانية) أو انقطع الاتصال بالإنترنت. يرجى التحقق من اتصال الشبكة ثم إعادة المحاولة.'}
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="btn-primary w-full min-h-[64px] sm:min-h-[72px] flex items-center justify-center gap-3 text-senior-xl font-bold bg-teal-700 hover:bg-teal-800 dark:bg-[#3DB8C4] dark:hover:bg-[#349fa8] text-white dark:text-[#0E1517] disabled:opacity-50"
            aria-label="إعادة المحاولة الآن"
          >
            <RefreshCw className="w-7 h-7" />
            <span>🔄 إعادة المحاولة الآن</span>
          </button>

          {onRetake && (
            <button
              type="button"
              onClick={handleRetake}
              className="btn-secondary w-full min-h-[64px] flex items-center justify-center gap-3 text-senior-lg font-bold bg-white dark:bg-[#162124] text-slate-700 dark:text-[#E6EEF0] border-2 border-slate-300 dark:border-[#1D2B2F] hover:bg-slate-100 dark:hover:bg-[#1D2B2F]"
              aria-label={isPrescription ? "تصوير روشتة أخرى" : "تصوير علبة أخرى"}
            >
              <Camera className="w-6 h-6" />
              <span>📷 {isPrescription ? "تصوير روشتة أخرى" : "تصوير علبة أخرى"}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // State (b): Server Error
  if (category === 'server_error') {
    return (
      <div
        role="alert"
        className="w-full bg-rose-50 dark:bg-[#3A1418] border-3 border-rose-500 dark:border-rose-700 rounded-3xl p-6 sm:p-8 shadow-senior my-6 text-right animate-in fade-in duration-200"
      >
        <div className="flex items-center gap-3 mb-4 text-rose-800 dark:text-rose-200">
          <ServerCrash className="w-10 h-10 text-rose-600 dark:text-rose-300 flex-shrink-0" />
          <h2 className="text-senior-2xl font-bold">
            حدث خطأ في الخادم الطبي الذكي
          </h2>
        </div>

        <p className="text-senior-lg text-slate-800 dark:text-[#E6EEF0] mb-4 leading-relaxed">
          {errorMessage || 'نواجه صعوبة مؤقتة في التواصل مع المعالج الطبي الذكي. يرجى المحاولة مرة أخرى بعد قليل.'}
        </p>

        {errorCode && (
          <div className="mb-6">
            <span
              data-testid="error-code-badge"
              className="inline-flex items-center gap-2 bg-rose-100 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-700 rounded-xl px-4 py-2 font-mono text-senior-sm font-bold"
            >
              <span>رمز الخطأ:</span>
              <span>{errorCode}</span>
            </span>
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="btn-primary w-full min-h-[64px] sm:min-h-[72px] flex items-center justify-center gap-3 text-senior-xl font-bold bg-teal-700 hover:bg-teal-800 dark:bg-[#3DB8C4] dark:hover:bg-[#349fa8] text-white dark:text-[#0E1517] disabled:opacity-50"
            aria-label="إعادة المحاولة الآن"
          >
            <RefreshCw className="w-7 h-7" />
            <span>🔄 إعادة المحاولة الآن</span>
          </button>

          {onRetake && (
            <button
              type="button"
              onClick={handleRetake}
              className="btn-secondary w-full min-h-[64px] flex items-center justify-center gap-3 text-senior-lg font-bold bg-white dark:bg-[#162124] text-slate-700 dark:text-[#E6EEF0] border-2 border-slate-300 dark:border-[#1D2B2F] hover:bg-slate-100 dark:hover:bg-[#1D2B2F]"
              aria-label="العودة للرئيسية"
            >
              <Home className="w-6 h-6" />
              <span>🏠 العودة للرئيسية</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // State (d): Invalid JSON
  if (category === 'invalid_json') {
    return (
      <div
        role="alert"
        className="w-full bg-indigo-50 dark:bg-[#1D2B2F] border-3 border-indigo-500 dark:border-indigo-400 rounded-3xl p-6 sm:p-8 shadow-senior my-6 text-right animate-in fade-in duration-200"
      >
        <div className="flex items-center gap-3 mb-4 text-indigo-800 dark:text-indigo-300">
          <FileCode className="w-10 h-10 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <h2 className="text-senior-2xl font-bold">
            تعذر قراءة رد المعالج الذكي
          </h2>
        </div>

        <p className="text-senior-lg text-slate-800 dark:text-[#E6EEF0] mb-6 leading-relaxed">
          {errorMessage || 'استلم التطبيق بيانات غير مكتملة أو غير صالحة من المعالج الذكي. يرجى الضغط على زر إعادة المحاولة لقراءة العلبة مجدداً.'}
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="btn-primary w-full min-h-[64px] sm:min-h-[72px] flex items-center justify-center gap-3 text-senior-xl font-bold bg-teal-700 hover:bg-teal-800 dark:bg-[#3DB8C4] dark:text-[#0E1517] dark:hover:bg-[#329ba6] disabled:opacity-50"
            aria-label="إعادة المحاولة الآن"
          >
            <RefreshCw className="w-7 h-7" />
            <span>🔄 إعادة المحاولة الآن</span>
          </button>

          {onRetake && (
            <button
              type="button"
              onClick={handleRetake}
              className="btn-secondary w-full min-h-[64px] flex items-center justify-center gap-3 text-senior-lg font-bold bg-white dark:bg-[#162124] text-slate-700 dark:text-[#E6EEF0] border-2 border-slate-300 dark:border-[#1D2B2F] hover:bg-slate-100 dark:hover:bg-[#1D2B2F]"
              aria-label={isPrescription ? "تصوير روشتة أخرى" : "تصوير دواء آخر"}
            >
              <Camera className="w-6 h-6" />
              <span>📷 {isPrescription ? "تصوير روشتة أخرى" : "تصوير دواء آخر"}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Default: State (c) unclear_image
  const defaultExplanation = isPrescription
    ? 'الصورة غير واضحة للأسف، ساعدنا بإعادة التقاطها لنتمكن من قراءتها بدقة'
    : 'لم نتمكن من قراءة اسم الدواء بدقة. من أجل سلامتكم وصحتكم، يرجى إعادة التقاط الصورة باتباع النصائح التالية:';

  const defaultButtonLabel = isPrescription
    ? 'إعادة التصوير'
    : 'إعادة تصوير العلبة الآن';

  const defaultAriaLabel = isPrescription
    ? 'إعادة التصوير'
    : 'إعادة تصوير علبة الدواء الآن';

  return (
    <div
      role="alert"
      className="w-full bg-amber-50 dark:bg-[#3A2E12] border-3 border-amber-500 dark:border-amber-600 rounded-3xl p-6 sm:p-8 shadow-senior my-6 text-right animate-in fade-in duration-200"
    >
      <div className="flex items-center gap-3 mb-4 text-amber-800 dark:text-[#F5D58A]">
        <AlertTriangle className="w-10 h-10 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <h2 className="text-senior-2xl font-bold">
          الصورة غير واضحة بما يكفي
        </h2>
      </div>

      <p className="text-senior-lg text-slate-800 dark:text-[#F5D58A] mb-6 leading-relaxed">
        {errorMessage || defaultExplanation}
      </p>

      {/* Exactly 3 concrete tips container */}
      <div className="bg-white dark:bg-[#162124] rounded-2xl p-4 sm:p-5 border border-amber-200 dark:border-[#1D2B2F] mb-6 space-y-3">
        {isPrescription ? (
          <>
            <div className="flex items-center gap-3 text-slate-800 dark:text-[#E6EEF0]">
              <SunMedium className="w-7 h-7 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="text-senior-base font-semibold">
                الإضاءة: التأكد من إضاءة الغرفة بشكل كافٍ بدون ظلال أو لمعان شديد.
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-800 dark:text-[#E6EEF0]">
              <Focus className="w-7 h-7 text-teal-600 dark:text-[#3DB8C4] flex-shrink-0" />
              <span className="text-senior-base font-semibold">
                الإطار: إظهار الروشتة أو العلبة كاملة داخل الإطار والتأكد من وضوح الكلام.
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-800 dark:text-[#E6EEF0]">
              <Smartphone className="w-7 h-7 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="text-senior-base font-semibold">
                الثبات: تثبيت الهاتف باليدين وعدم الاهتزاز أثناء التصوير.
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 text-slate-800 dark:text-[#E6EEF0]">
              <SunMedium className="w-7 h-7 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="text-senior-base font-semibold">
                تأكد من وجود إضاءة كافية فوق علبة الدواء.
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-800 dark:text-[#E6EEF0]">
              <Focus className="w-7 h-7 text-teal-600 dark:text-[#3DB8C4] flex-shrink-0" />
              <span className="text-senior-base font-semibold">
                قرّب الكاميرا واجعل اسم الدواء في منتصف الشاشة.
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-800 dark:text-[#E6EEF0]">
              <Smartphone className="w-7 h-7 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="text-senior-base font-semibold">
                ثبّت الهاتف باليدين لمنع الاهتزاز أثناء التقاط الصورة.
              </span>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={handleRetake}
        disabled={isRetrying}
        className="btn-primary w-full min-h-[64px] sm:min-h-[72px] flex items-center justify-center gap-3 text-senior-xl font-bold bg-teal-700 hover:bg-teal-800 dark:bg-[#3DB8C4] dark:text-[#0E1517] dark:hover:bg-[#329ba6] disabled:opacity-50"
        aria-label={retakeButtonLabel || defaultAriaLabel}
      >
        <RefreshCw className="w-7 h-7" />
        <span>📷 {retakeButtonLabel || defaultButtonLabel}</span>
      </button>
    </div>
  );
};
