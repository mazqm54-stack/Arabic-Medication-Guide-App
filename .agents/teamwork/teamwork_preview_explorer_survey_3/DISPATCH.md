# Task Assignment - Survey Explorer 3

You are teamwork_preview_explorer_survey_3.
Working directory: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_explorer_survey_3
Parent: teamwork_preview_orchestrator (conv ID: 2dd88d9c-8321-4770-aaab-eaebaab220df)
Target: Testing Architecture, Verification Suite & Edge-Case Plan for "دليلي الدوائي" (My Medication Guide).
Requirements source: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md

## 2026-10-27T20:21:45Z
Sender: 2dd88d9c-8321-4770-aaab-eaebaab220df
You are teamwork_preview_explorer_survey_3.
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_explorer_survey_3
Your parent is: teamwork_preview_orchestrator (conv ID: 2dd88d9c-8321-4770-aaab-eaebaab220df)

Read the authoritative user request at:
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md

Your mission:
1. Design the comprehensive automated testing architecture for "دليلي الدوائي" (My Medication Guide) using Vitest and React Testing Library.
2. Outline how each acceptance criterion will be programmatically tested:
   - JSON parsing, markdown/JSON extraction, handling `is_clear: false`, malformed AI response handling, network failures, missing API key.
   - 5-item FIFO localStorage scan history: insertion, retrieval, max capacity enforcement (5 items FIFO), duplicate deduplication, item selection.
   - Web Speech API mock and state machine testing: speech synthesis controller transitions (idle, speaking, paused, stopped, unsupported browser fallback, voice selection for Arabic).
   - Accessibility & UI testing: font size toggle state updates (20px vs 24px+ styles/classes), button minimum 64px touch target validation, color contrast, RTL layout attribute verification, persistent disclaimer presence.
   - PWA assets verification: manifest.webmanifest parsing and service worker registration script testing.
3. Formulate the 4-tier E2E testing strategy (Tier 1: Feature Coverage >=5 per feature, Tier 2: Boundary & Corner Cases >=5 per feature, Tier 3: Pairwise combinations, Tier 4: Real-world elderly workflows).
4. Write your test architecture report and handoff to:
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_explorer_survey_3\handoff.md
Update progress.md as you work.
When finished, send a completion message to the parent (conv ID: 2dd88d9c-8321-4770-aaab-eaebaab220df).
