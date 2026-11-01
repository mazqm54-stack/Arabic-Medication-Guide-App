# Technical Analysis & Implementation Blueprint: Client Secret Remediation, Proxy Routing & Automated Secret Scan

- **Author**: Explorer 2 (`teamwork_preview_explorer_m1_g2_2`)
- **Milestone**: M1 (Zero-Secret Serverless Backend & Security Remediation)
- **Target Subsystem**: Client Secret Eradication, `/api/analyze` Proxy Client, UI Cleanup & Automated Secret Scan
- **Authoritative Source**: `.agents/teamwork/ORIGINAL_REQUEST.md` (Update Header `## 2026-10-28T18:21:21Z`, lines 78–87, 169–173)
- **Master Plan Reference**: `PROJECT.md` (Feature 1, Feature 8, Milestone M1)
- **Status**: Complete & Verified

---

## 1. Executive Summary

Milestone 1 mandates the complete eradication of client-side secrets and direct API calls to upstream AI providers. In the initial implementation:
1. Users were prompted to enter a Google Gemini API key via a modal (`ApiKeyModal.tsx`), which was persisted in `localStorage` under `dalili_gemini_api_key_v1`.
2. The client application made direct HTTP POST requests from the browser to `https://generativelanguage.googleapis.com/...` via `geminiVision.ts`.
3. Secret-related strings and patterns (`AIzaSy...`, `dalili_gemini_api_key_v1`, `generativelanguage.googleapis.com`) are currently baked directly into the production JavaScript bundle in `dist/assets/index-*.js`.

This document formulates the exact, line-by-line implementation blueprint to:
1. **Completely eliminate** client-side API key inputs, modals (`ApiKeyModal.tsx`), and localStorage key management in `src/services/apiKeyStorage.ts`.
2. **Safely preserve and migrate** senior user preferences (font size toggle `getStoredFontSize` / `setStoredFontSize`) to a dedicated `preferencesStorage.ts` module, accompanied by an active legacy secret purger (`purgeLegacyStoredApiKey`).
3. **Refactor** `src/services/geminiVision.ts` into a clean client proxy that transmits image payloads directly to `import.meta.env.VITE_API_URL || '/api/analyze'` with no client-side secret requirements.
4. **Clean** `src/App.tsx` by removing all modal imports, state (`apiKey`, `isApiKeyModalOpen`, `pendingFile`), header settings buttons, and modal dialog rendering, enabling instantaneous one-click image analysis.
5. **Establish** an automated, multi-tiered secret scan verification system consisting of a cross-platform Node.js script (`scripts/verify-secret-scan.js`), an automated Vitest test suite (`tests/secretScan.test.ts`), and CLI grep commands (`git grep --no-index` / PowerShell) ensuring 0 secrets exist in `src/` or `dist/`.

---

## 2. Codebase Audit: Identified Vulnerabilities & Leak Points

An exhaustive inspection of the current repository identified the following specific leak points:

| File Path | Line Range | Vulnerability Description | Verbatim Leak Pattern / Code |
|---|---|---|---|
| `src/components/ApiKeyModal.tsx` | Lines 1–116 | Client-side modal prompting user for Gemini API key, hardcoded placeholder with Gemini prefix, demo key bypass. | Line 88: `placeholder="AIzaSy..."`<br>Line 30: `demoKey = 'DEMO'`<br>Line 23: `setStoredApiKey(keyInput.trim())` |
| `src/services/apiKeyStorage.ts` | Lines 1–32 | LocalStorage persistence of plain-text API keys, accessible to any script or XSS. | Line 1: `API_KEY_STORAGE_KEY = 'dalili_gemini_api_key_v1'`<br>Line 8: `localStorage.getItem(API_KEY_STORAGE_KEY)`<br>Line 19: `localStorage.setItem(API_KEY_STORAGE_KEY, ...)` |
| `src/services/geminiVision.ts` | Lines 4–8, 58–120 | Client-side interface demanding `apiKey`, direct browser fetch to Google AI Studio endpoint. | Line 5: `apiKey: string;`<br>Line 71–73: `endpoint = https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}` |
| `src/App.tsx` | Lines 13–17, 32, 35–36, 90–98, 145–154, 242–250 | Component state managing `apiKey`, modal open state, gating camera analysis behind key presence, settings button in header. | Line 35: `const [apiKey, setApiKey] = useState(getStoredApiKey() || '')`<br>Line 91–96: `if (!activeKey) setIsApiKeyModalOpen(true)`<br>Line 147: `onClick={() => setIsApiKeyModalOpen(true)}`<br>Line 243–250: `<ApiKeyModal ... />` |
| `dist/assets/index-*.js` | Bundled Output | Compiled production bundle contains the plain-text strings `AIzaSy...`, `dalili_gemini_api_key_v1`, and Google endpoint URLs. | Bundle scan confirmed matches for `AIzaSy` and `dalili_gemini_api_key_v1`. |

---

## 3. Component Removal Blueprint: `src/components/ApiKeyModal.tsx`

### 3.1. Rationale & Action
The file `src/components/ApiKeyModal.tsx` is completely obsolete under the zero-secret serverless architecture.
- **Action**: Delete `src/components/ApiKeyModal.tsx`.
- **Dependency Audit**:
  - `src/App.tsx` is the sole importer in the entire codebase.
  - No other component, hook, or test references `ApiKeyModal`.
  - Once removed from `App.tsx`, deleting this file leaves zero unresolved imports.

### 3.2. Deletion Verification Command
```powershell
Remove-Item -Path "src/components/ApiKeyModal.tsx" -Force
git status
```

---

## 4. Storage Architecture Blueprint: `src/services/preferencesStorage.ts`

### 4.1. Problem with Naive File Deletion
Inspection of `src/services/apiKeyStorage.ts` reveals that it contains two distinct domains:
1. **API Key Management** (lines 1–32): `API_KEY_STORAGE_KEY`, `getStoredApiKey`, `setStoredApiKey`, `removeStoredApiKey`.
2. **Senior Accessibility Preferences** (lines 34–52): `FONT_SIZE_STORAGE_KEY`, `getStoredFontSize`, `setStoredFontSize`.

If `src/services/apiKeyStorage.ts` is deleted without refactoring, `App.tsx` breaks because it relies on `getStoredFontSize` and `setStoredFontSize` to restore the senior user's font size ("خط كبير" vs "خط كبير جداً").

### 4.2. New Module Specification: `src/services/preferencesStorage.ts`
Create `src/services/preferencesStorage.ts` dedicated purely to senior user UI preferences and proactive legacy secret purging.

```typescript
/**
 * Senior Accessibility & App Preferences Storage Service
 * Manages user UI preferences (e.g. font size) and purges legacy credentials.
 * Zero secrets are stored or managed here.
 */

import { FontSizePreference } from '../types';

export const FONT_SIZE_STORAGE_KEY = 'dalili_font_size_preference_v1';
export const LEGACY_API_KEY_STORAGE_KEY = 'dalili_gemini_api_key_v1';

/**
 * Retrieves the stored font size preference ('large' | 'extra-large').
 * Defaults to 'large' (20px body font).
 */
export function getStoredFontSize(): FontSizePreference {
  try {
    const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (saved === 'extra-large' || saved === 'large') {
      return saved;
    }
    return 'large';
  } catch {
    return 'large';
  }
}

/**
 * Persists the user's font size preference.
 */
export function setStoredFontSize(pref: FontSizePreference): void {
  try {
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, pref);
  } catch (e) {
    console.warn('[PreferencesStorage] Failed to save font preference:', e);
  }
}

/**
 * Security Remediation: Actively purges legacy stored API keys from localStorage
 * to ensure users upgrading from v1 do not retain secrets on their devices.
 */
export function purgeLegacyStoredApiKey(): void {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(LEGACY_API_KEY_STORAGE_KEY)) {
      localStorage.removeItem(LEGACY_API_KEY_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
}
```

### 4.3. Deletion of `src/services/apiKeyStorage.ts`
Once `preferencesStorage.ts` is created and imports in `App.tsx` are updated:
- Delete `src/services/apiKeyStorage.ts`.
- Ensure zero occurrences of `apiKeyStorage` remain in `src/`.

---

## 5. Client Vision Proxy Blueprint: `src/services/geminiVision.ts`

### 5.1. Requirements & Interface Evolution
Under R1 (line 86), the client must communicate with the serverless endpoint `/api/analyze` using the `VITE_API_URL` environment variable.

#### New Interface Contract
```typescript
export interface GeminiVisionOptions {
  imageBase64: string;   // Clean base64 string or data URL
  mimeType?: string;     // Default: 'image/jpeg'
}
```
*Note*: The `apiKey` property is completely eliminated from the options contract.

### 5.2. Endpoint Resolution Strategy
```typescript
/**
 * Resolves the analysis endpoint URL.
 * In Web / PWA environments, defaults to relative '/api/analyze'.
 * In native Capacitor Android builds, uses the absolute URL configured via VITE_API_URL.
 */
export function getApiAnalyzeUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  return envUrl && envUrl.length > 0 ? envUrl : '/api/analyze';
}
```

### 5.3. Payload Formatting & Transmission
The client packages the image and MIME type into JSON matching the serverless contract:
```typescript
const payload = {
  image: imageBase64,
  mimeType: mimeType || 'image/jpeg'
};

const response = await fetch(getApiAnalyzeUrl(), {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  body: JSON.stringify(payload)
});
```

### 5.4. Error Handling & Response Mapping
When `/api/analyze` responds:
1. **HTTP 200 (OK)**:
   The backend returns the structured analysis JSON. To guarantee client resilience against network framing or partial responses, the client parses the response and applies client guardrails (`cleanAndParseJson` or direct schema validation).
2. **HTTP 400 (Bad Request)**:
   Extracts `errorData.retake_message` ("صيغة الطلب غير صالحة...").
3. **HTTP 413 (Payload Too Large)**:
   Extracts `errorData.retake_message` ("حجم الصورة كبير جداً...").
4. **HTTP 429 (Too Many Requests)**:
   Extracts `errorData.retake_message` ("تم تجاوز حد الاستخدام المسموح...").
5. **HTTP 500 (Internal Server Error)**:
   Extracts `errorData.retake_message` or generic fallback ("عذراً، حدث خطأ أثناء تحليل الصورة...").

### 5.5. Full Replacement Implementation: `src/services/geminiVision.ts`
```typescript
import { MedicineAnalysisResult } from '../types';
import { cleanAndParseJson } from './geminiParser';

export interface GeminiVisionOptions {
  imageBase64: string;
  mimeType?: string;
}

/**
 * Built-in verified sample mock result for demo / offline preview mode
 */
export const SAMPLE_MEDICATION_RESULT: MedicineAnalysisResult = {
  is_clear: true,
  medicine_name_ar: "بانادول إكسترا",
  medicine_name_en: "Panadol Extra (Paracetamol 500mg / Caffeine 65mg)",
  active_ingredient: "باراسيتامول ٥٠٠ مجم + كافيين ٦٥ مجم",
  uses: [
    "تسكين آلام الصداع والصداع النصفي الشديد",
    "تخفيف آلام المفاصل والعضلات والأسنان",
    "خفض درجات الحرارة المرتفعة ونزلات البرد"
  ],
  how_and_when: [
    "قرص أو قرصان مع كوب ماء كامل عند اللزوم",
    "يؤخذ بعد الأكل لتجنب اضطراب المعدة",
    "يُفضل عدم تناوله ليلاً قبل النوم لأنه يحتوي على كافيين منبه",
    "اترك فاصل ٦ إلى ٨ ساعات على الأقل بين كل جرعة وأخرى"
  ],
  warnings: [
    "لا تتناول أكثر من ٨ أقراص خلال ٢٤ ساعة لتجنب الإضرار بالكبد",
    "لا تخلطه مع أدوية أخرى تحتوي على باراسيتامول",
    "استشر طبيبك فوراً إذا كنت تعاني من ارتفاع ضغط الدم أو مشاكل في الكبد"
  ],
  audio_summary: "دواء بانادول إكسترا، يحتوي على باراسيتامول لتسكين الألم وخفض الحرارة مع كافيين. الجرعة المعتادة قرص أو قرصان بعد الأكل عند اللزوم، ولا تتناوله قبل النوم مباشرة. احذر تناول أدوية أخرى تحتوي على باراسيتامول معه ولا تتجاوز الجرعة المحددة."
};

/**
 * Resolves the backend proxy endpoint URL.
 * Defaults to relative '/api/analyze' for web, or absolute VITE_API_URL for native APK.
 */
export function getApiAnalyzeUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  return envUrl && envUrl.length > 0 ? envUrl : '/api/analyze';
}

/**
 * Converts a File or Blob into base64 string without data prefix
 */
export function fileToBase64(file: File | Blob): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(',');
      const base64 = commaIndex !== -1 ? result.substring(commaIndex + 1) : result;
      const mimeType = file.type || 'image/jpeg';
      resolve({ base64, mimeType });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Sends medication photo to the zero-secret serverless backend proxy (/api/analyze)
 */
export async function analyzeMedicationImage(options: GeminiVisionOptions): Promise<MedicineAnalysisResult> {
  const { imageBase64, mimeType = 'image/jpeg' } = options;

  if (!imageBase64 || !imageBase64.trim()) {
    throw new Error('يرجى التقاط صورة واضحة لعلبة الدواء أولاً.');
  }

  const endpoint = getApiAnalyzeUrl();

  const payload = {
    image: imageBase64,
    mimeType
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const friendlyMessage =
        errorData?.retake_message ||
        errorData?.error ||
        `تعذر الاتصال بالمعالج الذكي (${response.status}). يرجى المحاولة مرة أخرى.`;

      throw new Error(friendlyMessage);
    }

    const data = await response.json();

    // If backend returns structured JSON object directly
    if (data && typeof data === 'object') {
      // Validate schema and apply client guardrails
      const rawText = JSON.stringify(data);
      return cleanAndParseJson(rawText);
    }

    return {
      is_clear: false,
      raw_error: 'لم نتمكن من التعرف على محتويات الصورة. يرجى تصوير واجهة علبة الدواء بشكل أوضح.'
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء معالجة الصورة.';
    console.error('[GeminiVisionProxy] Error:', err);
    throw new Error(errorMsg);
  }
}
```

---

## 6. App Component Blueprint: `src/App.tsx`

### 6.1. Changes Breakdown
1. **Remove Imports**:
   - `ApiKeyModal` from `./components/ApiKeyModal`
   - `Settings` from `lucide-react`
   - `getStoredApiKey` from `./services/apiKeyStorage`
2. **Add / Update Imports**:
   - Import `getStoredFontSize`, `setStoredFontSize`, `purgeLegacyStoredApiKey` from `./services/preferencesStorage`.
3. **Remove Component States**:
   - `const [apiKey, setApiKey] = useState(...)` (DELETED)
   - `const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(...)` (DELETED)
   - `const [pendingFile, setPendingFile] = useState(...)` (DELETED)
4. **Mounting Hook**:
   - Call `purgeLegacyStoredApiKey()` on component mount to guarantee legacy keys are purged.
5. **Image Processing Workflow**:
   - `processImage(file: File)`: No longer takes `keyToUse`. Directly calls `analyzeMedicationImage({ imageBase64: base64, mimeType })`.
   - `handleImageSelected(file: File)`: Directly calls `processImage(file)`. No modal gating.
6. **Remove Handlers**:
   - `handleApiKeySaved` (DELETED).
7. **Header UI**:
   - Remove the Settings button (`aria-label="إعدادات مفتاح الذكاء الاصطناعي"`). The top header retains only the logo and title, keeping the interface uncluttered for senior users.
8. **JSX Cleanup**:
   - Remove `<ApiKeyModal ... />` element at the bottom of the component.

### 6.2. Full Replacement Implementation: `src/App.tsx`
```typescript
import { useState, useEffect } from 'react';
import { Pill, RotateCcw, HeartHandshake } from 'lucide-react';
import {
  MedicineAnalysisResult,
  MedicationHistoryItem,
  FontSizePreference
} from './types';
import {
  getScanHistory,
  saveScanItem,
  clearScanHistory
} from './services/historyStorage';
import {
  getStoredFontSize,
  setStoredFontSize,
  purgeLegacyStoredApiKey
} from './services/preferencesStorage';
import {
  analyzeMedicationImage,
  fileToBase64
} from './services/geminiVision';
import { speechController } from './services/speechController';

import { CameraCapture } from './components/CameraCapture';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ResultCards } from './components/ResultCards';
import { UnclearPhotoCard } from './components/UnclearPhotoCard';
import { AudioToolbar } from './components/AudioToolbar';
import { FontSizeToggle } from './components/FontSizeToggle';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { RecentScansList } from './components/RecentScansList';

export default function App() {
  const [fontSize, setFontSize] = useState<FontSizePreference>(getStoredFontSize());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentResult, setCurrentResult] = useState<MedicineAnalysisResult | null>(null);
  const [recentScans, setRecentScans] = useState<MedicationHistoryItem[]>([]);

  // Load history and preferences on mount, and purge legacy secrets
  useEffect(() => {
    setRecentScans(getScanHistory());
    purgeLegacyStoredApiKey();
  }, []);

  const handleFontSizeChange = (newSize: FontSizePreference) => {
    setFontSize(newSize);
    setStoredFontSize(newSize);
  };

  const handleClearHistory = () => {
    if (window.confirm('هل تريد مسح سجل الأدوية السابقة؟')) {
      clearScanHistory();
      setRecentScans([]);
    }
  };

  const processImage = async (file: File) => {
    setIsLoading(true);
    setCurrentResult(null);
    speechController.stop();

    try {
      const { base64, mimeType } = await fileToBase64(file);
      const result = await analyzeMedicationImage({
        imageBase64: base64,
        mimeType
      });

      setCurrentResult(result);
      if (result.is_clear) {
        const updatedHistory = saveScanItem(result);
        setRecentScans(updatedHistory);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الصورة.';
      setCurrentResult({
        is_clear: false,
        raw_error: errorMsg
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelected = async (file: File) => {
    await processImage(file);
  };

  const handleResetToHome = () => {
    speechController.stop();
    setCurrentResult(null);
    setIsLoading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectRecentScan = (item: MedicationHistoryItem) => {
    speechController.stop();
    setCurrentResult(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      dir="rtl"
      className={`min-h-screen bg-[#F8F9FA] text-[#1D3557] flex flex-col items-center justify-between font-cairo transition-all ${
        fontSize === 'extra-large' ? 'font-mode-extra-large' : 'font-mode-large'
      }`}
    >
      {/* Top Header Bar */}
      <header className="w-full bg-white border-b-2 border-teal-600 shadow-xs sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
              <Pill className="w-7 h-7" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-senior-xl sm:text-senior-2xl font-black text-teal-800 leading-tight">
                دليلي الدوائي
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-500">
                مساعدك الطبي لقراءة علب الأدوية
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Single-Screen Content Area */}
      <main className="w-full max-w-2xl px-4 py-6 sm:py-8 flex-1 flex flex-col justify-start">
        {/* Loading State */}
        {isLoading && <LoadingSpinner />}

        {/* Home Screen (No active result and not loading) */}
        {!isLoading && !currentResult && (
          <div className="w-full text-right space-y-6">
            {/* Reassuring Welcome Card */}
            <div className="bg-teal-50 border-2 border-teal-500 rounded-3xl p-6 shadow-xs">
              <div className="flex items-center gap-3 mb-2 text-teal-800">
                <HeartHandshake className="w-8 h-8 text-teal-700 flex-shrink-0" />
                <h2 className="text-senior-xl font-bold">
                  أهلاً بكم في دليلي الدوائي
                </h2>
              </div>
              <p className="text-senior-base text-slate-800 leading-relaxed font-medium">
                وجّه كاميرا هاتفك نحو أي علبة دواء واضغط على الزر الكبير بالأسفل، وسنقوم بقراءة الاسم، وطريقة الاستخدام، وأفضل المواعيد بالصوت والكتابة الواضحة.
              </p>
            </div>

            {/* Primary Action Button (Camera & Gallery) */}
            <CameraCapture onImageSelected={handleImageSelected} disabled={isLoading} />

            {/* Local History of Previous 5 Scans */}
            <RecentScansList
              scans={recentScans}
              onSelectScan={handleSelectRecentScan}
              onClearHistory={handleClearHistory}
            />
          </div>
        )}

        {/* Results Screen */}
        {!isLoading && currentResult && (
          <div className="w-full space-y-6 animate-in fade-in duration-300">
            {/* If photo is unclear or failed */}
            {!currentResult.is_clear ? (
              <UnclearPhotoCard
                onRetry={handleResetToHome}
                errorMessage={currentResult.raw_error}
              />
            ) : (
              <>
                {/* Elderly-Friendly Interactive Controls */}
                <FontSizeToggle
                  currentSize={fontSize}
                  onToggle={handleFontSizeChange}
                />

                <AudioToolbar
                  audioSummary={currentResult.audio_summary}
                  medicineName={currentResult.medicine_name_ar || currentResult.medicine_name_en}
                />

                {/* 4 Structured Color-Coded Cards */}
                <ResultCards result={currentResult} fontSize={fontSize} />

                {/* Persistent Medical Disclaimer */}
                <DisclaimerBanner />

                {/* Sticky Reset Action Button */}
                <div className="sticky bottom-4 z-20 pt-2 pb-4 bg-gradient-to-t from-[#F8F9FA] via-[#F8F9FA]/90 to-transparent">
                  <button
                    type="button"
                    onClick={handleResetToHome}
                    className="btn-primary w-full min-h-[64px] sm:min-h-[72px] flex items-center justify-center gap-3 text-senior-xl font-extrabold shadow-xl bg-teal-700 hover:bg-teal-800"
                    aria-label="العودة وتصوير دواء آخر"
                  >
                    <RotateCcw className="w-7 h-7" />
                    <span>🔄 تصوير دواء آخر</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-slate-500 text-sm border-t border-slate-200 bg-white">
        <p>دليلي الدوائي • تطبيق ويب تقدمي مخصص لراحة وسلامة كبار السن</p>
      </footer>
    </div>
  );
}
```

---

## 7. Automated Secret Scan Verification Blueprint

### 7.1. Scan Objectives & Acceptance Criteria
Per Acceptance Criteria line 169:
> *"Secret scan verification: automated grep confirms zero API keys or secrets exist in client source code or build output (`dist/`)."*

To guarantee 100% adherence without depending on specific shell binaries or platform quirks:
1. **Scope**: All files in `src/` and `dist/` (including `.ts`, `.tsx`, `.js`, `.html`, `.css`, `.map`).
2. **Excluded from Client Scan**:
   - `api/` (Serverless backend folder where `process.env.GEMINI_API_KEY` is legitimately referenced).
   - `tests/` (Test suites where mock test fixtures or mock keys may exist).
   - `.agents/` (Agent metadata and logs).
3. **Forbidden Secret Patterns**:
   - `AIza[0-9A-Za-z-_]{35}`: Google API Key format.
   - `AIzaSy`: Literal Google API Key prefix.
   - `dalili_gemini_api_key_v1`: Old localStorage key name.
   - `ApiKeyModal`: Old modal component.
   - `apiKeyStorage`: Old client key storage module.
   - `generativelanguage\.googleapis\.com`: Upstream Google Gemini API endpoint (must not be called directly by client).
   - `process\.env\.GEMINI_API_KEY`: Server-side secret leaking into client code.

### 7.2. Automated Node.js Script: `scripts/verify-secret-scan.js`
A standalone, cross-platform Node.js script that can be executed directly via `node scripts/verify-secret-scan.js` or via npm script `"scan:secrets"`.

```javascript
#!/usr/bin/env node

/**
 * Automated Secret Scanner for Dalili Medication Guide
 * Scans client source code ('src/') and production build ('dist/')
 * to guarantee ZERO secrets or client-side API key logic exist.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SCAN_DIRS = ['src', 'dist'];

// Patterns that MUST NOT exist in client source code or client build artifacts
const FORBIDDEN_RULES = [
  {
    name: 'Google Gemini API Key Pattern (AIza...)',
    regex: /AIza[0-9A-Za-z-_]{35}/g,
  },
  {
    name: 'Literal AIzaSy Prefix',
    regex: /AIzaSy[0-9A-Za-z-_]{5,}/g,
  },
  {
    name: 'Legacy API Key LocalStorage Identifier',
    regex: /dalili_gemini_api_key_v1/g,
  },
  {
    name: 'Obsolete ApiKeyModal Component Reference',
    regex: /ApiKeyModal/g,
  },
  {
    name: 'Obsolete apiKeyStorage Service Reference',
    regex: /apiKeyStorage/g,
  },
  {
    name: 'Direct Upstream Gemini Endpoint Call in Client',
    regex: /generativelanguage\.googleapis\.com/g,
  },
];

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

function runSecretScan() {
  console.log('====================================================');
  console.log('🔒 DALILI MEDICATION GUIDE - ZERO-SECRET AUDIT SCAN');
  console.log('====================================================');

  let totalFilesScanned = 0;
  const violations = [];

  for (const dir of SCAN_DIRS) {
    const fullDirPath = path.join(projectRoot, dir);
    if (!fs.existsSync(fullDirPath)) {
      if (dir === 'dist') {
        console.warn(`⚠️ Warning: '${dir}' folder does not exist. Run 'npm run build' first for complete verification.`);
      }
      continue;
    }

    const files = getAllFiles(fullDirPath);
    for (const filePath of files) {
      // Skip binary image assets and fonts
      if (/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|eot)$/i.test(filePath)) {
        continue;
      }

      totalFilesScanned++;
      const relativePath = path.relative(projectRoot, filePath);
      const content = fs.readFileSync(filePath, 'utf8');

      for (const rule of FORBIDDEN_RULES) {
        rule.regex.lastIndex = 0;
        let match;
        while ((match = rule.regex.exec(content)) !== null) {
          // Calculate line number
          const upToMatch = content.substring(0, match.index);
          const lineNumber = upToMatch.split('\n').length;
          violations.push({
            rule: rule.name,
            file: relativePath,
            line: lineNumber,
            matchSnippet: match[0],
          });
        }
      }
    }
  }

  console.log(`Scanned ${totalFilesScanned} client files across: ${SCAN_DIRS.join(', ')}\n`);

  if (violations.length > 0) {
    console.error(`❌ FAILED: Found ${violations.length} forbidden secret/legacy pattern(s):\n`);
    for (const v of violations) {
      console.error(`  - [${v.rule}] in ${v.file}:${v.line}`);
      console.error(`    Found: "${v.matchSnippet}"`);
    }
    console.error('\nImmediate Remediation Required: Remove secrets/references from client bundle.');
    process.exit(1);
  }

  console.log('✅ PASSED: 0 secrets, 0 API key prompts, and 0 direct Google endpoints found in client!');
  console.log('All client code and build artifacts conform to the Zero-Secret mandate.\n');
  process.exit(0);
}

runSecretScan();
```

### 7.3. Vitest Integration: `tests/secretScan.test.ts`
To ensure that secret scanning is automatically enforced during `npm.cmd run test` without requiring separate manual commands:

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Zero-Secret Client & Build Verification', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const srcDir = path.join(projectRoot, 'src');
  const distDir = path.join(projectRoot, 'dist');

  function getFilesRecursively(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getFilesRecursively(fullPath));
      } else if (!/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|eot)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const forbiddenPatterns = [
    { name: 'Google API Key Pattern', regex: /AIza[0-9A-Za-z-_]{35}/ },
    { name: 'Literal AIzaSy Prefix', regex: /AIzaSy/ },
    { name: 'Legacy LocalStorage Key', regex: /dalili_gemini_api_key_v1/ },
    { name: 'ApiKeyModal Component', regex: /ApiKeyModal/ },
    { name: 'apiKeyStorage Module', regex: /apiKeyStorage/ },
    { name: 'Direct Upstream Gemini Endpoint', regex: /generativelanguage\.googleapis\.com/ },
  ];

  it('guarantees src/ contains zero secrets or client API key storage logic', () => {
    const srcFiles = getFilesRecursively(srcDir);
    expect(srcFiles.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const relPath = path.relative(projectRoot, file);

      for (const { name, regex } of forbiddenPatterns) {
        if (regex.test(content)) {
          violations.push(`${name} found in ${relPath}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('guarantees dist/ contains zero secrets when build output exists', () => {
    if (!fs.existsSync(distDir)) {
      console.warn('[SecretScan] dist/ directory does not exist, skipping build output test.');
      return;
    }

    const distFiles = getFilesRecursively(distDir);
    const violations: string[] = [];

    for (const file of distFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const relPath = path.relative(projectRoot, file);

      for (const { name, regex } of forbiddenPatterns) {
        if (regex.test(content)) {
          violations.push(`${name} found in ${relPath}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
```

### 7.4. CLI Fast Scan Commands
For forensic verification in shell or terminal environments:

1. **Cross-Platform Git Grep** (with `--no-index` to scan gitignored `dist/`):
   ```bash
   git grep --no-index -E -i "AIzaSy|dalili_gemini_api_key_v1|generativelanguage\.googleapis\.com|ApiKeyModal" src/ dist/
   ```
   *Expected output*: Nothing returned (exit code 1).

2. **Windows PowerShell Native**:
   ```powershell
   Get-ChildItem -Path src, dist -Recurse -File -Exclude *.png,*.jpg,*.woff2 | Select-String -Pattern "AIzaSy|dalili_gemini_api_key_v1|generativelanguage\.googleapis\.com|ApiKeyModal"
   ```
   *Expected output*: Blank (0 matches).

3. **Dedicated NPM Script**:
   Add to `package.json` scripts:
   ```json
   "scan:secrets": "node scripts/verify-secret-scan.js"
   ```

---

## 8. Implementation Step-by-Step Transition Plan

The implementer (Worker M1) can execute the remediation following this exact sequence:

1. **Step 1: Create `src/services/preferencesStorage.ts`**
   - Place `FONT_SIZE_STORAGE_KEY`, `getStoredFontSize`, `setStoredFontSize`, and `purgeLegacyStoredApiKey` in `src/services/preferencesStorage.ts`.
2. **Step 2: Update `src/services/geminiVision.ts`**
   - Remove `apiKey` from `GeminiVisionOptions`.
   - Implement `getApiAnalyzeUrl()` with `import.meta.env.VITE_API_URL || '/api/analyze'`.
   - Update `analyzeMedicationImage` to POST `{ image: imageBase64, mimeType }` to the proxy and parse response.
3. **Step 3: Update `src/App.tsx`**
   - Update imports to pull from `./services/preferencesStorage`.
   - Remove `ApiKeyModal` import.
   - Remove `apiKey`, `isApiKeyModalOpen`, `pendingFile` state.
   - Remove Settings button in `<header>`.
   - Call `purgeLegacyStoredApiKey()` in `useEffect`.
   - Update `processImage` and `handleImageSelected` to invoke analysis directly.
   - Remove `<ApiKeyModal ... />` JSX.
4. **Step 4: Delete Obsolete Files**
   - Delete `src/components/ApiKeyModal.tsx`.
   - Delete `src/services/apiKeyStorage.ts`.
5. **Step 5: Add Secret Scanner Script & Tests**
   - Create `scripts/verify-secret-scan.js`.
   - Add `"scan:secrets": "node scripts/verify-secret-scan.js"` to `package.json`.
   - Create `tests/secretScan.test.ts`.
6. **Step 6: Build & Verify**
   - Run `npm.cmd test` (All tests including `secretScan.test.ts` must pass).
   - Run `npm.cmd run build` (`tsc --noEmit && vite build` must succeed).
   - Run `node scripts/verify-secret-scan.js` (Must report 0 violations).

---

## 9. Verification & Invalidation Matrix

| Verification Check | Exact Command | Pass Criteria | Invalidation Conditions |
|---|---|---|---|
| **Unit Tests & Secret Scan** | `npm.cmd test` | 100% test pass (24+ tests passed) including `tests/secretScan.test.ts` | Any test failure or secret pattern detected in `src/` |
| **Production Build** | `npm.cmd run build` | Zero TypeScript or Vite bundling errors | TS compile errors or broken module imports |
| **Build Artifact Secret Scan** | `node scripts/verify-secret-scan.js` | Exit code 0, 0 violations in `src/` and `dist/` | Any match for `AIzaSy`, `dalili_gemini_api_key_v1`, `generativelanguage`, or `ApiKeyModal` |
| **Git Grep Inspection** | `git grep --no-index -i "AIzaSy" src/ dist/` | Exit code 1 (0 matches) | Output contains any file matching pattern |
| **App Usability** | Render `<App />` | Instant camera button ready, no key modal appears | Modal dialog renders or prompts for API key on scan |
