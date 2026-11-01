# Task Assignment: Explorer 1 (Milestone M4 — Prescription UI & Details Flow)

## Role & Mission
You are Explorer 1 for Milestone M4 of "دليلي الدوائي".
Your objective is to investigate the technical architecture, component design, and integration touchpoints for the Prescription Reading Flow and Medicine Details Mode in the React + TypeScript frontend.

## Scope of Investigation
1. **Prescription Tab & Flow (`src/components/PrescriptionFlow.tsx` / `src/App.tsx`)**:
   - How the "الروشتة" (`prescription`) tab is integrated into `App.tsx`.
   - Camera triggering ("صوّر الروشتة") and gallery picker integration via `src/services/nativeCamera.ts`.
   - Pre-compression using `compressPrescriptionImage` (1600px, 0.8 quality).
   - Calling `analyzePrescriptionImage` via `src/services/geminiVision.ts`.
   - Loading states, spinners, and senior feedback during in-flight analysis.

2. **Prescription Result View (`src/components/PrescriptionResultView.tsx`)**:
   - Rendering prescription multi-item results (`items: PrescriptionItem[]`).
   - Card layout per legible medicine: Large name, one-line purpose (`short_explanation`), "ما كتبه الطبيب" container with `written_instructions`, and confidence badge.
   - Low-confidence presentation: Soft amber card with text "غير واضح، اسأل الصيدلي" and NO AI explanation.
   - Advisory banner: "راجع أسماء الأدوية قبل الاعتماد".
   - Whole-prescription audio read-aloud button using `audio_summary` and `src/services/audioSpeech.ts`.
   - Empty prescription items handling (`is_clear: false` or empty `items` routing to retake screen).

3. **Medicine Details Modal (`src/components/MedicineDetailsModal.tsx`)**:
   - Tapping any legible prescription card opens a 4-card details modal for that medicine.
   - Fetching details using `fetchMedicineDetails(medicine_name)` with caching via `src/services/detailsCache.ts`.
   - "أضف لأدويتي" action allowing user to add the medicine to their tracked medicines (`medicationStorage.ts`).

## Required Artifacts to Inspect
- `PROJECT.md` (Features F09, F14, F15, F16, F17, F18, F20)
- `ORIGINAL_REQUEST.md` (Section R2)
- `src/types/index.ts` (`PrescriptionItem`, `PrescriptionAnalysisResult`, `MedicineAnalysisResult`)
- `src/services/geminiVision.ts` (`analyzePrescriptionImage`, `fetchMedicineDetails`)
- `src/services/detailsCache.ts`
- `src/services/audioSpeech.ts`
- `src/components/ResultCards.tsx` (for reference styling and accessibility)
- `tests/e2e/tier1_features/prescription_reading.test.ts`
- `tests/e2e/tier2_boundaries/prescription_boundaries.test.ts`

## Output Requirements
Produce a comprehensive technical handoff report at:
`c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_1\handoff.md`
Detailing:
- Architecture and component specifications.
- Exact prop interfaces, state variables, and callbacks.
- Step-by-step code templates for the Worker to implement.
- Edge cases and error handling.
Do NOT write application source code directly; you are an Explorer.


## 2026-10-31T20:07:05Z
[Message] timestamp=2026-10-31T20:07:05Z sender=be14d828-8b13-435b-929b-e3dd3fbf5ac6 priority=MESSAGE_PRIORITY_HIGH content=You are Explorer 1 for Milestone M4 (Prescription UI & Details Flow).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_1
Read your assignment in c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_1\DISPATCH.md.
Also read c:\Users\PC\Documents\antigravity\fervent-mendel\ORIGINAL_REQUEST.md and c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md.
Investigate the technical component design, interfaces, and integration requirements for the Prescription Reading Flow (camera/gallery, compression, result cards, low-confidence amber cards, details modal, read-aloud button).
Write your complete handoff report to c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_1\handoff.md and report back via send_message to orchestrator. Do not write source code directly.
