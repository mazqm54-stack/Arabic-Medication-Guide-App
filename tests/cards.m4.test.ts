import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrescriptionResultView } from '../src/components/PrescriptionResultView';
import { ResultCards } from '../src/components/ResultCards';
import { HomeScreen } from '../src/components/HomeScreen';
import { SkeletonLoader } from '../src/components/SkeletonLoader';
import { PrescriptionAnalysisResult, MedicineAnalysisResult } from '../src/types';

describe('Milestone 4 Redesign: Modern Cards, Result Screens & Sticky Action Padding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockPrescriptionResult: PrescriptionAnalysisResult = {
    is_clear: true,
    confidence: 'high',
    items: [
      {
        line_text_as_written: 'Metformin 500mg 1x2 daily',
        medicine_name_ar: 'ميتفورمين',
        medicine_name_en: 'Metformin 500mg',
        active_ingredient: 'Metformin Hydrochloride',
        confidence: 'high',
        written_instructions: 'قرص مرتين يومياً بعد الأكل',
        short_explanation: 'يساعد على خفض مستوى السكر في الدم',
      },
      {
        line_text_as_written: 'Scribble line ???',
        medicine_name_ar: '',
        medicine_name_en: '',
        active_ingredient: '',
        confidence: 'low',
        written_instructions: '',
        short_explanation: '',
      },
    ],
    audio_summary: 'تحتوي الروشتة على ميتفورمين',
  };

  const mockMedicineResult: MedicineAnalysisResult = {
    is_clear: true,
    confidence: 'high',
    evidence_text: 'Panadol Advance 500mg Paracetamol',
    medicine_name_ar: 'بنادول أدفانس',
    medicine_name_en: 'Panadol Advance 500mg',
    active_ingredient: 'Paracetamol',
    uses: ['تسكين الصداع والآلام الخفيفة والمتوسطة'],
    how_and_when: ['قرص كل 6 إلى 8 ساعات بعد الأكل'],
    usage_source: 'printed',
    warnings: ['لا تتناول أكثر من 8 أقراص يومياً'],
    audio_summary: 'بنادول مسكن للصداع والآلام',
  };

  // =========================================================================
  // 1. PrescriptionResultView: Sticky Button & Scroll Padding Fix (F29)
  // =========================================================================
  describe('1. Sticky Button & Scroll Padding Fix (PrescriptionResultView)', () => {
    it('applies scroll padding pb-36 (144px) on root container for reachability', () => {
      const { container } = render(
        React.createElement(PrescriptionResultView, {
          result: mockPrescriptionResult,
          fontSize: 'normal',
          onRetake: vi.fn(),
          onSelectMedicine: vi.fn(),
        })
      );

      const rootDiv = container.firstElementChild as HTMLElement;
      expect(rootDiv).toBeInTheDocument();
      expect(rootDiv.className).toContain('pb-36');
    });

    it('styles "تصوير روشتة أخرى" as a compact secondary outline action with min-h-[48px]', () => {
      const onRetake = vi.fn();
      render(
        React.createElement(PrescriptionResultView, {
          result: mockPrescriptionResult,
          fontSize: 'normal',
          onRetake,
          onSelectMedicine: vi.fn(),
        })
      );

      const retakeBtn = screen.getByRole('button', { name: 'تصوير روشتة أخرى' });
      expect(retakeBtn).toBeInTheDocument();

      // Touch target height >= 48px
      expect(retakeBtn.className).toContain('min-h-[48px]');

      // Secondary / outline styling: border border-teal-600, text-teal-700, bg-white, dark:bg-[#162124]
      expect(retakeBtn.className).toContain('border-teal-600');
      expect(retakeBtn.className).toContain('text-teal-700');
      expect(retakeBtn.className).toContain('bg-white');
      expect(retakeBtn.className).toContain('dark:bg-[#162124]');

      // Triggers onRetake callback
      fireEvent.click(retakeBtn);
      expect(onRetake).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 2. Compact Result Cards: Hierarchy, Confidence Chips & Chevrons (F33, F34)
  // =========================================================================
  describe('2. Compact Result Cards (PrescriptionResultView & ResultCards)', () => {
    it('renders prescription items with 16px radius (rounded-2xl), soft shadow, and clean border', () => {
      render(
        React.createElement(PrescriptionResultView, {
          result: mockPrescriptionResult,
          fontSize: 'normal',
          onRetake: vi.fn(),
          onSelectMedicine: vi.fn(),
        })
      );

      const highCard = screen.getByRole('article', { name: '' });
      expect(highCard).toBeInTheDocument();
      expect(highCard.className).toContain('rounded-2xl');
      expect(highCard.className).toContain('shadow-sm');
      expect(highCard.className).toContain('border');
      expect(highCard.className).toContain('bg-white');
      expect(highCard.className).toContain('dark:bg-[#162124]');
    });

    it('displays prominent medicine name, confidence chip, and muted as-written text', () => {
      render(
        React.createElement(PrescriptionResultView, {
          result: mockPrescriptionResult,
          fontSize: 'normal',
          onRetake: vi.fn(),
          onSelectMedicine: vi.fn(),
        })
      );

      // Prominent bold medicine name
      expect(screen.getByText('ميتفورمين')).toBeInTheDocument();
      expect(screen.getByText('Metformin 500mg')).toBeInTheDocument();

      // Confidence chip (Arabic badge)
      const chip = screen.getByText('واضح');
      expect(chip).toBeInTheDocument();
      expect(chip.className).toContain('bg-emerald-50');

      // Muted "as written" text in small mono font
      const asWrittenText = screen.getByText(/النص كما كُتب: Metformin 500mg 1x2 daily/);
      expect(asWrittenText).toBeInTheDocument();
      expect(asWrittenText.className).toContain('text-xs');
      expect(asWrittenText.className).toContain('text-gray-500');
    });

    it('toggles expandable chevron to show/hide details inline', () => {
      render(
        React.createElement(PrescriptionResultView, {
          result: mockPrescriptionResult,
          fontSize: 'normal',
          onRetake: vi.fn(),
          onSelectMedicine: vi.fn(),
        })
      );

      // Initially collapsed: ChevronDown is present, details are hidden
      const toggleBtn = screen.getByRole('button', { name: 'عرض تفاصيل الدواء' });
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(/المادة الفعالة:/)).toBeNull();

      // Click to expand
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText(/المادة الفعالة:/)).toBeInTheDocument();
      expect(screen.getByText('Metformin Hydrochloride')).toBeInTheDocument();

      // Click again to collapse
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(/المادة الفعالة:/)).toBeNull();
    });

    it('renders ResultCards with rounded-2xl, confidence chips, muted evidence text, and expandable chevron', () => {
      render(React.createElement(ResultCards, { result: mockMedicineResult, fontSize: 'normal' }));

      // Section 1 card styling
      const card1 = screen.getByLabelText('اسم الدواء والمادة الفعالة');
      expect(card1).toBeInTheDocument();
      expect(card1.className).toContain('rounded-2xl');
      expect(card1.className).toContain('shadow-sm');

      // Confidence badge
      expect(screen.getByText('دقة عالية (واضح)')).toBeInTheDocument();

      // Muted evidence text
      const evidence = screen.getByText(/النص المقروء من العلبة: Panadol Advance 500mg Paracetamol/);
      expect(evidence).toBeInTheDocument();
      expect(evidence.className).toContain('text-xs');
      expect(evidence.className).toContain('text-gray-500');

      // Expandable chevron in Card 1
      const chevronBtn = screen.getByRole('button', { name: 'عرض تفاصيل البطاقة الأولى' });
      expect(chevronBtn).toBeInTheDocument();
      expect(chevronBtn).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(chevronBtn);
      expect(chevronBtn).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText(/إرشادات التحقق:/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. Redesigned Home Screen: Greeting, Action Cards & Recent Scans (F37)
  // =========================================================================
  describe('3. Redesigned Home Screen (HomeScreen)', () => {
    it('renders compact greeting "مرحباً بك في دليلي الدوائي"', () => {
      render(
        React.createElement(HomeScreen, {
          onImageSelected: vi.fn(),
          onNavigateToPrescription: vi.fn(),
          recentScans: [],
          onSelectRecentScan: vi.fn(),
          onClearHistory: vi.fn(),
        })
      );

      expect(screen.getByText('مرحباً بك في دليلي الدوائي')).toBeInTheDocument();
    });

    it('renders 2 clean action cards with Pill and FileText icons and rounded-2xl styling', () => {
      const onNavigateToPrescription = vi.fn();
      render(
        React.createElement(HomeScreen, {
          onImageSelected: vi.fn(),
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan: vi.fn(),
          onClearHistory: vi.fn(),
        })
      );

      // Card 1: علبة دواء
      const boxCard = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });
      expect(boxCard).toBeInTheDocument();
      expect(boxCard.className).toContain('rounded-2xl');
      expect(boxCard.className).toContain('shadow-sm');
      expect(boxCard.className).toContain('min-h-[120px]');

      // Card 2: روشتة
      const prescriptionCard = screen.getByRole('button', { name: 'صوّر روشتة' });
      expect(prescriptionCard).toBeInTheDocument();
      expect(prescriptionCard.className).toContain('rounded-2xl');
      expect(prescriptionCard.className).toContain('shadow-sm');
      expect(prescriptionCard.className).toContain('min-h-[120px]');

      // Click card 2 navigates to prescription
      fireEvent.click(prescriptionCard);
      expect(onNavigateToPrescription).toHaveBeenCalledTimes(1);
    });

    it('renders compact recent-scans empty state without massive wasted space', () => {
      render(
        React.createElement(HomeScreen, {
          onImageSelected: vi.fn(),
          onNavigateToPrescription: vi.fn(),
          recentScans: [],
          onSelectRecentScan: vi.fn(),
          onClearHistory: vi.fn(),
        })
      );

      const emptyNotice = screen.getByText('لا توجد أدوية مسجلة بعد. يمكنك تصوير علبة دواء للبدء.');
      expect(emptyNotice).toBeInTheDocument();
      const emptyContainer = emptyNotice.parentElement as HTMLElement;
      expect(emptyContainer.className).toContain('rounded-2xl');
      expect(emptyContainer.className).toContain('py-4');
    });
  });

  // =========================================================================
  // 4. Skeleton Loaders & Screen Transitions (F35)
  // =========================================================================
  describe('4. Skeleton Loaders & Transitions (SkeletonLoader)', () => {
    it('renders skeleton loader with role="status", animate-pulse, and rounded-2xl card shapes', () => {
      render(React.createElement(SkeletonLoader, { type: 'box', count: 4 }));

      const loader = screen.getByRole('status');
      expect(loader).toBeInTheDocument();
      expect(loader).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByText('جاري قراءة علبة الدواء بالذكاء الاصطناعي...')).toBeInTheDocument();

      // Check 4 skeleton cards matching final shapes
      const cards = screen.getAllByTestId(/skeleton-card-/);
      expect(cards).toHaveLength(4);

      cards.forEach((card) => {
        expect(card.className).toContain('rounded-2xl');
        expect(card.className).toContain('animate-pulse');
        expect(card.className).toContain('shadow-sm');
        expect(card.className).toContain('border');
        expect(card.className).toContain('motion-reduce:animate-none');
      });
    });

    it('supports prescription type with custom or appropriate status message', () => {
      render(React.createElement(SkeletonLoader, { type: 'prescription', count: 3 }));

      expect(screen.getByText('جاري قراءة الروشتة بالذكاء الاصطناعي...')).toBeInTheDocument();
      const cards = screen.getAllByTestId(/skeleton-card-/);
      expect(cards).toHaveLength(3);
    });
  });

  // =========================================================================
  // 5. Universal Touch Target Accessibility (>= 48px)
  // =========================================================================
  describe('5. Interactive Touch Targets (>= 48px)', () => {
    it('verifies all primary buttons in HomeScreen have touch target >= 48px', () => {
      render(
        React.createElement(HomeScreen, {
          onImageSelected: vi.fn(),
          onNavigateToPrescription: vi.fn(),
          recentScans: [],
          onSelectRecentScan: vi.fn(),
          onClearHistory: vi.fn(),
        })
      );

      const boxBtn = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });
      const rxBtn = screen.getByRole('button', { name: 'صوّر روشتة' });
      const galleryBtn = screen.getByRole('button', { name: 'اختيار صورة علبة دواء من الألبوم' });

      [boxBtn, rxBtn, galleryBtn].forEach((btn) => {
        const match = btn.className.match(/min-h-\[(\d+)px\]/);
        const minHeight = match ? parseInt(match[1], 10) : 0;
        expect(minHeight).toBeGreaterThanOrEqual(48);
      });
    });

    it('verifies secondary sticky button in PrescriptionResultView has touch target >= 48px', () => {
      render(
        React.createElement(PrescriptionResultView, {
          result: mockPrescriptionResult,
          fontSize: 'normal',
          onRetake: vi.fn(),
          onSelectMedicine: vi.fn(),
        })
      );

      const retakeBtn = screen.getByRole('button', { name: 'تصوير روشتة أخرى' });
      const match = retakeBtn.className.match(/min-h-\[(\d+)px\]/);
      const minHeight = match ? parseInt(match[1], 10) : 0;
      expect(minHeight).toBeGreaterThanOrEqual(48);
    });
  });
});
