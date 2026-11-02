# DISPATCH

## 2026-11-01T22:37:50Z
Sender: 47a081ca-fb5a-441e-9b11-4e9961928480
Priority: MESSAGE_PRIORITY_HIGH

You are Worker M1 Redesign.
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m1_redesign\
You MUST read ORIGINAL_REQUEST.md at: c:\Users\PC\Documents\antigravity\fervent-mendel\ORIGINAL_REQUEST.md before starting work.
You MUST also read PROJECT.md at: c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md and the survey report at: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_spec_miner_redesign_survey_2\survey_typography_tests.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your task is to implement Milestone 1: Typography, Readex Pro Font, Dynamic Rem Sizing & Touch Targets:
1. Local Font Bundling ("Readex Pro"):
   - Bundle the modern Arabic font "Readex Pro" locally in `src/assets/fonts/` (ensure WOFF2 files exist with valid font headers, covering Regular 400, Medium 500, SemiBold 600, Bold 700). Note: If network downloads from Google are blocked by sandbox/offline environment, you can generate or bundle valid local font files using Node.js or existing tools.
   - Configure local `@font-face` declarations in `src/index.css`.
   - Remove remote Google Fonts links (`<link rel="preconnect"...>` and `<link rel="stylesheet"...>`) from `index.html`.
   - Update `tailwind.config.js` to set font family `sans` to `['"Readex Pro"', 'system-ui', 'sans-serif']` (keep `cairo: ['"Readex Pro"', 'sans-serif']` as alias for backward compatibility).
   - Ensure zero external network font requests.
2. Dynamic Rem Root Font Sizing & 3 Selectable Levels:
   - 3 levels: "عادي" (normal, base 16px, default), "كبير" (large, base 19px), "كبير جداً" (extra-large, base 23px).
   - In `src/types/index.ts`: update `FontSizePreference = 'normal' | 'large' | 'extra-large'`.
   - In `src/services/preferencesStorage.ts`: set default to `'normal'`, validate and save `'normal' | 'large' | 'extra-large'`, and provide DOM class updater (`applyFontSizeToDOM`).
   - In `src/index.css`:
     `html.font-size-normal { font-size: 16px; --touch-min: 48px; }`
     `html.font-size-large { font-size: 19px; --touch-min: 56px; }`
     `html.font-size-extra-large { font-size: 23px; --touch-min: 56px; }`
     Set universal buttons: `min-height: var(--touch-min, 48px);`
   - In `tailwind.config.js`: convert `fontSize` tokens (`senior-xs` through `senior-3xl`) to `rem` units per Section 3.2 of `survey_typography_tests.md`.
3. Touch Targets (48px / 56px) & Legacy Tests Adaptation:
   - In `src/test/setup.ts`: update custom matcher `toHaveMinTouchTarget(received, minSize = 48)` and support `min-h-[48px]`, `min-h-[56px]`, `min-w-[48px]`, `min-w-[56px]`, `h-12`, `h-14`.
   - Update legacy tests in `tests/` that assert 64px button heights or 20px font-sizes per the detailed line-by-line guide in `survey_typography_tests.md` Section 5.2 (e.g. `tests/m3.challenge2.test.ts`, `tests/m3.challenge1.test.ts`, `tests/camera.challenge.test.ts`, `tests/errorStates.test.tsx`, `tests/elderlyDesign.test.tsx`, `tests/seniorDesignReview.test.ts`, etc.).
   - DO NOT weaken unrelated tests.
4. Verification:
   - Run type check: `npx.cmd tsc --noEmit`.
   - Run test suite: `npm.cmd test` / `npx.cmd vitest run`. All 42 suites (1042+ tests) MUST pass 100%!
   - Run production build: `npm.cmd run build`. Must compile cleanly with zero errors.

Windows constraints:
- Use `npx.cmd` and `npm.cmd`.
- Write your completion report in `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m1_redesign\handoff.md`.
- Report back with passing test outputs.
