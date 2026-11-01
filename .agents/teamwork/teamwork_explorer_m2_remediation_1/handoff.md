# Investigation & Remediation Report: Milestone M2.2 Remediation

**Author**: Explorer (`teamwork_explorer_m2_remediation_1`)  
**Target Milestone**: M2.2 Remediation (Client Data Layer, Details Caching, Medication Usage Defense)  
**Status**: Ready for Worker Remediation  

---

## Executive Summary

During Gate 2 adversarial verification and forensic auditing of Milestone M2, two concrete defects were identified:
1. **Details Cache In-Memory Fallback & Spy Defect (`src/services/detailsCache.ts` & `tests/detailsCache.test.ts`)**:
   - In `src/services/detailsCache.ts:33`, `getStorageItem` returned `window.localStorage.getItem(key)` unconditionally when `window.localStorage` was accessible. In browser environments, `getItem` returns `null` on a cache miss without throwing an exception. Consequently, any medicine details saved to `inMemoryCache` during `QuotaExceededError` or private browsing restrictions could never be retrieved.
   - In `tests/detailsCache.test.ts:159`, `vi.spyOn(Storage.prototype, 'setItem')` was used to simulate quota failure. However, in `src/test/setup.ts`, `window.localStorage` is defined as an instance of `LocalStorageMock` (which does not inherit from `Storage.prototype`). The spy was never invoked, causing the test to pass falsely against standard localStorage while masking the broken in-memory fallback.
2. **Doctor Deferral Regex Anchor & Whitespace Defect (`src/services/geminiParser.ts`)**:
   - In `src/services/geminiParser.ts:40`, `isGenericFollowDoctor` used the pattern `/^(?:راجع|استشر)\s+الطبيب\s+(?:أو\s+الصيدلي\s+)?(?:فقط)?$/i`. Mandatory `\s+` directly after `الطبيب` and after `الصيدلي` caused trimmed Arabic phrases (e.g. `"استشر الطبيب"`, `"استشر الطبيب أو الصيدلي"`, `"راجع الطبيب"`) to fail matching. Furthermore, strict end anchoring (`$`) failed to catch doctor deferrals carrying suffixes or explanations (e.g. `"راجع الطبيب لمعرفة الجرعة"`).

This report presents complete forensic observations, deductive logic chains, and exact drop-in remediation code for the Worker.

---

## 1. Observation

### 1.1 Test Execution Commands and Verbatim Output

Running the targeted challenge suite:
```bash
npx.cmd vitest run tests/m2.challenge1.test.ts tests/m2.challenge2.test.ts tests/detailsCache.test.ts
```

Output:
```
Test Files  2 failed | 1 passed (3)
     Tests  6 failed | 133 passed (139)
```

#### Verbatim Failures in `tests/m2.challenge1.test.ts` (3 Failures):
1. **Failure 1 (Line 806)**:
   ```
   FAIL  tests/m2.challenge1.test.ts > Milestone M2 Challenger 1: Image Compression & Details Cache Adversarial Suite > 5. LocalStorage QuotaExceededError and Security Exception Fallback to Memory Cache > falls back seamlessly to in-memory cache when localStorage.setItem throws QuotaExceededError
   AssertionError: expected null not to be null
    ❯ tests/m2.challenge1.test.ts:806:26
       804|       // Verify item can be retrieved without data loss within session
       805|       const cached = getCachedDetails('أوجمنتين');
       806|       expect(cached).not.toBeNull();
          |                          ^
   ```
2. **Failure 2 (Line 822)**:
   ```
   FAIL  tests/m2.challenge1.test.ts > Milestone M2 Challenger 1: Image Compression & Details Cache Adversarial Suite > 5. LocalStorage QuotaExceededError and Security Exception Fallback to Memory Cache > retrieves in-memory cached details using diacritic-accented query under QuotaExceededError
   AssertionError: expected null not to be null
    ❯ tests/m2.challenge1.test.ts:822:29
       820|       // Query with heavy diacritics and hamza
       821|       const retrieved = getCachedDetails('بَانَادُولْ إِكْسْتْرَاـ');
       822|       expect(retrieved).not.toBeNull();
          |                             ^
   ```
3. **Failure 3 (Line 895)**:
   ```
   FAIL  tests/m2.challenge1.test.ts > Milestone M2 Challenger 1: Image Compression & Details Cache Adversarial Suite > 5. LocalStorage QuotaExceededError and Security Exception Fallback to Memory Cache > clearDetailsCache clears entries from both localStorage and in-memory cache without affecting unrelated storage keys
   AssertionError: expected null not to be null
    ❯ tests/m2.challenge1.test.ts:895:48
       893|       // Both should be present
       894|       expect(getCachedDetails('بانادول')).not.toBeNull();
       895|       expect(getCachedDetails('كونجستال')).not.toBeNull();
          |                                                ^
   ```

#### Verbatim Failures in `tests/m2.challenge2.test.ts` (3 Failures):
1. **Failure 4 (Line 523)**:
   ```
   FAIL  tests/m2.challenge2.test.ts > M2 Adversarial Challenge 2: Prescription Validation & Medication Usage Defense > 2. Medication Usage Defense & usage_source Badging > 2.2 Adversarial Doctor Deferrals in Arabic & English > stress-tests doctor deferrals specified in dispatch: "راجع الطبيب لمعرفة الجرعة" and "استشر الطبيب أو الصيدلي"
   AssertionError: expected false to be true // Object.is equality
   - Expected: true
   + Received: false
    ❯ tests/m2.challenge2.test.ts:523:50
       521|         // Direct predicate test
       522|         expect(isGenericFollowDoctor(deferral1)).toBe(true);
       523|         expect(isGenericFollowDoctor(deferral2)).toBe(true);
          |                                                  ^
   ```
2. **Failure 5 (Line 538)**:
   ```
   FAIL  tests/m2.challenge2.test.ts > M2 Adversarial Challenge 2: Prescription Validation & Medication Usage Defense > 2. Medication Usage Defense & usage_source Badging > 2.2 Adversarial Doctor Deferrals in Arabic & English > filters out Arabic deferral "راجع الطبيب لمعرفة الجرعة" and replaces with DEFAULT_COMMON_USAGE and common source
   AssertionError: expected [ 'راجع الطبيب لمعرفة الجرعة' ] to deeply equal [ …(3) ]
   - Expected
   + Received
     [
   -   "يؤخذ القرص عبر الفم مع كوب ماء كامل",
   -   "يُفضل تناوله في نفس الموعد يومياً للحفاظ على فاعليته",
   -   "استشر الصيدلي أو الطبيب لتحديد المواعيد الأنسب لحالتك الصحية",
   +   "راجع الطبيب لمعرفة الجرعة",
     ]
    ❯ tests/m2.challenge2.test.ts:538:37
   ```
3. **Failure 6 (Line 551)**:
   ```
   FAIL  tests/m2.challenge2.test.ts > M2 Adversarial Challenge 2: Prescription Validation & Medication Usage Defense > 2. Medication Usage Defense & usage_source Badging > 2.2 Adversarial Doctor Deferrals in Arabic & English > filters out Arabic deferral "استشر الطبيب أو الصيدلي" and replaces with DEFAULT_COMMON_USAGE and common source
   AssertionError: expected [ 'استشر الطبيب أو الصيدلي' ] to deeply equal [ …(3) ]
   - Expected
   + Received
     [
   -   "يؤخذ القرص عبر الفم مع كوب ماء كامل",
   -   "يُفضل تناوله في نفس الموعد يومياً للحفاظ على فاعليته",
   -   "استشر الصيدلي أو الطبيب لتحديد المواعيد الأنسب لحالتك الصحية",
   +   "استشر الطبيب أو الصيدلي",
     ]
    ❯ tests/m2.challenge2.test.ts:551:37
   ```

---

### 1.2 Inspection of Source Code Locations

#### A. `src/services/detailsCache.ts` (Lines 30–51):
```typescript
function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // LocalStorage restricted or unavailable
  }
  return inMemoryCache.get(key) || null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {
    // QuotaExceededError or private browsing
  }
  inMemoryCache.set(key, value);
}
```

#### B. `tests/detailsCache.test.ts` (Lines 157–181):
```typescript
  describe('5. Error Resilience & Fallback Handling', () => {
    it('gracefully handles QuotaExceededError on localStorage.setItem', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
        throw error;
      });

      // Should not throw
      expect(() => setCachedDetails('كونجستال', sampleResult)).not.toThrow();

      // Falls back to in-memory map
      const cached = getCachedDetails('كونجستال');
      expect(cached).not.toBeNull();
      expect(cached?.medicine_name_ar).toBe('بانادول إكسترا');
    });

    it('gracefully handles SecurityError when localStorage is blocked', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });

      expect(() => getCachedDetails('أدول')).not.toThrow();
      expect(getCachedDetails('أدول')).toBeNull();
    });
  });
```

#### C. `src/test/setup.ts` (Lines 64–98):
```typescript
class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem = vi.fn((key: string): string | null => this.store[key] ?? null);
  setItem = vi.fn((key: string, value: string): void => { this.store[key] = String(value); });
  removeItem = vi.fn((key: string): void => { delete this.store[key]; });
  clear = vi.fn((): void => { this.store = {}; });
  // ...
}

const mockLocalStorage = new LocalStorageMock();
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});
```

#### D. `src/services/geminiParser.ts` (Lines 35–46):
```typescript
export function isGenericFollowDoctor(text: string): boolean {
  if (!text) return true;
  const t = text.trim();
  const genericPatterns = [
    /^(?:اتبع|يجب اتباع)\s+(?:بدقة\s+)?(?:توجيهات|تعليمات|إرشادات)\s+الطبيب/i,
    /^(?:راجع|استشر)\s+الطبيب\s+(?:أو\s+الصيدلي\s+)?(?:فقط)?$/i,
    /^(?:اتبع\s+ما\s+كتبه\s+الطبيب|حسب\s+إرشادات\s+الطبيب)$/i,
    /^as\s+directed\s+by\s+(?:your\s+)?doctor$/i,
    /^follow\s+(?:the\s+)?doctor(?:'s)?\s+instructions$/i
  ];
  return genericPatterns.some((pattern) => pattern.test(t));
}
```

---

## 2. Logic Chain

### 2.1 Logic Chain for Defect 1: Details Cache Fallback & Test Spy
1. **Observation 1.2.A**: In `setStorageItem`, when `window.localStorage.setItem` throws `QuotaExceededError`, execution enters the `catch` block and proceeds to `inMemoryCache.set(key, value)`. The serialized medicine details are successfully stored in the in-memory map.
2. **Observation 1.2.A**: When `getCachedDetails` calls `getStorageItem(key)` to retrieve the saved data, line 33 evaluates `return window.localStorage.getItem(key);`.
3. **W3C Web Storage Specification & Behavior**: `localStorage.getItem(key)` returns `null` when a key does not exist. It does NOT throw an exception.
4. **Deduction 1**: Line 33 returns `null` immediately. Line 38 (`return inMemoryCache.get(key) || null;`) is unreachable on a localStorage cache miss.
5. **Deduction 2**: As a result, data written to `inMemoryCache` during quota exhaustion can never be retrieved by `getCachedDetails(name)` within the session.
6. **Observation 1.2.B & 1.2.C**: The test in `tests/detailsCache.test.ts:159` spied on `Storage.prototype.setItem`. But `src/test/setup.ts` instantiated `mockLocalStorage` from `LocalStorageMock`, which does not inherit from `Storage.prototype`. The spy had zero effect on `window.localStorage.setItem`. Thus, `window.localStorage.setItem` continued saving to `mockLocalStorage`, making `getCachedDetails` pass falsely by reading from `mockLocalStorage`.
7. **Resolution 1**:
   - `getStorageItem` must check if `const item = window.localStorage.getItem(key)` is non-null (`item !== null`). Only if non-null should it return `item`. If `null`, it must fall through to `return inMemoryCache.get(key) || null;`.
   - `tests/detailsCache.test.ts` lines 159 and 174 must spy directly on `window.localStorage` (`vi.spyOn(window.localStorage, 'setItem')` and `vi.spyOn(window.localStorage, 'getItem')`).

---

### 2.2 Logic Chain for Defect 2: Doctor Deferral Regex
1. **Observation 1.2.D**: In `src/services/geminiParser.ts:40`, pattern 2 is:
   `/^(?:راجع|استشر)\s+الطبيب\s+(?:أو\s+الصيدلي\s+)?(?:فقط)?$/i`
2. **Analysis of Syntax**:
   - There is a mandatory `\s+` immediately following `الطبيب`.
   - Inside `(?:أو\s+الصيدلي\s+)?`, there is a mandatory `\s+` immediately following `الصيدلي`.
   - The pattern ends with `(?:فقط)?$`.
3. **Deduction 1**:
   - Because `t = text.trim()`, `t` has no trailing whitespace.
   - For `"استشر الطبيب"`, there is no whitespace after `الطبيب`, so `\s+` fails to match before `$`.
   - For `"استشر الطبيب أو الصيدلي"`, there is no whitespace after `الصيدلي`, so `\s+` fails to match before `$`.
   - For `"راجع الطبيب لمعرفة الجرعة"`, the anchor `(?:فقط)?$` rejects any explanatory suffix such as `"لمعرفة الجرعة"`.
4. **Deduction 2**:
   - The regex fails to match standard doctor deferrals in Arabic.
   - In `parseMedicineAnalysisResult`, these strings survive `rawHowAndWhen.filter(item => !isGenericFollowDoctor(item))`.
   - The result returns `how_and_when: ["راجع الطبيب لمعرفة الجرعة"]` with `usage_source: 'printed'`, violating Feature F21, Feature F22, and Requirement R4 (which mandate that generic deferrals be stripped and replaced with safe educational `DEFAULT_COMMON_USAGE`).
5. **Resolution 2**:
   - Update `isGenericFollowDoctor` to:
     ```typescript
     export function isGenericFollowDoctor(text: string): boolean {
       if (!text) return true;
       const t = text.trim();
       if (DEFAULT_COMMON_USAGE.includes(t)) {
         return false;
       }
       const genericPatterns = [
         /^(?:اتبع|يجب اتباع)\s+(?:بدقة\s+)?(?:توجيهات|تعليمات|إرشادات)\s+الطبيب/i,
         /^(?:راجع|استشر)\s+(?:الطبيب|الصيدلي)(?:\s+أو\s+(?:الصيدلي|الطبيب))?(?:\s+.*)?$/i,
         /^(?:اتبع\s+ما\s+كتبه\s+الطبيب|حسب\s+إرشادات\s+الطبيب)(?:\s+.*)?$/i,
         /^as\s+directed\s+by\s+(?:your\s+)?doctor(?:\s+.*)?$/i,
         /^follow\s+(?:the\s+)?doctor(?:'s)?\s+instructions(?:\s+.*)?$/i
       ];
       return genericPatterns.some((pattern) => pattern.test(t));
     }
     ```
   - Pattern 2 allows either `الطبيب` or `الصيدلي` first, followed optionally by `أو (الصيدلي|الطبيب)`, without trailing space requirements, and permits optional trailing explanatory phrases (`(?:\s+.*)?$`).
   - Suffix protection on patterns 3, 4, 5 covers English and Arabic variants.
   - Explicit guard `if (DEFAULT_COMMON_USAGE.includes(t)) return false;` guarantees that standard educational fallback strings (specifically item 3: `'استشر الصيدلي أو الطبيب لتحديد المواعيد الأنسب لحالتك الصحية'`) are never inadvertently stripped.

---

## 3. Caveats

1. **Scope Limitation**: The Explorer operates strictly in read-only analysis mode. No source code or test files in `src/` or `tests/` have been modified during this investigation.
2. **Implementation Responsibility**: The Worker assigned to Milestone M2.2 Remediation must apply the exact diffs documented in Section 4.
3. **No Side Effects on Architecture**: The proposed changes are surgical and drop-in. No interfaces, types, signatures, or public APIs are altered.

---

## 4. Conclusion & Exact Remediation Code (For Worker)

The root causes are completely analyzed, verified, and reproduced. The remediation consists of 3 targeted file modifications:

### Remediation Item 1: `src/services/detailsCache.ts`
**Target File**: `src/services/detailsCache.ts`  
**Target Lines**: 30–39  
**Rationale**: Check `window.localStorage.getItem(key)` for non-null before returning; fall through to `inMemoryCache` on localStorage miss.

#### Target Content (Before):
```typescript
function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // LocalStorage restricted or unavailable
  }
  return inMemoryCache.get(key) || null;
}
```

#### Replacement Content (After):
```typescript
function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        return item;
      }
    }
  } catch {
    // LocalStorage restricted or unavailable
  }
  return inMemoryCache.get(key) || null;
}
```

---

### Remediation Item 2: `tests/detailsCache.test.ts`
**Target File**: `tests/detailsCache.test.ts`  
**Target Lines**: 158–181  
**Rationale**: Spy directly on `window.localStorage` instead of `Storage.prototype` because `setup.ts` overrides `window.localStorage` with a custom `LocalStorageMock`.

#### Target Content (Before):
```typescript
  describe('5. Error Resilience & Fallback Handling', () => {
    it('gracefully handles QuotaExceededError on localStorage.setItem', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
        throw error;
      });

      // Should not throw
      expect(() => setCachedDetails('كونجستال', sampleResult)).not.toThrow();

      // Falls back to in-memory map
      const cached = getCachedDetails('كونجستال');
      expect(cached).not.toBeNull();
      expect(cached?.medicine_name_ar).toBe('بانادول إكسترا');
    });

    it('gracefully handles SecurityError when localStorage is blocked', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });

      expect(() => getCachedDetails('أدول')).not.toThrow();
      expect(getCachedDetails('أدول')).toBeNull();
    });
  });
```

#### Replacement Content (After):
```typescript
  describe('5. Error Resilience & Fallback Handling', () => {
    it('gracefully handles QuotaExceededError on localStorage.setItem', () => {
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
        throw error;
      });

      // Should not throw
      expect(() => setCachedDetails('كونجستال', sampleResult)).not.toThrow();

      // Falls back to in-memory map
      const cached = getCachedDetails('كونجستال');
      expect(cached).not.toBeNull();
      expect(cached?.medicine_name_ar).toBe('بانادول إكسترا');
    });

    it('gracefully handles SecurityError when localStorage is blocked', () => {
      vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });

      expect(() => getCachedDetails('أدول')).not.toThrow();
      expect(getCachedDetails('أدول')).toBeNull();
    });
  });
```

---

### Remediation Item 3: `src/services/geminiParser.ts`
**Target File**: `src/services/geminiParser.ts`  
**Target Lines**: 35–46  
**Rationale**: Fix regex whitespace requirements, allow doctor deferrals with suffixes, and safely preserve educational items in `DEFAULT_COMMON_USAGE`.

#### Target Content (Before):
```typescript
export function isGenericFollowDoctor(text: string): boolean {
  if (!text) return true;
  const t = text.trim();
  const genericPatterns = [
    /^(?:اتبع|يجب اتباع)\s+(?:بدقة\s+)?(?:توجيهات|تعليمات|إرشادات)\s+الطبيب/i,
    /^(?:راجع|استشر)\s+الطبيب\s+(?:أو\s+الصيدلي\s+)?(?:فقط)?$/i,
    /^(?:اتبع\s+ما\s+كتبه\s+الطبيب|حسب\s+إرشادات\s+الطبيب)$/i,
    /^as\s+directed\s+by\s+(?:your\s+)?doctor$/i,
    /^follow\s+(?:the\s+)?doctor(?:'s)?\s+instructions$/i
  ];
  return genericPatterns.some((pattern) => pattern.test(t));
}
```

#### Replacement Content (After):
```typescript
export function isGenericFollowDoctor(text: string): boolean {
  if (!text) return true;
  const t = text.trim();
  if (DEFAULT_COMMON_USAGE.includes(t)) {
    return false;
  }
  const genericPatterns = [
    /^(?:اتبع|يجب اتباع)\s+(?:بدقة\s+)?(?:توجيهات|تعليمات|إرشادات)\s+الطبيب/i,
    /^(?:راجع|استشر)\s+(?:الطبيب|الصيدلي)(?:\s+أو\s+(?:الصيدلي|الطبيب))?(?:\s+.*)?$/i,
    /^(?:اتبع\s+ما\s+كتبه\s+الطبيب|حسب\s+إرشادات\s+الطبيب)(?:\s+.*)?$/i,
    /^as\s+directed\s+by\s+(?:your\s+)?doctor(?:\s+.*)?$/i,
    /^follow\s+(?:the\s+)?doctor(?:'s)?\s+instructions(?:\s+.*)?$/i
  ];
  return genericPatterns.some((pattern) => pattern.test(t));
}
```

---

## 5. Verification Method

To verify the remediation after applying the code changes:

### Step 1: Typecheck
```powershell
npx.cmd tsc --noEmit
```
**Expected**: Exit code 0, 0 type errors.

### Step 2: Run Target Adversarial & Unit Suites
```powershell
npx.cmd vitest run tests/detailsCache.test.ts tests/m2.challenge1.test.ts tests/m2.challenge2.test.ts
```
**Expected**:
- `tests/detailsCache.test.ts`: 16 passed (16)
- `tests/m2.challenge1.test.ts`: 84 passed (84) — 0 failures
- `tests/m2.challenge2.test.ts`: 39 passed (39) — 0 failures
- Total: 3 passed files, 139 passed tests, 0 failures.

### Step 3: Run Full Repository Test Suite
```powershell
npx.cmd vitest run
```
**Expected**:
- 38 test files passed (38)
- 953+ tests passed, 0 failures.
- Exit code 0.

### Invalidation Conditions:
1. If `tests/m2.challenge1.test.ts` still reports `AssertionError: expected null not to be null` under QuotaExceededError, `getStorageItem` in `src/services/detailsCache.ts` was not properly updated to check `item !== null`.
2. If `tests/m2.challenge2.test.ts` still reports `AssertionError: expected false to be true` on `"راجع الطبيب لمعرفة الجرعة"` or `"استشر الطبيب أو الصيدلي"`, `isGenericFollowDoctor` in `src/services/geminiParser.ts` regex was not properly updated.
