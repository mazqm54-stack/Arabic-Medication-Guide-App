# Worker M5 Dispatch Task

## 2026-10-31T22:34:19Z
You are Worker M5 for Dalili Medication Guide (دليلي الدوائي).

Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\worker_m5\
Please read your instructions at: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\worker_m5\DISPATCH.md
And reference documents:
- c:\Users\PC\Documents\antigravity\fervent-mendel\ORIGINAL_REQUEST.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md

## Scope & Tasks
Implement Milestone M5: Android Versioning, Release Signing Automation, Vitest 100% Suite Pass, and Live Cloudflare Worker Deployment (Features F25–F28).

1. **Android Versioning (F25)**:
   - Edit `android/app/build.gradle`:
     - Update `versionCode 1` -> `versionCode 2`
     - Update `versionName "1.0"` -> `versionName "1.1"`
   - Maintain namespace `com.dalili.medicationguide`, camera crash queries, and existing SDK settings.

2. **Release Signing Script (F26)**:
   - Edit `sign-release.bat`:
     - Add explicit reminder message to the developer before step [1/4] to verify that `versionCode` and `versionName` in `android/app/build.gradle` are incremented for clean APK upgrades on target Android devices (Current: versionCode 2, versionName "1.1").
     - Preserve keystore checks, password masking, Gradle assembleRelease invocation, and apksigner verification.

3. **Capacitor Sync**:
   - Run `npm.cmd run build`
   - Run `npx.cmd cap sync android` to sync web assets in `dist/` into Android public assets.

4. **Cloudflare Worker Deployment & Live Test (F28)**:
   - Run `npx.cmd wrangler deploy` from `worker/` directory (or project root with appropriate path).
   - If deployment succeeds, capture the live worker URL.
   - Run a test against the live worker:
     - Check `/health` endpoint.
     - Send a test request with sample image payload to `/api/analyze` or `/api/prescription`.
     - Record actual HTTP response status code, headers, and measured response latency in milliseconds.
   - If `wrangler deploy` fails due to lack of network/Cloudflare login credentials, document the command output, verify `worker/src/index.ts` and `worker/wrangler.toml` are completely valid, test with local/mock worker endpoints, and record results clearly.

5. **Quality Verification (F27 & F02)**:
   - Run `npx.cmd tsc --noEmit` -> ensure 0 errors.
   - Run `npx.cmd vitest run` -> ensure all test files pass 100%.
   - Run `npx.cmd vitest run tests/secretScan.test.ts` -> ensure 0 secrets in client code or `dist/`.
   - Update `PROJECT.md` table to mark M5 status as DONE (and M4 as DONE if not updated).

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion Deliverables
Write your handoff report to `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\worker_m5\handoff.md` and send a message back with your findings, command outputs, live latency test results, and status.

## 2026-10-31T22:58:12Z
**Context**: Milestone M5 Execution Status Check
**Content**: Heartbeat check 10: Please report your current progress on Milestone M5. Have `npm.cmd run build`, `npx.cmd cap sync android`, and the tests completed?
**Action**: Provide a brief status update or deliver your handoff report if complete.
