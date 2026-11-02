## 2026-10-29T15:44:44Z
Fix two bugs in the Dalili Medication Guide Android application and Cloudflare Worker backend: camera button behavior and image analysis failure handling.

Working directory: c:\Users\PC\Documents\antigravity\fervent-mendel
Integrity mode: development

## Requirements

### R1. Native Camera Integration (Bug 1)
- The main button ("صوّر علبة الدواء الآن") must use the native `@capacitor/camera` plugin with source `CameraSource.Camera` (rear camera).
- The photo gallery must be a separate secondary button using `CameraSource.Photos`.
- Do NOT use an `<input type="file">` for the main button.
- Make sure `android/app/src/main/AndroidManifest.xml` has the `CAMERA` permission and the camera feature declared as not required (`android.hardware.camera` with `android:required="false"`).
- Capacitor Camera permissions must be requested and handled at runtime.
- Run `npx cap sync android` after the changes.

### R2. Error Handling, Timeout, and Image Compression Diagnostics (Bug 2)
- Do not map every error to "image not clear". Separate these cases with different friendly Arabic messages:
  (a) Network or timeout
  (b) Server error
  (c) The AI said `is_clear=false`
  (d) Invalid JSON
- Add a 30-second timeout on the client request with a friendly Arabic message and a retry button.
- Check the image compression code on Android WebView: ensure the compressed image is a valid JPEG and is not blank or black (verify base64 output length and image dimensions).
- Ensure the client reads and handles the Worker debug field `error_code` for failures to display the appropriate Arabic message.
- Run all existing tests (`npm.cmd test`), rebuild the application, and provide the command for signing the release APK (`sign-release.bat`).

### R3. Cloudflare Worker Diagnostics and Upstream Error Handling
- Test the live endpoint `https://dalili-medication-guide-worker.dalili-medication.workers.dev` using a valid sample base64 JPEG image (using the exact request format the app uses) and record the exact HTTP status code and full JSON response body without printing secrets.
- Verify whether the Gemini API accepts `thinkingConfig` and the configured model name (`gemini-3.8-flash` in `worker/wrangler.toml`).
- If Gemini rejects the request because of location/region, report it explicitly.
- In the Worker, log the real upstream error without ever logging the API key or image data.
- Make the Worker return a safe `error_code` and a short non-sensitive `detail` field when Gemini fails (e.g. Gemini HTTP status and error message without key or image data), so the client can diagnose failures.
- Redeploy the Worker with `npx wrangler deploy` and re-test against the live endpoint until it returns a valid JSON result.

## Verification Resources
- Use synthetic sample test images (e.g. a small valid JPEG with sample medication text) generated during testing to verify the live Worker endpoint and image compression.
- Vitest test suite runnable via `npm.cmd test`.
- Android build/sync commands: `npx cap sync android`.

## Acceptance Criteria

### Bug 1: Native Camera
- [ ] Main capture button invokes `@capacitor/camera` with `CameraSource.Camera` (rear camera) and does not use `<input type="file">`.
- [ ] Photo gallery picker is accessible via a separate secondary button using `CameraSource.Photos`.
- [ ] `android/app/src/main/AndroidManifest.xml` specifies `android.permission.CAMERA` and `android.hardware.camera` with `android:required="false"`.
- [ ] Runtime camera permission requests are implemented for Android.
- [ ] `npx cap sync android` executes without error.

### Bug 2: Client Diagnostics & Error Messaging
- [ ] Client request aborts after 30 seconds, presenting a distinct friendly Arabic timeout message and an interactive retry button.
- [ ] Distinct Arabic error messages are displayed for: network/timeout, server error, invalid JSON, and AI `is_clear=false`.
- [ ] Image compression utility produces verified valid JPEG base64 output (valid header, non-zero length/dimensions, not blank/black).
- [ ] Test suite (`npm.cmd test`) passes.
- [ ] Instructions provided for running `sign-release.bat`.

### Cloudflare Worker & Live Endpoint
- [ ] Live endpoint `https://dalili-medication-guide-worker.dalili-medication.workers.dev` is tested with a valid base64 image payload.
- [ ] Exact HTTP status code and full JSON response body (sanitized of secrets) are reported.
- [ ] Upstream Gemini error handling in the Worker returns a safe `error_code` and short `detail` string without exposing API keys or image data.
- [ ] Worker is redeployed via `npx wrangler deploy`.
- [ ] Live endpoint test returns HTTP 200 and a valid JSON analysis result.


## 2026-10-31T14:24:12Z
Upgrade the Arabic Android application "دليلي الدوائي" (RTL) for production with native bottom navigation, prescription reading flow, unclear photo guidance, common medication usage information, and backend Cloudflare Worker integration.

Working directory: c:\Users\PC\Documents\antigravity\fervent-mendel
Integrity mode: development

## Requirements

### R1. Native App Look and Bottom Navigation
- Keep the entire UI in Arabic with strict RTL layout. Keep all existing functionality working.
- IMPORTANT: First confirm that the camera and gallery crash fix is complete and working, and do not break it. Maintain `@capacitor/camera@6.1.2` (do not upgrade to 8.x) and preserve the `<queries>` in `AndroidManifest.xml` for `IMAGE_CAPTURE`, `GET_CONTENT`, and `PICK`.
- Never put secrets or API keys in the client. Use `npx.cmd` and `npm.cmd` for Windows environment command execution.
- Add a fixed bottom navigation bar in RTL order (right to left): الرئيسية, أدويتي, [CENTER CAMERA BUTTON], الروشتة, السجل.
- Center button: Large raised round button (72–80px, teal #006D77, white camera icon, label "صوّر"). It opens the native rear camera immediately (`@capacitor/camera`, `CameraSource.Camera`) and starts the medicine-box analysis flow.
- Other tabs: Large icons (28px+), bold labels (at least 16px), touch targets at least 64px, a clear active state (filled rounded pill behind active icon), light haptic feedback on tap, respecting Android safe-area insets.
- Native mobile feel (not a web page): No text selection, no tap highlight, no overscroll bounce, smooth short screen transitions (under 250ms), teal status bar, simple top title bar, large rounded cards, soft shadows, 20px+ body text, high contrast. Keep the medical disclaimer visible on result screens.
- Home screen: Short friendly greeting, two big cards ("صوّر علبة دواء" and "صوّر روشتة"), and recent scans without clutter.

### R2. Prescription Reading Flow (Tab "الروشتة") and Cloudflare Worker Integration
- Tab has a big "صوّر الروشتة" button (camera) and a secondary gallery button.
- Image compression: For prescription photos only, compress to max 1600px on the longest side with JPEG quality 0.8 (preserve 1024px and JPEG quality 0.7 for medicine box photos). Ensure the Worker accepts this payload size within its image size limit.
- Cloudflare Worker prescription analysis:
  - Add prescription capability (via new route `/api/prescription` or a `mode` field, team decision) with strict system instruction and schema.
  - Model configuration: Add env var `GEMINI_MODEL_PRESCRIPTION` (default `gemini-3.8-flash` with thinkingLevel LOW). Keep `GEMINI_MODEL` (fast model) for medicine boxes. Never hardcode model names.
  - Enforce 25s abort in the Worker, 30s timeout in the client, and separate error codes (never turn a timeout or server error into "image not clear").
  - System instruction rules:
    1. Only read what is actually written. NEVER guess a medicine name from partial or unclear letters. If a line is unclear, mark it low confidence and leave the name empty or exactly as visible.
    2. If the whole image is blurry, dark, cropped, or not a prescription, set `is_clear=false` with a friendly Arabic `retake_message` (more light, whole page visible, hold steady).
    3. Copy what the doctor wrote about dose, frequency, or duration EXACTLY into `written_instructions`. Never invent or complete instructions. If nothing is written, leave it empty.
    4. For each readable medicine give a one-sentence simple Arabic explanation of what it is generally used for. For low-confidence items give no explanation.
    5. Maximum 10 items. Simple, warm Modern Standard Arabic for elderly people. JSON only.
  - Schema: `{ is_clear, retake_message, confidence, evidence_text, items: [ { line_text_as_written, medicine_name_ar, medicine_name_en, active_ingredient, confidence ("high"|"medium"|"low"), written_instructions, short_explanation } ], audio_summary }`.
- Client rules & presentation:
  - Validate the JSON. If `items` is empty, show the retake screen.
  - Render one big card per medicine: name (large), one-line purpose, a box "ما كتبه الطبيب" with `written_instructions` if any, and a confidence badge.
  - Low-confidence items: Shown in a soft amber card: "غير واضح، اسأل الصيدلي" with no explanation.
  - Header notice above list: "راجع أسماء الأدوية قبل الاعتماد".
  - Show permanent disclaimer and add a read-aloud button for the whole prescription.
  - Each medicine card is tappable and opens a separate "تفاصيل الدواء" page with the same 4 cards as the box result.
  - Add a Worker mode "details" that takes the medicine name as text (no image) and returns the box-result schema. Cache details by medicine name. Add "أضف لأدويتي" on each item.

### R3. Unclear Photos Handling
- Both medicine box and prescription flows: Provide a friendly Arabic message with 3 short retake tips and a big "إعادة التصوير" button.
- For prescriptions: If only some lines are unclear, still show the readable ones and mark the others as low confidence.

### R4. Medication Usage Card ("كيف ومتى")
- `how_and_when` must NEVER be empty and must not just say "follow the doctor". Give 2–3 short items about the COMMON general usage of the active ingredient (timing such as before or after food, and typical frequency in general words). Do NOT include mg or ml amounts, exact doses, or treatment durations.
- If the box or prescription prints instructions, show those first, labeled "مكتوب على العلبة" or "مكتوب في الروشتة". Add a field `usage_source` ("printed" or "common") and label general items "الاستخدام الشائع".
- Under the card, always show this fixed line (hard-coded in the app, not AI-generated): "هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي."
- Update rule 6 of the box system instruction to allow this general common usage, while still forbidding exact doses and personal medical advice.

### R5. Test Suite, Verification, Versioning, and Live Worker Deployment
- Versioning: Increase `versionCode` and `versionName` in `android/app/build.gradle` for this build. Update `sign-release.bat` to remind the user to increment them on each release (or automate the check/increment) so that the new APK installs cleanly over existing installations.
- Update and add tests: Bottom navigation, prescription JSON validator (low confidence flagged, empty items goes to retake), details mode and cache, usage never empty, fixed disclaimer line present. Keep the secret scan. Run all tests.
- Deploy the Worker with `npx.cmd wrangler deploy` and test live endpoints with real sample images. Record and report real status codes and response times. Do not say anything works without real evidence. The user will run `sign-release.bat` themselves.

## Verification Resources
- Vitest test suite runnable via `npm.cmd test` / `npx.cmd vitest run`.
- Live Cloudflare Worker endpoint testing via `worker/wrangler.toml` and `npx.cmd wrangler deploy`.
- Synthetic sample test images and fixtures generated during testing to verify prescription analysis, unclear photo detection, and live Worker response formats.

## Acceptance Criteria

### Navigation & UI Shell
- [ ] Bottom navigation bar is fixed, displayed in RTL order (الرئيسية, أدويتي, Center Button, الروشتة, السجل).
- [ ] Center camera button is 72–80px teal (#006D77) circular button labeled "صوّر", opening the rear camera directly via `@capacitor/camera` (`CameraSource.Camera`) without using `<input type="file">`.
- [ ] Tab buttons have touch targets >= 64px, icons >= 28px, labels >= 16px, rounded pill active indicator, and light haptic feedback.
- [ ] Native app feel verified: No text selection, no tap highlight, no overscroll bounce, transitions < 250ms, teal status bar, body text >= 20px, high contrast, safe-area insets respected.
- [ ] Home screen displays friendly greeting, "صوّر علبة دواء" and "صوّر روشتة" cards, and recent scans.
- [ ] Medical disclaimer is visible on all result screens.

### Prescription Flow & Cloudflare Worker
- [ ] "الروشتة" tab includes "صوّر الروشتة" (camera) and gallery picker buttons.
- [ ] Prescription photo compression compresses to max 1600px longest side and JPEG quality 0.8, while medicine box photos remain 1024px / 0.7.
- [ ] Worker supports prescription mode with `GEMINI_MODEL_PRESCRIPTION` (default `gemini-3.8-flash`, thinkingLevel LOW) without hardcoding model names.
- [ ] Worker processes the 1600px / 0.8 quality prescription image payload within its size limits.
- [ ] Worker enforces 25s abort limit, client enforces 30s timeout, and distinct error codes/messages are returned without mapping timeouts or server errors to "image not clear".
- [ ] Prescription system instruction and schema strictly conform to rules (evidence text, verbatim instructions, one-sentence purpose for readable items, no guess on unclear text, max 10 items).
- [ ] Prescription client validation routes empty items to retake screen.
- [ ] Each readable medicine displays name, purpose, "ما كتبه الطبيب" instructions, and confidence badge.
- [ ] Low-confidence items display in soft amber card ("غير واضح، اسأل الصيدلي") with no AI explanation.
- [ ] Advisory banner "راجع أسماء الأدوية قبل الاعتماد", permanent disclaimer, and whole-prescription read-aloud button are rendered.
- [ ] Tapping a prescription medicine card opens "تفاصيل الدواء" backed by Worker text details mode and client-side caching by medicine name.
- [ ] "أضف لأدويتي" action is present on each prescription medicine item.

### Unclear Photos & Medication Usage
- [ ] Unclear photo state shows friendly Arabic message, 3 retake tips, and "إعادة التصوير" button.
- [ ] Partially unclear prescription images render legible items and flag unclear items.
- [ ] `how_and_when` card is non-empty with 2–3 common usage items, distinguishes `usage_source` ("printed" vs "common"), and displays labels "مكتوب على العلبة" / "مكتوب في الروشتة" / "الاستخدام الشائع".
- [ ] Fixed Arabic disclaimer string ("هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي.") is rendered immediately under the usage card.
- [ ] Rule 6 of box system instruction allows general common usage while forbidding exact doses and personal medical advice.

### Quality, Security, Versioning & Deployment
- [ ] `versionCode` and `versionName` in `android/app/build.gradle` incremented for this release build.
- [ ] `sign-release.bat` updated to remind user or automate incrementing versions for clean APK upgrades.
- [ ] Vitest test suite passes with 100% success rate via `npm.cmd test` (covering bottom nav, prescription JSON validator, details mode & cache, usage never empty, disclaimer line).
- [ ] Secret scan passes with zero API keys or secrets in client code or git.
- [ ] Camera and gallery crash fix is intact: `@capacitor/camera@6.1.2` maintained, `AndroidManifest.xml` intent queries preserved.
- [ ] Cloudflare Worker deployed to live environment with `npx.cmd wrangler deploy`.
- [ ] Live endpoint tested with real sample image payloads with real HTTP status codes and response times documented.


## 2026-10-31T17:02:55Z
[Message from Sentinel Parent e8a2b200-a3c8-44e3-8bf6-97238e80f268]:
Sentinel liveness check: Please update your progress.md and review Worker M2 Replacement status (Worker M2 has finished all implementations, passed 831/831 tests, and generated handoff.md).


## 2026-11-01T20:58:48Z
[Message from Parent c4436489-dbc3-4aa2-9af5-8cb100353553]:
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
