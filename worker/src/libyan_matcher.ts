import dataset from './libyan_drugs_data.json';

export interface LibyanDrugMatch {
  matched: boolean;
  matchType?: 'exact_brand' | 'exact_generic' | 'exact_arabic' | 'fuzzy_brand' | 'fuzzy_generic';
  correctedNameEn: string;
  genericNameEn: string;
  arabicName: string;
  libyanBrands: string[];
  forms: string[];
  distance?: number;
  confidenceAdjustment: 'boost' | 'demote' | 'keep';
  isMalformed?: boolean;
}

interface GenericEntry {
  i: string; // inn
  a: string; // arabic
  b: string[]; // brands
  f: string[]; // forms
  c: string[]; // components
}

interface BrandEntry {
  b: string; // brand
  g: string[]; // generics
  f: string[]; // forms
}

const genericsMap: Record<string, GenericEntry> = (dataset as any).generics || {};
const brandsMap: Record<string, BrandEntry> = (dataset as any).brands || {};

// Precompute Arabic reverse map for O(1) exact Arabic lookups
const arabicToGenericKey = new Map<string, string>();
for (const [k, v] of Object.entries(genericsMap)) {
  if (v.a) {
    const normAr = normalizeArabic(v.a);
    if (normAr) {
      arabicToGenericKey.set(normAr, k);
    }
  }
}

// Precompute lists for fuzzy iteration
const allBrandKeys = Object.keys(brandsMap);
const allGenericKeys = Object.keys(genericsMap);

export function stripStrengthAndForm(text: string): string {
  if (!text) return '';
  let s = text.toLowerCase();
  // Strip Rx prefix
  s = s.replace(/^r\/?\s+/i, '');
  // Strip dosages with units: 500mg, 5ml, 10mcg, 5%, etc.
  s = s.replace(/\b\d+(\.\d+)?\s*(mg|g|mcg|ml|iu|%)\b/gi, ' ');
  // Strip frequency/dosage patterns: 1x3, 1 x 3, 1x3x5, 2x, 1x
  s = s.replace(/\b\d+\s*x\s*\d+(\s*x\s*\d+)?\b/gi, ' ');
  s = s.replace(/\b\d+\s*x\b/gi, ' ');
  s = s.replace(/\bx\s*\d+\b/gi, ' ');
  // Strip duration/frequency shorthand: 3m, 1cp, 5d, 7j, 1x1, 1x2, 2cc, 2 c.c
  s = s.replace(/\b\d+\s*(m|j|d|h|c\.?c\.?)\b/gi, ' ');
  // Strip isolated digits
  s = s.replace(/\b\d+\b/g, ' ');
  // Strip form tokens: tab, tabs, cp, cap, caps, syp, etc.
  s = s.replace(/\b(tabs?|tablets?|caps?|capsules?|cp|cps|comp|comprim[eé]s?|g[eé]l|g[eé]lules?|syrups?|syr|syp|suspensions?|susp|injections?|inj|ampoules?|amp|vials?|vial|ointments?|oint|creams?|cr|suppositories?|supp|sachets?|sach|drops|gtt|sol|solutions?|lotions?|lotion|gels?|gel|sprays?|patch|inh|inhalers?|eff)\b/gi, ' ');
  // Strip isolated direction symbols & tokens: x, SOS, PRN, etc.
  s = s.replace(/\b(x|sos|prn|od|qd|bid|tid|qid|hs|ac|pc|po|im|iv|sc|s\/c)\b/gi, ' ');
  return s.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeEnglish(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[®™]/g, '')
      .replace(/\b(and|with)\b/g, ' ')
      .replace(/[\(\)\[\],;\.\/\-\+\&]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
}

export function normalizeArabic(text: string): string {
    if (!text) return '';
    return text
      .trim()
      .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
      .replace(/[إأآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) {
    row[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = a[i - 1] === b[j - 1] ? prev : Math.min(prev, row[j], row[j - 1]) + 1;
      prev = row[j];
      row[j] = cur;
    }
  }
  return row[b.length];
}

export function isMalformedName(name: string): boolean {
  if (!name || typeof name !== 'string') return true;
  const clean = name.trim();
  if (clean.length < 3) {
    // Whitelist legitimate very short acronyms
    const validShort = new Set(['gtn', 'asa', 'ors', 'kcl', 'bca', 'dha', 'epa']);
    return !validShort.has(clean.toLowerCase());
  }

  // 4 or more consecutive identical characters
  if (/(.)\1{3,}/.test(clean)) return true;

  // Excessive consecutive consonants (6+)
  const stripped = clean.toLowerCase().replace(/[^a-z]/g, '');
  if (/[bcdfghjklmnpqrstvwxyz]{6,}/.test(stripped)) return true;

  return false;
}

/**
 * Matches an input medicine name against the Libyan National Formulary database.
 * Follows strict safety rules:
 * 1. Exact match on brand or generic
 * 2. Strict fuzzy match based on length (<=4: exact only, 5-7: dist<=1, 8+: dist<=2)
 * 3. Never forces doubtful matches
 */
export function matchLibyanMedicine(
  nameEn: string,
  nameAr?: string,
  activeIngredient?: string
): LibyanDrugMatch {
  const normEn = normalizeEnglish(nameEn);
  const strippedEn = stripStrengthAndForm(normEn);
  const normAr = normalizeArabic(nameAr || '');
  const normActive = normalizeEnglish(activeIngredient || '');

  // 1. Exact match on Generic (preferred if input is an INN)
  let candidateGenericKey = (normEn && genericsMap[normEn]) ? normEn : null;
  let genericMatchedViaStripped = false;
  if (!candidateGenericKey && strippedEn && genericsMap[strippedEn]) {
    candidateGenericKey = strippedEn;
    genericMatchedViaStripped = true;
  }
  if (candidateGenericKey) {
    const gEntry = genericsMap[candidateGenericKey];
    return {
      matched: true,
      matchType: 'exact_generic',
      correctedNameEn: gEntry.i,
      genericNameEn: gEntry.i,
      arabicName: gEntry.a || nameAr || '',
      libyanBrands: gEntry.b || [],
      forms: gEntry.f || [],
      distance: 0,
      confidenceAdjustment: genericMatchedViaStripped ? 'keep' : 'boost'
    };
  }

  // 2. Exact match on Brand
  let candidateBrandKey = (normEn && brandsMap[normEn]) ? normEn : null;
  let brandMatchedViaStripped = false;
  if (!candidateBrandKey && strippedEn && brandsMap[strippedEn]) {
    candidateBrandKey = strippedEn;
    brandMatchedViaStripped = true;
  }
  if (candidateBrandKey) {
    const bEntry = brandsMap[candidateBrandKey];
    const genName = bEntry.g[0] || nameEn;
    const gKey = normalizeEnglish(genName);
    const gEntry = genericsMap[gKey];

    return {
      matched: true,
      matchType: 'exact_brand',
      correctedNameEn: bEntry.b,
      genericNameEn: gEntry?.i || genName,
      arabicName: gEntry?.a || nameAr || '',
      libyanBrands: gEntry?.b && gEntry.b.length > 0 ? gEntry.b : [bEntry.b],
      forms: bEntry.f && bEntry.f.length > 0 ? bEntry.f : (gEntry?.f || []),
      distance: 0,
      confidenceAdjustment: brandMatchedViaStripped ? 'keep' : 'boost'
    };
  }

  // 3. Exact match on active ingredient (if provided and different)
  if (normActive && normActive !== normEn && genericsMap[normActive]) {
    const gEntry = genericsMap[normActive];
    return {
      matched: true,
      matchType: 'exact_generic',
      correctedNameEn: nameEn, // keep user's brand name
      genericNameEn: gEntry.i,
      arabicName: gEntry.a || nameAr || '',
      libyanBrands: gEntry.b || [],
      forms: gEntry.f || [],
      distance: 0,
      confidenceAdjustment: 'boost'
    };
  }

  // 4. Exact match on Arabic name
  if (normAr && arabicToGenericKey.has(normAr)) {
    const gKey = arabicToGenericKey.get(normAr)!;
    const gEntry = genericsMap[gKey];
    return {
      matched: true,
      matchType: 'exact_arabic',
      correctedNameEn: gEntry.i,
      genericNameEn: gEntry.i,
      arabicName: gEntry.a,
      libyanBrands: gEntry.b || [],
      forms: gEntry.f || [],
      distance: 0,
      confidenceAdjustment: 'boost'
    };
  }

  // 5. Strict Fuzzy Matching
  const queryKey = strippedEn || normEn;
  const isStrippedFuzzy = Boolean(strippedEn && strippedEn !== normEn);
  // Only attempt if length >= 5
  if (queryKey.length >= 5) {
    const maxAllowedDist = queryKey.length >= 8 ? 2 : 1;

    let bestDist = 999;
    let bestType: 'brand' | 'generic' | null = null;
    let bestKey: string | null = null;

    // Search brands
    for (const bKey of allBrandKeys) {
      if (Math.abs(bKey.length - queryKey.length) > maxAllowedDist) continue;
      const d = levenshteinDistance(queryKey, bKey);
      if (d <= maxAllowedDist && d < bestDist) {
        bestDist = d;
        bestType = 'brand';
        bestKey = bKey;
        if (d === 1 && queryKey.length < 8) break; // optimal for short
      }
    }

    // Search generics if distance is not already 1
    if (bestDist > 1) {
      for (const gKey of allGenericKeys) {
        if (Math.abs(gKey.length - queryKey.length) > maxAllowedDist) continue;
        const d = levenshteinDistance(queryKey, gKey);
        if (d <= maxAllowedDist && d < bestDist) {
          bestDist = d;
          bestType = 'generic';
          bestKey = gKey;
        }
      }
    }

    if (bestKey && bestDist <= maxAllowedDist) {
      if (bestType === 'brand') {
        const bEntry = brandsMap[bestKey];
        const genName = bEntry.g[0] || '';
        const gKey = normalizeEnglish(genName);
        const gEntry = genericsMap[gKey];

        return {
          matched: true,
          matchType: 'fuzzy_brand',
          correctedNameEn: bEntry.b,
          genericNameEn: gEntry?.i || genName,
          arabicName: gEntry?.a || nameAr || '',
          libyanBrands: gEntry?.b || [bEntry.b],
          forms: bEntry.f || (gEntry?.f || []),
          distance: bestDist,
          confidenceAdjustment: isStrippedFuzzy ? 'keep' : 'boost'
        };
      } else {
        const gEntry = genericsMap[bestKey];
        return {
          matched: true,
          matchType: 'fuzzy_generic',
          correctedNameEn: gEntry.i,
          genericNameEn: gEntry.i,
          arabicName: gEntry.a || nameAr || '',
          libyanBrands: gEntry.b || [],
          forms: gEntry.f || [],
          distance: bestDist,
          confidenceAdjustment: isStrippedFuzzy ? 'keep' : 'boost'
        };
      }
    }
  }

  // 6. NOT MATCHED:
  // "If NOT matched: do NOT automatically return 'unclear', because the directory may not list every medicine in pharmacies.
  // Lower confidence by one level only and keep Gemini's reading. Return 'unclear' only when the name also looks malformed."
  const malformed = isMalformedName(nameEn);

  return {
    matched: false,
    correctedNameEn: nameEn,
    genericNameEn: activeIngredient || '',
    arabicName: nameAr || '',
    libyanBrands: [],
    forms: [],
    confidenceAdjustment: 'demote',
    isMalformed: malformed
  };
}

/**
 * Searches the database for 5 to 10 closest candidate names matching partial/visible letters.
 * Used to guide Gemini in retry attempts when a line is unclear.
 */
export function findClosestCandidates(partial: string, limit = 8): string[] {
  if (!partial || typeof partial !== 'string') return [];
  const norm = normalizeEnglish(partial);
  if (!norm || norm.length < 2) return [];

  const candidates: Array<{ name: string; score: number }> = [];

  // Prefix matches first
  for (const bKey of allBrandKeys) {
    const bEntry = brandsMap[bKey];
    if (bKey.startsWith(norm)) {
      candidates.push({ name: bEntry.b, score: 100 - (bKey.length - norm.length) });
    } else if (bKey.includes(norm)) {
      candidates.push({ name: bEntry.b, score: 50 });
    } else if (norm.length >= 3 && Math.abs(bKey.length - norm.length) <= 2) {
      const d = levenshteinDistance(norm, bKey.slice(0, norm.length));
      if (d <= 1) {
        candidates.push({ name: bEntry.b, score: 30 - d });
      }
    }
    if (candidates.length >= 30) break;
  }

  // Sort descending by score, deduplicate
  const seen = new Set<string>();
  const results: string[] = [];
  candidates.sort((a, b) => b.score - a.score);

  for (const c of candidates) {
    const clean = c.name.trim();
    if (!seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      results.push(clean);
      if (results.length >= limit) break;
    }
  }

  return results;
}
