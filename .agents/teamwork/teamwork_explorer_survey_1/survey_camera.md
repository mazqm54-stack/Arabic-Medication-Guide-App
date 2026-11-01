# Survey Report: Requirement R1 (Native Camera Integration)

**Date**: 2026-10-29  
**Investigator**: Explorer 1 (`teamwork_explorer_survey_1`)  
**Workspace**: `c:\Users\PC\Documents\antigravity\fervent-mendel`  
**Target Requirement**: R1 (Native Camera Integration - Bug 1)

---

## 1. Executive Summary

Requirement R1 mandates:
1. The primary button ("صوّر علبة الدواء الآن") must use native `@capacitor/camera` with `CameraSource.Camera` (rear camera), without using an `<input type="file">`.
2. The photo gallery must be a separate secondary button using `CameraSource.Photos`.
3. `android/app/src/main/AndroidManifest.xml` must declare `android.permission.CAMERA` and `android.hardware.camera` with `android:required="false"`.
4. Capacitor Camera permissions must be requested and handled at runtime with graceful fallback in Arabic.
5. `npx cap sync android` must execute cleanly.

### Key Survey Conclusions:
- **Client Code**: `src/components/CameraCapture.tsx` currently relies entirely on two hidden `<input type="file">` elements (one with `capture="environment"` and one for gallery). `@capacitor/camera` is not installed or imported anywhere.
- **Package Dependency**: `@capacitor/camera` (`^8.2.6`) needs to be added to `package.json` to match the installed `@capacitor/core: 8.5.3`.
- **AndroidManifest.xml**: Both `android.permission.CAMERA` and `<uses-feature android:name="android.hardware.camera" android:required="false" />` are **already declared** at lines 41–42.
- **Runtime Permissions**: Need explicit checks via `Camera.checkPermissions()` and `Camera.requestPermissions({ permissions: ['camera'] })` with senior-friendly Arabic alerts upon denial and graceful handling of cancelation.
- **Android Sync**: `npx.cmd cap sync android` runs successfully (1.38s). Once `@capacitor/camera` is installed, Capacitor CLI will auto-link `:capacitor-camera` into `capacitor.settings.gradle` and `capacitor.build.gradle`.
- **Existing Tests**: All 125 existing tests pass (`npm.cmd test`). However, `tests/accessibility.test.tsx` line 53 expects `input[capture="environment"]`, which must be updated when that input is replaced with the native camera call. `@capacitor/camera` must also be mocked in `src/test/setup.ts`.

---

## 2. Objective 1: Client Codebase in `src/` Analysis

### 2.1 Current Implementation in `src/components/CameraCapture.tsx`

The component currently renders:
```tsx
// File: src/components/CameraCapture.tsx (lines 10-44)
const cameraInputRef = useRef<HTMLInputElement>(null);
const galleryInputRef = useRef<HTMLInputElement>(null);

const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    onImageSelected(file);
    e.target.value = '';
  }
};

return (
  <div className="w-full space-y-4 my-6">
    {/* Hidden file inputs */}
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
...
```

The buttons (lines 47–70) trigger `.click()` on the HTML input elements:
- Line 50: `onClick={() => cameraInputRef.current?.click()}`
  - Main button text: `📷 صوّر علبة الدواء الآن`
- Line 64: `onClick={() => galleryInputRef.current?.click()}`
  - Secondary button text: `📁 أو اختر صورة من الألبوم`

### 2.2 Problems with Current Implementation
1. `<input type="file" capture="environment">` delegates capture to Android's web intent dispatcher, which frequently presents an OS application selection sheet (Documents, Google Drive, Files, Camera) or fails in certain WebView versions instead of directly launching the native rear camera.
2. Requirement R1 strictly forbids `<input type="file">` for the main button:
   > *"Do NOT use an `<input type="file">` for the main button."*

### 2.3 Proposed Native Implementation (`src/services/nativeCamera.ts` & `src/components/CameraCapture.tsx`)

A native camera helper service (`src/services/nativeCamera.ts`) should encapsulate Capacitor Camera calls, permission negotiation, and file conversion:

```typescript
import { Camera, CameraSource, CameraResultType, CameraDirection } from '@capacitor/camera';

export interface CameraCaptureResult {
  file: File;
  dataUrl?: string;
}

/**
 * Native camera capture service with runtime permission verification.
 * @param source CameraSource.Camera for rear camera, CameraSource.Photos for gallery.
 */
export async function captureMedicationImage(
  source: CameraSource = CameraSource.Camera
): Promise<File | null> {
  // 1. Verify / Request runtime permissions
  const permissions = await Camera.checkPermissions();

  if (source === CameraSource.Camera) {
    if (permissions.camera !== 'granted') {
      const requestResult = await Camera.requestPermissions({ permissions: ['camera'] });
      if (requestResult.camera !== 'granted') {
        throw new Error('PERMISSION_DENIED');
      }
    }
  } else if (source === CameraSource.Photos) {
    if (permissions.photos !== 'granted') {
      const requestResult = await Camera.requestPermissions({ permissions: ['photos'] });
      if (requestResult.photos !== 'granted') {
        throw new Error('PERMISSION_DENIED');
      }
    }
  }

  // 2. Launch Capacitor Camera / Gallery
  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: source,
      direction: CameraDirection.Rear, // Forces rear camera
      correctOrientation: true,
      saveToGallery: false,
    });

    if (!photo.webPath) {
      return null;
    }

    // Convert webPath into File object for downstream pipeline
    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    const extension = photo.format || 'jpeg';
    const mimeType = blob.type || `image/${extension}`;
    const filename = `medication_${Date.now()}.${extension}`;

    return new File([blob], filename, { type: mimeType });
  } catch (err: any) {
    // Gracefully ignore user cancellation without showing error
    const message = err?.message || String(err);
    if (/cancelled|canceled|no image picked|user cancelled/i.test(message)) {
      return null;
    }
    throw err;
  }
}
```

### 2.4 Refactoring `CameraCapture.tsx`
- **Eliminate** `<input ref={cameraInputRef} type="file" ... />` completely.
- Connect main button directly to `captureMedicationImage(CameraSource.Camera)`.
- Connect secondary button directly to `captureMedicationImage(CameraSource.Photos)`.
- Handle runtime errors (permission denial, hardware error) and display an accessible, clear Arabic message:
  - If permission denied: `"تم رفض إذن الكاميرا. يرجى تفعيل إذن استخدام الكاميرا من إعدادات الهاتف لتصوير علبة الدواء."`
  - If general error: `"تعذر فتح الكاميرا حالياً. يمكنك تجربة اختيار صورة من الألبوم."`

---

## 3. Objective 2: AndroidManifest.xml Analysis

File location: `android/app/src/main/AndroidManifest.xml`

### 3.1 Permissions & Features Check (Lines 38–45)
```xml
    <!-- Permissions -->

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

### 3.2 Evaluation Against R1:
- `android.permission.CAMERA` is **present** (Line 41).
- `<uses-feature android:name="android.hardware.camera" android:required="false" />` is **present** (Line 42).
- `READ_EXTERNAL_STORAGE` (API <= 32) and `READ_MEDIA_IMAGES` (API 33+) are **present** (Lines 43-44).
- Optional enhancement: Add `<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />` to maximize Google Play compatibility across low-end devices without autofocus hardware.

Conclusion: `AndroidManifest.xml` **already satisfies** all permission and hardware feature declarations required by R1.

---

## 4. Objective 3: Capacitor Camera Runtime Permissions & Error Handling

### 4.1 Capacitor Permission Flow
Capacitor 8 Camera API defines:
- `Camera.checkPermissions()`: Returns `{ camera: PermissionState, photos: PermissionState }`.
  - Values: `'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'`.
- `Camera.requestPermissions({ permissions: ['camera' | 'photos'] })`: Triggers Android runtime permission dialog (`ActivityCompat.requestPermissions`).
  - If user selects "Allow" / "While using the app" -> status becomes `'granted'`.
  - If user selects "Don't allow" -> status becomes `'denied'`.
  - On repeated denials or "Don't ask again", subsequent calls return `'denied'` immediately without showing a dialog.

### 4.2 Graceful Degradation Strategy
1. **Permission Denied**:
   - The UI should not crash or hang.
   - Set an error state in `CameraCapture` or pass error to parent.
   - Display a dismissible Arabic guidance message:
     `"تم رفض إذن الكاميرا. يرجى السماح للتطبيق باستخدام الكاميرا من إعدادات الهاتف لتتمكن من تصوير علبة الدواء، أو يمكنك اختيار صورة من الألبوم."`
   - Keep the secondary "📁 أو اختر صورة من الألبوم" button active so the senior user can proceed without frustration.
2. **User Cancelled**:
   - If the user opens the camera or gallery and presses Android back button or cancels, Capacitor rejects with `"User cancelled photos app"`.
   - The catch block must filter out `/cancelled|canceled/i` and exit cleanly without displaying an error alert.

---

## 5. Objective 4: capacitor.config.ts & Android Project Sync Status

### 5.1 Verification of `capacitor.config.ts`
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
No custom plugin overrides are strictly required in `capacitor.config.ts` for `@capacitor/camera`.

### 5.2 Dependency & Gradle Sync Status
- `@capacitor/camera` is not yet listed in `package.json`.
- Tested installing version: `@capacitor/camera@^8.2.6` (peer dependency `@capacitor/core: >=8.0.0`, matching installed `@capacitor/core: 8.5.3`).
- Tested `npx.cmd cap sync android`:
  - Verified working synchronously. Copies web assets and updates Android plugins in 1.38s.
  - When `@capacitor/camera` is installed, `npx.cmd cap sync android` will automatically add:
    - `include ':capacitor-camera'` in `android/capacitor.settings.gradle`
    - `implementation project(':capacitor-camera')` in `android/app/capacitor.build.gradle`

---

## 6. Test Suite & Regression Safeguards

### 6.1 Test Status
- Current test execution (`npm.cmd test`): **10 files, 125 tests passed**.
- Affected test file: `tests/accessibility.test.tsx`
  - Lines 51–61 currently assert:
    ```typescript
    it('primary camera button specifies rear camera capture attribute and meets min touch height', () => {
      render(<CameraCapture onImageSelected={() => {}} />);
      const cameraInput = document.querySelector('input[capture="environment"]');
      expect(cameraInput).toBeInTheDocument();
      expect(cameraInput).toHaveAttribute('accept', 'image/*');
      ...
    ```
  - When `<input type="file" capture="environment">` is removed, this test will fail unless updated.
  - Test should be updated to verify:
    1. No `<input type="file" capture="environment">` exists for the main button (`expect(document.querySelector('input[capture="environment"]')).toBeNull()`).
    2. Primary camera button exists with text matching "صوّر علبة الدواء الآن" and satisfies senior touch target.
    3. Clicking the camera button invokes `Camera.getPhoto` with `{ source: 'CAMERA', direction: 'REAR' }`.
    4. Clicking the gallery button invokes `Camera.getPhoto` with `{ source: 'PHOTOS' }`.

### 6.2 Test Setup Mock (`src/test/setup.ts`)
To prevent Vitest jsdom errors when `@capacitor/camera` is imported, add a mock in `src/test/setup.ts`:
```typescript
vi.mock('@capacitor/camera', () => ({
  Camera: {
    checkPermissions: vi.fn().mockResolvedValue({ camera: 'granted', photos: 'granted' }),
    requestPermissions: vi.fn().mockResolvedValue({ camera: 'granted', photos: 'granted' }),
    getPhoto: vi.fn().mockResolvedValue({
      webPath: 'blob:mock-camera-photo',
      format: 'jpeg',
    }),
  },
  CameraSource: {
    Camera: 'CAMERA',
    Photos: 'PHOTOS',
    Prompt: 'PROMPT',
  },
  CameraResultType: {
    Uri: 'uri',
    Base64: 'base64',
    DataUrl: 'dataUrl',
  },
  CameraDirection: {
    Rear: 'REAR',
    Front: 'FRONT',
  },
}));
```

---

## 7. Actionable Implementation Plan for Implementer

1. **Install Package**:
   `npm.cmd install @capacitor/camera@^8.2.6` (run with elevated/sandbox-bypass permissions if connecting to npm registry).
2. **Add Native Camera Service**:
   Create `src/services/nativeCamera.ts` implementing `captureMedicationImage(source)`.
3. **Refactor `src/components/CameraCapture.tsx`**:
   - Remove `<input ref={cameraInputRef} ... />` (no `<input type="file">` for main button).
   - Wire main button to `CameraSource.Camera` (rear camera).
   - Wire secondary button to `CameraSource.Photos`.
   - Add state for permission/camera error alert in Arabic.
4. **Update Test Setup & Tests**:
   - Add `@capacitor/camera` mock in `src/test/setup.ts`.
   - Update `tests/accessibility.test.tsx` to assert no `<input type="file">` for the camera button and check native invocation.
   - Run `npm.cmd test` to ensure all 125+ tests pass.
5. **Sync Android Project**:
   Run `npx.cmd cap sync android`.
   Verify `android/capacitor.settings.gradle` and `android/app/capacitor.build.gradle` have `:capacitor-camera`.
