# Technical Specification & Analysis: R1 (Zero-Secret Serverless Backend) & R5 (AI Pharmacist Prompt, Strict Schema & Client Guardrails)

- **Author**: Specification Miner 2 (Survey Phase)
- **Target System**: "دليلي الدوائي" (My Medication Guide) - Native Android & PWA
- **Authoritative Source**: `.agents/teamwork/ORIGINAL_REQUEST.md` (Update Header `## 2026-10-28T18:21:21Z`)
- **Status**: Complete & Verified

---

## 1. Executive Summary

This document establishes the exhaustive technical specification for:
1. **Requirement 1 (R1): Zero-Secret Serverless Backend (`/api/analyze`)**
   Eliminating client-side API keys and APK decompilation vulnerabilities by introducing a serverless proxy running in European/MENA-adjacent regions (`fra1` or `cdg1`), handling image payloads, enforcing per-IP rate limits (20 req/hr), validating payload sizes (max 4MB), and orchestrating Gemini API calls with zero secrets exposed to the client.
2. **Requirement 5 (R5): AI Pharmacist Prompt, Strict Schema & Client Guardrails**
   Enforcing the verbatim English system instruction (lines 117–129), a strict 11-field JSON response schema with enum constraints and item limits, and multi-tier client guardrails (handling `is_clear: false`, empty `evidence_text`, `confidence: "low"`, markdown fence stripping, and field validation).

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R1: Security | Zero-Secret Client Architecture | Completely remove client-side API key inputs, modal dialogs, and `localStorage` key persistence (`apiKeyStorage.ts`). Client contains zero secrets. | User interaction / launch | Clean UI without key prompts | N/A (keys cannot be entered or leaked) | ORIGINAL_REQUEST.md (R1, line 79) |
| 2 | R1: Backend | Serverless Endpoint `/api/analyze` | Vercel serverless function handling image analysis requests via `POST`. | JSON `{ image: string, mimeType?: string }` (base64 JPEG) | JSON conforming to R5 schema | 400 Bad Request, 413 Payload Too Large, 429 Too Many Requests, 500 Server Error | ORIGINAL_REQUEST.md (R1, line 80-85) |
| 3 | R1: Backend | Configurable Environment Variables | Uses `GEMINI_API_KEY` (secret) and `GEMINI_MODEL` (configurable, default `gemini-1.5-flash` or `gemini-2.5-flash`) via `process.env`. Never hardcode model name. | `process.env.GEMINI_API_KEY`, `process.env.GEMINI_MODEL` | Server execution context | HTTP 500 with friendly Arabic message if API key missing | ORIGINAL_REQUEST.md (R1, line 82) |
| 4 | R1: Backend | Gemini Parameter Optimization | Configures `temperature: 0`, `responseMimeType: "application/json"`, `thinkingConfig: { thinkingBudget: 0 }` (to disable/minimize thinking latency on thinking models), and strict `responseSchema`. | Base64 image + prompt | Structured JSON text from Gemini | Throws if Gemini fails or rejects params; server catches and formats response | ORIGINAL_REQUEST.md (R1, line 83) |
| 5 | R1: Backend | Per-IP Rate Limiting | Rate limits clients to 20 requests/hour per IP address using IP extraction from `x-forwarded-for` / `x-real-ip`. | Client IP address | HTTP 200 with `X-RateLimit-*` headers or HTTP 429 | HTTP 429 with `Retry-After` header and Arabic retry explanation | ORIGINAL_REQUEST.md (R1, line 84) |
| 6 | R1: Backend | Max Payload Size Validation | Validates request body size before processing. Rejects oversized payloads (>4MB base64). | Request body / `content-length` | Passes to Gemini if valid | HTTP 413 with friendly Arabic message asking user to retake photo | ORIGINAL_REQUEST.md (R1, line 84) |
| 7 | R1: Backend | Low-Latency Region Affinity | Configures function in `vercel.json` with region affinity `fra1` (Frankfurt) or `cdg1` (Paris) for low latency to Middle East / North Africa users. | `vercel.json` configuration | Deployed function in specified region | Default region used if unspecified | ORIGINAL_REQUEST.md (R1, line 84) |
| 8 | R1: Deployment | Vercel Deployment & Docs | Provides `vercel.json` configuration and concise deployment guide & README for setting env vars and deploying. | CLI commands / environment | Deployed production API | Missing env var warning in guide | ORIGINAL_REQUEST.md (R1, line 87) |
| 9 | R1: Client | Client API Proxy Routing | Client connects to `/api/analyze` using `import.meta.env.VITE_API_URL` (relative `/api/analyze` for web, full URL for Capacitor APK). | `VITE_API_URL` environment variable | Fetch call to backend proxy | Fallback error card with Arabic explanation on network failure | ORIGINAL_REQUEST.md (R1, line 86) |
| 10 | R5: Prompt | Verbatim AI Pharmacist Prompt | Exact 10-rule English system instruction enforcing factual reading of packaging without guessing. | Medication package image | Structured pharmacist analysis | Instructions force `is_clear=false` on blur/unclear images | ORIGINAL_REQUEST.md (R5, lines 117-129) |
| 11 | R5: Schema | Strict 11-Field JSON Schema | Exact output schema: `is_clear`, `retake_message`, `confidence`, `evidence_text`, `medicine_name_ar`, `medicine_name_en`, `active_ingredient`, `uses` (max 3), `how_and_when` (max 3), `warnings` (max 4), `audio_summary`. | Gemini model output | Validated JSON object matching schema | Unmatched format caught and handled by parser | ORIGINAL_REQUEST.md (R5, lines 131-146) |
| 12 | R5: Guardrail | Unclear Photo Guardrail | If `is_clear === false`, display `retake_message` and prominent retry button. Never show partial or broken cards. | `{ is_clear: false, retake_message: "..." }` | Unclear photo UI state | Retake message rendered with high contrast and retry action | ORIGINAL_REQUEST.md (R5, line 149) |
| 13 | R5: Guardrail | Evidence Text Guardrail | If `evidence_text` is empty or missing, client must automatically treat confidence as `"low"`. | Empty string or whitespace in `evidence_text` | Confidence coerced to `"low"` | Triggers low-confidence retake flow | ORIGINAL_REQUEST.md (R5, line 150) |
| 14 | R5: Guardrail | Low Confidence Guardrail | If confidence is `"low"`, do not show medicine details or confirmation screen; automatically ask for a retake. | `{ confidence: "low" }` | Retake photo prompt UI | Blocks displaying unverified drug data | ORIGINAL_REQUEST.md (R5, line 151) |
| 15 | R5: Guardrail | Markdown Fence & JSON Parser | Safely strip markdown code fences (` ```json `), find outer `{}` brackets, and validate all fields before rendering. | Raw model string response | Normalized `MedicineAnalysisResult` | Graceful fallback error object if corrupted | ORIGINAL_REQUEST.md (R5, line 152) |
| 16 | R5: Guardrail | Item Count Clamping | Enforce max item limits: `uses` (max 3), `how_and_when` (max 3), `warnings` (max 4) to ensure concise senior-friendly presentation. | Array of strings from model | Clamped array (`.slice(0, max)`) | Excess items safely discarded | ORIGINAL_REQUEST.md (R5, lines 141-143) |

---

## 3. Edge Cases & Boundary Behaviors

| # | Feature | Input / Scenario | Observed / Required Behavior |
|---|---------|------------------|------------------------------|
| 1 | Rate Limiting | Client makes 21st request within 1 hour | Backend intercepts before Gemini API call, returns HTTP 429 with `Retry-After: <seconds>` and Arabic message: "تم تجاوز حد الطلبات المسموح (20 طلباً في الساعة)..." |
| 2 | Rate Limiting | Request with comma-separated `x-forwarded-for: 203.0.113.195, 70.41.3.18` | Server extracts first IP (`203.0.113.195`) after trimming whitespace, correctly isolating client IP from proxy chain. |
| 3 | Payload Validation | Payload with raw uncompressed 8MB base64 string | Server checks body size against 4MB limit, rejects with HTTP 413 without calling Gemini, saving API quota and preventing Vercel function timeout. |
| 4 | Payload Validation | Empty body `{}` or missing `image` property | Returns HTTP 400 Bad Request with Arabic message: "لم يتم إرسال صورة علبة الدواء...". |
| 5 | Environment Vars | `GEMINI_API_KEY` is undefined or blank | Server returns HTTP 500 with friendly Arabic message ("خدمة التحليل غير مهيأة بالشكل الصحيح في الخادم..."). Client never sees stack trace or missing variable name. |
| 6 | Environment Vars | `GEMINI_MODEL` is not set | Server falls back to default (`process.env.GEMINI_MODEL || 'gemini-1.5-flash'`). |
| 7 | Gemini Thinking Config | `GEMINI_MODEL` is `gemini-1.5-flash` vs `gemini-2.0-flash` | Legacy 1.5 models error if `thinkingConfig` is passed. Server must conditionally include `thinkingConfig: { thinkingBudget: 0 }` only for models supporting thinking (e.g. models matching `/2\./` or `thinking`), or catch and retry without `thinkingConfig`. |
| 8 | Model Hallucination | Model generates drug details but omits `evidence_text` | Client guardrail activates: if `!result.evidence_text?.trim()`, overrides `confidence = 'low'`, which immediately prompts user for retake, preventing hallucinated guidance from reaching senior user. |
| 9 | Low Confidence | Model returns `confidence: "low"` with `is_clear: true` | Client suppresses result cards and confirmation step; displays retake prompt with advice on better lighting and steady camera. |
| 10 | Markdown Wrappers | Model wraps JSON in ```` ```json\n{ ... }\n``` ```` with conversational prefix | Parser strips fences, slices between first `{` and last `}`, producing clean JSON parse. |
| 11 | Multiple Medicines | Packaging image contains 2 different medicine boxes | Prompt rule 3 dictates model sets `is_clear = false` and writes message in `retake_message` asking user to photograph one medicine at a time. |
| 12 | Blurry / Dark Photo | Photo is underexposed or motion-blurred | Prompt rule 2 dictates model sets `is_clear = false` and writes friendly guidance in `retake_message` (more light, whole box visible, steady phone). |
| 13 | Excess List Items | Model outputs 6 items in `warnings` or `uses` | Client clamps array using `.slice(0, 4)` for warnings and `.slice(0, 3)` for uses to avoid overwhelming elderly readers. |
| 14 | CORS Preflight | Android Capacitor webview sends `OPTIONS` preflight from `http://localhost` | Server responds immediately with HTTP 200/204, `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: POST, OPTIONS`, and `Access-Control-Allow-Headers: Content-Type`. |
| 15 | Network Disconnect | User triggers scan while completely offline | Fetch fails; client catches network exception and presents friendly Arabic offline banner: "تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت أو مراجعة الأدوية المحفوظة في أدويتي." |

---

## 4. Exhaustive Technical Specifications

### 4.1. Serverless Endpoint Specification (`/api/analyze`)

- **Route**: `/api/analyze`
- **File Location**: `api/analyze.ts` (Vercel Serverless Function)
- **Runtime**: Node.js 18+ / 20+ (ES Module)
- **HTTP Methods**:
  - `POST`: Main inference invocation
  - `OPTIONS`: CORS preflight handling
  - Any other method: Return `405 Method Not Allowed` with `Allow: POST, OPTIONS`

#### Request Specification
- **Content-Type**: `application/json`
- **Payload Schema**:
  ```typescript
  export interface AnalyzeRequestBody {
    image: string;       // Raw base64-encoded image string (without data:image/jpeg;base64, prefix)
    mimeType?: string;   // Optional MIME type, default: "image/jpeg"
  }
  ```
- **Size Limits**:
  - Maximum body size: 4.0 MB (4,194,304 characters). Vercel's hard limit for request bodies is 4.5 MB.
  - Client pre-processing ensures images are <= 1024px longest side with JPEG quality 0.7, yielding ~150KB–700KB base64 payloads under normal conditions.

#### Response Headers
- `Content-Type: application/json; charset=utf-8`
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With`
- `X-RateLimit-Limit: 20`
- `X-RateLimit-Remaining: <number>`
- `X-RateLimit-Reset: <unix_epoch_seconds>`

#### HTTP Status Codes & Error Responses
- **200 OK**: Successful analysis. Response body is JSON matching R5 schema.
- **400 Bad Request**: Missing or malformed payload.
  ```json
  {
    "is_clear": false,
    "retake_message": "صيغة الطلب غير صالحة، يرجى التقاط صورة واضحة لعلبة الدواء والمحاولة مجدداً.",
    "error": "BAD_REQUEST"
  }
  ```
- **413 Payload Too Large**: Request body exceeds 4MB.
  ```json
  {
    "is_clear": false,
    "retake_message": "حجم الصورة كبير جداً، يرجى إعادة التقاط الصورة بحجم أصغر وإضاءة جيدة.",
    "error": "PAYLOAD_TOO_LARGE"
  }
  ```
- **429 Too Many Requests**: IP rate limit exceeded (>20 req/hr).
  ```json
  {
    "is_clear": false,
    "retake_message": "تم تجاوز حد الاستخدام المسموح (20 تحليلاً في الساعة). يرجى الانتظار قليلاً قبل تصوير دواء آخر.",
    "error": "RATE_LIMIT_EXCEEDED"
  }
  ```
  Header: `Retry-After: <seconds_until_reset>`
- **500 Internal Server Error**: Gemini API failure, missing configuration, or parsing failure.
  ```json
  {
    "is_clear": false,
    "retake_message": "حدث خطأ أثناء التواصل مع المعالج الذكي. يرجى إعادة المحاولة بعد لحظات.",
    "error": "SERVER_ERROR"
  }
  ```

---

### 4.2. Environment Variables & Security Architecture

#### Server-Side Environment Variables (Vercel Project Settings)
1. `GEMINI_API_KEY` (Required, Secret):
   - Google Gemini API key obtained from Google AI Studio.
   - Strictly server-side only. Must NEVER be prefixed with `VITE_`.
   - Never committed to git repository (`.gitignore` must contain `.env*`).
2. `GEMINI_MODEL` (Optional, Configurable):
   - Specifies the model to invoke.
   - Default: `process.env.GEMINI_MODEL || 'gemini-1.5-flash'` (or `gemini-2.5-flash`).
   - Must never be hardcoded into the endpoint logic.

#### Client-Side Environment Variables (Vite / Capacitor)
1. `VITE_API_URL` (Optional / Configurable):
   - Default: `/api/analyze` (for web/PWA deployments where frontend and API share the domain).
   - In Capacitor Android production builds: configured to the full Vercel URL (e.g. `https://dalili-guide.vercel.app/api/analyze`).
   - Defined in `.env.production` or injected during APK build.

#### Zero-Secret Deletion Protocol
- Remove `src/services/apiKeyStorage.ts`.
- Remove `src/components/ApiKeyModal.tsx`.
- Remove all `localStorage.getItem('dalili_gemini_api_key_v1')` references from `App.tsx`.
- Remove settings button for API key input from the top header bar.
- Perform automated grep verification to guarantee 0 secret references in client bundles.

---

### 4.3. Gemini API Parameters & Latency Optimization

When `/api/analyze` calls the upstream Google Gemini REST endpoint (`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`):

```typescript
const payload = {
  systemInstruction: {
    parts: [{ text: PHARMACIST_SYSTEM_PROMPT }]
  },
  contents: [
    {
      role: "user",
      parts: [
        { text: "Analyze this medicine packaging photo and extract all details according to the instructions." },
        {
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: imageBase64
          }
        }
      ]
    }
  ],
  generationConfig: {
    temperature: 0,
    responseMimeType: "application/json",
    // Conditionally include thinkingConfig for Gemini 2.0+ / 2.5+ models to minimize latency
    ...(supportsThinking(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    responseSchema: {
      type: "OBJECT",
      properties: {
        is_clear: { type: "BOOLEAN" },
        retake_message: { type: "STRING" },
        confidence: { type: "STRING", enum: ["high", "medium", "low"] },
        evidence_text: { type: "STRING" },
        medicine_name_ar: { type: "STRING" },
        medicine_name_en: { type: "STRING" },
        active_ingredient: { type: "STRING" },
        uses: { type: "ARRAY", items: { type: "STRING" } },
        how_and_when: { type: "ARRAY", items: { type: "STRING" } },
        warnings: { type: "ARRAY", items: { type: "STRING" } },
        audio_summary: { type: "STRING" }
      },
      required: [
        "is_clear",
        "retake_message",
        "confidence",
        "evidence_text",
        "medicine_name_ar",
        "medicine_name_en",
        "active_ingredient",
        "uses",
        "how_and_when",
        "warnings",
        "audio_summary"
      ]
    }
  }
};
```

#### Thinking Latency Optimization (`thinkingBudget: 0`)
- **Background**: Newer Gemini models (Gemini 2.0 Flash Thinking, Gemini 2.5 Flash) introduce internal reasoning chains which add 2–6 seconds of latency.
- **Requirement**: `thinkingBudget: 0` explicitly instructs the model to bypass or minimize the reasoning token budget, delivering instant answers critical for elderly user patience.
- **Compatibility Guard**: Gemini 1.5 Flash rejects requests containing `thinkingConfig`. The backend must test `supportsThinking(model)` (e.g. `model.includes('2.') || model.includes('thinking')`) or use a try-catch fallback that retries without `thinkingConfig` if a 400 parameter rejection occurs.

---

### 4.4. Serverless Rate Limiting Architecture

- **Quota**: 20 requests per rolling 1-hour window per IP address.
- **Client IP Resolution Hierarchy**:
  ```typescript
  function getClientIp(req: IncomingMessage | VercelRequest): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0].trim();
    }
    return (req.headers['x-real-ip'] as string) || req.socket?.remoteAddress || '127.0.0.1';
  }
  ```
- **In-Memory Store Pattern**:
  ```typescript
  interface RateLimitEntry {
    count: number;
    resetTime: number;
  }
  const rateLimitMap = new Map<string, RateLimitEntry>();
  const WINDOW_MS = 60 * 60 * 1000; // 1 hour
  const MAX_REQUESTS = 20;

  function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    // Periodic garbage collection
    if (rateLimitMap.size > 1000) {
      for (const [key, entry] of rateLimitMap.entries()) {
        if (now > entry.resetTime) rateLimitMap.delete(key);
      }
    }
    let entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetTime) {
      entry = { count: 1, resetTime: now + WINDOW_MS };
      rateLimitMap.set(ip, entry);
      return { allowed: true, remaining: MAX_REQUESTS - 1, resetTime: entry.resetTime };
    }
    if (entry.count >= MAX_REQUESTS) {
      return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }
    entry.count += 1;
    return { allowed: true, remaining: MAX_REQUESTS - entry.count, resetTime: entry.resetTime };
  }
  ```

---

### 4.5. Vercel Deployment Configuration (`vercel.json`) & Guide

#### `vercel.json` Specification
```json
{
  "version": 2,
  "regions": ["fra1"],
  "functions": {
    "api/analyze.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  },
  "routes": [
    {
      "src": "/api/analyze",
      "dest": "/api/analyze.ts"
    },
    {
      "handle": "filesystem"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```
*Note on Regions*: `fra1` (Frankfurt) is selected as the default primary region for minimal round-trip latency to the MENA region. `cdg1` (Paris) is an alternative compliant European option.

#### Deployment Guide & README (`DEPLOYMENT_VERCEL.md`)
1. **Prerequisites**:
   - Vercel CLI installed: `npm.cmd install -g vercel`
   - Active Gemini API key from Google AI Studio.
2. **Local Development**:
   ```bash
   vercel dev
   ```
   (Loads local environment from `.env.local`).
3. **Setting Environment Variables on Vercel**:
   ```bash
   vercel env add GEMINI_API_KEY production
   # Enter value when prompted
   vercel env add GEMINI_MODEL production
   # Enter value e.g. gemini-1.5-flash or gemini-2.5-flash
   ```
4. **Deploying to Production**:
   ```bash
   vercel --prod
   ```
5. **Connecting Android APK**:
   Set `VITE_API_URL=https://<your-project>.vercel.app/api/analyze` in `.env.production` before executing `npm.cmd run build` and `npx.cmd cap sync android`.

---

### 4.6. AI Pharmacist Prompt & Strict Schema (R5)

#### Exact Word-for-Word English System Instruction
Lines 117–129 of `ORIGINAL_REQUEST.md`:

```
You are an expert pharmacist assistant for elderly Arabic-speaking users. You will receive a photo of a medicine box or blister pack. Your job is to READ what is printed on the packaging and explain it in very simple Arabic.

STRICT RULES:
1. Only use text you can actually see on the packaging for the medicine name, strength and active ingredient. NEVER guess or invent. If a part is unreadable, leave it empty and lower the confidence.
2. If the image is blurry, too dark, cropped, or not a medicine, set is_clear=false and write a short friendly Arabic message in retake_message telling the user how to retake the photo (more light, whole box visible, hold the phone steady).
3. If more than one different medicine is visible, set is_clear=false and ask the user to photograph one medicine at a time.
4. Copy the exact text you read from the box into evidence_text (the name, strength and active ingredient as printed). This is used to verify you did not guess.
5. Set confidence to 'high' only if the name and the active ingredient are both clearly printed and agree with each other. Use 'medium' if one is unclear. Use 'low' if you are mostly inferring.
6. General uses, usage guidance and warnings come from standard well-established medical knowledge about that active ingredient. Keep them general and safe. NEVER give exact doses, dose changes, or personal medical advice. If the box prints dosing instructions, you may mention that the box has them and tell the user to follow their doctor or pharmacist.
7. Mention only well-known, important warnings (for example: not suitable for pregnant women, interaction with alcohol, drowsiness, stomach irritation). Do not list rare side effects. Never invent a warning.
8. Always write in simple, short, warm Modern Standard Arabic suitable for elderly people. Avoid medical jargon. If a medical term is necessary, explain it in simple words.
9. The last warning must always remind the user to ask the doctor or pharmacist if unsure.
10. Return JSON only, matching the schema. No markdown, no extra text.
```

#### Exact JSON Schema Specification
```json
{
  "is_clear": boolean,
  "retake_message": string,
  "confidence": "high" | "medium" | "low",
  "evidence_text": string,
  "medicine_name_ar": string,
  "medicine_name_en": string,
  "active_ingredient": string,
  "uses": string[] (max 3 short items),
  "how_and_when": string[] (max 3 short items, e.g. before/after food, morning/evening, only if standard),
  "warnings": string[] (max 4 short items),
  "audio_summary": string (3 to 4 short sentences, spoken style, simple Arabic: name, what it is for, when to take it, and a reminder to ask the doctor)
}
```

#### Detailed Field Semantics & Constraints
1. `is_clear` (boolean): `true` if packaging is legible, contains a single medication, and can be analyzed. `false` if blurry, dark, cropped, non-medicine, or multiple medicines.
2. `retake_message` (string): Friendly, actionable Arabic instructions explaining how to retake the photo when `is_clear` is `false`. Empty string when `is_clear` is `true`.
3. `confidence` (enum: `"high" | "medium" | "low"`):
   - `"high"`: Both medicine name and active ingredient are clearly visible and consistent.
   - `"medium"`: One of name or active ingredient is partially unreadable or inferred.
   - `"low"`: Low certainty or largely inferred.
4. `evidence_text` (string): Exact verbatim text read directly off the box (name, strength, active ingredient). Used by the client to verify no hallucination occurred.
5. `medicine_name_ar` (string): Medicine name transliterated/translated into standard Arabic.
6. `medicine_name_en` (string): Full English trade name, strength, and pharmaceutical form as printed (e.g. "Panadol Extra 500mg/65mg Tablets").
7. `active_ingredient` (string): Active chemical compound(s) in simple Arabic (e.g. "باراسيتامول وكافيين").
8. `uses` (array of strings, max 3 items): Common, simplified therapeutic indications in Arabic bullet points.
9. `how_and_when` (array of strings, max 3 items): Standard administration timing (e.g. after food, morning/evening). No exact prescription dosages.
10. `warnings` (array of strings, max 4 items): Essential precautions (pregnancy, drowsiness, alcohol). The last item MUST be: reminder to consult doctor or pharmacist if unsure.
11. `audio_summary` (string): 3–4 sentences in warm, spoken Modern Standard Arabic for voice readout (`speechSynthesis` / native TTS).

---

### 4.7. Client Guardrails Specification

The client data parser and display controller must enforce five sequential validation tiers before any medication information is presented to the user:

```
[Raw Model Response]
        │
        ▼
[Tier 1: Markdown Strip & Outer Brace Slicing]
        │
        ▼
[Tier 2: JSON Parsing & Type Coercion]
        │
        ▼
[Tier 3: `is_clear` Validation] ─── (false) ───► [Display Retake Screen with `retake_message`]
        │ (true)
        ▼
[Tier 4: `evidence_text` Check] ─── (empty) ───► Coerce `confidence = 'low'`
        │
        ▼
[Tier 5: `confidence` Check] ────── ('low') ───► [Display Retake Screen (Suppress Details)]
        │ ('high' | 'medium')
        ▼
[Tier 6: Item Limits Clamping]
  • uses <= 3
  • how_and_when <= 3
  • warnings <= 4
        │
        ▼
[Render Medicine Confirmation & Result Cards]
```

#### TypeScript Interface Contract (`src/types/index.ts`)
```typescript
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface MedicineAnalysisResult {
  is_clear: boolean;
  retake_message?: string;
  confidence?: ConfidenceLevel;
  evidence_text?: string;
  medicine_name_ar?: string;
  medicine_name_en?: string;
  active_ingredient?: string;
  uses?: string[];
  how_and_when?: string[];
  warnings?: string[];
  audio_summary?: string;
  raw_error?: string;
}
```

#### Implementation Rules for `cleanAndParseJson(rawText: string)`:
1. **Markdown Fence Stripping**:
   ```typescript
   let cleaned = rawText.trim();
   const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
   const match = cleaned.match(markdownRegex);
   if (match && match[1]) {
     cleaned = match[1].trim();
   }
   const startBrace = cleaned.indexOf('{');
   const endBrace = cleaned.lastIndexOf('}');
   if (startBrace !== -1 && endBrace !== -1 && endBrace > startBrace) {
     cleaned = cleaned.slice(startBrace, endBrace + 1);
   }
   ```
2. **Evidence Text & Confidence Downgrade**:
   ```typescript
   let confidence: ConfidenceLevel = (['high', 'medium', 'low'].includes(parsed.confidence)
     ? parsed.confidence
     : 'low') as ConfidenceLevel;

   const evidenceText = typeof parsed.evidence_text === 'string' ? parsed.evidence_text.trim() : '';
   if (!evidenceText) {
     confidence = 'low';
   }
   ```
3. **Item Clamping**:
   ```typescript
   const uses = normalizeArray(parsed.uses).slice(0, 3);
   const howAndWhen = normalizeArray(parsed.how_and_when).slice(0, 3);
   const warnings = normalizeArray(parsed.warnings).slice(0, 4);
   ```

---

## 5. Verification Matrix

| Area | Component | Verification Command / Method | Success Criteria |
|------|-----------|-------------------------------|------------------|
| R1 Backend | Handler unit tests | `npm.cmd run test -- tests/apiAnalyze.test.ts` | 100% pass on rate-limit, payload size check, and error responses |
| R1 Backend | Zero secrets in client | `git grep -i "AIzaSy" src/` & `npm.cmd run build && grep -rn "AIzaSy" dist/` | Exactly 0 occurrences |
| R1 Backend | Vercel config | Inspect `vercel.json` | Valid JSON, `regions: ["fra1"]`, `maxDuration: 30` |
| R5 Prompt | Verbatim prompt | Vitest regex/string match | Exact match with lines 117–129 of ORIGINAL_REQUEST.md |
| R5 Schema | Schema parser tests | `npm.cmd run test -- tests/geminiParser.test.ts` | Validates all 11 fields, enum constraints, and item limits |
| R5 Guardrails | Unclear photo | Unit test with `is_clear: false` | Retake message returned, cards suppressed |
| R5 Guardrails | Empty evidence | Unit test with `evidence_text: ""` | Confidence coerced to "low" |
| R5 Guardrails | Low confidence | Unit test with `confidence: "low"` | Details suppressed, retake triggered |
| Build | TypeScript & Vite | `npm.cmd run build` | Clean build with zero TypeScript or bundling errors |
