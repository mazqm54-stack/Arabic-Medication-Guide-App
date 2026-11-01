import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { BottomNavBar, RTL_NAV_TABS } from '../src/components/BottomNavBar';
import App from '../src/App';
import * as nativeCamera from '../src/services/nativeCamera';
import { TabKey } from '../src/types';

describe('Milestone M3 Challenger 1: RTL Bottom Navigation & Shell Adversarial Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.setAttribute('dir', 'rtl');

    // Default mock for navigator.vibrate
    if (typeof navigator !== 'undefined') {
      Object.defineProperty(navigator, 'vibrate', {
        value: vi.fn().mockReturnValue(true),
        writable: true,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. RTL Tab Order & Visual DOM Structure
  // =========================================================================
  describe('1. RTL Tab Order & Visual Positions in DOM', () => {
    it('1.1 verifies export contract RTL_NAV_TABS matches exact 5-tab sequence', () => {
      expect(RTL_NAV_TABS).toHaveLength(5);
      expect(RTL_NAV_TABS[0]).toEqual({ key: 'home', label: 'الرئيسية', icon: 'Home' });
      expect(RTL_NAV_TABS[1]).toEqual({ key: 'medicines', label: 'أدويتي', icon: 'Pill' });
      expect(RTL_NAV_TABS[2]).toEqual({ key: 'camera', label: 'صوّر', icon: 'Camera' });
      expect(RTL_NAV_TABS[3]).toEqual({ key: 'prescription', label: 'الروشتة', icon: 'FileText' });
      expect(RTL_NAV_TABS[4]).toEqual({ key: 'history', label: 'السجل', icon: 'History' });
    });

    it('1.2 verifies navigation root element enforces dir="rtl" and semantic role="navigation"', () => {
      const { container } = render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const navElement = container.querySelector('nav');
      expect(navElement).not.toBeNull();
      expect(navElement?.getAttribute('dir')).toBe('rtl');
      expect(navElement?.getAttribute('role')).toBe('navigation');
      expect(navElement?.getAttribute('aria-label')).toBe('شريط التنقل السفلي');
      expect(navElement).toHaveRtlDirection();
    });

    it('1.3 verifies exact 5 children in physical DOM order: [home, medicines, camera, prescription, history]', () => {
      const { container } = render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const navInnerFlex = container.querySelector('nav > div');
      expect(navInnerFlex).not.toBeNull();
      const children = Array.from(navInnerFlex!.children);
      expect(children).toHaveLength(5);

      // Child 0: Tab 1 (الرئيسية)
      expect(children[0].tagName.toLowerCase()).toBe('button');
      expect(children[0].getAttribute('aria-label')).toBe('الرئيسية');
      expect(children[0].textContent).toContain('الرئيسية');

      // Child 1: Tab 2 (أدويتي)
      expect(children[1].tagName.toLowerCase()).toBe('button');
      expect(children[1].getAttribute('aria-label')).toBe('أدويتي');
      expect(children[1].textContent).toContain('أدويتي');

      // Child 2: Tab 3 (Center Raised Camera Button wrapper)
      expect(children[2].tagName.toLowerCase()).toBe('div');
      const cameraBtn = children[2].querySelector('button');
      expect(cameraBtn).not.toBeNull();
      expect(cameraBtn?.getAttribute('aria-label')).toBe('صوّر');
      expect(cameraBtn?.textContent).toContain('صوّر');

      // Child 3: Tab 4 (الروشتة)
      expect(children[3].tagName.toLowerCase()).toBe('button');
      expect(children[3].getAttribute('aria-label')).toBe('الروشتة');
      expect(children[3].textContent).toContain('الروشتة');

      // Child 4: Tab 5 (السجل)
      expect(children[4].tagName.toLowerCase()).toBe('button');
      expect(children[4].getAttribute('aria-label')).toBe('السجل');
      expect(children[4].textContent).toContain('السجل');
    });

    it('1.4 verifies active state indicator specifies rounded-full pill for each active tab', () => {
      const tabs: TabKey[] = ['home', 'medicines', 'prescription', 'history'];

      for (const currentTab of tabs) {
        const { unmount } = render(
          React.createElement(BottomNavBar, {
            activeTab: currentTab,
            onSelectTab: vi.fn(),
            onCameraClick: vi.fn(),
          })
        );

        const tabButtons = screen.getAllByRole('tab');
        const activeTabButton = tabButtons.find(
          (btn) => btn.getAttribute('aria-selected') === 'true'
        );

        expect(activeTabButton).toBeDefined();
        expect(activeTabButton?.className).toContain('rounded-full');
        expect(activeTabButton?.className).toContain('bg-[#006D77]/15');
        expect(activeTabButton?.className).toContain('text-[#006D77]');

        // Ensure non-active tabs have aria-selected="false"
        const inactiveTabButtons = tabButtons.filter(
          (btn) => btn.getAttribute('aria-selected') === 'false'
        );
        expect(inactiveTabButtons).toHaveLength(3);
        inactiveTabButtons.forEach((btn) => {
          expect(btn.className).not.toContain('bg-[#006D77]/15');
        });

        unmount();
      }
    });

    it('1.5 verifies fixed positioning and safe-area inset classes on nav bar', () => {
      const { container } = render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const nav = container.querySelector('nav')!;
      expect(nav.classList.contains('fixed')).toBe(true);
      expect(nav.classList.contains('bottom-0')).toBe(true);
      expect(nav.classList.contains('left-0')).toBe(true);
      expect(nav.classList.contains('right-0')).toBe(true);
      expect(nav.classList.contains('z-50')).toBe(true);
      expect(nav.classList.contains('pb-safe')).toBe(true);
    });
  });

  // =========================================================================
  // 2. Center Raised Circular Camera Button Specs & Attributes
  // =========================================================================
  describe('2. Center Raised Circular Camera Button Specs & Attributes', () => {
    it('2.1 verifies dimensions are clamped strictly between 72px and 80px (76px)', () => {
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const cameraButton = screen.getByRole('button', { name: 'صوّر' });
      expect(cameraButton.className).toContain('w-[76px]');
      expect(cameraButton.className).toContain('h-[76px]');

      // Extract pixel values from classes
      const widthMatch = cameraButton.className.match(/w-\[(\d+)px\]/);
      const heightMatch = cameraButton.className.match(/h-\[(\d+)px\]/);
      expect(widthMatch).not.toBeNull();
      expect(heightMatch).not.toBeNull();

      const width = parseInt(widthMatch![1], 10);
      const height = parseInt(heightMatch![1], 10);

      expect(width).toBeGreaterThanOrEqual(72);
      expect(width).toBeLessThanOrEqual(80);
      expect(height).toBeGreaterThanOrEqual(72);
      expect(height).toBeLessThanOrEqual(80);
      expect(width).toBe(height); // Must be equilateral circular
    });

    it('2.2 verifies circular styling, z-index >= 60, and teal #006D77 background', () => {
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const cameraButton = screen.getByRole('button', { name: 'صوّر' });
      expect(cameraButton.className).toContain('rounded-full');
      expect(cameraButton.className).toContain('bg-[#006D77]');
      expect(cameraButton.className).toContain('z-60');

      // Verify z-index is at least 60
      const zIndexMatch = cameraButton.className.match(/z-(\d+)/);
      expect(zIndexMatch).not.toBeNull();
      const zIndex = parseInt(zIndexMatch![1], 10);
      expect(zIndex).toBeGreaterThanOrEqual(60);
    });

    it('2.3 verifies raised styling with negative top margin, shadow-xl, and white border', () => {
      const { container } = render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const cameraWrapper = container.querySelector('nav > div > div.relative');
      expect(cameraWrapper).not.toBeNull();
      expect(cameraWrapper?.className).toContain('-mt-7');

      const cameraButton = screen.getByRole('button', { name: 'صوّر' });
      expect(cameraButton.className).toContain('shadow-xl');
      expect(cameraButton.className).toContain('border-4');
      expect(cameraButton.className).toContain('border-white');
    });

    it('2.4 verifies white camera icon (w-8 h-8 >= 28px) and bold label "صوّر"', () => {
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const cameraButton = screen.getByRole('button', { name: 'صوّر' });
      const svgIcon = cameraButton.querySelector('svg');
      expect(svgIcon).not.toBeNull();
      expect(svgIcon?.getAttribute('aria-hidden')).toBe('true');
      expect(svgIcon?.classList.contains('w-8')).toBe(true);
      expect(svgIcon?.classList.contains('h-8')).toBe(true);
      expect(svgIcon?.classList.contains('text-white')).toBe(true);

      const labelSpan = cameraButton.querySelector('span');
      expect(labelSpan).not.toBeNull();
      expect(labelSpan?.textContent).toBe('صوّر');
      expect(labelSpan?.className).toContain('text-white');
      expect(labelSpan?.className).toContain('font-black');
    });

    it('2.5 verifies navigation bar operates natively without any <input type="file">', () => {
      const { container } = render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const fileInputs = container.querySelectorAll('input[type="file"]');
      expect(fileInputs.length).toBe(0);
    });
  });

  // =========================================================================
  // 3. Rapid Concurrent Double-Tap Stress & Camera Mutex Lock
  // =========================================================================
  describe('3. Rapid Double-Click & Mutex Stress Testing', () => {
    it('3.1 prevents duplicate execution when camera button is rapidly double-tapped (5x concurrent)', async () => {
      let resolveCamera!: () => void;
      const cameraPromise = new Promise<void>((resolve) => {
        resolveCamera = resolve;
      });
      const onCameraClick = vi.fn().mockReturnValue(cameraPromise);

      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: onCameraClick,
        })
      );

      const cameraButton = screen.getByRole('button', { name: 'صوّر' });

      // First click begins execution and acquires mutex lock
      await act(async () => {
        fireEvent.click(cameraButton);
      });
      expect(onCameraClick).toHaveBeenCalledTimes(1);

      // Rapid concurrent second, third, fourth, fifth taps while capturing is in-flight
      await act(async () => {
        fireEvent.click(cameraButton);
        fireEvent.click(cameraButton);
        fireEvent.click(cameraButton);
        fireEvent.click(cameraButton);
      });

      // Mutex lock must have discarded all concurrent attempts
      expect(onCameraClick).toHaveBeenCalledTimes(1);

      // Now resolve camera promise
      await act(async () => {
        resolveCamera();
      });

      // After lock is released, subsequent click should now proceed
      await act(async () => {
        fireEvent.click(cameraButton);
      });
      expect(onCameraClick).toHaveBeenCalledTimes(2);
    });

    it('3.2 allows subsequent sequential camera clicks after previous capture resolves', async () => {
      const onCameraClick = vi.fn().mockResolvedValue(undefined);

      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: onCameraClick,
        })
      );

      const cameraButton = screen.getByRole('button', { name: 'صوّر' });

      // First sequential click
      await act(async () => {
        fireEvent.click(cameraButton);
      });
      expect(onCameraClick).toHaveBeenCalledTimes(1);

      // Second sequential click
      await act(async () => {
        fireEvent.click(cameraButton);
      });
      expect(onCameraClick).toHaveBeenCalledTimes(2);

      // Third sequential click
      await act(async () => {
        fireEvent.click(cameraButton);
      });
      expect(onCameraClick).toHaveBeenCalledTimes(3);
    });

    it('3.3 enforces disabled state when disabled prop is true and blocks all clicks', async () => {
      const onCameraClick = vi.fn();
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: onCameraClick,
          disabled: true,
        })
      );

      const cameraButton = screen.getByRole('button', { name: 'صوّر' });
      expect(cameraButton).toBeDisabled();

      await act(async () => {
        fireEvent.click(cameraButton);
        fireEvent.click(cameraButton);
      });

      expect(onCameraClick).not.toHaveBeenCalled();
    });

    it('3.4 sets disabled attribute and disabled:opacity-60 while capturing lock is active', async () => {
      let resolveCamera!: () => void;
      const cameraPromise = new Promise<void>((resolve) => {
        resolveCamera = resolve;
      });
      const onCameraClick = vi.fn().mockReturnValue(cameraPromise);

      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: onCameraClick,
        })
      );

      const cameraButton = screen.getByRole('button', { name: 'صوّر' });
      expect(cameraButton).not.toBeDisabled();

      // Click to start capture
      await act(async () => {
        fireEvent.click(cameraButton);
      });

      // While capturing is in-flight:
      expect(cameraButton).toBeDisabled();
      expect(cameraButton.className).toContain('disabled:opacity-60');

      // Finish capture
      await act(async () => {
        resolveCamera();
      });

      // Restored after capture completes
      expect(cameraButton).not.toBeDisabled();
    });
  });

  // =========================================================================
  // 4. Senior Touch Target & Accessibility Compliance
  // =========================================================================
  describe('4. Senior Touch Target & Accessibility Compliance', () => {
    it('4.1 verifies all 4 standard navigation tabs have minimum 64px touch target (toHaveMinTouchTarget)', () => {
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const tabButtons = screen.getAllByRole('tab');
      expect(tabButtons).toHaveLength(4);

      tabButtons.forEach((tab) => {
        expect(tab.className).toContain('min-h-[64px]');
        expect(tab.className).toContain('min-w-[64px]');
        expect(tab).toHaveMinTouchTarget(64);
      });
    });

    it('4.2 verifies center camera button has touch target exceeding 64px (76px x 76px)', () => {
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const cameraButton = screen.getByRole('button', { name: 'صوّر' });
      expect(cameraButton.className).toContain('w-[76px]');
      expect(cameraButton.className).toContain('h-[76px]');

      const wMatch = cameraButton.className.match(/w-\[(\d+)px\]/);
      const hMatch = cameraButton.className.match(/h-\[(\d+)px\]/);
      expect(wMatch).not.toBeNull();
      expect(hMatch).not.toBeNull();

      const width = parseInt(wMatch![1], 10);
      const height = parseInt(hMatch![1], 10);
      expect(width).toBeGreaterThanOrEqual(64);
      expect(height).toBeGreaterThanOrEqual(64);
    });

    it('4.3 verifies icon dimensions are >= 28px for all tabs', () => {
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const tabButtons = screen.getAllByRole('tab');
      tabButtons.forEach((tab) => {
        const svg = tab.querySelector('svg');
        expect(svg).not.toBeNull();
        // Lucide w-7 h-7 = 1.75rem = 28px
        expect(svg?.classList.contains('w-7')).toBe(true);
        expect(svg?.classList.contains('h-7')).toBe(true);
      });

      // Center button icon w-8 h-8 = 2rem = 32px
      const cameraBtn = screen.getByRole('button', { name: 'صوّر' });
      const cameraSvg = cameraBtn.querySelector('svg');
      expect(cameraSvg).not.toBeNull();
      expect(cameraSvg?.classList.contains('w-8')).toBe(true);
      expect(cameraSvg?.classList.contains('h-8')).toBe(true);
    });

    it('4.4 verifies tab labels have senior typography text-base (16px) and bold font', () => {
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const tabButtons = screen.getAllByRole('tab');
      tabButtons.forEach((tab) => {
        const span = tab.querySelector('span');
        expect(span).not.toBeNull();
        // text-base = 1rem = 16px
        expect(span?.classList.contains('text-base')).toBe(true);
        expect(span?.classList.contains('font-bold')).toBe(true);
      });
    });

    it('4.5 verifies ARIA roles, labels, and hidden attributes for screen readers', () => {
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'medicines',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      expect(screen.getByRole('navigation', { name: 'شريط التنقل السفلي' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'الرئيسية' })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('tab', { name: 'أدويتي' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'الروشتة' })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('tab', { name: 'السجل' })).toHaveAttribute('aria-selected', 'false');

      const svgs = document.querySelectorAll('svg');
      svgs.forEach((svg) => {
        expect(svg.getAttribute('aria-hidden')).toBe('true');
      });
    });
  });

  // =========================================================================
  // 5. Haptic Feedback Invocation
  // =========================================================================
  describe('5. Haptic Feedback Invocation', () => {
    it('5.1 invokes navigator.vibrate(10) when each tab is clicked', async () => {
      const vibrateSpy = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrateSpy,
        writable: true,
        configurable: true,
      });

      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      // Click Tab 1: الرئيسية
      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: 'الرئيسية' }));
      });
      expect(vibrateSpy).toHaveBeenLastCalledWith(10);

      // Click Tab 2: أدويتي
      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: 'أدويتي' }));
      });
      expect(vibrateSpy).toHaveBeenLastCalledWith(10);

      // Click Tab 4: الروشتة
      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: 'الروشتة' }));
      });
      expect(vibrateSpy).toHaveBeenLastCalledWith(10);

      // Click Tab 5: السجل
      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: 'السجل' }));
      });
      expect(vibrateSpy).toHaveBeenLastCalledWith(10);

      // Click Center Camera Button
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'صوّر' }));
      });
      expect(vibrateSpy).toHaveBeenLastCalledWith(10);

      expect(vibrateSpy).toHaveBeenCalledTimes(5);
    });

    it('5.2 degrades gracefully without throwing when navigator.vibrate is undefined (e.g. desktop/iOS Safari)', async () => {
      Object.defineProperty(navigator, 'vibrate', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const onSelectTab = vi.fn();
      const onCameraClick = vi.fn();

      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: onSelectTab,
          onCameraClick: onCameraClick,
        })
      );

      await expect(
        act(async () => {
          fireEvent.click(screen.getByRole('tab', { name: 'أدويتي' }));
          fireEvent.click(screen.getByRole('button', { name: 'صوّر' }));
        })
      ).resolves.not.toThrow();

      expect(onSelectTab).toHaveBeenCalledWith('medicines');
      expect(onCameraClick).toHaveBeenCalledTimes(1);
    });

    it('5.3 suppresses exceptions if navigator.vibrate throws (e.g. SecurityError or policy block)', async () => {
      Object.defineProperty(navigator, 'vibrate', {
        value: vi.fn().mockImplementation(() => {
          throw new DOMException('Vibration blocked by user permissions policy', 'SecurityError');
        }),
        writable: true,
        configurable: true,
      });

      const onSelectTab = vi.fn();
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: onSelectTab,
          onCameraClick: vi.fn(),
        })
      );

      await expect(
        act(async () => {
          fireEvent.click(screen.getByRole('tab', { name: 'الروشتة' }));
        })
      ).resolves.not.toThrow();

      expect(onSelectTab).toHaveBeenCalledWith('prescription');
    });
  });

  // =========================================================================
  // 6. Navigation Routing & Tab Switching in App.tsx
  // =========================================================================
  describe('6. Tab Routing in App.tsx', () => {
    it('6.1 starts at home screen and switches between tabs seamlessly', async () => {
      render(React.createElement(App));

      // Initial Home Screen view
      expect(screen.getByText('أهلاً بكم في دليلي الدوائي')).toBeInTheDocument();
      expect(screen.getByText('صوّر علبة الدواء الآن')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'الرئيسية' })).toHaveAttribute('aria-selected', 'true');

      // Navigate to 'medicines' tab
      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: 'أدويتي' }));
      });
      expect(screen.getByText('💊 أدويتي المحفوظة')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'أدويتي' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'الرئيسية' })).toHaveAttribute('aria-selected', 'false');

      // Navigate to 'prescription' tab
      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: 'الروشتة' }));
      });
      expect(screen.getByText('📋 قراءة الروشتة الطبية')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'صوّر الروشتة بالكاميرا' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'الروشتة' })).toHaveAttribute('aria-selected', 'true');

      // Navigate to 'history' tab
      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: 'السجل' }));
      });
      expect(screen.getByText('🕒 سجل الأدوية السابقة')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'السجل' })).toHaveAttribute('aria-selected', 'true');

      // Navigate back to 'home' tab
      await act(async () => {
        fireEvent.click(screen.getByRole('tab', { name: 'الرئيسية' }));
      });
      expect(screen.getByText('أهلاً بكم في دليلي الدوائي')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'الرئيسية' })).toHaveAttribute('aria-selected', 'true');
    });

    it('6.2 navigates to prescription tab from HomeScreen "صوّر روشتة" card', async () => {
      render(React.createElement(App));

      // Click Card 2: "صوّر روشتة"
      const prescriptionCard = screen.getByRole('button', { name: 'صوّر روشتة' });
      await act(async () => {
        fireEvent.click(prescriptionCard);
      });

      // Verifies prescription view rendered and nav bar tab is selected
      expect(screen.getByText('📋 قراءة الروشتة الطبية')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'الروشتة' })).toHaveAttribute('aria-selected', 'true');
    });

    it('6.3 triggers native rear camera when center camera button is tapped in App shell', async () => {
      const captureSpy = vi.spyOn(nativeCamera, 'capturePhoto').mockResolvedValue(null);

      render(React.createElement(App));

      const centerCameraBtn = screen.getByRole('button', { name: 'صوّر' });
      await act(async () => {
        fireEvent.click(centerCameraBtn);
      });

      expect(captureSpy).toHaveBeenCalledTimes(1);
    });
  });
});
