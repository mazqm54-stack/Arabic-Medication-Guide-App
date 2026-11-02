# Project: دليلي الدوائي (Dalili Medication Guide) — Production Redesign

## Architecture
- **Client Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite, Vitest.
- **Mobile Native Runtime**: Capacitor 6.1.2 (`@capacitor/camera@6.1.2`, `@capacitor/android`, `@capacitor/cli`), Android Gradle build with custom intent queries, adaptive launcher icons, dark mode system bar styles, and release signing script.
- **Backend Edge Computing**: Cloudflare Worker running on edge runtime, integrated with Google Gemini API (`generateContent` with `thinkingConfig: { thinkingLevel: 'LOW' }`).
- **Typography & Theming**: Locally bundled Readex Pro WOFF2 fonts (zero network calls), 3 dynamic font size levels ('normal' 16px, 'large' 19px, 'extra-large' 23px) via root `rem` scaling, token-based dark mode palette meeting WCAG AAA contrast, zero startup flash.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Camera Crash Fix Preservation | Maintain `@capacitor/camera@6.1.2` and AndroidManifest `<queries>` for `IMAGE_CAPTURE`, `GET_CONTENT`, `PICK` | Core | R6 |
| F02 | Secret Zero-Leak Guarantee | Zero API keys or secrets in client code or git repository | Core / M5 | R6 |
| F29 | Sticky Button & Scroll Padding Fix | Style "تصوير روشتة أخرى" as compact secondary action; set scroll area padding to `pb-36` (144px) so last item is fully reachable without overlap | M4 | R1 |
| F30 | Bottom Navigation Collision Fix | 5 equal-width slots (`grid-cols-5`), 24px icons, 12px labels (never > 14px), single line with ellipsis, zero collision at 360px & 320px | M3 | R1 |
| F31 | Button Emojis Replacement | Replace all button emojis (🔄 📷 🔍 📁 💊 🗑️ etc.) with locally bundled Lucide line-icons with uniform stroke width | M3 | R1 |
| F32 | Compact Top Bar & Slim Banner | Small logo, app name (~18px), no long subtitle, small "Aa" icon button, slim one-line banner (13-14px) for "راجع أسماء الأدوية قبل الاعتماد" | M3 | R1 |
| F33 | Modern Visual Styling | Brand teal #006D77, clean neutral backgrounds, white cards with 16px radius (`rounded-2xl`), soft shadows, 8px grid, subtle gradient on primary | M4 | R2 |
| F34 | Compact Result Cards | Prominent medicine name, confidence chip, small muted "as written" text, expandable chevron for details | M4 | R2 |
| F35 | Skeleton Loaders & Transitions | Skeleton loaders during analysis, screen transitions under 200ms, light haptics, reduced-motion support | M4 | R2 |
| F36 | Local Readex Pro Font Bundling | Bundle Readex Pro WOFF2 locally in `src/assets/fonts/`, remove remote Google Fonts links from `index.html`, zero network requests | M1 | R2 |
| F37 | Redesigned Home Screen | Compact greeting, two clean action cards (علبة دواء / روشتة) with icons, compact recent-scans list without large empty space | M4 | R2 |
| F38 | Center Camera Button Update | 64px circle, teal gradient #0A8F9C to #006D77, 4px notch ring, soft glow shadow, scan-style line-icon, "صوّر" label, scale 0.95 animation | M3 | R2 |
| F39 | Three Dynamic Font Size Levels | Support "عادي" (16px default), "كبير" (19px), "كبير جداً" (23px) via Settings, top-bar "Aa" button, and first-launch choice | M1 | R3 |
| F40 | Root Rem Sizing Scaling | Scale all typography and layouts via root font-size (rem units) so layouts never break on font size changes | M1 | R3 |
| F41 | Adaptive Touch Targets & Test Updates | Minimum 48px touch target in default mode, 56px in larger modes. Update legacy test assertions (64px/20px) without weakening unrelated tests | M1 | R3 |
| F42 | Dark Mode Options & Zero Flash | Settings options: "تلقائي" (system default), "فاتح" (light), "داكن" (dark), persisted locally with zero startup flash via synchronous `<head>` script | M2 | R4 |
| F43 | Token-Based Dark Palette & Contrast | Background #0E1517, surface #162124, surface-2 #1D2B2F, text #E6EEF0, muted #9FB3B8, primary #3DB8C4 (with dark text for AAA), warning #3A2E12/#F5D58A | M2 | R4 |
| F44 | Android System Bars Synchronization | Synchronize Android status bar and navigation bar with active theme via `values-night/styles.xml` and `<meta name="theme-color">` | M2 | R4 |
| F45 | Adaptive Launcher Icon Generation | Adaptive launcher icon (teal #006D77 background, white prescription sheet with capsule symbol) across all mipmap densities | M5 | R5 |
| F46 | Light and Dark Splash Screens | Generate matching splash screens across all Android asset densities via pure Node.js offline script | M5 | R5 |
| F47 | Consistent Line-Icon Set | Single locally bundled line-icon set (`lucide-react`) used consistently across the entire application | M3 | R5 |
| F48 | Screenshot Verification Suite | Capture browser screenshots at 360x800 and 320x640 in light and dark modes across all 3 font sizes for 7 screens (zero clipping/overlapping) | M5 | Verification |
| F49 | Version Bump & Release Reminder | Increment `versionCode 2 -> 3` and `versionName "1.1" -> "1.2"` in `build.gradle`, `sign-release.bat`, and `package.json` | M5 | Process |
| F50 | Full Test Suite Pass & Final Secret Scan | 100% tests pass, final secret scan passes, clean `cap sync android`, and explicit confirmation that it is safe to run `sign-release.bat` | M5 | Verification |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Typography, Readex Pro Font, Dynamic Rem Sizing & Touch Targets | F36, F39, F40, F41 (Readex Pro WOFF2 bundling, remove Google Fonts, rem tokens in Tailwind, root rem scaling, 48px/56px touch targets, test setup & legacy assertions update) | none | DONE |
| M2 | Dark Mode Tokens, Theming & Android System Bars Synchronization | F42, F43, F44 (Tailwind dark class, token palette, `<head>` zero-flash script, Settings theme/font modal, `values-night/styles.xml`, WCAG AAA contrast) | M1 | IN_PROGRESS |
| M3 | Navigation, Compact Top Bar, Center Camera Button & Lucide Icons | F30, F31, F32, F38, F47 (BottomNav 5 equal slots, 24px icons, 12px labels, 64px center camera button, compact top bar, Aa button, slim banner, replace emojis with Lucide) | M1, M2 | PLANNED |
| M4 | Modern Cards, Result Screens & Sticky Action Padding | F29, F33, F34, F35, F37 (Sticky button compact secondary styling, `pb-36` scroll padding, compact result cards, redesigned Home screen, skeleton loaders, <200ms transitions) | M1, M2, M3 | PLANNED |
| M5 | Launcher Icons, Splash Assets, Screenshot Suite, Build & Sign-off | F45, F46, F48, F49, F50 (Adaptive icons, light/dark splash screens, 84-screenshot matrix, version bump to 3/1.2, 100% tests pass, cap sync android, final secret scan, safe sign-off notice) | M1, M2, M3, M4 | PLANNED |

## Code Layout
- `src/assets/fonts/`: Bundled Readex Pro WOFF2 font files.
- `src/index.css`: Local `@font-face` rules, root rem sizing classes, touch target variables.
- `src/types/index.ts`: TypeScript contracts for font size ('normal'|'large'|'extra-large') and theme ('system'|'light'|'dark').
- `src/services/preferencesStorage.ts`: Font size and theme storage handlers.
- `src/components/BottomNavBar.tsx`: 5 equal-width slots, 24px icons, 12px labels, 64px center camera button.
- `src/components/TopBar.tsx` / `src/App.tsx`: Compact top bar, Aa button, Settings button, slim info banner.
- `src/components/SettingsModal.tsx`: Font size and theme options.
- `src/components/HomeScreen.tsx`: Redesigned modern greeting, 2 action cards, compact recent scans.
- `src/components/PrescriptionResultView.tsx`: Compact medicine cards, compact sticky button, scroll padding fix.
- `src/components/ResultCards.tsx`: 16px radius cards, prominent medicine names, expandable details.
- `src/components/SkeletonLoader.tsx`: Pulse skeleton loaders.
- `android/app/src/main/res/`: Adaptive icons (`mipmap-*`), splash drawables, `values-night/styles.xml`.
- `android/app/build.gradle`: Version code (3) and version name ("1.2").
- `sign-release.bat`: Version reminder and signing script.
- `scripts/generate-app-assets.js`: Standalone Node.js script for adaptive icons and splash screens.
- `scripts/capture-screenshots.js`: Chrome headless screenshot matrix runner.
- `tests/`: Vitest test suites.
