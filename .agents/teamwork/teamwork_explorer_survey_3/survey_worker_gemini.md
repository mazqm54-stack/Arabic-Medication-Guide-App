# Technical Survey: Cloudflare Worker Diagnostics & Upstream Gemini Error Handling (Requirement R3)

**Author:** Explorer 3  
**Date:** 2026-10-29  
**Status:** Completed  
**Target Working Directory:** `c:\Users\PC\Documents\antigravity\fervent-mendel\worker`

---

## 1. Executive Summary

A comprehensive investigation of the Cloudflare Worker backend (`worker/src/index.ts`, `worker/wrangler.toml`) and live endpoint (`https://dalili-medication-guide-worker.dalili-medication.workers.dev`) was conducted.

### Core Discoveries:
1. **Live Endpoint Status:**
   - Health check (`GET /health`) is **online (HTTP 200)**, confirming Cloudflare deployment and presence of the `GEMINI_API_KEY` secret.
   - Analysis endpoint (`POST /api/analyze`) consistently returns **HTTP 500 Internal Server Error** with the payload:
     ```json
     {"is_clear":false,"retake_message":"حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية. يرجى المحاولة مرة أخرى.","error":"UPSTREAM_API_ERROR"}
     ```
2. **Root Cause Analysis (Live Telemetry via Wrangler Tail):**
   - Intercepted live Cloudflare Worker logs during an active request:
     `[Worker] Upstream Gemini error: HTTP 503` (wall time ~11.85 seconds).
   - Google Gemini API returned **HTTP 503 Service Unavailable / Model Overloaded**.
   - Because the Worker currently swallows upstream error details and maps all non-429 upstream errors to a generic 500 with opaque `UPSTREAM_API_ERROR`, neither the client app nor developers could see what failed.
   - Furthermore, in the client application (`src/App.tsx` and `src/components/UnclearPhotoCard.tsx`), any failure is presented to elderly users under the misleading title *"الصورة غير واضحة بما يكفي"* (The image is not clear enough), causing user confusion.
3. **Gemini API & Model Specifications (`gemini-3.8-flash`):**
   - `gemini-3.8-flash` is a valid, generally available model (released September 2, 2026 as GA).
   - **Critical Breaking API Changes in Gemini 3.6/3.8:**
     * Deprecated sampling parameters: `temperature`, `top_p`, and `top_k` are deprecated. In future/current model generations, passing `temperature` triggers an **HTTP 400 Bad Request**. The worker currently passes `temperature: 0`.
     * `thinkingConfig`: Gemini 3.x uses `thinkingLevel: "LOW" | "MEDIUM" | "HIGH"`. `thinkingBudget` (integer) is legacy (Gemini 2.0). The worker correctly uses `thinkingLevel: "LOW"`, but minimal thinking is unsupported on 3.8 and causes an error.
4. **Cloudflare Deployment Readiness:**
   - Wrangler CLI is pre-authenticated with OAuth token for account `mazqm54@gmail.com` (Account ID: `e082aa6bb2e4458fe3096feb4d838b51`).
   - Deployment via `cmd.exe /c "npx wrangler deploy"` is verified and functional.

---

## 2. Worker Codebase Architecture Inspection

### 2.1 File Structure
```
worker/
├── .wrangler/          # Wrangler temporary build cache
├── package.json        # Dependencies: @cloudflare/workers-types, wrangler ^3.99.0, typescript ^5.7.3
├── src/
│   └── index.ts        # Main Worker entry point (366 lines)
└── wrangler.toml       # Worker configuration, vars, rate limiting
```

### 2.2 `worker/wrangler.toml` Analysis
```toml
name = "dalili-medication-guide-worker"
main = "src/index.ts"
compatibility_date = "2024-10-01"

[placement]
mode = "smart"

[vars]
GEMINI_MODEL = "gemini-3.8-flash"

# Cloudflare Rate Limiting (10 requests per minute)
[[ratelimits]]
name = "RATE_LIMITER"
namespace_id = "1001"

[ratelimits.simple]
limit = 10
period = 60
```
- **Model Variable:** `GEMINI_MODEL = "gemini-3.8-flash"`.
- **Smart Placement:** Enabled. Optimizes worker execution location relative to backend origins.
- **Rate Limiting:** Bound to Cloudflare Native Rate Limiting (10 req/min).

### 2.3 `worker/src/index.ts` Detailed Inspection

#### Request Flow:
1. **CORS Preflight:** Handles `OPTIONS` with `204 No Content` and full CORS headers.
2. **Health Check:** `GET /` or `GET /health` returns:
   ```json
   {"status":"ok","service":"dalili-medication-guide-worker","model":"gemini-3.8-flash","hasApiKey":true}
   ```
3. **Rate Limiting:** Checks `env.RATE_LIMITER.limit({ key: clientIp })` with in-memory sliding window fallback (10 req/min). Returns HTTP 429 when exceeded.
4. **Payload Parsing:** Validates `body.image` (string, max 4MB).
5. **Secret Check:** Verifies `env.GEMINI_API_KEY`. Returns HTTP 500 `SERVER_CONFIGURATION_ERROR` if empty.
6. **Gemini Upstream URL:**
   `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`
7. **Gemini Payload Construction:**
   ```typescript
   generationConfig: {
     temperature: 0,                           // ⚠️ DEPRECATED in Gemini 3.6/3.8
     responseMimeType: 'application/json',
     ...(includeThinking
       ? {
           thinkingConfig: {
             thinkingLevel: 'LOW'              // Supported on Gemini 3.x
           }
         }
       : {}),
     responseSchema: GEMINI_RESPONSE_SCHEMA
   }
   ```
8. **Upstream Error Handling Deficiencies:**
   - **Flawed Fallback:**
     ```typescript
     if (response.status === 400) {
       const errorText = await response.clone().text();
       if (errorText.toLowerCase().includes('thinking')) {
         response = await fetch(apiUrl, { ... buildPayload(false) });
       }
     }
     ```
     If the 400 error is caused by `temperature: 0`, the fallback does not trigger. Even if it triggered, `buildPayload(false)` still includes `temperature: 0`.
   - **Opaque Upstream Error Response:**
     ```typescript
     if (!response.ok) {
       if (response.status === 429) { ... }
       console.error(`[Worker] Upstream Gemini error: HTTP ${response.status}`);
       return jsonResponse({
         is_clear: false,
         retake_message: 'حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية. يرجى المحاولة مرة أخرى.',
         error: 'UPSTREAM_API_ERROR'
       }, 500);
     }
     ```
     - Does not read or log the response body (error message is lost).
     - Does not return `error_code` or `detail` field.
     - Swallows specific HTTP codes (503 Service Overloaded, 403 Forbidden / Location Block, 404 Model Not Found, 400 Bad Request).

---

## 3. Gemini API Specifications & Compatibility Investigation

### 3.1 Model Support: `gemini-3.8-flash`
According to official Gemini API documentation:
- **Status:** GA (Generally Available) since September 2, 2026.
- **Capabilities:**
  - Multimodal input: Text, Image, Video, Audio, PDF.
  - Output: Structured JSON (`responseMimeType: "application/json"`, `responseSchema`).
  - Native Thinking support: Levels `low`, `medium`, `high`.
- **Breaking API Rule:**
  - `temperature`, `top_p`, `top_k` are deprecated. For Gemini 3.6 Flash, Gemini 3.8 Flash, and newer models, requests must omit these sampling parameters to avoid HTTP 400 errors.

### 3.2 `thinkingConfig` & Thinking Levels
- **Gemini 3 Series:**
  - `thinkingLevel`: `"LOW"` (fastest reasoning), `"MEDIUM"` (default balanced), `"HIGH"` (deepest reasoning).
  - Note: `minimal` is not supported on `gemini-3.8-flash` and returns an error.
  - `thinkingBudget`: Integer parameter used for Gemini 2.0 / legacy models.
- **Gemini 1.5 Series:**
  - Does **not** support `thinkingConfig`. Supplying `thinkingConfig` returns HTTP 400.
- **Safe Handling Strategy:**
  - Omit `temperature` for Gemini 3.x models.
  - Apply `thinkingConfig: { thinkingLevel: 'LOW' }` for Gemini 3.x.
  - If upstream returns HTTP 400, automatically retry without `thinkingConfig`.

---

## 4. Live Endpoint Diagnostics & Telemetry

### 4.1 Test Methodology
A synthetic valid 1x1 JPEG base64 payload was constructed matching the client application schema:
```json
{
  "image": "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "mimeType": "image/jpeg"
}
```

### 4.2 Endpoint Test 1: Health Check (`GET /health`)
- **Command:** `curl.exe -i -s https://dalili-medication-guide-worker.dalili-medication.workers.dev/health`
- **Result:**
  ```http
  HTTP/1.1 200 OK
  Date: Thu, 29 Oct 2026 15:55:15 GMT
  Content-Type: application/json; charset=utf-8
  Cf-Placement: local-SOF
  Server: cloudflare

  {"status":"ok","service":"dalili-medication-guide-worker","model":"gemini-3.8-flash","hasApiKey":true}
  ```
- **Deduction:** The worker is live, reachable, and has `GEMINI_API_KEY` configured in Cloudflare Secrets.

### 4.3 Endpoint Test 2: Live Analysis (`POST /api/analyze`)
- **Command:** `curl.exe -i -s -X POST -H "Content-Type: application/json" -d "@test_payload.json" https://dalili-medication-guide-worker.dalili-medication.workers.dev/api/analyze`
- **Result:**
  ```http
  HTTP/1.1 500 Internal Server Error
  Date: Thu, 29 Oct 2026 16:00:59 GMT
  Content-Type: application/json; charset=utf-8
  Cf-Placement: local-SOF
  CF-RAY: a52362690984f346-SOF
  Server: cloudflare

  {"is_clear":false,"retake_message":"حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية. يرجى المحاولة مرة أخرى.","error":"UPSTREAM_API_ERROR"}
  ```

### 4.4 Live Cloudflare Log Capture (via `wrangler tail`)
During the live execution, `wrangler tail` captured the following trace:
```json
{
  "wallTime": 11856,
  "cpuTime": 1,
  "executionModel": "stateless",
  "outcome": "ok",
  "scriptVersion": { "id": "539b2d5e-a600-4e95-8e7d-1e3dd86c2913" },
  "logs": [
    {
      "message": [ "[Worker] Upstream Gemini error: HTTP 503" ],
      "level": "error",
      "timestamp": 1793290208394
    }
  ],
  "event": {
    "request": {
      "url": "https://dalili-medication-guide-worker.dalili-medication.workers.dev/api/analyze",
      "method": "POST",
      "cf": { "colo": "SOF" }
    },
    "response": { "status": 500 }
  }
}
```

### 4.5 Findings on Region/Location Restrictions
- The worker executes at Cloudflare edge colocation `SOF` (Sofia, Bulgaria).
- The error received was HTTP 503 (Overloaded), **not** HTTP 400/403 with `FAILED_PRECONDITION` ("User location is not supported").
- However, if the API key or Cloudflare egress IP is routed to a region where Gemini Developer API is restricted, Gemini returns:
  `"User location is not supported for the API use."`
- The Worker must explicitly parse this string to return `error_code: "UPSTREAM_LOCATION_RESTRICTED"`.

---

## 5. Secure Upstream Error Logging & Client Diagnostic Contract

### 5.1 Secret Sanitization Guardrails
To prevent accidental leaks of the API key or raw patient medical images:
1. **Never Log Image Data:** Never include `body.image`, `cleanBase64`, or `inlineData` in console logs or error responses.
2. **Sanitize Upstream URLs & Errors:** Strip API key patterns before logging or returning in detail:
   ```typescript
   function sanitizeMessage(msg: string): string {
     return msg
       .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
       .replace(/key=[^&\s]+/gi, 'key=[REDACTED_KEY]');
   }
   ```
3. **Truncate Detail:** Cap the `detail` string at 250 characters to prevent verbose error dumps.

### 5.2 Enhanced Error Response Schema
The Worker must return structured diagnostic fields so the client can differentiate failures:
```typescript
interface WorkerErrorResponse {
  is_clear: false;
  retake_message: string;          // User-friendly Arabic guidance
  error: string;                   // Legacy backwards compatibility (e.g., 'UPSTREAM_API_ERROR')
  error_code: string;              // Specific diagnostic code
  detail?: string;                 // Non-sensitive technical summary (e.g., 'Gemini HTTP 503: Model overloaded')
  upstream_status?: number;        // HTTP status code from Google Gemini
}
```

### 5.3 Error Code Mapping Table
| Upstream Condition | `error_code` | HTTP Status | User Message (`retake_message`) |
| :--- | :--- | :--- | :--- |
| Upstream HTTP 503 | `UPSTREAM_OVERLOADED` | 503 | "خدمة الذكاء الاصطناعي تحت ضغط مؤقت. يرجى الانتظار بضع ثوانٍ ثم الضغط على زر إعادة المحاولة." |
| Upstream HTTP 429 | `UPSTREAM_RATE_LIMIT` | 429 | "تم تجاوز حد الطلبات المسموح لدى مزود الخدمة. يرجى الانتظار دقيقة والمحاولة مجدداً." |
| Upstream Location Block | `UPSTREAM_LOCATION_RESTRICTED` | 403 | "خدمة التحليل الذكي غير متاحة في هذا النطاق الجغرافي حالياً." |
| Upstream HTTP 400 (Invalid Arg) | `UPSTREAM_BAD_REQUEST` | 400 | "حدث خطأ في صياغة طلب التحليل. يرجى إعادة المحاولة." |
| Other Upstream Errors (500, etc.) | `UPSTREAM_API_ERROR` | 500 | "حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية. يرجى المحاولة مرة أخرى." |
| Worker Missing API Key | `SERVER_CONFIGURATION_ERROR` | 500 | "خدمة التحليل غير مهيأة بالشكل الصحيح في الخادم." |
| Client Payload > 4MB | `PAYLOAD_TOO_LARGE` | 413 | "حجم الصورة كبير جداً (يتجاوز 4 ميجابايت). يرجى تصغير الصورة." |
| Client Rate Limit Exceeded | `RATE_LIMIT_EXCEEDED` | 429 | "تم تجاوز حد الاستخدام المسموح (10 تحليلات في الدقيقة)." |
| Missing Image Payload | `BAD_REQUEST` | 400 | "لم يتم استلام صورة علبة الدواء." |

---

## 6. Actionable Implementation Plan for Worker

### Step 1: Update `worker/src/index.ts`
1. **Remove deprecated `temperature: 0` for Gemini 3.x models:**
   ```typescript
   const isGemini3 = model.includes('gemini-3') || model.includes('3.8') || model.includes('3.6');
   const generationConfig: Record<string, any> = {
     responseMimeType: 'application/json',
     responseSchema: GEMINI_RESPONSE_SCHEMA
   };
   if (!isGemini3) {
     generationConfig.temperature = 0;
   }
   if (includeThinking) {
     generationConfig.thinkingConfig = { thinkingLevel: 'LOW' };
   }
   ```
2. **Add Upstream Retry on 503 / 400:**
   If upstream returns 503 or 400 with thinking error, perform one retry (with a 1-second delay for 503, or with thinking omitted for 400).
3. **Implement Safe Upstream Error Capture and Logging:**
   ```typescript
   if (!response.ok) {
     const errorText = await response.text().catch(() => '');
     const sanitized = sanitizeMessage(errorText);
     console.error(`[Worker] Upstream Gemini error HTTP ${response.status}: ${sanitized.slice(0, 300)}`);
     
     // Detect location restrictions
     const isLocationBlocked = (response.status === 400 || response.status === 403) &&
       (sanitized.toLowerCase().includes('location') || sanitized.toLowerCase().includes('region') || sanitized.toLowerCase().includes('country'));

     if (isLocationBlocked) {
       return jsonResponse({
         is_clear: false,
         retake_message: 'خدمة التحليل الذكي غير متاحة في هذا النطاق الجغرافي حالياً.',
         error: 'UPSTREAM_LOCATION_RESTRICTED',
         error_code: 'UPSTREAM_LOCATION_RESTRICTED',
         detail: `Gemini HTTP ${response.status}: Location not supported`,
         upstream_status: response.status
       }, 403);
     }

     if (response.status === 503) {
       return jsonResponse({
         is_clear: false,
         retake_message: 'خدمة الذكاء الاصطناعي تحت ضغط مؤقت. يرجى إعادة المحاولة بعد قليل.',
         error: 'UPSTREAM_OVERLOADED',
         error_code: 'UPSTREAM_OVERLOADED',
         detail: `Gemini HTTP 503: Service Unavailable / Overloaded`,
         upstream_status: 503
       }, 503);
     }

     if (response.status === 429) {
       return jsonResponse({
         is_clear: false,
         retake_message: 'تم تجاوز حد الطلبات لدى مزود الخدمة الذكية. يرجى الانتظار دقيقة والمحاولة مجدداً.',
         error: 'UPSTREAM_RATE_LIMIT',
         error_code: 'UPSTREAM_RATE_LIMIT',
         detail: `Gemini HTTP 429: Rate limit exceeded`,
         upstream_status: 429
       }, 429, { 'Retry-After': '60' });
     }

     return jsonResponse({
       is_clear: false,
       retake_message: 'حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية. يرجى المحاولة مرة أخرى.',
       error: 'UPSTREAM_API_ERROR',
       error_code: 'UPSTREAM_API_ERROR',
       detail: `Gemini HTTP ${response.status}: ${extractErrorMessage(sanitized) || 'Upstream API error'}`,
       upstream_status: response.status
     }, 500);
   }
   ```

### Step 2: Update Tests in `tests/worker.test.ts`
- Ensure tests verify `error_code`, `detail`, and `upstream_status`.
- Verify no `temperature` is passed when `GEMINI_MODEL` is `gemini-3.8-flash`.
- Verify location restriction returns `UPSTREAM_LOCATION_RESTRICTED`.

### Step 3: Deploy Worker to Cloudflare
Execute deployment from project root:
```powershell
cd worker
cmd.exe /c "npx wrangler deploy"
```
*(Note: Use `cmd.exe /c "npx wrangler deploy"` to avoid PowerShell script execution policy restrictions on `npx.ps1`).*

### Step 4: Re-Test Live Worker Endpoint
Send test request with synthetic JPEG:
```powershell
curl.exe -i -s -X POST -H "Content-Type: application/json" -d "@test_payload.json" https://dalili-medication-guide-worker.dalili-medication.workers.dev/api/analyze
```
Verify response contains structured JSON or precise error codes.
