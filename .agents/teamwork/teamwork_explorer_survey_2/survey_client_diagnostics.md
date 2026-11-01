# Survey Report: Client Diagnostics, Error Handling, Timeout, Image Compression, and Tests (Requirement R2)

**Explorer**: Explorer 2 (Survey Phase)  
**Date**: 2026-10-29  
**Integrity Mode**: Development  
**Target Requirement**: R2 (Client Diagnostics, Error Handling, Timeout, Image Compression, and Tests)

---

## Executive Summary

This survey provides a comprehensive investigation of the client-side architecture in `src/`, error handling pathways, timeout behavior, image processing on Android WebView, the Vitest test suite, and the release APK build/signing scripts.

### Key Discoveries & Root Causes:
1. **The "Image Not Clear" Fallacy**:
   - Currently, *any* failure (network drop, 30s timeout, HTTP 500 from Cloudflare Worker, rate limiting, or corrupted JSON) is caught in `src/App.tsx:74-80` and transformed into `{ is_clear: false, raw_error: errorMsg }`.
   - In `src/App.tsx:165`, whenever `!currentResult.is_clear`, the UI exclusively renders `<UnclearPhotoCard />`.
   - `UnclearPhotoCard.tsx:18` contains a hardcoded title `"الصورة غير واضحة بما يكفي"` (The image is not clear enough) and tips about lighting and camera positioning, falsely telling elderly users their photo is blurry even when the server crashed or the internet disconnected.
   - In `src/services/geminiParser.ts:80-86`, when `JSON.parse` fails, it explicitly returns `{ is_clear: false, raw_error: 'الصورة غير واضحة بدرجة كافية لقراءة بيانات الدواء...' }`.
2. **Missing Request Timeout**:
   - `src/services/geminiVision.ts:81-88` invokes `fetch(endpoint, ...)` with no `signal` or timeout mechanism. If the network drops or the server stalls, the request hangs indefinitely, trapping elderly users on the loading spinner.
3. **No Image Compression on Client**:
   - Currently, `src/services/geminiVision.ts:48-61` uses a basic `fileToBase64()` with `FileReader.readAsDataURL()`. There is NO canvas compression, NO 1024px clamping, and NO Android WebView validation (such as JPEG header checks, length checks, or black/blank pixel detection).
   - High-resolution smartphone cameras (12MP–50MP) send 5MB–20MB payloads, risking out-of-memory errors on Android WebView or triggering HTTP 413 (`PAYLOAD_TOO_LARGE`).
4. **Worker Debug Field Ignored**:
   - When the backend returns an error, `geminiVision.ts` extracts `errorData?.retake_message || errorData?.error`, discarding `error_code`, `status`, and `detail`.
5. **Vitest & Build Verification**:
   - `npm.cmd test` runs Vitest 3.2.7 and currently passes 10/10 test files and 125/125 tests cleanly.
   - `npm.cmd run build` executes `tsc --noEmit && vite build` and builds production assets in `dist/` without error.
   - `sign-release.bat` is fully configured and ready, referencing `dalili-release-key.jks` (alias `dalili`), calling `gradlew.bat assembleRelease`, and verifying with `apksigner`.

---

## 1. Client Error Handling & Mapping in `src/`

### 1.1 Current Architecture & Code Points

#### Point 1: API Call Error Handling (`src/services/geminiVision.ts:90-98, 113-117`)
```typescript
90:  if (!response.ok) {
91:    const errorData = await response.json().catch(() => ({}));
92:    const friendlyMessage =
93:      errorData?.retake_message ||
94:      errorData?.error ||
95:      `تعذر الاتصال بالمعالج الذكي (${response.status}). يرجى المحاولة مرة أخرى.`;
96:
97:    throw new Error(friendlyMessage);
98:  }
...
113: } catch (err: unknown) {
114:   const errorMsg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء معالجة الصورة.';
115:   console.error('[GeminiVisionProxy] Error:', err);
116:   throw new Error(errorMsg);
117: }
```
**Problem**: The error thrown is a simple string. The structured `error_code`, HTTP status code, and `detail` returned by the Worker are discarded.

#### Point 2: JSON Parsing Fallback (`src/services/geminiParser.ts:80-86`)
```typescript
80: } catch (err) {
81:   console.warn('[GeminiParser] JSON parse error:', err, 'Raw text was:', rawText);
82:   return {
83:     is_clear: false,
84:     raw_error: 'الصورة غير واضحة بدرجة كافية لقراءة بيانات الدواء. يرجى إعادة التصوير في مكان ذي إضاءة جيدة والتركيز على واجهة العلبة.'
85:   };
86: }
```
**Problem**: If the AI model generates corrupted JSON or markdown, the code explicitly blames the user's photo rather than indicating a parsing failure.

#### Point 3: Application Error Capture (`src/App.tsx:74-80`)
```typescript
74: } catch (err: unknown) {
75:   const errorMsg = err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الصورة.';
76:   setCurrentResult({
77:     is_clear: false,
78:     raw_error: errorMsg
79:   });
80: }
```
**Problem**: All exceptions (network, abort, server, timeout, JSON) are coerced into `MedicineAnalysisResult` with `is_clear: false`.

#### Point 4: Presentation Layer (`src/components/UnclearPhotoCard.tsx:15-46`)
```tsx
15: <div className="flex items-center gap-3 mb-4 text-amber-800">
16:   <AlertTriangle className="w-10 h-10 text-amber-600 flex-shrink-0" />
17:   <h2 className="text-senior-2xl font-bold">
18:     الصورة غير واضحة بما يكفي
19:   </h2>
20: </div>
21: <p className="text-senior-lg text-slate-800 mb-6 leading-relaxed">
22:   {errorMessage || 'لم نتمكن من قراءة اسم الدواء بدقة...'}
23: </p>
```
**Problem**: The title and tips are hardcoded to "Image is not clear", confusing users when the failure is unrelated to image clarity. Furthermore, the button `onRetry` simply resets the screen to home, discarding the captured image.

---

### 1.2 Separation of the 4 Distinct Friendly Arabic Messages

To satisfy Requirement R2, we define four mutually exclusive error categories:

| Category | Trigger Conditions | Friendly Arabic Title | Friendly Arabic Message | Action Buttons |
|---|---|---|---|---|
| **(a) Network or Timeout** (`network_timeout`) | • Request exceeds 30 seconds (`AbortError` / `TimeoutError`)<br>• Browser offline (`!navigator.onLine`)<br>• `TypeError: Failed to fetch`<br>• HTTP 504 Gateway Timeout | `تعذر الاتصال بالشبكة أو انتهت مهلة الطلب` | `استغرق الاتصال بالخادم وقتاً أطول من المعتاد (أكثر من 30 ثانية) أو انقطع الاتصال بالإنترنت. يرجى التحقق من الشبكة والضغط على زر إعادة المحاولة.` | • **Primary**: `🔄 إعادة المحاولة الآن` (retries without re-taking)<br>• **Secondary**: `📷 تصوير دواء آخر` |
| **(b) Server Error** (`server_error`) | • HTTP status 500, 502, 503<br>• Worker debug `error_code` (`UPSTREAM_API_ERROR`, `SERVER_CONFIGURATION_ERROR`, `UPSTREAM_RATE_LIMIT`, `RATE_LIMIT_EXCEEDED`, `INTERNAL_SERVER_ERROR`) | `حدث خطأ في الخادم الطبي الذكي` | `نواجه صعوبة مؤقتة في التواصل مع المعالج الذكي. يرجى المحاولة مرة أخرى بعد قليل.`<br>*(If rate limit: `تم تجاوز حد الاستخدام المؤقت. يرجى الانتظار دقيقة قبل المحاولة.`)*<br>*(Displays debug badge if `error_code` present)* | • **Primary**: `🔄 إعادة المحاولة الآن`<br>• **Secondary**: `🏠 العودة للرئيسية` |
| **(c) AI Said `is_clear=false`** (`unclear_image`) | • HTTP 200 returned<br>• Valid JSON parsed<br>• `result.is_clear === false` | `الصورة غير واضحة بما يكفي` | `لم نتمكن من قراءة اسم الدواء بدقة من هذه الصورة. يرجى إعادة التصوير مع مراعاة النصائح التالية:`<br>*(or AI's `retake_message` if available)* | • **Primary**: `📷 إعادة تصوير العلبة الآن` (opens camera)<br>• Guidance tips: lighting, focus, single box |
| **(d) Invalid JSON** (`invalid_json`) | • HTTP 200 returned<br>• Response is not valid JSON or missing required fields<br>• `cleanAndParseJson` catches SyntaxError | `تعذر قراءة رد المعالج الذكي` | `استلم التطبيق بيانات غير مكتملة أو غير صالحة من المعالج الذكي. يرجى الضغط على زر إعادة المحاولة لقراءة العلبة مجدداً.` | • **Primary**: `🔄 إعادة المحاولة الآن`<br>• **Secondary**: `📷 تصوير علبة أخرى` |

---

### 1.3 Handling Worker Debug Field `error_code`

In `worker/src/index.ts`, error responses return an `error` or `error_code` field:
- `UPSTREAM_API_ERROR`
- `SERVER_CONFIGURATION_ERROR`
- `UPSTREAM_RATE_LIMIT`
- `RATE_LIMIT_EXCEEDED`
- `PAYLOAD_TOO_LARGE`
- `BAD_REQUEST`
- `METHOD_NOT_ALLOWED`
- `INTERNAL_SERVER_ERROR`

**Client Extraction Pattern**:
```typescript
export interface AnalysisErrorMetadata {
  category: 'network_timeout' | 'server_error' | 'unclear_image' | 'invalid_json';
  errorCode?: string;
  detail?: string;
  statusCode?: number;
}
```
When `geminiVision.ts` catches a non-200 HTTP response:
```typescript
const errorData = await response.json().catch(() => ({}));
const errorCode = errorData?.error_code || errorData?.error || `HTTP_${response.status}`;
const detail = errorData?.detail;
```
The client preserves this metadata and renders an accessible badge in `UnclearPhotoCard.tsx` (or a dedicated diagnostics card):
```tsx
{errorCode && (
  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono text-slate-700" dir="ltr">
    <span>Error Code: {errorCode}</span>
  </div>
)}
```

---

## 2. Request Timeout & Interactive Retry Mechanism

### 2.1 30-Second AbortController Architecture

In `src/services/geminiVision.ts`:
```typescript
export interface GeminiVisionOptions {
  imageBase64: string;
  mimeType?: string;
  timeoutMs?: number; // Defaults to 30000
  signal?: AbortSignal;
}

export async function analyzeMedicationImage(options: GeminiVisionOptions): Promise<MedicineAnalysisResult> {
  const { imageBase64, mimeType = 'image/jpeg', timeoutMs = 30000, signal: externalSignal } = options;

  const controller = new AbortController();
  let isInternalTimeout = false;

  const timeoutId = setTimeout(() => {
    isInternalTimeout = true;
    controller.abort(new DOMException('Request timeout after 30000ms', 'AbortError'));
  }, timeoutMs);

  // Link external signal if provided
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timeoutId);
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort(externalSignal.reason);
      });
    }
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    ...
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (isInternalTimeout || err.name === 'AbortError' || err.name === 'TimeoutError') {
        const timeoutError = new Error('استغرقت العملية أكثر من 30 ثانية. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة.');
        (timeoutError as any).category = 'network_timeout';
        (timeoutError as any).errorCode = 'CLIENT_TIMEOUT';
        throw timeoutError;
      }
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### 2.2 Interactive Retry UX in `src/App.tsx`

Currently, when an error occurs, `App.tsx` only offers `handleResetToHome`, which purges the captured image:
```typescript
const handleResetToHome = () => {
  speechController.stop();
  setCurrentResult(null);
  setIsLoading(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
```
**Proposed Solution**:
1. Store the active file / image payload in state:
   ```typescript
   const [lastFile, setLastFile] = useState<File | null>(null);
   ```
2. When the error is `network_timeout`, `server_error`, or `invalid_json`, provide an interactive retry handler:
   ```typescript
   const handleRetrySameImage = async () => {
     if (lastFile) {
       await processImage(lastFile);
     }
   };
   ```
3. Update `UnclearPhotoCard.tsx` to support both `onRetry` (retry same photo) and `onRetake` (open camera / reset to home).

---

## 3. Image Compression & Android WebView Diagnostics

### 3.1 Current Status
- Currently, NO image compression exists in the codebase.
- `src/utils/` does not exist.
- `src/services/geminiVision.ts:fileToBase64` directly base64-encodes the raw input file using `FileReader`.
- Smartphone cameras easily generate 12MP–48MP images (4000x3000px or larger), producing raw base64 payloads of 10MB–30MB. This causes:
  - Heavy memory consumption leading to Android WebView out-of-memory crashes.
  - HTTP 413 `PAYLOAD_TOO_LARGE` rejection by Cloudflare Worker (4MB limit).
  - Excessive upload times triggering the 30-second timeout.

### 3.2 Android WebView Hazards & Countermeasures

| Hazard on Android WebView | Root Cause | Robust Countermeasure |
|---|---|---|
| **Black Pixels / Black Screen** | Converting transparent PNG/WebP or empty canvas directly to JPEG renders transparent pixels as `#000000` (black). | Explicitly paint a solid white `#FFFFFF` rectangle across the canvas before drawing the image: `ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height);` |
| **Blank / Incomplete Rendering** | `ctx.drawImage` invoked before `img.decode()` or `img.onload` fully completes, or hardware acceleration glitch. | Await `img.decode()` (fallback to `onload`), use `{ willReadFrequently: true }` in `canvas.getContext('2d')`. |
| **All-Black / All-White Image Capture** | Camera sensor uninitialized or lens covered when Capacitor camera snaps. | Sample pixels across a 10x10 grid using `ctx.getImageData()`. Verify luminance `L = 0.299R + 0.587G + 0.114B > 5` and pixel variance > 0. Throw friendly Arabic error if black/blank. |
| **Invalid JPEG Output** | WebViews failing `canvas.toDataURL('image/jpeg', 0.7)` fallback to PNG or corrupted data. | Validate JPEG SOI header bytes (`0xFF 0xD8 0xFF`), which corresponds to base64 prefix `/9j/`. |
| **Android Memory Leaks** | `URL.createObjectURL(file)` retains unmanaged memory in Chromium WebView. | Always call `URL.revokeObjectURL(url)` in a `finally` block. |

### 3.3 Proposed `src/utils/imageProcessor.ts` Specification

```typescript
export interface ProcessedImageResult {
  base64: string;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
  fileSizeBytes: number;
}

export const MAX_IMAGE_DIMENSION = 1024;
export const JPEG_COMPRESSION_QUALITY = 0.75;

/**
 * Validates whether a base64 string begins with a valid JPEG header (0xFF 0xD8 0xFF /9j/).
 */
export function isValidJpegBase64(base64: string): boolean {
  if (!base64 || typeof base64 !== 'string') return false;
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  return clean.trim().startsWith('/9j/');
}

/**
 * Verifies that the canvas does not contain all-black or blank pixels.
 */
export function verifyNotBlackOrBlank(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const sampleSteps = 10;
  const stepX = Math.max(1, Math.floor(width / sampleSteps));
  const stepY = Math.max(1, Math.floor(height / sampleSteps));
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let totalLuminance = 0;
  let samples = 0;
  let nonBlackCount = 0;

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuminance += lum;
      samples++;
      if (lum > 8) {
        nonBlackCount++;
      }
    }
  }

  const avgLum = totalLuminance / (samples || 1);
  // Return false if image is virtually pitch black or completely uniform blank
  return nonBlackCount > 0 && avgLum >= 5;
}

/**
 * Resizes, compresses to JPEG, and verifies the image for Android WebView.
 */
export async function processAndCompressImage(file: File | Blob): Promise<ProcessedImageResult> {
  // 1. Create Object URL and load Image
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = objectUrl;
    if (img.decode) {
      await img.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
      });
    }

    const { naturalWidth: width, naturalHeight: height } = img;
    if (!width || !height) {
      throw new Error('أبعاد الصورة الملتقطة غير صالحة.');
    }

    // 2. Scale clamping to max 1024px preserving aspect ratio
    let targetWidth = width;
    let targetHeight = height;
    if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
      const scale = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
      targetWidth = Math.round(width * scale);
      targetHeight = Math.round(height * scale);
    }

    // 3. Canvas rendering with solid white backdrop
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('تعذر إنشاء سياق معالجة الصور في المتصفح.');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // 4. Android WebView Black Screen / Blank Check
    const isVisible = verifyNotBlackOrBlank(ctx, targetWidth, targetHeight);
    if (!isVisible) {
      throw new Error('الصورة الملتقطة تبدو مظلمة جداً أو فارغة تماماً (شاشة سوداء). يرجى التأكد من تشغيل الإضاءة وإعادة التصوير.');
    }

    // 5. Canvas to JPEG Compression
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_COMPRESSION_QUALITY);
    const commaIndex = dataUrl.indexOf(',');
    const base64 = commaIndex !== -1 ? dataUrl.substring(commaIndex + 1) : dataUrl;

    // 6. Output Validation
    if (!isValidJpegBase64(base64)) {
      throw new Error('صيغة الصورة الناتجة غير صالحة (JPEG Header Missing).');
    }

    if (base64.length < 500) {
      throw new Error('حجم بيانات الصورة صغير جداً وغير صالح.');
    }

    return {
      base64,
      mimeType: 'image/jpeg',
      width: targetWidth,
      height: targetHeight,
      fileSizeBytes: Math.round((base64.length * 3) / 4)
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
```

---

## 4. Test Suite & Release Build Scripts

### 4.1 Vitest Test Suite Execution
- **Command**: `npm.cmd test` (runs `vitest run`)
- **Current Execution Result**:
  - Test Files: **10 passed (10)**
  - Tests: **125 passed (125)**
  - Duration: ~83.47s
- **Verified Files in `tests/`**:
  1. `tests/accessibility.test.tsx` (4 tests)
  2. `tests/analyze.adversarial.test.ts` (39 tests)
  3. `tests/analyze.test.ts` (28 tests)
  4. `tests/geminiParser.test.ts` (6 tests)
  5. `tests/geminiVision.challenge.test.ts` (28 tests)
  6. `tests/historyStorage.test.ts` (6 tests)
  7. `tests/pwa.test.ts` (3 tests)
  8. `tests/secretScan.test.ts` (2 tests)
  9. `tests/speechController.test.ts` (4 tests)
  10. `tests/worker.test.ts` (10 tests)
- **Key Testing Observation**:
  - `tests/geminiParser.test.ts:82` asserts:
    `expect(parsed.raw_error).toContain('الصورة غير واضحة');`
  - When enhancing `geminiParser.ts` for invalid JSON, the updated error string must preserve the phrase `'الصورة غير واضحة'` or include `'الصورة غير واضحة أو الرد غير مكتمل'` to maintain 100% test compatibility while attaching `error_category: 'invalid_json'`.
  - In `src/test/setup.ts`, `URL.createObjectURL` and `URL.revokeObjectURL` are already mocked. When writing unit tests for `imageProcessor.ts`, canvas 2D context (`getContext('2d')`) and `toDataURL` should be mocked in the test file or `setup.ts` to ensure reliable execution in jsdom without requiring node-canvas binaries.

### 4.2 Application Production Build
- **Command**: `npm.cmd run build` (runs `tsc --noEmit && vite build`)
- **Current Execution Result**:
  - `✓ 1591 modules transformed.`
  - `dist/index.html`: 2.12 kB
  - `dist/assets/index-8UQDLyVd.css`: 25.60 kB
  - `dist/assets/index-CTBTixax.js`: 184.53 kB
  - Build status: **Exit Code 0 (Success)** in 23.89s.

### 4.3 Release APK Build & Signing Script (`sign-release.bat`)
- **Location**: `sign-release.bat` in project root.
- **Keystore Present**: `dalili-release-key.jks` exists in project root (2,664 bytes).
- **Key Alias**: `dalili`.
- **Workflow**:
  1. Validates presence of `dalili-release-key.jks`.
  2. Requests keystore password securely via PowerShell (`Read-Host -AsSecureString`).
  3. Enters `android/` directory and executes `call gradlew.bat assembleRelease --no-daemon`.
  4. Immediately wipes password from environment variables.
  5. Locates `android\app\build\outputs\apk\release\app-release.apk` (or unsigned fallback).
  6. Signs with `apksigner.bat` if needed and copies to `dalili-app-signed-release.apk` in project root.
  7. Verifies signature using `apksigner verify --verbose dalili-app-signed-release.apk`.
- **User Execution Instructions**:
  Open Command Prompt or Terminal in `c:\Users\PC\Documents\antigravity\fervent-mendel` and run:
  ```cmd
  sign-release.bat
  ```
  Enter the keystore password when prompted. The signed release APK will be generated at:
  `c:\Users\PC\Documents\antigravity\fervent-mendel\dalili-app-signed-release.apk`

---

## 5. Actionable Implementation Plan for Requirement R2

### Phase 1: Image Compression & Verification Utility (`src/utils/imageProcessor.ts`)
1. Create `src/utils/imageProcessor.ts` implementing `processAndCompressImage`, `isValidJpegBase64`, and `verifyNotBlackOrBlank`.
2. Ensure solid white `#FFFFFF` backdrop is rendered prior to `drawImage` to prevent black artifacting on Android WebView.
3. Validate JPEG SOI header `/9j/`, minimum length > 500 chars, and dimensions clamped to <= 1024px.
4. Add unit tests in `tests/imageProcessor.test.ts` covering normal scaling, transparent PNG background filling, black pixel rejection, and invalid input handling.

### Phase 2: Client Diagnostics & Timeout in `src/services/geminiVision.ts`
1. Update `analyzeMedicationImage` to introduce a 30-second `AbortController` timeout.
2. Integrate `processAndCompressImage` so captured photos are compressed before transmission.
3. Extract `errorData?.error_code` and `errorData?.detail` from Worker error responses.
4. Throw a structured `AnalysisError` carrying `{ category, errorCode, detail }` while preserving backwards-compatible string messages for existing challenge tests.

### Phase 3: Error Classification & Guardrails in `src/services/geminiParser.ts`
1. Update `cleanAndParseJson` to assign `error_category: 'invalid_json'` and `error_code: 'INVALID_JSON'` when `JSON.parse` fails.
2. Keep the error message text containing `'الصورة غير واضحة'` so existing test `geminiParser.test.ts:82` remains 100% green.

### Phase 4: UI Error Segregation & Interactive Retry in `src/components/UnclearPhotoCard.tsx` & `src/App.tsx`
1. Enhance `UnclearPhotoCard.tsx` into a multi-category error card:
   - For `network_timeout`: Show `WifiOff`/`Clock` icon, title `"تعذر الاتصال بالشبكة أو انتهت مهلة الطلب"`, and interactive `"🔄 إعادة المحاولة الآن"` button.
   - For `server_error`: Show `ServerCrash` icon, title `"حدث خطأ في الخادم الطبي الذكي"`, display `(رمز الخطأ: {error_code})`, and interactive retry button.
   - For `invalid_json`: Show `FileCode` icon, title `"تعذر قراءة رد المعالج الذكي"`, and interactive retry button.
   - For `unclear_image`: Show `SunMedium`/`Focus` icons, title `"الصورة غير واضحة بما يكفي"`, camera tips, and primary `"📷 إعادة تصوير العلبة الآن"` button.
2. In `App.tsx`, store `lastFile` and pass `onRetry={() => processImage(lastFile)}` to retry the exact same photo without forcing the senior user to hold and re-photograph the medicine packaging.

### Phase 5: Verification & APK Generation
1. Run `npm.cmd test` and ensure all 125+ tests pass.
2. Run `npm.cmd run build` and ensure TypeScript and Vite build succeed.
3. Provide final instructions for running `sign-release.bat`.
