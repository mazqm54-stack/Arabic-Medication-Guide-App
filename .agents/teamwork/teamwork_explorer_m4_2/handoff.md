# Handoff Report: Explorer 2 (Milestone M4 — Unclear Photo Guidance & Medication Usage Card)

## 1. Observation

Direct observations from examining the codebase, specifications, and test suites:

1. **`src/components/UnclearPhotoCard.tsx` (Current State)**:
   - Line 15–22: `UnclearPhotoCardProps` only defines:
     ```ts
     export interface UnclearPhotoCardProps {
       onRetry?: () => void;
       onRetake?: () => void;
       errorMessage?: string;
       errorCategory?: ErrorCategory;
       errorCode?: string;
       hasLastImage?: boolean;
     }
     ```
   - Lines 193–231: The default `unclear_image` state renders only TWO tips:
     - Tip 1 (Line 213): `تأكد من وجود إضاءة كافية فوق علبة الدواء.`
     - Tip 2 (Line 217): `قرّب الكاميرا واجعل اسم الدواء في منتصف الشاشة.`
     - Missing Tip 3 on steadiness/holding phone steady.
   - Lines 221–229: The retake button is hardcoded to box terminology:
     - `aria-label="إعادة تصوير علبة الدواء الآن"`
     - Text content: `📷 إعادة تصوير العلبة الآن`
   - Existing unit tests (`tests/errorStates.test.tsx` lines 86–91 and `tests/errorStates.challenge.test.tsx` lines 351–365) explicitly assert:
     - `expect(screen.getByText('الصورة غير واضحة بما يكفي')).toBeInTheDocument()`
     - `expect(screen.getByText('تأكد من وجود إضاءة كافية فوق علبة الدواء.')).toBeInTheDocument()`
     - `expect(screen.getByText('قرّب الكاميرا واجعل اسم الدواء في منتصف الشاشة.')).toBeInTheDocument()`
     - `screen.getByRole('button', { name: /إعادة تصوير علبة الدواء الآن/i })`
     - `expect(retakeBtn).toHaveTextContent('إعادة تصوير العلبة الآن')`
     - Any modification must preserve these exact strings when in box mode to prevent test regressions.

2. **Requirements for `UnclearPhotoCard` in M4 (`PROJECT.md` F19, `ORIGINAL_REQUEST.md` R3, `tests/e2e/tier1_features/prescription_presentation.test.ts` lines 221–257)**:
   - F19 mandates a unified card used across BOTH the box photo flow and prescription photo flow when `is_clear === false`.
   - Exactly 3 short concrete tips:
     1. الإضاءة: إضاءة كافية بدون ظلال أو لمعان شديد.
     2. الإطار: ملء الشاشة بالعلبة أو الروشتة والتأكد من ظهور الورقة كاملة ووضوح الكلام.
     3. الثبات: تثبيت الهاتف باليدين لمنع الاهتزاز أثناء التصوير.
   - Large prominent button labeled "إعادة التصوير" with touch target $\ge 64$px and WCAG AAA contrast.
   - Disabled state support during active capture (`prescription_presentation_boundary.test.ts` line 228).
   - Partial legibility preservation (`PROJECT.md` F20): If a prescription has some readable items and some unreadable items, readable items render as standard cards, and unreadable lines render as soft amber cards (`LOW_CONFIDENCE_AMBER_TEXT = 'غير واضح، اسأل الصيدلي'`). `UnclearPhotoCard` is only rendered when zero items are readable or the entire image is illegible.

3. **`src/components/ResultCards.tsx` (Current State)**:
   - Lines 101–135 (Card 3: طريقة الاستخدام وأفضل المواعيد):
     - Lacks `usage_source` badge.
     - Lacks the hardcoded usage disclaimer line.
     - Fallback on empty `how_and_when` renders a generic message:
       `<p className={`${bodyClass} text-slate-700 pr-2`}>اتبع بدقة توجيهات الطبيب المكتوبة على الوصفة الطبية.</p>`
       This violates Feature F21.

4. **Requirements for Card 3 in M4 (`PROJECT.md` F21–F23, `tests/e2e/tier1_features/medication_usage.test.ts`, `tests/e2e/tier2_boundaries/medication_usage_boundary.test.ts`)**:
   - F21 (`how_and_when` Non-Empty Guarantee): Must always render 2–3 practical items and NEVER an empty list or single generic "follow doctor" phrase. Safe fallback:
     ```ts
     [
       'يؤخذ عادة في أوقات منتظمة يومياً حسب توجيهات الصيدلي',
       'يفضل تناوله مع كوب ماء كامل بعد الطعام',
       'راجع طبيبك أو الصيدلي دائماً لتحديد الجرعة المناسبة لحالتك',
     ]
     ```
   - F22 (`usage_source` Badging):
     - Source: `'printed' | 'common'`
     - Labels:
       - `printed` + box context: `"مكتوب على العلبة"`
       - `printed` + prescription context: `"مكتوب في الروشتة"`
       - `common`: `"الاستخدام الشائع"`
     - Badge CSS classes:
       - `printed`: `'bg-emerald-100 text-emerald-800 border-emerald-300'`
       - `common`: `'bg-blue-100 text-blue-800 border-blue-300'`
       - Container: `'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border'`
       - `data-testid="usage-source-badge"`
   - F23 (Hardcoded Arabic Disclaimer Line):
     - Exact string constant:
       `HARDCODED_DISCLAIMER_LINE = 'هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي.'`
     - Exact length: 87 characters.
     - Placement: Immediately below the usage card list in Card 3.
     - Styling: `text-slate-600`, font size scaling with `fontSize` preference (`text-base` / `text-lg`), RTL alignment (`dir="rtl"`).

5. **Existing Project Health Baseline**:
   - `vitest run --run`: 1021 passing tests across 40 test files (0 failures).

---

## 2. Logic Chain

1. **Backwards Compatibility & Unification Strategy for `UnclearPhotoCard.tsx`**:
   - Existing unit tests in `tests/errorStates.test.tsx` and `tests/errorStates.challenge.test.tsx` verify exact strings for box mode (`تأكد من وجود إضاءة كافية فوق علبة الدواء.`, `قرّب الكاميرا واجعل اسم الدواء في منتصف الشاشة.`, and `إعادة تصوير العلبة الآن`).
   - Adding an optional prop `context?: 'box' | 'prescription'` (defaulting to `'box'` or auto-inferred if `errorMessage` mentions 'روشتة') and an optional `retakeButtonLabel?: string` allows `UnclearPhotoCard` to serve both flows cleanly:
     - In `context === 'box'`: Render the 2 existing box tips PLUS a 3rd tip on holding the phone steady (`ثبّت الهاتف باليدين لمنع الاهتزاز أثناء التقاط الصورة.`), keeping button label `إعادة تصوير العلبة الآن`.
     - In `context === 'prescription'`: Render the 3 prescription tips specified in F19 (إضاءة, إطار, ثبات), with button label `إعادة التصوير` and aria-label `إعادة التصوير`.
   - Adding `isRetrying?: boolean` satisfies the boundary test for disabled state during capture.

2. **Partial Clarity Preservation Execution**:
   - In `geminiParser.ts`, `validatePrescriptionJson` sets `is_clear: false` only if the input is flagged unclear or `items` array has zero items.
   - When `items` has $\ge 1$ item, `PrescriptionResultView` renders each item based on its individual confidence level:
     - High/Medium confidence $\rightarrow$ Standard card, clickable for `MedicineDetailsModal`.
     - Low confidence $\rightarrow$ Amber card with `LOW_CONFIDENCE_AMBER_TEXT` ("غير واضح، اسأل الصيدلي"), verbatim line text, and zero AI explanations.
   - Therefore, `UnclearPhotoCard` is only rendered when the entire prescription failed or returned 0 items.

3. **Card 3 Implementation Strategy for `ResultCards.tsx`**:
   - Export `HARDCODED_DISCLAIMER_LINE` as a named constant so it can be imported by tests or other views.
   - Add optional `context?: 'box' | 'prescription'` to `ResultCardsProps` (defaulting to `'box'`).
   - Implement `safeHowAndWhen` computation inside Card 3:
     - Filter raw items for null/undefined/empty string/single-character noise.
     - Filter out generic "follow doctor" patterns.
     - If the resulting list is empty, inject the 3 standard safe common usage items and treat `usage_source` as `'common'`.
   - Render the `usage_source` badge in the Card 3 header with `data-testid="usage-source-badge"`.
   - Render the `HARDCODED_DISCLAIMER_LINE` immediately beneath the usage instructions with `data-testid="usage-disclaimer-line"`.

---

## 3. Caveats

1. **Test String Sensitivity**:
   - `tests/errorStates.test.tsx` and `tests/errorStates.challenge.test.tsx` test exact Arabic strings without fuzzy matching. Worker must not alter existing Arabic strings in box mode.
2. **Context Resolution**:
   - If `context` is omitted on `ResultCards` or `UnclearPhotoCard`, both must default to `'box'` to guarantee zero regressions for existing home/history scan components.
3. **Prescription Flow Coordination**:
   - Explorer 1 is specifying `PrescriptionFlow.tsx` and `PrescriptionResultView.tsx`. When `PrescriptionFlow` encounters `is_clear === false`, it must invoke `<UnclearPhotoCard context="prescription" onRetry={...} onRetake={...} errorMessage={...} />`.

---

## 4. Conclusion & Implementation Blueprint for Worker

### A. Exact JSX & Code Specification for `src/components/UnclearPhotoCard.tsx`

```tsx
import React from 'react';
import {
  AlertTriangle,
  RefreshCw,
  SunMedium,
  Focus,
  Smartphone,
  WifiOff,
  ServerCrash,
  FileCode,
  Camera,
  Home
} from 'lucide-react';
import { ErrorCategory } from '../types';

export interface UnclearPhotoCardProps {
  onRetry?: () => void;
  onRetake?: () => void;
  errorMessage?: string;
  errorCategory?: ErrorCategory;
  errorCode?: string;
  hasLastImage?: boolean;
  context?: 'box' | 'prescription';
  retakeButtonLabel?: string;
  isRetrying?: boolean;
}

export const UnclearPhotoCard: React.FC<UnclearPhotoCardProps> = ({
  onRetry,
  onRetake,
  errorMessage,
  errorCategory,
  errorCode,
  hasLastImage: _hasLastImage = false,
  context = 'box',
  retakeButtonLabel,
  isRetrying = false
}) => {
  // Infer category if not explicitly provided
  const category: ErrorCategory = errorCategory || (() => {
    if (errorMessage && (/timeout|30 ثانية|مهلة|network|fetch|شبكة|اتصال/i.test(errorMessage))) {
      return 'network_timeout';
    }
    if (errorMessage && (/خادم|server|500|502|503|504|UPSTREAM/i.test(errorMessage))) {
      return 'server_error';
    }
    if (errorMessage && (/JSON|قراءة رد|syntax/i.test(errorMessage))) {
      return 'invalid_json';
    }
    return 'unclear_image';
  })();

  const isPrescription = context === 'prescription' || (errorMessage && /روشتة/i.test(errorMessage));

  const handleRetry = onRetry || onRetake || (() => {});
  const handleRetake = onRetake || onRetry || (() => {});

  // State (a): Network / Timeout
  if (category === 'network_timeout') {
    return (
      <div
        role="alert"
        className="w-full bg-amber-50 border-3 border-amber-500 rounded-3xl p-6 sm:p-8 shadow-senior my-6 text-right animate-in fade-in duration-200"
      >
        <div className="flex items-center gap-3 mb-4 text-amber-800">
          <WifiOff className="w-10 h-10 text-amber-600 flex-shrink-0" />
          <h2 className="text-senior-2xl font-bold">
            تعذر الاتصال بالشبكة أو انتهت مهلة الطلب
          </h2>
        </div>

        <p className="text-senior-lg text-slate-800 mb-6 leading-relaxed">
          {errorMessage || 'استغرق الاتصال بالخادم وقتاً أطول من المعتاد (أكثر من 30 ثانية) أو انقطع الاتصال بالإنترنت. يرجى التحقق من اتصال الشبكة ثم إعادة المحاولة.'}
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="btn-primary w-full min-h-[64px] sm:min-h-[72px] flex items-center justify-center gap-3 text-senior-xl font-bold bg-teal-700 hover:bg-teal-800 disabled:opacity-50"
            aria-label="إعادة المحاولة الآن"
          >
            <RefreshCw className="w-7 h-7" />
            <span>🔄 إعادة المحاولة الآن</span>
          </button>

          {onRetake && (
            <button
              type="button"
              onClick={handleRetake}
              className="btn-secondary w-full min-h-[64px] flex items-center justify-center gap-3 text-senior-lg font-bold bg-white text-slate-700 border-2 border-slate-300 hover:bg-slate-100"
              aria-label={isPrescription ? "تصوير روشتة أخرى" : "تصوير علبة أخرى"}
            >
              <Camera className="w-6 h-6" />
              <span>📷 {isPrescription ? "تصوير روشتة أخرى" : "تصوير علبة أخرى"}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // State (b): Server Error
  if (category === 'server_error') {
    return (
      <div
        role="alert"
        className="w-full bg-rose-50 border-3 border-rose-500 rounded-3xl p-6 sm:p-8 shadow-senior my-6 text-right animate-in fade-in duration-200"
      >
        <div className="flex items-center gap-3 mb-4 text-rose-800">
          <ServerCrash className="w-10 h-10 text-rose-600 flex-shrink-0" />
          <h2 className="text-senior-2xl font-bold">
            حدث خطأ في الخادم الطبي الذكي
          </h2>
        </div>

        <p className="text-senior-lg text-slate-800 mb-4 leading-relaxed">
          {errorMessage || 'نواجه صعوبة مؤقتة في التواصل مع المعالج الطبي الذكي. يرجى المحاولة مرة أخرى بعد قليل.'}
        </p>

        {errorCode && (
          <div className="mb-6">
            <span
              data-testid="error-code-badge"
              className="inline-flex items-center gap-2 bg-rose-100 text-rose-900 border border-rose-300 rounded-xl px-4 py-2 font-mono text-senior-sm font-bold"
            >
              <span>رمز الخطأ:</span>
              <span>{errorCode}</span>
            </span>
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="btn-primary w-full min-h-[64px] sm:min-h-[72px] flex items-center justify-center gap-3 text-senior-xl font-bold bg-teal-700 hover:bg-teal-800 disabled:opacity-50"
            aria-label="إعادة المحاولة الآن"
          >
            <RefreshCw className="w-7 h-7" />
            <span>🔄 إعادة المحاولة الآن</span>
          </button>

          {onRetake && (
            <button
              type="button"
              onClick={handleRetake}
              className="btn-secondary w-full min-h-[64px] flex items-center justify-center gap-3 text-senior-lg font-bold bg-white text-slate-700 border-2 border-slate-300 hover:bg-slate-100"
              aria-label="العودة للرئيسية"
            >
              <Home className="w-6 h-6" />
              <span>🏠 العودة للرئيسية</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // State (d): Invalid JSON
  if (category === 'invalid_json') {
    return (
      <div
        role="alert"
        className="w-full bg-indigo-50 border-3 border-indigo-500 rounded-3xl p-6 sm:p-8 shadow-senior my-6 text-right animate-in fade-in duration-200"
      >
        <div className="flex items-center gap-3 mb-4 text-indigo-800">
          <FileCode className="w-10 h-10 text-indigo-600 flex-shrink-0" />
          <h2 className="text-senior-2xl font-bold">
            تعذر قراءة رد المعالج الذكي
          </h2>
        </div>

        <p className="text-senior-lg text-slate-800 mb-6 leading-relaxed">
          {errorMessage || 'تعذر قراءة رد المعالج الذكي. يرجى الضغط على زر إعادة المحاولة لقراءة العلبة مجدداً.'}
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="btn-primary w-full min-h-[64px] sm:min-h-[72px] flex items-center justify-center gap-3 text-senior-xl font-bold bg-teal-700 hover:bg-teal-800 disabled:opacity-50"
            aria-label="إعادة المحاولة الآن"
          >
            <RefreshCw className="w-7 h-7" />
            <span>🔄 إعادة المحاولة الآن</span>
          </button>

          {onRetake && (
            <button
              type="button"
              onClick={handleRetake}
              className="btn-secondary w-full min-h-[64px] flex items-center justify-center gap-3 text-senior-lg font-bold bg-white text-slate-700 border-2 border-slate-300 hover:bg-slate-100"
              aria-label={isPrescription ? "تصوير روشتة أخرى" : "تصوير دواء آخر"}
            >
              <Camera className="w-6 h-6" />
              <span>📷 {isPrescription ? "تصوير روشتة أخرى" : "تصوير دواء آخر"}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Default: State (c) unclear_image
  const defaultExplanation = isPrescription
    ? 'الصورة غير واضحة للأسف، ساعدنا بإعادة التقاطها لنتمكن من قراءتها بدقة'
    : 'لم نتمكن من قراءة اسم الدواء بدقة. من أجل سلامتكم وصحتكم، يرجى إعادة التقاط الصورة باتباع النصائح التالية:';

  const defaultButtonLabel = isPrescription
    ? 'إعادة التصوير'
    : 'إعادة تصوير العلبة الآن';

  const defaultAriaLabel = isPrescription
    ? 'إعادة التصوير'
    : 'إعادة تصوير علبة الدواء الآن';

  return (
    <div
      role="alert"
      className="w-full bg-amber-50 border-3 border-amber-500 rounded-3xl p-6 sm:p-8 shadow-senior my-6 text-right animate-in fade-in duration-200"
    >
      <div className="flex items-center gap-3 mb-4 text-amber-800">
        <AlertTriangle className="w-10 h-10 text-amber-600 flex-shrink-0" />
        <h2 className="text-senior-2xl font-bold">
          الصورة غير واضحة بما يكفي
        </h2>
      </div>

      <p className="text-senior-lg text-slate-800 mb-6 leading-relaxed">
        {errorMessage || defaultExplanation}
      </p>

      {/* Exactly 3 concrete tips container */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200 mb-6 space-y-3">
        {isPrescription ? (
          <>
            <div className="flex items-center gap-3 text-slate-800">
              <SunMedium className="w-7 h-7 text-amber-600 flex-shrink-0" />
              <span className="text-senior-base font-semibold">
                الإضاءة: التأكد من إضاءة الغرفة بشكل كافٍ بدون ظلال أو لمعان شديد.
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-800">
              <Focus className="w-7 h-7 text-teal-600 flex-shrink-0" />
              <span className="text-senior-base font-semibold">
                الإطار: إظهار الروشتة كاملة داخل الإطار والتأكد من وضوح الكلام.
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-800">
              <Smartphone className="w-7 h-7 text-blue-600 flex-shrink-0" />
              <span className="text-senior-base font-semibold">
                الثبات: تثبيت الهاتف باليدين وعدم الاهتزاز أثناء التصوير.
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 text-slate-800">
              <SunMedium className="w-7 h-7 text-amber-600 flex-shrink-0" />
              <span className="text-senior-base font-semibold">
                تأكد من وجود إضاءة كافية فوق علبة الدواء.
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-800">
              <Focus className="w-7 h-7 text-teal-600 flex-shrink-0" />
              <span className="text-senior-base font-semibold">
                قرّب الكاميرا واجعل اسم الدواء في منتصف الشاشة.
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-800">
              <Smartphone className="w-7 h-7 text-blue-600 flex-shrink-0" />
              <span className="text-senior-base font-semibold">
                ثبّت الهاتف باليدين لمنع الاهتزاز أثناء التقاط الصورة.
              </span>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={handleRetake}
        disabled={isRetrying}
        className="btn-primary w-full min-h-[64px] sm:min-h-[72px] flex items-center justify-center gap-3 text-senior-xl font-bold bg-teal-700 hover:bg-teal-800 disabled:opacity-50"
        aria-label={retakeButtonLabel || defaultAriaLabel}
      >
        <RefreshCw className="w-7 h-7" />
        <span>📷 {retakeButtonLabel || defaultButtonLabel}</span>
      </button>
    </div>
  );
};
```

---

### B. Exact JSX & Code Specification for `src/components/ResultCards.tsx`

```tsx
import React, { useMemo } from 'react';
import { Pill, FileText, Clock, AlertTriangle, CheckCircle2, Info, Tag } from 'lucide-react';
import { MedicineAnalysisResult, FontSizePreference } from '../types';

export const HARDCODED_DISCLAIMER_LINE = 'هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي.';

export interface ResultCardsProps {
  result: MedicineAnalysisResult;
  fontSize: FontSizePreference;
  context?: 'box' | 'prescription';
}

export const ResultCards: React.FC<ResultCardsProps> = ({ result, fontSize, context = 'box' }) => {
  const isExtraLarge = fontSize === 'extra-large';

  const headingClass = isExtraLarge ? 'text-senior-2xl font-bold' : 'text-senior-xl font-bold';
  const bodyClass = isExtraLarge ? 'text-senior-lg leading-loose' : 'text-senior-base leading-relaxed';
  const iconSizeClass = isExtraLarge ? 'w-10 h-10' : 'w-8 h-8';

  // F21: Multi-tier safe fallback for how_and_when
  const safeHowAndWhen: string[] = useMemo(() => {
    const rawList = Array.isArray(result.how_and_when)
      ? result.how_and_when.filter((item): item is string => typeof item === 'string' && item.trim().length > 2)
      : [];

    const filtered = rawList.filter((item) => {
      const t = item.trim();
      const isGeneric = (
        /^(?:اتبع|يجب اتباع)\s+(?:بدقة\s+)?(?:توجيهات|تعليمات|إرشادات)\s+الطبيب/i.test(t) ||
        /^(?:راجع|استشر)\s+(?:الطبيب|الصيدلي)(?:\s+أو\s+(?:الصيدلي|الطبيب))?(?:\s+.*)?$/i.test(t) ||
        /^(?:اتبع\s+ما\s+كتبه\s+الطبيب|حسب\s+إرشادات\s+الطبيب)(?:\s+.*)?$/i.test(t) ||
        /^as\s+directed\s+by\s+(?:your\s+)?doctor/i.test(t) ||
        /^follow\s+(?:the\s+)?doctor/i.test(t)
      );
      return !isGeneric;
    });

    if (filtered.length === 0) {
      return [
        'يؤخذ عادة في أوقات منتظمة يومياً حسب توجيهات الصيدلي',
        'يفضل تناوله مع كوب ماء كامل بعد الطعام',
        'راجع طبيبك أو الصيدلي دائماً لتحديد الجرعة المناسبة لحالتك',
      ];
    }
    return filtered;
  }, [result.how_and_when]);

  // F22: Usage source badge resolution
  const usageSource: 'printed' | 'common' = result.usage_source === 'printed' ? 'printed' : 'common';

  const badgeLabel = usageSource === 'printed'
    ? (context === 'prescription' ? 'مكتوب في الروشتة' : 'مكتوب على العلبة')
    : 'الاستخدام الشائع';

  const badgeClasses = usageSource === 'printed'
    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
    : 'bg-blue-100 text-blue-800 border-blue-300';

  return (
    <div className="space-y-6 w-full" aria-label="نتائج تحليل علبة الدواء">
      {/* Card 1: اسم الدواء والمادة الفعالة */}
      <section
        tabIndex={0}
        aria-label="اسم الدواء والمادة الفعالة"
        className="card-senior bg-white border-3 border-teal-600 shadow-md"
      >
        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-teal-100">
          <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
            <Pill className={`${iconSizeClass} text-teal-700`} aria-hidden="true" />
          </div>
          <div>
            <span className="text-teal-700 font-bold text-sm block">البطاقة الأولى</span>
            <h2 className={`${headingClass} text-teal-900`}>
              اسم الدواء والمادة الفعالة
            </h2>
          </div>
        </div>

        <div className="space-y-3 pr-2">
          {result.medicine_name_ar && (
            <div>
              <span className="text-slate-600 text-sm font-semibold block mb-0.5">الاسم بالعربية:</span>
              <p className={`${isExtraLarge ? 'text-3xl' : 'text-2xl'} font-extrabold text-teal-800`}>
                {result.medicine_name_ar}
              </p>
            </div>
          )}

          {result.medicine_name_en && (
            <div dir="ltr" className="text-left bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 text-xs font-semibold block mb-0.5">Trade Name & Strength:</span>
              <p className="text-xl font-bold text-slate-800 font-mono">
                {result.medicine_name_en}
              </p>
            </div>
          )}

          {result.active_ingredient && (
            <div className="pt-2">
              <span className="text-slate-600 text-sm font-semibold block mb-0.5">المادة الفعالة:</span>
              <p className={`${bodyClass} font-bold text-slate-800 bg-teal-50/70 p-3 rounded-xl border border-teal-200`}>
                🧪 {result.active_ingredient}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Card 2: دواعي الاستعمال */}
      <section
        tabIndex={0}
        aria-label="دواعي الاستعمال"
        className="card-senior bg-white border-3 border-blue-600 shadow-md"
      >
        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-blue-100">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <FileText className={`${iconSizeClass} text-blue-700`} aria-hidden="true" />
          </div>
          <div>
            <span className="text-blue-700 font-bold text-sm block">البطاقة الثانية</span>
            <h2 className={`${headingClass} text-blue-900`}>
              دواعي الاستعمال (لماذا يُستخدم؟)
            </h2>
          </div>
        </div>

        {result.uses && result.uses.length > 0 ? (
          <ul className="space-y-3 pr-2">
            {result.uses.map((use, index) => (
              <li key={index} className="flex items-start gap-3">
                <CheckCircle2 className="w-7 h-7 text-blue-600 flex-shrink-0 mt-1" aria-hidden="true" />
                <span className={`${bodyClass} font-semibold text-slate-800`}>{use}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`${bodyClass} text-slate-700 pr-2`}>
            يرجى مراجعة النشرة الداخلية أو استشارة الطبيب لمعرفة كافة دواعي الاستعمال.
          </p>
        )}
      </section>

      {/* Card 3: طريقة الاستخدام وأفضل المواعيد (F21, F22, F23) */}
      <section
        tabIndex={0}
        aria-label="طريقة الاستخدام وأفضل المواعيد"
        className="card-senior bg-white border-3 border-emerald-600 shadow-md"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b-2 border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Clock className={`${iconSizeClass} text-emerald-700`} aria-hidden="true" />
            </div>
            <div>
              <span className="text-emerald-700 font-bold text-sm block">البطاقة الثالثة</span>
              <h2 className={`${headingClass} text-emerald-900`}>
                طريقة الاستخدام وأفضل المواعيد
              </h2>
            </div>
          </div>

          {/* F22: Usage Source Badge */}
          <span
            data-testid="usage-source-badge"
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${badgeClasses}`}
          >
            {usageSource === 'printed' ? (
              <Tag className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            ) : (
              <Info className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            )}
            <span>{badgeLabel}</span>
          </span>
        </div>

        {/* F21: Safe guaranteed non-empty instructions */}
        <ul className="space-y-3 pr-2 mb-4">
          {safeHowAndWhen.map((instruction, index) => (
            <li key={index} className="flex items-start gap-3 bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-base">
                {index + 1}
              </span>
              <span className={`${bodyClass} font-bold text-emerald-950`}>{instruction}</span>
            </li>
          ))}
        </ul>

        {/* F23: Hardcoded Arabic Disclaimer Line immediately below Card 3 */}
        <div
          data-testid="usage-disclaimer-container"
          className="mt-4 pt-3 border-t border-emerald-100 text-right"
          dir="rtl"
        >
          <p
            data-testid="usage-disclaimer-line"
            className={`text-slate-600 ${isExtraLarge ? 'text-lg' : 'text-base'} leading-relaxed font-medium`}
          >
            {HARDCODED_DISCLAIMER_LINE}
          </p>
        </div>
      </section>

      {/* Card 4: تنبيهات هامة */}
      <section
        tabIndex={0}
        aria-label="تنبيهات هامة واحتياطات"
        className="card-senior bg-[#FEF3C7] border-3 border-amber-500 shadow-md text-[#92400E]"
      >
        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-amber-300">
          <div className="w-12 h-12 rounded-xl bg-amber-200 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className={`${iconSizeClass} text-amber-800`} aria-hidden="true" />
          </div>
          <div>
            <span className="text-amber-800 font-bold text-sm block">البطاقة الرابعة</span>
            <h2 className={`${headingClass} text-amber-950`}>
              تنبيهات واحتياطات هامة
            </h2>
          </div>
        </div>

        {result.warnings && result.warnings.length > 0 ? (
          <ul className="space-y-3 pr-2">
            {result.warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="w-3 h-3 rounded-full bg-amber-700 flex-shrink-0 mt-3" aria-hidden="true" />
                <span className={`${bodyClass} font-bold text-amber-950`}>{warning}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`${bodyClass} font-semibold text-amber-900 pr-2`}>
            لا توجد تحذيرات استثنائية مسجلة على واجهة العلبة، يُرجى قراءة النشرة الداخلية دائماً.
          </p>
        )}
      </section>
    </div>
  );
};
```

---

## 5. Verification Method

To independently verify these components after implementation by the Worker:

1. **Run Unit & Feature Tests**:
   ```powershell
   npm.cmd test -- --run tests/e2e/tier1_features/medication_usage.test.ts
   npm.cmd test -- --run tests/e2e/tier2_boundaries/medication_usage_boundary.test.ts
   npm.cmd test -- --run tests/e2e/tier1_features/prescription_presentation.test.ts
   npm.cmd test -- --run tests/e2e/tier2_boundaries/prescription_presentation_boundary.test.ts
   npm.cmd test -- --run tests/errorStates.test.tsx
   npm.cmd test -- --run tests/errorStates.challenge.test.tsx
   npm.cmd test -- --run tests/accessibility.test.tsx
   ```

2. **Run Full Test Suite Baseline**:
   ```powershell
   npm.cmd test -- --run
   ```
   Ensure 1021+ tests pass with 0 failures across all 40 test files.

3. **Check Invalidation Conditions**:
   - `UnclearPhotoCard` must fail if `screen.getByText('تأكد من وجود إضاءة كافية فوق علبة الدواء.')` fails in box mode.
   - `ResultCards` must fail if `usage_source` badge is missing or disclaimer string length is not exactly 87 characters.
