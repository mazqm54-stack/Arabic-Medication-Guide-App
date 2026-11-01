export interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_MODEL_PRESCRIPTION?: string;
  RATE_LIMITER?: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
}

const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024; // 4MB
const IN_MEMORY_RATE_LIMIT_WINDOW = 60 * 1000; // 60 Seconds (1 Minute)
const IN_MEMORY_RATE_LIMIT_MAX = 10; // 10 requests per minute

export const fallbackRateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkFallbackRateLimit(ip: string): boolean {
  const now = Date.now();
  if (fallbackRateLimitMap.size > 500) {
    for (const [key, record] of fallbackRateLimitMap.entries()) {
      if (now > record.resetTime) {
        fallbackRateLimitMap.delete(key);
      }
    }
  }

  let record = fallbackRateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    fallbackRateLimitMap.set(ip, { count: 1, resetTime: now + IN_MEMORY_RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= IN_MEMORY_RATE_LIMIT_MAX) {
    return false;
  }

  record.count += 1;
  return true;
}

export const PHARMACIST_SYSTEM_PROMPT = `You are an expert pharmacist assistant for elderly Arabic-speaking users. You will receive a photo of a medicine box or blister pack. Your job is to READ what is printed on the packaging and explain it in very simple Arabic.

STRICT RULES:
1. Only use text you can actually see on the packaging for the medicine name, strength and active ingredient. NEVER guess or invent. If a part is unreadable, leave it empty and lower the confidence.
2. If the image is blurry, too dark, cropped, or not a medicine, set is_clear=false and write a short friendly Arabic message in retake_message telling the user how to retake the photo (more light, whole box visible, hold the phone steady).
3. If more than one different medicine is visible, set is_clear=false and ask the user to photograph one medicine at a time.
4. Copy the exact text you read from the box into evidence_text (the name, strength and active ingredient as printed). This is used to verify you did not guess.
5. Set confidence to 'high' only if the name and the active ingredient are both clearly printed and agree with each other. Use 'medium' if one is unclear. Use 'low' if you are mostly inferring.
6. how_and_when must NEVER be empty and must not just say follow the doctor. If the packaging prints instructions, include them and set usage_source='printed'. Otherwise, provide 2 to 3 short items about the COMMON general usage of that active ingredient (timing such as before/after food, and typical frequency in general words without exact doses) and set usage_source='common'. NEVER give exact mg or ml amounts, exact doses, or personal medical advice.
7. Mention only well-known, important warnings (for example: not suitable for pregnant women, interaction with alcohol, drowsiness, stomach irritation). Do not list rare side effects. Never invent a warning.
8. Always write in simple, short, warm Modern Standard Arabic suitable for elderly people. Avoid medical jargon. If a medical term is necessary, explain it in simple words.
9. The last warning must always remind the user to ask the doctor or pharmacist if unsure.
10. Return JSON only, matching the schema. No markdown, no extra text.`;

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

export const MEDICINE_DETAILS_SYSTEM_PROMPT = `You are an expert pharmacist assistant for elderly Arabic-speaking users. The user will provide a medicine name. Your job is to return standard, safe pharmaceutical details for this medication in very simple Modern Standard Arabic.

STRICT RULES:
1. Provide accurate Arabic and English trade names and the active ingredient.
2. uses: 2 to 3 well-established primary uses.
3. how_and_when: 2 to 3 short items about the COMMON general usage of that active ingredient (timing such as before/after food, typical frequency). Do NOT include exact mg/ml amounts or personal medical advice.
4. Set usage_source='common'.
5. warnings: 2 to 3 important safety warnings (e.g. pregnancy, liver/kidney precautions, drowsiness). The last warning must remind the user to ask the doctor or pharmacist if unsure.
6. audio_summary: A simple, warm spoken summary of the medicine, its purpose, and common usage in spoken Modern Standard Arabic.
7. Set is_clear=true, confidence='high', evidence_text='Verified database details for ' + medicine_name.
8. Return JSON only matching the schema. No markdown, no extra commentary.`;

export const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_clear: { type: 'BOOLEAN' },
    retake_message: { type: 'STRING' },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
    evidence_text: { type: 'STRING' },
    medicine_name_ar: { type: 'STRING' },
    medicine_name_en: { type: 'STRING' },
    active_ingredient: { type: 'STRING' },
    uses: { type: 'ARRAY', items: { type: 'STRING' } },
    how_and_when: { type: 'ARRAY', items: { type: 'STRING' } },
    usage_source: { type: 'STRING', enum: ['printed', 'common'] },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
    audio_summary: { type: 'STRING' }
  },
  required: [
    'is_clear',
    'retake_message',
    'confidence',
    'evidence_text',
    'medicine_name_ar',
    'medicine_name_en',
    'active_ingredient',
    'uses',
    'how_and_when',
    'usage_source',
    'warnings',
    'audio_summary'
  ]
};

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

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
      ...extraHeaders
    }
  });
}

export function cleanAndParseJsonText(rawText: string): any {
  if (!rawText || !rawText.trim()) return null;
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
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export function sanitizeMessage(msg: string): string {
  if (!msg) return '';
  return msg
    .replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED_KEY]')
    .replace(/AIza[0-9A-Za-z\-_]{35}/g, '[REDACTED_KEY]')
    .replace(/(x-goog-api-key\s*[:=]\s*)[^\r\n,;"'\s]+/gi, '$1[REDACTED_KEY]')
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\r\n,;"'\s]+/gi, '$1[REDACTED_TOKEN]')
    .replace(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/gi, 'data:image/[REDACTED_BASE64]')
    .replace(/("?(?:data|image|inlineData)"?\s*:\s*")[A-Za-z0-9+/=]{64,}(")/gi, '$1[REDACTED_BASE64]$2')
    .replace(/[A-Za-z0-9+/=]{80,}/g, '[REDACTED_PAYLOAD]')
    .slice(0, 300);
}

export function parseUpstreamError(rawText: string, status: number): { detail: string; isLocationBlocked: boolean } {
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Health check endpoint
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      const activeModel = (env.GEMINI_MODEL || 'gemini-3.5-flash-lite').replace(/^models\//, '');
      const prescriptionModel = (env.GEMINI_MODEL_PRESCRIPTION || 'gemini-3.8-flash').replace(/^models\//, '');
      return jsonResponse({
        status: 'ok',
        service: 'dalili-medication-guide-worker',
        model: activeModel,
        prescriptionModel: prescriptionModel,
        hasApiKey: Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim())
      });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return jsonResponse(
        {
          is_clear: false,
          retake_message: 'طريقة الطلب غير مدعومة. يرجى استخدام POST فقط.',
          error: 'METHOD_NOT_ALLOWED',
          error_code: 'METHOD_NOT_ALLOWED'
        },
        405,
        { Allow: 'POST, OPTIONS, GET' }
      );
    }

    // 1. Rate Limiting Check
    const clientIp = request.headers.get('cf-connecting-ip') || '127.0.0.1';
    let rateAllowed = true;

    if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === 'function') {
      try {
        const { success } = await env.RATE_LIMITER.limit({ key: clientIp });
        rateAllowed = success;
      } catch {
        rateAllowed = checkFallbackRateLimit(clientIp);
      }
    } else {
      rateAllowed = checkFallbackRateLimit(clientIp);
    }

    if (!rateAllowed) {
      return jsonResponse(
        {
          is_clear: false,
          retake_message: 'تم تجاوز حد الاستخدام المسموح (10 تحليلات في الدقيقة). يرجى الانتظار دقيقة قبل تصوير دواء آخر.',
          error: 'RATE_LIMIT_EXCEEDED',
          error_code: 'RATE_LIMIT_EXCEEDED'
        },
        429,
        { 'Retry-After': '60' }
      );
    }

    // 2. Parse and Validate Request Payload
    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        {
          is_clear: false,
          retake_message: 'صيغة الطلب غير صالحة. يرجى إرسال صورة علبة الدواء للمتابعة.',
          error: 'BAD_REQUEST',
          error_code: 'BAD_REQUEST'
        },
        400
      );
    }

    // Hybrid routing & mode support:
    // /prescription or body.mode === 'prescription' -> Prescription Analysis Mode
    // /details or body.mode === 'details' -> Medicine Details Mode
    // Otherwise -> Medicine Box Analysis Mode
    const isPrescription = url.pathname.endsWith('/prescription') || body?.mode === 'prescription';
    const isDetails = url.pathname.endsWith('/details') || body?.mode === 'details';
    const mode: 'prescription' | 'details' | 'box' = isPrescription
      ? 'prescription'
      : (isDetails ? 'details' : 'box');

    // Mode-specific input validation
    if (mode === 'details') {
      const medicineName = body?.medicine_name;
      if (!medicineName || typeof medicineName !== 'string' || !medicineName.trim()) {
        return jsonResponse(
          {
            is_clear: false,
            retake_message: 'يرجى إرسال اسم الدواء لعرض التفاصيل.',
            error: 'BAD_REQUEST',
            error_code: 'BAD_REQUEST'
          },
          400
        );
      }
    } else {
      const { image } = body || {};
      if (!image || typeof image !== 'string' || !image.trim()) {
        return jsonResponse(
          {
            is_clear: false,
            retake_message: isPrescription
              ? 'لم يتم استلام صورة الروشتة. يرجى التقاط صورة واضحة والمحاولة مجدداً.'
              : 'لم يتم استلام صورة علبة الدواء. يرجى التقاط صورة واضحة والمحاولة مجدداً.',
            error: 'BAD_REQUEST',
            error_code: 'BAD_REQUEST'
          },
          400
        );
      }

      if (image.length > MAX_PAYLOAD_BYTES) {
        return jsonResponse(
          {
            is_clear: false,
            retake_message: 'حجم الصورة كبير جداً (يتجاوز 4 ميجابايت). يرجى إعادة التقاط الصورة بحجم أصغر وإضاءة جيدة.',
            error: 'PAYLOAD_TOO_LARGE',
            error_code: 'PAYLOAD_TOO_LARGE'
          },
          413
        );
      }
    }

    // 3. API Key & Model Configuration
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      return jsonResponse(
        {
          is_clear: false,
          retake_message: 'خدمة التحليل غير مهيأة بالشكل الصحيح في الخادم (مفتاح GEMINI_API_KEY غير موجود). يرجى ضبط المفتاح في Cloudflare Worker.',
          error: 'SERVER_CONFIGURATION_ERROR',
          error_code: 'SERVER_CONFIGURATION_ERROR',
          detail: 'Server configuration error: GEMINI_API_KEY is missing or empty'
        },
        500
      );
    }

    // Select model without hardcoding: GEMINI_MODEL_PRESCRIPTION for prescription, GEMINI_MODEL for box/details
    let rawModel: string;
    if (mode === 'prescription') {
      rawModel = env.GEMINI_MODEL_PRESCRIPTION || 'gemini-3.8-flash';
    } else {
      rawModel = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    }
    const model = rawModel.replace(/^models\//, '');
    const isGemini3 = /gemini-3/i.test(model) || /3\.[0-9]/i.test(model);
    const isLite = /lite/i.test(model);

    const { image, mimeType = 'image/jpeg' } = body || {};

    const buildPayload = (includeThinking: boolean) => {
      const schema = mode === 'prescription' ? PRESCRIPTION_RESPONSE_SCHEMA : GEMINI_RESPONSE_SCHEMA;
      const systemPrompt = mode === 'prescription'
        ? PRESCRIPTION_SYSTEM_PROMPT
        : (mode === 'details' ? MEDICINE_DETAILS_SYSTEM_PROMPT : PHARMACIST_SYSTEM_PROMPT);

      const genConfig: Record<string, any> = {
        responseMimeType: 'application/json',
        responseSchema: schema
      };

      // Only set temperature: 0 for legacy models (pre-Gemini 3)
      if (!isGemini3) {
        genConfig.temperature = 0;
      }

      // Include thinkingConfig for non-lite models when requested
      if (includeThinking && !isLite) {
        genConfig.thinkingConfig = {
          thinkingLevel: 'LOW'
        };
      }

      let userParts: any[];
      if (mode === 'details') {
        userParts = [
          { text: `Provide detailed pharmaceutical information in simple Arabic for the medicine: ${body.medicine_name.trim()}` }
        ];
      } else {
        const cleanBase64 = image.includes(',') ? image.split(',')[1] : image;
        const promptText = mode === 'prescription'
          ? 'Analyze this doctor prescription photo and extract all details according to the instructions.'
          : 'Analyze this medicine packaging photo and extract all details according to the instructions.';
        userParts = [
          { text: promptText },
          {
            inlineData: {
              mimeType: typeof mimeType === 'string' && mimeType.trim() ? mimeType.trim() : 'image/jpeg',
              data: cleanBase64
            }
          }
        ];
      }

      return {
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: 'user',
            parts: userParts
          }
        ],
        generationConfig: genConfig
      };
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    // 25s AbortController timeout for upstream Gemini request
    const workerAbortController = new AbortController();
    const timeoutId = setTimeout(() => {
      workerAbortController.abort(new DOMException('Upstream Gemini request timed out after 25 seconds', 'TimeoutError'));
    }, 25000);

    try {
      let response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(true)),
        signal: workerAbortController.signal
      });

      // Fallback: If model rejects thinkingConfig with HTTP 400, retry without thinkingConfig
      if (response.status === 400) {
        const errorText = await response.clone().text().catch(() => '');
        if (errorText.toLowerCase().includes('thinking')) {
          console.warn('[Worker] Model rejected thinkingConfig, retrying without thinkingConfig');
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPayload(false)),
            signal: workerAbortController.signal
          });
        }
      }

      clearTimeout(timeoutId);

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

      const data: any = await response.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText) {
        if (mode === 'prescription') {
          return jsonResponse({
            is_clear: false,
            retake_message: 'لم نتمكن من التعرف على بيانات الروشتة من الصورة. يرجى إعادة التصوير في مكان ذي إضاءة جيدة والتركيز على كامل الروشتة.',
            confidence: 'low',
            evidence_text: '',
            items: [],
            audio_summary: '',
            error_code: 'NO_CANDIDATE_TEXT'
          });
        }
        return jsonResponse({
          is_clear: false,
          retake_message: mode === 'details'
            ? 'لم نتمكن من العثور على معلومات الدواء المطلوب.'
            : 'لم نتمكن من التعرف على بيانات الدواء من الصورة. يرجى إعادة التصوير في مكان ذي إضاءة جيدة والتركيز على العلبة.',
          confidence: 'low',
          evidence_text: '',
          medicine_name_ar: mode === 'details' ? body.medicine_name.trim() : '',
          medicine_name_en: '',
          active_ingredient: '',
          uses: [],
          how_and_when: [],
          usage_source: 'common',
          warnings: [],
          audio_summary: '',
          error_code: 'NO_CANDIDATE_TEXT'
        });
      }

      const parsedJson = cleanAndParseJsonText(candidateText);
      if (!parsedJson) {
        if (mode === 'prescription') {
          return jsonResponse({
            is_clear: false,
            retake_message: 'تعذر قراءة بيانات الروشتة بشكل صحيح. يرجى إعادة التقاط الصورة بوضوح.',
            confidence: 'low',
            evidence_text: '',
            items: [],
            audio_summary: '',
            error_code: 'INVALID_JSON'
          });
        }
        return jsonResponse({
          is_clear: false,
          retake_message: mode === 'details'
            ? 'تعذر قراءة تفاصيل الدواء بشكل صحيح.'
            : 'تعذر قراءة بيانات الدواء بشكل صحيح. يرجى إعادة التقاط الصورة بوضوح.',
          confidence: 'low',
          evidence_text: '',
          medicine_name_ar: mode === 'details' ? body.medicine_name.trim() : '',
          medicine_name_en: '',
          active_ingredient: '',
          uses: [],
          how_and_when: [],
          usage_source: 'common',
          warnings: [],
          audio_summary: '',
          error_code: 'INVALID_JSON'
        });
      }

      if (mode === 'prescription') {
        return jsonResponse({
          ...parsedJson,
          error_code: null
        });
      }

      const usage_source = parsedJson.usage_source === 'printed' ? 'printed' : 'common';
      return jsonResponse({
        ...parsedJson,
        usage_source,
        error_code: null
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError' || workerAbortController.signal.aborted) {
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

      const sanitizedErr = sanitizeMessage(err?.message || String(err));
      console.error('[Worker] Unexpected error:', sanitizedErr);
      return jsonResponse(
        {
          is_clear: false,
          retake_message: 'حدث خطأ غير متوقع أثناء معالجة الصورة. يرجى المحاولة بعد قليل.',
          error: 'INTERNAL_SERVER_ERROR',
          error_code: 'INTERNAL_SERVER_ERROR',
          detail: `Unexpected error: ${sanitizedErr.slice(0, 150)}`
        },
        500
      );
    }
  }
};
