## 2026-10-31T14:54:53Z
You are Worker M1 (Cloudflare Worker Backend Upgrade).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m1_g2_1\
Your parent is: be14d828-8b13-435b-929b-e3dd3fbf5ac6

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY: Read the authoritative files before starting:
1. c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
3. c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_spec_miner_upgrade_survey_2\survey_prescription_worker.md

Exclusive Write Ownership:
You own ONLY:
- worker/src/index.ts
- worker/wrangler.toml
- tests/worker.test.ts
Do NOT modify any other files.

Task Specifications:
1. `worker/wrangler.toml`:
   In `[vars]`, set:
   ```toml
   GEMINI_MODEL = "gemini-3.5-flash-lite"
   GEMINI_MODEL_PRESCRIPTION = "gemini-3.8-flash"
   ```
2. `worker/src/index.ts`:
   - Update `Env` interface with `GEMINI_MODEL_PRESCRIPTION?: string;`.
   - Implement Hybrid routing & mode support:
     - Match: `url.pathname.endsWith('/prescription') || body.mode === 'prescription'` -> Prescription Analysis Mode.
     - Match: `url.pathname.endsWith('/details') || body.mode === 'details'` -> Medicine Details Mode.
     - Otherwise (default) -> Medicine Box Analysis Mode.
   - Model selection:
     - Never hardcode model names: read `env.GEMINI_MODEL_PRESCRIPTION || 'gemini-3.8-flash'` for prescription; `env.GEMINI_MODEL || 'gemini-3.5-flash-lite'` for box/details.
     - For `gemini-3.8-flash`: use `thinkingConfig: { thinkingLevel: 'LOW' }` and omit temperature. For flash-lite: omit `thinkingConfig`. Keep the fallback in case Gemini returns 400 with "thinking".
   - 25s AbortController:
     - Wrap upstream Gemini fetch with an AbortController with 25,000ms timeout.
     - If aborted or timeout: return HTTP 504 Gateway Timeout with:
       `{ is_clear: false, error: "UPSTREAM_TIMEOUT", error_code: "UPSTREAM_TIMEOUT", retake_message: "استغرقت عملية التحليل وقتاً أطول من المتوقع في الخادم (25 ثانية). يرجى المحاولة مرة أخرى.", upstream_status: 504, detail: "Upstream Gemini request timed out after 25 seconds" }`.
   - Prescription System Prompt & Schema:
     - Enforce the 5 strict rules from `ORIGINAL_REQUEST.md`:
       (1) Read ONLY what is actually written. NEVER guess a medicine name from partial or unclear letters. If unclear, confidence="low", name empty or exact visible letters.
       (2) If entire image is blurry, dark, cropped, or not a prescription: `is_clear=false`, `items=[]`, friendly Arabic `retake_message` (good lighting, whole paper visible, hold steady).
       (3) Copy doctor's instructions about dose/frequency/duration EXACTLY into `written_instructions`. Never invent or complete. If nothing written, leave empty string `""`.
       (4) Readable medicine: one-sentence simple Arabic explanation in `short_explanation`. Low-confidence items: short_explanation MUST be empty string `""`.
       (5) Max 10 items. Simple, warm Modern Standard Arabic for elderly. JSON only.
     - Prescription JSON Schema:
       `{ is_clear, retake_message, confidence ("high"|"medium"|"low"), evidence_text, items: [ { line_text_as_written, medicine_name_ar, medicine_name_en, active_ingredient, confidence ("high"|"medium"|"low"), written_instructions, short_explanation } ], audio_summary }`.
   - Medicine Details Mode:
     - Takes text `medicine_name` in request body (no image required).
     - Prompts Gemini to return the 4-card box schema for that medicine (`medicine_name_ar`, `medicine_name_en`, `active_ingredient`, `uses`, `how_and_when`, `usage_source`, `warnings`, `audio_summary`).
   - Box System Prompt Rule 6 & Schema Update:
     - Update Rule 6 in box prompt: allow general common usage (2–3 short items on timing and typical frequency in general words without exact doses) and set `usage_source="common"` or `"printed"`.
     - Update `GEMINI_RESPONSE_SCHEMA` to include `usage_source: { type: 'STRING', enum: ['printed', 'common'] }` in properties and required.
     - Update box prompt and fallback to include `usage_source`.
   - Payload limit: Ensure `MAX_PAYLOAD_BYTES = 4 * 1024 * 1024` accommodates 1600px / 0.8 JPEG base64 payloads safely.
3. `tests/worker.test.ts`:
   - Update tests to verify all new capabilities:
     - Prescription route and mode with valid image
     - Details mode with medicine name
     - Upstream timeout mapping to 504 and UPSTREAM_TIMEOUT
     - Prescription schema validation (rules 1-5)
     - `usage_source` field in box response
     - Rate limiter and CORS preservation
4. Verification:
   - Run tests with `npx.cmd vitest run tests/worker.test.ts`.
   - Ensure all tests pass.
   - Run `npx.cmd tsc --noEmit` to verify type cleanliness.
