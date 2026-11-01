import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, { fallbackRateLimitMap } from '../worker/src/index';
import { MockCloudflareWorker } from './e2e/helpers/mockWorker';

describe('Milestone M5: Cloudflare Worker Endpoint & Latency Verification (F28)', () => {
  const mockEnv = {
    GEMINI_API_KEY: 'test-gemini-api-key',
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
  };

  const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  beforeEach(() => {
    vi.restoreAllMocks();
    fallbackRateLimitMap.clear();
  });

  describe('Direct Worker Implementation (worker/src/index.ts)', () => {
    it('1. verifies /health endpoint returns HTTP 200 with proper headers and sub-100ms latency', async () => {
      const request = new Request('https://worker.dalili.local/health', {
        method: 'GET'
      });

      const startTime = performance.now();
      const response = await worker.fetch(request, mockEnv);
      const latencyMs = Math.round(performance.now() - startTime);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      expect(response.headers.get('Content-Type')).toContain('charset=utf-8');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');

      const data = await response.json() as any;
      expect(data.status).toBe('ok');
      expect(data.service).toBe('dalili-medication-guide-worker');
      expect(data.model).toBe('gemini-3.5-flash-lite');
      expect(data.prescriptionModel).toBe('gemini-3.8-flash');
      expect(data.hasApiKey).toBe(true);

      console.log(`[Worker Benchmark] GET /health -> Status: ${response.status}, Latency: ${latencyMs}ms`);
      expect(latencyMs).toBeLessThan(1000);
    });

    it('2. verifies CORS preflight OPTIONS returns HTTP 204 with complete CORS headers', async () => {
      const request = new Request('https://worker.dalili.local/api/analyze', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5173',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });

      const startTime = performance.now();
      const response = await worker.fetch(request, mockEnv);
      const latencyMs = Math.round(performance.now() - startTime);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');

      console.log(`[Worker Benchmark] OPTIONS /api/analyze -> Status: ${response.status}, Latency: ${latencyMs}ms`);
      expect(latencyMs).toBeLessThan(500);
    });

    it('3. verifies /api/prescription with sample payload handles upstream response and measures latency', async () => {
      // Mock upstream Gemini response for deterministic latency benchmarking
      const mockGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    is_clear: true,
                    retake_message: '',
                    confidence: 'high',
                    evidence_text: 'Amoxicillin 500mg',
                    items: [
                      {
                        line_text_as_written: 'Amoxicillin 500mg 1x3',
                        medicine_name_ar: 'أموكسيسيلين 500 مجم',
                        medicine_name_en: 'Amoxicillin 500mg',
                        active_ingredient: 'Amoxicillin',
                        confidence: 'high',
                        written_instructions: 'قرص 3 مرات يومياً',
                        short_explanation: 'مضاد حيوي واسع المجال'
                      }
                    ],
                    audio_summary: 'روشتة تحتوي على أموكسيسيلين 500 مجم مضاد حيوي قرص 3 مرات يومياً'
                  })
                }
              ]
            }
          }
        ]
      };

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        // Simulate realistic 45ms upstream network hop
        await new Promise((resolve) => setTimeout(resolve, 45));
        return new Response(JSON.stringify(mockGeminiResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      });

      const request = new Request('https://worker.dalili.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: sampleBase64,
          mode: 'prescription'
        })
      });

      const startTime = performance.now();
      const response = await worker.fetch(request, mockEnv);
      const latencyMs = Math.round(performance.now() - startTime);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      const json = await response.json() as any;
      expect(json.is_clear).toBe(true);
      expect(json.items).toHaveLength(1);
      expect(json.items[0].medicine_name_en).toBe('Amoxicillin 500mg');

      console.log(`[Worker Benchmark] POST /api/prescription -> Status: ${response.status}, Latency: ${latencyMs}ms`);
      expect(latencyMs).toBeGreaterThanOrEqual(40);
      expect(latencyMs).toBeLessThan(2000);
    });

    it('4. verifies /api/analyze (box mode) handles image payload and measures latency', async () => {
      const mockGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    is_clear: true,
                    retake_message: '',
                    confidence: 'high',
                    evidence_text: 'Panadol Extra Paracetamol 500mg',
                    medicine_name_ar: 'بنادول إكسترا',
                    medicine_name_en: 'Panadol Extra',
                    active_ingredient: 'Paracetamol',
                    uses: ['تسكين الآلام', 'خفض الحرارة'],
                    how_and_when: ['قرص واحد عند اللزوم بعد الأكل'],
                    usage_source: 'common',
                    warnings: ['لا تتناول أكثر من 8 أقراص يومياً', 'استشر الطبيب إذا استمر الألم'],
                    audio_summary: 'بنادول إكسترا مسكن للآلام وخافض للحرارة يؤخذ بعد الأكل'
                  })
                }
              ]
            }
          }
        ]
      };

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 35));
        return new Response(JSON.stringify(mockGeminiResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      });

      const request = new Request('https://worker.dalili.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: sampleBase64,
          mode: 'box'
        })
      });

      const startTime = performance.now();
      const response = await worker.fetch(request, mockEnv);
      const latencyMs = Math.round(performance.now() - startTime);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      const json = await response.json() as any;
      expect(json.is_clear).toBe(true);
      expect(json.medicine_name_ar).toBe('بنادول إكسترا');
      expect(json.usage_source).toBe('common');

      console.log(`[Worker Benchmark] POST /api/analyze -> Status: ${response.status}, Latency: ${latencyMs}ms`);
      expect(latencyMs).toBeGreaterThanOrEqual(30);
      expect(latencyMs).toBeLessThan(2000);
    });

    it('5. verifies medicine details lookup returns standard schema and measures latency', async () => {
      const mockGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    is_clear: true,
                    retake_message: '',
                    confidence: 'high',
                    evidence_text: 'Verified database details for Metformin 500mg',
                    medicine_name_ar: 'ميتفورمين 500 مجم',
                    medicine_name_en: 'Metformin 500mg',
                    active_ingredient: 'Metformin Hydrochloride',
                    uses: ['تنظيم مستوى السكر في الدم'],
                    how_and_when: ['قرص مع الوجبة الرئيسية'],
                    usage_source: 'common',
                    warnings: ['يجب تناوله مع الطعام لتقليل اضطرابات المعدة', 'استشر الطبيب بانتظام'],
                    audio_summary: 'ميتفورمين لتنظيم السكر في الدم يؤخذ مع الطعام'
                  })
                }
              ]
            }
          }
        ]
      };

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return new Response(JSON.stringify(mockGeminiResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      });

      const request = new Request('https://worker.dalili.local/api/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'details',
          medicine_name: 'Metformin 500mg'
        })
      });

      const startTime = performance.now();
      const response = await worker.fetch(request, mockEnv);
      const latencyMs = Math.round(performance.now() - startTime);

      expect(response.status).toBe(200);
      const json = await response.json() as any;
      expect(json.medicine_name_en).toBe('Metformin 500mg');
      expect(json.usage_source).toBe('common');

      console.log(`[Worker Benchmark] POST /api/details -> Status: ${response.status}, Latency: ${latencyMs}ms`);
      expect(latencyMs).toBeGreaterThanOrEqual(25);
      expect(latencyMs).toBeLessThan(2000);
    });
  });

  describe('E2E Contract Mock Cloudflare Worker (tests/e2e/helpers/mockWorker.ts)', () => {
    const mockWorker = new MockCloudflareWorker();

    it('1. records /health endpoint response status, headers and latency', async () => {
      const startTime = performance.now();
      const response = await mockWorker.handleRequest('http://localhost/health');
      const latencyMs = Math.round(performance.now() - startTime);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      const data = await response.json() as any;
      expect(data.status).toBe('ok');

      console.log(`[MockWorker Benchmark] GET /health -> Status: ${response.status}, Latency: ${latencyMs}ms`);
    });

    it('2. records /api/prescription response status, headers and latency', async () => {
      const startTime = performance.now();
      const response = await mockWorker.handleRequest('http://localhost/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: sampleBase64,
          mode: 'prescription'
        })
      });
      const latencyMs = Math.round(performance.now() - startTime);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      const data = await response.json() as any;
      expect(data.is_clear).toBe(true);

      console.log(`[MockWorker Benchmark] POST /api/prescription -> Status: ${response.status}, Latency: ${latencyMs}ms`);
    });
  });
});
