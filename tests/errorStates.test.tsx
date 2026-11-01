import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnclearPhotoCard } from '../src/components/UnclearPhotoCard';
import App from '../src/App';
import * as geminiVision from '../src/services/geminiVision';
import * as imageProcessor from '../src/utils/imageProcessor';
import * as nativeCamera from '../src/services/nativeCamera';

describe('Error States & Interactive Retry Verification (errorStates.test.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Distinct Error Categories in UnclearPhotoCard', () => {
    it('renders State (a) Network / Timeout with distinct Arabic title, message, and retry button', () => {
      const handleRetry = vi.fn();
      const handleRetake = vi.fn();

      render(
        <UnclearPhotoCard
          errorCategory="network_timeout"
          onRetry={handleRetry}
          onRetake={handleRetake}
          errorMessage="استغرقت العملية أكثر من 30 ثانية. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة."
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('تعذر الاتصال بالشبكة أو انتهت مهلة الطلب')).toBeInTheDocument();
      expect(
        screen.getByText('استغرقت العملية أكثر من 30 ثانية. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة.')
      ).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /إعادة المحاولة الآن/i });
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);

      const retakeBtn = screen.getByRole('button', { name: /تصوير علبة أخرى/i });
      expect(retakeBtn).toBeInTheDocument();
      fireEvent.click(retakeBtn);
      expect(handleRetake).toHaveBeenCalledTimes(1);
    });

    it('renders State (b) Server Error with distinct Arabic title, message, and debug error_code badge', () => {
      const handleRetry = vi.fn();
      const handleRetake = vi.fn();

      render(
        <UnclearPhotoCard
          errorCategory="server_error"
          errorCode="UPSTREAM_OVERLOADED"
          onRetry={handleRetry}
          onRetake={handleRetake}
          errorMessage="الخدمة الذكية تحت ضغط مرتفع حالياً. يرجى إعادة المحاولة."
        />
      );

      expect(screen.getByText('حدث خطأ في الخادم الطبي الذكي')).toBeInTheDocument();
      expect(screen.getByText('الخدمة الذكية تحت ضغط مرتفع حالياً. يرجى إعادة المحاولة.')).toBeInTheDocument();

      const badge = screen.getByTestId('error-code-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('UPSTREAM_OVERLOADED');

      const retryBtn = screen.getByRole('button', { name: /إعادة المحاولة الآن/i });
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);

      const homeBtn = screen.getByRole('button', { name: /العودة للرئيسية/i });
      fireEvent.click(homeBtn);
      expect(handleRetake).toHaveBeenCalledTimes(1);
    });

    it('renders State (c) Unclear Image (is_clear=false) with lighting and focus tips', () => {
      const handleRetake = vi.fn();

      render(
        <UnclearPhotoCard
          errorCategory="unclear_image"
          onRetake={handleRetake}
          errorMessage="لم نتمكن من قراءة اسم الدواء بدقة. من أجل سلامتكم وصحتكم، يرجى إعادة التقاط الصورة باتباع النصائح التالية:"
        />
      );

      expect(screen.getByText('الصورة غير واضحة بما يكفي')).toBeInTheDocument();
      expect(screen.getByText('تأكد من وجود إضاءة كافية فوق علبة الدواء.')).toBeInTheDocument();
      expect(screen.getByText('قرّب الكاميرا واجعل اسم الدواء في منتصف الشاشة.')).toBeInTheDocument();

      const retakeBtn = screen.getByRole('button', { name: /إعادة تصوير علبة الدواء الآن/i });
      fireEvent.click(retakeBtn);
      expect(handleRetake).toHaveBeenCalledTimes(1);
    });

    it('renders State (d) Invalid JSON with distinct Arabic title and interactive retry button', () => {
      const handleRetry = vi.fn();
      const handleRetake = vi.fn();

      render(
        <UnclearPhotoCard
          errorCategory="invalid_json"
          onRetry={handleRetry}
          onRetake={handleRetake}
          errorMessage="تعذر قراءة رد المعالج الذكي. يرجى الضغط على زر إعادة المحاولة لقراءة العلبة مجدداً."
        />
      );

      expect(screen.getByText('تعذر قراءة رد المعالج الذكي')).toBeInTheDocument();
      expect(
        screen.getByText('تعذر قراءة رد المعالج الذكي. يرجى الضغط على زر إعادة المحاولة لقراءة العلبة مجدداً.')
      ).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /إعادة المحاولة الآن/i });
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });

    it('infers network_timeout category from error message if errorCategory is not provided', () => {
      render(
        <UnclearPhotoCard
          errorMessage="استغرقت العملية أكثر من 30 ثانية. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة."
        />
      );

      expect(screen.getByText('تعذر الاتصال بالشبكة أو انتهت مهلة الطلب')).toBeInTheDocument();
    });

    it('infers server_error category from error message if errorCategory is not provided', () => {
      render(
        <UnclearPhotoCard
          errorMessage="حدث خطأ في الخادم (500). يرجى المحاولة مرة أخرى."
        />
      );

      expect(screen.getByText('حدث خطأ في الخادم الطبي الذكي')).toBeInTheDocument();
    });
  });

  describe('2. Senior Accessibility & Ergonomics', () => {
    it('satisfies minimum 64px touch target height on all error state action buttons', () => {
      render(
        <UnclearPhotoCard
          errorCategory="network_timeout"
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

    it('maintains proper RTL text alignment', () => {
      const { container } = render(
        <UnclearPhotoCard
          errorCategory="server_error"
          errorCode="TEST_ERR"
        />
      );

      const alertCard = container.querySelector('[role="alert"]');
      expect(alertCard).toHaveClass('text-right');
    });
  });

  describe('3. App.tsx Interactive Retry Integration', () => {
    it('re-analyzes the same photo on interactive retry without requiring retake', async () => {
      const dummyFile = Object.assign(
        new File(['mock-image-bytes'], 'medication-box.jpg', { type: 'image/jpeg' }),
        {
          base64Data: '/9j/mockBase64',
          format: 'jpeg' as const,
          width: 800,
          height: 600,
          dataUrl: 'data:image/jpeg;base64,/9j/mockBase64'
        }
      ) as nativeCamera.NativePhotoFile;

      // Mock nativeCamera.capturePhoto
      vi.spyOn(nativeCamera, 'capturePhoto').mockResolvedValue(dummyFile);

      // Mock image processing to succeed
      vi.spyOn(imageProcessor, 'processAndValidateImage').mockResolvedValue({
        base64: '/9j/mockBase64StringPayloadForTesting' + 'A'.repeat(500),
        mimeType: 'image/jpeg',
        width: 800,
        height: 600,
        sizeBytes: 1200
      });

      // 1st call fails with timeout AnalysisError
      const analyzeMock = vi
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
        // 2nd call (on retry) succeeds!
        .mockResolvedValueOnce({
          is_clear: true,
          medicine_name_ar: 'بانادول إكسترا',
          medicine_name_en: 'Panadol Extra',
          active_ingredient: 'باراسيتامول + كافيين',
          uses: ['تسكين الألم'],
          how_and_when: ['قرص عند اللزوم'],
          warnings: ['استشر الطبيب'],
          audio_summary: 'دواء بانادول إكسترا مسكن للألم'
        });

      render(<App />);

      // User clicks camera capture button
      const cameraBtn = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
      fireEvent.click(cameraBtn);

      // Verify error state (a) appears
      await waitFor(() => {
        expect(screen.getByText('تعذر الاتصال بالشبكة أو انتهت مهلة الطلب')).toBeInTheDocument();
      });

      expect(analyzeMock).toHaveBeenCalledTimes(1);

      // User clicks "إعادة المحاولة الآن"
      const retryBtn = screen.getByRole('button', { name: /إعادة المحاولة الآن/i });
      fireEvent.click(retryBtn);

      // Verify that analyzeMedicationImage was called a 2nd time without needing another camera click!
      await waitFor(() => {
        expect(analyzeMock).toHaveBeenCalledTimes(2);
      });

      // And result screen displays the medication
      await waitFor(() => {
        expect(screen.getByText('بانادول إكسترا')).toBeInTheDocument();
      });
    });

    it('displays server error with Worker error_code badge and resets to home on retake', async () => {
      const dummyFile = Object.assign(
        new File(['mock-image-bytes'], 'medication-box.jpg', { type: 'image/jpeg' }),
        {
          base64Data: '/9j/mockBase64',
          format: 'jpeg' as const,
          width: 800,
          height: 600,
          dataUrl: 'data:image/jpeg;base64,/9j/mockBase64'
        }
      ) as nativeCamera.NativePhotoFile;

      vi.spyOn(nativeCamera, 'capturePhoto').mockResolvedValue(dummyFile);

      vi.spyOn(imageProcessor, 'processAndValidateImage').mockResolvedValue({
        base64: '/9j/mockBase64StringPayloadForTesting' + 'A'.repeat(500),
        mimeType: 'image/jpeg',
        width: 800,
        height: 600,
        sizeBytes: 1200
      });

      vi.spyOn(geminiVision, 'analyzeMedicationImage').mockRejectedValueOnce(
        new geminiVision.AnalysisError('الخدمة تحت ضغط كبير حالياً.', {
          category: 'server_error',
          errorCode: 'UPSTREAM_OVERLOADED',
          status: 503
        })
      );

      render(<App />);

      const cameraBtn = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
      fireEvent.click(cameraBtn);

      await waitFor(() => {
        expect(screen.getByText('حدث خطأ في الخادم الطبي الذكي')).toBeInTheDocument();
      });

      const badge = screen.getByTestId('error-code-badge');
      expect(badge).toHaveTextContent('UPSTREAM_OVERLOADED');

      // Click home / retake button
      const homeBtn = screen.getByRole('button', { name: /العودة للرئيسية/i });
      fireEvent.click(homeBtn);

      // Home welcome card reappears
      await waitFor(() => {
        expect(screen.getByText('أهلاً بكم في دليلي الدوائي')).toBeInTheDocument();
      });
    });
  });
});
