# Milestone 2 Implementation Report: Native Camera Integration & Android Setup (Requirement R1)

**Worker**: `teamwork_worker_m2_1`  
**Date**: 2026-10-29  
**Target Requirement**: R1 (Bug 1: Native Camera Integration & Android Setup)

---

## 1. Executive Summary

Requirement R1 addresses Bug 1 in the Dalili Medication Guide mobile application:
1. Replaced the legacy `<input type="file">` HTML elements in `src/components/CameraCapture.tsx` with genuine native Capacitor Camera integrations.
2. The primary capture button ("صوّر علبة الدواء الآن") directly invokes `@capacitor/camera` with `CameraSource.Camera` using the rear camera (`CameraDirection.Rear`) and `CameraResultType.Base64`.
3. The photo gallery picker is isolated into a dedicated secondary button invoking `CameraSource.Photos` via `pickPhoto()`.
4. Runtime permission verification and requesting are handled gracefully (`checkAndRequestCameraPermissions` / `checkAndRequestPhotosPermissions`) with polite Arabic guidance alerts on denial.
5. User cancelations (dismissing camera or picker without taking/selecting a photo) are intercepted and resolved cleanly without crashes or erroneous alert messages.
6. `android/app/src/main/AndroidManifest.xml` has been verified to declare `android.permission.CAMERA` and `<uses-feature android:name="android.hardware.camera" android:required="false" />`.
7. `npx cap sync android` successfully auto-linked `@capacitor/camera@8.2.6` into Android Gradle configuration (`android/capacitor.settings.gradle` and `android/app/capacitor.build.gradle`).
8. The full Vitest test suite (`npm.cmd test`) passed with 182/182 tests across 12 test files, and `tsc --noEmit && vite build` built cleanly in production mode.

---

## 2. Changes Made by File

### 2.1 `package.json`
- Added `"@capacitor/camera": "^8.2.6"` to dependencies matching `@capacitor/core: ^8.5.3`.

### 2.2 `src/services/nativeCamera.ts` (New File)
Created a comprehensive native camera service conforming to interface contracts:
- **`capturePhoto(): Promise<NativePhotoFile | null>`**:
  - Checks and requests runtime camera permissions (`Camera.checkPermissions()`, `Camera.requestPermissions({ permissions: ['camera'] })`).
  - Calls `Camera.getPhoto` configured with:
    - `source: CameraSource.Camera`
    - `direction: CameraDirection.Rear`
    - `resultType: CameraResultType.Base64`
    - `quality: 90`
    - `correctOrientation: true`
    - `saveToGallery: false`
  - Converts base64 output into a standard `File` object while attaching `base64Data`, `format: 'jpeg'`, `width`, and `height`.
  - Gracefully returns `null` on user cancelation (`/cancelled|canceled|no image picked|user cancelled/i`).
  - Throws `CameraPermissionDeniedError` with friendly Arabic message if permission is denied.
- **`pickPhoto(): Promise<NativePhotoFile | null>`**:
  - Checks and requests runtime photos permissions (`CameraSource.Photos`).
  - Converts photo gallery selection into `File` with attached base64 metadata.
  - Gracefully handles user cancelation without errors.
- **`captureFromCamera(): Promise<CaptureResult | null>` & `pickFromGallery(): Promise<CaptureResult | null>`**:
  - Implements the contract defined in `SCOPE.md` returning `{ base64Data, format: 'jpeg', width, height, file }`.
- **`checkAndRequestCameraPermissions(): Promise<boolean>` & `checkAndRequestPhotosPermissions(): Promise<boolean>`**:
  - Provides reusable runtime permission helpers.

### 2.3 `src/components/CameraCapture.tsx`
- **Completely removed** all `<input type="file">` and `<input capture="environment">` elements.
- Wired the primary button ("📷 صوّر علبة الدواء الآن") to `capturePhoto()`.
- Wired the secondary button ("📁 أو اختر صورة من الألبوم") to `pickPhoto()`.
- Added stateful error handling: displays an accessible Arabic alert (`role="alert"`, `aria-live="polite"`) when permissions are denied or hardware errors occur, with a dismiss action.
- Maintained large senior-friendly touch targets (`min-h-[76px]` primary, `min-h-[64px]` secondary).

### 2.4 `src/test/setup.ts`
- Added Vitest mock for `@capacitor/camera`:
  - `Camera.checkPermissions`
  - `Camera.requestPermissions`
  - `Camera.getPhoto`
  - `Camera.pickImages`
  - `CameraSource`, `CameraResultType`, `CameraDirection`
- Mocked `window.alert` to avoid jsdom "Not implemented: window.alert" errors.

### 2.5 `tests/accessibility.test.tsx`
- Replaced outdated assertion on `input[capture="environment"]` with:
  1. Verification that no `<input type="file">` is rendered for camera or gallery.
  2. Verification that primary button triggers native camera (`CameraSource.Camera`, `CameraDirection.Rear`).
  3. Verification that secondary button triggers native gallery (`CameraSource.Photos`).
  4. Verification of runtime permission denial with accessible Arabic alert banner.
  5. Verification that user cancelation does not trigger errors or alerts.
  6. Verification of button disabled states and touch targets.

### 2.6 `android/app/src/main/AndroidManifest.xml`
- Verified:
  - `<uses-permission android:name="android.permission.CAMERA" />` (Line 41)
  - `<uses-feature android:name="android.hardware.camera" android:required="false" />` (Line 42)
  - Both declarations conform to Google Play store compatibility guidelines.

---

## 3. Verification Commands & Results

1. **Capacitor Android Sync**:
   ```powershell
   npx.cmd cap sync android
   ```
   **Output**:
   ```
   √ Copying web assets from dist to android\app\src\main\assets\public in 46.51ms
   √ Creating capacitor.config.json in android\app\src\main\assets in 3.02ms
   √ copy android in 142.20ms
   √ Updating Android plugins in 26.51ms
   [info] Found 1 Capacitor plugin for android:
          @capacitor/camera@8.2.6
   √ update android in 232.41ms
   [info] Sync finished in 0.527s
   ```
   - `android/capacitor.settings.gradle`:
     ```groovy
     include ':capacitor-camera'
     project(':capacitor-camera').projectDir = new File('../node_modules/@capacitor/camera/android')
     ```
   - `android/app/capacitor.build.gradle`:
     ```groovy
     dependencies {
         implementation project(':capacitor-camera')
     }
     ```

2. **TypeScript & Production Build**:
   ```powershell
   npm.cmd run build
   ```
   **Output**:
   ```
   > dalili-medication-guide@1.0.0 build
   > tsc --noEmit && vite build
   ✓ 1597 modules transformed.
   ✓ built in 13.14s
   ```

3. **Vitest Unit & Integration Test Suite**:
   ```powershell
   npm.cmd test
   ```
   **Output**:
   ```
   Test Files  12 passed (12)
        Tests  182 passed (182)
     Duration  9.68s
   ```
   All 12 test suites and 182 tests passed with 0 failures.
