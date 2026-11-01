import { MedicineAnalysisResult, MedicationHistoryItem } from '../types';

export const HISTORY_STORAGE_KEY = 'dalili_medication_history_v1';
export const MAX_HISTORY_ITEMS = 5;

export function getScanHistory(): MedicationHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, MAX_HISTORY_ITEMS);
    }
    return [];
  } catch (e) {
    console.warn('[History] Failed to read scan history:', e);
    return [];
  }
}

export function saveScanItem(item: MedicineAnalysisResult): MedicationHistoryItem[] {
  // Only save valid medication analyses that are clear and have a name
  if (!item.is_clear) {
    return getScanHistory();
  }

  const existing = getScanHistory();
  const nameAr = (item.medicine_name_ar || '').trim().toLowerCase();
  const nameEn = (item.medicine_name_en || '').trim().toLowerCase();

  // Deduplicate: filter out any existing item with identical name
  const filtered = existing.filter((hist) => {
    const hAr = (hist.medicine_name_ar || '').trim().toLowerCase();
    const hEn = (hist.medicine_name_en || '').trim().toLowerCase();
    if (nameAr && hAr && nameAr === hAr) return false;
    if (nameEn && hEn && nameEn === hEn) return false;
    return true;
  });

  const newItem: MedicationHistoryItem = {
    ...item,
    id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now()
  };

  const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);

  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[History] Failed to persist scan history:', e);
    // If quota exceeded, try saving fewer items
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated.slice(0, 3)));
    } catch {
      // Ignored
    }
  }

  return updated;
}

export function clearScanHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (e) {
    console.warn('[History] Failed to clear scan history:', e);
  }
}
