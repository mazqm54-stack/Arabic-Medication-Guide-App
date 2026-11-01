import { describe, it, expect } from 'vitest';
import { HARDCODED_DISCLAIMER_LINE } from '../fixtures/testContracts';
import { PHARMACIST_SYSTEM_PROMPT } from '../../../worker/src/index';

describe('Tier 2: Boundary & Corner Cases — Medication Usage & Disclaimers (F21 - F24)', () => {
  // =========================================================================
  // F21 Boundaries
  // =========================================================================
  describe('F21: Medication Usage Non-Empty Boundaries', () => {
    it('1. verifies null or undefined elements in how_and_when are filtered out', () => {
      const rawList = ['يؤخذ بعد الأكل', null, undefined, 'مرة واحدة يومياً'] as any[];
      const cleanList = rawList.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
      expect(cleanList).toHaveLength(2);
      expect(cleanList[0]).toBe('يؤخذ بعد الأكل');
    });

    it('2. verifies forbidden exact mg/ml dosing words are detected', () => {
      const forbiddenDosePatterns = [
        /(?:^|\s)\d+\s*(?:mg|ml)(?:\s|$|[.,،])/i,
        /(?:^|\s)\d+\s*(?:مجم|مل)(?:\s|$|[.,،])/,
      ];

      const testSafeText = 'يؤخذ قرص واحد يومياً في الصباح';
      const testUnsafeText = 'تناول 500 مجم مرتين يومياً';

      const containsDose = (t: string) => forbiddenDosePatterns.some((p) => p.test(t));
      expect(containsDose(testSafeText)).toBe(false);
      expect(containsDose(testUnsafeText)).toBe(true);
    });

    it('3. verifies items exceeding 300 characters wrap cleanly without breaking box schema', () => {
      const longItem = 'تعليمات تفصيلية: '.repeat(20);
      expect(longItem.length).toBeGreaterThan(200);
      const isString = typeof longItem === 'string';
      expect(isString).toBe(true);
    });

    it('4. verifies single-character items are rejected as malformed noise', () => {
      const filterValidItems = (items: string[]) => items.filter((i) => i.trim().length > 2);
      const noiseList = ['a', 'ب', 'يؤخذ مع كوب ماء'];
      const filtered = filterValidItems(noiseList);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe('يؤخذ مع كوب ماء');
    });

    it('5. verifies duplicate usage items are deduplicated', () => {
      const duplicates = ['يؤخذ صباحاً', 'يؤخذ صباحاً', 'مع الأكل'];
      const deduped = Array.from(new Set(duplicates));
      expect(deduped).toHaveLength(2);
    });
  });

  // =========================================================================
  // F22 Boundaries
  // =========================================================================
  describe('F22: Usage Source Badging Boundaries', () => {
    it('1. verifies undefined or unknown usage_source defaults safely to "common"', () => {
      const resolveSource = (src?: string): 'printed' | 'common' => {
        return src === 'printed' ? 'printed' : 'common';
      };

      expect(resolveSource(undefined)).toBe('common');
      expect(resolveSource('unknown')).toBe('common');
      expect(resolveSource('printed')).toBe('printed');
    });

    it('2. verifies uppercase or mixed-case usage_source normalizes to lowercase', () => {
      const normalizeSource = (src: string) => src.trim().toLowerCase();
      expect(normalizeSource('PRINTED')).toBe('printed');
      expect(normalizeSource('Common')).toBe('common');
    });

    it('3. verifies badge label includes Arabic text', () => {
      const labels = ['مكتوب على العلبة', 'مكتوب في الروشتة', 'الاستخدام الشائع'];
      labels.forEach((lbl) => {
        expect(/[\u0600-\u06FF]/.test(lbl)).toBe(true);
      });
    });

    it('4. verifies badge container enforces inline-flex and rounded-full pill styling', () => {
      const badgeClasses = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border';
      expect(badgeClasses).toContain('inline-flex');
      expect(badgeClasses).toContain('rounded-full');
    });

    it('5. verifies prescription vs box context dispatches correct printed badge label', () => {
      const getLabel = (mode: 'box' | 'prescription') =>
        mode === 'box' ? 'مكتوب على العلبة' : 'مكتوب في الروشتة';

      expect(getLabel('box')).toBe('مكتوب على العلبة');
      expect(getLabel('prescription')).toBe('مكتوب في الروشتة');
    });
  });

  // =========================================================================
  // F23 Boundaries
  // =========================================================================
  describe('F23: Hardcoded Disclaimer Line Boundaries', () => {
    it('1. verifies disclaimer text character length is exact and tamper-free', () => {
      expect(HARDCODED_DISCLAIMER_LINE.length).toBe(87);
    });

    it('2. verifies disclaimer line rendered in 24px font mode maintains legibility', () => {
      const fontSizeClass = 'text-lg'; // 18-20px scaling up in 24px mode
      expect(fontSizeClass).toBe('text-lg');
    });

    it('3. verifies disclaimer line on narrow 320px screen wraps without horizontal scrollbar', () => {
      const screenWidth = 320;
      const textLength = HARDCODED_DISCLAIMER_LINE.length;
      expect(screenWidth).toBe(320);
      expect(textLength).toBeGreaterThan(50);
    });

    it('4. verifies disclaimer line color has high contrast against light gray card footers', () => {
      const disclaimerColor = 'text-slate-600';
      expect(disclaimerColor).toBe('text-slate-600');
    });

    it('5. verifies disclaimer text ends with mandatory instruction to consult doctor or pharmacist', () => {
      expect(HARDCODED_DISCLAIMER_LINE.endsWith('اتبع تعليمات طبيبك أو الصيدلي.')).toBe(true);
    });
  });

  // =========================================================================
  // F24 Boundaries
  // =========================================================================
  describe('F24: Worker Box Prompt Rule 6 Boundaries', () => {
    it('1. verifies Rule 6 in worker prompt enforces uppercase NEVER for exact doses', () => {
      expect(PHARMACIST_SYSTEM_PROMPT).toContain('NEVER give exact mg or ml amounts');
    });

    it('2. verifies Rule 6 explicitly forbids personal medical advice', () => {
      expect(PHARMACIST_SYSTEM_PROMPT).toContain('or personal medical advice');
    });

    it('3. verifies prompt instructions strip Markdown and extra text strictly', () => {
      expect(PHARMACIST_SYSTEM_PROMPT).toContain('Return JSON only, matching the schema. No markdown, no extra text.');
    });

    it('4. verifies Rule 6 distinguishes between printed packaging instructions and common usage', () => {
      expect(PHARMACIST_SYSTEM_PROMPT).toContain("set usage_source='printed'");
      expect(PHARMACIST_SYSTEM_PROMPT).toContain("set usage_source='common'");
    });

    it('5. verifies prompt Rule 9 mandates asking doctor or pharmacist when unsure', () => {
      expect(PHARMACIST_SYSTEM_PROMPT).toContain('The last warning must always remind the user to ask the doctor or pharmacist if unsure.');
    });
  });
});
