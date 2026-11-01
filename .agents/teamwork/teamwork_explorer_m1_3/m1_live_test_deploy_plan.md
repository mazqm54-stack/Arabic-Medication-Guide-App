# Milestone 1: Cloudflare Worker Diagnostics, Deployment & Testing Plan

**Author:** Explorer 3  
**Date:** 2026-10-29  
**Milestone:** Milestone 1 — Cloudflare Worker Diagnostics & Upstream Gemini Error Handling  
**Target Components:** `worker/src/index.ts`, `worker/wrangler.toml`, `tests/worker.test.ts`  

---

## 1. Executive Summary

This report establishes the live testing methodology, deployment procedures, verification protocols, and automated test specifications for Milestone 1.

### Key Empirical Findings:
1. **Current Live Worker State:**
   - Target URL: `https://dalili-medication-guide-worker.dalili-medication.workers.dev`
   - Health check (`GET /health`): **HTTP 200 OK** (`status: "ok"`, `service: "dalili-medication-guide-worker"`, `model: "gemini-3.8-flash"`, `hasApiKey: true`).
   - Analysis endpoint (`POST /api/analyze`): Consistently returns **HTTP 500 Internal Server Error** with:
     ```json
     {"is_clear":false,"retake_message":"حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية. يرجى المحاولة مرة أخرى.","error":"UPSTREAM_API_ERROR"}
     ```
   - Cloudflare telemetry confirms upstream Google Gemini returns HTTP 503 / HTTP 400. Currently, the worker suppresses upstream error details, lacks safe error codes, and supplies deprecated `temperature: 0`.
2. **Deployment Readiness:**
   - Wrangler CLI v4.155.0 is authenticated via OAuth to account `mazqm54@gmail.com` (Account ID: `e082aa6bb2e4458fe3096feb4d838b51`).
   - Verified command `cd worker; cmd.exe /c "npx wrangler deploy"` is fully functional.
   - Requires running with outside-sandbox privileges (`BypassSandbox: true`) because local sandbox proxies interfere with Cloudflare API connections and log writes.
3. **Automated Worker Tests:**
   - Invocation command: `npm.cmd test -- tests/worker.test.ts`.
   - 10 existing tests pass in ~3.08 seconds via Vitest v3.2.7.
   - Crucial gap identified: Existing test #8 asserts `expect(capturedBody.generationConfig.temperature).toBe(0)`. This must be updated to assert omission (`toBeUndefined()`) for Gemini 3.8 Flash, and new tests for upstream 503, 429, location restriction, and secret sanitization must be introduced.

---

## 2. Live Endpoint Testing Methodology

### 2.1 Endpoint Specification & Zero-Secret Architecture
The Dalili backend operates as a zero-secret proxy:
- **Base URL:** `https://dalili-medication-guide-worker.dalili-medication.workers.dev`
- **Health Check Endpoint:** `GET /health` or `GET /`
- **Image Analysis Endpoint:** `POST /api/analyze`
- **Authentication:** No client-side API key is required. The `GEMINI_API_KEY` is securely stored as an encrypted environment secret in Cloudflare Workers.

### 2.2 Sample Valid Payload
The endpoint expects a JSON object matching the client request format:
```json
{
  "image": "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "mimeType": "image/jpeg"
}
```
*Note: The image field contains a valid base64-encoded JPEG (either raw base64 or prefixed with `data:image/jpeg;base64,`). Maximum allowed size is 4MB.*

### 2.3 Live Testing Commands

#### Option A: `curl.exe` (Recommended on Windows)
1. **Health Check:**
   ```powershell
   curl.exe -i -s https://dalili-medication-guide-worker.dalili-medication.workers.dev/health
   ```

2. **Live Analysis Request (Capturing Status Code & Body):**
   ```powershell
   # Write payload to temporary file
   $payload = '{"image":"/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=","mimeType":"image/jpeg"}'
   $payload | Set-Content -Path "test_payload.json" -Encoding utf8

   # Send request and capture HTTP status code + JSON response body cleanly
   $statusCode = curl.exe -s -o live_response.json -w "%{http_code}" -X POST "https://dalili-medication-guide-worker.dalili-medication.workers.dev/api/analyze" -H "Content-Type: application/json" -d "@test_payload.json"

   Write-Output "HTTP Status: $statusCode"
   Get-Content live_response.json
   ```

#### Option B: PowerShell 5.1 / 7 (`Invoke-WebRequest`)
```powershell
$uri = "https://dalili-medication-guide-worker.dalili-medication.workers.dev/api/analyze"
$payload = @{
    image = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
    mimeType = "image/jpeg"
} | ConvertTo-Json

try {
    $res = Invoke-WebRequest -Uri $uri -Method Post -ContentType "application/json" -Body $payload -UseBasicParsing
    $statusCode = $res.StatusCode
    $body = $res.Content
} catch [System.Net.WebException] {
    $webRes = $_.Exception.Response
    $statusCode = [int]$webRes.StatusCode
    $reader = New-Object System.IO.StreamReader($webRes.GetResponseStream(), [System.Text.Encoding]::UTF8)
    $body = $reader.ReadToEnd()
}

Write-Output "HTTP Status: $statusCode"
Write-Output "Body: $body"
```

### 2.4 Capturing Status and Body Without Printing Secrets
To prevent exposing sensitive data (API keys, session tokens, or patient image base64 strings):
1. **Never echo request image payloads:** The base64 image data must not be written to terminal logs.
2. **Filter upstream responses against secret patterns:**
   ```powershell
   function Sanitize-Output([string]$raw) {
       if (-not $raw) { return "" }
       $clean = $raw -replace 'AIza[0-9A-Za-z\-_]{35}', '[REDACTED_API_KEY]'
       $clean = $clean -replace 'key=[^&\s"]+', 'key=[REDACTED_KEY]'
       $clean = $clean -replace 'Bearer\s+[A-Za-z0-9\-_\.]+', 'Bearer [REDACTED_TOKEN]'
       return $clean
   }
   ```
3. **Worker-Side Redaction:** The worker itself must strip any instances of `AIza...` or `?key=...` from `detail` and `console.error` logs before sending responses back to the client.

---

## 3. Worker Deployment Procedure

### 3.1 Deployment Prerequisites Verified
- **Cloudflare Account:** `mazqm54@gmail.com` (Account ID: `e082aa6bb2e4458fe3096feb4d838b51`).
- **Wrangler Version:** `4.155.0` (managed via `npx`).
- **Configuration:** `worker/wrangler.toml`:
  - `name = "dalili-medication-guide-worker"`
  - `main = "src/index.ts"`
  - `compatibility_date = "2024-10-01"`
  - `[vars] GEMINI_MODEL = "gemini-3.8-flash"`
  - `[[ratelimits]] name = "RATE_LIMITER"`
- **Cloudflare Secrets:** `GEMINI_API_KEY` is already stored on Cloudflare and persists across deployments.

### 3.2 Deployment Command
From the project root:
```powershell
cd worker; cmd.exe /c "npx wrangler deploy"
```

#### Why `cmd.exe /c "npx wrangler deploy"` is Mandatory:
1. In Windows PowerShell, running `npx` directly targets `npx.ps1`, which can be blocked by PowerShell's `Restricted` or `RemoteSigned` Execution Policy.
2. `cmd.exe /c` invokes `npx.cmd` directly, ensuring frictionless execution in standard Windows environments.
3. For automated agents, the command must be executed with sandbox bypass (`BypassSandbox: true`) to avoid sandbox proxy connection failures (`127.0.0.1:62743`) and file system permission locks in `C:\Users\PC\AppData\Roaming\xdg.config\.wrangler`.

---

## 4. Post-Deployment Verification Protocol

### 4.1 Step 1: Health Check Verification
Verify the worker is running and recognizes the model and secret:
```powershell
curl.exe -s https://dalili-medication-guide-worker.dalili-medication.workers.dev/health
```
**Expected Response:**
```json
{
  "status": "ok",
  "service": "dalili-medication-guide-worker",
  "model": "gemini-3.8-flash",
  "hasApiKey": true
}
```

### 4.2 Step 2: Live Analysis Verification
Execute the test command:
```powershell
$status = curl.exe -s -o test_res.json -w "%{http_code}" -X POST "https://dalili-medication-guide-worker.dalili-medication.workers.dev/api/analyze" -H "Content-Type: application/json" -d "@test_payload.json"
```

### 4.3 Validation Criteria
After the Milestone 1 fixes (temperature omission and upstream error handling) are deployed:

1. **Successful Gemini Analysis (HTTP 200 OK):**
   - HTTP status code must be **200**.
   - Body must be valid JSON matching `GEMINI_RESPONSE_SCHEMA`:
     - `is_clear`: `true` or `false` (boolean)
     - `retake_message`: string (Arabic instructions)
     - `confidence`: `"high"` | `"medium"` | `"low"`
     - `evidence_text`: string
     - `medicine_name_ar`: string
     - `medicine_name_en`: string
     - `active_ingredient`: string
     - `uses`: string[]
     - `how_and_when`: string[]
     - `warnings`: string[]
     - `audio_summary`: string
     - `error_code`: `null` (or omitted)

2. **Upstream Overloaded / Gemini 503 (Diagnostic Response):**
   - If Google Gemini returns HTTP 503 during testing:
     - Worker must return **HTTP 503** (not opaque generic 500).
     - Body must contain:
       ```json
       {
         "is_clear": false,
         "retake_message": "خدمة الذكاء الاصطناعي تحت ضغط مؤقت. يرجى الانتظار بضع ثوانٍ ثم الضغط على زر إعادة المحاولة.",
         "error": "UPSTREAM_OVERLOADED",
         "error_code": "UPSTREAM_OVERLOADED",
         "upstream_status": 503,
         "detail": "Gemini HTTP 503: Service Unavailable / Overloaded"
       }
       ```
     - Validates that error translation and diagnostic codes are functioning correctly.

---

## 5. Worker Automated Tests Architecture (`tests/worker.test.ts`)

### 5.1 Test Invocation
- **Command:** `npm.cmd test -- tests/worker.test.ts`
- **Test Framework:** Vitest v3.2.7 (`vitest run tests/worker.test.ts`)
- **Environment:** `jsdom` with `globals: true` and `./src/test/setup.ts` preloaded.
- **Speed:** ~3.08 seconds for full worker suite execution.

### 5.2 Direct Worker Import Mechanism
The test does not start an HTTP server or run Miniflare; it directly imports the worker handler:
```typescript
import worker, { PHARMACIST_SYSTEM_PROMPT, GEMINI_RESPONSE_SCHEMA } from '../worker/src/index';
```
Tests invoke:
```typescript
const response = await worker.fetch(request, env);
```
This enables fast, reliable unit testing of edge cases without network latency or external rate limits.

### 5.3 Mocking and Fixture Strategy

#### A. Upstream Gemini Network Mocking (`globalThis.fetch`)
Network calls to `https://generativelanguage.googleapis.com/...` are intercepted with `vi.spyOn`:
```typescript
vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
  const parsedBody = JSON.parse(init.body);
  return new Response(JSON.stringify({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify(SAMPLE_MOCK_MEDICATION)
        }]
      }
    }]
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
```

#### B. Cloudflare Environment & Bindings Mocking
```typescript
const mockEnv = {
  GEMINI_API_KEY: 'test-api-key-123',
  GEMINI_MODEL: 'gemini-3.8-flash',
  RATE_LIMITER: {
    limit: vi.fn().mockResolvedValue({ success: true })
  }
};
```

#### C. Request Fixtures
Using Web standard `Request`:
```typescript
const request = new Request('https://worker.local/api/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'cf-connecting-ip': '192.168.1.1'
  },
  body: JSON.stringify({ image: 'base64sample' })
});
```

### 5.4 Test Suite Delta Required for Milestone 1

| Test Name | Target Behavior | Assertion Delta |
| :--- | :--- | :--- |
| **Test #8 (Line 146)** | Gemini 3.8 Config | Change `expect(capturedBody.generationConfig.temperature).toBe(0)` to `expect(capturedBody.generationConfig.temperature).toBeUndefined()` |
| **New Test #11** | Upstream 503 Overloaded | Mock fetch returns status 503. Assert worker returns status 503, `error_code: 'UPSTREAM_OVERLOADED'`, and `upstream_status: 503`. |
| **New Test #12** | Upstream 429 Rate Limit | Mock fetch returns status 429. Assert worker returns status 429, `error_code: 'UPSTREAM_RATE_LIMIT'`, and `Retry-After: 60`. |
| **New Test #13** | Upstream Location Block | Mock fetch returns status 400 with text `"User location is not supported"`. Assert worker returns status 403 with `error_code: 'UPSTREAM_LOCATION_RESTRICTED'`. |
| **New Test #14** | Secret Sanitization | Mock fetch returns 500 with text containing `AIzaSyD...` and `key=XYZ`. Assert worker logs and `detail` field redact the key to `[REDACTED_KEY]` and do not include the raw image. |

---

## 6. Implementation Checklist for Milestone 1 Implementer

- [ ] Update `worker/src/index.ts`:
  - Omit `temperature` when `model` is Gemini 3.x (`gemini-3.8-flash`, `gemini-3.6-flash`).
  - Read response error text on `!response.ok` and sanitize via `sanitizeMessage(errorText)`.
  - Handle HTTP 503 -> return HTTP 503 with `error_code: 'UPSTREAM_OVERLOADED'` and `upstream_status: 503`.
  - Handle HTTP 429 -> return HTTP 429 with `error_code: 'UPSTREAM_RATE_LIMIT'` and `Retry-After: 60`.
  - Detect location restrictions (`location`, `region`, `country`) -> return HTTP 403 with `error_code: 'UPSTREAM_LOCATION_RESTRICTED'`.
  - Fallback non-ok responses -> return HTTP 500 with `error_code: 'UPSTREAM_API_ERROR'` and sanitized `detail`.
- [ ] Update `tests/worker.test.ts`:
  - Update Gemini 3.8 config test to assert `temperature` is undefined.
  - Add test cases for 503, 429, location block, and secret sanitization.
  - Run `npm.cmd test -- tests/worker.test.ts` to verify 100% pass.
- [ ] Deploy Worker:
  - Run `cd worker; cmd.exe /c "npx wrangler deploy"` (with `BypassSandbox: true`).
- [ ] Live Endpoint Validation:
  - Run live test with `test_payload.json` and confirm HTTP status code and JSON schema.
