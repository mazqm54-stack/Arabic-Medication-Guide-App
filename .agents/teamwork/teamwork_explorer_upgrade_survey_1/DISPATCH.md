# Dispatch for Explorer 1 (UI & Nav Survey)
Survey R1 (Native UI, Bottom Navigation, Camera Integration).
See prompt for full details.

## 2026-10-31T14:28:09Z
Sender: be14d828-8b13-435b-929b-e3dd3fbf5ac6
Content:
You are Survey Explorer 1 (UI & Nav Explorer).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_upgrade_survey_1\
Your parent is: be14d828-8b13-435b-929b-e3dd3fbf5ac6

MANDATORY: Read the authoritative request file at:
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md before starting.

You are a read-only exploration agent. Do NOT write or modify application code.

Your Mission:
Survey R1 (Native App Look and Bottom Navigation) and the existing UI architecture in the repository:
1. Confirm camera and gallery crash fix is complete and working:
   - Check `@capacitor/camera` version in `package.json` (must be 6.1.2, do not upgrade to 8.x).
   - Check `android/app/src/main/AndroidManifest.xml` for `<queries>` with `IMAGE_CAPTURE`, `GET_CONTENT`, and `PICK`.
   - Inspect existing `src/services/nativeCamera.ts` and `src/components/CameraCapture.tsx`.
2. Inspect existing UI structure, RTL layout, theme, and styling:
   - Examine `src/App.tsx`, `src/index.css`, `tailwind.config.js`, and existing screen/component layout.
   - Inspect existing tabs or views, safe-area insets, font sizes, contrast, touch targets.
3. Investigate requirements for Fixed Bottom Navigation Bar:
   - RTL order (right to left): الرئيسية (Home), أدويتي (My Medicines), [CENTER CAMERA BUTTON], الروشتة (Prescription), السجل (History).
   - Center button: Large raised round button (72–80px, teal #006D77, white camera icon, label "صوّر"), opening native rear camera immediately (`@capacitor/camera`, `CameraSource.Camera`) for box analysis.
   - Other tabs: Large icons (28px+), bold labels (at least 16px), touch targets at least 64px, active state (filled rounded pill behind active icon), light haptic feedback on tap, respecting safe-area insets.
4. Investigate native mobile feel requirements:
   - Disabling text selection (`user-select: none`), tap highlight (`-webkit-tap-highlight-color: transparent`), overscroll bounce (`overscroll-behavior: none`).
   - Smooth short screen transitions (<250ms), teal status bar, top title bar, large rounded cards, soft shadows, body text 20px+, high contrast.
   - Medical disclaimer visibility on all result screens.
5. Investigate Home screen requirements:
   - Friendly greeting, two big cards ("صوّر علبة دواء" and "صوّر روشتة"), recent scans list.
6. Identify all affected files, existing components that can be reused or refactored, and potential risks.

Deliver your detailed findings, verified evidence chains, and feature inventory to:
`c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_upgrade_survey_1\survey_ui_nav.md`
Also create `handoff.md` and keep `progress.md` updated with timestamps.
Send a message back to parent when completed.
