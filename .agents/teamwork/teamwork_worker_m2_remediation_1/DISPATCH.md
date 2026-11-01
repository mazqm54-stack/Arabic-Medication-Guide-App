# Dispatch: Worker for Milestone M2.2 Remediation

## Role
teamwork_worker

## Working Directory
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_remediation_1

## Context & Inputs
- `ORIGINAL_REQUEST.md`: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
- `PROJECT.md`: c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
- Explorer Remediation Report: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m2_remediation_1\handoff.md
- Forensic Auditor Report: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_auditor_m2_g2_1\handoff.md
- Challenger 1 Report: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m2_g2_1\handoff.md
- Challenger 2 Report: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m2_g2_2\handoff.md

## Exclusive Write Ownership
You exclusively own and may edit:
- `src/services/detailsCache.ts`
- `tests/detailsCache.test.ts`
- `src/services/geminiParser.ts`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Remediation Tasks (from Explorer handoff.md)
1. In `src/services/detailsCache.ts`:
   Update `getStorageItem(key)` to check `const item = window.localStorage.getItem(key); if (item !== null) return item;` so that on a localStorage miss (`null`), execution falls through to `return inMemoryCache.get(key) || null;`.
2. In `tests/detailsCache.test.ts`:
   Update lines 159 and 174 to spy directly on `window.localStorage` (`vi.spyOn(window.localStorage, 'setItem')` and `vi.spyOn(window.localStorage, 'getItem')`) because `setup.ts` instantiates `LocalStorageMock` directly on `window.localStorage`.
3. In `src/services/geminiParser.ts`:
   Update `isGenericFollowDoctor(text)`:
   - Guard against `DEFAULT_COMMON_USAGE.includes(t)` returning `false`.
   - Update `genericPatterns` to handle trimmed Arabic doctor deferrals with flexible whitespace and suffixes ("استشر الطبيب أو الصيدلي", "راجع الطبيب لمعرفة الجرعة").

## Verification Commands
1. `npx.cmd tsc --noEmit` (Must be 0 errors, exit code 0)
2. `npx.cmd vitest run tests/detailsCache.test.ts tests/m2.challenge1.test.ts tests/m2.challenge2.test.ts` (All 139 tests must pass)
3. `npx.cmd vitest run` (All 38 test files and 953+ tests must pass with 0 failures)

## Output
Write `handoff.md` with:
- Observation (commands, verbatim outputs)
- Logic Chain
- Caveats
- Conclusion
- Verification Method

## 2026-10-31T17:42:01Z
You are the Worker for Milestone M2.2 Remediation.
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_remediation_1
Read your instructions in DISPATCH.md in that directory.
Also read:
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m2_remediation_1\handoff.md

Your exclusive write files:
- src/services/detailsCache.ts
- tests/detailsCache.test.ts
- src/services/geminiParser.ts

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Apply the three exact remediation code changes documented in Section 4 of `teamwork_explorer_m2_remediation_1/handoff.md`:
1. `src/services/detailsCache.ts` (`getStorageItem` checks `item !== null`, falls back to `inMemoryCache`).
2. `tests/detailsCache.test.ts` (spy on `window.localStorage`).
3. `src/services/geminiParser.ts` (`isGenericFollowDoctor` updated regexes and `DEFAULT_COMMON_USAGE` guard).

Run tests:
- npx.cmd tsc --noEmit
- npx.cmd vitest run tests/detailsCache.test.ts tests/m2.challenge1.test.ts tests/m2.challenge2.test.ts
- npx.cmd vitest run

Deliver your findings and verification results in:
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m2_remediation_1\handoff.md.
Send a message to the orchestrator when complete.
