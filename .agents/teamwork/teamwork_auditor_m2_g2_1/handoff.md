# Forensic Audit Report: Milestone M2 (Client Data Layer, Types, Image Compression & Services)

**Work Product**: Milestone M2 Deliverables (`src/types/index.ts`, `src/utils/imageProcessor.ts`, `src/services/geminiVision.ts`, `src/services/geminiParser.ts`, `src/services/detailsCache.ts`, tests, `package.json`, `android/app/src/main/AndroidManifest.xml`)
**Profile**: General Project
**Verdict**: **INTEGRITY VIOLATION**

---

### Phase Results Summary
- **Check 1: Genuine Implementation vs Mock/Facade**: **FAIL**
  - While `src/types/index.ts`, `src/utils/imageProcessor.ts`, `src/services/geminiVision.ts`, and `src/services/geminiParser.ts` contain authentic implementations, `src/services/detailsCache.ts` contains a broken/facade in-memory fallback: `getStorageItem` immediately returns `window.localStorage.getItem(key)` which is `null` on a cache miss in localStorage, short-circuiting before `inMemoryCache` is ever consulted. Any data stored during `QuotaExceededError` cannot be retrieved.
- **Check 2: Hardcoding & Test Bypass Check**: **PASS**
  - Source files in `src/` contain no hardcoded test fixtures, stubs, or test bypasses. `SAMPLE_MEDICATION_RESULT` in `geminiVision.ts` is only used by external test fixtures and is not called in production flows.
- **Check 3: Secret Exposure Check**: **PASS**
  - Automated ripgrep scans for `AIza...`, `API_KEY`, and bearer tokens confirm zero secrets in `src/` or client code. Proactive remediation `purgeLegacyStoredApiKey()` is present.
- **Check 4: Camera Crash Fix Preservation**: **PASS**
  - `package.json` retains `"@capacitor/camera": "^6.1.2"`.
  - `android/app/src/main/AndroidManifest.xml` preserves `<queries>` for `IMAGE_CAPTURE`, `GET_CONTENT`, and `PICK`.
- **Check 5: Independent TypeScript Compilation**: **PASS**
  - Command `npx.cmd tsc --noEmit` completed with exit code 0 (0 errors).
- **Check 6: Independent Full Test Execution**: **FAIL**
  - Command `npx.cmd vitest run` failed with exit code 1 (3 tests failed in `tests/m2.challenge1.test.ts`).

---

## 1. Observation

### 1.1 Independent Test Suite Failure
Running the project-wide test suite independently via powershell:
```powershell
npx.cmd vitest run
```
Resulted in exit code 1 with 3 failed tests:
```
 Test Files  1 failed | 36 passed (37)
      Tests  3 failed | 911 passed (914)
   Start at  19:12:57
   Duration  39.23s

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/m2.challenge1.test.ts > Milestone M2 Challenger 1: Image Compression & Details Cache Adversarial Suite > 5. LocalStorage QuotaExceededError and Security Exception Fallback to Memory Cache > falls back seamlessly to in-memory cache when localStorage.setItem throws QuotaExceededError
AssertionError: expected null not to be null
 ❯ tests/m2.challenge1.test.ts:793:26
    791|       // Verify item can be retrieved without data loss within session
    792|       const cached = getCachedDetails('أوجمنتين');
    793|       expect(cached).not.toBeNull();
       |                          ^
    794|       expect(cached?.is_clear).toBe(true);
    795|       expect(cached?.medicine_name_ar).toBe('بانادول إكسترا');

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  tests/m2.challenge1.test.ts > Milestone M2 Challenger 1: Image Compression & Details Cache Adversarial Suite > 5. LocalStorage QuotaExceededError and Security Exception Fallback to Memory Cache > retrieves in-memory cached details using diacritic-accented query under QuotaExceededError
AssertionError: expected null not to be null
 ❯ tests/m2.challenge1.test.ts:809:29
    807|       // Query with heavy diacritics and hamza
    808|       const retrieved = getCachedDetails('بَانَادُولْ إِكْسْتْرَاـ');
    809|       expect(retrieved).not.toBeNull();
       |                             ^
    810|       expect(retrieved?.medicine_name_en).toBe('Panadol Extra');
    811|     });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  tests/m2.challenge1.test.ts > Milestone M2 Challenger 1: Image Compression & Details Cache Adversarial Suite > 5. LocalStorage QuotaExceededError and Security Exception Fallback to Memory Cache > clearDetailsCache clears entries from both localStorage and in-memory cache without affecting unrelated storage keys
AssertionError: expected null not to be null
 ❯ tests/m2.challenge1.test.ts:882:48
    880|       // Both should be present
    881|       expect(getCachedDetails('بانادول')).not.toBeNull();
    882|       expect(getCachedDetails('كونجستال')).not.toBeNull();
       |                                                ^
    883| 
    884|       // Clear details cache

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

### 1.2 Inspection of `src/services/detailsCache.ts`
Lines 30-52:
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
Direct observation:
1. When `window.localStorage.setItem` throws `QuotaExceededError`, `setStorageItem` catches it and correctly calls `inMemoryCache.set(key, value)`.
2. However, when `getStorageItem(key)` is subsequently called, line 33 executes:
   `return window.localStorage.getItem(key);`
   In a normal browser environment, `window.localStorage.getItem(key)` does NOT throw when a key is absent; it returns `null`.
3. Because `return window.localStorage.getItem(key)` immediately returns `null`, line 38 (`return inMemoryCache.get(key) || null;`) is unreachable on a localStorage miss!
4. Consequently, any medicine details saved to the in-memory cache due to quota exhaustion can never be retrieved by `getCachedDetails(name)`.

### 1.3 Inspection of `tests/detailsCache.test.ts`
Lines 158-171:
```typescript
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
```
Direct observation:
In `src/test/setup.ts`, `window.localStorage` is instantiated as a custom `LocalStorageMock` instance (`Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })`), NOT an instance deriving from `Storage.prototype`.
Therefore, `vi.spyOn(Storage.prototype, 'setItem')` did NOT intercept calls to `window.localStorage.setItem`. `window.localStorage.setItem` succeeded silently and saved into `mockLocalStorage`. The test passed falsely, self-certifying a broken in-memory fallback.
When `tests/m2.challenge1.test.ts` spied directly on `window.localStorage.setItem`, the defect was exposed.

### 1.4 Worker M2 Handoff Claim vs Reality
Worker handoff report (`teamwork_worker_m2_g2_1_r2/handoff.md`) stated:
```
3. Full Test Suite Command:
   npx.cmd vitest run
   Result verbatim:
   Test Files 36 passed (36)
        Tests 831 passed (831)
     Duration 33.32s
```
Reality:
The repository contains 37 test files, and running `npx.cmd vitest run` yields 1 failed file (3 failed tests in `tests/m2.challenge1.test.ts`).

### 1.5 Verification of Clean Deliverables
1. `src/types/index.ts`:
   - `usage_source?: 'printed' | 'common'` present.
   - `PrescriptionItem` and `PrescriptionAnalysisResult` strongly typed.
   - `ActiveTab` updated with `prescription`.
2. `src/utils/imageProcessor.ts`:
   - `compressPrescriptionImage` clamps to 1600px with JPEG quality 0.8.
   - `compressImage` clamps to 1024px with JPEG quality 0.7.
   - Solid white `#FFFFFF` backdrop prefill verified.
   - 10x10 grid blank/black detection verified.
3. `src/services/geminiVision.ts`:
   - `analyzePrescriptionImage` enforces 30s timeout and separates timeout/server errors from unclear image errors.
   - `fetchMedicineDetails` queries cache before making backend call.
   - Zero secrets or client-side credentials.
4. `src/services/geminiParser.ts`:
   - `parseMedicineAnalysisResult` guarantees `how_and_when` is never empty and never generic follow-doctor, falling back to `DEFAULT_COMMON_USAGE` with `usage_source = 'common'`.
   - `validatePrescriptionJson` routes empty `items` to `is_clear: false` with friendly Arabic `retake_message`.
   - Strips `short_explanation` for low-confidence items.
5. Camera crash fix:
   - `package.json` line 17: `"@capacitor/camera": "^6.1.2"`
   - `android/app/src/main/AndroidManifest.xml` lines 46-58: `<queries>` contains `IMAGE_CAPTURE`, `GET_CONTENT`, and `PICK`.

---

## 2. Logic Chain

1. **Premise 1**: Under the Integrity Forensics Protocol (Profile: General Project, Section "Build and run"):
   "Build the project from source and run its test suite. The build must succeed and tests must execute — a project that doesn't build or whose tests don't run is automatically flagged."
   "Block on failure: If ANY check fails, the verdict is INTEGRITY VIOLATION and the work product must be rejected."
2. **Premise 2**: Independent execution of `npx.cmd vitest run` failed with exit code 1 and 3 test failures in `tests/m2.challenge1.test.ts`.
3. **Premise 3**: Inspection of `src/services/detailsCache.ts` line 33 reveals that `getStorageItem` returns `window.localStorage.getItem(key)` directly without checking `if (val !== null) return val;`. Because `getItem` returns `null` on a cache miss, the function returns `null` immediately and never queries `inMemoryCache`.
4. **Premise 4**: Consequently, any item stored in `inMemoryCache` (the fallback mechanism for `QuotaExceededError`) cannot be retrieved, rendering the in-memory fallback non-functional (facade behavior).
5. **Premise 5**: The unit test `tests/detailsCache.test.ts` was self-certifying because it spied on `Storage.prototype.setItem` rather than `window.localStorage.setItem`, masking the defect during worker verification.
6. **Conclusion**: Because test failures exist in the repository test suite and the cache fallback logic fails under real quota exhaustion, the work product does not satisfy the zero-failure integrity criteria.

---

## 3. Caveats

No caveats. All findings are empirically verified with direct execution outputs from `npx.cmd vitest run` and code line analysis.

---

## 4. Conclusion & Required Remediation

**Verdict**: **INTEGRITY VIOLATION**

### Required Remediation (for Worker):
1. In `src/services/detailsCache.ts`, update `getStorageItem` to check if `localStorage.getItem` returned a non-null value before returning, and fall back to `inMemoryCache.get(key) || null` if it returned `null`:
   ```typescript
   function getStorageItem(key: string): string | null {
     try {
       if (typeof window !== 'undefined' && window.localStorage) {
         const val = window.localStorage.getItem(key);
         if (val !== null) {
           return val;
         }
       }
     } catch {
       // LocalStorage restricted or unavailable
     }
     return inMemoryCache.get(key) || null;
   }
   ```
2. In `tests/detailsCache.test.ts`, update line 159 to spy on `window.localStorage`:
   ```typescript
   vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
     const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
     throw error;
   });
   ```
3. Re-run `npx.cmd vitest run` and ensure all 37 test files and 914 tests pass with 0 failures.

---

## 5. Verification Method

To independently reproduce this finding:
1. Run:
   ```powershell
   npx.cmd vitest run tests/m2.challenge1.test.ts
   ```
   Observe: 3 test failures under section "5. LocalStorage QuotaExceededError and Security Exception Fallback to Memory Cache".
2. Run full suite:
   ```powershell
   npx.cmd vitest run
   ```
   Observe: Exit code 1, `Test Files 1 failed | 36 passed (37)`.
