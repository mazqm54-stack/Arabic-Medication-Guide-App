import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';

import { HomeScreen } from '../src/components/HomeScreen';
import { DisclaimerBanner } from '../src/components/DisclaimerBanner';
import { RecentScansList } from '../src/components/RecentScansList';
import App from '../src/App';
import * as nativeCamera from '../src/services/nativeCamera';
import {
  CameraPermissionDeniedError,
  PhotosPermissionDeniedError,
  NativePhotoFile,
} from '../src/services/nativeCamera';
import { MedicationHistoryItem, MedicineAnalysisResult } from '../src/types';

// Mock nativeCamera module for controlled adversarial injection
vi.mock('../src/services/nativeCamera', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/nativeCamera')>();
  return {
    ...actual,
    capturePhoto: vi.fn(),
    pickPhoto: vi.fn(),
  };
});

function createMockFile(name = 'test.jpg'): NativePhotoFile {
  const file = new File(['mock content'], name, { type: 'image/jpeg' }) as NativePhotoFile;
  file.base64Data = 'mockbase64';
  file.format = 'jpeg';
  file.width = 800;
  file.height = 600;
  file.dataUrl = 'data:image/jpeg;base64,mockbase64';
  return file;
}

function generateHistoryItems(count: number): MedicationHistoryItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    timestamp: Date.now() - i * 10000,
    is_clear: true,
    medicine_name_ar: `دواء ${i + 1}`,
    medicine_name_en: `Medicine ${i + 1}`,
    active_ingredient: `مادة فعالة ${i + 1}`,
    uses: [`استخدام ${i + 1}`],
    how_and_when: [`جرعة ${i + 1}`],
    warnings: [`تحذير ${i + 1}`],
    audio_summary: `ملخص صوتي ${i + 1}`,
  }));
}

describe('M3 Adversarial Challenge 2: HomeScreen, Mobile CSS, Error Handling & Disclaimer', () => {
  const onImageSelected = vi.fn();
  const onNavigateToPrescription = vi.fn();
  const onSelectRecentScan = vi.fn();
  const onClearHistory = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Home Screen Action Buttons & Backwards Compatibility (F07 / R1)
  // =========================================================================
  describe('1. Home Screen Action Buttons & Backwards Compatibility', () => {
    it('renders Card 1 "صوّر علبة دواء" with aria-label="صوّر علبة الدواء الآن" and button text', () => {
      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const boxButton = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });
      expect(boxButton).toBeInTheDocument();
      expect(boxButton).toHaveAttribute('aria-label', 'صوّر علبة الدواء الآن');
      expect(boxButton).toHaveTextContent('صوّر علبة الدواء الآن');
      expect(boxButton).toHaveTextContent('التقط صورة لعلبة الدواء لمعرفة دواعي الاستعمال والتحذيرات');
    });

    it('invokes native rear camera capturePhoto on Card 1 click and dispatches image', async () => {
      const mockPhoto = createMockFile('box_photo.jpg');
      vi.mocked(nativeCamera.capturePhoto).mockResolvedValueOnce(mockPhoto);

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const boxButton = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });
      fireEvent.click(boxButton);

      await waitFor(() => {
        expect(nativeCamera.capturePhoto).toHaveBeenCalledTimes(1);
        expect(onImageSelected).toHaveBeenCalledTimes(1);
        expect(onImageSelected).toHaveBeenCalledWith(mockPhoto);
      });
    });

    it('handles camera user cancellation silently without dispatching or showing errors', async () => {
      vi.mocked(nativeCamera.capturePhoto).mockResolvedValueOnce(null);

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const boxButton = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });
      fireEvent.click(boxButton);

      await waitFor(() => {
        expect(nativeCamera.capturePhoto).toHaveBeenCalledTimes(1);
      });

      expect(onImageSelected).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('renders Card 2 "صوّر روشتة" and invokes onNavigateToPrescription on click', () => {
      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const prescriptionButton = screen.getByRole('button', { name: 'صوّر روشتة' });
      expect(prescriptionButton).toBeInTheDocument();
      expect(prescriptionButton).toHaveAttribute('aria-label', 'صوّر روشتة');
      expect(prescriptionButton).toHaveTextContent('صوّر روشتة');
      expect(prescriptionButton).toHaveTextContent('قراءة الأدوية المكتوبة في الروشتة وتوضيح ما كتبه الطبيب');

      fireEvent.click(prescriptionButton);
      expect(onNavigateToPrescription).toHaveBeenCalledTimes(1);
    });

    it('renders secondary gallery button "📁 أو اختر صورة من الألبوم" and invokes pickPhoto on click', async () => {
      const mockGalleryPhoto = createMockFile('gallery_photo.jpg');
      vi.mocked(nativeCamera.pickPhoto).mockResolvedValueOnce(mockGalleryPhoto);

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const galleryButton = screen.getByRole('button', { name: 'اختيار صورة علبة دواء من الألبوم' });
      expect(galleryButton).toBeInTheDocument();
      expect(galleryButton).toHaveTextContent('📁 أو اختر صورة من الألبوم');

      fireEvent.click(galleryButton);

      await waitFor(() => {
        expect(nativeCamera.pickPhoto).toHaveBeenCalledTimes(1);
        expect(onImageSelected).toHaveBeenCalledTimes(1);
        expect(onImageSelected).toHaveBeenCalledWith(mockGalleryPhoto);
      });
    });

    it('handles gallery cancellation gracefully when pickPhoto returns null', async () => {
      vi.mocked(nativeCamera.pickPhoto).mockResolvedValueOnce(null);

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const galleryButton = screen.getByRole('button', { name: 'اختيار صورة علبة دواء من الألبوم' });
      fireEvent.click(galleryButton);

      await waitFor(() => {
        expect(nativeCamera.pickPhoto).toHaveBeenCalledTimes(1);
      });

      expect(onImageSelected).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('disables all action buttons and prevents triggers when disabled prop is true', () => {
      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
          disabled: true,
        })
      );

      const boxButton = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });
      const prescriptionButton = screen.getByRole('button', { name: 'صوّر روشتة' });
      const galleryButton = screen.getByRole('button', { name: 'اختيار صورة علبة دواء من الألبوم' });

      expect(boxButton).toBeDisabled();
      expect(prescriptionButton).toBeDisabled();
      expect(galleryButton).toBeDisabled();

      fireEvent.click(boxButton);
      fireEvent.click(prescriptionButton);
      fireEvent.click(galleryButton);

      expect(nativeCamera.capturePhoto).not.toHaveBeenCalled();
      expect(onNavigateToPrescription).not.toHaveBeenCalled();
      expect(nativeCamera.pickPhoto).not.toHaveBeenCalled();
    });

    it('prevents concurrent double-click invocations while capture is in-flight', async () => {
      let resolveCapture: (file: NativePhotoFile) => void;
      const capturePromise = new Promise<NativePhotoFile>((res) => {
        resolveCapture = res;
      });
      vi.mocked(nativeCamera.capturePhoto).mockReturnValueOnce(capturePromise);

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const boxButton = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });

      // Rapid clicks while in flight
      fireEvent.click(boxButton);
      fireEvent.click(boxButton);
      fireEvent.click(boxButton);

      expect(nativeCamera.capturePhoto).toHaveBeenCalledTimes(1);

      // Finish pending capture
      resolveCapture!(createMockFile());
      await waitFor(() => {
        expect(onImageSelected).toHaveBeenCalledTimes(1);
      });
    });

    it('blocks gallery picker while camera capture is in flight', async () => {
      let resolveCapture: (file: NativePhotoFile) => void;
      const capturePromise = new Promise<NativePhotoFile>((res) => {
        resolveCapture = res;
      });
      vi.mocked(nativeCamera.capturePhoto).mockReturnValueOnce(capturePromise);

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const boxButton = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });
      const galleryButton = screen.getByRole('button', { name: 'اختيار صورة علبة دواء من الألبوم' });

      // Start box capture
      fireEvent.click(boxButton);
      expect(nativeCamera.capturePhoto).toHaveBeenCalledTimes(1);

      // Attempt gallery pick while capture is in flight
      fireEvent.click(galleryButton);
      expect(nativeCamera.pickPhoto).not.toHaveBeenCalled();

      // Finish capture
      resolveCapture!(createMockFile());
      await waitFor(() => {
        expect(onImageSelected).toHaveBeenCalledTimes(1);
      });
    });

    it('blocks camera capture while gallery picker is in flight', async () => {
      let resolveGallery: (file: NativePhotoFile) => void;
      const galleryPromise = new Promise<NativePhotoFile>((res) => {
        resolveGallery = res;
      });
      vi.mocked(nativeCamera.pickPhoto).mockReturnValueOnce(galleryPromise);

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const boxButton = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });
      const galleryButton = screen.getByRole('button', { name: 'اختيار صورة علبة دواء من الألبوم' });

      // Start gallery pick
      fireEvent.click(galleryButton);
      expect(nativeCamera.pickPhoto).toHaveBeenCalledTimes(1);

      // Attempt camera capture while gallery is in flight
      fireEvent.click(boxButton);
      expect(nativeCamera.capturePhoto).not.toHaveBeenCalled();

      // Finish gallery pick
      resolveGallery!(createMockFile());
      await waitFor(() => {
        expect(onImageSelected).toHaveBeenCalledTimes(1);
      });
    });
  });

  // =========================================================================
  // 2. Clamped Recent Scans & Empty State Robustness (F07 / R1)
  // =========================================================================
  describe('2. Clamped Recent Scans & Empty State Robustness', () => {
    it('strictly clamps 20 recent scans to exactly 5 displayed items in the DOM', () => {
      const twentyScans = generateHistoryItems(20);

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: twentyScans,
          onSelectRecentScan,
          onClearHistory,
        })
      );

      // Verify the list section header shows length 5
      expect(screen.getByText(/آخر الأدوية التي صورتها \(5\)/)).toBeInTheDocument();

      // Items 1 to 5 must exist
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByRole('button', { name: new RegExp(`عرض تفاصيل دواء دواء ${i}`, 'i') })).toBeInTheDocument();
      }

      // Items 6 to 20 must NOT be in the document
      for (let i = 6; i <= 20; i++) {
        expect(screen.queryByRole('button', { name: new RegExp(`عرض تفاصيل دواء دواء ${i}`, 'i') })).toBeNull();
      }
    });

    it('renders all items when count is between 1 and 5 without over-clamping', () => {
      const threeScans = generateHistoryItems(3);

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: threeScans,
          onSelectRecentScan,
          onClearHistory,
        })
      );

      expect(screen.getByText(/آخر الأدوية التي صورتها \(3\)/)).toBeInTheDocument();
      expect(screen.getByText('دواء 1')).toBeInTheDocument();
      expect(screen.getByText('دواء 2')).toBeInTheDocument();
      expect(screen.getByText('دواء 3')).toBeInTheDocument();
      expect(screen.queryByText('دواء 4')).toBeNull();
    });

    it('displays senior-friendly empty state text when recent scans array is empty', () => {
      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      expect(
        screen.getByText('لا توجد أدوية مسجلة بعد. يمكنك تصوير علبة دواء للبدء.')
      ).toBeInTheDocument();
      expect(screen.queryByText(/آخر الأدوية التي صورتها/)).toBeNull();
    });

    it('defensively handles null or undefined recentScans prop without throwing exceptions', () => {
      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: null as unknown as MedicationHistoryItem[],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      expect(
        screen.getByText('لا توجد أدوية مسجلة بعد. يمكنك تصوير علبة دواء للبدء.')
      ).toBeInTheDocument();
    });

    it('invokes onSelectRecentScan when a clamped scan item is clicked', () => {
      const items = generateHistoryItems(10);

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: items,
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const targetButton = screen.getByRole('button', { name: /عرض تفاصيل دواء دواء 2/i });
      fireEvent.click(targetButton);

      expect(onSelectRecentScan).toHaveBeenCalledTimes(1);
      expect(onSelectRecentScan).toHaveBeenCalledWith(items[1]);
    });

    it('invokes onClearHistory when clear button is clicked in RecentScansList', () => {
      const items = generateHistoryItems(2);

      render(
        React.createElement(RecentScansList, {
          scans: items,
          onSelectScan: onSelectRecentScan,
          onClearHistory,
        })
      );

      const clearButton = screen.getByRole('button', { name: 'مسح سجل الأدوية السابقة' });
      fireEvent.click(clearButton);

      expect(onClearHistory).toHaveBeenCalledTimes(1);
    });

    it('handles items with only English medicine names correctly in aria-labels and display', () => {
      const englishItem: MedicationHistoryItem = {
        id: 'eng-1',
        timestamp: Date.now(),
        is_clear: true,
        medicine_name_en: 'Amoxicillin 500mg',
        active_ingredient: 'Amoxicillin',
        uses: ['Antibiotic'],
        how_and_when: ['1 capsule tid'],
        warnings: ['Complete full course'],
        audio_summary: 'Amoxicillin',
      };

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [englishItem],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      expect(screen.getByText('Amoxicillin 500mg')).toBeInTheDocument();
      const itemBtn = screen.getByRole('button', { name: /عرض تفاصيل دواء Amoxicillin 500mg/i });
      expect(itemBtn).toBeInTheDocument();
    });

    it('strictly clamps 50 recent scans to exactly 5 displayed items', () => {
      const fiftyScans = generateHistoryItems(50);

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: fiftyScans,
          onSelectRecentScan,
          onClearHistory,
        })
      );

      expect(screen.getByText(/آخر الأدوية التي صورتها \(5\)/)).toBeInTheDocument();
      // Only 5 items rendered in list
      const listItems = screen.getAllByRole('button', { name: /عرض تفاصيل دواء/i });
      expect(listItems).toHaveLength(5);
    });

    it('falls back to "غير مسمى" in aria-label when both Arabic and English names are empty', () => {
      const unnamedItem: MedicationHistoryItem = {
        id: 'unnamed-1',
        timestamp: Date.now(),
        is_clear: true,
        medicine_name_ar: '',
        medicine_name_en: '',
        active_ingredient: 'Active Substance',
        uses: [],
        how_and_when: [],
        warnings: [],
        audio_summary: '',
      };

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [unnamedItem],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const unnamedBtn = screen.getByRole('button', { name: /عرض تفاصيل دواء غير مسمى/i });
      expect(unnamedBtn).toBeInTheDocument();
    });

    it('renders scan item without active ingredient subtitle when active_ingredient is absent', () => {
      const itemWithoutActive: MedicationHistoryItem = {
        id: 'no-active-1',
        timestamp: Date.now(),
        is_clear: true,
        medicine_name_ar: 'فيتامين سي',
        active_ingredient: '',
        uses: [],
        how_and_when: [],
        warnings: [],
        audio_summary: '',
      };

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [itemWithoutActive],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      expect(screen.getByText('فيتامين سي')).toBeInTheDocument();
      expect(screen.queryByText(/المادة:/)).toBeNull();
    });
  });

  // =========================================================================
  // 3. Native Mobile Feel CSS Rules Verification (F06 / R1)
  // =========================================================================
  describe('3. Native Mobile Feel CSS Rules Verification', () => {
    const cssPath = path.resolve(__dirname, '../src/index.css');
    let cssContent: string;

    beforeEach(() => {
      cssContent = fs.readFileSync(cssPath, 'utf-8');
    });

    it('verifies src/index.css exists and contains required native app styling rules', () => {
      expect(fs.existsSync(cssPath)).toBe(true);
      expect(cssContent.length).toBeGreaterThan(500);
    });

    it('verifies user-select: none on html and body to eliminate web browser selection feel', () => {
      expect(cssContent).toMatch(/html\s*\{[^}]*user-select:\s*none;/s);
      expect(cssContent).toMatch(/html\s*\{[^}]*-webkit-user-select:\s*none;/s);
      expect(cssContent).toMatch(/body\s*\{[^}]*user-select:\s*none;/s);
      expect(cssContent).toMatch(/body\s*\{[^}]*-webkit-user-select:\s*none;/s);
    });

    it('verifies overscroll-behavior: none to prevent rubber-band bounce effect', () => {
      expect(cssContent).toMatch(/html\s*\{[^}]*overscroll-behavior:\s*none;/s);
      expect(cssContent).toMatch(/html\s*\{[^}]*overscroll-behavior-y:\s*none;/s);
      expect(cssContent).toMatch(/body\s*\{[^}]*overscroll-behavior:\s*none;/s);
      expect(cssContent).toMatch(/body\s*\{[^}]*overscroll-behavior-y:\s*none;/s);
    });

    it('verifies -webkit-tap-highlight-color: transparent on html, body, and buttons', () => {
      expect(cssContent).toMatch(/html\s*\{[^}]*-webkit-tap-highlight-color:\s*transparent;/s);
      expect(cssContent).toMatch(/body\s*\{[^}]*-webkit-tap-highlight-color:\s*transparent;/s);
      expect(cssContent).toMatch(/button,[^}]*-webkit-tap-highlight-color:\s*transparent;/s);
    });

    it('verifies safe-area utilities (.pb-safe and .pt-safe) for notch and navigation bar inset', () => {
      expect(cssContent).toMatch(/\.pb-safe\s*\{[^}]*padding-bottom:\s*max\(\s*16px,\s*env\(safe-area-inset-bottom/s);
      expect(cssContent).toMatch(/\.pt-safe\s*\{[^}]*padding-top:\s*max\(\s*0px,\s*env\(safe-area-inset-top/s);
    });

    it('verifies transition speeds capped under 250ms for native app snappiness', () => {
      expect(cssContent).toMatch(/\.transition-native\s*\{[^}]*transition-duration:\s*200ms;/s);
      expect(cssContent).toMatch(/transition:\s*all\s*0\.2s\s*ease-in-out;/s);
    });

    it('verifies minimum touch target height for buttons in CSS layer', () => {
      expect(cssContent).toMatch(/button,\s*\[role="button"\],[^}]*min-height:\s*(?:var\(--touch-min,\s*48px\)|48px|64px);/s);
      expect(cssContent).toMatch(/--touch-min:\s*(?:48|56|64)px;/);
    });

    it('verifies dynamic base font size scale in CSS', () => {
      expect(cssContent).toMatch(/font-size:\s*(?:16|20)px;/);
      expect(cssContent).toMatch(/(?:\.font-mode-large|html\.font-size-large)\s*\{[^}]*font-size:\s*(?:19|20)px;/);
      expect(cssContent).toMatch(/(?:\.font-mode-extra-large|html\.font-size-extra-large)\s*\{[^}]*font-size:\s*(?:23|24)px;/);
    });

    it('verifies HomeScreen root container has strict dir="rtl" and text-right alignment', () => {
      const { container } = render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveAttribute('dir', 'rtl');
      expect(root.className).toContain('text-right');
    });

    it('verifies action buttons apply minimum 120px height for primary cards and at least 48px for gallery', () => {
      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const boxBtn = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });
      const prescriptionBtn = screen.getByRole('button', { name: 'صوّر روشتة' });
      const galleryBtn = screen.getByRole('button', { name: 'اختيار صورة علبة دواء من الألبوم' });

      expect(boxBtn.className).toContain('min-h-[120px]');
      expect(prescriptionBtn.className).toContain('min-h-[120px]');
      expect(galleryBtn.className).toMatch(/min-h-\[(?:48|56|64)px\]/);
    });

    it('verifies universal minimum touch target of >= 48px on HomeScreen buttons', () => {
      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const boxBtn = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });
      const prescriptionBtn = screen.getByRole('button', { name: 'صوّر روشتة' });
      const galleryBtn = screen.getByRole('button', { name: 'اختيار صورة علبة دواء من الألبوم' });

      // Gallery button meets touch target via custom matcher
      expect(galleryBtn).toHaveMinTouchTarget(48);

      // Primary cards exceed touch target with min-h-[120px] (120px >= 48px)
      const boxMinH = parseInt(boxBtn.className.match(/min-h-\[(\d+)px\]/)?.[1] || '0', 10);
      const rxMinH = parseInt(prescriptionBtn.className.match(/min-h-\[(\d+)px\]/)?.[1] || '0', 10);
      expect(boxMinH).toBeGreaterThanOrEqual(48);
      expect(rxMinH).toBeGreaterThanOrEqual(48);
    });

    it('verifies HomeScreen root element enforces RTL direction via custom matcher', () => {
      const { container } = render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveRtlDirection();
    });
  });

  // =========================================================================
  // 4. Camera Error Handling & Permission Denied Dialogs (F01 / F07)
  // =========================================================================
  describe('4. Camera Error Handling & Permission Denied Dialogs', () => {
    it('catches CameraPermissionDeniedError and renders accessible alert banner', async () => {
      const deniedMsg =
        'تم رفض إذن الكاميرا. يرجى تفعيل إذن استخدام الكاميرا من إعدادات الهاتف لتصوير علبة الدواء، أو يمكنك اختيار صورة من الألبوم.';
      vi.mocked(nativeCamera.capturePhoto).mockRejectedValueOnce(
        new CameraPermissionDeniedError(deniedMsg)
      );

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const boxButton = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });
      fireEvent.click(boxButton);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAttribute('aria-live', 'polite');
        expect(alert).toHaveTextContent(deniedMsg);
      });

      expect(onImageSelected).not.toHaveBeenCalled();
    });

    it('catches PhotosPermissionDeniedError from gallery and displays alert banner', async () => {
      const photosDeniedMsg =
        'تم رفض إذن الوصول إلى الصور. يرجى تفعيل الإذن من إعدادات الهاتف لاختيار صورة من الألبوم.';
      vi.mocked(nativeCamera.pickPhoto).mockRejectedValueOnce(
        new PhotosPermissionDeniedError(photosDeniedMsg)
      );

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const galleryButton = screen.getByRole('button', { name: 'اختيار صورة علبة دواء من الألبوم' });
      fireEvent.click(galleryButton);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent(photosDeniedMsg);
      });
    });

    it('allows user to dismiss the error alert via the close button', async () => {
      vi.mocked(nativeCamera.capturePhoto).mockRejectedValueOnce(
        new CameraPermissionDeniedError('Permission was denied.')
      );

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const boxButton = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });
      fireEvent.click(boxButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      const closeAlertBtn = screen.getByRole('button', { name: 'إغلاق التنبيه' });
      fireEvent.click(closeAlertBtn);

      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('handles generic Error objects with hardware messages gracefully', async () => {
      vi.mocked(nativeCamera.capturePhoto).mockRejectedValueOnce(
        new Error('Camera hardware sensor failed to respond')
      );

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const boxButton = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });
      fireEvent.click(boxButton);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Camera hardware sensor failed to respond');
      });
    });

    it('falls back to friendly Arabic message when thrown error is not an Error instance', async () => {
      vi.mocked(nativeCamera.capturePhoto).mockRejectedValueOnce('string error');

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const boxButton = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });
      fireEvent.click(boxButton);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('تعذر فتح الكاميرا حالياً. يمكنك تجربة اختيار صورة من الألبوم.');
      });
    });

    it('clears existing error alert automatically on subsequent successful capture', async () => {
      // 1. First trigger failure
      vi.mocked(nativeCamera.capturePhoto).mockRejectedValueOnce(
        new CameraPermissionDeniedError('Denied on first attempt')
      );

      render(
        React.createElement(HomeScreen, {
          onImageSelected,
          onNavigateToPrescription,
          recentScans: [],
          onSelectRecentScan,
          onClearHistory,
        })
      );

      const boxButton = screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' });
      fireEvent.click(boxButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // 2. Second attempt succeeds
      const mockSuccessFile = createMockFile('success.jpg');
      vi.mocked(nativeCamera.capturePhoto).mockResolvedValueOnce(mockSuccessFile);

      fireEvent.click(boxButton);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).toBeNull();
        expect(onImageSelected).toHaveBeenCalledWith(mockSuccessFile);
      });
    });
  });

  // =========================================================================
  // 5. Medical Disclaimer Banner Persistence (F08 / R1)
  // =========================================================================
  describe('5. Medical Disclaimer Banner Persistence', () => {
    it('renders DisclaimerBanner with role="note" and aria-label="تنبيه طبي هام"', () => {
      render(React.createElement(DisclaimerBanner));

      const banner = screen.getByRole('note', { name: 'تنبيه طبي هام' });
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveAttribute('aria-label', 'تنبيه طبي هام');
    });

    it('verifies exact Arabic medical disclaimer text is rendered verbatim', () => {
      render(React.createElement(DisclaimerBanner));

      expect(screen.getByText('تنبيه طبي هام:')).toBeInTheDocument();
      expect(
        screen.getByText(
          'هذه المعلومات إرشادية لتسهيل القراءة ولا تغني بأي حال عن تعليمات طبيبك المعالج أو استشارة الصيدلي.'
        )
      ).toBeInTheDocument();
    });

    it('verifies DisclaimerBanner is integrated and persistent on scan result screens in App', async () => {
      // Setup a mock clear result
      const mockClearResult: MedicineAnalysisResult = {
        is_clear: true,
        medicine_name_ar: 'كونكور 5 مجم',
        medicine_name_en: 'Concor 5mg',
        active_ingredient: 'بيسوبرولول فومارات',
        uses: ['علاج ارتفاع ضغط الدم'],
        how_and_when: ['قرص واحد صباحاً قبل الإفطار'],
        warnings: ['لا تتوقف عن تناول الدواء فجأة دون استشارة الطبيب'],
        audio_summary: 'كونكور 5 مجم لعلاج ضغط الدم',
      };

      // Mock capturePhoto and analyzeMedicationImage
      vi.mocked(nativeCamera.capturePhoto).mockResolvedValueOnce(createMockFile());

      // We spy on historyStorage to return an initial item, and click it to open result view
      const historyStorage = await import('../src/services/historyStorage');
      vi.spyOn(historyStorage, 'getScanHistory').mockReturnValue([
        {
          ...mockClearResult,
          id: 'test-concor-1',
          timestamp: Date.now(),
        },
      ]);

      render(React.createElement(App));

      // Verify the recent scan button is present
      const scanItem = screen.getByRole('button', { name: /عرض تفاصيل دواء كونكور 5 مجم/i });
      expect(scanItem).toBeInTheDocument();

      // Click to open result view
      fireEvent.click(scanItem);

      // Verify ResultCards are rendered
      await waitFor(() => {
        expect(screen.getByText('كونكور 5 مجم')).toBeInTheDocument();
      });

      // Verify DisclaimerBanner is present on the result screen
      const disclaimer = screen.getByRole('note', { name: 'تنبيه طبي هام' });
      expect(disclaimer).toBeInTheDocument();
      expect(
        within(disclaimer).getByText(
          'هذه المعلومات إرشادية لتسهيل القراءة ولا تغني بأي حال عن تعليمات طبيبك المعالج أو استشارة الصيدلي.'
        )
      ).toBeInTheDocument();

      // Verify disclaimer persists even when font size preference changes
      const fontToggle = screen.getByRole('button', { name: /تغيير حجم الخط/i });
      fireEvent.click(fontToggle);
      expect(screen.getByRole('note', { name: 'تنبيه طبي هام' })).toBeInTheDocument();

      // Verify reset button returns to home and removes disclaimer
      const resetBtn = screen.getByRole('button', { name: 'العودة وتصوير دواء آخر' });
      fireEvent.click(resetBtn);

      await waitFor(() => {
        expect(screen.queryByRole('note', { name: 'تنبيه طبي هام' })).toBeNull();
        expect(screen.getByRole('button', { name: 'صوّر علبة الدواء الآن' })).toBeInTheDocument();
      });
    });

    it('does not render DisclaimerBanner when photo result is unclear or failed', async () => {
      const mockUnclearResult: MedicineAnalysisResult = {
        is_clear: false,
        error_category: 'unclear_image',
        raw_error: 'الصورة غير واضحة، يرجى إعادة التقاطها في إضاءة أفضل.',
      };

      const historyStorage = await import('../src/services/historyStorage');
      vi.spyOn(historyStorage, 'getScanHistory').mockReturnValue([
        {
          ...mockUnclearResult,
          id: 'test-unclear-1',
          timestamp: Date.now(),
        },
      ]);

      render(React.createElement(App));

      const scanItem = screen.getByRole('button', { name: /عرض تفاصيل دواء غير مسمى/i });
      fireEvent.click(scanItem);

      await waitFor(() => {
        expect(screen.getByText(/الصورة غير واضحة، يرجى إعادة التقاطها/)).toBeInTheDocument();
      });

      // DisclaimerBanner should not be displayed on unclear card
      expect(screen.queryByRole('note', { name: 'تنبيه طبي هام' })).toBeNull();
    });
  });
});
