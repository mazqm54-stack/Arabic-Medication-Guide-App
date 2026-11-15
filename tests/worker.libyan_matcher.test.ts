import { describe, it, expect } from 'vitest';
import {
  matchLibyanMedicine,
  findClosestCandidates,
  normalizeEnglish,
  normalizeArabic,
  isMalformedName,
  levenshteinDistance
} from '../worker/src/libyan_matcher';

describe('Libyan National Formulary Matcher (worker/src/libyan_matcher.ts)', () => {
  it('normalizes English and Arabic text correctly', () => {
    expect(normalizeEnglish('Augmentin® 375mg (Tab)')).toBe('augmentin 375mg tab');
    expect(normalizeArabic('أَمُوكْسِيسِيلِين')).toBe('اموكسيسيلين');
    expect(normalizeArabic('أدوية مُسَكِّنة')).toBe('ادويه مسكنه');
  });

  it('calculates accurate Levenshtein distance', () => {
    expect(levenshteinDistance('augmentin', 'augmentin')).toBe(0);
    expect(levenshteinDistance('augmentn', 'augmentin')).toBe(1);
    expect(levenshteinDistance('divida', 'divido')).toBe(1);
    expect(levenshteinDistance('panadol', 'paracetamol')).toBe(6);
  });

  it('detects malformed non-medicine gibberish', () => {
    expect(isMalformedName('Kyzak')).toBe(false); // 5 letters, but plausible phonetic
    expect(isMalformedName('bbbbbb')).toBe(true); // repeated characters
    expect(isMalformedName('ab')).toBe(true); // too short
    expect(isMalformedName('GTN')).toBe(false); // whitelisted short medical acronym
    expect(isMalformedName('ASA')).toBe(false); // whitelisted short medical acronym
    expect(isMalformedName('brkfldtzq')).toBe(true); // 9 consecutive consonants
  });

  it('matches exact brand names and enriches with generic and Arabic names', () => {
    const match = matchLibyanMedicine('Augmentin');
    expect(match.matched).toBe(true);
    expect(match.matchType).toBe('exact_brand');
    expect(match.correctedNameEn).toBe('Augmentin');
    expect(match.genericNameEn.toLowerCase()).toContain('amoxicillin');
    expect(match.arabicName).toBeTruthy();
    expect(match.confidenceAdjustment).toBe('boost');
    expect(match.libyanBrands.length).toBeGreaterThan(0);
  });

  it('matches exact generic names', () => {
    const match = matchLibyanMedicine('Amoxicillin');
    expect(match.matched).toBe(true);
    expect(match.matchType).toBe('exact_generic');
    expect(match.correctedNameEn.toLowerCase()).toContain('amoxicillin');
    expect(match.arabicName).toBe('أموكسيسيلين');
    expect(match.confidenceAdjustment).toBe('boost');
  });

  it('matches exact Arabic names', () => {
    const match = matchLibyanMedicine('', 'أموكسيسيلين');
    expect(match.matched).toBe(true);
    expect(match.matchType).toBe('exact_arabic');
    expect(match.correctedNameEn.toLowerCase()).toContain('amoxicillin');
  });

  it('performs strict fuzzy matching for minor OCR handwriting typos (dist <= 1)', () => {
    // "Augmentn" -> "Augmentin" (dist 1)
    const match1 = matchLibyanMedicine('Augmentn');
    expect(match1.matched).toBe(true);
    expect(match1.matchType).toBe('fuzzy_brand');
    expect(match1.correctedNameEn).toBe('Augmentin');
    expect(match1.distance).toBe(1);

    // "Divida" -> "Divido" (dist 1)
    const match2 = matchLibyanMedicine('Divida');
    expect(match2.matched).toBe(true);
    expect(match2.correctedNameEn).toBe('Divido');
  });

  it('enforces strict threshold: short names (<5 chars) NEVER fuzzy match', () => {
    // Short name length 4: "Acic" should NOT fuzzy match "Asa" or "Acam"
    const match = matchLibyanMedicine('Acic');
    expect(match.matched).toBe(false);
    expect(match.confidenceAdjustment).toBe('demote');
  });

  it('strips form and direction tokens like cp, x, 3m and matches with confidenceAdjustment keep', () => {
    const match = matchLibyanMedicine('Domperidon cp x 3m');
    expect(match.matched).toBe(true);
    expect(match.correctedNameEn).toBe('Domperidone');
    expect(match.genericNameEn).toBe('Domperidone');
    expect(match.confidenceAdjustment).toBe('keep');
  });

  it('does NOT mark a legitimate medicine unclear when absent from directory', () => {
    // A legitimate medicine not listed in LNF
    const match = matchLibyanMedicine('SpecialNovelMedicine');
    expect(match.matched).toBe(false);
    expect(match.isMalformed).toBe(false);
    expect(match.confidenceAdjustment).toBe('demote');
    expect(match.correctedNameEn).toBe('SpecialNovelMedicine'); // preserved
  });

  it('returns candidate recommendations for unclear lines based on visible letters', () => {
    const candidates = findClosestCandidates('aug', 5);
    expect(candidates).toContain('Augmentin');
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(5);
  });
});
