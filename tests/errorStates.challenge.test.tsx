import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App';
import { UnclearPhotoCard } from '../src/components/UnclearPhotoCard';
import * as geminiVision from '../src/services/geminiVision';
import * as geminiParser from '../src/services/geminiParser';
import * as imageProcessor from '../src/utils/imageProcessor';
import * as nativeCamera from '../src/services/nativeCamera';
import { ErrorCategory } from '../src/types';

describe('Adversarial Challenge Suite: Error States, Timeout Abortion & Interactive Retry (R2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to create a realistic mock camera photo
  const createMockPhotoFile = (filename = 'panadol-box.jpg'): nativeCamera.NativePhotoFile => {
    return Object.assign(
      new File(['mock-jpeg-binary-content'], filename, { type: 'image/jpeg' }),
      {
        base64Data: '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////',
        format: 'jpeg' as const,
        width: 800,
        height: 600,
        dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////'
      }
    );
  };

  // =========================================================================
  // 1. 30-Second AbortController Timeout & Network Diagnostics
  // =========================================================================
  describe('1. 30-Second AbortController Timeout & Client Network Abortion', () => {
    it('aborts after timeoutMs (30s) and throws AnalysisError with category network_timeout and errorCode CLIENT_TIMEOUT', async () => {
      vi.useFakeTimers();

      // Mock fetch to simulate a hanging connection that listens for abort signal
      const hangingFetch = vi.fn().mockImplementation((_url: string, options: RequestInit) => {
        return new Promise((_resolve, reject) => {
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              reject(new DOMException('Request timeout after 30000ms', 'AbortError'));
            });
          }
        });
      });
      vi.stubGlobal('fetch', hangingFetch);

      const promise = geminiVision.analyzeMedicationImage({
        imageBase64: 'valid-base64-content',
        timeoutMs: 30000
      });

      // Advance time past 30 seconds
      vi.advanceTimersByTime(30001);

      await expect(promise).rejects.toThrow(geminiVision.AnalysisError);
      await promise.catch((err: geminiVision.AnalysisError) => {
        expect(err.category).toBe('network_timeout');
        expect(err.errorCode).toBe('CLIENT_TIMEOUT');
        expect(err.message).toContain('30 ثانية');
        expect(err.message).toContain('التحقق من اتصال الإنترنت');
      });

      expect(hangingFetch).toHaveBeenCalledTimes(1);
    });

    it('honors custom timeoutMs parameter and aborts promptly at designated threshold', async () => {
      vi.useFakeTimers();

      const hangingFetch = vi.fn().mockImplementation((_url: string, options: RequestInit) => {
        return new Promise((_resolve, reject) => {
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              reject(new DOMException('Request timeout after 5000ms', 'AbortError'));
            });
          }
        });
      });
      vi.stubGlobal('fetch', hangingFetch);

      const promise = geminiVision.analyzeMedicationImage({
        imageBase64: 'valid-base64-content',
        timeoutMs: 5000
      });

      // At 4900ms, should not have rejected yet
      vi.advanceTimersByTime(4900);

      // At 5001ms, it aborts!
      vi.advanceTimersByTime(102);

      await expect(promise).rejects.toThrow(geminiVision.AnalysisError);
      await promise.catch((err: geminiVision.AnalysisError) => {
        expect(err.category).toBe('network_timeout');
        expect(err.errorCode).toBe('CLIENT_TIMEOUT');
      });
    });

    it('maps network TypeError ("Failed to fetch") to category network_timeout and errorCode NETWORK_ERROR', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      );

      await expect(
        geminiVision.analyzeMedicationImage({ imageBase64: 'valid-base64' })
      ).rejects.toMatchObject({
        category: 'network_timeout',
        errorCode: 'NETWORK_ERROR'
      });
    });

    it('maps external AbortError to category network_timeout and errorCode ABORTED', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

      await expect(
        geminiVision.analyzeMedicationImage({ imageBase64: 'valid-base64' })
      ).rejects.toMatchObject({
        category: 'network_timeout',
        errorCode: 'ABORTED'
      });
    });

    it('maps HTTP 504 Gateway Timeout from server proxy to category network_timeout', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 504,
          json: async () => ({
            error: 'Gateway Timeout',
            error_code: 'CLIENT_TIMEOUT',
            retake_message: 'انتهت مهلة استجابة الخادم الخارجي'
          })
        })
      );

      await expect(
        geminiVision.analyzeMedicationImage({ imageBase64: 'valid-base64' })
      ).rejects.toMatchObject({
        category: 'network_timeout',
        status: 504,
        errorCode: 'CLIENT_TIMEOUT'
      });
    });

    it('clears timeout timer on successful fetch response without leaking background timers', async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            is_clear: true,
            medicine_name_ar: 'بانادول',
            medicine_name_en: 'Panadol',
            uses: ['مسكن'],
            how_and_when: ['قرص واحد'],
            warnings: ['استشر الطبيب'],
            audio_summary: 'بانادول مسكن'
          })
        })
      );

      const result = await geminiVision.analyzeMedicationImage({
        imageBase64: 'valid-base64-payload'
      });

      expect(result.is_clear).toBe(true);
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. Cloudflare Worker Error Codes & Debug Badge UI Propagation
  // =========================================================================
  describe('2. Cloudflare Worker Upstream Error Codes & Debug Badge Propagation', () => {
    const workerErrorScenarios = [
      {
        status: 503,
        code: 'UPSTREAM_OVERLOADED',
        errorMsg: 'الخدمة الذكية تحت ضغط مرتفع حالياً. يرجى إعادة المحاولة.',
        detail: 'Gemini HTTP 503: The model is overloaded. Please try again later.'
      },
      {
        status: 429,
        code: 'UPSTREAM_RATE_LIMIT',
        errorMsg: 'تم تجاوز الحد المسموح من الطلبات مؤقتاً.',
        detail: 'Gemini HTTP 429: Resource has been exhausted (e.g. check quota).'
      },
      {
        status: 403,
        code: 'UPSTREAM_LOCATION_RESTRICTED',
        errorMsg: 'خدمة التحليل غير متاحة في هذا النطاق الجغرافي.',
        detail: 'Gemini HTTP 400: User location is not supported for the API use.'
      },
      {
        status: 400,
        code: 'UPSTREAM_BAD_REQUEST',
        errorMsg: 'صيغة الطلب أو محتوى الصورة غير مدعوم من الخادم.',
        detail: 'Gemini HTTP 400: Invalid JSON payload in request.'
      },
      {
        status: 500,
        code: 'UPSTREAM_API_ERROR',
        errorMsg: 'حدث خطأ تقني أثناء معالجة الصورة في الخادم.',
        detail: 'Gemini HTTP 500: Internal error encountered.'
      }
    ];

    workerErrorScenarios.forEach(({ status, code, errorMsg, detail }) => {
      it(`propagates HTTP ${status} with errorCode ${code} through geminiVision to UI and renders debug badge`, async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue({
            ok: false,
            status,
            json: async () => ({
              error: errorMsg,
              error_code: code,
              detail,
              retake_message: errorMsg
            })
          })
        );

        // Verify geminiVision throws AnalysisError with exact fields
        let caughtError: geminiVision.AnalysisError | null = null;
        try {
          await geminiVision.analyzeMedicationImage({ imageBase64: 'sample-box-base64' });
        } catch (err) {
          caughtError = err as geminiVision.AnalysisError;
        }

        expect(caughtError).not.toBeNull();
        expect(caughtError?.category).toBe('server_error');
        expect(caughtError?.errorCode).toBe(code);
        expect(caughtError?.status).toBe(status);
        expect(caughtError?.detail).toBe(detail);

        // Render in UnclearPhotoCard component directly
        const { unmount } = render(
          <UnclearPhotoCard
            errorCategory={caughtError!.category}
            errorCode={caughtError!.errorCode}
            errorMessage={caughtError!.message}
          />
        );

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('حدث خطأ في الخادم الطبي الذكي')).toBeInTheDocument();
        expect(screen.getByText(errorMsg)).toBeInTheDocument();

        // Check debug badge presence and content
        const badge = screen.getByTestId('error-code-badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent('رمز الخطأ:');
        expect(badge).toHaveTextContent(code);

        unmount();
      });
    });

    it('handles non-JSON error bodies (e.g. Cloudflare HTML 502/503 page) gracefully and falls back to HTTP status code badge', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          // When response.json() fails because server returned HTML
          json: async () => {
            throw new SyntaxError('Unexpected token < in JSON at position 0');
          }
        })
      );

      await expect(
        geminiVision.analyzeMedicationImage({ imageBase64: 'sample-box-base64' })
      ).rejects.toMatchObject({
        category: 'server_error',
        errorCode: 'HTTP_502',
        status: 502
      });

      render(
        <UnclearPhotoCard
          errorCategory="server_error"
          errorCode="HTTP_502"
        />
      );

      const badge = screen.getByTestId('error-code-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('HTTP_502');
    });

    it('handles empty JSON object on HTTP 500 and renders default friendly Arabic server error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({})
        })
      );

      let caughtError: geminiVision.AnalysisError | null = null;
      try {
        await geminiVision.analyzeMedicationImage({ imageBase64: 'sample-box-base64' });
      } catch (err) {
        caughtError = err as geminiVision.AnalysisError;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError?.errorCode).toBe('HTTP_500');

      render(
        <UnclearPhotoCard
          errorCategory={caughtError!.category}
          errorCode={caughtError!.errorCode}
          errorMessage={caughtError!.message}
        />
      );

      expect(screen.getByText('حدث خطأ في الخادم الطبي الذكي')).toBeInTheDocument();
      expect(screen.getByTestId('error-code-badge')).toHaveTextContent('HTTP_500');
    });
  });

  // =========================================================================
  // 3. AI is_clear=false & Senior Tips Verification (State c)
  // =========================================================================
  describe('3. AI is_clear=false State & Senior Tips (No Debug Badge)', () => {
    it('displays lighting and focus tips when AI declares is_clear=false, and SUPPRESSES the debug badge', () => {
      render(
        <UnclearPhotoCard
          errorCategory="unclear_image"
          errorMessage="لم نتمكن من قراءة اسم الدواء بدقة. من أجل سلامتكم وصحتكم، يرجى إعادة التقاط الصورة باتباع النصائح التالية:"
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('الصورة غير واضحة بما يكفي')).toBeInTheDocument();

      // Verify specific senior guidance tips
      expect(screen.getByText('تأكد من وجود إضاءة كافية فوق علبة الدواء.')).toBeInTheDocument();
      expect(screen.getByText('قرّب الكاميرا واجعل اسم الدواء في منتصف الشاشة.')).toBeInTheDocument();

      // CRITICAL REQUIREMENT: Debug error badge MUST NOT be rendered for unclear photos!
      expect(screen.queryByTestId('error-code-badge')).toBeNull();

      // Action button is specifically "إعادة تصوير العلبة الآن"
      const retakeBtn = screen.getByRole('button', { name: /إعادة تصوير علبة الدواء الآن/i });
      expect(retakeBtn).toBeInTheDocument();
      expect(retakeBtn).toHaveTextContent('إعادة تصوير العلبة الآن');
    });

    it('renders custom retake_message provided by AI analysis alongside tips without debug badge', () => {
      const customMessage = 'الصورة مظلمة جداً ولم يظهر اسم الدواء بوضوح.';
      render(
        <UnclearPhotoCard
          errorCategory="unclear_image"
          errorMessage={customMessage}
        />
      );

      expect(screen.getByText(customMessage)).toBeInTheDocument();
      expect(screen.getByText('تأكد من وجود إضاءة كافية فوق علبة الدواء.')).toBeInTheDocument();
      expect(screen.getByText('قرّب الكاميرا واجعل اسم الدواء في منتصف الشاشة.')).toBeInTheDocument();
      expect(screen.queryByTestId('error-code-badge')).toBeNull();
    });

    it('invokes onRetake callback when "إعادة تصوير العلبة الآن" button is clicked', () => {
      const handleRetake = vi.fn();
      render(
        <UnclearPhotoCard
          errorCategory="unclear_image"
          onRetake={handleRetake}
        />
      );

      const button = screen.getByRole('button', { name: /إعادة تصوير علبة الدواء الآن/i });
      fireEvent.click(button);
      expect(handleRetake).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 4. Invalid JSON Parsing & State (d) Verification
  // =========================================================================
  describe('4. Invalid JSON Parsing & State (d) Verification', () => {
    it('categorizes corrupted JSON syntax as invalid_json with INVALID_JSON code', () => {
      const corruptedJson = '{"is_clear": true, "medicine_name_ar": "بانادول", "incomplete: ';
      const result = geminiParser.cleanAndParseJson(corruptedJson);

      expect(result.is_clear).toBe(false);
      expect(result.error_category).toBe('invalid_json');
      expect(result.error_code).toBe('INVALID_JSON');
      expect(result.raw_error).toContain('الصورة غير واضحة بدرجة كافية أو تعذر قراءة رد المعالج الذكي');
    });

    it('categorizes empty or whitespace response as invalid_json with EMPTY_RESPONSE code', () => {
      const result = geminiParser.cleanAndParseJson('   \n  ');

      expect(result.is_clear).toBe(false);
      expect(result.error_category).toBe('invalid_json');
      expect(result.error_code).toBe('EMPTY_RESPONSE');
      expect(result.raw_error).toContain('لم نتمكن من استلام إجابة من المعالج الذكي');
    });

    it('renders State (d) in UnclearPhotoCard with distinct indigo theme and retry button', () => {
      const handleRetry = vi.fn();
      const { container } = render(
        <UnclearPhotoCard
          errorCategory="invalid_json"
          onRetry={handleRetry}
          errorMessage="تعذر قراءة رد المعالج الذكي. يرجى الضغط على زر إعادة المحاولة لقراءة العلبة مجدداً."
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(container.querySelector('.bg-indigo-50')).toBeInTheDocument();
      expect(screen.getByText('تعذر قراءة رد المعالج الذكي')).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /إعادة المحاولة الآن/i });
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 5. Interactive Retry & Zero Photo Picker Invocations in App.tsx
  // =========================================================================
  describe('5. Interactive Retry Caching & Zero Photo Picker Invocations in App.tsx', () => {
    it('re-executes processImage with preserved lastFile and DOES NOT trigger camera on interactive retry', async () => {
      const mockPhoto = createMockPhotoFile();

      // Spy on native camera capture
      const cameraCaptureSpy = vi.spyOn(nativeCamera, 'capturePhoto').mockResolvedValue(mockPhoto);

      // Spy on imageProcessor to return valid payload
      const processImageSpy = vi.spyOn(imageProcessor, 'processAndValidateImage').mockResolvedValue({
        base64: mockPhoto.base64Data!,
        mimeType: 'image/jpeg',
        width: 800,
        height: 600,
        sizeBytes: 1500
      });

      // analyzeMedicationImage: 1st call fails with timeout, 2nd call succeeds!
      const analyzeSpy = vi
        .spyOn(geminiVision, 'analyzeMedicationImage')
        .mockRejectedValueOnce(
          new geminiVision.AnalysisError(
            'استغرقت العملية أكثر من 30 ثانية. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة.',
            {
              category: 'network_timeout',
              errorCode: 'CLIENT_TIMEOUT'
            }
          )
        )
        .mockResolvedValueOnce({
          is_clear: true,
          medicine_name_ar: 'كونجستال للأعراض ونزلات البرد',
          medicine_name_en: 'Congestal Cold & Flu',
          active_ingredient: 'باراسيتامول ٦٥٠ مجم + كلورفينيرامين + سودوإيفيدرين',
          uses: ['علاج الرشح ونزلات البرد والصداع'],
          how_and_when: ['قرص واحد ثلاث مرات يومياً بعد الوجبات'],
          warnings: ['يحذر لمرضى الضغط المرتفع'],
          audio_summary: 'دواء كونجستال لنزلات البرد والاحتقان'
        });

      render(<App />);

      // Step 1: User captures initial photo via primary camera button
      const mainCameraBtn = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
      fireEvent.click(mainCameraBtn);

      // Verify failure card appears with network timeout message
      await waitFor(() => {
        expect(screen.getByText('تعذر الاتصال بالشبكة أو انتهت مهلة الطلب')).toBeInTheDocument();
      });

      expect(cameraCaptureSpy).toHaveBeenCalledTimes(1);
      expect(processImageSpy).toHaveBeenCalledTimes(1);
      expect(analyzeSpy).toHaveBeenCalledTimes(1);

      // Step 2: User clicks "إعادة المحاولة الآن" button
      const retryBtn = screen.getByRole('button', { name: /إعادة المحاولة الآن/i });
      fireEvent.click(retryBtn);

      // Step 3: EMPIRICAL PROOF: Camera MUST NOT be invoked during retry!
      await waitFor(() => {
        expect(analyzeSpy).toHaveBeenCalledTimes(2);
      });

      expect(cameraCaptureSpy).toHaveBeenCalledTimes(1); // STILL 1! No new photo prompt!
      expect(processImageSpy).toHaveBeenCalledTimes(2); // Processed cached lastFile

      // Step 4: Successful medication card is rendered
      await waitFor(() => {
        expect(screen.getByText('كونجستال للأعراض ونزلات البرد')).toBeInTheDocument();
      });
    });

    it('endures a multi-stage failure chain (timeout -> 503 -> invalid JSON -> success) preserving cached file throughout', async () => {
      const mockPhoto = createMockPhotoFile();
      const cameraSpy = vi.spyOn(nativeCamera, 'capturePhoto').mockResolvedValue(mockPhoto);

      vi.spyOn(imageProcessor, 'processAndValidateImage').mockResolvedValue({
        base64: mockPhoto.base64Data!,
        mimeType: 'image/jpeg',
        width: 800,
        height: 600,
        sizeBytes: 1500
      });

      // Chain: 1st timeout -> 2nd 503 OVERLOADED -> 3rd invalid JSON -> 4th success
      const analyzeSpy = vi
        .spyOn(geminiVision, 'analyzeMedicationImage')
        .mockRejectedValueOnce(
          new geminiVision.AnalysisError('انتهت مهلة الـ 30 ثانية', {
            category: 'network_timeout',
            errorCode: 'CLIENT_TIMEOUT'
          })
        )
        .mockRejectedValueOnce(
          new geminiVision.AnalysisError('الخادم تحت ضغط شديد', {
            category: 'server_error',
            errorCode: 'UPSTREAM_OVERLOADED',
            status: 503
          })
        )
        .mockRejectedValueOnce(
          new geminiVision.AnalysisError('رد المعالج تالف', {
            category: 'invalid_json',
            errorCode: 'INVALID_JSON'
          })
        )
        .mockResolvedValueOnce({
          is_clear: true,
          medicine_name_ar: 'أوجمنتين ١ جم',
          medicine_name_en: 'Augmentin 1g',
          active_ingredient: 'أموكسيسيلين + كلافولانيك',
          uses: ['مضاد حيوي واسع المجال'],
          how_and_when: ['قرص كل ١٢ ساعة في بداية الأكل'],
          warnings: ['أكمل الكورس بالكامل'],
          audio_summary: 'دواء أوجمنتين مضاد حيوي'
        });

      render(<App />);

      // Initial capture
      fireEvent.click(screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i }));

      // State 1: Timeout
      await waitFor(() => {
        expect(screen.getByText('تعذر الاتصال بالشبكة أو انتهت مهلة الطلب')).toBeInTheDocument();
      });

      // Retry 1 -> leads to State 2: 503 Server Error
      fireEvent.click(screen.getByRole('button', { name: /إعادة المحاولة الآن/i }));
      await waitFor(() => {
        expect(screen.getByText('حدث خطأ في الخادم الطبي الذكي')).toBeInTheDocument();
      });
      expect(screen.getByTestId('error-code-badge')).toHaveTextContent('UPSTREAM_OVERLOADED');

      // Retry 2 -> leads to State 3: Invalid JSON
      fireEvent.click(screen.getByRole('button', { name: /إعادة المحاولة الآن/i }));
      await waitFor(() => {
        expect(screen.getByText('تعذر قراءة رد المعالج الذكي')).toBeInTheDocument();
      });

      // Retry 3 -> leads to Success!
      fireEvent.click(screen.getByRole('button', { name: /إعادة المحاولة الآن/i }));
      await waitFor(() => {
        expect(screen.getByText('أوجمنتين ١ جم')).toBeInTheDocument();
      });

      // Across 4 calls, camera was called EXACTLY ONCE!
      expect(cameraSpy).toHaveBeenCalledTimes(1);
      expect(analyzeSpy).toHaveBeenCalledTimes(4);
    });

    it('resets state and clears cached lastFile when retake/home button is pressed', async () => {
      const mockPhoto = createMockPhotoFile();
      vi.spyOn(nativeCamera, 'capturePhoto').mockResolvedValue(mockPhoto);

      vi.spyOn(imageProcessor, 'processAndValidateImage').mockResolvedValue({
        base64: mockPhoto.base64Data!,
        mimeType: 'image/jpeg',
        width: 800,
        height: 600,
        sizeBytes: 1500
      });

      vi.spyOn(geminiVision, 'analyzeMedicationImage').mockRejectedValueOnce(
        new geminiVision.AnalysisError('خطأ الخادم', {
          category: 'server_error',
          errorCode: 'UPSTREAM_API_ERROR'
        })
      );

      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i }));

      await waitFor(() => {
        expect(screen.getByText('حدث خطأ في الخادم الطبي الذكي')).toBeInTheDocument();
      });

      // Click home button "العودة للرئيسية"
      const homeBtn = screen.getByRole('button', { name: /العودة للرئيسية/i });
      fireEvent.click(homeBtn);

      // Verify welcome screen is restored
      await waitFor(() => {
        expect(screen.getByText('أهلاً بكم في دليلي الدوائي')).toBeInTheDocument();
      });
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  // =========================================================================
  // 6. Senior Ergonomics & RTL Text Direction Across All 4 States
  // =========================================================================
  describe('6. Senior Accessibility & RTL Text Layout Verification', () => {
    const allCategories: { category: ErrorCategory; code?: string; name: string }[] = [
      { category: 'network_timeout', code: 'CLIENT_TIMEOUT', name: 'State (a) Network Timeout' },
      { category: 'server_error', code: 'UPSTREAM_OVERLOADED', name: 'State (b) Server Error' },
      { category: 'unclear_image', name: 'State (c) Unclear Image' },
      { category: 'invalid_json', code: 'INVALID_JSON', name: 'State (d) Invalid JSON' }
    ];

    allCategories.forEach(({ category, code, name }) => {
      it(`enforces >=64px touch target height on all buttons for ${name}`, () => {
        render(
          <UnclearPhotoCard
            errorCategory={category}
            errorCode={code}
            onRetry={vi.fn()}
            onRetake={vi.fn()}
          />
        );

        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThanOrEqual(1);

        for (const button of buttons) {
          expect(button).toHaveMinTouchTarget(64);
        }
      });

      it(`maintains RTL text alignment and role="alert" for ${name}`, () => {
        const { container } = render(
          <UnclearPhotoCard
            errorCategory={category}
            errorCode={code}
          />
        );

        const alertElement = container.querySelector('[role="alert"]');
        expect(alertElement).toBeInTheDocument();
        expect(alertElement).toHaveClass('text-right');
      });
    });

    it('infers categories automatically from unstructured error strings when category is omitted', () => {
      // (a) Timeout inference
      const { rerender } = render(
        <UnclearPhotoCard errorMessage="انتهت مهلة الـ 30 ثانية في الاتصال بالشبكة" />
      );
      expect(screen.getByText('تعذر الاتصال بالشبكة أو انتهت مهلة الطلب')).toBeInTheDocument();

      // (b) Server error inference
      rerender(<UnclearPhotoCard errorMessage="خطأ داخلي من الخادم 503 UPSTREAM" />);
      expect(screen.getByText('حدث خطأ في الخادم الطبي الذكي')).toBeInTheDocument();

      // (d) Invalid JSON inference
      rerender(<UnclearPhotoCard errorMessage="تعذر قراءة رد المعالج الذكي JSON syntax" />);
      expect(screen.getByText('تعذر قراءة رد المعالج الذكي')).toBeInTheDocument();

      // (c) Unclear photo fallback
      rerender(<UnclearPhotoCard errorMessage="الصورة مشوشة وغير واضحة" />);
      expect(screen.getByText('الصورة غير واضحة بما يكفي')).toBeInTheDocument();
    });
  });
});
