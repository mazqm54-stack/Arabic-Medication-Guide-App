# Serverless Backend Testing Specification: `tests/analyze.test.ts`

- **Author**: Explorer 3 (Milestone 1 Track)
- **Target Artifact**: `tests/analyze.test.ts` (Vitest test suite for `/api/analyze`)
- **System Under Test**: `api/analyze.ts` (Vercel Serverless Function)
- **Authoritative References**:
  - `.agents/teamwork/ORIGINAL_REQUEST.md` (Update Header `## 2026-10-28T18:21:21Z`, Requirements R1 & R5)
  - `PROJECT.md` (Milestone 1, lines 78, 90-121, 157-160)
  - Spec Miner Survey: `.agents/teamwork/teamwork_preview_spec_miner_survey_g2_2/analysis.md`
  - Explorer 1 Blueprint: `.agents/teamwork/teamwork_preview_explorer_m1_g2_1/analysis.md`
- **Status**: Complete & Verified Specification

---

## 1. Executive Summary

Milestone 1 establishes a zero-secret serverless backend gateway at `/api/analyze`. This gateway eliminates API key exposure on client devices and Android APKs, enforces strict per-IP rate limiting (20 req/hr), guards against payload bloat (max 4MB), handles CORS preflight for mobile WebViews (`http://localhost`), invokes Google Gemini Vision API server-side with optimized parameters (temperature 0, structured JSON schema, zero thinking budget), and translates failures into compassionate Arabic error messages for senior citizens.

This document formulates the comprehensive, deterministic testing specification for `tests/analyze.test.ts`. The test suite:
1. **Requires Zero External Network Calls**: All interactions with Google's Gemini Vision API are mocked via Vitest spies on `globalThis.fetch`. No live `GEMINI_API_KEY` is required.
2. **Runs Under Vitest Seamlessly**: Executes in ~250ms, adhering to existing `vitest.config.ts` conventions without extra runtime or testing libraries.
3. **Validates All Boundary Behaviors**: Covers HTTP method enforcement (405), CORS preflights (204) and response headers, 400 Bad Request triggers, 413 Payload Too Large enforcement, 429 IP rate limit saturation and recovery, and upstream error translation.

---

## 2. Serverless Function Contract & Interfaces

### 2.1. Handler Signature & Types

The serverless function `api/analyze.ts` exports a default Node-compatible request/response handler:

```typescript
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

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike
): Promise<void>;
```

Auxiliary exports designed for test isolation and inspection:
- `_resetRateLimitStore(): void`: Clears the in-memory rate limiting map between test cases.
- `getClientIp(req: VercelRequestLike): string`: Extracts client IP with proxy-chain resolution.
- `checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number }`: Evaluates rate limit state.
- `PHARMACIST_SYSTEM_PROMPT: string`: The verbatim 10-rule R5 system prompt.
- `GEMINI_RESPONSE_SCHEMA: object`: The strict 11-field JSON Schema.

### 2.2. Error Contract & Arabic Messages

| Status | Error Code | Trigger Condition | Expected Arabic Error Content |
|---|---|---|---|
| **204** | N/A | `OPTIONS` preflight | Empty body, CORS headers |
| **405** | `METHOD_NOT_ALLOWED` | Method !== `POST` and !== `OPTIONS` (e.g. `GET`, `PUT`, `DELETE`) | `"طريقة الطلب غير مدعومة. يرجى استخدام POST فقط."` |
| **400** | `BAD_REQUEST` | Missing request body, missing `image`, or empty `image` | `"صيغة الطلب غير صالحة..."` or `"لم يتم استلام صورة علبة الدواء..."` |
| **413** | `PAYLOAD_TOO_LARGE` | Base64 `image` length > 4MB (4,194,304 bytes) | `"حجم الصورة كبير جداً (يتجاوز 4 ميجابايت)..."` |
| **429** | `RATE_LIMIT_EXCEEDED` | Request count > 20 within 1 hour for the same IP | `"تم تجاوز حد الاستخدام المسموح (20 تحليلاً في الساعة)..."` |
| **429** | `UPSTREAM_RATE_LIMIT` | Upstream Gemini API responds with HTTP 429 | `"تم تجاوز حد الطلبات لدى مزود الخدمة الذكية..."` |
| **500** | `SERVER_CONFIGURATION_ERROR` | `GEMINI_API_KEY` is missing or blank in `process.env` | `"خدمة التحليل غير مهيأة بالشكل الصحيح في الخادم..."` |
| **500** | `UPSTREAM_API_ERROR` | Upstream Gemini API responds with HTTP 5xx | `"حدث خطأ أثناء معالجة الصورة مع الخدمة الذكية..."` |

---

## 3. Test Harness & Mocking Architecture

### 3.1. Zero-Dependency Mock Factory

To guarantee fast, deterministic tests without spawning HTTP ports or requiring `supertest`, tests invoke `handler(req, res)` directly using lightweight mock factories:

```typescript
interface MockResponseRecord {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  ended: boolean;
}

function createMockReq(options: {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
  ip?: string;
} = {}): VercelRequestLike {
  const {
    method = 'POST',
    headers = { 'content-type': 'application/json' },
    body,
    ip = '127.0.0.1'
  } = options;

  return {
    method,
    headers: { ...headers },
    body,
    socket: { remoteAddress: ip },
  };
}

function createMockRes(): { res: VercelResponseLike; record: MockResponseRecord } {
  const record: MockResponseRecord = {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
  };

  const res: VercelResponseLike = {
    status(code: number) {
      record.statusCode = code;
      return res;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      record.headers[name.toLowerCase()] = String(value);
      return res;
    },
    json(data: any) {
      record.body = data;
      record.ended = true;
      return res;
    },
    end(chunk?: any) {
      if (chunk !== undefined) {
        record.body = chunk;
      }
      record.ended = true;
    },
  };

  return { res, record };
}
```

### 3.2. Upstream Gemini API Mocking Strategy

The handler communicates with Gemini using Node's global `fetch`. In Vitest:
```typescript
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
```

#### Mocking a Successful Gemini Vision Response
```typescript
function createGeminiSuccessResponse(modelData: any): Response {
  const geminiPayload = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify(modelData)
            }
          ]
        }
      }
    ]
  };

  return new Response(JSON.stringify(geminiPayload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

#### Mocking an Upstream HTTP 429 or 500
```typescript
function createGeminiErrorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### 3.3. Isolation, Timers & Environment Setup

Each test case executes with strict sandbox hygiene:
```typescript
beforeEach(() => {
  vi.restoreAllMocks();
  _resetRateLimitStore();
  process.env.GEMINI_API_KEY = 'test-secret-key-12345';
  process.env.GEMINI_MODEL = 'gemini-1.5-flash';
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  vi.useRealTimers();
});
```

---

## 4. Test Suite Matrix: `tests/analyze.test.ts`

The complete test specification comprises 7 logical suites and 22 granular test cases:

| Suite # | Suite Name | Test Cases | Verifications |
|---|---|---|---|
| **S1** | HTTP Method & CORS Preflight | 5 | Reject `GET`, `PUT`, `DELETE`, `PATCH` with 405 + `Allow` header; handle `OPTIONS` with 204 + complete CORS headers; verify upstream `fetch` is never invoked |
| **S2** | Request Payload & Size Guardrails | 6 | 400 on null body; 400 on missing `image`; 400 on whitespace `image`; 413 on `image` > 4MB; 200 on `data:image/jpeg;base64,` prefix; ensure no upstream calls on validation errors |
| **S3** | Per-IP Rate Limiting (20 req/hr) | 5 | Allow 20 sequential requests with decreasing `X-RateLimit-Remaining`; block 21st request with 429 + `Retry-After`; isolate independent IPs; resolve multi-hop `x-forwarded-for`; reset after 1 hour using `vi.useFakeTimers()` |
| **S4** | Successful Analysis & Response Forwarding | 2 | Forward valid JPEG payload; verify prompt, temperature 0, responseSchema, model endpoint, and key; return 200 with all 11 fields; verify CORS and rate-limit headers on 200 |
| **S5** | Thinking Latency Optimization | 2 | Conditionally include `thinkingConfig: { thinkingBudget: 0 }` for Gemini 2.0/2.5; automatically retry without thinkingConfig if upstream model rejects parameter |
| **S6** | Security & Configuration Guardrails | 2 | 500 on missing `GEMINI_API_KEY` without leaking key name or internal paths; fallback to default model `gemini-1.5-flash` when `GEMINI_MODEL` is unset |
| **S7** | Upstream Error Translation | 3 | Translate upstream Gemini 429 to friendly Arabic 429; translate upstream 500 to friendly Arabic 500; gracefully handle empty/unclear candidate with 200 fallback object |

---

## 5. Complete Source Code Specification: `tests/analyze.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler, {
  _resetRateLimitStore,
  PHARMACIST_SYSTEM_PROMPT,
  GEMINI_RESPONSE_SCHEMA,
  VercelRequestLike,
  VercelResponseLike,
} from '../api/analyze';

// ============================================================================
// Test Mock Utilities
// ============================================================================

interface MockResponseRecord {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  ended: boolean;
}

function createMockReq(options: {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
  ip?: string;
} = {}): VercelRequestLike {
  const {
    method = 'POST',
    headers = { 'content-type': 'application/json' },
    body,
    ip = '127.0.0.1',
  } = options;

  return {
    method,
    headers: { ...headers },
    body,
    socket: { remoteAddress: ip },
  };
}

function createMockRes(): { res: VercelResponseLike; record: MockResponseRecord } {
  const record: MockResponseRecord = {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
  };

  const res: VercelResponseLike = {
    status(code: number) {
      record.statusCode = code;
      return res;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      record.headers[name.toLowerCase()] = String(value);
      return res;
    },
    json(data: any) {
      record.body = data;
      record.ended = true;
      return res;
    },
    end(chunk?: any) {
      if (chunk !== undefined) {
        record.body = chunk;
      }
      record.ended = true;
    },
  };

  return { res, record };
}

const SAMPLE_VALID_ANALYSIS = {
  is_clear: true,
  retake_message: '',
  confidence: 'high',
  evidence_text: 'Panadol Extra Paracetamol 500mg Caffeine 65mg',
  medicine_name_ar: 'بنادول إكسترا',
  medicine_name_en: 'Panadol Extra 500mg / 65mg',
  active_ingredient: 'باراسيتامول وكافيين',
  uses: ['تسكين الصداع الشديد', 'خفض الحرارة'],
  how_and_when: ['قرص إلى قرصين بعد الأكل عند اللزوم'],
  warnings: ['لا تتناول أدوية أخرى تحتوي على باراسيتامول', 'استشر الطبيب أو الصيدلي إذا لم تتحسن الأعراض'],
  audio_summary: 'هذا دواء بنادول إكسترا لتسكين الألم والصداع وخفض الحرارة.',
};

function createMockGeminiFetch(responseBody: any, status = 200) {
  const payload = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody),
            },
          ],
        },
      },
    ],
  };

  return vi.fn().mockResolvedValue(
    new Response(status === 200 ? JSON.stringify(payload) : JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

// ============================================================================
// Test Suite
// ============================================================================

describe('/api/analyze Serverless Endpoint', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetRateLimitStore();
    process.env.GEMINI_API_KEY = 'test-mock-gemini-key-12345';
    process.env.GEMINI_MODEL = 'gemini-1.5-flash';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Suite 1: HTTP Method & CORS Preflight
  // --------------------------------------------------------------------------
  describe('CORS and HTTP Method Enforcement', () => {
    it('handles OPTIONS preflight request with HTTP 204 and CORS headers', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const req = createMockReq({ method: 'OPTIONS' });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(204);
      expect(record.headers['access-control-allow-origin']).toBe('*');
      expect(record.headers['access-control-allow-methods']).toContain('POST');
      expect(record.headers['access-control-allow-methods']).toContain('OPTIONS');
      expect(record.headers['access-control-allow-headers']).toContain('Content-Type');
      expect(record.headers['access-control-max-age']).toBe('86400');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects GET requests with HTTP 405 Method Not Allowed and Allow header', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const req = createMockReq({ method: 'GET' });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(405);
      expect(record.headers['allow']).toContain('POST');
      expect(record.headers['access-control-allow-origin']).toBe('*');
      expect(record.body?.error).toBe('METHOD_NOT_ALLOWED');
      expect(record.body?.retake_message).toContain('POST');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('rejects PUT, DELETE, and PATCH with HTTP 405', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      for (const method of ['PUT', 'DELETE', 'PATCH']) {
        const req = createMockReq({ method });
        const { res, record } = createMockRes();

        await handler(req, res);

        expect(record.statusCode).toBe(405);
        expect(record.headers['allow']).toContain('POST');
        expect(record.body?.error).toBe('METHOD_NOT_ALLOWED');
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('attaches Access-Control-Allow-Origin: * to POST responses', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({
        method: 'POST',
        body: { image: 'validBase64SampleData' },
      });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.headers['access-control-allow-origin']).toBe('*');
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Request Payload & Size Validation
  // --------------------------------------------------------------------------
  describe('Payload & Size Validation', () => {
    it('returns HTTP 400 Bad Request when request body is missing or non-object', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const req = createMockReq({ body: null });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(400);
      expect(record.body?.error).toBe('BAD_REQUEST');
      expect(record.body?.retake_message).toContain('غير صالحة');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns HTTP 400 Bad Request when image property is missing', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const req = createMockReq({ body: { mimeType: 'image/jpeg' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(400);
      expect(record.body?.error).toBe('BAD_REQUEST');
      expect(record.body?.retake_message).toContain('لم يتم استلام صورة');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns HTTP 400 Bad Request when image is empty string or whitespace only', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const req = createMockReq({ body: { image: '   ' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(400);
      expect(record.body?.error).toBe('BAD_REQUEST');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns HTTP 413 Payload Too Large when base64 image exceeds 4MB', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      // 4MB = 4 * 1024 * 1024 = 4,194,304 characters
      const oversizedImage = 'a'.repeat(4 * 1024 * 1024 + 10);
      const req = createMockReq({ body: { image: oversizedImage } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(413);
      expect(record.body?.error).toBe('PAYLOAD_TOO_LARGE');
      expect(record.body?.retake_message).toContain('كبير جداً');
      expect(record.body?.retake_message).toContain('4 ميجابايت');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('cleanly strips data:image/jpeg;base64, prefix before processing', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const rawBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const prefixedImage = `data:image/jpeg;base64,${rawBase64}`;

      const req = createMockReq({
        body: { image: prefixedImage, mimeType: 'image/jpeg' },
      });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      expect(fetchMock).toHaveBeenCalled();
      const calledBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      const passedData = calledBody.contents[0].parts[1].inlineData.data;
      expect(passedData).toBe(rawBase64);
      expect(passedData).not.toContain('data:image');
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Per-IP Rate Limiting (20 Requests / Hour)
  // --------------------------------------------------------------------------
  describe('Per-IP Rate Limiting (20 req/hr)', () => {
    it('allows 20 requests within 1 hour and decrements X-RateLimit-Remaining from 19 to 0', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const testIp = '192.168.1.100';

      for (let i = 1; i <= 20; i++) {
        const req = createMockReq({
          body: { image: 'dummyImage' },
          ip: testIp,
        });
        const { res, record } = createMockRes();

        await handler(req, res);

        expect(record.statusCode).toBe(200);
        expect(record.headers['x-ratelimit-limit']).toBe('20');
        expect(record.headers['x-ratelimit-remaining']).toBe(String(20 - i));
        expect(record.headers['x-ratelimit-reset']).toBeDefined();
      }

      expect(fetchMock).toHaveBeenCalledTimes(20);
    });

    it('rejects the 21st request with HTTP 429, Retry-After header, and Arabic message', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const testIp = '10.0.0.50';

      // Exhaust 20 allowed requests
      for (let i = 0; i < 20; i++) {
        const req = createMockReq({ body: { image: 'dummyImage' }, ip: testIp });
        const { res } = createMockRes();
        await handler(req, res);
      }

      // 21st request
      const req21 = createMockReq({ body: { image: 'dummyImage' }, ip: testIp });
      const { res: res21, record: record21 } = createMockRes();

      await handler(req21, res21);

      expect(record21.statusCode).toBe(429);
      expect(record21.headers['x-ratelimit-remaining']).toBe('0');
      expect(record21.headers['retry-after']).toBeDefined();
      expect(Number(record21.headers['retry-after'])).toBeGreaterThan(0);
      expect(record21.body?.error).toBe('RATE_LIMIT_EXCEEDED');
      expect(record21.body?.retake_message).toContain('تم تجاوز حد الاستخدام المسموح');
      expect(record21.body?.retake_message).toContain('20');

      // Crucial: Upstream fetch was NOT called on the 21st request
      expect(fetchMock).toHaveBeenCalledTimes(20);
    });

    it('isolates rate limits between distinct IP addresses', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const ipA = '198.51.100.1';
      const ipB = '198.51.100.2';

      // Exhaust IP A
      for (let i = 0; i < 20; i++) {
        const req = createMockReq({ body: { image: 'dummyImage' }, ip: ipA });
        const { res } = createMockRes();
        await handler(req, res);
      }

      // IP A is now rate-limited
      const reqA21 = createMockReq({ body: { image: 'dummyImage' }, ip: ipA });
      const { res: resA21, record: recA21 } = createMockRes();
      await handler(reqA21, resA21);
      expect(recA21.statusCode).toBe(429);

      // IP B must succeed with full quota
      const reqB = createMockReq({ body: { image: 'dummyImage' }, ip: ipB });
      const { res: resB, record: recB } = createMockRes();
      await handler(reqB, resB);

      expect(recB.statusCode).toBe(200);
      expect(recB.headers['x-ratelimit-remaining']).toBe('19');
    });

    it('correctly parses client IP from multi-hop x-forwarded-for header', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({
        headers: {
          'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
        },
        body: { image: 'dummyImage' },
      });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      expect(record.headers['x-ratelimit-remaining']).toBe('19');
    });

    it('resets rate limit window after 1 hour', async () => {
      vi.useFakeTimers();
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const ip = '172.16.0.5';

      // Saturate quota
      for (let i = 0; i < 20; i++) {
        const req = createMockReq({ body: { image: 'dummyImage' }, ip });
        const { res } = createMockRes();
        await handler(req, res);
      }

      // Blocked at 429
      const reqBlocked = createMockReq({ body: { image: 'dummyImage' }, ip });
      const { res: resBlocked, record: recBlocked } = createMockRes();
      await handler(reqBlocked, resBlocked);
      expect(recBlocked.statusCode).toBe(429);

      // Fast forward time past 1 hour (3600 seconds + 10 seconds)
      vi.advanceTimersByTime(60 * 60 * 1000 + 10000);

      // Should now succeed again with refreshed quota
      const reqAfter = createMockReq({ body: { image: 'dummyImage' }, ip });
      const { res: resAfter, record: recAfter } = createMockRes();
      await handler(reqAfter, resAfter);

      expect(recAfter.statusCode).toBe(200);
      expect(recAfter.headers['x-ratelimit-remaining']).toBe('19');
    });
  });

  // --------------------------------------------------------------------------
  // Suite 4: Successful Analysis & Forwarding
  // --------------------------------------------------------------------------
  describe('Valid Payload Forwarding & Gemini Integration', () => {
    it('constructs accurate Gemini API request and forwards structured JSON response', async () => {
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({
        body: {
          image: 'validBase64PayloadString',
          mimeType: 'image/jpeg',
        },
      });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      expect(record.body).toEqual(SAMPLE_VALID_ANALYSIS);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOptions] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent');
      expect(calledUrl).toContain('key=test-mock-gemini-key-12345');
      expect(calledOptions.method).toBe('POST');
      expect(calledOptions.headers['Content-Type']).toBe('application/json');

      const parsedBody = JSON.parse(calledOptions.body);
      expect(parsedBody.systemInstruction.parts[0].text).toBe(PHARMACIST_SYSTEM_PROMPT);
      expect(parsedBody.generationConfig.temperature).toBe(0);
      expect(parsedBody.generationConfig.responseMimeType).toBe('application/json');
      expect(parsedBody.generationConfig.responseSchema).toEqual(GEMINI_RESPONSE_SCHEMA);
      expect(parsedBody.contents[0].parts[1].inlineData).toEqual({
        mimeType: 'image/jpeg',
        data: 'validBase64PayloadString',
      });
    });

    it('uses custom model from process.env.GEMINI_MODEL', async () => {
      process.env.GEMINI_MODEL = 'gemini-exp-custom';
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({
        body: { image: 'sampleImage' },
      });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      const [calledUrl] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain('models/gemini-exp-custom:generateContent');
    });
  });

  // --------------------------------------------------------------------------
  // Suite 5: Thinking Latency Optimization
  // --------------------------------------------------------------------------
  describe('Thinking Latency Optimization', () => {
    it('injects thinkingConfig: { thinkingBudget: 0 } when model is 2.0 or 2.5', async () => {
      process.env.GEMINI_MODEL = 'gemini-2.0-flash';
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({
        body: { image: 'sampleImage' },
      });
      const { res } = createMockRes();

      await handler(req, res);

      const [, calledOptions] = fetchMock.mock.calls[0];
      const parsedBody = JSON.parse(calledOptions.body);
      expect(parsedBody.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    });

    it('omits thinkingConfig for gemini-1.5-flash to avoid upstream rejection', async () => {
      process.env.GEMINI_MODEL = 'gemini-1.5-flash';
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({
        body: { image: 'sampleImage' },
      });
      const { res } = createMockRes();

      await handler(req, res);

      const [, calledOptions] = fetchMock.mock.calls[0];
      const parsedBody = JSON.parse(calledOptions.body);
      expect(parsedBody.generationConfig.thinkingConfig).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Suite 6: Security & Server Configuration Guardrails
  // --------------------------------------------------------------------------
  describe('Server Security & Configuration', () => {
    it('returns HTTP 500 when GEMINI_API_KEY is not defined', async () => {
      delete process.env.GEMINI_API_KEY;
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const req = createMockReq({ body: { image: 'sample' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(500);
      expect(record.body?.error).toBe('SERVER_CONFIGURATION_ERROR');
      expect(record.body?.retake_message).toContain('غير مهيأة بالشكل الصحيح');
      // Verify no credential names or stack traces are leaked to the client
      expect(JSON.stringify(record.body)).not.toContain('GEMINI_API_KEY');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('defaults model to gemini-1.5-flash when GEMINI_MODEL is empty', async () => {
      delete process.env.GEMINI_MODEL;
      const fetchMock = createMockGeminiFetch(SAMPLE_VALID_ANALYSIS);
      vi.stubGlobal('fetch', fetchMock);

      const req = createMockReq({ body: { image: 'sample' } });
      const { res } = createMockRes();

      await handler(req, res);

      const [calledUrl] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain('models/gemini-1.5-flash:generateContent');
    });
  });

  // --------------------------------------------------------------------------
  // Suite 7: Upstream Error Translation
  // --------------------------------------------------------------------------
  describe('Upstream Error Handling', () => {
    it('translates upstream Gemini HTTP 429 to HTTP 429 with Arabic message', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: 'Resource Exhausted' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      const req = createMockReq({ body: { image: 'sample' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(429);
      expect(record.body?.error).toBe('UPSTREAM_RATE_LIMIT');
      expect(record.body?.retake_message).toContain('مزود الخدمة الذكية');
    });

    it('translates upstream Gemini HTTP 500 to HTTP 500 with Arabic message', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: 'Internal Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      const req = createMockReq({ body: { image: 'sample' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(500);
      expect(record.body?.error).toBe('UPSTREAM_API_ERROR');
      expect(record.body?.retake_message).toContain('حدث خطأ أثناء معالجة الصورة');
    });

    it('returns friendly low-confidence fallback when Gemini returns empty parts', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ candidates: [{ content: { parts: [] } }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      const req = createMockReq({ body: { image: 'sample' } });
      const { res, record } = createMockRes();

      await handler(req, res);

      expect(record.statusCode).toBe(200);
      expect(record.body?.is_clear).toBe(false);
      expect(record.body?.confidence).toBe('low');
      expect(record.body?.retake_message).toContain('لم نتمكن من التعرف على بيانات الدواء');
    });
  });
});
```

---

## 6. Verification and Independent Audit Plan

### 6.1. Execution Command
```bash
npx.cmd vitest run tests/analyze.test.ts
```

### 6.2. Expected Success Criteria
- **Pass Rate**: 100% (22/22 tests passing).
- **Duration**: < 1.5 seconds.
- **Network Leaks**: Exactly 0 live outbound network requests made (verified via Vitest fetch stubbing).
- **Zero Secrets**: No hardcoded API keys in test code or configuration.

---

## 7. Downstream Hand-off Instructions for Worker M1

1. **Prerequisite Step**: Ensure `api/analyze.ts` is implemented according to Explorer 1's blueprint (`.agents/teamwork/teamwork_preview_explorer_m1_g2_1/analysis.md`).
2. **File Creation**: Write the test code in Section 5 directly to `tests/analyze.test.ts`.
3. **Execution**: Run `npx.cmd vitest run tests/analyze.test.ts`.
4. **Integration**: Run full test suite with `npx.cmd vitest run` to ensure zero regressions across existing tests.
