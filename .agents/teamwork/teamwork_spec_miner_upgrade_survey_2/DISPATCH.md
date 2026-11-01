## 2026-10-31T14:28:24Z
[Message] timestamp=2026-10-31T14:28:24Z sender=be14d828-8b13-435b-929b-e3dd3fbf5ac6 priority=MESSAGE_PRIORITY_HIGH content=You are Survey Spec Miner 2 (Prescription & Worker Spec Miner).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_spec_miner_upgrade_survey_2\
Your parent is: be14d828-8b13-435b-929b-e3dd3fbf5ac6

MANDATORY: Read the authoritative request file at:
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md before starting.

You are a read-only specification investigation agent. Do NOT modify application code.

Your Mission:
Survey R2 (Prescription Reading Flow & Cloudflare Worker Integration) and R3 (Unclear Photos Handling):
1. Inspect current Cloudflare Worker implementation in `worker/src/index.ts`, `worker/wrangler.toml`, and related types/tests:
   - Check current endpoints, request/response formats, size limits, error handling, Gemini SDK/REST calls.
   - Evaluate API route architecture: adding `/api/prescription` vs `mode: "prescription" | "box" | "details"`.
   - Inspect model configuration: env var `GEMINI_MODEL_PRESCRIPTION` (default `gemini-3.8-flash` with thinkingLevel LOW), keeping `GEMINI_MODEL` for medicine boxes. No hardcoding.
   - Investigate 25s abort in Worker, 30s timeout in client, and separate error codes.
2. Mine the exact system instruction rules and JSON schema for prescription analysis:
   - Schema: `{ is_clear, retake_message, confidence, evidence_text, items: [ { line_text_as_written, medicine_name_ar, medicine_name_en, active_ingredient, confidence ("high"|"medium"|"low"), written_instructions, short_explanation } ], audio_summary }`.
   - 5 strict rules:
     (1) Read only what is written, NEVER guess medicine name. Unclear -> low confidence, name empty or as visible.
     (2) If whole image blurry/dark/cropped/not prescription -> `is_clear=false` with friendly Arabic `retake_message`.
     (3) Copy doctor's dose/frequency/duration EXACTLY into `written_instructions`. Never invent or complete.
     (4) Readable medicine -> one-sentence simple Arabic explanation of general use. Low-confidence -> NO explanation.
     (5) Max 10 items. Simple, warm Modern Standard Arabic for elderly. JSON only.
3. Mine Client Prescription Flow requirements:
   - "الروشتة" tab: "صوّر الروشتة" (camera) + gallery button.
   - Image compression: max 1600px longest side, JPEG quality 0.8 (compared to 1024px / 0.7 for box).
   - Client validation: if items empty -> retake screen.
   - Card layout: large name, one-line purpose, "ما كتبه الطبيب" with written_instructions, confidence badge.
   - Low confidence items: soft amber card "غير واضح، اسأل الصيدلي" with no AI explanation.
   - Advisory banner: "راجع أسماء الأدوية قبل الاعتماد".
   - Read-aloud button for whole prescription and permanent disclaimer.
   - Tapping card opens "تفاصيل الدواء" page with 4 cards as box result.
   - Worker mode "details": text input of medicine name, returns box schema. Client-side caching by name. "أضف لأدويتي" action.
4. Mine R3 Unclear Photos Handling:
   - Both box and prescription flows: friendly Arabic message with 3 short retake tips and big "إعادة التصوير" button.
   - Partial unclear: readable ones shown, unclear ones low-confidence.

Deliver your detailed findings, verified evidence chains, and specification extraction to:
`c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_spec_miner_upgrade_survey_2\survey_prescription_worker.md`
Also create `handoff.md` and keep `progress.md` updated with timestamps.
Send a message back to parent when completed.
