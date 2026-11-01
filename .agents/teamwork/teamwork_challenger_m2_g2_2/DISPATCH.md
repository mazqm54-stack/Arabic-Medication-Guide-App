# Dispatch: Challenger 2 for Milestone M2 (Client Data Layer & Services)

## Role
teamwork_challenger

## Working Directory
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m2_g2_2

## Context
- `ORIGINAL_REQUEST.md`: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
- `PROJECT.md`: c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
- Scope: Adversarial verification of Prescription Schema Validation (`validatePrescriptionJson`) and Medication Usage Defense (`parseMedicineAnalysisResult`) in `src/services/geminiParser.ts`.

## Test File to Create
`tests/m2.challenge2.test.ts`

## Specific Stress Scenarios to Cover
1. Prescription JSON Robustness:
   - Clamping to maximum 10 items when model returns 15+ items.
   - Low confidence items: verify `short_explanation` is strictly stripped (empty string), preventing hallucinated medical explanations.
   - High/medium confidence items: verify `short_explanation` is preserved.
   - Empty items array: verify parsed as `is_clear: false` with friendly Arabic `retake_message`.
   - Missing fields, null values, or unexpected types inside `items`: verify resilient defaults without throwing exceptions.
2. `how_and_when` Defense & `usage_source` Badging:
   - Verify array is never empty.
   - Test adversarial doctor deferral strings in Arabic and English (e.g. "راجع الطبيب لمعرفة الجرعة", "Follow doctor's instructions", "استشر الطبيب أو الصيدلي"): verify filtered out and replaced by `DEFAULT_COMMON_USAGE`.
   - Verify that when replacement occurs, `usage_source` is set to `'common'`.
   - Test genuine printed dosage (e.g. "قرص واحد يومياً بعد الأكل"): verify preserved and `usage_source` is `'printed'`.

## Verification
- Run: `npx.cmd vitest run tests/m2.challenge2.test.ts`
- Run: `npx.cmd tsc --noEmit`

## Output
Write `handoff.md` with:
- Observation (test results, pass count)
- Logic Chain
- Conclusion (APPROVE or REQUEST_CHANGES)
- Verification Method

## 2026-10-31T17:01:41Z
You are Challenger 2 for Milestone M2 (Client Data Layer, Types, Image Compression & Services).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m2_g2_2
Read your instructions in DISPATCH.md in that directory.
Also read:
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md

Your task is to write adversarial tests in:
tests/m2.challenge2.test.ts
Focus on stress-testing prescription validation and usage defense in src/services/geminiParser.ts:
1. Prescription JSON schema parsing:
   - Clamping to 10 items maximum.
   - Low confidence items: verify short_explanation is strictly stripped/empty string.
   - High/medium confidence items: verify short_explanation is preserved.
   - Empty items array: verify parsed as is_clear: false with friendly Arabic retake_message.
   - Missing fields, null values, malformed JSON, markdown fences.
2. how_and_when defense & usage_source badging:
   - Verify array is never empty.
   - Test adversarial doctor deferrals in Arabic and English (verify replaced with educational DEFAULT_COMMON_USAGE).
   - Verify that when replacement occurs, usage_source is set to 'common'.
   - Verify genuine printed instructions preserve usage_source: 'printed'.

Run your tests:
- npx.cmd vitest run tests/m2.challenge2.test.ts
- npx.cmd tsc --noEmit

Deliver your findings and final verdict in c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m2_g2_2\handoff.md.
Then send a brief message to the orchestrator with your verdict.

