import {
  MedicineAnalysisResult,
  ErrorCategory,
  PrescriptionAnalysisResult
} from '../types';
import {
  cleanAndParseJson,
  parseMedicineAnalysisResult,
  validatePrescriptionJson
} from './geminiParser';
import {
  getCachedDetails,
  setCachedDetails
} from './detailsCache';

export interface GeminiVisionOptions {
  imageBase64: string;
  mimeType?: string;
  timeoutMs?: number;
}

export class AnalysisError extends Error {
  category: ErrorCategory;
  errorCode?: string;
  status?: number;
  detail?: string;

  constructor(
    message: string,
    options: {
      category: ErrorCategory;
      errorCode?: string;
      status?: number;
      detail?: string;
    }
  ) {
    super(message);
    this.name = 'AnalysisError';
    this.category = options.category;
    this.errorCode = options.errorCode;
    this.status = options.status;
    this.detail = options.detail;
  }
}

/**
 * Built-in verified sample mock result for demo / offline preview mode
 */
export const SAMPLE_MEDICATION_RESULT: MedicineAnalysisResult = {
  is_clear: true,
  medicine_name_ar: "بانادول إكسترا",
  medicine_name_en: "Panadol Extra (Paracetamol 500mg / Caffeine 65mg)",
  active_ingredient: "باراسيتامول ٥٠٠ مجم + كافيين ٦٥ مجم",
  uses: [
    "تسكين آلام الصداع والصداع النصفي الشديد",
    "تخفيف آلام المفاصل والعضلات والأسنان",
    "خفض درجات الحرارة المرتفعة ونزلات البرد"
  ],
  how_and_when: [
    "قرص أو قرصان مع كوب ماء كامل عند اللزوم",
    "يؤخذ بعد الأكل لتجنب اضطراب المعدة",
    "يُفضل عدم تناوله ليلاً قبل النوم لأنه يحتوي على كافيين منبه",
    "اترك فاصل ٦ إلى ٨ ساعات على الأقل بين كل جرعة وأخرى"
  ],
  usage_source: 'common',
  warnings: [
    "لا تتناول أكثر من ٨ أقراص خلال ٢٤ ساعة لتجنب الإضرار بالكبد",
    "لا تخلطه مع أدوية أخرى تحتوي على باراسيتامول",
    "استشر طبيبك فوراً إذا كنت تعاني من ارتفاع ضغط الدم أو مشاكل في الكبد"
  ],
  audio_summary: "دواء بانادول إكسترا، يحتوي على باراسيتامول لتسكين الألم وخفض الحرارة مع كافيين. الجرعة المعتادة قرص أو قرصان بعد الأكل عند اللزوم، ولا تتناوله قبل النوم مباشرة. احذر تناول أدوية أخرى تحتوي على باراسيتامول معه ولا تتجاوز الجرعة المحددة."
};

/**
 * Resolves the backend proxy endpoint URL for medicine boxes.
 * Defaults to relative '/api/analyze' for web, or absolute VITE_API_URL for native APK.
 */
export function getApiAnalyzeUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  return envUrl && envUrl.length > 0 ? envUrl : '/api/analyze';
}

/**
 * Resolves the backend proxy endpoint URL for prescriptions.
 */
export function getApiPrescriptionUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (envUrl && envUrl.length > 0) {
    if (envUrl.endsWith('/analyze')) {
      return envUrl.replace(/\/analyze$/, '/prescription');
    }
    if (envUrl.endsWith('/')) {
      return `${envUrl}api/prescription`;
    }
    return `${envUrl}/api/prescription`;
  }
  return '/api/prescription';
}

/**
 * Resolves the backend proxy endpoint URL for text-based medicine details.
 */
export function getApiDetailsUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (envUrl && envUrl.length > 0) {
    if (envUrl.endsWith('/analyze')) {
      return envUrl.replace(/\/analyze$/, '/details');
    }
    if (envUrl.endsWith('/')) {
      return `${envUrl}api/details`;
    }
    return `${envUrl}/api/details`;
  }
  return '/api/details';
}

/**
 * Converts a File or Blob into base64 string without data prefix
 */
export function fileToBase64(file: File | Blob): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(',');
      const base64 = commaIndex !== -1 ? result.substring(commaIndex + 1) : result;
      const mimeType = file.type || 'image/jpeg';
      resolve({ base64, mimeType });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Sends medication photo to the zero-secret serverless backend proxy (/api/analyze)
 * with a 30-second AbortController timeout, Worker debug field propagation, and AnalysisError throwing.
 */
export async function analyzeMedicationImage(options: GeminiVisionOptions): Promise<MedicineAnalysisResult> {
  const { imageBase64, mimeType = 'image/jpeg', timeoutMs = 30000 } = options;

  if (!imageBase64 || !imageBase64.trim()) {
    throw new Error('يرجى التقاط صورة واضحة لعلبة الدواء أولاً.');
  }

  const endpoint = getApiAnalyzeUrl();

  const payload = {
    image: imageBase64,
    mimeType
  };

  const controller = new AbortController();
  let isInternalTimeout = false;
  const timeoutTimer = setTimeout(() => {
    isInternalTimeout = true;
    controller.abort(new DOMException('Request timeout after 30000ms', 'AbortError'));
  }, timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const friendlyMessage =
        errorData?.retake_message ||
        errorData?.error ||
        `تعذر الاتصال بالمعالج الذكي (${response.status}). يرجى المحاولة مرة أخرى.`;

      const errorCode = errorData?.error_code || errorData?.error || `HTTP_${response.status}`;
      const detail = errorData?.detail;
      const status = response.status;
      const category: ErrorCategory =
        status === 504 || errorCode === 'CLIENT_TIMEOUT' || errorCode === 'UPSTREAM_TIMEOUT'
          ? 'network_timeout'
          : 'server_error';

      throw new AnalysisError(friendlyMessage, {
        category,
        errorCode,
        status,
        detail
      });
    }

    const data = await response.json();

    // If backend returns structured JSON object directly
    if (data && typeof data === 'object') {
      // Validate schema and apply client guardrails
      const rawText = JSON.stringify(data);
      return cleanAndParseJson(rawText);
    }

    return {
      is_clear: false,
      error_category: 'unclear_image',
      raw_error: 'لم نتمكن من التعرف على محتويات الصورة. يرجى تصوير واجهة علبة الدواء بشكل أوضح.'
    };
  } catch (err: unknown) {
    if (err instanceof AnalysisError) {
      throw err;
    }

    if (isInternalTimeout) {
      throw new AnalysisError(
        'استغرقت العملية أكثر من 30 ثانية. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة.',
        {
          category: 'network_timeout',
          errorCode: 'CLIENT_TIMEOUT'
        }
      );
    }

    if (err instanceof Error) {
      const isNetworkOrAbort =
        err.name === 'AbortError' ||
        err.name === 'TimeoutError' ||
        err instanceof TypeError ||
        err.message.includes('fetch') ||
        err.message.includes('NetworkError');

      console.error('[GeminiVisionProxy] Error:', err);
      throw new AnalysisError(err.message, {
        category: isNetworkOrAbort ? 'network_timeout' : 'server_error',
        errorCode: err.name === 'AbortError' ? 'ABORTED' : 'NETWORK_ERROR'
      });
    }

    const errorMsg = 'حدث خطأ غير متوقع أثناء معالجة الصورة.';
    console.error('[GeminiVisionProxy] Unknown Error:', err);
    throw new AnalysisError(errorMsg, {
      category: 'server_error',
      errorCode: 'UNKNOWN_ERROR'
    });
  } finally {
    clearTimeout(timeoutTimer);
  }
}

/**
 * Sends a prescription photo to the backend proxy (/api/prescription or mode: 'prescription')
 * with a 30-second AbortController timeout.
 * Strictly separates timeouts/server errors from unclear photos.
 */
export async function analyzePrescriptionImage(
  base64Image: string,
  signal?: AbortSignal
): Promise<PrescriptionAnalysisResult> {
  if (!base64Image || !base64Image.trim()) {
    throw new Error('يرجى التقاط صورة واضحة للروشتة أولاً.');
  }

  const endpoint = getApiPrescriptionUrl();
  const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  const controller = new AbortController();
  let isInternalTimeout = false;
  const timeoutTimer = setTimeout(() => {
    isInternalTimeout = true;
    controller.abort(new DOMException('Request timeout after 30000ms', 'AbortError'));
  }, 30000);

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener('abort', () => {
        controller.abort(signal.reason);
      });
    }
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        image: cleanBase64,
        mode: 'prescription'
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const status = response.status;
      const errorCode = errorData?.error_code || errorData?.error || `HTTP_${status}`;
      const isTimeout = status === 504 || errorCode === 'UPSTREAM_TIMEOUT' || errorCode === 'CLIENT_TIMEOUT';

      const friendlyMessage = isTimeout
        ? (errorData?.retake_message || 'استغرقت عملية التحليل وقتاً أطول من المتوقع في الخادم (25 ثانية). يرجى المحاولة مرة أخرى.')
        : (errorData?.retake_message || errorData?.error || `تعذر الاتصال بالمعالج الذكي (${status}). يرجى المحاولة مرة أخرى.`);

      const category: ErrorCategory = isTimeout ? 'network_timeout' : 'server_error';

      throw new AnalysisError(friendlyMessage, {
        category,
        errorCode,
        status,
        detail: errorData?.detail
      });
    }

    const data = await response.json();
    return validatePrescriptionJson(data);
  } catch (err: unknown) {
    if (err instanceof AnalysisError) {
      throw err;
    }

    if (isInternalTimeout) {
      throw new AnalysisError(
        'استغرقت عملية التحليل وقتاً أطول من المتوقع في الخادم (25 ثانية). يرجى المحاولة مرة أخرى.',
        {
          category: 'network_timeout',
          errorCode: 'CLIENT_TIMEOUT'
        }
      );
    }

    if (err instanceof Error) {
      const isNetwork =
        err.name === 'AbortError' ||
        err.name === 'TimeoutError' ||
        err instanceof TypeError ||
        err.message.includes('fetch') ||
        err.message.includes('NetworkError');

      throw new AnalysisError(err.message, {
        category: isNetwork ? 'network_timeout' : 'server_error',
        errorCode: err.name === 'AbortError' ? 'ABORTED' : 'NETWORK_ERROR'
      });
    }

    throw new AnalysisError('حدث خطأ غير متوقع أثناء معالجة صورة الروشتة.', {
      category: 'server_error',
      errorCode: 'UNKNOWN_ERROR'
    });
  } finally {
    clearTimeout(timeoutTimer);
  }
}

/**
 * Fetches standardized pharmaceutical details for a given medicine name (text mode, no image).
 * Checks the client-side cache first; on cache miss, calls Worker mode "details",
 * stores result in cache upon success, and returns parsed MedicineAnalysisResult.
 */
export async function fetchMedicineDetails(
  medicineName: string,
  signal?: AbortSignal
): Promise<MedicineAnalysisResult> {
  const cleanName = (medicineName || '').trim();
  if (!cleanName) {
    throw new Error('يرجى إدخال اسم الدواء لعرض التفاصيل.');
  }

  // 1. Check client-side cache (0ms latency on cache hit)
  const cached = getCachedDetails(cleanName);
  if (cached) {
    return cached;
  }

  // 2. Cache miss -> fetch from backend
  const endpoint = getApiDetailsUrl();
  const controller = new AbortController();
  let isInternalTimeout = false;
  const timeoutTimer = setTimeout(() => {
    isInternalTimeout = true;
    controller.abort(new DOMException('Request timeout after 30000ms', 'AbortError'));
  }, 30000);

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener('abort', () => {
        controller.abort(signal.reason);
      });
    }
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        medicine_name: cleanName,
        mode: 'details'
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const status = response.status;
      const errorCode = errorData?.error_code || errorData?.error || `HTTP_${status}`;
      const isTimeout = status === 504 || errorCode === 'UPSTREAM_TIMEOUT' || errorCode === 'CLIENT_TIMEOUT';

      const friendlyMessage = isTimeout
        ? (errorData?.retake_message || 'استغرقت عملية التحليل وقتاً أطول من المتوقع في الخادم (25 ثانية). يرجى المحاولة مرة أخرى.')
        : (errorData?.retake_message || errorData?.error || `تعذر الاتصال بالمعالج الذكي (${status}). يرجى المحاولة مرة أخرى.`);

      throw new AnalysisError(friendlyMessage, {
        category: isTimeout ? 'network_timeout' : 'server_error',
        errorCode,
        status,
        detail: errorData?.detail
      });
    }

    const data = await response.json();
    const result = parseMedicineAnalysisResult(data);

    // If successfully returned clear results, cache in localStorage
    if (result.is_clear) {
      setCachedDetails(cleanName, result);
    }

    return result;
  } catch (err: unknown) {
    if (err instanceof AnalysisError) {
      throw err;
    }

    if (isInternalTimeout) {
      throw new AnalysisError(
        'استغرقت عملية التحليل وقتاً أطول من المتوقع في الخادم (25 ثانية). يرجى المحاولة مرة أخرى.',
        {
          category: 'network_timeout',
          errorCode: 'CLIENT_TIMEOUT'
        }
      );
    }

    if (err instanceof Error) {
      const isNetwork =
        err.name === 'AbortError' ||
        err.name === 'TimeoutError' ||
        err instanceof TypeError ||
        err.message.includes('fetch') ||
        err.message.includes('NetworkError');

      throw new AnalysisError(err.message, {
        category: isNetwork ? 'network_timeout' : 'server_error',
        errorCode: err.name === 'AbortError' ? 'ABORTED' : 'NETWORK_ERROR'
      });
    }

    throw new AnalysisError('حدث خطأ غير متوقع أثناء استرجاع تفاصيل الدواء.', {
      category: 'server_error',
      errorCode: 'UNKNOWN_ERROR'
    });
  } finally {
    clearTimeout(timeoutTimer);
  }
}
