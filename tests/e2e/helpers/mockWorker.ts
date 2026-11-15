/**
 * Mock Cloudflare Worker Server for E2E Contract Testing
 * Strictly implements the interface contract defined in PROJECT.md § Interface Contracts
 */

import { sampleBoxPrintedUsage, sampleBoxCommonUsage, sampleBoxDetailsMetformin } from '../fixtures/sampleBoxes';
import {
  sampleClearPrescription,
  sampleMixedPrescription,
  sampleEmptyItemsPrescription,
  samplePhase1ConfirmedPrescription,
  samplePhase1MixedWithSuggestions,
  samplePhase1ChronicPrescription,
  samplePhase1CardiovascularPrescription,
  samplePhase1UnclearFallback
} from '../fixtures/samplePrescriptions';
import { WorkerErrorResponse } from '../fixtures/testContracts';

export interface MockWorkerConfig {
  simulatedDelayMs?: number;
  forceTimeout?: boolean;
  forceRateLimit?: boolean;
  forcePayloadTooLarge?: boolean;
  geminiModelBox?: string;
  geminiModelPrescription?: string;
}

export class MockCloudflareWorker {
  private config: MockWorkerConfig;
  private requestCount = 0;

  constructor(config: MockWorkerConfig = {}) {
    this.config = {
      simulatedDelayMs: 10,
      forceTimeout: false,
      forceRateLimit: false,
      forcePayloadTooLarge: false,
      geminiModelBox: 'gemini-2.5-flash',
      geminiModelPrescription: 'gemini-3.8-flash',
      ...config,
    };
  }

  setConfig(newConfig: Partial<MockWorkerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  async handleRequest(url: string, init: RequestInit = {}): Promise<Response> {
    const method = init.method || 'GET';
    const parsedUrl = new URL(url, 'http://localhost');

    // 1. OPTIONS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // 2. Health check endpoint
    if (method === 'GET' && (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/')) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'dalili-medication-guide-worker',
          model_box: this.config.geminiModelBox,
          model_prescription: this.config.geminiModelPrescription,
          hasApiKey: true,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }

    if (method !== 'POST') {
      const err: WorkerErrorResponse = {
        is_clear: false,
        error: 'METHOD_NOT_ALLOWED',
        error_code: 'METHOD_NOT_ALLOWED',
        retake_message: 'طريقة الطلب غير مدعومة. يرجى استخدام POST فقط.',
      };
      return new Response(JSON.stringify(err), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }

    // 3. Simulated Rate Limit Check
    this.requestCount++;
    if (this.config.forceRateLimit || this.requestCount > 10) {
      const err: WorkerErrorResponse = {
        is_clear: false,
        error: 'RATE_LIMIT_EXCEEDED',
        error_code: 'RATE_LIMIT_EXCEEDED',
        retake_message: 'تم تجاوز حد الاستخدام المسموح (10 تحليلات في الدقيقة). يرجى الانتظار دقيقة قبل المحاولة مجدداً.',
      };
      return new Response(JSON.stringify(err), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    // 4. Parse JSON body
    let body: any = {};
    try {
      body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
    } catch {
      const err: WorkerErrorResponse = {
        is_clear: false,
        error: 'BAD_REQUEST',
        error_code: 'BAD_REQUEST',
        retake_message: 'صيغة الطلب غير صالحة.',
      };
      return new Response(JSON.stringify(err), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 5. Check Payload Size Limit (4MB)
    const rawBodyLength = typeof init.body === 'string' ? init.body.length : 0;
    if (this.config.forcePayloadTooLarge || rawBodyLength > 4 * 1024 * 1024) {
      const err: WorkerErrorResponse = {
        is_clear: false,
        error: 'PAYLOAD_TOO_LARGE',
        error_code: 'PAYLOAD_TOO_LARGE',
        retake_message: 'حجم الصورة كبير جداً ويتجاوز الحد المسموح به. يرجى تصغير الصورة.',
      };
      return new Response(JSON.stringify(err), { status: 413, headers: { 'Content-Type': 'application/json' } });
    }

    // 6. Simulate 25-Second Abort / Timeout
    if (this.config.forceTimeout) {
      const err: WorkerErrorResponse = {
        is_clear: false,
        error: 'UPSTREAM_TIMEOUT',
        error_code: 'UPSTREAM_TIMEOUT',
        retake_message: 'استغرقت الخدمة وقتاً أطول من المعتاد. يرجى إعادة المحاولة.',
        detail: 'Upstream Gemini aborted after 25s limit reached',
      };
      return new Response(JSON.stringify(err), { status: 504, headers: { 'Content-Type': 'application/json' } });
    }

    // 7. Route / Mode Dispatch
    const mode = body.mode || (parsedUrl.pathname.includes('prescription') ? 'prescription' : 'box');

    // Details Mode (Text-only lookup)
    if (mode === 'details') {
      const medicineName = body.medicine_name || '';
      if (!medicineName.trim()) {
        const err: WorkerErrorResponse = {
          is_clear: false,
          error: 'BAD_REQUEST',
          error_code: 'MISSING_MEDICINE_NAME',
          retake_message: 'يرجى تحديد اسم الدواء المطلوب.',
        };
        return new Response(JSON.stringify(err), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const response = {
        ...sampleBoxDetailsMetformin,
        medicine_name_en: medicineName,
        medicine_name_ar: medicineName.includes('ميتفورمين') ? medicineName : sampleBoxDetailsMetformin.medicine_name_ar,
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    // Prescription Mode
    if (mode === 'prescription') {
      if (!body.image) {
        const err: WorkerErrorResponse = {
          is_clear: false,
          error: 'BAD_REQUEST',
          error_code: 'MISSING_IMAGE',
          retake_message: 'لم يتم إرسال صورة الروشتة.',
        };
        return new Response(JSON.stringify(err), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      if (body.image.includes('unclear_empty')) {
        return new Response(JSON.stringify(sampleEmptyItemsPrescription), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (body.image.includes('mixed')) {
        return new Response(JSON.stringify(sampleMixedPrescription), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (body.image.includes('phase1_suggestions')) {
        return new Response(JSON.stringify(samplePhase1MixedWithSuggestions), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (body.image.includes('phase1_confirmed')) {
        return new Response(JSON.stringify(samplePhase1ConfirmedPrescription), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (body.image.includes('phase1_chronic')) {
        return new Response(JSON.stringify(samplePhase1ChronicPrescription), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (body.image.includes('phase1_cardio')) {
        return new Response(JSON.stringify(samplePhase1CardiovascularPrescription), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (body.image.includes('phase1_unclear')) {
        return new Response(JSON.stringify(samplePhase1UnclearFallback), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(sampleClearPrescription), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Box Mode (Default)
    if (!body.image) {
      const err: WorkerErrorResponse = {
        is_clear: false,
        error: 'BAD_REQUEST',
        error_code: 'MISSING_IMAGE',
        retake_message: 'لم يتم استلام صورة علبة الدواء.',
      };
      return new Response(JSON.stringify(err), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (body.image.includes('common_usage')) {
      return new Response(JSON.stringify(sampleBoxCommonUsage), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(sampleBoxPrintedUsage), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
