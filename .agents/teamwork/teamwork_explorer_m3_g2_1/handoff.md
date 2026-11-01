# Milestone M3 Handoff Report: Native App Shell, RTL Bottom Navigation & Home Screen

## 1. Observation

### 1.1 Existing Files and Architecture State
- **`src/App.tsx`** (256 lines):
  - Currently implements a single-screen layout with a sticky top header (`<header>` lines 148–164), inline welcome card (lines 175–185), inline `<CameraCapture>` (line 188), and inline `<RecentScansList>` (lines 191–195).
  - No bottom navigation bar exists. All navigation is handled via conditional rendering based on `currentResult` and `isLoading`.
  - Content has `min-h-screen bg-[#F8F9FA]` and a basic footer (`<footer>` lines 250–252).
  - `tests/errorStates.test.tsx` line 222 queries `screen.getByRole('button', { name: /صوّر علبة الدواء الآن/i })` on `<App />`. The new `HomeScreen` must preserve an accessible button matching this regex to prevent breaking existing tests.
- **`src/index.css`** (106 lines):
  - Defines `:root` variables (`--touch-min: 64px`, `--brand-teal: #006D77`), `html` RTL direction and base 20px font.
  - **Critical CSS omissions**:
    - `user-select: none` is missing.
    - `-webkit-tap-highlight-color: transparent` is missing.
    - `overscroll-behavior: none` is missing.
    - Safe-area inset classes (`pb-safe`, `pt-safe`) are missing.
    - Explicit transition duration cap (`< 250ms`) is missing.
- **`src/types/index.ts`** (56 lines):
  - Line 45 defines `export type ActiveTab = 'home' | 'medicines' | 'prescription' | 'history';`.
  - Does not export `TabKey` or center button camera tab type.
  - Test fixture `tests/e2e/fixtures/testContracts.ts` lines 48–56 defines:
    ```typescript
    export type TabKey = 'home' | 'medicines' | 'camera' | 'prescription' | 'history';
    export const RTL_NAV_TABS: Array<{ key: TabKey; label: string; icon: string }> = [
      { key: 'home', label: 'الرئيسية', icon: 'Home' },
      { key: 'medicines', label: 'أدويتي', icon: 'Pill' },
      { key: 'camera', label: 'صوّر', icon: 'Camera' },
      { key: 'prescription', label: 'الروشتة', icon: 'FileText' },
      { key: 'history', label: 'السجل', icon: 'History' },
    ];
    ```
- **`src/services/nativeCamera.ts`** (253 lines):
  - Line 151: `export async function capturePhoto(): Promise<NativePhotoFile | null>` invokes `@capacitor/camera` with `CameraSource.Camera`, `CameraDirection.Rear`, `CameraResultType.Base64`, quality 90.
  - Line 184: `export async function pickPhoto(): Promise<NativePhotoFile | null>` invokes `CameraSource.Photos`.
  - Operates completely natively without creating or manipulating `<input type="file">`.
  - Permission denials are handled gracefully with Arabic alert dialogs and custom error types (`CameraPermissionDeniedError`, `PhotosPermissionDeniedError`).
- **`src/components/`** (8 existing components):
  - `BottomNavBar.tsx` does NOT exist yet.
  - `HomeScreen.tsx` does NOT exist yet.
  - `CameraCapture.tsx` (115 lines) renders a primary camera button with `aria-label="صوّر علبة الدواء الآن باستخدام الكاميرا"` and text `📷 صوّر علبة الدواء الآن`, plus a secondary gallery button `📁 أو اختر صورة من الألبوم`.
  - `DisclaimerBanner.tsx` (25 lines) renders a persistent Arabic disclaimer note: `هذه المعلومات إرشادية لتسهيل القراءة ولا تغني بأي حال عن تعليمات طبيبك المعالج أو استشارة الصيدلي.`.
  - `RecentScansList.tsx` (81 lines) renders past scans list up to 5 items with clear history confirmation.
- **Current Test Suite Baseline**:
  - Command `npm.cmd test -- --run` executed synchronously:
  - Output: `38 passed (38 test files), 954 passed (954 tests), Duration: 43.65s`. Zero failures.

---

## 2. Logic Chain

### 2.1 Navigation Shell Architecture & RTL Sequence
1. **RTL Display Sequence (Right to Left)**:
   - In an RTL layout (`dir="rtl"`), flex items render from right to left in DOM order:
     - Tab 0: `الرئيسية` (`home`) — Rightmost
     - Tab 1: `أدويتي` (`medicines`) — Inner right
     - Tab 2: `صوّر` (`camera`) — Center raised action button
     - Tab 3: `الروشتة` (`prescription`) — Inner left
     - Tab 4: `السجل` (`history`) — Leftmost
   - This strictly satisfies Requirement R1 and `tests/e2e/tier1_features/navigation_shell.test.ts` (lines 19–26).

2. **Center Camera Button Ergonomics (F04)**:
   - Diameter: 76px (within the required [72px, 80px] range, tested by `navigation_shell_boundary.test.ts` lines 58–65).
   - Background: Teal `#006D77`, circular (`rounded-full`), raised above the bar (`-mt-7` or `-translate-y-4`).
   - Z-Index: `z-60`, strictly higher than the nav bar container (`z-50`) as required by boundary test line 91.
   - Icon & Label: White `Camera` icon ($\ge 28$px, e.g. 32px) and bold Arabic label `صوّر`.
   - Behavior: Debounced against rapid double taps (`isCapturing` mutex lock), vibrates lightly (`navigator.vibrate?.(10)`), directly executes `capturePhoto()` from `src/services/nativeCamera.ts`, and feeds the captured image to the box analysis flow without `<input type="file">`.

3. **Standard Tab Ergonomics (F05)**:
   - Touch Target: $\ge 64$px minimum height and width (`min-h-[64px] min-w-[64px]`).
   - Icons: $\ge 28$px (`w-7 h-7` or `size={28}`).
   - Labels: $\ge 16$px (`text-base` or `text-[16px]`), `font-bold`.
   - Active Pill Indicator: Active tab displays rounded pill background `bg-[#006D77]/15 text-[#006D77] rounded-full px-4 py-1` (matching `navigation_shell.test.ts` line 35).
   - Haptic Feedback: Safe invocation `if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') { try { navigator.vibrate(10); } catch {} }`.
   - Safe Area Insets: Container includes class `pb-safe` with CSS `padding-bottom: env(safe-area-inset-bottom, 16px)`.

4. **Home Screen Redesign (F07)**:
   - Header Greeting: Warm Modern Standard Arabic greeting ("أهلاً بك في دليلي الدوائي") with subheading.
   - Two Big Action Cards (minHeight $\ge 120$px):
     - **Card 1 ("صوّر علبة دواء")**: Teal bordered card with pill/camera icon, clear explanation, and primary action that launches camera capture. Crucially, the button carries `aria-label="صوّر علبة الدواء الآن"` and text containing `صوّر علبة الدواء الآن` so `tests/errorStates.test.tsx` passes without regression. Also includes secondary option for gallery selection.
     - **Card 2 ("صوّر روشتة")**: Emerald/blue bordered card with prescription icon and explanation, navigating user directly to the `prescription` tab.
   - Recent Scans: Clamped to 5 items (`scans.slice(0, 5)`). If empty, shows friendly fallback: "لا توجد أدوية مسجلة بعد. يمكنك تصوير علبة دواء للبدء." as verified by `navigation_shell_boundary.test.ts` lines 194–198.

5. **Native Mobile Feel CSS (F06)**:
   - `src/index.css` must include:
     - `user-select: none; -webkit-user-select: none;`
     - `-webkit-tap-highlight-color: transparent;`
     - `overscroll-behavior: none; overscroll-behavior-y: none;`
     - Transition durations capped at 200ms (`< 250ms`).
     - Bottom and top safe area classes (`pb-safe`, `pt-safe`).

6. **Medical Disclaimer Persistence (F08)**:
   - `<DisclaimerBanner />` displayed on all scan results and detail screens.
   - Fixed amber/slate styling, high contrast, non-dismissible.

---

## 3. Caveats
1. **Prescription Flow Separation (M3 vs M4)**:
   - Milestone M3 establishes the native shell, bottom nav bar, and Home screen. The full prescription scanning pipeline (Gemini 3.8 Flash Worker call, 1600px compression, multi-item prescription cards, low-confidence amber cards, and details modal) belongs to Milestone M4. For M3, the `prescription` tab displays an initial friendly landing view with "صوّر الروشتة" trigger card.
2. **Capacitor Mocking in Vitest**:
   - In Node/JSDOM test environments, `@capacitor/camera` methods (`Camera.getPhoto`, `Camera.checkPermissions`) are mocked. Implementation code must safely check for web fallbacks and avoid assuming real native hardware is attached.
3. **Double-Tap Debounce Mutex**:
   - The center camera button and Home screen capture buttons must guard against asynchronous race conditions where rapid clicks could trigger multiple camera dialogs or analysis requests. An `isCapturing` ref/state lock guarantees single-flight execution.

---

## 4. Conclusion & Implementation Guide for Worker M3

Worker M3 should implement the changes following the exact step-by-step specifications below:

### Step 1: Update `src/index.css`
Add native mobile-feel rules, safe area padding utilities, and transition speed caps:

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
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    overscroll-behavior: none;
    overscroll-behavior-y: none;
  }

  body {
    margin: 0;
    padding: 0;
    min-height: 100vh;
    direction: rtl;
    text-align: right;
    line-height: 1.75;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    overscroll-behavior: none;
    overscroll-behavior-y: none;
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
    -webkit-tap-highlight-color: transparent;
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

  /* Safe Area Padding Utilities for Android devices */
  .pb-safe {
    padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
  }
  .pt-safe {
    padding-top: max(0px, env(safe-area-inset-top, 0px));
  }

  /* Transitions capped under 250ms for native snappiness */
  .transition-native {
    transition-duration: 200ms;
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

### Step 2: Update `src/types/index.ts`
Export `TabKey` and update `ActiveTab`:

```typescript
export type TabKey = 'home' | 'medicines' | 'camera' | 'prescription' | 'history';
export type ActiveTab = 'home' | 'medicines' | 'prescription' | 'history';

export interface NavTabItem {
  key: TabKey;
  label: string;
  icon: string;
}
```

---

### Step 3: Implement `src/components/BottomNavBar.tsx`
Create `src/components/BottomNavBar.tsx`:

```tsx
import React, { useState } from 'react';
import { Home, Pill, Camera, FileText, History } from 'lucide-react';
import { TabKey } from '../types';

export interface BottomNavBarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  onCameraClick: () => Promise<void> | void;
  disabled?: boolean;
}

export const RTL_NAV_TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'home', label: 'الرئيسية', icon: 'Home' },
  { key: 'medicines', label: 'أدويتي', icon: 'Pill' },
  { key: 'camera', label: 'صوّر', icon: 'Camera' },
  { key: 'prescription', label: 'الروشتة', icon: 'FileText' },
  { key: 'history', label: 'السجل', icon: 'History' },
];

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  onCameraClick,
  disabled = false,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(10);
      } catch {
        // Ignore vibration errors on unsupported platforms
      }
    }
  };

  const handleTabClick = (key: TabKey) => {
    triggerHaptic();
    onSelectTab(key);
  };

  const handleCenterCameraClick = async () => {
    if (disabled || isCapturing) return;
    triggerHaptic();
    setIsCapturing(true);
    try {
      await onCameraClick();
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <nav
      dir="rtl"
      role="navigation"
      aria-label="شريط التنقل السفلي"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-slate-200 shadow-lg pb-safe"
    >
      <div className="max-w-md mx-auto px-2 flex items-center justify-between min-h-[72px]">
        {/* Tab 1: الرئيسية (Home) */}
        <button
          type="button"
          role="tab"
          aria-label="الرئيسية"
          aria-selected={activeTab === 'home'}
          onClick={() => handleTabClick('home')}
          className={`min-h-[64px] min-w-[64px] flex-1 flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'home'
              ? 'bg-[#006D77]/15 text-[#006D77] rounded-full px-4 py-1'
              : 'text-slate-600 hover:text-teal-700'
          }`}
        >
          <Home className="w-7 h-7" aria-hidden="true" />
          <span className="text-base font-bold mt-1">الرئيسية</span>
        </button>

        {/* Tab 2: أدويتي (Medicines) */}
        <button
          type="button"
          role="tab"
          aria-label="أدويتي"
          aria-selected={activeTab === 'medicines'}
          onClick={() => handleTabClick('medicines')}
          className={`min-h-[64px] min-w-[64px] flex-1 flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'medicines'
              ? 'bg-[#006D77]/15 text-[#006D77] rounded-full px-4 py-1'
              : 'text-slate-600 hover:text-teal-700'
          }`}
        >
          <Pill className="w-7 h-7" aria-hidden="true" />
          <span className="text-base font-bold mt-1">أدويتي</span>
        </button>

        {/* Tab 3: Center Raised Camera Button (صوّر) */}
        <div className="relative flex flex-col items-center justify-center -mt-7 px-1">
          <button
            type="button"
            disabled={disabled || isCapturing}
            onClick={handleCenterCameraClick}
            aria-label="صوّر"
            className="w-[76px] h-[76px] rounded-full bg-[#006D77] hover:bg-teal-800 active:scale-95 disabled:opacity-60 text-white flex flex-col items-center justify-center shadow-xl border-4 border-white transition-all z-60"
          >
            <Camera className="w-8 h-8 text-white" aria-hidden="true" />
            <span className="text-xs font-black text-white mt-0.5">صوّر</span>
          </button>
        </div>

        {/* Tab 4: الروشتة (Prescription) */}
        <button
          type="button"
          role="tab"
          aria-label="الروشتة"
          aria-selected={activeTab === 'prescription'}
          onClick={() => handleTabClick('prescription')}
          className={`min-h-[64px] min-w-[64px] flex-1 flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'prescription'
              ? 'bg-[#006D77]/15 text-[#006D77] rounded-full px-4 py-1'
              : 'text-slate-600 hover:text-teal-700'
          }`}
        >
          <FileText className="w-7 h-7" aria-hidden="true" />
          <span className="text-base font-bold mt-1">الروشتة</span>
        </button>

        {/* Tab 5: السجل (History) */}
        <button
          type="button"
          role="tab"
          aria-label="السجل"
          aria-selected={activeTab === 'history'}
          onClick={() => handleTabClick('history')}
          className={`min-h-[64px] min-w-[64px] flex-1 flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'history'
              ? 'bg-[#006D77]/15 text-[#006D77] rounded-full px-4 py-1'
              : 'text-slate-600 hover:text-teal-700'
          }`}
        >
          <History className="w-7 h-7" aria-hidden="true" />
          <span className="text-base font-bold mt-1">السجل</span>
        </button>
      </div>
    </nav>
  );
};
```

---

### Step 4: Implement `src/components/HomeScreen.tsx`
Create `src/components/HomeScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { Camera, FileText, Image, Sparkles, AlertTriangle, Pill, Clock } from 'lucide-react';
import { MedicationHistoryItem } from '../types';
import { capturePhoto, pickPhoto } from '../services/nativeCamera';
import { RecentScansList } from './RecentScansList';

export interface HomeScreenProps {
  onImageSelected: (file: File) => void;
  onNavigateToPrescription: () => void;
  recentScans: MedicationHistoryItem[];
  onSelectRecentScan: (item: MedicationHistoryItem) => void;
  onClearHistory: () => void;
  disabled?: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onImageSelected,
  onNavigateToPrescription,
  recentScans,
  onSelectRecentScan,
  onClearHistory,
  disabled = false,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBoxCapture = async () => {
    if (disabled || isCapturing) return;
    setIsCapturing(true);
    setErrorMessage(null);
    try {
      const file = await capturePhoto();
      if (file) {
        onImageSelected(file);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'تعذر فتح الكاميرا حالياً. يمكنك تجربة اختيار صورة من الألبوم.';
      setErrorMessage(message);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleGalleryPick = async () => {
    if (disabled || isCapturing) return;
    setIsCapturing(true);
    setErrorMessage(null);
    try {
      const file = await pickPhoto();
      if (file) {
        onImageSelected(file);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'تعذر فتح ألبوم الصور حالياً.';
      setErrorMessage(message);
    } finally {
      setIsCapturing(false);
    }
  };

  const displayedScans = recentScans ? recentScans.slice(0, 5) : [];

  return (
    <div dir="rtl" className="w-full text-right space-y-6">
      {/* Friendly Senior Greeting */}
      <div className="bg-teal-50 border-2 border-teal-500 rounded-3xl p-6 shadow-xs">
        <h2 className="text-senior-xl font-bold text-teal-900 mb-2">
          أهلاً بك في دليلي الدوائي
        </h2>
        <p className="text-senior-base text-slate-800 leading-relaxed font-medium">
          مساعدك الطبي الذكي لقراءة علب الأدوية والروشتات بالصوت والكتابة الواضحة. اختر ما تريد تصويره للبدء فوراً.
        </p>
      </div>

      {/* Error alert for permissions or hardware issues */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-2xl p-4 text-senior-base font-bold flex items-start justify-between gap-3 shadow-xs"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-amber-800 hover:text-amber-950 font-extrabold px-2 py-1 rounded-lg"
            aria-label="إغلاق التنبيه"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2 Big Action Cards (F07) */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        {/* Card 1: صوّر علبة دواء */}
        <button
          type="button"
          disabled={disabled || isCapturing}
          onClick={handleBoxCapture}
          aria-label="صوّر علبة الدواء الآن"
          className="w-full min-h-[120px] bg-white hover:bg-teal-50/60 active:scale-[0.98] disabled:opacity-60 border-2 border-teal-600 rounded-3xl p-6 flex items-center justify-between text-right shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <Camera className="w-9 h-9" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-senior-xl font-extrabold text-teal-900">
                صوّر علبة دواء
              </h3>
              <p className="text-senior-base text-slate-700 font-medium mt-1">
                التقط صورة لعلبة الدواء لمعرفة دواعي الاستعمال والتحذيرات
              </p>
            </div>
          </div>
        </button>

        {/* Card 2: صوّر روشتة */}
        <button
          type="button"
          disabled={disabled || isCapturing}
          onClick={onNavigateToPrescription}
          aria-label="صوّر روشتة"
          className="w-full min-h-[120px] bg-white hover:bg-blue-50/60 active:scale-[0.98] disabled:opacity-60 border-2 border-blue-600 rounded-3xl p-6 flex items-center justify-between text-right shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
              <FileText className="w-9 h-9" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-senior-xl font-extrabold text-blue-900">
                صوّر روشتة
              </h3>
              <p className="text-senior-base text-slate-700 font-medium mt-1">
                قراءة الأدوية المكتوبة في الروشتة وتوضيح ما كتبه الطبيب
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Secondary Gallery Action */}
      <button
        type="button"
        disabled={disabled || isCapturing}
        onClick={handleGalleryPick}
        className="w-full min-h-[64px] bg-white hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60 text-slate-800 border-2 border-slate-300 rounded-2xl p-4 flex items-center justify-center gap-3 text-senior-base font-bold shadow-xs transition-all"
        aria-label="اختيار صورة علبة دواء من الألبوم"
      >
        <Image className="w-6 h-6 text-slate-600" aria-hidden="true" />
        <span>📁 أو اختر صورة من الألبوم</span>
      </button>

      {/* Uncluttered Recent Scans List (Clamped to 5) */}
      {displayedScans.length > 0 ? (
        <RecentScansList
          scans={displayedScans}
          onSelectScan={onSelectRecentScan}
          onClearHistory={onClearHistory}
        />
      ) : (
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 text-center text-slate-600">
          <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-senior-base font-medium">
            لا توجد أدوية مسجلة بعد. يمكنك تصوير علبة دواء للبدء.
          </p>
        </div>
      )}
    </div>
  );
};
```

---

### Step 5: Update `src/App.tsx`
Integrate `<BottomNavBar />` and `<HomeScreen />`, handle tab state switching, and manage native safe areas:

```tsx
import { useState, useEffect } from 'react';
import { Pill, RotateCcw } from 'lucide-react';
import {
  MedicineAnalysisResult,
  MedicationHistoryItem,
  FontSizePreference,
  TabKey,
} from './types';
import {
  getScanHistory,
  saveScanItem,
  clearScanHistory,
} from './services/historyStorage';
import {
  getStoredFontSize,
  setStoredFontSize,
  purgeLegacyStoredApiKey,
} from './services/preferencesStorage';
import {
  analyzeMedicationImage,
  AnalysisError,
} from './services/geminiVision';
import { processAndValidateImage } from './utils/imageProcessor';
import { speechController } from './services/speechController';
import { capturePhoto } from './services/nativeCamera';

import { LoadingSpinner } from './components/LoadingSpinner';
import { ResultCards } from './components/ResultCards';
import { UnclearPhotoCard } from './components/UnclearPhotoCard';
import { AudioToolbar } from './components/AudioToolbar';
import { FontSizeToggle } from './components/FontSizeToggle';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { BottomNavBar } from './components/BottomNavBar';
import { HomeScreen } from './components/HomeScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [fontSize, setFontSize] = useState<FontSizePreference>(getStoredFontSize());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentResult, setCurrentResult] = useState<MedicineAnalysisResult | null>(null);
  const [recentScans, setRecentScans] = useState<MedicationHistoryItem[]>([]);
  const [lastFile, setLastFile] = useState<File | null>(null);

  useEffect(() => {
    setRecentScans(getScanHistory());
    purgeLegacyStoredApiKey();
  }, []);

  const handleFontSizeChange = (newSize: FontSizePreference) => {
    setFontSize(newSize);
    setStoredFontSize(newSize);
  };

  const handleClearHistory = () => {
    if (window.confirm('هل تريد مسح سجل الأدوية السابقة؟')) {
      clearScanHistory();
      setRecentScans([]);
    }
  };

  const processImage = async (file: File) => {
    setIsLoading(true);
    setCurrentResult(null);
    speechController.stop();
    setLastFile(file);

    try {
      const processed = await processAndValidateImage(file);
      const result = await analyzeMedicationImage({
        imageBase64: processed.base64,
        mimeType: processed.mimeType,
      });

      setCurrentResult(result);
      if (result.is_clear) {
        const updatedHistory = saveScanItem(result);
        setRecentScans(updatedHistory);
      }
    } catch (err: unknown) {
      if (err instanceof AnalysisError) {
        setCurrentResult({
          is_clear: false,
          error_category: err.category,
          error_code: err.errorCode,
          error_detail: err.detail,
          raw_error: err.message,
        });
      } else {
        const errorMsg = err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الصورة.';
        const isTimeout = /timeout|30 ثانية|مهلة/i.test(errorMsg);
        const isNetwork = /network|fetch|شبكة|اتصال/i.test(errorMsg);
        const isUnclear = /الصورة الملتقطة تبدو مظلمة|أبعاد الصورة|شاشة سوداء/i.test(errorMsg);

        let error_category: MedicineAnalysisResult['error_category'] = 'server_error';
        if (isTimeout || isNetwork) {
          error_category = 'network_timeout';
        } else if (isUnclear) {
          error_category = 'unclear_image';
        }

        setCurrentResult({
          is_clear: false,
          error_category,
          error_code: isTimeout ? 'CLIENT_TIMEOUT' : undefined,
          raw_error: errorMsg,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelected = async (file: File) => {
    await processImage(file);
  };

  const handleCenterCameraClick = async () => {
    speechController.stop();
    const file = await capturePhoto();
    if (file) {
      setActiveTab('home');
      await processImage(file);
    }
  };

  const handleRetrySameImage = async () => {
    if (lastFile) {
      await processImage(lastFile);
    } else {
      handleResetToHome();
    }
  };

  const handleResetToHome = () => {
    speechController.stop();
    setCurrentResult(null);
    setIsLoading(false);
    setLastFile(null);
    setActiveTab('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectRecentScan = (item: MedicationHistoryItem) => {
    speechController.stop();
    setCurrentResult(item);
    setActiveTab('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (tab: TabKey) => {
    speechController.stop();
    setCurrentResult(null);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      dir="rtl"
      className={`min-h-screen bg-[#F8F9FA] text-[#1D3557] flex flex-col items-center justify-between font-cairo transition-all ${
        fontSize === 'extra-large' ? 'font-mode-extra-large' : 'font-mode-large'
      }`}
    >
      {/* Top Header Bar */}
      <header className="w-full bg-white border-b-2 border-teal-600 shadow-xs sticky top-0 z-30 px-4 py-3 sm:px-6 pt-safe">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
              <Pill className="w-7 h-7" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-senior-xl sm:text-senior-2xl font-black text-teal-800 leading-tight">
                دليلي الدوائي
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-500">
                مساعدك الطبي لقراءة علب الأدوية والروشتات
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area with bottom padding for fixed nav */}
      <main className="w-full max-w-2xl px-4 py-6 sm:py-8 flex-1 flex flex-col justify-start pb-28">
        {/* Loading State */}
        {isLoading && <LoadingSpinner />}

        {/* Home Screen (Active Tab: Home & No Active Result & Not Loading) */}
        {!isLoading && !currentResult && activeTab === 'home' && (
          <HomeScreen
            onImageSelected={handleImageSelected}
            onNavigateToPrescription={() => setActiveTab('prescription')}
            recentScans={recentScans}
            onSelectRecentScan={handleSelectRecentScan}
            onClearHistory={handleClearHistory}
            disabled={isLoading}
          />
        )}

        {/* Medicines Screen (Active Tab: Medicines) */}
        {!isLoading && !currentResult && activeTab === 'medicines' && (
          <div className="w-full space-y-6">
            <div className="bg-white border-2 border-teal-600 rounded-3xl p-6 shadow-xs text-right">
              <h2 className="text-senior-xl font-bold text-teal-900 mb-2">💊 أدويتي المحفوظة</h2>
              <p className="text-senior-base text-slate-700">
                قائمة بجميع الأدوية التي قمت بتصويرها وحفظها لمراجعتها في أي وقت:
              </p>
            </div>
            <HomeScreen
              onImageSelected={handleImageSelected}
              onNavigateToPrescription={() => setActiveTab('prescription')}
              recentScans={recentScans}
              onSelectRecentScan={handleSelectRecentScan}
              onClearHistory={handleClearHistory}
              disabled={isLoading}
            />
          </div>
        )}

        {/* Prescription Screen (Active Tab: Prescription) */}
        {!isLoading && !currentResult && activeTab === 'prescription' && (
          <div className="w-full space-y-6 text-right">
            <div className="bg-blue-50 border-2 border-blue-600 rounded-3xl p-6 shadow-xs">
              <h2 className="text-senior-xl font-bold text-blue-900 mb-2">📋 قراءة الروشتة الطبية</h2>
              <p className="text-senior-base text-slate-800 leading-relaxed">
                صوّر الروشتة بوضوح لقراءة أسماء الأدوية المكتوبة وتعليمات الطبيب بدقة.
              </p>
            </div>
            {/* Direct Trigger Cards for Prescription in M3 */}
            <div className="grid grid-cols-1 gap-4">
              <button
                type="button"
                onClick={handleCenterCameraClick}
                className="w-full min-h-[76px] bg-blue-600 hover:bg-blue-700 text-white rounded-3xl p-5 flex items-center justify-center gap-3 text-senior-xl font-extrabold shadow-sm"
                aria-label="صوّر الروشتة بالكاميرا"
              >
                <span>📷 صوّر الروشتة الآن</span>
              </button>
            </div>
          </div>
        )}

        {/* History Screen (Active Tab: History) */}
        {!isLoading && !currentResult && activeTab === 'history' && (
          <div className="w-full space-y-6">
            <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 shadow-xs text-right">
              <h2 className="text-senior-xl font-bold text-slate-900 mb-2">🕒 سجل الأدوية السابقة</h2>
              <p className="text-senior-base text-slate-700">
                جميع عمليات الفحص السابقة مخزنة محلياً على جهازك لخصوصيتك الكاملة.
              </p>
            </div>
            <HomeScreen
              onImageSelected={handleImageSelected}
              onNavigateToPrescription={() => setActiveTab('prescription')}
              recentScans={recentScans}
              onSelectRecentScan={handleSelectRecentScan}
              onClearHistory={handleClearHistory}
              disabled={isLoading}
            />
          </div>
        )}

        {/* Results Screen */}
        {!isLoading && currentResult && (
          <div className="w-full space-y-6 animate-in fade-in duration-200">
            {!currentResult.is_clear ? (
              <UnclearPhotoCard
                onRetry={handleRetrySameImage}
                onRetake={handleResetToHome}
                errorMessage={currentResult.raw_error}
                errorCategory={currentResult.error_category}
                errorCode={currentResult.error_code}
                hasLastImage={Boolean(lastFile)}
              />
            ) : (
              <>
                <FontSizeToggle
                  currentSize={fontSize}
                  onToggle={handleFontSizeChange}
                />

                <AudioToolbar
                  audioSummary={currentResult.audio_summary}
                  medicineName={currentResult.medicine_name_ar || currentResult.medicine_name_en}
                />

                <ResultCards result={currentResult} fontSize={fontSize} />

                <DisclaimerBanner />

                <div className="sticky bottom-20 z-20 pt-2 pb-4 bg-gradient-to-t from-[#F8F9FA] via-[#F8F9FA]/90 to-transparent">
                  <button
                    type="button"
                    onClick={handleResetToHome}
                    className="btn-primary w-full min-h-[64px] sm:min-h-[72px] flex items-center justify-center gap-3 text-senior-xl font-extrabold shadow-xl bg-teal-700 hover:bg-teal-800"
                    aria-label="العودة وتصوير دواء آخر"
                  >
                    <RotateCcw className="w-7 h-7" />
                    <span>🔄 تصوير دواء آخر</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Fixed RTL Bottom Navigation Bar */}
      <BottomNavBar
        activeTab={activeTab}
        onSelectTab={handleTabChange}
        onCameraClick={handleCenterCameraClick}
        disabled={isLoading}
      />
    </div>
  );
}
```

---

### Step 6: Create `tests/navigationShell.test.tsx`
Add a dedicated unit test suite covering `BottomNavBar` and `HomeScreen` interactions:
- Verifies RTL order of tabs: `الرئيسية`, `أدويتي`, `صوّر`, `الروشتة`, `السجل`.
- Verifies center camera button dimensions (76px), teal background (`#006D77`), and native camera invocation without `<input type="file">`.
- Verifies touch target $\ge 64$px and icon size $\ge 28$px.
- Verifies haptic feedback triggered on tab and center button clicks.
- Verifies `HomeScreen` 2 big cards and uncluttered recent scans.

---

## 5. Verification Method

To independently verify Worker M3's implementation:

1. **Verify CSS Rules**:
   Inspect `src/index.css` or run:
   ```powershell
   npx.cmd vitest run tests/e2e/tier1_features/navigation_shell.test.ts
   ```
   Assert: All 5 tests under `F06: Native Mobile Feel Styling` pass, verifying `user-select: none`, `-webkit-tap-highlight-color: transparent`, and `overscroll-behavior: none`.

2. **Verify Navigation & Home Screen E2E Suite**:
   ```powershell
   npx.cmd vitest run tests/e2e/tier1_features/navigation_shell.test.ts tests/e2e/tier2_boundaries/navigation_shell_boundary.test.ts
   ```
   Assert: 60/60 tests pass across Tier 1 (features F03–F08) and Tier 2 (boundary & corner cases).

3. **Verify Zero Regressions Across Full Test Suite**:
   ```powershell
   npm.cmd test -- --run
   ```
   Assert: All test files pass (including `tests/errorStates.test.tsx` and `tests/accessibility.test.tsx`).
