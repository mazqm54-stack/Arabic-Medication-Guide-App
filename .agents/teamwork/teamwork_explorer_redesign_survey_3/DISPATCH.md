## 2026-11-01T21:12:11Z
From: 47a081ca-fb5a-441e-9b11-4e9961928480
Priority: MESSAGE_PRIORITY_HIGH

You are Redesign Survey Explorer 3.
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_redesign_survey_3\
You MUST read ORIGINAL_REQUEST.md at: c:\Users\PC\Documents\antigravity\fervent-mendel\ORIGINAL_REQUEST.md before starting work.

Your task is to investigate the codebase for Theming, Dark Mode Tokens, Android System Bars, Launcher Icons/Assets, and Build/Verification:
1. R4 Dark Mode & System Theming:
   - Investigate how themes are currently handled (or if Tailwind `dark` class is configured in `tailwind.config.js`).
   - Theme options in Settings: "تلقائي" (follows system, default), "فاتح" (light), and "داكن" (dark), persisted locally (e.g. localStorage/Capacitor preferences) with zero flash of incorrect theme on startup (check `index.html` inline script).
   - Token-based dark palette: background #0E1517, surface #162124, surface-2 #1D2B2F, text #E6EEF0, muted text #9FB3B8, primary #3DB8C4, warning box background #3A2E12 with text #F5D58A.
   - Contrast check: ensure at least 4.5:1 text contrast for all text, confidence chips, amber card "غير واضح، اسأل الصيدلي", borders, bottom nav, and status bar.
   - Android status bar and navigation bar colors: check how to synchronize them with active theme (e.g., `@capacitor/status-bar`, theme-color meta tag, or native Android styles in `android/app/src/main/res/values/styles.xml`).
2. R5 Launcher Icons and App Assets:
   - Check current assets in `android/app/src/main/res/` (mipmap directories for launcher icons, drawable for splash screens).
   - Check available tools/scripts in the repo for generating assets (e.g. `@capacitor/assets`, custom script, or SVG/PNG generation).
   - Design spec: adaptive Android app launcher icon (teal #006D77 background, clean white prescription sheet with capsule symbol, clear at small sizes) and matching splash screens (light and dark).
3. Screenshot verification & Android Build:
   - Requirement: "Screenshots captured in browser at 360x800 and 320x640 in light and dark modes across all 3 font sizes for: home, medicine result, prescription result (with low-confidence item), unclear-photo, my medicines, history, settings, confirming zero clipping or overlapping."
   - Check what tools (Puppeteer, Playwright, or Node canvas/script) are available or can be run via npx to capture these screenshots.
   - Version code & version name: check `android/app/build.gradle` (currently versionCode 2, versionName "1.1") and `sign-release.bat`. Plan the bump for this release.
   - Ensure keystore and password files remain strictly ignored in `.gitignore`.

Constraints:
- You are read-only. Do NOT modify source code or run builds.
- Write `survey_theming_assets.md` and `handoff.md` in `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_redesign_survey_3\`.
- Regularly update `progress.md` with timestamps.
- Report back with a comprehensive handoff report.
