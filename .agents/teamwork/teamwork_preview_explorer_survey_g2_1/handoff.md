# Handoff Report: Survey of Codebase and Native Android Setup

**Milestone**: Survey Phase  
**Agent**: Explorer 1 (`teamwork_preview_explorer_survey_g2_1`)  
**Parent**: Orchestrator (`f4f724ac-fd8c-4c16-a91a-05f2f4a5cab4`)  
**Date**: 2026-10-28  

---

## 1. Observation

1. **`package.json` Dependencies and Scripts**:
   - Lines 15–22 of `package.json`:
     ```json
     "dependencies": {
       "@capacitor/android": "^8.5.3",
       "@capacitor/cli": "^8.5.3",
       "@capacitor/core": "^8.5.3",
       "lucide-react": "^0.468.0",
       "react": "^18.3.1",
       "react-dom": "^18.3.1"
     }
     ```
   - `@capacitor/camera`, `@capacitor-community/text-to-speech`, `@capacitor/haptics`, and `@capacitor/preferences` are not present in `package.json`.
   - Lines 6–14 of `package.json`: scripts list `dev`, `build`, `preview`, `test`, `test:watch`, `test:ui`, `test:coverage`. There is no `build:apk` script.

2. **Capacitor Configuration & Android Plugin Linking**:
   - `capacitor.config.ts` (lines 3–10):
     ```typescript
     const config: CapacitorConfig = {
       appId: 'com.dalili.medicationguide',
       appName: 'دليلي الدوائي',
       webDir: 'dist',
       server: {
         androidScheme: 'https'
       }
     };
     ```
   - `android/app/src/main/assets/capacitor.plugins.json`: Content is `[]`.
   - `android/app/capacitor.build.gradle`: Line 11–14 `dependencies {}` is empty.

3. **Android Manifest Orientation and Activity**:
   - `android/app/src/main/AndroidManifest.xml` (lines 12–19):
     ```xml
     <activity
         android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"
         android:name=".MainActivity"
         android:label="@string/title_activity_main"
         android:theme="@style/AppTheme.NoActionBarLaunch"
         android:launchMode="singleTask"
         android:exported="true">
     ```
   - Verbatim observation: `android:screenOrientation="portrait"` is absent from `<activity>`.

4. **Android Splash Screen, Theme Colors, and Icons**:
   - `android/app/src/main/res/values/ic_launcher_background.xml` (line 3): `<color name="ic_launcher_background">#FFFFFF</color>`.
   - `android/app/src/main/res/drawable/ic_launcher_background.xml` (line 8): `android:fillColor="#26A69A"`.
   - `android/app/src/main/res/values/styles.xml` (lines 7–9): References `@color/colorPrimary` and `@color/colorPrimaryDark`, but there is no `android/app/src/main/res/values/colors.xml` file.
   - `android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml`: Contains default Android robot vector.
   - `android/app/src/main/res/drawable/splash.png` and density folders contain default Capacitor splash screens.

5. **Build Scripts & Environment State**:
   - `scripts/` directory contains only `generate-icons.js`. No `scripts/build-apk.ps1` exists.
   - `java -version`: `openjdk version "17.0.21.0.2" 2026-10-22 LTS` located at `C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot\bin\javac.exe`.
   - `$env:ANDROID_HOME` and `$env:ANDROID_SDK_ROOT` are empty.
   - Running `./gradlew.bat -v` in `android/` failed with:
     ```
     java.lang.RuntimeException: Could not create parent directory for lock file C:\Users\PC\.gradle\wrapper\dists\gradle-8.14.3-all\10utluxaxniiv4wxiphsi49nj\gradle-8.14.3-all.zip.lck
     ```
     When running with local `$env:GRADLE_USER_HOME`, it threw `java.net.UnknownHostException: services.gradle.org` due to sandbox network restrictions.

6. **Web Fonts and Client API Key Storage in `src/`**:
   - `index.html` (lines 19–24): Loads Cairo & Tajawal from `https://fonts.googleapis.com`. `src/assets/fonts/` does not exist.
   - `src/services/apiKeyStorage.ts` (lines 1, 6–32): Manages `dalili_gemini_api_key_v1` in `localStorage`.
   - `src/components/ApiKeyModal.tsx`: Renders modal prompting user for Gemini API key.
   - `src/services/geminiVision.ts` (lines 71–73): Directly calls Google Gemini API via browser `fetch` using the client-stored API key.
   - `src/services/geminiParser.ts`: Uses legacy Arabic prompt instead of the updated English system instruction and schema defined in R5 of `ORIGINAL_REQUEST.md`.

7. **Test Suite & Build Verification**:
   - Command: `npm.cmd run test`
   - Result: 5 test files, 23 passed, duration ~9.41s.
   - Command: `npm.cmd run build`
   - Result: `tsc --noEmit && vite build` succeeded in 15.04s, generating `dist/` (`dist/index.html`, `dist/assets/index-DeEqV6QJ.css`, `dist/assets/index-Bw3GQUVH.js`).

---

## 2. Logic Chain

1. **Capacitor Plugin Requirements**:
   - *Observation 1 & 2*: `@capacitor/camera`, `@capacitor-community/text-to-speech`, `@capacitor/haptics`, and `@capacitor/preferences` are missing from `package.json`, and `capacitor.plugins.json` is `[]`.
   - *Inference*: The project cannot use native device camera, native TTS, haptics, or native preferences until these packages are installed via npm and synced into Android via `npx cap sync android`.

2. **Android Configuration Compliance**:
   - *Observation 3 & 4*: `AndroidManifest.xml` lacks `android:screenOrientation="portrait"`, `colors.xml` is missing, `ic_launcher_background` is `#FFFFFF`, and splash/icon assets are the stock Capacitor defaults.
   - *Inference*: To satisfy R2 (Custom Teal `#006D77` splash screen, modern high-contrast app icon, and locked portrait orientation), we must:
     a) Insert `android:screenOrientation="portrait"` into `<activity>` in `AndroidManifest.xml`.
     b) Create `res/values/colors.xml` defining Deep Teal `#006D77`, Slate, Amber, and splash colors.
     c) Update `ic_launcher_background.xml` and replace icons with the branded medical capsule icon.

3. **Release APK Build Infrastructure**:
   - *Observation 1 & 5*: `scripts/build-apk.ps1` and `package.json` script `"build:apk"` are absent. Building Gradle within the sandbox environment hits permission restrictions on `~/.gradle` and blocked downloads from `services.gradle.org`.
   - *Inference*: A dedicated PowerShell script `scripts/build-apk.ps1` must be provided. It must:
     a) Verify Java and Android SDK environment variables (`JAVA_HOME`, `ANDROID_HOME`).
     b) Set `$env:GRADLE_USER_HOME` safely.
     c) Execute the full build pipeline: `npm.cmd run build` -> `npx.cmd cap sync android` -> `gradlew assembleRelease` -> signing.
     d) Copy the output APK to a standard release directory (e.g. `release/dalili-medication-guide.apk`).

4. **Security, Zero-Secret Architecture & Code Removal**:
   - *Observation 6*: The current application stores `dalili_gemini_api_key_v1` in `localStorage` and calls the Gemini API directly from the browser.
   - *Inference*: To fulfill R1 (Zero-Secret Serverless Backend), `ApiKeyModal.tsx` and all client API key storage logic must be removed. A Vercel serverless function (`/api/analyze.ts`) must be created to handle Gemini API communication server-side, with rate limiting and strict R5 schema validation.

5. **Performance & Offline Assets**:
   - *Observation 6*: `index.html` loads Google Fonts remotely and `src/assets/fonts/` is missing.
   - *Inference*: To satisfy R3 (zero external runtime Google Font requests), Cairo font files must be bundled locally in `src/assets/fonts/cairo/`, declared via `@font-face` in `src/index.css`, and Google Fonts link tags removed from `index.html`.

---

## 3. Caveats

- **Sandbox Network & Android SDK**: The sandbox environment lacks an installed Android SDK (`ANDROID_HOME`) and restricts outbound network access to Gradle distribution servers (`services.gradle.org`). The APK build script must be designed to run cleanly on the user's host environment or CI environment where the Android SDK is configured.
- **Java 17 vs Java 21**: `app/capacitor.build.gradle` specifies `JavaVersion.VERSION_21`, while the host environment has Java 17.0.21. AGP 8.13 works on Java 17+, but compatibility between Gradle target bytecode and the installed JDK should be verified when assembling the APK.
- **PWA Service Worker vs Native App**: The existing PWA caching and web manifest will continue to operate for web previews, but Capacitor native plugins will take precedence when running inside the Android WebView.

---

## 4. Conclusion

The existing codebase is structurally sound, clean, and has all 23 unit/accessibility tests passing. However, native Android capabilities, zero-secret serverless backend, Cairo local font bundling, image compression/hashing, and elderly UI workflows ("أدويتي" and confirmation screen) are not yet implemented.

### Actionable Implementation Roadmap:
1. **Track 1: Serverless Backend (`/api/analyze`)**:
   - Create `api/analyze.ts` with Vercel serverless handler, strict R5 prompt and schema, IP rate-limiting, and error handling.
   - Add automated test suite for the serverless handler.
2. **Track 2: Security & Client Cleanup**:
   - Delete `src/components/ApiKeyModal.tsx`.
   - Remove client API key storage functions from `apiKeyStorage.ts`.
   - Update `src/services/geminiVision.ts` to call `/api/analyze`.
   - Run automated secret scan grep to guarantee zero secrets in client code and `dist/`.
3. **Track 3: Native Android & Capacitor Plugins**:
   - Install `@capacitor/camera`, `@capacitor-community/text-to-speech`, `@capacitor/haptics`, `@capacitor/preferences`.
   - Run `npx.cmd cap sync android`.
   - Lock orientation to portrait in `AndroidManifest.xml`.
   - Add `colors.xml`, set splash background to Deep Teal `#006D77`, and update launcher icons.
   - Create `scripts/build-apk.ps1` and add `"build:apk"` to `package.json`.
4. **Track 4: Offline Assets, Image Pipeline & Elderly Features**:
   - Bundle local Cairo fonts in `src/assets/fonts/cairo/` and remove Google Fonts CDN links.
   - Implement client-side image compression (max 1024px, JPEG 0.7) and image hash caching.
   - Implement First-Launch 3-point Onboarding modal.
   - Implement Medicine Confirmation Step.
   - Implement "أدويتي" (My Medicines) local shelf with delete confirmation.

---

## 5. Verification Method

To independently verify all findings in this report:
1. **Dependencies and Plugin State**:
   - Inspect `package.json` and verify missing plugins:
     `npm.cmd list @capacitor/camera @capacitor-community/text-to-speech @capacitor/haptics @capacitor/preferences`
   - Inspect `android/app/src/main/assets/capacitor.plugins.json` (should be `[]`).
2. **Android Project Configuration**:
   - Inspect `android/app/src/main/AndroidManifest.xml` line 13 to verify `android:screenOrientation="portrait"` is missing.
   - Inspect `android/app/src/main/res/values/ic_launcher_background.xml` (value is `#FFFFFF`).
3. **Existing Tests and Production Build**:
   - Run: `npm.cmd run test` (must pass 23/23 tests).
   - Run: `npm.cmd run build` (must pass with 0 errors).
4. **Client API Key Presence**:
   - Run: `grep -rn "API_KEY_STORAGE_KEY" src/` (verifies presence of client storage key).
