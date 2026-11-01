import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getApiAnalyzeUrl,
  analyzeMedicationImage,
  fileToBase64,
  SAMPLE_MEDICATION_RESULT
} from '../src/services/geminiVision';

describe('Adversarial Challenge: geminiVision.ts Client Proxy', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    delete (import.meta.env as any).VITE_API_URL;
  });

  describe('1. Endpoint URL Resolution (getApiAnalyzeUrl)', () => {
    it('defaults to relative /api/analyze when VITE_API_URL is undefined', () => {
      delete (import.meta.env as any).VITE_API_URL;
      expect(getApiAnalyzeUrl()).toBe('/api/analyze');
    });

    it('defaults to relative /api/analyze when VITE_API_URL is empty string', () => {
      (import.meta.env as any).VITE_API_URL = '';
      expect(getApiAnalyzeUrl()).toBe('/api/analyze');
    });

    it('defaults to relative /api/analyze when VITE_API_URL is whitespace-only', () => {
      (import.meta.env as any).VITE_API_URL = '   \t\n  ';
      expect(getApiAnalyzeUrl()).toBe('/api/analyze');
    });

    it('uses configured absolute URL when VITE_API_URL is set', () => {
      (import.meta.env as any).VITE_API_URL = 'https://dalili.vercel.app/api/analyze';
      expect(getApiAnalyzeUrl()).toBe('https://dalili.vercel.app/api/analyze');
    });

    it('trims leading and trailing whitespace from configured VITE_API_URL', () => {
      (import.meta.env as any).VITE_API_URL = '  https://dalili.vercel.app/api/analyze  \n';
      expect(getApiAnalyzeUrl()).toBe('https://dalili.vercel.app/api/analyze');
    });

    it('allows local Android emulator loopback host (10.0.2.2)', () => {
      (import.meta.env as any).VITE_API_URL = 'http://10.0.2.2:3000/api/analyze';
      expect(getApiAnalyzeUrl()).toBe('http://10.0.2.2:3000/api/analyze');
    });

    it('returns custom relative path if configured', () => {
      (import.meta.env as any).VITE_API_URL = '/custom/api/proxy';
      expect(getApiAnalyzeUrl()).toBe('/custom/api/proxy');
    });
  });

  describe('2. Input Validation Guardrails', () => {
    it('rejects empty imageBase64 with kind Arabic validation error', async () => {
      await expect(analyzeMedicationImage({ imageBase64: '' }))
        .rejects
        .toThrow('يرجى التقاط صورة واضحة لعلبة الدواء أولاً.');
    });

    it('rejects whitespace-only imageBase64 with kind Arabic validation error', async () => {
      await expect(analyzeMedicationImage({ imageBase64: '   \n  ' }))
        .rejects
        .toThrow('يرجى التقاط صورة واضحة لعلبة الدواء أولاً.');
    });

    it('rejects null/undefined imageBase64 via unsafe cast', async () => {
      await expect(analyzeMedicationImage({ imageBase64: null as unknown as string }))
        .rejects
        .toThrow('يرجى التقاط صورة واضحة لعلبة الدواء أولاً.');
    });
  });

  describe('3. Network Request Dispatching', () => {
    it('dispatches POST request with correct payload and headers to default endpoint', async () => {
      delete (import.meta.env as any).VITE_API_URL;
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          is_clear: true,
          confidence: 'high',
          evidence_text: 'Aspirin 100mg',
          medicine_name_ar: 'أسبرين',
          medicine_name_en: 'Aspirin 100mg',
          active_ingredient: 'حمض أسيتيل الساليسيليك',
          uses: ['حماية القلب'],
          how_and_when: ['قرص يومياً بعد الأكل'],
          warnings: ['استشر الطبيب'],
          audio_summary: 'دواء أسبرين لحماية القلب'
        })
      });
      vi.stubGlobal('fetch', fakeFetch);

      const result = await analyzeMedicationImage({
        imageBase64: 'fake-base64-payload',
        mimeType: 'image/png'
      });

      expect(fakeFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fakeFetch.mock.calls[0];
      expect(calledUrl).toBe('/api/analyze');
      expect(calledInit.method).toBe('POST');
      expect(calledInit.headers).toEqual({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      });
      const parsedBody = JSON.parse(calledInit.body);
      expect(parsedBody).toEqual({
        image: 'fake-base64-payload',
        mimeType: 'image/png'
      });
      expect(result.is_clear).toBe(true);
      expect(result.medicine_name_ar).toBe('أسبرين');
    });

    it('dispatches request to configured VITE_API_URL', async () => {
      (import.meta.env as any).VITE_API_URL = 'https://my-backend.vercel.app/api/analyze';
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          is_clear: true,
          confidence: 'high',
          evidence_text: 'Panadol',
          medicine_name_ar: 'بنادول',
          medicine_name_en: 'Panadol',
          active_ingredient: 'باراسيتامول',
          uses: ['مسكن'],
          how_and_when: ['قرص عند اللزوم'],
          warnings: ['لا تفرط في الجرعة'],
          audio_summary: 'بنادول مسكن للألم'
        })
      });
      vi.stubGlobal('fetch', fakeFetch);

      await analyzeMedicationImage({
        imageBase64: 'sample-image'
      });

      expect(fakeFetch).toHaveBeenCalledTimes(1);
      const [calledUrl] = fakeFetch.mock.calls[0];
      expect(calledUrl).toBe('https://my-backend.vercel.app/api/analyze');
    });

    it('defaults mimeType to image/jpeg if not specified', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          is_clear: true,
          confidence: 'high',
          evidence_text: 'Text',
          medicine_name_ar: 'دواء',
          medicine_name_en: 'Medicine',
          active_ingredient: 'Ingredient',
          uses: ['استخدام'],
          how_and_when: ['طريقة'],
          warnings: ['تحذير'],
          audio_summary: 'ملخص'
        })
      });
      vi.stubGlobal('fetch', fakeFetch);

      await analyzeMedicationImage({
        imageBase64: 'sample-base64'
      });

      const [, calledInit] = fakeFetch.mock.calls[0];
      const parsedBody = JSON.parse(calledInit.body);
      expect(parsedBody.mimeType).toBe('image/jpeg');
    });
  });

  describe('4. Adversarial Network Failure Fallbacks', () => {
    it('handles catastrophic network drop (TypeError: Failed to fetch)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      await expect(analyzeMedicationImage({ imageBase64: 'test-data' }))
        .rejects
        .toThrow('Failed to fetch');
    });

    it('handles connection refused (NetworkError)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('NetworkError when attempting to fetch resource.')));

      await expect(analyzeMedicationImage({ imageBase64: 'test-data' }))
        .rejects
        .toThrow('NetworkError when attempting to fetch resource.');
    });

    it('handles request timeout or abort signal rejection', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

      await expect(analyzeMedicationImage({ imageBase64: 'test-data' }))
        .rejects
        .toThrow('The operation was aborted');
    });

    it('handles non-Error thrown exceptions with safe Arabic fallback', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue('Fatal String Exception'));

      await expect(analyzeMedicationImage({ imageBase64: 'test-data' }))
        .rejects
        .toThrow('حدث خطأ غير متوقع أثناء معالجة الصورة.');
    });
  });

  describe('5. Adversarial HTTP Error Handling & Upstream Statuses', () => {
    it('translates HTTP 400 Bad Request with backend retake_message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          is_clear: false,
          retake_message: 'لم يتم استلام صورة علبة الدواء. يرجى التقاط صورة واضحة والمحاولة مجدداً.',
          error: 'BAD_REQUEST'
        })
      }));

      await expect(analyzeMedicationImage({ imageBase64: 'corrupt-data' }))
        .rejects
        .toThrow('لم يتم استلام صورة علبة الدواء. يرجى التقاط صورة واضحة والمحاولة مجدداً.');
    });

    it('translates HTTP 413 Payload Too Large with backend retake_message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 413,
        json: async () => ({
          is_clear: false,
          retake_message: 'حجم الصورة كبير جداً (يتجاوز 4 ميجابايت). يرجى إعادة التقاط الصورة بحجم أصغر وإضاءة جيدة.',
          error: 'PAYLOAD_TOO_LARGE'
        })
      }));

      await expect(analyzeMedicationImage({ imageBase64: 'huge-data' }))
        .rejects
        .toThrow('حجم الصورة كبير جداً (يتجاوز 4 ميجابايت). يرجى إعادة التقاط الصورة بحجم أصغر وإضاءة جيدة.');
    });

    it('translates HTTP 429 Rate Limit Exceeded with backend retake_message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          is_clear: false,
          retake_message: 'تم تجاوز حد الاستخدام المسموح (20 تحليلاً في الساعة). يرجى الانتظار قليلاً قبل تصوير دواء آخر.',
          error: 'RATE_LIMIT_EXCEEDED'
        })
      }));

      await expect(analyzeMedicationImage({ imageBase64: 'rate-limited-data' }))
        .rejects
        .toThrow('تم تجاوز حد الاستخدام المسموح (20 تحليلاً في الساعة). يرجى الانتظار قليلاً قبل تصوير دواء آخر.');
    });

    it('translates HTTP 500 with backend retake_message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          is_clear: false,
          retake_message: 'حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية. يرجى المحاولة مرة أخرى.',
          error: 'UPSTREAM_API_ERROR'
        })
      }));

      await expect(analyzeMedicationImage({ imageBase64: 'err-data' }))
        .rejects
        .toThrow('حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية. يرجى المحاولة مرة أخرى.');
    });

    it('handles HTTP 500 without retake_message by falling back to error field', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'خطأ داخلي في الخادم'
        })
      }));

      await expect(analyzeMedicationImage({ imageBase64: 'err-data' }))
        .rejects
        .toThrow('خطأ داخلي في الخادم');
    });

    it('handles HTTP 502 Bad Gateway with HTML error body from Vercel crash', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        }
      }));

      await expect(analyzeMedicationImage({ imageBase64: 'crash-data' }))
        .rejects
        .toThrow('تعذر الاتصال بالمعالج الذكي (502). يرجى المحاولة مرة أخرى.');
    });

    it('handles HTTP 504 Gateway Timeout with empty body', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 504,
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON input');
        }
      }));

      await expect(analyzeMedicationImage({ imageBase64: 'timeout-data' }))
        .rejects
        .toThrow('تعذر الاتصال بالمعالج الذكي (504). يرجى المحاولة مرة أخرى.');
    });
  });

  describe('6. Schema Validation & Guardrails Integration', () => {
    it('returns parsed MedicineAnalysisResult when backend returns valid object', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => SAMPLE_MEDICATION_RESULT
      }));

      const result = await analyzeMedicationImage({ imageBase64: 'valid-box' });
      expect(result.is_clear).toBe(true);
      expect(result.medicine_name_ar).toBe('بانادول إكسترا');
      expect(result.uses?.length).toBeGreaterThan(0);
    });

    it('handles backend returning is_clear: false result safely', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          is_clear: false,
          retake_message: 'الصورة ضبابية جداً، يرجى إعادة التصوير في ضوء أوضح.',
          confidence: 'low',
          evidence_text: '',
          medicine_name_ar: '',
          medicine_name_en: '',
          active_ingredient: '',
          uses: [],
          how_and_when: [],
          warnings: [],
          audio_summary: ''
        })
      }));

      const result = await analyzeMedicationImage({ imageBase64: 'blurry-box' });
      expect(result.is_clear).toBe(false);
      expect(result.medicine_name_ar).toBeUndefined();
    });

    it('handles backend returning non-object primitive (e.g. number or null)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => null
      }));

      const result = await analyzeMedicationImage({ imageBase64: 'weird-response' });
      expect(result.is_clear).toBe(false);
      expect(result.raw_error).toContain('لم نتمكن من التعرف على محتويات الصورة');
    });
  });

  describe('7. fileToBase64 Utility Function', () => {
    it('converts File/Blob to base64 string without data: prefix', async () => {
      const blob = new Blob(['sample-file-content'], { type: 'image/jpeg' });
      const { base64, mimeType } = await fileToBase64(blob);

      expect(typeof base64).toBe('string');
      expect(base64).not.toContain('data:image/jpeg;base64,');
      expect(mimeType).toBe('image/jpeg');
    });
  });
});
