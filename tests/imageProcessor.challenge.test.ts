import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateClampedDimensions,
  isValidJpegBase64,
  verifyNotBlackOrBlank,
  processAndValidateImage,
  MAX_IMAGE_DIMENSION,
  JPEG_COMPRESSION_QUALITY,
  MIN_VALID_BASE64_LENGTH,
  ProcessedImage
} from '../src/utils/imageProcessor';

// A synthetic valid JPEG payload (> 500 chars, begins with /9j/)
const VALID_JPEG_BASE64_SUFFIX = 'A'.repeat(550);
const VALID_JPEG_BASE64 = `/9j/4AAQSkZJRgABAQEASABIAAD/${VALID_JPEG_BASE64_SUFFIX}`;
const VALID_JPEG_DATA_URL = `data:image/jpeg;base64,${VALID_JPEG_BASE64}`;

describe('Milestone 3 Empirical Challenge: Image Processor & Validation (Requirement R2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Challenge 1: Extreme Image Dimensions & Mathematical Clamping
  // =========================================================================
  describe('Challenge 1: Extreme Image Dimensions & Clamping Stress Tests', () => {
    it('handles ultra-wide aspect ratio (5000x1)', () => {
      const { width, height } = calculateClampedDimensions(5000, 1);
      expect(width).toBe(1024);
      expect(height).toBe(0); // Math.round(1 * 1024/5000) = 0
    });

    it('handles ultra-tall aspect ratio (1x5000)', () => {
      const { width, height } = calculateClampedDimensions(1, 5000);
      expect(width).toBe(0); // Math.round(1 * 1024/5000) = 0
      expect(height).toBe(1024);
    });

    it('clamps 4K smartphone capture (4096x3072) to 1024x768 preserving exact 4:3 ratio', () => {
      const { width, height } = calculateClampedDimensions(4096, 3072);
      expect(width).toBe(1024);
      expect(height).toBe(768);
      expect(width / height).toBeCloseTo(4096 / 3072, 3);
    });

    it('clamps 4K portrait capture (3072x4096) to 768x1024 preserving exact 3:4 ratio', () => {
      const { width, height } = calculateClampedDimensions(3072, 4096);
      expect(width).toBe(768);
      expect(height).toBe(1024);
      expect(width / height).toBeCloseTo(3072 / 4096, 3);
    });

    it('clamps 48MP mobile sensor (8000x6000) down to 1024x768', () => {
      const { width, height } = calculateClampedDimensions(8000, 6000);
      expect(width).toBe(1024);
      expect(height).toBe(768);
    });

    it('clamps 108MP ultra-res mobile sensor (12000x9000) down to 1024x768', () => {
      const { width, height } = calculateClampedDimensions(12000, 9000);
      expect(width).toBe(1024);
      expect(height).toBe(768);
    });

    it('does NOT upscale small low-res thumbnails (100x100)', () => {
      const { width, height } = calculateClampedDimensions(100, 100);
      expect(width).toBe(100);
      expect(height).toBe(100);
    });

    it('does NOT upscale 1x1 single pixel image', () => {
      const { width, height } = calculateClampedDimensions(1, 1);
      expect(width).toBe(1);
      expect(height).toBe(1);
    });

    it('preserves exact boundary dimension (1024x1024)', () => {
      const { width, height } = calculateClampedDimensions(1024, 1024);
      expect(width).toBe(1024);
      expect(height).toBe(1024);
    });

    it('clamps boundary+1 (1025x1025) down to 1024x1024', () => {
      const { width, height } = calculateClampedDimensions(1025, 1025);
      expect(width).toBe(1024);
      expect(height).toBe(1024);
    });

    it('safely handles zero, negative, and degenerate dimensions', () => {
      expect(calculateClampedDimensions(0, 0)).toEqual({ width: 0, height: 0 });
      expect(calculateClampedDimensions(-500, 1000)).toEqual({ width: 0, height: 0 });
      expect(calculateClampedDimensions(1000, -500)).toEqual({ width: 0, height: 0 });
      expect(calculateClampedDimensions(-100, -100)).toEqual({ width: 0, height: 0 });
    });

    it('rejects image in processAndValidateImage when natural dimensions are invalid (0x0)', async () => {
      vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(function (this: HTMLImageElement) {
        Object.defineProperty(this, 'naturalWidth', { value: 0, configurable: true });
        Object.defineProperty(this, 'naturalHeight', { value: 0, configurable: true });
        return Promise.resolve();
      });

      const blob = new Blob(['bad-dimensions'], { type: 'image/jpeg' });
      await expect(processAndValidateImage(blob)).rejects.toThrow('أبعاد الصورة الملتقطة غير صالحة.');
    });
  });

  // =========================================================================
  // Challenge 2: Pitch-Black Frame Detection (Rec. 601 Luma < 5)
  // =========================================================================
  describe('Challenge 2: Pitch-Black Frame Detection & Luma Stress Tests', () => {
    it('rejects absolute black frame (R=0, G=0, B=0 across all pixels)', () => {
      const fakeCtx = {
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(0)
        })
      } as unknown as CanvasRenderingContext2D;

      expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(false);
    });

    it('rejects pitch-black frame with noise below threshold (R=4, G=4, B=4, L=4)', () => {
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

    it('rejects covered camera lens with small light leak (99% black, 1% bright)', () => {
      // 100x100 canvas, sampled in 10x10 grid (100 sample points)
      // If 99 sample points are pitch black (L=0) and 1 sample point is L=255:
      // avgLum = 255 / 100 = 2.55 (< 5) -> must be rejected
      const data = new Uint8ClampedArray(100 * 100 * 4).fill(0);
      // Set single pixel to white
      data[0] = 255;
      data[1] = 255;
      data[2] = 255;
      data[3] = 255;

      const fakeCtx = {
        getImageData: vi.fn().mockReturnValue({ data })
      } as unknown as CanvasRenderingContext2D;

      expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(false);
    });

    it('rejects frame at L=8 boundary because nonBlackCount is 0 (lum <= 8)', () => {
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

      // avgLum = 8, but lum is not > 8, so nonBlackCount === 0 -> rejected
      expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(false);
    });

    it('accepts frame at L=9 boundary (nonBlackCount > 0 and avgLum >= 5)', () => {
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

    it('accepts legitimate dim medication photo with contrast (dark background with illuminated label)', () => {
      const data = new Uint8ClampedArray(100 * 100 * 4).fill(10); // dark background
      // 30% of pixels illuminated by lamp (R=180, G=170, B=150)
      for (let i = 0; i < data.length * 0.3; i += 4) {
        data[i] = 180;
        data[i + 1] = 170;
        data[i + 2] = 150;
      }
      const fakeCtx = {
        getImageData: vi.fn().mockReturnValue({ data })
      } as unknown as CanvasRenderingContext2D;

      expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(true);
    });

    it('throws friendly Arabic error when processAndValidateImage encounters black capture', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(0)
        })
      } as unknown as CanvasRenderingContext2D);

      const blob = new Blob(['black-frame'], { type: 'image/jpeg' });
      await expect(processAndValidateImage(blob)).rejects.toThrow(
        'الصورة الملتقطة تبدو مظلمة جداً أو فارغة تماماً (شاشة سوداء). يرجى التأكد من تشغيل الإضاءة وإعادة التصوير.'
      );
    });
  });

  // =========================================================================
  // Challenge 3: Blank / Solid White Frame Rejection & Medical Box Discrimination
  // =========================================================================
  describe('Challenge 3: Blank/Solid White Frames Rejection', () => {
    it('rejects 100% solid white washed-out frame (R=255, G=255, B=255)', () => {
      const fakeCtx = {
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(255)
        })
      } as unknown as CanvasRenderingContext2D;

      expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(false);
    });

    it('rejects near-white solid washed-out frame (R=252, G=252, B=252)', () => {
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

      expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(false);
    });

    it('NEVER false-rejects white medication box with black/colored text', () => {
      // 85% white box (255), 15% dark text (20)
      const data = new Uint8ClampedArray(100 * 100 * 4).fill(255);
      for (let i = 0; i < data.length * 0.15; i += 4) {
        data[i] = 20;
        data[i + 1] = 20;
        data[i + 2] = 20;
      }
      const fakeCtx = {
        getImageData: vi.fn().mockReturnValue({ data })
      } as unknown as CanvasRenderingContext2D;

      // Variance is non-zero (max=255, min=20) -> must pass!
      expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(true);
    });

    it('accepts solid colored surfaces that are not white (e.g. solid yellow box)', () => {
      // Solid bright yellow (255, 255, 0)
      // L = 0.299*255 + 0.587*255 = 225.93 <= 250 -> not rejected
      const data = new Uint8ClampedArray(100 * 100 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
      const fakeCtx = {
        getImageData: vi.fn().mockReturnValue({ data })
      } as unknown as CanvasRenderingContext2D;

      expect(verifyNotBlackOrBlank(fakeCtx, 100, 100)).toBe(true);
    });
  });

  // =========================================================================
  // Challenge 4: Transparent PNG Alpha Flattening to Solid #FFFFFF Backdrop
  // =========================================================================
  describe('Challenge 4: Transparent PNG Alpha Flattening to Solid #FFFFFF Backdrop', () => {
    it('pre-paints canvas with solid #FFFFFF backdrop BEFORE drawing source image', async () => {
      const callOrder: string[] = [];
      let recordedFillStyle = '';

      const fakeCtx = {
        get fillStyle() {
          return recordedFillStyle;
        },
        set fillStyle(val: string) {
          recordedFillStyle = val;
          callOrder.push(`fillStyle:${val}`);
        },
        fillRect: vi.fn((_x, _y, w, h) => {
          callOrder.push(`fillRect:${w}x${h}`);
        }),
        drawImage: vi.fn(() => {
          callOrder.push('drawImage');
        }),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(800 * 600 * 4).fill(128)
        })
      };

      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx as any);
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(VALID_JPEG_DATA_URL);

      const transparentPngBlob = new Blob(['fake-transparent-png'], { type: 'image/png' });
      await processAndValidateImage(transparentPngBlob);

      // Verify fillStyle was set to #FFFFFF
      expect(callOrder).toContain('fillStyle:#FFFFFF');

      // Verify fillRect occurred BEFORE drawImage
      const fillRectIndex = callOrder.findIndex(c => c.startsWith('fillRect:'));
      const drawImageIndex = callOrder.indexOf('drawImage');
      expect(fillRectIndex).toBeGreaterThanOrEqual(0);
      expect(drawImageIndex).toBeGreaterThan(fillRectIndex);
    });

    it('rejects a completely transparent PNG because backing fill turns it into solid blank white', async () => {
      // When a transparent PNG is drawn onto white canvas, all pixels remain #FFFFFF
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(800 * 600 * 4).fill(255) // Canvas became pure white
        })
      } as unknown as CanvasRenderingContext2D);

      const emptyTransparentBlob = new Blob(['transparent-png'], { type: 'image/png' });
      await expect(processAndValidateImage(emptyTransparentBlob)).rejects.toThrow(
        'الصورة الملتقطة تبدو مظلمة جداً أو فارغة تماماً (شاشة سوداء). يرجى التأكد من تشغيل الإضاءة وإعادة التصوير.'
      );
    });
  });

  // =========================================================================
  // Challenge 5: Non-Image Files, Corrupt Base64, Truncated Headers (< 500 chars)
  // =========================================================================
  describe('Challenge 5: Non-Image Files, Corrupt Base64, and Header Truncation', () => {
    describe('isValidJpegBase64 magic byte verification', () => {
      it('accepts raw base64 starting with /9j/', () => {
        expect(isValidJpegBase64('/9j/4AAQSkZJRgABAQEASABIAAD/')).toBe(true);
      });

      it('accepts data URL with JPEG MIME and /9j/ base64', () => {
        expect(isValidJpegBase64('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true);
      });

      it('accepts base64 with leading and trailing whitespace', () => {
        expect(isValidJpegBase64('   /9j/4AAQSkZJRg== \n')).toBe(true);
      });

      it('rejects PNG base64 starting with iVBOR', () => {
        expect(isValidJpegBase64('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ')).toBe(false);
        expect(isValidJpegBase64('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')).toBe(false);
      });

      it('rejects GIF base64 starting with R0lGOD', () => {
        expect(isValidJpegBase64('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')).toBe(false);
      });

      it('rejects WebP base64 starting with UklGR', () => {
        expect(isValidJpegBase64('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v39gAA=')).toBe(false);
      });

      it('rejects SVG base64 starting with PHN2Zw', () => {
        expect(isValidJpegBase64('PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==')).toBe(false);
      });

      it('rejects empty strings, whitespace, and corrupt strings', () => {
        expect(isValidJpegBase64('')).toBe(false);
        expect(isValidJpegBase64('   ')).toBe(false);
        expect(isValidJpegBase64('/9j')).toBe(false); // under 4 chars
        expect(isValidJpegBase64('corrupt-string-data')).toBe(false);
      });

      it('rejects null, undefined, and non-string inputs safely without crashing', () => {
        expect(isValidJpegBase64(null as any)).toBe(false);
        expect(isValidJpegBase64(undefined as any)).toBe(false);
        expect(isValidJpegBase64(123456 as any)).toBe(false);
        expect(isValidJpegBase64({} as any)).toBe(false);
        expect(isValidJpegBase64([] as any)).toBe(false);
      });
    });

    describe('Output length and corruption rejection in processAndValidateImage', () => {
      it('rejects output payload when base64 is exactly 499 characters (< 500 threshold)', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(800 * 600 * 4).fill(128)
          })
        } as unknown as CanvasRenderingContext2D);

        // 4 chars (/9j/) + 495 chars ('A') = 499 chars total
        const shortPayload = '/9j/' + 'A'.repeat(495);
        expect(shortPayload.length).toBe(499);

        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(`data:image/jpeg;base64,${shortPayload}`);

        const blob = new Blob(['short-output'], { type: 'image/jpeg' });
        await expect(processAndValidateImage(blob)).rejects.toThrow('حجم بيانات الصورة صغير جداً وغير صالح.');
      });

      it('accepts output payload when base64 is exactly 500 characters', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(800 * 600 * 4).fill(128)
          })
        } as unknown as CanvasRenderingContext2D);

        const boundaryPayload = '/9j/' + 'A'.repeat(496);
        expect(boundaryPayload.length).toBe(500);

        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(`data:image/jpeg;base64,${boundaryPayload}`);

        const blob = new Blob(['boundary-output'], { type: 'image/jpeg' });
        const result = await processAndValidateImage(blob);
        expect(result.base64.length).toBe(500);
      });

      it('rejects when canvas toDataURL produces a non-JPEG payload (e.g. PNG)', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(800 * 600 * 4).fill(128)
          })
        } as unknown as CanvasRenderingContext2D);

        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,iVBORw0KGgo' + 'A'.repeat(600));

        const blob = new Blob(['png-output'], { type: 'image/png' });
        await expect(processAndValidateImage(blob)).rejects.toThrow(
          'صيغة الصورة الناتجة غير صالحة (JPEG Header Missing).'
        );
      });

      it('rejects corrupt non-image file where image decode throws error', async () => {
        vi.spyOn(HTMLImageElement.prototype, 'decode').mockRejectedValue(new Error('Decoding failed'));

        // When decode rejects, fallback onerror triggers
        const originalImage = window.Image;
        try {
          window.Image = class MockFailingImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            src = '';
            decode = vi.fn().mockRejectedValue(new Error('Format error'));
            constructor() {
              setTimeout(() => {
                if (this.onerror) this.onerror();
              }, 10);
            }
          } as any;

          const corruptBlob = new Blob(['%PDF-1.4 corrupt binary'], { type: 'application/pdf' });
          await expect(processAndValidateImage(corruptBlob)).rejects.toThrow('تعذر تحميل بيانات الصورة المحددة.');
        } finally {
          window.Image = originalImage;
        }
      });
    });
  });

  // =========================================================================
  // Challenge 6: Memory Leak Avoidance (URL.revokeObjectURL Cleanup)
  // =========================================================================
  describe('Challenge 6: Memory Leak Prevention & Lifecycle Cleanup', () => {
    it('revokes object URL on successful compression', async () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(VALID_JPEG_DATA_URL);

      const blob = new Blob(['success-test'], { type: 'image/jpeg' });
      await processAndValidateImage(blob);

      expect(revokeSpy).toHaveBeenCalledTimes(1);
      expect(revokeSpy).toHaveBeenCalledWith(expect.stringMatching(/^blob:/));
    });

    it('revokes object URL when image dimensions are invalid', async () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(function (this: HTMLImageElement) {
        Object.defineProperty(this, 'naturalWidth', { value: 0, configurable: true });
        Object.defineProperty(this, 'naturalHeight', { value: 0, configurable: true });
        return Promise.resolve();
      });

      const blob = new Blob(['bad-dims'], { type: 'image/jpeg' });
      await expect(processAndValidateImage(blob)).rejects.toThrow();

      expect(revokeSpy).toHaveBeenCalledTimes(1);
    });

    it('revokes object URL when canvas getContext returns null', async () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

      const blob = new Blob(['no-context'], { type: 'image/jpeg' });
      await expect(processAndValidateImage(blob)).rejects.toThrow('تعذر إنشاء سياق معالجة الصور في المتصفح.');

      expect(revokeSpy).toHaveBeenCalledTimes(1);
    });

    it('revokes object URL when image is rejected as pitch-black', async () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(0)
        })
      } as unknown as CanvasRenderingContext2D);

      const blob = new Blob(['black-frame'], { type: 'image/jpeg' });
      await expect(processAndValidateImage(blob)).rejects.toThrow();

      expect(revokeSpy).toHaveBeenCalledTimes(1);
    });

    it('revokes object URL when output base64 has invalid header', async () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,iVBORw0KGgo' + 'A'.repeat(600));

      const blob = new Blob(['invalid-header'], { type: 'image/png' });
      await expect(processAndValidateImage(blob)).rejects.toThrow();

      expect(revokeSpy).toHaveBeenCalledTimes(1);
    });

    it('revokes object URL when output base64 is under 500 characters', async () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,/9j/short');

      const blob = new Blob(['too-short'], { type: 'image/jpeg' });
      await expect(processAndValidateImage(blob)).rejects.toThrow();

      expect(revokeSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT invoke URL.createObjectURL or URL.revokeObjectURL when input is already a string', async () => {
      const createSpy = vi.spyOn(URL, 'createObjectURL');
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(VALID_JPEG_DATA_URL);

      await processAndValidateImage(VALID_JPEG_DATA_URL);

      expect(createSpy).not.toHaveBeenCalled();
      expect(revokeSpy).not.toHaveBeenCalled();
    });

    it('survives high-concurrency stress test with 30 parallel processing calls without leaking URLs', async () => {
      const createdUrls: string[] = [];
      const revokedUrls: string[] = [];

      vi.spyOn(URL, 'createObjectURL').mockImplementation((_blob: any) => {
        const url = `blob:test-concurrent-${Math.random()}`;
        createdUrls.push(url);
        return url;
      });

      vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
        revokedUrls.push(url);
      });

      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(VALID_JPEG_DATA_URL);

      const promises = Array.from({ length: 30 }, (_, i) => {
        const blob = new Blob([`concurrent-item-${i}`], { type: 'image/jpeg' });
        return processAndValidateImage(blob);
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(30);
      expect(createdUrls).toHaveLength(30);
      expect(revokedUrls).toHaveLength(30);
      // Ensure every single created URL was revoked
      expect(revokedUrls.sort()).toEqual(createdUrls.sort());
    });
  });

  // =========================================================================
  // Challenge 7: Output Interface Conformance & Compression Specifications
  // =========================================================================
  describe('Challenge 7: Output Contract Conformance & Compression Specifications', () => {
    it('produces ProcessedImage strictly adhering to TypeScript interface', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(VALID_JPEG_DATA_URL);

      const blob = new Blob(['spec-test'], { type: 'image/jpeg' });
      const result: ProcessedImage = await processAndValidateImage(blob);

      expect(result).toHaveProperty('base64');
      expect(result).toHaveProperty('mimeType', 'image/jpeg');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
      expect(result).toHaveProperty('sizeBytes');

      // base64 must not have data URL prefix
      expect(result.base64).not.toContain('data:');
      expect(result.base64).toMatch(/^\/9j\//);

      // sizeBytes should match raw base64 byte calculation
      expect(result.sizeBytes).toBe(Math.round((result.base64.length * 3) / 4));

      // clamped dimensions
      expect(result.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
      expect(result.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
    });

    it('passes exact compression quality 0.75 and image/jpeg to canvas.toDataURL', async () => {
      const toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(VALID_JPEG_DATA_URL);

      const blob = new Blob(['quality-test'], { type: 'image/jpeg' });
      await processAndValidateImage(blob);

      expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', JPEG_COMPRESSION_QUALITY);
      expect(JPEG_COMPRESSION_QUALITY).toBe(0.75);
      expect(MIN_VALID_BASE64_LENGTH).toBe(500);
    });
  });

  // =========================================================================
  // Challenge 8: Canvas Security Taint Handling, Fallbacks & Advanced Aspect Ratios
  // =========================================================================
  describe('Challenge 8: Canvas Security Taint Handling, Fallbacks & Advanced Aspect Ratios', () => {
    it('gracefully accepts image if ctx.getImageData throws SecurityError (tainted canvas fallback)', () => {
      const fakeCtx = {
        getImageData: vi.fn().mockImplementation(() => {
          throw new Error('SecurityError: The canvas has been tainted by cross-origin data.');
        })
      } as unknown as CanvasRenderingContext2D;

      // verifyNotBlackOrBlank should catch and return true to prevent false rejection
      expect(verifyNotBlackOrBlank(fakeCtx, 800, 600)).toBe(true);
    });

    it('clamps 16:9 widescreen capture (1920x1080) to exact 1024x576', () => {
      const { width, height } = calculateClampedDimensions(1920, 1080);
      expect(width).toBe(1024);
      expect(height).toBe(576);
      expect(width / height).toBeCloseTo(16 / 9, 2);
    });

    it('clamps 9:16 portrait story capture (1080x1920) to exact 576x1024', () => {
      const { width, height } = calculateClampedDimensions(1080, 1920);
      expect(width).toBe(576);
      expect(height).toBe(1024);
      expect(width / height).toBeCloseTo(9 / 16, 2);
    });

    it('clamps fractional non-integer dimensions to rounded integers', () => {
      const { width, height } = calculateClampedDimensions(1500.5, 2000.7);
      expect(Number.isInteger(width)).toBe(true);
      expect(Number.isInteger(height)).toBe(true);
      expect(height).toBe(1024);
      expect(width).toBe(768);
    });

    it('converts PNG data URL string input to valid JPEG output', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(VALID_JPEG_DATA_URL);

      const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const result = await processAndValidateImage(pngDataUrl);

      expect(result.mimeType).toBe('image/jpeg');
      expect(result.base64).toMatch(/^\/9j\//);
    });
  });
});

