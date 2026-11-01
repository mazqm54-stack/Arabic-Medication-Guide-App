import { describe, it, expect, beforeEach } from 'vitest';
import {
  getScanHistory,
  saveScanItem,
  clearScanHistory,
  MAX_HISTORY_ITEMS
} from '../src/services/historyStorage';
import { MedicineAnalysisResult } from '../src/types';

describe('History Storage Service', () => {
  beforeEach(() => {
    clearScanHistory();
  });

  const sampleMed1: MedicineAnalysisResult = {
    is_clear: true,
    medicine_name_ar: 'كونكور',
    medicine_name_en: 'Concor 5mg',
    active_ingredient: 'بيسوبرولول',
    uses: ['ضغط الدم'],
    how_and_when: ['صباحاً'],
    warnings: ['لا تتوقف فجأة']
  };

  const sampleMed2: MedicineAnalysisResult = {
    is_clear: true,
    medicine_name_ar: 'أوجمنتين',
    medicine_name_en: 'Augmentin 1g',
    active_ingredient: 'أموكسيسيلين + كلافولانات',
    uses: ['مضاد حيوي'],
    how_and_when: ['كل 12 ساعة'],
    warnings: ['أكمل الجرعة كاملة']
  };

  it('starts with an empty scan history', () => {
    expect(getScanHistory()).toEqual([]);
  });

  it('saves clear medication item and returns updated list with id and timestamp', () => {
    const list = saveScanItem(sampleMed1);
    expect(list.length).toBe(1);
    expect(list[0].medicine_name_ar).toBe('كونكور');
    expect(list[0].id).toBeDefined();
    expect(list[0].timestamp).toBeTypeOf('number');
  });

  it('does NOT save unclear items (is_clear = false)', () => {
    const unclear: MedicineAnalysisResult = {
      is_clear: false,
      raw_error: 'صورة غير واضحة'
    };
    const list = saveScanItem(unclear);
    expect(list.length).toBe(0);
  });

  it('enforces maximum 5 items via FIFO eviction', () => {
    for (let i = 1; i <= 7; i++) {
      saveScanItem({
        is_clear: true,
        medicine_name_ar: `دواء ${i}`,
        medicine_name_en: `Med ${i}`
      });
    }

    const history = getScanHistory();
    expect(history.length).toBe(MAX_HISTORY_ITEMS);
    // Newest items should be at top: Med 7, Med 6, Med 5, Med 4, Med 3
    expect(history[0].medicine_name_ar).toBe('دواء 7');
    expect(history[MAX_HISTORY_ITEMS - 1].medicine_name_ar).toBe('دواء 3');
  });

  it('deduplicates when scanning an existing medicine and moves it to top', () => {
    saveScanItem(sampleMed1); // Concor
    saveScanItem(sampleMed2); // Augmentin

    let history = getScanHistory();
    expect(history.length).toBe(2);
    expect(history[0].medicine_name_ar).toBe('أوجمنتين');

    // Rescan Concor
    saveScanItem({
      ...sampleMed1,
      warnings: ['تحذير إضافي محدث']
    });

    history = getScanHistory();
    expect(history.length).toBe(2);
    expect(history[0].medicine_name_ar).toBe('كونكور');
    expect(history[0].warnings).toContain('تحذير إضافي محدث');
  });

  it('clears history completely', () => {
    saveScanItem(sampleMed1);
    expect(getScanHistory().length).toBe(1);
    clearScanHistory();
    expect(getScanHistory().length).toBe(0);
  });
});
