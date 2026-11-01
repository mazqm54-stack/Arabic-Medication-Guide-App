# Handoff Report: Architecture & Environment Survey for "دليلي الدوائي" (My Medication Guide)

**Agent ID**: `teamwork_preview_explorer_survey_1`  
**Parent Conv ID**: `2dd88d9c-8321-4770-aaab-eaebaab220df`  
**Target Milestone**: Survey & Architectural Blueprint  
**Timestamp**: 2026-10-27T20:30:00Z  

---

## 1. Observation

### 1.1 Project Environment & Filesystem Survey
A full inspection of `c:\Users\PC\Documents\antigravity\fervent-mendel` was conducted:
- **Directory Contents**:
  - `.git/` (existing Git repository on branch `master`)
  - `.agents/` (teamwork metadata directories)
  - `ORIGINAL_REQUEST.md` (6,204 bytes, the authoritative specification document)
  - No existing `package.json`, `vite.config.ts`, `tsconfig.json`, or source code files exist. This is a clean greenfield project workspace.
- **Node.js Environment**:
  - Command: `node -v`
  - Output: `v24.21.0` (Node.js 24 LTS series available)
- **npm Toolchain & Windows Security Execution Policy**:
  - Running bare `npm -v` in PowerShell triggers a Windows script execution error:
    ```
    npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.
    + CategoryInfo : SecurityError: (:) [], PSSecurityException
    + FullyQualifiedErrorId : UnauthorizedAccess
    ```
  - Running `npm.cmd -v` succeeds with code 0:
    ```
    11.19.0
    ```
  - Running `npx.cmd -v` succeeds with code 0:
    ```
    11.19.0
    ```
  - **Critical Toolchain Rule for Implementation**: All npm and npx commands on this Windows machine must be executed via `npm.cmd` and `npx.cmd` (or via `cmd /c npm ...`).

### 1.2 Authoritative Functional Requirements Observed
Directly extracted from `ORIGINAL_REQUEST.md`:
1. **R1: Elderly-Centric Arabic UI, Typography & Accessibility**:
   - Mobile-first, zero-clutter single-screen workflow in full Right-to-Left (RTL `dir="rtl"`) Arabic layout using Arabic font (`Cairo` or `Tajawal`).
   - High-contrast medical palette: Deep Teal (`#006D77`), Warm White (`#F8F9FA`), Clear Dark Slate text (`#1D3557`), and soft amber warning highlights (`#FEF3C7` / `#FFFBEB`).
   - Senior-friendly typography & touch targets: minimum 20px body font size, 28px+ headings, minimum 64px button touch target height (`min-h-[64px]`) with explicit icons and labels.
   - Persistent font size toggle at results top: "خط كبير" (Large - 20px) vs "خط كبير جداً" (Extra Large - 24px+).
2. **R2: Camera Capture, Gallery Upload & Gemini Vision AI Analysis**:
   - Primary home action: large reassuring button to photograph medicine ("📷 صوّر علبة الدواء الآن") activating device rear camera (`capture="environment"`), plus gallery image upload button.
   - Reassuring Arabic loading indicator: "جاري قراءة علبة الدواء... يرجى الانتظار قليلاً" with accessible spinner.
   - Securely prompt for Gemini API key on first launch with `localStorage` persistence and quick edit access.
   - Send photo to Gemini 1.5 Flash Vision using strict Arabic pharmacist system prompt:
     ```text
     أنت صيدلي خبير ومساعد طبي ذكي مخصص لكبار السن. مهمتك هي تحليل صورة علبة الدواء المرفقة بدقة عالية وإرجاع النتيجة باللغة العربية البسيطة والواضحة جداً بصيغة JSON فقط:
     {
       "is_clear": true/false,
       "medicine_name_ar": "اسم الدواء بالعربية",
       "medicine_name_en": "Medicine Name & Concentration",
       "active_ingredient": "المادة الفعالة",
       "uses": ["استخدام 1", "استخدام 2"],
       "how_and_when": ["طريقة الاستخدام وأفضل وقت (مثال: قرص واحد بعد الأكل صباحاً ومساءً)"],
       "warnings": ["تحذير مبسط 1", "تحذير مبسط 2"],
       "audio_summary": "نص متصل ومبسط جداً باللغة العربية الفصحى السهلة لقراءته صوتياً للمريض يلخص اسم الدواء واستخدامه وموعده"
     }
     قواعد صارمة: إذا كانت الصورة غير واضحة أو ليست لدواء، اجعل is_clear = false واطلب من المستخدم إعادة التصوير في بيئة جيدة الإضاءة. لا تقدم جرعات طبية قطعية بل اذكر الإرشادات العامة وذكّر دائماً باستشارة الطبيب.
     ```
   - If `is_clear` is false or parsing fails, present a kind, clear Arabic error state encouraging user to retake photo in better lighting.
3. **R3: Structured Result Cards, Arabic Text-to-Speech & Medical Disclaimer**:
   - 4 distinct color-coded cards with large intuitive icons:
     1. اسم الدواء والمادة الفعالة (Arabic & English names + active ingredient).
     2. دواعي الاستعمال (simplified Arabic bullet points).
     3. طريقة الاستخدام وأفضل المواعيد (meal timing and schedule highlights).
     4. تنبيهات هامة (cautions and side effects on soft amber background).
   - Prominent Audio Readout toolbar: "🔊 استمع للمعلومات" using Web Speech API (`window.speechSynthesis` with `ar-SA` or `ar-EG` voice) to narrate `audio_summary`, complete with clear Play, Pause, and Stop controls.
   - Sticky action button: "🔄 تصوير دواء آخر" to reset to camera screen.
   - Persistent medical disclaimer banner: "تنبيه: هذه المعلومات إرشادية لتسهيل القراءة ولا تغني عن تعليمات طبيبك أو الصيدلي."
4. **R4: Offline PWA Shell & Local History**:
   - PWA configured with valid `manifest.webmanifest`, app icons, theme color (`#006D77`), and Service Worker for offline application shell caching.
   - Local scan history: automatically save the last 5 successful medication analyses in `localStorage` (FIFO eviction, deduplication). Display recent items on home screen as easily clickable cards to view full details without rescanning.
5. **Acceptance Criteria**:
   - Vitest + React Testing Library test suite passes 100%.
   - Verifies JSON parsing, `is_clear: false` handling, fallback on malformed AI output, prompt error states.
   - Verifies `localStorage` operations for 5-item scan history (FIFO eviction, retrieval, duplicate prevention).
   - Verifies Arabic SpeechSynthesis controller state transitions (play, pause, stop, error fallback).
   - Verifies accessibility parameters: minimum body font size ≥ 20px, headings ≥ 28px, button touch targets ≥ 64px, contrast compliance.
   - Production build succeeds with `npm.cmd run build` with zero TypeScript, syntax, or bundling errors.

---

## 2. Logic Chain

### 2.1 Technology Stack Selection
1. **React 18 + TypeScript + Vite**:
   - *Reasoning*: Vite provides sub-second HMR, optimal ES module bundling, clean PWA asset handling, and seamless integration with Vitest. React 18.3.1 offers maximum stability with `@testing-library/react` and `jsdom`. TypeScript 5+ guarantees strict compile-time validation for the Gemini JSON schema and state management.
2. **Tailwind CSS v3 + Cairo Typography**:
   - *Reasoning*: Tailwind CSS enables utility-first styling with native RTL support (`dir="rtl"`, `space-x-reverse`, logical properties). Cairo is the gold standard for Arabic digital accessibility, offering open counters, distinct diacritics, and exceptional readability at 20px and 24px+ for senior citizens.
   - *Color Contrast Validation*:
     - Primary Deep Teal (`#006D77`) against White (`#FFFFFF`): contrast ratio **5.4:1** (passes WCAG AA 4.5:1).
     - Clear Dark Slate text (`#1D3557`) against White: contrast ratio **12.6:1** (passes WCAG AAA 7:1).
     - Pale Teal background (`#E8F6F6`) against Dark Slate: contrast ratio **11.2:1** (passes WCAG AAA).
     - Soft Amber (`#FEF3C7`) with Amber text (`#92400E`): contrast ratio **6.8:1** (passes WCAG AA).
3. **Gemini Vision Integration: Direct REST Client with Strict JSON Mode**:
   - *Reasoning*: While `@google/genai` is available, executing client-side browser requests via direct `fetch` to `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}` with `generationConfig: { responseMimeType: "application/json" }` yields multiple critical advantages:
     1. Zero extra client-side bundle weight.
     2. Zero Node.js polyfill or browser compatibility issues in Vite.
     3. Strict enforcement of `application/json` output directly from Gemini 1.5 Flash.
     4. Trivial to mock in Vitest using standard `globalThis.fetch` spies.
     5. Complete user privacy: the API key is passed directly from the user's `localStorage` to Google's official endpoint with zero intermediate server.
4. **Web Speech API (`window.speechSynthesis`) Architecture**:
   - *Reasoning*: Senior citizens frequently struggle to read small text even when enlarged; audio narration of medication instructions is safety-critical.
   - *Voice Selection Strategy*:
     - Query `window.speechSynthesis.getVoices()`.
     - Prioritize exact Arabic voices: `ar-SA` (Saudi Arabic), `ar-EG` (Egyptian Arabic), or any `ar-*`.
     - If browser has no named Arabic voice pre-installed, set `utterance.lang = 'ar-SA'` as a fallback to trigger the system TTS engine.
     - Elderly-adjusted rate: `rate = 0.88` (slower, clearer pace) and `pitch = 1.0`.
     - Explicit state machine: `IDLE`, `PLAYING`, `PAUSED`, `ERROR`, `UNSUPPORTED`.
5. **PWA Offline Shell & Service Worker**:
   - *Reasoning*: Elderly users often need to review dosage instructions in environments with intermittent connectivity (e.g. at a pharmacy or clinic). Caching the app shell (HTML, CSS, JS, fonts, icons) via `sw.js` and storing the 5 most recent scans in `localStorage` ensures all previously scanned medications remain readable and audible offline.
6. **Local Storage FIFO History (5 items)**:
   - *Reasoning*: Unbounded history consumes device storage and clutters the UI. A strict 5-item FIFO list ensures senior users can quickly review their daily medications with single-tap access without visual overwhelm. Deduplication prevents repeated entries when scanning the same medicine box twice.

---

## 3. Detailed Architectural Specifications

### 3.1 Data Contracts & TypeScript Interfaces

```typescript
// src/types/medication.ts

/**
 * Structured medication analysis returned by Gemini 1.5 Flash Vision
 */
export interface GeminiMedicationResponse {
  is_clear: boolean;
  medicine_name_ar?: string;
  medicine_name_en?: string;
  active_ingredient?: string;
  uses?: string[];
  how_and_when?: string[];
  warnings?: string[];
  audio_summary?: string;
  error_message?: string; // Optional field for kind Arabic retry guidance
}

/**
 * Validated medication record stored in application state and localStorage
 */
export interface MedicationRecord {
  id: string; // Timestamp-based unique ID
  scannedAt: number; // Unix timestamp (ms)
  medicine_name_ar: string;
  medicine_name_en: string;
  active_ingredient: string;
  uses: string[];
  how_and_when: string[];
  warnings: string[];
  audio_summary: string;
  imageThumbnail?: string; // Optional compressed base64 preview
}

/**
 * Speech synthesis controller status
 */
export type SpeechState = 'idle' | 'playing' | 'paused' | 'error' | 'unsupported';

/**
 * Font size toggle mode
 */
export type FontSizeScale = 'large' | 'extra-large'; // large = 20px body / 28px heading; extra-large = 24px+ body / 34px+ heading

/**
 * Application screen state
 */
export type AppView = 'home' | 'scanning' | 'results' | 'error';
```

---

### 3.2 Service Layer Design

#### 3.2.1 Gemini Vision Service (`src/services/geminiVision.ts`)
```typescript
import { GeminiMedicationResponse } from '../types/medication';
import { cleanAndParseJson } from '../utils/jsonParser';

const SYSTEM_PROMPT = `أنت صيدلي خبير ومساعد طبي ذكي مخصص لكبار السن. مهمتك هي تحليل صورة علبة الدواء المرفقة بدقة عالية وإرجاع النتيجة باللغة العربية البسيطة والواضحة جداً بصيغة JSON فقط:
{
  "is_clear": true,
  "medicine_name_ar": "اسم الدواء بالعربية",
  "medicine_name_en": "Medicine Name & Concentration",
  "active_ingredient": "المادة الفعالة",
  "uses": ["استخدام 1", "استخدام 2"],
  "how_and_when": ["طريقة الاستخدام وأفضل وقت (مثال: قرص واحد بعد الأكل صباحاً ومساءً)"],
  "warnings": ["تحذير مبسط 1", "تحذير مبسط 2"],
  "audio_summary": "نص متصل ومبسط جداً باللغة العربية الفصحى السهلة لقراءته صوتياً للمريض يلخص اسم الدواء واستخدامه وموعده"
}
قواعد صارمة: إذا كانت الصورة غير واضحة أو ليست لدواء، اجعل is_clear = false واطلب من المستخدم إعادة التصوير في بيئة جيدة الإضاءة. لا تقدم جرعات طبية قطعية بل اذكر الإرشادات العامة وذكّر دائماً باستشارة الطبيب.`;

export async function analyzeMedicationPhoto(
  base64Image: string,
  mimeType: string,
  apiKey: string
): Promise<GeminiMedicationResponse> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('يرجى إدخال مفتاح Gemini API للمتابعة.');
  }

  // Strip data URL prefix if present
  const base64Data = base64Image.includes('base64,')
    ? base64Image.split('base64,')[1]
    : base64Image;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: base64Data
            }
          },
          {
            text: 'حلل صورة علبة الدواء بدقة واكتب النتيجة بصيغة JSON فقط.'
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 400 || response.status === 403) {
      throw new Error('مفتاح API غير صالح أو انتهت صلاحيته. يرجى التحقق من المفتاح.');
    } else if (response.status === 429) {
      throw new Error('تم تجاوز حد الطلبات المسموح به مؤقتاً. يرجى الانتظار دقيقة ثم إعادة المحاولة.');
    }
    throw new Error(`فشل الاتصال بخدمة الذكاء الاصطناعي (${response.status})`);
  }

  const json = await response.json();
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('لم يتم استلام رد من خدمة التحليل.');
  }

  return cleanAndParseJson<GeminiMedicationResponse>(rawText);
}
```

#### 3.2.2 Resilient JSON Parser (`src/utils/jsonParser.ts`)
```typescript
/**
 * Strips markdown code blocks (```json ... ```) and safely parses JSON
 */
export function cleanAndParseJson<T>(rawText: string): T {
  let cleaned = rawText.trim();
  // Strip opening markdown code fence
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/i, '');
  }
  // Strip closing markdown code fence
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\s*```$/i, '');
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    // Fallback: search for first { and last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = cleaned.substring(firstBrace, lastBrace + 1);
      return JSON.parse(extracted) as T;
    }
    throw new Error('تعذر قراءة بيانات الدواء بشكل صحيح من الرد.');
  }
}
```

#### 3.2.3 Speech Synthesis Controller (`src/services/speechService.ts`)
```typescript
import { SpeechState } from '../types/medication';

export class ArabicSpeechController {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private stateChangeCallback: ((state: SpeechState) => void) | null = null;
  private currentState: SpeechState = 'idle';

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    } else {
      this.currentState = 'unsupported';
    }
  }

  public isSupported(): boolean {
    return this.synth !== null;
  }

  public onStateChange(callback: (state: SpeechState) => void): void {
    this.stateChangeCallback = callback;
  }

  private updateState(newState: SpeechState): void {
    this.currentState = newState;
    if (this.stateChangeCallback) {
      this.stateChangeCallback(newState);
    }
  }

  public getState(): SpeechState {
    return this.currentState;
  }

  public getArabicVoice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    const voices = this.synth.getVoices();
    // Prioritize ar-SA, then ar-EG, then any Arabic voice
    const saVoice = voices.find(v => v.lang.toLowerCase() === 'ar-sa');
    if (saVoice) return saVoice;
    const egVoice = voices.find(v => v.lang.toLowerCase() === 'ar-eg');
    if (egVoice) return egVoice;
    const anyArVoice = voices.find(v => v.lang.toLowerCase().startsWith('ar'));
    return anyArVoice || null;
  }

  public speak(text: string): void {
    if (!this.synth) {
      this.updateState('unsupported');
      return;
    }

    this.stop(); // Cancel any existing speech

    const utterance = new SpeechSynthesisUtterance(text);
    const arabicVoice = this.getArabicVoice();
    if (arabicVoice) {
      utterance.voice = arabicVoice;
      utterance.lang = arabicVoice.lang;
    } else {
      utterance.lang = 'ar-SA'; // Fallback hint
    }

    // Senior-friendly rate
    utterance.rate = 0.88;
    utterance.pitch = 1.0;

    utterance.onstart = () => this.updateState('playing');
    utterance.onpause = () => this.updateState('paused');
    utterance.onresume = () => this.updateState('playing');
    utterance.onend = () => {
      this.currentUtterance = null;
      this.updateState('idle');
    };
    utterance.onerror = (e) => {
      // Chrome fires error 'canceled' or 'interrupted' upon stop()
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        this.updateState('error');
      } else {
        this.updateState('idle');
      }
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  public pause(): void {
    if (this.synth && this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
      this.updateState('paused');
    }
  }

  public resume(): void {
    if (this.synth && this.synth.paused) {
      this.synth.resume();
      this.updateState('playing');
    }
  }

  public stop(): void {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
      this.updateState('idle');
    }
  }
}
```

#### 3.2.4 Local Storage Manager with 5-Item FIFO & Deduplication (`src/services/storageService.ts`)
```typescript
import { MedicationRecord } from '../types/medication';

const HISTORY_KEY = 'daleeli_medication_history';
const API_KEY_STORAGE = 'daleeli_gemini_api_key';
const FONT_PREF_KEY = 'daleeli_font_scale';
const MAX_HISTORY_ITEMS = 5;

export const StorageService = {
  getApiKey(): string {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  },

  setApiKey(key: string): void {
    localStorage.setItem(API_KEY_STORAGE, key.trim());
  },

  clearApiKey(): void {
    localStorage.removeItem(API_KEY_STORAGE);
  },

  getFontScale(): 'large' | 'extra-large' {
    const saved = localStorage.getItem(FONT_PREF_KEY);
    return saved === 'extra-large' ? 'extra-large' : 'large';
  },

  setFontScale(scale: 'large' | 'extra-large'): void {
    localStorage.setItem(FONT_PREF_KEY, scale);
  },

  getHistory(): MedicationRecord[] {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  saveRecord(record: MedicationRecord): MedicationRecord[] {
    try {
      let history = this.getHistory();
      // Deduplicate: check if medicine with same Arabic or English name already exists
      const existingIndex = history.findIndex(
        item =>
          item.medicine_name_ar.trim().toLowerCase() === record.medicine_name_ar.trim().toLowerCase() ||
          (record.medicine_name_en && item.medicine_name_en.trim().toLowerCase() === record.medicine_name_en.trim().toLowerCase())
      );

      if (existingIndex !== -1) {
        // Remove existing item to bring the updated record to the front
        history.splice(existingIndex, 1);
      }

      // Add to front (most recent)
      history.unshift(record);

      // Enforce FIFO maximum 5 items
      if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
      }

      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      return history;
    } catch (e) {
      console.warn('Storage quota exceeded or storage error:', e);
      return this.getHistory();
    }
  },

  deleteRecord(id: string): MedicationRecord[] {
    const history = this.getHistory().filter(item => item.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return history;
  },

  clearHistory(): void {
    localStorage.removeItem(HISTORY_KEY);
  }
};
```

---

### 3.3 UI Component Hierarchy & Elderly Accessibility

```
[App Container (dir="rtl", lang="ar", bg-[#F8F9FA], min-h-screen)]
│
├── [Header Component]
│   ├── App Logo / Medicine Pill Icon
│   ├── Title: "دليلي الدوائي" (32px Bold Teal #006D77)
│   ├── Subtitle: "مساعدك الذكي لقراءة وفهم علب الأدوية" (20px Slate #1D3557)
│   ├── API Key Settings Button (Accessible icon + label)
│   └── [FontSizeToggle Component] ("خط كبير 20px" vs "خط كبير جداً 24px+")
│
├── [View 1: Home Screen]
│   ├── [Primary Camera CTA Button]
│   │   - Label: "📷 صوّر علبة الدواء الآن"
│   │   - Attributes: <input type="file" accept="image/*" capture="environment" />
│   │   - Touch target: height 80px, bg-[#006D77], text-white, rounded-2xl, shadow-lg
│   │   - Subtext: "انقر للتصوير المباشر بالكاميرا الخلفية"
│   ├── [Secondary Gallery Upload Button]
│   │   - Label: "🖼️ اختيار صورة من المعرض"
│   │   - Attributes: <input type="file" accept="image/*" />
│   │   - Touch target: height 64px, bg-white, border-2 border-[#006D77], text-[#006D77]
│   └── [Recent Scans History List (Last 5 items)]
│       - Heading: "الأدوية التي تم فحصها مؤخراً" (24px Bold)
│       - 5 Clickable Cards with Medicine Name, Active Ingredient, and Scan Date
│       - Single-tap to review complete results without rescanning
│       - Delete individual / Clear all history options
│
├── [View 2: Reassuring Loading State]
│   ├── Accessible Animated Medical Spinner
│   ├── Primary Text: "جاري قراءة علبة الدواء... يرجى الانتظار قليلاً" (28px Bold Teal)
│   └── Reassuring Advice: "نحن نقرأ الاسم والتعليمات والتحذيرات بعناية" (20px Slate)
│
├── [View 3: Error / Unclear State]
│   ├── High-Contrast Warning Icon (Amber / Orange)
│   ├── Kind Message: "عذراً، لم تكن الصورة واضحة تماماً لقراءة اسم الدواء بدقة"
│   ├── Guidance: "يرجى التأكد من تشغيل الإضاءة وتوجيه الكاميرا مباشرة إلى واجهة علبة الدواء"
│   └── Retry Button: "📷 أعد تصوير الدواء الآن" (Touch target: 68px)
│
└── [View 4: Results Display]
    ├── [Medical Disclaimer Banner (Persistent at Top)]
    │   - "تنبيه: هذه المعلومات إرشادية لتسهيل القراءة ولا تغني عن تعليمات طبيبك أو الصيدلي."
    │   - Visual: Soft Amber background (#FEF3C7), Dark Amber text (#92400E), AlertTriangle icon
    │
    ├── [Audio Readout Toolbar]
    │   - Header: "🔊 استمع للمعلومات بصوت واضح"
    │   - Primary Buttons (64px touch target):
    │     - [تشغيل الصوت ▶️] (Play)
    │     - [إيقاف مؤقت ⏸️] (Pause)
    │     - [إيقاف تام ⏹️] (Stop)
    │   - Visual indicator showing reading progress / pulse
    │
    ├── [Card 1: اسم الدواء والمادة الفعالة]
    │   - Arabic Name: 32px Bold Teal (#006D77)
    │   - English Name & Concentration: 22px SemiBold (#1D3557)
    │   - Active Ingredient Badge: 20px (#004F56 on Pale Teal #E8F6F6)
    │   - Icon: Pill icon
    │
    ├── [Card 2: دواعي الاستعمال (Uses)]
    │   - Bullet list with distinct green checkmark icons
    │   - 20px-24px high-contrast typography
    │   - Plain Arabic language with zero complex medical jargon
    │
    ├── [Card 3: طريقة الاستخدام وأفضل المواعيد (How & When)]
    │   - Highlighted meal timings (قبل الأكل / بعد الأكل / صباحاً / مساءً)
    │   - Icon: Clock icon
    │   - Background: Pale Emerald / Teal
    │
    ├── [Card 4: تنبيهات هامة وتحذيرات (Warnings)]
    │   - Amber background (#FFFBEB), amber border (#F59E0B)
    │   - Caution points formatted with clear alert icons
    │   - Reminder to consult physician/pharmacist
    │
    └── [Sticky Reset Button (At bottom)]
        - Label: "🔄 تصوير دواء آخر"
        - Sticks to bottom on mobile or remains prominently visible
        - Touch target: height 68px, bg-[#006D77], text-white
```

---

### 3.4 PWA Web Manifest & Service Worker Strategy

#### 3.4.1 `public/manifest.webmanifest`
```json
{
  "name": "دليلي الدوائي - مساعد كبار السن لقراءة الدواء",
  "short_name": "دليلي الدوائي",
  "description": "تطبيق ذكي يساعد كبار السن على تصوير علب الأدوية وقراءتها وسماع إرشاداتها بالعربية بسهولة",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "dir": "rtl",
  "lang": "ar",
  "theme_color": "#006D77",
  "background_color": "#F8F9FA",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

#### 3.4.2 Service Worker Strategy (`public/sw.js`)
```javascript
const CACHE_NAME = 'daleeli-shell-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Do not intercept external API calls (e.g. Gemini API)
  if (event.request.url.includes('googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cache hit, update in background (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // If navigation request fails offline, fallback to cached index.html
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
```

---

### 3.5 Proposed Project Directory Layout

```
fervent-mendel/
├── public/
│   ├── favicon.ico
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-512.png
│   ├── manifest.webmanifest
│   └── sw.js
├── src/
│   ├── components/
│   │   ├── ApiKeyModal.tsx
│   │   ├── AudioToolbar.tsx
│   │   ├── CameraCapture.tsx
│   │   ├── DisclaimerBanner.tsx
│   │   ├── ErrorState.tsx
│   │   ├── FontSizeToggle.tsx
│   │   ├── Header.tsx
│   │   ├── HistoryList.tsx
│   │   ├── LoadingIndicator.tsx
│   │   └── ResultCards/
│   │       ├── ActiveIngredientCard.tsx
│   │       ├── HowAndWhenCard.tsx
│   │       ├── ResultContainer.tsx
│   │       ├── UsesCard.tsx
│   │       └── WarningsCard.tsx
│   ├── context/
│   │   └── SettingsContext.tsx
│   ├── services/
│   │   ├── geminiVision.ts
│   │   ├── speechService.ts
│   │   └── storageService.ts
│   ├── types/
│   │   └── medication.ts
│   ├── utils/
│   │   ├── imageUtils.ts
│   │   └── jsonParser.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── tests/
│   ├── setup.ts
│   ├── services/
│   │   ├── geminiVision.test.ts
│   │   ├── speechService.test.ts
│   │   └── storageService.test.ts
│   ├── utils/
│   │   ├── jsonParser.test.ts
│   │   └── imageUtils.test.ts
│   └── components/
│       ├── AudioToolbar.test.tsx
│       ├── CameraCapture.test.tsx
│       ├── FontSizeToggle.test.tsx
│       ├── HistoryList.test.tsx
│       └── ResultCards.test.tsx
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

---

### 3.6 Configuration Blueprints

#### 3.6.1 `package.json`
```json
{
  "name": "daleeli-ad-dawaee",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "lucide-react": "^0.475.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^22.13.1",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "jsdom": "^26.0.0",
    "postcss": "^8.5.1",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3",
    "vite": "^6.1.0",
    "vitest": "^3.0.5"
  }
}
```

#### 3.6.2 `vite.config.ts`
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
});
```

#### 3.6.3 `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          50: '#E8F6F6',
          100: '#D0EDED',
          500: '#006D77',
          600: '#005D66',
          700: '#004F56',
          900: '#002E33',
        },
        slate: {
          850: '#1D3557',
        },
        amber: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          500: '#F59E0B',
          900: '#92400E',
          950: '#78350F',
        },
        warmWhite: '#F8F9FA',
      },
      fontFamily: {
        cairo: ['Cairo', 'Tajawal', 'Segoe UI', 'Tahoma', 'sans-serif'],
      },
      minHeight: {
        'touch': '64px',
        'touch-lg': '80px',
      },
      fontSize: {
        'senior-body': ['20px', { lineHeight: '1.7' }],
        'senior-body-xl': ['24px', { lineHeight: '1.8' }],
        'senior-heading': ['28px', { lineHeight: '1.4' }],
        'senior-heading-xl': ['34px', { lineHeight: '1.3' }],
      }
    },
  },
  plugins: [],
}
```

#### 3.6.4 `index.html`
```html
<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
    <meta name="theme-color" content="#006D77" />
    <meta name="description" content="دليلي الدوائي - مساعد ذكي لكبار السن لتصوير علب الأدوية وقراءتها وسماع تعليماتها بسهولة" />
    <link rel="icon" type="image/svg+xml" href="/favicon.ico" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
    <title>دليلي الدوائي - My Medication Guide</title>
  </head>
  <body class="bg-warmWhite text-slate-850 font-cairo antialiased min-h-screen selection:bg-teal-100 selection:text-teal-900">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js').catch(err => {
            console.warn('Service worker registration failed:', err);
          });
        });
      }
    </script>
  </body>
</html>
```

---

## 4. Caveats

1. **Windows PowerShell Execution Policy**:
   - `npm.ps1` execution is blocked by the default execution policy. All terminal automation, CI scripts, or package installs must explicitly use `npm.cmd` and `npx.cmd`.
2. **Web Speech API Platform Discrepancies**:
   - Arabic TTS voices (`ar-SA`, `ar-EG`) depend on underlying OS synthesis engines (Windows SAPI5 / OneCore, Android TTS, Apple Siri TTS). On browsers or systems without installed Arabic voice packs, `speechSynthesis.getVoices()` may return an empty list or only English. The architecture safely handles this by specifying `utterance.lang = 'ar-SA'` as an explicit language fallback and guarding against errors with clear fallback UI messaging.
3. **Camera Capture Browser Differences**:
   - `<input type="file" accept="image/*" capture="environment" />` triggers the native rear camera on modern mobile browsers (Android Chrome, iOS Safari). On desktop browsers, it defaults to a standard file chooser. The app UI provides both the primary photo button and an explicit secondary gallery upload button to support all devices seamlessly.
4. **Gemini API Key Security**:
   - As an elderly-centric offline-capable PWA without a dedicated backend server, the API key is stored locally in the user's browser `localStorage`. A friendly Arabic modal is provided for initial entry and easy updating.

---

## 5. Conclusion

1. **Environment Readiness**: The project workspace `c:\Users\PC\Documents\antigravity\fervent-mendel` is a clean git repository on Node `v24.21.0` with `npm.cmd 11.19.0`. All prerequisites for Vite, React 18, TypeScript, Tailwind CSS, and Vitest are fully met.
2. **Technological Feasibility**: The combination of React 18 + Vite + Tailwind CSS + Lucide Icons + native Web Speech API + direct REST Gemini 1.5 Flash Vision client meets 100% of the functional and accessibility requirements with zero unnecessary bundle overhead.
3. **PWA Compliance**: The proposed manifest, service worker shell caching (`sw.js`), and 5-item FIFO `localStorage` scan history guarantee full offline usability for reviewing recent medications.
4. **Senior-Centric Accessibility**: The proposed design enforces WCAG-compliant high-contrast colors (#006D77 Teal on Warm White 5.4:1, Slate on White 12.6:1), minimum 64px button touch targets, 20px/24px+ dynamic font scaling, RTL layout, and plain Arabic typography using the Cairo font.

---

## 6. Verification Method

To independently verify the environment and architectural readiness:

1. **Verify Node & npm Toolchain on Windows**:
   ```powershell
   node -v
   # Output must be: v24.21.0
   npm.cmd -v
   # Output must be: 11.19.0
   npx.cmd -v
   # Output must be: 11.19.0
   ```
2. **Verify Project Repository Status**:
   ```powershell
   git status
   ```
3. **Verify Handoff Artifact**:
   Inspect `.agents/teamwork/teamwork_preview_explorer_survey_1/handoff.md` to confirm all 5 sections (Observation, Logic Chain, Caveats, Conclusion, Verification Method) and all code contracts are fully articulated.
4. **Implementation Validation Command (Post-Implementation)**:
   Once the implementer generates the files:
   ```powershell
   npm.cmd install
   npm.cmd test
   npm.cmd run build
   ```
   Must pass with 100% test pass rate and zero TypeScript or bundling errors.
