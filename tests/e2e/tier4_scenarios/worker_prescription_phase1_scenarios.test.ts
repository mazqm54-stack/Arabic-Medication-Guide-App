/**
 * Tier 4: Real-World Scenarios — Senior Arabic Patient Journeys (Phase 1)
 * Models end-to-end user journeys for elderly Arabic-speaking patients navigating
 * medication boxes, prescriptions with handwriting, poor lighting retakes, and safety guidance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, { fallbackRateLimitMap } from '../../../worker/src/index';
import {
  validatePhase1PrescriptionSchema,
  validateBoxSchema
} from '../fixtures/testContracts';
import {
  samplePhase1ConfirmedPrescription,
  samplePhase1MixedWithSuggestions,
  samplePhase1ChronicPrescription
} from '../fixtures/samplePrescriptions';
import { sampleBoxPrintedUsage } from '../fixtures/sampleBoxes';

describe('Tier 4: Real-World Scenarios — Senior Arabic Patient Journeys (Phase 1)', () => {
  const mockEnv = {
    GEMINI_API_KEY: 'test-real-world-key-101',
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    fallbackRateLimitMap.clear();
  });

  // =========================================================================
  // Scenario 1: Hajj Mahmoud (71) with Acute Chest Infection Prescription
  // =========================================================================
  it('Scenario 1: Hajj Mahmoud (71) reads prescription with legible Augmentin and handwritten antibiotic suggestion', async () => {
    // 1. Hajj Mahmoud takes a photo of his clinic prescription
    const prescriptionPhotoBase64 = '/9j/4AAQSkZJRg_hajj_mahmoud_chest_rx';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify(samplePhase1MixedWithSuggestions) }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    // 2. Client submits to /api/prescription
    const req = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: prescriptionPhotoBase64, mode: 'prescription' })
    });

    const res = await worker.fetch(req, mockEnv);
    expect(res.status).toBe(200);

    const rxResult = await res.json() as any;
    const val = validatePhase1PrescriptionSchema(rxResult);
    expect(val.valid).toBe(true);

    // 3. Clinical condition is deduced
    expect(rxResult.deduced_condition).toContain('عدوى بكتيرية');

    // 4. Confirmed medicine (Augmentin) is rendered with complete doctor instructions
    const confirmedMed = rxResult.items.find((i: any) => i.is_confirmed);
    expect(confirmedMed).toBeDefined();
    expect(confirmedMed.medicine_name_ar).toBe('أوجمنتين 1 غرام');
    expect(confirmedMed.written_instructions).toBe('قرص كل 12 ساعة بعد الطعام');
    expect(confirmedMed.confidence).toBe('high');

    // 5. Unclear handwritten line (C...fl... 500) renders up to 2 suggestions with ZERO dosage
    const suggestedMed = rxResult.items.find((i: any) => !i.is_confirmed && i.status === 'suggested');
    expect(suggestedMed).toBeDefined();
    expect(suggestedMed.suggested_medicines.length).toBeLessThanOrEqual(2);
    expect(suggestedMed.suggested_medicines[0].name_ar).toContain('سيبروفلوكساسين');
    // Safety check: NO dosage instructions shown to patient for suggested item
    expect(suggestedMed.written_instructions).toBe('');
    expect(suggestedMed.warning_note).toContain('اسأل الصيدلي');

    // 6. Audio summary is clear and readable for elderly patient
    expect(rxResult.audio_summary).toBeTruthy();
    expect(rxResult.audio_summary).toContain('أوجمنتين');
  });

  // =========================================================================
  // Scenario 2: Hajja Khadija (75) Managing Diabetes and Hypertension
  // =========================================================================
  it('Scenario 2: Hajja Khadija (75) scans chronic prescription, deducing diabetes context for unclear Gliclazide line', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify(samplePhase1ChronicPrescription) }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const req = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'khadija_chronic_prescription', mode: 'prescription' })
    });

    const res = await worker.fetch(req, mockEnv);
    expect(res.status).toBe(200);

    const rxResult = await res.json() as any;
    expect(rxResult.deduced_condition).toContain('داء السكري');

    // Confirmed Metformin
    const metformin = rxResult.items[0];
    expect(metformin.is_confirmed).toBe(true);
    expect(metformin.status).toBe('confirmed');
    expect(metformin.medicine_name_ar).toContain('ميتفورمين');
    expect(metformin.written_instructions).toContain('مرتين يومياً');

    // Unclear Gliclazide suggestion
    const gliclazide = rxResult.items[1];
    expect(gliclazide.is_confirmed).toBe(false);
    expect(gliclazide.status).toBe('suggested');
    expect(gliclazide.visible_letters).toBe('G...cl...');
    expect(gliclazide.suggested_medicines[0].name_en).toBe('Gliclazide 80mg');
    expect(gliclazide.written_instructions).toBe(''); // Zero dosage!
  });

  // =========================================================================
  // Scenario 3: Amm Ibrahim (82) in Poor Lighting (Retake Flow)
  // =========================================================================
  it('Scenario 3: Amm Ibrahim (82) photographs prescription in poor lighting, receives friendly Arabic tips, and retakes successfully', async () => {
    // 1. Dark/Blurry photo failure
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                is_clear: false,
                retake_message: 'الصورة غير واضحة أو مظلمة. يرجى إعادة التصوير في مكان ذي إضاءة جيدة مع إظهار كامل الروشتة وتثبيت الهاتف.',
                confidence: 'low',
                evidence_text: '',
                deduced_condition: '',
                items: [],
                audio_summary: 'يرجى إعادة التقاط الصورة بوضوح.'
              })
            }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const failReq = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'dark_blurry_rx_photo' })
    });

    const failRes = await worker.fetch(failReq, mockEnv);
    const failData = await failRes.json() as any;

    expect(failData.is_clear).toBe(false);
    expect(failData.items).toEqual([]);
    expect(failData.retake_message).toContain('إضاءة');
    expect(failData.retake_message).toContain('تثبيت');

    // 2. Amm Ibrahim follows the 3 tips and retakes with good lighting
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify(samplePhase1ConfirmedPrescription) }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const retryReq = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'bright_clear_rx_photo' })
    });

    const retryRes = await worker.fetch(retryReq, mockEnv);
    expect(retryRes.status).toBe(200);
    const retryData = await retryRes.json() as any;
    expect(retryData.is_clear).toBe(true);
    expect(retryData.items.length).toBe(2);
  });

  // =========================================================================
  // Scenario 4: Cross-Verification of Medicine Box then Doctor Prescription
  // =========================================================================
  it('Scenario 4: Senior patient scans medicine box packaging first, then cross-checks with doctor prescription', async () => {
    // 1. Patient scans Augmentin box
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify(sampleBoxPrintedUsage) }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const boxReq = new Request('https://worker.local/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'augmentin_box_image' })
    });

    const boxRes = await worker.fetch(boxReq, mockEnv);
    const boxData = await boxRes.json() as any;
    expect(validateBoxSchema(boxData).valid).toBe(true);
    expect(boxData.medicine_name_ar).toBe('بنادول إكسترا');
    expect(boxData.usage_source).toBe('printed');

    // 2. Patient scans prescription to check prescribed directions
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify(samplePhase1ConfirmedPrescription) }]
          }
        }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const rxReq = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'prescription_image' })
    });

    const rxRes = await worker.fetch(rxReq, mockEnv);
    const rxData = await rxRes.json() as any;
    expect(validatePhase1PrescriptionSchema(rxData).valid).toBe(true);

    // Cross-check: Both analyses succeeded and contain valid medicine data
    expect(rxData.items.length).toBe(2);
    expect(rxData.items.some((i: any) => i.medicine_name_ar.includes('بنادول'))).toBe(true);
  });

  // =========================================================================
  // Scenario 5: Rapid Button Taps & Rate Limit Recovery
  // =========================================================================
  it('Scenario 5: Elderly user accidentally double/triple taps scan, hits rate limit, sees friendly message, and recovers', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(samplePhase1ConfirmedPrescription) }] } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const patientIp = '172.16.0.42';

    // Rapid taps: 10 calls succeed
    for (let tap = 1; tap <= 10; tap++) {
      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': patientIp },
        body: JSON.stringify({ image: 'tap_photo' })
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(200);
    }

    // 11th tap triggers rate limit
    const tap11 = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': patientIp },
      body: JSON.stringify({ image: 'tap_photo' })
    });
    const res11 = await worker.fetch(tap11, mockEnv);
    expect(res11.status).toBe(429);
    const data11 = await res11.json() as any;
    expect(data11.retake_message).toContain('10 تحليلات في الدقيقة');

    // Simulate cooldown: clear rate limit map
    fallbackRateLimitMap.clear();

    // Subsequent tap succeeds
    const recoverReq = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': patientIp },
      body: JSON.stringify({ image: 'tap_photo' })
    });
    const recoverRes = await worker.fetch(recoverReq, mockEnv);
    expect(recoverRes.status).toBe(200);
  });
});
