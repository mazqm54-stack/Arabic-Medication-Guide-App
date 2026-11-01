# Technical Specification Survey: Prescription Reading Flow (R2), Cloudflare Worker Integration, and Unclear Photo Handling (R3)

**Author**: Survey Spec Miner 2 (Prescription & Worker Spec Miner)  
**Date**: 2026-10-31  
**Integrity Mode**: Production / Development  
**Authoritative Sources**:
- `ORIGINAL_REQUEST.md` (Requirements R2, R3, R4, R5)
- `worker/src/index.ts` & `worker/wrangler.toml` (Current Cloudflare Worker Implementation)
- `src/types/index.ts`, `src/services/geminiVision.ts`, `src/utils/imageProcessor.ts`, `src/components/UnclearPhotoCard.tsx`
- Upstream Google Gemini API specifications (`generateContent`, `thinkingConfig`, `responseSchema`)

---

## 1. Executive Summary

This specification mining report provides the complete, authoritative architectural and behavioral contract for implementing:
1. **Prescription Reading Flow (R2)**: End-to-end flow from image acquisition, tailored high-resolution compression (1600px, JPEG quality 0.8), Cloudflare Worker execution with `gemini-3.8-flash` (thinkingLevel LOW), schema validation, multi-item Arabic card presentation, low-confidence flagging, and text-based medicine details mode ("تفاصيل الدواء") with client caching.
2. **Cloudflare Worker Integration (R2)**: Dual route / mode architecture supporting box analysis, prescription analysis, and medicine details; model environment variables (`GEMINI_MODEL` and `GEMINI_MODEL_PRESCRIPTION`); 25s Worker abort signal paired with 30s client timeout; distinct error code categorization preventing misclassification of timeouts or server errors as unclear photos.
3. **Unclear Photos Handling (R3)**: Unified Arabic UX for both medicine box and prescription flows presenting 3 specific retake tips (lighting, framing, stability), a prominent "إعادة التصوير" button, and partial-clarity preservation for prescriptions.

---

## 2. Cloudflare Worker Architecture & API Route Evaluation

### 2.1 Current Worker Anatomy (`worker/src/index.ts`)

| Component | Current Implementation | Observations / Gaps |
|---|---|---|
| **Runtime & Interface** | Cloudflare Worker ES module (`fetch(request, env)`) | Target environment uses Node/V8 compatible Web standard APIs. |
| **Current Endpoints** | `GET /` & `GET /health`<br>`POST /` & `POST /api/analyze`<br>`OPTIONS *` | Only handles medicine box analysis. Rejects unsupported methods with 405. No prescription or details endpoints yet. |
| **Payload Size Limit** | `MAX_PAYLOAD_BYTES = 4 * 1024 * 1024` (4MB) | Evaluates `image.length > MAX_PAYLOAD_BYTES`. Correctly enforced with HTTP 413 `PAYLOAD_TOO_LARGE`. |
| **Rate Limiter** | Cloudflare `RATE_LIMITER` binding (10 req/min) + in-memory Map fallback (500 entries) | Blocks excessive requests with HTTP 429 `RATE_LIMIT_EXCEEDED` and `Retry-After: 60`. |
| **Upstream Fetch** | Direct REST call to `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}` | **Gap**: Currently lacks an `AbortController` timeout for the 25s upstream deadline. |
| **Model Config** | `env.GEMINI_MODEL \|\| 'gemini-3.8-flash'` | Reads `GEMINI_MODEL`. Normalizes `models/` prefix. **Gap**: Does not yet read `GEMINI_MODEL_PRESCRIPTION`. |
| **Thinking Config** | Automatically omitted for lite models, included as `{ thinkingLevel: 'LOW' }` for Gemini 3 | Tested with fallback if Gemini returns 400 with "thinking". |
| **Error Handling** | Sanitizes API keys, base64 strings, and tokens. Maps 400, 403, 429, 500, 503 to distinct error codes. | Error codes include: `UPSTREAM_LOCATION_RESTRICTED`, `UPSTREAM_OVERLOADED`, `UPSTREAM_RATE_LIMIT`, `UPSTREAM_BAD_REQUEST`, `UPSTREAM_API_ERROR`, `SERVER_CONFIGURATION_ERROR`. |

### 2.2 API Route Architecture Evaluation: Route vs Mode vs Hybrid

`ORIGINAL_REQUEST.md` (line 26) specifies:
> "Add prescription capability (via new route `/api/prescription` or a `mode` field, team decision) with strict system instruction and schema."

We evaluated three architectural options:

1. **Option A: Route-Only (`/api/prescription`, `/api/details`, `/api/analyze`)**
   - *Pros*: Follows standard REST resource partitioning.
   - *Cons*: On Android native APK or preview environments, `VITE_API_URL` is often set to the full Worker URL (e.g., `https://dalili-worker.subdomain.workers.dev/api/analyze` or `https://dalili-worker.subdomain.workers.dev`). If the client appends or substitutes paths naively, double slashes or missing subpaths can cause routing failures in client code.

2. **Option B: Mode-Only (`POST /api/analyze` with `{ mode: "prescription" | "box" | "details" }`)**
   - *Pros*: Single endpoint URL for all client requests; eliminates URL construction errors.
   - *Cons*: Cannot be routed or inspected at the CDN/firewall level by pathname without parsing the request body.

3. **Option C: Hybrid (Route AND Mode Supported — RECOMMENDED)**
   - *Specification*:
     - Route matching:
       - If `url.pathname.endsWith('/prescription') || body.mode === 'prescription'` -> **Prescription Analysis Mode**.
       - If `url.pathname.endsWith('/details') || body.mode === 'details'` -> **Medicine Details Mode**.
       - Otherwise (default) -> **Medicine Box Analysis Mode**.
   - *Justification*: Provides 100% backward compatibility with all existing tests and clients calling `/api/analyze`, supports modern RESTful URL calls, and provides foolproof handling if client uses `mode` in the JSON body.

### 2.3 Model Configuration Architecture

`ORIGINAL_REQUEST.md` (line 27) specifies:
> "Model configuration: Add env var `GEMINI_MODEL_PRESCRIPTION` (default `gemini-3.8-flash` with thinkingLevel LOW). Keep `GEMINI_MODEL` (fast model) for medicine boxes. Never hardcode model names."

#### Concrete Specification:
1. **`worker/wrangler.toml` updates**:
   ```toml
   [vars]
   GEMINI_MODEL = "gemini-3.5-flash-lite"
   GEMINI_MODEL_PRESCRIPTION = "gemini-3.8-flash"
   ```
2. **`worker/src/index.ts` Env Interface**:
   ```typescript
   export interface Env {
     GEMINI_API_KEY?: string;
     GEMINI_MODEL?: string;
     GEMINI_MODEL_PRESCRIPTION?: string;
     RATE_LIMITER?: {
       limit: (options: { key: string }) => Promise<{ success: boolean }>;
     };
   }
   ```
3. **Model Selection Logic**:
   - For **box mode**:
     ```typescript
     const rawModel = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
     const model = rawModel.replace(/^models\//, '');
     ```
   - For **prescription mode**:
     ```typescript
     const rawModel = env.GEMINI_MODEL_PRESCRIPTION || 'gemini-3.8-flash';
     const model = rawModel.replace(/^models\//, '');
     ```
   - For **details mode**:
     ```typescript
     // Details mode is fast text reasoning: use GEMINI_MODEL (or GEMINI_MODEL_PRESCRIPTION if needed, default to GEMINI_MODEL)
     const rawModel = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
     const model = rawModel.replace(/^models\//, '');
     ```
4. **ThinkingConfig Handling**:
   - For `gemini-3.8-flash` (prescription model):
     - Omit deprecated `temperature`.
     - Include `thinkingConfig: { thinkingLevel: 'LOW' }`.
     - Retain automatic fallback: if model returns HTTP 400 containing "thinking", retry without `thinkingConfig`.
   - For Flash-Lite models (`/lite/i.test(model)`):
     - Omit `thinkingConfig` completely to maximize throughput and minimize latency.

### 2.4 Worker 25s Abort & Client 30s Timeout Synchronization

`ORIGINAL_REQUEST.md` (line 28) specifies:
> "Enforce 25s abort in the Worker, 30s timeout in the client, and separate error codes (never turn a timeout or server error into 'image not clear')."

#### Synchronization Architecture:
```
Client Request (Timeout = 30,000ms)
   │
   ├──────> Cloudflare Worker (AbortSignal = 25,000ms)
   │           │
   │           ├──────> Google Gemini API
   │           │
   │           ├─[If Gemini takes > 25s] Worker Aborts Gemini Fetch!
   │           │   Worker returns HTTP 504 Gateway Timeout:
   │           │   {
   │           │     "is_clear": false,
   │           │     "error": "UPSTREAM_TIMEOUT",
   │           │     "error_code": "UPSTREAM_TIMEOUT",
   │           │     "retake_message": "استغرقت عملية التحليل وقتاً أطول من المتوقع في الخادم (25 ثانية). يرجى المحاولة مرة أخرى.",
   │           │     "detail": "Upstream Gemini call timed out after 25000ms"
   │           │   }
   │           ▼
   ├─[Client receives HTTP 504 at ~25.2s]
   │   Client maps error_code "UPSTREAM_TIMEOUT" or status 504 to:
   │   category: "network_timeout"
   │   Renders Network Timeout Screen (with Retry Button)
   │   CRITICAL: NEVER turns into "unclear_image" or retake screen!
   │
   └─[If network drop prevents Worker response reaching Client within 30s]
       Client's internal 30s timer triggers:
       Throws AnalysisError(category: "network_timeout", errorCode: "CLIENT_TIMEOUT")
       Renders Network Timeout Screen (with Retry Button)
```

#### Worker AbortController Implementation Contract:
```typescript
const workerAbortController = new AbortController();
const timeoutId = setTimeout(() => {
  workerAbortController.abort(new DOMException('Upstream Gemini timeout after 25s', 'TimeoutError'));
}, 25000);

try {
  let response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: workerAbortController.signal
  });
  // handle response
} catch (fetchErr: any) {
  if (fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError' || workerAbortController.signal.aborted) {
    return jsonResponse(
      {
        is_clear: false,
        retake_message: 'استغرقت عملية التحليل وقتاً أطول من المتوقع في الخادم (25 ثانية). يرجى المحاولة مرة أخرى.',
        error: 'UPSTREAM_TIMEOUT',
        error_code: 'UPSTREAM_TIMEOUT',
        upstream_status: 504,
        detail: 'Upstream Gemini request timed out after 25 seconds'
      },
      504
    );
  }
  throw fetchErr;
} finally {
  clearTimeout(timeoutId);
}
```

### 2.5 Image Payload Sizing and Worker Limits

| Metric | Medicine Box Photo | Prescription Photo | Cloudflare Worker Limit | Headroom / Margin |
|---|---|---|---|---|
| **Max Longest Dimension** | 1024px | **1600px** | N/A | Preserves fine cursive handwriting and numbers |
| **JPEG Quality** | 0.70 (or 0.75) | **0.80** | N/A | Prevents high-frequency ringing around pen strokes |
| **Expected File Size** | 80KB – 220KB | **350KB – 950KB** | Max 4MB (`MAX_PAYLOAD_BYTES`) | Over 4x headroom beneath 4MB limit |
| **Base64 String Length** | ~110,000 – 300,000 chars | **~470,000 – 1,300,000 chars** | 4,194,304 chars | Well within limit |
| **Worker Enforcement** | `image.length > 4 * 1024 * 1024` -> HTTP 413 | Same | 4MB | Guaranteed safe |

---

## 3. Prescription Analysis: Prompt Engineering, Strict Rules & JSON Schema

### 3.1 Strict System Instruction Rules Verification

`ORIGINAL_REQUEST.md` (lines 29–34) mandates 5 strict rules:
1. **Rule 1**: Only read what is actually written. NEVER guess a medicine name from partial or unclear letters. If a line is unclear, mark it low confidence and leave the name empty or exactly as visible.
2. **Rule 2**: If the whole image is blurry, dark, cropped, or not a prescription, set `is_clear=false` with a friendly Arabic `retake_message` (more light, whole page visible, hold steady).
3. **Rule 3**: Copy what the doctor wrote about dose, frequency, or duration EXACTLY into `written_instructions`. Never invent or complete instructions. If nothing is written, leave it empty.
4. **Rule 4**: For each readable medicine give a one-sentence simple Arabic explanation of what it is generally used for. For low-confidence items give no explanation.
5. **Rule 5**: Maximum 10 items. Simple, warm Modern Standard Arabic for elderly people. JSON only.

### 3.2 Authoritative Prescription System Prompt

```typescript
export const PRESCRIPTION_SYSTEM_PROMPT = `You are an expert medical pharmacist assistant for elderly Arabic-speaking users. You will receive a photo of a doctor's medical prescription (روشتة طبية). Your job is to READ what the doctor wrote with extreme accuracy, care, and safety.

STRICT RULES:
1. Read ONLY what is actually written on the prescription. NEVER guess or invent a medicine name from partial or unclear letters. If a line or medicine name is unclear or illegible, set confidence to 'low' and leave medicine_name_ar / medicine_name_en empty or write only the exact letters you can distinctly see.
2. If the entire image is blurry, too dark, cropped, unreadable, or is NOT a medical prescription, set is_clear=false, set confidence='low', leave items as an empty array [], and write a warm, friendly Arabic retake_message guiding the user on how to retake the photo (good lighting, whole paper visible without cropping, hold phone steady).
3. Copy what the doctor wrote regarding dosage, frequency, or duration EXACTLY into written_instructions (e.g. "قرص بعد الغداء", "1x3", "لمدة 5 أيام"). NEVER invent, assume, or complete instructions. If the doctor wrote no instructions for that item, leave written_instructions as an empty string "".
4. For each readable medicine (confidence 'high' or 'medium'), provide a one-sentence, very simple Arabic explanation of what this medicine is generally used for in short_explanation (e.g. "مسكن للآلام وخافض للحرارة"). For low-confidence items, you MUST leave short_explanation as an empty string "".
5. Extract a maximum of 10 items.
6. Copy the exact text of each line as written into line_text_as_written.
7. Set item confidence:
   - 'high': The medicine name and instructions are clearly readable.
   - 'medium': The medicine name is readable with reasonable confidence but part of the instructions is faint.
   - 'low': The medicine name or handwriting is unclear, faint, or ambiguous.
8. audio_summary must provide a warm, respectful Arabic read-aloud summary for elderly users listing the identified medicines in simple spoken Modern Standard Arabic.
9. Always write in simple, warm, clear Modern Standard Arabic suitable for elderly patients. Avoid complex jargon.
10. Return JSON only, strictly matching the schema. No markdown, no extra commentary.`;
```

### 3.3 Authoritative Prescription JSON Schema

```typescript
export const PRESCRIPTION_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_clear: { type: 'BOOLEAN' },
    retake_message: { type: 'STRING' },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
    evidence_text: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          line_text_as_written: { type: 'STRING' },
          medicine_name_ar: { type: 'STRING' },
          medicine_name_en: { type: 'STRING' },
          active_ingredient: { type: 'STRING' },
          confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
          written_instructions: { type: 'STRING' },
          short_explanation: { type: 'STRING' }
        },
        required: [
          'line_text_as_written',
          'medicine_name_ar',
          'medicine_name_en',
          'active_ingredient',
          'confidence',
          'written_instructions',
          'short_explanation'
        ]
      }
    },
    audio_summary: { type: 'STRING' }
  },
  required: [
    'is_clear',
    'retake_message',
    'confidence',
    'evidence_text',
    'items',
    'audio_summary'
  ]
};
```

### 3.4 Data Models & TypeScript Types

```typescript
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface PrescriptionItem {
  line_text_as_written: string;
  medicine_name_ar: string;
  medicine_name_en: string;
  active_ingredient: string;
  confidence: ConfidenceLevel;
  written_instructions: string;
  short_explanation: string;
}

export interface PrescriptionAnalysisResult {
  is_clear: boolean;
  retake_message: string;
  confidence: ConfidenceLevel;
  evidence_text: string;
  items: PrescriptionItem[];
  audio_summary: string;
  raw_error?: string;
  error_category?: ErrorCategory;
  error_code?: string;
  error_detail?: string;
}
```

---

## 4. Worker Text Details Mode ("تفاصيل الدواء")

`ORIGINAL_REQUEST.md` (line 43) specifies:
> "Add a Worker mode 'details' that takes the medicine name as text (no image) and returns the box-result schema. Cache details by medicine name. Add 'أضف لأدويتي' on each item."

### 4.1 Details Mode Request & Response Contract

- **Endpoint**: `POST /api/details` or `POST /api/analyze` with `{ mode: "details", medicine_name: string }`
- **Request Body**:
  ```json
  {
    "mode": "details",
    "medicine_name": "بانادول إكسترا"
  }
  ```
- **Validation**:
  - If `medicine_name` is missing or empty -> HTTP 400 `BAD_REQUEST` with Arabic message:
    `"يرجى إرسال اسم الدواء لعرض التفاصيل."`
- **Upstream Gemini Request**:
  - Model: `GEMINI_MODEL` (e.g. `gemini-3.5-flash-lite` or `gemini-3.8-flash`)
  - No image attachment needed.
  - User prompt:
    `"Provide detailed pharmaceutical information in simple Arabic for the medicine: {medicine_name}."`
  - Output Schema: The exact same `GEMINI_RESPONSE_SCHEMA` (including R4 `how_and_when` common usage, `uses`, `warnings`, `active_ingredient`, `audio_summary`).

### 4.2 Details Mode System Instruction

```typescript
export const MEDICINE_DETAILS_SYSTEM_PROMPT = `You are an expert pharmacist assistant for elderly Arabic-speaking users. The user will provide a medicine name. Your job is to return standard, safe pharmaceutical details for this medication in very simple Modern Standard Arabic.

STRICT RULES:
1. Provide accurate Arabic and English trade names and the active ingredient.
2. uses: 2 to 3 well-established primary uses.
3. how_and_when: 2 to 3 short items about the COMMON general usage (timing such as before/after food, typical frequency). Do NOT include exact mg/ml amounts or personal medical advice.
4. warnings: 2 to 3 important safety warnings (e.g. pregnancy, liver/kidney precautions, drowsiness). The last warning must remind the user to ask the doctor or pharmacist if unsure.
5. audio_summary: A simple, warm spoken summary of the medicine, its purpose, and common usage.
6. Set is_clear=true, confidence='high', evidence_text='Verified database details for ' + medicine_name.
7. Return JSON only matching the schema.`;
```

### 4.3 Client-Side Caching Architecture

1. **Storage Mechanism**: `localStorage` with prefix `dalili_med_details_v1_` (or an in-memory Map backed by `localStorage`).
2. **Cache Key Normalization**:
   ```typescript
   export function normalizeMedicineKey(name: string): string {
     return name
       .trim()
       .toLowerCase()
       .replace(/[\u064B-\u065F\u0670]/g, '') // strip Arabic diacritics / tashkeel
       .replace(/[أإآ]/g, 'ا')
       .replace(/ة/g, 'ه')
       .replace(/ى/g, 'ي')
       .replace(/\s+/g, '_');
   }
   ```
3. **Cache Invalidation & Freshness**:
   - Medication information is static scientific knowledge; cache indefinitely or with 30-day TTL.
   - On cache hit: Return cached `MedicineAnalysisResult` immediately (0ms network latency).
   - On cache miss: Call Worker mode `"details"`, store in cache upon HTTP 200, then return.

### 4.4 "أضف لأدويتي" (Add to My Medications) Integration

- Each item in the prescription view has an "أضف لأدويتي" button.
- When tapped:
  - If details are already loaded or cached, saves to `myMedicationsStorage` (persisted in `localStorage` under `dalili_my_medications_list`).
  - If details are not yet fetched, fetches details via `fetchMedicineDetails(item.medicine_name_ar || item.medicine_name_en)` and saves.
  - Displays a brief toast or checkmark: `"تمت الإضافة إلى قائمة أدويتي بنجاح"`.

---

## 5. Client Prescription Flow Specifications (UI/UX & Logic)

### 5.1 Tab "الروشتة" Layout & Entry Points

- Positioned as Tab 4 in the 5-tab RTL Bottom Navigation:
  `[الرئيسية (Home)] [أدويتي (My Meds)] [CAMERA (صوّر)] [الروشتة (Prescription)] [السجل (History)]`
- Screen Header:
  - Title: "قراءة الروشتة الطبية"
  - Subtitle: "صوّر الروشتة وسنقوم بقراءة أسماء الأدوية المكتوبة وتعليمات الطبيب"
- Primary Buttons:
  1. **"صوّر الروشتة" (Camera Button)**:
     - Prominent large teal button (`min-h-[76px]`, icon `Camera` 32px, text 22px bold).
     - Triggers native rear camera via `@capacitor/camera` (`CameraSource.Camera`).
     - Passes photo to high-resolution compression.
  2. **"اختيار من الألبوم" (Gallery Picker Button)**:
     - Secondary button (`min-h-[64px]`, icon `Image` 28px, text 18px bold).
     - Triggers native gallery picker via `@capacitor/camera` (`CameraSource.Photos`).

### 5.2 Image Compression Pipeline Specifications

| Parameter | Box Photo (`processAndValidateImage`) | Prescription Photo (`processAndValidatePrescriptionImage`) |
|---|---|---|
| **Max Longest Dimension** | 1024px | **1600px** |
| **JPEG Quality** | 0.70 (or 0.75) | **0.80** |
| **Backdrop** | Solid `#FFFFFF` | Solid `#FFFFFF` (eliminates Android WebView transparency bugs) |
| **Pixel Verification** | 10x10 grid non-black & non-blank check | 10x10 grid non-black & non-blank check |
| **Output Type** | `ProcessedImage` (base64, mimeType, width, height, sizeBytes) | `ProcessedImage` |

### 5.3 Client-Side Validation Rules

```
Receive Worker Response
       │
       ├─► HTTP Error (4xx, 5xx) -> Throw AnalysisError with specific category & error_code
       │
       ▼
Parse JSON
       │
       ├─► If is_clear === false -> Render UnclearPhotoCard (Retake Screen) with 3 tips
       │
       ├─► If is_clear === true BUT (!items || items.length === 0)
       │       Route to Retake Screen with message:
       │       "لم نتمكن من العثور على أدوية واضحة في الروشتة. يرجى التأكد من تصوير كامل الروشتة بوضوح."
       │
       ▼
Valid Prescription Result (is_clear === true && items.length > 0)
       │
       ├─► Render Top Advisory Banner: "راجع أسماء الأدوية قبل الاعتماد"
       ├─► Render Medical Disclaimer Banner
       ├─► Render "استمع للروشتة كاملة" Read-Aloud Button
       ├─► Render List of Medicine Cards (Readable & Low-Confidence)
       └─► Save to Prescription History
```

### 5.4 Card Layout for Prescription Results

1. **Top Advisory Banner**:
   - Background: Soft amber/yellow (`bg-amber-50`, `border-2 border-amber-400`).
   - Icon: `AlertCircle` (24px).
   - Text: `"⚠️ تنبيه طبي: خط يد الأطباء قد يكون غير واضح أحياناً. يرجى مراجعة أسماء الأدوية مع الصيدلي قبل تناول أي دواء."`
   - Subtext: `"راجع أسماء الأدوية قبل الاعتماد"` (Bold 18px+).

2. **Readable Medicine Card (Confidence 'high' or 'medium')**:
   - Card container: Large rounded (`rounded-3xl`), border teal (`border-2 border-teal-500`), white background, shadow.
   - Header:
     - Medicine Name in Arabic (`medicine_name_ar`) in 24px+ bold teal text.
     - English Name & Strength (`medicine_name_en`) in 18px font-mono.
     - Confidence Badge: Green pill `"واضح"` (High) or Blue pill `"متوسط"` (Medium).
   - One-Line Purpose:
     - `"الاستخدام: " + item.short_explanation` (e.g. "مسكن للآلام ومضاد للالتهاب").
   - Doctor's Written Instructions Box ("ما كتبه الطبيب"):
     - Styled box with distinct background (`bg-slate-100`, `border border-slate-300`, `rounded-2xl`, `p-3`).
     - Header: `"📝 ما كتبه الطبيب:"`.
     - Content: `item.written_instructions` (e.g. `"قرص بعد الإفطار والعشاء لمدة أسبوع"`). If empty, shows `"لم تُذكر تعليمات خاصة على الروشتة"`.
   - Card Actions:
     - Tap anywhere on card -> Opens "تفاصيل الدواء" page (the 4 cards view).
     - Button: `"➕ أضف لأدويتي"`.

3. **Low-Confidence Medicine Card (Confidence 'low')**:
   - Card container: Soft amber card (`bg-amber-50`, `border-2 border-amber-300`, `rounded-3xl`, `p-5`).
   - Header: Amber alert icon + `"دواء غير واضح، اسأل الصيدلي"`.
   - Content:
     - Shows line as written: `"النص الظاهر: " + item.line_text_as_written`.
     - NO AI-generated usage explanation (strictly empty, no guessing).
     - Advisory text: `"لم يستطع المساعد قراءة هذا السطر بدقة كافية حرصاً على سلامتكم. اسأل الصيدلي عند صرف الروشتة."`.

4. **Prescription Audio Summary Button**:
   - Button: `"🔊 استمع للروشتة كاملة"`.
   - Plays `audio_summary` using `speechController.speak(...)`.

---

## 6. R3 Unclear Photos Handling Specifications

`ORIGINAL_REQUEST.md` (lines 45–48) specifies:
> "- Both medicine box and prescription flows: Provide a friendly Arabic message with 3 short retake tips and a big 'إعادة التصوير' button.  
> - For prescriptions: If only some lines are unclear, still show the readable ones and mark the others as low confidence."

### 6.1 Unified 3 Arabic Retake Tips

Both the medicine box flow and prescription flow must display these 3 short, concrete retake tips:

1. **الإضاءة (Lighting)**:
   - Icon: `SunMedium` (amber-600)
   - Text: `"تأكد من وجود إضاءة كافية ومباشرة دون ظلال أو انعكاسات قوية."`
2. **الشمول والحدود (Framing)**:
   - Icon: `Scan` or `Maximize` (teal-600)
   - Text: `"اجعل كامل العلبة أو ورقة الروشتة ظاهرة بالكامل داخل الشاشة دون قص أي زاوية."`
3. **الثبات والتركيز (Focus & Steadiness)**:
   - Icon: `Focus` (blue-600)
   - Text: `"ثبّت يدك جيداً وانتظر حتى تصبح الكلمات واضحة تماماً قبل التقاط الصورة."`

### 6.2 The Big "إعادة التصوير" Action Button

- Button label: `"📷 إعادة التصوير الآن"` (or `"🔄 إعادة المحاولة"` for network/server errors).
- Minimum height: 64px (desktop) / 72px (mobile).
- Styling: Primary teal (`bg-teal-700 hover:bg-teal-800`), white bold text 22px+.
- Behavior:
  - For Box flow: Invokes native camera immediately or resets to camera view.
  - For Prescription flow: Invokes native camera for prescription or resets to prescription camera view.

### 6.3 Handling Partial Unclear Prescriptions

- When an image contains multiple handwritten lines, some may be legible and others illegible:
  - `is_clear` must be `true` as long as at least one item is recognized.
  - The readable items (high/medium confidence) are rendered with full details and explanations.
  - The unclear items (low confidence) are rendered in the soft amber card with `"غير واضح، اسأل الصيدلي"`.
  - The user can still proceed, add readable medicines to "أدويتي", and review details.

---

## 7. Features Discovered Table

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Worker Architecture | Hybrid Route/Mode Dispatch | Supports `/api/prescription`, `/api/details`, `/api/analyze` and `mode: "box" \| "prescription" \| "details"`. | HTTP Request (URL path and/or body `mode`) | Dispatches to correct prompt, schema, and model | Rejects invalid methods with 405 | ORIGINAL_REQUEST.md & `worker/src/index.ts` |
| 2 | Worker Architecture | `GEMINI_MODEL_PRESCRIPTION` Env Var | Environment variable configuring prescription model, defaulting to `gemini-3.8-flash`. | `env.GEMINI_MODEL_PRESCRIPTION` | Active model string without `models/` prefix | Falls back to `gemini-3.8-flash` if unset | ORIGINAL_REQUEST.md & `worker/wrangler.toml` |
| 3 | Worker Architecture | Worker 25s AbortController | Enforces 25s execution timeout on upstream Gemini fetch calls. | 25,000ms AbortSignal | Clean abort before edge or client timeout | Returns HTTP 504 with `UPSTREAM_TIMEOUT` | ORIGINAL_REQUEST.md & `tests/worker.test.ts` |
| 4 | Worker Architecture | Client 30s Timeout | Enforces 30s timeout on client fetch to Worker proxy. | 30,000ms timer | Aborts client fetch | Throws `AnalysisError` (`CLIENT_TIMEOUT`, `network_timeout`) | ORIGINAL_REQUEST.md & `src/services/geminiVision.ts` |
| 5 | Worker Architecture | Distinct Error Categorization | Prevents timeouts and server errors from ever mapping to "image not clear". | HTTP status code and `error_code` from Worker | ErrorCategory (`network_timeout`, `server_error`, `unclear_image`, `invalid_json`) | Renders dedicated UI screen per error category | ORIGINAL_REQUEST.md & `src/components/UnclearPhotoCard.tsx` |
| 6 | Prescription Spec | 5 Strict Prescription Rules | Enforces zero guessing, exact instructions, general use for readable items, max 10 items. | Prescription image payload | Verbatim extraction without hallucinations | Low confidence or `is_clear: false` | ORIGINAL_REQUEST.md Requirement R2 |
| 7 | Prescription Spec | Prescription JSON Schema | Validates `{ is_clear, retake_message, confidence, evidence_text, items, audio_summary }`. | Gemini model output text | Validated structured JSON object | Returns `error_code: 'INVALID_JSON'` if schema broken | ORIGINAL_REQUEST.md Requirement R2 |
| 8 | Image Processing | High-Res Compression (1600px @ 0.8) | Preserves fine cursive medical handwriting without exceeding 4MB Worker cap. | Raw image File or Blob | Base64 JPEG (max 1600px, quality 0.8, ~500KB) | Rejects dark/blank frames | ORIGINAL_REQUEST.md & `src/utils/imageProcessor.ts` |
| 9 | Client Flow | Empty Items Validation | Routes result with `is_clear: true` but `items: []` to retake screen. | `result.items` array | Navigates to retake screen | Prompts user to retake complete prescription | ORIGINAL_REQUEST.md Requirement R2 |
| 10 | Client Flow | Top Advisory Banner | Displays `"راجع أسماء الأدوية قبل الاعتماد"` prominently above prescription list. | None | Sticky / static prominent warning banner | Always rendered on prescription result | ORIGINAL_REQUEST.md Requirement R2 |
| 11 | Client Flow | Low Confidence Amber Cards | Renders illegible prescription lines as `"غير واضح، اسأل الصيدلي"` with zero AI explanation. | Item with `confidence: 'low'` | Soft amber UI card without explanation | Prevents harmful medical misinformation | ORIGINAL_REQUEST.md Requirement R2 |
| 12 | Client Flow | "ما كتبه الطبيب" Box | Displays doctor's exact instructions verbatim in dedicated styled box. | `item.written_instructions` | Styled card block | Empty message if doctor wrote nothing | ORIGINAL_REQUEST.md Requirement R2 |
| 13 | Details Mode | Text-Based Medicine Lookup | Worker mode `"details"` returning full 4-card box schema for a given medicine name. | `{ mode: 'details', medicine_name: string }` | Full `MedicineAnalysisResult` | HTTP 400 if name is empty | ORIGINAL_REQUEST.md Requirement R2 |
| 14 | Details Mode | Client Caching by Medicine Name | Stores fetched medicine details in `localStorage` by normalized name. | Normalized medicine name | Instant cached result on subsequent taps | Fetches from Worker on cache miss | ORIGINAL_REQUEST.md Requirement R2 |
| 15 | Details Mode | "أضف لأدويتي" Action | Adds prescription item to patient's saved medications list. | Prescription item details | Persisted in `myMedicationsStorage` | Visual confirmation toast / checkmark | ORIGINAL_REQUEST.md Requirement R2 |
| 16 | Unclear Handling | 3 Arabic Retake Tips | Explicit guidance on lighting, full framing, and phone steadiness. | `is_clear === false` | 3 structured bullet cards with distinct icons | Displayed on both Box and Prescription retakes | ORIGINAL_REQUEST.md Requirement R3 |
| 17 | Unclear Handling | Big "إعادة التصوير" Button | Massive 64px+ touch target button initiating immediate photo recapture. | Click / tap event | Triggers camera or resets view | Accessible with screen readers and haptic feedback | ORIGINAL_REQUEST.md Requirement R3 |
| 18 | Unclear Handling | Partial Unclear Prescription | Legible items shown normally; illegible items flagged as low confidence. | Multi-line prescription image | Mixed item list (standard cards + amber cards) | User can still proceed with readable medicines | ORIGINAL_REQUEST.md Requirement R3 |

---

## 8. Edge Cases & Observed Behavior

| # | Feature | Input / Condition | Observed / Required Behavior |
|---|---|---|---|
| 1 | Image Sizing | Prescription photo with 4000x3000px native camera capture | Scaled down to 1600x1200px preserving aspect ratio; compressed to JPEG quality 0.8; base64 payload size ~650KB (well under 4MB limit). |
| 2 | Worker Timeout | Gemini API takes 26 seconds to generate response | Worker's 25s AbortController fires at 25,000ms; fetch is aborted; Worker immediately returns HTTP 504 `UPSTREAM_TIMEOUT`; Client maps to `network_timeout` (not `unclear_image`). |
| 3 | Client Timeout | Network latency / dropped connection prevents Worker response reaching Client within 30s | Client's 30s timer fires; throws `AnalysisError` (`CLIENT_TIMEOUT`); UI displays network timeout retry card with "🔄 إعادة المحاولة الآن". |
| 4 | Prescription Parsing | Whole photo is a blurred doctor's signature or random document | Worker returns `is_clear: false`, `retake_message` in Arabic, `items: []`. Client renders Unclear Photo Card with 3 tips. |
| 5 | Prescription Parsing | Gemini returns `is_clear: true` but hallucinated 0 items (`items: []`) | Client validation catches empty items; treats as unclear photo; routes to retake screen. |
| 6 | Doctor Instructions | Doctor wrote "1x3 بعد الأكل" for Item 1 and nothing for Item 2 | Item 1 displays "ما كتبه الطبيب: 1x3 بعد الأكل"; Item 2 displays "ما كتبه الطبيب: لم تُذكر تعليمات خاصة على الروشتة". |
| 7 | Unclear Line | One line has illegible scribbles | Item extracted with `confidence: 'low'`, `line_text_as_written` with visible letters, `short_explanation: ""`. Client renders soft amber card: "غير واضح، اسأل الصيدلي". |
| 8 | Details Mode | User taps a prescription medicine card twice | First tap: calls `/api/details`, caches in `localStorage`. Second tap: returns immediately from cache in 0ms without network call. |
| 9 | Details Mode | User enters medicine name with Arabic diacritics (e.g. "بَانَادُول") | Normalizer strips diacritics to "بانادول", matching the existing cached entry. |
| 10 | Upstream 503 | Gemini API overloaded during prescription reading | Worker catches 503; returns HTTP 503 `UPSTREAM_OVERLOADED`; Client shows server error card with error code badge and retry button. Does NOT show "photo unclear". |
| 11 | Pitch Black Capture | User accidentally covers lens while photographing prescription | Client image processor 10x10 grid check detects average luminance < 5; rejects immediately before network call with Arabic alert. |
| 12 | Huge Prescription List | Prescription has 14 medicines written | Model enforces Rule 5 (max 10 items); outputs top 10 items cleanly without truncated JSON. |

---

## 9. Concrete Implementation Checklist for Engineering Team

### Phase 1: Worker Updates (`worker/`)
- [ ] Add `GEMINI_MODEL_PRESCRIPTION = "gemini-3.8-flash"` to `worker/wrangler.toml` under `[vars]`.
- [ ] Update `worker/src/index.ts`:
  - [ ] Add `GEMINI_MODEL_PRESCRIPTION?: string` to `Env` interface.
  - [ ] Add `PRESCRIPTION_SYSTEM_PROMPT` and `PRESCRIPTION_RESPONSE_SCHEMA`.
  - [ ] Add `MEDICINE_DETAILS_SYSTEM_PROMPT`.
  - [ ] Implement 25s `AbortController` timeout for upstream Gemini `fetch()`.
  - [ ] Add Hybrid routing: check `url.pathname` and `body.mode` for `'prescription'`, `'details'`, or `'box'`.
  - [ ] Map 25s timeout to HTTP 504 `UPSTREAM_TIMEOUT`.
  - [ ] Preserve all existing sanitization, CORS, and rate limiting logic.

### Phase 2: Client Types & Services (`src/types/`, `src/services/`, `src/utils/`)
- [ ] In `src/types/index.ts`: Add `PrescriptionItem`, `PrescriptionAnalysisResult`, and `ConfidenceLevel`.
- [ ] In `src/utils/imageProcessor.ts`:
  - [ ] Export `processAndValidatePrescriptionImage(file)` with max 1600px and JPEG quality 0.8.
  - [ ] Keep 1024px / 0.7 for `processAndValidateImage` (box photos).
- [ ] In `src/services/geminiVision.ts`:
  - [ ] Add `analyzePrescriptionImage({ imageBase64, mimeType, timeoutMs })`.
  - [ ] Add `fetchMedicineDetails(medicineName: string)`.
  - [ ] Enforce client-side caching of medicine details in `localStorage`.
- [ ] In `src/components/UnclearPhotoCard.tsx`:
  - [ ] Update to render the 3 standardized Arabic tips (lighting, framing, steadiness).
  - [ ] Ensure button label says `"📷 إعادة التصوير الآن"`.

### Phase 3: Prescription UI Components
- [ ] Create `src/components/PrescriptionTab.tsx` (or integrate into tab router):
  - [ ] Camera and Gallery action buttons.
  - [ ] Empty items routing to retake screen.
  - [ ] Top advisory banner `"راجع أسماء الأدوية قبل الاعتماد"`.
  - [ ] Whole prescription read-aloud button (`audio_summary`).
  - [ ] Medicine cards list (readable vs soft amber low-confidence cards).
  - [ ] "ما كتبه الطبيب" box rendering.
  - [ ] Tapping card opens "تفاصيل الدواء" page.
  - [ ] "أضف لأدويتي" action per item.
