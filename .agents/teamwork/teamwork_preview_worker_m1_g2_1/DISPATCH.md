## 2026-10-28T19:34:27Z
You are Worker M1 for Milestone 1: Zero-Secret Serverless Backend & Security Remediation.
Working directory: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_worker_m1_g2_1
Project root: c:\Users\PC\Documents\antigravity\fervent-mendel
Authoritative request: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md (header ## 2026-10-28T18:21:21Z)
Project master plan: c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md

Read the Explorer blueprints thoroughly before modifying any code:
- Explorer 1 (Serverless & Vercel): c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_explorer_m1_g2_1\analysis.md
- Explorer 2 (Client Secret Removal): c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_explorer_m1_g2_2\analysis.md
- Explorer 3 (Serverless Tests): c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_explorer_m1_g2_3\analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVELY OWNED FILES:
You own and will implement/modify:
- `api/analyze.ts` (create Vercel serverless function with CORS, rate limiting, payload validation, Gemini API integration, strict schema)
- `vercel.json` (create with region `fra1`, `maxDuration: 30`, rewrites)
- `DEPLOYMENT_VERCEL.md` (create deployment guide for Vercel)
- `src/services/preferencesStorage.ts` (create to manage font size preference & purge legacy keys)
- `src/services/geminiVision.ts` (update to proxy requests to `import.meta.env.VITE_API_URL || '/api/analyze'`)
- `src/components/ApiKeyModal.tsx` (delete completely)
- `src/services/apiKeyStorage.ts` (delete or purge completely)
- `src/App.tsx` (remove ApiKeyModal imports, state, handlers, header settings button)
- `scripts/verify-secret-scan.js` (create automated Node.js secret scan script)
- `tests/analyze.test.ts` (create comprehensive Vitest test suite for serverless backend)
- `tests/secretScan.test.ts` (create Vitest test suite for secret scanning)

VERIFICATION STEPS:
1. Run `npm.cmd run test` — all tests must pass 100%.
2. Run `npm.cmd run build` — build must succeed cleanly with zero TypeScript or bundling errors.
3. Run `node scripts/verify-secret-scan.js` — must confirm 0 secrets in `src/` and `dist/`.

Document your implementation, execution commands, and output in `handoff.md` and send a message when done.
