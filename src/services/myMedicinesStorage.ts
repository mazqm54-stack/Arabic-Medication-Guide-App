export interface MyMedicineItem {
  id: string;
  name_ar?: string;
  name_en?: string;
  name?: string;
  active_ingredient?: string;
  how_and_when?: string[];
  addedAt: number;
}

export const MY_MEDICINES_KEY = 'dalili_my_medicines_v1';

export function getMyMedicines(): MyMedicineItem[] {
  try {
    const raw = localStorage.getItem(MY_MEDICINES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[MyMedicines] Read error:', e);
    return [];
  }
}

export function saveMyMedicine(item: Partial<MyMedicineItem>): boolean {
  try {
    const existing = getMyMedicines();
    const nameAr = (item.name_ar || item.name || '').trim().toLowerCase();
    const nameEn = (item.name_en || '').trim().toLowerCase();

    // Deduplication by name
    const alreadyExists = existing.some((m) => {
      const mAr = (m.name_ar || m.name || '').trim().toLowerCase();
      const mEn = (m.name_en || '').trim().toLowerCase();
      if (nameAr && mAr && nameAr === mAr) return true;
      if (nameEn && mEn && nameEn === mEn) return true;
      return false;
    });

    if (alreadyExists) {
      return false;
    }

    const newItem: MyMedicineItem = {
      id: item.id || `med_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name_ar: item.name_ar,
      name_en: item.name_en,
      name: item.name || item.name_ar || item.name_en,
      active_ingredient: item.active_ingredient,
      how_and_when: item.how_and_when,
      addedAt: item.addedAt || Date.now(),
    };

    localStorage.setItem(MY_MEDICINES_KEY, JSON.stringify([newItem, ...existing]));
    return true;
  } catch (e) {
    console.warn('[MyMedicines] Save error:', e);
    return false;
  }
}

export function removeMyMedicine(id: string): void {
  try {
    const existing = getMyMedicines();
    const filtered = existing.filter((m) => m.id !== id);
    localStorage.setItem(MY_MEDICINES_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[MyMedicines] Remove error:', e);
  }
}

export function clearMyMedicines(): void {
  try {
    localStorage.removeItem(MY_MEDICINES_KEY);
  } catch (e) {
    console.warn('[MyMedicines] Clear error:', e);
  }
}
