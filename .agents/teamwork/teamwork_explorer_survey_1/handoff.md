# Handoff Report: Survey for Requirement R1 (Native Camera Integration)

**Task**: Requirement R1 (Native Camera Integration) Survey  
**Author**: Explorer 1 (`teamwork_explorer_survey_1`)  
**Target Recipient**: Orchestrator / Implementer Agent  
**Date**: 2026-10-29  

---

## 1. Observation

1. **`src/components/CameraCapture.tsx`**:
   - Lines 10–11:
     ```tsx
     const cameraInputRef = useRef<HTMLInputElement>(null);
     const galleryInputRef = useRef<HTMLInputElement>(null);
     ```
   - Lines 25–44:
     ```tsx
     <input
       ref={cameraInputRef}
       type="file"
       accept="image/*"
       capture="environment"
       onChange={handleFileChange}
       className="hidden"
       id="camera-input"
       aria-label="التقاط صورة عبر الكاميرا"
     />

     <input
       ref={galleryInputRef}
       type="file"
       accept="image/*"
       onChange={handleFileChange}
       className="hidden"
       id="gallery-input"
       aria-label="اختيار صورة من ألبوم الصور"
     />
     ```
   - Lines 50 & 64: Buttons trigger click on the file inputs:
     Line 50: `onClick={() => cameraInputRef.current?.click()}` (Text: `📷 صوّر علبة الدواء الآن`)
     Line 64: `onClick={() => galleryInputRef.current?.click()}` (Text: `📁 أو اختر صورة من الألبوم`)
   - `@capacitor/camera` is not imported anywhere in `src/`.

2. **`package.json`**:
   - Dependencies list currently contains:
     `"@capacitor/android": "^8.5.3"`,
     `"@capacitor/cli": "^8.5.3"`,
     `"@capacitor/core": "^8.5.3"`.
   - `@capacitor/camera` is **not present** in `dependencies`.
   - Querying npm registry (`npm.cmd info @capacitor/camera version`) returned `8.2.6`, and `peerDependencies` requires `{"@capacitor/core": ">=8.0.0"}`.

3. **`android/app/src/main/AndroidManifest.xml`**:
   - Lines 40–44:
     ```xml
     <uses-permission android:name="android.permission.INTERNET" />
     <uses-permission android:name="android.permission.CAMERA" />
     <uses-feature android:name="android.hardware.camera" android:required="false" />
     <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
     <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
     ```
   - Both `android.permission.CAMERA` and `<uses-feature android:name="android.hardware.camera" android:required="false" />` are already declared.

4. **`capacitor.config.ts`**:
   - Contains clean baseline configuration: `appId: 'com.dalili.medicationguide'`, `appName: 'دليلي الدوائي'`, `webDir: 'dist'`, `server: { androidScheme: 'https' }`. No plugin conflicts.

5. **`android/` Project Sync Status**:
   - `android/capacitor.settings.gradle` currently only includes `:capacitor-android`.
   - `android/app/capacitor.build.gradle` has an empty `dependencies {}` block.
   - Running `npx.cmd cap sync android` executed cleanly in 1.38s:
     `√ Copying web assets from dist to android\app\src\main\assets\public in 58.01ms`
     `√ Updating Android plugins in 12.67ms`
     `[info] Sync finished in 1.379s`

6. **Test Suite (`npm.cmd test`)**:
   - Current status: **10 test files passed, 125 tests passed**.
   - `tests/accessibility.test.tsx` lines 51–55:
     ```tsx
     it('primary camera button specifies rear camera capture attribute and meets min touch height', () => {
       render(<CameraCapture onImageSelected={() => {}} />);
       const cameraInput = document.querySelector('input[capture="environment"]');
       expect(cameraInput).toBeInTheDocument();
       expect(cameraInput).toHaveAttribute('accept', 'image/*');
     ```
     This test explicitly asserts on `input[capture="environment"]`.

---

## 2. Logic Chain

1. From Observation 1, the client currently uses HTML `<input type="file" capture="environment">` for the camera button and `<input type="file">` for the gallery. This violates R1's requirement: *"Do NOT use an `<input type="file">` for the main button"*.
2. From Observation 2, `@capacitor/camera` must be installed at version `^8.2.6` so that native Capacitor camera APIs (`Camera.getPhoto`, `Camera.checkPermissions`, `Camera.requestPermissions`) become available.
3. From Observation 3, AndroidManifest.xml is already in full compliance with R1's manifest requirements (`android.permission.CAMERA` and `android.hardware.camera` with `android:required="false"`).
4. From Observation 5, running `npx.cmd cap sync android` after installing `@capacitor/camera` will automatically populate `:capacitor-camera` in `android/capacitor.settings.gradle` and `android/app/capacitor.build.gradle`.
5. For runtime permission handling (Requirement R1 item 4):
   - `Camera.checkPermissions()` and `Camera.requestPermissions({ permissions: ['camera'] })` must be invoked before `Camera.getPhoto({ source: CameraSource.Camera, direction: CameraDirection.Rear })`.
   - If permission is denied (`'denied'`), a clear Arabic message must inform the user rather than failing silently or mapping to a generic error.
   - If the user cancels the camera intent, the thrown cancelation error (`/cancelled|canceled/i`) must be swallowed gracefully without displaying an error message.
6. From Observation 6, when `<input type="file" capture="environment">` is removed, `tests/accessibility.test.tsx` line 53 will fail unless updated to assert that no `<input type="file">` is rendered for the camera and that the camera button invokes the native camera service. Furthermore, `@capacitor/camera` must be mocked in `src/test/setup.ts` to keep Vitest headless tests green.

---

## 3. Caveats

1. In automated headless Vitest testing (jsdom), native Android camera hardware and Capacitor plugins do not execute natively. A mock for `@capacitor/camera` in `src/test/setup.ts` is required.
2. When installing `@capacitor/camera` via `npm.cmd`, Windows sandbox policies may block network access unless `BypassSandbox: true` is set or the package is installed with appropriate network connectivity.
3. On devices running Android 13+ (API 33+), photo gallery access uses the Android Photo Picker which does not require legacy `READ_EXTERNAL_STORAGE`, whereas older devices rely on `READ_EXTERNAL_STORAGE` (already capped at `maxSdkVersion="32"` in the manifest).

---

## 4. Conclusion

The technical path to implement Requirement R1 is well-defined, low-risk, and requires no architectural overhauls:
1. **Dependencies**: Add `"@capacitor/camera": "^8.2.6"` to `package.json` and install.
2. **Native Camera Service**: Create `src/services/nativeCamera.ts` handling `CameraSource.Camera` (rear camera), `CameraSource.Photos` (gallery), runtime permission requests/checks, user cancelation suppression, and blob-to-File conversion.
3. **Refactor `CameraCapture.tsx`**: Remove `<input type="file" capture="environment">` and `cameraInputRef`. Connect the main button to `captureMedicationImage(CameraSource.Camera)` and the secondary button to `captureMedicationImage(CameraSource.Photos)`. Render accessible Arabic error banners upon permission denial.
4. **Android Sync**: Run `npx.cmd cap sync android` to generate the Gradle plugin binding.
5. **Testing**: Mock `@capacitor/camera` in `src/test/setup.ts`, update `tests/accessibility.test.tsx` to verify the absence of `<input type="file">` on the main button and verify native call dispatch, and verify all 125 tests pass.

Detailed findings and code snippets are available in `survey_camera.md`.

---

## 5. Verification Method

To verify the implementation of R1:
1. **Inspect Code**:
   - `src/components/CameraCapture.tsx`: Ensure no `<input type="file" capture="environment">` exists.
   - `android/app/src/main/AndroidManifest.xml`: Confirm `CAMERA` permission and `android.hardware.camera` feature (`required="false"`).
2. **Automated Unit & Accessibility Tests**:
   - Command: `npm.cmd test`
   - Invalidation condition: Any test failure or failure in `tests/accessibility.test.tsx`.
3. **Capacitor Android Sync**:
   - Command: `npx.cmd cap sync android`
   - Verification: `android/capacitor.settings.gradle` contains `include ':capacitor-camera'`.
   - Invalidation condition: `npx.cmd cap sync android` exits with non-zero exit code or fails Gradle project configuration.
