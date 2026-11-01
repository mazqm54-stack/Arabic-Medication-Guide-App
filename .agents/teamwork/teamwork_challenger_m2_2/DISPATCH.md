# Dispatch — Challenger 2 (Milestone 2: Native Camera Integration)

You are Challenger 2 for Milestone 2: Native Camera Integration & Android Setup (Requirement R1).
Your working directory is: `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m2_2`

## References to read:
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\orchestrator\SCOPE.md`
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_1\m2_camera_implementation.md`
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_1\handoff.md`

## Your Task:
Create an empirical verification suite in `tests/nativeCamera.challenger2.test.ts` to rigorously challenge:
1. `src/services/nativeCamera.ts`:
   - Direct unit tests for `capturePhoto()`, `pickPhoto()`, `captureFromCamera()`, `pickFromGallery()`, `checkAndRequestCameraPermissions()`, and `checkAndRequestPhotosPermissions()`.
   - Test edge conditions: permission prompt granted, prompt denied, already granted, already denied, restricted.
   - Test cancelation strings matching: 'User cancelled photos app', 'user cancelled', 'no image picked', 'canceled'.
   - Test malformed/corrupted base64 handling, null returns, and error throwing.
2. Android build sync integrity:
   - Check `android/capacitor.settings.gradle` contains `:capacitor-camera`.
   - Check `android/app/capacitor.build.gradle` contains `project(':capacitor-camera')`.
   - Check `android/app/src/main/AndroidManifest.xml` contains `android.permission.CAMERA` and `<uses-feature android:name="android.hardware.camera" android:required="false" />`.
3. Run your tests via `npm.cmd test -- tests/nativeCamera.challenger2.test.ts`.
4. Run full test suite via `npm.cmd test`.
5. Write your challenge report in `m2_challenge_report.md` and complete `handoff.md` with explicit verdict `APPROVE` or `REQUEST_CHANGES`.
6. Send completion message to orchestrator (`8a80a925-17f2-4fac-a86b-d712a51f21a6`).

## 2026-10-29T18:33:52Z
[Message] timestamp=2026-10-29T18:33:52Z sender=8a80a925-17f2-4fac-a86b-d712a51f21a6 priority=MESSAGE_PRIORITY_HIGH content=You are Challenger 2 for Milestone 2: Native Camera Integration & Android Setup (Requirement R1).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m2_2

MANDATORY: Read c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md before beginning.
Also read:
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m2_2\DISPATCH.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\orchestrator\SCOPE.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_1\m2_camera_implementation.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_1\handoff.md

Your tasks:
1. Write an empirical verification suite in `tests/nativeCamera.challenger2.test.ts` testing `src/services/nativeCamera.ts` in isolation.
2. Rigorously test permissions state transitions, all cancelation string variations, corrupted base64 inputs, and Android Gradle/Manifest settings file consistency.
3. Run `npm.cmd test -- tests/nativeCamera.challenger2.test.ts` and `npm.cmd test`.
4. Write your challenge report in `m2_challenge_report.md` and complete `handoff.md` with explicit verdict APPROVE or REQUEST_CHANGES.
5. Send completion message to orchestrator (conversation ID: 8a80a925-17f2-4fac-a86b-d712a51f21a6).
