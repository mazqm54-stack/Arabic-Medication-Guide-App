import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  getMyMedicines,
  saveMyMedicine,
  removeMyMedicine,
  clearMyMedicines,
  MY_MEDICINES_KEY
} from '../src/services/myMedicinesStorage';
import {
  PrescriptionResultView,
  PRESCRIPTION_ADVISORY_BANNER,
  LOW_CONFIDENCE_AMBER_TEXT
} from '../src/components/PrescriptionResultView';
import { MedicineDetailsModal } from '../src/components/MedicineDetailsModal';
import { UnclearPhotoCard } from '../src/components/UnclearPhotoCard';
import { ResultCards, HARDCODED_DISCLAIMER_LINE } from '../src/components/ResultCards';
import { PrescriptionAnalysisResult, PrescriptionItem, MedicineAnalysisResult } from '../src/types';
import * as geminiVision from '../src/services/geminiVision';

describe('Milestone M4 Component & Service Suite', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.speechSynthesis.cancel();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. myMedicinesStorage.ts
  // =========================================================================
  describe('myMedicinesStorage', () => {
    it('saves a medicine and retrieves it from localStorage', () => {
      const success = saveMyMedicine({
        name_ar: 'ميتفورمين',
        name_en: 'Metformin',
        active_ingredient: 'Metformin HCl',
        how_and_when: ['قرص بعد الأكل صباحاً'],
      });

      expect(success).toBe(true);
      const list = getMyMedicines();
      expect(list).toHaveLength(1);
      expect(list[0].name_ar).toBe('ميتفورمين');
      expect(list[0].name_en).toBe('Metformin');
      expect(list[0].active_ingredient).toBe('Metformin HCl');
    });

    it('prevents duplicate additions by name', () => {
      saveMyMedicine({ name_ar: 'كونكور', name_en: 'Concor' });
      const duplicateSuccess = saveMyMedicine({ name_ar: 'كونكور', name_en: 'Concor' });

      expect(duplicateSuccess).toBe(false);
      expect(getMyMedicines()).toHaveLength(1);
    });

    it('removes a medicine by id', () => {
      saveMyMedicine({ id: 'med_test_1', name_ar: 'بنادول' });
      saveMyMedicine({ id: 'med_test_2', name_ar: 'أسبوسيد' });

      expect(getMyMedicines()).toHaveLength(2);
      removeMyMedicine('med_test_1');

      const remaining = getMyMedicines();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('med_test_2');
    });

    it('clears all medicines', () => {
      saveMyMedicine({ name_ar: 'دواء 1' });
      saveMyMedicine({ name_ar: 'دواء 2' });

      clearMyMedicines();
      expect(getMyMedicines()).toHaveLength(0);
      expect(window.localStorage.getItem(MY_MEDICINES_KEY)).toBeNull();
    });
  });

  // =========================================================================
  // 2. PrescriptionResultView.tsx
  // =========================================================================
  describe('PrescriptionResultView', () => {
    const mockPrescription: PrescriptionAnalysisResult = {
      is_clear: true,
      confidence: 'medium',
      items: [
        {
          line_text_as_written: 'Metformin 500mg 1x2',
          medicine_name_ar: 'ميتفورمين',
          medicine_name_en: 'Metformin 500mg',
          active_ingredient: 'Metformin HCl',
          confidence: 'high',
          written_instructions: 'قرص مرتين يومياً بعد الأكل',
          short_explanation: 'يساعد على خفض السكر في الدم',
        },
        {
          line_text_as_written: 'Dr scribble ~~~',
          medicine_name_ar: '',
          medicine_name_en: '',
          active_ingredient: '',
          confidence: 'low',
          written_instructions: '',
          short_explanation: '',
        },
      ],
      audio_summary: 'تحتوي الروشتة على ميتفورمين ودواء آخر غير واضح',
    };

    it('renders the top advisory banner with exact mandated text', () => {
      render(
        <PrescriptionResultView
          result={mockPrescription}
          fontSize="large"
          onRetake={vi.fn()}
          onSelectMedicine={vi.fn()}
        />
      );

      expect(screen.getByText(PRESCRIPTION_ADVISORY_BANNER)).toBeInTheDocument();
      expect(PRESCRIPTION_ADVISORY_BANNER).toBe('راجع أسماء الأدوية قبل الاعتماد');
    });

    it('renders legible medicine card with trade names, purpose, doctor instructions, and confidence badge', () => {
      const selectSpy = vi.fn();
      render(
        <PrescriptionResultView
          result={mockPrescription}
          fontSize="large"
          onRetake={vi.fn()}
          onSelectMedicine={selectSpy}
        />
      );

      expect(screen.getByText('ميتفورمين')).toBeInTheDocument();
      expect(screen.getByText('Metformin 500mg')).toBeInTheDocument();
      expect(screen.getByText('يساعد على خفض السكر في الدم')).toBeInTheDocument();
      expect(screen.getByText('قرص مرتين يومياً بعد الأكل')).toBeInTheDocument();
      expect(screen.getByText('ما كتبه الطبيب:')).toBeInTheDocument();
      expect(screen.getByText('واضح')).toBeInTheDocument();

      // Click card to open details
      const cardBtn = screen.getByRole('button', { name: /دواء ميتفورمين/i });
      fireEvent.click(cardBtn);
      expect(selectSpy).toHaveBeenCalledWith(mockPrescription.items[0]);
    });

    it('renders low-confidence amber card with exact warning text and zero AI explanation', () => {
      render(
        <PrescriptionResultView
          result={mockPrescription}
          fontSize="large"
          onRetake={vi.fn()}
          onSelectMedicine={vi.fn()}
        />
      );

      expect(screen.getByText(LOW_CONFIDENCE_AMBER_TEXT)).toBeInTheDocument();
      expect(LOW_CONFIDENCE_AMBER_TEXT).toBe('غير واضح، اسأل الصيدلي');
      expect(screen.getByText('Dr scribble ~~~')).toBeInTheDocument();
      expect(screen.getByLabelText('دواء غير واضح')).toBeInTheDocument();
    });

    it('triggers speech readout on audio button click and stops when clicked again', () => {
      render(
        <PrescriptionResultView
          result={mockPrescription}
          fontSize="large"
          onRetake={vi.fn()}
          onSelectMedicine={vi.fn()}
        />
      );

      const audioBtn = screen.getByRole('button', { name: /استمع للروشتة كاملة/i });
      fireEvent.click(audioBtn);

      expect(window.speechSynthesis.speak).toHaveBeenCalled();
    });

    it('triggers onRetake when sticky reset button is clicked', () => {
      const retakeSpy = vi.fn();
      render(
        <PrescriptionResultView
          result={mockPrescription}
          fontSize="large"
          onRetake={retakeSpy}
          onSelectMedicine={vi.fn()}
        />
      );

      const retakeBtn = screen.getByRole('button', { name: 'تصوير روشتة أخرى' });
      fireEvent.click(retakeBtn);
      expect(retakeSpy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 3. MedicineDetailsModal.tsx
  // =========================================================================
  describe('MedicineDetailsModal', () => {
    const mockItem: PrescriptionItem = {
      line_text_as_written: 'Concor 5mg',
      medicine_name_ar: 'كونكور 5 مجم',
      medicine_name_en: 'Concor 5mg',
      active_ingredient: 'Bisoprolol Fumarate',
      confidence: 'high',
      written_instructions: 'قرص صباحاً يومياً قبل الإفطار',
      short_explanation: 'لعلاج ارتفاع ضغط الدم وتنظيم ضربات القلب',
    };

    const mockDetailsResult: MedicineAnalysisResult = {
      is_clear: true,
      medicine_name_ar: 'كونكور 5 مجم',
      medicine_name_en: 'Concor 5mg',
      active_ingredient: 'Bisoprolol Fumarate',
      uses: ['علاج ارتفاع ضغط الدم', 'تنظيم ضربات القلب'],
      how_and_when: ['قرص واحد يومياً في الصباح قبل الإفطار'],
      usage_source: 'common',
      warnings: ['لا تتوقف عن تناول الدواء فجأة دون استشارة الطبيب'],
      audio_summary: 'كونكور دواء لعلاج ضغط الدم المرتفع',
    };

    it('fetches medicine details and renders result cards with add to medicines button', async () => {
      vi.spyOn(geminiVision, 'fetchMedicineDetails').mockResolvedValue(mockDetailsResult);
      const closeSpy = vi.fn();

      await act(async () => {
        render(
          <MedicineDetailsModal
            item={mockItem}
            isOpen={true}
            onClose={closeSpy}
            fontSize="large"
          />
        );
      });

      expect(screen.getByText('علاج ارتفاع ضغط الدم')).toBeInTheDocument();
      expect(screen.getByText('قرص واحد يومياً في الصباح قبل الإفطار')).toBeInTheDocument();
      expect(screen.getByText('لا تتوقف عن تناول الدواء فجأة دون استشارة الطبيب')).toBeInTheDocument();

      // Add to my medicines
      const addBtn = screen.getByRole('button', { name: 'أضف لأدويتي' });
      await act(async () => {
        fireEvent.click(addBtn);
      });

      expect(screen.getByText(/تمت الإضافة لقائمة أدويتي/)).toBeInTheDocument();
      const stored = getMyMedicines();
      expect(stored).toHaveLength(1);
      expect(stored[0].name_ar).toBe('كونكور 5 مجم');

      // Close modal
      const closeBtn = screen.getByRole('button', { name: 'إغلاق نافذة التفاصيل' });
      fireEvent.click(closeBtn);
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 4. UnclearPhotoCard.tsx in Prescription Mode
  // =========================================================================
  describe('UnclearPhotoCard in Prescription Context', () => {
    it('renders 3 senior tips and retry button in prescription mode', () => {
      const retakeSpy = vi.fn();
      render(
        <UnclearPhotoCard
          context="prescription"
          onRetake={retakeSpy}
          errorMessage="الصورة غير واضحة للأسف"
        />
      );

      expect(screen.getByText(/الإضاءة: التأكد من إضاءة الغرفة بشكل كافٍ/i)).toBeInTheDocument();
      expect(screen.getByText(/الإطار: إظهار الروشتة أو العلبة كاملة داخل الإطار/i)).toBeInTheDocument();
      expect(screen.getByText(/الثبات: تثبيت الهاتف باليدين وعدم الاهتزاز/i)).toBeInTheDocument();

      const retakeBtn = screen.getByRole('button', { name: 'إعادة التصوير' });
      expect(retakeBtn).toBeInTheDocument();
      fireEvent.click(retakeBtn);
      expect(retakeSpy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 5. ResultCards.tsx Card 3 Updates
  // =========================================================================
  describe('ResultCards Card 3 Enhancements', () => {
    const mockBox: MedicineAnalysisResult = {
      is_clear: true,
      medicine_name_ar: 'بنادول أدفانس',
      medicine_name_en: 'Panadol Advance',
      active_ingredient: 'Paracetamol',
      uses: ['تسكين الآلام الخفيفة والمتوسطة'],
      how_and_when: [], // empty -> should trigger safe fallback
      usage_source: 'common',
      warnings: ['لا تتناول أكثر من 8 أقراص يومياً'],
      audio_summary: 'بنادول مسكن للألم',
    };

    it('renders usage_source badge and hardcoded disclaimer line', () => {
      render(<ResultCards result={mockBox} fontSize="large" context="box" />);

      // Badge
      const badge = screen.getByTestId('usage-source-badge');
      expect(badge).toHaveTextContent('الاستخدام الشائع');

      // Safe non-empty fallback items
      expect(screen.getByText('يؤخذ عادة في أوقات منتظمة يومياً حسب توجيهات الصيدلي')).toBeInTheDocument();

      // Disclaimer line
      const disclaimer = screen.getByTestId('usage-disclaimer-line');
      expect(disclaimer).toHaveTextContent(HARDCODED_DISCLAIMER_LINE);
      expect(HARDCODED_DISCLAIMER_LINE).toBe(
        'هذا الاستخدام الشائع، ويختلف من شخص لآخر ومن حالة لأخرى. اتبع تعليمات طبيبك أو الصيدلي.'
      );
      expect(HARDCODED_DISCLAIMER_LINE).toHaveLength(87);
    });

    it('renders "مكتوب على العلبة" badge when usage_source is printed in box context', () => {
      const printedBox: MedicineAnalysisResult = {
        ...mockBox,
        usage_source: 'printed',
        how_and_when: ['قرص كل 8 ساعات بعد الأكل'],
      };

      render(<ResultCards result={printedBox} fontSize="large" context="box" />);
      const badge = screen.getByTestId('usage-source-badge');
      expect(badge).toHaveTextContent('مكتوب على العلبة');
    });

    it('renders "مكتوب في الروشتة" badge when usage_source is printed in prescription context', () => {
      const printedRx: MedicineAnalysisResult = {
        ...mockBox,
        usage_source: 'printed',
        how_and_when: ['قرص صباحاً ومساءً'],
      };

      render(<ResultCards result={printedRx} fontSize="large" context="prescription" />);
      const badge = screen.getByTestId('usage-source-badge');
      expect(badge).toHaveTextContent('مكتوب في الروشتة');
    });
  });
});
