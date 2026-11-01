# Dispatch — Worker M3 (Milestone 3: Client Diagnostics, Timeout, Image Compression & Verification)

You are Worker M3 for Milestone 3: Client Error Handling, Timeout, Image Compression & Verification (Requirement R2).
Your working directory is: `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m3_1`

## Exclusive Write Ownership:
- `src/types/index.ts`
- `src/utils/imageProcessor.ts`
- `src/services/geminiVision.ts`
- `src/services/geminiParser.ts`
- `src/components/UnclearPhotoCard.tsx`
- `src/App.tsx`
- `src/test/setup.ts`
- `tests/imageProcessor.test.ts`
- `tests/errorStates.test.tsx`

## MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## References to read before starting:
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\orchestrator\SCOPE.md`
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m3_1\m3_client_plan.md`
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m3_1\handoff.md`

## Your Implementation Tasks:
1. **Update `src/types/index.ts`**:
   - Define `ErrorCategory = 'network_timeout' | 'server_error' | 'unclear_image' | 'invalid_json'`
   - Add optional `error_category`, `error_code`, `error_detail` to `MedicineAnalysisResult`.
2. **Implement `src/utils/imageProcessor.ts`**:
   - Clamp max dimension to 1024px while preserving aspect ratio.
   - Compress to JPEG quality 0.75 via canvas.
   - Fill solid white `#FFFFFF` backdrop before drawing to eliminate Android WebView black transparency artifacts.
   - Output validation:
     * Valid JPEG header check (`/9j/` prefix in base64 / `0xFF, 0xD8, 0xFF` magic bytes).
     * Non-zero length check (length > 500 chars).
     * 10x10 pixel grid sample to detect and reject completely blank/pitch-black frames with descriptive error.
3. **Update `src/services/geminiVision.ts`**:
   - Add 30-second `AbortController` timeout throwing typed `CLIENT_TIMEOUT`.
   - Propagate Worker debug fields (`error_code`, `status`, `detail`).
   - Create `AnalysisError` class that preserves backwards-compatible string messages for existing challenge tests.
4. **Update `src/services/geminiParser.ts`**:
   - When JSON parsing fails, set `error_category: 'invalid_json'`, `error_code: 'INVALID_JSON'`, while preserving the `'الصورة غير واضحة'` substring in `raw_error` to maintain 100% test compatibility.
5. **Update `src/components/UnclearPhotoCard.tsx` & `src/App.tsx`**:
   - Render 4 distinct friendly Arabic error states:
     (a) Network or timeout: `تعذر الاتصال بالشبكة أو انتهت مهلة الطلب` with interactive retry button.
     (b) Server error: `حدث خطأ في الخادم الطبي الذكي` with debug badge showing Worker `error_code`.
     (c) AI `is_clear=false`: `الصورة غير واضحة بما يكفي` with lighting/focus tips and retake button.
     (d) Invalid JSON: `تعذر قراءة رد المعالج الذكي` with interactive retry button.
   - Interactive retry: In `App.tsx`, preserve the current image file/base64 in state (`lastFile`) so clicking "إعادة المحاولة" re-runs analysis without forcing the user to take a new photo.
6. **Update Test Setup & Author Tests**:
   - In `src/test/setup.ts`, add canvas 2D context mock (`getContext('2d')`) and `toDataURL` mock so jsdom can run canvas operations cleanly.
   - Create `tests/imageProcessor.test.ts` testing dimensions, white fill, JPEG header, length check, blank/black detection, and memory cleanup.
   - Create `tests/errorStates.test.tsx` verifying all 4 distinct UI error states, debug badge, and interactive retry without photo retake.
   - Run full test suite: `npm.cmd test` and ensure ALL tests pass.
   - Run production build: `npm.cmd run build` and ensure TypeScript and Vite build complete cleanly.
7. **Write Reports**:
   - Write your implementation report in `m3_worker_implementation.md` and complete `handoff.md`.
   - Send completion message to orchestrator (`8a80a925-17f2-4fac-a86b-d712a51f21a6`).


## 2026-10-29T19:13:48Z
You are Worker M3 for Milestone 3: Client Error Handling, Timeout, Image Compression & Verification (Requirement R2).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m3_1

Exclusive Write Ownership:
- src/types/index.ts
- src/utils/imageProcessor.ts
- src/services/geminiVision.ts
- src/services/geminiParser.ts
- src/components/UnclearPhotoCard.tsx
- src/App.tsx
- src/test/setup.ts
- tests/imageProcessor.test.ts
- tests/errorStates.test.tsx
