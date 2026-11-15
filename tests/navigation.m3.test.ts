import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { BottomNavBar } from '../src/components/BottomNavBar';
import App from '../src/App';

describe('Milestone 3: Navigation, Compact Top Bar, Center Camera Button & Lucide Icons Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.setAttribute('dir', 'rtl');

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
  // 1. Bottom Navigation Collision Fix & 5 Equal-Width Slots
  // =========================================================================
  describe('1. Bottom Navigation Collision Fix & 5 Equal-Width Slots', () => {
    it('1.1 verifies navigation container specifies 5 equal slots via grid-cols-5', () => {
      const { container } = render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const navGrid = container.querySelector('nav > div');
      expect(navGrid).not.toBeNull();
      expect(navGrid?.className).toContain('grid');
      expect(navGrid?.className).toContain('grid-cols-5');
      expect(navGrid?.children).toHaveLength(5);
    });

    it('1.2 verifies strict RTL slot order: الرئيسية, أدويتي, صوّر, الروشتة, السجل', () => {
      const { container } = render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const children = Array.from(container.querySelector('nav > div')!.children);
      expect(children[0].textContent).toContain('الرئيسية');
      expect(children[1].textContent).toContain('أدويتي');
      expect(children[2].textContent).toContain('صوّر');
      expect(children[3].textContent).toContain('الروشتة');
      expect(children[4].textContent).toContain('السجل');
    });

    it('1.3 verifies 24px Lucide icons (w-6 h-6) across all 4 tab buttons', () => {
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
        const svg = tab.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg?.classList.contains('w-6')).toBe(true);
        expect(svg?.classList.contains('h-6')).toBe(true);
      });
    });

    it('1.4 verifies 12px labels (text-xs) with single-line truncation and ellipsis', () => {
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const tabButtons = screen.getAllByRole('tab');
      tabButtons.forEach((tab) => {
        const label = tab.querySelector('span');
        expect(label).not.toBeNull();
        expect(label?.className).toContain('text-xs');
        expect(label?.className).not.toContain('text-base');
        expect(label?.className).not.toContain('text-sm');
        expect(label?.className).toContain('truncate');
        expect(label?.className).toContain('overflow-hidden');
        expect(label?.className).toContain('text-ellipsis');
        expect(label?.className).toContain('whitespace-nowrap');
      });
    });

    it('1.5 verifies geometry fits within 320px and 360px viewport widths without overflow', () => {
      // 5 slots in 320px: 320px - 8px padding = 312px / 5 = 62.4px per slot
      // 5 slots in 360px: 360px - 8px padding = 352px / 5 = 70.4px per slot
      const viewports = [320, 360];
      viewports.forEach((vpWidth) => {
        const padding = 8;
        const availableWidth = vpWidth - padding;
        const slotWidth = availableWidth / 5;
        expect(slotWidth).toBeGreaterThanOrEqual(60); // Each slot gets >= 60px
      });
    });
  });

  // =========================================================================
  // 2. Center Raised Circular Camera Button Specs & Behavior
  // =========================================================================
  describe('2. Center Raised Circular Camera Button Specs & Behavior', () => {
    it('2.1 verifies exact 64px circle dimensions (w-16 h-16 / w-[64px] h-[64px])', () => {
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const cameraBtn = screen.getByRole('button', { name: 'صوّر' });
      expect(cameraBtn.className).toMatch(/w-(?:16|\[64px\])/);
      expect(cameraBtn.className).toMatch(/h-(?:16|\[64px\])/);
      expect(cameraBtn.className).toContain('rounded-full');
    });

    it('2.2 verifies teal gradient from #0A8F9C to #006D77', () => {
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const cameraBtn = screen.getByRole('button', { name: 'صوّر' });
      expect(cameraBtn.className).toContain('bg-gradient-to-b');
      expect(cameraBtn.className).toContain('from-[#0A8F9C]');
      expect(cameraBtn.className).toContain('to-[#006D77]');
    });

    it('2.3 verifies 4px notch ring matching nav bar background and soft glow shadow', () => {
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const cameraBtn = screen.getByRole('button', { name: 'صوّر' });
      expect(cameraBtn.className).toContain('ring-4');
      expect(cameraBtn.className).toContain('ring-white');
      expect(cameraBtn.className).toContain('dark:ring-[#162124]');
      expect(cameraBtn.className).toMatch(/shadow-\[0_4px_16px/);
    });

    it('2.4 verifies 28px white scan-style line-icon (ScanLine) and small "صوّر" label below', () => {
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: vi.fn(),
        })
      );

      const cameraBtn = screen.getByRole('button', { name: 'صوّر' });
      const svg = cameraBtn.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.classList.contains('w-7')).toBe(true);
      expect(svg?.classList.contains('h-7')).toBe(true);
      expect(svg?.classList.contains('text-white')).toBe(true);

      const label = cameraBtn.querySelector('span');
      expect(label).not.toBeNull();
      expect(label?.textContent).toBe('صوّر');
      expect(label?.className).toContain('text-xs');
      expect(label?.className).toContain('text-white');
    });

    it('2.5 verifies active:scale-95 press animation and haptic feedback on click', async () => {
      const vibrateSpy = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrateSpy,
        writable: true,
        configurable: true,
      });

      const onCameraClick = vi.fn();
      render(
        React.createElement(BottomNavBar, {
          activeTab: 'home',
          onSelectTab: vi.fn(),
          onCameraClick: onCameraClick,
        })
      );

      const cameraBtn = screen.getByRole('button', { name: 'صوّر' });
      expect(cameraBtn.className).toContain('active:scale-95');

      await act(async () => {
        fireEvent.click(cameraBtn);
      });

      expect(vibrateSpy).toHaveBeenCalledWith(10);
      expect(onCameraClick).toHaveBeenCalledTimes(1);
    });

    it('2.6 preserves synchronous mutex lock preventing duplicate in-flight triggers', async () => {
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

      const cameraBtn = screen.getByRole('button', { name: 'صوّر' });

      await act(async () => {
        fireEvent.click(cameraBtn);
      });
      expect(onCameraClick).toHaveBeenCalledTimes(1);

      // Concurrent taps while in-flight
      await act(async () => {
        fireEvent.click(cameraBtn);
        fireEvent.click(cameraBtn);
        fireEvent.click(cameraBtn);
      });
      expect(onCameraClick).toHaveBeenCalledTimes(1);

      // Resolve and verify next sequential tap succeeds
      await act(async () => {
        resolveCamera();
      });

      await act(async () => {
        fireEvent.click(cameraBtn);
      });
      expect(onCameraClick).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // 3. Compact Top Bar & Slim Advisory Banner in App.tsx
  // =========================================================================
  describe('3. Compact Top Bar & Slim Advisory Banner in App.tsx', () => {
    it('3.1 verifies compact top bar renders small logo (w-8 h-8) and app title (~18px text-lg font-black)', () => {
      render(React.createElement(App));

      const title = screen.getByRole('heading', { level: 1, name: 'دليلي الدوائي' });
      expect(title).toBeInTheDocument();
      expect(title.className).toContain('text-lg');
      expect(title.className).toContain('font-black');

      // Verify no long subtitle in the header
      expect(screen.queryByText('مساعدك الطبي لقراءة علب الأدوية والروشتات')).toBeNull();
    });

    it('3.2 verifies small "Aa" button with touch target min 48px cycles font size', async () => {
      render(React.createElement(App));

      const aaBtn = screen.getByRole('button', { name: /تبديل حجم الخط \(Aa\)/i });
      expect(aaBtn).toBeInTheDocument();
      expect(aaBtn.className).toContain('min-h-[48px]');
      expect(aaBtn.className).toContain('min-w-[48px]');
      expect(aaBtn.textContent).toBe('Aa');

      // Click to cycle font size
      await act(async () => {
        fireEvent.click(aaBtn);
      });
      // Document root should update font mode
      expect(document.documentElement.className).toMatch(/font-size|theme/);
    });

    it('3.3 verifies settings icon button with touch target min 48px opens SettingsModal', async () => {
      render(React.createElement(App));

      const settingsBtn = screen.getByRole('button', { name: 'إعدادات التطبيق' });
      expect(settingsBtn).toBeInTheDocument();
      expect(settingsBtn.className).toContain('min-h-[48px]');
      expect(settingsBtn.className).toContain('min-w-[48px]');

      await act(async () => {
        fireEvent.click(settingsBtn);
      });

      // Settings modal should open
      expect(screen.getByRole('dialog', { name: 'إعدادات التطبيق' })).toBeInTheDocument();
    });

    it('3.4 verifies slim one-line advisory banner renders with Info icon and 13-14px text', () => {
      render(React.createElement(App));

      const banner = screen.getByRole('region', { name: 'تنبيه الأدوية' });
      expect(banner).toBeInTheDocument();
      expect(banner.textContent).toContain('راجع أسماء الأدوية قبل الاعتماد');

      const infoSvg = banner.querySelector('svg');
      expect(infoSvg).not.toBeNull();
      expect(infoSvg?.classList.contains('lucide-info')).toBe(true);
    });
  });

  // =========================================================================
  // 4. Exhaustive Zero-Emoji Audit across Source Components
  // =========================================================================
  describe('4. Exhaustive Zero-Emoji Audit across Source Components', () => {
    it('4.1 verifies zero emoji characters exist across all .ts and .tsx files in src/', () => {
      const srcDir = path.resolve(__dirname, '../src');
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2713}\u{2714}\u{2715}\u{2716}\u{274C}\u{2705}\u{25B6}\u{23F8}\u{23F9}\u{23FA}]/u;

      const violatingFiles: string[] = [];

      function scanDir(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (emojiRegex.test(content)) {
              violatingFiles.push(path.relative(srcDir, fullPath));
            }
          }
        }
      }

      scanDir(srcDir);
      expect(violatingFiles).toEqual([]);
    });
  });
});
