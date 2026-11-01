# Project: دليلي الدوائي (Dalili Medication Guide) — Production Upgrade

## Architecture
- **Client Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite, Vitest.
- **Mobile Native Runtime**: Capacitor 6.1.2 (`@capacitor/camera@6.1.2`, `@capacitor/android`, `@capacitor/cli`), Android Gradle build with custom intent queries and release signing script.
- **Backend Edge Computing**: Cloudflare Worker running on edge runtime, integrated with Google Gemini API (`generateContent` with `thinkingConfig: { thinkingLevel: 'LOW' }`).
- **Data Flow**:
  1. *Medicine Box Capture*: Native Camera (Rear, Base64) → 1024px/0.7 JPEG compression → Worker (`/api/analyze` or `mode: "box"`) → Gemini 3.5 Flash Lite → 4-Card Structured Analysis Result.
  2. *Prescription Capture*: Native Camera / Gallery → 1600px/0.8 JPEG compression → Worker (`/api/prescription` or `mode: "prescription"`) → Gemini 3.8 Flash → Multi-Item Prescription Schema → Retake screen (if empty) or Multi-Card Prescription View with Low-Confidence Badging.
  3. *Medicine Details*: Tapping Prescription Card / Search → Worker (`/api/details` or `mode: "details"`, text only) → 4-Card Box Schema → Client LocalStorage Cache.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Camera Crash Fix Preservation | Maintain `@capacitor/camera@6.1.2` and AndroidManifest `<queries>` for `IMAGE_CAPTURE`, `GET_CONTENT`, `PICK` | M1 / M3 | R1, survey |
| F02 | Secret Zero-Leak Guarantee | Zero API keys or secrets in client code or git repository | M1 / M5 | R1, R5 |
| F03 | Fixed Bottom Navigation Bar | Fixed bar in strict RTL order: الرئيسية, أدويتي, [CENTER CAMERA BUTTON], الروشتة, السجل | M3 | R1 |
| F04 | Center Raised Camera Button | 72–80px raised circular teal button (#006D77), white camera icon, label "صوّر", calling native rear camera immediately | M3 | R1 |
| F05 | Native Tab Ergonomics | Touch targets >= 64px, icons >= 28px, labels >= 16px, rounded pill active indicator, light haptic feedback | M3 | R1 |
| F06 | Native Mobile Feel Styling | `user-select: none`, `-webkit-tap-highlight-color: transparent`, `overscroll-behavior: none`, transitions < 250ms, teal status bar, body text >= 20px, high contrast, safe-area insets | M3 | R1 |
| F07 | Home Screen Redesign | Short friendly greeting, 2 big cards ("صوّر علبة دواء", "صوّر روشتة"), uncluttered recent scans | M3 | R1 |
| F08 | Medical Disclaimer Persistence | Medical disclaimer banner visible on all scan result and prescription screens | M3 / M4 | R1 |
| F09 | Prescription Camera & Gallery Flow | "الروشتة" tab with "صوّر الروشتة" (camera) and gallery picker | M4 | R2 |
| F10 | Prescription High-Res Compression | Compress prescription photos to max 1600px longest side, JPEG quality 0.8 (while preserving 1024px / 0.7 for box photos) | M2 | R2 |
| F11 | Cloudflare Worker Prescription Route/Mode | Support `/api/prescription` and `mode: "prescription"` with strict 5-rule system prompt and JSON schema | M1 | R2 |
| F12 | Model Configuration Environment Variables | Add `GEMINI_MODEL_PRESCRIPTION` (default `gemini-3.8-flash` with thinkingLevel LOW), keep `GEMINI_MODEL` for box mode, no hardcoding | M1 | R2 |
| F13 | Worker 25s Abort & Client 30s Timeout | Enforce 25s AbortController in Worker returning HTTP 504 `UPSTREAM_TIMEOUT`, client 30s timeout, separate error codes | M1 / M2 | R2 |
| F14 | Prescription Schema Validation & Empty Items Routing | Validate prescription JSON; if items array is empty, route to retake screen | M2 / M4 | R2 |
| F15 | Prescription Card Layout | One big card per readable medicine: name (large), one-sentence purpose, "ما كتبه الطبيب" box with `written_instructions`, confidence badge | M4 | R2 |
| F16 | Low-Confidence Amber Card Presentation | Low-confidence items rendered in soft amber card: "غير واضح، اسأل الصيدلي" with no AI explanation | M4 | R2 |
| F17 | Advisory Banner & Prescription Read-Aloud | Advisory banner "راجع أسماء الأدوية قبل الاعتماد" and read-aloud button for whole prescription | M4 | R2 |
| F18 | Medicine Details Mode & Client Caching | Worker mode "details" (text input of medicine name returning box schema), client caching by medicine name, and "أضف لأدويتي" action | M1 / M2 / M4 | R2 |
| F19 | Unclear Photo Guidance | Friendly Arabic message with 3 short retake tips (lighting, framing, steadiness) and large "إعادة التصوير" button for both flows | M4 | R3 |
| F20 | Partial Prescription Clarity Preservation | Legible prescription lines rendered with standard cards, unclear lines marked low confidence | M4 | R3 |
| F21 | Medication Usage Non-Empty Guarantee | `how_and_when` never empty and never generic "follow doctor"; provides 2–3 short items on common active ingredient usage | M1 / M2 / M4 | R4 |
| F22 | Usage Source Badging | Differentiate `usage_source` ("printed" vs "common"), with labels "مكتوب على العلبة" / "مكتوب في الروشتة" / "الاستخدام الشائع" | M1 / M2 / M4 | R4 |
| F23 | Hardcoded Arabic Disclaimer Line | Immediate fixed Arabic disclaimer line under usage card: "هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي." | M4 | R4 |
| F24 | Worker Box System Instruction Rule 6 Update | Update Rule 6 in worker box prompt to allow general common usage while forbidding exact doses and personal medical advice | M1 | R4 |
| F25 | Android Versioning Increment | Increment `versionCode` (to 2) and `versionName` (to "1.1") in `android/app/build.gradle` | M5 | R5 |
| F26 | Release Signing Automation & Version Reminder | Update `sign-release.bat` to remind developer to increment versions on each release for clean APK upgrades | M5 | R5 |
| F27 | Vitest Test Suite Expansion | Full test coverage for bottom nav, prescription validator, details mode & cache, usage never empty, fixed disclaimer line, and secret scan | M5 / Test Track | R5 |
| F28 | Live Cloudflare Worker Deployment & Verification | Deploy Worker with `npx.cmd wrangler deploy`, test live endpoints with real sample images, record real status codes and latency | M5 | R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Cloudflare Worker Backend Upgrade | Prescription endpoint/mode, `GEMINI_MODEL_PRESCRIPTION`, 25s abort, details mode, Box Rule 6 update | none | DONE |
| M2 | Client Data Layer, Types, Compression & Services | Types update (`usage_source`, prescription schema), 1600px/0.8 JPEG compression, 30s timeout, details cache | M1 | DONE |
| M3 | Native App Shell, RTL Bottom Navigation & Home Screen | Fixed bottom nav bar, 72-80px teal camera button, native mobile styling, uncluttered Home screen | M1, M2 | DONE |
| M4 | Prescription UI Flow, Unclear Guidance & Usage Card | Prescription tab & cards, low-confidence amber cards, details modal, 3 retake tips, Card 3 usage & disclaimer | M2, M3 | DONE |
| M5 | Android Versioning, Release Signing, Tests & Live Deploy | `build.gradle` version bump, `sign-release.bat`, Vitest suite pass 100%, `wrangler deploy`, live test report | M1, M2, M3, M4 | DONE |
| M-Final | Dual Track E2E Test Suite Pass & Adversarial Hardening | Pass 100% of E2E tests (Tiers 1-4) published in `TEST_READY.md`, Tier 5 adversarial coverage hardening | M1–M5, Test Track | PLANNED |

## Interface Contracts

### Client ↔ Worker Backend Contract
- **POST `/api/analyze` or `/api/prescription`**:
  - Request Headers: `Content-Type: application/json`
  - Request Body:
    ```json
    {
      "image": "<base64-jpeg-string>",
      "mode": "prescription" | "box" | "details",
      "medicine_name": "<string-for-details-mode-only>"
    }
    ```
  - Response (Prescription Mode):
    ```json
    {
      "is_clear": true | false,
      "retake_message": "<arabic-string>",
      "confidence": "high" | "medium" | "low",
      "evidence_text": "<string>",
      "items": [
        {
          "line_text_as_written": "<string>",
          "medicine_name_ar": "<string>",
          "medicine_name_en": "<string>",
          "active_ingredient": "<string>",
          "confidence": "high" | "medium" | "low",
          "written_instructions": "<string>",
          "short_explanation": "<string>"
        }
      ],
      "audio_summary": "<string>"
    }
    ```
  - Response (Box & Details Mode):
    ```json
    {
      "is_clear": true,
      "retake_message": "",
      "confidence": "high",
      "evidence_text": "",
      "medicine_name_ar": "<string>",
      "medicine_name_en": "<string>",
      "active_ingredient": "<string>",
      "uses": ["<string>"],
      "how_and_when": ["<string>"],
      "usage_source": "printed" | "common",
      "warnings": ["<string>"],
      "audio_summary": "<string>"
    }
    ```
  - Timeout & Error Response:
    ```json
    {
      "is_clear": false,
      "error": "UPSTREAM_TIMEOUT" | "UPSTREAM_API_ERROR" | "RATE_LIMIT_EXCEEDED" | "PAYLOAD_TOO_LARGE",
      "error_code": "UPSTREAM_TIMEOUT",
      "retake_message": "<friendly-arabic-error-message>",
      "detail": "<non-sensitive-error-summary>"
    }
    ```

## Code Layout
- `worker/src/index.ts`: Cloudflare Worker API router, Gemini API caller, system prompts, schemas, abort controller.
- `worker/wrangler.toml`: Cloudflare Worker configuration, environment variables (`GEMINI_MODEL`, `GEMINI_MODEL_PRESCRIPTION`).
- `src/types/index.ts`: TypeScript contracts for box results, prescription results, navigation tabs, error categories.
- `src/utils/imageProcessor.ts`: Dual-mode image compression (1024px/0.7 for box, 1600px/0.8 for prescription).
- `src/services/nativeCamera.ts`: Native `@capacitor/camera@6.1.2` integration (rear camera, gallery picker, permissions).
- `src/services/geminiVision.ts`: Client API caller, 30s timeout handler, error classification.
- `src/services/geminiParser.ts`: JSON normalization, prescription validation, `how_and_when` safe default fallback.
- `src/services/detailsCache.ts`: Client-side cache for medicine details by name.
- `src/components/BottomNavBar.tsx`: Fixed 5-tab RTL bottom navigation bar with raised 76px center camera button.
- `src/components/HomeScreen.tsx`: Home tab view (greeting, 2 big cards, recent scans).
- `src/components/PrescriptionFlow.tsx`: Prescription tab view (camera/gallery triggers, processing state).
- `src/components/PrescriptionResultView.tsx`: Prescription multi-item card list, low-confidence amber cards, read-aloud button.
- `src/components/MedicineDetailsModal.tsx`: Medicine detail view (4 cards) backed by details mode & cache.
- `src/components/ResultCards.tsx`: 4-card medicine box view with `usage_source` badge and hardcoded Arabic disclaimer string.
- `src/components/UnclearPhotoCard.tsx`: Unified unclear photo guidance (3 tips, retry button).
- `src/App.tsx`: Tab state management, route switching, native mobile shell, safe area insets.
- `src/index.css`: Native app CSS rules (`user-select: none`, `-webkit-tap-highlight-color: transparent`, `overscroll-behavior: none`).
- `android/app/build.gradle`: Android versionCode (2) and versionName ("1.1").
- `sign-release.bat`: Windows release APK signing script with version check/reminder.
- `tests/`: Vitest test suites.
