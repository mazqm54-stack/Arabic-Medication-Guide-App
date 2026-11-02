# Architectural Survey: Typography, Dynamic Font Sizing, Touch Targets & Test Suite Impact

**Author**: Redesign Survey Spec Miner 2  
**Date**: 2026-11-01  
**Project**: دليلي الدوائي (My Medication Guide)  
**Scope**: R2 & R3 Typography, Local Font Bundling ("Readex Pro"), 3-Level Dynamic Font Sizing (rem-based), Dynamic Touch Targets (48px/56px), and Test Suite Impact Analysis across `tests/`.

---

## 1. Executive Summary

This specification survey investigates the architectural changes required to transition the mobile Arabic PWA/Capacitor application from its legacy senior-only typography/layout (Cairo/Tajawal via Google Fonts, hardcoded 20px/24px base sizes, 64px static touch targets) to the modern native Android redesign requirements:
1. **Local Font Bundling**: Replacing remote Google Font requests with locally bundled modern Arabic font **"Readex Pro"** in `src/assets/fonts/`, eliminating all external network font calls.
2. **Dynamic 3-Level Font Sizing**: Supporting 3 distinct levels ("عادي" 16px default, "كبير" 19px, "كبير جداً" 23px) via root `rem` scaling on `html { font-size: ... }`, accessible via Settings, a compact top-bar "Aa" button, and initial onboarding.
3. **Adaptive Touch Targets**: Establishing a minimum 48px touch target for default size ("عادي") and 56px for larger sizes ("كبير" and "كبير جداً"), while retaining the 64px center camera action.
4. **Test Suite Impact**: All 42 test files (1,042 test cases) currently pass (`vitest run` exits with code 0). We have identified exactly 12 test files containing ~25 test cases that assert legacy 64px button heights, 20px font-sizes, 76px camera dimensions, or Cairo font rules, and defined exact non-destructive update specifications.

---

## 2. Typography & Local Font Bundling (Readex Pro)

### 2.1 Current State Analysis
- **Remote Font Dependency (`index.html`)**:
  Lines 18–24 of `index.html` make external network requests to Google Fonts:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap"
    rel="stylesheet"
  />
  ```
  This violates offline PWA readiness and causes layout shifts (FOUT) on slow/offline Android WebView environments.
- **Local Assets Directory**:
  Currently, `src/assets/` does not exist. No local `.woff2` or `.ttf` files are present.
- **CSS & Tailwind References**:
  - `src/index.css`: `font-family: 'Cairo', 'Tajawal', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;`
  - `tailwind.config.js`: `fontFamily.sans: ['Cairo', 'Tajawal', ...]`, `fontFamily.cairo`, `fontFamily.tajawal`.
  - `src/App.tsx`: `className="... font-cairo ..."`

### 2.2 Target Architecture: Readex Pro Bundling
- **Font Directory**: `src/assets/fonts/`
- **Font Formats**: Modern WOFF2 files (with TTF fallback if desired) covering the Arabic Unicode subset (`U+0600-06FF`, `U+200C-200E`, `U+2010-2011`, `U+FB50-FDFF`, `U+FE70-FEFF`) and Latin basic (`U+0000-00FF`):
  - `ReadexPro-Regular.woff2` (Weight 400)
  - `ReadexPro-Medium.woff2` (Weight 500)
  - `ReadexPro-SemiBold.woff2` (Weight 600)
  - `ReadexPro-Bold.woff2` (Weight 700)
- **Local `@font-face` Declarations (`src/index.css`)**:
  ```css
  @font-face {
    font-family: 'Readex Pro';
    font-style: normal;
    font-weight: 400;
    font-display: swap;
    src: url('./assets/fonts/ReadexPro-Regular.woff2') format('woff2');
  }
  @font-face {
    font-family: 'Readex Pro';
    font-style: normal;
    font-weight: 500;
    font-display: swap;
    src: url('./assets/fonts/ReadexPro-Medium.woff2') format('woff2');
  }
  @font-face {
    font-family: 'Readex Pro';
    font-style: normal;
    font-weight: 600;
    font-display: swap;
    src: url('./assets/fonts/ReadexPro-SemiBold.woff2') format('woff2');
  }
  @font-face {
    font-family: 'Readex Pro';
    font-style: normal;
    font-weight: 700;
    font-display: swap;
    src: url('./assets/fonts/ReadexPro-Bold.woff2') format('woff2');
  }
  ```
- **Zero Network Font Requests**:
  - Remove all Google Fonts `<link rel="preconnect"...>` and `<link rel="stylesheet"...>` from `index.html`.
- **Config & Tailwind Integration**:
  - `tailwind.config.js`:
    ```javascript
    fontFamily: {
      sans: ['"Readex Pro"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      readex: ['"Readex Pro"', 'sans-serif'],
    }
    ```
  - For backward compatibility with existing tests and JSX tags, alias `cairo` to `'Readex Pro'` or replace `font-cairo` with `font-sans` across the app.
- **Secret Scan Compatibility**:
  - `tests/secretScan.test.ts` (line 18) already excludes binary font files (`/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|eot)$/i`), ensuring zero false positives.

---

## 3. Dynamic Font Sizing & Root `rem` Architecture

### 3.1 Three Selectable Font Size Levels
The specification mandates 3 levels:
| Level Name (Arabic) | Preference Key | Base Body Size | Root Font Size (`html`) | Scale Factor vs Normal |
|---------------------|----------------|----------------|-------------------------|------------------------|
| **عادي** (Default)   | `'normal'`     | 16px           | `16px` (1rem = 16px)    | 100%                   |
| **كبير**            | `'large'`      | 19px           | `19px` (1rem = 19px)    | 118.75%                |
| **كبير جداً**       | `'extra-large'`| 23px           | `23px` (1rem = 23px)    | 143.75%                |

### 3.2 Root `rem` Scaling Mechanics
In standard CSS/Tailwind, if typography uses `rem` units, changing `html { font-size: ... }` automatically scales every text element, padding, and layout proportionally without modifying component code:
- **Default root**: `html { font-size: 16px; }`
- **Dynamic classes / attributes on `html`**:
  ```css
  html.font-size-normal {
    font-size: 16px;
    --touch-min: 48px;
  }
  html.font-size-large {
    font-size: 19px;
    --touch-min: 56px;
  }
  html.font-size-extra-large {
    font-size: 23px;
    --touch-min: 56px;
  }
  ```
- **Tailwind Font Size Configuration (`tailwind.config.js`)**:
  Replace legacy hardcoded `px` definitions with `rem` values:
  ```javascript
  fontSize: {
    'senior-xs': ['0.75rem', { lineHeight: '1.5', fontWeight: '500' }],
    'senior-sm': ['0.875rem', { lineHeight: '1.6', fontWeight: '500' }],
    'senior-base': ['1rem', { lineHeight: '1.7', fontWeight: '500' }],    // 16px -> 19px -> 23px
    'senior-lg': ['1.1875rem', { lineHeight: '1.7', fontWeight: '600' }],  // 19px -> 22.5px -> 27.3px
    'senior-xl': ['1.375rem', { lineHeight: '1.5', fontWeight: '700' }],   // 22px -> 26.1px -> 31.6px
    'senior-2xl': ['1.625rem', { lineHeight: '1.4', fontWeight: '800' }],  // 26px -> 30.8px -> 37.3px
    'senior-3xl': ['2rem', { lineHeight: '1.3', fontWeight: '900' }],     // 32px -> 38px -> 46px
  }
  ```
- **Layout Robustness (Preventing Breakage)**:
  - Containers must not use fixed `h-[...]` where text can wrap. Use `min-h-[...]` and flexbox.
  - Spacing uses Tailwind rem units (`gap-3`, `p-4`, `space-y-4`) which automatically adapt.
  - Cards on 320px screens: use `max-w-full overflow-hidden` and single line labels with `truncate` or `ellipsis` where required (e.g. bottom nav).

### 3.3 UI Access Points
1. **Settings Screen / Tab**:
   - Segmented 3-option control displaying: `عادي (16px)` | `كبير (19px)` | `كبير جداً (23px)`.
2. **Top-Bar Compact "Aa" Button**:
   - Replaces the bulky old font-size toggle card.
   - Positioned in the header next to app branding.
   - Has `aria-label="تغيير حجم الخط"` and touch target `min-h-[48px] min-w-[48px]`.
   - On click: cycles sequentially through `normal` -> `large` -> `extra-large` -> `normal`, or displays a quick accessible popup sheet.
3. **First-Launch Screen**:
   - Allows senior users to pick their comfort level before scanning.
4. **State & Preferences Storage**:
   - `src/types/index.ts`:
     ```typescript
     export type FontSizePreference = 'normal' | 'large' | 'extra-large';
     ```
   - `src/services/preferencesStorage.ts`:
     - Default changed to `'normal'`.
     - Validates and stores `'normal' | 'large' | 'extra-large'`.
     - `applyFontSizeToDOM(size: FontSizePreference)`: adds `font-size-normal`, `font-size-large`, or `font-size-extra-large` to `document.documentElement` to eliminate startup flash.

---

## 4. Touch Target Rules & Layout Budget

### 4.1 Specification Contracts
- **Normal Size ("عادي")**: Minimum touch target **48px** (`min-h-[48px] min-w-[48px]`).
- **Large & Extra-Large Sizes ("كبير" and "كبير جداً")**: Minimum touch target **56px** (`min-h-[56px] min-w-[56px]`).
- **Center Camera Button**: 64px circle (`w-[64px] h-[64px]` with notch border).

### 4.2 Interactive Elements Audit
| Element | Current Class / Size | Redesign Specification | Notes |
|---------|----------------------|------------------------|-------|
| Universal `button`, `[role="button"]` | `min-height: 64px;` in CSS | `min-height: var(--touch-min, 48px);` | Dynamically set via root class (48px or 56px) |
| `.btn-touch` utility | `min-height: 64px; min-width: 64px;` | `min-height: var(--touch-min, 48px); min-width: var(--touch-min, 48px);` | Scaled with font mode |
| Bottom Nav Tabs (5 slots) | `min-h-[64px] min-w-[64px]` | `min-h-[48px] min-w-[48px]` (56px in large modes) | 320px width / 5 = 64px max per slot. Must use 48px to prevent horizontal overflow |
| Center Camera Button | `w-[76px] h-[76px]` | `w-[64px] h-[64px]` rounded-full | Visual-only redesign; meets both 48px and 56px targets |
| Home Primary Action Cards | `min-h-[120px]` | `min-h-[120px]` | Easily exceeds 48px/56px |
| Gallery Pick Button | `min-h-[64px]` | `min-h-[48px]` (sm: `min-h-[56px]`) | Meets touch target |
| Results Sticky Action ("تصوير دواء آخر") | `min-h-[64px]` | `min-h-[48px]` or `min-h-[56px]` | Secondary action styling |
| Prescription Sticky Reset ("تصوير روشتة أخرى") | `min-h-[64px]` | `min-h-[48px]` compact secondary action | Fixes overlap with scroll padding |
| Audio Toolbar (Play/Pause/Stop) | `min-h-[64px]` | `min-h-[48px]` (sm: `min-h-[56px]`) | Accessible controls |
| Top-Bar "Aa" Button | New element | `min-h-[48px] min-w-[48px]` | Touch target compliance |
| Alert Dismiss Button ("✕") | `px-2 py-1` (~32px) | `min-h-[48px] min-w-[48px]` flex items-center justify-center | Fixes legacy sub-48px touch target |
| "أدويتي" Delete Button ("🗑️ حذف") | `p-2` (~36px) | `min-h-[48px] px-3` | Fixes legacy sub-48px touch target |
| Medicine Details Modal Close | `min-h-[56px]` | `min-h-[48px]` or `min-h-[56px]` | Fully compliant |

---

## 5. Test Suite Impact Analysis

### 5.1 Test Execution Baseline
- Command: `npm.cmd test` / `npx.cmd vitest run`
- Current result: **42 test files passed (42), 1,042 tests passed (1,042)**, duration ~26.7s.
- Target: All existing behavioral and integration test suites MUST continue passing with zero regressions.

### 5.2 Exhaustive Inventory of Affected Tests

#### 1. Custom Matchers & Setup (`src/test/setup.ts` & `src/types/matchers.d.ts`)
- **Location**: `src/test/setup.ts` lines 213–257, `src/types/matchers.d.ts` line 8.
- **Current assertion logic**:
  ```typescript
  toHaveMinTouchTarget(received: HTMLElement, minSize = 64) {
    ...
    const hasTailwindTouchClass =
      classList.includes('min-h-[64px]') ||
      classList.includes('min-h-touch') ||
      classList.includes('h-16') ||
      ...
  }
  ```
- **Update required**:
  - Change default parameter from `minSize = 64` to `minSize = 48` (or check `window.getComputedStyle(document.documentElement).getPropertyValue('--touch-min')`).
  - Add `min-h-[48px]`, `min-h-[56px]`, `h-12`, `h-14`, `min-w-[48px]`, `min-w-[56px]` to `hasTailwindTouchClass`.

#### 2. `tests/m3.challenge2.test.ts`
- **Line 613–616**:
  ```typescript
  it('verifies minimum 64px universal touch target height for buttons in CSS layer', () => {
    expect(cssContent).toMatch(/button,\s*\[role="button"\],[^}]*min-height:\s*64px;/s);
    expect(cssContent).toMatch(/--touch-min:\s*64px;/);
  });
  ```
  - *Impact*: Fails when `--touch-min` is changed to 48px / dynamic.
  - *Update*: Update to match `min-height:\s*(?:var\(--touch-min,\s*48px\)|48px)` and `--touch-min:\s*(?:48|56)px`.
- **Line 618–622**:
  ```typescript
  it('verifies senior default base font size is set to 20px', () => {
    expect(cssContent).toMatch(/font-size:\s*20px;\s*\/\*\s*Senior base default\s*\*\//);
    expect(cssContent).toMatch(/\.font-mode-large\s*\{[^}]*font-size:\s*20px;/);
    expect(cssContent).toMatch(/\.font-mode-extra-large\s*\{[^}]*font-size:\s*24px;/);
  });
  ```
  - *Impact*: Fails when CSS changes to 16px (normal), 19px (large), 23px (extra-large).
  - *Update*: Update test to verify 3 levels: normal 16px base, large 19px, extra-large 23px.
- **Line 640–658**:
  ```typescript
  expect(galleryBtn.className).toContain('min-h-[64px]');
  ```
  - *Impact*: If gallery button is updated to 48px/56px, this test will fail.
  - *Update*: Allow `min-h-[48px]`, `min-h-[56px]`, or `min-h-[64px]`.
- **Line 660–683**:
  ```typescript
  expect(galleryBtn).toHaveMinTouchTarget(64);
  expect(boxMinH).toBeGreaterThanOrEqual(64);
  ```
  - *Impact*: Asserts 64px.
  - *Update*: Update to `expect(galleryBtn).toHaveMinTouchTarget(48)` and `toBeGreaterThanOrEqual(48)`.
- **Line 944–947**:
  Checks font toggle click. Needs to handle 3-level cycling or Aa button.

#### 3. `tests/m3.challenge1.test.ts`
- **Line 410–427**:
  ```typescript
  it('4.1 verifies all 4 standard navigation tabs have minimum 64px touch target (toHaveMinTouchTarget)', () => {
    ...
    tabButtons.forEach((tab) => {
      expect(tab.className).toContain('min-h-[64px]');
      expect(tab.className).toContain('min-w-[64px]');
      expect(tab).toHaveMinTouchTarget(64);
    });
  });
  ```
  - *Impact*: Fails when tabs use 48px (or 56px in large mode) to fit the 5-slot bar.
  - *Update*: Update assertions to expect `min-h-[48px]` (or 56px) and `toHaveMinTouchTarget(48)`.
- **Line 429–445**:
  ```typescript
  it('4.2 verifies center camera button has touch target exceeding 64px (76px x 76px)', () => {
    expect(cameraButton.className).toContain('w-[76px]');
    expect(cameraButton.className).toContain('h-[76px]');
  });
  ```
  - *Impact*: R2 specifies center camera button is 64px circle (`w-[64px] h-[64px]`).
  - *Update*: Update dimensions from 76px to 64px circle (`w-[64px]`, `h-[64px]`).
- **Line 479–497**:
  ```typescript
  it('4.4 verifies tab labels have senior typography text-base (16px) and bold font')
  ```
  - *Impact*: R1 specifies tab labels <= 14px (12px recommended).
  - *Update*: Update to check text label classes (`text-xs` / `text-sm`).

#### 4. `tests/camera.challenge.test.ts`
- **Line 768–774**:
  ```typescript
  it('secondary gallery button meets touch target height requirements (>= 64px)', () => {
    expect(galleryButton.className).toMatch(/min-h-\[64px\]/);
  });
  ```
  - *Impact*: Fails if gallery button changes to 48px or 56px.
  - *Update*: Update regex to `min-h-\[(?:48|56|64)px\]`.

#### 5. `tests/errorStates.test.tsx`
- **Line 140–155**:
  ```typescript
  it('satisfies minimum 64px touch target height on all error state action buttons', () => {
    for (const button of buttons) {
      expect(button).toHaveMinTouchTarget(64);
    }
  });
  ```
  - *Impact*: Fails if button height is 48px or 56px.
  - *Update*: Update to `expect(button).toHaveMinTouchTarget(48)`.

#### 6. `tests/errorStates.challenge.test.tsx`
- **Line 647–663**:
  ```typescript
  it(`enforces >=64px touch target height on all buttons for ${name}`, () => {
    for (const button of buttons) {
      expect(button).toHaveMinTouchTarget(64);
    }
  });
  ```
  - *Impact*: Fails if button height is 48px or 56px.
  - *Update*: Update to `expect(button).toHaveMinTouchTarget(48)`.

#### 7. `tests/e2e/helpers/testHelpers.ts`
- **Line 5–27**:
  ```typescript
  export function assertTouchTargetSenior(el: HTMLElement, minPx = 64): void
  ```
  - *Impact*: Helper defaults to 64px and checks `min-h-[64px]`.
  - *Update*: Change default `minPx = 48`, add `min-h-[48px]`, `min-h-[56px]`.

#### 8. `tests/e2e/tier1_features/navigation_shell.test.ts`
- **Line 99–102**:
  ```typescript
  it('1. verifies touch target height is at least 64px for elderly patients', () => {
    const minTouchTarget = 64;
    expect(minTouchTarget).toBeGreaterThanOrEqual(64);
  });
  ```
  - *Update*: Update to `minTouchTarget = 48; expect(minTouchTarget).toBeGreaterThanOrEqual(48);`.
- **Line 169–172**:
  ```typescript
  it('4. verifies body base font size contract is at least 20px', () => {
    const baseFontSize = 20;
    expect(baseFontSize).toBeGreaterThanOrEqual(20);
  });
  ```
  - *Update*: Update to `baseFontSize = 16; expect(baseFontSize).toBeGreaterThanOrEqual(16);` (or check 16/19/23).

#### 9. `tests/e2e/tier2_boundaries/navigation_shell_boundary.test.ts`
- **Line 110–115**:
  ```typescript
  it('1. verifies touch target height strictly fails under 64px and passes at 64px+', () => {
    const validateTouchHeight = (h: number) => h >= 64;
    expect(validateTouchHeight(63.9)).toBe(false);
    expect(validateTouchHeight(64.0)).toBe(true);
    expect(validateTouchHeight(72.0)).toBe(true);
  });
  ```
  - *Update*: Update boundary to 48px: `h >= 48`, test 47.9 fails, 48.0 passes, 56.0 passes.
- **Line 126–131**:
  ```typescript
  it('3. verifies icon size strictly fails under 28px', () => {
    const validateIconSize = (size: number) => size >= 28;
    ...
  });
  ```
  - *Update*: R1 specifies 24px icons. Update boundary to 24px (`size >= 24`).

#### 10. `tests/e2e/tier1_features/prescription_presentation.test.ts`
- **Line 106–114**:
  `expect(readAloudBtn.minHeight).toBeGreaterThanOrEqual(64);`
  - *Update*: Update to `toBeGreaterThanOrEqual(48)`.
- **Line 248–256**:
  `expect(retryButton.height).toBeGreaterThanOrEqual(64);`
  - *Update*: Update to `toBeGreaterThanOrEqual(48)`.

#### 11. `tests/e2e/tier3_combinations/cross_feature_combinations.test.ts`
- **Line 155–158**:
  ```typescript
  const fontPref = 'extra-large';
  const computedFontSize = fontPref === 'extra-large' ? 24 : 20;
  ```
  - *Update*: Update font size resolution to 23px for extra-large, 19px for large, 16px for normal.

#### 12. `tests/e2e/tier4_scenarios/real_world_scenarios.test.ts`
- **Line 132–133**:
  ```typescript
  const fontModeClass = storedPrefs.fontSize === 'extra-large' ? 'font-mode-extra-large' : 'font-mode-large';
  ```
  - *Update*: Update to support `'font-size-normal' | 'font-size-large' | 'font-size-extra-large'`.

---

## 6. Discovered Features & Edge Cases

```markdown
## Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Typography | Readex Pro Local Bundling | Bundles Readex Pro WOFF2 fonts in `src/assets/fonts/`, declared via `@font-face` in `src/index.css` | Local font files | Zero network font requests, local font rendering | Fallback to system-ui Arabic sans-serif | ORIGINAL_REQUEST.md R2, index.html, index.css |
| 2 | Typography | Elimination of Google Fonts | Removes preconnect and Google Fonts stylesheet links for Cairo/Tajawal from `index.html` | None | Clean head tags, no external CSS/font requests | Browser uses cached/bundled styles | index.html lines 18-24 |
| 3 | Dynamic Sizing | 3-Level Font Size Scaling | Supports "عادي" (16px), "كبير" (19px), "كبير جداً" (23px) via root `rem` scaling on `html` | User preference ('normal', 'large', 'extra-large') | Root font-size set to 16px, 19px, or 23px; all rem text scales | Defaults to 'normal' (16px) on invalid input | ORIGINAL_REQUEST.md R3, preferencesStorage.ts |
| 4 | Dynamic Sizing | Top-Bar "Aa" Toggle Button | Compact button in header replacing large card toggle; cycles through font levels or opens selector | Click event | Updates active font size state and root class | Graceful fallback to normal size | ORIGINAL_REQUEST.md R1 & R3, App.tsx |
| 5 | Dynamic Sizing | Settings Font Size Selector | Segmented radio control in Settings tab allowing direct selection of normal, large, extra-large | User selection | Persists to localStorage and applies immediately | Preserves existing user preference | ORIGINAL_REQUEST.md R3 |
| 6 | Touch Targets | Dynamic Minimum Touch Targets | Enforces minimum 48px touch targets in normal mode and 56px in large/extra-large modes | Active font size mode | CSS variable `--touch-min` (48px or 56px) on interactive elements | Defaults to 48px minimum | ORIGINAL_REQUEST.md R3, index.css |
| 7 | Touch Targets | 64px Center Camera Button | Raised center camera button in bottom nav styled as 64px circle with teal gradient & notch ring | Tap / click | Captures photo via native camera, scale 0.95 press animation | Re-enables after capture completes or fails | ORIGINAL_REQUEST.md R2, BottomNavBar.tsx |
| 8 | Test Suite | Universal Touch Matcher Update | `toHaveMinTouchTarget` custom matcher in `src/test/setup.ts` updated to check 48px/56px | Element and optional minSize | Pass/fail vitest match result | Throws readable assertion message with element classes | src/test/setup.ts lines 213-257 |

## Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Dynamic Font Sizing | Extra Large font mode (23px) on narrow 320px screen | Containers without flexible wrapping cause horizontal scroll. Rem-based typography with flexbox and `min-h` wraps text cleanly without truncation. |
| 2 | Local Font Bundling | Offline app launch in Android WebView with zero internet connection | With Google Fonts link, browser delays rendering or falls back to system font. With local WOFF2 `@font-face`, font renders immediately with zero layout shift. |
| 3 | Bottom Nav Touch Targets | 5 navigation tabs on 320px viewport with legacy 64px min-width | 5 tabs * 64px = 320px (0px for borders/margins), causing tab clipping or overflow. With 48px minimum touch target, 5 slots distribute evenly with 64px slot width. |
| 4 | Preferences Storage | Corrupted or legacy localStorage value (e.g. 'large' from v1 or unexpected string) | `getStoredFontSize()` safely validates against allowed values (`'normal' \| 'large' \| 'extra-large'`), falling back to `'normal'`. |
| 5 | Small Interactive Icons | Top-bar "Aa" button, dismiss "✕" alerts, and delete buttons | Visual icon is 20-24px, but touch box must expand to at least 48px (56px in large font modes) via padding or `min-w-[48px] min-h-[48px]` to prevent tap misses. |
| 6 | Vitest Test Suite Execution | Updating button heights to 48px without updating `toHaveMinTouchTarget` matcher | Matcher throws error expecting 64px. Matcher default must be updated to 48px alongside test expectations. |
```

---

## 7. Implementation Recommendations for Worker

1. **Step 1 - Font Asset Placement**:
   - Create `src/assets/fonts/` and add Readex Pro WOFF2 files.
   - Update `src/index.css` with `@font-face` definitions.
   - Remove Google Fonts `<link>` tags from `index.html`.
   - Update `tailwind.config.js` to set `fontFamily.sans: ['"Readex Pro"', ...]`.
2. **Step 2 - rem-based Font Scaling**:
   - Configure `tailwind.config.js` `fontSize` to use `rem` values.
   - Update `src/types/index.ts` to `FontSizePreference = 'normal' | 'large' | 'extra-large'`.
   - Update `src/services/preferencesStorage.ts` to handle `'normal'` default and apply classes to `html`.
   - Update `src/index.css` with `html.font-size-normal`, `html.font-size-large`, `html.font-size-extra-large` and `--touch-min`.
3. **Step 3 - Component Updates**:
   - Add top-bar "Aa" button in `App.tsx`.
   - Update `BottomNavBar.tsx` to 5 equal slots with 24px icons and 48px min touch target.
   - Update center camera button to 64px circle.
   - Ensure all small buttons (delete, dismiss, modal close) meet 48px (56px in large modes).
4. **Step 4 - Test Suite Non-Destructive Update**:
   - Update `src/test/setup.ts` (`toHaveMinTouchTarget` default 48, new Tailwind classes).
   - Update affected tests in `m3.challenge1.test.ts`, `m3.challenge2.test.ts`, `errorStates.test.tsx`, `errorStates.challenge.test.tsx`, and E2E boundary tests to verify the new 48px/56px touch target and 16px/19px/23px font sizes.
   - Verify `npx.cmd vitest run` passes 100% of tests.
