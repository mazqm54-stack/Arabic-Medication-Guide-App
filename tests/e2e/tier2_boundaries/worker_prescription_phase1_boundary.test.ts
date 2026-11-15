/**
 * Tier 2: Boundary & Stress Verification — Worker Endpoints & Prescription Reasoning
 * Validates edge boundaries: 10-item limit, suggestion counts (0,1,2,>2), dosage omission,
 * empty/large payloads, rate limiting, 25s timeout, upstream errors, and secret redaction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, {
  fallbackRateLimitMap,
  sanitizeMessage
} from '../../../worker/src/index';
import {
  validatePhase1PrescriptionSchema,
  validatePrescriptionSchema
} from '../fixtures/testContracts';
import {
  samplePhase1ConfirmedPrescription,
  samplePhase1MixedWithSuggestions,
  sampleTenItemsPrescription
} from '../fixtures/samplePrescriptions';

describe('Tier 2: Boundary & Stress Verification — Worker Endpoints & Prescription Reasoning', () => {
  const mockEnv = {
    GEMINI_API_KEY: 'test-boundary-key-789',
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    fallbackRateLimitMap.clear();
  });

  // =========================================================================
  // 1. Prescription Items Ceiling & Suggestion Counts
  // =========================================================================
  describe('1. Prescription Items Ceiling & Suggestion Counts', () => {
    it('1.1 accepts prescription with exactly 10 items without error', () => {
      const val = validatePrescriptionSchema(sampleTenItemsPrescription);
      expect(val.valid).toBe(true);
      expect(sampleTenItemsPrescription.items.length).toBe(10);
    });

    it('1.2 rejects prescription exceeding 10 items ceiling (11 items)', () => {
      const elevenItems = {
        ...sampleTenItemsPrescription,
        items: [
          ...sampleTenItemsPrescription.items,
          { ...sampleTenItemsPrescription.items[0], line_text_as_written: 'Item 11' }
        ]
      };
      const val = validatePrescriptionSchema(elevenItems);
      expect(val.valid).toBe(false);
      expect(val.errors[0]).toContain('exceeds maximum allowed 10 items');
    });

    it('1.3 accepts suggested item with exactly 1 suggestion', () => {
      const singleSugRx = {
        ...samplePhase1MixedWithSuggestions,
        items: [
          samplePhase1MixedWithSuggestions.items[0],
          {
            ...samplePhase1MixedWithSuggestions.items[1],
            suggested_medicines: [
              { name_ar: 'سيبروفلوكساسين', name_en: 'Ciprofloxacin', confidence: 'medium' as const }
            ]
          }
        ]
      };
      const val = validatePhase1PrescriptionSchema(singleSugRx);
      expect(val.valid).toBe(true);
    });

    it('1.4 accepts suggested item with exactly 2 suggestions', () => {
      const val = validatePhase1PrescriptionSchema(samplePhase1MixedWithSuggestions);
      expect(val.valid).toBe(true);
      expect(samplePhase1MixedWithSuggestions.items[1].suggested_medicines!.length).toBe(2);
    });

    it('1.5 rejects suggested item with 0 suggestions or 3+ suggestions', () => {
      const zeroSugRx = {
        ...samplePhase1MixedWithSuggestions,
        items: [
          samplePhase1MixedWithSuggestions.items[0],
          {
            ...samplePhase1MixedWithSuggestions.items[1],
            suggested_medicines: []
          }
        ]
      };
      const valZero = validatePhase1PrescriptionSchema(zeroSugRx);
      expect(valZero.valid).toBe(false);
      expect(valZero.errors[0]).toContain('suggested_medicines array with 1 to 2 entries');

      const threeSugRx = {
        ...samplePhase1MixedWithSuggestions,
        items: [
          samplePhase1MixedWithSuggestions.items[0],
          {
            ...samplePhase1MixedWithSuggestions.items[1],
            suggested_medicines: [
              { name_ar: 'دواء 1', name_en: 'Med 1', confidence: 'medium' as const },
              { name_ar: 'دواء 2', name_en: 'Med 2', confidence: 'low' as const },
              { name_ar: 'دواء 3', name_en: 'Med 3', confidence: 'low' as const },
            ]
          }
        ]
      };
      const valThree = validatePhase1PrescriptionSchema(threeSugRx);
      expect(valThree.valid).toBe(false);
      expect(valThree.errors[0]).toContain('suggested_medicines array with 1 to 2 entries');
    });
  });

  // =========================================================================
  // 2. Strict Dosage Omission & Warning Requirements
  // =========================================================================
  describe('2. Strict Dosage Omission & Warning Requirements', () => {
    it('2.1 rejects suggested item with non-empty written_instructions', () => {
      const badRx = {
        ...samplePhase1MixedWithSuggestions,
        items: [
          samplePhase1MixedWithSuggestions.items[0],
          {
            ...samplePhase1MixedWithSuggestions.items[1],
            written_instructions: '1 tab daily'
          }
        ]
      };
      const val = validatePhase1PrescriptionSchema(badRx);
      expect(val.valid).toBe(false);
      expect(val.errors.some((e) => e.includes('DOSAGES MUST BE OMITTED FOR SUGGESTIONS'))).toBe(true);
    });

    it('2.2 rejects unclear item with non-empty written_instructions', () => {
      const badRx = {
        ...samplePhase1MixedWithSuggestions,
        items: [
          samplePhase1MixedWithSuggestions.items[0],
          {
            ...samplePhase1MixedWithSuggestions.items[1],
            status: 'unclear' as const,
            is_confirmed: false,
            written_instructions: '2x3'
          }
        ]
      };
      const val = validatePhase1PrescriptionSchema(badRx);
      expect(val.valid).toBe(false);
      expect(val.errors.some((e) => e.includes('Instructions must be empty'))).toBe(true);
    });

    it('2.3 worker automatically strips dosage instructions from suggestions at runtime', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    is_clear: true,
                    retake_message: '',
                    confidence: 'medium',
                    evidence_text: 'Test',
                    deduced_condition: 'عدوى',
                    items: [{
                      line_text_as_written: 'C... 500',
                      is_confirmed: false,
                      status: 'suggested',
                      medicine_name_ar: 'سيبروفلوكساسين',
                      medicine_name_en: 'Ciprofloxacin',
                      active_ingredient: 'سيبروفلوكساسين',
                      confidence: 'medium',
                      written_instructions: 'قرص مرتين يومياً', // Gemini hallucinated dosage!
                      short_explanation: 'شرح',
                      visible_letters: 'C...',
                      suggested_medicines: [
                        { name_ar: 'سيبروفلوكساسين', name_en: 'Ciprofloxacin', confidence: 'medium' }
                      ],
                      warning_note: 'اسأل الصيدلي'
                    }]
                  })
                }]
              }
            }]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sampleBase64' })
      });
      const res = await worker.fetch(req, mockEnv);
      const data = await res.json() as any;
      expect(data.items[0].written_instructions).toBe('');
      expect(data.items[0].short_explanation).toBe('');
    });

    it('2.4 mandates pharmacist warning note on suggested item', () => {
      const noWarningRx = {
        ...samplePhase1MixedWithSuggestions,
        items: [
          samplePhase1MixedWithSuggestions.items[0],
          {
            ...samplePhase1MixedWithSuggestions.items[1],
            warning_note: ''
          }
        ]
      };
      const val = validatePhase1PrescriptionSchema(noWarningRx);
      expect(val.valid).toBe(false);
      expect(val.errors.some((e) => e.includes('consult pharmacist'))).toBe(true);
    });
  });

  // =========================================================================
  // 3. Payload & Validation Boundaries (Empty, Large, Invalid)
  // =========================================================================
  describe('3. Payload & Validation Boundaries', () => {
    it('3.1 rejects empty JSON body with 400 BAD_REQUEST', async () => {
      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error_code).toBe('BAD_REQUEST');
      expect(data.retake_message).toContain('صورة الروشتة');
    });

    it('3.2 rejects whitespace-only image with 400 BAD_REQUEST', async () => {
      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: '    ' })
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(400);
    });

    it('3.3 rejects payload exceeding 4MB limit with 413 PAYLOAD_TOO_LARGE', async () => {
      const hugeImage = 'A'.repeat(4 * 1024 * 1024 + 1);
      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: hugeImage })
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(413);
      const data = await res.json() as any;
      expect(data.error_code).toBe('PAYLOAD_TOO_LARGE');
      expect(data.retake_message).toContain('4 ميجابايت');
    });

    it('3.4 accepts payload just under 4MB limit', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(samplePhase1ConfirmedPrescription) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      const largeValidImage = 'A'.repeat(2 * 1024 * 1024); // 2MB
      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: largeValidImage })
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(200);
    });

    it('3.5 rejects malformed request JSON string with 400 BAD_REQUEST', async () => {
      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ malformed json: not valid'
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error_code).toBe('BAD_REQUEST');
    });
  });

  // =========================================================================
  // 4. Rate Limiting Boundary (10 req/min)
  // =========================================================================
  describe('4. Rate Limiting Boundary (10 req/min)', () => {
    it('4.1 allows up to 10 requests within 60-second window', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(samplePhase1ConfirmedPrescription) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      for (let i = 1; i <= 10; i++) {
        const req = new Request('https://worker.local/api/prescription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '192.168.1.100' },
          body: JSON.stringify({ image: 'sampleBase64' })
        });
        const res = await worker.fetch(req, mockEnv);
        expect(res.status).toBe(200);
      }
    });

    it('4.2 blocks 11th request with 429 RATE_LIMIT_EXCEEDED and Retry-After: 60', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(samplePhase1ConfirmedPrescription) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      // Execute 10 requests
      for (let i = 1; i <= 10; i++) {
        const req = new Request('https://worker.local/api/prescription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '192.168.1.101' },
          body: JSON.stringify({ image: 'sampleBase64' })
        });
        await worker.fetch(req, mockEnv);
      }

      // 11th request must be blocked
      const blockedReq = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '192.168.1.101' },
        body: JSON.stringify({ image: 'sampleBase64' })
      });
      const blockedRes = await worker.fetch(blockedReq, mockEnv);
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get('Retry-After')).toBe('60');

      const data = await blockedRes.json() as any;
      expect(data.error_code).toBe('RATE_LIMIT_EXCEEDED');
      expect(data.retake_message).toContain('10 تحليلات في الدقيقة');
    });

    it('4.3 tracks rate limits per unique IP address independently', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(samplePhase1ConfirmedPrescription) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });

      // Fill quota for IP A
      for (let i = 1; i <= 10; i++) {
        const reqA = new Request('https://worker.local/api/prescription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '10.0.0.1' },
          body: JSON.stringify({ image: 'sampleBase64' })
        });
        await worker.fetch(reqA, mockEnv);
      }

      // IP B should still be allowed
      const reqB = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '10.0.0.2' },
        body: JSON.stringify({ image: 'sampleBase64' })
      });
      const resB = await worker.fetch(reqB, mockEnv);
      expect(resB.status).toBe(200);
    });
  });

  // =========================================================================
  // 5. Upstream Gemini Error Handling & Timeout (25s)
  // =========================================================================
  describe('5. Upstream Gemini Error Handling & Timeout', () => {
    it('5.1 maps upstream 25-second abort/timeout to 504 UPSTREAM_TIMEOUT', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        const err = new DOMException('Upstream Gemini request timed out after 25 seconds', 'TimeoutError');
        throw err;
      });

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sampleBase64' })
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(504);

      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_TIMEOUT');
      expect(data.retake_message).toContain('25 ثانية');
    });

    it('5.2 maps upstream 503 to safe UPSTREAM_OVERLOADED (503)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'The model is overloaded.' } }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sampleBase64' })
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(503);
      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_OVERLOADED');
      expect(data.retake_message).toContain('تحت ضغط مؤقت');
    });

    it('5.3 maps upstream 429 to UPSTREAM_RATE_LIMIT (429) with Retry-After: 60', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Resource exhausted.' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sampleBase64' })
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('60');
      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_RATE_LIMIT');
    });

    it('5.4 maps upstream location/region block to 403 UPSTREAM_LOCATION_RESTRICTED', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'User location is not supported for the API use.' } }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sampleBase64' })
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(403);
      const data = await res.json() as any;
      expect(data.error_code).toBe('UPSTREAM_LOCATION_RESTRICTED');
    });

    it('5.5 handles upstream invalid JSON string gracefully with INVALID_JSON error code', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'This is not JSON at all { corrupt' }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      const req = new Request('https://worker.local/api/prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'sampleBase64' })
      });
      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.is_clear).toBe(false);
      expect(data.error_code).toBe('INVALID_JSON');
      expect(data.items).toEqual([]);
    });
  });

  // =========================================================================
  // 6. Adversarial Secret Leak & Sanitization Boundary
  // =========================================================================
  describe('6. Adversarial Secret Leak & Sanitization Boundary', () => {
    it('6.1 redacts AIza... API keys from error messages', () => {
      const dirty = 'Error calling https://generativelanguage.googleapis.com?key=AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q in cluster';
      const clean = sanitizeMessage(dirty);
      expect(clean).not.toContain('AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q');
      expect(clean).toContain('[REDACTED_KEY]');
    });

    it('6.2 redacts Bearer tokens and Authorization headers', () => {
      const dirty = 'Authorization: Bearer ya29.a0AfH6SMBxyz123secretToken';
      const clean = sanitizeMessage(dirty);
      expect(clean).not.toContain('ya29.a0AfH6SMBxyz123secretToken');
      expect(clean).toContain('[REDACTED_TOKEN]');
    });

    it('6.3 redacts massive base64 image strings from logs and messages', () => {
      const dirty = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgF...';
      const clean = sanitizeMessage(dirty);
      expect(clean).not.toContain('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgF');
      expect(clean).toContain('[REDACTED_BASE64]');
    });

    it('6.4 clamps error message length to 300 characters to prevent buffer flood', () => {
      const hugeLog = 'Error: ' + 'x'.repeat(1000);
      const clean = sanitizeMessage(hugeLog);
      expect(clean.length).toBeLessThanOrEqual(300);
    });
  });
});
