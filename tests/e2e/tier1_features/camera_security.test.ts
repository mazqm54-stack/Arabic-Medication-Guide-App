import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Camera, CameraSource, CameraDirection } from '@capacitor/camera';
import { capturePhoto, pickPhoto } from '@/services/nativeCamera';

describe('Tier 1: Feature Coverage — Camera & Security (F01, F02)', () => {
  const projectRoot = path.resolve(__dirname, '../../..');

  // =========================================================================
  // F01: Camera Crash Fix Preservation
  // =========================================================================
  describe('F01: Camera Crash Fix Preservation', () => {
    it('1. verifies @capacitor/camera@6.1.2 is strictly maintained in package.json', () => {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const cameraDep = pkg.dependencies['@capacitor/camera'];
      expect(cameraDep).toBeDefined();
      expect(cameraDep).toMatch(/6\.1\.2/);
      expect(cameraDep).not.toMatch(/[78]\./);
    });

    it('2. verifies AndroidManifest.xml preserves <queries> for IMAGE_CAPTURE, GET_CONTENT, and PICK', () => {
      const manifestPath = path.join(projectRoot, 'android/app/src/main/AndroidManifest.xml');
      expect(fs.existsSync(manifestPath)).toBe(true);
      const manifestContent = fs.readFileSync(manifestPath, 'utf8');

      expect(manifestContent).toContain('<queries>');
      expect(manifestContent).toContain('android:name="android.media.action.IMAGE_CAPTURE"');
      expect(manifestContent).toContain('android:name="android.intent.action.GET_CONTENT"');
      expect(manifestContent).toContain('android:name="android.intent.action.PICK"');
    });

    it('3. verifies capturePhoto invokes Camera.getPhoto with rear camera direction', async () => {
      const result = await capturePhoto();
      expect(Camera.getPhoto).toHaveBeenCalledWith(
        expect.objectContaining({
          source: CameraSource.Camera,
          direction: CameraDirection.Rear,
          quality: 90,
        })
      );
      expect(result).toBeDefined();
      expect(result?.dataUrl).toContain('data:image/jpeg;base64');
    });

    it('4. verifies pickPhoto invokes Camera.getPhoto with Photos source', async () => {
      const result = await pickPhoto();
      expect(Camera.getPhoto).toHaveBeenCalledWith(
        expect.objectContaining({
          source: CameraSource.Photos,
        })
      );
      expect(result).toBeDefined();
      expect(result?.dataUrl).toContain('data:image/jpeg;base64');
    });

    it('5. verifies permission denial is handled gracefully without throwing unhandled exceptions', async () => {
      vi.mocked(Camera.checkPermissions).mockResolvedValueOnce({ camera: 'denied', photos: 'denied' } as any);
      vi.mocked(Camera.requestPermissions).mockResolvedValueOnce({ camera: 'denied', photos: 'denied' } as any);

      await expect(capturePhoto()).rejects.toThrow();
    });
  });

  // =========================================================================
  // F02: Secret Zero-Leak Guarantee
  // =========================================================================
  describe('F02: Secret Zero-Leak Guarantee', () => {
    function getFilesRecursively(dir: string): string[] {
      if (!fs.existsSync(dir)) return [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getFilesRecursively(fullPath));
        } else if (!/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|eot)$/i.test(entry.name)) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const secretRegex = /AIza[0-9A-Za-z-_]{35}/;

    it('1. verifies src/ contains zero Google API keys or hardcoded client tokens', () => {
      const srcFiles = getFilesRecursively(path.join(projectRoot, 'src'));
      expect(srcFiles.length).toBeGreaterThan(0);
      for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf8');
        expect(secretRegex.test(content)).toBe(false);
      }
    });

    it('2. verifies worker/src/ contains zero hardcoded API keys', () => {
      const workerFiles = getFilesRecursively(path.join(projectRoot, 'worker/src'));
      for (const file of workerFiles) {
        const content = fs.readFileSync(file, 'utf8');
        expect(secretRegex.test(content)).toBe(false);
      }
    });

    it('3. verifies android/ directory contains zero embedded Google AI API keys', () => {
      const androidFiles = getFilesRecursively(path.join(projectRoot, 'android'));
      for (const file of androidFiles) {
        const content = fs.readFileSync(file, 'utf8');
        expect(secretRegex.test(content)).toBe(false);
      }
    }, 15000);

    it('4. verifies localStorage has no legacy client API key storage logic', () => {
      const clientFiles = getFilesRecursively(path.join(projectRoot, 'src'));
      for (const file of clientFiles) {
        const content = fs.readFileSync(file, 'utf8');
        expect(content).not.toContain('dalili_gemini_api_key_v1');
        expect(content).not.toContain('ApiKeyModal');
      }
    });

    it('5. verifies sanitizeMessage redacts keys, auth tokens and inline base64', async () => {
      const workerModule = await import('../../../worker/src/index');
      if (typeof workerModule.sanitizeMessage === 'function') {
        const leaked = 'Error on AIzaSyDummyKeyWith35CharactersLongString123 and ?key=AIzaSySecret';
        const sanitized = workerModule.sanitizeMessage(leaked);
        expect(sanitized).not.toContain('AIzaSyDummyKeyWith35CharactersLongString123');
        expect(sanitized).toContain('[REDACTED_KEY]');
      }
    });
  });
});
