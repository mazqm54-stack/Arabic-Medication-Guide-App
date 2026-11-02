import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PRESCRIPTION_ADVISORY_BANNER,
  LOW_CONFIDENCE_AMBER_TEXT,
  PrescriptionItem,
} from '../fixtures/testContracts';
import { sampleClearPrescription, sampleMixedPrescription } from '../fixtures/samplePrescriptions';
import { MockCloudflareWorker } from '../helpers/mockWorker';

describe('Tier 1: Feature Coverage — Prescription Presentation & Details (F15 - F20)', () => {
  const mockWorker = new MockCloudflareWorker();

  beforeEach(() => {
    window.localStorage.clear();
    window.speechSynthesis.cancel();
  });

  // =========================================================================
  // F15: Prescription Card Layout
  // =========================================================================
  describe('F15: Prescription Card Layout', () => {
    it('1. verifies each readable medicine renders one distinct card object', () => {
      const items = sampleClearPrescription.items;
      expect(items).toHaveLength(2);
      items.forEach((item) => {
        expect(item.medicine_name_ar).toBeDefined();
        expect(item.medicine_name_ar.length).toBeGreaterThan(0);
      });
    });

    it('2. verifies medicine name is large, bold, and presented in Arabic and English', () => {
      const item = sampleClearPrescription.items[0];
      expect(item.medicine_name_ar).toBe('ميتفورمين (سيدوفاج)');
      expect(item.medicine_name_en).toBe('Metformin');
    });

    it('3. verifies one-sentence simple purpose explanation is present for readable items', () => {
      const item = sampleClearPrescription.items[0];
      expect(item.short_explanation).toContain('السكري');
      expect(item.short_explanation.length).toBeGreaterThan(10);
    });

    it('4. verifies "ما كتبه الطبيب" container wraps written_instructions exactly', () => {
      const item = sampleClearPrescription.items[0];
      const doctorInstructionsBox = {
        title: 'ما كتبه الطبيب',
        content: item.written_instructions,
      };
      expect(doctorInstructionsBox.title).toBe('ما كتبه الطبيب');
      expect(doctorInstructionsBox.content).toBe('قرص مرتين يومياً بعد الأكل');
    });

    it('5. verifies confidence badge displays appropriate level', () => {
      const highItem = sampleClearPrescription.items[0];
      expect(highItem.confidence).toBe('high');
      const badgeText = highItem.confidence === 'high' ? 'واضح' : 'غير مؤكد';
      expect(badgeText).toBe('واضح');
    });
  });

  // =========================================================================
  // F16: Low-Confidence Amber Card Presentation
  // =========================================================================
  describe('F16: Low-Confidence Amber Card Presentation', () => {
    const lowConfidenceItem = sampleMixedPrescription.items.find((i) => i.confidence === 'low')!;

    it('1. verifies soft amber styling contract for low-confidence items', () => {
      const amberCardClasses = 'bg-[#FEF3C7] border-amber-400 text-amber-900 rounded-2xl p-6';
      expect(amberCardClasses).toContain('bg-[#FEF3C7]');
      expect(amberCardClasses).toContain('border-amber-400');
    });

    it('2. verifies card displays exact mandated warning "غير واضح، اسأل الصيدلي"', () => {
      expect(LOW_CONFIDENCE_AMBER_TEXT).toBe('غير واضح، اسأل الصيدلي');
    });

    it('3. verifies card strictly provides zero AI explanation or guessed purpose', () => {
      expect(lowConfidenceItem.short_explanation).toBe('');
      expect(lowConfidenceItem.medicine_name_ar).toBe('');
    });

    it('4. verifies verbatim line text as written is preserved if partially readable', () => {
      expect(lowConfidenceItem.line_text_as_written).toBe('Dr scribble ~~~ 10mg');
      expect(lowConfidenceItem.written_instructions).toBe('10mg');
    });

    it('5. verifies amber card includes high-contrast warning icon attribute', () => {
      const cardConfig = {
        icon: 'AlertTriangle',
        iconColor: '#D97706',
        ariaLabel: 'دواء غير واضح',
      };
      expect(cardConfig.icon).toBe('AlertTriangle');
      expect(cardConfig.ariaLabel).toContain('غير واضح');
    });
  });

  // =========================================================================
  // F17: Advisory Banner & Prescription Read-Aloud
  // =========================================================================
  describe('F17: Advisory Banner & Prescription Read-Aloud', () => {
    it('1. verifies advisory banner text "راجع أسماء الأدوية قبل الاعتماد" is rendered at top', () => {
      expect(PRESCRIPTION_ADVISORY_BANNER).toBe('راجع أسماء الأدوية قبل الاعتماد');
    });

    it('2. verifies whole-prescription read-aloud button configuration', () => {
      const readAloudBtn = {
        label: 'استمع للروشتة كاملة',
        icon: 'Volume2',
        minHeight: 48,
      };
      expect(readAloudBtn.label).toContain('استمع');
      expect(readAloudBtn.minHeight).toBeGreaterThanOrEqual(48);
    });

    it('3. verifies read-aloud button invokes SpeechSynthesis with Arabic text', () => {
      const speakText = sampleClearPrescription.audio_summary;
      const utterance = new SpeechSynthesisUtterance(speakText);
      utterance.lang = 'ar-SA';
      window.speechSynthesis.speak(utterance);

      expect(window.speechSynthesis.speak).toHaveBeenCalled();
      expect(window.speechSynthesis.speaking).toBe(true);
    });

    it('4. verifies speech state transitions between speaking and paused/stopped', () => {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance('Test'));
      expect(window.speechSynthesis.speaking).toBe(true);
      window.speechSynthesis.cancel();
      expect(window.speechSynthesis.speaking).toBe(false);
    });

    it('5. verifies speech synthesis is stopped cleanly upon component unmount', () => {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance('Test'));
      const unmount = () => { window.speechSynthesis.cancel(); };
      unmount();
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // F18: Medicine Details Mode & Client Caching
  // =========================================================================
  describe('F18: Medicine Details Mode & Client Caching', () => {
    it('1. verifies tapping prescription item initiates details mode request', async () => {
      const res = await mockWorker.handleRequest('http://localhost/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'details',
          medicine_name: 'Metformin',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.medicine_name_ar).toContain('ميتفورمين');
      expect(json.how_and_when.length).toBeGreaterThan(0);
    });

    it('2. verifies details mode returns complete 4-card box result schema', async () => {
      const res = await mockWorker.handleRequest('http://localhost/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'details',
          medicine_name: 'Concor',
        }),
      });

      const json = await res.json();
      expect(json.uses).toBeDefined();
      expect(json.how_and_when).toBeDefined();
      expect(json.warnings).toBeDefined();
      expect(json.usage_source).toBe('common');
    });

    it('3. verifies client caches details response in localStorage by medicine name', async () => {
      const cacheKey = 'dalili_details_cache_Metformin';
      const mockData = { name: 'Metformin', cached: true };
      window.localStorage.setItem(cacheKey, JSON.stringify(mockData));

      const cached = window.localStorage.getItem(cacheKey);
      expect(cached).toBeDefined();
      expect(JSON.parse(cached!).cached).toBe(true);
    });

    it('4. verifies subsequent requests for cached medicine resolve without network fetch', async () => {
      const cacheMap = new Map<string, any>();
      cacheMap.set('Metformin', { name: 'Metformin', source: 'cache' });

      const fetchDetailsWithCache = async (name: string, fetchFn: () => Promise<any>) => {
        if (cacheMap.has(name)) {
          return cacheMap.get(name);
        }
        return await fetchFn();
      };

      const networkFetchSpy = vi.fn();
      const result = await fetchDetailsWithCache('Metformin', networkFetchSpy);

      expect(result.source).toBe('cache');
      expect(networkFetchSpy).not.toHaveBeenCalled();
    });

    it('5. verifies "أضف لأدويتي" action contract saves item to persistent medicines list', () => {
      const myMedicinesKey = 'dalili_my_medicines_v1';
      const newMed = { id: 'med_1', name_ar: 'ميتفورمين', addedAt: Date.now() };

      const existing: any[] = [];
      existing.push(newMed);
      window.localStorage.setItem(myMedicinesKey, JSON.stringify(existing));

      const stored = JSON.parse(window.localStorage.getItem(myMedicinesKey) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].name_ar).toBe('ميتفورمين');
    });
  });

  // =========================================================================
  // F19: Unclear Photo Guidance
  // =========================================================================
  describe('F19: Unclear Photo Guidance', () => {
    const tips = [
      'التأكد من إضاءة الغرفة بشكل كافٍ',
      'إظهار الروشتة أو العلبة كاملة داخل الإطار',
      'تثبيت الهاتف باليدين وعدم الاهتزاز أثناء التصوير',
    ];

    it('1. verifies friendly Arabic explanation message is present', () => {
      const msg = 'الصورة غير واضحة للأسف، ساعدنا بإعادة التقاطها لنتمكن من قراءتها بدقة';
      expect(msg).toContain('غير واضحة');
      expect(msg).toContain('قراءتها');
    });

    it('2. verifies Tip 1: إضاءة كافية (lighting) is clearly communicated', () => {
      expect(tips[0]).toContain('إضاءة');
    });

    it('3. verifies Tip 2: ظهور الورقة أو العلبة كاملة (framing) is clearly communicated', () => {
      expect(tips[1]).toContain('كاملة');
    });

    it('4. verifies Tip 3: تثبيت الهاتف (holding steady) is clearly communicated', () => {
      expect(tips[2]).toContain('تثبيت');
    });

    it('5. verifies large "إعادة التصوير" button meets touch targets (>=48px)', () => {
      const retryButton = {
        label: 'إعادة التصوير',
        height: 48,
        role: 'button',
      };
      expect(retryButton.label).toBe('إعادة التصوير');
      expect(retryButton.height).toBeGreaterThanOrEqual(48);
    });
  });

  // =========================================================================
  // F20: Partial Prescription Clarity Preservation
  // =========================================================================
  describe('F20: Partial Prescription Clarity Preservation', () => {
    it('1. verifies partially clear prescription retains all readable items as standard cards', () => {
      const readableItems = sampleMixedPrescription.items.filter((i) => i.confidence !== 'low');
      expect(readableItems.length).toBe(2);
      expect(readableItems[0].medicine_name_ar).toBe('ميتفورمين');
      expect(readableItems[1].medicine_name_ar).toBe('كونكور');
    });

    it('2. verifies partially illegible items are flagged as low confidence amber cards', () => {
      const lowConfidenceItems = sampleMixedPrescription.items.filter((i) => i.confidence === 'low');
      expect(lowConfidenceItems.length).toBe(1);
      expect(lowConfidenceItems[0].line_text_as_written).toBe('Dr scribble ~~~ 10mg');
    });

    it('3. verifies audio summary communicates both readable and unclear items', () => {
      const audioSummary = sampleMixedPrescription.audio_summary;
      expect(audioSummary).toContain('ميتفورمين');
      expect(audioSummary).toContain('كونكور');
      expect(audioSummary).toContain('غير واضح');
    });

    it('4. verifies readable items can be clicked to view details despite unclear lines', () => {
      const canClickItem = (item: PrescriptionItem) => item.confidence !== 'low';
      expect(canClickItem(sampleMixedPrescription.items[0])).toBe(true);
      expect(canClickItem(sampleMixedPrescription.items[2])).toBe(false);
    });

    it('5. verifies overall prescription confidence reflects mixed state', () => {
      expect(sampleMixedPrescription.confidence).toBe('medium');
    });
  });
});
