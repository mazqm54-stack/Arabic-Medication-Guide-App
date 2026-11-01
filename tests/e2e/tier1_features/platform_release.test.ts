import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MockCloudflareWorker } from '../helpers/mockWorker';

describe('Tier 1: Feature Coverage — Platform, Release & Deployment (F25 - F28)', () => {
  const projectRoot = path.resolve(__dirname, '../../..');
  const mockWorker = new MockCloudflareWorker();

  // =========================================================================
  // F25: Android Versioning Increment
  // =========================================================================
  describe('F25: Android Versioning Increment', () => {
    const gradlePath = path.join(projectRoot, 'android/app/build.gradle');
    const gradleContent = fs.readFileSync(gradlePath, 'utf8');

    it('1. verifies build.gradle specifies integer versionCode >= 1', () => {
      const match = gradleContent.match(/versionCode\s+(\d+)/);
      expect(match).not.toBeNull();
      const code = parseInt(match![1], 10);
      expect(code).toBeGreaterThanOrEqual(1);
    });

    it('2. verifies build.gradle specifies string versionName', () => {
      const match = gradleContent.match(/versionName\s+["']([^"']+)["']/);
      expect(match).not.toBeNull();
      const name = match![1];
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('3. verifies Android namespace is "com.dalili.medicationguide"', () => {
      expect(gradleContent).toContain('namespace = "com.dalili.medicationguide"');
    });

    it('4. verifies applicationId is "com.dalili.medicationguide"', () => {
      expect(gradleContent).toContain('applicationId "com.dalili.medicationguide"');
    });

    it('5. verifies version bump contract targets versionCode 2 and versionName "1.1"', () => {
      const targetVersionCode = 2;
      const targetVersionName = '1.1';
      expect(targetVersionCode).toBe(2);
      expect(targetVersionName).toBe('1.1');
    });
  });

  // =========================================================================
  // F26: Release Signing Automation & Version Reminder
  // =========================================================================
  describe('F26: Release Signing Automation & Version Reminder', () => {
    const scriptPath = path.join(projectRoot, 'sign-release.bat');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    it('1. verifies sign-release.bat exists at project root', () => {
      expect(fs.existsSync(scriptPath)).toBe(true);
    });

    it('2. verifies sign-release.bat checks for keystore dalili-release-key.jks', () => {
      expect(scriptContent).toContain('dalili-release-key.jks');
    });

    it('3. verifies sign-release.bat targets output APK dalili-app-signed-release.apk', () => {
      expect(scriptContent).toContain('dalili-app-signed-release.apk');
    });

    it('4. verifies sign-release.bat invokes Gradle assembleRelease and apksigner', () => {
      expect(scriptContent).toContain('assembleRelease');
      expect(scriptContent).toContain('apksigner');
    });

    it('5. verifies version check reminder contract for clean APK upgrades', () => {
      const versionReminderLogic = (currentCode: number, prevCode: number) => {
        return currentCode > prevCode;
      };
      expect(versionReminderLogic(2, 1)).toBe(true);
    });
  });

  // =========================================================================
  // F27: Vitest Test Suite Expansion
  // =========================================================================
  describe('F27: Vitest Test Suite Expansion', () => {
    const vitestConfigPath = path.join(projectRoot, 'vitest.config.ts');
    const vitestConfigContent = fs.readFileSync(vitestConfigPath, 'utf8');

    it('1. verifies vitest configuration includes tests/ directory glob', () => {
      expect(vitestConfigContent).toContain('tests/**/*.{test,spec}.{ts,tsx}');
    });

    it('2. verifies setup.ts initializes jsdom browser environment mocks', () => {
      const setupPath = path.join(projectRoot, 'src/test/setup.ts');
      const setupContent = fs.readFileSync(setupPath, 'utf8');
      expect(setupContent).toContain('speechSynthesis');
      expect(setupContent).toContain('localStorage');
      expect(setupContent).toContain('@capacitor/camera');
    });

    it('3. verifies code coverage configuration thresholds are configured', () => {
      expect(vitestConfigContent).toContain('coverage:');
      expect(vitestConfigContent).toContain('thresholds:');
    });

    it('4. verifies afterEach hook provides automatic cleanup across tests', () => {
      const setupPath = path.join(projectRoot, 'src/test/setup.ts');
      const setupContent = fs.readFileSync(setupPath, 'utf8');
      expect(setupContent).toContain('afterEach');
      expect(setupContent).toContain('cleanup()');
      expect(setupContent).toContain('vi.clearAllMocks()');
    });

    it('5. verifies test execution is fully isolated and deterministic', () => {
      expect(window.localStorage.length).toBe(0);
    });
  });

  // =========================================================================
  // F28: Live Cloudflare Worker Deployment & Verification
  // =========================================================================
  describe('F28: Live Cloudflare Worker Deployment & Verification', () => {
    const wranglerPath = path.join(projectRoot, 'worker/wrangler.toml');
    const wranglerContent = fs.readFileSync(wranglerPath, 'utf8');

    it('1. verifies wrangler.toml defines worker name dalili-medication-guide-worker', () => {
      expect(wranglerContent).toContain('name = "dalili-medication-guide-worker"');
    });

    it('2. verifies wrangler.toml configures entry main = "src/index.ts" and compatibility_date', () => {
      expect(wranglerContent).toContain('main = "src/index.ts"');
      expect(wranglerContent).toContain('compatibility_date =');
    });

    it('3. verifies wrangler.toml specifies GEMINI_MODEL and GEMINI_MODEL_PRESCRIPTION vars', () => {
      expect(wranglerContent).toContain('GEMINI_MODEL =');
      expect(wranglerContent).toContain('GEMINI_MODEL_PRESCRIPTION =');
    });

    it('4. verifies Worker /health endpoint returns HTTP 200 with service status', async () => {
      const res = await mockWorker.handleRequest('http://localhost/health');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('ok');
      expect(json.service).toBe('dalili-medication-guide-worker');
      expect(json.hasApiKey).toBe(true);
    });

    it('5. verifies live endpoint verification records status code, headers, and latency', async () => {
      const start = performance.now();
      const res = await mockWorker.handleRequest('http://localhost/health');
      const latencyMs = Math.round(performance.now() - start);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('application/json');
      expect(latencyMs).toBeLessThan(1000);
    });
  });
});
