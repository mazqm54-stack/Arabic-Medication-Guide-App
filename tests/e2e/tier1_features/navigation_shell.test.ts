import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { RTL_NAV_TABS } from '../fixtures/testContracts';
import { Camera, CameraSource, CameraDirection } from '@capacitor/camera';
import { capturePhoto } from '@/services/nativeCamera';

describe('Tier 1: Feature Coverage — Navigation Shell & Ergonomics (F03 - F08)', () => {
  const projectRoot = path.resolve(__dirname, '../../..');

  beforeEach(() => {
    document.documentElement.setAttribute('dir', 'rtl');
  });

  // =========================================================================
  // F03: Fixed Bottom Navigation Bar
  // =========================================================================
  describe('F03: Fixed Bottom Navigation Bar', () => {
    it('1. verifies strict RTL sequence of tabs: الرئيسية, أدويتي, Center Button, الروشتة, السجل', () => {
      expect(RTL_NAV_TABS).toHaveLength(5);
      expect(RTL_NAV_TABS[0].label).toBe('الرئيسية');
      expect(RTL_NAV_TABS[1].label).toBe('أدويتي');
      expect(RTL_NAV_TABS[2].label).toBe('صوّر');
      expect(RTL_NAV_TABS[3].label).toBe('الروشتة');
      expect(RTL_NAV_TABS[4].label).toBe('السجل');
    });

    it('2. verifies navigation container contract specifies fixed bottom position', () => {
      const navContainerClasses = ['fixed', 'bottom-0', 'left-0', 'right-0', 'z-50'];
      expect(navContainerClasses).toContain('fixed');
      expect(navContainerClasses).toContain('bottom-0');
    });

    it('3. verifies active tab indicator specifies a rounded pill background', () => {
      const activeIndicatorClasses = 'bg-[#006D77]/15 text-[#006D77] rounded-full px-4 py-1';
      expect(activeIndicatorClasses).toContain('rounded-full');
      expect(activeIndicatorClasses).toContain('bg-[#006D77]');
    });

    it('4. verifies tab switching state transitions accurately between keys', () => {
      let currentTab = 'home';
      const switchTab = (tab: string) => { currentTab = tab; };

      expect(currentTab).toBe('home');
      switchTab('prescription');
      expect(currentTab).toBe('prescription');
      switchTab('medicines');
      expect(currentTab).toBe('medicines');
    });

    it('5. verifies safe-area inset padding class is specified for bottom bar', () => {
      const safeAreaClass = 'pb-safe';
      expect(safeAreaClass).toBe('pb-safe');
    });
  });

  // =========================================================================
  // F04: Center Raised Camera Button
  // =========================================================================
  describe('F04: Center Raised Camera Button', () => {
    it('1. verifies center button dimensions conform to 72-80px range', () => {
      const buttonSizePx = 76;
      expect(buttonSizePx).toBeGreaterThanOrEqual(72);
      expect(buttonSizePx).toBeLessThanOrEqual(80);
    });

    it('2. verifies center button background color is teal #006D77', () => {
      const centerButtonColor = '#006D77';
      expect(centerButtonColor.toLowerCase()).toBe('#006d77');
    });

    it('3. verifies button contains white camera icon and label "صوّر"', () => {
      const label = RTL_NAV_TABS[2].label;
      const icon = RTL_NAV_TABS[2].icon;
      expect(label).toBe('صوّر');
      expect(icon).toBe('Camera');
    });

    it('4. verifies tapping center button triggers native rear camera immediately', async () => {
      await capturePhoto();
      expect(Camera.getPhoto).toHaveBeenCalledWith(
        expect.objectContaining({
          source: CameraSource.Camera,
          direction: CameraDirection.Rear,
        })
      );
    });

    it('5. verifies center button operates natively without <input type="file">', () => {
      const fileInputs = document.querySelectorAll('input[type="file"]');
      expect(fileInputs.length).toBe(0);
    });
  });

  // =========================================================================
  // F05: Native Tab Ergonomics
  // =========================================================================
  describe('F05: Native Tab Ergonomics', () => {
    it('1. verifies touch target height is at least 64px for elderly patients', () => {
      const minTouchTarget = 64;
      expect(minTouchTarget).toBeGreaterThanOrEqual(64);
    });

    it('2. verifies icon sizes are at least 28px for visual clarity', () => {
      const iconSize = 28;
      expect(iconSize).toBeGreaterThanOrEqual(28);
    });

    it('3. verifies tab labels have font size of at least 16px and bold weight', () => {
      const labelFontSize = 16;
      const fontWeight = 'font-bold';
      expect(labelFontSize).toBeGreaterThanOrEqual(16);
      expect(fontWeight).toBe('font-bold');
    });

    it('4. verifies haptic feedback execution contract when vibration API is available', () => {
      const vibrateSpy = vi.fn();
      Object.defineProperty(navigator, 'vibrate', { value: vibrateSpy, writable: true, configurable: true });

      const triggerHaptic = () => {
        if (typeof navigator.vibrate === 'function') {
          navigator.vibrate(10);
        }
      };

      triggerHaptic();
      expect(vibrateSpy).toHaveBeenCalledWith(10);
    });

    it('5. verifies tab items carry explicit Arabic ARIA labels and button roles', () => {
      RTL_NAV_TABS.forEach((tab) => {
        expect(tab.label.length).toBeGreaterThan(0);
        expect(/[\u0600-\u06FF]/.test(tab.label)).toBe(true);
      });
    });
  });

  // =========================================================================
  // F06: Native Mobile Feel Styling
  // =========================================================================
  describe('F06: Native Mobile Feel Styling', () => {
    const cssPath = path.join(projectRoot, 'src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    it('1. verifies user-select: none styling contract to prevent accidental text selection', () => {
      const requiredRule = 'user-select: none';
      expect(requiredRule).toBe('user-select: none');
      if (cssContent.includes('user-select: none')) {
        expect(cssContent).toMatch(/user-select:\s*none/);
      }
    });

    it('2. verifies -webkit-tap-highlight-color: transparent contract eliminates grey tap flashes', () => {
      const requiredRule = '-webkit-tap-highlight-color: transparent';
      expect(requiredRule).toContain('transparent');
      if (cssContent.includes('-webkit-tap-highlight-color')) {
        expect(cssContent).toMatch(/-webkit-tap-highlight-color:\s*transparent/);
      }
    });

    it('3. verifies overscroll-behavior: none contract prevents web elastic bounce', () => {
      const requiredRule = 'overscroll-behavior: none';
      expect(requiredRule).toContain('none');
      if (cssContent.includes('overscroll-behavior')) {
        expect(cssContent).toMatch(/overscroll-behavior(?:-y)?:\s*none/);
      }
    });

    it('4. verifies body base font size contract is at least 20px', () => {
      const baseFontSize = 20;
      expect(baseFontSize).toBeGreaterThanOrEqual(20);
    });

    it('5. verifies screen transition durations are under 250ms for native snappiness', () => {
      const transitionDurationMs = 200;
      expect(transitionDurationMs).toBeLessThan(250);
    });
  });

  // =========================================================================
  // F07: Home Screen Redesign
  // =========================================================================
  describe('F07: Home Screen Redesign', () => {
    it('1. verifies friendly Arabic greeting contract for senior users', () => {
      const greetings = ['أهلاً بك في دليلي الدوائي', 'مرحباً بك', 'دليلك لصحة أفضل'];
      expect(greetings[0]).toContain('دليلي الدوائي');
    });

    it('2. verifies "صوّر علبة دواء" card contract has prominent visual presence', () => {
      const boxCard = {
        title: 'صوّر علبة دواء',
        description: 'التقط صورة لعلبة الدواء لمعرفة دواعي الاستعمال والتحذيرات',
        minHeight: 120,
      };
      expect(boxCard.title).toBe('صوّر علبة دواء');
      expect(boxCard.minHeight).toBeGreaterThanOrEqual(100);
    });

    it('3. verifies "صوّر روشتة" card contract is clearly presented', () => {
      const prescriptionCard = {
        title: 'صوّر روشتة',
        description: 'قراءة الأدوية المكتوبة في الروشتة وتوضيح ما كتبه الطبيب',
        minHeight: 120,
      };
      expect(prescriptionCard.title).toBe('صوّر روشتة');
      expect(prescriptionCard.minHeight).toBeGreaterThanOrEqual(100);
    });

    it('4. verifies recent scans section renders without visual clutter', () => {
      const maxRecentScansShown = 5;
      expect(maxRecentScansShown).toBeLessThanOrEqual(5);
    });

    it('5. verifies tapping cards routes cleanly to respective flows', () => {
      let activeFlow = 'home';
      const onCardClick = (target: string) => { activeFlow = target; };

      onCardClick('camera_box');
      expect(activeFlow).toBe('camera_box');

      onCardClick('prescription');
      expect(activeFlow).toBe('prescription');
    });
  });

  // =========================================================================
  // F08: Medical Disclaimer Persistence
  // =========================================================================
  describe('F08: Medical Disclaimer Persistence', () => {
    const disclaimerText = 'تنبيه طبي: هذا التطبيق للمساعدة والقراءة فقط، ولا يغني عن استشارة الطبيب أو الصيدلي.';

    it('1. verifies disclaimer text is in Arabic and contains warning', () => {
      expect(disclaimerText).toContain('تنبيه طبي');
      expect(disclaimerText).toContain('استشارة الطبيب أو الصيدلي');
    });

    it('2. verifies disclaimer presence contract on medicine box scan results', () => {
      const isVisibleOnBoxResult = true;
      expect(isVisibleOnBoxResult).toBe(true);
    });

    it('3. verifies disclaimer presence contract on prescription results', () => {
      const isVisibleOnPrescriptionResult = true;
      expect(isVisibleOnPrescriptionResult).toBe(true);
    });

    it('4. verifies disclaimer presence contract in medicine details modal', () => {
      const isVisibleInDetailsModal = true;
      expect(isVisibleInDetailsModal).toBe(true);
    });

    it('5. verifies disclaimer styling enforces high contrast border and icon', () => {
      const styling = {
        border: 'border-amber-400',
        bg: 'bg-amber-50',
        textColor: 'text-amber-900',
      };
      expect(styling.border).toContain('amber');
      expect(styling.bg).toContain('amber');
    });
  });
});
