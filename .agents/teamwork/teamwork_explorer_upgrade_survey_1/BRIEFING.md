# BRIEFING — 2026-10-31T14:50:00Z

## Mission
Survey R1 (Native App Look and Bottom Navigation) and existing UI architecture in "دليلي الدوائي" (RTL).

## 🔒 My Identity
- Archetype: explorer
- Roles: UI & Nav Explorer
- Working directory: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_upgrade_survey_1\
- Original parent: be14d828-8b13-435b-929b-e3dd3fbf5ac6
- Milestone: upgrade_survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify application code
- Keep entire UI in Arabic with strict RTL layout
- Confirm camera and gallery crash fix is complete and working; maintain @capacitor/camera@6.1.2 (do not upgrade to 8.x) and preserve <queries> in AndroidManifest.xml
- Never put secrets or API keys in client
- Use npx.cmd and npm.cmd for Windows environment

## Current Parent
- Conversation ID: be14d828-8b13-435b-929b-e3dd3fbf5ac6
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `package.json` (line 17: `@capacitor/camera@^6.1.2`)
  - `android/app/src/main/AndroidManifest.xml` (lines 46-58: `<queries>` with `IMAGE_CAPTURE`, `GET_CONTENT`, `PICK`)
  - `src/services/nativeCamera.ts` (rear camera capture, gallery pick, permissions, cancelation handling)
  - `src/components/CameraCapture.tsx` (no `<input type="file">`, senior touch targets)
  - `src/App.tsx`, `src/index.css`, `tailwind.config.js` (RTL layout, typography, WCAG AAA colors, touch targets)
  - Existing components: `DisclaimerBanner.tsx`, `RecentScansList.tsx`, `ResultCards.tsx`, `UnclearPhotoCard.tsx`, `FontSizeToggle.tsx`, `AudioToolbar.tsx`
  - Android config: `android/app/build.gradle`, `styles.xml`, `MainActivity.java`, `sign-release.bat`
  - Test suites: Ran `npm.cmd test`, all 398 tests passed across 18 files.
- **Key findings**:
  - Camera & gallery fix is 100% verified and working.
  - Current UI is a single-screen layout; needs persistent 5-tab Bottom Navigation bar in RTL order.
  - Center button needs to be a 72-80px raised teal button opening native rear camera directly.
  - Home screen needs 2 big cards: "صوّر علبة دواء" and "صوّر روشتة".
  - Native feel CSS adjustments needed (`user-select: none`, `-webkit-tap-highlight-color: transparent`, `overscroll-behavior: none`, transitions < 250ms).
- **Unexplored areas**: None for UI & Nav survey.

## Key Decisions Made
- Recommended architectural blueprint for Fixed Bottom Navigation Bar with RTL sequence: الرئيسية, أدويتي, صوّر (Center), الروشتة, السجل.
- Recommended Home screen structure with friendly greeting, 2 big action cards, and recent scans.
- Highlighted critical requirement to keep `@capacitor/camera@6.1.2` and preserve Android `<queries>`.

## Artifact Index
- survey_ui_nav.md — Full comprehensive survey report and blueprint
- progress.md — Liveness heartbeat and progress log
- handoff.md — 5-component handoff report
