# Survey Report: Theming, Dark Mode Tokens, Android System Bars, Launcher Icons/Assets, and Build/Verification

**Agent**: Redesign Survey Explorer 3  
**Date**: 2026-11-02  
**Target Project**: دليلي الدوائي (Dalili Medication Guide)  
**Location**: `c:\Users\PC\Documents\antigravity\fervent-mendel\`

---

## 1. Executive Summary

This investigation explores the codebase and architectural requirements for:
1. **R4 Dark Mode & System Theming**: Implementing token-based dark mode (`#0E1517` background, `#162124` surface, `#1D2B2F` surface-2, `#E6EEF0` text, `#9FB3B8` muted text, `#3DB8C4` primary, `#3A2E12` / `#F5D58A` warning box), zero startup theme flash via inline `<head>` script, WCAG contrast verification, Settings options ("تلقائي", "فاتح", "داكن"), and native Android system bar synchronization.
2. **R5 Launcher Icons and App Assets**: Upgrading Android adaptive icons from default Android robot assets to a custom teal (`#006D77`) background with a crisp white prescription sheet and capsule symbol, plus light/dark splash screens, generated via a standalone offline Node.js tool.
3. **Screenshot Verification & Android Build**: Establishing an offline headless Chrome CLI screenshot pipeline across the complete 84-combination matrix (2 viewports × 2 modes × 3 font sizes × 7 screens), bumping `versionCode 2 -> 3` and `versionName "1.1" -> "1.2"` across `build.gradle`, `sign-release.bat`, and `package.json`, and confirming strict keystore exclusion in `.gitignore`.

---

## 2. R4 Dark Mode & System Theming

### 2.1 Current State Analysis
- **`tailwind.config.js`**: `darkMode` is **not configured** (defaults to `'media'` or unconfigured in Tailwind v3.4.17). To support user selection ("تلقائي", "فاتح", "داكن") with class-based toggling on `<html>`, `darkMode: 'class'` is strictly required. Furthermore, dark mode color tokens are completely missing from the theme extension.
- **`index.html`**:
  - The `<body>` element hardcodes light background and text classes: `class="bg-[#F8F9FA] text-[#1D3557] ..."`.
  - There is `<meta name="theme-color" content="#006D77" />`.
  - **Zero inline script** exists in `<head>`. If a user configured dark mode, the browser renders the white `#F8F9FA` body until React loads, mounts, and reads preferences—creating an unsightly white flash (FOIT/FOUC).
  - Outdated external Google Fonts `<link>` tags for Cairo/Tajawal remain in `<head>` (lines 18-24).
- **`src/index.css`**:
  - `:root` declares only light mode CSS variables (`--bg-primary: #F8F9FA`, `--text-primary: #1D3557`, etc.).
  - There is no `.dark` selector block.
  - Hardcoded classes (e.g. `.card-warnings { bg-[#FEF3C7] text-[#92400E] }`) do not adapt to dark mode.
- **Settings Screen**:
  - Currently, **no Settings screen or modal exists** in `src/`. The bottom nav (`BottomNavBar.tsx`) has 5 tabs: `home`, `medicines`, `camera`, `prescription`, `history`.
  - Settings must be accessible either as a dedicated tab/view or as a modal triggered from the top bar (e.g. adjacent to the "Aa" button).
- **Preferences Storage (`src/services/preferencesStorage.ts`)**:
  - Currently only persists `dalili_font_size_preference_v1` with values `'large' | 'extra-large'`.
  - Must be expanded to support theme preference: `dalili_theme_preference` with values `'system' | 'light' | 'dark'`.

---

### 2.2 Token-Based Dark Palette & Mathematical Contrast Verification

All text and UI controls were mathematically evaluated against WCAG 2.1 AA (4.5:1 normal text, 3.0:1 large text/UI components) and AAA (7.0:1 normal text, 4.5:1 large text) standards.

Relative luminance formula:
$$L = 0.2126 \times R + 0.7152 \times G + 0.0722 \times B$$
$$\text{Contrast Ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$

| Element | Foreground Color | Background Color | Contrast Ratio | WCAG Compliance | Evaluation & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Text** | `#E6EEF0` ($L=0.8446$) | `#0E1517` Background ($L=0.0070$) | **15.69:1** | **Passes AAA** | High-contrast, crystal clear on dark background |
| **Primary Text** | `#E6EEF0` ($L=0.8446$) | `#162124` Surface ($L=0.0139$) | **13.99:1** | **Passes AAA** | Standard card text |
| **Primary Text** | `#E6EEF0` ($L=0.8446$) | `#1D2B2F` Surface-2 ($L=0.0219$) | **12.44:1** | **Passes AAA** | Nested cards & active tabs |
| **Muted Text** | `#9FB3B8` ($L=0.4375$) | `#0E1517` Background ($L=0.0070$) | **8.55:1** | **Passes AAA** | Secondary labels & timestamps |
| **Muted Text** | `#9FB3B8` ($L=0.4375$) | `#162124` Surface ($L=0.0139$) | **7.63:1** | **Passes AAA** | "As written" prescription lines |
| **Muted Text** | `#9FB3B8` ($L=0.4375$) | `#1D2B2F` Surface-2 ($L=0.0219$) | **6.78:1** | **Passes AA (4.5:1)** | Inactive bottom nav tabs |
| **Warning Box Text** | `#F5D58A` ($L=0.6889$) | `#3A2E12` Warning BG ($L=0.0288$) | **9.38:1** | **Passes AAA** | Card 4 cautions & side effects |
| **Low Confidence Chip** | `#F5D58A` ($L=0.6889$) | `#3A2E12` Warning BG ($L=0.0288$) | **9.38:1** | **Passes AAA** | "غير واضح، اسأل الصيدلي" chip |
| **High Confidence Chip** | `#6EE7B7` ($L=0.6120$) | `#064E3B` Dark Green ($L=0.0460$) | **6.90:1** | **Passes AA (4.5:1)** | High confidence green badge |
| **Medium Confidence Chip** | `#FCD34D` ($L=0.6720$) | `#451A03` Dark Amber ($L=0.0220$) | **10.03:1** | **Passes AAA** | Medium confidence amber badge |
| **Primary Accent** | `#3DB8C4` ($L=0.3986$) | `#0E1517` Background ($L=0.0070$) | **7.87:1** | **Passes AAA** | Icons, active indicators, borders |
| **Primary Accent** | `#3DB8C4` ($L=0.3986$) | `#162124` Surface ($L=0.0139$) | **7.02:1** | **Passes AAA** | Card borders & headings |
| **Primary Button Text (DARK)** | `#0E1517` Text ($L=0.0070$) | `#3DB8C4` Primary BG ($L=0.3986$) | **7.87:1** | **Passes AAA** | **CRITICAL: Use dark text on teal-300 button!** |
| *Primary Button Text (WHITE)* | *`#FFFFFF` Text ($L=1.000$)* | *`#3DB8C4` Primary BG ($L=0.3986$)* | *2.34:1* | *FAIL (< 4.5:1)* | *White text fails on #3DB8C4; must use dark text!* |

#### ⚠️ Critical Design Finding: Primary Action Buttons in Dark Mode
When `#3DB8C4` is used as a button background:
- White text (`#FFFFFF`) on `#3DB8C4` yields a contrast ratio of only **2.34:1**, violating WCAG AA minimums.
- Dark slate/background text (`#0E1517` or `#162124`) on `#3DB8C4` yields **7.87:1**, exceeding WCAG AAA requirements.
- **Rule for Implementers**: Buttons utilizing the dark mode primary `#3DB8C4` background must specify `text-[#0E1517] font-black`. Alternatively, if the button retains deep teal `#006D77` with white text, contrast is **4.54:1** (passes AA).

---

### 2.3 Zero-Flash Theme Startup Architecture

To guarantee zero flash of incorrect theme, the theme resolution must execute **synchronously in the HTML `<head>` before any body DOM nodes or stylesheets render**:

```html
<!-- Inside index.html <head>, directly before stylesheets -->
<script>
  (function () {
    try {
      var saved = localStorage.getItem('dalili_theme_preference') || 'system';
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = saved === 'dark' || (saved === 'system' && prefersDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', '#0E1517');
      } else {
        document.documentElement.classList.remove('dark');
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', '#006D77');
      }
    } catch (e) {}
  })();
</script>
```

In `index.html`:
- Remove hardcoded `class="bg-[#F8F9FA] text-[#1D3557]"` on `<body>`.
- Change `<body>` class to:
  `class="bg-[#F8F9FA] text-[#1D3557] dark:bg-[#0E1517] dark:text-[#E6EEF0] font-sans antialiased min-h-screen selection:bg-teal-100 dark:selection:bg-teal-900 selection:text-teal-900 dark:selection:text-teal-100"`

---

### 2.4 Android System Bars Synchronization

#### Constraint Assessment:
Running `npm.cmd view @capacitor/status-bar` demonstrated that external network access to the npm registry is blocked in this environment (`connect EACCES 127.0.0.1:58901`). Moreover, `@capacitor/status-bar` is not currently in `package.json` or `node_modules`.

#### Reliable Multi-Tier Synchronization Strategy:
1. **Tier 1: Native Android Styles (`values/styles.xml` and `values-night/styles.xml`)**:
   Android natively switches resources based on night mode.
   
   In `android/app/src/main/res/values/styles.xml`:
   ```xml
   <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
       <item name="windowActionBar">false</item>
       <item name="windowNoTitle">true</item>
       <item name="android:background">@null</item>
       <item name="android:statusBarColor">#006D77</item>
       <item name="android:navigationBarColor">#FFFFFF</item>
       <item name="android:windowLightStatusBar">false</item>
       <item name="android:windowLightNavigationBar">true</item>
   </style>
   ```

   In `android/app/src/main/res/values-night/styles.xml` (new file):
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <resources>
       <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
           <item name="windowActionBar">false</item>
           <item name="windowNoTitle">true</item>
           <item name="android:background">@null</item>
           <item name="android:statusBarColor">#0E1517</item>
           <item name="android:navigationBarColor">#162124</item>
           <item name="android:windowLightStatusBar">false</item>
           <item name="android:windowLightNavigationBar">false</item>
       </style>
       <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
           <item name="android:background">@drawable/splash</item>
           <item name="windowSplashScreenBackground">#0E1517</item>
       </style>
   </resources>
   ```

2. **Tier 2: Web / PWA Meta Tag**:
   Dynamic manipulation of `<meta name="theme-color">` between `#006D77` (light) and `#0E1517` (dark) informs the browser and modern Android WebView of the active status bar theme.

3. **Tier 3: Runtime System Bar Control via `MainActivity.java`**:
   `MainActivity.java` extends `BridgeActivity`. We can add a lightweight JavaScript interface or native helper that syncs window status/navigation bar colors directly when called from the web app:
   ```java
   // In MainActivity.java
   public void setSystemBarTheme(boolean isDark) {
       runOnUiThread(() -> {
           Window window = getWindow();
           WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, window.getDecorView());
           if (isDark) {
               window.setStatusBarColor(Color.parseColor("#0E1517"));
               window.setNavigationBarColor(Color.parseColor("#162124"));
               controller.setAppearanceLightStatusBars(false);
               controller.setAppearanceLightNavigationBars(false);
           } else {
               window.setStatusBarColor(Color.parseColor("#006D77"));
               window.setNavigationBarColor(Color.parseColor("#FFFFFF"));
               controller.setAppearanceLightStatusBars(false);
               controller.setAppearanceLightNavigationBars(true);
           }
       });
   }
   ```
   This approach requires **zero external npm dependencies** and provides 100% native synchronization.

---

### 2.5 Settings Screen & Theme Options

To satisfy the requirement:
- Provide a **Settings View / Modal** accessible via:
  1. A dedicated tab in the bottom bar or an icon in the top header (e.g. settings gear icon next to the "Aa" font size button).
  2. The three theme choices:
     - **"تلقائي" (`'system'`)**: Follows device OS preference (default).
     - **"فاتح" (`'light'`)**: Forces light theme `#F8F9FA`.
     - **"داكن" (`'dark'`)**: Forces dark theme `#0E1517`.
  3. The three font size choices (from R3):
     - **"عادي" (`'normal'`)**: 16px body font.
     - **"كبير" (`'large'`)**: 19px body font.
     - **"كبير جداً" (`'extra-large'`)**: 23px body font.
  4. Local storage persistence: `localStorage.setItem('dalili_theme_preference', mode)`.
  5. Reactive listener: When in `'system'` mode, attach `window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)` to dynamically react to OS theme changes without app restart.

---

## 3. R5 Launcher Icons and App Assets

### 3.1 Current Assets in `android/app/src/main/res/`
- **`mipmap-anydpi-v26/ic_launcher.xml`**:
  ```xml
  <adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
      <background android:drawable="@color/ic_launcher_background"/>
      <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
  </adaptive-icon>
  ```
- **`values/ic_launcher_background.xml`**: Currently defines `<color name="ic_launcher_background">#FFFFFF</color>`. **Must be changed to `#006D77`**.
- **`drawable-v24/ic_launcher_foreground.xml`**: Currently contains the standard **Android robot head** vector drawable!
- **`mipmap-*/ic_launcher_foreground.png`**: Contains Android robot raster PNGs.
- **`drawable/splash.png` and `drawable-port-*/splash.png`**: Basic pill graphic, lacks dark mode variant.

---

### 3.2 Asset Generation Strategy (Zero-Dependency Script)

Because `@capacitor/assets` is not installed and network installation is blocked in this environment, we must use an in-repo Node.js script.

We already have a working reference: `scripts/generate-icons.js`, which generates PNGs using Node's standard `node:zlib` without any external dependencies!

We can extend this into `scripts/generate-app-assets.js` to generate:
1. **Adaptive Icon Foreground Vector (`android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml`)**:
   A crisp Android Vector Drawable (108dp × 108dp, viewport 108×108):
   - Centered prescription paper sheet (white `#FFFFFF`, folded top-right corner, subtle document lines).
   - Prominent capsule symbol at center: right half amber `#F59E0B`, left half teal `#006D77` (or dark slate `#1D3557`), clear and recognizable at 48dp.
2. **Adaptive Icon Background (`android/app/src/main/res/values/ic_launcher_background.xml`)**:
   `<color name="ic_launcher_background">#006D77</color>`.
3. **Legacy Launcher Mipmaps (`ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png`)**:
   - `mipmap-mdpi`: 48×48 (foreground 108×108)
   - `mipmap-hdpi`: 72×72 (foreground 162×162)
   - `mipmap-xhdpi`: 96×96 (foreground 216×216)
   - `mipmap-xxhdpi`: 144×144 (foreground 324×324)
   - `mipmap-xxxhdpi`: 192×192 (foreground 432×432)
4. **PWA Icons**:
   - `public/icon-192.png` (192×192)
   - `public/icon-512.png` (512×512)
5. **Splash Screens**:
   - Light: `splash.png` (teal `#006D77` background, white document & capsule logo, app title "دليلي الدوائي").
   - Dark: `splash_dark.png` (dark `#0E1517` background, glowing teal `#3DB8C4` & white logo).
   - Saved across `drawable/`, `drawable-port-*`, and `drawable-land-*`.

---

## 4. Screenshot Verification Tooling & Android Build

### 4.1 Headless Chrome Verification Pipeline

#### Proven Execution Capability:
We tested and proved on this exact Windows machine that Google Chrome headless CLI can capture local screenshots cleanly without any node package:
```bat
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --no-sandbox --user-data-dir="C:\Users\PC\AppData\Local\Temp\chrome_temp" --window-size=360,800 --screenshot="output.png" "http://localhost:5173/?mock=..."
```
This executed with exit code 0 and wrote valid PNG image files.

#### Comprehensive 84-Combination Matrix:
The acceptance criteria specify:
> "Screenshots captured in browser at 360x800 and 320x640 in light and dark modes across all 3 font sizes for: home, medicine result, prescription result (with low-confidence item), unclear-photo, my medicines, history, settings, confirming zero clipping or overlapping."

$$\text{Total Captures} = 2 \text{ resolutions} \times 2 \text{ themes} \times 3 \text{ font sizes} \times 7 \text{ screens} = 84 \text{ screenshots}$$

| Parameter | Values | Count |
| :--- | :--- | :--- |
| **Viewport Resolutions** | 1. `360x800` (Modern compact Android)<br>2. `320x640` (Extreme small Android / low-end) | 2 |
| **Theme Modes** | 1. `light` (`#F8F9FA` background)<br>2. `dark` (`#0E1517` background) | 2 |
| **Font Sizes** | 1. `normal` (16px base body)<br>2. `large` (19px base body)<br>3. `extra-large` (23px base body) | 3 |
| **Screens** | 1. `home`<br>2. `medicine_result`<br>3. `prescription_result` (with low-confidence "غير واضح، اسأل الصيدلي" item)<br>4. `unclear_photo`<br>5. `medicines` (My Medicines shelf)<br>6. `history` (Scan history)<br>7. `settings` (Theme & font switcher) | 7 |

#### Deterministic Harness Implementation:
To render each screen deterministically without manual user interaction:
- In `src/App.tsx`, inspect URL search parameters on mount (or when `window.__MOCK_STATE__` is provided):
  `?mock=prescription_result&theme=dark&fontSize=extra-large`
- When `?mock=...` is present:
  - Populate mock state (e.g. sample prescription analysis result with a low-confidence item).
  - Apply the requested theme (`'dark'` / `'light'`) and font size (`'normal'` / `'large'` / `'extra-large'`).
  - Render the target screen immediately without network calls or camera triggers.
- A Node script (`scripts/capture-verification-screenshots.mjs`) starts Vite, loops through the 84 permutations, calls Chrome headless with the appropriate `--window-size` and `--screenshot`, and saves them to `screenshots/verification/`.
- Layout verification checks: Confirm zero horizontal scrollbar (`document.documentElement.scrollWidth <= window.innerWidth`), zero button label wrapping on bottom nav, and zero sticky button overlap.

---

### 4.2 Android Version Code and Name Bump

#### Current Versions:
- **`android/app/build.gradle`**:
  ```groovy
  versionCode 2
  versionName "1.1"
  ```
- **`sign-release.bat`** (line 31):
  ```bat
  echo            Current release: versionCode 2, versionName "1.1"
  ```
- **`package.json`**:
  ```json
  "version": "1.0.0"
  ```

#### Planned Bump:
- **`versionCode`**: `2` $\rightarrow$ `3` (strictly incremented integer for Android package manager).
- **`versionName`**: `"1.1"` $\rightarrow$ `"1.2"` (reflecting the UI redesign release).
- **`package.json`**: `"1.0.0"` $\rightarrow$ `"1.2.0"`.
- **`sign-release.bat`**: Update line 31 to display:
  `echo            Current release: versionCode 3, versionName "1.2"`.

---

### 4.3 Keystore and Secret Protection Audit

#### Audit Findings:
- Checked `.gitignore`:
  ```gitignore
  # Android Keystores & Signing
  *.jks
  *.keystore
  *.key
  keystore.properties
  *password*
  *.properties.local
  *.apk
  ```
- Checked git status with `--ignored`:
  - `dalili-release-key.jks` $\rightarrow$ Ignored (`!!`)
  - `dalili-app-signed-release.apk` $\rightarrow$ Ignored (`!!`)
  - `dalili-app-release-unsigned.apk` $\rightarrow$ Ignored (`!!`)
  - `dalili-app.apk` $\rightarrow$ Ignored (`!!`)
  - `.env` $\rightarrow$ Ignored (`!!`)
  - `android/local.properties` $\rightarrow$ Ignored (`!!`)
- **Conclusion**: Keystores, passwords, release binaries, and local credentials are strictly ignored and untracked. No changes to `.gitignore` are required, and the existing git commit `before-ui-redesign` (commit 4031ce9) remains intact.

---

## 5. Concrete Action Plan & Implementation Guidance

When the implementer proceeds, here is the exact step-by-step checklist:

1. **Tailwind & Dark Mode Tokens (`tailwind.config.js`)**:
   - Add `darkMode: 'class'`.
   - Extend colors with dark mode tokens:
     ```javascript
     dark: {
       bg: '#0E1517',
       surface: '#162124',
       'surface-2': '#1D2B2F',
       text: '#E6EEF0',
       muted: '#9FB3B8',
       primary: '#3DB8C4',
       warning: {
         bg: '#3A2E12',
         text: '#F5D58A',
       },
     }
     ```
2. **`index.html` Flash Prevention & Cleanup**:
   - Add the synchronous inline `<script>` in `<head>` to resolve theme before body paint.
   - Remove obsolete Google Fonts links (Cairo/Tajawal).
   - Update `<body>` classes to support `dark:bg-[#0E1517] dark:text-[#E6EEF0]`.
3. **Styles & Index CSS (`src/index.css`)**:
   - Update root font scaling for the 3 levels (16px, 19px, 23px).
   - Add `.dark` rules for cards, borders, buttons, and alert components.
4. **Settings & Preferences (`src/services/preferencesStorage.ts`)**:
   - Add `getStoredTheme()`, `setStoredTheme()`, and system media query listener.
   - Implement Settings screen/modal with 3 theme buttons ("تلقائي", "فاتح", "داكن") and 3 font sizes ("عادي", "كبير", "كبير جداً").
5. **Android System Bars (`android/app/src/main/res/values-night/styles.xml`)**:
   - Create `values-night/styles.xml` with `#0E1517` status bar and `#162124` navigation bar.
   - Update `values/styles.xml` with light status/navigation bar colors.
6. **Launcher Icons & Splash Screens (`scripts/generate-app-assets.js`)**:
   - Run the zero-dependency Node script to generate prescription sheet + capsule icons and splash screens.
   - Update `values/ic_launcher_background.xml` to `#006D77`.
   - Update `drawable-v24/ic_launcher_foreground.xml` to prescription sheet vector.
7. **Version Bump & Build Verification**:
   - Bump `android/app/build.gradle` to `versionCode 3`, `versionName "1.2"`.
   - Bump `sign-release.bat` and `package.json`.
8. **Screenshot Verification**:
   - Run the 84-combination headless Chrome capture script and confirm zero clipping across 360px and 320px viewports.

---
*Report prepared and self-verified by Redesign Survey Explorer 3.*
