# Original User Request

## Approved Task Prompt — 2026-11-01T20:57:17Z

Use fast-track mode: one reviewer per milestone, one final secret scan at the end, and do not add large numbers of extra tests. Send one short status message when each milestone ends, and clearly state when it is safe to run sign-release.bat. Redesign the visual look and UX of the Arabic app "دليلي الدوائي" to feel like a modern native Android app for pharmacists and the general public. This is a visual and UX production update to the existing app while keeping all existing features, behaviors, logic, services, Worker, and tests intact.

Integrity mode: development

## Requirements

### R1. Layout and Navigation Fixes
- Fix the sticky button "تصوير روشتة أخرى" on the prescription result screen so it does not overlap content or the "استمع للروشتة" button: ensure the scroll area has adequate bottom padding (including navigation bar and safe area) so the last item is fully reachable, and style the button as a compact secondary action.
- Fix bottom navigation label collisions ("الروشتة" and "السجل", "الرئيسية" and "أدويتي") using 5 equal-width slots, 24px icons, 12px labels (never above 14px), single line with ellipsis, verifying zero overlap at 360px and 320px viewport widths.
- Replace all button emojis (🔍 🔄 📷) with a consistent locally bundled line-icon set (such as Lucide icons) with uniform stroke width.
- Implement a compact top bar with a small logo, app name (~18px), no long subtitle, a small "Aa" icon button replacing the large font-size card, and a slim one-line banner (13-14px, info icon) for "راجع أسماء الأدوية قبل الاعتماد".

### R2. Modern Visual Styling, Cards, and Home Screen
- Apply a clean, modern aesthetic retaining brand teal #006D77, clean neutral backgrounds, white cards with 16px radius, soft shadows, consistent 8px spacing grid, one accent color, and subtle teal gradient only on primary elements.
- Implement compact result cards: prescription medicine items with prominent medicine name, confidence chip, the "as written" line in small muted text, and a chevron to expand details.
- Provide skeleton loaders during analysis, screen transitions under 200ms, light haptics, and respect reduced-motion settings.
- Bundle the modern Arabic font "Readex Pro" locally and remove the old font if no longer used. Zero network font requests.
- Redesign the Home screen with a compact greeting, two clean action cards (علبة دواء / روشتة) with icons, and a compact recent-scans list without large empty areas.
- Center camera button: visual-only update (64px circle, teal gradient #0A8F9C to #006D77, 4px ring matching nav bar background for notch effect, soft glow shadow, white scan-style line-icon inside corner brackets, small "صوّر" label below, scale 0.95 press animation and haptic, functional in light and dark mode, retaining existing tap action exactly).

### R3. Dynamic Font Sizing and Touch Targets
- Support three selectable font size levels: "عادي" (default, base body 16px), "كبير" (base body 19px), and "كبير جداً" (base body 23px), accessible in Settings, via the top-bar "Aa" button, and on the first-launch choice screen (if present).
- Scale all typography and layouts via root font-size (rem units) so layouts do not break when font size changes.
- Ensure minimum touch target size of 48px (56px in the two larger font size levels). Update old tests expecting 64px/20px to the new rules without weakening unrelated tests.

### R4. Dark Mode and System Theming
- Provide theme options in Settings: "تلقائي" (follows system, default), "فاتح" (light), and "داكن" (dark), persisted locally with zero flash of incorrect theme on startup.
- Implement a token-based dark palette meeting at least 4.5:1 text contrast ratio (background #0E1517, surface #162124, surface-2 #1D2B2F, text #E6EEF0, muted text #9FB3B8, primary #3DB8C4, warning box background #3A2E12 with text #F5D58A). Ensure confidence chips, the amber "غير واضح، اسأل الصيدلي" card, borders, bottom nav, and status bar render properly in dark mode.
- Synchronize Android status bar and navigation bar colors with the active theme.

### R5. Launcher Icons and App Assets
- Create an adaptive Android app launcher icon (teal #006D77 background, clean white prescription sheet with capsule symbol, clear and recognizable at small sizes) and matching splash screens (light and dark).
- Generate all required Android asset sizes (e.g. using @capacitor/assets with 1024x1024 source or equivalent script).
- Ensure all in-app icons use the single locally bundled line-icon set with consistent stroke width.

### R6. Hard Constraints and Process Guardrails
- Work strictly as an update to the existing codebase in the current project repository; do not rebuild from scratch, do not recreate the project, and do not replace or rewrite existing logic, services, Worker, or tests.
- A git commit named "before-ui-redesign" (commit 4031ce9) has already been created as a restore point; ensure keystore and password files remain strictly ignored in .gitignore.
- Never replace a real plugin with a stub or fake file. If something fails to build, report the exact error instead of working around it.
- Do not touch the Worker, API logic, or camera/gallery logic. Keep @capacitor/camera@6.1.2 and AndroidManifest.xml <queries>. Do not replace the native camera with a custom in-app camera; only change button appearance.
- Strictly maintain Arabic RTL throughout.
- Keep medical disclaimers visible on result screens.
- Zero secrets in client code.
- Use npx.cmd / npm.cmd for all commands.
- Process guardrails: Use fast-track mode: one reviewer per milestone, one final secret scan at the end, and do not add large numbers of extra tests. Send one short status message when each milestone ends, and clearly state when it is safe to run sign-release.bat.

## Acceptance Criteria

### Visual and Layout Verification
- [ ] Sticky button "تصوير روشتة أخرى" on prescription result screen does not overlap "استمع للروشتة" or any content; scroll area bottom padding allows the last item to be fully reachable.
- [ ] Bottom navigation displays 5 equal-width slots with 24px icons and labels <= 14px on a single line with ellipsis; zero label collision or clipping at 360px and 320px viewport widths.
- [ ] All button emojis (🔍 🔄 📷) replaced with consistent locally bundled line-icons.
- [ ] Top bar is compact (~18px title, small logo, no long subtitle), large font-size card replaced with small "Aa" button, and reminder banner is a slim one-line info banner (13-14px).
- [ ] Result screens render compact medicine cards with confidence chip, muted "as written" line, and expandable chevron.
- [ ] Home screen displays compact greeting, two action cards with icons, and compact recent-scans list without large empty space.
- [ ] Center camera button is a 64px circle with teal gradient, notch-effect ring, scan-style line-icon, "صوّر" label, press animation, and unchanged tap behavior.

### Typography, Accessibility, and Theming
- [ ] Arabic font Readex Pro bundled locally with zero network font requests; unused font files removed.
- [ ] Font size switcher supports "عادي" (16px), "كبير" (19px), "كبير جداً" (23px) via root rem scaling without breaking layouts.
- [ ] Minimum touch targets are at least 48px in default size and 56px in larger sizes. Existing tests updated to match without weakening unrelated checks.
- [ ] Dark mode switchable ("تلقائي", "فاتح", "داكن") and persisted locally with zero startup flash; all screens, chips, and warning boxes meet 4.5:1 text contrast.
- [ ] Android status bar and navigation bar match active theme colors.

### Assets, Build, and Process
- [ ] Adaptive launcher icon and splash screens (light and dark) generated across all Android asset densities.
- [ ] Screenshots captured in browser at 360x800 and 320x640 in light and dark modes across all 3 font sizes for: home, medicine result, prescription result (with low-confidence item), unclear-photo, my medicines, history, settings, confirming zero clipping or overlapping.
- [ ] Restore point commit "before-ui-redesign" intact and keystore/password files remain untracked in .gitignore.
- [ ] No real plugins replaced with stubs or fake files.
- [ ] All test suites pass without adding large numbers of unnecessary extra tests.
- [ ] Final secret scan passes at the end with zero secrets found.
- [ ] Version code and version name bumped.
- [ ] Build succeeds and `npx.cmd cap sync android` completes without errors.
- [ ] Short status message sent when each milestone ends, and explicit confirmation provided when it is safe to run `sign-release.bat`.
