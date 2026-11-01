import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateClampedDimensions,
  isValidJpegBase64,
  verifyNotBlackOrBlank,
  processAndValidateImage,
  compressImage,
  compressPrescriptionImage,
  processAndValidatePrescriptionImage,
  MAX_IMAGE_DIMENSION,
  JPEG_COMPRESSION_QUALITY,
  MIN_VALID_BASE64_LENGTH
} from '../src/utils/imageProcessor';

describe('Image Processor Utility (imageProcessor.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Constants Integrity', () => {
    it('enforces 1024px maximum dimension clamp', () => {
      expect(MAX_IMAGE_DIMENSION).toBe(1024);
    });

    it('enforces 0.75 JPEG compression quality', () => {
      expect(JPEG_COMPRESSION_QUALITY).toBe(0.75);
    });

    it('enforces 500 character minimum valid base64 payload length', () => {
      expect(MIN_VALID_BASE64_LENGTH).toBe(500);
    });
  });

  describe('2. Dimension Clamping (calculateClampedDimensions)', () => {
    it('clamps landscape image exceeding 1024px while strictly preserving 4:3 aspect ratio', () => {
      const { width, height } = calculateClampedDimensions(2048, 1536);
      expect(width).toBe(1024);
      expect(height).toBe(768);
    });

    it('clamps portrait smartphone image exceeding 1024px while preserving 3:4 aspect ratio', () => {
      const { width, height } = calculateClampedDimensions(3000, 4000);
      expect(height).toBe(1024);
      expect(width).toBe(768);
    });

    it('clamps large square image to 1024x1024', () => {
      const { width, height } = calculateClampedDimensions(3000, 3000);
      expect(width).toBe(1024);
      expect(height).toBe(1024);
    });

    it('does NOT upscale images that are already smaller than 1024px', () => {
      const { width, height } = calculateClampedDimensions(800, 600);
      expect(width).toBe(800);
      expect(height).toBe(600);
    });

    it('preserves exact 1024px boundaries without distortion', () => {
      const { width, height } = calculateClampedDimensions(1024, 768);
      expect(width).toBe(1024);
      expect(height).toBe(768);
    });

    it('handles invalid or zero dimensions safely', () => {
      expect(calculateClampedDimensions(0, 0)).toEqual({ width: 0, height: 0 });
      expect(calculateClampedDimensions(-100, 500)).toEqual({ width: 0, height: 0 });
    });

    it('clamps landscape image exceeding 1600px while preserving 4:3 aspect ratio', () => {
      const { width, height } = calculateClampedDimensions(3200, 2400, 1600);
      expect(width).toBe(1600);
      expect(height).toBe(1200);
    });

    it('clamps portrait image exceeding 1600px while preserving 3:4 aspect ratio', () => {
      const { width, height } = calculateClampedDimensions(2400, 3200, 1600);
      expect(width).toBe(1200);
      expect(height).toBe(1600);
    });

    it('clamps large square image to 1600x1600', () => {
      const { width, height } = calculateClampedDimensions(4000, 4000, 1600);
      expect(width).toBe(1600);
      expect(height).toBe(1600);
    });

    it('does NOT upscale images already smaller than 1600px', () => {
      const { width, height } = calculateClampedDimensions(1200, 900, 1600);
      expect(width).toBe(1200);
      expect(height).toBe(900);
    });

    it('preserves exact 1600px boundaries', () => {
      const { width, height } = calculateClampedDimensions(1600, 1200, 1600);
      expect(width).toBe(1600);
      expect(height).toBe(1200);
    });
  });

  describe('3. JPEG Base64 Header Validation (isValidJpegBase64)', () => {
    it('accepts base64 starting with standard JPEG magic bytes (/9j/)', () => {
      const validJpeg = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...';
      expect(isValidJpegBase64(validJpeg)).toBe(true);
    });

    it('accepts full data URL with JPEG prefix', () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
      expect(isValidJpegBase64(dataUrl)).toBe(true);
    });

    it('rejects PNG base64 payloads starting with iVBOR', () => {
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      expect(isValidJpegBase64(pngBase64)).toBe(false);
    });

    it('rejects empty, null, or undefined values', () => {
      expect(isValidJpegBase64('')).toBe(false);
      expect(isValidJpegBase64(null as unknown as string)).toBe(false);
      expect(isValidJpegBase64(undefined as unknown as string)).toBe(false);
      expect(isValidJpegBase64('corrupt string')).toBe(false);
    });
  });

  describe('4. Blank and Pitch-Black Detection (verifyNotBlackOrBlank)', () => {
    it('rejects pitch-black image where all sampled pixels have zero luminance', () => {
      const fakeCtx = {
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(0) // All black pixels
        })
      } as unknown as CanvasRenderingContext2D;

      const isClear = verifyNotBlackOrBlank(fakeCtx, 100, 100);
      expect(isClear).toBe(false);
    });

    it('rejects completely blank solid white frame where all pixels are 255', () => {
      const fakeCtx = {
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(255) // Pure white
        })
      } as unknown as CanvasRenderingContext2D;

      const isClear = verifyNotBlackOrBlank(fakeCtx, 100, 100);
      expect(isClear).toBe(false);
    });

    it('accepts healthy frame with varied luminance across the 10x10 grid', () => {
      const data = new Uint8ClampedArray(100 * 100 * 4);
      // Fill with varied medical box colors (mix of light and dark)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = (i % 250);     // R
        data[i + 1] = 120;       // G
        data[i + 2] = (i % 200); // B
        data[i + 3] = 255;       // A
      }

      const fakeCtx = {
        getImageData: vi.fn().mockReturnValue({ data })
      } as unknown as CanvasRenderingContext2D;

      const isClear = verifyNotBlackOrBlank(fakeCtx, 100, 100);
      expect(isClear).toBe(true);
    });

    it('handles edge cases safely if context is null or dimensions are invalid', () => {
      expect(verifyNotBlackOrBlank(null as unknown as CanvasRenderingContext2D, 100, 100)).toBe(false);
      expect(verifyNotBlackOrBlank({} as CanvasRenderingContext2D, 0, 0)).toBe(false);
    });
  });

  describe('5. Unified Pipeline (processAndValidateImage)', () => {
    it('compresses and returns valid JPEG payload with solid white background fill', async () => {
      const fillRectSpy = vi.fn();
      const drawImageSpy = vi.fn();

      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: fillRectSpy,
        drawImage: drawImageSpy,
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(1000 * 1000 * 4).fill(128)
        })
      } as unknown as CanvasRenderingContext2D);

      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/' + 'A'.repeat(600)
      );

      const blob = new Blob(['sample-image-data'], { type: 'image/jpeg' });
      const result = await processAndValidateImage(blob);

      expect(result.mimeType).toBe('image/jpeg');
      expect(result.base64).toMatch(/^\/9j\//);
      expect(result.sizeBytes).toBeGreaterThan(0);
      expect(fillRectSpy).toHaveBeenCalledWith(0, 0, expect.any(Number), expect.any(Number));
      expect(drawImageSpy).toHaveBeenCalled();
    });

    it('rejects completely dark or black photos with friendly Arabic error', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(0) // Pitch black
        })
      } as unknown as CanvasRenderingContext2D);

      const blob = new Blob(['black-screen'], { type: 'image/jpeg' });
      await expect(processAndValidateImage(blob)).rejects.toThrow(
        'الصورة الملتقطة تبدو مظلمة جداً أو فارغة تماماً (شاشة سوداء). يرجى التأكد من تشغيل الإضاءة وإعادة التصوير.'
      );
    });

    it('rejects output if generated base64 does not start with /9j/', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(128)
        })
      } as unknown as CanvasRenderingContext2D);

      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
        'data:image/png;base64,iVBORw0KGgo' + 'A'.repeat(600)
      );

      const blob = new Blob(['invalid-header'], { type: 'image/png' });
      await expect(processAndValidateImage(blob)).rejects.toThrow(
        'صيغة الصورة الناتجة غير صالحة (JPEG Header Missing).'
      );
    });

    it('rejects output if base64 length is under 500 characters', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(128)
        })
      } as unknown as CanvasRenderingContext2D);

      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
        'data:image/jpeg;base64,/9j/tiny'
      );

      const blob = new Blob(['tiny'], { type: 'image/jpeg' });
      await expect(processAndValidateImage(blob)).rejects.toThrow(
        'حجم بيانات الصورة صغير جداً وغير صالح.'
      );
    });

    it('safely revokes object URL in finally block for File/Blob input', async () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
        'data:image/jpeg;base64,/9j/' + 'A'.repeat(600)
      );
      const blob = new Blob(['clean-up-test'], { type: 'image/jpeg' });

      await processAndValidateImage(blob);
      expect(revokeSpy).toHaveBeenCalled();
    });
  });

  describe('6. Dual-Mode Image Compression (compressImage & compressPrescriptionImage)', () => {
    it('compressImage uses 1024px max dimension and 0.7 quality by default', async () => {
      const toDataUrlSpy = vi.fn().mockReturnValue(
        'data:image/jpeg;base64,/9j/' + 'A'.repeat(600)
      );
      const fillRectSpy = vi.fn();
      const drawImageSpy = vi.fn();

      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: fillRectSpy,
        drawImage: drawImageSpy,
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(128)
        })
      } as unknown as CanvasRenderingContext2D);

      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(toDataUrlSpy);

      const blob = new Blob(['box-photo'], { type: 'image/jpeg' });
      const result = await compressImage(blob);

      expect(toDataUrlSpy).toHaveBeenCalledWith('image/jpeg', 0.7);
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.base64).toMatch(/^\/9j\//);
      expect(fillRectSpy).toHaveBeenCalled();
      expect(drawImageSpy).toHaveBeenCalled();
    });

    it('compressPrescriptionImage compresses with max 1600px and 0.8 JPEG quality', async () => {
      const toDataUrlSpy = vi.fn().mockReturnValue(
        'data:image/jpeg;base64,/9j/' + 'A'.repeat(600)
      );
      const fillRectSpy = vi.fn();
      const drawImageSpy = vi.fn();

      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: fillRectSpy,
        drawImage: drawImageSpy,
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(128)
        })
      } as unknown as CanvasRenderingContext2D);

      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(toDataUrlSpy);

      const blob = new Blob(['prescription-photo'], { type: 'image/jpeg' });
      const result = await compressPrescriptionImage(blob);

      expect(toDataUrlSpy).toHaveBeenCalledWith('image/jpeg', 0.8);
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.base64).toMatch(/^\/9j\//);
    });

    it('processAndValidatePrescriptionImage is an alias for compressPrescriptionImage', () => {
      expect(processAndValidatePrescriptionImage).toBe(compressPrescriptionImage);
    });

    it('maintains #FFFFFF canvas prefill to avoid Android WebView black transparency bug', async () => {
      let canvasFillStyle = '';
      const fillRectSpy = vi.fn();

      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        get fillStyle() {
          return canvasFillStyle;
        },
        set fillStyle(val) {
          canvasFillStyle = val;
        },
        fillRect: fillRectSpy,
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(128)
        })
      } as unknown as CanvasRenderingContext2D);

      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
        'data:image/jpeg;base64,/9j/' + 'A'.repeat(600)
      );

      const blob = new Blob(['sample-img'], { type: 'image/jpeg' });
      await compressPrescriptionImage(blob);

      expect(canvasFillStyle).toBe('#FFFFFF');
      expect(fillRectSpy).toHaveBeenCalled();
    });

    it('rejects pitch black prescription captures with kind Arabic error', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(0) // Pitch black
        })
      } as unknown as CanvasRenderingContext2D);

      const blob = new Blob(['dark-prescription'], { type: 'image/jpeg' });
      await expect(compressPrescriptionImage(blob)).rejects.toThrow(
        'الصورة الملتقطة تبدو مظلمة جداً أو فارغة تماماً (شاشة سوداء). يرجى التأكد من تشغيل الإضاءة وإعادة التصوير.'
      );
    });

    it('returns a valid CompressedImage with base64 starting with /9j/ and accurate sizeBytes', async () => {
      const sampleBase64 = '/9j/' + 'B'.repeat(800);
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(128)
        })
      } as unknown as CanvasRenderingContext2D);

      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
        `data:image/jpeg;base64,${sampleBase64}`
      );

      const blob = new Blob(['valid-prescription-bytes'], { type: 'image/jpeg' });
      const result = await compressPrescriptionImage(blob);

      expect(result.mimeType).toBe('image/jpeg');
      expect(result.base64).toBe(sampleBase64);
      expect(result.base64.startsWith('/9j/')).toBe(true);
      expect(result.sizeBytes).toBe(Math.round((sampleBase64.length * 3) / 4));
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    it('supports string input (both raw base64 and data URL prefix) seamlessly', async () => {
      const sampleBase64 = '/9j/' + 'C'.repeat(600);
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(128)
        })
      } as unknown as CanvasRenderingContext2D);

      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
        `data:image/jpeg;base64,${sampleBase64}`
      );

      // Raw base64 string
      const rawRes = await compressPrescriptionImage(sampleBase64);
      expect(rawRes.base64).toBe(sampleBase64);

      // Data URL string
      const dataUrlRes = await compressPrescriptionImage(`data:image/jpeg;base64,${sampleBase64}`);
      expect(dataUrlRes.base64).toBe(sampleBase64);
    });

    it('safely revokes object URL for File/Blob inputs in finally block', async () => {
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(128)
        })
      } as unknown as CanvasRenderingContext2D);

      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
        'data:image/jpeg;base64,/9j/' + 'D'.repeat(600)
      );

      const blob = new Blob(['blob-for-cleanup'], { type: 'image/jpeg' });
      await compressPrescriptionImage(blob);
      expect(revokeSpy).toHaveBeenCalled();
    });

    it('rejects solid blank white prescription captures with kind Arabic error', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(255) // Pure blank white
        })
      } as unknown as CanvasRenderingContext2D);

      const blob = new Blob(['white-prescription'], { type: 'image/jpeg' });
      await expect(compressPrescriptionImage(blob)).rejects.toThrow(
        'الصورة الملتقطة تبدو مظلمة جداً أو فارغة تماماً (شاشة سوداء). يرجى التأكد من تشغيل الإضاءة وإعادة التصوير.'
      );
    });

    it('rejects tiny base64 output under MIN_VALID_BASE64_LENGTH', async () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(128)
        })
      } as unknown as CanvasRenderingContext2D);

      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
        'data:image/jpeg;base64,/9j/short'
      );

      const blob = new Blob(['short-output'], { type: 'image/jpeg' });
      await expect(compressPrescriptionImage(blob)).rejects.toThrow(
        'حجم بيانات الصورة صغير جداً وغير صالح.'
      );
    });
  });
});

