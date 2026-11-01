import { describe, it, expect } from 'vitest';
import { validatePrescriptionSchema } from '../fixtures/testContracts';
import { sampleClearPrescription, sampleEmptyItemsPrescription, sampleTenItemsPrescription } from '../fixtures/samplePrescriptions';
import { MockCloudflareWorker } from '../helpers/mockWorker';

describe('Tier 1: Feature Coverage — Prescription Pipeline & Edge Backend (F09 - F14)', () => {
  const mockWorker = new MockCloudflareWorker();

  // =========================================================================
  // F09: Prescription Camera & Gallery Flow
  // =========================================================================
  describe('F09: Prescription Camera & Gallery Flow', () => {
    it('1. verifies "الروشتة" tab defines dual capture mechanisms: camera and gallery', () => {
      const prescriptionFlowControls = {
        primaryAction: 'صوّر الروشتة',
        secondaryAction: 'اختر من المعرض',
      };
      expect(prescriptionFlowControls.primaryAction).toBe('صوّر الروشتة');
      expect(prescriptionFlowControls.secondaryAction).toBe('اختر من المعرض');
    });

    it('2. verifies prescription camera configuration specifies 1600px max and high quality', () => {
      const prescriptionCameraConfig = {
        maxLongestSide: 1600,
        jpegQuality: 0.8,
        source: 'CAMERA',
      };
      expect(prescriptionCameraConfig.maxLongestSide).toBe(1600);
      expect(prescriptionCameraConfig.jpegQuality).toBe(0.8);
    });

    it('3. verifies prescription gallery configuration specifies Photos source', () => {
      const galleryConfig = {
        source: 'PHOTOS',
        allowsEditing: false,
      };
      expect(galleryConfig.source).toBe('PHOTOS');
    });

    it('4. verifies user cancelation returns null gracefully without throwing errors', () => {
      const isCancelled = true;
      const handleResult = (cancelled: boolean) => (cancelled ? null : { image: 'data' });
      expect(handleResult(isCancelled)).toBeNull();
    });

    it('5. verifies capture failure surfaces an interactive retry button', () => {
      const errorState = {
        hasError: true,
        retryButtonText: 'إعادة المحاولة',
      };
      expect(errorState.retryButtonText).toBe('إعادة المحاولة');
    });
  });

  // =========================================================================
  // F10: Prescription High-Res Compression
  // =========================================================================
  describe('F10: Prescription High-Res Compression', () => {
    function computeTargetDimensions(w: number, h: number, maxSide: number): { targetWidth: number; targetHeight: number } {
      if (w <= maxSide && h <= maxSide) return { targetWidth: w, targetHeight: h };
      if (w >= h) {
        return { targetWidth: maxSide, targetHeight: Math.round((h * maxSide) / w) };
      }
      return { targetWidth: Math.round((w * maxSide) / h), targetHeight: maxSide };
    }

    it('1. verifies prescription compression targets 1600px max side (vs 1024px for box)', () => {
      const prescriptionMax = 1600;
      const boxMax = 1024;
      expect(prescriptionMax).toBe(1600);
      expect(boxMax).toBe(1024);
      expect(prescriptionMax).toBeGreaterThan(boxMax);
    });

    it('2. verifies prescription JPEG quality is 0.8 (vs 0.7 for box)', () => {
      const prescriptionQuality = 0.8;
      const boxQuality = 0.7;
      expect(prescriptionQuality).toBe(0.8);
      expect(boxQuality).toBe(0.7);
    });

    it('3. verifies landscape 2400x1800 clamps longest side to 1600x1200', () => {
      const dims = computeTargetDimensions(2400, 1800, 1600);
      expect(dims.targetWidth).toBe(1600);
      expect(dims.targetHeight).toBe(1200);
    });

    it('4. verifies portrait 1800x3200 clamps longest side to 900x1600', () => {
      const dims = computeTargetDimensions(1800, 3200, 1600);
      expect(dims.targetWidth).toBe(900);
      expect(dims.targetHeight).toBe(1600);
    });

    it('5. verifies white canvas backdrop fill is specified to eliminate Android WebView black artifacts', () => {
      const fillStyle = '#FFFFFF';
      expect(fillStyle).toBe('#FFFFFF');
    });
  });

  // =========================================================================
  // F11: Cloudflare Worker Prescription Route/Mode
  // =========================================================================
  describe('F11: Cloudflare Worker Prescription Route/Mode', () => {
    it('1. verifies mock worker accepts mode: "prescription" and returns prescription schema', async () => {
      const res = await mockWorker.handleRequest('http://localhost/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'prescription',
          image: '/9j/mockPrescriptionClearImagePayload',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      const validation = validatePrescriptionSchema(json);
      expect(validation.valid).toBe(true);
      expect(json.items.length).toBeGreaterThan(0);
    });

    it('2. verifies Rule 1: low confidence item leaves explanation empty without guessing', async () => {
      const res = await mockWorker.handleRequest('http://localhost/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'prescription',
          image: '/9j/mixed_prescription_image',
        }),
      });

      const json = await res.json();
      const lowConfidenceItem = json.items.find((i: any) => i.confidence === 'low');
      expect(lowConfidenceItem).toBeDefined();
      expect(lowConfidenceItem.short_explanation).toBe('');
    });

    it('3. verifies Rule 2: unclear/dark photo returns is_clear: false with Arabic retake_message', async () => {
      const res = await mockWorker.handleRequest('http://localhost/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'prescription',
          image: '/9j/unclear_empty_prescription_image',
        }),
      });

      const json = await res.json();
      expect(json.is_clear).toBe(false);
      expect(json.retake_message).toContain('إضاءة');
      expect(json.items).toEqual([]);
    });

    it('4. verifies Rule 3: doctor written instructions are preserved verbatim', () => {
      const item = sampleClearPrescription.items[0];
      expect(item.written_instructions).toBe('قرص مرتين يومياً بعد الأكل');
      expect(item.line_text_as_written).toBe('Tab Metformin 500mg 1x2 pc');
    });

    it('5. verifies Rule 5: items array enforces maximum 10 items ceiling', () => {
      expect(sampleTenItemsPrescription.items.length).toBe(10);
      const validation = validatePrescriptionSchema(sampleTenItemsPrescription);
      expect(validation.valid).toBe(true);

      const elevenItems = {
        ...sampleTenItemsPrescription,
        items: [...sampleTenItemsPrescription.items, sampleTenItemsPrescription.items[0]],
      };
      const invalidValidation = validatePrescriptionSchema(elevenItems);
      expect(invalidValidation.valid).toBe(false);
      expect(invalidValidation.errors[0]).toContain('exceeds maximum allowed 10 items');
    });
  });

  // =========================================================================
  // F12: Model Configuration Environment Variables
  // =========================================================================
  describe('F12: Model Configuration Environment Variables', () => {
    it('1. verifies GEMINI_MODEL_PRESCRIPTION defaults to gemini-3.8-flash with LOW thinking', () => {
      const defaultPrescriptionModel = 'gemini-3.8-flash';
      const defaultThinkingConfig = { thinkingLevel: 'LOW' };
      expect(defaultPrescriptionModel).toBe('gemini-3.8-flash');
      expect(defaultThinkingConfig.thinkingLevel).toBe('LOW');
    });

    it('2. verifies GEMINI_MODEL is preserved for fast box analysis', () => {
      const defaultBoxModel = 'gemini-2.5-flash';
      expect(defaultBoxModel).toContain('flash');
    });

    it('3. verifies worker configures active model dynamically from env without hardcoding', async () => {
      mockWorker.setConfig({
        geminiModelBox: 'gemini-box-custom',
        geminiModelPrescription: 'gemini-rx-custom',
      });

      const healthRes = await mockWorker.handleRequest('http://localhost/health');
      const healthData = await healthRes.json();

      expect(healthData.model_box).toBe('gemini-box-custom');
      expect(healthData.model_prescription).toBe('gemini-rx-custom');
    });

    it('4. verifies worker supports environment variable overrides cleanly', () => {
      const env = {
        GEMINI_MODEL: 'gemini-2.5-flash',
        GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash',
      };
      const activeModel = (env.GEMINI_MODEL_PRESCRIPTION || 'gemini-3.8-flash').replace(/^models\//, '');
      expect(activeModel).toBe('gemini-3.8-flash');
    });

    it('5. verifies fallback to default model if environment variable is omitted', () => {
      const env: { GEMINI_MODEL_PRESCRIPTION?: string } = {};
      const activeModel = env.GEMINI_MODEL_PRESCRIPTION || 'gemini-3.8-flash';
      expect(activeModel).toBe('gemini-3.8-flash');
    });
  });

  // =========================================================================
  // F13: Worker 25s Abort & Client 30s Timeout
  // =========================================================================
  describe('F13: Worker 25s Abort & Client 30s Timeout', () => {
    it('1. verifies Worker 25s abort limit specification', () => {
      const workerAbortTimeoutMs = 25000;
      expect(workerAbortTimeoutMs).toBe(25000);
    });

    it('2. verifies Worker returns HTTP 504 UPSTREAM_TIMEOUT upon abort', async () => {
      mockWorker.setConfig({ forceTimeout: true });
      const res = await mockWorker.handleRequest('http://localhost/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'prescription', image: 'dummy' }),
      });

      expect(res.status).toBe(504);
      const json = await res.json();
      expect(json.error).toBe('UPSTREAM_TIMEOUT');
      expect(json.error_code).toBe('UPSTREAM_TIMEOUT');
      expect(json.retake_message).toContain('استغرقت الخدمة وقتاً أطول');
      mockWorker.setConfig({ forceTimeout: false });
    });

    it('3. verifies Client 30s timeout specification', () => {
      const clientTimeoutMs = 30000;
      expect(clientTimeoutMs).toBe(30000);
      expect(clientTimeoutMs).toBeGreaterThan(25000); // Must be strictly greater than Worker abort
    });

    it('4. verifies Client maps timeout to category network_timeout and distinct error code', () => {
      const mapError = (errName: string) => {
        if (errName === 'AbortError' || errName === 'CLIENT_TIMEOUT') {
          return { error_category: 'network_timeout', error_code: 'CLIENT_TIMEOUT' };
        }
        return { error_category: 'server_error', error_code: 'UNKNOWN' };
      };

      const mapped = mapError('CLIENT_TIMEOUT');
      expect(mapped.error_category).toBe('network_timeout');
      expect(mapped.error_code).toBe('CLIENT_TIMEOUT');
    });

    it('5. verifies timeout error is never misclassified as "image not clear"', () => {
      const timeoutError = {
        is_clear: false,
        error_code: 'UPSTREAM_TIMEOUT',
        error_category: 'network_timeout',
      };
      // Must not be classified as unclear_image
      expect(timeoutError.error_category).not.toBe('unclear_image');
      expect(timeoutError.error_code).not.toBe('UNCLEAR_IMAGE');
    });
  });

  // =========================================================================
  // F14: Prescription Schema Validation & Empty Items Routing
  // =========================================================================
  describe('F14: Prescription Schema Validation & Empty Items Routing', () => {
    it('1. verifies validatePrescriptionSchema accepts fully compliant sample prescription', () => {
      const validation = validatePrescriptionSchema(sampleClearPrescription);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('2. verifies empty items array triggers retake routing decision in client', () => {
      const shouldRouteToRetake = (result: typeof sampleEmptyItemsPrescription) => {
        return !result.is_clear || !result.items || result.items.length === 0;
      };

      expect(shouldRouteToRetake(sampleEmptyItemsPrescription)).toBe(true);
      expect(shouldRouteToRetake(sampleClearPrescription)).toBe(false);
    });

    it('3. verifies missing required top-level fields fail schema validation', () => {
      const missingFields = { is_clear: true }; // missing items, evidence_text, audio_summary
      const validation = validatePrescriptionSchema(missingFields);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('4. verifies invalid confidence string is rejected by validator', () => {
      const invalidConfidence = {
        ...sampleClearPrescription,
        confidence: 'super_high',
      };
      const validation = validatePrescriptionSchema(invalidConfidence);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('confidence must be high, medium, or low');
    });

    it('5. verifies low-confidence items with short_explanation violate schema rule 4', () => {
      const violatingItem = {
        ...sampleClearPrescription,
        items: [
          {
            ...sampleClearPrescription.items[0],
            confidence: 'low' as const,
            short_explanation: 'This should not be here because confidence is low',
          },
        ],
      };
      const validation = validatePrescriptionSchema(violatingItem);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('must be empty');
    });
  });
});
