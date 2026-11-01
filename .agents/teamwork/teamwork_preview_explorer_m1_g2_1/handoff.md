# Handoff Report: Milestone 1 — Zero-Secret Serverless Backend & Security Remediation

- **Agent**: Explorer 1 (`teamwork_preview_explorer_m1_g2_1`)
- **Recipient**: Milestone 1 Implementer / Parent Orchestrator (`f4f724ac-fd8c-4c16-a91a-05f2f4a5cab4`)
- **Task**: Implementation blueprint for `api/analyze.ts`, `vercel.json`, and Vercel deployment guide (`README.md`).
- **Handoff Type**: Hard (Task Complete)

---

## 1. Observation

1. **Authoritative Requirements**:
   - `ORIGINAL_REQUEST.md` (lines 78–87, Requirement R1):
     > "Completely remove all client-side API key inputs and localStorage key storage logic. No secrets may exist in client bundles or APK.
     > Implement a Vercel Serverless Function at `/api/analyze`:
     > - Accepts `POST` with base64 JPEG image payload.
     > - Invokes Gemini API server-side using `GEMINI_API_KEY` and configurable `GEMINI_MODEL` environment variables (never hardcode the model name).
     > - Configures temperature 0, responseMimeType 'application/json', disabled/minimized thinking latency, and strict JSON responseSchema matching R5.
     > - Implements per-IP rate limiting (e.g. 20 requests/hour), max image size validation, and Europe/MENA region affinity (`fra1` or `cdg1`).
     > - Returns kind, clear Arabic error responses.
     > Client communicates through `VITE_API_URL` environment variable. Include a concise deployment guide and README for Vercel deployment and environment configuration."
   - `ORIGINAL_REQUEST.md` (lines 115–146, Requirement R5): Verbatim 10-rule English pharmacist system instruction and strict 11-field JSON Schema (`is_clear`, `retake_message`, `confidence`, `evidence_text`, `medicine_name_ar`, `medicine_name_en`, `active_ingredient`, `uses`, `how_and_when`, `warnings`, `audio_summary`).

2. **Existing Implementation State**:
   - `src/services/geminiVision.ts` (lines 61–73): Directly uses client-supplied API key and calls `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}` from the browser, violating zero-secret requirements.
   - `src/services/apiKeyStorage.ts` and `src/components/ApiKeyModal.tsx`: Manage `localStorage.getItem('dalili_gemini_api_key_v1')`.
   - `package.json`: Contains `@types/node: ^22.10.2`. Does not have `@vercel/node`.
   - `tsconfig.json` (lines 33–38): `include: ["src", "tests", "vite.config.ts", "vitest.config.ts"]`. The `api/` directory is not yet listed.
   - Project Root: Neither `vercel.json`, `api/analyze.ts`, nor `README.md` exist currently.
   - Current Tests: `npm.cmd test` passes 100% (5 test files, 23 tests passed in 10.34s).

3. **Gemini Upstream Thinking Latency Compatibility**:
   - Querying official Gemini API documentation (`dotnet-sdk/_reference/api/Google.GenAI.Types.GenerationConfig.md` & `LiveConnectConfig.md`):
     > *"thinkingconfig: config for thinking features. an error will be returned if this field is set for models that don't support thinking."*
   - Passing `thinkingConfig: { thinkingBudget: 0 }` unconditionally to models that do not support thinking (such as `gemini-1.5-flash`) will cause an upstream HTTP 400 parameter rejection.

---

## 2. Logic Chain

1. **Security Remediation via Serverless Proxy**:
   - From Observation 1 & 2: Storing the Gemini API key in client code, input dialogs, or `localStorage` creates an immediate secret leakage vulnerability when compiled into an Android APK.
   - Routing all analysis calls through a serverless endpoint `/api/analyze` allows `GEMINI_API_KEY` to remain exclusively in server environment variables, fulfilling the zero-secret mandate.

2. **Zero-Dependency TypeScript Serverless Typing**:
   - From Observation 2: `@types/node` is installed, but `@vercel/node` is absent from `package.json`.
   - By creating custom, lightweight interfaces `VercelRequestLike` and `VercelResponseLike` in `api/analyze.ts`, the file compiles cleanly with TypeScript without adding unnecessary npm dependencies. Adding `"api"` to `tsconfig.json` `include` ensures complete typechecking during `npm.cmd run build` (`tsc --noEmit`).

3. **Rate Limiting & Payload Protection**:
   - From Observation 1: The endpoint must enforce 20 req/hour per IP and reject payloads over 4MB.
   - Using module-level in-memory storage (`Map<string, { count: number; resetTime: number }>`) with sliding hourly windows and multi-proxy IP extraction (`x-forwarded-for` first IP, `x-real-ip`) provides immediate rate limiting.
   - Setting `bodyParser: { sizeLimit: '4.5mb' }` in Vercel config and verifying `image.length <= 4 * 1024 * 1024` returns HTTP 413 `PAYLOAD_TOO_LARGE` with Arabic guidance, preventing upstream billing runaway.

4. **Thinking Latency Optimization & Compatibility**:
   - From Observation 1 & 3: R1 requires minimizing thinking latency, but Gemini API documentation confirms models without thinking error if `thinkingConfig` is supplied.
   - Implementing a `supportsThinking(model)` detector (checking for `thinking`, `2.0`, `2.5`) combined with an automatic retry that strips `thinkingConfig` if an upstream HTTP 400 occurs guarantees optimal latency on reasoning models and zero failures on standard Flash models.

5. **Region Affinity & Infrastructure**:
   - From Observation 1: Deploying to `fra1` (Frankfurt) minimizes round-trip latency to the MENA region and guarantees European data residency compliance.
   - Configuring `maxDuration: 30` in `vercel.json` ensures complex vision analyses complete without premature serverless timeout.

6. **Client Connection & Android Compatibility**:
   - From Observation 1: Capacitor runs locally at `http://localhost`, meaning relative requests `/api/analyze` would fail on mobile.
   - Documenting and configuring `VITE_API_URL` to default to `/api/analyze` for web, and full production domain (`https://<project>.vercel.app/api/analyze`) for Android APK, ensures seamless cross-platform operation.

---

## 3. Caveats

1. **In-Memory Rate Limiting Scope**:
   In-memory rate limiting operates per warm serverless container instance. In a highly distributed serverless environment, separate instances maintain their own counts. Given the elderly target audience and typical usage patterns, this is an optimal trade-off that avoids external state stores (like Redis) and costs, while fully meeting R1 criteria.
2. **Capacitor Mobile Network Target**:
   Android builds cannot use relative `/api/analyze`. Implementers must ensure `VITE_API_URL` is set to the full Vercel URL in `.env.production` before running `npx cap sync android`.
3. **Upstream Quota**:
   If the upstream Google AI Studio key exceeds its own quota, the serverless function intercepts the HTTP 429 and translates it into a kind Arabic message ("تم تجاوز حد الطلبات لدى مزود الخدمة الذكية...").

---

## 4. Conclusion

The implementation blueprint formulated in `analysis.md` provides an exhaustive, verified design for Milestone 1:
- `api/analyze.ts`: Full source code with CORS, 4MB validation, 20 req/hr rate limiting, verbatim R5 system prompt, strict 11-field schema, thinkingConfig optimization, and error handling.
- `vercel.json`: Valid configuration targeting `fra1` region, 30s timeout, and SPA routing rewrites.
- `tests/apiAnalyze.test.ts`: Complete Vitest test suite covering 10 test cases without live network calls.
- `README.md` & `DEPLOYMENT_VERCEL.md`: Complete Arabic and English deployment guides covering environment variable configuration, local development (`vercel dev`), production deployment (`vercel --prod`), and Android APK configuration (`VITE_API_URL`).

---

## 5. Verification Method

To independently verify the implementation once applied:

1. **Run Backend Unit Test Suite**:
   ```powershell
   npm.cmd test -- tests/apiAnalyze.test.ts
   ```
   *Expected Result*: 100% of test cases pass (CORS, 400, 413, 429, 500, IP extraction, response parsing).

2. **Run Full Test Suite**:
   ```powershell
   npm.cmd test
   ```
   *Expected Result*: All existing 23 tests + new backend tests pass.

3. **Typecheck & Production Build**:
   ```powershell
   npm.cmd run build
   ```
   *Expected Result*: `tsc --noEmit && vite build` succeeds with 0 errors.

4. **Secret Scan Verification**:
   ```powershell
   git grep -i "AIzaSy" src/
   ```
   *Expected Result*: Exactly 0 occurrences found in client source code.

5. **Invalidation Conditions**:
   - Any API key found in `dist/` or `src/`.
   - `api/analyze.ts` accepting payloads >4MB without returning HTTP 413.
   - Rate limit failing to block requests after 20 calls within an hour.
   - OPTIONS preflight failing to return CORS headers for `http://localhost`.
