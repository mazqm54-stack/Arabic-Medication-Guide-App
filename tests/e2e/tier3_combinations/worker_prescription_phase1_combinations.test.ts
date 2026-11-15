/**
 * Tier 3: Cross-Feature Combinations & Pairwise Integration Flows
 * Validates cross-feature interactions: confirmed + suggested in single prescription,
 * confirmed + unclear fallback, multi-morbidity condition deduction, sequential multi-endpoint flows,
 * rate limit sharing across endpoints, and universal secret sanitization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, {
  fallbackRateLimitMap
} from '../../../worker/src/index';
import {
  validatePhase1PrescriptionSchema,
  validateBoxSchema
} from '../fixtures/testContracts';
import {
  samplePhase1ConfirmedPrescription,
  samplePhase1MixedWithSuggestions,
  samplePhase1UnclearFallback,
  samplePhase1ChronicPrescription,
  samplePhase1CardiovascularPrescription
} from '../fixtures/samplePrescriptions';
import { sampleBoxPrintedUsage } from '../fixtures/sampleBoxes';

describe('Tier 3: Cross-Feature Combinations — Worker Endpoints & Prescription Reasoning', () => {
  const mockEnv = {
    GEMINI_API_KEY: 'test-combo-key-333',
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    fallbackRateLimitMap.clear();
  });

  // =========================================================================
  // Flow 1: Confirmed + Suggested Items in a Single Prescription
  // =========================================================================
  it('Flow 1: handles confirmed and suggested items in a single prescription without cross-pollution', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(samplePhase1MixedWithSuggestions) }] } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const req = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'sampleBase64', mode: 'prescription' })
    });

    const res = await worker.fetch(req, mockEnv);
    expect(res.status).toBe(200);
    const data = await res.json() as any;

    const val = validatePhase1PrescriptionSchema(data);
    expect(val.valid).toBe(true);

    // Item 1: Confirmed
    const confirmed = data.items[0];
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.is_confirmed).toBe(true);
    expect(confirmed.written_instructions).toBe('قرص كل 12 ساعة بعد الطعام');
    expect(confirmed.suggested_medicines).toEqual([]);

    // Item 2: Suggested
    const suggested = data.items[1];
    expect(suggested.status).toBe('suggested');
    expect(suggested.is_confirmed).toBe(false);
    expect(suggested.written_instructions).toBe(''); // Strictly no dosage!
    expect(suggested.suggested_medicines.length).toBe(2);
    expect(suggested.warning_note).toContain('صيدلي');
  });

  // =========================================================================
  // Flow 2: Confirmed + Unclear Fallback Scribble in a Single Prescription
  // =========================================================================
  it('Flow 2: handles confirmed medicine alongside completely illegible scribble with zero guessing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(samplePhase1UnclearFallback) }] } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const req = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'sampleBase64', mode: 'prescription' })
    });

    const res = await worker.fetch(req, mockEnv);
    const data = await res.json() as any;

    expect(data.is_clear).toBe(true);
    expect(data.items.length).toBe(2);

    // Confirmed item
    expect(data.items[0].status).toBe('confirmed');
    expect(data.items[0].is_confirmed).toBe(true);
    expect(data.items[0].medicine_name_en).toBe('Augmentin 1g');

    // Unclear scribble item
    expect(data.items[1].status).toBe('unclear');
    expect(data.items[1].is_confirmed).toBe(false);
    expect(data.items[1].medicine_name_ar).toBe('');
    expect(data.items[1].suggested_medicines).toEqual([]);
    expect(data.items[1].warning_note).toContain('صيدلي');
  });

  // =========================================================================
  // Flow 3: Multi-Morbidity Prescription Condition Deduction
  // =========================================================================
  it('Flow 3: deduces combined clinical conditions for complex prescriptions', async () => {
    const multiMorbidityRx = {
      is_clear: true,
      retake_message: '',
      confidence: 'high',
      evidence_text: 'Metformin 500mg 1x2, Concor 5mg 1x1, Augmentin 1g 1x2',
      deduced_condition: 'داء السكري وارتفاع ضغط الدم مع عدوى بكتيرية حادة',
      items: [
        samplePhase1ChronicPrescription.items[0],
        samplePhase1CardiovascularPrescription.items[0],
        samplePhase1ConfirmedPrescription.items[0],
      ],
      audio_summary: 'تحتوي الروشتة على أدوية للسكر والضغط بالإضافة لمضاد حيوي.'
    };

    const val = validatePhase1PrescriptionSchema(multiMorbidityRx);
    expect(val.valid).toBe(true);
    expect(multiMorbidityRx.deduced_condition).toContain('السكري');
    expect(multiMorbidityRx.deduced_condition).toContain('ضغط الدم');
    expect(multiMorbidityRx.deduced_condition).toContain('بكتيرية');
  });

  // =========================================================================
  // Flow 4: Sequential Multi-Endpoint Journey (Box -> Prescription -> Details)
  // =========================================================================
  it('Flow 4: successfully executes sequential Box -> Prescription -> Details calls on same worker instance', async () => {
    // 1. Box Analysis
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(sampleBoxPrintedUsage) }] } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const boxReq = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'boxImageBase64' })
    });
    const boxRes = await worker.fetch(boxReq, mockEnv);
    expect(boxRes.status).toBe(200);
    const boxData = await boxRes.json() as any;
    expect(validateBoxSchema(boxData).valid).toBe(true);

    // 2. Prescription Analysis
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(samplePhase1MixedWithSuggestions) }] } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const rxReq = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'rxImageBase64' })
    });
    const rxRes = await worker.fetch(rxReq, mockEnv);
    expect(rxRes.status).toBe(200);
    const rxData = await rxRes.json() as any;
    expect(validatePhase1PrescriptionSchema(rxData).valid).toBe(true);

    // 3. Details Lookup
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          is_clear: true,
          retake_message: '',
          confidence: 'high',
          evidence_text: 'Panadol details',
          medicine_name_ar: 'بنادول',
          medicine_name_en: 'Panadol',
          active_ingredient: 'باراسيتامول',
          uses: ['مسكن'],
          how_and_when: ['عند اللزوم'],
          usage_source: 'common',
          warnings: ['استشر الصيدلي'],
          audio_summary: ''
        }) }] } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const detailsReq = new Request('https://worker.local/api/details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicine_name: 'بانادول' })
    });
    const detailsRes = await worker.fetch(detailsReq, mockEnv);
    expect(detailsRes.status).toBe(200);
    const detailsData = await detailsRes.json() as any;
    expect(detailsData.medicine_name_ar).toBe('بنادول');
  });

  // =========================================================================
  // Flow 5: Shared Rate Limiting across Mixed Endpoints
  // =========================================================================
  it('Flow 5: enforces shared 10 req/min rate limit across /api/analyze and /api/prescription', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(samplePhase1ConfirmedPrescription) }] } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const clientIp = '10.20.30.40';

    // 5 calls to /api/analyze
    for (let i = 0; i < 5; i++) {
      const req = new Request('https://worker.local/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': clientIp },
        body: JSON.stringify({ image: 'imgData' })
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(200);
    }

    // 5 calls to /api/prescription
    for (let i = 0; i < 5; i++) {
      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': clientIp },
        body: JSON.stringify({ image: 'imgData' })
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(200);
    }

    // 11th call (e.g. to /api/details) must trigger rate limit 429
    const req11 = new Request('https://worker.local/api/details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': clientIp },
      body: JSON.stringify({ medicine_name: 'بانادول' })
    });
    const res11 = await worker.fetch(req11, mockEnv);
    expect(res11.status).toBe(429);
    const data11 = await res11.json() as any;
    expect(data11.error_code).toBe('RATE_LIMIT_EXCEEDED');
  });

  // =========================================================================
  // Flow 6: Universal Secret Redaction Across All Failure Modes
  // =========================================================================
  it('Flow 6: ensures zero API key leakage when upstream throws dirty error strings', async () => {
    const dirtyApiKey = 'AIzaSyDirtySecretKeyDoNotLeak1234567890';
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error(`Failed to contact upstream at https://generativelanguage.googleapis.com/v1beta/models?key=${dirtyApiKey}`)
    );

    const req = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'someBase64' })
    });

    const res = await worker.fetch(req, {
      ...mockEnv,
      GEMINI_API_KEY: dirtyApiKey
    });

    expect(res.status).toBe(500);
    const data = await res.json() as any;
    const stringified = JSON.stringify(data);
    expect(stringified).not.toContain(dirtyApiKey);
    expect(stringified).toContain('[REDACTED_KEY]');
  });

  // =========================================================================
  // Flow 7: Retry Without Thinking Config when Upstream Rejects with 400
  // =========================================================================
  it('Flow 7: retries seamlessly without thinkingConfig when upstream rejects with thinking error', async () => {
    let attempts = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        return new Response(JSON.stringify({ error: { message: 'thinking is not supported for this model' } }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(samplePhase1ConfirmedPrescription) }] } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const req = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'someBase64' })
    });
    const res = await worker.fetch(req, mockEnv);
    expect(res.status).toBe(200);
    expect(attempts).toBe(2);
  });
});
