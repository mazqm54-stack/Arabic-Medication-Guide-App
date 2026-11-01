# Dispatch — M3 Explorer (Milestone 3: Client Diagnostics, Timeout, Compression & Tests)

You are the Explorer for Milestone 3: Client Error Handling, Timeout, Image Compression & Verification (Requirement R2).
Your working directory is: `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m3_1`

## References to read:
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\orchestrator\SCOPE.md`
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_survey_2\survey_client_diagnostics.md`
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_survey_2\handoff.md`

## Your Mission:
Investigate and produce an actionable implementation plan for Worker M3 covering:
1. `src/utils/imageProcessor.ts`:
   - Canvas-based image compression: clamp dimensions to max 1024px while preserving aspect ratio.
   - Compress to JPEG quality 0.75.
   - Fill solid white `#FFFFFF` backdrop to avoid Android WebView black transparency artifacts.
   - Output validation:
     * Valid JPEG header check (starts with `/9j/` in base64, or magic bytes `0xFF, 0xD8, 0xFF`).
     * Non-zero length check (length > 500 chars).
     * 10x10 pixel grid sample to reject completely blank or pitch-black captures.
2. `src/services/geminiVision.ts`:
   - Add 30-second `AbortController` timeout throwing typed `CLIENT_TIMEOUT`.
   - Pass Worker debug `error_code`, `status`, and `detail` in structured errors.
3. 4 Distinct Friendly Arabic Error States in `src/App.tsx`, `src/services/geminiParser.ts`, `src/components/UnclearPhotoCard.tsx`:
   - (a) Network or timeout (`تعذر الاتصال بالشبكة أو انتهت مهلة الطلب`) with interactive retry button.
   - (b) Server error (`حدث خطأ في الخادم الطبي الذكي`) with debug badge showing Worker `error_code`.
   - (c) AI `is_clear=false` (`الصورة غير واضحة بما يكفي`) with lighting/focus tips.
   - (d) Invalid JSON (`تعذر قراءة رد المعالج الذكي`) with retry button.
   - Interactive retry: In `App.tsx`, preserve the current image file/base64 in state so clicking "إعادة المحاولة" re-runs analysis without forcing the user to take a new photo.
4. Test & Build Strategy:
   - Identify tests needed in `tests/` to verify all 4 error states, 30s timeout, interactive retry, and image compression guardrails.
   - Verify `sign-release.bat` instructions.
5. Write your report in `m3_client_plan.md` and complete `handoff.md`.
6. Send completion message to orchestrator (`8a80a925-17f2-4fac-a86b-d712a51f21a6`).

## 2026-10-29T19:03:00Z
You are the Explorer for Milestone 3: Client Error Handling, Timeout, Image Compression & Verification (Requirement R2).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m3_1

MANDATORY: Read c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md before beginning.
Also read:
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m3_1\DISPATCH.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\orchestrator\SCOPE.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_survey_2\survey_client_diagnostics.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_survey_2\handoff.md

Your tasks:
1. Inspect current codebase state for:
   - `src/utils/imageProcessor.ts`
   - `src/services/geminiVision.ts`
   - `src/services/geminiParser.ts`
   - `src/App.tsx`
   - `src/components/UnclearPhotoCard.tsx`
   - `tests/geminiParser.test.ts`, `tests/analyze.test.ts`, `tests/geminiVision.challenge.test.ts`
2. Formulate a precise, step-by-step implementation plan for Worker M3:
   - Image compression with 1024px clamping, JPEG 0.75, white background, `/9j/` JPEG header validation, length check, and blank/black pixel grid detection.
   - 30-second `AbortController` timeout throwing `CLIENT_TIMEOUT`.
   - 4 distinct friendly Arabic error states in UI with interactive retry button that re-analyzes without re-taking photos.
   - Retaining Worker debug `error_code` badge in server errors.
   - Test suite updates and additions.
3. Write your report in `m3_client_plan.md` and complete `handoff.md`.
4. Send a message to orchestrator (conversation ID: 8a80a925-17f2-4fac-a86b-d712a51f21a6).
