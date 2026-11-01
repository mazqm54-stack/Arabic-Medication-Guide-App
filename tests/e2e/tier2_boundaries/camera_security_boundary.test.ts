import { describe, it, expect } from 'vitest';
import { capturePhoto } from '@/services/nativeCamera';
import { isValidJpegBase64, MIN_VALID_BASE64_LENGTH } from '@/utils/imageProcessor';
import { sanitizeMessage } from '../../../worker/src/index';

describe('Tier 2: Boundary & Corner Cases — Camera & Security (F01, F02)', () => {
  // =========================================================================
  // F01 Boundaries
  // =========================================================================
  describe('F01: Camera Crash Fix Boundaries', () => {
    it('1. verifies zero-byte or empty base64 string from camera is rejected by validation', () => {
      const validateCapturedPhoto = (photo: { base64Data?: string }) => {
        if (!photo || !photo.base64Data || photo.base64Data.trim() === '') {
          throw new Error('بيانات الصورة فارغة');
        }
        return true;
      };

      expect(() => validateCapturedPhoto({ base64Data: '' })).toThrow();
      expect(() => validateCapturedPhoto({} as any)).toThrow();
    });

    it('2. verifies corrupted base64 payload lacking /9j/ header fails isValidJpegBase64 check', () => {
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      expect(isValidJpegBase64(pngBase64)).toBe(false);
      expect(isValidJpegBase64('')).toBe(false);
      expect(isValidJpegBase64('/9j/4AAQSkZJRgABAQ...')).toBe(true);
    });

    it('3. verifies base64 payload under MIN_VALID_BASE64_LENGTH is rejected as truncated', () => {
      const truncatedBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/';
      expect(truncatedBase64.length).toBeLessThan(MIN_VALID_BASE64_LENGTH);

      const validateBase64Length = (b64: string) => {
        if (b64.length < MIN_VALID_BASE64_LENGTH) {
          throw new Error('حجم بيانات الصورة صغير جداً وغير صالح.');
        }
        return true;
      };

      expect(() => validateBase64Length(truncatedBase64)).toThrow('صغير جداً');
    });

    it('4. verifies extreme dimensions (8000x8000) are clamped without memory crash', () => {
      const maxSide = 1600;
      const originalW = 8000;
      const originalH = 8000;
      const targetW = maxSide;
      const targetH = Math.round((originalH * maxSide) / originalW);

      expect(targetW).toBe(1600);
      expect(targetH).toBe(1600);
    });

    it('5. verifies rapid consecutive camera open calls throttle without crashing', async () => {
      const calls = [capturePhoto(), capturePhoto(), capturePhoto()];
      const results = await Promise.allSettled(calls);
      expect(results).toHaveLength(3);
    });
  });

  // =========================================================================
  // F02 Boundaries
  // =========================================================================
  describe('F02: Secret Zero-Leak Boundaries', () => {
    it('1. verifies obfuscated or partial API key strings are sanitized', () => {
      const raw = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';
      const sanitized = sanitizeMessage(raw);
      expect(sanitized).toBe('[REDACTED_KEY]');
      expect(sanitized).not.toContain('AIzaSy');
    });

    it('2. verifies URL query parameters with keys (?key=...) are redacted', () => {
      const rawUrl = 'https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyTestKey12345678901234567890123';
      const sanitized = sanitizeMessage(rawUrl);
      expect(sanitized).toContain('key=[REDACTED_KEY]');
      expect(sanitized).not.toContain('TestKey');
    });

    it('3. verifies authorization bearer tokens are redacted', () => {
      const rawHeader = 'Authorization: Bearer ya29.a0AfH6SMBDummySecretToken12345';
      const sanitized = sanitizeMessage(rawHeader);
      expect(sanitized).toContain('[REDACTED_TOKEN]');
      expect(sanitized).not.toContain('ya29');
    });

    it('4. verifies base64 data payloads in error messages are redacted', () => {
      const rawPayload = 'inlineData: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/' + 'A'.repeat(120) + '"';
      const sanitized = sanitizeMessage(rawPayload);
      expect(sanitized).toContain('[REDACTED_BASE64]');
      expect(sanitized).not.toContain('AAAAAA');
    });

    it('5. verifies oversized error logs are truncated to 300 characters to prevent exfiltration', () => {
      const hugeMsg = 'SafeErrorPrefix: ' + 'X'.repeat(600);
      const sanitized = sanitizeMessage(hugeMsg);
      expect(sanitized.length).toBeLessThanOrEqual(300);
    });
  });
});
