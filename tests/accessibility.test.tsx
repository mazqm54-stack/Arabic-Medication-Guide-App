import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResultCards } from '../src/components/ResultCards';
import { DisclaimerBanner } from '../src/components/DisclaimerBanner';
import { CameraCapture } from '../src/components/CameraCapture';
import { MedicineAnalysisResult } from '../src/types';
import { Camera, CameraSource, CameraDirection } from '@capacitor/camera';

describe('Senior Accessibility & UI Verification', () => {
  const sampleResult: MedicineAnalysisResult = {
    is_clear: true,
    medicine_name_ar: 'بانادول إكسترا',
    medicine_name_en: 'Panadol Extra',
    active_ingredient: 'باراسيتامول + كافيين',
    uses: ['تسكين آلام الصداع', 'خفض درجات الحرارة'],
    how_and_when: ['قرص واحد بعد الأكل'],
    warnings: ['لا تتناول أكثر من 8 أقراص يومياً'],
    audio_summary: 'بانادول إكسترا مسكن للصداع يؤخذ بعد الأكل'
  };

  it('renders all 4 distinct color-coded cards with large intuitive headings', () => {
    render(<ResultCards result={sampleResult} fontSize="large" />);

    expect(screen.getByText('اسم الدواء والمادة الفعالة')).toBeInTheDocument();
    expect(screen.getByText('بانادول إكسترا')).toBeInTheDocument();
    expect(screen.getByText('Panadol Extra')).toBeInTheDocument();

    expect(screen.getByText('دواعي الاستعمال (لماذا يُستخدم؟)')).toBeInTheDocument();
    expect(screen.getByText('تسكين آلام الصداع')).toBeInTheDocument();

    expect(screen.getByText('طريقة الاستخدام وأفضل المواعيد')).toBeInTheDocument();
    expect(screen.getByText('قرص واحد بعد الأكل')).toBeInTheDocument();

    expect(screen.getByText('تنبيهات واحتياطات هامة')).toBeInTheDocument();
    expect(screen.getByText('لا تتناول أكثر من 8 أقراص يومياً')).toBeInTheDocument();
  });

  it('adjusts typography classes when font size is set to extra-large', () => {
    const { container } = render(<ResultCards result={sampleResult} fontSize="extra-large" />);
    // Check that extra large text classes are applied
    const title = container.querySelector('.text-3xl');
    expect(title).toBeInTheDocument();
  });

  it('renders persistent medical disclaimer banner with clear Arabic alert', () => {
    render(<DisclaimerBanner />);
    const disclaimer = screen.getByRole('note', { name: /تنبيه طبي هام/i });
    expect(disclaimer).toBeInTheDocument();
    expect(disclaimer).toHaveTextContent('هذه المعلومات إرشادية لتسهيل القراءة ولا تغني بأي حال عن تعليمات طبيبك');
  });

  it('primary camera button invokes native rear camera without file input and meets min touch height', async () => {
    const handleSelected = vi.fn();
    render(<CameraCapture onImageSelected={handleSelected} />);

    // Verification that NO <input type="file"> is used
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(document.querySelector('input[capture="environment"]')).toBeNull();

    const cameraButton = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
    expect(cameraButton).toBeInTheDocument();
    // Verify touch target class
    expect(cameraButton.className).toContain('min-h-[');

    // Verify native camera invocation
    fireEvent.click(cameraButton);
    await waitFor(() => {
      expect(Camera.getPhoto).toHaveBeenCalledWith(
        expect.objectContaining({
          source: CameraSource.Camera,
          direction: CameraDirection.Rear,
        })
      );
    });
  });

  it('secondary gallery button invokes native photos picker and meets touch target', async () => {
    const handleSelected = vi.fn();
    render(<CameraCapture onImageSelected={handleSelected} />);

    // Verification that NO <input type="file"> is used for gallery
    expect(document.querySelector('input[type="file"]')).toBeNull();

    const galleryButton = screen.getByRole('button', { name: /اختيار صورة محفوظة مسبقاً من الألبوم/i });
    expect(galleryButton).toBeInTheDocument();
    expect(galleryButton.className).toContain('min-h-[');

    fireEvent.click(galleryButton);
    await waitFor(() => {
      expect(Camera.getPhoto).toHaveBeenCalledWith(
        expect.objectContaining({
          source: CameraSource.Photos,
        })
      );
    });
  });

  it('handles camera permission denial gracefully with an accessible Arabic alert', async () => {
    vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
      camera: 'denied',
      photos: 'denied',
    });
    vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
      camera: 'denied',
      photos: 'denied',
    });

    const handleSelected = vi.fn();
    render(<CameraCapture onImageSelected={handleSelected} />);

    const cameraButton = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
    fireEvent.click(cameraButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/تم رفض إذن الكاميرا/i);
    expect(handleSelected).not.toHaveBeenCalled();

    // Verify dismiss button works
    const dismissButton = screen.getByRole('button', { name: /إغلاق التنبيه/i });
    fireEvent.click(dismissButton);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('handles user cancelation cleanly without displaying an error alert', async () => {
    vi.mocked(Camera.getPhoto).mockRejectedValueOnce(new Error('User cancelled photos app'));

    const handleSelected = vi.fn();
    render(<CameraCapture onImageSelected={handleSelected} />);

    const cameraButton = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
    fireEvent.click(cameraButton);

    await waitFor(() => {
      expect(cameraButton).not.toBeDisabled();
    });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(handleSelected).not.toHaveBeenCalled();
  });

  it('disables both buttons when disabled prop is true', () => {
    render(<CameraCapture onImageSelected={() => {}} disabled={true} />);

    const cameraButton = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
    const galleryButton = screen.getByRole('button', { name: /اختيار صورة محفوظة مسبقاً من الألبوم/i });

    expect(cameraButton).toBeDisabled();
    expect(galleryButton).toBeDisabled();
  });
});
