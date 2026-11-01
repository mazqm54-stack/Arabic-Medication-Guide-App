# Dispatch: Survey Spec Miner 2 (Serverless Backend & AI Pharmacist Spec)

- Role: Serverless Backend & AI Pharmacist Spec Miner
- Target: Extract comprehensive requirements for R1 (Vercel Serverless Backend /api/analyze) and R5 (Exact AI Pharmacist prompt, JSON schema, client guardrails).
- Working Directory: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_spec_miner_survey_g2_2
- Source of truth: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md (header ## 2026-10-28T18:21:21Z)
## 2026-10-28T18:37:34Z
[Message] timestamp=2026-10-28T18:37:34Z sender=f4f724ac-fd8c-4c16-a91a-05f2f4a5cab4 priority=MESSAGE_PRIORITY_HIGH content=You are Spec Miner 2 for the Survey Phase.
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_spec_miner_survey_g2_2
The project root is: c:\Users\PC\Documents\antigravity\fervent-mendel
Authoritative request: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md (specifically under header ## 2026-10-28T18:21:21Z).

TASK:
Extract and document the exact technical specifications for R1 (Zero-Secret Serverless Backend) and R5 (AI Pharmacist Prompt, Strict Schema & Client Guardrails):
1. Serverless endpoint `/api/analyze`: HTTP method (POST), payload format (JSON with base64 JPEG image payload), headers, max payload size validation.
2. Environment variables: `GEMINI_API_KEY`, configurable `GEMINI_MODEL` (default e.g. gemini-1.5-flash or gemini-2.5-flash / configurable via process.env).
3. Gemini API parameters: temperature 0, responseMimeType: "application/json", disabled/minimized thinking latency (thinkingConfig: { thinkingBudget: 0 } or equivalent where applicable), strict responseSchema matching R5.
4. Rate limiting: per-IP rate limiting (e.g. 20 requests/hour) using in-memory or headers/client IP parsing.
5. Vercel deployment: `vercel.json` with region affinity (`fra1` or `cdg1`), maxDuration, function routes, and concise README / deployment guide.
6. Exact system instruction from R5 word-for-word (English prompt lines 117-129) and exact JSON schema (is_clear, retake_message, confidence, evidence_text, medicine_name_ar, medicine_name_en, active_ingredient, uses, how_and_when, warnings, audio_summary).
7. Client guardrails: is_clear=false, evidence_text empty, confidence 'low', strip markdown fences, validate fields.

Write your findings to analysis.md and handoff.md in your working directory. Send a brief message back when done.
