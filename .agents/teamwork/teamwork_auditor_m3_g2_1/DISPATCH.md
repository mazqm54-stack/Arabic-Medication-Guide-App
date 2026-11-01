# Dispatch: Forensic Auditor for Milestone M3 (Native App Shell, RTL Bottom Navigation & Home Screen)

## Role
teamwork_auditor

## Working Directory
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_auditor_m3_g2_1

## Context & Inputs
- `ORIGINAL_REQUEST.md`: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
- `PROJECT.md`: c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
- Worker M3 Report: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m3_g2_1\handoff.md
- Source Files:
  - `src/index.css`
  - `src/types/index.ts`
  - `src/components/BottomNavBar.tsx`
  - `src/components/HomeScreen.tsx`
  - `src/App.tsx`
  - `package.json`
  - `android/app/src/main/AndroidManifest.xml`

## Forensic Audit Verification Mandate
1. Verify Genuine Implementation:
   - Verify `BottomNavBar.tsx` and `HomeScreen.tsx` contain real React components with authentic state and event handlers, not dummy stubs or facades.
   - Verify zero `<input type="file">` hidden elements in `BottomNavBar.tsx` and `HomeScreen.tsx` (must call `capturePhoto` / `pickPhoto` from `nativeCamera.ts`).
2. Verify Zero Hardcoded Test Bypasses in `src/`.
3. Verify Zero Secrets or API keys in `src/`.
4. Verify Camera Crash Fix Preservation:
   - `package.json` retains `"@capacitor/camera": "^6.1.2"`.
   - `android/app/src/main/AndroidManifest.xml` retains `<queries>` intent filters for `IMAGE_CAPTURE`, `GET_CONTENT`, and `PICK`.
5. Independent Build & Test Execution:
   - `npx.cmd tsc --noEmit`
   - `npx.cmd vitest run tests/e2e/tier1_features/navigation_shell.test.ts tests/e2e/tier2_boundaries/navigation_shell_boundary.test.ts`
   - `npx.cmd vitest run`

## Output
Write `handoff.md` with:
- Observation (findings, build/test results)
- Logic Chain
- Verdict: **CLEAN** or **INTEGRITY VIOLATION**
- Verification Method

## 2026-10-31T19:23:12Z
From: be14d828-8b13-435b-929b-e3dd3fbf5ac6
Message:
You are Forensic Auditor for Milestone M3 (Native App Shell, RTL Bottom Navigation & Home Screen).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_auditor_m3_g2_1
Read your instructions in DISPATCH.md in that directory.
Also read:
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m3_g2_1\handoff.md

Conduct a full forensic integrity audit:
1. Genuine implementation: Verify src/components/BottomNavBar.tsx, src/components/HomeScreen.tsx, src/App.tsx, and src/index.css contain real, authentic logic without dummy facades or mock shortcuts.
2. Check for hidden file inputs: Ensure neither BottomNavBar nor HomeScreen uses <input type="file"> to trigger camera capture (must call nativeCamera.ts).
3. Zero hardcoding of test assertions in src/.
4. Zero secret or API key leaks in src/.
5. Camera crash fix intact (@capacitor/camera@6.1.2 and AndroidManifest <queries>).
6. Independent build & test:
   - npx.cmd tsc --noEmit
   - npx.cmd vitest run tests/e2e/tier1_features/navigation_shell.test.ts tests/e2e/tier2_boundaries/navigation_shell_boundary.test.ts
   - npx.cmd vitest run

Deliver your findings and binary verdict (CLEAN or INTEGRITY VIOLATION) in:
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_auditor_m3_g2_1\handoff.md.
Send a message to the orchestrator when complete.
