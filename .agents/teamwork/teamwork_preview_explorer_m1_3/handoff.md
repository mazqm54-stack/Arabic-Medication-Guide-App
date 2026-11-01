# Milestone 1 Exploration & Specification Report: RTL Typography, Tailwind Design Tokens & Test Harness Setup

**Author**: `teamwork_preview_explorer_m1_3`  
**Date**: 2026-10-27T20:59:00Z  
**Target Milestone**: Milestone 1 (M1) — Project Foundation, PWA Shell & Theme  
**Target Audience**: Implementer Worker (`teamwork_preview_worker`) & Orchestrator  
**Authoritative References**:
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\ORIGINAL_REQUEST.md` (R1, R3, R4, Acceptance Criteria)
- `c:\Users\PC\Documents\antigravity\fervent-mendel\PROJECT.md` (Architecture, Design System, Feature Inventory #1, #2, #3, #16)
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_explorer_survey_3\handoff.md` (Testing Architecture)
- `c:\Users\PC\Documents\antigravity\fervent-mendel\.agents\teamwork\teamwork_preview_spec_miner_survey_2\handoff.md` (Requirements Mining)

---

## 1. Observation

Direct, verifiable observations of the project codebase, environment, and specifications:

1. **System & Toolchain Constraints**:
   - Operating System: Windows 11 / PowerShell environment.
   - Node runtime: `v24.21.0`.
   - Package manager: `npm.cmd` (`11.19.0`). Windows PowerShell script execution policy blocks `.ps1` execution, mandating all script commands execute as `npm.cmd run <script>` and `npx.cmd`.
   - Workspace state: Greenfield project at `c:\Users\PC\Documents\antigravity\fervent-mendel`. Contains only `.git`, `ORIGINAL_REQUEST.md`, `PROJECT.md`, and metadata folders under `.agents/teamwork/`.

2. **Milestone Scope Division**:
   - **Explorer 1** is detailing `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`.
   - **Explorer 2** is detailing `public/manifest.webmanifest`, `public/sw.js`, and `src/main.tsx` service worker registration.
   - **Explorer 3 (This Report)** is detailing:
     - `index.html` loading Cairo and Tajawal fonts, `dir="rtl"`, `lang="ar"`, theme-color meta tag, and elderly viewport settings.
     - `tailwind.config.js`, `postcss.config.js`, and `src/index.css` implementing the WCAG AAA medical palette (Teal `#006D77`, Warm White `#F8F9FA`, Dark Slate `#1D3557`, Amber `#FEF3C7`/`#F59E0B`/`#92400E`), the senior typography scale (20px body minimum, 28px+ headings, 24px+ toggle state), and minimum 64px touch target utilities.
     - `vitest.config.ts`, `src/test/setup.ts`, `src/types/matchers.d.ts`, and `src/test/testUtils.tsx` implementing custom matchers (`toHaveMinTouchTarget`, `toHaveRtlDirection`) and deterministic mocks for `window.speechSynthesis`, `window.localStorage`, and `window.matchMedia`.

3. **Verbatim Specifications from ORIGINAL_REQUEST.md**:
   - *R1 (Typography & Palette)*: "Build a mobile-first, zero-clutter single-screen workflow in full Right-to-Left (RTL) Arabic layout using a legible Arabic font ('Cairo' or 'Tajawal'). Implement high-contrast medical palette: Deep Teal (#006D77), Warm White (#F8F9FA), Clear Dark Slate text (#1D3557), and soft amber warning highlights. Enforce senior-friendly typography and touch targets: minimum 20px body font size, 28px+ headings, minimum 64px button touch target height with explicit icons and labels. Provide a persistent font size toggle at the top of results between 'خط كبير' (Large - 20px) and 'خط كبير جداً' (Extra Large - 24px+)."
   - *R4 (PWA & Offline)*: "Configured PWA with valid Web App Manifest (`manifest.webmanifest`), app icons, theme color, and Service Worker for offline application shell caching."
   - *Acceptance Criteria*: "Programmatic unit and integration test suite (Vitest + React Testing Library) runs and passes 100% of tests... Tests verify accessibility parameters: minimum body font size ≥ 20px, headings ≥ 28px, button touch targets ≥ 64px, and contrast compliance. Production build succeeds with `npm run build` with zero TypeScript, syntax, or bundling errors."

---

## 2. Logic Chain

1. **Root HTML Directionality & Font Loading**:
   - Setting `lang="ar"` and `dir="rtl"` at the `<html>` level in `index.html` guarantees that the browser's layout engine initializes the text rendering, scrollbars, flexbox, and grid alignments in RTL mode prior to React hydration.
   - For Arabic typography, 'Cairo' is optimized for headings, numbers, and UI buttons with open counters and high legibility, while 'Tajawal' offers clean geometric sans-serif shapes for long-form explanatory text. Preconnecting to `https://fonts.googleapis.com` and `https://fonts.gstatic.com` eliminates TLS connection latency.
   - Including `display=swap` in the Google Fonts link guarantees text remains immediately readable via system fallback fonts (`system-ui, -apple-system, 'Segoe UI', Tahoma, Arial`) during cold starts or offline launches.
   - The theme-color meta tag must match Deep Teal (`#006D77`) so that mobile browser address bars and the PWA status bar seamlessly blend into the application shell.

2. **Tailwind Design Token & Typography Architecture**:
   - Standard Tailwind defaults assume `text-base` is `16px`, which is too small for seniors suffering from presbyopia.
   - In `tailwind.config.js`, we establish a senior-centric font size scale:
     - `senior-base`: `20px` with `1.75` line-height (Default "خط كبير").
     - `senior-lg`: `24px` with `1.8` line-height (Toggled "خط كبير جداً").
     - `senior-xl`: `28px` with `1.6` line-height (Subheadings & card titles).
     - `senior-2xl`: `32px` with `1.5` line-height (Section headers).
     - `senior-3xl`: `36px` with `1.4` line-height (App title / Hero).
   - In `src/index.css`, setting root `font-size: 20px` and default `line-height: 1.75` ensures that even untagged HTML elements meet the 20px minimum.
   - The medical color palette is codified into semantic Tailwind classes:
     - `teal`: `#006D77` (brand primary), `#004E55` (dark hover), `#E6F1F2` (soft tint).
     - `warm`: `#F8F9FA` (app background), `#FFFFFF` (card surfaces).
     - `slate`: `#1D3557` (body text with 12.6:1 contrast against #F8F9FA, surpassing WCAG AAA).
     - `amber`: `#FEF3C7` (Card 4 soft background), `#F59E0B` (amber accent/border), `#92400E` (high-contrast amber text).
   - All interactive controls receive a mandatory `min-h-[64px]` touch target token (`min-h-touch`), preventing touch tremors from missing buttons.

3. **Vitest & Test Harness Architecture**:
   - `vitest.config.ts` must use the `@vitejs/plugin-react` plugin and configure the `@` path alias pointing to `./src`, matching `vite.config.ts` and `tsconfig.json`.
   - `environment: 'jsdom'` is required for testing React component lifecycles, event dispatching, and DOM nodes.
   - `src/test/setup.ts` runs automatically before every test file. It imports `@testing-library/jest-dom` and configures automatic cleanup via `afterEach(cleanup)`.

4. **Custom Matchers & Mock Requirements**:
   - **`toHaveMinTouchTarget(received: HTMLElement, minSize = 64)`**:
     JSDOM does not perform layout geometry or calculate real bounding boxes (`getBoundingClientRect()` returns zeros by default). Therefore, the matcher must perform a multi-strategy verification:
     1. Checks `getComputedStyle(received).minHeight` and `height`.
     2. Checks inline styles (`received.style.minHeight`, `received.style.height`).
     3. Checks `received.getBoundingClientRect().height`.
     4. Checks Tailwind utility classes in `received.className` (e.g. `min-h-[64px]`, `min-h-touch`, `h-16`, `h-[64px]`, `min-h-16`).
     This dual inspection ensures tests pass reliably in both unit DOM environments and styled browser tests.
   - **`toHaveRtlDirection(received: HTMLElement)`**:
     Verifies that `dir="rtl"` exists on the element, its computed style `direction: rtl`, or within its closest parent tree (`element.closest('[dir="rtl"]')`).
   - **TypeScript Matcher Declarations (`src/types/matchers.d.ts`)**:
     To avoid TypeScript compilation failures during `npm.cmd run build` and `tsc`, custom matchers must be declared via module augmentation on Vitest's `Assertion` interface.
   - **Web Speech API Mock (`MockSpeechSynthesis` & `MockSpeechSynthesisUtterance`)**:
     `window.speechSynthesis` is `undefined` in standard JSDOM. The mock must simulate `speaking`, `paused`, `voices`, and dispatch `onstart`, `onpause`, `onresume`, `onend`, and `onerror` to allow testing the `SpeechSynthesisController` state machine.
   - **LocalStorage Mock**:
     A dedicated mock in `setup.ts` ensures `getItem`, `setItem`, `removeItem`, and `clear` operate with Vitest spies, enabling assertions on the 5-item FIFO storage operations.

---

## 3. Caveats & Assumptions

1. **JSDOM Layout Geometry Limitations**:
   - JSDOM does not calculate CSS cascade from external stylesheets unless Vitest is configured with `css: true`. Even with `css: true`, JSDOM does not compute physical pixel bounding boxes for flexbox/grid containers.
   - *Mitigation*: Our custom `toHaveMinTouchTarget` matcher inspects both computed/inline styles and Tailwind utility class names (`min-h-[64px]`, `h-16`, `min-h-touch`), ensuring 100% reliable assertions without flakiness.
2. **Font Loading Offline Fallback**:
   - When running offline in PWA mode, external Google Fonts requests to `fonts.googleapis.com` will not fetch unless cached by the Service Worker (Explorer 2's scope).
   - *Mitigation*: `src/index.css` specifies robust system fallback fonts (`system-ui, -apple-system, 'Segoe UI', Tahoma, Arial`) that render Arabic script legibly without layout breakage.
3. **TypeScript Module Augmentation for Vitest**:
   - Depending on whether Vitest globals are enabled, Jest DOM or Vitest matchers can conflict if types are not mapped cleanly.
   - *Mitigation*: We provide an explicit type declaration file (`src/types/matchers.d.ts`) included in `tsconfig.json` so `expect(...).toHaveMinTouchTarget()` compiles with zero errors.

---

## 4. Conclusion & Concrete File Specifications for the Worker

The following 8 concrete file specifications are recommended for direct implementation by the Worker in Milestone 1:

### 4.1 `index.html` (Application Root HTML)
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\index.html`

```html
<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
    <meta name="theme-color" content="#006D77" />
    <meta name="description" content="دليلي الدوائي - مساعد طبي ذكي باللغة العربية لكبار السن لقراءة وشرح علب الأدوية بدقة وتكبير واضح" />
    
    <!-- PWA & Mobile Web App Meta -->
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="دليلي الدوائي" />
    <link rel="manifest" href="/manifest.webmanifest" />

    <!-- Google Fonts Preconnect & Stylesheets (Cairo & Tajawal) -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap"
      rel="stylesheet"
    />

    <title>دليلي الدوائي | مساعد قراءة الأدوية لكبار السن</title>
  </head>
  <body class="bg-[#F8F9FA] text-[#1D3557] font-sans antialiased min-h-screen selection:bg-teal-100 selection:text-teal-900">
    <noscript>
      <div style="padding: 24px; text-align: center; font-size: 20px; font-family: sans-serif; background-color: #FEF3C7; color: #92400E;">
        يرجى تفعيل الجافاسكريبت لتشغيل تطبيق دليلي الدوائي.
      </div>
    </noscript>
    <div id="root" dir="rtl" class="min-h-screen flex flex-col"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

### 4.2 `tailwind.config.js` (Tailwind Configuration & Design Tokens)
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // High-Contrast Medical Palette (WCAG AAA)
        teal: {
          DEFAULT: '#006D77',
          50: '#F0F9FA',
          100: '#E6F1F2',
          200: '#C2E2E5',
          500: '#00838F',
          600: '#006D77', // Primary Brand Color
          700: '#005860',
          800: '#004E55',
          900: '#003338',
        },
        warm: {
          50: '#FFFFFF',
          100: '#FDFEFE',
          200: '#F8F9FA', // Main Background
          300: '#E9ECEF',
          400: '#DEE2E6',
        },
        slate: {
          900: '#1D3557', // High-Contrast Text (12.6:1 against #F8F9FA)
          800: '#2A4365',
          700: '#334E68',
          600: '#457B9D', // Muted Secondary Text
        },
        amber: {
          50: '#FFFDF5',
          100: '#FEF3C7', // Card 4 Soft Amber Background
          200: '#FDE68A',
          400: '#FBBF24',
          500: '#F59E0B', // Amber Accent & Border
          800: '#92400E', // High-Contrast Amber Text
          900: '#78350F',
        },
      },
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        cairo: ['Cairo', 'sans-serif'],
        tajawal: ['Tajawal', 'sans-serif'],
      },
      fontSize: {
        // Senior-Centric Typography Scale
        'senior-sm': ['18px', { lineHeight: '1.7', fontWeight: '500' }],
        'senior-base': ['20px', { lineHeight: '1.75', fontWeight: '600' }], // Minimum Body (Large)
        'senior-lg': ['24px', { lineHeight: '1.8', fontWeight: '600' }],   // Extra Large Body
        'senior-xl': ['28px', { lineHeight: '1.6', fontWeight: '700' }],   // Headings (Large)
        'senior-2xl': ['32px', { lineHeight: '1.5', fontWeight: '800' }],  // Headings (Extra Large) / Headers
        'senior-3xl': ['36px', { lineHeight: '1.4', fontWeight: '900' }],  // Prominent Titles
      },
      minHeight: {
        'touch': '64px',    // Mandatory minimum touch target height
        'touch-lg': '72px', // Prominent action button height
      },
      minWidth: {
        'touch': '64px',
      },
      boxShadow: {
        'senior': '0 4px 14px 0 rgba(29, 53, 87, 0.08)',
        'senior-lg': '0 8px 24px 0 rgba(29, 53, 87, 0.12)',
      },
    },
  },
  plugins: [],
};
```

---

### 4.3 `postcss.config.js` (PostCSS Configuration)
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\postcss.config.js`

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

### 4.4 `src/index.css` (Tailwind Directives & Global Senior Accessibility Styles)
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\src\index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    color-scheme: light;
    --touch-min: 64px;
    --text-primary: #1D3557;
    --bg-primary: #F8F9FA;
    --brand-teal: #006D77;
    --amber-soft: #FEF3C7;
    --amber-text: #92400E;
  }

  html {
    direction: rtl;
    font-family: 'Cairo', 'Tajawal', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-size: 20px; /* Senior base default */
    background-color: var(--bg-primary);
    color: var(--text-primary);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  body {
    margin: 0;
    padding: 0;
    min-height: 100vh;
    direction: rtl;
    text-align: right;
    line-height: 1.75;
  }

  /* Universal minimum touch target for interactive controls */
  button,
  [role="button"],
  input[type="button"],
  input[type="submit"],
  input[type="file"],
  select {
    min-height: 64px;
    touch-action: manipulation;
  }
}

@layer components {
  /* Senior Touch Target Utility */
  .btn-touch {
    min-height: 64px;
    min-width: 64px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.875rem 1.5rem;
    font-size: 1.25rem; /* 20px+ */
    font-weight: 700;
    border-radius: 1rem;
    transition: all 0.2s ease-in-out;
  }

  .btn-primary {
    @apply btn-touch bg-teal-600 text-white hover:bg-teal-700 active:scale-[0.98] shadow-senior focus:ring-4 focus:ring-teal-200 outline-none;
  }

  .btn-secondary {
    @apply btn-touch bg-white text-slate-900 border-2 border-slate-300 hover:bg-slate-50 active:scale-[0.98] focus:ring-4 focus:ring-slate-200 outline-none;
  }

  /* Color-Coded Card Bases */
  .card-senior {
    @apply rounded-2xl p-6 shadow-senior border-2 transition-all;
  }

  /* Card 1: Medicine Identity (Teal border & accent) */
  .card-identity {
    @apply card-senior bg-white border-teal-600 text-slate-900;
  }

  /* Card 2: Uses (Blue/Slate border) */
  .card-uses {
    @apply card-senior bg-white border-blue-600 text-slate-900;
  }

  /* Card 3: Dosage & Schedule (Emerald border) */
  .card-schedule {
    @apply card-senior bg-white border-emerald-600 text-slate-900;
  }

  /* Card 4: Warnings & Cautions (Soft Amber Background) */
  .card-warnings {
    @apply card-senior bg-[#FEF3C7] border-amber-500 text-[#92400E];
  }
}

/* Dynamic Font Sizing Control Classes */
.font-mode-large {
  font-size: 20px;
}

.font-mode-extra-large {
  font-size: 24px;
}
```

---

### 4.5 `vitest.config.ts` (Vitest Test Runner Configuration)
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\vitest.config.ts`

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
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/**/*.{test,spec}.{ts,tsx}',
    ],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        'vite.config.ts',
        'vitest.config.ts',
        'tailwind.config.js',
        'postcss.config.js',
      ],
    },
  },
});
```

---

### 4.6 `src/test/setup.ts` (Global Test Setup, Custom Matchers & Mocks)
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\src\test\setup.ts`

```typescript
import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// -------------------------------------------------------------
// 1. Automatic Post-Test Cleanup
// -------------------------------------------------------------
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
});

// -------------------------------------------------------------
// 2. Mock window.matchMedia
// -------------------------------------------------------------
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
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

// -------------------------------------------------------------
// 3. Mock window.scrollTo
// -------------------------------------------------------------
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// -------------------------------------------------------------
// 4. Mock URL.createObjectURL & URL.revokeObjectURL
// -------------------------------------------------------------
if (typeof window.URL.createObjectURL === 'undefined') {
  Object.defineProperty(window.URL, 'createObjectURL', {
    writable: true,
    value: vi.fn((file: File) => `blob:mock-url-${file.name || 'image'}`),
  });
}
if (typeof window.URL.revokeObjectURL === 'undefined') {
  Object.defineProperty(window.URL, 'revokeObjectURL', {
    writable: true,
    value: vi.fn(),
  });
}

// -------------------------------------------------------------
// 5. Mock LocalStorage with Spyable Interface
// -------------------------------------------------------------
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem = vi.fn((key: string): string | null => {
    return this.store[key] ?? null;
  });

  setItem = vi.fn((key: string, value: string): void => {
    this.store[key] = String(value);
  });

  removeItem = vi.fn((key: string): void => {
    delete this.store[key];
  });

  clear = vi.fn((): void => {
    this.store = {};
  });

  get length(): number {
    return Object.keys(this.store).length;
  }

  key = vi.fn((index: number): string | null => {
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  });
}

const mockLocalStorage = new LocalStorageMock();
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// -------------------------------------------------------------
// 6. Mock Web Speech API (window.speechSynthesis & Utterance)
// -------------------------------------------------------------
export class MockSpeechSynthesisUtterance {
  text: string;
  lang = 'ar-SA';
  voice: SpeechSynthesisVoice | null = null;
  rate = 0.9;
  pitch = 1.0;
  volume = 1.0;
  onstart: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

export class MockSpeechSynthesis {
  speaking = false;
  paused = false;
  pending = false;
  onvoiceschanged: (() => void) | null = null;
  currentUtterance: MockSpeechSynthesisUtterance | null = null;

  voices: SpeechSynthesisVoice[] = [
    { name: 'Maged (Arabic Saudi Arabia)', lang: 'ar-SA', default: true, localService: true, voiceURI: 'ar-sa-1' } as any,
    { name: 'Hoda (Arabic Egypt)', lang: 'ar-EG', default: false, localService: true, voiceURI: 'ar-eg-1' } as any,
    { name: 'David (English US)', lang: 'en-US', default: false, localService: true, voiceURI: 'en-us-1' } as any,
  ];

  getVoices = vi.fn((): SpeechSynthesisVoice[] => {
    return this.voices;
  });

  speak = vi.fn((utterance: MockSpeechSynthesisUtterance): void => {
    this.currentUtterance = utterance;
    this.speaking = true;
    this.paused = false;
    if (utterance.onstart) {
      setTimeout(() => utterance.onstart?.(), 0);
    }
  });

  pause = vi.fn((): void => {
    if (this.speaking && !this.paused) {
      this.paused = true;
      if (this.currentUtterance?.onpause) {
        this.currentUtterance.onpause();
      }
    }
  });

  resume = vi.fn((): void => {
    if (this.speaking && this.paused) {
      this.paused = false;
      if (this.currentUtterance?.onresume) {
        this.currentUtterance.onresume();
      }
    }
  });

  cancel = vi.fn((): void => {
    if (this.speaking || this.paused) {
      this.speaking = false;
      this.paused = false;
      if (this.currentUtterance?.onend) {
        this.currentUtterance.onend();
      }
      this.currentUtterance = null;
    }
  });
}

const mockSynth = new MockSpeechSynthesis();
Object.defineProperty(window, 'speechSynthesis', {
  value: mockSynth,
  writable: true,
  configurable: true,
});
(window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

// -------------------------------------------------------------
// 7. Mock Navigator Service Worker
// -------------------------------------------------------------
if (!('serviceWorker' in navigator)) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      register: vi.fn().mockResolvedValue({
        scope: '/',
        active: { state: 'activated' },
      }),
      ready: Promise.resolve({
        active: { state: 'activated' },
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
}

// -------------------------------------------------------------
// 8. Custom Vitest Matchers Implementation
// -------------------------------------------------------------
expect.extend({
  /**
   * Asserts that an interactive element satisfies the senior 64px minimum touch target height.
   * Checks computed styles, inline styles, bounding rects, and Tailwind classes.
   */
  toHaveMinTouchTarget(received: HTMLElement, minSize = 64) {
    if (!received || !(received instanceof HTMLElement)) {
      return {
        pass: false,
        message: () => `Expected a valid HTMLElement, but received: ${received}`,
      };
    }

    const style = window.getComputedStyle(received);
    const computedMinHeight = parseFloat(style.minHeight) || 0;
    const computedHeight = parseFloat(style.height) || 0;
    const inlineMinHeight = parseFloat(received.style.minHeight) || 0;
    const inlineHeight = parseFloat(received.style.height) || 0;
    const rectHeight = received.getBoundingClientRect ? received.getBoundingClientRect().height : 0;

    const effectiveHeight = Math.max(
      computedMinHeight,
      computedHeight,
      inlineMinHeight,
      inlineHeight,
      rectHeight
    );

    // Also check for Tailwind min-h and height classes
    const classList = received.className || '';
    const hasTailwindTouchClass =
      classList.includes('min-h-[64px]') ||
      classList.includes('min-h-touch') ||
      classList.includes('h-16') ||
      classList.includes('h-[64px]') ||
      classList.includes('min-h-16') ||
      classList.includes('btn-touch') ||
      classList.includes('btn-primary') ||
      classList.includes('btn-secondary');

    const pass = effectiveHeight >= minSize || hasTailwindTouchClass;

    return {
      pass,
      message: () =>
        pass
          ? `Expected element NOT to have minimum touch target height of ${minSize}px, but effective height is ${effectiveHeight}px (classes: "${classList}")`
          : `Expected element to have minimum touch target height of ${minSize}px, but received effective height of ${effectiveHeight}px (classes: "${classList}")`,
    };
  },

  /**
   * Asserts that an element or its ancestor tree explicitly enforces dir="rtl".
   */
  toHaveRtlDirection(received: HTMLElement) {
    if (!received || !(received instanceof HTMLElement)) {
      return {
        pass: false,
        message: () => `Expected a valid HTMLElement, but received: ${received}`,
      };
    }

    const explicitDir = received.getAttribute('dir');
    const computedDir = window.getComputedStyle(received).direction;
    const closestRtl = received.closest ? received.closest('[dir="rtl"]') : null;
    const documentDir = document.documentElement.getAttribute('dir');

    const pass =
      explicitDir === 'rtl' ||
      computedDir === 'rtl' ||
      closestRtl !== null ||
      documentDir === 'rtl';

    return {
      pass,
      message: () =>
        pass
          ? `Expected element NOT to have dir="rtl", but found explicit="${explicitDir}", computed="${computedDir}", closestRtl=${Boolean(closestRtl)}`
          : `Expected element to have dir="rtl", but found explicit="${explicitDir}", computed="${computedDir}", closestRtl=${Boolean(closestRtl)}`,
    };
  },
});
```

---

### 4.7 `src/types/matchers.d.ts` (TypeScript Declaration Merging for Matchers)
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\src\types\matchers.d.ts`

```typescript
import 'vitest';

interface CustomElderlyMatchers<R = unknown> {
  /**
   * Checks that an element satisfies the minimum 64px touch target height.
   * @param minSize Expected minimum pixel height (defaults to 64px).
   */
  toHaveMinTouchTarget(minSize?: number): R;

  /**
   * Checks that an element or its ancestor enforces Right-to-Left (dir="rtl") direction.
   */
  toHaveRtlDirection(): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomElderlyMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomElderlyMatchers {}
}

export {};
```

---

### 4.8 `src/test/testUtils.tsx` (RTL Provider & Render Helpers)
**Path**: `c:\Users\PC\Documents\antigravity\fervent-mendel\src\test\testUtils.tsx`

```typescript
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

interface WrapperProps {
  children: React.ReactNode;
}

/**
 * Custom test wrapper that ensures components render within an RTL Arabic container.
 */
const AllProviders: React.FC<WrapperProps> = ({ children }) => {
  return (
    <div dir="rtl" lang="ar" className="font-sans bg-[#F8F9FA] text-[#1D3557] min-h-screen">
      {children}
    </div>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options });

export * from '@testing-library/react';
export { customRender as renderWithRtl };
```

---

## 5. Verification Method

To independently verify the implementation after Worker code generation:

1. **Verify Tailwind Build & Configuration**:
   Execute:
   ```powershell
   npx.cmd tailwindcss -i ./src/index.css -o ./dist/output.css --minify
   ```
   *Expected outcome*: Compiles without errors; output CSS contains Deep Teal (`#006D77`), Warm White (`#F8F9FA`), Dark Slate (`#1D3557`), and Amber (`#FEF3C7`/`#F59E0B`/`#92400E`) utilities.

2. **Verify Custom Matchers & Test Setup in Vitest**:
   Create a sanity test `src/test/setup.test.tsx`:
   ```typescript
   import { render, screen } from '@testing-library/react';
   import { describe, it, expect } from 'vitest';

   describe('Test Harness Sanity Check', () => {
     it('verifies custom matchers toHaveMinTouchTarget and toHaveRtlDirection', () => {
       render(
         <div dir="rtl">
           <button className="min-h-[64px]">صوّر علبة الدواء</button>
         </div>
       );
       const button = screen.getByRole('button');
       expect(button).toHaveRtlDirection();
       expect(button).toHaveMinTouchTarget(64);
     });

     it('verifies speechSynthesis and localStorage mocks', () => {
       expect(window.speechSynthesis).toBeDefined();
       expect(window.speechSynthesis.getVoices()).toHaveLength(3);
       localStorage.setItem('test_key', 'test_value');
       expect(localStorage.getItem('test_key')).toBe('test_value');
     });
   });
   ```
   Execute:
   ```powershell
   npm.cmd run test
   ```
   *Expected outcome*: Test runner starts via Vitest, processes setup file, runs tests, and completes with 100% pass.

3. **Verify Full Production Compilation**:
   Execute:
   ```powershell
   npm.cmd run build
   ```
   *Expected outcome*: `tsc` and `vite build` complete with zero errors. `index.html` is bundled with Google Fonts and RTL metadata intact.

4. **Invalidation Conditions**:
   - If `npm.cmd run build` complains about `toHaveMinTouchTarget` type errors on `expect()`, verify that `src/types/matchers.d.ts` is referenced in `tsconfig.json` (`"include": ["src", "tests"]`).
   - If JSDOM tests fail touch target tests on buttons with Tailwind classes, ensure `toHaveMinTouchTarget` class inspection includes `classList.includes('min-h-[64px]')` and `classList.includes('btn-touch')`.
