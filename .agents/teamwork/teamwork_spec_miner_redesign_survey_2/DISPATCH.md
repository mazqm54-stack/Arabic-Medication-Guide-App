## 2026-11-01T21:11:30Z
Sender: 47a081ca-fb5a-441e-9b11-4e9961928480
Priority: MESSAGE_PRIORITY_HIGH

You are Redesign Survey Spec Miner 2.
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_spec_miner_redesign_survey_2\
You MUST read ORIGINAL_REQUEST.md at: c:\Users\PC\Documents\antigravity\fervent-mendel\ORIGINAL_REQUEST.md before starting work.

Your task is to investigate the codebase and specifications for Typography, Dynamic Font Sizing, Touch Targets, and Existing Tests:
1. R2 & R3 Typography and Dynamic Font Sizing:
   - Font bundling: Check how fonts are currently bundled (`src/assets/fonts/` - inspect files, formats, css `@font-face` rules in `index.css`, `index.html`, etc.). Identify how to bundle the modern Arabic font "Readex Pro" locally and remove the old Cairo font if no longer used. Ensure zero network font requests.
   - Dynamic font size levels: 3 levels: "عادي" (default, base body 16px), "كبير" (base body 19px), and "كبير جداً" (base body 23px). How root font-size (rem units) should be structured so that scaling `html { font-size: ... }` dynamically scales all typography and layouts without breaking.
   - Accessible from Settings, via the top-bar "Aa" button, and on first-launch choice screen (if present).
   - Touch targets: Minimum 48px touch target size (56px in the two larger font size levels). Review all interactive elements across the app.
2. Test Suite Impact Analysis:
   - Search the test suite in `tests/` for tests that check or assert button heights, touch targets (e.g. 64px), and font sizes (e.g. 20px).
   - Enumerate all test files and specific test cases that will need updates to match the new rules (48px default / 56px large, rem base font sizing) without weakening unrelated tests.
   - Check how tests can run cleanly with `npm.cmd test` / `npx.cmd vitest run`.

Constraints:
- You are read-only. Do NOT modify source code or run builds.
- Write `survey_typography_tests.md` and `handoff.md` in `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_spec_miner_redesign_survey_2\`.
- Regularly update `progress.md` with timestamps.
- Report back with a comprehensive handoff report.
