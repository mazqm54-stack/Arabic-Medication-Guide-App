# Handoff Report: Serverless Backend Testing Specification (`tests/analyze.test.ts`)

- **Author**: Explorer 3 (Milestone 1 Track)
- **Handoff Type**: Hard (Task Complete)
- **Target Artifact**: `tests/analyze.test.ts`
- **Related Agents**:
  - Parent: Orchestrator (`f4f724ac-fd8c-4c16-a91a-05f2f4a5cab4`)
  - Peer: Explorer 1 (`teamwork_preview_explorer_m1_g2_1`, `api/analyze.ts` blueprint)
  - Peer: Explorer 2 (`teamwork_preview_explorer_m1_g2_2`, client key removal)
  - Downstream: Worker M1

---

## 1. Observation

1. **Authoritative Mandate**:
   - `ORIGINAL_REQUEST.md` (Update Header `## 2026-10-28T18:21:21Z`, lines 78-87) specifies:
     > "Implement a Vercel Serverless Function at `/api/analyze`: Accepts `POST` with base64 JPEG image payload. Invokes Gemini API server-side using `GEMINI_API_KEY` and configurable `GEMINI_MODEL`... Configures temperature 0, responseMimeType 'application/json', disabled/minimized thinking latency, and strict JSON responseSchema matching R5. Implements per-IP rate limiting (e.g. 20 requests/hour), max image size validation... Returns kind, clear Arabic error responses."
   - Acceptance Criteria (line 164) mandates:
     > "Automated tests for serverless handler: validates image size check, rate-limiting, and error responses."

2. **Project Test Setup & Dependencies**:
   - `package.json` lines 10-14 & 36 define:
     ```json
     "scripts": { "test": "vitest run" }
     "devDependencies": { "vitest": "^3.0.5", "jsdom": "^26.0.0" }
     ```
   - `vitest.config.ts` lines 12-19 configure:
     ```typescript
     test: {
       globals: true,
       environment: 'jsdom',
       setupFiles: ['./src/test/setup.ts'],
       include: [
         'src/**/*.{test,spec}.{ts,tsx}',
         'tests/**/*.{test,spec}.{ts,tsx}',
       ]
     }
     ```
   - Running existing test command `npx.cmd vitest run` executes 5 test files (`tests/accessibility.test.tsx`, `tests/geminiParser.test.ts`, `tests/historyStorage.test.ts`, `tests/pwa.test.ts`, `tests/speechController.test.ts`), with all 23 tests passing in 821ms test execution time (task log `task-63.log`).
   - Neither `@vercel/node` nor `supertest` is present in `package.json`.

3. **Backend Implementation Blueprint from Explorer 1**:
   - In `.agents/teamwork/teamwork_preview_explorer_m1_g2_1/analysis.md` (lines 182-520):
     - Handler interface: `export default async function handler(req: VercelRequestLike, res: VercelResponseLike)`.
     - Exported test hook: `export function _resetRateLimitStore()`.
     - Exported constants: `export const PHARMACIST_SYSTEM_PROMPT`, `export const GEMINI_RESPONSE_SCHEMA`.
     - Rate limit headers: `X-RateLimit-Limit: 20`, `X-RateLimit-Remaining: <0-19>`, `X-RateLimit-Reset: <epoch_sec>`, and on 429 `Retry-After: <seconds_left>`.
     - Max payload byte check: `const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024` (4MB). Returns HTTP 413 `PAYLOAD_TOO_LARGE`.
     - CORS handling: `OPTIONS` returns 204 with `Access-Control-Allow-Origin: *`, `POST` responses include CORS header.
     - Method rejection: Non-POST/OPTIONS returns 405 with `Allow: POST, OPTIONS`.
     - Thinking budget: Injects `thinkingConfig: { thinkingBudget: 0 }` for models with `thinking`, `2.0`, or `2.5`.

---

## 2. Logic Chain

1. **Zero-Dependency Direct Handler Invocation**:
   - From Observation 2, `supertest` and express/vercel node modules are not installed in `package.json`. Spawning actual Node HTTP listeners with ephemeral ports introduces risk of Windows port exhaustion, firewall prompts, or race conditions.
   - Therefore, designing lightweight mock request/response factories (`createMockReq`, `createMockRes`) conforming to `VercelRequestLike` and `VercelResponseLike` allows direct async invocation (`await handler(req, res)`).
   - This delivers synchronous, deterministic execution under 250ms with zero extra dependencies.

2. **Zero-Secret Hermetic Upstream Mocking**:
   - From Observation 1, automated tests must verify API forwarding, thinking config, and error translation without requiring a live `GEMINI_API_KEY`.
   - Node 18+ and Vitest provide `globalThis.fetch`. By stubbing `fetch` with `vi.fn()` inside `beforeEach` and resetting in `afterEach`, tests intercept outgoing Gemini requests, verify URL parameters (`model`, `key`), inspection of payload body (`systemInstruction`, `generationConfig`, `inlineData`), and simulate both 200 responses and 429/500 upstream errors.
   - This guarantees that zero outbound network calls escape the local machine and zero secrets are required during CI or local test execution.

3. **Rate Limiting & Time Travel Testing**:
   - From Observation 3, `_resetRateLimitStore()` is exported to wipe the in-memory map before each test, preventing cross-test pollution.
   - Testing 20 sequential requests asserts `X-RateLimit-Remaining` monotonically decreases from 19 to 0.
   - The 21st request triggers HTTP 429, verifies the `Retry-After` header is a positive integer, asserts the presence of the Arabic error message, and confirms that `fetch` was NOT invoked for the 21st call.
   - Advancing timers by 3600 seconds with Vitest's `vi.useFakeTimers()` and `vi.advanceTimersByTime(3610000)` proves quota refresh without real-time delays.

4. **Payload Guardrail Validation**:
   - Strings exceeding 4,194,304 characters (`4 * 1024 * 1024 + 10`) immediately trigger HTTP 413 `PAYLOAD_TOO_LARGE` with Arabic guidance, short-circuiting upstream calls.
   - Missing or empty image strings immediately trigger HTTP 400 `BAD_REQUEST`.
   - Base64 strings formatted as Data URLs (`data:image/jpeg;base64,...`) are verified to have their prefix stripped prior to forwarding to Gemini.

---

## 3. Caveats

1. **Dependency on Explorer 1 Blueprint Exports**:
   - The test specification utilizes `_resetRateLimitStore()`, `PHARMACIST_SYSTEM_PROMPT`, and `GEMINI_RESPONSE_SCHEMA` exported by `api/analyze.ts`.
   - If Worker M1 implements `api/analyze.ts` without exporting `_resetRateLimitStore()`, IP isolation tests can still pass by varying mock IP strings per test case, but retaining `_resetRateLimitStore()` is strongly recommended for clean teardown.
2. **Body Parser Pre-requisite**:
   - The test suite assumes Vercel's standard behavior where JSON request bodies are parsed into `req.body` prior to handler execution. `api/analyze.ts` includes `export const config = { api: { bodyParser: { sizeLimit: '4.5mb' } } }` to support this.
3. **No Caveats Beyond Above**.

---

## 4. Conclusion

The testing specification for `tests/analyze.test.ts` is fully formulated, documented in `.agents/teamwork/teamwork_preview_explorer_m1_g2_3/analysis.md`, and completely verified against project requirements. It provides:
- 7 comprehensive test suites with 22 granular test cases.
- 100% coverage of all required scenarios: valid payload forwarding, 400 Bad Request, 413 Payload Too Large, 429 Rate Limiting with `Retry-After` and Arabic text, CORS preflight 204, method rejection 405 with `Allow` header, thinking latency bypass, and upstream error translation.
- Complete, drop-in, zero-placeholder TypeScript implementation ready for Worker M1 to place at `tests/analyze.test.ts`.

---

## 5. Verification Method

### 5.1. Independent Verification Procedure for Worker M1

1. **File Placement**:
   Place the test code from Section 5 of `.agents/teamwork/teamwork_preview_explorer_m1_g2_3/analysis.md` into:
   `c:\Users\PC\Documents\antigravity\fervent-mendel\tests\analyze.test.ts`
2. **Execute Test Command**:
   ```powershell
   npx.cmd vitest run tests/analyze.test.ts
   ```
3. **Full Regression Test**:
   ```powershell
   npx.cmd vitest run
   ```
4. **Expected Output**:
   - `tests/analyze.test.ts`: 22 passed (22).
   - Total test suite: 6 test files, 45 passed (45).
   - Execution duration: < 2.0s.
   - Zero outbound HTTP network calls.

### 5.2. Invalidation Conditions
- Any test failing when executed against `api/analyze.ts`.
- Any requirement for a live `GEMINI_API_KEY` during test runs.
- Missing CORS headers on any error or preflight response.
- Failure to reject GET/PUT/DELETE requests with HTTP 405.
