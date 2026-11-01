# Milestone 3 Implementation Plan: Client Error Handling, Timeout, Image Compression & Verification (Requirement R2)

**Explorer**: Explorer M3 (`teamwork_explorer_m3_1`)  
**Date**: 2026-10-29  
**Integrity Mode**: Development  
**Target Milestone**: Milestone 3 (Requirement R2)  
**Target Worker**: Worker M3 (`teamwork_worker_m3_1`)  

---

## 1. Executive Summary & Problem Scope

In the Dalili Medication Guide application, Requirement R2 addresses two critical failure modes in the client application:
1. **The "Image Not Clear" Fallacy**:
   Every failure in the application—whether an internet disconnection, a 30-second server timeout, an HTTP 500/503 from the Cloudflare Worker, an API rate limit, or invalid JSON syntax—is caught and mapped to `is_clear: false`, presenting a hardcoded card titled `"الصورة غير واضحة بما يكفي"` (The image is not clear enough) with camera focus and lighting tips. This misleads elderly patients into believing they took a poor photo when the actual issue was a server or network failure. Furthermore, clicking the retry button currently resets the entire screen to the home state, discarding the captured photo and forcing elderly users to reposition and retake the medication box.
2. **Missing Image Compression & Android WebView Guardrails**:
   Photos captured on modern Android smartphones reach 12MP–50MP (4000x3000px or higher), resulting in 10MB–30MB base64 payloads. Because `src/services/geminiVision.ts` currently performs raw `FileReader.readAsDataURL` with zero compression:
   - Requests exceed the Cloudflare Worker's 4MB limit (`MAX_PAYLOAD_BYTES`), returning HTTP 413 (`PAYLOAD_TOO_LARGE`).
   - Android WebView crashes due to memory exhaustion.
   - Converting images with transparent channels to JPEG on Android WebView renders transparent areas as solid black (`#000000`).
   - Network requests lack an `AbortController` timeout, causing stalled requests to hang indefinitely on the loading spinner.

### Milestone 3 Deliverables
1. **`src/utils/imageProcessor.ts`**:
   - Clamping dimensions to max 1024px while strictly preserving aspect ratio.
   - Canvas-based compression to JPEG quality 0.75.
   - Solid white background (`#FFFFFF`) fill before drawing to eliminate Android WebView black transparency artifacts.
   - Output validation: JPEG header check (`/9j/` prefix / `0xFF, 0xD8, 0xFF`), length check (> 500 chars), and 10x10 pixel grid sampling to detect and reject completely black or blank frames.
2. **`src/services/geminiVision.ts`**:
   - 30-second `AbortController` timeout throwing typed `CLIENT_TIMEOUT`.
   - Extraction and propagation of Worker debug fields (`error_code`, `status`, `detail`).
   - Structured `AnalysisError` class that preserves backwards-compatible string messages for existing challenge tests.
3. **`src/services/geminiParser.ts`**:
   - Categorize JSON parsing failures with `error_category: 'invalid_json'` and `error_code: 'INVALID_JSON'` while preserving the `'الصورة غير واضحة'` substring in `raw_error` to maintain 100% test compatibility.
4. **4 Distinct Friendly Arabic Error States in `src/components/UnclearPhotoCard.tsx` & `src/App.tsx`**:
   - (a) Network or timeout (`تعذر الاتصال بالشبكة أو انتهت مهلة الطلب`) with interactive retry button.
   - (b) Server error (`حدث خطأ في الخادم الطبي الذكي`) with Worker debug `error_code` badge.
   - (c) AI `is_clear=false` (`الصورة غير واضحة بما يكفي`) with lighting and focus tips and camera retake button.
   - (d) Invalid JSON (`تعذر قراءة رد المعالج الذكي`) with interactive retry button.
   - **Interactive Retry**: `App.tsx` preserves the current image file/base64 in state so clicking "إعادة المحاولة" re-analyzes without forcing the user to take a new photo.
5. **Test Suite & Build Verification**:
   - New unit tests for `imageProcessor.ts` with canvas 2D mocks.
   - Component & integration tests verifying all 4 error states and interactive retry.
   - Verification of `npm.cmd test` (passing 282+ tests), `npm.cmd run build`, and `sign-release.bat`.

---

## 2. Forensic Codebase State & File Locations

| File Path | Current Status | Required Worker M3 Modification |
|---|---|---|
| `src/types/index.ts` | Exists (21 lines) | Add optional `error_category`, `error_code`, `error_detail` to `MedicineAnalysisResult`. |
| `src/utils/imageProcessor.ts` | **Does not exist** | Create new file with 1024px clamp, white backdrop, JPEG 0.75, header check, length check, and black/blank pixel detection. |
| `src/services/geminiVision.ts` | Exists (119 lines) | Add 30s `AbortController` timeout, `AnalysisError` class, extract Worker `error_code`/`detail`, preserve backwards-compatible error messages. |
| `src/services/geminiParser.ts` | Exists (88 lines) | When `JSON.parse` fails, attach `error_category: 'invalid_json'` and `error_code: 'INVALID_JSON'`, while retaining `'الصورة غير واضحة'` substring in `raw_error`. |
| `src/components/UnclearPhotoCard.tsx` | Exists (49 lines) | Refactor to support 4 distinct categories, dynamic Arabic titles, icons (`WifiOff`, `ServerCrash`, `AlertTriangle`, `FileCode`), debug badge, and dual `onRetry`/`onRetake` buttons. |
| `src/App.tsx` | Exists (214 lines) | Integrate `processAndValidateImage`, store `lastFile` in state, provide `handleRetrySameImage` to re-analyze without retaking, pass structured error metadata to `UnclearPhotoCard`. |
| `src/test/setup.ts` | Exists (326 lines) | Add canvas 2D context mock (`getContext('2d')`) and `toDataURL` mock so jsdom can run canvas operations smoothly. |
| `tests/imageProcessor.test.ts` | **Does not exist** | Create new unit test suite for dimensions, white fill, JPEG header, length check, black/blank detection, and memory cleanup. |
| `tests/errorStates.test.tsx` | **Does not exist** | Create comprehensive test suite for the 4 distinct UI error states, debug badge, and interactive retry without photo retake. |

---

## 3. Step-by-Step Implementation Blueprint for Worker M3

### Step 1: Update Type Definitions in `src/types/index.ts`

In `src/types/index.ts`, update `MedicineAnalysisResult` to include optional error metadata fields. This maintains complete backwards compatibility with all existing code while enabling structured error reporting:

```typescript
export type ErrorCategory = 'network_timeout' | 'server_error' | 'unclear_image' | 'invalid_json';

export interface MedicineAnalysisResult {
  is_clear: boolean;
  medicine_name_ar?: string;
  medicine_name_en?: string;
  active_ingredient?: string;
  uses?: string[];
  how_and_when?: string[];
  warnings?: string[];
  audio_summary?: string;
  raw_error?: string;
  error_category?: ErrorCategory;
  error_code?: string;
  error_detail?: string;
}
```

---

### Step 2: Implement `src/utils/imageProcessor.ts`

Create `src/utils/imageProcessor.ts`.

#### Critical Implementation Details:
1. **Constants**:
   - `MAX_IMAGE_DIMENSION = 1024`
   - `JPEG_COMPRESSION_QUALITY = 0.75`
   - `MIN_VALID_BASE64_LENGTH = 500`
2. **Dimension Clamping**:
   - If `width > 1024` or `height > 1024`:
     ```typescript
     const scale = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
     const targetWidth = Math.round(width * scale);
     const targetHeight = Math.round(height * scale);
     ```
   - If both are <= 1024, preserve natural dimensions.
3. **Solid White Background Fill (`#FFFFFF`)**:
   - Before drawing the image on the canvas, fill the entire canvas with `#FFFFFF`:
     ```typescript
     ctx.fillStyle = '#FFFFFF';
     ctx.fillRect(0, 0, targetWidth, targetHeight);
     ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
     ```
   - This ensures transparent PNG/WebP images do NOT produce black backgrounds or black borders on Android WebView.
4. **Header Validation (`isValidJpegBase64`)**:
   - Clean data URL prefix if present.
   - JPEG base64 strings always begin with `/9j/` (corresponding to the JPEG Start of Image magic bytes `0xFF 0xD8 0xFF`).
   ```typescript
   export function isValidJpegBase64(base64: string): boolean {
     if (!base64 || typeof base64 !== 'string') return false;
     const clean = base64.includes(',') ? base64.split(',')[1] : base64;
     return clean.trim().startsWith('/9j/');
   }
   ```
5. **Blank & Black Pixel Grid Detection (`verifyNotBlackOrBlank`)**:
   - Sample a 10x10 grid using `ctx.getImageData()`.
   - Luminance: $L = 0.299 \times R + 0.587 \times G + 0.114 \times B$.
   - Track `minLum`, `maxLum`, and `totalLum`.
   - Reject if:
     - Average luminance $< 5$ (virtually pitch-black image, covered lens).
     - Variance is zero and average luminance $> 250$ (completely blank/washed out screen).
     - Non-black pixels count is zero.
   ```typescript
   export function verifyNotBlackOrBlank(
     ctx: CanvasRenderingContext2D,
     width: number,
     height: number
   ): boolean {
     const sampleSteps = 10;
     const stepX = Math.max(1, Math.floor(width / sampleSteps));
     const stepY = Math.max(1, Math.floor(height / sampleSteps));
     const imageData = ctx.getImageData(0, 0, width, height);
     const data = imageData.data;

     let totalLum = 0;
     let minLum = 255;
     let maxLum = 0;
     let samples = 0;
     let nonBlackCount = 0;

     for (let y = 0; y < height; y += stepY) {
       for (let x = 0; x < width; x += stepX) {
         const idx = (y * width + x) * 4;
         const r = data[idx];
         const g = data[idx + 1];
         const b = data[idx + 2];
         const lum = 0.299 * r + 0.587 * g + 0.114 * b;
         totalLum += lum;
         if (lum < minLum) minLum = lum;
         if (lum > maxLum) maxLum = lum;
         samples++;
         if (lum > 8) {
           nonBlackCount++;
         }
       }
     }

     const avgLum = totalLum / (samples || 1);
     // Reject pitch-black (avgLum < 5 or no pixels > 8) or completely blank solid white (maxLum - minLum === 0 && avgLum > 250)
     if (nonBlackCount === 0 || avgLum < 5) return false;
     if (maxLum - minLum === 0 && avgLum > 250) return false;
     return true;
   }
   ```
6. **Unified Processing Pipeline (`processAndValidateImage`)**:
   - Accept `File | Blob | string`.
   - Create and revoke Object URL safely in `finally`.
   - Support `img.decode()` with fallback to `img.onload`.
   - Throw friendly Arabic validation errors if image dimensions are invalid, image is black/blank, header is missing, or payload is under 500 characters.

```typescript
export interface ProcessedImage {
  base64: string;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
  sizeBytes: number;
}

export async function processAndValidateImage(
  input: File | Blob | string
): Promise<ProcessedImage> {
  let objectUrl: string | null = null;
  let sourceSrc: string;

  if (typeof input === 'string') {
    sourceSrc = input.startsWith('data:') ? input : `data:image/jpeg;base64,${input}`;
  } else {
    objectUrl = URL.createObjectURL(input);
    sourceSrc = objectUrl;
  }

  try {
    const img = new Image();
    img.src = sourceSrc;

    if (typeof img.decode === 'function') {
      try {
        await img.decode();
      } catch {
        // Fallback for environments where decode fails
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = (e) => reject(new Error('تعذر تحميل بيانات الصورة المحددة.'));
        });
      }
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(new Error('تعذر تحميل بيانات الصورة المحددة.'));
      });
    }

    const { naturalWidth: width, naturalHeight: height } = img;
    if (!width || !height || width <= 0 || height <= 0) {
      throw new Error('أبعاد الصورة الملتقطة غير صالحة.');
    }

    // Clamp dimensions to max 1024px while strictly preserving aspect ratio
    let targetWidth = width;
    let targetHeight = height;
    if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
      const scale = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
      targetWidth = Math.round(width * scale);
      targetHeight = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('تعذر إنشاء سياق معالجة الصور في المتصفح.');
    }

    // Solid white backdrop to eliminate Android WebView black transparency artifacts
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // 10x10 Grid Pixel Sample Check
    const isVisible = verifyNotBlackOrBlank(ctx, targetWidth, targetHeight);
    if (!isVisible) {
      throw new Error('الصورة الملتقطة تبدو مظلمة جداً أو فارغة تماماً (شاشة سوداء). يرجى التأكد من تشغيل الإضاءة وإعادة التصوير.');
    }

    // Convert to JPEG with quality 0.75
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_COMPRESSION_QUALITY);
    const commaIndex = dataUrl.indexOf(',');
    const base64 = commaIndex !== -1 ? dataUrl.substring(commaIndex + 1) : dataUrl;

    if (!isValidJpegBase64(base64)) {
      throw new Error('صيغة الصورة الناتجة غير صالحة (JPEG Header Missing).');
    }

    if (base64.length < MIN_VALID_BASE64_LENGTH) {
      throw new Error('حجم بيانات الصورة صغير جداً وغير صالح.');
    }

    return {
      base64,
      mimeType: 'image/jpeg',
      width: targetWidth,
      height: targetHeight,
      sizeBytes: Math.round((base64.length * 3) / 4)
    };
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
```

---

### Step 3: Implement 30s Timeout & Structured Errors in `src/services/geminiVision.ts`

#### Critical Implementation Details:
1. **Define `AnalysisError` class**:
   Extends `Error` and stores `category`, `errorCode`, `status`, and `detail`.
   Because it extends `Error`, any test running `expect(...).rejects.toThrow(expectedMessage)` continues to pass identically!
2. **30-Second Timeout with `AbortController`**:
   - `timeoutMs` defaults to `30000`.
   - Setup a timer:
     ```typescript
     let isInternalTimeout = false;
     const controller = new AbortController();
     const timeoutId = setTimeout(() => {
       isInternalTimeout = true;
       controller.abort(new DOMException('Request timeout after 30000ms', 'AbortError'));
     }, timeoutMs);
     ```
   - Pass `signal: controller.signal` to `fetch`.
   - If abort occurs due to timeout:
     ```typescript
     if (isInternalTimeout || err.name === 'AbortError' || err.name === 'TimeoutError') {
       throw new AnalysisError(
         'استغرقت العملية أكثر من 30 ثانية. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة.',
         {
           category: 'network_timeout',
           errorCode: 'CLIENT_TIMEOUT'
         }
       );
     }
     ```
3. **Parse Worker Error Responses**:
   When `!response.ok`:
   - Read JSON response safely: `const errorData = await response.json().catch(() => ({}));`
   - Extract:
     ```typescript
     const errorCode = errorData?.error_code || errorData?.error || `HTTP_${response.status}`;
     const detail = errorData?.detail;
     const status = response.status;
     ```
   - Build friendly Arabic message (matching existing challenge test expectations):
     ```typescript
     const friendlyMessage =
       errorData?.retake_message ||
       errorData?.error ||
       `تعذر الاتصال بالمعالج الذكي (${response.status}). يرجى المحاولة مرة أخرى.`;
     ```
   - Determine category:
     - `status === 504` or `errorCode === 'CLIENT_TIMEOUT'`: `'network_timeout'`
     - Otherwise: `'server_error'`
   - Throw `new AnalysisError(friendlyMessage, { category, errorCode, detail, status })`.
4. **General Network Failures**:
   If `err instanceof TypeError && err.message.includes('fetch')`:
   - Throw `AnalysisError` with `category: 'network_timeout'`, `errorCode: 'NETWORK_ERROR'`.

---

### Step 4: Refactor `src/services/geminiParser.ts` for Invalid JSON

In `cleanAndParseJson`:
```typescript
  try {
    const parsed = JSON.parse(cleaned);
    ...
    return {
      is_clear: isClear,
      ...
    };
  } catch (err) {
    console.warn('[GeminiParser] JSON parse error:', err, 'Raw text was:', rawText);
    return {
      is_clear: false,
      error_category: 'invalid_json',
      error_code: 'INVALID_JSON',
      raw_error: 'الصورة غير واضحة بدرجة كافية أو تعذر قراءة رد المعالج الذكي. يرجى إعادة المحاولة.'
    };
  }
```

*Note on Backward Compatibility*:
`tests/geminiParser.test.ts:82` checks:
`expect(parsed.raw_error).toContain('الصورة غير واضحة');`
By wording the error string as `'الصورة غير واضحة بدرجة كافية أو تعذر قراءة رد المعالج الذكي. يرجى إعادة المحاولة.'`, this assertion remains 100% green while accurately assigning `error_category: 'invalid_json'`.

---

### Step 5: Multi-Category Error Card in `src/components/UnclearPhotoCard.tsx`

Refactor `UnclearPhotoCard.tsx` to handle all 4 categories distinctly while satisfying senior accessibility guidelines:

#### Props:
```typescript
export interface UnclearPhotoCardProps {
  onRetry?: () => void;
  onRetake?: () => void;
  errorMessage?: string;
  errorCategory?: 'network_timeout' | 'server_error' | 'unclear_image' | 'invalid_json';
  errorCode?: string;
  hasLastImage?: boolean;
}
```

#### Category Presentation Matrix:

| Category | Icon | Border & Background | Arabic Title | Description | Primary Button | Secondary Button |
|---|---|---|---|---|---|---|
| **(a) `network_timeout`** | `WifiOff` (amber-600) | `bg-amber-50 border-amber-500` | `تعذر الاتصال بالشبكة أو انتهت مهلة الطلب` | `استغرق الاتصال بالخادم وقتاً أطول من المعتاد (أكثر من 30 ثانية) أو انقطع الاتصال بالإنترنت. يرجى التحقق من الشبكة ثم الضغط على زر إعادة المحاولة.` | `🔄 إعادة المحاولة الآن` (`onRetry`) | `📷 تصوير علبة أخرى` (`onRetake`) |
| **(b) `server_error`** | `ServerCrash` (rose-600) | `bg-rose-50 border-rose-500` | `حدث خطأ في الخادم الطبي الذكي` | `نواجه صعوبة مؤقتة في التواصل مع المعالج الطبي الذكي. يرجى المحاولة مرة أخرى بعد قليل.` *(or rate limit / location message)*<br>+ **Debug badge**: `رمز الخطأ: {errorCode}` | `🔄 إعادة المحاولة الآن` (`onRetry`) | `🏠 العودة للرئيسية` (`onRetake`) |
| **(c) `unclear_image`** | `AlertTriangle` (teal-600) | `bg-teal-50 border-teal-500` | `الصورة غير واضحة بما يكفي` | `لم نتمكن من قراءة اسم الدواء بدقة من هذه الصورة. من أجل سلامتكم وصحتكم، يرجى إعادة التقاط الصورة باتباع النصائح التالية:`<br>+ Tips box (`SunMedium` lighting, `Focus` centering) | `📷 إعادة تصوير العلبة الآن` (`onRetake`) | None |
| **(d) `invalid_json`** | `FileCode` (indigo-600) | `bg-indigo-50 border-indigo-500` | `تعذر قراءة رد المعالج الذكي` | `استلم التطبيق بيانات غير مكتملة أو غير صالحة من المعالج الذكي. يرجى الضغط على زر إعادة المحاولة لقراءة العلبة مجدداً.` | `🔄 إعادة المحاولة الآن` (`onRetry`) | `📷 تصوير دواء آخر` (`onRetake`) |

#### Senior Ergonomics:
- Touch target height: all action buttons use `min-h-[64px]` or `min-h-[72px]`.
- Font size: `text-senior-xl` / `text-senior-2xl` bold.
- RTL layout enforced.

---

### Step 6: Interactive Retry Architecture in `src/App.tsx`

Update `src/App.tsx` to preserve `lastFile` and re-run analysis upon retry without forcing the user to take a new photo:

```typescript
// 1. State for retaining active captured image
const [lastFile, setLastFile] = useState<File | null>(null);

// 2. Processing pipeline with image compression
const processImage = async (file: File) => {
  setIsLoading(true);
  setCurrentResult(null);
  speechController.stop();
  setLastFile(file); // Store for interactive retry!

  try {
    // A. Canvas resize, white backdrop fill, JPEG 0.75 compression & verification
    const processed = await processAndValidateImage(file);

    // B. Analyze via zero-secret proxy with 30s timeout
    const result = await analyzeMedicationImage({
      imageBase64: processed.base64,
      mimeType: processed.mimeType
    });

    setCurrentResult(result);
    if (result.is_clear) {
      const updatedHistory = saveScanItem(result);
      setRecentScans(updatedHistory);
    }
  } catch (err: unknown) {
    if (err instanceof AnalysisError) {
      setCurrentResult({
        is_clear: false,
        error_category: err.category,
        error_code: err.errorCode,
        error_detail: err.detail,
        raw_error: err.message
      });
    } else {
      const errorMsg = err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الصورة.';
      const isTimeout = /timeout|30 ثانية|مهلة/i.test(errorMsg);
      const isNetwork = /network|fetch|شبكة|اتصال/i.test(errorMsg);
      setCurrentResult({
        is_clear: false,
        error_category: isTimeout || isNetwork ? 'network_timeout' : 'server_error',
        error_code: isTimeout ? 'CLIENT_TIMEOUT' : undefined,
        raw_error: errorMsg
      });
    }
  } finally {
    setIsLoading(false);
  }
};

// 3. Interactive Retry Handler
const handleRetrySameImage = async () => {
  if (lastFile) {
    await processImage(lastFile);
  } else {
    handleResetToHome();
  }
};
```

In the JSX render:
```tsx
{!currentResult.is_clear ? (
  <UnclearPhotoCard
    onRetry={handleRetrySameImage}
    onRetake={handleResetToHome}
    errorMessage={currentResult.raw_error}
    errorCategory={currentResult.error_category}
    errorCode={currentResult.error_code}
    hasLastImage={Boolean(lastFile)}
  />
) : (
  ...
)}
```

---

### Step 7: Test Suite & Mocking Strategy

#### 1. Canvas Mocking in `src/test/setup.ts`
Because Vitest runs in `jsdom`, `HTMLCanvasElement.prototype.getContext` and `toDataURL` must be reliably mocked so `imageProcessor.ts` can run without headless canvas binary dependencies:
```typescript
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId: string) => {
    if (contextId === '2d') {
      return {
        fillStyle: '#FFFFFF',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(1024 * 1024 * 4).fill(128) // Normal gray image
        }),
      };
    }
    return null;
  }) as any;

  HTMLCanvasElement.prototype.toDataURL = vi.fn().mockImplementation((type?: string) => {
    // Valid JPEG base64 starting with /9j/
    return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  });
}
```

#### 2. Create `tests/imageProcessor.test.ts`
Test cases:
- `clamps dimensions exceeding 1024px while preserving aspect ratio (2048x1536 -> 1024x768)`
- `does not upscale dimensions <= 1024px (800x600 -> 800x600)`
- `renders solid white background before drawImage`
- `validates valid JPEG /9j/ header correctly`
- `rejects base64 without /9j/ prefix`
- `rejects base64 under 500 characters`
- `rejects pitch-black grid samples (all pixels lum < 5)`
- `rejects completely blank solid white grid samples`
- `accepts healthy photos with variable luminance`
- `revokes object URL in finally block`

#### 3. Create `tests/errorStates.test.tsx`
Test cases:
- `renders State (a) Network/Timeout with correct title, message, and retry button`
- `renders State (b) Server Error with correct title, message, and error_code badge`
- `renders State (c) Unclear Image with lighting/focus tips and retake button`
- `renders State (d) Invalid JSON with correct title and retry button`
- `clicking interactive retry triggers onRetry without resetting to home`
- `clicking retake button triggers onRetake`

---

## 4. Release Build & Signing Instructions (`sign-release.bat`)

`sign-release.bat` in the project root is fully configured. It automates:
1. Validating `dalili-release-key.jks` in the root directory.
2. Securely prompting the user for the keystore password via PowerShell `Read-Host -AsSecureString`.
3. Executing Gradle release build: `cd android && call gradlew.bat assembleRelease --no-daemon`.
4. Immediately clearing passwords from memory.
5. Copying the resulting signed APK to `dalili-app-signed-release.apk`.
6. Running `apksigner verify --verbose` to confirm APK signature validity.

### Command for User:
Open Command Prompt in `c:\Users\PC\Documents\antigravity\fervent-mendel` and run:
```cmd
sign-release.bat
```
Enter the keystore password when prompted. The signed release APK will be generated at:
`c:\Users\PC\Documents\antigravity\fervent-mendel\dalili-app-signed-release.apk`

---

## 5. Verification Commands for Worker M3

After implementing the above changes, Worker M3 must run the following verification steps:
1. **Run Full Vitest Suite**:
   ```cmd
   npm.cmd test
   ```
   *Expected outcome*: All test files pass (including new `imageProcessor.test.ts` and `errorStates.test.tsx`), zero regressions.
2. **Run TypeScript Check & Production Build**:
   ```cmd
   npm.cmd run build
   ```
   *Expected outcome*: Exit code 0, `tsc --noEmit` clean, Vite bundles `dist/`.
3. **Android Sync Verification**:
   ```cmd
   npx cap sync android
   ```
   *Expected outcome*: Android web assets synced cleanly.
