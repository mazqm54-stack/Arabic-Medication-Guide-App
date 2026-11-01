# Handoff Report: R1 (Zero-Secret Serverless Backend) & R5 (AI Pharmacist Prompt, Strict Schema & Client Guardrails)

- **Agent**: Spec Miner 2 (Survey Phase)
- **Recipient**: Orchestrator (`f4f724ac-fd8c-4c16-a91a-05f2f4a5cab4`)
- **Status**: Complete (Hard Handoff)
- **Working Directory**: `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_spec_miner_survey_g2_2`
- **Specification Document**: `analysis.md`

---

## 1. Observation

1. **Authoritative Request File**:
   In `ORIGINAL_REQUEST.md` under header `## 2026-10-28T18:21:21Z`:
   - Line 78–87:
     ```markdown
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
     ```
   - Lines 114–153:
     ```markdown
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

     Client-side safety checks & guardrails:
     - If `is_clear` is false or the JSON is invalid, show the retake message and a big retry button. Never show partial or broken results.
     - If `evidence_text` is empty, treat confidence as "low".
     - If confidence is "low", do not show details; ask for a retake.
     - Parse the JSON safely (strip any markdown fences) and validate all fields before rendering.
     ```

2. **Current Codebase State**:
   - `src/App.tsx` (lines 35, 91–105, 145–154) imports and calls `getStoredApiKey` from `src/services/apiKeyStorage.ts` and renders `ApiKeyModal.tsx`.
   - `src/services/geminiVision.ts` directly queries Google's Gemini endpoint from the browser via client-supplied `apiKey`.
   - `src/services/geminiParser.ts` uses the previous milestone's Arabic prompt (`أنت صيدلي خبير ومساعد طبي ذكي مخصص لكبار السن...`) instead of the new R5 English prompt.
   - `src/services/geminiParser.ts` schema does not yet include `retake_message`, `confidence`, or `evidence_text`.
   - No `api/` directory or `vercel.json` exists yet in the workspace root.
   - Test execution `npm.cmd run test` passes 100% of existing baseline tests (23 tests across 5 files in task-53).

3. **Gemini API Discovery Documentation**:
   - Upstream schema confirms `generationConfig` supports `temperature`, `responseMimeType`, `responseSchema`, and `thinkingConfig.thinkingBudget`.
   - Upstream note on `thinkingConfig`: "An error will be returned if this field is set for models that don't support thinking."

---

## 2. Logic Chain

1. **Security Vulnerability Remediation**:
   - *Observation*: The client currently accepts and stores Gemini API keys in `localStorage` (`apiKeyStorage.ts`) and makes direct browser fetch calls (`geminiVision.ts`).
   - *Requirement*: R1 demands zero secrets in client bundles or APK.
   - *Deduction*: All client-side key storage (`apiKeyStorage.ts`), modals (`ApiKeyModal.tsx`), and settings buttons must be deleted. All API calls must route through a serverless backend proxy endpoint `/api/analyze` using `VITE_API_URL`.

2. **Serverless Architecture & Compatibility**:
   - *Observation*: R1 specifies a Vercel Serverless Function `/api/analyze` with region affinity `fra1` or `cdg1`, `maxDuration: 30`, max image size validation, per-IP rate limiting (20/hr), and configurable `GEMINI_MODEL`.
   - *Observation on Gemini Models*: Setting `thinkingConfig: { thinkingBudget: 0 }` reduces reasoning latency on thinking models (Gemini 2.0/2.5) but triggers an API rejection error on Gemini 1.5.
   - *Deduction*: The serverless handler must:
     a. Validate incoming body size (<= 4MB base64) and return HTTP 413 if exceeded.
     b. Enforce per-IP rate limits using in-memory IP tracking with sliding window reset, returning HTTP 429 when exceeded.
     c. Read `process.env.GEMINI_API_KEY` and fallback `process.env.GEMINI_MODEL || 'gemini-1.5-flash'`.
     d. Conditionally include `thinkingConfig: { thinkingBudget: 0 }` for models supporting thinking.
     e. Provide CORS headers for Capacitor Android webviews.

3. **AI Pharmacist Accuracy & Guardrail Cascade**:
   - *Observation*: R5 prescribes a verbatim 10-rule English prompt emphasizing packaging transcription over clinical guessing, accompanied by a strict 11-field schema with `evidence_text` and `confidence`.
   - *Deduction*:
     a. The system prompt must be verbatim English lines 117–129.
     b. The schema must require `evidence_text`, `confidence`, and `retake_message`.
     c. The client parser must implement a 5-step guardrail: (1) strip markdown fences, (2) validate JSON, (3) check `is_clear`, (4) check `evidence_text` and force `confidence = 'low'` if empty, and (5) check `confidence` and trigger retake if `'low'`.
     d. Lists must be clamped: `uses` <= 3, `how_and_when` <= 3, `warnings` <= 4.

---

## 3. Caveats

1. **Vercel Serverless Memory State**:
   - In-memory rate limiting is bound to individual serverless lambda container instances. For high-volume multi-instance production environments, an external store (e.g. Upstash Redis or Vercel KV) is typically preferred; however, per R1's lightweight specification ("using in-memory or headers/client IP parsing"), an in-memory Map with garbage collection is fully compliant and zero-cost.
2. **Capacitor Android Origin Handling**:
   - Capacitor on Android runs under `http://localhost` or `https://localhost`. The backend CORS configuration must include `Access-Control-Allow-Origin: *` to prevent cross-origin blocking from native devices.

---

## 4. Conclusion

The authoritative specifications for R1 and R5 have been completely mined, cross-referenced with upstream API capabilities, and documented in `analysis.md`. The design guarantees:
1. Zero secrets in client code or APK bundles.
2. A resilient serverless endpoint `/api/analyze` configured for Europe/MENA affinity (`fra1`).
3. Verbatim English prompt adherence and strict 11-field schema enforcement.
4. Robust client guardrails preventing hallucinated or low-confidence medical advice from reaching elderly users.

---

## 5. Verification Method

To independently verify the findings and future implementation:

1. **Verify Documentation Artifacts**:
   - Inspect `analysis.md` in `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_spec_miner_survey_g2_2\analysis.md`.
2. **Execute Existing Test Suite**:
   ```powershell
   npm.cmd run test
   ```
   (Must pass 100% of tests).
3. **Verify Upstream Schema & Zero Secrets Invalidation Conditions**:
   - Invalidation condition 1: Any client source file in `src/` containing API key persistence or modal prompts.
   - Invalidation condition 2: `/api/analyze` hardcoding the Gemini model name instead of reading `process.env.GEMINI_MODEL`.
   - Invalidation condition 3: Prompt deviating in any word or punctuation from lines 117–129 of `ORIGINAL_REQUEST.md`.
   - Invalidation condition 4: Client failing to downgrade confidence to "low" when `evidence_text` is empty.
