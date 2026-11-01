# Dispatch Task: Challenger 2 — Milestone 3 (Requirement R2)

## Working Directory
`c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m3_2`

## Parent
Orchestrator conversation ID: `8a80a925-17f2-4fac-a86b-d712a51f21a6`

## Context & Objectives
You are Challenger 2 for Milestone 3 (Requirement R2).
Your task is to adversarially challenge and stress-test:
1. The 30-second `AbortController` timeout and network error mapping in `src/services/geminiVision.ts`.
2. The 4 distinct UI error states and debug badge in `src/components/UnclearPhotoCard.tsx`.
3. The interactive retry mechanism in `src/App.tsx` (confirming `lastFile` is preserved and reused on retry without taking a new photo).

## Your Mission
1. Read `ORIGINAL_REQUEST.md` at `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md`.
2. Inspect `src/services/geminiVision.ts`, `src/services/geminiParser.ts`, `src/components/UnclearPhotoCard.tsx`, and `src/App.tsx`.
3. Author challenge tests in `tests/errorStates.challenge.test.tsx` verifying:
   - 30-second timeout firing: abort signal fires, throws `AnalysisError` with `category: 'network_timeout'` and `errorCode: 'CLIENT_TIMEOUT'`.
   - Cloudflare Worker error codes: HTTP 500/503 with `UPSTREAM_OVERLOADED`, `UPSTREAM_RATE_LIMIT`, `UPSTREAM_LOCATION_RESTRICTED`, `UPSTREAM_BAD_REQUEST`, `UPSTREAM_API_ERROR` propagate to UI and display debug badge.
   - AI `is_clear=false` displays lighting and focus tips without debug badge.
   - Interactive retry button executes `processImage` with cached `lastFile` and does NOT invoke camera/photo picker.
   - Arabic text rendering and RTL direction.
4. Run your tests with `npx.cmd vitest run tests/errorStates.challenge.test.tsx`.
5. Run full test suite `npm.cmd test`.
6. Write your comprehensive challenge findings to `m3_challenge_report.md` and `handoff.md` in your working directory.
7. Your verdict MUST be either **APPROVE** or **REQUEST_CHANGES**.
8. Send a message to orchestrator (`8a80a925-17f2-4fac-a86b-d712a51f21a6`) with your verdict and report path.

## 2026-10-29T19:47:37Z
[Message] timestamp=2026-10-29T19:47:37Z sender=8a80a925-17f2-4fac-a86b-d712a51f21a6 priority=MESSAGE_PRIORITY_HIGH content=You are Challenger 2 for Milestone 3 (Requirement R2).
Your working directory is c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m3_2.
Read DISPATCH.md in your working directory and ORIGINAL_REQUEST.md at c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md.
Follow instructions in DISPATCH.md to adversarially challenge error states, 30s timeout abortion, interactive retry without photo retake, write and run tests in tests/errorStates.challenge.test.tsx, run npm.cmd test, and produce m3_challenge_report.md and handoff.md with your verdict (APPROVE or REQUEST_CHANGES). Report back to parent via send_message.
