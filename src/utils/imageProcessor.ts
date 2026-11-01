/**
 * Image Processor Utility for Dalili Medication Guide
 *
 * Implements Android WebView-safe image compression, dimension clamping,
 * solid white backdrop (preventing black transparency artifacts),
 * and empirical blank/black frame detection.
 */

export const MAX_IMAGE_DIMENSION = 1024;
export const JPEG_COMPRESSION_QUALITY = 0.75;
export const MIN_VALID_BASE64_LENGTH = 500;

export interface CompressedImage {
  base64: string;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
  sizeBytes: number;
}

export type ProcessedImage = CompressedImage;


/**
 * Validates that a base64 string starts with the standard JPEG SOI header (/9j/).
 */
export function isValidJpegBase64(base64: string): boolean {
  if (!base64 || typeof base64 !== 'string') return false;
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  return clean.trim().startsWith('/9j/');
}

/**
 * Samples a 10x10 pixel grid on the canvas context to detect and reject
 * completely pitch-black captures (e.g. covered camera lens) or solid blank white frames.
 */
export function verifyNotBlackOrBlank(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): boolean {
  if (!ctx || width <= 0 || height <= 0) return false;

  const sampleSteps = 10;
  const stepX = Math.max(1, Math.floor(width / sampleSteps));
  const stepY = Math.max(1, Math.floor(height / sampleSteps));

  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, width, height);
  } catch {
    // If getImageData is restricted or unavailable
    return true;
  }

  if (!imageData || !imageData.data) return false;
  const data = imageData.data;

  let totalLum = 0;
  let minLum = 255;
  let maxLum = 0;
  let samples = 0;
  let nonBlackCount = 0;

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const idx = (y * width + x) * 4;
      if (idx + 2 < data.length) {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        // Standard Rec. 601 luma calculation
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        totalLum += lum;
        if (lum < minLum) minLum = lum;
        if (lum > maxLum) maxLum = lum;
        samples++;
        if (lum > 8) {
          nonBlackCount++;
        }
      }
    }
  }

  const avgLum = totalLum / (samples || 1);

  // Reject pitch black: average luminance < 5 or virtually no non-black pixels
  if (nonBlackCount === 0 || avgLum < 5) {
    return false;
  }

  // Reject pure blank washed-out white: variance is zero and average luminance > 250
  if (maxLum - minLum === 0 && avgLum > 250) {
    return false;
  }

  return true;
}

/**
 * Clamps dimensions to max 1024px while strictly preserving aspect ratio.
 */
export function calculateClampedDimensions(
  width: number,
  height: number,
  maxDimension = MAX_IMAGE_DIMENSION
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }

  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const scale = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  };
}

/**
 * Dual-mode image compression utility for Dalili Medication Guide.
 * Clamps dimensions to maxDimension while preserving aspect ratio,
 * fills a solid #FFFFFF backdrop to eliminate Android WebView black transparency bugs,
 * runs 10x10 grid verification against black/blank frames,
 * and encodes to JPEG with the requested quality.
 */
export async function compressImage(
  input: File | Blob | string,
  maxDimension = 1024,
  quality = 0.7
): Promise<CompressedImage> {
  let objectUrl: string | null = null;
  let sourceSrc: string;

  if (typeof input === 'string') {
    sourceSrc = input.startsWith('data:') ? input : `data:image/jpeg;base64,${input}`;
  } else {
    objectUrl = URL.createObjectURL(input);
    sourceSrc = objectUrl;
  }

  try {
    const img = new Image();
    img.src = sourceSrc;

    if (typeof img.decode === 'function') {
      try {
        await img.decode();
      } catch {
        // Fallback for environments where decode() fails on data/blob URLs
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('تعذر تحميل بيانات الصورة المحددة.'));
        });
      }
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('تعذر تحميل بيانات الصورة المحددة.'));
      });
    }

    const { naturalWidth, naturalHeight } = img;
    const width = naturalWidth || img.width;
    const height = naturalHeight || img.height;

    if (!width || !height || width <= 0 || height <= 0) {
      throw new Error('أبعاد الصورة الملتقطة غير صالحة.');
    }

    const { width: targetWidth, height: targetHeight } = calculateClampedDimensions(width, height, maxDimension);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('تعذر إنشاء سياق معالجة الصور في المتصفح.');
    }

    // Solid white backdrop to eliminate Android WebView black transparency artifacts
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // 10x10 Grid Pixel Sample Check
    const isVisible = verifyNotBlackOrBlank(ctx, targetWidth, targetHeight);
    if (!isVisible) {
      throw new Error('الصورة الملتقطة تبدو مظلمة جداً أو فارغة تماماً (شاشة سوداء). يرجى التأكد من تشغيل الإضاءة وإعادة التصوير.');
    }

    // Convert to JPEG with specified quality
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const commaIndex = dataUrl.indexOf(',');
    const base64 = commaIndex !== -1 ? dataUrl.substring(commaIndex + 1) : dataUrl;

    if (!isValidJpegBase64(base64)) {
      throw new Error('صيغة الصورة الناتجة غير صالحة (JPEG Header Missing).');
    }

    if (base64.length < MIN_VALID_BASE64_LENGTH) {
      throw new Error('حجم بيانات الصورة صغير جداً وغير صالح.');
    }

    return {
      base64,
      mimeType: 'image/jpeg',
      width: targetWidth,
      height: targetHeight,
      sizeBytes: Math.round((base64.length * 3) / 4)
    };
  } finally {
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // Ignore revoke errors in environments where mock doesn't support it
      }
    }
  }
}

/**
 * Compresses prescription images with high resolution (max 1600px) and quality 0.8
 * to preserve fine cursive medical handwriting and numbers.
 */
export async function compressPrescriptionImage(
  file: File | Blob | string
): Promise<CompressedImage> {
  return compressImage(file, 1600, 0.8);
}

export const processAndValidatePrescriptionImage = compressPrescriptionImage;

/**
 * Processes an input image (File, Blob, or string) for medicine boxes, enforces dimension clamping to 1024px,
 * renders a solid white backdrop to avoid Android WebView black transparency bugs,
 * compresses to JPEG quality 0.75, and performs strict output and pixel verification.
 */
export async function processAndValidateImage(
  input: File | Blob | string
): Promise<ProcessedImage> {
  return compressImage(input, MAX_IMAGE_DIMENSION, JPEG_COMPRESSION_QUALITY);
}

