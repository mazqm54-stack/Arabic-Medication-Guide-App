## 2026-11-02T00:17:00Z
You are Worker M2 Redesign.
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_redesign\
You MUST read ORIGINAL_REQUEST.md at: c:\Users\PC\Documents\antigravity\fervent-mendel\ORIGINAL_REQUEST.md before starting work.
You MUST also read PROJECT.md at: c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md and Explorer 3's survey report at: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_redesign_survey_3\survey_theming_assets.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your task is to implement Milestone 2: Dark Mode Tokens, Theming & Android System Bars Synchronization:
1. Tailwind Configuration:
   - In `tailwind.config.js`: add `darkMode: 'class'`.
   - Add dark color tokens to theme colors:
     - Background: `#0E1517`
     - Surface: `#162124`
     - Surface-2: `#1D2B2F`
     - Text: `#E6EEF0`
     - Muted text: `#9FB3B8`
     - Primary: `#3DB8C4`
     - Warning box background: `#3A2E12` with text: `#F5D58A`
2. Zero Startup Theme Flash in `index.html`:
   - In `index.html` `<head>`: insert a synchronous inline `<script>` before `<body>` that immediately reads `localStorage.getItem('dalili_theme_preference')`. If theme is `'dark'` or (theme !== `'light'` and `window.matchMedia('(prefers-color-scheme: dark)').matches`), add `'dark'` to `document.documentElement.classList` and set `<meta name="theme-color">` to `#0E1517`; otherwise ensure no `'dark'` class and set theme-color to `#006D77`.
   - Update `index.html` `<body>` to: `class="bg-[#F8F9FA] dark:bg-[#0E1517] text-[#1D3557] dark:text-[#E6EEF0] font-sans antialiased min-h-screen selection:bg-teal-100 selection:text-teal-900"`.
3. Theme Preferences Service (`src/services/themeStorage.ts`):
   - In `src/types/index.ts`: export `type ThemePreference = 'system' | 'light' | 'dark';`
   - In `src/services/themeStorage.ts`: provide:
     - `getStoredThemePreference(): ThemePreference` (defaults to `'system'`).
     - `setStoredThemePreference(theme: ThemePreference): void` (persists to `localStorage` under `'dalili_theme_preference'`).
     - `applyThemeToDOM(theme: ThemePreference): void` (adds/removes `'dark'` class on `document.documentElement`, sets up system `change` listener when in `'system'` mode, and updates `<meta name="theme-color">`).
     - `isDarkMode(): boolean`.
4. Contrast Compliance & Styling Rules:
   - Verify WCAG AAA contrast across all tokens:
     Text `#E6EEF0` on `#0E1517` is 15.69:1.
     Muted text `#9FB3B8` on `#0E1517` is 8.55:1.
     Warning card `#3A2E12` with `#F5D58A` is 9.38:1.
   - **CRITICAL WCAG COMPLIANCE**: On `#3DB8C4` primary buttons in dark mode, the label text MUST be dark (`text-[#0E1517] font-bold`) yielding 7.87:1, NEVER white text (which yields only 2.34:1).
   - Ensure confidence chips (high/medium/low), amber warning card ("غير واضح، اسأل الصيدلي"), borders, bottom nav, and status bar support dark mode.
5. Settings Modal/Screen (`src/components/SettingsModal.tsx`):
   - Create an accessible modal component with:
     - Theme options: 3 choices "تلقائي" (system), "فاتح" (light), "داكن" (dark).
     - Font size options: 3 choices "عادي" (16px), "كبير" (19px), "كبير جداً" (23px).
     - Min touch target 48px/56px.
   - Wire into `src/App.tsx` (with state to open/close Settings).
6. Android System Bars Synchronization:
   - Create `android/app/src/main/res/values-night/styles.xml` with:
     ```xml
     <?xml version="1.0" encoding="utf-8"?>
     <resources>
         <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
             <item name="android:statusBarColor">#0E1517</item>
             <item name="android:navigationBarColor">#162124</item>
             <item name="android:windowLightStatusBar">false</item>
             <item name="android:windowLightNavigationBar">false</item>
         </style>
     </resources>
     ```
   - In `android/app/src/main/res/values/styles.xml`: ensure `android:statusBarColor` is `#006D77` and `android:navigationBarColor` is `#FFFFFF`.
7. Tests & Verification:
   - Create `tests/theming.m2.test.ts` covering theme preferences storage, DOM class toggling, contrast calculations/assertions, and system bars setup.
   - Run type check: `npx.cmd tsc --noEmit`.
   - Run full test suite: `npm.cmd test` / `npx.cmd vitest run`. All tests MUST pass 100%!
   - Run build: `npm.cmd run build`. Must compile cleanly with 0 errors.

Windows constraints:
- Use `npx.cmd` and `npm.cmd`.
- Write your completion report in `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_redesign\handoff.md`.
- Report back with passing test outputs.
