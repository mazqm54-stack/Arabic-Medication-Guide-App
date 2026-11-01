export interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  RATE_LIMITER?: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
}

const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024; // 4MB
const IN_MEMORY_RATE_LIMIT_WINDOW = 60 * 1000; // 60 Seconds (1 Minute)
const IN_MEMORY_RATE_LIMIT_MAX = 10; // 10 requests per minute

const fallbackRateLimitMap = new Map<string, { count: number; resetTime: number }>();

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
6. General uses, usage guidance and warnings come from standard well-established medical knowledge about that active ingredient. Keep them general and safe. NEVER give exact doses, dose changes, or personal medical advice. If the box prints dosing instructions, you may mention that the box has them and tell the user to follow their doctor or pharmacist.
7. Mention only well-known, important warnings (for example: not suitable for pregnant women, interaction with alcohol, drowsiness, stomach irritation). Do not list rare side effects. Never invent a warning.
8. Always write in simple, short, warm Modern Standard Arabic suitable for elderly people. Avoid medical jargon. If a medical term is necessary, explain it in simple words.
9. The last warning must always remind the user to ask the doctor or pharmacist if unsure.
10. Return JSON only, matching the schema. No markdown, no extra text.`;

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
    'warnings',
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
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED_KEY]')
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
      const activeModel = (env.GEMINI_MODEL || 'gemini-3.8-flash').replace(/^models\//, '');
      return jsonResponse({
        status: 'ok',
        service: 'dalili-medication-guide-worker',
        model: activeModel,
        hasApiKey: Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim())
      });
    }

    // Only allow POST to / or /api/analyze
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

    const { image, mimeType = 'image/jpeg' } = body || {};
    if (!image || typeof image !== 'string' || !image.trim()) {
      return jsonResponse(
        {
          is_clear: false,
          retake_message: 'لم يتم استلام صورة علبة الدواء. يرجى التقاط صورة واضحة والمحاولة مجدداً.',
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

    const rawModel = env.GEMINI_MODEL || 'gemini-3.8-flash';
    // Strip leading 'models/' if present to guarantee URL never has 'models/models/'
    const model = rawModel.replace(/^models\//, '');
    const cleanBase64 = image.includes(',') ? image.split(',')[1] : image;

    // Detect Gemini 3.x models to conditionally omit deprecated temperature parameter
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

      const data: any = await response.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText) {
        return jsonResponse({
          is_clear: false,
          retake_message: 'لم نتمكن من التعرف على بيانات الدواء من الصورة. يرجى إعادة التصوير في مكان ذي إضاءة جيدة والتركيز على العلبة.',
          confidence: 'low',
          evidence_text: '',
          medicine_name_ar: '',
          medicine_name_en: '',
          active_ingredient: '',
          uses: [],
          how_and_when: [],
          warnings: [],
          audio_summary: '',
          error_code: 'NO_CANDIDATE_TEXT'
        });
      }

      const parsedJson = cleanAndParseJsonText(candidateText);
      if (!parsedJson) {
        return jsonResponse({
          is_clear: false,
          retake_message: 'تعذر قراءة بيانات الدواء بشكل صحيح. يرجى إعادة التقاط الصورة بوضوح.',
          confidence: 'low',
          evidence_text: '',
          medicine_name_ar: '',
          medicine_name_en: '',
          active_ingredient: '',
          uses: [],
          how_and_when: [],
          warnings: [],
          audio_summary: '',
          error_code: 'INVALID_JSON'
        });
      }

      return jsonResponse({
        ...parsedJson,
        error_code: null
      });
    } catch (err: any) {
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
