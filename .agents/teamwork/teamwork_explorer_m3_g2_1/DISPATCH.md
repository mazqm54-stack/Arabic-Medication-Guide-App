# Dispatch: Explorer for Milestone M3 (Native App Shell, RTL Bottom Navigation & Home Screen)

## Role
teamwork_explorer

## Working Directory
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m3_g2_1

## Context & Inputs
- `ORIGINAL_REQUEST.md`: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
- `PROJECT.md`: c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
- Scope: Requirement R1 (Features F01, F03, F04, F05, F06, F07, F08)

## Target Files to Inspect
- `src/App.tsx`
- `src/index.css`
- `src/components/BottomNavBar.tsx` (if present) or `src/components/Navigation.tsx`
- `src/components/HomeScreen.tsx` (if present)
- `src/components/TitleBar.tsx`
- `src/types/index.ts`
- `src/services/nativeCamera.ts`
- E2E Tests: `tests/e2e/tier1_feature_coverage.test.ts` (search for F03–F08 test assertions)

## Key Technical Questions to Answer
1. Bottom Navigation Bar layout and exact RTL tab order:
   - 1: `الرئيسية` (Home, icon: Home / Lucide)
   - 2: `أدويتي` (My Medicines, icon: Pill / Package)
   - 3: Center raised circular button `صوّر` (72–80px teal `#006D77`, white Camera icon, calling `capturePhoto` directly without file input)
   - 4: `الروشتة` (Prescription, icon: FileText / Receipt)
   - 5: `السجل` (History, icon: History / Clock)
2. Tab ergonomics: Touch targets $\ge 64$px, icons $\ge 28$px, bold labels $\ge 16$px, rounded pill active indicator, light haptic feedback (`navigator.vibrate?.(10)`), safe area insets (`pb-safe`).
3. Mobile-feel styling in `src/index.css`: `user-select: none`, `-webkit-tap-highlight-color: transparent`, `overscroll-behavior: none`, transitions $< 250$ms.
4. Home Screen redesign:
   - Friendly greeting ("مرحباً بك في دليلي الدوائي").
   - 2 big accessible cards ("صوّر علبة دواء", "صوّر روشتة").
   - Uncluttered recent scans list.
5. Persistent medical disclaimer: visible on all scan result and prescription screens.
6. Existing tests: Verify which existing tests touch `App.tsx` or navigation components and outline the required new/updated tests.

## Output
Write `handoff.md` with:
- Observation (current code analysis, interfaces, existing tests)
- Logic Chain (component architecture, state transitions)
- Step-by-step implementation guide for Worker M3
- Verification Method


## 2026-10-31T18:16:52Z
You are the Explorer for Milestone M3 (Native App Shell, RTL Bottom Navigation & Home Screen).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m3_g2_1
Read your instructions in DISPATCH.md in that directory.
Also read:
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md

Investigate:
- src/App.tsx
- src/index.css
- src/components/
- src/services/nativeCamera.ts
- tests/e2e/tier1_feature_coverage.test.ts (features F03-F08)
- existing navigation and App tests

Formulate the complete technical architecture and step-by-step implementation guide for Worker M3:
- Fixed bottom nav bar in strict RTL order: الرئيسية, أدويتي, 76px center raised teal (#006D77) camera button صوّر, الروشتة, السجل
- Touch targets >= 64px, icons >= 28px, bold labels >= 16px, pill active state, haptic feedback, safe area insets
- Native mobile feel CSS (user-select: none, overscroll-behavior: none, -webkit-tap-highlight-color: transparent, transitions < 250ms)
- Home screen redesign: friendly greeting, 2 big cards ("صوّر علبة دواء", "صوّر روشتة"), uncluttered recent scans
- Persistent medical disclaimer

Deliver your findings and implementation plan in:
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m3_g2_1\handoff.md.
Send a message to the orchestrator when complete.


## 2026-10-31T18:32:12Z
**Context**: Milestone M3 Investigation
**Content**: Status query: Please update your progress.md with your current investigation findings and ETA for handoff.md.
**Action**: Reply with status update or complete handoff.md.
