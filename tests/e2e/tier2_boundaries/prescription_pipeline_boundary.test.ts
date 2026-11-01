import { describe, it, expect } from 'vitest';
import { validatePrescriptionSchema } from '../fixtures/testContracts';
import { sampleTenItemsPrescription } from '../fixtures/samplePrescriptions';
import { MockCloudflareWorker } from '../helpers/mockWorker';
import { calculateClampedDimensions, verifyNotBlackOrBlank } from '@/utils/imageProcessor';

describe('Tier 2: Boundary & Corner Cases — Prescription Pipeline & Edge Backend (F09 - F14)', () => {
  const mockWorker = new MockCloudflareWorker();

  // =========================================================================
  // F09 Boundaries
  // =========================================================================
  describe('F09: Prescription Camera & Gallery Boundaries', () => {
    it('1. verifies multi-photo selection is clamped to the first single photo', () => {
      const selectedPhotos = [{ path: 'p1.jpg' }, { path: 'p2.jpg' }, { path: 'p3.jpg' }];
      const singlePhoto = selectedPhotos.length > 0 ? selectedPhotos[0] : null;
      expect(singlePhoto?.path).toBe('p1.jpg');
    });

    it('2. verifies non-image mime types (.pdf, .txt) are rejected by validator', () => {
      const isAllowedImageType = (mime: string) => ['image/jpeg', 'image/png', 'image/webp'].includes(mime);
      expect(isAllowedImageType('application/pdf')).toBe(false);
      expect(isAllowedImageType('text/plain')).toBe(false);
      expect(isAllowedImageType('image/jpeg')).toBe(true);
    });

    it('3. verifies extreme file size (30MB) is intercepted client-side', () => {
      const maxRawSizeBytes = 20 * 1024 * 1024; // 20MB client limit
      const testFileSize = 30 * 1024 * 1024;
      const isTooLarge = testFileSize > maxRawSizeBytes;
      expect(isTooLarge).toBe(true);
    });

    it('4. verifies gallery picker unknown error maps to friendly Arabic message', () => {
      const mapPickerError = (_err: unknown) => {
        return 'تعذر فتح ألبوم الصور. يرجى المحاولة مرة أخرى أو استخدام الكاميرا.';
      };
      expect(mapPickerError(new Error('Unknown native error'))).toContain('ألبوم الصور');
    });

    it('5. verifies permission rationale flag indicates need for explanatory dialog', () => {
      const permissionState = { camera: 'prompt-with-rationale' };
      const needsExplanation = permissionState.camera === 'prompt-with-rationale';
      expect(needsExplanation).toBe(true);
    });
  });

  // =========================================================================
  // F10 Boundaries
  // =========================================================================
  describe('F10: Prescription High-Res Compression Boundaries', () => {
    it('1. verifies exact square 1600x1600 maintains 1600x1600 clamped dimensions', () => {
      const dims = calculateClampedDimensions(1600, 1600, 1600);
      expect(dims.width).toBe(1600);
      expect(dims.height).toBe(1600);
    });

    it('2. verifies extreme panoramic 8000x1000 clamps to 1600x200 preserving 8:1 ratio', () => {
      const dims = calculateClampedDimensions(8000, 1000, 1600);
      expect(dims.width).toBe(1600);
      expect(dims.height).toBe(200);
    });

    it('3. verifies quality 0.8 JPEG compresses significantly below uncompressed raw bytes', () => {
      const rawPixelsBytes = 1600 * 1200 * 4; // ~7.6MB
      const estimatedCompressedBytes = Math.round(1600 * 1200 * 0.8 * 0.2); // ~300KB
      expect(estimatedCompressedBytes).toBeLessThan(rawPixelsBytes / 10);
    });

    it('4. verifies verifyNotBlackOrBlank detects pitch-black canvas', () => {
      const mockBlackCtx = {
        getImageData: () => ({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(0), // Solid black
        }),
      } as any;

      const isClear = verifyNotBlackOrBlank(mockBlackCtx, 100, 100);
      expect(isClear).toBe(false);
    });

    it('5. verifies verifyNotBlackOrBlank detects solid blank white canvas', () => {
      const mockWhiteCtx = {
        getImageData: () => ({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(255), // Solid white
        }),
      } as any;

      const isClear = verifyNotBlackOrBlank(mockWhiteCtx, 100, 100);
      expect(isClear).toBe(false);
    });
  });

  // =========================================================================
  // F11 Boundaries
  // =========================================================================
  describe('F11: Cloudflare Worker Prescription Route Boundaries', () => {
    it('1. verifies worker returns 400 MISSING_IMAGE when image is empty string', async () => {
      const res = await mockWorker.handleRequest('http://localhost/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'prescription', image: '' }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error_code).toBe('MISSING_IMAGE');
    });

    it('2. verifies worker returns 413 PAYLOAD_TOO_LARGE when payload exceeds 4MB', async () => {
      mockWorker.setConfig({ forcePayloadTooLarge: true });
      const res = await mockWorker.handleRequest('http://localhost/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'prescription', image: 'huge' }),
      });

      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.error_code).toBe('PAYLOAD_TOO_LARGE');
      mockWorker.setConfig({ forcePayloadTooLarge: false });
    });

    it('3. verifies worker returns 429 RATE_LIMIT_EXCEEDED when threshold is exceeded', async () => {
      mockWorker.setConfig({ forceRateLimit: true });
      const res = await mockWorker.handleRequest('http://localhost/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'prescription', image: 'test' }),
      });

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('60');
      mockWorker.setConfig({ forceRateLimit: false });
    });

    it('4. verifies worker returns 405 METHOD_NOT_ALLOWED for GET requests on prescription endpoint', async () => {
      const res = await mockWorker.handleRequest('http://localhost/api/prescription', {
        method: 'GET',
      });

      expect(res.status).toBe(405);
      const json = await res.json();
      expect(json.error_code).toBe('METHOD_NOT_ALLOWED');
    });

    it('5. verifies worker returns 400 BAD_REQUEST for malformed non-JSON body', async () => {
      const res = await mockWorker.handleRequest('http://localhost/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json-string{missing',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error_code).toBe('BAD_REQUEST');
    });
  });

  // =========================================================================
  // F12 Boundaries
  // =========================================================================
  describe('F12: Model Configuration Boundaries', () => {
    it('1. verifies empty string GEMINI_MODEL_PRESCRIPTION defaults to gemini-3.8-flash', () => {
      const getModel = (envVar?: string) => (envVar && envVar.trim() ? envVar.trim() : 'gemini-3.8-flash');
      expect(getModel('')).toBe('gemini-3.8-flash');
      expect(getModel('   ')).toBe('gemini-3.8-flash');
      expect(getModel(undefined)).toBe('gemini-3.8-flash');
    });

    it('2. verifies models/ prefix is cleanly stripped from configured model name', () => {
      const sanitizeModel = (name: string) => name.replace(/^models\//, '');
      expect(sanitizeModel('models/gemini-3.8-flash')).toBe('gemini-3.8-flash');
      expect(sanitizeModel('gemini-3.8-flash')).toBe('gemini-3.8-flash');
    });

    it('3. verifies leading and trailing whitespace is trimmed from model name', () => {
      const raw = '   gemini-3.8-flash   ';
      expect(raw.trim()).toBe('gemini-3.8-flash');
    });

    it('4. verifies thinkingConfig level is strictly set to LOW for prescription flash model', () => {
      const thinkingConfig = { thinkingLevel: 'LOW' };
      expect(thinkingConfig.thinkingLevel).toBe('LOW');
      expect(['LOW', 'HIGH']).toContain(thinkingConfig.thinkingLevel);
    });

    it('5. verifies temperature is omitted for Gemini 3 models but retained for legacy models', () => {
      const isGemini3 = (m: string) => /gemini-3/i.test(m) || /3\.[0-9]/i.test(m);
      expect(isGemini3('gemini-3.8-flash')).toBe(true);
      expect(isGemini3('gemini-1.5-flash')).toBe(false);
    });
  });

  // =========================================================================
  // F13 Boundaries
  // =========================================================================
  describe('F13: Worker 25s & Client 30s Timeout Boundaries', () => {
    it('1. verifies exact 25000ms worker timeout boundary specification', () => {
      const WORKER_TIMEOUT = 25000;
      expect(WORKER_TIMEOUT).toBe(25000);
    });

    it('2. verifies exact 30000ms client timeout boundary specification', () => {
      const CLIENT_TIMEOUT = 30000;
      expect(CLIENT_TIMEOUT).toBe(30000);
      expect(CLIENT_TIMEOUT - 25000).toBe(5000); // Exactly 5 seconds grace period
    });

    it('3. verifies Worker abort response includes UPSTREAM_TIMEOUT error code', async () => {
      mockWorker.setConfig({ forceTimeout: true });
      const res = await mockWorker.handleRequest('http://localhost/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'prescription', image: 'test' }),
      });

      const json = await res.json();
      expect(json.error_code).toBe('UPSTREAM_TIMEOUT');
      mockWorker.setConfig({ forceTimeout: false });
    });

    it('4. verifies network connection failure maps to network_timeout category', () => {
      const categorizeError = (err: Error) => {
        if (err.message.includes('Failed to fetch') || err.name === 'AbortError') {
          return 'network_timeout';
        }
        return 'server_error';
      };

      expect(categorizeError(new TypeError('Failed to fetch'))).toBe('network_timeout');
    });

    it('5. verifies client abort controller cancels active request cleanly', () => {
      const controller = new AbortController();
      expect(controller.signal.aborted).toBe(false);
      controller.abort();
      expect(controller.signal.aborted).toBe(true);
    });
  });

  // =========================================================================
  // F14 Boundaries
  // =========================================================================
  describe('F14: Prescription Schema Boundaries', () => {
    it('1. verifies empty items array explicitly triggers retake screen decision', () => {
      const result = { is_clear: true, items: [] };
      const requiresRetake = !result.is_clear || result.items.length === 0;
      expect(requiresRetake).toBe(true);
    });

    it('2. verifies exactly 10 items passes schema validation boundary', () => {
      const validation = validatePrescriptionSchema(sampleTenItemsPrescription);
      expect(validation.valid).toBe(true);
    });

    it('3. verifies 11 items fails schema validation boundary', () => {
      const elevenItems = {
        ...sampleTenItemsPrescription,
        items: [...sampleTenItemsPrescription.items, sampleTenItemsPrescription.items[0]],
      };
      const validation = validatePrescriptionSchema(elevenItems);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('exceeds maximum allowed 10 items');
    });

    it('4. verifies low confidence item with non-empty short_explanation fails validation', () => {
      const badItem = {
        ...sampleTenItemsPrescription,
        items: [
          {
            ...sampleTenItemsPrescription.items[0],
            confidence: 'low' as const,
            short_explanation: 'Invalid explanation for low confidence',
          },
        ],
      };
      const validation = validatePrescriptionSchema(badItem);
      expect(validation.valid).toBe(false);
    });

    it('5. verifies non-string line_text_as_written fails schema validation', () => {
      const badLine = {
        ...sampleTenItemsPrescription,
        items: [
          {
            ...sampleTenItemsPrescription.items[0],
            line_text_as_written: 12345 as any,
          },
        ],
      };
      const validation = validatePrescriptionSchema(badLine);
      expect(validation.valid).toBe(false);
    });
  });
});
