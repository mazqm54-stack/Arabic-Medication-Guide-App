# Survey Report: Medication Usage Card (R4), Android Build/Versioning (R5), Test Suite (R5), and Cloudflare Deployment (R5)

**Agent**: Survey Explorer 3 (Usage, Build & Test Explorer)  
**Date**: 2026-10-31  
**Working Directory**: `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_upgrade_survey_3\`  
**Target File**: `survey_usage_build_tests.md`  

---

## Executive Summary

This report delivers an exhaustive, evidence-backed architectural investigation of **Requirement R4** (Medication Usage Card "كيف ومتى" & Worker Box Prompt Rule 6) and **Requirement R5** (Android Build, Versioning, Signing, Test Suite, Secret Scans, and Cloudflare Worker Deployment).

### Key Findings Snapshot:
1. **Medication Usage Card (`how_and_when`) Defect**: In `src/components/ResultCards.tsx` (lines 130–134), when `result.how_and_when` is empty, the app currently falls back to *"اتبع بدقة توجيهات الطبيب المكتوبة على الوصفة الطبية"*, directly violating R4. Furthermore, `usage_source` ("printed" | "common") is neither modeled in `src/types/index.ts` nor rendered in the UI. Card 3 also lacks the required hardcoded Arabic disclaimer line.
2. **Worker Prompt Rule 6 Contradiction**: In `worker/src/index.ts` (lines 47–48), Rule 6 currently instructs the AI: *"If the box prints dosing instructions, you may mention that the box has them and tell the user to follow their doctor or pharmacist"*, causing Gemini to emit generic deferral statements instead of 2–3 common active ingredient usage items.
3. **Android Versioning & Release Signing**: `android/app/build.gradle` is currently fixed at `versionCode 1` and `versionName "1.0"`. In `sign-release.bat`, no check or reminder exists to prompt the developer to increment versions, risking failed or overlapping APK upgrades on user devices.
4. **Test Suite Baseline & Coverage Gaps**: The existing Vitest test suite runs 18 test files (398 tests) with a 100% pass rate in 30.4s. However, there are **zero** tests for: Bottom Navigation, Prescription JSON Validator, Details Mode & Caching, Usage Non-Empty Guarantee, or the Fixed Disclaimer Line.
5. **Cloudflare Worker Deployment & Live Testing**: `worker/wrangler.toml` is missing the `GEMINI_MODEL_PRESCRIPTION` environment variable in `[vars]`. DNS resolution for `dalili-medication-guide-worker.dalili-medication.workers.dev` currently fails because the Worker has not yet been deployed to the live Cloudflare Workers domain. `npx.cmd wrangler` (v4.156.0) is available on the system.

---

## 1. Medication Usage Card ("كيف ومتى") & Worker Box Prompt Rule 6 (R4)

### 1.1 Current Codebase Audit

#### A. Client Component: `src/components/ResultCards.tsx`
Lines 101–135 currently render Card 3:
```tsx
{/* Card 3: طريقة الاستخدام وأفضل المواعيد */}
<section
  tabIndex={0}
  aria-label="طريقة الاستخدام وأفضل المواعيد"
  className="card-senior bg-white border-3 border-emerald-600 shadow-md"
>
  <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-emerald-100">
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

  {result.how_and_when && result.how_and_when.length > 0 ? (
    <ul className="space-y-3 pr-2">
      {result.how_and_when.map((instruction, index) => (
        <li key={index} className="flex items-start gap-3 bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
          <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-base">
            {index + 1}
          </span>
          <span className={`${bodyClass} font-bold text-emerald-950`}>{instruction}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className={`${bodyClass} text-slate-700 pr-2`}>
      اتبع بدقة توجيهات الطبيب المكتوبة على الوصفة الطبية.
    </p>
  )}
</section>
```

#### Deficiencies Identified:
1. **Generic Deferral Fallback**: Lines 130–134 render `"اتبع بدقة توجيهات الطبيب المكتوبة على الوصفة الطبية"` whenever `how_and_when` is empty or undefined. This explicitly violates R4:
   > "`how_and_when` must NEVER be empty and must not just say 'follow doctor'. Give 2–3 short items about COMMON general usage of active ingredient (timing e.g. before/after food, typical frequency in general words). NO mg/ml amounts, exact doses, or treatment durations."
2. **Missing `usage_source` Badge**: There is no badge or label indicating whether instructions come from the packaging (`"مكتوب على العلبة"` / `"مكتوب في الروشتة"`) or are general established practices (`"الاستخدام الشائع"`).
3. **Missing Immediate Hardcoded Disclaimer**: There is no fixed Arabic disclaimer directly below Card 3. The only disclaimer in the app is `src/components/DisclaimerBanner.tsx` placed at the bottom of the entire page after Card 4.

#### B. Client Types: `src/types/index.ts`
Lines 3–16:
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
  error_category?: ErrorCategory;
  error_code?: string;
  error_detail?: string;
}
```
- Missing: `usage_source?: 'printed' | 'common';`

#### C. Client Parser: `src/services/geminiParser.ts`
Lines 69, 88:
```typescript
const howAndWhen = normalizeArray(parsed.how_and_when);
...
how_and_when: howAndWhen.length > 0 ? howAndWhen : undefined,
```
- If `parsed.how_and_when` is empty, `how_and_when` is set to `undefined`, which triggers the invalid fallback in `ResultCards.tsx`.
- Does not extract or pass through `usage_source`.

#### D. Worker Implementation: `worker/src/index.ts`
Line 47 currently reads:
```typescript
6. General uses, usage guidance and warnings come from standard well-established medical knowledge about that active ingredient. Keep them general and safe. NEVER give exact doses, dose changes, or personal medical advice. If the box prints dosing instructions, you may mention that the box has them and tell the user to follow their doctor or pharmacist.
```
- Lines 64, 77:
```typescript
how_and_when: { type: 'ARRAY', items: { type: 'STRING' } },
```
- Does not include `usage_source` in `properties` or `required`.
- Lines 443, 461: Default fallback objects set `how_and_when: []`.

---

### 1.2 Proposed Worker Box System Instruction Rule 6 & Schema Revision

#### Revised Rule 6 (Worker Box Prompt):
```text
6. Usage guidance in how_and_when must NEVER be empty and must NEVER just say "follow doctor" or "ask pharmacist".
- If the box prints specific administration instructions (e.g. "take with water", "after meals", or frequency), copy those instructions into how_and_when and set usage_source="printed".
- If no instructions are printed on the box, provide 2–3 short items in how_and_when about the COMMON general usage of that active ingredient (timing e.g. before or after food, and typical frequency in general words like morning or evening), and set usage_source="common".
- NEVER include exact mg or ml amounts, individualized patient doses, or treatment durations. Keep all guidance safe, standard, and educational.
```

#### Revised Schema in `worker/src/index.ts`:
```typescript
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_clear: { type: 'BOOLEAN' },
    retake_message: { type: 'STRING' },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
    evidence_text: { type: 'STRING' },
    medicine_name_ar: { type: 'STRING' },
    medicine_name_en: { type: 'STRING' },
    active_ingredient: { type: 'STRING' },
    uses: { type: 'ARRAY', items: { type: 'STRING' } },
    how_and_when: { type: 'ARRAY', items: { type: 'STRING' } },
    usage_source: { type: 'STRING', enum: ['printed', 'common'] },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
    audio_summary: { type: 'STRING' }
  },
  required: [
    'is_clear',
    'retake_message',
    'confidence',
    'evidence_text',
    'medicine_name_ar',
    'medicine_name_en',
    'active_ingredient',
    'uses',
    'how_and_when',
    'usage_source',
    'warnings',
    'audio_summary'
  ]
};
```

---

### 1.3 Client-Side Multi-Tier Defense for `how_and_when`

Even if an upstream LLM or backend returns empty items, the client must guarantee that `how_and_when` is never empty and never simply says "اتبع الطبيب".

#### Client Normalization (`src/services/geminiParser.ts`):
```typescript
const defaultCommonUsage = [
  'يؤخذ القرص عبر الفم مع كوب ماء كامل',
  'يُفضل تناوله في نفس الموعد يومياً للحفاظ على فاعليته',
  'استشر الصيدلي أو الطبيب لتحديد المواعيد الأنسب لحالتك الصحية'
];

let finalHowAndWhen = howAndWhen.filter(item => 
  !item.includes('اتبع بدقة توجيهات الطبيب') && 
  !item.includes('راجع الطبيب فقط')
);

if (finalHowAndWhen.length === 0) {
  finalHowAndWhen = defaultCommonUsage;
}
```

#### Client Card Layout in `src/components/ResultCards.tsx`:
```tsx
{/* Card 3: طريقة الاستخدام وأفضل المواعيد */}
<section
  tabIndex={0}
  aria-label="طريقة الاستخدام وأفضل المواعيد"
  className="card-senior bg-white border-3 border-emerald-600 shadow-md rounded-3xl p-5 sm:p-6"
>
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

    {/* Usage Source Badge */}
    <span className={`px-3 py-1.5 rounded-full text-sm font-bold border ${
      result.usage_source === 'printed'
        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
        : 'bg-teal-100 text-teal-900 border-teal-300'
    }`}>
      {result.usage_source === 'printed' ? 'مكتوب على العلبة' : 'الاستخدام الشائع'}
    </span>
  </div>

  <ul className="space-y-3 pr-2">
    {displayHowAndWhen.map((instruction, index) => (
      <li key={index} className="flex items-start gap-3 bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
        <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-base">
          {index + 1}
        </span>
        <span className={`${bodyClass} font-bold text-emerald-950`}>{instruction}</span>
      </li>
    ))}
  </ul>

  {/* Fixed Hardcoded Arabic Disclaimer Line directly under the usage items */}
  <div className="mt-4 pt-3 border-t border-emerald-200 text-right">
    <p className="text-xs sm:text-sm font-bold text-emerald-800 leading-normal">
      هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي.
    </p>
  </div>
</section>
```

---

## 2. Android Build, Versioning & Signing (R5)

### 2.1 Audit of `android/app/build.gradle`
Location: `android/app/build.gradle`  
Lines 6–12:
```groovy
defaultConfig {
    applicationId "com.dalili.medicationguide"
    minSdkVersion rootProject.ext.minSdkVersion
    targetSdkVersion rootProject.ext.targetSdkVersion
    versionCode 1
    versionName "1.0"
    testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
}
```

#### Observations:
- Current `versionCode` = `1`
- Current `versionName` = `"1.0"`
- In Android OS, an APK cannot be upgraded over an existing installation unless `versionCode` is strictly greater than the currently installed APK (`versionCode_new > versionCode_installed`). If `versionCode` remains `1`, `adb install -r` or manual installation triggers `INSTALL_FAILED_VERSION_DOWNGRADE`.
- **Target Upgrade**:
  - `versionCode 2`
  - `versionName "1.1"`

---

### 2.2 Audit of `sign-release.bat`
Location: `sign-release.bat`  
Total lines: 113.  

#### Workflow Analysis:
1. Verifies existence of `dalili-release-key.jks` in project root.
2. Prompts user securely for keystore password via PowerShell `Read-Host -AsSecureString`.
3. Sets environment variables `DALILI_KEYSTORE_PASSWORD`, `DALILI_KEY_PASSWORD`, `DALILI_KEY_ALIAS`, `DALILI_KEYSTORE_FILE`.
4. Invokes `call gradlew.bat assembleRelease --no-daemon` inside `android/`.
5. Clears password variables immediately.
6. Copies `android\app\build\outputs\apk\release\app-release.apk` to project root `dalili-app-signed-release.apk`.
7. Verifies APK signature with `apksigner verify --verbose`.

#### Deficiency:
`sign-release.bat` performs **no check or reminder** of `versionCode` or `versionName`. If a developer makes changes and builds a release APK without updating `build.gradle`, the resulting APK retains the old version code.

#### Proposed Improvement to `sign-release.bat`:
Add a pre-flight version verification step immediately before password prompting:
```bat
echo ======================================================================
echo    Dalili Medication Guide - Android Release Build and Sign
echo ======================================================================
echo.

:: Inspect current build.gradle version
set "GRADLE_FILE=%SCRIPT_DIR%android\app\build.gradle"
for /f "tokens=2" %%A in ('findstr /r /c:"versionCode [0-9]*" "%GRADLE_FILE%"') do set "CURRENT_VC=%%A"
for /f "tokens=2*" %%A in ('findstr /r /c:"versionName \".*\"" "%GRADLE_FILE%"') do set "CURRENT_VN=%%A"

echo Current Release Version:
echo   - versionCode: !CURRENT_VC!
echo   - versionName: !CURRENT_VN!
echo.
echo [REMINDER] To ensure a clean upgrade over existing installations on Android,
echo verify that versionCode and versionName have been incremented!
echo ----------------------------------------------------------------------
echo.
```

#### Command Conventions Note:
- On Windows environments, all npm and npx commands must use `.cmd` extensions (`npm.cmd run build`, `npx.cmd cap sync android`, `npx.cmd vitest run`, `npx.cmd wrangler deploy`).

---

## 3. Test Suite Architecture, Gaps & Secret Scans (R5)

### 3.1 Existing Test Suite Baseline
- Configuration: `vitest.config.ts`, `package.json` (`npm.cmd test` maps to `vitest run`).
- Environment: `jsdom` with setup file `./src/test/setup.ts`.
- **Empirical Execution Result**:
  - Test Files: **18 passed (18)**
  - Tests: **398 passed (398)**
  - Total Duration: 30.44s

#### Existing 18 Test Suites:
| Suite File | Scope | Test Count |
|---|---|---|
| `tests/accessibility.test.tsx` | Senior UI accessibility, ARIA, RTL, font mode | 11 |
| `tests/analyze.test.ts` | Local Vercel proxy API contract | 23 |
| `tests/analyze.adversarial.test.ts` | Stress tests for `/api/analyze` proxy | 39 |
| `tests/camera.challenge.test.ts` | Camera permissions & capture edge cases | 28 |
| `tests/errorStates.test.tsx` | Error cards, network retry | 15 |
| `tests/errorStates.challenge.test.tsx` | Timeout abortion & interactive retry | 42 |
| `tests/geminiParser.test.ts` | Box JSON cleaning & parsing | 6 |
| `tests/geminiVision.challenge.test.ts` | Timeout & URL proxy configuration | 18 |
| `tests/historyStorage.test.ts` | Recent scan local history persistence | 6 |
| `tests/imageProcessor.test.ts` | Canvas 1024px clamping & JPEG 0.75 | 22 |
| `tests/imageProcessor.challenge.test.ts` | Memory leak prevention & aspect ratios | 53 |
| `tests/nativeCamera.challenger2.test.ts` | Android Capacitor camera integration | 28 |
| `tests/pwa.test.ts` | Manifest and service worker checks | 3 |
| `tests/secretScan.test.ts` | Zero-secret client regex scan | 2 |
| `tests/speechController.test.ts` | Text-to-speech audio state | 4 |
| `tests/worker.test.ts` | Cloudflare Worker baseline routes & errors | 32 |
| `tests/worker.challenge.test.ts` | Cloudflare Worker adversarial stress | 30 |
| `tests/worker.challenger2.test.ts` | Worker error mapping & sanitization | 16 |

---

### 3.2 Required Test Suites for Upgrade (R5 Spec)

To satisfy R5 and ensure 100% test pass rate without regressions, the following 5 test areas must be created or updated:

#### 1. Bottom Navigation Test Suite (`tests/navigation.test.tsx`):
- **Verification points**:
  - Renders 5 tabs in RTL visual order (الرئيسية, أدويتي, صوّر, الروشتة, السجل).
  - Center button has 72–80px circular styling, `#006D77` background, white camera icon, and label "صوّر".
  - Center button triggers native rear camera directly (`CameraSource.Camera`) without opening `<input type="file">`.
  - Non-center tab buttons meet senior accessibility requirements: touch targets >= 64px, labels >= 16px, icons >= 28px, rounded pill active indicator.
  - Tapping tabs switches views and triggers light haptic feedback.

#### 2. Prescription JSON Validator Suite (`tests/prescriptionValidator.test.ts`):
- **Verification points**:
  - Validates full prescription schema: `is_clear`, `retake_message`, `confidence`, `evidence_text`, `items`, `audio_summary`.
  - Routes empty items (`items: []`) to retake screen even if `is_clear: true`.
  - Low confidence items (`confidence: 'low'`) are flagged to render in soft amber card with text `"غير واضح، اسأل الصيدلي"` and no AI explanation.
  - High/medium confidence items preserve `written_instructions` exactly as written and include 1-sentence `short_explanation`.
  - Maximum items enforced (up to 10 items).

#### 3. Details Mode & Caching Suite (`tests/medicineDetails.test.ts`):
- **Verification points**:
  - Worker `/api/details` (or `mode: "details"`) accepts text query `medicine_name` without requiring an image.
  - Returns box-result schema (`medicine_name_ar`, `uses`, `how_and_when`, `warnings`).
  - Client caches results by normalized medicine name in `localStorage`.
  - Repeated lookups for the same medicine hit cache with 0ms network latency.
  - "أضف لأدويتي" action is present and successfully saves medicine to local shelf.

#### 4. Medication Usage Non-Empty & Disclaimer Line Suite (`tests/usageCard.test.tsx`):
- **Verification points**:
  - `how_and_when` is NEVER empty in any rendered result.
  - `how_and_when` never displays `"اتبع بدقة توجيهات الطبيب المكتوبة على الوصفة الطبية"` as sole instruction.
  - Differentiates `usage_source`: `"printed"` renders badge `"مكتوب على العلبة"` (or `"مكتوب في الروشتة"`), `"common"` renders badge `"الاستخدام الشائع"`.
  - Verifies presence of exact hardcoded Arabic string immediately below Card 3:
    `"هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي."`

#### 5. Secret Scan Suite (`tests/secretScan.test.ts`):
- **Verification points**:
  - Retain and execute existing zero-secret test.
  - Confirms zero API keys, zero `AIza...` patterns, zero client-side key storage dialogs in `src/` and `dist/`.

---

## 4. Cloudflare Worker Deployment & Live Endpoint Testing (R5)

### 4.1 Worker Configuration Audit (`worker/wrangler.toml`)
Location: `worker/wrangler.toml`  
Contents:
```toml
name = "dalili-medication-guide-worker"
main = "src/index.ts"
compatibility_date = "2024-10-01"

[placement]
mode = "smart"

[vars]
GEMINI_MODEL = "gemini-3.5-flash-lite"

# Cloudflare Rate Limiting (10 requests per minute)
[[ratelimits]]
name = "RATE_LIMITER"
namespace_id = "1001"

[ratelimits.simple]
limit = 10
period = 60
```

#### Configuration Defect:
- Missing `GEMINI_MODEL_PRESCRIPTION`:
  R2 and R5 require:
  > "Add env var `GEMINI_MODEL_PRESCRIPTION` (default `gemini-3.8-flash` with thinkingLevel LOW). Keep `GEMINI_MODEL` (fast model) for medicine boxes. Never hardcode model names."
- **Required addition to `worker/wrangler.toml`**:
  ```toml
  [vars]
  GEMINI_MODEL = "gemini-3.5-flash-lite"
  GEMINI_MODEL_PRESCRIPTION = "gemini-3.8-flash"
  ```
- And in `worker/src/index.ts`:
  ```typescript
  export interface Env {
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    GEMINI_MODEL_PRESCRIPTION?: string;
    RATE_LIMITER?: {
      limit: (options: { key: string }) => Promise<{ success: boolean }>;
    };
  }
  ```

---

### 4.2 Deployment & Live Testing Protocol

#### 1. Deployment Execution:
In Windows environment:
```powershell
cd worker
npx.cmd wrangler deploy
```

#### 2. Live Secret Ingestion:
```powershell
cd worker
npx.cmd wrangler secret put GEMINI_API_KEY
```
*(Enter the Google Gemini API key when prompted).*

#### 3. Live DNS & Connectivity Check:
- Live URL: `https://dalili-medication-guide-worker.dalili-medication.workers.dev`
- Direct Health Check Request:
  ```powershell
  Invoke-RestMethod -Uri "https://dalili-medication-guide-worker.dalili-medication.workers.dev/health" -Method Get
  ```
  Expected Response:
  ```json
  {
    "status": "ok",
    "service": "dalili-medication-guide-worker",
    "model": "gemini-3.5-flash-lite",
    "hasApiKey": true
  }
  ```

#### 4. Live Multi-Payload Testing Harness:
The implementation phase must test the live endpoint with real image payloads and log empirical HTTP metrics:
- **Test 1: Medicine Box Image**:
  - Method: `POST` to `/api/analyze` (or `/` with `mode: "box"`)
  - Payload: Real 1024px / 0.7 JPEG base64 encoded medicine box image.
  - Assertions: HTTP status 200, latency < 5000ms, `is_clear: true`, `usage_source` present, `how_and_when` contains 2–3 items.
- **Test 2: Prescription Image**:
  - Method: `POST` to `/api/prescription` (or `/` with `mode: "prescription"`)
  - Payload: Real 1600px / 0.8 JPEG base64 encoded prescription image.
  - Assertions: HTTP status 200, latency < 8000ms, `items` array populated with confidence levels.
- **Test 3: Medicine Details Lookup**:
  - Method: `POST` to `/api/details` (or `/` with `mode: "details"`, `medicine_name: "Panadol"`)
  - Assertions: HTTP status 200, latency < 2500ms, text-only response matching box schema.
- **Test 4: Unclear Image**:
  - Method: `POST` with dark/blank image.
  - Assertions: HTTP status 200, `is_clear: false`, `retake_message` populated in Arabic.

---

## 5. Acceptance Criteria Cross-Reference Matrix

| Requirement | Acceptance Criterion | Current Status | Required Action for Implementers |
|---|---|---|---|
| **R4.1** | `how_and_when` never empty and does not just say "follow doctor" | ❌ Fails (falls back to generic deferral) | Update `ResultCards.tsx` & `geminiParser.ts` with default common usage |
| **R4.2** | 2–3 short items on common usage (timing, frequency, no mg/ml) | ⚠️ Partial (sometimes empty from Gemini) | Update Worker Prompt Rule 6 + client normalization |
| **R4.3** | Distinguish `usage_source`: "printed" vs "common" | ❌ Missing | Add to Worker schema, `types/index.ts`, and render badges |
| **R4.4** | Fixed Arabic disclaimer string directly under Card 3 | ❌ Missing | Hardcode exact disclaimer line in `ResultCards.tsx` |
| **R4.5** | Update Rule 6 in `worker/src/index.ts` | ❌ Not updated | Replace Rule 6 with revised text prohibiting generic deferrals |
| **R5.1** | Increment `versionCode` & `versionName` in `build.gradle` | ❌ At 1 and "1.0" | Set `versionCode 2`, `versionName "1.1"` |
| **R5.2** | Update `sign-release.bat` with version reminder/check | ❌ No check | Add pre-flight version inspect and reminder echo |
| **R5.3** | Use `npm.cmd` and `npx.cmd` in all Windows commands | ✅ Verified | Enforce in scripts and documentation |
| **R5.4** | Add bottom navigation tests | ❌ 0 tests | Create `tests/navigation.test.tsx` |
| **R5.5** | Add prescription JSON validator tests | ❌ 0 tests | Create `tests/prescriptionValidator.test.ts` |
| **R5.6** | Add details mode & cache tests | ❌ 0 tests | Create `tests/medicineDetails.test.ts` |
| **R5.7** | Add usage never empty & disclaimer line tests | ❌ 0 tests | Create `tests/usageCard.test.tsx` |
| **R5.8** | Secret scan clean pass | ✅ 2/2 tests pass | Keep `tests/secretScan.test.ts` intact |
| **R5.9** | Add `GEMINI_MODEL_PRESCRIPTION` to `worker/wrangler.toml` | ❌ Missing | Add `GEMINI_MODEL_PRESCRIPTION = "gemini-3.8-flash"` |
| **R5.10** | Deploy Worker with `npx.cmd wrangler deploy` and test live | ⏳ Ready for live deploy | Execute deploy and record HTTP status + latency |

---

## 6. Implementation Guidance

### For Worker Implementer:
1. Update `worker/wrangler.toml` to declare `GEMINI_MODEL_PRESCRIPTION = "gemini-3.8-flash"`.
2. Update `worker/src/index.ts`:
   - Extend `Env` interface with `GEMINI_MODEL_PRESCRIPTION?: string`.
   - Update `PHARMACIST_SYSTEM_PROMPT` Rule 6.
   - Update `GEMINI_RESPONSE_SCHEMA` to require `usage_source: 'printed' | 'common'`.
   - Add routes/modes for `/api/prescription` and `/api/details`.
   - Implement Worker 25s `AbortController` timeout returning HTTP 504 `UPSTREAM_TIMEOUT`.
3. Deploy to Cloudflare via `npx.cmd wrangler deploy` from `worker/`.

### For Client Implementer:
1. Update `src/types/index.ts` to include `usage_source?: 'printed' | 'common'`.
2. Update `src/components/ResultCards.tsx`:
   - Replace generic fallback with safe common usage items.
   - Add source badge (`مكتوب على العلبة` vs `الاستخدام الشائع`).
   - Add exact fixed Arabic disclaimer line directly beneath Card 3.
3. Update `android/app/build.gradle`:
   - `versionCode 2`
   - `versionName "1.1"`
4. Update `sign-release.bat`:
   - Echo current version from `build.gradle` and print upgrade reminder.
5. Create new test suites in `tests/` covering Navigation, Prescription Validator, Details Mode/Cache, and Usage/Disclaimer.
