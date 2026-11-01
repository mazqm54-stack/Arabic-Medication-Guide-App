import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateClampedDimensions,
  isValidJpegBase64,
  verifyNotBlackOrBlank,
  compressImage,
  compressPrescriptionImage,
  processAndValidateImage,
  processAndValidatePrescriptionImage,
  MAX_IMAGE_DIMENSION,
  JPEG_COMPRESSION_QUALITY,
  MIN_VALID_BASE64_LENGTH,
  CompressedImage
} from '../src/utils/imageProcessor';
import {
  normalizeMedicineName,
  getCacheKey,
  getCachedDetails,
  setCachedDetails,
  clearDetailsCache,
  DETAILS_CACHE_PREFIX
} from '../src/services/detailsCache';
import { MedicineAnalysisResult } from '../src/types';

// Standard mock JPEG payload (> 500 chars, starting with /9j/)
const SYNTHETIC_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEASABIAAD/' + 'A'.repeat(550);
const SYNTHETIC_JPEG_DATA_URL = `data:image/jpeg;base64,${SYNTHETIC_JPEG_BASE64}`;

const sampleMedicineResult: MedicineAnalysisResult = {
  is_clear: true,
  medicine_name_ar: 'بانادول إكسترا',
  medicine_name_en: 'Panadol Extra',
  active_ingredient: 'باراسيتامول + كافيين',
  uses: ['تسكين الآلام', 'خفض درجة الحرارة'],
  how_and_when: [
    'قرص إلى قرصين كل 6-8 ساعات بعد الأكل',
    'يؤخذ القرص عبر الفم مع كوب ماء كامل',
    'يُفضل تناوله في نفس الموعد يومياً'
  ],
  usage_source: 'common',
  warnings: ['لا تتناول أكثر من 8 أقراص يومياً', 'استشر الطبيب في حال استمرار الأعراض'],
  audio_summary: 'بانادول إكسترا مسكن للصداع والحمى'
};

describe('Milestone M2 Challenger 1: Image Compression & Details Cache Adversarial Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDetailsCache();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearDetailsCache();
    window.localStorage.clear();
  });

  // =========================================================================
  // 1. Extreme Dimensions & Aspect Ratio Preservation
  // =========================================================================
  describe('1. Extreme Image Dimensions & Aspect Ratio Preservation', () => {
    describe('1.1 Mathematical Clamping (calculateClampedDimensions)', () => {
      it('clamps extreme landscape 16000x1000 to max 1600 preserving 16:1 aspect ratio', () => {
        const { width, height } = calculateClampedDimensions(16000, 1000, 1600);
        expect(width).toBe(1600);
        expect(height).toBe(100);
        expect(width / height).toBeCloseTo(16000 / 1000, 5);
      });

      it('clamps extreme portrait 1000x16000 to max 1600 preserving 1:16 aspect ratio', () => {
        const { width, height } = calculateClampedDimensions(1000, 16000, 1600);
        expect(width).toBe(100);
        expect(height).toBe(1600);
        expect(width / height).toBeCloseTo(1000 / 16000, 5);
      });

      it('clamps extreme landscape 16000x1000 to default max 1024 preserving aspect ratio', () => {
        const { width, height } = calculateClampedDimensions(16000, 1000, 1024);
        expect(width).toBe(1024);
        expect(height).toBe(64); // Math.round(1000 * 1024 / 16000) = 64
        expect(width / height).toBeCloseTo(16000 / 1000, 1);
      });

      it('clamps extreme portrait 1000x16000 to default max 1024 preserving aspect ratio', () => {
        const { width, height } = calculateClampedDimensions(1000, 16000, 1024);
        expect(width).toBe(64);
        expect(height).toBe(1024);
        expect(width / height).toBeCloseTo(1000 / 16000, 1);
      });

      it('does NOT upscale very small images (100x100) under max 1600 or max 1024', () => {
        const res1600 = calculateClampedDimensions(100, 100, 1600);
        expect(res1600).toEqual({ width: 100, height: 100 });

        const res1024 = calculateClampedDimensions(100, 100, 1024);
        expect(res1024).toEqual({ width: 100, height: 100 });
      });

      it('does NOT upscale single pixel image (1x1)', () => {
        expect(calculateClampedDimensions(1, 1, 1600)).toEqual({ width: 1, height: 1 });
      });

      it('preserves exact boundary dimension 1600x1600 under max 1600', () => {
        const { width, height } = calculateClampedDimensions(1600, 1600, 1600);
        expect(width).toBe(1600);
        expect(height).toBe(1600);
      });

      it('preserves exact boundary dimension 1600x1200 and 1200x1600 under max 1600', () => {
        expect(calculateClampedDimensions(1600, 1200, 1600)).toEqual({ width: 1600, height: 1200 });
        expect(calculateClampedDimensions(1200, 1600, 1600)).toEqual({ width: 1200, height: 1600 });
      });

      it('clamps boundary+1 (1601x1601) down to 1600x1600', () => {
        const { width, height } = calculateClampedDimensions(1601, 1601, 1600);
        expect(width).toBe(1600);
        expect(height).toBe(1600);
      });

      it('leaves boundary-1 (1599x1599) unscaled under max 1600', () => {
        expect(calculateClampedDimensions(1599, 1599, 1600)).toEqual({ width: 1599, height: 1599 });
      });

      it('clamps 4K 16:9 ultra-wide (3840x2160) to 1600x900 preserving aspect ratio', () => {
        const { width, height } = calculateClampedDimensions(3840, 2160, 1600);
        expect(width).toBe(1600);
        expect(height).toBe(900);
        expect(width / height).toBeCloseTo(16 / 9, 3);
      });

      it('clamps 4K 9:16 portrait (2160x3840) to 900x1600 preserving aspect ratio', () => {
        const { width, height } = calculateClampedDimensions(2160, 3840, 1600);
        expect(width).toBe(900);
        expect(height).toBe(1600);
        expect(width / height).toBeCloseTo(9 / 16, 3);
      });

      it('handles panoramic ribbon (20000x500) clamping to 1600x40', () => {
        const { width, height } = calculateClampedDimensions(20000, 500, 1600);
        expect(width).toBe(1600);
        expect(height).toBe(40);
      });

      it('handles tall receipt scroll (500x20000) clamping to 40x1600', () => {
        const { width, height } = calculateClampedDimensions(500, 20000, 1600);
        expect(width).toBe(40);
        expect(height).toBe(1600);
      });

      it('handles fractional float inputs and returns rounded integers', () => {
        const { width, height } = calculateClampedDimensions(1999.7, 1499.3, 1600);
        expect(Number.isInteger(width)).toBe(true);
        expect(Number.isInteger(height)).toBe(true);
        expect(width).toBe(1600);
        expect(height).toBe(1200);
      });

      it('handles zero, negative, and degenerate dimensions safely by returning 0x0', () => {
        expect(calculateClampedDimensions(0, 0, 1600)).toEqual({ width: 0, height: 0 });
        expect(calculateClampedDimensions(-100, 1600, 1600)).toEqual({ width: 0, height: 0 });
        expect(calculateClampedDimensions(1600, -100, 1600)).toEqual({ width: 0, height: 0 });
        expect(calculateClampedDimensions(-50, -50, 1600)).toEqual({ width: 0, height: 0 });
      });
    });

    describe('1.2 End-to-End Compression Dimension Clamping (compressPrescriptionImage)', () => {
      it('clamps an extreme 16000x1000 input image to target dimensions 1600x100 in pipeline', async () => {
        vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(function (this: HTMLImageElement) {
          Object.defineProperty(this, 'naturalWidth', { value: 16000, configurable: true });
          Object.defineProperty(this, 'naturalHeight', { value: 1000, configurable: true });
          return Promise.resolve();
        });

        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(SYNTHETIC_JPEG_DATA_URL);

        const blob = new Blob(['extreme-wide-prescription'], { type: 'image/jpeg' });
        const result = await compressPrescriptionImage(blob);

        expect(result.width).toBe(1600);
        expect(result.height).toBe(100);
        expect(result.width / result.height).toBeCloseTo(16000 / 1000, 3);
      });

      it('clamps an extreme 1000x16000 input image to target dimensions 100x1600 in pipeline', async () => {
        vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(function (this: HTMLImageElement) {
          Object.defineProperty(this, 'naturalWidth', { value: 1000, configurable: true });
          Object.defineProperty(this, 'naturalHeight', { value: 16000, configurable: true });
          return Promise.resolve();
        });

        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(SYNTHETIC_JPEG_DATA_URL);

        const blob = new Blob(['extreme-tall-prescription'], { type: 'image/jpeg' });
        const result = await compressPrescriptionImage(blob);

        expect(result.width).toBe(100);
        expect(result.height).toBe(1600);
        expect(result.width / result.height).toBeCloseTo(1000 / 16000, 3);
      });

      it('maintains 100x100 without upscaling in compressPrescriptionImage', async () => {
        vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(function (this: HTMLImageElement) {
          Object.defineProperty(this, 'naturalWidth', { value: 100, configurable: true });
          Object.defineProperty(this, 'naturalHeight', { value: 100, configurable: true });
          return Promise.resolve();
        });

        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(SYNTHETIC_JPEG_DATA_URL);

        const blob = new Blob(['small-prescription'], { type: 'image/jpeg' });
        const result = await compressPrescriptionImage(blob);

        expect(result.width).toBe(100);
        expect(result.height).toBe(100);
      });

      it('preserves exact 1600x1600 boundary in compressPrescriptionImage', async () => {
        vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(function (this: HTMLImageElement) {
          Object.defineProperty(this, 'naturalWidth', { value: 1600, configurable: true });
          Object.defineProperty(this, 'naturalHeight', { value: 1600, configurable: true });
          return Promise.resolve();
        });

        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(SYNTHETIC_JPEG_DATA_URL);

        const blob = new Blob(['boundary-square-prescription'], { type: 'image/jpeg' });
        const result = await compressPrescriptionImage(blob);

        expect(result.width).toBe(1600);
        expect(result.height).toBe(1600);
      });

      it('rejects image with zero natural dimensions (0x0)', async () => {
        vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(function (this: HTMLImageElement) {
          Object.defineProperty(this, 'naturalWidth', { value: 0, configurable: true });
          Object.defineProperty(this, 'naturalHeight', { value: 0, configurable: true });
          return Promise.resolve();
        });

        const blob = new Blob(['zero-dimension-image'], { type: 'image/jpeg' });
        await expect(compressPrescriptionImage(blob)).rejects.toThrow('أبعاد الصورة الملتقطة غير صالحة.');
      });
    });
  });

  // =========================================================================
  // 2. Base64 JPEG Header /9j/ Verification & Payload Integrity
  // =========================================================================
  describe('2. Base64 JPEG Header /9j/ Verification & Payload Integrity', () => {
    describe('2.1 Magic Byte Detection (isValidJpegBase64)', () => {
      it('accepts raw base64 string starting with standard JPEG magic bytes /9j/', () => {
        const validRaw = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...';
        expect(isValidJpegBase64(validRaw)).toBe(true);
      });

      it('accepts full data URL with image/jpeg MIME prefix and /9j/ header', () => {
        const validDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...';
        expect(isValidJpegBase64(validDataUrl)).toBe(true);
      });

      it('accepts base64 with surrounding whitespace, tabs, and newlines', () => {
        const padded = '  \n\t /9j/4AAQSkZJRg== \r\n ';
        expect(isValidJpegBase64(padded)).toBe(true);
      });

      it('rejects PNG base64 payloads starting with iVBOR', () => {
        const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        expect(isValidJpegBase64(png)).toBe(false);
        expect(isValidJpegBase64(`data:image/png;base64,${png}`)).toBe(false);
      });

      it('rejects WebP base64 payloads starting with UklGR', () => {
        const webp = 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v39gAA=';
        expect(isValidJpegBase64(webp)).toBe(false);
        expect(isValidJpegBase64(`data:image/webp;base64,${webp}`)).toBe(false);
      });

      it('rejects GIF base64 payloads starting with R0lGOD', () => {
        const gif = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        expect(isValidJpegBase64(gif)).toBe(false);
        expect(isValidJpegBase64(`data:image/gif;base64,${gif}`)).toBe(false);
      });

      it('rejects PDF base64 payloads starting with JVBERi', () => {
        const pdf = 'JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQ==';
        expect(isValidJpegBase64(pdf)).toBe(false);
        expect(isValidJpegBase64(`data:application/pdf;base64,${pdf}`)).toBe(false);
      });

      it('rejects truncated /9j headers that lack the trailing slash or are under 4 chars', () => {
        expect(isValidJpegBase64('/9j')).toBe(false);
        expect(isValidJpegBase64('/9')).toBe(false);
        expect(isValidJpegBase64('/')).toBe(false);
        expect(isValidJpegBase64('/9jA')).toBe(false); // does not start with /9j/
      });

      it('rejects empty strings, whitespace-only, and malformed non-base64 text', () => {
        expect(isValidJpegBase64('')).toBe(false);
        expect(isValidJpegBase64('    ')).toBe(false);
        expect(isValidJpegBase64('invalid-corrupt-jpeg-string')).toBe(false);
      });

      it('rejects non-string values safely without runtime exceptions', () => {
        expect(isValidJpegBase64(null as unknown as string)).toBe(false);
        expect(isValidJpegBase64(undefined as unknown as string)).toBe(false);
        expect(isValidJpegBase64(123456 as unknown as string)).toBe(false);
        expect(isValidJpegBase64({} as unknown as string)).toBe(false);
        expect(isValidJpegBase64([] as unknown as string)).toBe(false);
      });
    });

    describe('2.2 Pipeline Base64 Output and Non-Zero Size Verification', () => {
      it('returns CompressedImage with clean base64 starting with /9j/ (no data URL prefix)', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(SYNTHETIC_JPEG_DATA_URL);

        const blob = new Blob(['prescription-content'], { type: 'image/jpeg' });
        const result = await compressPrescriptionImage(blob);

        expect(result.mimeType).toBe('image/jpeg');
        expect(result.base64).toMatch(/^\/9j\//);
        expect(result.base64).not.toContain('data:');
        expect(result.base64).not.toContain('base64,');
        expect(result.sizeBytes).toBeGreaterThan(0);
        expect(result.sizeBytes).toBe(Math.round((result.base64.length * 3) / 4));
      });

      it('passes quality 0.8 to canvas.toDataURL for compressPrescriptionImage', async () => {
        const toDataUrlSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(SYNTHETIC_JPEG_DATA_URL);

        const blob = new Blob(['prescription-quality-test'], { type: 'image/jpeg' });
        await compressPrescriptionImage(blob);

        expect(toDataUrlSpy).toHaveBeenCalledWith('image/jpeg', 0.8);
      });

      it('passes quality 0.7 to canvas.toDataURL for compressImage by default', async () => {
        const toDataUrlSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(SYNTHETIC_JPEG_DATA_URL);

        const blob = new Blob(['box-quality-test'], { type: 'image/jpeg' });
        await compressImage(blob);

        expect(toDataUrlSpy).toHaveBeenCalledWith('image/jpeg', 0.7);
      });

      it('rejects output when canvas toDataURL produces a non-JPEG header (e.g. PNG)', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
          'data:image/png;base64,iVBORw0KGgo' + 'A'.repeat(600)
        );

        const blob = new Blob(['png-header-test'], { type: 'image/jpeg' });
        await expect(compressPrescriptionImage(blob)).rejects.toThrow(
          'صيغة الصورة الناتجة غير صالحة (JPEG Header Missing).'
        );
      });

      it('rejects output when base64 length is under 500 characters (MIN_VALID_BASE64_LENGTH)', async () => {
        // 499 characters total
        const shortBase64 = '/9j/' + 'A'.repeat(495);
        expect(shortBase64.length).toBe(499);

        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
          `data:image/jpeg;base64,${shortBase64}`
        );

        const blob = new Blob(['undersized-output'], { type: 'image/jpeg' });
        await expect(compressPrescriptionImage(blob)).rejects.toThrow(
          'حجم بيانات الصورة صغير جداً وغير صالح.'
        );
      });

      it('accepts output when base64 length is exactly 500 characters boundary', async () => {
        // 500 characters total
        const boundaryBase64 = '/9j/' + 'A'.repeat(496);
        expect(boundaryBase64.length).toBe(500);

        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
          `data:image/jpeg;base64,${boundaryBase64}`
        );

        const blob = new Blob(['boundary-500-chars'], { type: 'image/jpeg' });
        const result: CompressedImage = await compressPrescriptionImage(blob);

        expect(result.base64.length).toBe(500);
        expect(result.base64.startsWith('/9j/')).toBe(true);
        expect(result.sizeBytes).toBe(Math.round((500 * 3) / 4));
      });

      it('confirms imageProcessor exported constants and aliases match specifications', async () => {
        expect(MAX_IMAGE_DIMENSION).toBe(1024);
        expect(JPEG_COMPRESSION_QUALITY).toBe(0.75);
        expect(MIN_VALID_BASE64_LENGTH).toBe(500);
        expect(processAndValidatePrescriptionImage).toBe(compressPrescriptionImage);

        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(SYNTHETIC_JPEG_DATA_URL);
        const blob = new Blob(['alias-test'], { type: 'image/jpeg' });
        const boxResult: CompressedImage = await processAndValidateImage(blob);
        expect(boxResult.mimeType).toBe('image/jpeg');
        expect(boxResult.base64.startsWith('/9j/')).toBe(true);
      });
    });
  });

  // =========================================================================
  // 3. Blank / Solid White / Black / Transparent Frame Rejection
  // =========================================================================
  describe('3. Blank / Solid White / Black / Transparent Frame Rejection', () => {
    describe('3.1 Pixel Grid Luminance Verification (verifyNotBlackOrBlank)', () => {
      it('rejects pitch-black frame with 100% black pixels (RGBA: 0,0,0,255)', () => {
        const fakeCtx = {
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(100 * 100 * 4).fill(0)
          })
        } as unknown as CanvasRenderingContext2D;

        expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(false);
      });

      it('rejects sub-threshold dark noise where luminance < 5 (e.g. RGB: 4,4,4)', () => {
        const data = new Uint8ClampedArray(100 * 100 * 4);
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 4;
          data[i + 1] = 4;
          data[i + 2] = 4;
          data[i + 3] = 255;
        }
        const fakeCtx = {
          getImageData: vi.fn().mockReturnValue({ data })
        } as unknown as CanvasRenderingContext2D;

        expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(false);
      });

      it('rejects boundary condition where pixels have luma=8 (nonBlackCount === 0)', () => {
        const data = new Uint8ClampedArray(100 * 100 * 4);
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 8;
          data[i + 1] = 8;
          data[i + 2] = 8;
          data[i + 3] = 255;
        }
        const fakeCtx = {
          getImageData: vi.fn().mockReturnValue({ data })
        } as unknown as CanvasRenderingContext2D;

        // lum is not > 8, so nonBlackCount is 0 -> rejected
        expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(false);
      });

      it('accepts boundary condition where pixels have luma=9 (nonBlackCount > 0 and avgLum >= 5)', () => {
        const data = new Uint8ClampedArray(100 * 100 * 4);
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 9;
          data[i + 1] = 9;
          data[i + 2] = 9;
          data[i + 3] = 255;
        }
        const fakeCtx = {
          getImageData: vi.fn().mockReturnValue({ data })
        } as unknown as CanvasRenderingContext2D;

        expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(true);
      });

      it('rejects covered camera lens with small 1% light leak (avgLum < 5)', () => {
        // 100x100 grid with 99% pitch black (0) and 1% bright (255)
        const data = new Uint8ClampedArray(100 * 100 * 4).fill(0);
        data[0] = 255;
        data[1] = 255;
        data[2] = 255;
        data[3] = 255;

        const fakeCtx = {
          getImageData: vi.fn().mockReturnValue({ data })
        } as unknown as CanvasRenderingContext2D;

        // avgLum = 255 / 100 = 2.55 < 5 -> rejected
        expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(false);
      });

      it('rejects 100% solid washed-out white frame (RGB: 255,255,255)', () => {
        const fakeCtx = {
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(100 * 100 * 4).fill(255)
          })
        } as unknown as CanvasRenderingContext2D;

        expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(false);
      });

      it('rejects near-white solid washed-out frame with zero variance (RGB: 252,252,252)', () => {
        const data = new Uint8ClampedArray(100 * 100 * 4);
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 252;
          data[i + 1] = 252;
          data[i + 2] = 252;
          data[i + 3] = 255;
        }
        const fakeCtx = {
          getImageData: vi.fn().mockReturnValue({ data })
        } as unknown as CanvasRenderingContext2D;

        // maxLum - minLum === 0 and avgLum > 250 -> rejected
        expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(false);
      });

      it('NEVER false-rejects white prescription paper with handwritten dark text', () => {
        // 90% white paper (255), 10% dark ink (25)
        const data = new Uint8ClampedArray(100 * 100 * 4).fill(255);
        for (let i = 0; i < data.length * 0.1; i += 4) {
          data[i] = 25;
          data[i + 1] = 25;
          data[i + 2] = 25;
        }
        const fakeCtx = {
          getImageData: vi.fn().mockReturnValue({ data })
        } as unknown as CanvasRenderingContext2D;

        // Variance is 255 - 25 = 230 !== 0 -> must accept!
        expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(true);
      });

      it('accepts solid colored prescription forms (e.g. solid yellow paper: Luma ~ 226 <= 250)', () => {
        const data = new Uint8ClampedArray(100 * 100 * 4);
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255;   // R
          data[i + 1] = 255; // G
          data[i + 2] = 0;   // B
          data[i + 3] = 255;
        }
        const fakeCtx = {
          getImageData: vi.fn().mockReturnValue({ data })
        } as unknown as CanvasRenderingContext2D;

        // avgLum = 0.299*255 + 0.587*255 = 225.93 <= 250 -> accepted
        expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(true);
      });

      it('gracefully recovers when getImageData throws SecurityError (tainted canvas fallback)', () => {
        const fakeCtx = {
          getImageData: vi.fn().mockImplementation(() => {
            throw new Error('SecurityError: The canvas has been tainted by cross-origin data.');
          })
        } as unknown as CanvasRenderingContext2D;

        expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(true);
      });

      it('returns false safely on null context or non-positive dimensions', () => {
        expect(verifyNotBlackOrBlank(null as unknown as CanvasRenderingContext2D, 100, 100)).toBe(false);
        expect(verifyNotBlackOrBlank({} as CanvasRenderingContext2D, 0, 100)).toBe(false);
        expect(verifyNotBlackOrBlank({} as CanvasRenderingContext2D, 100, 0)).toBe(false);
      });
    });

    describe('3.2 Transparent PNG Backdrop & Blank Frame Detection in Pipeline', () => {
      it('fills canvas with solid #FFFFFF backdrop BEFORE drawing source image', async () => {
        const operations: string[] = [];
        let currentFillStyle = '';

        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
          get fillStyle() {
            return currentFillStyle;
          },
          set fillStyle(val: string) {
            currentFillStyle = val;
            operations.push(`fillStyle:${val}`);
          },
          fillRect: vi.fn((_x, _y, w, h) => {
            operations.push(`fillRect:${w}x${h}`);
          }),
          drawImage: vi.fn(() => {
            operations.push('drawImage');
          }),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(800 * 600 * 4).fill(128)
          })
        } as unknown as CanvasRenderingContext2D);

        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(SYNTHETIC_JPEG_DATA_URL);

        const blob = new Blob(['png-with-alpha'], { type: 'image/png' });
        await compressPrescriptionImage(blob);

        expect(operations).toContain('fillStyle:#FFFFFF');
        const fillRectIdx = operations.findIndex(op => op.startsWith('fillRect:'));
        const drawImageIdx = operations.indexOf('drawImage');
        expect(fillRectIdx).toBeGreaterThanOrEqual(0);
        expect(drawImageIdx).toBeGreaterThan(fillRectIdx);
      });

      it('rejects a completely transparent PNG because #FFFFFF backdrop turns it into solid blank white', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(800 * 600 * 4).fill(255) // Entire canvas became pure white
          })
        } as unknown as CanvasRenderingContext2D);

        const transparentBlob = new Blob(['transparent-png-data'], { type: 'image/png' });
        await expect(compressPrescriptionImage(transparentBlob)).rejects.toThrow(
          'الصورة الملتقطة تبدو مظلمة جداً أو فارغة تماماً (شاشة سوداء). يرجى التأكد من تشغيل الإضاءة وإعادة التصوير.'
        );
      });

      it('rejects a solid pitch-black capture in compressPrescriptionImage with friendly Arabic error', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(800 * 600 * 4).fill(0) // Pitch black
          })
        } as unknown as CanvasRenderingContext2D);

        const blackBlob = new Blob(['pitch-black-data'], { type: 'image/jpeg' });
        await expect(compressPrescriptionImage(blackBlob)).rejects.toThrow(
          'الصورة الملتقطة تبدو مظلمة جداً أو فارغة تماماً (شاشة سوداء). يرجى التأكد من تشغيل الإضاءة وإعادة التصوير.'
        );
      });

      it('rejects a solid washed-out white capture in compressPrescriptionImage with friendly Arabic error', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(800 * 600 * 4).fill(255) // Solid white
          })
        } as unknown as CanvasRenderingContext2D);

        const whiteBlob = new Blob(['solid-white-data'], { type: 'image/jpeg' });
        await expect(compressPrescriptionImage(whiteBlob)).rejects.toThrow(
          'الصورة الملتقطة تبدو مظلمة جداً أو فارغة تماماً (شاشة سوداء). يرجى التأكد من تشغيل الإضاءة وإعادة التصوير.'
        );
      });
    });
  });

  // =========================================================================
  // 4. Cache Key Normalization with Intricate Arabic Diacritics & Variants
  // =========================================================================
  describe('4. Cache Key Normalization with Intricate Arabic Diacritics & Variants', () => {
    describe('4.1 Diacritic / Tashkeel Stripping', () => {
      it('strips all standard Arabic short vowels (fatha, damma, kasra, sukun)', () => {
        const text = 'مَفْهُومٌ بَانَادُولْ كُونْجِسْتَالْ فِيتَامِينْ';
        const normalized = normalizeMedicineName(text);
        expect(normalized).toBe('مفهوم_بانادول_كونجستال_فيتامين');
      });

      it('strips all tanween forms (fathatan, dammatan, kasratan)', () => {
        const text = 'عِلَاجًا دَوَاءٌ قُرْصٍ';
        const normalized = normalizeMedicineName(text);
        expect(normalized).toBe('علاجا_دواء_قرص');
      });

      it('strips shadda and stacked diacritics (shadda + fatha, shadda + dammatan)', () => {
        const text = 'مُضَادٌّ حَيَوِيٌّ فَعَّالٌ';
        const normalized = normalizeMedicineName(text);
        expect(normalized).toBe('مضاد_حيوي_فعال');
      });

      it('strips dagger alif (\\u0670) and tatweel/kashida (\\u0640)', () => {
        const text = 'هٰذَا بـــــانـــــادول';
        const normalized = normalizeMedicineName(text);
        expect(normalized).toBe('هذا_بانادول');
      });

      it('handles complex Arabic medication prescription string with combined diacritics', () => {
        const complex = 'بَانَادُولْ إِكْسْتْرَاـ ٥٠٠ مِلْغِرَامٌ مَرَّتَيْنِ يَوْمِيًّا';
        const normalized = normalizeMedicineName(complex);
        expect(normalized).toBe('بانادول_اكسترا_٥٠٠_ملغرام_مرتين_يوميا');
      });
    });

    describe('4.2 Hamza Normalization (أ, إ, آ -> ا)', () => {
      it('normalizes alif with hamza above (أ) to plain alif (ا)', () => {
        expect(normalizeMedicineName('أَسْبِرِين')).toBe('اسبرين');
        expect(normalizeMedicineName('أَمُوكْسِيسِيلِين')).toBe('اموكسيسيلين');
        expect(normalizeMedicineName('أَوْجِمَنْتِين')).toBe('اوجمنتين');
      });

      it('normalizes alif with hamza below (إ) to plain alif (ا)', () => {
        expect(normalizeMedicineName('إِيبُوبْرُوفِين')).toBe('ايبوبروفين');
        expect(normalizeMedicineName('إِكْسْتْرَا')).toBe('اكسترا');
        expect(normalizeMedicineName('إِنْسُولِين')).toBe('انسولين');
      });

      it('normalizes alif with madda (آ) to plain alif (ا)', () => {
        expect(normalizeMedicineName('آسِيدْ أَلْفَا')).toBe('اسيد_الفا');
        expect(normalizeMedicineName('آيْرُون')).toBe('ايرون');
      });

      it('normalizes strings containing multiple mixed hamza types', () => {
        const mixed = 'أَوْجِمَنْتِينْ إِكْسْ إِيلْ آكْتِيفْ';
        expect(normalizeMedicineName(mixed)).toBe('اوجمنتين_اكس_ايل_اكتيف');
      });
    });

    describe('4.3 Taa Marbuta (ة -> ه) and Alef Maksura (ى -> ي)', () => {
      it('normalizes taa marbuta (ة) to haa (ه)', () => {
        expect(normalizeMedicineName('روشتة')).toBe('روشته');
        expect(normalizeMedicineName('كبسولة')).toBe('كبسوله');
        expect(normalizeMedicineName('حقنة وريدية')).toBe('حقنه_وريديه');
        expect(normalizeMedicineName('قطرة عينية')).toBe('قطره_عينيه');
      });

      it('normalizes alef maksura (ى) to yaa (ي)', () => {
        expect(normalizeMedicineName('مستشفى')).toBe('مستشفي');
        expect(normalizeMedicineName('أدوية كبرى')).toBe('ادويه_كبري');
        expect(normalizeMedicineName('مرضى')).toBe('مرضي');
      });

      it('normalizes both taa marbuta and alef maksura in the same phrase', () => {
        const phrase = 'روشتة مستشفى كبرى';
        expect(normalizeMedicineName(phrase)).toBe('روشته_مستشفي_كبري');
      });
    });

    describe('4.4 Whitespace and Latin Case Normalization', () => {
      it('trims leading and trailing spaces, tabs, and newlines', () => {
        expect(normalizeMedicineName('   \t\n  بانادول  \n\t  ')).toBe('بانادول');
      });

      it('collapses multiple sequential spaces and tabs into a single underscore', () => {
        expect(normalizeMedicineName('أوجمنتين    1000   مجم')).toBe('اوجمنتين_1000_مجم');
        expect(normalizeMedicineName('Panadol \t\t Extra \n\n 500mg')).toBe('panadol_extra_500mg');
      });

      it('converts English medication names to lowercase', () => {
        expect(normalizeMedicineName('AUGMENTIN 1000MG')).toBe('augmentin_1000mg');
        expect(normalizeMedicineName('Cataflam 50mg Tablets')).toBe('cataflam_50mg_tablets');
      });

      it('handles mixed Arabic and English medication names', () => {
        expect(normalizeMedicineName('بانادول Panadol Extra')).toBe('بانادول_panadol_extra');
        expect(normalizeMedicineName('Augmentin أوجمنتين 1g')).toBe('augmentin_اوجمنتين_1g');
      });

      it('handles null, undefined, empty, or whitespace-only strings safely', () => {
        expect(normalizeMedicineName('')).toBe('');
        expect(normalizeMedicineName('    ')).toBe('');
        expect(normalizeMedicineName(null as unknown as string)).toBe('');
        expect(normalizeMedicineName(undefined as unknown as string)).toBe('');
      });
    });

    describe('4.5 Cache Key Generation Equivalence (getCacheKey)', () => {
      it('prepends DETAILS_CACHE_PREFIX (dalili_details_) to normalized key', () => {
        const key = getCacheKey('بانادول');
        expect(key).toBe(`${DETAILS_CACHE_PREFIX}بانادول`);
      });

      it('produces identical cache key for diacritics vs non-diacritics', () => {
        const k1 = getCacheKey('بَانَادُولْ إِكْسْتْرَا');
        const k2 = getCacheKey('بانادول اكسترا');
        expect(k1).toBe(k2);
      });

      it('produces identical cache key for hamza variations', () => {
        const k1 = getCacheKey('أَمُوكْسِيل');
        const k2 = getCacheKey('اموكسيل');
        expect(k1).toBe(k2);
      });

      it('produces identical cache key for taa marbuta vs haa', () => {
        const k1 = getCacheKey('روشتة طبية');
        const k2 = getCacheKey('روشته طبيه');
        expect(k1).toBe(k2);
      });

      it('produces identical cache key for alef maksura vs yaa', () => {
        const k1 = getCacheKey('مستشفى');
        const k2 = getCacheKey('مستشفي');
        expect(k1).toBe(k2);
      });
    });
  });

  // =========================================================================
  // 5. LocalStorage QuotaExceededError and Security Exception Fallback to Memory Cache
  // =========================================================================
  describe('5. LocalStorage QuotaExceededError and Security Exception Fallback to Memory Cache', () => {
    it('handles QuotaExceededError on localStorage.setItem without throwing', () => {
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });

      expect(() => {
        setCachedDetails('كونجستال', sampleMedicineResult);
      }).not.toThrow();
    });

    it('falls back seamlessly to in-memory cache when localStorage.setItem throws QuotaExceededError', () => {
      // Spy directly on window.localStorage.setItem to simulate QuotaExceededError
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      });

      // Save item under QuotaExceededError condition
      setCachedDetails('أوجمنتين', sampleMedicineResult);

      // Verify item can be retrieved without data loss within session
      const cached = getCachedDetails('أوجمنتين');
      expect(cached).not.toBeNull();
      expect(cached?.is_clear).toBe(true);
      expect(cached?.medicine_name_ar).toBe('بانادول إكسترا');
      expect(cached?.active_ingredient).toBe('باراسيتامول + كافيين');
      expect(cached?.how_and_when).toHaveLength(3);
    });

    it('retrieves in-memory cached details using diacritic-accented query under QuotaExceededError', () => {
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });

      setCachedDetails('بانادول اكسترا', sampleMedicineResult);

      // Query with heavy diacritics and hamza
      const retrieved = getCachedDetails('بَانَادُولْ إِكْسْتْرَاـ');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.medicine_name_en).toBe('Panadol Extra');
    });

    it('handles SecurityError on localStorage.getItem without throwing and falls back safely', () => {
      vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });

      expect(() => {
        const res = getCachedDetails('أدول');
        expect(res).toBeNull();
      }).not.toThrow();
    });

    it('operates entirely in memory if localStorage throws SecurityError on both setItem and getItem', () => {
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });
      vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });

      // Storing should not throw
      expect(() => setCachedDetails('أسبرين', sampleMedicineResult)).not.toThrow();

      // Retrieval should seamlessly succeed from in-memory cache
      const cached = getCachedDetails('أسبرين');
      expect(cached).not.toBeNull();
      expect(cached?.medicine_name_ar).toBe('بانادول إكسترا');
    });

    it('handles corrupted JSON in localStorage safely by removing corrupted item and returning null', () => {
      const key = getCacheKey('فيتامين سي');
      window.localStorage.setItem(key, '{"invalid_json_corrupted: true');

      expect(getCachedDetails('فيتامين سي')).toBeNull();
      // Corrupted key should have been evicted
      expect(window.localStorage.getItem(key)).toBeNull();
    });

    it('returns null if cached item in localStorage has is_clear: false', () => {
      const key = getCacheKey('دواء غير واضح');
      window.localStorage.setItem(key, JSON.stringify({ is_clear: false, raw_error: 'صورة ضبابية' }));

      expect(getCachedDetails('دواء غير واضح')).toBeNull();
    });

    it('safely ignores setCachedDetails with empty, whitespace-only, or null arguments', () => {
      expect(() => setCachedDetails('', sampleMedicineResult)).not.toThrow();
      expect(() => setCachedDetails('   ', sampleMedicineResult)).not.toThrow();
      expect(() => setCachedDetails('دواء', null as unknown as MedicineAnalysisResult)).not.toThrow();

      expect(getCachedDetails('')).toBeNull();
      expect(getCachedDetails('   ')).toBeNull();
      expect(getCachedDetails('دواء')).toBeNull();
    });

    it('clearDetailsCache clears entries from both localStorage and in-memory cache without affecting unrelated storage keys', () => {
      window.localStorage.setItem('user_theme', 'teal_dark');
      window.localStorage.setItem('dalili_history', JSON.stringify([{ id: 'scan_1' }]));

      // Normal store into localStorage
      setCachedDetails('بانادول', sampleMedicineResult);

      // Force QuotaExceededError to store into in-memory cache
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });
      setCachedDetails('كونجستال', sampleMedicineResult);

      // Both should be present
      expect(getCachedDetails('بانادول')).not.toBeNull();
      expect(getCachedDetails('كونجستال')).not.toBeNull();

      // Clear details cache
      clearDetailsCache();

      // Both should now be null
      expect(getCachedDetails('بانادول')).toBeNull();
      expect(getCachedDetails('كونجستال')).toBeNull();

      // Unrelated storage items must remain completely intact
      expect(window.localStorage.getItem('user_theme')).toBe('teal_dark');
      expect(window.localStorage.getItem('dalili_history')).not.toBeNull();
    });
  });
});
