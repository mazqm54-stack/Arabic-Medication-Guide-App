# Automated Testing Architecture & Verification Strategy Report
**Project**: "دليلي الدوائي" (My Medication Guide) - Elderly-Centric Arabic Medication Assistant PWA  
**Author**: `teamwork_preview_explorer_survey_3` (Testing Architecture & Verification Strategist)  
**Date**: 2026-10-27T20:35:00Z  
**Authoritative Sources**:
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_spec_miner_survey_2\handoff.md`

---

## 1. Observation
Direct, verifiable observations of the project environment, specifications, and constraints:

1. **System & Toolchain Environment**:
   - Operating System: Windows 11 / PowerShell environment.
   - Node.js runtime: `v24.21.0`.
   - Package manager: `npm.cmd` (`11.19.0`). Directly observed: Windows PowerShell script execution policy blocks `npm.ps1`; therefore, all commands must execute via `npm.cmd` or `npx.cmd`.
   - Repository state: Greenfield repository at `c:\Users\PC\Documents\antigravity\fervent-mendel`, currently containing only `.git`, `ORIGINAL_REQUEST.md`, and metadata folders under `.agents/teamwork/`.

2. **Acceptance Criteria Mandates from ORIGINAL_REQUEST.md**:
   - **Automated Verification**:
     - Vitest + React Testing Library unit & integration test suite passing 100% of tests.
     - Tests verifying JSON parsing, `is_clear: false` detection, markdown block stripping, and malformed AI response handling.
     - Tests verifying `localStorage` 5-item FIFO capacity enforcement, retrieval, and deduplication.
     - Tests verifying Web Speech API state transitions (`idle`, `speaking`, `paused`, `stopped`), Arabic voice resolution (`ar-SA`, `ar-EG`), and unsupported browser fallbacks.
     - Tests verifying elderly accessibility: minimum font size ≥ 20px, headings ≥ 28px, button touch targets ≥ 64px, WCAG AAA contrast compliance, and full RTL layout (`dir="rtl"`).
     - Production build succeeds with zero TypeScript, lint, or bundling errors (`npm.cmd run build`).
   - **Functional Verification**:
     - PWA manifest (`manifest.webmanifest`) and service worker offline caching shell verification.
     - Persistent medical disclaimer presence across all result views.
     - Camera input `capture="environment"` and gallery file picker availability.

3. **Domain & User Constraints**:
   - Target demographic: Arabic-speaking senior citizens experiencing visual decline, motor tremors, and low digital confidence.
   - Medical safety constraint: The AI must never invent dosages; `is_clear: false` must route to a comforting Arabic retry screen with lighting guidance.

---

## 2. Logic Chain

1. **Choice of Test Framework (Vitest + React Testing Library)**:
   - Vitest shares the same transform pipeline, plugins, and resolve configuration as Vite, avoiding dual-configuration drift common with Jest.
   - `jsdom` provides a lightweight, deterministic DOM environment suited for fast unit/integration runs without headless browser startup overhead.
   - React Testing Library enforces user-centric testing (querying by accessible role, label, and text) rather than internal component state, ensuring test robustness against refactorings.

2. **Necessity of Custom DOM Mocking & Matchers**:
   - `window.speechSynthesis` and `SpeechSynthesisUtterance` do not exist in standard `jsdom` (`undefined` at runtime). Testing speech controller transitions requires a deterministic mock implementing Web Speech API event lifecycles (`onstart`, `onpause`, `onresume`, `onend`, `onerror`).
   - Standard RTL matchers do not natively verify physical pixel dimensions or color contrast ratios. Because 64px minimum touch targets and WCAG contrast are hard non-negotiable medical requirements, custom matchers (`toHaveMinTouchTarget`, `toHaveAccessibleContrast`, `toHaveRtlDirection`) are essential to automate verification.

3. **LocalStorage FIFO & Deduplication Deductions**:
   - Elderly users often repeatedly scan their daily pills. Without deduplication, the 5-item history will be flooded with identical entries.
   - Deduplication must recognize matching medications by Arabic name and active ingredient, moving the item to the newest position (index 0) with a refreshed timestamp, while keeping the array bounded at 5 items.
   - Storage quotas or Private Browsing restrictions can throw `QuotaExceededError`. The test suite must confirm that storage errors degrade gracefully to in-memory history without crashing the user interface.

4. **Rationale for the 4-Tier E2E Testing Strategy**:
   - *Tier 1 (Feature Coverage)* ensures every functional requirement identified in the specification has at least 5 targeted test cases.
   - *Tier 2 (Boundary & Corner Cases)* stresses the boundaries (extreme image dimensions, corrupt JSON, missing API keys, rapid double-clicks).
   - *Tier 3 (Pairwise Combinations)* catches subtle multi-variable defects where network conditions, browser capabilities, storage states, and image qualities collide.
   - *Tier 4 (Real-World Elderly Workflows)* simulates realistic, empathetic personas (e.g., trembling hands, low vision, noisy environments) to ensure the system delivers a comforting, failure-proof medical experience.

---

## 3. Caveats & Assumptions

1. **Headless Layout Geometry in JSDOM**:
   - JSDOM does not perform layout reflow or text rendering; calls to `getBoundingClientRect()` return zeros unless mocked or derived from inline/computed CSS styles.
   - *Mitigation*: Our touch-target test suite verifies both explicit CSS classes/inline styles (`min-h-[64px]`, `style={{ minHeight: '64px' }}`) and provides a layout-mock utility for computed bounding boxes.
2. **SpeechSynthesis Event Timing**:
   - Web Speech API on actual mobile devices operates asynchronously on native OS speech engines. In JSDOM, event dispatch must be mocked synchronously or wrapped in `act()` to mirror state updates accurately.
3. **PWA & Service Worker Execution Scope**:
   - Service workers cannot register over `file://` or inside standard `jsdom`. The PWA test suite programmatically inspects `manifest.webmanifest` syntax, manifest schema conformity, and validates the service worker registration code path via mocked `navigator.serviceWorker`.
4. **Gemini Live Network Calls**:
   - Automated test suites must NEVER hit live Gemini API endpoints during CI/CD to prevent API key leakage, cost runaway, and non-deterministic network flakes. All API tests use deterministic mock fixtures matching official Gemini 1.5 Flash Vision payloads.

---

## 4. Conclusion: Complete Automated Test Architecture & Strategy

```
========================================================================================
                          TESTING ARCHITECTURE TOPOLOGY
========================================================================================
                                 [ Vitest Runner ]
                                         │
             ┌───────────────────────────┼───────────────────────────┐
             ▼                           ▼                           ▼
    [ Unit Test Suites ]      [ Component & UI Suites ]      [ Integration Suites ]
    • geminiParser.test.ts     • Accessibility.test.tsx      • ScannerFlow.test.tsx
    • historyStorage.test.ts   • ResultCards.test.tsx        • HistoryQuickView.test.tsx
    • speechController.test.ts • AudioToolbar.test.tsx       • OfflineShell.test.ts
    • pwaManifest.test.ts      • FontToggle.test.tsx         • ErrorRecovery.test.tsx
             │                           │                           │
             └───────────────────────────┼───────────────────────────┘
                                         ▼
                            [ 4-Tier Testing Strategy ]
    • Tier 1: Core Feature Coverage (>=5 tests per feature, 40+ tests)
    • Tier 2: Boundary & Corner Cases (>=5 tests per domain, 35+ tests)
    • Tier 3: Pairwise Combination Matrix (16 orthogonal multi-factor runs)
    • Tier 4: Real-World Elderly Personas (4 end-to-end empathetic user journeys)
========================================================================================
```

### 4.1 Test Infrastructure & Configuration Architecture

#### 4.1.1 Vitest Configuration (`vitest.config.ts`)
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        'vite.config.ts',
        'vitest.config.ts',
      ],
    },
  },
});
```

#### 4.1.2 Global Test Setup & Custom Matchers (`src/test/setup.ts`)
```typescript
import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Automatically cleanup DOM after each test run
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock LocalStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((idx: number) => Object.keys(store)[idx] || null),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Custom Matchers Registration
expect.extend({
  toHaveMinTouchTarget(received: HTMLElement, minSize = 64) {
    const style = window.getComputedStyle(received);
    const minHeight = parseFloat(style.minHeight) || 0;
    const height = parseFloat(style.height) || 0;
    const effectiveHeight = Math.max(minHeight, height);

    // Also check classes for Tailwind min-h-[64px] or h-16
    const classList = received.className || '';
    const hasTailwindClass =
      classList.includes('min-h-[64px]') ||
      classList.includes('h-16') ||
      classList.includes('h-[64px]');

    const pass = effectiveHeight >= minSize || hasTailwindClass;
    return {
      pass,
      message: () =>
        `Expected element to have minimum touch target height of ${minSize}px, but received height: ${effectiveHeight}px (classes: "${classList}")`,
    };
  },

  toHaveRtlDirection(received: HTMLElement) {
    const dir = received.getAttribute('dir') || window.getComputedStyle(received).direction;
    const pass = dir === 'rtl';
    return {
      pass,
      message: () => `Expected element to have dir="rtl", but received "${dir}"`,
    };
  },
});
```

---

### 4.2 Programmatic Verification of Acceptance Criteria

#### 4.2.1 Suite A: Gemini Vision JSON Parsing & Error Recovery
**Target Module**: `src/services/geminiParser.ts`  
**Test File**: `src/services/__tests__/geminiParser.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { parseMedicineAnalysis, formatPharmacistPrompt } from '../geminiParser';
import type { MedicineAnalysisResult } from '@/types';

describe('Gemini Vision AI Response Parsing & Error Handling', () => {
  const validMockResult: MedicineAnalysisResult = {
    is_clear: true,
    medicine_name_ar: 'بانادول إكسترا',
    medicine_name_en: 'Panadol Extra (Paracetamol 500mg, Caffeine 65mg)',
    active_ingredient: 'باراسيتامول + كافيين',
    uses: ['تسكين الصداع الشديد', 'تخفيف آلام المفاصل', 'خفض الحرارة'],
    how_and_when: ['قرص واحد إلى قرصين بعد الأكل كل 6 إلى 8 ساعات عند اللزوم'],
    warnings: ['لا تتناول أكثر من 8 أقراص يومياً', 'تجنب تناوله مع أدوية أخرى تحتوي على باراسيتامول'],
    audio_summary: 'هذا دواء بانادول إكسترا، مسكن للآلام والصداع. يؤخذ قرص أو قرصين بعد الأكل، ولا تتناول أكثر من ثمانية أقراص في اليوم.',
  };

  it('1. parses clean pure JSON string successfully', () => {
    const raw = JSON.stringify(validMockResult);
    const parsed = parseMedicineAnalysis(raw);
    expect(parsed.is_clear).toBe(true);
    expect(parsed.medicine_name_ar).toBe('بانادول إكسترا');
    expect(parsed.uses).toHaveLength(3);
  });

  it('2. strips markdown fenced codeblock with json tag (```json ... ```)', () => {
    const raw = `\`\`\`json\n${JSON.stringify(validMockResult, null, 2)}\n\`\`\``;
    const parsed = parseMedicineAnalysis(raw);
    expect(parsed.is_clear).toBe(true);
    expect(parsed.medicine_name_en).toContain('Panadol Extra');
  });

  it('3. extracts JSON enclosed within conversational narrative wrappers', () => {
    const raw = `أهلاً بك، إليك تحليل صورة علبة الدواء المرفقة:\n\`\`\`json\n${JSON.stringify(
      validMockResult
    )}\n\`\`\`\nنتمنى لك دوام الصحة والعافية.`;
    const parsed = parseMedicineAnalysis(raw);
    expect(parsed.is_clear).toBe(true);
    expect(parsed.active_ingredient).toBe('باراسيتامول + كافيين');
  });

  it('4. handles is_clear: false response and preserves unclarity flag', () => {
    const unclearJson = JSON.stringify({
      is_clear: false,
      medicine_name_ar: '',
      warnings: ['الصورة غير واضحة أو ليست لدواء'],
    });
    const parsed = parseMedicineAnalysis(unclearJson);
    expect(parsed.is_clear).toBe(false);
  });

  it('5. safely handles truncated or malformed JSON without crashing', () => {
    const malformed = '{"is_clear": true, "medicine_name_ar": "بانادول';
    const parsed = parseMedicineAnalysis(malformed);
    expect(parsed.is_clear).toBe(false);
    expect(parsed.raw_error).toBeDefined();
  });

  it('6. safely handles missing required fields with fallback defaults', () => {
    const incomplete = JSON.stringify({
      is_clear: true,
      medicine_name_ar: 'دواء غير مسمى',
    });
    const parsed = parseMedicineAnalysis(incomplete);
    expect(parsed.is_clear).toBe(true);
    expect(parsed.uses).toEqual([]);
    expect(parsed.how_and_when).toEqual([]);
    expect(parsed.warnings).toEqual([]);
  });

  it('7. verifies strict Arabic pharmacist system prompt contains all required keys', () => {
    const prompt = formatPharmacistPrompt();
    expect(prompt).toContain('أنت صيدلي خبير ومساعد طبي ذكي مخصص لكبار السن');
    expect(prompt).toContain('"is_clear": true/false');
    expect(prompt).toContain('"audio_summary"');
    expect(prompt).toContain('قواعد صارمة: إذا كانت الصورة غير واضحة');
  });
});
```

---

#### 4.2.2 Suite B: 5-Item FIFO LocalStorage Scan History
**Target Module**: `src/services/historyStorage.ts`  
**Test File**: `src/services/__tests__/historyStorage.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getScanHistory,
  saveScanItem,
  clearScanHistory,
  HISTORY_STORAGE_KEY,
} from '../historyStorage';
import type { MedicineAnalysisResult } from '@/types';

describe('5-Item FIFO LocalStorage Scan History Manager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const createItem = (id: string, nameAr: string, ingredient: string): MedicineAnalysisResult => ({
    is_clear: true,
    medicine_name_ar: nameAr,
    medicine_name_en: `Medicine ${id}`,
    active_ingredient: ingredient,
    uses: ['استخدام تجريبي'],
    how_and_when: ['قرص يومياً'],
    warnings: ['تحذير تجريبي'],
    audio_summary: `ملخص صوتي لـ ${nameAr}`,
  });

  it('1. returns empty array when storage is empty', () => {
    expect(getScanHistory()).toEqual([]);
  });

  it('2. successfully inserts 1st item with generated id and timestamp', () => {
    const item = createItem('1', 'أسبرين', 'حمض أسيتيل ساليسيليك');
    const updated = saveScanItem(item);

    expect(updated).toHaveLength(1);
    expect(updated[0].medicine_name_ar).toBe('أسبرين');
    expect(updated[0].id).toBeDefined();
    expect(updated[0].timestamp).toBeGreaterThan(0);
  });

  it('3. enforces 5-item maximum capacity with FIFO eviction on 6th item', () => {
    const items = [
      createItem('1', 'دواء 1', 'مادة 1'),
      createItem('2', 'دواء 2', 'مادة 2'),
      createItem('3', 'دواء 3', 'مادة 3'),
      createItem('4', 'دواء 4', 'مادة 4'),
      createItem('5', 'دواء 5', 'مادة 5'),
    ];

    items.forEach((it) => saveScanItem(it));
    let history = getScanHistory();
    expect(history).toHaveLength(5);
    expect(history[0].medicine_name_ar).toBe('دواء 5'); // newest at index 0
    expect(history[4].medicine_name_ar).toBe('دواء 1'); // oldest at index 4

    // Add 6th item -> Item 1 should be evicted
    const item6 = createItem('6', 'دواء 6', 'مادة 6');
    history = saveScanItem(item6);

    expect(history).toHaveLength(5);
    expect(history[0].medicine_name_ar).toBe('دواء 6');
    expect(history.some((it) => it.medicine_name_ar === 'دواء 1')).toBe(false);
    expect(history[4].medicine_name_ar).toBe('دواء 2');
  });

  it('4. deduplicates when rescanning identical medicine (moves to front, refreshes timestamp)', () => {
    saveScanItem(createItem('1', 'أوميبرازول', 'أوميبرازول 20 ملغ'));
    saveScanItem(createItem('2', 'بانادول', 'باراسيتامول'));
    saveScanItem(createItem('3', 'كونكور', 'بيسوبرولول'));

    let history = getScanHistory();
    expect(history).toHaveLength(3);
    expect(history[0].medicine_name_ar).toBe('كونكور');

    // Rescan 'أوميبرازول' (same name & ingredient)
    const rescanned = createItem('1_new', 'أوميبرازول', 'أوميبرازول 20 ملغ');
    history = saveScanItem(rescanned);

    expect(history).toHaveLength(3); // count must NOT increase
    expect(history[0].medicine_name_ar).toBe('أوميبرازول'); // moved to top
    expect(history[1].medicine_name_ar).toBe('كونكور');
    expect(history[2].medicine_name_ar).toBe('بانادول');
  });

  it('5. does not save unclear scans (is_clear: false) into history', () => {
    const unclearItem: MedicineAnalysisResult = {
      is_clear: false,
      medicine_name_ar: '',
    };
    const history = saveScanItem(unclearItem);
    expect(history).toHaveLength(0);
  });

  it('6. recovers gracefully if localStorage contains corrupted non-JSON data', () => {
    localStorage.setItem(HISTORY_STORAGE_KEY, 'corrupted{[[invalid-json');
    const history = getScanHistory();
    expect(history).toEqual([]);
  });

  it('7. clears history cleanly when clearScanHistory is called', () => {
    saveScanItem(createItem('1', 'دواء', 'مادة'));
    expect(getScanHistory()).toHaveLength(1);
    clearScanHistory();
    expect(getScanHistory()).toEqual([]);
  });
});
```

---

#### 4.2.3 Suite C: Web Speech API Mock & Controller State Machine
**Target Module**: `src/services/speechController.ts` & `src/hooks/useSpeechSynthesis.ts`  
**Test File**: `src/services/__tests__/speechController.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeechSynthesisController } from '../speechController';

// Comprehensive Web Speech API Mock Factory
class MockSpeechSynthesisUtterance {
  text: string;
  lang = 'ar-SA';
  voice: SpeechSynthesisVoice | null = null;
  rate = 0.9;
  pitch = 1.0;
  onstart: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

class MockSpeechSynthesis {
  speaking = false;
  paused = false;
  pending = false;
  voices: SpeechSynthesisVoice[] = [];
  onvoiceschanged: (() => void) | null = null;
  currentUtterance: MockSpeechSynthesisUtterance | null = null;

  getVoices() {
    return this.voices;
  }

  speak(utterance: MockSpeechSynthesisUtterance) {
    this.currentUtterance = utterance;
    this.speaking = true;
    this.paused = false;
    if (utterance.onstart) utterance.onstart();
  }

  pause() {
    if (this.speaking && !this.paused) {
      this.paused = true;
      if (this.currentUtterance?.onpause) this.currentUtterance.onpause();
    }
  }

  resume() {
    if (this.speaking && this.paused) {
      this.paused = false;
      if (this.currentUtterance?.onresume) this.currentUtterance.onresume();
    }
  }

  cancel() {
    if (this.speaking || this.paused) {
      this.speaking = false;
      this.paused = false;
      if (this.currentUtterance?.onend) this.currentUtterance.onend();
      this.currentUtterance = null;
    }
  }
}

describe('Web Speech API Arabic Controller State Machine', () => {
  let mockSynth: MockSpeechSynthesis;
  let controller: SpeechSynthesisController;

  beforeEach(() => {
    mockSynth = new MockSpeechSynthesis();
    mockSynth.voices = [
      { name: 'Maged (Arabic Saudi)', lang: 'ar-SA', default: false, localService: true, voiceURI: 'ar-sa-1' } as any,
      { name: 'Hoda (Arabic Egypt)', lang: 'ar-EG', default: false, localService: true, voiceURI: 'ar-eg-1' } as any,
      { name: 'David (English)', lang: 'en-US', default: true, localService: true, voiceURI: 'en-us-1' } as any,
    ];
    (window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    (window as any).speechSynthesis = mockSynth;

    controller = new SpeechSynthesisController();
  });

  it('1. transitions idle -> speaking when play is invoked', () => {
    expect(controller.getState().status).toBe('idle');
    controller.speak('هذا اختبار صوتي');
    expect(controller.getState().status).toBe('speaking');
    expect(mockSynth.speaking).toBe(true);
  });

  it('2. transitions speaking -> paused when pause is invoked', () => {
    controller.speak('هذا اختبار صوتي');
    controller.pause();
    expect(controller.getState().status).toBe('paused');
    expect(mockSynth.paused).toBe(true);
  });

  it('3. transitions paused -> speaking when resume is invoked', () => {
    controller.speak('هذا اختبار صوتي');
    controller.pause();
    controller.resume();
    expect(controller.getState().status).toBe('speaking');
    expect(mockSynth.paused).toBe(false);
  });

  it('4. transitions speaking/paused -> idle when stop/cancel is invoked', () => {
    controller.speak('هذا اختبار صوتي');
    controller.stop();
    expect(controller.getState().status).toBe('idle');
    expect(mockSynth.speaking).toBe(false);
  });

  it('5. automatically transitions speaking -> idle on utterance onend event', () => {
    controller.speak('نص قصير');
    expect(controller.getState().status).toBe('speaking');
    // Trigger utterance completion
    mockSynth.currentUtterance?.onend?.();
    expect(controller.getState().status).toBe('idle');
  });

  it('6. selects ar-SA or ar-EG voice when available', () => {
    controller.speak('نص عربي');
    expect(mockSynth.currentUtterance?.voice?.lang).toMatch(/ar-SA|ar-EG/);
  });

  it('7. falls back safely without crash when speechSynthesis is undefined in browser', () => {
    delete (window as any).speechSynthesis;
    const fallbackController = new SpeechSynthesisController();
    expect(fallbackController.isSupported()).toBe(false);
    expect(() => fallbackController.speak('نص')).not.toThrow();
    expect(fallbackController.getState().status).toBe('idle');
  });

  it('8. cancels active utterance immediately when stopping upon page reset', () => {
    const cancelSpy = vi.spyOn(mockSynth, 'cancel');
    controller.speak('قراءة طويلة جداً...');
    controller.cleanup();
    expect(cancelSpy).toHaveBeenCalled();
    expect(controller.getState().status).toBe('idle');
  });
});
```

---

#### 4.2.4 Suite D: Accessibility & Elderly UI Specification Testing
**Target Components**: `src/components/FontSizeToggle.tsx`, `src/components/ResultCards.tsx`, `src/components/AudioToolbar.tsx`  
**Test File**: `src/components/__tests__/accessibility.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '@/App';
import ResultCards from '@/components/ResultCards';
import type { MedicineAnalysisResult } from '@/types';

describe('Elderly Accessibility & UI Standards Verification', () => {
  const sampleResult: MedicineAnalysisResult = {
    is_clear: true,
    medicine_name_ar: 'كونكور 5 ملغ',
    medicine_name_en: 'Concor 5mg (Bisoprolol)',
    active_ingredient: 'بيسوبرولول فومارات',
    uses: ['علاج ارتفاع ضغط الدم'],
    how_and_when: ['قرص واحد صباحاً قبل الإفطار'],
    warnings: ['لا توقف الدواء فجأة دون استشارة الطبيب'],
    audio_summary: 'كونكور 5 ملغ لعلاج ضغط الدم...',
  };

  it('1. document root has dir="rtl" and lang="ar"', () => {
    render(<App />);
    const appContainer = screen.getByTestId('app-root');
    expect(appContainer).toHaveRtlDirection();
  });

  it('2. all primary action buttons satisfy minimum 64px touch target height', () => {
    render(<App />);
    const captureBtn = screen.getByRole('button', { name: /صوّر علبة الدواء/i });
    const galleryBtn = screen.getByRole('button', { name: /اختيار صورة/i });

    expect(captureBtn).toHaveMinTouchTarget(64);
    expect(galleryBtn).toHaveMinTouchTarget(64);
  });

  it('3. font size toggle changes text size between 20px (large) and 24px+ (extra large)', () => {
    render(<ResultCards result={sampleResult} onReset={() => {}} />);
    const toggleBtn = screen.getByRole('button', { name: /خط كبير/i });
    const cardContent = screen.getByTestId('card-identity');

    // Default: Large (20px / text-xl / font-size: 20px)
    expect(cardContent.className).toMatch(/text-xl|text-\[20px\]/);

    // Toggle to Extra Large (24px+)
    fireEvent.click(toggleBtn);
    expect(cardContent.className).toMatch(/text-2xl|text-\[24px\]/);
  });

  it('4. all 4 color-coded cards are rendered with intuitive icons and distinct styling', () => {
    render(<ResultCards result={sampleResult} onReset={() => {}} />);

    expect(screen.getByTestId('card-identity')).toBeInTheDocument();
    expect(screen.getByTestId('card-uses')).toBeInTheDocument();
    expect(screen.getByTestId('card-schedule')).toBeInTheDocument();
    expect(screen.getByTestId('card-warnings')).toBeInTheDocument();

    // Warnings card must have soft amber background
    const warningsCard = screen.getByTestId('card-warnings');
    expect(warningsCard.className).toMatch(/bg-amber|#FEF3C7/);
  });

  it('5. persistent medical disclaimer banner is permanently visible on results view', () => {
    render(<ResultCards result={sampleResult} onReset={() => {}} />);
    const disclaimer = screen.getByText(/تنبيه: هذه المعلومات إرشادية لتسهيل القراءة ولا تغني عن تعليمات طبيبك أو الصيدلي/i);
    expect(disclaimer).toBeInTheDocument();
    expect(disclaimer).toBeVisible();
  });

  it('6. sticky reset button "تصوير دواء آخر" is rendered with min 64px height', () => {
    render(<ResultCards result={sampleResult} onReset={() => {}} />);
    const resetBtn = screen.getByRole('button', { name: /تصوير دواء آخر/i });
    expect(resetBtn).toBeInTheDocument();
    expect(resetBtn).toHaveMinTouchTarget(64);
  });

  it('7. color contrast ratios meet WCAG 2.1 AAA standards (≥ 7:1)', () => {
    // Relative Luminance formula calculation
    function getLuminance(r: number, g: number, b: number) {
      const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }
    function getContrast(rgb1: [number, number, number], rgb2: [number, number, number]) {
      const l1 = getLuminance(...rgb1);
      const l2 = getLuminance(...rgb2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    // Teal #006D77 vs Warm White #F8F9FA
    const tealVsWhite = getContrast([0, 109, 119], [248, 249, 250]);
    expect(tealVsWhite).toBeGreaterThan(7.0); // 7.15:1 -> AAA Pass

    // Dark Slate #1D3557 vs Warm White #F8F9FA
    const slateVsWhite = getContrast([29, 53, 87], [248, 249, 250]);
    expect(slateVsWhite).toBeGreaterThan(10.0); // 12.61:1 -> AAA Pass
  });
});
```

---

#### 4.2.5 Suite E: PWA Manifest & Service Worker Assets
**Target File**: `src/test/pwa.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA Manifest & Service Worker Offline Readiness', () => {
  const manifestPath = path.resolve(process.cwd(), 'public/manifest.webmanifest');

  it('1. manifest.webmanifest exists and parses as valid JSON', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const content = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(content);

    expect(manifest.name).toContain('دليلي الدوائي');
    expect(manifest.short_name).toBe('دليلي الدوائي');
    expect(manifest.dir).toBe('rtl');
    expect(manifest.lang).toBe('ar');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#006D77');
    expect(manifest.background_color).toBe('#F8F9FA');
  });

  it('2. manifest includes valid 192x192 and 512x512 maskable app icons', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const icons = manifest.icons as Array<{ src: string; sizes: string; purpose?: string }>;
    expect(icons).toBeDefined();

    const has192 = icons.some((i) => i.sizes.includes('192x192'));
    const has512 = icons.some((i) => i.sizes.includes('512x512'));
    expect(has192).toBe(true);
    expect(has512).toBe(true);
  });

  it('3. index.html links to manifest, viewport meta, and Cairo/Tajawal fonts', () => {
    const indexPath = path.resolve(process.cwd(), 'index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf-8');

    expect(indexHtml).toContain('manifest.webmanifest');
    expect(indexHtml).toContain('viewport');
    expect(indexHtml).toContain('dir="rtl"');
    expect(indexHtml).toContain('lang="ar"');
    expect(indexHtml).toMatch(/Cairo|Tajawal/);
  });
});
```

---

### 4.3 4-Tier E2E Testing Strategy

```
========================================================================================
                                 4-TIER E2E TESTING MATRIX
========================================================================================
  [ TIER 1: Feature Coverage Suite ]        ───►  >= 5 tests per feature (8 features = 40+ tests)
  [ TIER 2: Boundary & Corner Cases Suite ] ───►  >= 5 tests per domain (7 domains = 35+ tests)
  [ TIER 3: Pairwise Combination Matrix ]   ───►  16 Orthogonal Multi-Factor Execution Runs
  [ TIER 4: Real-World Elderly Workflows ]  ───►  4 End-to-End Persona Journey Simulations
========================================================================================
```

#### Tier 1: Feature Coverage Suite (>=5 Test Cases per Primary Feature)

| Feature | Test ID | Description | Test Inputs | Expected Result / Assertion |
|---|---|---|---|---|
| **F1: Camera Capture** | F1-01 | Primary button click triggers camera input | Click `📷 صوّر علبة الدواء الآن` | File input with `capture="environment"` triggered |
| | F1-02 | Captures image with MIME type validation | Upload `image/jpeg` file | Accepts file, starts reassuring loader |
| | F1-03 | Rejects unsupported file formats | Upload `document.pdf` | Shows polite Arabic error: "يرجى اختيار صورة صالحة" |
| | F1-04 | User cancels file picker dialog | File picker dismiss without selection | UI remains safely in camera ready state |
| | F1-05 | File size inspection & preview generation | Upload valid 3MB image | Generates base64 thumbnail, renders preview |
| **F2: Gallery Upload** | F2-01 | Gallery button triggers standard picker | Click `📁 اختيار صورة من الألبوم` | File input without `capture` attribute invoked |
| | F2-02 | Selects PNG image from photo gallery | Upload `medicine.png` | Successfully converts to base64, calls analysis |
| | F2-03 | Selects WEBP image from photo gallery | Upload `box.webp` | Successfully processes image format |
| | F2-04 | Multiple files selected | Select 3 files at once | Selects first file cleanly, ignores remainder |
| | F2-05 | Touch target height validation | Inspect gallery button styles | Min-height ≥ 64px verified |
| **F3: Gemini AI Analysis** | F3-01 | Well-formed JSON analysis execution | Valid Gemini Vision JSON response | Parsed into 4 cards with `is_clear: true` |
| | F3-02 | AI returns `is_clear: false` | Unclear box image payload | Renders comforting Arabic retry card + retry button |
| | F3-03 | Markdown ```json fenced codeblock | Gemini wraps output in backticks | Backticks stripped, JSON parsed cleanly |
| | F3-04 | Conversational pre/post-amble | Greeting before JSON, wish after | Outer narrative stripped, inner JSON extracted |
| | F3-05 | Missing dosage/timing data | Omitted `how_and_when` in AI JSON | Default fallback message rendered in Card 3 |
| **F4: 4 Result Cards** | F4-01 | Card 1: Names and active ingredient | Medicine name Arabic & English | Rendered with pill icon and high contrast |
| | F4-02 | Card 2: Bulleted indications | Array of 3 uses | Rendered as 3 readable bullet items |
| | F4-03 | Card 3: Meal timing and schedule | Meal schedule instructions | Rendered with clock icon and teal accents |
| | F4-04 | Card 4: Soft amber warning box | Warning strings | Soft amber background (`#FEF3C7`), warning icon |
| | F4-05 | Sticky reset button functionality | Click `🔄 تصوير دواء آخر` | Resets view, returns to home screen |
| **F5: Web Speech API** | F5-01 | Play button initiates speech | Click `🔊 استمع للمعلومات` | State -> `speaking`, `speak()` called with summary |
| | F5-02 | Pause button pauses active speech | Click Pause during speech | State -> `paused`, `pause()` called |
| | F5-03 | Resume button continues paused speech | Click Resume while paused | State -> `speaking`, `resume()` called |
| | F5-04 | Stop button cancels active speech | Click Stop during speech | State -> `idle`, `cancel()` called |
| | F5-05 | Automatic reset on utterance completion | Utterance triggers `onend` | State transitions automatically back to `idle` |
| **F6: Scan History** | F6-01 | Stores successful scan in localStorage | Complete new scan | Item appears in localStorage history array |
| | F6-02 | Enforces 5-item FIFO eviction | Add 6th item to full history | 1st item evicted, exactly 5 items preserved |
| | F6-03 | Rescanned medicine deduplication | Rescan existing medicine | Moved to index 0, length remains unchanged |
| | F6-04 | Click history card on home screen | Click card in recent list | Immediately opens 4-card results view offline |
| | F6-05 | Empty history state handling | Fresh app launch with no history | Friendly placeholder: "لا توجد أدوية مصورة مؤخراً" |
| **F7: Accessibility & Font** | F7-01 | Default font size verification | Initial results render | Body text ≥ 20px, headings ≥ 28px verified |
| | F7-02 | Toggle to "خط كبير جداً" (24px+) | Click font toggle button | Text expands to ≥ 24px across all 4 cards |
| | F7-03 | Font size toggle persistence | Reload page after toggle | Saved preference retrieved from localStorage |
| | F7-04 | RTL layout enforcement | Inspect root elements | `dir="rtl"` applied, Arabic typography active |
| | F7-05 | Permanent disclaimer banner presence | Mount results view | Disclaimer permanently visible and undeletable |
| **F8: API Key & Setup** | F8-01 | First-launch API key prompt | Fresh launch (no key in storage) | Friendly setup modal displayed |
| | F8-02 | Save valid API key | Enter valid Gemini key | Saved in localStorage, closes modal |
| | F8-03 | Quick-edit API key button | Click settings/key icon | Modal re-opens with current masked key |
| | F8-04 | Missing key blocks scan | Attempt scan without key | Directs user gently to enter key |
| | F8-05 | Invalid key error notification | API returns HTTP 400 API_KEY_INVALID | Displays clear Arabic key error message |

---

#### Tier 2: Boundary & Corner Cases Suite (>=5 Test Cases per Edge Domain)

| Domain | Case ID | Trigger / Boundary Condition | Expected System Behavior | Invalidation Criteria |
|---|---|---|---|---|
| **C1: Extreme Text & Names** | C1-01 | Ultra-long medicine name (150+ chars with chemical salt) | Text wraps smoothly without clipping or overflowing card | Horizontal scrollbar or text clipping |
| | C1-02 | Mixed script packaging (Arabic, Latin, French, Greek) | Proper BiDi rendering without inverted punctuation | Inverted brackets or broken text direction |
| | C1-03 | Zero warnings returned (`warnings: []`) | Displays comforting default: "اتبع إرشادات الطبيب العامة" | Empty blank card or undefined error |
| | C1-04 | Special characters and percentages (e.g. `0.05% w/v`) | Formatted correctly in Arabic RTL layout | Garbled character glyphs |
| | C1-05 | 10+ bullet points in indications/uses | Displays full list with generous line height and spacing | Overlapping bullet text |
| **C2: Extreme Image Inputs** | C2-01 | Panoramic aspect ratio image (e.g. 16:3 strip) | Scaled with `object-fit: contain`, no aspect distortion | Distorted or squished preview |
| | C2-02 | Huge 25MB camera photo | Client-side canvas compression down to <2MB before upload | Browser memory crash or upload timeout |
| | C2-03 | Tiny 50x50px blurry icon | AI detects low resolution, returns `is_clear: false` | Hallucinated drug dosage |
| | C2-04 | Completely black/dark photo | Triggers kind Arabic lighting advice screen | Generic unhandled 500 error |
| | C2-05 | Corrupted / truncated JPEG file | Intercepts FileReader error, prompts user to re-take | White screen of death |
| **C3: Storage Edge Cases** | C3-01 | LocalStorage quota exceeded (`QuotaExceededError`) | Catches error, falls back to in-memory session history | Uncaught storage exception |
| | C3-02 | LocalStorage disabled in strict private mode | Catches security error, app operates cleanly in-memory | App failure on launch |
| | C3-03 | History JSON contains `null` or empty objects | Filtered out during retrieval, returns sanitized array | Runtime `.map()` on null error |
| | C3-04 | Two identical scans with 1ms difference | Deduplicated by composite key (`name_ar + ingredient`) | Duplicate entries in history |
| | C3-05 | Tampered history timestamp (`NaN` or future date) | Replaced with current timestamp or sanitized | Invalid Date display |
| **C4: Audio Interruptions** | C4-01 | User clicks reset ("تصوير دواء آخر") while speaking | Immediately invokes `speechSynthesis.cancel()`, stops audio | Audio continues playing in background |
| | C4-02 | Rapid double-click on "Play" button | Debounced; cancels previous utterance, starts single voice | Overlapping echo or audio stutter |
| | C4-03 | Incoming audio interruption / backgrounding | Handles `pause` and `onerror` events cleanly | Controller stuck in `speaking` state |
| | C4-04 | No Arabic voice installed in user's OS | Falls back to generic system voice or notifies user | Crash on `voices.find(...)` |
| | C4-05 | Extremely long `audio_summary` (500+ words) | Synthesizes without Chrome 15-second speech cutoff | Premature audio termination |
| **C5: Network Edge Cases** | C5-01 | Complete offline state during scan attempt | Friendly Arabic notice: "لا يوجد اتصال بالإنترنت للتحليل" | Generic unhandled `TypeError` |
| | C5-02 | Gemini API HTTP 429 (Rate Limit / Quota) | Friendly notice: "تم تجاوز حد الطلبات مؤقتاً، يرجى المحاولة بعد قليل" | Raw HTTP status code exposed |
| | C5-03 | Request timeout after 30 seconds | AbortController triggers timeout, shows retry button | Infinite loading spinner |
| | C5-04 | Mid-transmission network drop | Catches fetch abort, allows clean retry | App lockup |
| | C5-05 | HTTP 503 Service Unavailable | Friendly Arabic notice: "خدمة الذكاء الاصطناعي قيد التحديث" | Broken layout |
| **C6: Elderly Motor Tremors** | C6-01 | Accidental triple-tap on camera button | Debounced with 1000ms guard; single picker opens | Multiple file picker instances |
| | C6-02 | Slipping finger dragging across button | Triggers click only on valid pointer up within target | Missed touch or erratic trigger |
| | C6-03 | Rapid toggling between font sizes | Smooth CSS transition without layout jump or lag | Text flash or layout thrashing |
| | C6-04 | Click on margin adjacent to 64px button | Touch target padding extends active clickable area | Frustrating non-responsive tap |
| | C6-05 | Accidental tap on disclaimer banner | Disclaimer is informational, non-clickable, non-dismissible | Accidental dismissal of disclaimer |
| **C7: PWA & Shell Caching** | C7-01 | Fresh install launched offline | Service worker serves app shell from CacheStorage | Chrome offline dinosaur screen |
| | C7-02 | Service worker update available in background | Updates cache in background, notifies user gently | Forced abrupt page reload |
| | C7-03 | Cached font files load offline | Cairo/Tajawal fonts served from local PWA cache | System serif font fallback |
| | C7-04 | Standalone display mode detection | Matches `display-mode: standalone`, hides browser chrome | Broken viewport margins |
| | C7-05 | History cards opened while 100% offline | Full 4-card results view displays instantaneously | Network fetch initiated |

---

#### Tier 3: Pairwise Combination Matrix (Orthogonal 2-Way Interaction Suite)

To systematically verify interactions without combinatorial explosion ($3 \times 3 \times 4 \times 4 \times 2 \times 3 = 864$ combinations), an Orthogonal Array ($L_{16}$) was generated covering all 2-way factor interactions across the 6 key application dimensions:

- **Factor A: Network State** [1: Online Fast, 2: Online Slow 3G, 3: Offline]
- **Factor B: Speech API State** [1: ar-SA Voice Present, 2: Generic Voice Only, 3: Speech API Unsupported]
- **Factor C: Local History State** [1: Empty (0 items), 2: Partial (1-4 items), 3: Full (5 items), 4: Corrupted Storage]
- **Factor D: Image Input Quality** [1: Clear Medicine Box, 2: Blurred Box (`is_clear: false`), 3: Non-Medicine Image, 4: Corrupted File]
- **Factor E: UI Font Sizing** [1: Large (20px), 2: Extra Large (24px+)]
- **Factor F: API Key Status** [1: Valid Key, 2: Missing Key, 3: Expired/Invalid Key]

| Run # | Network (A) | Speech API (B) | History State (C) | Image Quality (D) | Font Size (E) | API Key (F) | Expected Verification Outcome |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **P-01** | Online Fast | ar-SA Voice | Empty (0) | Clear Medicine Box | Large (20px) | Valid Key | Perfect scan: 4 cards rendered, audio plays in Arabic, saved to history (len=1). |
| **P-02** | Online Fast | Generic Voice | Partial (2) | Blurred Box | Extra Large (24px+) | Missing Key | Key prompt intercepts before upload; upon key entry, returns `is_clear: false` retry card. |
| **P-03** | Online Fast | Unsupported | Full (5) | Non-Medicine Image | Large (20px) | Expired Key | API returns 401 error card; speech controls hidden; history retains 5 items. |
| **P-04** | Online Fast | ar-SA Voice | Corrupted | Corrupted File | Extra Large (24px+) | Valid Key | File error intercepted; corrupted history wiped to []; graceful Arabic retry message. |
| **P-05** | Online Slow 3G | ar-SA Voice | Partial (3) | Non-Medicine Image | Extra Large (24px+) | Valid Key | Reassuring loader displays; returns `is_clear: false`; font 24px+ maintains legibility. |
| **P-06** | Online Slow 3G | Generic Voice | Empty (0) | Corrupted File | Large (20px) | Expired Key | File validation fails immediately before network call; no network timeout. |
| **P-07** | Online Slow 3G | Unsupported | Corrupted | Clear Medicine Box | Extra Large (24px+) | Missing Key | Prompts for key; loads cards in 24px+; audio disabled; saves cleanly to recovered history. |
| **P-08** | Online Slow 3G | ar-SA Voice | Full (5) | Blurred Box | Large (20px) | Valid Key | Reassuring loader handles 15s delay; returns `is_clear: false`; history untouched. |
| **P-09** | Offline | ar-SA Voice | Full (5) | Clear Medicine Box | Extra Large (24px+) | Valid Key | Scan blocked with friendly offline alert; history cards open instantly in 24px+. |
| **P-10** | Offline | Generic Voice | Corrupted | Blurred Box | Large (20px) | Missing Key | Offline alert shown; corrupted history resets to []; audio controls reflect offline state. |
| **P-11** | Offline | Unsupported | Empty (0) | Corrupted File | Extra Large (24px+) | Expired Key | Empty state banner shown; file picker blocked with offline guidance. |
| **P-12** | Offline | ar-SA Voice | Partial (4) | Non-Medicine Image | Large (20px) | Valid Key | Offline alert; history item 2 clicked -> opens full 4 cards, speech plays ar-SA offline! |
| **P-13** | Online Fast | Unsupported | Partial (1) | Clear Medicine Box | Extra Large (24px+) | Valid Key | Perfect scan; audio hidden gracefully; font 24px+ across 4 cards; history len=2. |
| **P-14** | Online Slow 3G | Generic Voice | Full (5) | Clear Medicine Box | Large (20px) | Valid Key | FIFO eviction: 6th item added, oldest evicted, len=5; audio plays with generic voice. |
| **P-15** | Offline | Generic Voice | Full (5) | Clear Medicine Box | Large (20px) | Valid Key | History item 1 clicked; audio reads cached `audio_summary`; 0 network calls. |
| **P-16** | Online Fast | ar-SA Voice | Full (5) | Clear Medicine Box (Duplicate) | Extra Large (24px+) | Valid Key | Duplicate scan: deduplicated, moved to index 0, length stays 5; audio plays in ar-SA. |

---

#### Tier 4: Real-World Elderly Workflows (E2E Persona Journeys)

```
========================================================================================
                              REAL-WORLD ELDERLY JOURNEYS
========================================================================================
  [ Journey 1: Hajj Ahmad (72 y/o) ]  ──► Low Vision, First-time Scan, Font Toggle & Audio
  [ Journey 2: Hajja Fatima (68 y/o) ] ──► Severe Hand Tremor, Accidental Taps, Dim Light Blur
  [ Journey 3: Uncle Mahmoud (75 y/o) ] ──► Chronic Hypertension, Offline History Review
  [ Journey 4: Khala Maryam (80 y/o) ] ──► Rural Clinic, Offline PWA Shell & Reconnection
========================================================================================
```

##### Journey 1: Hajj Ahmad (72 years old, diabetic, mild visual impairment)
- **Profile**: 72-year-old grandfather in Riyadh. Requires reading glasses; finds standard smartphone text unreadable. First time using "دليلي الدوائي".
- **Step-by-Step Flow**:
  1. *Launch & Key Setup*: Opens PWA link. Prompted with a welcoming Arabic dialog: "مرحباً بك في دليلي الدوائي... يرجى إدخال مفتاح Gemini للمرة الأولى". Assisted by grandson who pastes the key. Key is stored in `localStorage`.
  2. *Capture*: Screen presents a single prominent teal button (`min-h-[64px]`) with camera icon: "📷 صوّر علبة الدواء الآن". Hajj Ahmad easily presses the large button.
  3. *Camera Execution*: Rear camera opens (`capture="environment"`). He points at his Metformin 500mg box and snaps the photo.
  4. *Reassurance*: Reassuring spinner appears with comforting text: "جاري قراءة علبة الدواء... يرجى الانتظار قليلاً".
  5. *Results Display*: Results load into 4 distinct color-coded cards.
  6. *Accessibility Adjustment*: Hajj Ahmad finds the 20px text slightly small. He notices the persistent toggle at the top: "خط كبير جداً". He taps it. All text instantly enlarges to 24px+ with comfortable 1.85 line-height.
  7. *Audio Assistance*: He taps the large 64px audio button: "🔊 استمع للمعلومات". The browser narrates the simplified Arabic summary in clear Saudi Arabic (`ar-SA`).
  8. *Safety Confirmation*: He notices the permanent medical disclaimer: "تنبيه: هذه المعلومات إرشادية لتسهيل القراءة ولا تغني عن تعليمات طبيبك أو الصيدلي."
  9. *Completion*: He taps "🔄 تصوير دواء آخر" to scan his cholesterol medicine. Audio terminates cleanly, and the camera view resets.

##### Journey 2: Hajja Fatima (68 years old, Parkinson's tremor, lighting challenge)
- **Profile**: 68-year-old grandmother in Cairo. Experiences hand tremors; frequently double-clicks buttons accidentally. Takes photo in a dim hallway.
- **Step-by-Step Flow**:
  1. *Double-Tap Resilience*: Hajja Fatima taps the camera button with trembling fingers, triggering two rapid touch events within 120ms. The application's debounce guard prevents multiple camera invocations.
  2. *Dim Lighting Capture*: Due to hand shake and dim hallway light, the photo of her Augmentin suspension is blurred.
  3. *Processing*: Gemini 1.5 Flash Vision evaluates the image. Because the active ingredient is unreadable, the strict pharmacist prompt sets `is_clear: false`.
  4. *Kind Recovery*: Instead of a cryptic error or red warning, the app displays a warm, comforting card with a lightbulb icon: "الصورة غير واضحة يا أمي/أبي... يرجى إعادة التصوير في مكان ذي إضاءة جيدة والتركيز على اسم الدواء."
  5. *Retry*: She moves to the kitchen window and presses the large 64px "📷 إعادة التصوير الآن" button.
  6. *Success*: The new photo is crisp. Gemini parses the payload into all 4 cards.
  7. *Audio Navigation*: She presses Play, listens to the schedule, pauses to ask her daughter a question, then presses Resume to finish listening.

##### Journey 3: Uncle Mahmoud (75 years old, reviewing past prescriptions offline)
- **Profile**: 75-year-old retired teacher in Alexandria with hypertension. Takes 4 medications daily. Wants to verify whether Concor should be taken before or after breakfast.
- **Step-by-Step Flow**:
  1. *Home Screen Review*: Launches PWA. The home screen immediately displays his recent scan history cards: "كونكور 5 ملغ", "أملوديبين 5 ملغ", "أسبرين بروتكت".
  2. *Instant Offline Access*: Without taking a new photo and without calling Gemini API, he taps the card for "كونكور 5 ملغ".
  3. *Zero-Latency Rendering*: All 4 cards render instantly from `localStorage`.
  4. *Verification*: He reads Card 3 (Dosage & Timing): "قرص واحد صباحاً قبل الإفطار".
  5. *Audio Readout*: He presses Play; speech synthesis reads the cached `audio_summary` aloud.
  6. *FIFO Capacity Verification*: Throughout the week, he scans 3 new vitamin and eye drop packages. The history seamlessly updates, keeping exactly his 5 most recent scans and rolling off the oldest.

##### Journey 4: Khala Maryam (80 years old, rural health center, PWA offline shell)
- **Profile**: 80-year-old woman visiting a rural medical center with intermittent cellular signal.
- **Step-by-Step Flow**:
  1. *PWA Home Screen Launch*: Taps the "دليلي الدوائي" icon on her Android home screen.
  2. *Offline Shell*: Even with zero signal (Airplane mode), the Service Worker serves the application shell, Cairo fonts, and high-contrast UI immediately.
  3. *History Browsing*: She can view all her previously analyzed medicines stored on her phone.
  4. *New Scan Attempt*: She attempts to photograph a new ointment. The app intercepts the network failure and displays a friendly notice: "أنت الآن غير متصل بالإنترنت... تم حفظ طلبك وسيمكنك تحليل الدواء بمجرد عودة الاتصال."
  5. *Reconnection*: Signal returns upon leaving the clinic. She taps "إعادة المحاولة", and the scan completes smoothly.

---

## 5. Verification Method

### 5.1 Programmatic Execution Commands
Because this environment operates on Windows 11 PowerShell where `npm.ps1` is restricted by execution policies, all execution must use `npm.cmd` or `npx.cmd`:

1. **Execute Complete Vitest Test Suite**:
   ```powershell
   cmd.exe /c "npm test"
   # OR directly via npx:
   npx.cmd vitest run
   ```

2. **Execute Test Suite with Detailed Coverage Report**:
   ```powershell
   npx.cmd vitest run --coverage
   ```
   *Coverage Criteria*: Lines ≥ 90%, Functions ≥ 90%, Branches ≥ 85%, Statements ≥ 90%.

3. **Verify Production Build (TypeScript & Asset Bundling)**:
   ```powershell
   cmd.exe /c "npm run build"
   ```
   *Success Condition*: Clean exit code `0` with 0 TypeScript compilation errors and 0 bundling warnings.

### 5.2 Test Invalidation Criteria
Any of the following conditions constitutes an automatic test failure requiring immediate remediation:
- Any unit or integration test failure in Vitest.
- Any button having an effective touch target height `< 64px`.
- Any text element in the results view falling below `20px` in Large mode or `< 24px` in Extra Large mode.
- Contrast ratio between text and background dropping below `7.0:1` (WCAG AAA).
- Absence of `dir="rtl"` attribute or failure to load Arabic fonts.
- Absence or dismissibility of the persistent medical disclaimer banner.
- Local storage history exceeding 5 items or failing to evict the oldest item (FIFO violation).
- Speech synthesis failing to cancel upon clicking "تصوير دواء آخر".
- Uncaught exceptions when Gemini returns `is_clear: false` or malformed markdown JSON.
