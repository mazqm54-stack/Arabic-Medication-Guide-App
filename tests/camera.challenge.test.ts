import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { CameraCapture } from '../src/components/CameraCapture';
import {
  capturePhoto,
  pickPhoto,
  captureFromCamera,
  pickFromGallery,
  base64ToFile,
  isUserCancelation,
  checkAndRequestCameraPermissions,
  checkAndRequestPhotosPermissions,
  CameraPermissionDeniedError,
  PhotosPermissionDeniedError,
  CaptureResult,
  NativePhotoFile,
} from '../src/services/nativeCamera';
import { Camera, CameraSource, CameraDirection, CameraResultType } from '@capacitor/camera';

// 1x1 Transparent PNG sample base64 string
const SAMPLE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const SAMPLE_DATA_URL = `data:image/jpeg;base64,${SAMPLE_BASE64}`;

describe('Milestone 2 Empirical Challenge: Native Camera Integration & Android Setup', () => {
  const projectRoot = path.resolve(__dirname, '..');

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock behavior for granted permissions
    vi.mocked(Camera.checkPermissions).mockResolvedValue({
      camera: 'granted',
      photos: 'granted',
    });
    vi.mocked(Camera.requestPermissions).mockResolvedValue({
      camera: 'granted',
      photos: 'granted',
    });

    // Default mock photo result
    vi.mocked(Camera.getPhoto).mockResolvedValue({
      base64String: SAMPLE_BASE64,
      dataUrl: SAMPLE_DATA_URL,
      webPath: 'blob:mock-camera-photo',
      format: 'jpeg',
      width: 1024,
      height: 768,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Challenge Section 1: Native Camera Invocation (Requirement R1 / Bug 1)
  // =========================================================================
  describe('1. Native Camera Invocation & Rear Camera Configuration', () => {
    it('primary button triggers Camera.getPhoto directly with rear camera parameters', async () => {
      const handleSelected = vi.fn();
      render(React.createElement(CameraCapture, { onImageSelected: handleSelected }));

      const primaryButton = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
      expect(primaryButton).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(primaryButton);
      });

      await waitFor(() => {
        expect(Camera.getPhoto).toHaveBeenCalledTimes(1);
      });

      expect(Camera.getPhoto).toHaveBeenCalledWith({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        direction: CameraDirection.Rear,
        correctOrientation: true,
        saveToGallery: false,
      });

      await waitFor(() => {
        expect(handleSelected).toHaveBeenCalledTimes(1);
      });

      const selectedFile = handleSelected.mock.calls[0][0] as NativePhotoFile;
      expect(selectedFile).toBeInstanceOf(File);
      expect(selectedFile.name).toMatch(/^medication_camera_\d+\.jpg$/);
      expect(selectedFile.type).toBe('image/jpeg');
      expect(selectedFile.format).toBe('jpeg');
      expect(selectedFile.width).toBe(1024);
      expect(selectedFile.height).toBe(768);
      expect(selectedFile.base64Data).toBe(SAMPLE_BASE64);
      expect(selectedFile.dataUrl).toBe(SAMPLE_DATA_URL);
    });

    it('captureFromCamera service function conforms to SCOPE.md interface contract', async () => {
      const result: CaptureResult | null = await captureFromCamera();

      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.format).toBe('jpeg');
      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
      expect(result.base64Data).toBe(SAMPLE_BASE64);
      expect(result.file).toBeInstanceOf(File);
      expect(result.file.type).toBe('image/jpeg');
      expect((result.file as NativePhotoFile).base64Data).toBe(SAMPLE_BASE64);
    });

    it('requests runtime camera permissions when initially prompt/denied before invoking getPhoto', async () => {
      vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
        camera: 'prompt',
        photos: 'granted',
      });
      vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
        camera: 'granted',
        photos: 'granted',
      });

      const handleSelected = vi.fn();
      render(React.createElement(CameraCapture, { onImageSelected: handleSelected }));

      const primaryButton = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
      await act(async () => {
        fireEvent.click(primaryButton);
      });

      await waitFor(() => {
        expect(Camera.checkPermissions).toHaveBeenCalled();
        expect(Camera.requestPermissions).toHaveBeenCalledWith({ permissions: ['camera'] });
        expect(Camera.getPhoto).toHaveBeenCalledWith(
          expect.objectContaining({ source: CameraSource.Camera })
        );
        expect(handleSelected).toHaveBeenCalledTimes(1);
      });
    });
  });

  // =========================================================================
  // Challenge Section 2: Dedicated Photo Gallery Picker (Requirement R1)
  // =========================================================================
  describe('2. Dedicated Gallery Picker Invocation', () => {
    it('secondary gallery button triggers Camera.getPhoto with CameraSource.Photos without rear camera direction', async () => {
      const handleSelected = vi.fn();
      render(React.createElement(CameraCapture, { onImageSelected: handleSelected }));

      const galleryButton = screen.getByRole('button', { name: /اختيار صورة محفوظة مسبقاً من الألبوم/i });
      expect(galleryButton).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(galleryButton);
      });

      await waitFor(() => {
        expect(Camera.getPhoto).toHaveBeenCalledTimes(1);
      });

      expect(Camera.getPhoto).toHaveBeenCalledWith({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
        correctOrientation: true,
        saveToGallery: false,
      });

      // Direction should not be forced to Rear for gallery picker
      const calledArgs = vi.mocked(Camera.getPhoto).mock.calls[0][0];
      expect(calledArgs.direction).toBeUndefined();

      await waitFor(() => {
        expect(handleSelected).toHaveBeenCalledTimes(1);
      });

      const selectedFile = handleSelected.mock.calls[0][0] as NativePhotoFile;
      expect(selectedFile).toBeInstanceOf(File);
      expect(selectedFile.name).toMatch(/^medication_gallery_\d+\.jpg$/);
      expect(selectedFile.type).toBe('image/jpeg');
    });

    it('pickFromGallery service function conforms to SCOPE.md interface contract', async () => {
      const result: CaptureResult | null = await pickFromGallery();

      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.format).toBe('jpeg');
      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
      expect(result.base64Data).toBe(SAMPLE_BASE64);
      expect(result.file).toBeInstanceOf(File);
      expect(result.file.name).toMatch(/^medication_gallery_/);
    });

    it('requests runtime photos permissions when initially prompt before invoking getPhoto', async () => {
      vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
        camera: 'granted',
        photos: 'prompt',
      });
      vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
        camera: 'granted',
        photos: 'granted',
      });

      const handleSelected = vi.fn();
      render(React.createElement(CameraCapture, { onImageSelected: handleSelected }));

      const galleryButton = screen.getByRole('button', { name: /اختيار صورة محفوظة مسبقاً من الألبوم/i });
      await act(async () => {
        fireEvent.click(galleryButton);
      });

      await waitFor(() => {
        expect(Camera.checkPermissions).toHaveBeenCalled();
        expect(Camera.requestPermissions).toHaveBeenCalledWith({ permissions: ['photos'] });
        expect(Camera.getPhoto).toHaveBeenCalledWith(
          expect.objectContaining({ source: CameraSource.Photos })
        );
        expect(handleSelected).toHaveBeenCalledTimes(1);
      });
    });
  });

  // =========================================================================
  // Challenge Section 3: Empirical Guarantee — ZERO HTML File Inputs
  // =========================================================================
  describe('3. Empirical Guarantee: Zero HTML File Inputs Across All Component States', () => {
    it('verifies zero input elements exist in initial state', () => {
      const { container } = render(React.createElement(CameraCapture, { onImageSelected: vi.fn() }));

      expect(container.querySelectorAll('input')).toHaveLength(0);
      expect(document.querySelector('input[type="file"]')).toBeNull();
      expect(document.querySelector('input[capture]')).toBeNull();
    });

    it('verifies zero input elements exist during active in-flight capture', async () => {
      let resolvePhoto: (val: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePhoto = resolve;
      });
      vi.mocked(Camera.getPhoto).mockReturnValueOnce(pendingPromise as any);

      const { container } = render(React.createElement(CameraCapture, { onImageSelected: vi.fn() }));
      const cameraBtn = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });

      act(() => {
        fireEvent.click(cameraBtn);
      });

      // While capture is in flight
      expect(container.querySelectorAll('input')).toHaveLength(0);
      expect(document.querySelector('input[type="file"]')).toBeNull();
      expect(document.querySelector('input[capture]')).toBeNull();

      // Clean up the pending promise
      await act(async () => {
        resolvePhoto!({
          base64String: SAMPLE_BASE64,
          format: 'jpeg',
          width: 100,
          height: 100,
        });
      });
    });

    it('verifies zero input elements exist when disabled=true', () => {
      const { container } = render(
        React.createElement(CameraCapture, { onImageSelected: vi.fn(), disabled: true })
      );

      expect(container.querySelectorAll('input')).toHaveLength(0);
      expect(document.querySelector('input[type="file"]')).toBeNull();
    });

    it('verifies zero input elements exist when error alert banner is displayed', async () => {
      vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
        camera: 'denied',
        photos: 'denied',
      });
      vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
        camera: 'denied',
        photos: 'denied',
      });

      const { container } = render(React.createElement(CameraCapture, { onImageSelected: vi.fn() }));
      const cameraBtn = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });

      await act(async () => {
        fireEvent.click(cameraBtn);
      });

      const alert = await screen.findByRole('alert');
      expect(alert).toBeInTheDocument();

      expect(container.querySelectorAll('input')).toHaveLength(0);
      expect(document.querySelector('input[type="file"]')).toBeNull();
    });

    it('verifies no global document file inputs are injected anywhere on the page', () => {
      render(React.createElement(CameraCapture, { onImageSelected: vi.fn() }));
      const allInputs = document.querySelectorAll('input');
      expect(allInputs).toHaveLength(0);
    });
  });

  // =========================================================================
  // Challenge Section 4: Permission Denial & Accessible Arabic Alert Banner
  // =========================================================================
  describe('4. Permission Denial Handling & Accessible Alert Banners', () => {
    it('handles camera permission denial with accessible Arabic alert banner and role="alert"', async () => {
      vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
        camera: 'denied',
        photos: 'granted',
      });
      vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
        camera: 'denied',
        photos: 'granted',
      });

      const handleSelected = vi.fn();
      render(React.createElement(CameraCapture, { onImageSelected: handleSelected }));

      const cameraBtn = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
      await act(async () => {
        fireEvent.click(cameraBtn);
      });

      const alertBanner = await screen.findByRole('alert');
      expect(alertBanner).toBeInTheDocument();
      expect(alertBanner).toHaveAttribute('aria-live', 'polite');
      expect(alertBanner).toHaveTextContent(/تم رفض إذن الكاميرا/);
      expect(alertBanner).toHaveTextContent(/يمكنك اختيار صورة من الألبوم/);
      expect(handleSelected).not.toHaveBeenCalled();
      expect(Camera.getPhoto).not.toHaveBeenCalled();

      // Dismiss button removes alert
      const dismissBtn = screen.getByRole('button', { name: /إغلاق التنبيه/i });
      expect(dismissBtn).toBeInTheDocument();
      fireEvent.click(dismissBtn);

      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('handles photos permission denial with accessible Arabic alert banner', async () => {
      vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
        camera: 'granted',
        photos: 'denied',
      });
      vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
        camera: 'granted',
        photos: 'denied',
      });

      const handleSelected = vi.fn();
      render(React.createElement(CameraCapture, { onImageSelected: handleSelected }));

      const galleryBtn = screen.getByRole('button', { name: /اختيار صورة محفوظة مسبقاً من الألبوم/i });
      await act(async () => {
        fireEvent.click(galleryBtn);
      });

      const alertBanner = await screen.findByRole('alert');
      expect(alertBanner).toBeInTheDocument();
      expect(alertBanner).toHaveAttribute('aria-live', 'polite');
      expect(alertBanner).toHaveTextContent(/تم رفض إذن الوصول إلى الصور/);
      expect(handleSelected).not.toHaveBeenCalled();
      expect(Camera.getPhoto).not.toHaveBeenCalled();
    });

    it('capturePhoto directly throws CameraPermissionDeniedError with friendly Arabic message on denial', async () => {
      vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
        camera: 'denied',
        photos: 'granted',
      });
      vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
        camera: 'denied',
        photos: 'granted',
      });

      const err = await capturePhoto().catch((e) => e);
      expect(err).toBeInstanceOf(CameraPermissionDeniedError);
      expect(err.message).toMatch(/تم رفض إذن الكاميرا/);
    });

    it('pickPhoto directly throws PhotosPermissionDeniedError with friendly Arabic message on denial', async () => {
      vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
        camera: 'granted',
        photos: 'denied',
      });
      vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
        camera: 'granted',
        photos: 'denied',
      });

      const err = await pickPhoto().catch((e) => e);
      expect(err).toBeInstanceOf(PhotosPermissionDeniedError);
      expect(err.message).toMatch(/تم رفض إذن الوصول إلى الصور/);
    });

    it('falls back gracefully to true if permission inspection API throws an exception', async () => {
      vi.mocked(Camera.checkPermissions).mockRejectedValueOnce(new Error('Permission API unavailable'));

      const result = await checkAndRequestCameraPermissions();
      expect(result).toBe(true);

      vi.mocked(Camera.checkPermissions).mockRejectedValueOnce(new Error('Photos Permission API unavailable'));
      const photosResult = await checkAndRequestPhotosPermissions();
      expect(photosResult).toBe(true);
    });
  });

  // =========================================================================
  // Challenge Section 5: Cancelation Handling Across All Known Edge Cases
  // =========================================================================
  describe('5. Clean Cancelation Handling Across Edge Cases', () => {
    const cancellationMessages = [
      'User cancelled photos app',
      'user cancelled',
      'User canceled',
      'No image picked',
      'User closed camera without taking a photo',
      'cancelled',
      'canceled',
      'closed',
    ];

    for (const msg of cancellationMessages) {
      it(`resolves cleanly to null without throwing or alerting for message: "${msg}"`, async () => {
        vi.mocked(Camera.getPhoto).mockRejectedValueOnce(new Error(msg));

        const result = await capturePhoto();
        expect(result).toBeNull();
      });

      it(`UI handles cancelation message "${msg}" without rendering an error alert`, async () => {
        vi.mocked(Camera.getPhoto).mockRejectedValueOnce(new Error(msg));

        const handleSelected = vi.fn();
        render(React.createElement(CameraCapture, { onImageSelected: handleSelected }));

        const cameraBtn = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
        await act(async () => {
          fireEvent.click(cameraBtn);
        });

        await waitFor(() => {
          expect(cameraBtn).not.toBeDisabled();
        });

        expect(screen.queryByRole('alert')).toBeNull();
        expect(handleSelected).not.toHaveBeenCalled();
      });
    }

    it('isUserCancelation returns true for string cancelation rejection and false for real errors', () => {
      expect(isUserCancelation('User cancelled')).toBe(true);
      expect(isUserCancelation(new Error('User cancelled photos app'))).toBe(true);
      expect(isUserCancelation('no image picked')).toBe(true);
      expect(isUserCancelation(null)).toBe(false);
      expect(isUserCancelation(undefined)).toBe(false);
      expect(isUserCancelation(new Error('Hardware camera failure'))).toBe(false);
      expect(isUserCancelation(new Error('Out of memory'))).toBe(false);
    });

    it('handles non-cancelation camera hardware errors by displaying error banner and resetting state', async () => {
      vi.mocked(Camera.getPhoto).mockRejectedValueOnce(new Error('Camera hardware sensor failed'));

      const handleSelected = vi.fn();
      render(React.createElement(CameraCapture, { onImageSelected: handleSelected }));

      const cameraBtn = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
      await act(async () => {
        fireEvent.click(cameraBtn);
      });

      const alert = await screen.findByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Camera hardware sensor failed');
      expect(handleSelected).not.toHaveBeenCalled();

      // State is reset so buttons are re-enabled
      expect(cameraBtn).not.toBeDisabled();
    });

    it('handles non-Error thrown values with fallback Arabic message', async () => {
      vi.mocked(Camera.getPhoto).mockRejectedValueOnce('raw-string-error');

      const handleSelected = vi.fn();
      render(React.createElement(CameraCapture, { onImageSelected: handleSelected }));

      const cameraBtn = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
      await act(async () => {
        fireEvent.click(cameraBtn);
      });

      const alert = await screen.findByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('تعذر فتح الكاميرا حالياً. يمكنك تجربة اختيار صورة من الألبوم.');
      expect(cameraBtn).not.toBeDisabled();
    });
  });

  // =========================================================================
  // Challenge Section 6: Concurrency, Re-entrancy & Disabled Prop Guardrails
  // =========================================================================
  describe('6. Concurrency, Re-entrancy & Disabled Prop Guardrails', () => {
    it('disables both buttons and ignores clicks when disabled={true}', () => {
      render(React.createElement(CameraCapture, { onImageSelected: vi.fn(), disabled: true }));

      const cameraBtn = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
      const galleryBtn = screen.getByRole('button', { name: /اختيار صورة محفوظة مسبقاً من الألبوم/i });

      expect(cameraBtn).toBeDisabled();
      expect(galleryBtn).toBeDisabled();

      fireEvent.click(cameraBtn);
      fireEvent.click(galleryBtn);

      expect(Camera.checkPermissions).not.toHaveBeenCalled();
      expect(Camera.getPhoto).not.toHaveBeenCalled();
    });

    it('guards against rapid concurrent clicks while capture is in-flight', async () => {
      let resolvePhoto: (val: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePhoto = resolve;
      });
      vi.mocked(Camera.getPhoto).mockReturnValueOnce(pendingPromise as any);

      const handleSelected = vi.fn();
      render(React.createElement(CameraCapture, { onImageSelected: handleSelected }));

      const cameraBtn = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });

      // First click
      act(() => {
        fireEvent.click(cameraBtn);
      });

      // Second rapid click while first is in-flight
      act(() => {
        fireEvent.click(cameraBtn);
      });

      await waitFor(() => {
        expect(Camera.getPhoto).toHaveBeenCalledTimes(1);
      });

      // Resolve the initial capture
      await act(async () => {
        resolvePhoto!({
          base64String: SAMPLE_BASE64,
          format: 'jpeg',
          width: 500,
          height: 500,
        });
      });

      await waitFor(() => {
        expect(handleSelected).toHaveBeenCalledTimes(1);
      });
    });

    it('guards against gallery click while camera capture is in-flight', async () => {
      let resolvePhoto: (val: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePhoto = resolve;
      });
      vi.mocked(Camera.getPhoto).mockReturnValueOnce(pendingPromise as any);

      render(React.createElement(CameraCapture, { onImageSelected: vi.fn() }));

      const cameraBtn = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
      const galleryBtn = screen.getByRole('button', { name: /اختيار صورة محفوظة مسبقاً من الألبوم/i });

      act(() => {
        fireEvent.click(cameraBtn);
      });

      // Gallery button is disabled and its click handler exits early
      expect(galleryBtn).toBeDisabled();
      act(() => {
        fireEvent.click(galleryBtn);
      });

      await waitFor(() => {
        expect(Camera.getPhoto).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        resolvePhoto!({
          base64String: SAMPLE_BASE64,
          format: 'jpeg',
          width: 200,
          height: 200,
        });
      });
    });
  });

  // =========================================================================
  // Challenge Section 7: Base64-to-File & Metadata Conversion Fidelity
  // =========================================================================
  describe('7. Base64-to-File Conversion Fidelity & Robustness', () => {
    it('base64ToFile converts raw base64 string to standard File with correct MIME and size', () => {
      const file = base64ToFile(SAMPLE_BASE64, 'test_image.jpg', 'image/jpeg');

      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('test_image.jpg');
      expect(file.type).toBe('image/jpeg');
      expect(file.size).toBeGreaterThan(0);
    });

    it('base64ToFile strips data:image/jpeg;base64, prefix cleanly', () => {
      const fileFromUrl = base64ToFile(SAMPLE_DATA_URL, 'from_url.jpg', 'image/jpeg');
      const fileFromRaw = base64ToFile(SAMPLE_BASE64, 'from_raw.jpg', 'image/jpeg');

      expect(fileFromUrl.size).toBe(fileFromRaw.size);
      expect(fileFromUrl.type).toBe('image/jpeg');
    });

    it('base64ToFile strips arbitrary data:image/png;base64, prefix cleanly', () => {
      const pngPrefixUrl = `data:image/png;base64,${SAMPLE_BASE64}`;
      const file = base64ToFile(pngPrefixUrl, 'converted.jpg', 'image/jpeg');

      expect(file.type).toBe('image/jpeg');
      expect(file.size).toBeGreaterThan(0);
    });

    it('processPhotoResult extracts base64Data when only dataUrl is provided by Camera plugin', async () => {
      vi.mocked(Camera.getPhoto).mockResolvedValueOnce({
        dataUrl: SAMPLE_DATA_URL,
        format: 'jpeg',
        width: 640,
        height: 480,
      } as any);

      const result = await capturePhoto();
      expect(result).not.toBeNull();
      expect(result?.base64Data).toBe(SAMPLE_BASE64);
      expect(result?.dataUrl).toBe(SAMPLE_DATA_URL);
      expect(result?.width).toBe(640);
      expect(result?.height).toBe(480);
    });

    it('processPhotoResult synthesizes dataUrl when only base64String is provided', async () => {
      vi.mocked(Camera.getPhoto).mockResolvedValueOnce({
        base64String: SAMPLE_BASE64,
        format: 'jpeg',
        width: 800,
        height: 600,
      } as any);

      const result = await capturePhoto();
      expect(result).not.toBeNull();
      expect(result?.base64Data).toBe(SAMPLE_BASE64);
      expect(result?.dataUrl).toBe(`data:image/jpeg;base64,${SAMPLE_BASE64}`);
      expect(result?.width).toBe(800);
      expect(result?.height).toBe(600);
    });

    it('processPhotoResult handles webPath fallback when base64 is missing via fetch and FileReader', async () => {
      // Mock fetch and FileReader for webPath fallback
      const mockBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });
      const originalFetch = global.fetch;

      global.fetch = vi.fn().mockResolvedValue({
        blob: vi.fn().mockResolvedValue(mockBlob),
      } as any);

      vi.mocked(Camera.getPhoto).mockResolvedValueOnce({
        webPath: 'blob:https://localhost/mock-uuid-photo',
        format: 'jpeg',
        width: 320,
        height: 240,
      } as any);

      try {
        const result = await capturePhoto();
        expect(result).not.toBeNull();
        expect(result?.width).toBe(320);
        expect(result?.height).toBe(240);
        expect(result?.format).toBe('jpeg');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  // =========================================================================
  // Challenge Section 8: Android Manifest, Gradle & Capacitor Sync Integrity
  // =========================================================================
  describe('8. Android Manifest, Gradle & Capacitor Sync Integrity', () => {
    it('verifies AndroidManifest.xml contains CAMERA permission and optional camera hardware feature', () => {
      const manifestPath = path.join(projectRoot, 'android/app/src/main/AndroidManifest.xml');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifestContent = fs.readFileSync(manifestPath, 'utf8');

      // Requirement R1: CAMERA permission
      expect(manifestContent).toMatch(/<uses-permission\s+android:name="android\.permission\.CAMERA"\s*\/>/);

      // Requirement R1: android.hardware.camera with android:required="false"
      expect(manifestContent).toMatch(
        /<uses-feature\s+android:name="android\.hardware\.camera"\s+android:required="false"\s*\/>/
      );

      // Photo gallery read permission for Android <= 32 and >= 33
      expect(manifestContent).toMatch(/android\.permission\.READ_EXTERNAL_STORAGE/);
      expect(manifestContent).toMatch(/android\.permission\.READ_MEDIA_IMAGES/);
    });

    it('verifies android/capacitor.settings.gradle links :capacitor-camera', () => {
      const settingsPath = path.join(projectRoot, 'android/capacitor.settings.gradle');
      expect(fs.existsSync(settingsPath)).toBe(true);

      const settingsContent = fs.readFileSync(settingsPath, 'utf8');
      expect(settingsContent).toContain("include ':capacitor-camera'");
      expect(settingsContent).toContain("@capacitor/camera/android");
    });

    it('verifies android/app/capacitor.build.gradle depends on :capacitor-camera', () => {
      const buildGradlePath = path.join(projectRoot, 'android/app/capacitor.build.gradle');
      expect(fs.existsSync(buildGradlePath)).toBe(true);

      const buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
      expect(buildGradleContent).toMatch(/implementation\s+project\(':capacitor-camera'\)/);
    });

    it('verifies package.json lists @capacitor/camera under dependencies', () => {
      const pkgPath = path.join(projectRoot, 'package.json');
      const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      expect(pkgJson.dependencies).toBeDefined();
      expect(pkgJson.dependencies['@capacitor/camera']).toBeDefined();
      expect(pkgJson.dependencies['@capacitor/camera']).toMatch(/^\^?[68]\./);
    });

    it('verifies capacitor.config.ts configures valid Android scheme and app ID', () => {
      const configPath = path.join(projectRoot, 'capacitor.config.ts');
      const configContent = fs.readFileSync(configPath, 'utf8');

      expect(configContent).toContain("appId: 'com.dalili.medicationguide'");
      expect(configContent).toContain("webDir: 'dist'");
      expect(configContent).toContain("androidScheme: 'https'");
    });
  });

  // =========================================================================
  // Challenge Section 9: Senior Usability & Accessibility Compliance
  // =========================================================================
  describe('9. Senior Usability & Accessibility Compliance', () => {
    it('primary button meets senior touch target height requirements (>= 76px)', () => {
      render(React.createElement(CameraCapture, { onImageSelected: vi.fn() }));

      const primaryButton = screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i });
      expect(primaryButton.className).toMatch(/min-h-\[76px\]/);
      expect(primaryButton).toHaveAttribute('aria-label', expect.stringContaining('الكاميرا'));
    });

    it('secondary gallery button meets touch target height requirements (>= 48px)', () => {
      render(React.createElement(CameraCapture, { onImageSelected: vi.fn() }));

      const galleryButton = screen.getByRole('button', { name: /اختيار صورة محفوظة مسبقاً من الألبوم/i });
      expect(galleryButton.className).toMatch(/min-h-\[(?:48|56|64)px\]/);
      expect(galleryButton).toHaveAttribute('aria-label', expect.stringContaining('الألبوم'));
    });

    it('displays senior-friendly guidance badge below action buttons', () => {
      render(React.createElement(CameraCapture, { onImageSelected: vi.fn() }));

      expect(screen.getByText('التصوير المباشر يسهل قراءة الدواء فوراً')).toBeInTheDocument();
    });
  });
});
