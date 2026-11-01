## 2026-10-29T17:33:21Z
You are Worker M2 for Milestone 2: Native Camera Integration & Android Setup (Requirement R1).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_1

Exclusive Write Ownership:
- package.json
- src/services/nativeCamera.ts
- src/components/CameraCapture.tsx
- tests/accessibility.test.tsx
- src/test/setup.ts
- android/app/src/main/AndroidManifest.xml

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

References to read before starting:
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\orchestrator\SCOPE.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_survey_1\survey_camera.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_survey_1\handoff.md

Your tasks:
1. Install `@capacitor/camera` via `npm.cmd install @capacitor/camera` (or matching Capacitor 8 version `^8.2.6`).
2. Create `src/services/nativeCamera.ts`:
   - Import `Camera`, `CameraSource`, `CameraResultType` from `@capacitor/camera`.
   - Implement `capturePhoto()` using `CameraSource.Camera` (rear camera) and `CameraResultType.Base64` (or DataUrl).
   - Implement `pickPhoto()` using `CameraSource.Photos`.
   - Implement runtime permission checking and requesting (`Camera.checkPermissions()`, `Camera.requestPermissions()`).
   - Gracefully handle permission denials with friendly Arabic alert, and handle user cancelation cleanly (no crash/error).
3. Update `src/components/CameraCapture.tsx`:
   - The main button ("صوّر علبة الدواء الآن") MUST invoke native camera with `CameraSource.Camera` via `capturePhoto()`.
   - The photo gallery MUST be a separate secondary button using `CameraSource.Photos` via `pickPhoto()`.
   - Do NOT use an `<input type="file">` for the main button (remove the `<input type="file">` entirely).
4. Verify `android/app/src/main/AndroidManifest.xml`:
   - Ensure `android.permission.CAMERA` is present.
   - Ensure `<uses-feature android:name="android.hardware.camera" android:required="false" />` is declared.
5. Run `npx.cmd cap sync android` and ensure it runs without error.
6. Mock `@capacitor/camera` in `src/test/setup.ts`, update `tests/accessibility.test.tsx` (which had an assertion on `input[capture="environment"]`, update it to test the native camera button), and run all tests (`npm.cmd test`).
7. Write your implementation report in `m2_camera_implementation.md` and complete `handoff.md` in your working directory.
8. Send a message to the orchestrator with results.
