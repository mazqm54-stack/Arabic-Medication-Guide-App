# Task Assignment: Worker M4 (Prescription UI Flow, Unclear Guidance & Medication Usage Card)

## Role & Mission
You are Worker M4 for "دليلي الدوائي".
Your objective is to implement the components, UI integration, and storage services for Milestone M4 (Requirements R2, R3, R4) following the complete specifications and code templates from the M4 Explorers.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A forensic auditor and reviewer will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Files Owned Exclusively by Worker M4
1. `src/components/PrescriptionFlow.tsx` (new)
2. `src/components/PrescriptionResultView.tsx` (new)
3. `src/components/MedicineDetailsModal.tsx` (new)
4. `src/services/myMedicinesStorage.ts` (new)
5. `src/components/UnclearPhotoCard.tsx` (modify/enhance)
6. `src/components/ResultCards.tsx` (modify/enhance Card 3)
7. `src/App.tsx` (wire up prescription flow & my medicines view)

## Reference Reports & Code Templates
You MUST read and use the exact architectures, contracts, and drop-in implementations from:
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_1\handoff.md` (PrescriptionFlow, PrescriptionResultView, MedicineDetailsModal, myMedicinesStorage)
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_2\handoff.md` (UnclearPhotoCard, ResultCards Card 3, disclaimer line)
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_3\handoff.md` (E2E Test contracts, selectors, exact Arabic strings, App.tsx integration)
- `ORIGINAL_REQUEST.md` (Sections R2, R3, R4)
- `PROJECT.md` (Features F09, F14–F23)

## Key Technical Specifications

### 1. `src/components/PrescriptionFlow.tsx`
- Dual camera/gallery triggers: "صوّر الروشتة" (calls `capturePhoto()`), gallery button (calls `pickPhoto()`).
- Pre-compresses prescription photos using `compressPrescriptionImage(file)` (1600px max dimension, 0.8 JPEG quality).
- In-flight analysis: calls `analyzePrescriptionImage(file.base64Data, 'prescription')` from `src/services/geminiVision.ts`.
- Shows accessible Arabic senior loading screen with spinner during analysis.
- If `is_clear === false` or `items.length === 0`: routes to `UnclearPhotoCard` with `context="prescription"`.
- If analysis succeeds with readable items: renders `PrescriptionResultView`.
- Camera mutex lock: guards against double taps with `isCapturing` lock.

### 2. `src/components/PrescriptionResultView.tsx`
- Advisory Banner at top: `PRESCRIPTION_ADVISORY_BANNER = 'راجع أسماء الأدوية قبل الاعتماد'` in `bg-teal-50 border-teal-200 text-[#006D77]`.
- Whole-prescription Audio Read-Aloud Toolbar: Button labeled `'استمع للروشتة كاملة'` (or containing `'استمع'`), toggling to `'إيقاف القراءة'` when speaking. Uses `speechController` or `window.speechSynthesis` (`ar-SA`/`ar-EG`) to narrate `audio_summary`.
- Legible Medicine Cards (where `item.confidence !== 'low'`):
  - Arabic and English trade names and concentration.
  - One-line purpose (`short_explanation`).
  - "ما كتبه الطبيب" Box with title `'ما كتبه الطبيب'` rendering `written_instructions` verbatim.
  - Confidence badge: `'واضح'` for high, `'غير مؤكد'` for medium.
  - Tapping legible card opens `MedicineDetailsModal`.
- Low-Confidence Amber Cards (where `item.confidence === 'low'`):
  - Soft amber card: `bg-[#FEF3C7] border-[#F59E0B] text-amber-900`.
  - Mandated Warning Text: `'غير واضح، اسأل الصيدلي'` (exact string with Arabic comma).
  - Strict zero-explanation rule: NO AI explanation, no medical guesses.
  - Verbatim line text: renders `line_text_as_written` or `written_instructions` (fallback `'خط غير مقروء'`).
  - Warning icon (`AlertTriangle`). Non-clickable.
- Sticky Reset Action Button: `'🔄 تصوير روشتة أخرى'` resetting to prescription camera capture.
- Persistent medical disclaimer: `<DisclaimerBanner />` rendered underneath.

### 3. `src/components/MedicineDetailsModal.tsx`
- Modal dialog opened when user taps a legible prescription card.
- Backed by `fetchMedicineDetails(medicineName)` from `geminiVision.ts` with local caching via `detailsCache.ts`.
- Shows 4 cards for the medicine: (1) Name & active ingredient, (2) Uses, (3) Usage & timing with `usage_source` badge & fixed disclaimer, (4) Warnings.
- Action button: `'⭐ أضف لأدويتي'` (or `'✓ مضاف لأدويتي'`) saving medicine to `dalili_my_medicines_v1` via `myMedicinesStorage.ts`.
- Close button (`✕ إغلاق`).

### 4. `src/services/myMedicinesStorage.ts`
- Utility to get, add, and remove medicines in `localStorage` under key `dalili_my_medicines_v1`.
- Clean error handling and deduplication by medicine name.

### 5. `src/components/UnclearPhotoCard.tsx`
- Support both `box` and `prescription` flows via `context?: 'box' | 'prescription'`.
- Unified guidance with exactly 3 concrete tips:
  1. الإضاءة: إضاءة كافية بدون ظلال أو لمعان شديد.
  2. الإطار: ملء الشاشة بالعلبة أو الروشتة ووضوح الكلام.
  3. الثبات: تثبيت الهاتف باليدين لمنع الاهتزاز أثناء التصوير.
- Retake button: $\ge 64$px touch target, labeled "إعادة التصوير" (or preserving "إعادة تصوير العلبة الآن" when in box mode to satisfy legacy tests in `errorStates.test.tsx`).
- Support disabled/retrying state during in-flight retake.

### 6. `src/components/ResultCards.tsx` (Card 3 Updates)
- Guarantee `how_and_when` is never empty and never generic "follow doctor".
- Render `usage_source` badge: "مكتوب على العلبة" (if `usage_source === 'printed'`), "الاستخدام الشائع" (if `usage_source === 'common'`).
- Immediately underneath Card 3 usage list, render the exact mandatory hardcoded Arabic disclaimer string:
  `"هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي."`

### 7. `src/App.tsx` Integration
- Wire up the `'prescription'` tab in `BottomNavBar` to display `PrescriptionFlow`.
- Wire up the `'medicines'` tab to display saved medicines from `myMedicinesStorage`.
- Ensure switching tabs stops any active audio readout (`speechController.stop()`).
- Maintain persistent `<DisclaimerBanner />`.
- Retain camera crash fixes (`@capacitor/camera@6.1.2`, AndroidManifest intent queries).

## Verification Requirements
Worker M4 MUST:
1. Run `npx.cmd tsc --noEmit` and verify 0 type errors.
2. Run `npx.cmd vitest run` and verify ALL 1,021+ tests pass with 0 regressions.
3. Write a comprehensive completion report to:
   `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m4_1\handoff.md`
4. Send a completion message via `send_message` to the orchestrator.


## 2026-10-31T20:54:51Z
You are Worker M4 for "دليلي الدوائي".
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m4_1
Read your assignment in c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m4_1\DISPATCH.md.
Also read:
- c:\Users\PC\Documents\antigravity\fervent-mendel\ORIGINAL_REQUEST.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_1\handoff.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_2\handoff.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Files you exclusively own and must implement/enhance:
1. src/components/PrescriptionFlow.tsx (new)
2. src/components/PrescriptionResultView.tsx (new)
3. src/components/MedicineDetailsModal.tsx (new)
4. src/services/myMedicinesStorage.ts (new)
5. src/components/UnclearPhotoCard.tsx (enhance: 3 tips on lighting/framing/steadiness, retake button, box & prescription support)
6. src/components/ResultCards.tsx (enhance Card 3: usage_source badge, safe non-empty fallback, hardcoded Arabic disclaimer string)
7. src/App.tsx (wire up prescription tab and my medicines tab, stop speech on navigation, disclaimer persistence)

Run `npx.cmd tsc --noEmit` and `npx.cmd vitest run` to ensure 0 type errors and 100% green tests across the repository.
Write your complete handoff report to c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m4_1\handoff.md and report back via send_message to orchestrator.


## 2026-10-31T21:20:41Z
**Context**: Server restart recovery for Milestone M4.
**Content**: Server has restarted. Please resume your implementation work immediately:
1. Implement `src/services/myMedicinesStorage.ts`
2. Implement `src/components/MedicineDetailsModal.tsx`
3. Implement `src/components/PrescriptionResultView.tsx`
4. Implement `src/components/PrescriptionFlow.tsx`
5. Enhance `src/components/UnclearPhotoCard.tsx` (3 tips + retake button, box & prescription support)
6. Enhance `src/components/ResultCards.tsx` (Card 3 usage_source badge, non-empty fallback, hardcoded disclaimer)
7. Integrate into `src/App.tsx` (prescription tab, medicines tab, stop speech on navigation, disclaimer persistence)
Verify with `npx.cmd tsc --noEmit` and `npx.cmd vitest run`.
Write your handoff to `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m4_1\handoff.md` and message orchestrator when done.
**Action**: Resume execution and implement the M4 deliverables.
