# Original User Request

## 2026-10-27T20:15:11Z

Build a complete, production-ready, mobile-first Progressive Web App (PWA) in Arabic (RTL layout) called "دليلي الدوائي" (My Medication Guide) designed specifically for elderly users to photograph medication packages, receive instant, simplified explanations via Gemini Vision AI, hear audio readouts via Web Speech API, and review scan history with high-contrast accessibility.

Working directory: c:\Users\PC\Documents\antigravity\fervent-mendel
Integrity mode: development

## Requirements

### R1. Elderly-Centric Arabic UI, Typography & Accessibility
- Build a mobile-first, zero-clutter single-screen workflow in full Right-to-Left (RTL) Arabic layout using a legible Arabic font ('Cairo' or 'Tajawal').
- Implement high-contrast medical palette: Deep Teal (#006D77), Warm White (#F8F9FA), Clear Dark Slate text (#1D3557), and soft amber warning highlights.
- Enforce senior-friendly typography and touch targets: minimum 20px body font size, 28px+ headings, minimum 64px button touch target height with explicit icons and labels.
- Provide a persistent font size toggle at the top of results between "خط كبير" (Large - 20px) and "خط كبير جداً" (Extra Large - 24px+).

### R2. Camera Capture, Gallery Upload & Gemini Vision AI Analysis
- Primary home screen action: large, reassuring button to photograph medicine ("📷 صوّر علبة الدواء الآن") activating device rear camera (`capture="environment"`), with an alternative button for gallery image upload.
- Display a reassuring Arabic loading indicator: "جاري قراءة علبة الدواء... يرجى الانتظار قليلاً" with an accessible spinner.
- Securely prompt for the Gemini API key on first launch with local storage persistence and quick edit access.
- Send the medication photo to Gemini 1.5 Flash Vision using the strict Arabic pharmacist system prompt:
  "أنت صيدلي خبير ومساعد طبي ذكي مخصص لكبار السن. مهمتك هي تحليل صورة علبة الدواء المرفقة بدقة عالية وإرجاع النتيجة باللغة العربية البسيطة والواضحة جداً بصيغة JSON فقط:
  {
    \"is_clear\": true/false,
    \"medicine_name_ar\": \"اسم الدواء بالعربية\",
    \"medicine_name_en\": \"Medicine Name & Concentration\",
    \"active_ingredient\": \"المادة الفعالة\",
    \"uses\": [\"استخدام 1\", \"استخدام 2\"],
    \"how_and_when\": [\"طريقة الاستخدام وأفضل وقت (مثال: قرص واحد بعد الأكل صباحاً ومساءً)\"],
    \"warnings\": [\"تحذير مبسط 1\", \"تحذير مبسط 2\"],
    \"audio_summary\": \"نص متصل ومبسط جداً باللغة العربية الفصحى السهلة لقراءته صوتياً للمريض يلخص اسم الدواء واستخدامه وموعده\"
  }
  قواعد صارمة: إذا كانت الصورة غير واضحة أو ليست لدواء، اجعل is_clear = false واطلب من المستخدم إعادة التصوير في بيئة جيدة الإضاءة. لا تقدم جرعات طبية قطعية بل اذكر الإرشادات العامة وذكّر دائماً باستشارة الطبيب."
- If `is_clear` is false or parsing fails, present a kind, clear Arabic error state encouraging the user to retake the photo in better lighting.

### R3. Structured Result Cards, Arabic Text-to-Speech & Medical Disclaimer
- Results presented in 4 distinct color-coded cards with large intuitive icons:
  1. اسم الدواء والمادة الفعالة (Arabic & English names + active ingredient).
  2. دواعي الاستعمال (simplified Arabic bullet points).
  3. طريقة الاستخدام وأفضل المواعيد (meal timing and schedule highlights).
  4. تنبيهات هامة (cautions and side effects on soft amber background).
- Prominent Audio Readout toolbar: "🔊 استمع للمعلومات" utilizing browser Web Speech API (`window.speechSynthesis` with `ar-SA` or `ar-EG` voice) to narrate `audio_summary`, complete with clear Play, Pause, and Stop controls.
- Sticky action button: "🔄 تصوير دواء آخر" to reset to the camera screen.
- Persistent medical disclaimer banner on the results view: "تنبيه: هذه المعلومات إرشادية لتسهيل القراءة ولا تغني عن تعليمات طبيبك أو الصيدلي."

### R4. Offline PWA Shell & Local History
- Configured PWA with valid Web App Manifest (`manifest.webmanifest`), app icons, theme color, and Service Worker for offline application shell caching.
- Local scan history: automatically save the last 5 successful medication analyses in `localStorage`. Display these recent items on the home screen as easily clickable cards to view full details without rescanning.

## Acceptance Criteria

### Automated Verification
- [ ] Programmatic unit and integration test suite (Vitest + React Testing Library) runs and passes 100% of tests.
- [ ] Tests verify JSON parsing, handling of `is_clear: false`, fallback on malformed AI output, and prompt error states.
- [ ] Tests verify `localStorage` operations for the 5-item scan history (FIFO eviction, retrieval, duplicate prevention).
- [ ] Tests verify Arabic SpeechSynthesis controller state transitions (play, pause, stop, error fallback).
- [ ] Tests verify accessibility parameters: minimum body font size ≥ 20px, headings ≥ 28px, button touch targets ≥ 64px, and contrast compliance.
- [ ] Production build succeeds with `npm run build` with zero TypeScript, syntax, or bundling errors.

### Functional Verification
- [ ] PWA manifest and service worker register cleanly and pass PWA readiness criteria.
- [ ] UI is fully Right-to-Left (`dir="rtl"`) with Arabic typography.
- [ ] Camera input correctly specifies `capture="environment"`, and gallery file picker allows image selection.
- [ ] Font size toggle dynamically toggles between Large (20px) and Extra Large (24px+) across all cards.
- [ ] Medical disclaimer banner is permanently visible on the results screen.


## 2026-10-28T18:21:21Z

Upgrade the existing Arabic application "دليلي الدوائي" (My Medication Guide) into a high-speed, modern, native Android application (APK) specifically optimized for elderly users, featuring a zero-secret Vercel serverless backend, Capacitor native plugins, local offline font bundling, image compression and hashing cache, a medicine name confirmation step, and a local "أدويتي" (My Medicines) manager.

Working directory: c:\Users\PC\Documents\antigravity\fervent-mendel
Integrity mode: development

## Requirements

### R1. Zero-Secret Serverless Backend (/api/analyze)
- Completely remove all client-side API key inputs and localStorage key storage logic. No secrets may exist in client bundles or APK.
- Implement a Vercel Serverless Function at `/api/analyze`:
  - Accepts `POST` with base64 JPEG image payload.
  - Invokes Gemini API server-side using `GEMINI_API_KEY` and configurable `GEMINI_MODEL` environment variables (never hardcode the model name).
  - Configures temperature 0, responseMimeType "application/json", disabled/minimized thinking latency, and strict JSON responseSchema matching R5.
  - Implements per-IP rate limiting (e.g. 20 requests/hour), max image size validation, and Europe/MENA region affinity (`fra1` or `cdg1`).
  - Returns kind, clear Arabic error responses.
- Client communicates through `VITE_API_URL` environment variable.
- Include a concise deployment guide and README for Vercel deployment and environment configuration.

### R2. Native Capacitor Android Architecture & Distribution
- Wrap and configure Capacitor for native Android:
  - `@capacitor/camera` for native rear camera capture (`CameraSource.Camera`) with gallery picker fallback.
  - `@capacitor-community/text-to-speech` for Arabic speech synthesis (rate ~0.85) with Play, Pause, and Stop controls.
  - `@capacitor/haptics` for light haptic feedback on primary touch targets.
  - `@capacitor/preferences` (or localStorage) for resilient offline data storage.
  - Custom Teal (`#006D77`) splash screen, modern high-contrast app icon, and locked portrait orientation.
- Provide step-by-step instructions and scripts to build a signed release APK for direct installation without Google Play.

### R3. Performance, Offline Optimization & Local Assets
- Client-side image pre-processing: resize to max 1024px on longest side, compress to JPEG quality 0.7 before transmission.
- Immediate local image preview and skeleton loader with reassuring Arabic status text during processing.
- Image hash caching: compute local hash of captured images to instantly serve cached analysis without re-querying the API.
- Bundle Arabic web fonts (`Cairo`) locally inside `src/assets/fonts/` (zero external runtime Google Font requests).
- Network resilience: automatic single retry on network failure; informative offline Arabic banner allowing full access to saved medicines.
- Concise model output: concise bullet points, no long paragraphs.

### R4. Elderly-Centric Arabic Flow & Features
- **Home Screen:** Massive primary button `📷 صوّر علبة الدواء الآن`, secondary `أدويتي` (My Medicines) shelf, and recent scans history.
- **First-Launch Onboarding:** 3-point visual photo guide with large icons (good lighting, whole package in frame, steady phone) with a large `فهمت` (Understood) dismissal button.
- **Medicine Confirmation Step:** Display detected medicine name in extra-large text with two prominent choices: `نعم، هذا دوائي` (Yes, this is my medicine) to open full details, and `لا، أعد التصوير` (No, retake photo). If confidence is "low", automatically prompt for a retake.
- **"أدويتي" (My Medicines):** One-click button `أضف لأدويتي` on results; stores medicine name, thumbnail, and date locally on device only (zero server accounts). Includes deletion with Arabic confirmation dialog.
- **Results Screen:** 4 color-coded cards (Identity, Uses, Dosage/Schedule, Warnings), Speech Read Aloud toolbar, font size toggle (`large` 20px vs `extra-large` 24px+), sticky `🔄 تصوير دواء آخر` button, and permanent medical disclaimer banner: "تنبيه: هذه المعلومات إرشادية لتسهيل القراءة ولا تغني عن تعليمات طبيبك أو الصيدلي."
- Exclude unnecessary clutter: no expiry date scanning, no WhatsApp/sharing, no reminders, no accounts or passwords.

### R5. AI Pharmacist Prompt, Strict Schema & Client Guardrails
Enforce this exact system instruction for Gemini, word for word:

"You are an expert pharmacist assistant for elderly Arabic-speaking users. You will receive a photo of a medicine box or blister pack. Your job is to READ what is printed on the packaging and explain it in very simple Arabic.

STRICT RULES:
1. Only use text you can actually see on the packaging for the medicine name, strength and active ingredient. NEVER guess or invent. If a part is unreadable, leave it empty and lower the confidence.
2. If the image is blurry, too dark, cropped, or not a medicine, set is_clear=false and write a short friendly Arabic message in retake_message telling the user how to retake the photo (more light, whole box visible, hold the phone steady).
3. If more than one different medicine is visible, set is_clear=false and ask the user to photograph one medicine at a time.
4. Copy the exact text you read from the box into evidence_text (the name, strength and active ingredient as printed). This is used to verify you did not guess.
5. Set confidence to 'high' only if the name and the active ingredient are both clearly printed and agree with each other. Use 'medium' if one is unclear. Use 'low' if you are mostly inferring.
6. General uses, usage guidance and warnings come from standard well-established medical knowledge about that active ingredient. Keep them general and safe. NEVER give exact doses, dose changes, or personal medical advice. If the box prints dosing instructions, you may mention that the box has them and tell the user to follow their doctor or pharmacist.
7. Mention only well-known, important warnings (for example: not suitable for pregnant women, interaction with alcohol, drowsiness, stomach irritation). Do not list rare side effects. Never invent a warning.
8. Always write in simple, short, warm Modern Standard Arabic suitable for elderly people. Avoid medical jargon. If a medical term is necessary, explain it in simple words.
9. The last warning must always remind the user to ask the doctor or pharmacist if unsure.
10. Return JSON only, matching the schema. No markdown, no extra text."

JSON Schema:
```json
{
  "is_clear": boolean,
  "retake_message": string,
  "confidence": "high" | "medium" | "low",
  "evidence_text": string,
  "medicine_name_ar": string,
  "medicine_name_en": string,
  "active_ingredient": string,
  "uses": string[] (max 3 short items),
  "how_and_when": string[] (max 3 short items, e.g. before/after food, morning/evening, only if standard),
  "warnings": string[] (max 4 short items),
  "audio_summary": string (3 to 4 short sentences, spoken style, simple Arabic: name, what it is for, when to take it, and a reminder to ask the doctor)
}
```

Client-side safety checks & guardrails:
- If `is_clear` is false or the JSON is invalid, show the retake message and a big retry button. Never show partial or broken results.
- If `evidence_text` is empty, treat confidence as "low".
- If confidence is "low", do not show details; ask for a retake.
- Parse the JSON safely (strip any markdown fences) and validate all fields before rendering.

### R6. Modern Design (Keep Accessibility)
- Color Palette: Deep Teal `#006D77`, warm white `#F8F9FA`, dark text `#1D3557`, soft amber warning box (`#FEF3C7` / `#92400E`).
- Accessibility Standards: Minimum body text 20px, headings 28px+, buttons at least 64px high, strict RTL.
- Modern Aesthetics: Large rounded corners (20 to 28px), soft shadows, generous spacing, clean gradient header, big clear icons, smooth short transitions (under 250ms), skeleton loading instead of a plain spinner, press animations on buttons.
- Single-screen flow: One screen at a time, zero menus, zero sidebars, zero clutter.
- Accessibility Setting: Respect the system `prefers-reduced-motion` setting.

## Acceptance Criteria

### Automated Verification
- [ ] Automated tests for serverless handler: validates image size check, rate-limiting, and error responses.
- [ ] Automated tests for client image compression: verifies max 1024px dimension clamping and JPEG quality compression.
- [ ] Automated tests for local hash cache: verifies duplicate images resolve from cache without network calls.
- [ ] Automated tests for JSON validator and schema parser: verifies confidence thresholds, evidence_text validation, and fallback behavior.
- [ ] Automated tests for confirmation step and "أدويتي" local storage (add, list, delete with confirmation).
- [ ] Secret scan verification: automated grep confirms zero API keys or secrets exist in client source code or build output (`dist/`).
- [ ] Production build succeeds with `npm.cmd run build` with zero TypeScript or bundling errors.

### Functional Verification
- [ ] All client-side API key dialogs/inputs are eliminated; app relies exclusively on `VITE_API_URL` / serverless proxy.
- [ ] Cairo font loads 100% locally from bundled assets without network calls to Google Fonts.
- [ ] First-launch 3-point photo guide appears once and dismisses cleanly.
- [ ] Confirmation screen renders detected medicine name with "نعم، هذا دوائي" and "لا، أعد التصوير".
- [ ] "أدويتي" list persists across sessions with thumbnails and delete confirmation.
- [ ] Release APK build instructions provided and verified.
