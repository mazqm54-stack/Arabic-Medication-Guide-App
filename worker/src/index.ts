import type { D1Database, KVNamespace, ExecutionContext } from './types';
import { recordRequest, recordFeedback, fetchDashboardData, fetchApiStats } from './stats';
import { renderLoginPage, renderDashboardPage } from './admin_html';
import { matchLibyanMedicine, findClosestCandidates } from './libyan_matcher';

export interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_MODEL_PRESCRIPTION?: string;
  PRESCRIPTION_THINKING_LEVEL?: string;
  PRESCRIPTION_MEDIA_RESOLUTION?: string;
  DEEP_THINKING_LEVEL?: string;
  DEEP_MEDIA_RESOLUTION?: string;
  RATE_LIMITER?: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
  DB?: D1Database;
  CONFIG_KV?: KVNamespace;
  ADMIN_KEY?: string;
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

export const PRESCRIPTION_SYSTEM_PROMPT = `You read photos of doctor prescriptions (روشتة طبية) from the Arabic-speaking market (mostly Libya). Your ONLY job is to read the medicines accurately. A wrong name stated with confidence is much worse than saying "unclear". Return JSON only, matching the schema, with no markdown and no extra text.

METHOD
1. First separate the page parts: header (clinic, doctor, date), patient data, diagnosis, and the medicine list. Ignore everything that is not a medicine line. Never output patient or doctor names.
2. Read the medicine lines from top to bottom, one line at a time. Each line usually has: a form abbreviation, the medicine name, a strength, and directions.
3. Lines that are crossed out, scribbled over, or struck through are cancelled: do NOT list them.
4. Medicine names are usually brand or generic names written in English letters (Libyan market). Write what is written, using the standard spelling of the medicine when you are sure it is a real medicine. Use a name in active_ingredient only if you are sure.
5. If the page is not a prescription, or is too blurry/dark/cropped to read, set is_clear=false, items=[] and write a short friendly Arabic retake_message (good light, whole paper visible, hold the phone steady).
6. FRAGMENTS & DIRECTIONS OVERFLOW: A line or fragment containing only dosage, frequency, or directions (such as "cp x 3m 1", "1x3", "2 c.c x 3") without a medicine name belongs to the previous medicine item. Append it to that previous item's written_instructions; NEVER create a separate item for a directions-only fragment.

ABBREVIATIONS (copy directions exactly as written, do not interpret or complete them)
Forms: Tab/Tabs/cp = tablet, Cap = capsule, Syp = syrup, Susp = suspension, Inj/Amp/Vial = injection, Cr = cream, Oint = ointment, Gel, Supp = suppository, Drops/Gtt, Sol = solution, Inh = inhaler, Sach = sachet, Eff = effervescent.
Frequency: OD/QD = once daily, BID/bd = twice daily, TID/tds = three times daily, QID = four times daily, PRN = when needed, HS = at bedtime, AC = before meals, PC = after meals, "1x3" = one, three times per day, "cp x 3m" = 1 tablet 3 times a day. Arabic: حبة، قرص، كبسولة، مرتين، ثلاث مرات، قبل/بعد الأكل.

FORM IS A HARD CONSTRAINT
If the line says cream, oint, gel, supp, syrup, drops, inj, inhaler, etc., the medicine you name MUST exist in that form. Never turn a cream into tablets or capsules, or the opposite. If the name you read does not exist in that form, lower the confidence or return unclear.

CONFIDENCE (based ONLY on how clearly the handwriting is legible)
- high: every important letter of the name is clearly legible, and the name is a real medicine.
- medium: most letters are legible, with a small ambiguity, and the result is a real medicine.
- low: important letters are unclear, or you are not sure the result is a real medicine.
The diagnosis or the other medicines may help you choose between candidates, but they NEVER raise confidence above medium. A name that fits the diagnosis is not confirmation that the doctor wrote it.

PARTLY LEGIBLE & UNCLEAR LINES
- For lines that are partly legible (some letters of the name are legible): put your best reading of the medicine name in medicine_name_en with confidence="low", set status="suggested", is_confirmed=false, put only the letters you can actually see in visible_letters, give up to two plausible registered candidates in suggested_medicines, and set warning_note="محتمل، غير مؤكد - اسأل الصيدلي للتأكد من الدواء والجرعة الصحيحة". Never leave medicine_name_en empty if any letters of the name can be read.
- Leave medicine_name_en="" ONLY when NO letter of the medicine name is legible at all. In that case, set status="unclear", confidence="low", is_confirmed=false, put visible letter fragments in visible_letters, leave suggested_medicines empty, and set warning_note="غير واضح، اسأل الصيدلي".
- For suggested and unclear lines: written_instructions must be "" (never give a dose for a guess).

READABLE LINES
status="confirmed", is_confirmed=true, confidence high or medium. Copy the directions exactly into written_instructions (for example "1x3", "قرص بعد الغداء", "5 days"). If the doctor wrote no directions, leave "". Copy the whole line as written into line_text_as_written. medicine_name_ar: an Arabic spelling of the name if you are sure, otherwise "".

OUTPUT RULES
- Up to 10 items, in the order they appear on the page.
- short_explanation: always "" for every item. audio_summary: always "".
- evidence_text: one short sentence about how clear the page was.
- deduced_condition: the diagnosis if written or clearly implied, otherwise "".

EXAMPLES (they only show the format; never output these names unless they are really written)
- "Tab. Amlor 5mg 1x1" → form tablet, name Amlor, strength 5mg, directions "1x1", confidence high if letters are clear.
- "Cr. Fucidin apply BID" → form cream; the name must exist as a cream.
- "Inj. Rocephin 1g IM OD" → form injection; directions "IM OD".
- "cp x 3m 1" written below a medicine line → belongs to that medicine's written_instructions, do NOT create a separate item.
- "Cap. Xy......" with only "Xy" visible → best reading of name in medicine_name_en with confidence low, status "suggested".
- Completely illegible line → medicine_name_en="", visible_letters="...", status="unclear", confidence="low".`;

export const MEDICINE_DETAILS_SYSTEM_PROMPT = `You are an expert pharmacist assistant for elderly Arabic-speaking users. The user will provide a medicine name. Your job is to return standard, safe pharmaceutical details for this medication in very simple Modern Standard Arabic.

STRICT RULES:
1. Provide accurate Arabic and English trade names (medicine_name_ar, medicine_name_en) and the active ingredient (generic name).
2. uses: 2 to 3 clearly stated bullet points explaining why the medicine is used in simple Arabic (دواعي الاستعمال).
3. how_to_use: 2 to 3 practical bullet points on how to take it (كيفية الاستخدام: مع كوب ماء، قبل/بعد الأكل، مع الطعام، إلخ).
4. when_to_take: usual timing and number of times per day (أوقات الاستخدام: مرة صباحاً، مرتين يومياً، عند اللزوم، إلخ).
5. how_and_when: 2 to 3 short items about the COMMON general usage of that active ingredient (timing such as before/after food, typical frequency). Do NOT include exact mg/ml amounts or personal medical advice.
6. Set usage_source='common'.
7. warnings: 1 to 2 important safety warnings.
8. audio_summary: A simple, warm spoken summary of the medicine, its purpose, and common usage in spoken Modern Standard Arabic.
9. Set is_clear=true, confidence='high', evidence_text='Verified database details for ' + medicine_name.
10. Return JSON only matching the schema. No markdown, no extra commentary.`;

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
    how_to_use: { type: 'ARRAY', items: { type: 'STRING' } },
    when_to_take: { type: 'ARRAY', items: { type: 'STRING' } },
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
    deduced_condition: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          line_text_as_written: { type: 'STRING' },
          is_confirmed: { type: 'BOOLEAN' },
          status: { type: 'STRING', enum: ['confirmed', 'suggested', 'unclear'] },
          medicine_name_ar: { type: 'STRING' },
          medicine_name_en: { type: 'STRING' },
          active_ingredient: { type: 'STRING' },
          confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
          written_instructions: { type: 'STRING' },
          short_explanation: { type: 'STRING' },
          visible_letters: { type: 'STRING' },
          suggested_medicines: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name_ar: { type: 'STRING' },
                name_en: { type: 'STRING' },
                confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] }
              },
              required: ['name_ar', 'name_en', 'confidence']
            }
          },
          warning_note: { type: 'STRING' }
        },
        required: [
          'line_text_as_written',
          'is_confirmed',
          'status',
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

export function safeRepairJsonText(jsonStr: string): any {
  if (!jsonStr || !jsonStr.trim()) return null;
  let text = jsonStr.trim();

  // 1. Try direct standard parse
  try {
    return JSON.parse(text);
  } catch {}

  // 2. Strip markdown blocks
  const markdownRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = text.match(markdownRegex);
  if (match && match[1]) {
    text = match[1].trim();
    try {
      return JSON.parse(text);
    } catch {}
  }

  // 3. Locate starting brace
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return null;
  text = text.slice(firstBrace);

  // 4. Trace bracket and quote balance to repair truncated JSON
  let inString = false;
  let escaped = false;
  const stack: ('{' | '[')[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{' || ch === '[') {
        stack.push(ch);
      } else if (ch === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === '{') stack.pop();
      } else if (ch === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === '[') stack.pop();
      }
    }
  }

  let repaired = text;
  // If terminated inside an unclosed string, close it
  if (inString) {
    repaired += '"';
  }

  // Clean trailing trailing commas before closing
  repaired = repaired.replace(/,\s*([\}\]])/g, '$1');
  repaired = repaired.replace(/,\s*$/g, '');
  repaired = repaired.replace(/:\s*$/g, ': null');

  // Close remaining open brackets and braces in reverse order
  while (stack.length > 0) {
    const open = stack.pop();
    if (open === '{') repaired += '}';
    else if (open === '[') repaired += ']';
  }

  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
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
    const candidate = cleaned.slice(startBrace, endBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  // Fall back to resilient auto-repair parser
  return safeRepairJsonText(cleaned);
}

export function normalizePrescriptionItems(rawItems: any[]): any[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((item: any) => {
    const status: 'confirmed' | 'suggested' | 'unclear' =
      ['confirmed', 'suggested', 'unclear'].includes(item?.status)
        ? item.status
        : (item?.confidence === 'low' ? 'unclear' : 'confirmed');
    const is_confirmed = typeof item?.is_confirmed === 'boolean'
      ? item.is_confirmed
      : (status === 'confirmed');
    return {
      line_text_as_written: typeof item?.line_text_as_written === 'string' ? item.line_text_as_written : '',
      is_confirmed,
      status,
      medicine_name_ar: typeof item?.medicine_name_ar === 'string' ? item.medicine_name_ar : '',
      medicine_name_en: typeof item?.medicine_name_en === 'string' ? item.medicine_name_en : '',
      active_ingredient: typeof item?.active_ingredient === 'string' ? item.active_ingredient : '',
      confidence: ['high', 'medium', 'low'].includes(item?.confidence) ? item.confidence : (status === 'confirmed' ? 'high' : 'medium'),
      written_instructions: status === 'suggested' ? '' : (typeof item?.written_instructions === 'string' ? item.written_instructions : ''),
      short_explanation: (status === 'suggested' || status === 'unclear' || item?.confidence === 'low') ? '' : (typeof item?.short_explanation === 'string' ? item.short_explanation : ''),
      visible_letters: typeof item?.visible_letters === 'string' ? item.visible_letters : '',
      suggested_medicines: Array.isArray(item?.suggested_medicines)
        ? item.suggested_medicines.slice(0, 2).map((s: any) => ({
            name_ar: typeof s?.name_ar === 'string' ? s.name_ar : '',
            name_en: typeof s?.name_en === 'string' ? s.name_en : '',
            confidence: ['high', 'medium', 'low'].includes(s?.confidence) ? s.confidence : 'medium'
          }))
        : [],
      warning_note: typeof item?.warning_note === 'string' && item.warning_note.length > 0
        ? item.warning_note
        : (status === 'suggested'
            ? 'محتمل، غير مؤكد - اسأل الصيدلي للتأكد من الدواء والجرعة الصحيحة'
            : (status === 'unclear' ? 'غير واضح، اسأل الصيدلي' : ''))
    };
  });
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
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
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
      const prescriptionModel = (env.GEMINI_MODEL_PRESCRIPTION || 'gemini-3.5-flash-lite').replace(/^models\//, '');
      return jsonResponse({
        status: 'ok',
        service: 'dalili-medication-guide-worker',
        model: activeModel,
        prescriptionModel: prescriptionModel,
        prescriptionThinkingLevel: env.PRESCRIPTION_THINKING_LEVEL || 'MEDIUM',
        prescriptionMediaResolution: env.PRESCRIPTION_MEDIA_RESOLUTION || 'MEDIA_RESOLUTION_HIGH',
        deepThinkingLevel: env.DEEP_THINKING_LEVEL || 'HIGH',
        deepMediaResolution: env.DEEP_MEDIA_RESOLUTION || 'MEDIA_RESOLUTION_HIGH',
        hasApiKey: Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim())
      });
    }

    // Part 1: Remote Control (/api/status)
    if (request.method === 'GET' && url.pathname === '/api/status') {
      let maintenance = false;
      let maintenanceMessage = 'النظام قيد الصيانة حالياً. يرجى المحاولة لاحقاً.';
      let latestVersion = '0.0.1';
      let minVersion = '0.0.1';
      let updateUrl = '';
      let updateMessage = 'يتوفر تحديث جديد للتطبيق. يرجى التحديث للحصول على أحدث الميزات.';

      if (env.CONFIG_KV) {
        try {
          const mVal = await env.CONFIG_KV.get('maintenance');
          if (mVal !== null) maintenance = mVal.trim().toLowerCase() === 'true';

          const mMsg = await env.CONFIG_KV.get('maintenance_message');
          if (mMsg) maintenanceMessage = mMsg;

          const lVer = await env.CONFIG_KV.get('latest_version');
          if (lVer) latestVersion = lVer;

          const mVer = await env.CONFIG_KV.get('min_version');
          if (mVer) minVersion = mVer;

          const uUrl = await env.CONFIG_KV.get('update_url');
          if (uUrl) updateUrl = uUrl;

          const uMsg = await env.CONFIG_KV.get('update_message');
          if (uMsg) updateMessage = uMsg;
        } catch (err) {
          console.error('[KV] Error reading status config:', err);
        }
      }

      return jsonResponse({
        maintenance,
        maintenance_message: maintenanceMessage,
        latest_version: latestVersion,
        min_version: minVersion,
        update_url: updateUrl,
        update_message: updateMessage
      }, 200, {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
    }

    // Part 3: Feedback Endpoint (/api/feedback)
    if (request.method === 'POST' && url.pathname === '/api/feedback') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'BAD_REQUEST', message: 'صيغة الطلب غير صالحة' }, 400);
      }

      const rawRating = String(body?.choice || body?.rating || '').trim().toLowerCase();
      if (rawRating !== 'correct' && rawRating !== 'wrong') {
        return jsonResponse({ error: 'BAD_REQUEST', message: 'التقييم يجب أن يكون correct أو wrong' }, 400);
      }
      const rating: 'correct' | 'wrong' = rawRating === 'correct' ? 'correct' : 'wrong';

      const rawType = String(body?.type || 'box').trim().toLowerCase();
      const type = (rawType === 'prescription' || rawType === 'box') ? rawType : 'box';
      const deviceId = String(body?.device_id || request.headers.get('x-device-id') || 'anonymous').trim();

      await recordFeedback(env.DB, { deviceId, type, rating });
      return jsonResponse({ success: true, message: 'شكراً لمشاركتك رأيك!' });
    }

    // Part 2: Stats Endpoint (/api/stats - Protected by ADMIN_KEY)
    if (request.method === 'GET' && url.pathname === '/api/stats') {
      const expectedKey = (env.ADMIN_KEY || 'dalili-admin-2026').trim();
      const authKey = (
        url.searchParams.get('key') ||
        url.searchParams.get('admin_key') ||
        request.headers.get('x-admin-key') ||
        (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
      ).trim();

      if (authKey !== expectedKey) {
        return jsonResponse({ error: 'UNAUTHORIZED', message: 'مفتاح الإدارة غير صحيح أو مفقود' }, 401);
      }

      if (!env.DB) {
        return jsonResponse({ error: 'DB_UNAVAILABLE', message: 'قاعدة البيانات D1 غير متصلة' }, 503);
      }

      try {
        const stats = await fetchApiStats(env.DB);
        return jsonResponse(stats);
      } catch (err: any) {
        console.error('[Worker] Error fetching stats:', err);
        return jsonResponse({ error: 'INTERNAL_ERROR', message: String(err?.message || err) }, 500);
      }
    }

    // Part 4: Admin Dashboard (/admin - Protected by ADMIN_KEY)
    if (request.method === 'GET' && url.pathname === '/admin') {
      const expectedKey = (env.ADMIN_KEY || 'dalili-admin-2026').trim();
      const queryKey = (url.searchParams.get('key') || '').trim();

      if (!queryKey) {
        return new Response(renderLoginPage(), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      if (queryKey !== expectedKey) {
        return new Response(renderLoginPage('مفتاح الإدارة غير صحيح. يرجى المحاولة مجدداً.'), {
          status: 401,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      if (!env.DB) {
        return new Response('<h3>قاعدة البيانات D1 غير متصلة بالخادم.</h3>', {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      try {
        const dashboardData = await fetchDashboardData(env.DB);
        return new Response(renderDashboardPage(dashboardData, expectedKey), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      } catch (err: any) {
        console.error('[Worker] Error loading admin dashboard:', err);
        return new Response(`<h3>حدث خطأ أثناء تحميل لوحة التحكم: ${err?.message || err}</h3>`, {
          status: 500,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    }

    // Only allow POST for analyze/prescription/details endpoints
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

    const isDeep = Boolean(body?.deep);
    const overallBudgetMs = mode === 'prescription' ? (isDeep ? 45000 : 24000) : 20000;
    const reqStartTime = Date.now();
    const overallDeadlineMs = reqStartTime + overallBudgetMs;
    const deviceId = String(request.headers.get('x-device-id') || body?.device_id || 'anonymous').trim();

    const logAndReturn = (
      res: Response,
      status: 'success' | 'failure',
      isGemini429 = false,
      medicinesCount = 0,
      unclearCount = 0,
      retryNeeded = false,
      retryImproved = false,
      lnfMatched = 0,
      lnfCorrected = 0,
      lnfNotFound = 0,
      errorCode = '',
      isDeepFlag = isDeep,
      isHardFlag = false
    ): Response => {
      const duration = Date.now() - reqStartTime;
      const promise = recordRequest(env.DB, {
        deviceId,
        type: mode,
        status,
        responseTimeMs: duration,
        isGemini429,
        medicinesCount,
        unclearCount,
        retryNeeded,
        retryImproved,
        lnfMatched,
        lnfCorrected,
        lnfNotFound,
        errorCode,
        isDeep: isDeepFlag,
        isHard: isHardFlag
      });
      if (ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(promise);
      } else {
        promise.catch(console.error);
      }
      return res;
    };

    // Mode-specific input validation
    if (mode === 'details') {
      const medicineName = body?.medicine_name;
      if (!medicineName || typeof medicineName !== 'string' || !medicineName.trim()) {
        return logAndReturn(
          jsonResponse(
            {
              is_clear: false,
              retake_message: 'يرجى إرسال اسم الدواء لعرض التفاصيل.',
              error: 'BAD_REQUEST',
              error_code: 'BAD_REQUEST'
            },
            400
          ),
          'failure'
        );
      }
    } else {
      const { image } = body || {};
      if (!image || typeof image !== 'string' || !image.trim()) {
        return logAndReturn(
          jsonResponse(
            {
              is_clear: false,
              retake_message: isPrescription
                ? 'لم يتم استلام صورة الروشتة. يرجى التقاط صورة واضحة والمحاولة مجدداً.'
                : 'لم يتم استلام صورة علبة الدواء. يرجى التقاط صورة واضحة والمحاولة مجدداً.',
              error: 'BAD_REQUEST',
              error_code: 'BAD_REQUEST'
            },
            400
          ),
          'failure'
        );
      }

      if (image.length > MAX_PAYLOAD_BYTES) {
        return logAndReturn(
          jsonResponse(
            {
              is_clear: false,
              retake_message: 'حجم الصورة كبير جداً (يتجاوز 4 ميجابايت). يرجى إعادة التقاط الصورة بحجم أصغر وإضاءة جيدة.',
              error: 'PAYLOAD_TOO_LARGE',
              error_code: 'PAYLOAD_TOO_LARGE'
            },
            413
          ),
          'failure'
        );
      }
    }

    // 3. API Key & Model Configuration
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      return logAndReturn(
        jsonResponse(
          {
            is_clear: false,
            retake_message: 'خدمة التحليل غير مهيأة بالشكل الصحيح في الخادم (مفتاح GEMINI_API_KEY غير موجود). يرجى ضبط المفتاح في Cloudflare Worker.',
            error: 'SERVER_CONFIGURATION_ERROR',
            error_code: 'SERVER_CONFIGURATION_ERROR',
            detail: 'Server configuration error: GEMINI_API_KEY is missing or empty'
          },
          500
        ),
        'failure'
      );
    }

    // Select model without hardcoding: GEMINI_MODEL_PRESCRIPTION for prescription, GEMINI_MODEL for box/details
    let rawModel: string;
    if (mode === 'prescription') {
      rawModel = env.GEMINI_MODEL_PRESCRIPTION || 'gemini-3.5-flash-lite';
    } else {
      rawModel = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    }
    const model = rawModel.replace(/^models\//, '');
    const isGemini3 = /gemini-3/i.test(model) || /3\.[0-9]/i.test(model);
    const isLite = /lite/i.test(model);

    // Deep Mode daily rate limit check (max 5 per device per calendar day)
    if (mode === 'prescription' && isDeep && env.CONFIG_KV) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const kvKey = `deep_limit_${deviceId}_${todayStr}`;
      let deepCount = 0;
      try {
        const val = await env.CONFIG_KV.get(kvKey);
        if (val) deepCount = parseInt(val, 10) || 0;
      } catch (kvErr) {
        console.warn('[KV] Failed to read deep limit:', kvErr);
      }

      if (deepCount >= 5) {
        return logAndReturn(
          jsonResponse(
            {
              is_clear: false,
              limit_reached: true,
              retake_message: 'تم استنفاد الحد اليومي للتدقيق العميق (5 روشتات يومياً). يرجى الاعتماد على القراءة الأولية أو المحاولة غداً.',
              error: 'DEEP_DAILY_LIMIT_EXCEEDED',
              error_code: 'DEEP_LIMIT_REACHED'
            },
            429,
            { 'Retry-After': '86400' }
          ),
          'failure',
          false,
          0,
          0,
          false,
          false,
          0,
          0,
          0,
          'DEEP_LIMIT_REACHED',
          true,
          true
        );
      }

      try {
        await env.CONFIG_KV.put(kvKey, String(deepCount + 1), { expirationTtl: 86400 });
      } catch (kvErr) {
        console.warn('[KV] Failed to update deep limit:', kvErr);
      }
    }

    const { image, mimeType = 'image/jpeg' } = body || {};

    const buildPayload = (includeThinking: boolean, candidateHints?: string[]) => {
      const schema = mode === 'prescription' ? PRESCRIPTION_RESPONSE_SCHEMA : GEMINI_RESPONSE_SCHEMA;
      const systemPrompt = mode === 'prescription'
        ? PRESCRIPTION_SYSTEM_PROMPT
        : (mode === 'details' ? MEDICINE_DETAILS_SYSTEM_PROMPT : PHARMACIST_SYSTEM_PROMPT);

      const genConfig: Record<string, any> = {
        responseMimeType: 'application/json',
        responseSchema: schema,
        maxOutputTokens: 8192
      };

      // Set media resolution for prescriptions to capture fine handwriting details
      if (mode === 'prescription') {
        const defaultResolution = isDeep
          ? (env.DEEP_MEDIA_RESOLUTION || 'MEDIA_RESOLUTION_HIGH')
          : (env.PRESCRIPTION_MEDIA_RESOLUTION || 'MEDIA_RESOLUTION_HIGH');
        genConfig.mediaResolution = body?.test_media_resolution || defaultResolution;
      }

      // Only set temperature: 0 for legacy models (pre-Gemini 3).
      // For Gemini 3 / 3.5 Flash-Lite, leave at default (omitted) per official Google guidance.
      if (!isGemini3) {
        genConfig.temperature = 0;
      }

      // Thinking configuration:
      // For prescriptions: configurable via wrangler vars (defaults: normal MEDIUM, deep HIGH) or test override
      // For other modes: LOW (or omitted for lite)
      if (includeThinking) {
        if (mode === 'prescription') {
          const defaultLevel = isDeep
            ? (env.DEEP_THINKING_LEVEL || 'HIGH')
            : (env.PRESCRIPTION_THINKING_LEVEL || 'MEDIUM');
          const tLevel = body?.test_thinking_level || defaultLevel;
          genConfig.thinkingConfig = {
            thinkingLevel: tLevel
          };
        } else if (!isLite) {
          genConfig.thinkingConfig = {
            thinkingLevel: 'LOW'
          };
        }
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
        if (candidateHints && candidateHints.length > 0) {
          userParts.push({
            text: `PHARMACEUTICAL DIRECTORY GUIDANCE: For any unclear handwritten lines, here are verified registered medications in the Libyan National Formulary matching visible letter fragments:\n${candidateHints.join('\n')}\nCross-reference the doctor's handwriting strokes and overall prescription diagnosis with these registered medications.`
          });
        }
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

    const executeGeminiCall = async (timeoutMs = 15000, candidateHints?: string[]) => {
      let lastResp: Response | null = null;
      let lastError: any = null;

      // Auto-retry on Gemini 503 and 500 errors inside the Worker: up to 2 retries (attempts 1..3)
      // with short waits (~0.8s, then 1.5s). Do NOT retry on 429, 400, or invalid image.
      for (let attempt = 1; attempt <= 3; attempt++) {
        const remainingBudget = overallDeadlineMs - Date.now();
        if (remainingBudget < 1500 && attempt > 1) {
          break;
        }

        const effectiveTimeout = Math.max(1000, Math.min(timeoutMs, remainingBudget - 300));
        const callController = new AbortController();
        const callTimeout = setTimeout(() => {
          callController.abort(new DOMException(`Gemini call timed out after ${effectiveTimeout}ms`, 'TimeoutError'));
        }, effectiveTimeout);

        try {
          let resp = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPayload(true, candidateHints)),
            signal: callController.signal
          });

          // Fallback: If model rejects thinkingConfig with HTTP 400, retry without thinkingConfig
          if (resp.status === 400) {
            const errorText = await resp.clone().text().catch(() => '');
            if (errorText.toLowerCase().includes('thinking')) {
              console.warn('[Worker] Model rejected thinkingConfig, retrying without thinkingConfig');
              resp = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildPayload(false, candidateHints)),
                signal: callController.signal
              });
            }
          }

          lastResp = resp;

          // If successful or non-transient status (400, 429, 403, 404), return immediately
          if (resp.status !== 503 && resp.status !== 500) {
            return resp;
          }

          console.warn(`[Worker] Upstream HTTP ${resp.status} on attempt ${attempt}. Transient retry allowed.`);
        } catch (fetchErr: any) {
          if (lastResp) {
            return lastResp;
          }
          throw fetchErr;
        } finally {
          clearTimeout(callTimeout);
        }

        // Sleep before retry (attempt 1 -> 800ms, attempt 2 -> 1500ms)
        if (attempt < 3) {
          const waitMs = attempt === 1 ? 800 : 1500;
          if (overallDeadlineMs - Date.now() > waitMs + 2000) {
            await new Promise((r) => setTimeout(r, waitMs));
          } else {
            break;
          }
        }
      }

      if (lastResp) return lastResp;
      if (lastError) throw lastError;
      throw new DOMException('Gemini call failed with no response', 'TimeoutError');
    };

    try {
      let response = await executeGeminiCall(18000);

      if (!response.ok) {
        const rawErrorText = await response.text().catch(() => '');
        const { detail, isLocationBlocked } = parseUpstreamError(rawErrorText, response.status);

        console.error(`[Worker] Upstream Gemini error: HTTP ${response.status} - ${detail}`);

        if (isLocationBlocked) {
          return logAndReturn(
            jsonResponse(
              {
                is_clear: false,
                retake_message: 'خدمة التحليل الذكي غير متاحة في هذا النطاق الجغرافي حالياً.',
                error: 'UPSTREAM_LOCATION_RESTRICTED',
                error_code: 'UPSTREAM_LOCATION_RESTRICTED',
                upstream_status: response.status,
                detail
              },
              403
            ),
            'failure',
            false,
            0,
            0,
            false,
            false,
            0,
            0,
            0,
            'UPSTREAM_LOCATION_RESTRICTED',
            isDeep
          );
        }

        if (response.status === 503) {
          return logAndReturn(
            jsonResponse(
              {
                is_clear: false,
                retake_message: 'خدمة الذكاء الاصطناعي تحت ضغط مؤقت. يرجى الانتظار بضع ثوانٍ ثم الضغط على زر إعادة المحاولة.',
                error: 'UPSTREAM_OVERLOADED',
                error_code: 'UPSTREAM_OVERLOADED',
                upstream_status: 503,
                detail
              },
              503
            ),
            'failure',
            false,
            0,
            0,
            false,
            false,
            0,
            0,
            0,
            'UPSTREAM_OVERLOADED_503',
            isDeep
          );
        }

        if (response.status === 429) {
          return logAndReturn(
            jsonResponse(
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
            ),
            'failure',
            true,
            0,
            0,
            false,
            false,
            0,
            0,
            0,
            'UPSTREAM_RATE_LIMIT_429',
            isDeep
          );
        }

        if (response.status === 400) {
          return logAndReturn(
            jsonResponse(
              {
                is_clear: false,
                retake_message: 'حدث خطأ في صياغة طلب التحليل لمزود الخدمة الذكية.',
                error: 'UPSTREAM_BAD_REQUEST',
                error_code: 'UPSTREAM_BAD_REQUEST',
                upstream_status: 400,
                detail
              },
              400
            ),
            'failure',
            false,
            0,
            0,
            false,
            false,
            0,
            0,
            0,
            'BAD_REQUEST_400',
            isDeep
          );
        }

        return logAndReturn(
          jsonResponse(
            {
              is_clear: false,
              retake_message: 'حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية. يرجى المحاولة مرة أخرى.',
              error: 'UPSTREAM_API_ERROR',
              error_code: 'UPSTREAM_API_ERROR',
              upstream_status: response.status,
              detail
            },
            500
          ),
          'failure',
          false,
          0,
          0,
          false,
          false,
          0,
          0,
          0,
          'UPSTREAM_ERROR_500',
          isDeep
        );
      }

      const data: any = await response.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText) {
        if (mode === 'prescription') {
          return logAndReturn(
            jsonResponse({
              is_clear: false,
              retake_message: 'لم نتمكن من التعرف على بيانات الروشتة من الصورة. يرجى إعادة التصوير في مكان ذي إضاءة جيدة والتركيز على كامل الروشتة.',
              confidence: 'low',
              evidence_text: '',
              deduced_condition: '',
              items: [],
              audio_summary: '',
              error_code: 'EMPTY_RESPONSE'
            }),
            'failure',
            false,
            0,
            0,
            false,
            false,
            0,
            0,
            0,
            'EMPTY_RESPONSE',
            isDeep
          );
        }
        return logAndReturn(
          jsonResponse({
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
            error_code: 'EMPTY_RESPONSE'
          }),
          'failure',
          false,
          0,
          0,
          false,
          false,
          0,
          0,
          0,
          'EMPTY_RESPONSE',
          isDeep
        );
      }

      const parsedJson = cleanAndParseJsonText(candidateText);
      if (!parsedJson) {
        if (mode === 'prescription') {
          return logAndReturn(
            jsonResponse({
              is_clear: false,
              retake_message: 'تعذر قراءة بيانات الروشتة بشكل صحيح. يرجى إعادة التقاط الصورة بوضوح.',
              confidence: 'low',
              evidence_text: '',
              deduced_condition: '',
              items: [],
              audio_summary: '',
              error_code: 'INVALID_JSON'
            }),
            'failure',
            false,
            0,
            0,
            false,
            false,
            0,
            0,
            0,
            'INVALID_JSON',
            isDeep
          );
        }
        return logAndReturn(
          jsonResponse({
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
          }),
          'failure',
          false,
          0,
          0,
          false,
          false,
          0,
          0,
          0,
          'INVALID_JSON',
          isDeep
        );
      }

      if (mode === 'prescription') {
        const firstItems = normalizePrescriptionItems(parsedJson?.items);

        // Check if any medicine is low confidence or unclear
        const hasLowConfidence = firstItems.length > 0 && firstItems.some(
          (it: any) => it.confidence === 'low' || it.status === 'unclear'
        );

        // LNF helper to match a list of items
        const applyLnfMatching = (items: any[]) => {
          const tMatchStart = performance.now();
          let matchedCount = 0;
          let correctedCount = 0;
          let notFoundCount = 0;

          const updated = items.map((item: any) => {
            const match = matchLibyanMedicine(
              item.medicine_name_en,
              item.medicine_name_ar,
              item.active_ingredient
            );

            if (match.matched) {
              matchedCount++;
              if (match.correctedNameEn) {
                const origLower = (item.medicine_name_en || '').toLowerCase().trim();
                const corrLower = match.correctedNameEn.toLowerCase().trim();
                if (origLower === corrLower) {
                  item.medicine_name_en = match.correctedNameEn;
                } else if (origLower.startsWith(corrLower + ' ') || origLower.startsWith(corrLower + '-')) {
                  item.medicine_name_en = match.correctedNameEn + (item.medicine_name_en || '').slice(match.correctedNameEn.length);
                } else {
                  correctedCount++;
                  item.medicine_name_en = match.correctedNameEn;
                }
              }
              if (match.genericNameEn) item.active_ingredient = match.genericNameEn;
              if (match.arabicName && (!item.medicine_name_ar || item.medicine_name_ar === 'غير مؤكد' || item.medicine_name_ar.includes('(محتمل)'))) {
                item.medicine_name_ar = match.arabicName;
              }
              item.libyan_brands = match.libyanBrands;
              item.trade_names = match.libyanBrands;
              item.available_forms = match.forms;

              // Raise confidence: at most ONE level, and only for medium/high (never raise 'low' to 'medium')
              // If match was found only after stripping form/direction tokens (confidenceAdjustment === 'keep'), do not boost.
              if (match.confidenceAdjustment === 'boost') {
                if (item.confidence === 'medium') {
                  item.confidence = 'high';
                }
              }

              // Suggested/unclear handwriting stays suggested (presence in directory verifies drug exists, not reading certainty)
              if (item.status === 'suggested' || item.status === 'unclear') {
                item.status = 'suggested';
                item.is_confirmed = false;
                if (!item.warning_note) {
                  item.warning_note = 'محتمل، غير مؤكد - اسأل الصيدلي';
                }
              }
            } else {
              notFoundCount++;
              if (match.isMalformed || item.status === 'unclear') {
                item.status = 'unclear';
                item.confidence = 'low';
                item.is_confirmed = false;
                if (!item.warning_note) {
                  item.warning_note = 'غير واضح، اسأل الصيدلي';
                }
              } else {
                if (item.confidence === 'high') {
                  item.confidence = 'medium';
                } else if (item.confidence === 'medium') {
                  item.confidence = 'low';
                }
              }
            }
            return item;
          });

          const matchElapsedMs = (performance.now() - tMatchStart).toFixed(2);
          console.log(`[LNF Matcher] Processed ${updated.length} items in ${matchElapsedMs}ms. Matched: ${matchedCount}, Corrected: ${correctedCount}, NotFound: ${notFoundCount}`);
          return { updatedItems: updated, matchedCount, correctedCount, notFoundCount };
        };

        // (a) Normal Mode: If any medicine is unclear or low confidence, return first result immediately with hard: true
        if (!isDeep && !body?.retry && hasLowConfidence) {
          const { updatedItems, matchedCount, correctedCount, notFoundCount } = applyLnfMatching(firstItems);
          const medsCount = updatedItems.length;
          const uncCount = updatedItems.filter((i: any) => i.status === 'unclear' || i.confidence === 'low').length;

          return logAndReturn(
            jsonResponse({
              ...parsedJson,
              deduced_condition: typeof parsedJson?.deduced_condition === 'string' ? parsedJson.deduced_condition : '',
              items: updatedItems,
              audio_summary: typeof parsedJson?.audio_summary === 'string' ? parsedJson.audio_summary : '',
              hard: true,
              error_code: null
            }),
            'success',
            false,
            medsCount,
            uncCount,
            false,
            false,
            matchedCount,
            correctedCount,
            notFoundCount,
            '',
            false,
            true // isHard = true
          );
        }

        // (b) Deep Mode (or retry explicitly requested, or all items clear in normal mode):
        let finalItems = firstItems;
        let retryNeeded = false;
        let retryImproved = false;
        let finalAudioSummary = typeof parsedJson?.audio_summary === 'string' ? parsedJson.audio_summary : '';
        let finalCondition = typeof parsedJson?.deduced_condition === 'string' ? parsedJson.deduced_condition : '';

        if (hasLowConfidence && (isDeep || body?.retry)) {
          retryNeeded = true;
          const attempts: Array<{ parsedJson: any; items: any[] }> = [
            { parsedJson, items: firstItems }
          ];

          // Build candidate hints from Libyan National Formulary for unclear items
          const candidateHints: string[] = [];
          firstItems.forEach((it: any, idx: number) => {
            if (it.confidence === 'low' || it.status === 'unclear') {
              const partial = (it.visible_letters || it.medicine_name_en || '').trim();
              if (partial) {
                const candidates = findClosestCandidates(partial, 8);
                if (candidates.length > 0) {
                  candidateHints.push(`Line ${idx + 1} (${it.line_text_as_written || partial}): possible Libyan registered candidates [${candidates.join(', ')}]`);
                }
              }
            }
          });

          // Maximum 2 extra attempts
          for (let attempt = 2; attempt <= 3; attempt++) {
            if (overallDeadlineMs - Date.now() < 5000) {
              console.warn(`[Worker] Overall budget expiring (${overallDeadlineMs - Date.now()}ms left), stopping retries at attempt ${attempt}`);
              break;
            }

            try {
              const retryResp = await executeGeminiCall(14000, candidateHints);
              if (!retryResp.ok) {
                if (retryResp.status === 429) {
                  console.warn(`[Worker] Upstream 429 rate limit hit during retry ${attempt}, stopping retries`);
                  break;
                }
                console.warn(`[Worker] Upstream HTTP ${retryResp.status} during retry ${attempt}, stopping retries`);
                break;
              }

              const retryData: any = await retryResp.json();
              const retryText = retryData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (!retryText) continue;

              const retryJson = cleanAndParseJsonText(retryText);
              if (!retryJson || !Array.isArray(retryJson.items)) continue;

              const retryItems = normalizePrescriptionItems(retryJson.items);
              attempts.push({ parsedJson: retryJson, items: retryItems });

              const anyStillLow = retryItems.some((it: any) => it.confidence === 'low' || it.status === 'unclear');
              if (!anyStillLow) {
                break;
              }
            } catch (retryErr: any) {
              console.warn(`[Worker] Error during prescription retry ${attempt}:`, retryErr?.message);
              break;
            }
          }

          // Merge logic: keep highest confidence reading or most frequent, locking high-confidence medicines
          finalItems = firstItems.map((baseItem: any, idx: number) => {
            if (baseItem.confidence === 'high') {
              return baseItem;
            }

            const candidates: any[] = [];
            for (const att of attempts) {
              if (att.items[idx]) {
                candidates.push(att.items[idx]);
              }
            }

            if (candidates.length <= 1) {
              return baseItem;
            }

            const score = (c: any) => {
              if (c.confidence === 'high') return 3;
              if (c.confidence === 'medium') return 2;
              return 1;
            };

            let maxScore = 1;
            for (const c of candidates) {
              const s = score(c);
              if (s > maxScore) maxScore = s;
            }

            const topCandidates = candidates.filter((c: any) => score(c) === maxScore);
            if (topCandidates.length === 1) {
              return topCandidates[0];
            }

            const freqMap = new Map<string, { count: number; item: any }>();
            for (const c of topCandidates) {
              const key = `${(c.medicine_name_en || '').trim().toLowerCase()}|${(c.medicine_name_ar || '').trim()}`;
              const ex = freqMap.get(key);
              if (ex) {
                ex.count++;
              } else {
                freqMap.set(key, { count: 1, item: c });
              }
            }

            let bestItem = topCandidates[0];
            let maxFreq = 0;
            for (const entry of freqMap.values()) {
              if (entry.count > maxFreq) {
                maxFreq = entry.count;
                bestItem = entry.item;
              }
            }

            return bestItem;
          });

          // Determine if improved
          const initialLowCount = firstItems.filter((i: any) => i.confidence === 'low' || i.status === 'unclear').length;
          const finalLowCount = finalItems.filter((i: any) => i.confidence === 'low' || i.status === 'unclear').length;

          const confSum = (items: any[]) => items.reduce((sum: number, it: any) => {
            return sum + (it.confidence === 'high' ? 3 : (it.confidence === 'medium' ? 2 : 1));
          }, 0);

          const initialScore = confSum(firstItems);
          const finalScore = confSum(finalItems);

          retryImproved = (finalLowCount < initialLowCount) || (finalScore > initialScore);

          for (const att of attempts) {
            if (att.parsedJson?.deduced_condition && !finalCondition) {
              finalCondition = att.parsedJson.deduced_condition;
            }
            if (retryImproved && att.parsedJson?.audio_summary) {
              finalAudioSummary = att.parsedJson.audio_summary;
            }
          }
        }

        const { updatedItems, matchedCount, correctedCount, notFoundCount } = applyLnfMatching(finalItems);
        const medsCount = updatedItems.length;
        const uncCount = updatedItems.filter((i: any) => i.status === 'unclear' || i.confidence === 'low').length;
        const isHard = hasLowConfidence;

        return logAndReturn(
          jsonResponse({
            ...parsedJson,
            deduced_condition: finalCondition,
            items: updatedItems,
            audio_summary: finalAudioSummary,
            hard: isHard,
            deep_improved: isDeep ? retryImproved : false,
            error_code: null
          }),
          'success',
          false,
          medsCount,
          uncCount,
          retryNeeded,
          retryImproved,
          matchedCount,
          correctedCount,
          notFoundCount,
          '',
          isDeep,
          isHard
        );
      }

      const usage_source = parsedJson.usage_source === 'printed' ? 'printed' : 'common';
      return logAndReturn(
        jsonResponse({
          ...parsedJson,
          usage_source,
          error_code: null
        }),
        'success'
      );
    } catch (err: any) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError' || String(err?.message || '').toLowerCase().includes('time out') || String(err?.message || '').toLowerCase().includes('timeout')) {
        return logAndReturn(
          jsonResponse(
            {
              is_clear: false,
              retake_message: 'استغرقت عملية التحليل وقتاً أطول من المتوقع في الخادم (25 ثانية). يرجى المحاولة مرة أخرى.',
              error: 'UPSTREAM_TIMEOUT',
              error_code: 'UPSTREAM_TIMEOUT',
              upstream_status: 504,
              detail: 'Upstream Gemini request timed out after 25 seconds'
            },
            504
          ),
          'failure',
          false,
          0,
          0,
          false,
          false,
          0,
          0,
          0,
          'UPSTREAM_TIMEOUT_504',
          isDeep
        );
      }

      const sanitizedErr = sanitizeMessage(err?.message || String(err));
      console.error('[Worker] Unexpected error:', sanitizedErr);
      return logAndReturn(
        jsonResponse(
          {
            is_clear: false,
            retake_message: 'حدث خطأ غير متوقع أثناء معالجة الصورة. يرجى المحاولة بعد قليل.',
            error: 'INTERNAL_SERVER_ERROR',
            error_code: 'INTERNAL_SERVER_ERROR',
            detail: `Unexpected error: ${sanitizedErr.slice(0, 150)}`
          },
          500
        ),
        'failure',
        false,
        0,
        0,
        false,
        false,
        0,
        0,
        0,
        'INTERNAL_SERVER_ERROR',
        isDeep
      );
    }
  }
};
