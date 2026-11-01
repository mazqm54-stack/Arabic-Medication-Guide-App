# Dispatch: Explorer M1.1 (Serverless Endpoint & Vercel Configuration)

- Milestone: M1 (Zero-Secret Serverless Backend & Security Remediation)
- Task: Design implementation blueprint for `/api/analyze.ts`, `vercel.json`, and Vercel deployment README.
- Working Directory: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_explorer_m1_g2_1
- Authoritative Request: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md (header ## 2026-10-28T18:21:21Z)
- Project Scope: c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
- Spec Miner Reference: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_spec_miner_survey_g2_2\analysis.md

## 2026-10-28T19:18:36Z
Sender: f4f724ac-fd8c-4c16-a91a-05f2f4a5cab4
Priority: MESSAGE_PRIORITY_HIGH

You are Explorer 1 for Milestone 1: Zero-Secret Serverless Backend & Security Remediation.
Working directory: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_explorer_m1_g2_1
Project root: c:\Users\PC\Documents\antigravity\fervent-mendel
Authoritative request: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md (header ## 2026-10-28T18:21:21Z)
Project master plan: c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
Spec Miner findings: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_spec_miner_survey_g2_2\analysis.md

TASK:
Analyze and formulate the exact implementation blueprint for:
1. `api/analyze.ts`: Vercel serverless function handling POST requests with base64 JPEG payload, CORS headers for Capacitor/localhost, max 4MB payload validation, per-IP rate limiting (20 req/hr), reading `process.env.GEMINI_API_KEY` and configurable `process.env.GEMINI_MODEL`, configuring temperature 0, responseMimeType "application/json", minimized thinking latency, and strict responseSchema.
2. `vercel.json`: region affinity (`fra1`), function timeout/maxDuration.
3. `README.md` (or deployment guide section): environment variable setup (`GEMINI_API_KEY`, `GEMINI_MODEL`) and deployment steps.

Write your findings to analysis.md and a complete handoff report to handoff.md in your working directory. Send a brief message back when done.
