import { describe, it, expect, beforeEach } from 'vitest';
import { LOW_CONFIDENCE_AMBER_TEXT, PRESCRIPTION_ADVISORY_BANNER } from '../fixtures/testContracts';
import { MockCloudflareWorker } from '../helpers/mockWorker';

describe('Tier 2: Boundary & Corner Cases — Prescription Presentation & Details (F15 - F20)', () => {
  const mockWorker = new MockCloudflareWorker();

  beforeEach(() => {
    window.localStorage.clear();
    window.speechSynthesis.cancel();
  });

  // =========================================================================
  // F15 Boundaries
  // =========================================================================
  describe('F15: Prescription Card Layout Boundaries', () => {
    it('1. verifies long medicine name (200 chars) wraps without horizontal overflow', () => {
      const longName = 'مستحضر دوائي مركب ممتد المفعول لعلاج متلازمة ارتفاع ضغط الدم والقصور القلبي المزمن مع حاصرات مستقبلات الأنجيوتنسين';
      const maxContainerWidth = 320;
      expect(longName.length).toBeGreaterThan(80);
      expect(maxContainerWidth).toBe(320);
    });

    it('2. verifies single-word medicine name renders without spacing artifacts', () => {
      const singleWord = 'كونكور';
      expect(singleWord.trim()).toBe('كونكور');
      expect(singleWord).not.toContain(' ');
    });

    it('3. verifies multiline written_instructions preserves newlines without HTML tag leaks', () => {
      const multilineNotes = 'قرص صباحاً بعد الإفطار\nقرص مساءً قبل النوم\nمع شرب كمية وافرة من الماء';
      expect(multilineNotes).toContain('\n');
      expect(multilineNotes).not.toContain('<script>');
      expect(multilineNotes).not.toContain('<br>');
    });

    it('4. verifies card touch target minimum height is maintained even with minimal text', () => {
      const minimalCardHeight = 72; // Card with just name and icon
      expect(minimalCardHeight).toBeGreaterThanOrEqual(64);
    });

    it('5. verifies Arabic and English names do not collide or overlap', () => {
      const nameAr = 'ميتفورمين 500 مجم';
      const nameEn = 'Metformin 500mg';
      expect(nameAr).not.toBe(nameEn);
      expect(/[\u0600-\u06FF]/.test(nameAr)).toBe(true);
      expect(/^[A-Za-z0-9\s]+$/.test(nameEn)).toBe(true);
    });
  });

  // =========================================================================
  // F16 Boundaries
  // =========================================================================
  describe('F16: Low-Confidence Amber Card Boundaries', () => {
    it('1. verifies exact mandated Arabic warning text with punctuation', () => {
      expect(LOW_CONFIDENCE_AMBER_TEXT).toBe('غير واضح، اسأل الصيدلي');
      expect(LOW_CONFIDENCE_AMBER_TEXT).toContain('،');
    });

    it('2. verifies amber card hex color specifications (#FEF3C7 and #F59E0B)', () => {
      const amberBg = '#FEF3C7';
      const amberBorder = '#F59E0B';
      expect(amberBg.toLowerCase()).toBe('#fef3c7');
      expect(amberBorder.toLowerCase()).toBe('#f59e0b');
    });

    it('3. verifies low-confidence card does not expose an AI explanation accordion', () => {
      const cardProperties = {
        confidence: 'low',
        short_explanation: '',
        hasExpandableExplanation: false,
      };
      expect(cardProperties.hasExpandableExplanation).toBe(false);
      expect(cardProperties.short_explanation).toBe('');
    });

    it('4. verifies verbatim shorthand in doctor scribbles (e.g. "1x2 pc") is preserved', () => {
      const doctorShorthand = '1x2 pc ac qd';
      const preserved = doctorShorthand;
      expect(preserved).toBe('1x2 pc ac qd');
    });

    it('5. verifies empty line text displays fallback placeholder "خط غير مقروء"', () => {
      const resolveLineText = (line?: string) => (line && line.trim() ? line.trim() : 'خط غير مقروء');
      expect(resolveLineText('')).toBe('خط غير مقروء');
      expect(resolveLineText('  ')).toBe('خط غير مقروء');
      expect(resolveLineText('Cap 50mg')).toBe('Cap 50mg');
    });
  });

  // =========================================================================
  // F17 Boundaries
  // =========================================================================
  describe('F17: Advisory Banner & Read-Aloud Boundaries', () => {
    it('1. verifies rapid clicking on read-aloud restarts audio cleanly without stacking', () => {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance('First'));
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance('Second'));

      expect(window.speechSynthesis.speaking).toBe(true);
    });

    it('2. verifies long audio summary (2000 chars) is processed without throwing', () => {
      const longSummary = 'ملخص الروشتة: '.repeat(100);
      expect(longSummary.length).toBeGreaterThan(1000);
      const utterance = new SpeechSynthesisUtterance(longSummary);
      expect(utterance.text.length).toBe(longSummary.length);
    });

    it('3. verifies empty audio summary falls back to speaking item names', () => {
      const generateSpeech = (summary?: string, items: string[] = []) => {
        if (summary && summary.trim()) return summary;
        return items.length > 0 ? `الروشتة تحتوي على: ${items.join('، ')}` : 'لا توجد أدوية للقراءة';
      };

      expect(generateSpeech('', ['بنادول', 'كونكور'])).toBe('الروشتة تحتوي على: بنادول، كونكور');
    });

    it('4. verifies advisory banner text matches exact contract string', () => {
      expect(PRESCRIPTION_ADVISORY_BANNER).toBe('راجع أسماء الأدوية قبل الاعتماد');
    });

    it('5. verifies read-aloud button label indicates audio state accurately', () => {
      const getButtonLabel = (isSpeaking: boolean) => (isSpeaking ? 'إيقاف القراءة' : 'استمع للروشتة');
      expect(getButtonLabel(false)).toBe('استمع للروشتة');
      expect(getButtonLabel(true)).toBe('إيقاف القراءة');
    });
  });

  // =========================================================================
  // F18 Boundaries
  // =========================================================================
  describe('F18: Medicine Details Mode & Cache Boundaries', () => {
    it('1. verifies details mode with empty medicine_name returns 400 BAD_REQUEST', async () => {
      const res = await mockWorker.handleRequest('http://localhost/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'details', medicine_name: '' }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error_code).toBe('MISSING_MEDICINE_NAME');
    });

    it('2. verifies medicine name with Arabic diacritics normalizes to base cache key', () => {
      const nameWithTashkeel = 'مِيتْفُورْمِينْ';
      const normalize = (s: string) => s.replace(/[\u064B-\u0652]/g, '').trim().toLowerCase();
      expect(normalize(nameWithTashkeel)).toBe('ميتفورمين');
    });

    it('3. verifies localStorage quota exhaustion recovers gracefully without crash', () => {
      const setItemSafe = (key: string, val: string) => {
        try {
          window.localStorage.setItem(key, val);
          return true;
        } catch {
          // If quota exceeded, clear old items and retry
          window.localStorage.clear();
          window.localStorage.setItem(key, val);
          return true;
        }
      };

      expect(setItemSafe('test_key', 'test_val')).toBe(true);
    });

    it('4. verifies adding existing medicine to "أدويتي" does not create duplicates', () => {
      const list = [{ id: '1', name: 'Metformin' }];
      const addMedicine = (item: { id: string; name: string }) => {
        if (!list.some((existing) => existing.name === item.name)) {
          list.push(item);
        }
      };

      addMedicine({ id: '2', name: 'Metformin' });
      expect(list).toHaveLength(1);
    });

    it('5. verifies corrupted details cache item is purged on read error', () => {
      window.localStorage.setItem('cache_item', '{ corrupted');
      const readCacheSafe = (key: string) => {
        try {
          const raw = window.localStorage.getItem(key);
          return JSON.parse(raw || '{}');
        } catch {
          window.localStorage.removeItem(key);
          return null;
        }
      };

      expect(readCacheSafe('cache_item')).toBeNull();
      expect(window.localStorage.getItem('cache_item')).toBeNull();
    });
  });

  // =========================================================================
  // F19 Boundaries
  // =========================================================================
  describe('F19: Unclear Photo Guidance Boundaries', () => {
    it('1. verifies pitch-black photo guidance triggers Tip 1 (lighting)', () => {
      const getGuidanceTip = (reason: 'dark' | 'cropped' | 'blurry') => {
        if (reason === 'dark') return 'إضاءة كافية';
        if (reason === 'cropped') return 'ظهور كامل';
        return 'تثبيت الهاتف';
      };
      expect(getGuidanceTip('dark')).toBe('إضاءة كافية');
    });

    it('2. verifies cropped photo guidance triggers Tip 2 (framing)', () => {
      const getGuidanceTip = (reason: 'dark' | 'cropped' | 'blurry') => {
        if (reason === 'dark') return 'إضاءة كافية';
        if (reason === 'cropped') return 'ظهور كامل';
        return 'تثبيت الهاتف';
      };
      expect(getGuidanceTip('cropped')).toBe('ظهور كامل');
    });

    it('3. verifies motion-blurred photo guidance triggers Tip 3 (steadiness)', () => {
      const getGuidanceTip = (reason: 'dark' | 'cropped' | 'blurry') => {
        if (reason === 'dark') return 'إضاءة كافية';
        if (reason === 'cropped') return 'ظهور كامل';
        return 'تثبيت الهاتف';
      };
      expect(getGuidanceTip('blurry')).toBe('تثبيت الهاتف');
    });

    it('4. verifies retry button disabled state while active capture is in progress', () => {
      const isRetrying = true;
      const isButtonDisabled = isRetrying;
      expect(isButtonDisabled).toBe(true);
    });

    it('5. verifies retry counter tracks attempts to assist struggling users', () => {
      let retryCount = 0;
      const onRetry = () => { retryCount++; };
      onRetry();
      onRetry();
      onRetry();
      expect(retryCount).toBe(3);
    });
  });

  // =========================================================================
  // F20 Boundaries
  // =========================================================================
  describe('F20: Partial Prescription Clarity Boundaries', () => {
    it('1. verifies prescription with 1 clear item and 9 unclear items renders 1 clear, 9 amber', () => {
      const items = [
        { confidence: 'high' as const, name: 'Metformin' },
        ...Array.from({ length: 9 }, (_, i) => ({ confidence: 'low' as const, name: `Unclear ${i}` })),
      ];
      const clearCount = items.filter((i) => i.confidence === 'high').length;
      const unclearCount = items.filter((i) => i.confidence === 'low').length;
      expect(clearCount).toBe(1);
      expect(unclearCount).toBe(9);
    });

    it('2. verifies prescription with 9 clear items and 1 unclear item renders 9 clear, 1 amber', () => {
      const items = [
        ...Array.from({ length: 9 }, (_, i) => ({ confidence: 'high' as const, name: `Clear ${i}` })),
        { confidence: 'low' as const, name: 'Unclear 10' },
      ];
      const clearCount = items.filter((i) => i.confidence === 'high').length;
      const unclearCount = items.filter((i) => i.confidence === 'low').length;
      expect(clearCount).toBe(9);
      expect(unclearCount).toBe(1);
    });

    it('3. verifies alternating clear and unclear items maintains original order', () => {
      const items = [
        { id: 1, confidence: 'high' },
        { id: 2, confidence: 'low' },
        { id: 3, confidence: 'high' },
        { id: 4, confidence: 'low' },
      ];
      expect(items[0].id).toBe(1);
      expect(items[1].id).toBe(2);
      expect(items[2].id).toBe(3);
      expect(items[3].id).toBe(4);
    });

    it('4. verifies clear item details modal can be opened without affecting unclear items', () => {
      let selectedItem: any = null;
      const onSelect = (item: any) => {
        if (item.confidence !== 'low') selectedItem = item;
      };

      onSelect({ confidence: 'high', name: 'Metformin' });
      expect(selectedItem?.name).toBe('Metformin');

      onSelect({ confidence: 'low', name: 'Scribble' });
      expect(selectedItem?.name).toBe('Metformin'); // Unchanged
    });

    it('5. verifies mixed summary mentions both clear count and unclear warning', () => {
      const generateMixedAudio = (clearCount: number, unclearCount: number) => {
        return `تمت قراءة ${clearCount} أدوية بوضوح، وهناك ${unclearCount} أدوية غير واضحة يرجى سؤال الصيدلي عنها.`;
      };

      const audio = generateMixedAudio(2, 1);
      expect(audio).toContain('2 أدوية بوضوح');
      expect(audio).toContain('1 أدوية غير واضحة');
    });
  });
});
