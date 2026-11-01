# Handoff Report: E2E Test Contracts & App Shell Integration Architecture (Milestone M4)

- **Agent**: Explorer 3 (Milestone M4 — App Shell Integration & Test Contract Verification)
- **Date**: 2026-10-31T20:48:00Z
- **Target Audience**: Orchestrator, Worker, Reviewers

---

## 1. Observation

### 1.1 Baseline Test Suite Status
Executing the complete Vitest test suite (`npx.cmd vitest run`) reveals that **all 40 test files and 1,021 tests currently pass 100%**:
- `tests/e2e/tier1_features/` (140 tests passing across 5 suites)
- `tests/e2e/tier2_boundaries/` (140 tests passing across 5 suites)
- `tests/e2e/tier3_combinations/cross_feature_combinations.test.ts` (7 integration flows passing)
- `tests/e2e/tier4_scenarios/real_world_scenarios.test.ts` (5 real-world scenarios passing)
- Unit & challenger suites: `m3.challenge1.test.ts` (25 tests), `m3.challenge2.test.ts` (50+ tests), `errorStates.test.tsx` (10 tests), `errorStates.challenge.test.tsx` (31 tests), `accessibility.test.tsx` (8 tests), `camera.challenge.test.ts` (52 tests), `secretScan.test.ts` (2 tests).

### 1.2 Prescription Reading & Presentation Test Contracts
From `tests/e2e/fixtures/testContracts.ts`, `tests/e2e/tier1_features/prescription_presentation.test.ts`, and `tests/e2e/tier2_boundaries/prescription_presentation_boundary.test.ts`:

1. **Advisory Banner (F17)**:
   - Constant in `testContracts.ts:59`:
     ```ts
     export const PRESCRIPTION_ADVISORY_BANNER = 'راجع أسماء الأدوية قبل الاعتماد';
     ```
   - Must be rendered at the very top of the prescription result view above all cards (`prescription_presentation.test.ts:102-104`).
2. **Read-Aloud Toolbar / Button (F17)**:
   - Button configuration: Label must contain `'استمع'` (e.g. `'استمع للروشتة كاملة'` or `'استمع للروشتة'`), toggle to `'إيقاف القراءة'` when speaking (`prescription_presentation.test.ts:107-114`, `prescription_presentation_boundary.test.ts:123-127`).
   - Icon: `Volume2` from Lucide (`w-7 h-7` or `w-8 h-8`).
   - Minimum touch target height: $\ge 64$px (`prescription_presentation.test.ts:113`).
   - Arabic TTS: Invokes `window.speechSynthesis.speak(utterance)` with `utterance.lang = 'ar-SA'` or `speechController.speak(audio_summary)` (`prescription_presentation.test.ts:116-124`).
   - Fallback: If `audio_summary` is empty or whitespace, speaks: `'الروشتة تحتوي على: [names]'` or `'لا توجد أدوية للقراءة'` (`prescription_presentation_boundary.test.ts:110-117`).
   - Clean unmount/navigation: Calls `window.speechSynthesis.cancel()` or `speechController.stop()` on tab navigation or unmount (`prescription_presentation.test.ts:133-138`, `cross_feature_combinations.test.ts:164-179`).
3. **Legible Prescription Medicine Cards (F15, F20)**:
   - Rendered for all items where `item.confidence !== 'low'` (`prescription_presentation.test.ts:22-29`, `263-268`).
   - Medicine name: Displayed in extra-large bold font, presenting both Arabic name (`medicine_name_ar`) and English trade name & strength (`medicine_name_en`) (`prescription_presentation.test.ts:31-35`, `prescription_presentation_boundary.test.ts:42-48`). Container width $\le 320$px without horizontal scrollbar.
   - Purpose / Indication: One-sentence simple explanation (`short_explanation`) containing standard disease or indication term (e.g. `'السكري'`) (`prescription_presentation.test.ts:37-41`).
   - "ما كتبه الطبيب" Box: Exact container with title `'ما كتبه الطبيب'` and content displaying `written_instructions` verbatim (e.g. `'قرص مرتين يومياً بعد الأكل'`) (`prescription_presentation.test.ts:43-51`). Doctor shorthand (e.g. `"1x2 pc ac qd"`) and multiline instructions (`\n`) must be preserved without HTML leaks (`prescription_presentation_boundary.test.ts:30-35`, `77-81`).
   - Confidence badge:
     - `'high'` $\rightarrow$ `'واضح'`
     - `'medium'` $\rightarrow$ `'غير مؤكد'`
   - Interactive Detail Navigation: Clicking a readable card opens the 4-card details modal without affecting unclear items (`prescription_presentation.test.ts:283-287`, `cross_feature_combinations.test.ts:51-89`).
4. **Low-Confidence Amber Cards (F16, F20)**:
   - Condition: Items where `item.confidence === 'low'` (`prescription_presentation.test.ts:64-96`).
   - Styling: Soft amber card: `bg-[#FEF3C7] border-amber-400 text-amber-900 rounded-2xl p-6` (border `#F59E0B`, bg `#FEF3C7`) (`prescription_presentation.test.ts:68-71`, `prescription_presentation_boundary.test.ts:60-65`).
   - Mandated Arabic Warning Text:
     ```ts
     export const LOW_CONFIDENCE_AMBER_TEXT = 'غير واضح، اسأل الصيدلي';
     ```
     Exact string with Arabic comma `'،'` (`prescription_presentation.test.ts:73-75`, `testContracts.ts:60`).
   - Strict Zero-Explanation Rule: Must provide ZERO AI explanation or guessed purpose. `short_explanation === ""` and `medicine_name_ar === ""`. No expandable explanation accordion (`prescription_presentation.test.ts:77-80`, `prescription_presentation_boundary.test.ts:67-75`).
   - Verbatim line text: Preserves `line_text_as_written` (or `written_instructions`), e.g. `'Dr scribble ~~~ 10mg'`. If empty or whitespace, displays fallback `'خط غير مقروء'` (`prescription_presentation_boundary.test.ts:83-88`).
   - Icon / ARIA: `AlertTriangle` icon (color `#D97706`), `aria-label` containing `'غير واضح'` (`prescription_presentation.test.ts:87-95`).
   - Non-interactive: Low confidence items cannot be clicked to open details (`prescription_presentation.test.ts:284-287`).
5. **Partial Legibility Preservation (F20)**:
   - If a prescription has mixed readable and unreadable lines, readable lines render as standard cards and unclear lines as amber cards in their original sequential order (`prescription_presentation.test.ts:263-291`, `prescription_presentation_boundary.test.ts:248-281`).
   - The entire prescription is NOT rejected to the retake screen unless `is_clear: false` or `items.length === 0`.
   - Audio summary communicates both readable items and unclear count (`prescription_presentation.test.ts:276-281`, `prescription_presentation_boundary.test.ts:296-304`).
6. **Prescription Flow Triggers & Ergonomics (F09, F10)**:
   - In `tests/m3.challenge1.test.ts:654-656` (HARD CONTRACT):
     ```ts
     expect(screen.getByText('📋 قراءة الروشتة الطبية')).toBeInTheDocument();
     expect(screen.getByRole('button', { name: 'صوّر الروشتة بالكاميرا' })).toBeInTheDocument();
     ```
   - In `tests/m3.challenge1.test.ts:677-684`:
     Clicking HomeScreen Card 2 `screen.getByRole('button', { name: 'صوّر روشتة' })` transitions `activeTab` to `'prescription'`.
   - Dual capture actions:
     - Primary: "صوّر الروشتة" / "صوّر الروشتة بالكاميرا" activating native rear camera with max 1600px and JPEG quality 0.8 (`prescription_pipeline.test.ts:13-30`).
     - Secondary: "اختر من المعرض" / "اختيار من المعرض" activating `CameraSource.Photos` (`prescription_pipeline.test.ts:32-38`).
   - White canvas backdrop `#FFFFFF` to prevent Android WebView black artifacts (`prescription_pipeline.test.ts:94-97`).
   - Cancellation returns null cleanly without alert (`prescription_pipeline.test.ts:40-44`).

### 1.3 Unclear Photo Guidance Test Contracts (`UnclearPhotoCard.tsx`)
From `tests/errorStates.test.tsx`, `tests/errorStates.challenge.test.tsx`, and `tests/e2e/tier1_features/prescription_presentation.test.ts:221-257`:

1. **4 Distinct Error Categories**:
   - `network_timeout` (State a):
     - Title: `'تعذر الاتصال بالشبكة أو انتهت مهلة الطلب'` (`errorStates.test.tsx:29`).
     - Message: includes `'30 ثانية'` and `'التحقق من اتصال الإنترنت'` (`errorStates.test.tsx:30-32`).
     - Primary action: `screen.getByRole('button', { name: /إعادة المحاولة الآن/i })` (`errorStates.test.tsx:34`).
     - Secondary action: `screen.getByRole('button', { name: /تصوير علبة أخرى/i })` (`errorStates.test.tsx:39`).
     - Interactive retry re-analyzes `lastFile` without triggering camera/picker (`errorStates.test.tsx:233-239`, `errorStates.challenge.test.tsx:500-510`).
   - `server_error` (State b):
     - Title: `'حدث خطأ في الخادم الطبي الذكي'` (`errorStates.test.tsx:59`).
     - Debug badge: `screen.getByTestId('error-code-badge')` containing `'رمز الخطأ:'` and `{errorCode}` (`errorStates.test.tsx:62-64`).
     - Primary action: `/إعادة المحاولة الآن/i`.
     - Secondary action: `screen.getByRole('button', { name: /العودة للرئيسية/i })` (`errorStates.test.tsx:70`).
   - `invalid_json` (State d):
     - Title: `'تعذر قراءة رد المعالج الذكي'` (`errorStates.test.tsx:108`).
     - Primary action: `/إعادة المحاولة الآن/i`.
   - `unclear_image` (State c):
     - Title: `'الصورة غير واضحة بما يكفي'` (`errorStates.test.tsx:86`).
     - Message: contains `'غير واضحة'` and `'قراءتها'` (`prescription_presentation.test.ts:231-234`).
     - 3 Mandatory Senior Tips:
       - Tip 1 (Lighting): Contains `'إضاءة'` (e.g. `'تأكد من وجود إضاءة كافية فوق علبة الدواء.'` / `'التأكد من إضاءة الغرفة بشكل كافٍ'`) (`errorStates.test.tsx:87`, `prescription_presentation.test.ts:236-238`).
       - Tip 2 (Framing): Contains `'كاملة'` and `'في منتصف الشاشة'` (e.g. `'قرّب الكاميرا واجعل اسم الدواء أو الروشتة كاملة داخل الإطار في منتصف الشاشة.'`) (`errorStates.test.tsx:88`, `prescription_presentation.test.ts:240-242`).
       - Tip 3 (Steadiness): Contains `'تثبيت'` (e.g. `'تثبيت الهاتف باليدين وعدم الاهتزاز أثناء التصوير.'`) (`prescription_presentation.test.ts:244-246`).
     - **CRITICAL SAFETY CONTRACT**: Debug badge `data-testid="error-code-badge"` **MUST NOT** be rendered for unclear photos (`errorStates.challenge.test.tsx:359`, `379`).
     - Retake action: Must satisfy BOTH `errorStates.test.tsx:90` (`screen.getByRole('button', { name: /إعادة تصوير علبة الدواء الآن/i })`) and `prescription_presentation.test.ts:250-256` (`label: 'إعادة التصوير'`).
2. **Touch Targets & ARIA**:
   - All buttons must have minimum height $\ge 64$px (`errorStates.test.tsx:150-155`, `errorStates.challenge.test.tsx:657-663`).
   - Container has `role="alert"`, `dir="rtl"`, and `text-right` (`errorStates.test.tsx:165-167`).

### 1.4 Medication Usage Card Test Contracts (`ResultCards.tsx` Card 3)
From `tests/e2e/tier1_features/medication_usage.test.ts` and `tests/e2e/tier2_boundaries/medication_usage_boundary.test.ts`:

1. **Card 3 Title & Accessibility**:
   - Title: `'طريقة الاستخدام وأفضل المواعيد'`
   - Section: `tabIndex={0}`, `aria-label="طريقة الاستخدام وأفضل المواعيد"`, subtitle `'البطاقة الثالثة'` (`accessibility.test.tsx:31-33`, `ResultCards.tsx:101-115`).
2. **Non-Empty Guarantee (F21)**:
   - `how_and_when` is strictly non-empty across all box and details responses (`medication_usage.test.ts:11-14`).
   - Must NEVER be a single generic "follow doctor" phrase (`medication_usage.test.ts:16-23`).
   - Contains 2 to 3 practical timing/frequency items (contains `'مرة'`, `'يومياً'`, `'صباحاً'`, `'بعد'`, `'قبل'`) (`medication_usage.test.ts:25-33`).
   - Forbids exact milligram/milliliter dosing amounts: no match for `/(?:^|\s)\d+\s*(?:mg|ml|مجم|مل)(?:\s|$|[.,،])/i` (`medication_usage.test.ts:35-39`, `medication_usage_boundary.test.ts:17-29`).
   - Fallback algorithm injects 3 safe common items (`DEFAULT_COMMON_USAGE`) if AI returns empty (`medication_usage.test.ts:41-56`).
3. **Usage Source Badging (F22)**:
   - Supported values: `'printed'` vs `'common'` (case-insensitive, defaults to `'common'`) (`medication_usage_boundary.test.ts:57-71`).
   - Label mapping:
     - `usage_source === 'printed'` in box context: `'مكتوب على العلبة'` (`medication_usage.test.ts:68-77`).
     - `usage_source === 'printed'` in prescription context: `'مكتوب في الروشتة'` (`medication_usage.test.ts:79-88`).
     - `usage_source === 'common'`: `'الاستخدام الشائع'` (`medication_usage.test.ts:90-95`).
   - Visual styling:
     - `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border` (`medication_usage_boundary.test.ts:80-84`).
     - Printed badge: `bg-emerald-100 text-emerald-800 border-emerald-300` (`medication_usage.test.ts:99-111`).
     - Common badge: `bg-blue-100 text-blue-800 border-blue-300` (`medication_usage.test.ts:99-111`).
4. **Hardcoded Arabic Disclaimer Line (F23)**:
   - Exact constant in `testContracts.ts:58`:
     ```ts
     export const HARDCODED_DISCLAIMER_LINE = 'هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي.';
     ```
   - Exact length: 87 characters. Tamper-free (`medication_usage_boundary.test.ts:99-101`).
   - Placement: Rendered immediately under Card 3 (`medication_usage.test.ts:130-136`).
   - Presence: Must be rendered for BOTH `'printed'` and `'common'` usage sources (`medication_usage.test.ts:138-146`).
   - Styling: `text-slate-600`, minimum 16px font (`text-base` / `text-lg` in 24px mode), `dir="rtl"`, wraps on 320px screen without overflow (`medication_usage.test.ts:148-156`, `medication_usage_boundary.test.ts:108-118`).

### 1.5 Medical Disclaimer Banner Persistence (F08)
From `tests/m3.challenge2.test.ts:875-987`:
- Component: `<DisclaimerBanner />` in `src/components/DisclaimerBanner.tsx`.
- Role: `note`, `aria-label="تنبيه طبي هام"`.
- Header: `تنبيه طبي هام:`.
- Content: `هذه المعلومات إرشادية لتسهيل القراءة ولا تغني بأي حال عن تعليمات طبيبك المعالج أو استشارة الصيدلي.`.
- **Must be persistent on**:
  1. Box scan results view (`m3.challenge2.test.ts:895-957`).
  2. Prescription results view (`PROJECT.md:22`, `navigation_shell.test.ts:242-245`).
  3. Medicine details modal (`PROJECT.md:22`, `navigation_shell.test.ts:247-250`).
- **Must NOT render** when photo result is unclear or failed (`m3.challenge2.test.ts:959-986`).

---

## 2. Logic Chain

1. **Test Suite Integrity & Regression Risk**:
   - Because all 1,021 existing tests currently pass, any modification to `src/App.tsx`, `ResultCards.tsx`, or `UnclearPhotoCard.tsx` must preserve existing prop types, IDs, text, and behavior.
   - Specifically, `tests/m3.challenge1.test.ts` lines 654-656 and lines 673-685 assert the presence of text `'📋 قراءة الروشتة الطبية'` and button `aria-label="صوّر الروشتة بالكاميرا"`. If `PrescriptionFlow` changes these texts or removes this button, `m3.challenge1.test.ts` will fail immediately.
   - Therefore, `PrescriptionFlow` must include the header `'📋 قراءة الروشتة الطبية'` and provide the camera button with `aria-label="صوّر الروشتة بالكاميرا"` (and gallery button with `'اختر من المعرض'`).

2. **State Separation in `src/App.tsx`**:
   - `src/App.tsx` currently manages a single `currentResult: MedicineAnalysisResult | null` and `lastFile: File | null` for box scans.
   - If prescription analysis overwrites `currentResult`, switching between tabs will mix box and prescription schemas, causing TypeScript and runtime errors (e.g. `items` array vs `uses` array).
   - Therefore, `src/App.tsx` must maintain separate state slices:
     - `currentBoxResult: MedicineAnalysisResult | null`
     - `lastBoxFile: File | null`
     - `currentPrescriptionResult: PrescriptionAnalysisResult | null`
     - `lastPrescriptionFile: File | null`
     - `selectedMedicineForDetails: string | null` (for opening `MedicineDetailsModal`)
   - When `activeTab === 'home'`, render `HomeScreen` or box results.
   - When `activeTab === 'prescription'`, render `PrescriptionFlow` (which handles capture, processing, and renders `PrescriptionResultView` or `UnclearPhotoCard` accordingly).

3. **Audio Speech Synthesis Lifecycle**:
   - `tests/e2e/tier3_combinations/cross_feature_combinations.test.ts` Flow 5 mandates that any ongoing speech synthesis MUST be cancelled immediately when navigating between tabs.
   - `speechController` (`src/services/speechController.ts`) provides a singleton `speechController.stop()` that invokes `window.speechSynthesis.cancel()` and resets status to `'idle'`.
   - Therefore, `handleTabChange` in `src/App.tsx` must unconditionally call `speechController.stop()`.
   - In addition, starting a new camera capture, opening the details modal, or switching between audio summaries must invoke `speechController.stop()`.

4. **Unclear Photo Guidance Unification**:
   - `UnclearPhotoCard` must serve both the box flow and prescription flow.
   - In `errorStates.test.tsx:90`, the retake button is queried via `/إعادة تصوير علبة الدواء الآن/i`.
   - In `prescription_presentation.test.ts:250`, the retry button label is `'إعادة التصوير'`.
   - By adding a `context?: 'box' | 'prescription'` prop (defaulting to `'box'`):
     - When `context === 'box'`: `aria-label="إعادة تصوير علبة الدواء الآن"`, text `"📷 إعادة تصوير علبة الدواء الآن"`.
     - When `context === 'prescription'`: `aria-label="إعادة التصوير"`, text `"📷 إعادة التصوير"`.
     - Both match their respective tests cleanly.
   - The 3 senior tips must contain `'إضاءة'` (Tip 1), `'كاملة'` and `'في منتصف الشاشة'` (Tip 2), and `'تثبيت'` (Tip 3).
   - The debug badge `data-testid="error-code-badge"` must ONLY appear for `server_error`, NEVER for `unclear_image`.

5. **Medication Usage Card Updates**:
   - Card 3 in `ResultCards.tsx` must render:
     1. The `usage_source` badge pill:
        - Printed: `bg-emerald-100 text-emerald-800 border-emerald-300`, label `'مكتوب على العلبة'` (or `'مكتوب في الروشتة'` when in prescription context).
        - Common: `bg-blue-100 text-blue-800 border-blue-300`, label `'الاستخدام الشائع'`.
     2. The 2–3 usage items (`how_and_when`).
     3. The hardcoded disclaimer line immediately below the card:
        `"هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي."`
        in `text-slate-600 text-base font-medium mt-3 leading-relaxed`.

---

## 3. Caveats

1. **No Application Source Code Written**:
   - Per explorer role constraints, this report provides architectural blueprints, interface specifications, and exact code templates, but does not modify `src/App.tsx` or components directly.
2. **Capacitor Native Camera Mocking in Vitest**:
   - All camera operations in tests run against mocked `@capacitor/camera` and `speechSynthesis`. The Worker must ensure that native imports (`@capacitor/camera`, `@capacitor/haptics`) continue to degrade gracefully in web preview environments as verified by `camera.challenge.test.ts`.
3. **Storage Quota & Offline Persistence**:
   - Details caching uses `localStorage` with in-memory map fallback (`src/services/detailsCache.ts`). The Worker should ensure modal clicks catch any storage errors as verified in `detailsCache.test.ts`.

---

## 4. Conclusion & Complete Contract Specifications

### 4.1 Master String & Selector Matrix

| Component | Target Element | Selector / Role | Exact Text / Content | Test Reference |
|---|---|---|---|---|
| `App.tsx` | Prescription Tab Header | `getByText` | `📋 قراءة الروشتة الطبية` | `m3.challenge1.test.ts:654` |
| `App.tsx` / `PrescriptionFlow` | Primary Camera Button | `getByRole('button', { name: 'صوّر الروشتة بالكاميرا' })` | `صوّر الروشتة بالكاميرا` / `📷 صوّر الروشتة الآن` | `m3.challenge1.test.ts:655` |
| `PrescriptionFlow` | Secondary Gallery Button | `getByRole('button', { name: /اختر من المعرض/i })` | `اختر من المعرض` / `📁 اختيار من المعرض` | `prescription_pipeline.test.ts:16` |
| `PrescriptionResultView` | Advisory Banner | Top element | `راجع أسماء الأدوية قبل الاعتماد` | `prescription_presentation.test.ts:103` |
| `PrescriptionResultView` | Read-Aloud Button | `getByRole('button', { name: /استمع/i })` | `استمع للروشتة كاملة` / `استمع للروشتة` (toggle: `إيقاف القراءة`) | `prescription_presentation.test.ts:108` |
| `PrescriptionResultView` | Doctor Notes Box | Container header | `ما كتبه الطبيب` | `prescription_presentation.test.ts:46` |
| `PrescriptionResultView` | Confidence Badge (High) | Badge element | `واضح` | `prescription_presentation.test.ts:57` |
| `PrescriptionResultView` | Confidence Badge (Med) | Badge element | `غير مؤكد` | `prescription_presentation.test.ts:57` |
| `PrescriptionResultView` | Amber Card Warning | Amber card text | `غير واضح، اسأل الصيدلي` | `prescription_presentation.test.ts:74` |
| `PrescriptionResultView` | Amber Line Fallback | Empty line fallback | `خط غير مقروء` | `prescription_presentation_boundary.test.ts:84` |
| `PrescriptionResultView` | Amber Card Icon | Lucide AlertTriangle | `aria-label="دواء غير واضح"` / `#D97706` | `prescription_presentation.test.ts:91` |
| `ResultCards` (Card 3) | Usage Source (Printed Box) | Badge pill | `مكتوب على العلبة` | `medication_usage.test.ts:77` |
| `ResultCards` (Card 3) | Usage Source (Printed Rx) | Badge pill | `مكتوب في الروشتة` | `medication_usage.test.ts:87` |
| `ResultCards` (Card 3) | Usage Source (Common) | Badge pill | `الاستخدام الشائع` | `medication_usage.test.ts:95` |
| `ResultCards` (Card 3) | Fixed Disclaimer Line | Under Card 3 | `هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي.` | `medication_usage.test.ts:119` |
| `UnclearPhotoCard` | Network Timeout Title | Alert title | `تعذر الاتصال بالشبكة أو انتهت مهلة الطلب` | `errorStates.test.tsx:29` |
| `UnclearPhotoCard` | Server Error Title | Alert title | `حدث خطأ في الخادم الطبي الذكي` | `errorStates.test.tsx:59` |
| `UnclearPhotoCard` | Server Debug Badge | `getByTestId('error-code-badge')` | `رمز الخطأ: {errorCode}` | `errorStates.test.tsx:62` |
| `UnclearPhotoCard` | Unclear Image Title | Alert title | `الصورة غير واضحة بما يكفي` | `errorStates.test.tsx:86` |
| `UnclearPhotoCard` | Tip 1 (Lighting) | Tip 1 text | `تأكد من وجود إضاءة كافية فوق علبة الدواء أو الروشتة.` | `errorStates.test.tsx:87` |
| `UnclearPhotoCard` | Tip 2 (Framing) | Tip 2 text | `قرّب الكاميرا واجعل اسم الدواء أو الروشتة كاملة داخل الإطار في منتصف الشاشة.` | `errorStates.test.tsx:88` |
| `UnclearPhotoCard` | Tip 3 (Steadiness) | Tip 3 text | `تثبيت الهاتف باليدين وعدم الاهتزاز أثناء التصوير.` | `prescription_presentation.test.ts:227` |
| `UnclearPhotoCard` | Retry Action Button | `getByRole('button', { name: /إعادة المحاولة الآن/i })` | `🔄 إعادة المحاولة الآن` | `errorStates.test.tsx:34` |
| `UnclearPhotoCard` | Box Retake Action Button | `getByRole('button', { name: /إعادة تصوير علبة الدواء الآن/i })` | `📷 إعادة تصوير علبة الدواء الآن` | `errorStates.test.tsx:90` |
| `UnclearPhotoCard` | Rx Retake Action Button | `getByRole('button', { name: /إعادة التصوير/i })` | `📷 إعادة التصوير` | `prescription_presentation.test.ts:250` |
| `DisclaimerBanner` | Medical Disclaimer | `getByRole('note', { name: /تنبيه طبي هام/i })` | `هذه المعلومات إرشادية لتسهيل القراءة ولا تغني بأي حال عن تعليمات طبيبك المعالج أو استشارة الصيدلي.` | `m3.challenge2.test.ts:879` |

---

### 4.2 Safe Integration Architecture for `src/App.tsx`

The recommended integration pattern cleanly separates concerns and prevents state collisions:

```tsx
// State Model in App.tsx:
const [activeTab, setActiveTab] = useState<TabKey>('home');
const [fontSize, setFontSize] = useState<FontSizePreference>(getStoredFontSize());
const [isBoxLoading, setIsBoxLoading] = useState<boolean>(false);
const [currentBoxResult, setCurrentBoxResult] = useState<MedicineAnalysisResult | null>(null);
const [lastBoxFile, setLastBoxFile] = useState<File | null>(null);

// Prescription Flow State:
const [isPrescriptionLoading, setIsPrescriptionLoading] = useState<boolean>(false);
const [currentPrescriptionResult, setCurrentPrescriptionResult] = useState<PrescriptionAnalysisResult | null>(null);
const [lastPrescriptionFile, setLastPrescriptionFile] = useState<File | null>(null);
const [selectedMedicineForDetails, setSelectedMedicineForDetails] = useState<string | null>(null);

// Audio lifecycle on tab change:
const handleTabChange = (tab: TabKey) => {
  speechController.stop(); // Stops any ongoing speech immediately
  setActiveTab(tab);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Prescription tab view in JSX:
{!isPrescriptionLoading && !currentPrescriptionResult && activeTab === 'prescription' && (
  <PrescriptionFlow
    onImageSelected={handlePrescriptionImageSelected}
    disabled={isPrescriptionLoading}
  />
)}

// Prescription results in JSX:
{!isPrescriptionLoading && currentPrescriptionResult && activeTab === 'prescription' && (
  <div className="w-full space-y-6 animate-in fade-in duration-200">
    {!currentPrescriptionResult.is_clear || currentPrescriptionResult.items.length === 0 ? (
      <UnclearPhotoCard
        context="prescription"
        onRetry={handleRetryPrescriptionImage}
        onRetake={handleResetPrescription}
        errorMessage={currentPrescriptionResult.raw_error || currentPrescriptionResult.retake_message}
        errorCategory={currentPrescriptionResult.error_category}
        errorCode={currentPrescriptionResult.error_code}
        hasLastImage={Boolean(lastPrescriptionFile)}
      />
    ) : (
      <>
        <PrescriptionResultView
          result={currentPrescriptionResult}
          fontSize={fontSize}
          onSelectMedicine={(medicineName) => {
            speechController.stop();
            setSelectedMedicineForDetails(medicineName);
          }}
          onReset={handleResetPrescription}
        />
        {/* Persistent Medical Disclaimer on all prescription results */}
        <DisclaimerBanner />
      </>
    )}
  </div>
)}

// Medicine Details Modal:
{selectedMedicineForDetails && (
  <MedicineDetailsModal
    medicineName={selectedMedicineForDetails}
    fontSize={fontSize}
    onClose={() => setSelectedMedicineForDetails(null)}
  />
)}
```

---

## 5. Verification Method

To independently verify 100% compliance without regressions, the Worker and Reviewers should execute the following test commands:

1. **Verify E2E Tier 1 & Tier 2 Suites**:
   ```powershell
   npx.cmd vitest run tests/e2e/tier1_features/ tests/e2e/tier2_boundaries/
   ```
   *Expected*: All 280 tests pass.

2. **Verify Navigation & M3 Shell Backwards Compatibility**:
   ```powershell
   npx.cmd vitest run tests/m3.challenge1.test.ts tests/m3.challenge2.test.ts
   ```
   *Expected*: All 75+ tests pass with zero regressions.

3. **Verify Error States & Interactive Retry**:
   ```powershell
   npx.cmd vitest run tests/errorStates.test.tsx tests/errorStates.challenge.test.tsx
   ```
   *Expected*: All 41 tests pass.

4. **Verify Full Vitest Suite**:
   ```powershell
   npx.cmd vitest run
   ```
   *Expected*: All 40+ test files and 1,021+ tests pass with 0 failures.

5. **Verify TypeScript & Production Build**:
   ```powershell
   npm.cmd run build
   ```
   *Expected*: Exits with code 0, zero TypeScript errors, bundle size under budget.
