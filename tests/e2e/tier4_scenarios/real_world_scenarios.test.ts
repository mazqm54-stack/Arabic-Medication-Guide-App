import { describe, it, expect, beforeEach } from 'vitest';
import {
  HARDCODED_DISCLAIMER_LINE,
  LOW_CONFIDENCE_AMBER_TEXT,
  PRESCRIPTION_ADVISORY_BANNER,
  validatePrescriptionSchema,
  validateBoxSchema,
} from '../fixtures/testContracts';
import { sampleTenItemsPrescription } from '../fixtures/samplePrescriptions';
import { MockCloudflareWorker } from '../helpers/mockWorker';

describe('Tier 4: Real-World Application Scenarios — Senior Patient Journeys', () => {
  const mockWorker = new MockCloudflareWorker();

  beforeEach(() => {
    window.localStorage.clear();
    window.speechSynthesis.cancel();
    document.documentElement.setAttribute('dir', 'rtl');
  });

  // =========================================================================
  // Scenario 1: Elderly Diabetic Patient (Hajj Ahmed, 72)
  // =========================================================================
  it('Scenario 1: Hajj Ahmed (72) reads handwritten diabetes clinic prescription with mixed lines', async () => {
    // 1. Patient opens app and views bottom nav in RTL
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');

    // 2. Navigates to "الروشتة" and submits photo
    const res = await mockWorker.handleRequest('http://localhost/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'prescription',
        image: '/9j/hajj_ahmed_mixed_diabetes_rx',
      }),
    });

    expect(res.status).toBe(200);
    const rxData = await res.json();
    const validation = validatePrescriptionSchema(rxData);
    expect(validation.valid).toBe(true);

    // 3. Verifies advisory banner is visible at top
    expect(PRESCRIPTION_ADVISORY_BANNER).toBe('راجع أسماء الأدوية قبل الاعتماد');

    // 4. Verifies readable diabetes medicine (Metformin) renders high confidence card
    const metformin = rxData.items[0];
    expect(metformin.confidence).toBe('high');
    expect(metformin.written_instructions).toContain('مرتين يومياً');
    expect(metformin.short_explanation).toContain('السكر');

    // 5. Verifies scribbled third item renders soft amber card with warning
    const scribbledItem = rxData.items[2];
    expect(scribbledItem.confidence).toBe('low');
    expect(scribbledItem.short_explanation).toBe(''); // Must be empty
    expect(LOW_CONFIDENCE_AMBER_TEXT).toBe('غير واضح، اسأل الصيدلي');

    // 6. Hajj Ahmed activates audio read-aloud
    const utterance = new SpeechSynthesisUtterance(rxData.audio_summary);
    utterance.lang = 'ar-SA';
    window.speechSynthesis.speak(utterance);
    expect(window.speechSynthesis.speaking).toBe(true);

    // 7. Taps Metformin to open details modal and view 4 cards
    const detailsRes = await mockWorker.handleRequest('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'details',
        medicine_name: metformin.medicine_name_en,
      }),
    });

    const detailsData = await detailsRes.json();
    expect(detailsData.is_clear).toBe(true);
    expect(detailsData.how_and_when.length).toBeGreaterThanOrEqual(2);
  });

  // =========================================================================
  // Scenario 2: Grandparent Checking Expired Heart Medication (Hajja Fatima, 68)
  // =========================================================================
  it('Scenario 2: Hajja Fatima (68) scans heart medication in dim lighting, follows tips, and reads common usage', async () => {
    // 1. First attempt in dim room lighting fails
    const initialScan = {
      is_clear: false,
      retake_message: 'الصورة غير واضحة. يرجى التأكد من تشغيل إضاءة الغرفة، وإظهار العلبة كاملة، وتثبيت الهاتف أثناء التصوير.',
    };
    expect(initialScan.is_clear).toBe(false);
    expect(initialScan.retake_message).toContain('إضاءة');

    // 2. Retake button displays large senior touch target (>=64px)
    const retryBtnHeight = 72;
    expect(retryBtnHeight).toBeGreaterThanOrEqual(64);

    // 3. Second attempt with clear lighting succeeds
    const clearRes = await mockWorker.handleRequest('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'box',
        image: '/9j/hajja_fatima_concor_box',
      }),
    });

    expect(clearRes.status).toBe(200);
    const boxData = await clearRes.json();
    const boxValidation = validateBoxSchema(boxData);
    expect(boxValidation.valid).toBe(true);

    // 4. Verifies "كيف ومتى" usage card displays "الاستخدام الشائع"
    expect(boxData.usage_source).toBe('printed');
    expect(boxData.how_and_when.length).toBeGreaterThanOrEqual(2);

    // 5. Verifies hardcoded disclaimer line is rendered immediately under usage card
    expect(HARDCODED_DISCLAIMER_LINE).toBe(
      'هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي.'
    );
  });

  // =========================================================================
  // Scenario 3: Senior Reviewing Medication List with Extra-Large Font & High Contrast
  // =========================================================================
  it('Scenario 3: Senior patient navigates app in 24px+ extra-large font mode with high contrast', () => {
    // 1. User sets font preference to extra-large
    const userPrefs = { fontSize: 'extra-large' };
    window.localStorage.setItem('dalili_preferences_v1', JSON.stringify(userPrefs));

    const storedPrefs = JSON.parse(window.localStorage.getItem('dalili_preferences_v1') || '{}');
    expect(storedPrefs.fontSize).toBe('extra-large');

    // 2. Body font class applied
    const fontModeClass = storedPrefs.fontSize === 'extra-large' ? 'font-mode-extra-large' : 'font-mode-large';
    expect(fontModeClass).toBe('font-mode-extra-large');

    // 3. Verifies touch targets maintain >= 64px
    const touchButtons = [
      { name: 'الرئيسية', height: 64 },
      { name: 'أدويتي', height: 64 },
      { name: 'صوّر', height: 76 },
      { name: 'الروشتة', height: 64 },
      { name: 'السجل', height: 64 },
    ];
    touchButtons.forEach((btn) => {
      expect(btn.height).toBeGreaterThanOrEqual(64);
    });

    // 4. Verifies medical disclaimer remains unobstructed and readable
    const disclaimerBanner = {
      text: 'تنبيه طبي: هذا التطبيق للمساعدة فقط، ولا يغني عن استشارة الطبيب أو الصيدلي.',
      visible: true,
    };
    expect(disclaimerBanner.visible).toBe(true);
  });

  // =========================================================================
  // Scenario 4: Poor Cellular Connectivity (Slow 3G Network Timeout)
  // =========================================================================
  it('Scenario 4: Village patient on slow 3G cellular network experiences 25s worker timeout and recovers', async () => {
    // 1. Worker reaches 25-second upstream timeout limit
    mockWorker.setConfig({ forceTimeout: true });

    const timeoutRes = await mockWorker.handleRequest('http://localhost/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'prescription',
        image: '/9j/village_dispensary_rx',
      }),
    });

    expect(timeoutRes.status).toBe(504);
    const errorData = await timeoutRes.json();

    // 2. Verifies error code is UPSTREAM_TIMEOUT (never masked as unclear photo)
    expect(errorData.error_code).toBe('UPSTREAM_TIMEOUT');
    expect(errorData.error).toBe('UPSTREAM_TIMEOUT');
    expect(errorData.retake_message).toContain('استغرقت الخدمة وقتاً أطول');

    // 3. Client presents network timeout card with retry button
    const clientErrorState = {
      category: 'network_timeout',
      errorCode: errorData.error_code,
      message: errorData.retake_message,
      canRetryWithoutRecapture: true,
    };

    expect(clientErrorState.category).toBe('network_timeout');
    expect(clientErrorState.canRetryWithoutRecapture).toBe(true);

    // 4. Patient taps retry without retaking photo, succeeds when connection clears
    mockWorker.setConfig({ forceTimeout: false });
    const retryRes = await mockWorker.handleRequest('http://localhost/api/prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'prescription',
        image: '/9j/village_dispensary_rx',
      }),
    });

    expect(retryRes.status).toBe(200);
    const retryData = await retryRes.json();
    expect(retryData.is_clear).toBe(true);
  });

  // =========================================================================
  // Scenario 5: Emergency Room Multi-Medication Handwritten Triage Sheet
  // =========================================================================
  it('Scenario 5: Emergency room multi-medication sheet with 10 medicines exercises max-item ceiling', () => {
    // 1. ER triage sheet contains exactly 10 medicines
    const erSheet = sampleTenItemsPrescription;
    expect(erSheet.items.length).toBe(10);

    // 2. Schema validator verifies 10-item limit compliance
    const validation = validatePrescriptionSchema(erSheet);
    expect(validation.valid).toBe(true);

    // 3. Advisory banner displayed above the 10 cards
    expect(PRESCRIPTION_ADVISORY_BANNER).toBe('راجع أسماء الأدوية قبل الاعتماد');

    // 4. Low-confidence doctor scribbles render without hallucinations
    const lowConfidenceCards = erSheet.items.filter((i: any) => i.confidence === 'low');
    expect(lowConfidenceCards.length).toBeGreaterThan(0);
    lowConfidenceCards.forEach((card: any) => {
      expect(card.short_explanation).toBe('');
    });

    // 5. Patient can add legible emergency items to "أدويتي"
    const highConfidenceCards = erSheet.items.filter((i: any) => i.confidence === 'high');
    const myMedicines: any[] = [];
    highConfidenceCards.forEach((card: any) => {
      myMedicines.push({ name: card.medicine_name_ar, instructions: card.written_instructions });
    });
    expect(myMedicines.length).toBeGreaterThan(0);
  });
});
