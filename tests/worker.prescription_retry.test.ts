import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../worker/src/index';

describe('Cloudflare Worker — Prescription Consistency & Auto-Retry', () => {
  const mockEnv: any = {
    GEMINI_API_KEY: 'test-api-key',
    GEMINI_MODEL_PRESCRIPTION: 'gemini-3.8-flash'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('runs attempt 1 with default temperature and does NOT retry if all items have high or medium confidence', async () => {
    const mockOutput = {
      is_clear: true,
      retake_message: '',
      confidence: 'high',
      evidence_text: 'Concor 5mg 1x1',
      deduced_condition: 'ارتفاع ضغط الدم',
      items: [
        {
          line_text_as_written: 'Concor 5mg 1x1',
          is_confirmed: true,
          status: 'confirmed',
          medicine_name_ar: 'كونكور 5 ملغ',
          medicine_name_en: 'Concor 5mg',
          active_ingredient: 'بيسوبرولول',
          confidence: 'high',
          written_instructions: 'قرص صباحاً',
          short_explanation: 'علاج ارتفاع ضغط الدم'
        }
      ],
      audio_summary: 'روشتة تحتوي على كونكور'
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockOutput) }] } }]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const request = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'sampleBase64', mode: 'prescription' })
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(200);

    // Verify exactly ONE Gemini call occurred (no retries)
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(callBody.generationConfig.temperature).toBeUndefined();
    expect(callBody.generationConfig.mediaResolution).toBe('MEDIA_RESOLUTION_HIGH');
    expect(callBody.generationConfig.thinkingConfig.thinkingLevel).toBe('MEDIUM');

    const data = await response.json() as any;
    expect(data.items).toHaveLength(1);
    expect(data.items[0].confidence).toBe('high');
  });

  it('normal mode returns attempt 1 immediately with hard: true without extra retries when low confidence exists', async () => {
    const attempt1Output = {
      is_clear: true,
      confidence: 'medium',
      items: [
        {
          line_text_as_written: 'Augmentin 1g',
          medicine_name_ar: 'أوجمنتين 1 غرام',
          medicine_name_en: 'Augmentin 1g',
          confidence: 'high',
          status: 'confirmed'
        },
        {
          line_text_as_written: 'Dr scribble',
          medicine_name_ar: '',
          medicine_name_en: '',
          confidence: 'low',
          status: 'unclear'
        }
      ]
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(attempt1Output) }] } }]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const request = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'sampleBase64', mode: 'prescription' })
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(200);

    // In normal mode: only 1 Gemini call is made, returns hard: true immediately
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const data = await response.json() as any;
    expect(data.hard).toBe(true);
    expect(data.items).toHaveLength(2);
  });

  it('deep mode retries if an item has low confidence, and keeps high confidence items unchanged', async () => {
    // Attempt 1: Item 1 is High, Item 2 is Low (unclear)
    const attempt1Output = {
      is_clear: true,
      confidence: 'medium',
      items: [
        {
          line_text_as_written: 'Augmentin 1g',
          medicine_name_ar: 'أوجمنتين 1 غرام',
          medicine_name_en: 'Augmentin 1g',
          confidence: 'high',
          status: 'confirmed'
        },
        {
          line_text_as_written: 'Dr scribble',
          medicine_name_ar: '',
          medicine_name_en: '',
          confidence: 'low',
          status: 'unclear'
        }
      ]
    };

    // Attempt 2: Reads Item 2 with medium confidence (improved!)
    const attempt2Output = {
      is_clear: true,
      confidence: 'high',
      items: [
        {
          line_text_as_written: 'Augmentin 1g DIFFERENT_TEXT',
          medicine_name_ar: 'أوجمنتين مختلف',
          medicine_name_en: 'Augmentin Different',
          confidence: 'medium',
          status: 'confirmed'
        },
        {
          line_text_as_written: 'Panadol 500mg',
          medicine_name_ar: 'بنادول 500 ملغ',
          medicine_name_en: 'Panadol 500mg',
          confidence: 'medium',
          status: 'suggested'
        }
      ]
    };

    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
      callCount++;
      const payload = JSON.parse((options as any)?.body || '{}');
      expect(payload.generationConfig.temperature).toBeUndefined();
      if (callCount === 1) {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(attempt1Output) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } else {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(attempt2Output) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    });

    const request = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'sampleBase64', mode: 'prescription', deep: true })
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(200);

    const data = await response.json() as any;
    expect(data.items).toHaveLength(2);

    // Item 1 had 'high' confidence in attempt 1: MUST NOT CHANGE!
    expect(data.items[0].medicine_name_ar).toBe('أوجمنتين 1 غرام');
    expect(data.items[0].confidence).toBe('high');

    // Item 2 improved from 'low' to 'medium' from attempt 2 (and boosted to 'high' by LNF match):
    expect(data.items[1].medicine_name_en).toBe('Panadol 500mg');
    expect(['medium', 'high']).toContain(data.items[1].confidence);
  });

  it('auto-retries up to 2 times on upstream 503 error and succeeds when downstream recovers', async () => {
    const mockOutput = {
      is_clear: true,
      confidence: 'high',
      items: [
        {
          line_text_as_written: 'Amoxil 500mg',
          medicine_name_ar: 'أموكسيل 500 ملغ',
          medicine_name_en: 'Amoxil 500mg',
          confidence: 'high',
          status: 'confirmed'
        }
      ]
    };

    let callAttempts = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callAttempts++;
      if (callAttempts === 1) {
        // First attempt fails with 503 Overloaded
        return new Response('Overloaded', { status: 503 });
      }
      // Second attempt recovers
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(mockOutput) }] } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const request = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'sampleBase64', mode: 'prescription' })
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(200);
    expect(callAttempts).toBe(2);

    const data = await response.json() as any;
    expect(data.items).toHaveLength(1);
    expect(data.items[0].medicine_name_en).toBe('Amoxil 500mg');
  });

  it('stops retrying and returns best result so far if 429 rate limit is returned during retry', async () => {
    const attempt1Output = {
      is_clear: true,
      confidence: 'medium',
      items: [
        {
          line_text_as_written: 'Scribble line',
          medicine_name_ar: 'دواء تجريبي',
          medicine_name_en: 'TestMed',
          confidence: 'low',
          status: 'unclear'
        }
      ]
    };

    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(attempt1Output) }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } else {
        // Retry returns 429
        return new Response('Rate limit exceeded', { status: 429 });
      }
    });

    const request = new Request('https://worker.local/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'sampleBase64', mode: 'prescription', deep: true })
    });

    const response = await worker.fetch(request, mockEnv);
    // Should NOT fail with 429; should return 200 with best result so far!
    expect(response.status).toBe(200);

    const data = await response.json() as any;
    expect(data.items).toHaveLength(1);
    expect(data.items[0].medicine_name_en).toBe('TestMed');
  });
});
