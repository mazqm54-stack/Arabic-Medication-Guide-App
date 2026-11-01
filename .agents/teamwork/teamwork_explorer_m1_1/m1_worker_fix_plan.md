# Milestone 1 Plan: Cloudflare Worker Diagnostics & Upstream Gemini Error Handling

## 1. Executive Summary & Problem Diagnosis

### 1.1 Context
The Dalili Medication Guide mobile application relies on a Cloudflare Worker proxy (`worker/src/index.ts`) deployed at `https://dalili-medication-guide-worker.dalili-medication.workers.dev` to analyze images of medication boxes via Google's Gemini Vision models without exposing the Google API key to clients.

### 1.2 Observed Failure
1. **Health check (`GET /health`)**: Returns `HTTP 200 OK` confirming Cloudflare deployment and presence of the secret:
   ```json
   {"status":"ok","service":"dalili-medication-guide-worker","model":"gemini-3.8-flash","hasApiKey":true}
   ```
2. **Analysis endpoint (`POST /api/analyze`)**: Consistently fails with `HTTP 500 Internal Server Error`:
   ```json
   {"is_clear":false,"retake_message":"حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية. يرجى المحاولة مرة أخرى.","error":"UPSTREAM_API_ERROR"}
   ```
3. **Live Wrangler Tail Telemetry**:
   Logs reveal `[Worker] Upstream Gemini error: HTTP 503` (and HTTP 400 when invalid parameters are supplied). Because the existing worker suppresses the actual upstream HTTP status, error message, and details, neither client apps nor developers could diagnose upstream failures. Furthermore, any failure was attributed to "image not clear" on the client, confusing elderly users.

---

## 2. Gemini 3.8 Flash API Specifications & Breaking Changes

According to the official Google Gemini API documentation (verified via Gemini API docs tool):
1. **Model Support**: `gemini-3.8-flash` is generally available (stable) since September 2026.
2. **Temperature Deprecation**: Sampling parameters (`temperature`, `top_p`, `top_k`) are deprecated for Gemini 3.x models (`gemini-3.8-flash`, `gemini-3.6-flash`, etc.). Supplying `temperature: 0` can trigger an `HTTP 400 Bad Request` on newer Gemini 3 endpoints. The worker must conditionally omit `temperature` when using `gemini-3.8-flash` or any `gemini-3.x` model, while retaining `temperature: 0` only for legacy models (e.g., `gemini-1.5-flash`).
3. **ThinkingConfig**:
   - `gemini-3.8-flash` supports `thinkingConfig: { thinkingLevel: 'LOW' | 'MEDIUM' | 'HIGH' }`.
   - `minimal` is explicitly **not supported** on `gemini-3.8-flash` and returns an error.
   - `thinkingBudget` (integer) is legacy (Gemini 2.0) and rejected on Gemini 3.8 Flash.
   - If an upstream model rejects `thinkingConfig` with `HTTP 400`, the worker must cleanly retry without `thinkingConfig`.

---

## 3. Empirical Live Diagnostics

Empirical live tests conducted via `curl` against `https://dalili-medication-guide-worker.dalili-medication.workers.dev`:
- `GET /health` -> `HTTP 200 OK` (Cloudflare edge colo `SOF` Sofia).
- `POST /api/analyze` with synthetic valid JPEG base64 payload:
  - Execution wall time: ~12s - ~120s depending on upstream queueing.
  - Returns `HTTP 500` with generic `{"error":"UPSTREAM_API_ERROR"}`.
  - Wrangler CLI authentication confirmed: `mazqm54@gmail.com` (Account ID `e082aa6bb2e4458fe3096feb4d838b51`), valid OAuth token with `workers (write)` and `workers_scripts (write)` permissions.

---

## 4. Proposed Worker Implementation (`worker/src/index.ts`)

### 4.1 Security & Secret Sanitization Guardrails
To prevent accidental leaks of the `GEMINI_API_KEY` or raw patient medical images:
1. **Never Log Image Payloads**: Do not print `body.image`, `cleanBase64`, or `inlineData` in console logs or responses.
2. **Regex Redaction of Secrets**:
   ```typescript
   function sanitizeMessage(msg: string): string {
     if (!msg) return '';
     return msg
       .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
       .replace(/key=[^&\s]+/gi, 'key=[REDACTED_KEY]')
       .slice(0, 300);
   }
   ```
3. **Structured Upstream Error Parsing**:
   Parse upstream JSON or text, safely extracting non-sensitive descriptions while capping lengths.

### 4.2 Error Code Mapping Table
| Scenario | HTTP Status | `error_code` | `upstream_status` | User Message (`retake_message`) |
| :--- | :--- | :--- | :--- | :--- |
| Upstream Overloaded (503) | 503 | `UPSTREAM_OVERLOADED` | 503 | خدمة الذكاء الاصطناعي تحت ضغط مؤقت. يرجى الانتظار بضع ثوانٍ ثم الضغط على زر إعادة المحاولة. |
| Upstream Rate Limit (429) | 429 | `UPSTREAM_RATE_LIMIT` | 429 | تم تجاوز حد الطلبات لدى مزود الخدمة الذكية. يرجى الانتظار دقيقة والمحاولة مجدداً. |
| Upstream Location Restricted (403/400) | 403 | `UPSTREAM_LOCATION_RESTRICTED` | 400 / 403 | خدمة التحليل الذكي غير متاحة في هذا النطاق الجغرافي حالياً. |
| Upstream Bad Request (400) | 400 | `UPSTREAM_BAD_REQUEST` | 400 | حدث خطأ في صياغة طلب التحليل لمزود الخدمة الذكية. |
| General Upstream Failure (500/502/504) | 500 | `UPSTREAM_API_ERROR` | `response.status` | حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية. يرجى المحاولة مرة أخرى. |
| Missing Worker API Key | 500 | `SERVER_CONFIGURATION_ERROR` | undefined | خدمة التحليل غير مهيأة بالشكل الصحيح في الخادم (مفتاح GEMINI_API_KEY غير موجود). يرجى ضبط المفتاح في Cloudflare Worker. |
| Client Payload > 4MB | 413 | `PAYLOAD_TOO_LARGE` | undefined | حجم الصورة كبير جداً (يتجاوز 4 ميجابايت). يرجى إعادة التقاط الصورة بحجم أصغر وإضاءة جيدة. |
| Client Rate Limit Exceeded | 429 | `RATE_LIMIT_EXCEEDED` | undefined | تم تجاوز حد الاستخدام المسموح (10 تحليلات في الدقيقة). يرجى الانتظار دقيقة قبل تصوير دواء آخر. |
| Missing/Invalid Image Payload | 400 | `BAD_REQUEST` | undefined | لم يتم استلام صورة علبة الدواء. يرجى التقاط صورة واضحة والمحاولة مجدداً. |
| Method Not Allowed | 405 | `METHOD_NOT_ALLOWED` | undefined | طريقة الطلب غير مدعومة. يرجى استخدام POST فقط. |
| Unexpected Worker Exception | 500 | `INTERNAL_SERVER_ERROR` | undefined | حدث خطأ غير متوقع أثناء معالجة الصورة. يرجى المحاولة بعد قليل. |
| Success (Analysis Complete) | 200 | `null` | undefined | (Empty or normal result) |

### 4.3 Proposed Code Changes for `worker/src/index.ts`

```typescript
// --- Helper Functions to Add Near Top of worker/src/index.ts ---

function sanitizeMessage(msg: string): string {
  if (!msg) return '';
  return msg
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED_KEY]')
    .slice(0, 300);
}

function parseUpstreamError(rawText: string, status: number): { detail: string; isLocationBlocked: boolean } {
  const sanitized = sanitizeMessage(rawText);
  let message = '';
  try {
    const parsed = JSON.parse(sanitized);
    if (parsed?.error?.message && typeof parsed.error.message === 'string') {
      message = parsed.error.message.trim();
    }
  } catch {
    message = sanitized.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const combined = (message + ' ' + sanitized).toLowerCase();
  const isLocationBlocked = (status === 400 || status === 403) && (
    combined.includes('location') ||
    combined.includes('region') ||
    combined.includes('country') ||
    combined.includes('not supported for the api use') ||
    combined.includes('failed_precondition')
  );

  const detail = message
    ? `Gemini HTTP ${status}: ${message.slice(0, 200)}`
    : `Gemini API returned HTTP ${status}`;

  return { detail, isLocationBlocked };
}
```

#### Inside `fetch()`:
1. **GenerationConfig (Omit temperature for Gemini 3)**:
```typescript
    const rawModel = env.GEMINI_MODEL || 'gemini-3.8-flash';
    const model = rawModel.replace(/^models\//, '');
    const cleanBase64 = image.includes(',') ? image.split(',')[1] : image;

    // Detect Gemini 3.x models to omit deprecated temperature parameter
    const isGemini3 = /gemini-3/i.test(model) || /3\.[0-9]/i.test(model);

    const buildPayload = (includeThinking: boolean) => {
      const genConfig: Record<string, any> = {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RESPONSE_SCHEMA
      };

      // Only set temperature: 0 for legacy models (pre-Gemini 3)
      if (!isGemini3) {
        genConfig.temperature = 0;
      }

      if (includeThinking) {
        genConfig.thinkingConfig = {
          thinkingLevel: 'LOW'
        };
      }

      return {
        systemInstruction: {
          parts: [{ text: PHARMACIST_SYSTEM_PROMPT }]
        },
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Analyze this medicine packaging photo and extract all details according to the instructions.' },
              {
                inlineData: {
                  mimeType: typeof mimeType === 'string' && mimeType.trim() ? mimeType.trim() : 'image/jpeg',
                  data: cleanBase64
                }
              }
            ]
          }
        ],
        generationConfig: genConfig
      };
    };
```

2. **Upstream Request & Sanitized Error Processing**:
```typescript
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    try {
      let response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(true))
      });

      // Fallback: If model rejects thinkingConfig with HTTP 400, retry without thinkingConfig
      if (response.status === 400) {
        const errorText = await response.clone().text().catch(() => '');
        if (errorText.toLowerCase().includes('thinking')) {
          console.warn('[Worker] Model rejected thinkingConfig, retrying without thinkingConfig');
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPayload(false))
          });
        }
      }

      if (!response.ok) {
        const rawErrorText = await response.text().catch(() => '');
        const { detail, isLocationBlocked } = parseUpstreamError(rawErrorText, response.status);

        console.error(`[Worker] Upstream Gemini error: HTTP ${response.status} - ${detail}`);

        if (isLocationBlocked) {
          return jsonResponse(
            {
              is_clear: false,
              retake_message: 'خدمة التحليل الذكي غير متاحة في هذا النطاق الجغرافي حالياً.',
              error: 'UPSTREAM_LOCATION_RESTRICTED',
              error_code: 'UPSTREAM_LOCATION_RESTRICTED',
              upstream_status: response.status,
              detail
            },
            403
          );
        }

        if (response.status === 503) {
          return jsonResponse(
            {
              is_clear: false,
              retake_message: 'خدمة الذكاء الاصطناعي تحت ضغط مؤقت. يرجى الانتظار بضع ثوانٍ ثم الضغط على زر إعادة المحاولة.',
              error: 'UPSTREAM_OVERLOADED',
              error_code: 'UPSTREAM_OVERLOADED',
              upstream_status: 503,
              detail
            },
            503
          );
        }

        if (response.status === 429) {
          return jsonResponse(
            {
              is_clear: false,
              retake_message: 'تم تجاوز حد الطلبات لدى مزود الخدمة الذكية. يرجى الانتظار دقيقة والمحاولة مجدداً.',
              error: 'UPSTREAM_RATE_LIMIT',
              error_code: 'UPSTREAM_RATE_LIMIT',
              upstream_status: 429,
              detail
            },
            429,
            { 'Retry-After': '60' }
          );
        }

        if (response.status === 400) {
          return jsonResponse(
            {
              is_clear: false,
              retake_message: 'حدث خطأ في صياغة طلب التحليل لمزود الخدمة الذكية.',
              error: 'UPSTREAM_BAD_REQUEST',
              error_code: 'UPSTREAM_BAD_REQUEST',
              upstream_status: 400,
              detail
            },
            400
          );
        }

        return jsonResponse(
          {
            is_clear: false,
            retake_message: 'حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية. يرجى المحاولة مرة أخرى.',
            error: 'UPSTREAM_API_ERROR',
            error_code: 'UPSTREAM_API_ERROR',
            upstream_status: response.status,
            detail
          },
          500
        );
      }
```

3. **Success Response with `error_code: null`**:
```typescript
      return jsonResponse({
        ...parsedJson,
        error_code: null
      });
```

---

## 5. Test Plan for `tests/worker.test.ts`

### 5.1 Existing Tests Updates
1. Line 89 (`SERVER_CONFIGURATION_ERROR`):
   - Assert `expect(data.error_code).toBe('SERVER_CONFIGURATION_ERROR');`
   - Assert `expect(data.detail).toContain('GEMINI_API_KEY');`
2. Line 146 (`correctly normalizes models/ prefix`):
   - Change `expect(capturedBody.generationConfig.temperature).toBe(0);`
   - To: `expect(capturedBody.generationConfig.temperature).toBeUndefined();`
   - Verify: `expect(capturedBody.generationConfig.thinkingConfig.thinkingLevel).toBe('LOW');`

### 5.2 New Test Cases to Add
1. `retains temperature: 0 when using legacy non-Gemini 3 model (e.g. gemini-1.5-flash)`:
   - Provide `GEMINI_MODEL: 'gemini-1.5-flash'`, verify `capturedBody.generationConfig.temperature === 0`.
2. `translates upstream Gemini HTTP 503 to safe UPSTREAM_OVERLOADED error with upstream_status and detail`:
   - Mock fetch returning 503 with JSON `{"error": {"code": 503, "message": "The model is overloaded. Please try again later."}}`.
   - Assert status is 503, `error_code` is `UPSTREAM_OVERLOADED`, `upstream_status` is 503, and `retake_message` has Arabic overload warning.
3. `translates upstream Gemini HTTP 429 to safe UPSTREAM_RATE_LIMIT error with Retry-After`:
   - Mock fetch returning 429.
   - Assert status is 429, `Retry-After: 60`, `error_code` is `UPSTREAM_RATE_LIMIT`, `upstream_status` is 429.
4. `detects upstream location restriction and returns UPSTREAM_LOCATION_RESTRICTED (403)`:
   - Mock fetch returning 400 or 403 with `"User location is not supported for the API use."`.
   - Assert status is 403, `error_code` is `UPSTREAM_LOCATION_RESTRICTED`, `retake_message` explains geographical restriction.
5. `sanitizes API keys and sensitive tokens from error detail`:
   - Mock fetch returning an error containing `AIzaSyD1234567890abcdefghijklmnopqrstuv`.
   - Assert `data.detail` replaces the key with `[REDACTED_KEY]`.
6. `retries without thinkingConfig if Gemini returns 400 mentioning thinking`:
   - Mock fetch first returning 400 with `thinkingConfig not supported`, second call returning 200.
   - Verify second call omitted `thinkingConfig` and overall response returned 200 with `error_code: null`.

---

## 6. Deployment & Live Verification Steps (Implementer Instructions)

After code modifications are made:
1. **Run Vitest Tests**:
   ```powershell
   npm.cmd test
   ```
2. **Deploy Worker**:
   ```powershell
   cd worker
   cmd.exe /c "npx wrangler deploy"
   ```
3. **Verify Live Endpoint**:
   ```powershell
   curl.exe --noproxy "*" -i -X POST -H "Content-Type: application/json" -d "@test_payload.json" https://dalili-medication-guide-worker.dalili-medication.workers.dev/api/analyze
   ```
   Confirm structured JSON is returned and any failures provide `error_code`, `upstream_status`, and `detail`.
