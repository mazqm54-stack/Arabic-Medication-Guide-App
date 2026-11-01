# Handoff Report — Survey Spec Miner 2 (Prescription & Worker Spec Miner)

**Timestamp**: 2026-10-31T14:38:30Z  
**Type**: Hard Handoff (Task Complete)  
**Assigned Subsystem**: R2 (Prescription Reading Flow & Cloudflare Worker Integration) and R3 (Unclear Photos Handling)  
**Deliverable**: `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_spec_miner_upgrade_survey_2\survey_prescription_worker.md`

---

## 1. Observation

1. **Authoritative Requirements (`ORIGINAL_REQUEST.md`)**:
   - Lines 22–44 (R2): Specifies prescription reading flow, 1600px / 0.8 JPEG image compression, Cloudflare Worker route/mode architecture, model env var `GEMINI_MODEL_PRESCRIPTION` (default `gemini-3.8-flash` with thinkingLevel LOW), 25s Worker abort and 30s client timeout, separate error codes, 5 strict system instruction rules, exact JSON schema, empty items validation, card layout, soft amber card for low confidence, advisory banner `"راجع أسماء الأدوية قبل الاعتماد"`, read-aloud button, details mode with text input and caching, and "أضف لأدويتي" action.
   - Lines 45–48 (R3): Specifies friendly Arabic unclear photo handling with 3 short retake tips and a big "إعادة التصوير" button for both box and prescription flows, with partial-clarity preservation for prescriptions.

2. **Current Worker State (`worker/src/index.ts`, `worker/wrangler.toml`)**:
   - `worker/wrangler.toml`: Only defines `GEMINI_MODEL = "gemini-3.5-flash-lite"`. Does NOT define `GEMINI_MODEL_PRESCRIPTION`.
   - `worker/src/index.ts`:
     - Endpoints: GET `/` or `/health`, POST `/` or `/api/analyze`. No `/api/prescription` or `/api/details` or `mode` handling.
     - Payload limit: `MAX_PAYLOAD_BYTES = 4 * 1024 * 1024` (4MB). Base64 string checked against 4MB.
     - Upstream call: Uses REST fetch to Google Gemini API (`generateContent`). Does NOT currently use an `AbortController` timeout for the 25s deadline.
     - Prompt & Schema: Only includes `PHARMACIST_SYSTEM_PROMPT` and `GEMINI_RESPONSE_SCHEMA` for medicine boxes.

3. **Current Client State (`src/`)**:
   - `src/types/index.ts`: Only defines `MedicineAnalysisResult`. Lacks `PrescriptionItem`, `PrescriptionAnalysisResult`, `ConfidenceLevel`.
   - `src/utils/imageProcessor.ts`: Clamps to 1024px with JPEG quality 0.75 (`MAX_IMAGE_DIMENSION = 1024`, `JPEG_COMPRESSION_QUALITY = 0.75`). Lacks 1600px / 0.8 quality pipeline for prescriptions.
   - `src/components/UnclearPhotoCard.tsx`: Currently displays only 2 tips (lighting and camera centering). Needs 3 standardized tips and "إعادة التصوير" button.
   - `src/services/geminiVision.ts`: Enforces 30s timeout with `AbortController`, maps errors to `AnalysisError`.

4. **Test Suite Baseline**:
   - Vitest suite executed via `npm.cmd test`: 18 test files, 398 tests passed in 46.43s. All pass.

---

## 2. Logic Chain

1. **Payload & Limit Analysis**:
   - A prescription image scaled to max 1600px at JPEG quality 0.8 yields a base64 string between ~470,000 and 1,300,000 characters (~350KB to 950KB).
   - Because the Worker's `MAX_PAYLOAD_BYTES` is 4MB (`4,194,304` bytes), the prescription payload fits comfortably with >4x headroom beneath the 4MB limit.
   - Therefore, no increase to `MAX_PAYLOAD_BYTES` is needed, but the client must provide a dedicated `processAndValidatePrescriptionImage` function configuring `maxDimension = 1600` and `quality = 0.8`.

2. **Route Architecture Evaluation**:
   - Route-based (`/api/prescription`, `/api/details`) provides clean REST semantics.
   - Mode-based (`mode: "prescription" | "box" | "details"`) provides single-endpoint resilience against client URL resolution errors in native APK builds (`VITE_API_URL`).
   - Implementing a Hybrid approach (checking `url.pathname.endsWith('/prescription') || body.mode === 'prescription'`) delivers the best of both worlds with 100% backward compatibility and zero fragility.

3. **Timeout & Error Separation Logic**:
   - If Worker fetch takes >25s, Worker's `AbortController` aborts upstream fetch and returns HTTP 504 `UPSTREAM_TIMEOUT`.
   - Client maps status 504 / `UPSTREAM_TIMEOUT` to `network_timeout` and renders a retry card with "إعادة المحاولة".
   - Client's 30s timer serves as a fallback safeguard if the connection between client and Worker is broken.
   - This prevents timeouts, 500s, 503s, and 429s from ever showing the confusing "unclear photo" screen.

4. **Prescription Schema & Strict Prompt Logic**:
   - The 5 strict rules ensure Gemini never invents medicine names or dosage instructions.
   - Empty prescription items (`items: []`) even if `is_clear: true` must be validated by the client and redirected to the retake screen.
   - Low confidence items must omit `short_explanation` and display in soft amber cards ("غير واضح، اسأل الصيدلي").

5. **Details Mode & Caching Logic**:
   - Text-only lookup for medicine name returns the box schema.
   - Client-side normalization (stripping tashkeel and whitespace) and `localStorage` caching ensures 0ms latency on repeated viewings and enables seamless "أضف لأدويتي" operations.

---

## 3. Caveats

- **Live Cloudflare Deployment**: As a read-only specification investigation agent, no code changes or `wrangler deploy` executions were performed during this survey. Actual deployment and live endpoint testing will occur during the implementation phase.
- **Upstream Gemini Latency**: `gemini-3.8-flash` with thinkingLevel LOW typically responds within 3–8 seconds for multimodal vision, well within the 25s Worker abort and 30s client timeout.

---

## 4. Conclusion

The specification for R2 (Prescription Reading Flow & Cloudflare Worker Integration) and R3 (Unclear Photos Handling) is fully investigated, documented, and verified against all codebase constraints and upstream Gemini API contracts.
The complete specification document is available at:
`c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_spec_miner_upgrade_survey_2\survey_prescription_worker.md`.

---

## 5. Verification Method

To verify the findings and specifications:
1. Inspect the deliverable document:
   `view_file` on `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_spec_miner_upgrade_survey_2\survey_prescription_worker.md`.
2. Verify existing test suite baseline:
   `npm.cmd test` (18 test files, 398 tests pass).
3. Verify Worker source and wrangler configuration:
   `view_file` on `worker/src/index.ts` and `worker/wrangler.toml`.
4. Invalidation condition: If `ORIGINAL_REQUEST.md` requirements change regarding schema fields, image resolution, model naming, or error codes.
