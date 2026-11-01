# Dispatch: Challenger 2 for Milestone M3 (Native App Shell, RTL Bottom Navigation & Home Screen)

## Role
teamwork_challenger

## Working Directory
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m3_g2_2

## Context
- `ORIGINAL_REQUEST.md`: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
- `PROJECT.md`: c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
- Scope: Adversarial verification of Home Screen (`src/components/HomeScreen.tsx`), Native Mobile Feel CSS (`src/index.css`), and Disclaimer Persistence.

## Test File to Create
`tests/m3.challenge2.test.ts`

## Specific Stress Scenarios to Cover
1. Home Screen Cards & Actions:
   - Verify Card 1 "صوّر علبة دواء" carries `aria-label="صوّر علبة الدواء الآن"` and button text containing `صوّر علبة الدواء الآن` (verifying full backwards compatibility).
   - Verify Card 2 "صوّر روشتة" navigates to prescription tab.
   - Verify secondary gallery button "📁 أو اختر صورة من الألبوم" opens photo picker.
2. Recent Scans Clamping & Empty State:
   - Provide 20 history items; verify rendered output strictly clamps to 5 items.
   - Provide 0 history items; verify friendly empty state fallback text is rendered: "لا توجد أدوية مسجلة بعد. يمكنك تصوير علبة دواء للبدء."
3. Native Mobile Feel CSS Verification:
   - Check `src/index.css` for `user-select: none`, `-webkit-tap-highlight-color: transparent`, `overscroll-behavior: none`, `.pb-safe`, `.pt-safe`, and transition speeds.
4. Persistent Medical Disclaimer:
   - Verify medical disclaimer banner is rendered on scan results.

## Verification
- Run: `npx.cmd vitest run tests/m3.challenge2.test.ts`
- Run: `npx.cmd tsc --noEmit`

## Output
Write `handoff.md` with:
- Observation (test results, pass count)
- Logic Chain
- Conclusion (APPROVE or REQUEST_CHANGES)
- Verification Method


## 2026-10-31T19:22:39Z
You are Challenger 2 for Milestone M3 (Native App Shell, RTL Bottom Navigation & Home Screen).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m3_g2_2
Read your instructions in DISPATCH.md in that directory.
Also read:
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md

Write adversarial tests in:
tests/m3.challenge2.test.ts
Focus on stress-testing HomeScreen (src/components/HomeScreen.tsx), mobile CSS (src/index.css), and disclaimer persistence:
1. Home Screen action buttons:
   - "صوّر علبة دواء" with aria-label="صوّر علبة الدواء الآن" and button text.
   - "صوّر روشتة" routing.
   - Secondary gallery picker.
2. Clamped recent scans (20 items clamped to 5) and empty state ("لا توجد أدوية مسجلة بعد. يمكنك تصوير علبة دواء للبدء.").
3. Native mobile feel CSS rules (user-select: none, overscroll-behavior: none, -webkit-tap-highlight-color: transparent, safe area utilities).
4. Camera error handling (permission denied dialogs).
5. Medical disclaimer banner persistence.

Run tests:
- npx.cmd vitest run tests/m3.challenge2.test.ts
- npx.cmd tsc --noEmit

Deliver your findings and verdict in c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_challenger_m3_g2_2\handoff.md.
Send a message to the orchestrator when complete.
