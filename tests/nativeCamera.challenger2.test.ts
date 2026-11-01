import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Camera, CameraSource, CameraResultType, CameraDirection } from '@capacitor/camera';
import {
  capturePhoto,
  pickPhoto,
  captureFromCamera,
  pickFromGallery,
  checkAndRequestCameraPermissions,
  checkAndRequestPhotosPermissions,
  isUserCancelation,
  base64ToFile,
  CameraPermissionDeniedError,
  PhotosPermissionDeniedError,
  CaptureResult,
} from '../src/services/nativeCamera';

describe('Empirical Verification Suite - Challenger 2 (Native Camera & Android Setup)', () => {
  const SAMPLE_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const SAMPLE_DATA_URL = `data:image/jpeg;base64,${SAMPLE_BASE64}`;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock behavior for permissions
    vi.mocked(Camera.checkPermissions).mockResolvedValue({
      camera: 'granted',
      photos: 'granted',
    });
    vi.mocked(Camera.requestPermissions).mockResolvedValue({
      camera: 'granted',
      photos: 'granted',
    });
    vi.mocked(Camera.getPhoto).mockResolvedValue({
      base64String: SAMPLE_BASE64,
      dataUrl: SAMPLE_DATA_URL,
      webPath: 'blob:mock-camera-photo',
      format: 'jpeg',
      width: 640,
      height: 480,
    } as any);
  });

  // =========================================================================
  // 1. Android Manifest & Gradle Configuration Consistency
  // =========================================================================
  describe('1. Android Configuration & Build Consistency', () => {
    const rootDir = path.resolve(__dirname, '..');

    it('verifies android/capacitor.settings.gradle contains :capacitor-camera plugin binding', () => {
      const settingsGradlePath = path.join(rootDir, 'android', 'capacitor.settings.gradle');
      expect(fs.existsSync(settingsGradlePath)).toBe(true);
      const content = fs.readFileSync(settingsGradlePath, 'utf-8');

      expect(content).toContain("include ':capacitor-camera'");
      expect(content).toMatch(
        /project\(':capacitor-camera'\)\.projectDir\s*=\s*new File\('\.\.\/node_modules\/@capacitor\/camera\/android'\)/
      );
    });

    it('verifies android/app/capacitor.build.gradle declares implementation project(:capacitor-camera)', () => {
      const buildGradlePath = path.join(rootDir, 'android', 'app', 'capacitor.build.gradle');
      expect(fs.existsSync(buildGradlePath)).toBe(true);
      const content = fs.readFileSync(buildGradlePath, 'utf-8');

      expect(content).toContain("implementation project(':capacitor-camera')");
    });

    it('verifies android/app/src/main/AndroidManifest.xml contains android.permission.CAMERA', () => {
      const manifestPath = path.join(rootDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
      expect(fs.existsSync(manifestPath)).toBe(true);
      const manifestXml = fs.readFileSync(manifestPath, 'utf-8');

      expect(manifestXml).toContain('<uses-permission android:name="android.permission.CAMERA" />');
    });

    it('verifies android/app/src/main/AndroidManifest.xml specifies camera feature with android:required="false"', () => {
      const manifestPath = path.join(rootDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
      const manifestXml = fs.readFileSync(manifestPath, 'utf-8');

      // Requirement R1 explicitly mandates android:required="false" to prevent excluding devices without rear cameras
      expect(manifestXml).toMatch(
        /<uses-feature\s+android:name="android\.hardware\.camera"\s+android:required="false"\s*\/>/
      );
    });

    it('verifies android/app/src/main/AndroidManifest.xml specifies photo library storage permissions', () => {
      const manifestPath = path.join(rootDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
      const manifestXml = fs.readFileSync(manifestPath, 'utf-8');

      const hasReadStorage = manifestXml.includes('android.permission.READ_EXTERNAL_STORAGE');
      const hasReadMedia = manifestXml.includes('android.permission.READ_MEDIA_IMAGES');
      expect(hasReadStorage || hasReadMedia).toBe(true);
    });

    it('verifies package.json contains @capacitor/camera in dependencies', () => {
      const pkgJsonPath = path.join(rootDir, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

      expect(pkg.dependencies).toBeDefined();
      expect(pkg.dependencies['@capacitor/camera']).toBeDefined();
      expect(pkg.dependencies['@capacitor/camera']).toMatch(/^\^?[68]\./);
    });
  });

  // =========================================================================
  // 2. Custom Error Classes & Cancelation String Mining
  // =========================================================================
  describe('2. Error Classes & Cancelation String Mining', () => {
    it('verifies CameraPermissionDeniedError inherits from Error and provides friendly Arabic default message', () => {
      const err = new CameraPermissionDeniedError();
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(CameraPermissionDeniedError);
      expect(err.name).toBe('CameraPermissionDeniedError');
      expect(err.message).toContain('تم رفض إذن الكاميرا');
      expect(err.message).toContain('إعدادات الهاتف');
    });

    it('verifies PhotosPermissionDeniedError inherits from Error and provides friendly Arabic default message', () => {
      const err = new PhotosPermissionDeniedError();
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(PhotosPermissionDeniedError);
      expect(err.name).toBe('PhotosPermissionDeniedError');
      expect(err.message).toContain('تم رفض إذن الوصول إلى الصور');
    });

    it('identifies standard user cancelation strings from Capacitor Camera plugin', () => {
      const cancelPhrases = [
        'User cancelled photos app',
        'User cancelled photo selection',
        'user cancelled',
        'User canceled',
        'Action canceled',
        'no image picked',
        'No image picked by user',
        'closed',
        'Camera closed',
        'User closed camera preview',
        'cancelled by user',
      ];

      for (const phrase of cancelPhrases) {
        expect(isUserCancelation(new Error(phrase)), `Failed for: ${phrase}`).toBe(true);
        expect(isUserCancelation(phrase), `Failed for string: ${phrase}`).toBe(true);
      }
    });

    it('handles uppercase, lowercase, and mixed-case cancelation strings', () => {
      expect(isUserCancelation(new Error('USER CANCELLED'))).toBe(true);
      expect(isUserCancelation(new Error('NO IMAGE PICKED'))).toBe(true);
      expect(isUserCancelation(new Error('User Canceled Photos App'))).toBe(true);
      expect(isUserCancelation('CLOSED')).toBe(true);
    });

    it('returns false for falsy or non-cancelation error inputs', () => {
      expect(isUserCancelation(null)).toBe(false);
      expect(isUserCancelation(undefined)).toBe(false);
      expect(isUserCancelation(12345)).toBe(false);
      expect(isUserCancelation({})).toBe(false);
      expect(isUserCancelation('')).toBe(false);
    });

    it('returns false for genuine hardware, memory, or permission errors', () => {
      const genuineErrors = [
        'Camera hardware not available',
        'Camera 0: could not acquire hardware resource',
        'Permission denied: android.permission.CAMERA',
        'OutOfMemoryError: Java heap space during bitmap decode',
        'Fatal error opening camera activity',
        'NullPointerException in CameraPlugin',
      ];

      for (const errMsg of genuineErrors) {
        expect(isUserCancelation(new Error(errMsg)), `Wrongly matched genuine error: ${errMsg}`).toBe(false);
      }
    });
  });

  // =========================================================================
  // 3. base64ToFile Conversion & Corrupted Inputs
  // =========================================================================
  describe('3. base64ToFile Conversion & Corrupted Inputs', () => {
    it('converts clean raw base64 string to a standard File object', () => {
      const file = base64ToFile(SAMPLE_BASE64, 'test.jpg', 'image/jpeg');

      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('test.jpg');
      expect(file.type).toBe('image/jpeg');
      expect(file.size).toBeGreaterThan(0);
    });

    it('strips data:image/jpeg;base64, data URL prefix correctly before decoding', () => {
      const file = base64ToFile(SAMPLE_DATA_URL, 'prefixed.jpg', 'image/jpeg');

      expect(file).toBeInstanceOf(File);
      expect(file.size).toBeGreaterThan(0);
    });

    it('strips other image mime-type prefixes like data:image/png;base64,', () => {
      const pngPrefixUrl = `data:image/png;base64,${SAMPLE_BASE64}`;
      const file = base64ToFile(pngPrefixUrl, 'prefixed.png', 'image/png');

      expect(file).toBeInstanceOf(File);
      expect(file.size).toBeGreaterThan(0);
    });

    it('handles empty string base64 by returning a 0-byte File', () => {
      const file = base64ToFile('', 'empty.jpg', 'image/jpeg');

      expect(file).toBeInstanceOf(File);
      expect(file.size).toBe(0);
    });

    it('throws DOMException / InvalidCharacterError when base64 is corrupted with illegal characters', () => {
      const corruptedBase64 = '!!!@@@###$$$%%%^^^&&&***';
      expect(() => {
        base64ToFile(corruptedBase64, 'corrupted.jpg', 'image/jpeg');
      }).toThrow();
    });

    it('generates a default filename with timestamp when filename is omitted', () => {
      const file = base64ToFile(SAMPLE_BASE64);
      expect(file.name).toMatch(/^medication_\d+\.jpg$/);
    });
  });

  // =========================================================================
  // 4. Permissions State Transitions
  // =========================================================================
  describe('4. Permissions State Transitions', () => {
    describe('checkAndRequestCameraPermissions', () => {
      it('returns true immediately when camera status is already granted (does not call requestPermissions)', async () => {
        vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
          camera: 'granted',
          photos: 'granted',
        });

        const granted = await checkAndRequestCameraPermissions();
        expect(granted).toBe(true);
        expect(Camera.checkPermissions).toHaveBeenCalledTimes(1);
        expect(Camera.requestPermissions).not.toHaveBeenCalled();
      });

      it('calls requestPermissions when camera status is prompt, returns true when granted', async () => {
        vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
          camera: 'prompt',
          photos: 'prompt',
        });
        vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
          camera: 'granted',
          photos: 'granted',
        });

        const granted = await checkAndRequestCameraPermissions();
        expect(granted).toBe(true);
        expect(Camera.requestPermissions).toHaveBeenCalledWith({ permissions: ['camera'] });
      });

      it('calls requestPermissions when camera status is prompt-with-rationale, returns false when denied', async () => {
        vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
          camera: 'prompt-with-rationale',
          photos: 'prompt',
        });
        vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
          camera: 'denied',
          photos: 'denied',
        });

        const granted = await checkAndRequestCameraPermissions();
        expect(granted).toBe(false);
      });

      it('calls requestPermissions when camera status is denied, returns false if still denied', async () => {
        vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
          camera: 'denied',
          photos: 'denied',
        });
        vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
          camera: 'denied',
          photos: 'denied',
        });

        const granted = await checkAndRequestCameraPermissions();
        expect(granted).toBe(false);
      });

      it('returns true as fallback when Camera.checkPermissions throws an exception (web / unmocked environment)', async () => {
        vi.mocked(Camera.checkPermissions).mockRejectedValueOnce(
          new Error('Plugin not implemented on web')
        );

        const granted = await checkAndRequestCameraPermissions();
        expect(granted).toBe(true);
      });

      it('returns true as fallback when Camera.requestPermissions throws an exception', async () => {
        vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
          camera: 'prompt',
          photos: 'prompt',
        });
        vi.mocked(Camera.requestPermissions).mockRejectedValueOnce(
          new Error('Permission request interrupted')
        );

        const granted = await checkAndRequestCameraPermissions();
        expect(granted).toBe(true);
      });
    });

    describe('checkAndRequestPhotosPermissions', () => {
      it('returns true immediately when photos status is already granted', async () => {
        vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
          camera: 'denied',
          photos: 'granted',
        });

        const granted = await checkAndRequestPhotosPermissions();
        expect(granted).toBe(true);
        expect(Camera.requestPermissions).not.toHaveBeenCalled();
      });

      it('calls requestPermissions when photos status is prompt, returns true when granted', async () => {
        vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
          camera: 'granted',
          photos: 'prompt',
        });
        vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
          camera: 'granted',
          photos: 'granted',
        });

        const granted = await checkAndRequestPhotosPermissions();
        expect(granted).toBe(true);
        expect(Camera.requestPermissions).toHaveBeenCalledWith({ permissions: ['photos'] });
      });

      it('calls requestPermissions when photos status is denied, returns false if denied', async () => {
        vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
          camera: 'granted',
          photos: 'denied',
        });
        vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
          camera: 'granted',
          photos: 'denied',
        });

        const granted = await checkAndRequestPhotosPermissions();
        expect(granted).toBe(false);
      });

      it('returns true as fallback when photos permission check rejects', async () => {
        vi.mocked(Camera.checkPermissions).mockRejectedValueOnce(
          new Error('Web fallback: photos permission API unavailable')
        );

        const granted = await checkAndRequestPhotosPermissions();
        expect(granted).toBe(true);
      });
    });
  });

  // =========================================================================
  // 5. capturePhoto() Isolated Unit & Stress Tests
  // =========================================================================
  describe('5. capturePhoto() Isolated Unit Tests', () => {
    it('invokes Camera.getPhoto with exact required options (CameraSource.Camera, CameraDirection.Rear, Base64)', async () => {
      const result = await capturePhoto();

      expect(Camera.getPhoto).toHaveBeenCalledTimes(1);
      expect(Camera.getPhoto).toHaveBeenCalledWith({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        direction: CameraDirection.Rear,
        correctOrientation: true,
        saveToGallery: false,
      });

      expect(result).not.toBeNull();
      expect(result!.base64Data).toBe(SAMPLE_BASE64);
      expect(result!.format).toBe('jpeg');
      expect(result!.width).toBe(640);
      expect(result!.height).toBe(480);
      expect(result!.dataUrl).toBe(SAMPLE_DATA_URL);
      expect(result!.name).toMatch(/^medication_camera_\d+\.jpg$/);
    });

    it('synthesizes dataUrl if plugin returns base64String without dataUrl', async () => {
      vi.mocked(Camera.getPhoto).mockResolvedValueOnce({
        base64String: SAMPLE_BASE64,
        dataUrl: undefined,
        format: 'jpeg',
        width: 800,
        height: 600,
      } as any);

      const result = await capturePhoto();
      expect(result).not.toBeNull();
      expect(result!.dataUrl).toBe(`data:image/jpeg;base64,${SAMPLE_BASE64}`);
      expect(result!.base64Data).toBe(SAMPLE_BASE64);
    });

    it('extracts base64String if plugin returns dataUrl without base64String', async () => {
      vi.mocked(Camera.getPhoto).mockResolvedValueOnce({
        base64String: undefined,
        dataUrl: SAMPLE_DATA_URL,
        format: 'jpeg',
        width: 1024,
        height: 768,
      } as any);

      const result = await capturePhoto();
      expect(result).not.toBeNull();
      expect(result!.base64Data).toBe(SAMPLE_BASE64);
      expect(result!.dataUrl).toBe(SAMPLE_DATA_URL);
    });

    it('handles webPath fallback when both base64String and dataUrl are omitted', async () => {
      const mockBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        blob: () => Promise.resolve(mockBlob),
      } as any);

      vi.mocked(Camera.getPhoto).mockResolvedValueOnce({
        base64String: undefined,
        dataUrl: undefined,
        webPath: 'blob:mock-camera-url',
        format: 'jpeg',
        width: 320,
        height: 240,
      } as any);

      const result = await capturePhoto();
      expect(fetchSpy).toHaveBeenCalledWith('blob:mock-camera-url');
      expect(result).not.toBeNull();
      expect(result!.width).toBe(320);
      expect(result!.height).toBe(240);
      fetchSpy.mockRestore();
    });

    it('defaults width and height to 0 if plugin returns undefined dimensions', async () => {
      vi.mocked(Camera.getPhoto).mockResolvedValueOnce({
        base64String: SAMPLE_BASE64,
        dataUrl: SAMPLE_DATA_URL,
        format: 'jpeg',
        width: undefined,
        height: undefined,
      } as any);

      const result = await capturePhoto();
      expect(result).not.toBeNull();
      expect(result!.width).toBe(0);
      expect(result!.height).toBe(0);
    });

    it('returns null when user cancels camera without taking photo', async () => {
      vi.mocked(Camera.getPhoto).mockRejectedValueOnce(new Error('User cancelled photos app'));

      const result = await capturePhoto();
      expect(result).toBeNull();
    });

    it('returns null for various cancelation error message variations', async () => {
      const testCases = [
        'user cancelled',
        'User canceled',
        'no image picked',
        'Camera closed',
        'Canceled',
      ];

      for (const msg of testCases) {
        vi.mocked(Camera.getPhoto).mockRejectedValueOnce(new Error(msg));
        const result = await capturePhoto();
        expect(result, `Expected null for cancelation string: "${msg}"`).toBeNull();
      }
    });

    it('throws CameraPermissionDeniedError and triggers window.alert when camera permission is denied', async () => {
      vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
        camera: 'denied',
        photos: 'denied',
      });
      vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
        camera: 'denied',
        photos: 'denied',
      });

      const alertSpy = vi.spyOn(window, 'alert');

      await expect(capturePhoto()).rejects.toThrow(CameraPermissionDeniedError);
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('تم رفض إذن الكاميرا')
      );
      expect(Camera.getPhoto).not.toHaveBeenCalled();
    });

    it('does not fail if window.alert throws an error during permission denial', async () => {
      vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
        camera: 'denied',
        photos: 'denied',
      });
      vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
        camera: 'denied',
        photos: 'denied',
      });

      const alertSpy = vi.spyOn(window, 'alert').mockImplementationOnce(() => {
        throw new Error('Not implemented: window.alert');
      });

      await expect(capturePhoto()).rejects.toThrow(CameraPermissionDeniedError);
      alertSpy.mockRestore();
    });

    it('rethrows unexpected camera hardware or system errors', async () => {
      vi.mocked(Camera.getPhoto).mockRejectedValueOnce(
        new Error('Camera hardware failed: could not open camera session')
      );

      await expect(capturePhoto()).rejects.toThrow(
        'Camera hardware failed: could not open camera session'
      );
    });
  });

  // =========================================================================
  // 6. pickPhoto() Isolated Unit & Stress Tests
  // =========================================================================
  describe('6. pickPhoto() Isolated Unit Tests', () => {
    it('invokes Camera.getPhoto with CameraSource.Photos for gallery picker', async () => {
      const result = await pickPhoto();

      expect(Camera.getPhoto).toHaveBeenCalledTimes(1);
      expect(Camera.getPhoto).toHaveBeenCalledWith({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
        correctOrientation: true,
        saveToGallery: false,
      });

      expect(result).not.toBeNull();
      expect(result!.base64Data).toBe(SAMPLE_BASE64);
      expect(result!.name).toMatch(/^medication_gallery_\d+\.jpg$/);
    });

    it('returns null when user cancels gallery picker without selecting an image', async () => {
      vi.mocked(Camera.getPhoto).mockRejectedValueOnce(new Error('User cancelled photos app'));

      const result = await pickPhoto();
      expect(result).toBeNull();
    });

    it('throws PhotosPermissionDeniedError and alerts when photos permission is denied', async () => {
      vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
        camera: 'granted',
        photos: 'denied',
      });
      vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
        camera: 'granted',
        photos: 'denied',
      });

      const alertSpy = vi.spyOn(window, 'alert');

      await expect(pickPhoto()).rejects.toThrow(PhotosPermissionDeniedError);
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('تم رفض إذن الوصول إلى الصور')
      );
      expect(Camera.getPhoto).not.toHaveBeenCalled();
    });

    it('rethrows unexpected filesystem or memory errors from gallery selection', async () => {
      vi.mocked(Camera.getPhoto).mockRejectedValueOnce(
        new Error('File reading error: Permission denial reading URI')
      );

      await expect(pickPhoto()).rejects.toThrow(
        'File reading error: Permission denial reading URI'
      );
    });
  });

  // =========================================================================
  // 7. High-Level Contracts captureFromCamera() & pickFromGallery()
  // =========================================================================
  describe('7. High-Level Contracts captureFromCamera() & pickFromGallery()', () => {
    it('captureFromCamera returns CaptureResult interface with base64Data, format, width, height, and file', async () => {
      const result: CaptureResult | null = await captureFromCamera();

      expect(result).not.toBeNull();
      expect(result).toEqual({
        base64Data: SAMPLE_BASE64,
        format: 'jpeg',
        width: 640,
        height: 480,
        file: expect.any(File),
      });
    });

    it('captureFromCamera returns null on cancelation', async () => {
      vi.mocked(Camera.getPhoto).mockRejectedValueOnce(new Error('User cancelled photos app'));

      const result = await captureFromCamera();
      expect(result).toBeNull();
    });

    it('captureFromCamera propagates permission denial error', async () => {
      vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
        camera: 'denied',
        photos: 'denied',
      });
      vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
        camera: 'denied',
        photos: 'denied',
      });

      await expect(captureFromCamera()).rejects.toThrow(CameraPermissionDeniedError);
    });

    it('pickFromGallery returns CaptureResult interface with base64Data, format, width, height, and file', async () => {
      const result: CaptureResult | null = await pickFromGallery();

      expect(result).not.toBeNull();
      expect(result).toEqual({
        base64Data: SAMPLE_BASE64,
        format: 'jpeg',
        width: 640,
        height: 480,
        file: expect.any(File),
      });
    });

    it('pickFromGallery returns null on cancelation', async () => {
      vi.mocked(Camera.getPhoto).mockRejectedValueOnce(new Error('no image picked'));

      const result = await pickFromGallery();
      expect(result).toBeNull();
    });

    it('pickFromGallery propagates permission denial error', async () => {
      vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({
        camera: 'granted',
        photos: 'denied',
      });
      vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({
        camera: 'granted',
        photos: 'denied',
      });

      await expect(pickFromGallery()).rejects.toThrow(PhotosPermissionDeniedError);
    });
  });
});
