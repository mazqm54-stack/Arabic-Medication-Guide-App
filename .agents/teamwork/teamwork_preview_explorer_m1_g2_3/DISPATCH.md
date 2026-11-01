## 2026-10-28T19:18:37Z
You are Explorer 3 for Milestone 1: Zero-Secret Serverless Backend & Security Remediation.
Working directory: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_explorer_m1_g2_3
Project root: c:\Users\PC\Documents\antigravity\fervent-mendel
Authoritative request: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md (header ## 2026-10-28T18:21:21Z)
Project master plan: c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
Spec Miner findings: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_spec_miner_survey_g2_2\analysis.md

TASK:
Analyze and formulate the exact testing specification for the serverless backend:
1. Design `tests/analyze.test.ts` (Vitest compatible) to test `/api/analyze`:
   - Valid payload handling and mock Gemini API response forwarding.
   - 400 Bad Request on missing image or invalid mimeType.
   - 413 Payload Too Large on payload exceeding 4MB.
   - 429 Too Many Requests when IP rate limit (20 req/hr) is exceeded, verifying `Retry-After` header and Arabic error message.
   - CORS headers verification (OPTIONS pre-flight and POST responses).
   - Method rejection (reject GET, PUT, DELETE with 405 Method Not Allowed).
2. Ensure tests run smoothly under Vitest without requiring a live external Gemini API key.

Write your findings to analysis.md and a complete handoff report to handoff.md in your working directory. Send a brief message back when done.
