# Empirical Challenge Report: Milestone 3 (Requirement R2)
**Challenger 2 — Adversarial Challenge & Stress-Testing**
**Target**: Error States, 30s Timeout Abortion, Cloudflare Worker Error Codes & Debug Badge, Interactive Retry Without Photo Retake
**Date**: 2026-10-29
**Verdict**: **APPROVE**

---

## 1. Executive Summary

As an empirical challenger, I conducted an adversarial verification and stress testing of Requirement R2 across `src/services/geminiVision.ts`, `src/services/geminiParser.ts`, `src/components/UnclearPhotoCard.tsx`, and `src/App.tsx`. I authored and executed a dedicated 31-test adversarial test harness in `tests/errorStates.challenge.test.tsx` and ran the entire 398-test project suite (`npm.cmd test`).

All empirical challenge tests executed and passed without regressions:
- **Challenge Test File**: `tests/errorStates.challenge.test.tsx` (31 tests passed in 532ms)
- **Full Test Suite**: 18 test files, 398 total tests passed in 17.14s

---

## 2. Adversarial Challenge Analysis

### Challenge 1: 30-Second AbortController Timeout & Network Failure Abortion
- **Assumption Challenged**: Does the client reliably abort after 30 seconds, cancel the fetch connection, clear timer resources, and surface a dedicated Arabic timeout message and error category (`network_timeout`, `CLIENT_TIMEOUT`)?
- **Adversarial Scenario**:
  1. Simulated a hanging HTTP connection using fake timers (`vi.useFakeTimers()`). Advanced time by 30,001 ms.
  2. Tested custom threshold values (e.g. 5,000 ms) ensuring precise abortion timing.
  3. Tested abrupt network drop (`TypeError: Failed to fetch`), connection aborts (`AbortError`), and gateway timeout (`HTTP 504`).
  4. Verified that successful HTTP responses clear the internal timer (`clearTimeout`) preventing timer leaks.
- **Empirical Findings**:
  - At 30,001ms, `controller.abort()` is triggered with a DOMException.
  - `isInternalTimeout` flag correctly routes the exception to `AnalysisError` with `category: 'network_timeout'` and `errorCode: 'CLIENT_TIMEOUT'`.
  - The friendly Arabic message `"استغرقت العملية أكثر من 30 ثانية. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة."` is preserved.
  - `clearTimeout` is guaranteed in the `finally` block of `geminiVision.ts`.
- **Stress Test Status**: **PASS**

### Challenge 2: Cloudflare Worker Error Code Propagation & Debug Badge Rendering
- **Assumption Challenged**: Do upstream Cloudflare Worker error codes propagate from the HTTP response JSON all the way to the UI, rendering the debug badge in `UnclearPhotoCard` specifically for server errors?
- **Adversarial Scenario**:
  - Tested all 5 Cloudflare Worker upstream error codes:
    1. `UPSTREAM_OVERLOADED` (HTTP 503)
    2. `UPSTREAM_RATE_LIMIT` (HTTP 429)
    3. `UPSTREAM_LOCATION_RESTRICTED` (HTTP 403)
    4. `UPSTREAM_BAD_REQUEST` (HTTP 400)
    5. `UPSTREAM_API_ERROR` (HTTP 500)
  - Tested non-JSON error payloads (e.g., Cloudflare HTML 502/503 page).
  - Tested empty JSON objects `{}` on HTTP 500.
- **Empirical Findings**:
  - For all 5 upstream error codes, `geminiVision.ts` extracts `errorData.error_code`, sets `category: 'server_error'`, and attaches `detail`.
  - In `UnclearPhotoCard.tsx`, the debug badge `data-testid="error-code-badge"` is conditionally rendered when `errorCode` is present.
  - The badge prominently displays `"رمز الخطأ:"` and the exact error code (e.g., `UPSTREAM_OVERLOADED`).
  - Non-JSON error bodies (HTML error pages) are safely caught by `.catch(() => ({}))` and fall back to `HTTP_502` / `HTTP_503` without crashing.
  - Empty JSON responses fall back to `HTTP_500` and the standard Arabic friendly error text.
- **Stress Test Status**: **PASS**

### Challenge 3: AI `is_clear=false` Error State & Senior Guidance Tips
- **Assumption Challenged**: When Gemini returns `is_clear: false`, does the UI show helpful senior guidance (lighting and focus tips) while strictly suppressing any technical debug badges?
- **Adversarial Scenario**:
  - Rendered `UnclearPhotoCard` with `errorCategory="unclear_image"`.
  - Tested default unclear text as well as custom AI `retake_message`.
  - Queried `data-testid="error-code-badge"`.
- **Empirical Findings**:
  - State (c) displays:
    - Title: `"الصورة غير واضحة بما يكفي"`
    - Lighting tip: `"تأكد من وجود إضاءة كافية فوق علبة الدواء."` (with `SunMedium` icon)
    - Focus tip: `"قرّب الكاميرا واجعل اسم الدواء في منتصف الشاشة."` (with `Focus` icon)
  - `queryByTestId('error-code-badge')` evaluates to `null`. Technical error badges are completely hidden from seniors on unclear photos.
  - The action button is `"📷 إعادة تصوير العلبة الآن"` which triggers `onRetake`.
- **Stress Test Status**: **PASS**

### Challenge 4: Interactive Retry Without Photo Retake
- **Assumption Challenged**: Does clicking the retry button re-process the exact same photo without prompting the user to take another photo or open the gallery? Does `lastFile` survive multiple consecutive failures?
- **Adversarial Scenario**:
  - Mocked `nativeCamera.capturePhoto` and `imageProcessor.processAndValidateImage`.
  - Triggered initial photo capture via camera button -> failure (timeout).
  - Clicked `"🔄 إعادة المحاولة الآن"` on `UnclearPhotoCard`.
  - Multi-stage stress test: Timeout -> Retry -> HTTP 503 `UPSTREAM_OVERLOADED` -> Retry -> Invalid JSON -> Retry -> Success (`بانادول` / `أوجمنتين`).
  - Tested resetting via `"العودة للرئيسية"` home button.
- **Empirical Findings**:
  - `App.tsx` stores the selected image in `lastFile` state (`setLastFile(file)`).
  - On failure, `handleRetrySameImage` checks `lastFile` and invokes `processImage(lastFile)`.
  - `nativeCamera.capturePhoto` was called **exactly 1 time** during the entire 4-stage failure-and-retry sequence.
  - Neither native camera nor photo picker is invoked on retry.
  - When the user clicks `"العودة للرئيسية"`, `setLastFile(null)` cleanly disposes of the cached file and returns to the home screen.
- **Stress Test Status**: **PASS**

### Challenge 5: Invalid JSON Fallback (State d)
- **Assumption Challenged**: Does malformed, truncated, or empty JSON from Gemini map to State (d) (`invalid_json`) with a distinct UI presentation and retry capability?
- **Adversarial Scenario**:
  - Tested truncated JSON (`{"is_clear": true, "medicine_name_ar": ...`).
  - Tested empty / whitespace responses.
  - Verified `cleanAndParseJson` output and `UnclearPhotoCard` styling.
- **Empirical Findings**:
  - Truncated JSON returns `{ is_clear: false, error_category: 'invalid_json', error_code: 'INVALID_JSON' }`.
  - Empty strings return `{ is_clear: false, error_category: 'invalid_json', error_code: 'EMPTY_RESPONSE' }`.
  - `UnclearPhotoCard` renders with distinct indigo background (`bg-indigo-50 border-indigo-500`), title `"تعذر قراءة رد المعالج الذكي"`, and an active retry button.
- **Stress Test Status**: **PASS**

### Challenge 6: Senior Accessibility, RTL Direction & Minimum Touch Target
- **Assumption Challenged**: Do all error states adhere to accessibility standards for elderly users (64px touch target height, RTL layout, clear Arabic typography)?
- **Adversarial Scenario**:
  - Tested every button across all 4 error states with `toHaveMinTouchTarget(64)`.
  - Tested `role="alert"` and RTL alignment (`text-right`).
- **Empirical Findings**:
  - Every button across States (a), (b), (c), and (d) satisfies `min-h-[64px]` / `btn-primary` / `btn-secondary`.
  - All cards feature `role="alert"`, `text-right`, and clear Arabic headers.
- **Stress Test Status**: **PASS**

---

## 3. Stress Test Results Summary Table

| Test Category | Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| **Timeout (30s)** | Fake timers + hanging fetch at 30,001ms | `AbortError` -> `CLIENT_TIMEOUT` + `network_timeout` | AnalysisError thrown with `category: 'network_timeout'` and `errorCode: 'CLIENT_TIMEOUT'` | **PASS** |
| **Custom Timeout** | `timeoutMs: 5000` threshold | Aborts at 5,000ms | Rejected at 5,001ms with `CLIENT_TIMEOUT` | **PASS** |
| **Network Drop** | `TypeError: Failed to fetch` | Maps to `network_timeout` with `NETWORK_ERROR` | `AnalysisError` with `NETWORK_ERROR` thrown | **PASS** |
| **Worker 503** | `UPSTREAM_OVERLOADED` | Server error UI + debug badge | Badge shows `UPSTREAM_OVERLOADED` | **PASS** |
| **Worker 429** | `UPSTREAM_RATE_LIMIT` | Server error UI + debug badge | Badge shows `UPSTREAM_RATE_LIMIT` | **PASS** |
| **Worker 403** | `UPSTREAM_LOCATION_RESTRICTED`| Server error UI + debug badge | Badge shows `UPSTREAM_LOCATION_RESTRICTED` | **PASS** |
| **Worker 400** | `UPSTREAM_BAD_REQUEST` | Server error UI + debug badge | Badge shows `UPSTREAM_BAD_REQUEST` | **PASS** |
| **Worker 500** | `UPSTREAM_API_ERROR` | Server error UI + debug badge | Badge shows `UPSTREAM_API_ERROR` | **PASS** |
| **HTML 502/503** | Non-JSON Cloudflare error body | Fallback to `HTTP_502` code badge without crash | Safely caught, badge shows `HTTP_502` | **PASS** |
| **AI is_clear=false**| AI returns `is_clear: false` | Tips displayed, NO debug badge | Tips rendered; `error-code-badge` is null | **PASS** |
| **Interactive Retry** | Retry after timeout | Re-runs `processImage(lastFile)` | Camera calls: 1; Analyze calls: 2 | **PASS** |
| **Retry Chain** | Timeout -> 503 -> JSON -> 200 OK | `lastFile` preserved across 4 steps | Camera calls: 1; Analyze calls: 4; Success rendered | **PASS** |
| **Invalid JSON** | Malformed / truncated syntax | State (d) indigo card + retry button | `invalid_json` rendered with retry button | **PASS** |
| **Ergonomics** | Touch targets across all 4 states | Minimum 64px height | All buttons satisfy `toHaveMinTouchTarget(64)` | **PASS** |
| **RTL Direction** | Text alignment across all 4 states | `role="alert"` and `text-right` | All cards have `role="alert"` and `text-right` | **PASS** |

---

## 4. Final Verdict

**Verdict**: **APPROVE**

The implementation of Requirement R2 in Milestone 3 fully satisfies all functional, architectural, ergonomic, and adversarial challenge criteria.
