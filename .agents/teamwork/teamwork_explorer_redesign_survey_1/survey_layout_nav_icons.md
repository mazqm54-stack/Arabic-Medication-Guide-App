# Technical Survey: Layout, Navigation, Icons, Center Camera Button & Result Cards

**Document ID:** SURVEY-LAYOUT-NAV-ICONS-01  
**Project:** Dalili Medication Guide (دليلي الدوائي)  
**Author:** Redesign Survey Explorer 1  
**Date:** 2026-11-02  
**Target Milestone:** R1 Layout & Navigation Fixes, R2 Modern Visual Styling & Cards  

---

## 1. Executive Summary

This investigation surveys the current implementation of the Arabic UI in `src/` to guide the visual and UX redesign of "دليلي الدوائي". The survey covers:
1. **Sticky Action Button ("تصوير روشتة أخرى"):** Currently pinned at `bottom-20` with a 64-72px button height inside an 88-96px container, while `<main>` only has `pb-28` (112px). At the bottom of the scroll, 64px of content (notably the medical disclaimer) is permanently occluded. On short viewports, it competes with and crowds the "استمع للروشتة كاملة" button.
2. **Bottom Navigation Bar (`BottomNavBar.tsx`):** Four `flex-1` buttons with hardcoded `min-w-[64px]` plus a 76px camera button require a minimum width of at least 340px. On 320px screens, this causes overflow; on 360px screens, active tabs apply `rounded-full px-4` (32px padding) and 16px bold text (`text-base`), triggering severe text collisions between "الروشتة" and "السجل", and between "الرئيسية" and "أدويتي".
3. **Button Emojis Audit:** 13 distinct emoji instances exist in `src/` (🔄, 📷, 🔍, 📁, 💊, 🗑️, 🧪, 🔊, ⏸️, 🏠, 🕒, 📋, ✕, ✓). All can be cleanly replaced using the bundled `lucide-react` (v0.468.0).
4. **Top Bar:** Currently renders an oversized 28-32px title, a redundant subtitle, and lacks the required top-bar "Aa" font-size toggle button and slim advisory banner.
5. **Center Camera Button:** Currently a 76px solid teal circle with internal label. Needs a visual-only update to a 64px circle with teal gradient (`#0A8F9C` to `#006D77`), notch-effect ring, soft glow shadow, scan-style line-icon, scale 0.95 animation, while retaining existing camera invocation and double-tap mutex logic.
6. **Home Screen & Result Cards:** Currently heavy with large 3px borders, oversized empty states, and bulky padding. Need 16px radius cards, prominent medicine names, muted "as written" typography, expandable chevron interactions, and animated skeleton loaders during Gemini AI analysis.

---

## 2. Detailed Analysis: R1.1 Sticky Button ("تصوير روشتة أخرى")

### 2.1 Current Implementation & Geometry
In `src/components/PrescriptionResultView.tsx` (lines 211-221):
```tsx
{/* 5. Sticky Retake Action Button */}
<div className="sticky bottom-20 z-20 pt-2 pb-4 bg-gradient-to-t from-[#F8F9FA] via-[#F8F9FA]/90 to-transparent">
  <button
    type="button"
    onClick={handleResetAction}
    className="btn-primary w-full min-h-[64px] sm:min-h-[72px] flex items-center justify-center gap-3 text-senior-xl font-extrabold shadow-xl bg-teal-700 hover:bg-teal-800"
    aria-label="تصوير روشتة أخرى"
  >
    <RotateCcw className="w-7 h-7" />
    <span>🔄 تصوير روشتة أخرى</span>
  </button>
</div>
```

In `src/App.tsx` (line 206):
```tsx
<main className="w-full max-w-2xl px-4 py-6 sm:py-8 flex-1 flex flex-col justify-start pb-28">
```

In `src/components/BottomNavBar.tsx` (line 59):
```tsx
<nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-slate-200 shadow-lg pb-safe">
  <div className="max-w-md mx-auto px-2 flex items-center justify-between min-h-[72px]">
```

### 2.2 Mathematical Failure Analysis
- **Bottom Navigation Total Height:**
  - Base height: `72px` (`min-h-[72px]`).
  - Safe-area inset: `.pb-safe` calculates `max(16px, env(safe-area-inset-bottom, 16px))` = `16px` to `34px`.
  - Total nav height on standard devices = `88px` (up to `106px` with gesture pill).
- **Sticky Container Geometry:**
  - Pinned offset: `bottom-20` = `5rem` = `80px` (or `100px` if html root font is 20px!).
  - Button height: `min-h-[64px]` (sm: `72px`).
  - Container padding: `pt-2` (8px) + `pb-4` (16px) = `24px`.
  - Total height of sticky element: `64px + 24px = 88px` (sm: `96px`).
  - Reach from screen bottom: `80px + 88px = 168px` (sm: `176px`).
- **Scroll Container Deficit:**
  - Main bottom padding: `pb-28` = `7rem` = `112px` (or `140px` at 20px root).
  - Deficit: `168px - 112px = 56px` (sm: `64px`).
  - **Result:** The bottom `56px` to `64px` of the scrollable content (where `DisclaimerBanner` sits) is permanently obscured beneath the opaque/gradient sticky button container, even when the user scrolls to the absolute bottom!
- **Collision with "استمع للروشتة كاملة" Button:**
  - On viewports with height 640px (common in budget Android devices) or landscape mode, the sticky button occupies ~26% of the viewport.
  - When the prescription contains 0-1 items or during initial scroll, the sticky retake button directly touches or overlaps the audio readout toolbar ("استمع للروشتة كاملة"), visually confusing users as to what the primary action is.
  - The sticky button is currently styled as a primary CTA (`btn-primary bg-teal-700 font-extrabold shadow-xl min-h-[64px]`), competing directly with the primary audio readout button (`bg-teal-700 min-h-[64px]`).

### 2.3 Recommended Solution
1. **Re-style as Compact Secondary Action:**
   - Change button styling from `btn-primary bg-teal-700 text-senior-xl min-h-[64px]` to a clean secondary pill:
     `min-h-[48px] py-2.5 px-4 text-sm sm:text-base font-bold rounded-xl bg-white/95 dark:bg-[#162124]/95 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2`.
   - Remove the heavy `🔄` emoji from text, retaining `<RotateCcw className="w-5 h-5" />` and keeping `aria-label="تصوير روشتة أخرى"` for test compatibility (`tests/m4.prescription.test.tsx` line 189).
2. **Reduce Sticky Wrapper Footprint:**
   - Change sticky wrapper from `pt-2 pb-4 bg-gradient-to-t ...` to a slim container: `sticky bottom-20 z-20 py-2 bg-gradient-to-t from-[#F8F9FA] dark:from-[#0E1517] via-[#F8F9FA]/80 dark:via-[#0E1517]/80 to-transparent`.
3. **Fix Scroll Padding:**
   - Increase bottom padding on the scrollable container or on `PrescriptionResultView`:
     Add `pb-36` (144px) to `PrescriptionResultView` or dynamic padding `pb-[calc(5rem+4rem+env(safe-area-inset-bottom,16px))]`.
   - This guarantees that the bottom of `DisclaimerBanner` clears the top edge of the sticky button with at least 24px of clear breathing room.

---

## 3. Detailed Analysis: R1.2 Bottom Navigation Bar (`BottomNavBar.tsx`)

### 3.1 Current Implementation & Geometry
In `src/components/BottomNavBar.tsx` (lines 59-144):
- Container:
  ```tsx
  <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-slate-200 shadow-lg pb-safe">
    <div className="max-w-md mx-auto px-2 flex items-center justify-between min-h-[72px]">
  ```
- 4 regular tabs:
  ```tsx
  className={`min-h-[64px] min-w-[64px] flex-1 flex flex-col items-center justify-center py-1 transition-all ${
    activeTab === 'home'
      ? 'bg-[#006D77]/15 text-[#006D77] rounded-full px-4 py-1'
      : 'text-slate-600 hover:text-teal-700'
  }`}
  ```
  Icons: `w-7 h-7` (28px).
  Labels: `<span className="text-base font-bold mt-1">الرئيسية</span>` (16px, or 20px if root rem is 20px).
- Center Camera Tab:
  ```tsx
  <div className="relative flex flex-col items-center justify-center -mt-7 px-1">
    <button className="w-[76px] h-[76px] rounded-full bg-[#006D77] hover:bg-teal-800 active:scale-[0.96] ... border-4 border-white ...">
  ```

### 3.2 Viewport Width Failure Analysis (360px & 320px)

| Metric | 320px Viewport | 360px Viewport |
|---|---|---|
| Total available width | 320px | 360px |
| Outer padding (`px-2`) | 16px (8px * 2) | 16px (8px * 2) |
| Usable width | 304px | 344px |
| Center camera footprint | 76px + 8px padding = 84px | 76px + 8px padding = 84px |
| Width remaining for 4 tabs | 220px | 260px |
| Average width per tab | **55px** | **65px** |
| Minimum width per tab class | `min-w-[64px]` | `min-w-[64px]` |
| 4 tabs minimum width demand | 256px (`4 * 64px`) | 256px (`4 * 64px`) |
| **Total width demand** | **340px** (`256px + 84px`) | **340px** |
| **Overflow / Deficit** | **-36px OVERFLOW (Clipping!)** | **Only 4px slack!** |

### 3.3 The Padding Explosion on Active State
When a tab becomes active, `bg-[#006D77]/15 text-[#006D77] rounded-full px-4 py-1` is applied:
- `px-4` adds `16px` on the left and `16px` on the right = **32px of horizontal padding**!
- In a slot of 55px (320px screen) or 65px (360px screen), subtracting 32px leaves only **23px to 33px** for the Arabic text label!
- An Arabic word like "الروشتة" or "الرئيسية" at `text-base` (16px) is ~60px to 72px wide.
- Because there is no `truncate`, `max-w-full`, or `overflow-hidden`, the label spills over horizontally, colliding with the adjacent slots ("الروشتة" colliding into "السجل", and "الرئيسية" colliding into "أدويتي").

### 3.4 Recommended Grid Architecture & Spec Compliance
To guarantee **zero overlap** at 360px and 320px:
1. **Equal 5-Slot Architecture:**
   Use a strict 5-column CSS grid or 5 equal `w-1/5` slots:
   `className="max-w-md mx-auto grid grid-cols-5 items-center min-h-[64px] px-1"`
   - At 320px: each slot gets `(320 - 8) / 5 = 62.4px`.
   - At 360px: each slot gets `(360 - 8) / 5 = 70.4px`.
2. **Icon Sizing:**
   Change from `w-7 h-7` (28px) to exactly **24px** (`w-6 h-6`, stroke width 2).
3. **Label Sizing & Truncation:**
   - Font size: strictly **12px** (`text-xs`), font-medium (never above 14px).
   - Single line guarantee: `w-full text-center truncate block px-0.5 whitespace-nowrap overflow-hidden text-ellipsis`.
4. **Active Indicator Without Width Distortion:**
   - Avoid `px-4` on the entire button container.
   - For test compatibility (`tests/m3.challenge1.test.ts` lines 118-120: `expect(activeTabButton?.className).toContain('rounded-full'); expect(activeTabButton?.className).toContain('bg-[#006D77]/15'); expect(activeTabButton?.className).toContain('text-[#006D77]');`):
     Keep `rounded-full bg-[#006D77]/15 text-[#006D77]` but use `px-1.5 py-1 max-w-[90%] mx-auto` so it does not spill outside its 20% slot width.
5. **Center Slot Integration:**
   Slot 3 houses the center camera button with `-mt-5`, ensuring it is centered in its own 20% slot without pushing the other 4 slots off-center.

---

## 4. Detailed Analysis: R1.3 Button Emojis & Icon Replacements

### 4.1 Exhaustive Audit of Emojis in `src/`

| Location | Line | Current Emoji Snippet | Replacement Line-Icon (`lucide-react`) | Notes |
|---|---|---|---|---|
| `src/App.tsx` | 357 | `<span>🔄 تصوير دواء آخر</span>` | `<RotateCcw className="w-5 h-5 ml-2" />` + `<span>تصوير دواء آخر</span>` | Icon already present; remove emoji character from text |
| `src/App.tsx` | 226 | `<h2>💊 أدويتي المحفوظة</h2>` | `<Pill className="w-5 h-5 text-teal-600 inline ml-2" /> أدويتي المحفوظة` | Replace emoji with Lucide `Pill` |
| `src/App.tsx` | 264 | `🗑️ حذف` | `<Trash2 className="w-4 h-4 ml-1 inline text-rose-600" /> حذف` | Replace emoji with Lucide `Trash2` |
| `src/App.tsx` | 269 | `🧪 المادة الفعالة: ...` | `<FlaskConical className="w-4 h-4 text-teal-600 inline ml-1" /> المادة الفعالة:` | Replace emoji with Lucide `FlaskConical` |
| `src/App.tsx` | 300 | `<h2>🕒 سجل الأدوية السابقة</h2>` | `<History className="w-5 h-5 text-slate-600 inline ml-2" /> سجل الأدوية السابقة` | Replace emoji with Lucide `History` |
| `src/components/PrescriptionResultView.tsx` | 219 | `<span>🔄 تصوير روشتة أخرى</span>` | `<RotateCcw className="w-4 h-4 ml-2" />` + `<span>تصوير روشتة أخرى</span>` | Icon already present; remove emoji character from text |
| `src/components/UnclearPhotoCard.tsx` | 85 | `<span>🔄 إعادة المحاولة الآن</span>` | `<RefreshCw className="w-5 h-5 ml-2" />` + `<span>إعادة المحاولة الآن</span>` | Remove emoji character from text |
| `src/components/UnclearPhotoCard.tsx` | 96 | `<span>📷 {isPrescription ? ...}</span>` | `<Camera className="w-5 h-5 ml-2" />` + `<span>{...}</span>` | Remove emoji character from text |
| `src/components/UnclearPhotoCard.tsx` | 143 | `<span>🔄 إعادة المحاولة الآن</span>` | `<RefreshCw className="w-5 h-5 ml-2" />` + `<span>إعادة المحاولة الآن</span>` | Remove emoji character from text |
| `src/components/UnclearPhotoCard.tsx` | 154 | `<span>🏠 العودة للرئيسية</span>` | `<Home className="w-5 h-5 ml-2" />` + `<span>العودة للرئيسية</span>` | Remove emoji character from text |
| `src/components/UnclearPhotoCard.tsx` | 189 | `<span>🔄 إعادة المحاولة الآن</span>` | `<RefreshCw className="w-5 h-5 ml-2" />` + `<span>إعادة المحاولة الآن</span>` | Remove emoji character from text |
| `src/components/UnclearPhotoCard.tsx` | 200 | `<span>📷 {isPrescription ? ...}</span>` | `<Camera className="w-5 h-5 ml-2" />` + `<span>{...}</span>` | Remove emoji character from text |
| `src/components/UnclearPhotoCard.tsx` | 292 | `<span>📷 {retakeButtonLabel}</span>` | `<Camera className="w-5 h-5 ml-2" />` + `<span>{retakeButtonLabel}</span>` | Remove emoji character from text |
| `src/components/HomeScreen.tsx` | 98 | `<button ...>✕</button>` | `<X className="w-5 h-5 text-amber-800" />` | Replace character with Lucide `X` |
| `src/components/HomeScreen.tsx` | 161 | `<span>📁 أو اختر صورة من الألبوم</span>` | `<Image className="w-5 h-5 ml-2" />` + `<span>اختر صورة من الألبوم</span>` | Remove emoji character from text |
| `src/components/CameraCapture.tsx` | 77 | `<button ...>✕</button>` | `<X className="w-5 h-5 text-amber-800" />` | Replace character with Lucide `X` |
| `src/components/CameraCapture.tsx` | 93 | `<span>📷 صوّر علبة الدواء الآن</span>` | `<Camera className="w-6 h-6 ml-2" />` + `<span>صوّر علبة الدواء الآن</span>` | Remove emoji character from text |
| `src/components/CameraCapture.tsx` | 105 | `<span>📁 أو اختر صورة من الألبوم</span>` | `<Image className="w-5 h-5 ml-2" />` + `<span>اختر صورة من الألبوم</span>` | Remove emoji character from text |
| `src/components/AudioToolbar.tsx` | 70 | `جاري القراءة الآن 🔊` / `متوقف مؤقتاً ⏸️` | Text only with status dot or Lucide icon: `جاري القراءة` / `متوقف مؤقتاً` | Remove emojis |
| `src/components/AudioToolbar.tsx` | 85 | `<span>🔊 استمع للمعلومات بصوت واضح</span>` | `<Play className="w-5 h-5 ml-2" />` + `<span>استمع للمعلومات بصوت واضح</span>` | Remove emoji character from text |
| `src/components/FontSizeToggle.tsx` | 35 | `🔍 خط كبير جداً (مفعّل)` | `<Type className="w-4 h-4 ml-1 inline" />` + `خط كبير جداً` | Component replaced by top bar Aa button |
| `src/components/MedicineDetailsModal.tsx` | 130 | `<button ...>✕</button>` | `<X className="w-5 h-5 text-slate-700" />` | Replace character with Lucide `X` |
| `src/components/MedicineDetailsModal.tsx` | 187 | `<span>تمت الإضافة لقائمة أدويتي ✓</span>` | `<Check className="w-5 h-5 ml-2 text-emerald-700" />` + `<span>تمت الإضافة لقائمة أدويتي</span>` | Remove checkmark character from text |
| `src/components/ResultCards.tsx` | 102 | `🧪 {result.active_ingredient}` | `<FlaskConical className="w-4 h-4 text-teal-600 inline ml-1.5" /> {result.active_ingredient}` | Replace emoji with Lucide `FlaskConical` |

### 4.2 Icon Set Consistency
All icons are verified available in `lucide-react@0.468.0`:
`Scan`, `ScanLine`, `Camera`, `RotateCcw`, `RefreshCw`, `Pill`, `Trash2`, `FlaskConical`, `History`, `Home`, `Image`, `X`, `Check`, `Type`, `Volume2`, `Play`, `Pause`, `AlertTriangle`, `Info`.
All icons should use uniform stroke width (`strokeWidth={2}` or default) to maintain a cohesive native Android aesthetic.

---

## 5. Detailed Analysis: R1.4 Top Bar / Header

### 5.1 Current Implementation in `src/App.tsx`
Lines 187-202:
```tsx
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
```

### 5.2 Identified Deficiencies
1. **Vertical Footprint:** Title is `text-senior-xl sm:text-senior-2xl` (28px - 32px), plus a two-line subtitle (`مساعدك الطبي لقراءة علب الأدوية والروشتات`), plus `w-12 h-12` logo. Total header height exceeds 76px, stealing vital screen real-estate.
2. **Missing Font-Size Action:** The font size toggle is currently implemented as a bulky, standalone card (`FontSizeToggle.tsx`, 70px tall) placed inside `ResultCards` and `PrescriptionResultView`. It is completely absent from the top bar where users expect persistent accessibility controls.
3. **Missing Slim Advisory Banner:** Requirement R1 specifies a slim one-line banner (13-14px, info icon) for "راجع أسماء الأدوية قبل الاعتماد". Currently, `PrescriptionResultView` renders this as a heavy 4-line padding alert box (`bg-teal-50 border-2 border-teal-200 p-4`).

### 5.3 Redesign Blueprint
1. **Compact Top Bar Layout:**
   - Container: `w-full bg-white dark:bg-[#162124] border-b border-slate-200 dark:border-slate-800 shadow-xs sticky top-0 z-30 px-4 py-2.5 pt-safe flex flex-col`.
   - Main Row (`h-12` flex items-center justify-between):
     - **Right side (RTL Start):** Small logo (`w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs`) with `<Pill className="w-5 h-5" />`, and App title `text-[18px] font-bold text-teal-900 dark:text-teal-100`.
     - **Subtitle:** Completely removed.
     - **Left side (RTL End):** Small, accessible "Aa" button replacing the large font card:
       `<button type="button" onClick={handleToggleFontSize} className="min-w-[48px] min-h-[48px] rounded-xl bg-slate-100 dark:bg-[#1D2B2F] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center justify-center transition-all" aria-label="تغيير حجم الخط">Aa</button>`.
2. **Slim Advisory Banner (13-14px):**
   - Directly underneath the header row or conditionally displayed in prescription mode:
     ```tsx
     <div role="region" aria-label="تنبيه الروشتة" className="w-full bg-teal-50/90 dark:bg-[#1D2B2F] border-t border-teal-100 dark:border-teal-900/40 py-1.5 px-3 flex items-center justify-center gap-2 text-teal-900 dark:text-teal-200 text-[13px] sm:text-[14px] font-semibold">
       <Info className="w-4 h-4 flex-shrink-0 text-teal-700 dark:text-teal-400" aria-hidden="true" />
       <span>راجع أسماء الأدوية قبل الاعتماد</span>
     </div>
     ```
   - Matches the exact text `PRESCRIPTION_ADVISORY_BANNER` expected by tests (`tests/m4.prescription.test.tsx` line 118, `tests/e2e/tier1_features/prescription_presentation.test.ts` line 103).

---

## 6. Detailed Analysis: R2.1 Center Raised Camera Button

### 6.1 Current Implementation vs New Specification

| Feature | Current Implementation | Redesign Spec (R2) | Test Compatibility Constraint |
|---|---|---|---|
| **Dimensions** | `w-[76px] h-[76px]` | `64px` circle (`w-16 h-16` / `w-[64px] h-[64px]`) | `m3.challenge1.test.ts` line 168 expects `w-[76px]` or `minSize >= 64px`. Old tests will be updated per R3 guardrail. |
| **Background** | Solid `bg-[#006D77]` | Teal gradient `#0A8F9C` to `#006D77` (`bg-gradient-to-tr from-[#006D77] to-[#0A8F9C]`) | Preserves primary brand teal `#006D77` |
| **Notch Ring** | `border-4 border-white` | `4px ring matching nav bar background` (`ring-4 ring-white dark:ring-[#162124]`) | Creates native floating notch illusion |
| **Shadow** | `shadow-xl` | Soft glow shadow (`shadow-[0_4px_16px_rgba(0,109,119,0.35)]`) | Modern luminous depth |
| **Icon** | Lucide `Camera` (`w-8 h-8 text-white`) | White scan-style line-icon inside corner brackets (`ScanLine` or `Scan`, 24-28px) | Uniform stroke width line icon |
| **Label** | Crammed inside button: `<span className="text-xs font-black text-white mt-0.5">صوّر</span>` | Small "صوّر" label below button or cleanly integrated | `m3.challenge1.test.ts` line 86 checks `expect(cameraBtn?.textContent).toContain('صوّر')` |
| **Animation** | `active:scale-[0.96]` | `active:scale-95 duration-150 ease-out` | Satisfies <200ms transition spec |
| **Haptic** | `navigator.vibrate(10)` | `navigator.vibrate(10)` (light haptic) | Fully preserved |
| **Dark Mode** | White border hardcoded | Dynamically matches active nav surface | Meets 4.5:1 contrast |
| **Tap Action** | Invokes `capturePhoto()`, mutex lock via `isCapturing` | **100% UNCHANGED** | Preserves all camera and proxy handling |

---

## 7. Detailed Analysis: R2.2 Home Screen (`HomeScreen.tsx`)

### 7.1 Current Structure & Shortcomings
In `src/components/HomeScreen.tsx`:
1. **Greeting:**
   `bg-teal-50 border-2 border-teal-500 rounded-3xl p-6` containing 2 long paragraphs. Takes over 140px of vertical space before any actions are visible.
2. **Action Cards:**
   Two large vertical action buttons (`min-h-[120px] rounded-3xl p-6 border-2`), one teal (`صوّر علبة الدواء الآن`), one blue (`صوّر روشتة`). Followed by a secondary gallery button `📁 أو اختر صورة من الألبوم` (`min-h-[64px]`).
3. **Recent Scans Empty State:**
   When empty, renders a large 120px white card with `Clock` icon and empty message, creating dead white space on screen.

### 7.2 Redesign Recommendation
1. **Compact Greeting:**
   Clean, inviting, non-boxed greeting:
   `<div className="text-right py-2"><h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">أهلاً بك في دليلي الدوائي</h2><p className="text-sm text-slate-600 dark:text-slate-400">اختر نوع الفحص للبدء فوراً بالصوت والكتابة الواضحة</p></div>`.
2. **Two Clean Action Cards (16px radius):**
   - **Card 1: علبة دواء** (Medicine Box)
     `rounded-2xl p-5 bg-white dark:bg-[#162124] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex items-center justify-between group`.
     Icon: Crisp `Pill` or `Camera` in a subtle teal badge (`bg-teal-50 dark:bg-teal-950/50 text-[#006D77]`).
   - **Card 2: روشتة** (Prescription)
     `rounded-2xl p-5 bg-white dark:bg-[#162124] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex items-center justify-between group`.
     Icon: Crisp `FileText` in a subtle blue badge (`bg-blue-50 dark:bg-blue-950/50 text-blue-700`).
   - Gallery access: A clean, compact secondary text-button or icon button beneath the cards.
3. **Compact Recent-Scans List:**
   - Eliminates bloated borders.
   - When empty: a slim, single-line placeholder: `<div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2"><Clock className="w-4 h-4" /><span>لا توجد عمليات فحص سابقة بعد</span></div>`.
   - When populated: compact list rows with 12px pill badges, medicine name bold, date/ingredient in small muted font, and `ChevronLeft`.

---

## 8. Detailed Analysis: R2.3 Result Cards (`PrescriptionResultView.tsx` & `ResultCards.tsx`)

### 8.1 Prescription Result Cards (`PrescriptionResultView.tsx`)
- **Current:** Bulky `p-6 rounded-3xl border-2 border-teal-600` buttons.
- **Redesign:**
  - Modern `rounded-2xl` cards with 16px radius (`rounded-2xl p-4 sm:p-5 bg-white dark:bg-[#162124] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md`).
  - **Medicine Name:** Bold, prominent (`text-lg font-bold text-slate-900 dark:text-slate-100`).
  - **Confidence Chip:** Sleek pill badge (`px-2.5 py-0.5 rounded-full text-xs font-semibold`, e.g. emerald `bg-emerald-50 text-emerald-700 border border-emerald-200` for high, amber for medium).
  - **"as written" Line:** Rendered in small, muted typography (`text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5`).
  - **Expandable Chevron:** `ChevronDown` (or `ChevronLeft`) to seamlessly expand details inline or open the modal, with `<200ms` smooth transition.
  - **Low-Confidence Card:** Retains the soft amber background (`#FEF3C7` / `#92400E` in light, `#3A2E12` / `#F5D58A` in dark mode) and exact warning `غير واضح، اسأل الصيدلي` required by `tests/m4.prescription.test.tsx` line 157.

### 8.2 Medicine Box Result Cards (`ResultCards.tsx`)
- 4 color-coded cards (Identity, Uses, Schedule, Warnings):
  - Replace overly thick `border-3 border-teal-600` / `border-blue-600` / `border-emerald-600` / `border-amber-500` with sleek `border border-slate-200 dark:border-slate-800` cards with a clean top/side color accent or clean icon badges.
  - Border radius updated to `rounded-2xl` (16px).
  - Shadows updated to soft native elevation (`shadow-sm`).
  - Strictly preserve:
    - `data-testid="usage-source-badge"`
    - `data-testid="usage-disclaimer-container"`
    - `data-testid="usage-disclaimer-line"`
    - The exact 87-character `HARDCODED_DISCLAIMER_LINE` tested in `tests/m4.prescription.test.tsx` line 312.

---

## 9. Performance & Ergonomics: Skeleton Loaders, Transitions, Haptics & Reduced Motion

### 9.1 Skeleton Loaders During Analysis
- Currently, `LoadingSpinner.tsx` only renders `<Loader2 animate-spin>` and `<HeartPulse animate-pulse>`.
- **Redesign:**
  Implement a pulsating skeleton placeholder matching the 4 result cards layout:
  - Header skeleton: `w-32 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse`.
  - Body line skeletons: 3 staggered lines (`w-full h-4`, `w-4/5 h-4`, `w-2/3 h-4`).
  - Reassuring Arabic status text: `"جاري قراءة علبة الدواء بالذكاء الاصطناعي..."`.
  - This drastically improves perceived performance on Android devices during 2-5 second Gemini Vision calls.

### 9.2 Snappy Screen Transitions (<200ms)
- Replace generic transitions with fast CSS transitions capped under 200ms:
  `transition-all duration-150 ease-out` or `transition-native` (defined in `index.css` as `transition-duration: 200ms`).

### 9.3 Light Haptics
- Navigation tab taps and center camera taps execute `navigator.vibrate(10)` or `@capacitor/haptics` `Haptics.impact({ style: ImpactStyle.Light })`.
- Safely wrapped in feature detection so browser tests and desktop environments run cleanly without throwing.

### 9.4 Accessibility & Reduced-Motion (`prefers-reduced-motion`)
- Add utility rules in `src/index.css`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```
- Use Tailwind's `motion-reduce:transition-none motion-reduce:animate-none` on all animated elements (spinners, skeletons, button scale).

---

## 10. Test Alignment & Guardrails Matrix

| Component / Area | Existing Test File | What the Test Checks Today | Necessary Update or Safeguard |
|---|---|---|---|
| **Sticky Button** | `tests/m4.prescription.test.tsx`:189 | `screen.getByRole('button', { name: 'تصوير روشتة أخرى' })` | Retain exact `aria-label="تصوير روشتة أخرى"`. Removing emoji from text will NOT break test. |
| **Advisory Banner** | `tests/m4.prescription.test.tsx`:118 | `screen.getByText(PRESCRIPTION_ADVISORY_BANNER)` | Retain exact text `"راجع أسماء الأدوية قبل الاعتماد"`. |
| **Low-Confidence Card** | `tests/m4.prescription.test.tsx`:157 | `screen.getByText(LOW_CONFIDENCE_AMBER_TEXT)` | Retain exact text `"غير واضح، اسأل الصيدلي"`. |
| **Card 3 Disclaimer** | `tests/m4.prescription.test.tsx`:312 | `expect(HARDCODED_DISCLAIMER_LINE).toBe(...)` | Keep `data-testid="usage-disclaimer-line"` and exact text intact. |
| **Bottom Nav RTL Tabs** | `tests/m3.challenge1.test.ts`:34-38 | Checks `RTL_NAV_TABS` export sequence and keys | Keep `RTL_NAV_TABS` array identical: `[home, medicines, camera, prescription, history]`. |
| **Bottom Nav Active Class** | `tests/m3.challenge1.test.ts`:118-120 | Checks `rounded-full`, `bg-[#006D77]/15`, `text-[#006D77]` | Retain these 3 class names on active tab button. |
| **Bottom Nav Touch Target** | `tests/m3.challenge1.test.ts`:423 | Checks `min-h-[64px]` and `min-w-[64px]` | Per R3 spec: update to 48px/56px target rule without weakening tests. |
| **Center Camera Dimensions** | `tests/m3.challenge1.test.ts`:168 | Checks `w-[76px]` and `h-[76px]` | Per R2 spec: update test assertion to 64px (`w-16` / `w-[64px]`). |
| **Center Camera Text** | `tests/m3.challenge1.test.ts`:86 | Checks `cameraBtn?.textContent` contains `صوّر` | Keep `صوّر` label within button container. |
| **Secret Scan** | `tests/secretScan.test.ts` | Greps for API keys and endpoint leaks | Ensure zero secrets or API tokens exist in modified files. |

---

## 11. Conclusion
The proposed layout, navigation, icon, and card redesigns completely resolve the clipping, overlapping, and visual clutter issues observed on small viewports (320px and 360px) while maintaining 100% functional integrity, test compatibility, and Arabic accessibility.
