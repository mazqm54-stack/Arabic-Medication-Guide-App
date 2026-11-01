# Task Assignment: Reviewer M4 (Milestone M4 Fast-Track Review)

## Role & Mission
You are the sole Reviewer for Milestone M4 of "دليلي الدوائي" under Fast-Track Mode.
Your objective is to independently verify that Worker M4's deliverables satisfy all functional, accessibility, and architectural requirements for Requirements R2, R3, and R4.

## Files to Review
1. `src/components/PrescriptionFlow.tsx`
2. `src/components/PrescriptionResultView.tsx`
3. `src/components/MedicineDetailsModal.tsx`
4. `src/services/myMedicinesStorage.ts`
5. `src/components/UnclearPhotoCard.tsx`
6. `src/components/ResultCards.tsx`
7. `src/App.tsx`
8. `tests/m4.prescription.test.tsx`
9. `package.json` & `android/app/src/main/AndroidManifest.xml` (verify camera crash fixes intact)

## Key Review Checks
1. **Prescription Flow (R2 / F09, F10, F14)**:
   - Does `PrescriptionFlow.tsx` trigger rear camera via `capturePhoto()` and gallery picker via `pickPhoto()`?
   - Is pre-compression using 1600px/0.8 JPEG (`compressPrescriptionImage`)?
   - Does it show an accessible senior loading state with spinner?
   - If empty items or unreadable, does it route to `UnclearPhotoCard`?
2. **Prescription Presentation (R2 / F15, F16, F17, F20)**:
   - Does `PrescriptionResultView.tsx` display top advisory banner `'راجع أسماء الأدوية قبل الاعتماد'`?
   - Does the audio readout button toggle between reading and stop, narrating `audio_summary`?
   - Are legible medicine cards formatted with medicine names, purpose, "ما كتبه الطبيب" box, and confidence badge?
   - Are low-confidence items presented in soft amber cards (`#FEF3C7` / border `#F59E0B`) with text `'غير واضح، اسأل الصيدلي'` and ZERO AI explanation?
   - Is partial legibility preserved?
3. **Medicine Details Modal & Storage (R2 / F18)**:
   - Does tapping a legible card open `MedicineDetailsModal`?
   - Does it fetch details via `fetchMedicineDetails()` with caching via `detailsCache.ts`?
   - Does "أضف لأدويتي" persist medicines into `localStorage` (`dalili_my_medicines_v1`)?
4. **Unclear Photo Guidance (R3 / F19)**:
   - Does `UnclearPhotoCard.tsx` provide exactly 3 concrete tips (lighting, framing, steadiness)?
   - Is the retake button $\ge 64$px high with WCAG AAA contrast?
   - Are legacy tests in `errorStates.test.tsx` preserved?
5. **Medication Usage Card (R4 / F21, F22, F23)**:
   - Does Card 3 in `ResultCards.tsx` guarantee non-empty usage (2-3 items) and never a generic "follow doctor" single phrase?
   - Does it display the `usage_source` badge ("مكتوب على العلبة" vs "الاستخدام الشائع")?
   - Does it display the mandatory 87-character hardcoded Arabic disclaimer string immediately below the usage list?
6. **Mobile Shell & Integrity**:
   - Zero hidden `<input type="file">` elements.
   - Zero secrets / API keys in client code.
   - Camera crash fixes intact (`@capacitor/camera@6.1.2`, AndroidManifest intent queries).
   - Audio stops on tab navigation.
   - Persistent medical disclaimer retained.

## Independent Verification Commands
Execute in the workspace root:
1. `npx.cmd tsc --noEmit` (must exit 0)
2. `npx.cmd vitest run` (must pass 100% across all test files)
3. `npm.cmd run build` (production build must succeed)

## Output Requirements
Write your detailed handoff report to:
`c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_reviewer_m4_1\handoff.md`
Explicitly state your verdict: **APPROVE** or **REQUEST_CHANGES**.
Send a completion message via `send_message` to the orchestrator.


## 2026-10-31T22:07:41Z
Received dispatch from orchestrator (be14d828-8b13-435b-929b-e3dd3fbf5ac6):
Operate as Reviewer M4 for "دليلي الدوائي" in Fast-Track Mode. Conduct independent, rigorous code and verification review of Worker M4's deliverables.
