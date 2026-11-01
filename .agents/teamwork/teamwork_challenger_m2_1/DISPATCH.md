# Dispatch — Challenger 1 (Milestone 2: Native Camera Integration)

You are Challenger 1 for Milestone 2: Native Camera Integration & Android Setup (Requirement R1).
Your working directory is: `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m2_1`

## References to read:
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\orchestrator\SCOPE.md`
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_1\m2_camera_implementation.md`
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_1\handoff.md`

## Your Task:
Create an empirical challenge test suite in `tests/camera.challenge.test.ts` to stress-test and challenge Milestone 2:
1. Verify empirical guarantees:
   - Primary button directly invokes `@capacitor/camera` with `source: CameraSource.Camera`, `direction: CameraDirection.Rear`, `resultType: CameraResultType.Base64`.
   - Gallery button directly invokes `@capacitor/camera` with `source: CameraSource.Photos`.
   - NO `<input type="file">` exists in DOM under any state.
   - Permission denial gracefully triggers accessible Arabic error banner with `role="alert"`.
   - Cancelation (dismissing picker or camera) resolves cleanly without throwing uncaught exceptions or presenting false error alerts.
   - Disabled prop prevents camera/gallery interaction.
   - Base64-to-File conversion preserves format ('image/jpeg') and metadata (`width`, `height`, `base64Data`).
2. Run your challenge test suite via `npm.cmd test -- tests/camera.challenge.test.ts` and verify all tests pass.
3. Run the full test suite `npm.cmd test` to ensure zero regressions across existing tests.
4. Write your challenge report in `m2_challenge_report.md` and complete `handoff.md` with explicit verdict `APPROVE` or `REQUEST_CHANGES`.
5. Send completion message to orchestrator (`8a80a925-17f2-4fac-a86b-d712a51f21a6`).


## 2026-10-29T18:33:28Z
You are Challenger 1 for Milestone 2: Native Camera Integration & Android Setup (Requirement R1).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m2_1

MANDATORY: Read c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md before beginning.
Also read:
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m2_1\DISPATCH.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\orchestrator\SCOPE.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_1\m2_camera_implementation.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_1\handoff.md

Your tasks:
1. Write an empirical challenge test suite in `tests/camera.challenge.test.ts`.
2. Test native camera invocation (`CameraSource.Camera`, `CameraDirection.Rear`), gallery invocation (`CameraSource.Photos`), zero file inputs, permission denial alerts, clean cancelation handling, disabled states, and base64-to-File conversion.
3. Run `npm.cmd test -- tests/camera.challenge.test.ts` and `npm.cmd test`.
4. Write your challenge report in `m2_challenge_report.md` and complete `handoff.md` with explicit verdict APPROVE or REQUEST_CHANGES.
5. Send completion message to orchestrator (conversation ID: 8a80a925-17f2-4fac-a86b-d712a51f21a6).
