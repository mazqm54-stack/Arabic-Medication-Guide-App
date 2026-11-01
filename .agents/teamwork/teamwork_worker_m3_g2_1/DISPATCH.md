# Dispatch: Worker for Milestone M3 (Native App Shell, RTL Bottom Navigation & Home Screen)

## Role
teamwork_worker

## Working Directory
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m3_g2_1

## Context & Inputs
- `ORIGINAL_REQUEST.md`: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
- `PROJECT.md`: c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
- Explorer M3 Implementation Guide: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m3_g2_1\handoff.md

## Exclusive Write Ownership
You exclusively own and may edit:
- `src/index.css`
- `src/types/index.ts`
- `src/components/BottomNavBar.tsx` (new)
- `src/components/HomeScreen.tsx` (new)
- `src/App.tsx`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Tasks (Follow handoff.md Step-by-Step)
1. **Update `src/index.css`**:
   - Add `user-select: none; -webkit-user-select: none;`
   - Add `-webkit-tap-highlight-color: transparent;`
   - Add `overscroll-behavior: none; overscroll-behavior-y: none;`
   - Add safe area utilities: `.pb-safe` and `.pt-safe`
   - Add `.transition-native` (transition duration 200ms < 250ms)
2. **Update `src/types/index.ts`**:
   - Add and export `TabKey = 'home' | 'medicines' | 'camera' | 'prescription' | 'history';`
   - Export `ActiveTab = 'home' | 'medicines' | 'prescription' | 'history';`
3. **Create `src/components/BottomNavBar.tsx`**:
   - Implement fixed bottom navigation bar in strict RTL order:
     1: `الرئيسية` (`home`)
     2: `أدويتي` (`medicines`)
     3: `صوّر` (`camera` - raised circular 76px teal `#006D77` button with white camera icon, calling `capturePhoto` directly without file input)
     4: `الروشتة` (`prescription`)
     5: `السجل` (`history`)
   - Export `RTL_NAV_TABS` matching test contracts.
   - Touch targets >= 64px, icons >= 28px, bold labels >= 16px, rounded pill active indicator, haptic feedback (`navigator.vibrate?.(10)`).
   - Safe-area inset padding (`pb-safe`).
4. **Create `src/components/HomeScreen.tsx`**:
   - Friendly greeting ("أهلاً بك في دليلي الدوائي").
   - 2 big accessible cards:
     - Card 1: "صوّر علبة دواء" with button carrying `aria-label="صوّر علبة الدواء الآن"` and text `صوّر علبة الدواء الآن` (matching `tests/errorStates.test.tsx` line 222).
     - Card 2: "صوّر روشتة" with button navigating to `prescription` tab.
   - Secondary gallery picker button.
   - Recent scans list clamped to 5 items with friendly empty state ("لا توجد أدوية مسجلة بعد. يمكنك تصوير علبة دواء للبدء.").
5. **Update `src/App.tsx`**:
   - Integrate `<BottomNavBar />` and `<HomeScreen />`.
   - Manage active tab state switching.
   - Keep persistent `<DisclaimerBanner />` on all scan results and detail screens.
   - Ensure `isCapturing` mutex lock on camera clicks to prevent race conditions.

## Verification Commands
1. `npx.cmd tsc --noEmit` (Must be 0 errors, exit code 0)
2. `npx.cmd vitest run tests/e2e/tier1_features/navigation_shell.test.ts`
3. `npx.cmd vitest run tests/errorStates.test.tsx`
4. `npx.cmd vitest run` (100% green across all test files)

## Output
Write `handoff.md` with:
- Observation (commands, verbatim outputs)
- Logic Chain
- Caveats
- Conclusion
- Verification Method

## 2026-10-31T18:42:46Z
You are the Worker for Milestone M3 (Native App Shell, RTL Bottom Navigation & Home Screen).
Your working directory is: c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m3_g2_1
Read your instructions in DISPATCH.md in that directory.
Also read:
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md
- c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_explorer_m3_g2_1\handoff.md

Your exclusive write files:
- src/index.css
- src/types/index.ts
- src/components/BottomNavBar.tsx (new)
- src/components/HomeScreen.tsx (new)
- src/App.tsx

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Follow the implementation guide in Explorer's handoff.md:
1. `src/index.css`: Add user-select: none, overscroll-behavior: none, -webkit-tap-highlight-color: transparent, safe area utilities (pb-safe, pt-safe), and transitions < 250ms.
2. `src/types/index.ts`: Add and export TabKey and ActiveTab.
3. `src/components/BottomNavBar.tsx`: 5 tabs in strict RTL order (الرئيسية, أدويتي, 76px center teal camera button صوّر, الروشتة, السجل). Touch targets >= 64px, icons >= 28px, labels >= 16px, pill active state, haptics, pb-safe.
4. `src/components/HomeScreen.tsx`: Friendly greeting, 2 big cards ("صوّر علبة دواء", "صوّر روشتة"), gallery button, uncluttered recent scans clamped to 5 items with empty state fallback.
5. `src/App.tsx`: Tab state management, route switching, persistent medical disclaimer, and native safe area insets.

Run tests:
- npx.cmd tsc --noEmit
- npx.cmd vitest run tests/e2e/tier1_features/navigation_shell.test.ts
- npx.cmd vitest run tests/errorStates.test.tsx
- npx.cmd vitest run

Deliver your findings and verification results in:
c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_worker_m3_g2_1\handoff.md.
Send a message to the orchestrator when complete.

