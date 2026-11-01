# Comprehensive Specification & Requirements Mining Report
**Project**: "دليلي الدوائي" (My Medication Guide) - Elderly-Centric Arabic Medication Assistant PWA
**Author**: `teamwork_preview_spec_miner_survey_2` (Specification Miner)
**Date**: 2026-10-27T20:30:00Z
**Authoritative Source**: `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md`

---

## 1. Observation
Directly observed environment and specification parameters:
1. **Source Document**: `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md` (6,204 bytes, 67 lines). It mandates a complete, production-ready, mobile-first Arabic Progressive Web App (PWA) with full Right-to-Left (RTL) layout designed specifically for elderly users to photograph medication packages, receive simplified AI explanations via Gemini 1.5 Flash Vision, listen via Web Speech API, and access a 5-item local history.
2. **Execution Environment**:
   - OS: Windows 11 / PowerShell.
   - Node runtime: `v24.21.0`.
   - Package manager: `npm.cmd` (`11.19.0`) — Note: `npm.ps1` execution is blocked by Windows PowerShell script execution policy; all npm invocations must use `npm.cmd`.
   - Workspace state: Greenfield repository with `.git` and `.agents/teamwork/`.
3. **Core Architectural Requirements**:
   - R1: Elderly-Centric Arabic UI, Cairo/Tajawal font family, Deep Teal (`#006D77`), Warm White (`#F8F9FA`), Slate (`#1D3557`), Soft Amber highlights, minimum touch target height 64px, minimum font sizes (20px body, 28px+ heading), persistent font size toggle ("خط كبير" 20px vs "خط كبير جداً" 24px+).
   - R2: Primary action button ("📷 صوّر علبة الدواء الآن", `capture="environment"`), gallery fallback, reassuring Arabic spinner ("جاري قراءة علبة الدواء... يرجى الانتظار قليلاً"), local storage Gemini API key persistence, strict Arabic pharmacist system prompt with structured JSON schema (`is_clear`, `medicine_name_ar`, `medicine_name_en`, `active_ingredient`, `uses`, `how_and_when`, `warnings`, `audio_summary`), and kind error handling for `is_clear: false`.
   - R3: 4 distinct color-coded cards with icons (Identity, Uses, Dosage/Schedule, Warnings on amber), Web Speech API toolbar ("🔊 استمع للمعلومات") with Play, Pause, Stop in `ar-SA`/`ar-EG`, sticky action button ("🔄 تصوير دواء آخر"), and persistent disclaimer banner ("تنبيه: هذه المعلومات إرشادية لتسهيل القراءة ولا تغني عن تعليمات طبيبك أو الصيدلي.").
   - R4: PWA Web App Manifest, Service Worker offline shell caching, 5-item FIFO `localStorage` scan history with duplicate prevention and quick re-view cards.
   - Acceptance Criteria: 100% test pass rate with Vitest + React Testing Library, and zero build errors (`npm.cmd run build`).

---

## 2. Logic Chain
1. **Target Persona Constraint Deduction**:
   - The primary target user is an Arabic-speaking senior citizen (كبار السن).
   - Seniors frequently experience:
     a) Presbyopia / age-related low vision -> Mandates high WCAG AAA contrast, base font size of 20px, large 28px+ headings, high line-height (1.6-1.8), and an easily reachable font toggle to 24px+.
     b) Reduced motor precision / tremors -> Mandates oversized interactive touch targets (minimum 64px height), full-width stacked button layouts, and generous padding to eliminate misclicks.
     c) Cognitive friction / tech anxiety -> Mandates reassuring, warm Arabic copy, zero clutter, single-screen progressive disclosure, prominent audio readouts, and clear fallback states instead of cryptic error codes.
2. **Camera & Vision AI Processing Deduction**:
   - Real-world medication photography by seniors often produces tilted, shadowed, out-of-focus, or glare-heavy shots.
   - The Gemini 1.5 Flash Vision prompt must act as an empathetic Arabic pharmacist.
   - When the image quality is too low to guarantee patient safety, the model MUST set `is_clear: false` rather than guessing dangerous medical dosages.
   - The UI must intercept `is_clear: false` and render a comforting Arabic guidance state with instructions on good lighting and camera angle.
   - LLM responses occasionally wrap JSON in markdown tags (````json ... ````) or narrative text; therefore, client-side extraction must employ resilient regex and sanitization before JSON parsing.
3. **Audio / SpeechSynthesis Integration Deduction**:
   - Senior users benefit immensely from auditory reinforcement.
   - The Web Speech API provides client-side, zero-latency narration of `audio_summary` in Arabic (`ar-SA` or `ar-EG`).
   - Browser audio engines can hang if utterances are not stopped cleanly upon navigation. The controller must provide explicit state transitions (`idle`, `speaking`, `paused`) and hook into cleanup routines (`speechSynthesis.cancel()`) on component unmount or view reset.
4. **Offline Resilience & Scan History Deduction**:
   - Seniors may use the app indoors or in pharmacies where connectivity drops.
   - PWA caching ensures the application shell, fonts, and UI remain functional offline.
   - Previously scanned medications (up to 5 items) stored in `localStorage` allow immediate instant review of dosage and warnings without requiring internet or re-running Gemini vision queries.

---

## 3. Caveats & Assumptions
1. **Gemini API Key Exposure**: The application is a client-side PWA running directly in the user's browser. Storing the user's Gemini API key in browser `localStorage` is required by the spec. Users must be informed that the key is stored strictly on their device and never transmitted to any third-party server other than the official Google Gemini API endpoint.
2. **Web Speech API Platform Variance**: Some mobile browsers (or older Android webviews) may have limited Arabic voice packs installed locally. The system must implement graceful voice fallback: first attempt `ar-SA` or `ar-EG`, then any `ar-*` voice, and if unavailable, display clear visual cues without crashing the UI.
3. **Camera Hardware Differences**: Desktop environments running the PWA do not have a rear environment camera; the file input with `capture="environment"` gracefully falls back to webcam or system file picker, while the secondary gallery upload button guarantees full desktop and tablet compatibility.
4. **Offline AI Invocation**: While the PWA shell and saved scan history are 100% functional offline, new medication scans require active network access to reach Gemini Vision. An explicit friendly offline indicator must notify the user if a new photo is taken while offline.

---

## 4. Conclusion & Complete Specification Report

### 4.1 Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | UI/UX & A11y | RTL Root & Arabic Typography | Entire app configured with `dir="rtl"`, `lang="ar"`, loading Cairo/Tajawal font family | HTML document load | Arabic RTL layout with high legibility | Fallback to system sans-serif font | ORIGINAL_REQUEST.md (R1) |
| 2 | UI/UX & A11y | Medical Color Palette System | WCAG AAA high-contrast palette: Teal `#006D77`, Warm White `#F8F9FA`, Slate `#1D3557`, Soft Amber `#FEF3C7`/`#F59E0B` | CSS classes / Theme tokens | High-contrast visual tokens | N/A (compile-time token enforcement) | ORIGINAL_REQUEST.md (R1) |
| 3 | UI/UX & A11y | Senior Touch Targets & Sizing | Minimum 64px button height, ≥20px body font size, ≥28px heading font size | Component render props | Large touchable elements with icons & labels | Style enforcement prevents sub-64px heights | ORIGINAL_REQUEST.md (R1) |
| 4 | UI/UX & A11y | Persistent Font Size Toggle | Dynamic two-state font toggle at the top of results: "خط كبير" (20px) vs "خط كبير جداً" (24px+) | User click on toggle button | Dynamic text resize across all cards and UI | Defaults to "خط كبير" if unselected | ORIGINAL_REQUEST.md (R1) |
| 5 | Camera & AI | Primary Camera Capture Action | Large reassuring button "📷 صوّر علبة الدواء الآن" activating mobile rear camera (`capture="environment"`) | Camera snapshot / file input | Raw image file (JPEG/PNG/WEBP) | Permission denied -> Kind Arabic guidance | ORIGINAL_REQUEST.md (R2) |
| 6 | Camera & AI | Gallery Image Upload Fallback | Secondary button "📁 اختيار صورة من الألبوم" allowing gallery selection | File picker selection | Selected image file | Non-image file selected -> Arabic validation error | ORIGINAL_REQUEST.md (R2) |
| 7 | Camera & AI | Reassuring Arabic Loading State | Reassuring spinner with text "جاري قراءة علبة الدواء... يرجى الانتظار قليلاً" (`role="status"`, `aria-live="polite"`) | Image submission event | Accessible animated spinner & comforting text | Timeout handling if network drops | ORIGINAL_REQUEST.md (R2) |
| 8 | Security | Gemini API Key Management | Secure modal/input to enter API key on first run, persistent in `localStorage`, with quick-edit access | User API key input string | Saved key in localStorage | Empty/invalid key -> Warning modal | ORIGINAL_REQUEST.md (R2) |
| 9 | Camera & AI | Gemini 1.5 Flash Vision Service | Sends image to Gemini Vision API with strict Arabic pharmacist prompt and JSON instructions | Base64 image + API Key | Raw JSON string response | HTTP 401/429/500 -> Kind Arabic error banner | ORIGINAL_REQUEST.md (R2) |
| 10 | Camera & AI | Resilient JSON Parser | Strips markdown codeblocks and extracts valid JSON matching strict pharmacist schema | Raw AI response text | Validated `MedicineAnalysisResult` object | Syntax error -> Triggers fallback Arabic error | ORIGINAL_REQUEST.md (R2) |
| 11 | Camera & AI | Unclear Photo Error State | Detects `is_clear: false` or parsing failure, presents kind Arabic retry screen with lighting advice | `is_clear: false` response | Friendly error card with "📷 إعادة التصوير الآن" | N/A (renders safe UI) | ORIGINAL_REQUEST.md (R2) |
| 12 | Results View | Card 1: Medication Identity | Displays Arabic name, English name & concentration, and active ingredient with pill icon | `medicine_name_ar`, `medicine_name_en`, `active_ingredient` | High-contrast card with Teal accents | Missing fields -> Graceful fallback dashes | ORIGINAL_REQUEST.md (R3) |
| 13 | Results View | Card 2: Indications & Uses | Displays simplified Arabic bullet points for medication uses with medical icon | `uses: string[]` | Clear bulleted list in large font | Empty array -> "راجع الطبيب أو الصيدلي" | ORIGINAL_REQUEST.md (R3) |
| 14 | Results View | Card 3: Dosage & Best Timing | Highlights meal timings (before/after food) and schedule in easy-to-follow cards with clock icon | `how_and_when: string[]` | Formatted schedule highlights | Empty array -> "استشر الصيدلي لمعرفة المواعيد" | ORIGINAL_REQUEST.md (R3) |
| 15 | Results View | Card 4: Warnings & Precautions | Cautions, drug interactions, and side effects on soft amber background (`#FEF3C7`) with warning icon | `warnings: string[]` | Amber-toned card with high-contrast text | Empty array -> Standard general precautions | ORIGINAL_REQUEST.md (R3) |
| 16 | Audio & Speech | Web Speech API Readout Toolbar | Toolbar "🔊 استمع للمعلومات" with Play, Pause, Stop buttons speaking `audio_summary` in Arabic | User click on audio controls | Voice synthesis in `ar-SA` or `ar-EG` | SpeechSynthesis unsupported -> Friendly notice | ORIGINAL_REQUEST.md (R3) |
| 17 | Results View | Sticky Reset Action Button | Sticky button "🔄 تصوير دواء آخر" at screen bottom (min height 64px) to return to camera | User click on reset button | Cancels audio, clears view, navigates to home | N/A | ORIGINAL_REQUEST.md (R3) |
| 18 | Medical Safety | Persistent Disclaimer Banner | Permanently visible medical disclaimer banner on results view: "تنبيه: هذه المعلومات إرشادية لتسهيل القراءة..." | Results view mount | High-contrast alert banner | N/A (cannot be dismissed) | ORIGINAL_REQUEST.md (R3) |
| 19 | PWA & Offline | Web App Manifest Configuration | `manifest.webmanifest` with Arabic app title, standalone display, icons, and `#006D77` theme | Browser PWA detection | Installable progressive web application | Invalid manifest -> standard web mode | ORIGINAL_REQUEST.md (R4) |
| 20 | PWA & Offline | Service Worker Shell Caching | Service worker caches HTML shell, fonts, styles, and scripts for offline app launch | Service worker registration | Instant offline application startup | Cache failure -> Network fetch fallback | ORIGINAL_REQUEST.md (R4) |
| 21 | Data Storage | 5-Item FIFO Scan History | Stores last 5 successful analyses in `localStorage`, evicting oldest (FIFO) on 6th item, with deduplication | New analysis result | Updated 5-item array in localStorage | QuotaExceeded -> In-memory fallback | ORIGINAL_REQUEST.md (R4) |
| 22 | Navigation | Home Recent Scan Quick-View | Displays recent scan cards on home screen with medicine name & timestamp; clicking immediately reloads results | User tap on history item | Opens full 4-card results view offline | Corrupt history item -> Silently removed | ORIGINAL_REQUEST.md (R4) |
| 23 | Quality | Automated Verification Suite | Comprehensive Vitest + React Testing Library suite covering parsing, history, audio, a11y, build | Automated test runner | 100% test pass report, 0 build errors | Test failure blocks production release | ORIGINAL_REQUEST.md (Acceptance) |

---

### 4.2 Edge Cases Specification

| # | Feature | Input / Trigger | Expected Observed Behavior |
|---|---------|-----------------|-----------------------------|
| 1 | Camera Capture | Camera permission denied or dismissed by user | Display courteous Arabic notification: "يرجى السماح للتطبيق باستخدام الكاميرا أو اختيار صورة من المعرض", with fallback to gallery picker. |
| 2 | Camera Capture | Desktop device without camera hardware | `capture="environment"` falls back automatically to OS file dialog without runtime exception. |
| 3 | AI Vision Analysis | Heavily blurred, shadowed, or cropped medication box | Gemini model returns `is_clear: false`; app renders kind Arabic error screen: "الصورة غير واضحة... يرجى إعادة التصوير في إضاءة جيدة" with a 64px retry button. |
| 4 | AI Vision Analysis | Non-pharmaceutical object captured (e.g. food box, pet, book) | Gemini returns `is_clear: false` with prompt compliance; app displays friendly message stating the image does not appear to be a medicine package. |
| 5 | AI Vision Analysis | Multiple medication boxes captured in single photo | Pharmacist prompt instructs focus on the primary medicine or asks user to photograph each box individually. |
| 6 | AI Parsing | AI response enclosed in markdown ```json ... ``` blocks or conversational text | Regex parser extracts the inner JSON object, strips backticks, and safely parses the payload without throwing uncaught exceptions. |
| 7 | AI Network Call | Invalid Gemini API key, network disconnect, or HTTP 429 quota limit | Catch error and display clear Arabic status: "تعذر الاتصال بخدمة الذكاء الاصطناعي... يرجى التأكد من الاتصال بالإنترنت ومفتاح API" with a direct button to edit key. |
| 8 | Audio Readout | Browser lacks Web Speech API (`window.speechSynthesis === undefined`) | Hide speech playback controls or display polite note: "خاصية القراءة الصوتية غير مدعومة في هذا المتصفح", while all 4 visual text cards remain fully legible. |
| 9 | Audio Readout | Operating system does not have Arabic voice installed | Controller queries `speechSynthesis.getVoices()`, attempts fallback to default system voice, and handles narration without crashing. |
| 10 | Audio Readout | User clicks "🔄 تصوير دواء آخر" while audio is actively playing | Invoke `speechSynthesis.cancel()` immediately during unmount/reset to prevent lingering ghost audio. |
| 11 | Audio Readout | User rapidly taps "Play" button repeatedly | Check `speechSynthesis.speaking` / `paused`; prevent queuing multiple overlapping audio utterances. |
| 12 | Scan History | 6th medication analysis completed | FIFO eviction removes the oldest (1st) item; array maintains exactly the 5 most recent records. |
| 13 | Scan History | User rescans identical medication already in history | Deduplication logic detects match by name/ingredient, moves it to position 0, and updates timestamp without duplicating entries. |
| 14 | LocalStorage | Private Browsing / Storage quota exceeded or disabled | Enclose `localStorage.setItem` in `try/catch`; fallback to in-memory state so the current session continues unimpeded. |
| 15 | Accessibility | User switches to "خط كبير جداً" (Extra Large 24px+) | Root/card font scales cleanly without text clipping, layout breakage, or overlapping buttons on mobile screens. |
| 16 | Offline Launch | User launches PWA while device is in Airplane Mode | Service worker serves cached app shell instantly; user can browse recent scan history items and view complete medication details offline. |

---

### 4.3 Detailed Technical Contracts & Specifications

#### 4.3.1 Gemini 1.5 Flash Vision Arabic Pharmacist System Prompt
The API client MUST send the following verbatim system prompt:
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

#### 4.3.2 Strict TypeScript Schema Contract
```typescript
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
}

export interface MedicationHistoryItem extends MedicineAnalysisResult {
  id: string;
  timestamp: number;
}
```

#### 4.3.3 Design System & Accessibility Dimensions
- **Layout Direction**: `dir="rtl"` on `<html>` and root container.
- **Font Families**: `'Cairo', 'Tajawal', sans-serif`.
- **Color Codes**:
  - Deep Teal: `#006D77` (Buttons, primary brand accents, Card 1 borders)
  - Warm White: `#F8F9FA` (Application background, card backgrounds)
  - Clear Dark Slate: `#1D3557` (High-contrast typography)
  - Soft Amber Background: `#FEF3C7` (Card 4 warnings background)
  - Amber Border / Accent: `#F59E0B`
  - Amber Text: `#92400E`
- **Typography Dimensions**:
  - Regular State ("خط كبير"):
    - Body Text: `20px` (`1.25rem`), line-height: `1.75`
    - Card Headings: `28px` (`1.75rem`), bold
    - App Header: `32px` (`2rem`), bold
  - Extra Large State ("خط كبير جداً"):
    - Body Text: `24px` (`1.5rem`), line-height: `1.85`
    - Card Headings: `32px` (`2rem`), bold
    - App Header: `36px` (`2.25rem`), bold
- **Touch Target Dimensions**:
  - All primary action buttons (`📷 صوّر علبة الدواء الآن`, `📁 اختيار صورة`, `🔊 استمع للمعلومات`, `🔄 تصوير دواء آخر`, font toggle buttons): `min-height: 64px`, full width or minimum `width: 64px`.
  - Icon sizes: minimum `28px x 28px` to ensure effortless visual identification for elderly users.

#### 4.3.4 SpeechSynthesis Arabic Audio Controller Contract
```typescript
export interface AudioPlayerState {
  status: 'idle' | 'speaking' | 'paused';
  supported: boolean;
  error: string | null;
}

export interface AudioPlayerActions {
  play: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}
```

#### 4.3.5 Local History Service Contract
```typescript
export interface HistoryStorageService {
  getHistory: () => MedicationHistoryItem[];
  saveItem: (item: MedicineAnalysisResult) => MedicationHistoryItem[];
  clearHistory: () => void;
}
// Capacity: 5 items FIFO
// Deduplication: Keyed by medicine_name_ar + active_ingredient
```

---

## 5. Verification Method

### 5.1 Verification Commands
Because this environment runs on Windows PowerShell where `.ps1` scripts may be restricted, the team must use `npm.cmd` rather than `npm`:
1. **Automated Unit & Integration Test Suite**:
   ```powershell
   npm.cmd test
   ```
   Or via Vitest directly:
   ```powershell
   npx.cmd vitest run
   ```
2. **Production Build Verification**:
   ```powershell
   npm.cmd run build
   ```
   Must succeed with 0 TypeScript compilation errors and 0 bundling warnings.

### 5.2 Required Test Suites & Invalidation Criteria
- `tests/geminiParser.test.ts`:
  - Parses well-formed pharmacist JSON.
  - Correctly strips ````json` and ```` wrappers.
  - Accurately captures `is_clear: false` and routes to Arabic error state.
  - Fallbacks safely when JSON is corrupted or partial.
- `tests/historyStorage.test.ts`:
  - Adds 6 items; verifies that only the 5 most recent items remain (FIFO eviction of item #1).
  - Rescans an existing item; verifies that duplicate count does not exceed 5 and the rescanned item is moved to the top.
  - Recalls full detailed object for viewing without network request.
- `tests/speechController.test.ts`:
  - Verifies state transitions: `idle -> speaking -> paused -> speaking -> idle`.
  - Validates Arabic voice matching (`ar-SA`, `ar-EG`, or startsWith `ar`).
  - Gracefully handles missing `window.speechSynthesis`.
- `tests/accessibility.test.tsx`:
  - Verifies all buttons have computed or declared `min-height >= 64px`.
  - Verifies body font size is `>= 20px` in standard mode and `>= 24px` in extra-large mode.
  - Verifies headings are `>= 28px`.
  - Confirms persistent disclaimer text is rendered in the results view.
  - Confirms root element has `dir="rtl"`.
- `tests/pwaManifest.test.ts`:
  - Validates `manifest.webmanifest` contains `dir: "rtl"`, `lang: "ar"`, theme colors, and valid icons.

This specification provides the authoritative, exhaustive blueprint for the implementation and testing subagents.
