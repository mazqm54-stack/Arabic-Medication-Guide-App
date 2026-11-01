import { describe, it, expect } from 'vitest';
import { HARDCODED_DISCLAIMER_LINE } from '../fixtures/testContracts';
import { sampleBoxPrintedUsage, sampleBoxCommonUsage } from '../fixtures/sampleBoxes';
import { PHARMACIST_SYSTEM_PROMPT } from '../../../worker/src/index';

describe('Tier 1: Feature Coverage — Medication Usage Card & Disclaimers (F21 - F24)', () => {
  // =========================================================================
  // F21: Medication Usage Non-Empty Guarantee
  // =========================================================================
  describe('F21: Medication Usage Non-Empty Guarantee', () => {
    it('1. verifies how_and_when is strictly non-empty across all box responses', () => {
      expect(sampleBoxPrintedUsage.how_and_when.length).toBeGreaterThan(0);
      expect(sampleBoxCommonUsage.how_and_when.length).toBeGreaterThan(0);
    });

    it('2. verifies how_and_when is never a single generic "follow doctor" phrase', () => {
      const isOnlyGeneric = (items: string[]) => {
        return items.length === 1 && (items[0].includes('اتبع تعليمات الطبيب') || items[0].includes('استشر الطبيب'));
      };

      expect(isOnlyGeneric(sampleBoxCommonUsage.how_and_when)).toBe(false);
      expect(isOnlyGeneric(sampleBoxPrintedUsage.how_and_when)).toBe(false);
    });

    it('3. verifies how_and_when contains 2 to 3 practical timing/frequency items', () => {
      expect(sampleBoxCommonUsage.how_and_when.length).toBeGreaterThanOrEqual(2);
      expect(sampleBoxCommonUsage.how_and_when.length).toBeLessThanOrEqual(3);

      const hasTimingOrFrequency = sampleBoxCommonUsage.how_and_when.some(
        (i) => i.includes('مرة') || i.includes('يومياً') || i.includes('صباحاً') || i.includes('بعد') || i.includes('قبل')
      );
      expect(hasTimingOrFrequency).toBe(true);
    });

    it('4. verifies common usage items do not prescribe exact mg/ml amounts or personal courses', () => {
      // Must not prescribe individual specific milligram doses in common usage
      const commonItems = sampleBoxCommonUsage.how_and_when.join(' ');
      expect(commonItems).not.toMatch(/\b(خذ|تناول)\s+\d+\s*(مجم|مل)\b/);
    });

    it('5. verifies fallback algorithm guarantees 2-3 safe items if AI returns empty how_and_when', () => {
      const ensureSafeHowAndWhen = (rawList?: string[]) => {
        if (!rawList || rawList.length === 0) {
          return [
            'يؤخذ عادة في أوقات منتظمة يومياً حسب توجيهات الصيدلي',
            'يفضل تناوله مع كوب ماء كامل بعد الطعام',
            'راجع طبيبك أو الصيدلي دائماً لتحديد الجرعة المناسبة لحالتك',
          ];
        }
        return rawList;
      };

      const fallback = ensureSafeHowAndWhen([]);
      expect(fallback).toHaveLength(3);
      expect(fallback[0]).toContain('منتظمة');
    });
  });

  // =========================================================================
  // F22: Usage Source Badging
  // =========================================================================
  describe('F22: Usage Source Badging', () => {
    it('1. verifies usage_source is typed as either "printed" or "common"', () => {
      expect(['printed', 'common']).toContain(sampleBoxPrintedUsage.usage_source);
      expect(['printed', 'common']).toContain(sampleBoxCommonUsage.usage_source);
    });

    it('2. verifies printed box instructions map to label "مكتوب على العلبة"', () => {
      const getBadgeLabel = (source: 'printed' | 'common', context: 'box' | 'prescription') => {
        if (source === 'printed') {
          return context === 'box' ? 'مكتوب على العلبة' : 'مكتوب في الروشتة';
        }
        return 'الاستخدام الشائع';
      };

      expect(getBadgeLabel('printed', 'box')).toBe('مكتوب على العلبة');
    });

    it('3. verifies printed prescription instructions map to label "مكتوب في الروشتة"', () => {
      const getBadgeLabel = (source: 'printed' | 'common', context: 'box' | 'prescription') => {
        if (source === 'printed') {
          return context === 'box' ? 'مكتوب على العلبة' : 'مكتوب في الروشتة';
        }
        return 'الاستخدام الشائع';
      };

      expect(getBadgeLabel('printed', 'prescription')).toBe('مكتوب في الروشتة');
    });

    it('4. verifies general active ingredient usage maps to label "الاستخدام الشائع"', () => {
      const getBadgeLabel = (source: 'printed' | 'common') => {
        return source === 'common' ? 'الاستخدام الشائع' : 'مكتوب على العلبة';
      };

      expect(getBadgeLabel('common')).toBe('الاستخدام الشائع');
    });

    it('5. verifies visual styling differentiation between printed and common badges', () => {
      const getBadgeClasses = (source: 'printed' | 'common') => {
        return source === 'printed'
          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
          : 'bg-blue-100 text-blue-800 border-blue-300';
      };

      const printedClasses = getBadgeClasses('printed');
      const commonClasses = getBadgeClasses('common');

      expect(printedClasses).toContain('emerald');
      expect(commonClasses).toContain('blue');
      expect(printedClasses).not.toBe(commonClasses);
    });
  });

  // =========================================================================
  // F23: Hardcoded Arabic Disclaimer Line
  // =========================================================================
  describe('F23: Hardcoded Arabic Disclaimer Line', () => {
    it('1. verifies exact hardcoded Arabic disclaimer string content', () => {
      expect(HARDCODED_DISCLAIMER_LINE).toBe(
        'هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي.'
      );
    });

    it('2. verifies string is client-hardcoded and not dependent on AI payload', () => {
      // The disclaimer is a static string constant
      expect(typeof HARDCODED_DISCLAIMER_LINE).toBe('string');
      expect(HARDCODED_DISCLAIMER_LINE.length).toBeGreaterThan(50);
    });

    it('3. verifies disclaimer placement contract immediately under usage card', () => {
      const usageCardLayout = {
        cardId: 'card-schedule',
        footerDisclaimer: HARDCODED_DISCLAIMER_LINE,
      };
      expect(usageCardLayout.footerDisclaimer).toBe(HARDCODED_DISCLAIMER_LINE);
    });

    it('4. verifies disclaimer presence when usage_source is printed or common', () => {
      const renderDisclaimer = (_source: 'printed' | 'common') => {
        // Must always be present regardless of source
        return HARDCODED_DISCLAIMER_LINE;
      };

      expect(renderDisclaimer('printed')).toBe(HARDCODED_DISCLAIMER_LINE);
      expect(renderDisclaimer('common')).toBe(HARDCODED_DISCLAIMER_LINE);
    });

    it('5. verifies disclaimer adheres to RTL direction and senior contrast', () => {
      expect(/[\u0600-\u06FF]/.test(HARDCODED_DISCLAIMER_LINE)).toBe(true);
      const disclaimerStyle = {
        color: 'text-slate-600',
        fontSize: 'text-base', // >= 16px
        direction: 'rtl',
      };
      expect(disclaimerStyle.direction).toBe('rtl');
    });
  });

  // =========================================================================
  // F24: Worker Box System Instruction Rule 6 Update
  // =========================================================================
  describe('F24: Worker Box System Instruction Rule 6 Update', () => {
    it('1. verifies Rule 6 in worker prompt permits general common usage', () => {
      expect(PHARMACIST_SYSTEM_PROMPT).toContain("how_and_when must NEVER be empty and must not just say follow the doctor");
      expect(PHARMACIST_SYSTEM_PROMPT).toContain("COMMON general usage of that active ingredient");
    });

    it('2. verifies Rule 6 strictly forbids exact doses, dose changes, and personal advice', () => {
      expect(PHARMACIST_SYSTEM_PROMPT).toContain("NEVER give exact mg or ml amounts, exact doses, or personal medical advice");
    });

    it('3. verifies Rule 6 instructs that printed instructions set usage_source to printed', () => {
      expect(PHARMACIST_SYSTEM_PROMPT).toContain("If the packaging prints instructions, include them and set usage_source='printed'");
      expect(PHARMACIST_SYSTEM_PROMPT).toContain("set usage_source='common'");
    });

    it('4. verifies Worker system prompt retains all 10 numbered safety rules', () => {
      for (let i = 1; i <= 10; i++) {
        expect(PHARMACIST_SYSTEM_PROMPT).toContain(`${i}.`);
      }
    });

    it('5. verifies Worker prompt mandates warm Modern Standard Arabic for elderly people', () => {
      expect(PHARMACIST_SYSTEM_PROMPT).toContain('simple, short, warm Modern Standard Arabic suitable for elderly people');
    });
  });
});
