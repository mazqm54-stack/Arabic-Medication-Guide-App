// api/analyze.ts

export interface VercelRequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
  socket?: { remoteAddress?: string };
}

export interface VercelResponseLike {
  status(statusCode: number): VercelResponseLike;
  json(body: any): VercelResponseLike;
  setHeader(name: string, value: string | number | readonly string[]): VercelResponseLike | void;
  end(chunk?: any): void;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
};

const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024; // 4MB
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 Hour
const RATE_LIMIT_MAX_REQUESTS = 20;

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export function _resetRateLimitStore(): void {
  rateLimitStore.clear();
}

export function getClientIp(req: VercelRequestLike): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp.trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  if (rateLimitStore.size > 500) {
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }

  let record = rateLimitStore.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(ip, record);
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetTime: record.resetTime };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count, resetTime: record.resetTime };
}

function setCorsHeaders(res: VercelResponseLike): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
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

function supportsThinking(model: string): boolean {
  const m = model.toLowerCase();
  return m.includes('thinking') || m.includes('2.0') || m.includes('2.5');
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

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({
      is_clear: false,
      retake_message: 'طريقة الطلب غير مدعومة. يرجى استخدام POST فقط.',
      error: 'METHOD_NOT_ALLOWED'
    });
  }

  // Rate Limiting
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(clientIp);

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetTime / 1000).toString());

  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetTime - Date.now()) / 1000));
    res.setHeader('Retry-After', retryAfterSeconds.toString());
    return res.status(429).json({
      is_clear: false,
      retake_message: 'تم تجاوز حد الاستخدام المسموح (20 تحليلاً في الساعة). يرجى الانتظار قليلاً قبل تصوير دواء آخر.',
      error: 'RATE_LIMIT_EXCEEDED'
    });
  }

  // Payload Validation
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      is_clear: false,
      retake_message: 'صيغة الطلب غير صالحة، يرجى إرسال صورة علبة الدواء للمتابعة.',
      error: 'BAD_REQUEST'
    });
  }

  const { image, mimeType = 'image/jpeg' } = body;
  if (!image || typeof image !== 'string' || !image.trim()) {
    return res.status(400).json({
      is_clear: false,
      retake_message: 'لم يتم استلام صورة علبة الدواء. يرجى التقاط صورة واضحة والمحاولة مجدداً.',
      error: 'BAD_REQUEST'
    });
  }

  if (image.length > MAX_PAYLOAD_BYTES) {
    return res.status(413).json({
      is_clear: false,
      retake_message: 'حجم الصورة كبير جداً (يتجاوز 4 ميجابايت). يرجى إعادة التقاط الصورة بحجم أصغر وإضاءة جيدة.',
      error: 'PAYLOAD_TOO_LARGE'
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    console.error('[API/analyze] Missing GEMINI_API_KEY environment variable');
    return res.status(500).json({
      is_clear: false,
      retake_message: 'خدمة التحليل غير مهيأة بالشكل الصحيح في الخادم. يرجى التواصل مع الدعم الفني.',
      error: 'SERVER_CONFIGURATION_ERROR'
    });
  }

  const rawModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const model = rawModel.replace(/^models\//, '');
  const cleanBase64 = image.includes(',') ? image.split(',')[1] : image;

  const buildPayload = (includeThinking: boolean) => ({
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
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      ...(includeThinking && supportsThinking(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      responseSchema: GEMINI_RESPONSE_SCHEMA
    }
  });

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  try {
    let response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(true))
    });

    // Fallback: If model rejects thinkingConfig with HTTP 400, retry without thinkingConfig
    if (response.status === 400 && supportsThinking(model)) {
      const errorText = await response.clone().text();
      if (errorText.toLowerCase().includes('thinking')) {
        console.warn('[API/analyze] Model rejected thinkingConfig, retrying without thinkingConfig');
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(false))
        });
      }
    }

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({
          is_clear: false,
          retake_message: 'تم تجاوز حد الطلبات لدى مزود الخدمة الذكية. يرجى الانتظار دقيقة والمحاولة مجدداً.',
          error: 'UPSTREAM_RATE_LIMIT'
        });
      }

      console.error(`[API/analyze] Upstream Gemini error: HTTP ${response.status}`);
      return res.status(500).json({
        is_clear: false,
        retake_message: 'حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية. يرجى المحاولة مرة أخرى.',
        error: 'UPSTREAM_API_ERROR'
      });
    }

    const data: any = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return res.status(200).json({
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
        audio_summary: ''
      });
    }

    const parsedJson = cleanAndParseJsonText(candidateText);
    if (!parsedJson) {
      return res.status(200).json({
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
        audio_summary: ''
      });
    }

    return res.status(200).json(parsedJson);
  } catch (err: any) {
    console.error('[API/analyze] Unexpected server error:', err);
    return res.status(500).json({
      is_clear: false,
      retake_message: 'حدث خطأ غير متوقع أثناء معالجة الصورة. يرجى المحاولة بعد قليل.',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
}
