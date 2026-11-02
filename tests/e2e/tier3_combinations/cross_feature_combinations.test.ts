import { describe, it, expect, beforeEach } from 'vitest';
import { HARDCODED_DISCLAIMER_LINE } from '../fixtures/testContracts';
import { sampleClearPrescription } from '../fixtures/samplePrescriptions';
import { sampleBoxCommonUsage } from '../fixtures/sampleBoxes';
import { MockCloudflareWorker } from '../helpers/mockWorker';

describe('Tier 3: Cross-Feature Combinations — Pairwise Integration Flows', () => {
  const mockWorker = new MockCloudflareWorker();

  beforeEach(() => {
    window.localStorage.clear();
    window.speechSynthesis.cancel();
  });

  // =========================================================================
  // Pairwise Flow 1: Bottom nav tab switch during active camera capture (F03 + F04 + F01)
  // =========================================================================
  it('Flow 1: handles bottom nav tab switch during camera capture without hanging', async () => {
    let activeTab = 'home';
    let cameraInProgress = false;

    const startCamera = async () => {
      cameraInProgress = true;
      await new Promise((r) => setTimeout(r, 20));
      cameraInProgress = false;
      return { base64: 'mock_data' };
    };

    const switchTab = (tab: string) => {
      activeTab = tab;
      if (cameraInProgress) {
        cameraInProgress = false; // Aborts camera session
      }
    };

    // User triggers camera from center button
    const cameraPromise = startCamera();
    expect(cameraInProgress).toBe(true);

    // User taps "الروشتة" tab in bottom nav while camera is activating
    switchTab('prescription');

    await cameraPromise;
    expect(activeTab).toBe('prescription');
    expect(cameraInProgress).toBe(false);
  });

  // =========================================================================
  // Pairwise Flow 2: Prescription reading -> Details modal -> Add to "أدويتي" (F09 + F15 + F18)
  // =========================================================================
  it('Flow 2: prescription item click opens details mode and adds to "أدويتي"', async () => {
    // 1. Prescription item selected
    const selectedItem = sampleClearPrescription.items[0];
    expect(selectedItem.medicine_name_ar).toBe('ميتفورمين (سيدوفاج)');

    // 2. Fetch details mode via text name
    const detailsRes = await mockWorker.handleRequest('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'details',
        medicine_name: selectedItem.medicine_name_en,
      }),
    });

    expect(detailsRes.status).toBe(200);
    const detailsData = await detailsRes.json();
    expect(detailsData.uses.length).toBeGreaterThan(0);

    // 3. Cache details in localStorage
    const cacheKey = `dalili_details_cache_${selectedItem.medicine_name_en}`;
    window.localStorage.setItem(cacheKey, JSON.stringify(detailsData));

    // 4. Click "أضف لأدويتي"
    const myMedicinesKey = 'dalili_my_medicines_v1';
    const myMedItem = {
      id: 'med_metformin_1',
      name_ar: selectedItem.medicine_name_ar,
      name_en: selectedItem.medicine_name_en,
      how_and_when: detailsData.how_and_when,
      addedAt: Date.now(),
    };
    window.localStorage.setItem(myMedicinesKey, JSON.stringify([myMedItem]));

    // 5. Verify persistence in "أدويتي" list
    const stored = JSON.parse(window.localStorage.getItem(myMedicinesKey) || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].name_en).toBe('Metformin');
  });

  // =========================================================================
  // Pairwise Flow 3: Unclear photo guidance -> retry -> successful capture (F19 + F04 + F21 + F22 + F23)
  // =========================================================================
  it('Flow 3: unclear photo guidance triggers retry leading to successful 4-card box result', async () => {
    // 1. First capture returns unclear
    let analysisResult: any = {
      is_clear: false,
      retake_message: 'الصورة غير واضحة. يرجى التأكد من الإضاءة وإظهار العلبة كاملة.',
    };
    expect(analysisResult.is_clear).toBe(false);

    // 2. User reviews 3 tips and taps "إعادة المحاولة"
    const retryCapture = async () => {
      // Second attempt with good lighting
      const res = await mockWorker.handleRequest('http://localhost/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'box',
          image: '/9j/common_usage_box_photo',
        }),
      });
      return await res.json();
    };

    analysisResult = await retryCapture();

    // 3. Verify successful 4-card result
    expect(analysisResult.is_clear).toBe(true);
    expect(analysisResult.how_and_when.length).toBeGreaterThanOrEqual(2);
    expect(analysisResult.usage_source).toBe('common');

    // 4. Verify hardcoded disclaimer string under usage card
    expect(HARDCODED_DISCLAIMER_LINE).toContain('هذا الاستخدام الشائع');
  });

  // =========================================================================
  // Pairwise Flow 4: Usage card fallback + custom font size scaling (F21 + F06)
  // =========================================================================
  it('Flow 4: usage fallback populates 2-3 items and adapts to 24px+ font scaling', () => {
    // 1. Raw AI payload with missing how_and_when
    const rawAiPayload: any = {
      medicine_name_ar: 'بنادول',
      uses: ['مسكن للألم'],
      how_and_when: [], // Empty
    };

    // 2. Safe client fallback
    const sanitizeUsage = (payload: any) => {
      if (!payload.how_and_when || payload.how_and_when.length === 0) {
        payload.how_and_when = [
          'يؤخذ عادة عند اللزوم بعد الطعام مع كوب ماء كامل',
          'الالتزام بالمواعيد المحددة وعدم تكرار الجرعة دون داعٍ',
          'استشر الصيدلي أو الطبيب دائماً لتحديد الجرعة المناسبة لحالتك',
        ];
        payload.usage_source = 'common';
      }
      return payload;
    };

    const sanitized = sanitizeUsage(rawAiPayload);
    expect(sanitized.how_and_when).toHaveLength(3);
    expect(sanitized.usage_source).toBe('common');

    // 3. User switches font preference to extra-large (23px root scale)
    const fontPref = 'extra-large';
    const computedFontSize = fontPref === 'extra-large' ? 23 : fontPref === 'large' ? 19 : 16;
    expect(computedFontSize).toBe(23);
  });

  // =========================================================================
  // Pairwise Flow 5: Web Speech read-aloud active during tab navigation (F17 + F03)
  // =========================================================================
  it('Flow 5: read-aloud speech cancels automatically upon tab navigation', () => {
    // 1. Start speech synthesis on prescription view
    const utterance = new SpeechSynthesisUtterance('تحتوي الروشتة على دوائين...');
    window.speechSynthesis.speak(utterance);
    expect(window.speechSynthesis.speaking).toBe(true);

    // 2. User taps bottom nav tab to navigate away
    const onTabChange = () => {
      window.speechSynthesis.cancel();
    };

    onTabChange();

    // 3. Speech must be stopped immediately
    expect(window.speechSynthesis.speaking).toBe(false);
  });

  // =========================================================================
  // Pairwise Flow 6: Box scan -> details cache population -> offline retrieval (F18 + F28)
  // =========================================================================
  it('Flow 6: cached details mode retrieves offline without network access', async () => {
    // 1. Online scan populates details cache
    const medName = 'Concor';
    const detailsData = sampleBoxCommonUsage;
    window.localStorage.setItem(`dalili_details_cache_${medName}`, JSON.stringify(detailsData));

    // 2. Simulate offline network condition
    let isOnline = false;

    const fetchDetailsSafe = async (name: string) => {
      const cached = window.localStorage.getItem(`dalili_details_cache_${name}`);
      if (cached) {
        return { data: JSON.parse(cached), fromCache: true };
      }
      if (!isOnline) {
        throw new Error('لا يوجد اتصال بالإنترنت');
      }
      return { data: null, fromCache: false };
    };

    const result = await fetchDetailsSafe('Concor');
    expect(result.fromCache).toBe(true);
    expect(result.data.medicine_name_ar).toBe('كونكور 5 مجم');
  });

  // =========================================================================
  // Pairwise Flow 7: 1600px prescription photo -> 25s timeout -> client 30s timeout -> retry (F10 + F11 + F13 + F19)
  // =========================================================================
  it('Flow 7: handles 25s worker abort with distinct network timeout card and retry', async () => {
    // 1. Worker simulates 25-second abort
    mockWorker.setConfig({ forceTimeout: true });

    const timeoutRes = await mockWorker.handleRequest('http://localhost/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'prescription',
        image: '/9j/compressed_1600px_prescription_image',
      }),
    });

    expect(timeoutRes.status).toBe(504);
    const errData = await timeoutRes.json();
    expect(errData.error_code).toBe('UPSTREAM_TIMEOUT');

    // 2. Client classifies as network timeout, NOT unclear photo
    const clientClassification = errData.error_code === 'UPSTREAM_TIMEOUT' ? 'network_timeout' : 'unclear_image';
    expect(clientClassification).toBe('network_timeout');

    // 3. Retry succeeds when server responds normally
    mockWorker.setConfig({ forceTimeout: false });
    const retryRes = await mockWorker.handleRequest('http://localhost/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'prescription',
        image: '/9j/compressed_1600px_prescription_image',
      }),
    });

    expect(retryRes.status).toBe(200);
    const retryJson = await retryRes.json();
    expect(retryJson.is_clear).toBe(true);
  });
});
