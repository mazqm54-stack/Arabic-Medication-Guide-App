# Original User Request

## Initial Request — 2026-10-31T14:22:04Z

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

## Follow-up — 2026-10-31T20:33:01Z

URGENT INSTRUCTION FROM USER - FAST TRACK REMAINING MILESTONES (M4 and M5):
1. Use ONE reviewer per milestone and ONE final security/secret scan at the end, instead of 5-agent gates and adversarial test expansions.
2. Do not add more tests than strictly needed for the new features. Keep the existing tests green.
3. Keep the camera fix intact (@capacitor/camera@6.1.2 and the manifest queries).
4. PRIORITY: Reach a state where the Android app builds and the prescription flow works end-to-end. Deploy the Worker and test it with real status codes and response times.
5. After acknowledging, report updates ONLY when a milestone finishes or if blocked. Clearly indicate when it is safe for the user to run sign-release.bat.

Please adapt the orchestration plan immediately for speed.
