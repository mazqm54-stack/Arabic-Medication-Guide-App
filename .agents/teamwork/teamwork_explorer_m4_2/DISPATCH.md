# Task Assignment: Explorer 2 (Milestone M4 — Unclear Photo Guidance & Medication Usage Card)

## Role & Mission
You are Explorer 2 for Milestone M4 of "دليلي الدوائي".
Your objective is to investigate the technical requirements, design, and implementation guide for Unclear Photo Guidance (R3) and the Medication Usage Card updates (R4).

## Scope of Investigation
1. **Unclear Photo Guidance (`src/components/UnclearPhotoCard.tsx`)**:
   - Unified guidance card used across BOTH the box photo flow and prescription photo flow when `is_clear === false`.
   - Friendly Arabic message explaining why the photo was unclear.
   - Exactly 3 short, concrete retake tips:
     1. الإضاءة: التأكد من إضاءة جيدة بدون ظلال أو لمعان شديد.
     2. الإطار: ملء الشاشة بالعلبة أو الروشتة والتأكد من وضوح الكلام.
     3. الثبات: تثبيت اليد لمنع الاهتزاز.
   - Large, prominent "إعادة التصوير" button ($\ge 64$px touch target, WCAG AAA contrast, senior-friendly).
   - Preserving partial legibility: If a prescription has some readable items and some unreadable items, the readable ones are shown as normal cards, and unclear ones as soft amber cards — rather than routing the whole prescription to the retake screen! Only when zero items are readable or image is completely unreadable does it route to `UnclearPhotoCard`.

2. **Medication Usage Card (Card 3 in `src/components/ResultCards.tsx`)**:
   - `how_and_when` guarantee: Ensure Card 3 renders 2–3 common active ingredient usage items and never displays an empty list or generic "راجع الطبيب فقط".
   - `usage_source` badge: Visually differentiate whether usage is:
     - "مكتوب على العلبة" (if `usage_source === 'printed'`)
     - "مكتوب في الروشتة" (if from prescription)
     - "الاستخدام الشائع" (if `usage_source === 'common'`)
   - Mandatory fixed Arabic disclaimer string immediately below Card 3:
     `"هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي."`
   - Senior accessibility: 20px+ font, high contrast, RTL layout.

## Required Artifacts to Inspect
- `PROJECT.md` (Features F19, F20, F21, F22, F23)
- `ORIGINAL_REQUEST.md` (Sections R3 and R4)
- `src/components/UnclearPhotoCard.tsx` (current implementation)
- `src/components/ResultCards.tsx` (current Card 3 implementation)
- `src/services/geminiParser.ts` (`DEFAULT_COMMON_USAGE`, `isGenericFollowDoctor`)
- `tests/e2e/tier1_features/unclear_guidance.test.ts`
- `tests/e2e/tier1_features/medication_usage.test.ts`
- `tests/e2e/tier2_boundaries/unclear_guidance_boundary.test.ts`
- `tests/e2e/tier2_boundaries/medication_usage_boundary.test.ts`

## Output Requirements
Produce a comprehensive technical handoff report at:
`c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_2\handoff.md`
Detailing:
- Exact JSX structure, CSS styling, and Arabic strings for `UnclearPhotoCard.tsx`.
- Exact JSX structure and badging for Card 3 in `ResultCards.tsx`, including the disclaimer line placement.
- Step-by-step instructions for the Worker.
Do NOT write application source code directly; you are an Explorer.

## 2026-10-31T20:07:41Z
You are Explorer 2 for Milestone M4 (Unclear Guidance & Usage Card).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_2
Read your assignment in c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_2\DISPATCH.md.
Also read c:\Users\PC\Documents\antigravity\fervent-mendel\ORIGINAL_REQUEST.md and c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md.
Investigate the technical component design, styling, and Arabic copy for UnclearPhotoCard (3 concrete tips + retake button, partial clarity preservation) and Card 3 in ResultCards (usage_source badge + hardcoded disclaimer string).
Write your complete handoff report to c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m4_2\handoff.md and report back via send_message to orchestrator. Do not write source code directly.
