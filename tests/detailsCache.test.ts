import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizeMedicineName,
  getCacheKey,
  getCachedDetails,
  setCachedDetails,
  clearDetailsCache,
  DETAILS_CACHE_PREFIX
} from '../src/services/detailsCache';
import { MedicineAnalysisResult } from '../src/types';

describe('Medicine Details Cache Service (detailsCache.ts)', () => {
  const sampleResult: MedicineAnalysisResult = {
    is_clear: true,
    medicine_name_ar: 'بانادول إكسترا',
    medicine_name_en: 'Panadol Extra',
    active_ingredient: 'باراسيتامول + كافيين',
    uses: ['تسكين الصداع', 'خفض الحرارة'],
    how_and_when: [
      'قرص أو قرصان بعد الأكل',
      'يؤخذ القرص عبر الفم مع كوب ماء كامل',
      'يُفضل تناوله في نفس الموعد يومياً'
    ],
    usage_source: 'common',
    warnings: ['لا تتناول أكثر من 8 أقراص يومياً', 'استشر الطبيب أو الصيدلي'],
    audio_summary: 'دواء بانادول إكسترا مسكن للصداع'
  };

  beforeEach(() => {
    clearDetailsCache();
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearDetailsCache();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Name Normalization (normalizeMedicineName)', () => {
    it('trims leading and trailing whitespace and lowercases Latin text', () => {
      expect(normalizeMedicineName('  Panadol Extra 500mg  ')).toBe('panadol_extra_500mg');
    });

    it('strips Arabic tashkeel (fatha, damma, kasra, shadda, sukun, tanween, tatweel)', () => {
      const withTashkeel = 'بَانَادُولْ إِكْسْتْرَاـ';
      const normalized = normalizeMedicineName(withTashkeel);
      expect(normalized).toBe('بانادول_اكسترا');
    });

    it('normalizes Arabic letter variants (alif with hamza, taa marbuta, alif maqsura)', () => {
      expect(normalizeMedicineName('أَسْبِرِين')).toBe('اسبرين');
      expect(normalizeMedicineName('إيبوبروفين')).toBe('ايبوبروفين');
      expect(normalizeMedicineName('أدول')).toBe('ادول');
      expect(normalizeMedicineName('مضاد حيوي')).toBe('مضاد_حيوي');
    });

    it('normalizes multiple spaces to a single underscore separator', () => {
      expect(normalizeMedicineName('أوجمنتين    1000   مجم')).toBe('اوجمنتين_1000_مجم');
    });

    it('handles null, undefined, or empty strings safely', () => {
      expect(normalizeMedicineName('')).toBe('');
      expect(normalizeMedicineName(null as unknown as string)).toBe('');
      expect(normalizeMedicineName(undefined as unknown as string)).toBe('');
      expect(normalizeMedicineName('   ')).toBe('');
    });
  });

  describe('2. Cache Key Generation (getCacheKey)', () => {
    it('prefixes normalized name with dalili_details_', () => {
      const key = getCacheKey('بانادول');
      expect(key).toBe(`${DETAILS_CACHE_PREFIX}بانادول`);
    });

    it('generates identical cache key for diacritic-varying inputs', () => {
      const key1 = getCacheKey('بَانَادُول إِكْسْتْرَا');
      const key2 = getCacheKey('بانادول اكسترا');
      expect(key1).toBe(key2);
    });
  });

  describe('3. Cache Storage & Retrieval (getCachedDetails & setCachedDetails)', () => {
    it('returns null on cache miss', () => {
      expect(getCachedDetails('دواء غير موجود')).toBeNull();
    });

    it('stores and retrieves MedicineAnalysisResult successfully', () => {
      setCachedDetails('بانادول إكسترا', sampleResult);

      const cached = getCachedDetails('بانادول إكسترا');
      expect(cached).not.toBeNull();
      expect(cached?.is_clear).toBe(true);
      expect(cached?.medicine_name_ar).toBe('بانادول إكسترا');
      expect(cached?.active_ingredient).toBe('باراسيتامول + كافيين');
      expect(cached?.usage_source).toBe('common');
      expect(cached?.how_and_when).toHaveLength(3);
    });

    it('retrieves cached data using diacritic-accented query', () => {
      setCachedDetails('بانادول اكسترا', sampleResult);

      const retrieved = getCachedDetails('بَانَادُولْ إِكْسْتْرَا');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.medicine_name_en).toBe('Panadol Extra');
    });

    it('ignores setCachedDetails with empty name or missing data', () => {
      setCachedDetails('', sampleResult);
      setCachedDetails('   ', sampleResult);
      setCachedDetails('دواء', null as unknown as MedicineAnalysisResult);

      expect(getCachedDetails('')).toBeNull();
      expect(getCachedDetails('دواء')).toBeNull();
    });

    it('handles corrupted JSON in localStorage safely and returns null', () => {
      const key = getCacheKey('تست');
      localStorage.setItem(key, '{ invalid json string');

      expect(getCachedDetails('تست')).toBeNull();
      // Corrupt item should be removed
      expect(localStorage.getItem(key)).toBeNull();
    });

    it('returns null if cached item has is_clear: false', () => {
      setCachedDetails('دواء غير واضح', {
        is_clear: false,
        raw_error: 'صورة غير واضحة'
      });

      expect(getCachedDetails('دواء غير واضح')).toBeNull();
    });
  });

  describe('4. Cache Clearing (clearDetailsCache)', () => {
    it('removes all dalili_details_ entries without affecting other localStorage keys', () => {
      localStorage.setItem('user_font_size', 'large');
      localStorage.setItem('dalili_history', JSON.stringify([{ id: '1' }]));

      setCachedDetails('بانادول', sampleResult);
      setCachedDetails('أسبرين', { ...sampleResult, medicine_name_ar: 'أسبرين' });

      expect(getCachedDetails('بانادول')).not.toBeNull();
      expect(getCachedDetails('أسبرين')).not.toBeNull();

      clearDetailsCache();

      expect(getCachedDetails('بانادول')).toBeNull();
      expect(getCachedDetails('أسبرين')).toBeNull();
      expect(localStorage.getItem('user_font_size')).toBe('large');
      expect(localStorage.getItem('dalili_history')).not.toBeNull();
    });
  });

  describe('5. Error Resilience & Fallback Handling', () => {
    it('gracefully handles QuotaExceededError on localStorage.setItem', () => {
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
        throw error;
      });

      // Should not throw
      expect(() => setCachedDetails('كونجستال', sampleResult)).not.toThrow();

      // Falls back to in-memory map
      const cached = getCachedDetails('كونجستال');
      expect(cached).not.toBeNull();
      expect(cached?.medicine_name_ar).toBe('بانادول إكسترا');
    });

    it('gracefully handles SecurityError when localStorage is blocked', () => {
      vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });

      expect(() => getCachedDetails('أدول')).not.toThrow();
      expect(getCachedDetails('أدول')).toBeNull();
    });
  });
});
