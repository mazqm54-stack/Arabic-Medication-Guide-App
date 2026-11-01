# Milestone 1 Specification Guide: Google Gemini 3.8 Flash & Cloudflare Worker Error Architecture

**Author:** Spec Miner 2  
**Target Milestone:** Milestone 1 (Cloudflare Worker Diagnostics & Upstream Gemini Error Handling)  
**Date:** 2026-10-29  
**Specification Sources Probed:**
1. Google Gemini Developer API Documentation (v1beta / v1 reference, SDK type references, and guides)
2. `gemini-api-guides/models/gemini-3.8-flash.md` (GA September 2026 specification)
3. `gemini-api-reference/generate-content.md` (`GenerationConfig`, `ThinkingConfig`, `ThinkingLevel`)
4. `gemini-api-guides/api-errors.md` (Standard API error codes, HTTP status mapping, RPC statuses)
5. `worker/src/index.ts`, `worker/wrangler.toml`, `tests/worker.test.ts`
6. `survey_worker_gemini.md` (Prior live telemetry and root cause analysis)

---

## 1. Executive Summary & Purpose

The purpose of Milestone 1 is to ensure robust, secure, and diagnostic-transparent communication between the Cloudflare Worker proxy (`worker/src/index.ts`) and Google's Gemini API for `gemini-3.8-flash`.

Prior to this specification:
1. The Cloudflare Worker forwarded `temperature: 0` to `gemini-3.8-flash`, violating the Gemini 3.x parameter rules where sampling parameters (`temperature`, `top_p`, `top_k`) are deprecated.
2. In the event of upstream failure (such as HTTP 503 Overload observed in live testing), the worker swallowed the upstream error body, returning an opaque HTTP 500 with a generic message.
3. The client application had no structured way to distinguish between transient server overload, quota exhaustion, location blocks, or unreadable medication images.
4. Raw error strings risked leaking secrets (`GEMINI_API_KEY`) or sensitive patient medical photo base64 data to Cloudflare edge logs (`wrangler tail`).

This document provides the authoritative REST specification for `gemini-3.8-flash`, defines the Cloudflare Worker error schema and TypeScript contracts, and specifies the zero-leakage sanitization algorithm.

---

## 2. Google Gemini REST API v1beta / v1 Specification (`gemini-3.8-flash`)

### 2.1 Endpoint URL & Invocation Contract
- **Protocol:** HTTPS POST
- **Target URL Pattern:**
  `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Model Parameter (`{model}`):**
  Must be passed as `gemini-3.8-flash` (or encoded if needed).
  *Rule:* Strip any leading `models/` prefix before URL interpolation to prevent invalid paths like `/models/models/gemini-3.8-flash`.
- **Authentication:**
  - Query Parameter: `?key=${GEMINI_API_KEY}`
  - Or Header: `x-goog-api-key: ${GEMINI_API_KEY}`
- **Headers:**
  - `Content-Type: application/json`

---

### 2.2 `generationConfig` Parameter Inventory for `gemini-3.8-flash`

According to the official Gemini API schema and model specifications:

| Parameter | Type | Status in `gemini-3.8-flash` | Specification & Rules |
| :--- | :--- | :--- | :--- |
| `temperature` | `number` | **DEPRECATED / DISALLOWED** | Official doc note: *"This field is no longer supported and is silently ignored on Gemini 3.6 Flash and newer models."* In strict request validators and reasoning workflows, passing `temperature` risks `INVALID_ARGUMENT` (HTTP 400). **MUST BE OMITTED** for `gemini-3.8-flash`. |
| `topP` | `number` | **DEPRECATED / DISALLOWED** | Deprecated on Gemini 3.6+ and 3.8 Flash. **MUST BE OMITTED**. |
| `topK` | `integer` | **DEPRECATED / DISALLOWED** | Deprecated on Gemini 3.6+ and 3.8 Flash. **MUST BE OMITTED**. |
| `responseMimeType` | `string` | **ALLOWED & REQUIRED** | Must be set to `"application/json"` for structured medication extraction. |
| `responseSchema` | `object` | **ALLOWED** | Valid subset of OpenAPI 3.0 schema (type `OBJECT`, properties, required array). |
| `thinkingConfig` | `object` | **ALLOWED** | Contains `thinkingLevel` and optional `includeThoughts`. Detailed in §2.3. |
| `maxOutputTokens` | `integer` | **ALLOWED (Optional)** | Model limit is 65,536 tokens. For medication summary, default or omitted is standard. |
| `stopSequences` | `string[]` | **ALLOWED (Optional)** | Up to 5 stop sequences. Omitted for JSON schema mode. |
| `candidateCount` | `integer` | **ALLOWED (Optional)** | Must be 1 (multiple candidates unsupported with thinking models). |
| `seed` | `integer` | **ALLOWED (Optional)** | Optional integer seed for reproducibility. |

**Recommended `generationConfig` Payload for Worker:**
```json
{
  "generationConfig": {
    "responseMimeType": "application/json",
    "thinkingConfig": {
      "thinkingLevel": "LOW"
    },
    "responseSchema": { ... }
  }
}
```

---

### 2.3 `thinkingConfig` Deep Dive

Gemini 3.8 Flash features native reasoning ("thinking"). Official documentation specifies:

1. **`thinkingLevel` Enum Values:**
   - `"LOW"`: Low thinking depth. Delivers fastest latency and lowest token consumption. **Strongly recommended** for real-time mobile optical character recognition and medication leaflet extraction.
   - `"MEDIUM"`: Balanced reasoning depth.
   - `"HIGH"`: Deepest reasoning process for multi-step algorithmic or architectural deductions.
   - `"MINIMAL"`: **EXPLICITLY REJECTED.** The official Gemini 3.8 Flash model card states:
     > *"Thinking: Supported (low, medium, high). Note: `minimal` is not supported and returns an error."*
2. **`thinkingBudget` (Integer):**
   - Legacy parameter introduced in Gemini 2.0 / 2.5 Flash Thinking.
   - For Gemini 3.x, thinking depth is governed by `thinkingLevel`, not token integer budgets. Supplying `thinkingBudget: 0` will either be ignored or cause an HTTP 400 rejection.
3. **Resilience Strategy:**
   - First attempt: Send request with `thinkingConfig: { thinkingLevel: 'LOW' }`.
   - Fallback retry: If upstream Gemini returns HTTP 400 and the error payload includes `thinking`, automatically retry the request without `thinkingConfig`.

---

### 2.4 Upstream Google Gemini Error Behavior & Diagnostic Patterns

When the Gemini API rejects a request, it returns an HTTP status code accompanied by a standard Google RPC JSON body:
```json
{
  "error": {
    "code": 400,
    "message": "...",
    "status": "INVALID_ARGUMENT",
    "details": [ ... ]
  }
}
```

The table below outlines the upstream conditions, detectable message substrings, and their classification:

| Category | Upstream HTTP | RPC Status | Diagnostic Substrings in `error.message` | Cloudflare Worker Mapped `error_code` |
| :--- | :--- | :--- | :--- | :--- |
| **Location / Region Block** | 400 or 403 | `FAILED_PRECONDITION` or `PERMISSION_DENIED` | `"User location is not supported for the API use."`<br>`"location is not supported"`<br>`"region is not supported"`<br>`"country is not supported"` | `UPSTREAM_LOCATION_RESTRICTED` |
| **Model Overload / Transient Outage** | 503 | `UNAVAILABLE` | `"The model is overloaded. Please try again later."`<br>`"The model is currently overloaded"`<br>`"service_unavailable"` | `UPSTREAM_OVERLOADED` |
| **Rate Limit / Quota Exhaustion** | 429 | `RESOURCE_EXHAUSTED` | `"Resource has been exhausted (e.g. check quota)."`<br>`"rate_limit_exceeded"`<br>`"quota_exceeded"`<br>`"Quota exceeded for quota metric"` | `UPSTREAM_RATE_LIMIT` |
| **Malformed Request / Rejected Config** | 400 | `INVALID_ARGUMENT` | `"Invalid JSON payload received"`<br>`"Unknown name \"temperature\""`<br>`"thinkingConfig"`<br>`"thinkingLevel"`<br>`"Schema is invalid"` | `UPSTREAM_BAD_REQUEST` |
| **Authentication / Key Failure** | 401 or 403 | `UNAUTHENTICATED` or `PERMISSION_DENIED` | `"API key not valid"`<br>`"API_KEY_INVALID"`<br>`"Method doesn't allow unregistered callers"` | `UPSTREAM_AUTH_ERROR` |
| **Model Not Found** | 404 | `NOT_FOUND` | `"models/... is not found for API version"`<br>`"model_not_found"` | `UPSTREAM_MODEL_NOT_FOUND` |
| **Upstream Internal Server Error** | 500 or 502 | `INTERNAL` | `"An internal error has occurred."`<br>`"Bad Gateway"` | `UPSTREAM_API_ERROR` |
| **Upstream Gateway Timeout** | 504 | `DEADLINE_EXCEEDED` | `"Deadline exceeded"`<br>`"Gateway Timeout"` | `UPSTREAM_TIMEOUT` |

---

## 3. Cloudflare Worker Error Schema Specification

### 3.1 TypeScript Type Definitions

Milestone 1 establishes the unified diagnostic error schema for `worker/src/index.ts`:

```typescript
/**
 * Canonical Diagnostic Error Codes emitted by Cloudflare Worker
 */
export type WorkerErrorCode =
  // Upstream Google Gemini API Errors
  | 'UPSTREAM_OVERLOADED'           // 503: Model overloaded / service temporarily unavailable
  | 'UPSTREAM_RATE_LIMIT'           // 429: Upstream quota / per-minute limit exceeded
  | 'UPSTREAM_LOCATION_RESTRICTED'  // 403: Egress IP or account region not supported by Gemini
  | 'UPSTREAM_BAD_REQUEST'          // 400: Upstream rejected arguments (thinkingConfig, schema)
  | 'UPSTREAM_AUTH_ERROR'           // 401/403: Missing or invalid Gemini API key upstream
  | 'UPSTREAM_MODEL_NOT_FOUND'      // 404: Upstream model name does not exist
  | 'UPSTREAM_API_ERROR'            // 500/502: General upstream server failure
  | 'UPSTREAM_TIMEOUT'              // 504: Upstream deadline exceeded
  // Client Request / Edge Gateway Errors
  | 'BAD_REQUEST'                   // 400: Malformed client JSON or missing image parameter
  | 'PAYLOAD_TOO_LARGE'             // 413: Client payload exceeds 4MB
  | 'METHOD_NOT_ALLOWED'            // 405: Non-POST HTTP method used
  | 'RATE_LIMIT_EXCEEDED'           // 429: Cloudflare edge rate limit exceeded (10 req/min)
  // Worker Internal Execution Errors
  | 'SERVER_CONFIGURATION_ERROR'    // 500: Missing GEMINI_API_KEY environment secret in Worker
  | 'INTERNAL_SERVER_ERROR';        // 500: Uncaught worker execution exception

/**
 * Cloudflare Worker Error Response Interface
 */
export interface WorkerErrorResponse {
  is_clear: false;
  retake_message: string;          // User-facing localized Arabic instruction
  error: string;                   // Backwards-compatible legacy string
  error_code: WorkerErrorCode;     // Machine-readable diagnostic enum
  upstream_status?: number;        // Raw HTTP status received from Google Gemini
  detail?: string;                 // Sanitized, non-sensitive technical summary (max 250 chars)
}

/**
 * Cloudflare Worker Success Response Interface
 */
export interface WorkerSuccessResponse {
  is_clear: true;
  confidence: 'high' | 'medium' | 'low';
  evidence_text: string;
  medicine_name_ar: string;
  medicine_name_en: string;
  active_ingredient: string;
  uses: string[];
  how_and_when: string[];
  warnings: string[];
  audio_summary: string;
  retake_message?: string;
  error_code?: null;
}

export type WorkerApiResponse = WorkerSuccessResponse | WorkerErrorResponse;
```

---

### 3.2 Response Mapping Matrix

The Worker must map error events to appropriate HTTP status codes, headers, and friendly Arabic messages:

| Scenario | Worker HTTP Status | `error_code` | `upstream_status` | User Arabic Guidance (`retake_message`) |
| :--- | :--- | :--- | :--- | :--- |
| Upstream 503 (Overloaded) | 503 | `UPSTREAM_OVERLOADED` | 503 | "خدمة الذكاء الاصطناعي تحت ضغط مؤقت. يرجى الانتظار بضع ثوانٍ ثم الضغط على زر إعادة المحاولة." |
| Upstream 429 (Rate Limit) | 429 | `UPSTREAM_RATE_LIMIT` | 429 | "تم تجاوز حد الطلبات المسموح لدى مزود الخدمة. يرجى الانتظار دقيقة والمحاولة مجدداً." |
| Upstream Region Block | 403 | `UPSTREAM_LOCATION_RESTRICTED` | 400 or 403 | "خدمة التحليل الذكي غير متاحة في هذا النطاق الجغرافي حالياً." |
| Upstream 400 (Bad Argument) | 400 | `UPSTREAM_BAD_REQUEST` | 400 | "حدث خطأ في صياغة طلب التحليل مع المعالج الذكي. يرجى إعادة المحاولة." |
| Upstream Auth Failure | 500 | `UPSTREAM_AUTH_ERROR` | 401 or 403 | "حدث خطأ في التحقق من صلاحية الخدمة الذكية في الخادم." |
| Upstream 500 / 502 / Generic | 500 | `UPSTREAM_API_ERROR` | Upstream status | "حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية. يرجى المحاولة مرة أخرى." |
| Upstream 504 (Timeout) | 504 | `UPSTREAM_TIMEOUT` | 504 | "استغرق مزود الخدمة وقتاً أطول من المعتاد. يرجى إعادة المحاولة." |
| Edge Rate Limit Exceeded | 429 | `RATE_LIMIT_EXCEEDED` | undefined | "تم تجاوز حد الاستخدام المسموح (10 تحليلات في الدقيقة). يرجى الانتظار دقيقة قبل تصوير دواء آخر." |
| Missing Image in Request | 400 | `BAD_REQUEST` | undefined | "لم يتم استلام صورة علبة الدواء. يرجى التقاط صورة واضحة والمحاولة مجدداً." |
| Image Exceeds 4MB | 413 | `PAYLOAD_TOO_LARGE` | undefined | "حجم الصورة كبير جداً (يتجاوز 4 ميجابايت). يرجى إعادة التقاط الصورة بحجم أصغر وإضاءة جيدة." |
| Worker Missing API Key | 500 | `SERVER_CONFIGURATION_ERROR` | undefined | "خدمة التحليل غير مهيأة بالشكل الصحيح في الخادم (مفتاح GEMINI_API_KEY غير موجود)." |
| Method Not POST | 405 | `METHOD_NOT_ALLOWED` | undefined | "طريقة الطلب غير مدعومة. يرجى استخدام POST فقط." |

---

## 4. Log Sanitization & Information Leakage Prevention

### 4.1 Threat Model
Cloudflare edge logs are accessible via `wrangler tail` and Cloudflare Dashboard metrics. To comply with HIPAA/GDPR health privacy standards and Google Cloud security policies:
1. **API Keys:** Neither the URL query string (`?key=AIza...`) nor request headers (`x-goog-api-key`) may appear in logs or error bodies.
2. **Patient Medical Photos:** Base64 image payloads (`body.image`, `inlineData.data`, data URIs) must NEVER be logged under any circumstance.
3. **Verbose Stack Dumps:** Raw exception stacks containing internal worker file paths or upstream response bodies must be truncated and sanitized.

### 4.2 Verified Sanitization Algorithm & Implementation

```typescript
/**
 * Strips all sensitive credentials, headers, and base64 payloads from log strings.
 */
export function sanitizeLogMessage(message: unknown): string {
  if (message == null) return '';
  
  let str =
    typeof message === 'string'
      ? message
      : message instanceof Error
      ? message.stack || message.message
      : JSON.stringify(message);

  return str
    // 1. Redact Google API key query parameter (?key=... or &key=...)
    .replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED_KEY]')
    // 2. Redact standard AIza Google API key pattern anywhere in string
    .replace(/AIza[0-9A-Za-z\-_]{35}/g, '[REDACTED_KEY]')
    // 3. Redact x-goog-api-key header values
    .replace(/(x-goog-api-key\s*[:=]\s*)[^\r\n,;"'\s]+/gi, '$1[REDACTED_KEY]')
    // 4. Redact Authorization Bearer tokens
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\r\n,;"'\s]+/gi, '$1[REDACTED_TOKEN]')
    // 5. Redact data:image base64 URI strings
    .replace(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/gi, 'data:image/[REDACTED_BASE64]')
    // 6. Redact image/inlineData JSON field payloads
    .replace(/("?(?:data|image|inlineData)"?\s*:\s*")[A-Za-z0-9+/=]{64,}(")/gi, '$1[REDACTED_BASE64]$2')
    // 7. Redact any long standalone base64 sequence (>= 80 characters)
    .replace(/[A-Za-z0-9+/=]{80,}/g, '[REDACTED_PAYLOAD]');
}

/**
 * Extracts a safe, single-line diagnostic summary for the detail field (max 250 characters).
 */
export function buildSafeDetail(status: number, rawMessage: string): string {
  const sanitized = sanitizeLogMessage(rawMessage).replace(/[\r\n\t]+/g, ' ').trim();
  let summary = sanitized;

  try {
    const parsed = JSON.parse(sanitized);
    if (parsed.error?.message) {
      summary = parsed.error.message;
    }
  } catch {
    // raw text used
  }

  const prefix = `Gemini HTTP ${status}: `;
  const maxSummaryLen = 250 - prefix.length - 3;
  const truncatedSummary = summary.length > maxSummaryLen ? summary.slice(0, maxSummaryLen) + '...' : summary;
  
  return `${prefix}${truncatedSummary}`.trim();
}
```

---

## 5. Specification Mining Tables

### Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Gemini API Model | `gemini-3.8-flash` Model Code | Primary GA multimodal reasoning model released Sept 2026 | Text + Image Base64 | Structured JSON candidate | HTTP 404 if misspelled | `gemini-api-guides/models/gemini-3.8-flash.md` |
| 2 | Gemini API Config | `temperature` Disallowed | `temperature` sampling parameter deprecated on Gemini 3.6/3.8 | Number `0.0..2.0` | Deprecated / Ignored / Rejected | Risky HTTP 400 `INVALID_ARGUMENT` if passed with thinking | `gemini-api-reference/generate-content.md` |
| 3 | Gemini API Config | `thinkingLevel` Support | Thinking depth enum: `"LOW"`, `"MEDIUM"`, `"HIGH"` | String enum | Internal model reasoning tokens | Returns HTTP 400 if `"MINIMAL"` is passed | `gemini-api-guides/models/gemini-3.8-flash.md` |
| 4 | Gemini API Config | `thinkingBudget` Deprecated | Legacy integer budget token count | Integer | Ignored on 3.x | Replaced by `thinkingLevel` | `gemini-api-guides/text-generation.md` |
| 5 | Gemini API Error | Location Restriction | Egress IP / country restriction on Gemini API | Regional request | Error JSON | HTTP 400/403 with `FAILED_PRECONDITION` / `"User location is not supported"` | `gemini-api-guides/api-errors.md` & Live survey |
| 6 | Gemini API Error | Service Overload | Model overloaded during peak traffic | GenerateContent call | Error JSON | HTTP 503 `UNAVAILABLE` (`"The model is overloaded"`) | Live telemetry via `wrangler tail` |
| 7 | Gemini API Error | Quota Exhausted | Per-minute or daily quota exceeded | GenerateContent call | Error JSON | HTTP 429 `RESOURCE_EXHAUSTED` | `gemini-api-guides/api-errors.md` |
| 8 | Gemini API Error | Rejected Thinking/Schema | Invalid parameter in `generationConfig` | Bad payload | Error JSON | HTTP 400 `INVALID_ARGUMENT` | `gemini-api-guides/api-errors.md` |
| 9 | Worker Response | Structured Error Schema | Unified error response containing `error_code`, `upstream_status`, `detail` | Error condition | JSON `WorkerErrorResponse` | HTTP 4xx / 5xx with localized Arabic guidance | Requirement R3 & `SCOPE.md` |
| 10 | Worker Logging | Sensitive Data Redactor | Sanitizer stripping keys, headers, and base64 images | Raw log message | Clean log string | Never leaks secrets to Cloudflare logs | Requirement R3 & Test Verification |

---

### Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Model Name Prefix | `models/gemini-3.8-flash` in `GEMINI_MODEL` | Must strip `models/` prefix to prevent URL path `/models/models/gemini-3.8-flash` (HTTP 404). |
| 2 | `thinkingLevel: "MINIMAL"` | `thinkingConfig: { thinkingLevel: 'MINIMAL' }` | Explicitly rejected by `gemini-3.8-flash` with HTTP 400 `INVALID_ARGUMENT`. |
| 3 | Thinking Rejection Fallback | Gemini rejects `thinkingConfig` with HTTP 400 | Worker catches 400, inspects error string for `"thinking"`, retries once with payload without `thinkingConfig`. |
| 4 | Upstream 503 Overload | Gemini returns HTTP 503 during traffic spike | Worker intercepts 503, returns `WorkerErrorResponse` with `error_code: "UPSTREAM_OVERLOADED"` and HTTP 503 instead of opaque 500. |
| 5 | Region / Geo-blocking | Gemini rejects with `"User location is not supported"` | Worker returns HTTP 403 with `error_code: "UPSTREAM_LOCATION_RESTRICTED"` and localized Arabic explanation. |
| 6 | Cloudflare Rate Limit | Client sends 11th request in 60s from same IP | Cloudflare Native Rate Limiter (or in-memory fallback) returns HTTP 429 with `Retry-After: 60` and `error_code: "RATE_LIMIT_EXCEEDED"`. |
| 7 | Image Payload > 4MB | Base64 string > 4 * 1024 * 1024 bytes | Worker validates length before parsing and returns HTTP 413 `PAYLOAD_TOO_LARGE`. |
| 8 | Empty/Blank/Corrupt Image | Client sends `{"image": ""}` or missing property | Worker returns HTTP 400 `BAD_REQUEST` without calling Gemini. |
| 9 | Gemini Returns Empty Text | Gemini responds with HTTP 200 but empty candidate array | Worker returns `is_clear: false` with fallback object and Arabic retake prompt. |
| 10 | API Key in Error Response | Upstream Gemini error contains `https://...?key=AIzaSy...` in error text | Sanitizer strips key query parameter to `[REDACTED_KEY]` before logging or setting `detail`. |

---

## 6. Guidance for Milestone 1 Implementation

When Milestone 1 engineers update `worker/src/index.ts` and `tests/worker.test.ts`:
1. **In `worker/src/index.ts`:**
   - Remove `temperature: 0` from `generationConfig` when model is `gemini-3.8-flash`.
   - Ensure `thinkingConfig: { thinkingLevel: 'LOW' }` is used.
   - When handling `!response.ok`, parse the upstream body text, run it through `sanitizeLogMessage()`, and classify the error using the regex table.
   - Return the structured `WorkerErrorResponse` with appropriate `error_code`, `upstream_status`, and `detail`.
2. **In `tests/worker.test.ts`:**
   - Update line 146 where the test previously checked `expect(capturedBody.generationConfig.temperature).toBe(0)`. For `gemini-3.8-flash`, it should assert that `temperature` is `undefined`.
   - Add test cases verifying:
     - Upstream 503 produces `error_code: "UPSTREAM_OVERLOADED"` with HTTP 503.
     - Upstream location restriction produces `error_code: "UPSTREAM_LOCATION_RESTRICTED"` with HTTP 403.
     - Upstream 429 produces `error_code: "UPSTREAM_RATE_LIMIT"` with HTTP 429.
     - Log messages and `detail` never contain `AIza...`, `?key=...`, or image base64.
