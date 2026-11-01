# Task Assignment: Explorer 3 (Milestone M4 — App Shell Integration & Test Contract Verification)

## Role & Mission
You are Explorer 3 for Milestone M4 of "دليلي الدوائي".
Your objective is to investigate the existing E2E test suites and integration points in `src/App.tsx` for Milestone M4 to ensure zero regressions and 100% test contract compliance.

## Scope of Investigation
1. **Existing E2E Test Suite Analysis**:
   - Inspect all tests in `tests/e2e/tier1_features/` relating to M4:
     - `prescription_reading.test.ts`
     - `unclear_guidance.test.ts`
     - `medication_usage.test.ts`
   - Inspect all tests in `tests/e2e/tier2_boundaries/` relating to M4:
     - `prescription_boundaries.test.ts`
     - `unclear_guidance_boundary.test.ts`
     - `medication_usage_boundary.test.ts`
   - Inspect existing unit tests in `tests/`:
     - `errorStates.test.tsx`
     - `ResultCards.test.tsx`
     - `UnclearPhotoCard.test.tsx`
     - `navigation.test.tsx`
   - Identify every expected test ID, ARIA role, Arabic string literal, class name, and mocked function signature.

2. **Integration into `src/App.tsx`**:
   - How tab switching (`activeTab === 'prescription'`) mounts `PrescriptionFlow`.
   - Preserving state when navigating between tabs.
   - Managing audio synthesis lifecycle (stopping box audio when starting prescription, stopping prescription audio when changing tabs).
   - Medical disclaimer persistence on all result and prescription views.
   - Backwards compatibility with existing box scanning flows on the Home tab.

## Required Artifacts to Inspect
- `PROJECT.md`
- `ORIGINAL_REQUEST.md`
- `src/App.tsx`
- `tests/e2e/tier1_features/prescription_reading.test.ts`
- `tests/e2e/tier1_features/unclear_guidance.test.ts`
- `tests/e2e/tier1_features/medication_usage.test.ts`
- `tests/e2e/tier2_boundaries/prescription_boundaries.test.ts`
- `tests/e2e/tier2_boundaries/unclear_guidance_boundary.test.ts`
- `tests/e2e/tier2_boundaries/medication_usage_boundary.test.ts`

## Output Requirements
Produce a comprehensive technical handoff report at:
`c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_3\handoff.md`
Detailing:
- Complete matrix of all test assertions, required selectors, ARIA attributes, and Arabic text expectations.
- Safe integration pattern for `src/App.tsx` to maintain 100% test compatibility.
- Concrete verification commands for the Worker and Reviewers.
Do NOT write application source code directly; you are an Explorer.

## 2026-10-31T20:08:04Z
You are Explorer 3 for Milestone M4 (App Shell Integration & Test Contract Verification).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_3
Read your assignment in c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_3\DISPATCH.md.
Also read c:\Users\PC\Documents\antigravity\fervent-mendel\ORIGINAL_REQUEST.md and c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md.
Investigate the existing E2E test suites (tier1, tier2, and unit tests) for prescription reading, unclear photo guidance, and medication usage card contracts. Determine all required test IDs, ARIA attributes, exact strings, and the integration strategy for src/App.tsx.
Write your complete handoff report to c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_3\handoff.md and report back via send_message to orchestrator. Do not write source code directly.
