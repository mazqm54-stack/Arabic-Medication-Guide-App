import { MedicineAnalysisResult } from '../types';

export const DETAILS_CACHE_PREFIX = 'dalili_details_';

const inMemoryCache = new Map<string, string>();

/**
 * Normalizes a medicine name for cache keys:
 * Trims whitespace, converts to lowercase,
 * strips Arabic diacritics / tashkeel (fatha, damma, kasra, shadda, sukun, tanween, dagger alif, tatweel),
 * normalizes common Arabic character variations, and consolidates whitespace into underscores.
 */
export function normalizeMedicineName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // remove Arabic diacritics / tashkeel / tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, '_');
}

export function getCacheKey(name: string): string {
  const normalized = normalizeMedicineName(name);
  return `${DETAILS_CACHE_PREFIX}${normalized}`;
}

function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        return item;
      }
    }
  } catch {
    // LocalStorage restricted or unavailable
  }
  return inMemoryCache.get(key) || null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {
    // QuotaExceededError or private browsing
  }
  inMemoryCache.set(key, value);
}

function removeStorageItem(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
  inMemoryCache.delete(key);
}

/**
 * Retrieves cached medicine details from localStorage by medicine name.
 * Returns null on cache miss or corrupted data.
 */
export function getCachedDetails(name: string): MedicineAnalysisResult | null {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return null;
  }
  const key = getCacheKey(name);
  const raw = getStorageItem(key);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && data.is_clear) {
      return data as MedicineAnalysisResult;
    }
  } catch {
    removeStorageItem(key);
  }
  return null;
}

/**
 * Stores medicine analysis details into localStorage keyed by normalized medicine name.
 * Safely handles QuotaExceededError or private browsing restrictions.
 */
export function setCachedDetails(name: string, data: MedicineAnalysisResult): void {
  if (!name || typeof name !== 'string' || !name.trim() || !data) {
    return;
  }
  const key = getCacheKey(name);
  try {
    const serialized = JSON.stringify(data);
    setStorageItem(key, serialized);
  } catch {
    // Gracefully handle serialization errors
  }
}

/**
 * Clears all cached medicine details from localStorage (keys prefixed with dalili_details_).
 * Leaves other application storage items intact.
 */
export function clearDetailsCache(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(DETAILS_CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage access errors
  }
  for (const key of Array.from(inMemoryCache.keys())) {
    if (key.startsWith(DETAILS_CACHE_PREFIX)) {
      inMemoryCache.delete(key);
    }
  }
}
