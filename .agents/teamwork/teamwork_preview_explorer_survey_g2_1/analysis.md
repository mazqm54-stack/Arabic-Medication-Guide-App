# Technical Survey & Codebase Analysis Report

**Date**: 2026-10-28  
**Explorer**: Explorer 1 (Survey Phase)  
**Project**: دليلي الدوائي (Dalili Medication Guide)  
**Target Architecture**: Native Android Application (Capacitor) + Vercel Serverless Backend (`/api/analyze`)

---

## Executive Summary

The existing project is a mobile-first Arabic Progressive Web App (PWA) built with React 18, Vite 6, Tailwind CSS, and TypeScript 5.7. It has a passing Vitest test suite (5 test files, 23 tests passing) and builds cleanly to `dist/`. The Android native wrapper structure (`android/`) was scaffolded using Capacitor 8.5.3, but is currently in a skeleton state: no Capacitor plugins are installed, orientation is not locked to portrait, launcher icons and splash screens still use default Capacitor/Android assets, and no APK build script exists. Furthermore, the client currently stores a Gemini API key in `localStorage` and calls the Gemini API directly from the browser, which must be replaced by a zero-secret Vercel serverless backend (`/api/analyze`).

---

## 1. Analysis of Configuration Files & Current Dependencies

### 1.1 `package.json`
- **Identity**: `name`: `"dalili-medication-guide"`, `version`: `"1.0.0"`, `type`: `"module"`.
- **Scripts**:
  ```json
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
  ```
  - **Observations**:
    - Missing `build:apk` script.
    - Missing standard Capacitor helper scripts (`cap:sync`, `cap:copy`, etc.).
- **Dependencies**:
  - `@capacitor/android`: `^8.5.3`
  - `@capacitor/cli`: `^8.5.3`
  - `@capacitor/core`: `^8.5.3`
  - `lucide-react`: `^0.468.0`
  - `react`: `^18.3.1`
  - `react-dom`: `^18.3.1`
- **DevDependencies**:
  - `@testing-library/jest-dom`: `^6.6.3`
  - `@testing-library/react`: `^16.1.0`
  - `@types/node`: `^22.10.2`
  - `@types/react`: `^18.3.18`
  - `@types/react-dom`: `^18.3.5`
  - `@vitejs/plugin-react`: `^4.3.4`
  - `autoprefixer`: `^10.4.20`
  - `jsdom`: `^26.0.0`
  - `postcss`: `^8.5.2`
  - `tailwindcss`: `^3.4.17`
  - `typescript`: `^5.7.3`
  - `vite`: `^6.1.0`
  - `vitest`: `^3.0.5`

### 1.2 `capacitor.config.ts`
- **Content**:
  ```typescript
  import type { CapacitorConfig } from '@capacitor/cli';

  const config: CapacitorConfig = {
    appId: 'com.dalili.medicationguide',
    appName: 'دليلي الدوائي',
    webDir: 'dist',
    server: {
      androidScheme: 'https'
    }
  };

  export default config;
  ```
- **Observations**: Valid baseline config. For custom splash screens and plugins, plugin configurations (e.g. `SplashScreen: { launchShowDuration: 2000, backgroundColor: "#006D77", showSpinner: false }`) can be declared here.

### 1.3 `vite.config.ts`
- Uses `@vitejs/plugin-react`.
- Resolves alias `@` to `./src`.
- Builds to `dist` with `target: 'es2022'`.
- Verified: `npm.cmd run build` executes cleanly and outputs to `dist/`.

### 1.4 `tsconfig.json`
- Target: `ES2022`, module: `ESNext`, moduleResolution: `bundler`.
- Strict mode is active (`strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`).
- Path mapping `@/*` -> `./src/*`.
- Includes `src`, `tests`, `vite.config.ts`, `vitest.config.ts`.
- Note: If `/api` serverless functions are authored in TypeScript, ensure they are either typed via a separate `tsconfig` or accommodated without breaking client bundler type checks.

---

## 2. Capacitor Plugins Installed vs Required

| Plugin | Required Role | Current Status | Action Required |
|---|---|---|---|
| `@capacitor/camera` | Native rear camera capture (`CameraSource.Camera`) & gallery picker | **Not installed** | Install via `npm install @capacitor/camera` & run `npx cap sync android` |
| `@capacitor-community/text-to-speech` | Arabic speech synthesis (rate ~0.85) with Play/Pause/Stop | **Not installed** | Install via `npm install @capacitor-community/text-to-speech` & sync |
| `@capacitor/haptics` | Light haptic feedback on primary touch targets | **Not installed** | Install via `npm install @capacitor/haptics` & sync |
| `@capacitor/preferences` | Offline persistent key-value storage for "أدويتي", settings, history | **Not installed** | Install via `npm install @capacitor/preferences` & sync |

### Sync State in `android/`:
- `android/app/src/main/assets/capacitor.plugins.json`: `[]` (empty array).
- `android/app/capacitor.build.gradle`: `dependencies {}` (empty).
- Once packages are added to `package.json`, running `npx.cmd cap sync android` will populate these configuration files automatically.

---

## 3. Native Android Project Configuration

### 3.1 Orientation Lock (`AndroidManifest.xml`)
- **File**: `android/app/src/main/AndroidManifest.xml` (lines 12–25)
- **Current State**:
  ```xml
  <activity
      android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"
      android:name=".MainActivity"
      android:label="@string/title_activity_main"
      android:theme="@style/AppTheme.NoActionBarLaunch"
      android:launchMode="singleTask"
      android:exported="true">
  ```
- **Deficiency**: Does **NOT** have `android:screenOrientation="portrait"`.
- **Required Fix**: Add `android:screenOrientation="portrait"` to the `<activity>` tag.

### 3.2 Splash Screen & Theme Palette
- **Deep Teal Palette**: `#006D77`.
- **Current State in `android/app/src/main/res/`**:
  - `values/ic_launcher_background.xml`: `<color name="ic_launcher_background">#FFFFFF</color>` (pure white, not teal).
  - `drawable/ic_launcher_background.xml`: Vector background fill is `#26A69A` (default Android/Capacitor green).
  - `values/styles.xml`:
    - `AppTheme.NoActionBarLaunch` uses `<item name="android:background">@drawable/splash</item>`.
    - Lines 7–8 reference `@color/colorPrimary` and `@color/colorPrimaryDark`, but there is **no `colors.xml`** file in `res/values/`.
  - `drawable/splash.png` and `drawable-*-*dpi/splash.png` are the default Capacitor splash screens.
- **Required Fix**:
  1. Add `colors.xml` to `android/app/src/main/res/values/` defining `colorPrimary` (`#006D77`), `colorPrimaryDark` (`#004d54`), `colorAccent` (`#F59E0B`), and `splashBackground` (`#006D77`).
  2. Set `ic_launcher_background` to `#006D77`.
  3. Generate or configure splash screen drawable with Deep Teal background `#006D77`.

### 3.3 App Icons
- **Current State**:
  - Adaptive icon `mipmap-anydpi-v26/ic_launcher.xml` references `@drawable/ic_launcher_foreground` which is the default Android robot icon (`android:pathData="M66.94,46.02L66.94,46.02C72.44,50.07..."`).
  - Mipmap folders contain default Android robot PNGs.
- **Required Fix**:
  - Generate high-contrast medical capsule icon for Android mipmaps (192, 512, hdpi, mdpi, xhdpi, xxhdpi, xxxhdpi) matching the branding palette: Deep Teal `#006D77`, Warm White `#F8F9FA`, Amber `#F59E0B`, Dark Slate `#1D3557`.

### 3.4 Permissions & Hardware Features
- In `AndroidManifest.xml`:
  - `android.permission.INTERNET` is present.
  - `android.permission.CAMERA` is present.
  - `android.hardware.camera` (`android:required="false"`) is present.
  - `READ_EXTERNAL_STORAGE` and `READ_MEDIA_IMAGES` are present.
- Permissions are already aligned with `@capacitor/camera`.

---

## 4. Release APK Build Requirements & Infrastructure

### 4.1 Build Scripts
- **Current State**:
  - `scripts/` contains only `generate-icons.js`.
  - There is NO `scripts/build-apk.ps1`.
  - `package.json` lacks `"build:apk"`.
- **System Tooling Inspection**:
  - **Java**: Java 17 is available (`C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot\bin\javac.exe`).
  - **Android SDK**: `ANDROID_HOME` and `ANDROID_SDK_ROOT` are not set in the global environment; no local SDK found at default paths (`AppData\Local\Android\Sdk`).
  - **Gradle Execution Inside Sandbox**:
    - Default `~/.gradle` (`C:\Users\PC\.gradle`) is outside the sandbox and throws parent directory lock file exceptions unless `GRADLE_USER_HOME` is specified within the workspace.
    - Gradle wrapper attempts to download `gradle-8.14.3-all.zip` from `services.gradle.org`, which cannot connect due to sandbox network restrictions.
- **Required Solution**:
  1. Author a robust PowerShell script `scripts/build-apk.ps1`:
     - Checks for `JAVA_HOME`, `ANDROID_HOME` (or prompts/provides sensible defaults).
     - Configures `$env:GRADLE_USER_HOME` safely.
     - Runs `npm.cmd run build` to compile the web bundle into `dist/`.
     - Runs `npx.cmd cap sync android` to sync web assets and native plugins.
     - Invokes `gradlew.bat assembleRelease` in the `android/` directory.
     - Signs or aligns the resulting APK (using debug key for direct testing or release keystore).
     - Copies output APK to `release/dalili-medication-guide.apk` with clear size and timestamp logging.
  2. Add npm script: `"build:apk": "powershell -ExecutionPolicy Bypass -File scripts/build-apk.ps1"`.
  3. Provide comprehensive documentation in `README.md` / release notes for building both locally and in CI/CD.

---

## 5. Existing Code, Tests, and Upgrade Roadmap

### 5.1 What Can Be Removed
1. **Client API Key Storage & Input Modal**:
   - `src/components/ApiKeyModal.tsx` can be completely deleted.
   - Remove `dalili_gemini_api_key_v1` and `getStoredApiKey()`, `setStoredApiKey()`, `removeStoredApiKey()` from `src/services/apiKeyStorage.ts`.
   - Remove the Settings button and key-modal state from `src/App.tsx`.
   - Guarantees zero secrets in client source code or `dist/` bundle (satisfying R1 & Acceptance Criteria).
2. **Direct Browser Calls to Gemini API**:
   - `src/services/geminiVision.ts` directly calls `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}` with client API key.
   - This must be replaced with a client proxy calling `/api/analyze` (or `VITE_API_URL`).

### 5.2 What Needs to Be Upgraded
1. **Vercel Serverless Backend (`/api/analyze`)**:
   - Create `api/analyze.ts` (Vercel Serverless Function):
     - Validates HTTP method (`POST`), payload size, and base64 JPEG format.
     - Reads `GEMINI_API_KEY` and configurable `GEMINI_MODEL` (e.g. `gemini-1.5-flash` or `gemini-2.5-flash`) from environment variables (never hardcoded).
     - Implements per-IP rate-limiting (e.g. 20 req/hour) and MENA/Europe region affinity (`fra1`/`cdg1`).
     - Injects strict R5 system prompt and strict JSON schema (`responseMimeType: "application/json"`).
     - Returns kind, clear Arabic error responses.
2. **AI Prompt & Response Schema (R5)**:
   - Upgrade prompt to exact English pharmacist prompt from R5.
   - Upgrade schema to include:
     - `is_clear`: boolean
     - `retake_message`: string
     - `confidence`: 'high' | 'medium' | 'low'
     - `evidence_text`: string
     - `medicine_name_ar`, `medicine_name_en`, `active_ingredient`
     - `uses`: max 3 short items
     - `how_and_when`: max 3 short items
     - `warnings`: max 4 short items
     - `audio_summary`: 3–4 short sentences spoken style
   - Client guardrails:
     - If `evidence_text` is empty -> treat confidence as `low`.
     - If `confidence === 'low'` or `is_clear === false` -> prompt for retake without showing details.
3. **Local Cairo Font Bundling (R3)**:
   - Currently `index.html` loads fonts from Google Fonts CDN (`https://fonts.googleapis.com`).
   - Need to bundle Cairo font files in `src/assets/fonts/cairo/` (.woff2), define `@font-face` in `src/index.css`, and remove the external Google Font link tags from `index.html` (zero external font requests).
4. **Client Image Pre-Processing & Hashing Cache (R3)**:
   - Resize captured images to max 1024px on longest side and compress to JPEG quality 0.7 prior to transmission.
   - Compute hash of captured image (e.g. SHA-256 or canvas-based fast hash) to store and instantly serve cached analysis results without repeated API calls.
5. **Elderly-Centric Arabic Flow & Features (R4)**:
   - **First-Launch Onboarding**: 3-point visual photo guide with large icons and "فهمت" button.
   - **Medicine Confirmation Step**: Render detected medicine name in extra-large text with "نعم، هذا دوائي" and "لا، أعد التصوير".
   - **"أدويتي" (My Medicines) Shelf**: Local medicine manager allowing 1-click addition from results, viewing saved medicines with thumbnails, and deletion with Arabic confirmation dialog.
   - **Skeleton Loader**: Reassuring Arabic status text with skeleton layout instead of a plain spinner.
6. **Native Capacitor Plugins Integration (R2)**:
   - Update `CameraCapture.tsx` to use `@capacitor/camera` with gallery picker fallback.
   - Update `speechController.ts` and `AudioToolbar.tsx` to use `@capacitor-community/text-to-speech` with web speech fallback.
   - Integrate `@capacitor/haptics` for tactile feedback on primary touch targets.
   - Use `@capacitor/preferences` (with localStorage fallback) for resilient storage of "أدويتي", recent scans, and settings.
7. **Test Suite Expansion**:
   - Retain existing passing tests for accessibility, historyStorage, speechController.
   - Add new automated tests for:
     - Serverless handler (`api/analyze.test.ts`): image size check, rate-limiting, error responses.
     - Image compression and hash cache (`imageUtils.test.ts`).
     - R5 JSON schema parser and guardrails (`geminiParser.test.ts`).
     - Confirmation step and "أدويتي" storage manager (`savedMedicines.test.ts`).
     - Secret scan verification: grep test verifying zero API keys in client source or `dist/`.

---

## Conclusion

The project has a solid, well-tested foundation. The architectural transition from a browser-calling PWA to a secure, zero-secret native Android app requires clear separation of concerns across the planned implementation tracks: Serverless Backend (`/api/analyze`), Native Android & Capacitor Plugins, Client Optimization & Offline Fonts, and Senior UI Flow ("أدويتي" & Confirmation Step).
