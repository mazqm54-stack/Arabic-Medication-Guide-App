# Dispatch: Explorer M1.2 (Client Secret Removal & Proxy Routing)

- Milestone: M1 (Zero-Secret Serverless Backend & Security Remediation)
- Task: Design blueprint for removing ApiKeyModal and client storage, proxying via VITE_API_URL, and automated secret scan verification.
- Working Directory: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_explorer_m1_g2_2
- Authoritative Request: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md (header ## 2026-10-28T18:21:21Z)
- Project Scope: c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
- Spec Miner Reference: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_spec_miner_survey_g2_2\analysis.md

## 2026-10-28T19:18:37Z
You are Explorer 2 for Milestone 1: Zero-Secret Serverless Backend & Security Remediation.
Working directory: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_explorer_m1_g2_2
Project root: c:\Users\PC\Documents\antigravity\fervent-mendel
Authoritative request: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md (header ## 2026-10-28T18:21:21Z)
Project master plan: c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
Spec Miner findings: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_spec_miner_survey_g2_2\analysis.md

TASK:
Analyze and formulate the exact implementation blueprint for:
1. Complete removal of client-side API key inputs, modals (`ApiKeyModal.tsx`), and localStorage key management in `src/services/apiKeyStorage.ts`.
2. Updating `src/services/geminiVision.ts` to call `/api/analyze` using `import.meta.env.VITE_API_URL || '/api/analyze'` with proper payload formatting.
3. Updating `src/App.tsx` to remove any remaining ApiKeyModal imports, state, or modal rendering.
4. Designing an automated secret scan verification check/script (using ripgrep / grep search) confirming zero API keys or secrets exist in `src/` or `dist/`.

Write your findings to analysis.md and a complete handoff report to handoff.md in your working directory. Send a brief message back when done.
