# Dispatch: Forensic Integrity Auditor for Milestone M2 (Client Data Layer & Services)

## Role
teamwork_auditor

## Working Directory
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_auditor_m2_g2_1

## Context & Files to Audit
- `ORIGINAL_REQUEST.md`: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
- `PROJECT.md`: c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
- Worker M2 Report: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_g2_1_r2\handoff.md
- Source Files:
  - `src/types/index.ts`
  - `src/utils/imageProcessor.ts`
  - `src/services/geminiVision.ts`
  - `src/services/geminiParser.ts`
  - `src/services/detailsCache.ts`
- Test Files:
  - `tests/detailsCache.test.ts`
  - `tests/imageProcessor.test.ts`
  - `tests/geminiParser.test.ts`

## Mandatory Integrity Audit Checks
1. Genuine Implementation vs Mock/Facade:
   - Ensure `compressPrescriptionImage`, `validatePrescriptionJson`, `fetchMedicineDetails`, and `detailsCache` contain real, executing TypeScript logic, not stubs or hardcoded fixtures.
2. Hardcoding Check:
   - Search `src/` for hardcoded strings specifically matching test assertions or dummy bypasses.
3. Secret Exposure Check:
   - Verify zero API keys, secrets, or Gemini credentials in client-side code (`src/`).
4. Camera Crash Fix Preservation:
   - Verify `package.json` retains `@capacitor/camera@6.1.2` (no upgrade to 8.x).
   - Verify `android/app/src/main/AndroidManifest.xml` preserves `<queries>` for `IMAGE_CAPTURE`, `GET_CONTENT`, and `PICK`.
5. Independent Compilation & Full Test Suite:
   - Run: `npx.cmd tsc --noEmit`
   - Run: `npx.cmd vitest run`

## Output
Write `handoff.md` with:
- Observation (findings on each check)
- Logic Chain
- Verdict: **CLEAN** or **INTEGRITY VIOLATION**
- Verification Method


## 2026-10-31T17:02:09Z
You are Forensic Auditor for Milestone M2 (Client Data Layer, Types, Image Compression & Services).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_auditor_m2_g2_1
Read your instructions in DISPATCH.md in that directory.
Also read:
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_g2_1_r2\handoff.md

Conduct a full forensic integrity audit:
1. Genuine implementation: Verify src/types/index.ts, src/utils/imageProcessor.ts, src/services/geminiVision.ts, src/services/geminiParser.ts, src/services/detailsCache.ts contain real, authentic logic without dummy facades or mock bypasses.
2. Hardcoding: Verify no test outputs or assertions are hardcoded in src/.
3. Secret Exposure: Verify zero API keys or secrets in src/ or client code.
4. Camera Crash Fix: Verify package.json retains @capacitor/camera@6.1.2 and AndroidManifest preserves <queries> for IMAGE_CAPTURE, GET_CONTENT, and PICK.
5. Independent Build & Test:
   - npx.cmd tsc --noEmit
   - npx.cmd vitest run

Deliver your findings and binary verdict (CLEAN or INTEGRITY VIOLATION) in c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_auditor_m2_g2_1\handoff.md.
Then send a brief message to the orchestrator with your verdict.
