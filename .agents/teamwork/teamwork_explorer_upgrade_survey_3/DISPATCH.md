# Dispatch for Explorer 3 (Usage, Build & Test Survey)
Survey R4 & R5 (Medication Usage Card, Android Build/Versioning, Test Infrastructure, Worker Deployment).
See prompt for full details.


## 2026-10-31T14:28:41Z
You are Survey Explorer 3 (Usage, Build & Test Explorer).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_upgrade_survey_3\
Your parent is: be14d828-8b13-435b-929b-e3dd3fbf5ac6

MANDATORY: Read the authoritative request file at:
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md before starting.

You are a read-only exploration agent. Do NOT modify application code.

Your Mission:
Survey R4 (Medication Usage Card) and R5 (Test Suite, Versioning, and Live Deployment):
1. Investigate Medication Usage Card ("كيف ومتى") & Worker Box Prompt Rule 6:
   - Examine how medication results and `how_and_when` are currently modeled, validated, and rendered in `src/` (e.g. `ResultCards.tsx`, `types/`).
   - Requirements: `how_and_when` must NEVER be empty and must not just say "follow doctor". Give 2–3 short items about COMMON general usage of active ingredient (timing e.g. before/after food, typical frequency in general words). NO mg/ml amounts, exact doses, or treatment durations.
   - If box/prescription prints instructions, show those first labeled "مكتوب على العلبة" or "مكتوب في الروشتة".
   - Field `usage_source`: "printed" or "common", labeling general items "الاستخدام الشائع".
   - Fixed Arabic disclaimer line under card: "هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي." (hardcoded in app, not AI generated).
   - Worker box system instruction Rule 6: examine existing rule in `worker/src/index.ts` and how to update it to allow this general common usage while forbidding exact doses and personal medical advice.
2. Investigate Android Build, Versioning & Signing:
   - Inspect `android/app/build.gradle` for current `versionCode` and `versionName`.
   - Inspect `sign-release.bat` for how the release APK is signed and how to remind the user to increment them on each release (or automate the check/increment) for clean APK upgrade.
   - Note command conventions (`npm.cmd`, `npx.cmd`).
3. Investigate Test Suite & Secret Scans:
   - Inspect existing tests in `tests/`, vitest configuration in `vitest.config.ts`, test runner commands (`npm.cmd test` / `npx.cmd vitest run`).
   - Identify test requirements for: bottom navigation, prescription JSON validator (low confidence flagged, empty items goes to retake), details mode & cache, usage never empty, fixed disclaimer line present, secret scan.
4. Investigate Cloudflare Worker Deployment & Live Endpoint Testing:
   - Check `worker/wrangler.toml` and live URL `https://dalili-medication-guide-worker.dalili-medication.workers.dev`.
   - Review deployment process (`npx.cmd wrangler deploy`) and requirements for live testing with real sample images and documenting status codes and response times.

Deliver your detailed findings, verified evidence chains, and feature inventory to:
`c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_upgrade_survey_3\survey_usage_build_tests.md`
Also create `handoff.md` and keep `progress.md` updated with timestamps.
Send a message back to parent when completed.


## 2026-10-31T14:44:21Z
**Context**: Survey Explorer 3 (Medication Usage Card, Android Build/Versioning, Tests & Cloudflare Deployment).
**Content**: Checking in on your survey status. We noted your initial setup at 14:30Z. Explorer 1 and Spec Miner 2 have completed their investigations.
**Action**: Please reply with your current status and progress on R4/R5 investigation and when you expect to complete `survey_usage_build_tests.md`.
