# Technical Handoff Report: Milestone M4 — Prescription UI & Details Flow

**Author**: Explorer 1  
**Milestone**: M4 (Prescription UI Flow, Unclear Guidance & Usage Card)  
**Date**: 2026-10-31  
**Target Recipient**: Orchestrator (`be14d828-8b13-435b-929b-e3dd3fbf5ac6`) & Worker M4  

---

## 1. Observation

Direct observations from inspecting codebase, types, existing services, and automated test suites:

### 1.1 Existing Type Contracts (`src/types/index.ts`)
- **`PrescriptionItem`**:
  - `line_text_as_written: string`
  - `medicine_name_ar: string`
  - `medicine_name_en: string`
  - `active_ingredient: string`
  - `confidence: 'high' | 'medium' | 'low'`
  - `written_instructions: string`
  - `short_explanation: string`
- **`PrescriptionAnalysisResult`**:
  - `is_clear: boolean`
  - `retake_message?: string`
  - `confidence: 'high' | 'medium' | 'low'`
  - `evidence_text?: string`
  - `items: PrescriptionItem[]` (max 10 items)
  - `audio_summary?: string`
  - `error_category?: ErrorCategory` ('network_timeout' | 'server_error' | 'unclear_image' | 'invalid_json')
  - `error_code?: string`
  - `error_detail?: string`
- **`MedicineAnalysisResult`**:
  - `is_clear: boolean`
  - `medicine_name_ar?: string`
  - `medicine_name_en?: string`
  - `active_ingredient?: string`
  - `uses?: string[]`
  - `how_and_when?: string[]`
  - `usage_source?: 'printed' | 'common'`
  - `warnings?: string[]`
  - `audio_summary?: string`
- **Navigation & Audio**:
  - `TabKey`: `'home' | 'medicines' | 'camera' | 'prescription' | 'history'`
  - `AudioState`: `'idle' | 'speaking' | 'paused'`
  - `FontSizePreference`: `'large' | 'extra-large'`

### 1.2 Existing Services & Backend Readiness
- **Backend Edge Endpoint (`worker/src/index.ts`)**:
  - Supports `POST /api/prescription` or `mode: "prescription"` using `GEMINI_MODEL_PRESCRIPTION` (`gemini-3.8-flash`, `thinkingLevel: 'LOW'`).
  - Supports `POST /api/analyze` with `mode: "details"` for text-based medicine lookup.
  - Implements 25-second AbortController returning HTTP 504 `UPSTREAM_TIMEOUT`.
- **Client Vision Client (`src/services/geminiVision.ts`)**:
  - `analyzePrescriptionImage(base64Image: string, signal?: AbortSignal): Promise<PrescriptionAnalysisResult>`:
    - Automatically wraps request with 30s timeout (`CLIENT_TIMEOUT`).
    - Maps 504 and network aborts to `network_timeout` category.
    - Uses `validatePrescriptionJson` for parsing and safety filtering.
  - `fetchMedicineDetails(medicineName: string, signal?: AbortSignal): Promise<MedicineAnalysisResult>`:
    - Checks cache in `detailsCache.ts` first (0ms latency).
    - Calls Worker `mode: "details"`, populates cache upon success.
- **Image Compression Utility (`src/utils/imageProcessor.ts`)**:
  - `compressPrescriptionImage(file: File | Blob | string): Promise<CompressedImage>`:
    - Clamps longest dimension to **1600px** (vs 1024px for box).
    - Enforces JPEG quality **0.8** (vs 0.75 for box).
    - Applies `#FFFFFF` backdrop to eliminate Android WebView black transparency bugs.
    - Verifies non-black/non-blank frames with 10x10 sampling grid.
- **Native Camera Service (`src/services/nativeCamera.ts`)**:
  - `capturePhoto()`: Triggers native rear camera (`CameraSource.Camera`, `direction: CameraDirection.Rear`). Returns `NativePhotoFile | null` (returns `null` on user cancellation).
  - `pickPhoto()`: Opens gallery picker (`CameraSource.Photos`). Returns `NativePhotoFile | null`.
- **Speech Controller (`src/services/speechController.ts`)**:
  - Singleton `speechController`:
    - `speak(text: string, onEnd?: () => void)`: Uses Arabic voice (`ar-SA` / `ar-EG`) with senior-friendly pace `rate: 0.85`.
    - `pause()`, `resume()`, `stop()`, `subscribe(callback)`.
- **Details Cache Service (`src/services/detailsCache.ts`)**:
  - `getCachedDetails(name: string): MedicineAnalysisResult | null`
  - `setCachedDetails(name: string, data: MedicineAnalysisResult): void`
  - Storage key prefix: `dalili_details_` + normalized Arabic name (stripping tashkeel, consolidating whitespace).

### 1.3 Exact Test Contracts & Mandated Strings (`tests/e2e/fixtures/testContracts.ts`)
- `PRESCRIPTION_ADVISORY_BANNER`: `'راجع أسماء الأدوية قبل الاعتماد'` (exact length: 31 chars).
- `LOW_CONFIDENCE_AMBER_TEXT`: `'غير واضح، اسأل الصيدلي'` (exact length: 23 chars, contains Arabic comma `،`).
- `HARDCODED_DISCLAIMER_LINE`: `'هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي.'` (exact length: 87 chars).
- RTL Nav Tabs sequence: `['الرئيسية', 'أدويتي', 'صوّر', 'الروشتة', 'السجل']`.
- My Medicines local storage key: `'dalili_my_medicines_v1'`.

### 1.4 Automated Test Suite Execution Baseline
- Command: `npx.cmd vitest run`
- Results: **40 test files passed (40/40), 1021 tests passed (1021/1021)**, duration 27.07s.
- Zero regressions in existing test suite.

---

## 2. Logic Chain

From these observations, we formulate the technical architecture and component design required for Milestone M4:

```
[User on "الروشتة" Tab or "صوّر روشتة" Card]
                    │
                    ▼
     [PrescriptionFlow.tsx] ──── Idle State (Dual Buttons: Camera & Gallery)
                    │
      User triggers capture / pick
                    │
                    ▼
     [nativeCamera.ts] ─────── capturePhoto() / pickPhoto()
                    │ (gracefully handles user cancellation)
                    ▼
     [imageProcessor.ts] ───── compressPrescriptionImage() (1600px, 0.8 JPEG)
                    │
                    ▼
     [PrescriptionFlow.tsx] ──── Processing State ("جاري قراءة الروشتة الطبية...")
                    │
                    ▼
     [geminiVision.ts] ─────── analyzePrescriptionImage() (30s timeout)
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
[!is_clear || items==[]]     [is_clear && items.length > 0]
         │                     │
         ▼                     ▼
[UnclearPhotoCard.tsx]       [PrescriptionResultView.tsx]
(3 Tips & Retry Button)        ├─ Top Advisory Banner ("راجع أسماء الأدوية قبل الاعتماد")
                               ├─ Audio Read-Aloud Button ("استمع للروشتة كاملة")
                               ├─ Low-Confidence Amber Cards ("غير واضح، اسأل الصيدلي")
                               ├─ Legible Medicine Cards (Arabic/English, Instructions, Badge)
                               │         │
                               │    User clicks legible card
                               │         │
                               │         ▼
                               │   [MedicineDetailsModal.tsx]
                               │   (4-Card Details + "أضف لأدويتي")
                               │
                               └─ Sticky Reset Action ("🔄 تصوير روشتة أخرى")
```

### 2.1 Component Specifications

#### Component 1: `src/components/PrescriptionFlow.tsx`
- **Props Interface**:
  ```typescript
  export interface PrescriptionFlowProps {
    fontSize: FontSizePreference;
    onResetToHome?: () => void;
    onNavigateToMedicines?: () => void;
    disabled?: boolean;
  }
  ```
- **Internal States**:
  - `status: 'idle' | 'processing' | 'result' | 'unclear'`
  - `result: PrescriptionAnalysisResult | null`
  - `errorMessage: string | null`
  - `errorCategory: ErrorCategory | undefined`
  - `errorCode: string | undefined`
  - `lastFile: File | null` (retained for interactive retry without re-capturing)
  - `selectedMedicine: PrescriptionItem | null` (controls `MedicineDetailsModal`)
- **Key Methods**:
  - `handleCameraCapture()`:
    1. Stops any ongoing speech via `speechController.stop()`.
    2. Calls `capturePhoto()`. If `null` (cancelled), exit gracefully.
    3. Calls `processPrescriptionFile(file)`.
  - `handleGalleryPick()`:
    1. Calls `pickPhoto()`. If `null`, exit.
    2. Calls `processPrescriptionFile(file)`.
  - `processPrescriptionFile(file: File)`:
    1. Sets `status = 'processing'`, `lastFile = file`, `errorMessage = null`.
    2. Compresses image: `const compressed = await compressPrescriptionImage(file);`.
    3. Calls API: `const analysis = await analyzePrescriptionImage(compressed.base64);`.
    4. Evaluates result:
       - If `!analysis.is_clear || !analysis.items || analysis.items.length === 0`:
         Sets `status = 'unclear'`, `result = analysis`, `errorCategory = analysis.error_category || 'unclear_image'`.
       - Else: Sets `status = 'result'`, `result = analysis`.
    5. On catch (`AnalysisError` or `Error`):
       - If timeout (504 or CLIENT_TIMEOUT): Sets `errorCategory = 'network_timeout'`, `status = 'unclear'`.
       - Sets `status = 'unclear'`, preserving `lastFile` so user can retry directly.
  - `handleRetrySameImage()`:
    Re-runs `processPrescriptionFile(lastFile)`.

#### Component 2: `src/components/PrescriptionResultView.tsx`
- **Props Interface**:
  ```typescript
  export interface PrescriptionResultViewProps {
    result: PrescriptionAnalysisResult;
    fontSize: FontSizePreference;
    onRetake: () => void;
    onSelectMedicine: (item: PrescriptionItem) => void;
  }
  ```
- **Key UI Elements**:
  1. **Top Advisory Banner (F17)**:
     - Text: `PRESCRIPTION_ADVISORY_BANNER` (`"راجع أسماء الأدوية قبل الاعتماد"`).
     - Styling: Alert/info container, high-contrast, teal/amber border, info icon, font >= 18px.
  2. **Read-Aloud Toolbar / Button (F17)**:
     - Subscribes to `speechController.subscribe(...)`.
     - Button height >= 64px, `Volume2` icon.
     - Dynamic text: `isSpeaking ? 'إيقاف القراءة' : 'استمع للروشتة كاملة'`.
     - On click: toggles `speechController.speak(result.audio_summary)` vs `speechController.stop()`.
     - `useEffect` cleanup: cancel speech on component unmount (`speechController.stop()`).
  3. **Multi-Item Card List (F15, F16, F20)**:
     - Renders `result.items.map((item, index) => ...)`:
     - **If `item.confidence === 'low'` (F16)**:
       - Soft amber container: `bg-[#FEF3C7] border-2 border-amber-400 text-amber-900 rounded-2xl p-6` (with `#F59E0B` border tone).
       - Icon: `AlertTriangle` in `#D97706`.
       - Label/heading: `LOW_CONFIDENCE_AMBER_TEXT` (`"غير واضح، اسأل الصيدلي"`).
       - Verbatim text: `item.line_text_as_written || 'خط غير مقروء'` in a monospace / handwritten-style badge.
       - If `item.written_instructions`: shows what was detected without guessing.
       - Strictly **NO** AI explanation, no accordion, not clickable.
       - Accessibility: `aria-label="دواء غير واضح"`.
     - **If `item.confidence === 'high' | 'medium'` (F15, F20)**:
       - White card, teal/blue border, rounded-2xl or 3xl, shadow-md, touch target >= 64px, clickable.
       - Header:
         - Large Arabic medicine name: `item.medicine_name_ar` (24-28px font).
         - English trade name & strength: `item.medicine_name_en` (LTR monospace badge).
         - Confidence Badge: `item.confidence === 'high' ? 'واضح' : 'غير مؤكد'`.
       - Purpose line: `item.short_explanation` (one simple sentence).
       - "ما كتبه الطبيب" Box:
         - Distinct container with title "ما كتبه الطبيب" and `Clock`/`FileText` icon.
         - Content: `item.written_instructions`.
       - Footer hint / tap prompt: "اضغط لعرض التفاصيل الكاملة والدواعي 👈".
       - Click handler: `onSelectMedicine(item)`.
  4. **Medical Disclaimer Banner (F08)**:
     - Mounts `DisclaimerBanner`.
  5. **Sticky Reset Button**:
     - Sticky bottom: "🔄 تصوير روشتة أخرى" (min-height 64px).

#### Component 3: `src/components/MedicineDetailsModal.tsx`
- **Props Interface**:
  ```typescript
  export interface MedicineDetailsModalProps {
    item: PrescriptionItem | null;
    isOpen: boolean;
    onClose: () => void;
    fontSize: FontSizePreference;
    onAddedToMedicines?: () => void;
  }
  ```
- **State & Logic**:
  - `isLoading: boolean`
  - `details: MedicineAnalysisResult | null`
  - `isSaved: boolean`
  - `error: string | null`
- **Lifecycle**:
  - When `isOpen` becomes true and `item` is present:
    1. Checks if already saved in `dalili_my_medicines_v1`.
    2. Identifies lookup key: `item.medicine_name_en || item.medicine_name_ar`.
    3. Calls `fetchMedicineDetails(name)`.
    4. `fetchMedicineDetails` automatically returns cached result from `detailsCache.ts` if available, or fetches from `/api/analyze` (mode: "details").
    5. Displays the 4 cards (`ResultCards`).
- **"أضف لأدويتي" Button (F18)**:
  - When clicked: saves `{ id: 'med_' + Date.now(), name_ar: item.medicine_name_ar, name_en: item.medicine_name_en, how_and_when: details.how_and_when, addedAt: Date.now() }` to `localStorage` under `'dalili_my_medicines_v1'`.
  - Deduplicates by `name_ar` / `name_en` / `name`.
  - Sets `isSaved = true`.
  - Displays reassuring toast: "تمت إضافة الدواء إلى قائمة أدويتي بنجاح ✓".
- **Close Button**:
  - Prominent "✕ إغلاق" button (min height 64px) at top and bottom.

#### Component 4: Enhancements to `src/components/ResultCards.tsx` (F21, F22, F23)
- **F22 Usage Source Badging**:
  - In Card 3 ("طريقة الاستخدام وأفضل المواعيد"), render a badge:
    - If `result.usage_source === 'printed'`:
      `<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border bg-emerald-100 text-emerald-800 border-emerald-300">مكتوب على العلبة</span>`
    - If `result.usage_source === 'common'`:
      `<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border bg-blue-100 text-blue-800 border-blue-300">الاستخدام الشائع</span>`
- **F23 Hardcoded Arabic Disclaimer Line**:
  - Immediately under the instructions list in Card 3, render:
    ```tsx
    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-right">
      <p className="text-slate-600 text-base font-semibold leading-relaxed" dir="rtl">
        هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي.
      </p>
    </div>
    ```
  - Exact string matches `HARDCODED_DISCLAIMER_LINE` (87 characters).

#### Component 5: Enhancements to `src/components/UnclearPhotoCard.tsx` (F19)
- For `errorCategory === 'unclear_image'`:
  - Friendly Arabic message:
    `errorMessage || 'الصورة غير واضحة للأسف، ساعدنا بإعادة التقاطها لنتمكن من قراءتها بدقة'`
  - **3 Mandated Retake Tips**:
    1. `التأكد من إضاءة الغرفة بشكل كافٍ` (SunMedium icon)
    2. `إظهار الروشتة أو العلبة كاملة داخل الإطار` (Focus / Scan icon)
    3. `تثبيت الهاتف باليدين وعدم الاهتزاز أثناء التصوير` (Smartphone / Camera icon)
  - Primary button label: `"إعادة التصوير"` (height >= 64px).

#### Component 6: Persistent "أدويتي" Storage Utility (`src/services/myMedicinesStorage.ts`)
- Storage key: `'dalili_my_medicines_v1'`
- Functions:
  - `getMyMedicines(): MyMedicineItem[]`
  - `saveMyMedicine(item: Partial<MyMedicineItem>): boolean` (deduplicates by normalized name)
  - `removeMyMedicine(id: string): void`
  - `clearMyMedicines(): void`

#### Component 7: `src/App.tsx` Integration
- Replace placeholder in `activeTab === 'prescription'` with `<PrescriptionFlow ... />`.
- Wire `onNavigateToPrescription` from `HomeScreen` to `setActiveTab('prescription')`.
- Wire `activeTab === 'medicines'` to render saved medications from `myMedicinesStorage.ts` with delete action and confirmation dialog.
- Clean up speech upon tab navigation (`speechController.stop()`).

---

## 3. Step-by-Step Code Templates for the Worker

### Template 3.1: `src/services/myMedicinesStorage.ts`
```typescript
export interface MyMedicineItem {
  id: string;
  name_ar?: string;
  name_en?: string;
  name?: string;
  active_ingredient?: string;
  how_and_when?: string[];
  addedAt: number;
}

export const MY_MEDICINES_KEY = 'dalili_my_medicines_v1';

export function getMyMedicines(): MyMedicineItem[] {
  try {
    const raw = localStorage.getItem(MY_MEDICINES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[MyMedicines] Read error:', e);
    return [];
  }
}

export function saveMyMedicine(item: Partial<MyMedicineItem>): boolean {
  try {
    const existing = getMyMedicines();
    const nameAr = (item.name_ar || item.name || '').trim().toLowerCase();
    const nameEn = (item.name_en || '').trim().toLowerCase();

    // Deduplication by name
    const alreadyExists = existing.some((m) => {
      const mAr = (m.name_ar || m.name || '').trim().toLowerCase();
      const mEn = (m.name_en || '').trim().toLowerCase();
      if (nameAr && mAr && nameAr === mAr) return true;
      if (nameEn && mEn && nameEn === mEn) return true;
      return false;
    });

    if (alreadyExists) {
      return false;
    }

    const newItem: MyMedicineItem = {
      id: item.id || `med_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name_ar: item.name_ar,
      name_en: item.name_en,
      name: item.name || item.name_ar || item.name_en,
      active_ingredient: item.active_ingredient,
      how_and_when: item.how_and_when,
      addedAt: item.addedAt || Date.now(),
    };

    localStorage.setItem(MY_MEDICINES_KEY, JSON.stringify([newItem, ...existing]));
    return true;
  } catch (e) {
    console.warn('[MyMedicines] Save error:', e);
    return false;
  }
}

export function removeMyMedicine(id: string): void {
  try {
    const existing = getMyMedicines();
    const filtered = existing.filter((m) => m.id !== id);
    localStorage.setItem(MY_MEDICINES_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[MyMedicines] Remove error:', e);
  }
}
```

### Template 3.2: `src/components/MedicineDetailsModal.tsx`
```tsx
import React, { useEffect, useState } from 'react';
import { X, Plus, Check, Pill, AlertTriangle } from 'lucide-react';
import { PrescriptionItem, MedicineAnalysisResult, FontSizePreference } from '../types';
import { fetchMedicineDetails } from '../services/geminiVision';
import { saveMyMedicine, getMyMedicines } from '../services/myMedicinesStorage';
import { LoadingSpinner } from './LoadingSpinner';
import { ResultCards } from './ResultCards';

export interface MedicineDetailsModalProps {
  item: PrescriptionItem | null;
  isOpen: boolean;
  onClose: () => void;
  fontSize: FontSizePreference;
}

export const MedicineDetailsModal: React.FC<MedicineDetailsModalProps> = ({
  item,
  isOpen,
  onClose,
  fontSize,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [details, setDetails] = useState<MedicineAnalysisResult | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !item) {
      setDetails(null);
      setError(null);
      setIsSaved(false);
      return;
    }

    // Check if already saved in "أدويتي"
    const savedList = getMyMedicines();
    const alreadySaved = savedList.some(
      (m) =>
        (m.name_ar && m.name_ar === item.medicine_name_ar) ||
        (m.name_en && m.name_en === item.medicine_name_en)
    );
    setIsSaved(alreadySaved);

    // Fetch details
    const lookupName = item.medicine_name_en || item.medicine_name_ar;
    if (!lookupName) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchMedicineDetails(lookupName)
      .then((res) => {
        if (!isMounted) return;
        setDetails(res);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'تعذر تحميل تفاصيل الدواء');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleAddToMyMedicines = () => {
    const success = saveMyMedicine({
      name_ar: item.medicine_name_ar,
      name_en: item.medicine_name_en,
      name: item.medicine_name_ar || item.medicine_name_en,
      active_ingredient: item.active_ingredient,
      how_and_when: details?.how_and_when || [item.written_instructions],
    });
    if (success) {
      setIsSaved(true);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`تفاصيل دواء ${item.medicine_name_ar}`}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
    >
      <div
        dir="rtl"
        className="w-full max-w-2xl bg-[#F8F9FA] rounded-3xl shadow-2xl border-2 border-teal-600 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="bg-white border-b-2 border-teal-600 p-4 sm:p-5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-senior-xl font-bold text-teal-900 leading-tight">
                {item.medicine_name_ar || item.medicine_name_en}
              </h2>
              {item.medicine_name_en && item.medicine_name_ar && (
                <p className="text-xs font-mono text-slate-500" dir="ltr">
                  {item.medicine_name_en}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-12 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center text-xl font-bold"
            aria-label="إغلاق نافذة التفاصيل"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Doctor's Prescription Note */}
          <div className="bg-blue-50 border-2 border-blue-400 rounded-2xl p-4 text-right">
            <span className="text-blue-900 text-sm font-bold block mb-1">
              ما كتبه الطبيب في الروشتة:
            </span>
            <p className="text-senior-base font-extrabold text-blue-950">
              {item.written_instructions || 'لم تذكر تعليمات خاصة'}
            </p>
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-4">
              <LoadingSpinner message="جاري استرجاع التفاصيل الطبية للدواء..." />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-amber-50 border-2 border-amber-400 text-amber-900 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 text-amber-600" />
              <p className="text-senior-base font-bold">{error}</p>
            </div>
          )}

          {/* 4 Cards */}
          {!loading && details && (
            <ResultCards result={details} fontSize={fontSize} />
          )}

          {/* Add to "أدويتي" Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleAddToMyMedicines}
              disabled={isSaved}
              className={`w-full min-h-[64px] rounded-2xl p-4 flex items-center justify-center gap-3 text-senior-lg font-extrabold transition-all shadow-sm ${
                isSaved
                  ? 'bg-emerald-100 text-emerald-900 border-2 border-emerald-400 cursor-default'
                  : 'bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white'
              }`}
              aria-label={isSaved ? 'موجود في أدويتي' : 'أضف لأدويتي'}
            >
              {isSaved ? (
                <>
                  <Check className="w-7 h-7 text-emerald-700" />
                  <span>تمت الإضافة لقائمة أدويتي ✓</span>
                </>
              ) : (
                <>
                  <Plus className="w-7 h-7" />
                  <span>أضف لأدويتي</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[56px] rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-senior-base flex items-center justify-center"
          >
            العودة للروشتة
          </button>
        </div>
      </div>
    </div>
  );
};
```

### Template 3.3: `src/components/PrescriptionResultView.tsx`
```tsx
import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, AlertTriangle, CheckCircle2, ChevronLeft, RotateCcw } from 'lucide-react';
import { PrescriptionAnalysisResult, PrescriptionItem, FontSizePreference } from '../types';
import { speechController } from '../services/speechController';
import { DisclaimerBanner } from './DisclaimerBanner';
import { FontSizeToggle } from './FontSizeToggle';

export const PRESCRIPTION_ADVISORY_BANNER = 'راجع أسماء الأدوية قبل الاعتماد';
export const LOW_CONFIDENCE_AMBER_TEXT = 'غير واضح، اسأل الصيدلي';

export interface PrescriptionResultViewProps {
  result: PrescriptionAnalysisResult;
  fontSize: FontSizePreference;
  onRetake: () => void;
  onSelectMedicine: (item: PrescriptionItem) => void;
  onFontSizeChange: (size: FontSizePreference) => void;
}

export const PrescriptionResultView: React.FC<PrescriptionResultViewProps> = ({
  result,
  fontSize,
  onRetake,
  onSelectMedicine,
  onFontSizeChange,
}) => {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = speechController.subscribe((state) => {
      setIsSpeaking(state.status === 'speaking');
    });
    return () => {
      unsubscribe();
      speechController.stop();
    };
  }, []);

  const handleToggleSpeech = () => {
    if (isSpeaking) {
      speechController.stop();
    } else {
      const summaryText =
        result.audio_summary ||
        (result.items.length > 0
          ? `الروشتة تحتوي على: ${result.items
              .filter((i) => i.confidence !== 'low')
              .map((i) => i.medicine_name_ar || i.medicine_name_en)
              .join('، ')}`
          : 'لا توجد أدوية واضحة للقراءة');
      speechController.speak(summaryText);
    }
  };

  const isExtraLarge = fontSize === 'extra-large';
  const headingClass = isExtraLarge ? 'text-senior-2xl font-black' : 'text-senior-xl font-black';
  const bodyClass = isExtraLarge ? 'text-senior-lg leading-loose' : 'text-senior-base leading-relaxed';

  return (
    <div dir="rtl" className="w-full space-y-6 text-right animate-in fade-in duration-200">
      {/* 1. Top Advisory Banner (F17) */}
      <div
        role="region"
        aria-label="تنبيه الروشتة"
        className="bg-amber-100/90 border-2 border-amber-500 text-amber-950 rounded-2xl p-4 flex items-center gap-3 shadow-xs"
      >
        <AlertTriangle className="w-7 h-7 text-amber-700 flex-shrink-0" aria-hidden="true" />
        <p className="text-senior-base font-extrabold leading-normal">
          {PRESCRIPTION_ADVISORY_BANNER}
        </p>
      </div>

      {/* Font Size Toggle */}
      <FontSizeToggle currentSize={fontSize} onToggle={onFontSizeChange} />

      {/* 2. Read-Aloud Button (F17) */}
      <button
        type="button"
        onClick={handleToggleSpeech}
        className={`w-full min-h-[64px] rounded-2xl p-4 flex items-center justify-center gap-3 font-extrabold text-senior-lg shadow-sm transition-all ${
          isSpeaking
            ? 'bg-amber-600 hover:bg-amber-700 text-white'
            : 'bg-teal-700 hover:bg-teal-800 text-white'
        }`}
        aria-label={isSpeaking ? 'إيقاف القراءة' : 'استمع للروشتة كاملة'}
      >
        {isSpeaking ? (
          <>
            <VolumeX className="w-7 h-7" aria-hidden="true" />
            <span>إيقاف القراءة</span>
          </>
        ) : (
          <>
            <Volume2 className="w-7 h-7" aria-hidden="true" />
            <span>استمع للروشتة كاملة</span>
          </>
        )}
      </button>

      {/* 3. Multi-Item Card List (F15, F16, F20) */}
      <div className="space-y-4" role="feed" aria-label="أدوية الروشتة">
        {result.items.map((item, idx) => {
          const isLow = item.confidence === 'low';

          if (isLow) {
            // Low-Confidence Amber Card (F16)
            return (
              <div
                key={`rx_item_${idx}`}
                role="article"
                aria-label="دواء غير واضح"
                className="bg-[#FEF3C7] border-2 border-amber-400 text-amber-900 rounded-2xl p-6 shadow-xs"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-200 text-[#D97706] flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-7 h-7 text-[#D97706]" aria-hidden="true" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className={`${headingClass} text-amber-950 font-black`}>
                      {LOW_CONFIDENCE_AMBER_TEXT}
                    </h3>
                    <div className="bg-amber-200/60 p-3 rounded-xl border border-amber-300">
                      <span className="text-xs font-bold text-amber-800 block mb-0.5">
                        ما استطاع المعالج قراءته من الخط:
                      </span>
                      <p className="text-base font-mono font-bold text-amber-950" dir="ltr">
                        {item.line_text_as_written && item.line_text_as_written.trim()
                          ? item.line_text_as_written
                          : 'خط غير مقروء'}
                      </p>
                    </div>
                    {item.written_instructions && (
                      <p className="text-sm font-semibold text-amber-900">
                        ملاحظة: {item.written_instructions}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // Legible Prescription Card (F15, F20)
          return (
            <button
              key={`rx_item_${idx}`}
              type="button"
              onClick={() => onSelectMedicine(item)}
              aria-label={`دواء ${item.medicine_name_ar || item.medicine_name_en}، اضغط لعرض التفاصيل`}
              className="w-full text-right bg-white hover:bg-teal-50/40 active:scale-[0.99] border-2 border-teal-600 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 group"
            >
              {/* Top row: Name & Badge */}
              <div className="flex items-start justify-between gap-3 w-full border-b border-teal-100 pb-3">
                <div>
                  <h3 className={`${headingClass} text-teal-900 leading-tight`}>
                    {item.medicine_name_ar || item.medicine_name_en}
                  </h3>
                  {item.medicine_name_en && (
                    <p className="text-sm font-mono font-bold text-slate-500 mt-0.5" dir="ltr">
                      {item.medicine_name_en}
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                    item.confidence === 'high'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {item.confidence === 'high' ? 'واضح' : 'غير مؤكد'}
                </span>
              </div>

              {/* Purpose */}
              {item.short_explanation && (
                <p className={`${bodyClass} font-semibold text-slate-700`}>
                  {item.short_explanation}
                </p>
              )}

              {/* ما كتبه الطبيب */}
              <div className="bg-teal-50/80 p-3.5 rounded-2xl border border-teal-200 w-full">
                <span className="text-xs font-bold text-teal-800 block mb-1">
                  ما كتبه الطبيب:
                </span>
                <p className="text-senior-base font-extrabold text-teal-950">
                  {item.written_instructions || 'بدون تعليمات إضافية'}
                </p>
              </div>

              {/* Tap Prompt */}
              <div className="flex items-center justify-between text-teal-700 text-sm font-extrabold pt-1">
                <span>عرض التفاصيل والدواعي والتحذيرات</span>
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. Medical Disclaimer Banner (F08) */}
      <DisclaimerBanner />

      {/* 5. Sticky Retake Action Button */}
      <div className="sticky bottom-20 z-20 pt-2 pb-4 bg-gradient-to-t from-[#F8F9FA] via-[#F8F9FA]/90 to-transparent">
        <button
          type="button"
          onClick={onRetake}
          className="btn-primary w-full min-h-[64px] sm:min-h-[72px] flex items-center justify-center gap-3 text-senior-xl font-extrabold shadow-xl bg-teal-700 hover:bg-teal-800"
          aria-label="تصوير روشتة أخرى"
        >
          <RotateCcw className="w-7 h-7" />
          <span>🔄 تصوير روشتة أخرى</span>
        </button>
      </div>
    </div>
  );
};
```

### Template 3.4: `src/components/PrescriptionFlow.tsx`
```tsx
import React, { useState } from 'react';
import { FileText, Camera, Image, AlertTriangle } from 'lucide-react';
import {
  PrescriptionAnalysisResult,
  PrescriptionItem,
  FontSizePreference,
  ErrorCategory
} from '../types';
import { capturePhoto, pickPhoto } from '../services/nativeCamera';
import { compressPrescriptionImage } from '../utils/imageProcessor';
import { analyzePrescriptionImage, AnalysisError } from '../services/geminiVision';
import { LoadingSpinner } from './LoadingSpinner';
import { UnclearPhotoCard } from './UnclearPhotoCard';
import { PrescriptionResultView } from './PrescriptionResultView';
import { MedicineDetailsModal } from './MedicineDetailsModal';

export interface PrescriptionFlowProps {
  fontSize: FontSizePreference;
  onFontSizeChange: (size: FontSizePreference) => void;
  disabled?: boolean;
}

export const PrescriptionFlow: React.FC<PrescriptionFlowProps> = ({
  fontSize,
  onFontSizeChange,
  disabled = false,
}) => {
  const [status, setStatus] = useState<'idle' | 'processing' | 'result' | 'unclear'>('idle');
  const [result, setResult] = useState<PrescriptionAnalysisResult | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCategory, setErrorCategory] = useState<ErrorCategory | undefined>(undefined);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [selectedMedicine, setSelectedMedicine] = useState<PrescriptionItem | null>(null);

  const processPrescriptionFile = async (file: File) => {
    setStatus('processing');
    setLastFile(file);
    setErrorMessage(null);
    setErrorCategory(undefined);
    setErrorCode(undefined);

    try {
      // High-res 1600px compression
      const compressed = await compressPrescriptionImage(file);

      // Edge analysis
      const analysis = await analyzePrescriptionImage(compressed.base64);

      if (!analysis.is_clear || !analysis.items || analysis.items.length === 0) {
        setResult(analysis);
        setErrorCategory(analysis.error_category || 'unclear_image');
        setErrorCode(analysis.error_code);
        setErrorMessage(analysis.retake_message || analysis.raw_error || 'لم نتمكن من قراءة الروشتة بوضوح.');
        setStatus('unclear');
        return;
      }

      setResult(analysis);
      setStatus('result');
    } catch (err: unknown) {
      if (err instanceof AnalysisError) {
        setErrorCategory(err.category);
        setErrorCode(err.errorCode);
        setErrorMessage(err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الروشتة.';
        setErrorCategory('server_error');
        setErrorMessage(msg);
      }
      setStatus('unclear');
    }
  };

  const handleCameraCapture = async () => {
    if (disabled || status === 'processing') return;
    try {
      const file = await capturePhoto();
      if (file) {
        await processPrescriptionFile(file);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'تعذر فتح الكاميرا');
    }
  };

  const handleGalleryPick = async () => {
    if (disabled || status === 'processing') return;
    try {
      const file = await pickPhoto();
      if (file) {
        await processPrescriptionFile(file);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'تعذر فتح ألبوم الصور');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setResult(null);
    setLastFile(null);
    setErrorMessage(null);
    setSelectedMedicine(null);
  };

  const handleRetrySameImage = async () => {
    if (lastFile) {
      await processPrescriptionFile(lastFile);
    } else {
      handleReset();
    }
  };

  return (
    <div dir="rtl" className="w-full text-right space-y-6">
      {/* 1. Processing Loading State */}
      {status === 'processing' && (
        <LoadingSpinner message="جاري قراءة الروشتة الطبية... يرجى الانتظار قليلاً" />
      )}

      {/* 2. Unclear / Error State */}
      {status === 'unclear' && (
        <UnclearPhotoCard
          onRetry={handleRetrySameImage}
          onRetake={handleReset}
          errorMessage={errorMessage || undefined}
          errorCategory={errorCategory}
          errorCode={errorCode}
          hasLastImage={Boolean(lastFile)}
        />
      )}

      {/* 3. Idle State (Dual Buttons: Camera & Gallery) */}
      {status === 'idle' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border-2 border-blue-600 rounded-3xl p-6 shadow-xs">
            <h2 className="text-senior-xl font-bold text-blue-900 mb-2">
              📋 قراءة الروشتة الطبية
            </h2>
            <p className="text-senior-base text-slate-800 leading-relaxed font-medium">
              التقط صورة واضحة للروشتة أو اخترها من ألبوم الصور لقراءة أسماء الأدوية المكتوبة وشرح ما دونه الطبيب بدقة.
            </p>
          </div>

          {errorMessage && (
            <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 text-amber-600" />
              <p className="text-senior-base font-bold">{errorMessage}</p>
            </div>
          )}

          {/* Dual Action Controls (F09) */}
          <div className="space-y-4">
            {/* Primary Action: صوّر الروشتة */}
            <button
              type="button"
              disabled={disabled}
              onClick={handleCameraCapture}
              className="w-full min-h-[96px] bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-3xl p-6 flex items-center justify-between shadow-md transition-all group"
              aria-label="صوّر الروشتة"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Camera className="w-9 h-9 text-white" />
                </div>
                <div className="text-right">
                  <h3 className="text-senior-xl font-black">صوّر الروشتة</h3>
                  <p className="text-sm text-blue-100 font-semibold mt-0.5">
                    استخدم الكاميرا لالتقاط صورة فورية
                  </p>
                </div>
              </div>
            </button>

            {/* Secondary Action: اختر من المعرض */}
            <button
              type="button"
              disabled={disabled}
              onClick={handleGalleryPick}
              className="w-full min-h-[64px] bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-800 border-2 border-slate-300 rounded-2xl p-4 flex items-center justify-center gap-3 text-senior-base font-bold shadow-xs transition-all"
              aria-label="اختر من المعرض"
            >
              <Image className="w-6 h-6 text-slate-600" />
              <span>اختر من المعرض</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Result View */}
      {status === 'result' && result && (
        <PrescriptionResultView
          result={result}
          fontSize={fontSize}
          onRetake={handleReset}
          onSelectMedicine={(item) => setSelectedMedicine(item)}
          onFontSizeChange={onFontSizeChange}
        />
      )}

      {/* 5. Medicine Details Modal */}
      <MedicineDetailsModal
        item={selectedMedicine}
        isOpen={Boolean(selectedMedicine)}
        onClose={() => setSelectedMedicine(null)}
        fontSize={fontSize}
      />
    </div>
  );
};
```

### Template 3.5: Updates to `src/components/ResultCards.tsx`
Add `usage_source` badge and `HARDCODED_DISCLAIMER_LINE` to Card 3:
```tsx
// Inside Card 3 of ResultCards.tsx:
        <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Clock className={`${iconSizeClass} text-emerald-700`} aria-hidden="true" />
            </div>
            <div>
              <span className="text-emerald-700 font-bold text-sm block">البطاقة الثالثة</span>
              <h2 className={`${headingClass} text-emerald-900`}>
                طريقة الاستخدام وأفضل المواعيد
              </h2>
            </div>
          </div>
          {/* F22 Usage Source Badge */}
          {result.usage_source && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${
                result.usage_source === 'printed'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-blue-100 text-blue-800 border-blue-300'
              }`}
            >
              {result.usage_source === 'printed' ? 'مكتوب على العلبة' : 'الاستخدام الشائع'}
            </span>
          )}
        </div>

        {/* Existing instructions loop ... */}

        {/* F23 Hardcoded Arabic Disclaimer Line */}
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-right">
          <p className="text-slate-600 text-base font-semibold leading-relaxed" dir="rtl">
            هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي.
          </p>
        </div>
```

### Template 3.6: Updates to `src/components/UnclearPhotoCard.tsx`
Ensure 3 standardized tips for F19:
```tsx
      {/* 3 Tips for F19 */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200 mb-6 space-y-3">
        <div className="flex items-center gap-3 text-slate-800">
          <SunMedium className="w-7 h-7 text-amber-600 flex-shrink-0" />
          <span className="text-senior-base font-semibold">التأكد من إضاءة الغرفة بشكل كافٍ</span>
        </div>
        <div className="flex items-center gap-3 text-slate-800">
          <Focus className="w-7 h-7 text-teal-600 flex-shrink-0" />
          <span className="text-senior-base font-semibold">إظهار الروشتة أو العلبة كاملة داخل الإطار</span>
        </div>
        <div className="flex items-center gap-3 text-slate-800">
          <Camera className="w-7 h-7 text-blue-600 flex-shrink-0" />
          <span className="text-senior-base font-semibold">تثبيت الهاتف باليدين وعدم الاهتزاز أثناء التصوير</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleRetake}
        className="btn-primary w-full min-h-[64px] flex items-center justify-center gap-3 text-senior-xl font-bold bg-teal-700 hover:bg-teal-800"
        aria-label="إعادة التصوير"
      >
        <RefreshCw className="w-7 h-7" />
        <span>إعادة التصوير</span>
      </button>
```

---

## 4. Caveats

1. **Camera Permissions on Mobile Native**:
   - `@capacitor/camera` triggers native dialogs. If user denies permission, graceful alerts must be caught and rendered as friendly Arabic alerts rather than throwing unhandled exceptions.
2. **Audio Speech Synthesis Cancellation**:
   - Whenever the user switches tabs, opens a modal, or hits "إعادة التصوير", `speechController.stop()` must be called to prevent overlapping voices or speech persisting in the background.
3. **Low-Confidence Items Rule**:
   - Low-confidence items (`confidence: 'low'`) must never display an accordion or trigger the details modal, because AI did not read a reliable medicine name.
4. **Offline Resilience**:
   - `fetchMedicineDetails` seamlessly relies on `detailsCache.ts` (`dalili_details_` prefix). If the device is offline, previously scanned or searched medicines open instantly from localStorage without network fetch.
5. **No Direct Code Modifications by Explorer**:
   - As an Explorer, this report documents exact component designs, prop interfaces, and ready-to-use templates for the Worker to implement in Milestone M4.

---

## 5. Conclusion

The technical architecture for Milestone M4 (Prescription UI & Details Flow) has been completely mapped and verified against existing types, backend edge routes, services, and all 40 test suites.

- The Worker can implement:
  1. `src/services/myMedicinesStorage.ts` (storage helper for `dalili_my_medicines_v1`)
  2. `src/components/PrescriptionFlow.tsx` (camera/gallery triggers, compression, state machine)
  3. `src/components/PrescriptionResultView.tsx` (advisory banner, whole-prescription audio read-aloud, amber low-confidence cards, clickable legible cards)
  4. `src/components/MedicineDetailsModal.tsx` (4-card modal with "أضف لأدويتي")
  5. Updates to `src/components/ResultCards.tsx` (F22 badge and F23 hardcoded disclaimer)
  6. Updates to `src/components/UnclearPhotoCard.tsx` (F19 3 tips and retry button)
  7. Updates to `src/App.tsx` (wiring `PrescriptionFlow` and "أدويتي" tab list)

All contracts, button labels, icons, styling rules, and accessibility constraints are fully aligned with `PROJECT.md` and `TEST_READY.md`.

---

## 6. Verification Method

To verify the implementation independently after Worker changes:

1. **Vitest Full Test Suite**:
   ```powershell
   npx.cmd vitest run
   ```
   *Expected*: All 40 test files pass (1021+ tests), with zero regressions.

2. **Targeted E2E Prescription Test Suites**:
   ```powershell
   npx.cmd vitest run tests/e2e/tier1_features/prescription_presentation.test.ts
   npx.cmd vitest run tests/e2e/tier1_features/prescription_pipeline.test.ts
   npx.cmd vitest run tests/e2e/tier2_boundaries/prescription_presentation_boundary.test.ts
   npx.cmd vitest run tests/e2e/tier2_boundaries/prescription_pipeline_boundary.test.ts
   npx.cmd vitest run tests/e2e/tier3_combinations/cross_feature_combinations.test.ts
   npx.cmd vitest run tests/e2e/tier4_scenarios/real_world_scenarios.test.ts
   ```

3. **Production Build Compilation**:
   ```powershell
   npm.cmd run build
   ```
   *Expected*: Zero TypeScript errors, clean bundle output in `dist/`.

4. **Secret Scan Check**:
   ```powershell
   npx.cmd vitest run tests/secretScan.test.ts
   ```
   *Expected*: Confirms zero API keys or secrets exist in client source code.
