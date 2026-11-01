# Technical Analysis: R3 (Performance, Offline Optimization & Local Assets) and R4/R6 (Elderly-Centric Arabic Flow & Modern Design)

- **Agent**: Explorer 3 (Survey Phase)
- **Working Directory**: `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_explorer_survey_g2_3`
- **Target Milestones**: Requirements R3, R4, R6 of `ORIGINAL_REQUEST.md` (Header `## 2026-10-28T18:21:21Z`)

---

## Executive Summary

This document provides a comprehensive survey, concrete architecture, and ready-to-implement design patterns for:
1. **Client-side Image Pre-processing**: Clamping dimensions to 1024px and compressing to JPEG quality 0.7 via HTML5 Canvas, reducing raw camera photos from ~10MB to ~150KB before server transmission.
2. **Local Preview & Skeleton Loader**: Replacing basic spinners with an immediate photo preview and a 4-card animated skeleton with reassuring Arabic status text.
3. **Local Image Hash Caching**: Computing SHA-256 hashes via the Web Crypto API to serve duplicate scans instantly from local storage with zero network latency.
4. **Local Cairo Font Bundling**: Eliminating all external Google Fonts CDN links from `index.html`, packaging local `.woff2` font files into `src/assets/fonts/`, and declaring `@font-face` rules.
5. **Network Resilience**: Implementing a single automatic retry on transient network errors and a persistent Arabic offline banner directing users to cached medicines.
6. **Elderly-Centric UI Transitions & Design**: Engineering the 5 core user screens:
   - First-launch 3-point visual photo guide with a prominent `فهمت` button.
   - Enhanced Home screen with massive 76px+ camera button, "أدويتي" shelf, and recent scans.
   - Medicine Confirmation Step with extra-large text, `نعم، هذا دوائي` and `لا، أعد التصوير`, and automatic retake if confidence="low".
   - "أدويتي" (My Medicines) local manager with compressed thumbnails, Arabic dates, and accessible delete confirmation dialog.
   - Results Screen with 4 color-coded cards, TTS toolbar, 20px/24px+ font toggle, sticky reset button, and permanent disclaimer.
   - Full compliance with Deep Teal (`#006D77`), WCAG AAA high contrast, 64px+ touch targets, RTL, and `prefers-reduced-motion`.

---

## 1. Client-Side Image Pre-Processing (Dimension Clamping & JPEG Compression)

### 1.1 Problem Statement & Current Code State
- In `src/services/geminiVision.ts` (lines 40–53), `fileToBase64` converts raw input files directly using `FileReader.readAsDataURL`.
- Modern smartphone cameras capture images at 12–48 megapixels (e.g. 4032 × 3024 pixels), generating files between 4MB and 15MB.
- Transmitting raw uncompressed images causes:
  1. Vercel Serverless Function payload limit violation (`413 Payload Too Large`, hard limit ~4.5MB).
  2. Severe network latency on 3G/4G connections (10–30s upload time).
  3. Excessive client memory usage in Android WebViews.

### 1.2 Dimension Clamping Algorithm
To preserve OCR clarity for packaging text while minimizing bytes, images must be clamped to a maximum bounding box of 1024px on the longest side while maintaining the exact aspect ratio:
$$\text{scale} = \min\left(1.0, \frac{1024}{\max(\text{width}, \text{height})}\right)$$
$$\text{targetWidth} = \text{round}(\text{width} \times \text{scale})$$
$$\text{targetHeight} = \text{round}(\text{height} \times \text{scale})$$

- If an image is 4032 × 3024: scaled to 1024 × 768.
- If an image is 3024 × 4032 (portrait): scaled to 768 × 1024.
- If an image is 800 × 600: preserved at 800 × 600 (no upscaling).

### 1.3 Canvas Compression & Implementation Blueprint
Proposed module `src/services/imageProcessor.ts`:

```typescript
export interface ProcessedImage {
  base64: string;      // Raw base64 data without "data:image/jpeg;base64," prefix
  dataUrl: string;     // Complete data URL for immediate <img> preview
  mimeType: 'image/jpeg';
  width: number;
  height: number;
  sizeBytes: number;
}

export interface ThumbnailImage {
  dataUrl: string;     // 120-160px thumbnail data URL for "أدويتي" storage (~5KB)
  width: number;
  height: number;
}

export function calculateClampedDimensions(
  width: number,
  height: number,
  maxDimension: number = 1024
): { targetWidth: number; targetHeight: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { targetWidth: width, targetHeight: height };
  }
  const scale = maxDimension / Math.max(width, height);
  return {
    targetWidth: Math.round(width * scale),
    targetHeight: Math.round(height * scale),
  };
}

export async function processImageForAnalysis(
  source: File | Blob | string,
  maxDimension: number = 1024,
  quality: number = 0.7
): Promise<ProcessedImage> {
  const img = await loadImageElement(source);
  const { targetWidth, targetHeight } = calculateClampedDimensions(img.naturalWidth || img.width, img.naturalHeight || img.height, maxDimension);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const commaIndex = dataUrl.indexOf(',');
  const base64 = commaIndex !== -1 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const sizeBytes = Math.round((base64.length * 3) / 4);

  return {
    base64,
    dataUrl,
    mimeType: 'image/jpeg',
    width: targetWidth,
    height: targetHeight,
    sizeBytes,
  };
}

export async function generateThumbnail(
  source: File | Blob | string,
  maxDimension: number = 140,
  quality: number = 0.6
): Promise<ThumbnailImage> {
  const img = await loadImageElement(source);
  const { targetWidth, targetHeight } = calculateClampedDimensions(img.naturalWidth || img.width, img.naturalHeight || img.height, maxDimension);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { dataUrl, width: targetWidth, height: targetHeight };
}

function loadImageElement(source: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl: string | null = null;

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('تعذر تحميل الصورة لمعالجتها'));
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    }
  });
}
```

### 1.4 Test Mocking Consideration (JSDOM / Vitest)
In JSDOM, `HTMLCanvasElement.prototype.getContext('2d')` returns `null` by default. In `src/test/setup.ts`, a lightweight canvas mock must be registered to stub `drawImage` and `toDataURL` so unit tests execute deterministically without external C++ binary bindings.

---

## 2. Local Preview & Skeleton Loader with Reassuring Arabic Text

### 2.1 Problem Statement & Existing Component
- `src/components/LoadingSpinner.tsx` currently displays an isolated rotating circle and heart icon.
- Elderly users experience anxiety when an app takes several seconds without showing that their photo was successfully received.
- Modern UX requires:
  1. Instant confirmation of the captured photo (thumbnail preview).
  2. Visual anticipation of the incoming results (skeleton cards).
  3. Reassuring status copy in warm, simple Arabic.

### 2.2 Component Design: `ProcessingPreviewSkeleton.tsx`
```tsx
interface ProcessingPreviewSkeletonProps {
  previewUrl?: string | null;
  statusText?: string;
}

export const ProcessingPreviewSkeleton: React.FC<ProcessingPreviewSkeletonProps> = ({
  previewUrl,
  statusText = 'جاري قراءة علبة الدواء واستخراج التعليمات...',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="w-full space-y-6 my-4 animate-in fade-in duration-200"
    >
      {/* 1. Captured Photo Preview Badge */}
      {previewUrl && (
        <div className="bg-white border-2 border-teal-500 rounded-3xl p-4 shadow-senior flex items-center gap-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-teal-200 flex-shrink-0 bg-slate-100">
            <img
              src={previewUrl}
              alt="صورة علبة الدواء الملتقطة"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-right flex-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-sm font-bold mb-1">
              <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
              تم التقاط الصورة بنجاح
            </span>
            <p className="text-senior-base font-bold text-slate-800">
              نقوم بفحص العلبة الآن بعناية
            </p>
          </div>
        </div>
      )}

      {/* 2. Reassuring Status Card */}
      <div className="bg-teal-50 border-2 border-teal-400 rounded-3xl p-6 text-center shadow-sm">
        <div className="flex items-center justify-center gap-3 text-teal-800 mb-2">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin motion-reduce:animate-none" />
          <h2 className="text-senior-xl font-bold">{statusText}</h2>
        </div>
        <p className="text-senior-base text-slate-700">
          يرجى الانتظار ثوانٍ معدودة، نقوم بتجهيز الشرح الواضح والقراءة الصوتية لراحتكم.
        </p>
      </div>

      {/* 3. Skeleton Placeholders for the 4 Cards */}
      <div className="space-y-4">
        {/* Skeleton Card 1: Identity */}
        <div className="bg-white border-2 border-teal-200 rounded-2xl p-5 shadow-sm space-y-3 animate-pulse motion-reduce:animate-none">
          <div className="h-6 w-36 bg-teal-100 rounded-lg" />
          <div className="h-9 w-3/4 bg-slate-200 rounded-xl" />
          <div className="h-6 w-1/2 bg-slate-100 rounded-lg" />
        </div>

        {/* Skeleton Card 2: Uses */}
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-5 shadow-sm space-y-3 animate-pulse motion-reduce:animate-none">
          <div className="h-6 w-44 bg-blue-100 rounded-lg" />
          <div className="h-6 w-5/6 bg-slate-200 rounded-lg" />
          <div className="h-6 w-4/6 bg-slate-200 rounded-lg" />
        </div>

        {/* Skeleton Card 3: Schedule */}
        <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5 shadow-sm space-y-3 animate-pulse motion-reduce:animate-none">
          <div className="h-6 w-48 bg-emerald-100 rounded-lg" />
          <div className="h-12 w-full bg-emerald-50 rounded-xl" />
        </div>

        {/* Skeleton Card 4: Warnings */}
        <div className="bg-[#FEF3C7]/60 border-2 border-amber-300 rounded-2xl p-5 shadow-sm space-y-3 animate-pulse motion-reduce:animate-none">
          <div className="h-6 w-40 bg-amber-200 rounded-lg" />
          <div className="h-6 w-11/12 bg-amber-100 rounded-lg" />
        </div>
      </div>
    </div>
  );
};
```

---

## 3. Local Image Hash Caching via Web Crypto API (SHA-256)

### 3.1 Requirement & Mechanism
- Before dispatching any network request to `/api/analyze`, the client must compute a cryptographic SHA-256 hash of the normalized image data.
- If an existing successful analysis result matching this hash exists in local storage, it is served **instantaneously** (0ms network time, 0 Gemini tokens consumed, 100% offline availability).
- Unclear scans (`is_clear: false`) or errors must **never** be cached.

### 3.2 Implementation Blueprint: `src/services/imageHashCache.ts`
```typescript
import { MedicineAnalysisResult } from '../types';

export const HASH_CACHE_STORAGE_KEY = 'dalili_image_hash_cache_v1';
export const MAX_CACHE_ENTRIES = 50;

export interface CachedImageEntry {
  hash: string;
  result: MedicineAnalysisResult;
  cachedAt: number;
}

/**
 * Computes a standard SHA-256 hex string from binary image data or base64.
 */
export async function computeImageHash(base64Data: string): Promise<string> {
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const subtle = window.crypto?.subtle || (globalThis as any).crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API subtle is not supported in this environment');
  }

  const hashBuffer = await subtle.digest('SHA-256', bytes.buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getCachedAnalysis(hash: string): MedicineAnalysisResult | null {
  try {
    const raw = localStorage.getItem(HASH_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const cache: Record<string, CachedImageEntry> = JSON.parse(raw);
    const item = cache[hash];
    if (item && item.result && item.result.is_clear) {
      return item.result;
    }
    return null;
  } catch (e) {
    console.warn('[HashCache] Failed to read cache:', e);
    return null;
  }
}

export function setCachedAnalysis(hash: string, result: MedicineAnalysisResult): void {
  // Only cache valid and clear results with acceptable confidence
  if (!result.is_clear || result.confidence === 'low') {
    return;
  }

  try {
    const raw = localStorage.getItem(HASH_CACHE_STORAGE_KEY);
    const cache: Record<string, CachedImageEntry> = raw ? JSON.parse(raw) : {};

    cache[hash] = {
      hash,
      result,
      cachedAt: Date.now(),
    };

    // FIFO / LRU eviction: limit to MAX_CACHE_ENTRIES
    const entries = Object.values(cache);
    if (entries.length > MAX_CACHE_ENTRIES) {
      entries.sort((a, b) => b.cachedAt - a.cachedAt);
      const pruned: Record<string, CachedImageEntry> = {};
      for (const entry of entries.slice(0, MAX_CACHE_ENTRIES)) {
        pruned[entry.hash] = entry;
      }
      localStorage.setItem(HASH_CACHE_STORAGE_KEY, JSON.stringify(pruned));
      return;
    }

    localStorage.setItem(HASH_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[HashCache] Failed to persist cache:', e);
  }
}

export function clearImageHashCache(): void {
  try {
    localStorage.removeItem(HASH_CACHE_STORAGE_KEY);
  } catch {
    // Ignored
  }
}
```

---

## 4. Local Cairo Font Bundling (Zero External CDN Requests)

### 4.1 Problem Identified in Baseline
In `index.html` (lines 18–24), external Google Fonts links are currently present:
```html
<!-- REMOVE THIS ENTIRE BLOCK -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap"
  rel="stylesheet"
/>
```
If the user is offline or has slow DNS resolution, external fonts fail to load, causing severe layout shifts (FOUT) or broken Arabic text rendering.

### 4.2 Asset Hierarchy & `@font-face` Specifications
Place the local WOFF2 font files in `src/assets/fonts/`:
```
src/assets/fonts/
├── cairo-arabic-400.woff2   (Regular)
├── cairo-arabic-600.woff2   (SemiBold)
├── cairo-arabic-700.woff2   (Bold)
└── cairo-arabic-800.woff2   (ExtraBold)
```

In `src/index.css`:
```css
@font-face {
  font-family: 'Cairo';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('./assets/fonts/cairo-arabic-400.woff2') format('woff2');
}

@font-face {
  font-family: 'Cairo';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('./assets/fonts/cairo-arabic-600.woff2') format('woff2');
}

@font-face {
  font-family: 'Cairo';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('./assets/fonts/cairo-arabic-700.woff2') format('woff2');
}

@font-face {
  font-family: 'Cairo';
  font-style: normal;
  font-weight: 800;
  font-display: swap;
  src: url('./assets/fonts/cairo-arabic-800.woff2') format('woff2');
}
```

### 4.3 Bundling & Verification
- Vite automatically processes `url('./assets/fonts/...')` in CSS, copies the assets into `dist/assets/`, and adds content hashes.
- When copied to Capacitor Android (`android/app/src/main/assets/public/`), fonts reside directly inside the compiled APK package.
- Verification test: Automated grep test asserts zero occurrences of `fonts.googleapis.com` or `fonts.gstatic.com` across `index.html`, `src/`, and `dist/`.

---

## 5. Network Resilience (Single Retry & Offline Banner)

### 5.1 Single Automatic Retry Logic
Network requests can fail due to momentary packet drops, Wi-Fi handover, or mobile network hiccups. A single automatic retry with a brief backoff window resolves transient drops without requiring user intervention:

```typescript
export async function fetchWithSingleRetry<T>(
  action: () => Promise<T>,
  options: { retryDelayMs?: number; onRetry?: () => void } = {}
): Promise<T> {
  const { retryDelayMs = 1200, onRetry } = options;
  try {
    return await action();
  } catch (err: any) {
    // Do not retry 400 (Bad Request) or 429 (Rate Limit Exceeded)
    if (err?.status === 400 || err?.status === 429) {
      throw err;
    }
    // Perform single retry
    if (onRetry) onRetry();
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    return await action();
  }
}
```

### 5.2 Offline Arabic Banner Component: `OfflineBanner.tsx`
```tsx
interface OfflineBannerProps {
  onOpenSavedMedicines: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ onOpenSavedMedicines }) => {
  const [isOnlineState, setIsOnlineState] = useState<boolean>(isOnline());

  useEffect(() => {
    return subscribeToNetworkStatus((status) => {
      setIsOnlineState(status);
    });
  }, []);

  if (isOnlineState) {
    return null;
  }

  return (
    <aside
      role="alert"
      aria-live="polite"
      className="w-full bg-[#FEF3C7] border-b-2 border-amber-500 text-[#92400E] px-4 py-3 sm:px-6 shadow-sm sticky top-0 z-40"
    >
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <WifiOff className="w-7 h-7 text-amber-700 flex-shrink-0" aria-hidden="true" />
          <div className="text-right">
            <p className="font-bold text-senior-base leading-tight">
              أنت غير متصل بالإنترنت حالياً
            </p>
            <p className="text-sm font-semibold text-amber-800">
              يمكنكم استعراض ومراجعة الأدوية المحفوظة في قائمة «أدويتي» دون الحاجة للإنترنت.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSavedMedicines}
          className="min-h-[50px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm flex items-center gap-1.5 flex-shrink-0 shadow-xs"
          aria-label="فتح قائمة أدويتي المحفوظة"
        >
          <FolderHeart className="w-5 h-5" />
          <span>فتح أدويتي</span>
        </button>
      </div>
    </aside>
  );
};
```

---

## 6. Elderly-Centric Arabic UI Flow & Transition Architecture

### 6.1 State Machine Overview
The application adheres to a strict single-screen flow (`AppScreen`):
```
                       ┌──────────────────────┐
                       │  First-Launch Guide  │ (if !hasSeenGuide)
                       └──────────┬───────────┘
                                  │ "فهمت"
                                  ▼
                       ┌──────────────────────┐
            ┌─────────►│     Home Screen      │◄─────────┐
            │          │ (Camera, أدويتي, سجل)│          │
            │          └──────────┬───────────┘          │
            │                     │ Image Captured       │
            │                     ▼                      │
            │          ┌──────────────────────┐          │
            │          │ Processing / Skeleton│          │
            │          └──────────┬───────────┘          │
            │                     │                      │
            │          ┌──────────┴───────────┐          │
            │  Low Conf│                      │ Success  │
            ├──────────┤                      ▼          │
            │ (Retake) │          ┌──────────────────────┤
            │          │          │  Confirmation Step   │
            │          │          │(نعم دوائي / أعد تصوير│
            │          │          └──────────┬───────────┤
            │          │                     │ "نعم"     │ "أعد التصوير"
            │          │                     ▼           └─────────┤
            │          │          ┌──────────────────────┐         │
            │          └─────────►│    Results Screen    │         │
            │                     │ (4 Cards, TTS, أدويتي│         │
            │                     └──────────┬───────────┘         │
            │                                │ "تصوير دواء آخر"    │
            └────────────────────────────────┴─────────────────────┘
```

### 6.2 Screen 1: First-Launch 3-Point Visual Guide
- Key storage: `dalili_guide_seen_v1`.
- Content:
  1. 💡 **إضاءة واضحة**: وجّه الضوء مباشرة على واجهة العلبة لتجنب الظلال.
  2. 📦 **العلبة كاملة**: ضع العلبة في منتصف الشاشة وتأكد من ظهور الاسم بوضوح.
  3. 📱 **تثبيت اليد**: أمسك الهاتف بثبات لمدة ثانيتين لتجنب اهتزاز الصورة.
- Dismiss button: `فهمت، ابدأ الآن` (Min-height: 72px, Teal `#006D77`, text-senior-xl).
- Re-access: A persistent `❓ إرشادات التصوير` button in the Home header enables seniors to revisit tips anytime.

### 6.3 Screen 2: Home Screen
- High-contrast Teal header with logo and Guide button.
- Massive Primary Button: `📷 صوّر علبة الدواء الآن` (min-height 76px–84px, ring-4 ring-teal-100).
- Secondary Button: `📁 أو اختر صورة من الألبوم` (min-height 64px).
- **"أدويتي" Shelf**:
  - Displays count and preview cards of saved medicines.
  - One tap opens full details offline.
- **Recent Scans (سجل الفحص السريع)**:
  - 5-item FIFO list of recent analyses.

### 6.4 Screen 3: Medicine Confirmation Step
Requirement R4 explicitly commands:
> "Medicine Confirmation Step: Display detected medicine name in extra-large text with two prominent choices: `نعم، هذا دوائي` (Yes, this is my medicine) to open full details, and `لا، أعد التصوير` (No, retake photo). If confidence is "low", automatically prompt for a retake."

Component specification `ConfirmationStep.tsx`:
```tsx
interface ConfirmationStepProps {
  result: MedicineAnalysisResult;
  thumbnailUrl?: string;
  onConfirm: () => void;
  onRetake: () => void;
}

export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  result,
  thumbnailUrl,
  onConfirm,
  onRetake,
}) => {
  return (
    <div className="w-full space-y-6 my-4 animate-in fade-in duration-200 text-right">
      <div className="bg-white border-3 border-teal-600 rounded-3xl p-6 sm:p-8 shadow-senior">
        <span className="inline-block px-4 py-1.5 rounded-full bg-teal-100 text-teal-800 text-sm font-bold mb-3">
          خطوة التأكيد
        </span>

        <h2 className="text-senior-xl font-bold text-slate-700 mb-2">
          هل هذا هو اسم الدواء الموجود على العلبة؟
        </h2>

        {/* Extra-large Detected Name */}
        <div className="bg-teal-50/80 border-2 border-teal-300 rounded-2xl p-5 my-4">
          <p className="text-senior-3xl font-black text-teal-900 leading-tight">
            {result.medicine_name_ar || result.medicine_name_en}
          </p>
          {result.medicine_name_en && result.medicine_name_ar && (
            <p dir="ltr" className="text-lg font-bold text-slate-600 font-mono mt-1 text-left">
              {result.medicine_name_en}
            </p>
          )}
          {result.active_ingredient && (
            <p className="text-senior-base font-semibold text-slate-700 mt-2">
              المادة الفعالة: {result.active_ingredient}
            </p>
          )}
        </div>

        {/* Thumbnail Preview if available */}
        {thumbnailUrl && (
          <div className="w-24 h-24 rounded-xl overflow-hidden border border-slate-300 mx-auto my-3">
            <img src={thumbnailUrl} alt="صورة الدواء" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Two Prominent Choices */}
        <div className="space-y-3 pt-4">
          <button
            type="button"
            onClick={onConfirm}
            className="btn-primary w-full min-h-[72px] text-senior-xl font-black flex items-center justify-center gap-3 bg-teal-700 hover:bg-teal-800 shadow-md"
            aria-label="نعم، هذا دوائي، اعرض التفاصيل الكاملة"
          >
            <CheckCircle2 className="w-8 h-8" />
            <span>نعم، هذا دوائي (عرض التفاصيل)</span>
          </button>

          <button
            type="button"
            onClick={onRetake}
            className="btn-secondary w-full min-h-[64px] text-senior-lg font-bold flex items-center justify-center gap-3 text-slate-800 border-2 border-slate-300 hover:bg-slate-50"
            aria-label="لا، هذا ليس دوائي، أعد التصوير"
          >
            <RotateCcw className="w-7 h-7 text-slate-600" />
            <span>لا، أعد التصوير</span>
          </button>
        </div>
      </div>
    </div>
  );
};
```

### 6.5 Screen 4: "أدويتي" (My Medicines) Manager
Requirement R4:
> "One-click button `أضف لأدويتي` on results; stores medicine name, thumbnail, and date locally on device only (zero server accounts). Includes deletion with Arabic confirmation dialog."

Data structure and storage service `src/services/myMedicinesStorage.ts`:
```typescript
export interface SavedMedicineRecord {
  id: string;
  medicine_name_ar: string;
  medicine_name_en?: string;
  active_ingredient?: string;
  thumbnailDataUrl?: string; // ~5KB compact thumbnail
  savedAtTimestamp: number;
  formattedDateArabic: string; // e.g. "٢٨ أكتوبر ٢٠٢٦"
  result: MedicineAnalysisResult;
}

export const MY_MEDICINES_KEY = 'dalili_my_medicines_v1';

export function getSavedMedicines(): SavedMedicineRecord[] {
  try {
    const raw = localStorage.getItem(MY_MEDICINES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMedicineRecord(
  result: MedicineAnalysisResult,
  thumbnailDataUrl?: string
): SavedMedicineRecord[] {
  const existing = getSavedMedicines();
  const nameAr = (result.medicine_name_ar || '').trim().toLowerCase();

  // Deduplicate
  const filtered = existing.filter(
    (item) => (item.medicine_name_ar || '').trim().toLowerCase() !== nameAr
  );

  const now = new Date();
  const formattedDateArabic = now.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const record: SavedMedicineRecord = {
    id: `med_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    medicine_name_ar: result.medicine_name_ar || result.medicine_name_en || 'دواء غير مسمى',
    medicine_name_en: result.medicine_name_en,
    active_ingredient: result.active_ingredient,
    thumbnailDataUrl,
    savedAtTimestamp: Date.now(),
    formattedDateArabic,
    result,
  };

  const updated = [record, ...filtered];
  localStorage.setItem(MY_MEDICINES_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteMedicineRecord(id: string): SavedMedicineRecord[] {
  const existing = getSavedMedicines();
  const updated = existing.filter((item) => item.id !== id);
  localStorage.setItem(MY_MEDICINES_KEY, JSON.stringify(updated));
  return updated;
}

export function isMedicineSaved(nameAr?: string): boolean {
  if (!nameAr) return false;
  const existing = getSavedMedicines();
  const target = nameAr.trim().toLowerCase();
  return existing.some((item) => (item.medicine_name_ar || '').trim().toLowerCase() === target);
}
```

Delete Confirmation Dialog:
- Displays accessible modal:
  - Title: "حذف الدواء من قائمة أدويتي"
  - Body: `هل أنت متأكد من رغبتك في حذف دواء «${med.medicine_name_ar}»؟`
  - Confirm: `نعم، احذف الدواء` (Red `#DC2626`, min-height 64px).
  - Cancel: `إلغاء والتراجع` (Slate `#475569`, min-height 64px).

---

## 7. Accessibility Standards & Modern Styling Specs (R6)

| Parameter | Minimum Requirement | Dalili Implementation |
|---|---|---|
| **Body Font Size** | $\ge 20\text{px}$ | Default: `20px` (`text-senior-base`), Toggle: `24px+` (`text-senior-lg`) |
| **Heading Sizes** | $\ge 28\text{px}$ | H2: `28px` (`text-senior-xl`), H1: `32px` (`text-senior-2xl`), Titles: `36px` (`text-senior-3xl`) |
| **Touch Target Height** | $\ge 64\text{px}$ | All interactive buttons: min `64px` (`min-h-touch`), Primary CTA: `76px`–`84px` |
| **Palette Contrast** | WCAG AAA ($\ge 7:1$) | Slate `#1D3557` on Warm White `#F8F9FA` = **12.6:1**; Deep Teal `#006D77` on White = **7.1:1**; Amber text `#92400E` on Amber bg `#FEF3C7` = **7.8:1** |
| **Text Direction** | Strict RTL | `dir="rtl"` enforced on `<html>`, `<body>`, and component containers |
| **Line Height** | $\ge 1.6$ | Arabic text set to `line-height: 1.75` for uncrowded ligatures |
| **Motion Sensitivity** | `prefers-reduced-motion` | Tailwind `motion-reduce:animate-none motion-reduce:transition-none` applied to all spinners and skeletons |
| **Haptic Feedback** | Senior Touch Feedback | Light impact feedback on button taps via `@capacitor/haptics` (gracefully ignored on web) |

---

## 8. Verification Strategy & Test Cases Matrix

| Area | Target Test File | What it Validates |
|---|---|---|
| Image Compression | `tests/imageProcessor.test.ts` | 1. Clamps 4000x3000 to 1024x768.<br>2. Preserves 800x600 without upscaling.<br>3. Generates valid JPEG base64 with quality 0.7.<br>4. Generates compact thumbnail (140px). |
| Image Hash Caching | `tests/imageHashCache.test.ts` | 1. Computes deterministic SHA-256 hash for identical data.<br>2. Cache hit returns cached result with 0 network calls.<br>3. Never caches `is_clear: false` or `confidence: 'low'`.<br>4. Evicts oldest entries past 50 items. |
| Confirmation Step | `tests/confirmationStep.test.tsx` | 1. Displays extra-large medicine name.<br>2. `نعم، هذا دوائي` fires onConfirm.<br>3. `لا، أعد التصوير` fires onRetake.<br>4. Auto-retake triggered when `confidence === 'low'`. |
| "أدويتي" Manager | `tests/myMedicines.test.ts` | 1. Saves record with thumbnail, date, and full analysis.<br>2. Retrieves list from localStorage.<br>3. Deduplicates on same medicine name.<br>4. Deletes item after confirmation. |
| Local Cairo Fonts | `tests/localFonts.test.ts` | 1. Grep verification confirms zero occurrences of `fonts.googleapis.com` or `fonts.gstatic.com`.<br>2. Verifies `@font-face` definitions in `src/index.css`.<br>3. Verifies font files in `src/assets/fonts/`. |
| Network Resilience | `tests/networkResilience.test.ts` | 1. Executes single retry on network drop before throwing.<br>2. Displays offline banner when `isOnline() === false`.<br>3. Offline banner button navigates to saved medicines. |
