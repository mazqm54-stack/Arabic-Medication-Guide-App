import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  getStoredThemePreference,
  setStoredThemePreference,
  applyThemeToDOM,
  isDarkMode,
  initTheme,
  THEME_STORAGE_KEY,
} from '../src/services/themeStorage';
import { SettingsModal } from '../src/components/SettingsModal';
// @ts-expect-error - tailwind config is raw JS
import tailwindConfig from '../tailwind.config.js';

describe('Milestone 2: Dark Mode Tokens, Theming & Android System Bars Synchronization', () => {
  const projectRoot = path.resolve(__dirname, '..');

  // Helper for WCAG 2.1 relative luminance and contrast ratio calculations
  function hexToRgb(hex: string): [number, number, number] {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return [r, g, b];
  }

  function channelLuminance(value: number): number {
    const sRGB = value / 255;
    return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(hex: string): number {
    const [r, g, b] = hexToRgb(hex);
    return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
  }

  function calculateContrastRatio(color1: string, color2: string): number {
    const l1 = relativeLuminance(color1);
    const l2 = relativeLuminance(color2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

    beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    // Ensure clean meta theme-color tag
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#006D77';
      document.head.appendChild(meta);
    } else {
      meta.content = '#006D77';
    }

    // Default matchMedia mock in jsdom
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Tailwind Configuration & Color Palette Tokens', () => {
    it('verifies tailwind.config.js enables darkMode using the "class" strategy', () => {
      expect(tailwindConfig.darkMode).toBe('class');
    });

    it('verifies exact dark palette tokens match Milestone 2 specifications', () => {
      const darkColors = tailwindConfig.theme.extend.colors.dark;
      expect(darkColors).toBeDefined();
      expect(darkColors.bg.toLowerCase()).toBe('#0e1517');
      expect(darkColors.surface.toLowerCase()).toBe('#162124');
      expect(darkColors['surface-2'].toLowerCase()).toBe('#1d2b2f');
      expect(darkColors.text.toLowerCase()).toBe('#e6eef0');
      expect(darkColors.muted.toLowerCase()).toBe('#9fb3b8');
      expect(darkColors.primary.toLowerCase()).toBe('#3db8c4');
      expect(darkColors.warning.toLowerCase()).toBe('#3a2e12');
    });

    it('verifies flat dark color aliases exist in tailwind.config.js for utility class compatibility', () => {
      const colors = tailwindConfig.theme.extend.colors;
      expect(colors['dark-bg'].toLowerCase()).toBe('#0e1517');
      expect(colors['dark-surface'].toLowerCase()).toBe('#162124');
      expect(colors['dark-surface-2'].toLowerCase()).toBe('#1d2b2f');
      expect(colors['dark-text'].toLowerCase()).toBe('#e6eef0');
      expect(colors['dark-muted'].toLowerCase()).toBe('#9fb3b8');
      expect(colors['dark-primary'].toLowerCase()).toBe('#3db8c4');
      expect(colors['dark-warning'].toLowerCase()).toBe('#3a2e12');
    });

    it('verifies src/index.css specifies dark mode CSS variables and button overrides', () => {
      const cssContent = fs.readFileSync(path.join(projectRoot, 'src', 'index.css'), 'utf8');
      expect(cssContent).toContain('color-scheme: dark;');
      expect(cssContent).toContain('--color-bg: #0E1517;');
      expect(cssContent).toContain('--color-surface: #162124;');
      expect(cssContent).toContain('--color-surface-2: #1D2B2F;');
      expect(cssContent).toContain('--color-text: #E6EEF0;');
      expect(cssContent).toContain('--color-text-muted: #9FB3B8;');
      expect(cssContent).toContain('--color-primary: #3DB8C4;');
      expect(cssContent).toContain('--color-warning-box: #3A2E12;');

      // Verify .btn-primary has dark mode styling with dark text on primary button
      expect(cssContent).toContain('dark:bg-[#3DB8C4]');
      expect(cssContent).toContain('dark:text-[#0E1517]');
    });
  });

  describe('2. Zero Startup Theme Flash & index.html Setup', () => {
    const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');

    it('verifies index.html has synchronous theme script in <head> before page rendering', () => {
      expect(indexHtml).toContain('<script>');
      expect(indexHtml).toContain("localStorage.getItem('dalili_theme_preference')");
      expect(indexHtml).toContain("window.matchMedia('(prefers-color-scheme: dark)')");
      expect(indexHtml).toContain("document.documentElement.classList.add('dark')");
      expect(indexHtml).toContain("document.documentElement.classList.remove('dark')");
    });

    it('verifies index.html <body> includes dark mode background and text classes', () => {
      expect(indexHtml).toMatch(/<body[^>]*dark:bg-\[#0E1517\]/);
      expect(indexHtml).toMatch(/<body[^>]*dark:text-\[#E6EEF0\]/);
    });

    it('verifies index.html specifies default meta theme-color', () => {
      expect(indexHtml).toContain('<meta name="theme-color"');
    });
  });

  describe('3. Theme Storage Service & Preference Logic', () => {
    it('verifies getStoredThemePreference defaults to "system" when storage is empty', () => {
      expect(getStoredThemePreference()).toBe('system');
    });

    it('verifies setStoredThemePreference persists "dark", "light", and "system"', () => {
      setStoredThemePreference('dark');
      expect(getStoredThemePreference()).toBe('dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

      setStoredThemePreference('light');
      expect(getStoredThemePreference()).toBe('light');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

      setStoredThemePreference('system');
      expect(getStoredThemePreference()).toBe('system');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    });

    it('verifies getStoredThemePreference safely falls back to "system" on corrupted values', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'invalid_mode_value');
      expect(getStoredThemePreference()).toBe('system');
    });

    it('verifies isDarkMode correctly identifies dark mode state', () => {
      expect(isDarkMode('dark')).toBe(true);
      expect(isDarkMode('light')).toBe(false);

      // Test system query fallback
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(isDarkMode('system')).toBe(true);
    });

    it('verifies applyThemeToDOM updates documentElement class and meta theme-color', () => {
      applyThemeToDOM('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      const metaDark = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
      expect(metaDark.content.toLowerCase()).toBe('#0e1517');

      applyThemeToDOM('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      const metaLight = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
      expect(metaLight.content.toLowerCase()).toBe('#006d77');
    });

    it('verifies initTheme registers system preference listener and applies initial theme', () => {
      const addListenerSpy = vi.fn();
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: addListenerSpy,
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      setStoredThemePreference('system');
      const cleanup = initTheme();
      expect(addListenerSpy).toHaveBeenCalled();
      cleanup();
    });
  });

  describe('4. WCAG AAA Contrast Calculations & Dark Mode Button Invariant', () => {
    const DARK_BG = '#0E1517';
    const DARK_TEXT = '#E6EEF0';
    const DARK_MUTED = '#9FB3B8';
    const WARNING_BG = '#3A2E12';
    const WARNING_TEXT = '#F5D58A';
    const PRIMARY_TEAL = '#3DB8C4';
    const WHITE_TEXT = '#FFFFFF';

    it('verifies main text #E6EEF0 on dark bg #0E1517 satisfies WCAG AAA (>= 7.0:1)', () => {
      const ratio = calculateContrastRatio(DARK_TEXT, DARK_BG);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
      expect(ratio).toBeCloseTo(15.69, 1);
    });

    it('verifies muted text #9FB3B8 on dark bg #0E1517 satisfies WCAG AAA (>= 7.0:1)', () => {
      const ratio = calculateContrastRatio(DARK_MUTED, DARK_BG);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
      expect(ratio).toBeCloseTo(8.45, 1);
    });

    it('verifies warning text #F5D58A on warning box #3A2E12 satisfies WCAG AAA (>= 7.0:1)', () => {
      const ratio = calculateContrastRatio(WARNING_TEXT, WARNING_BG);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
      expect(ratio).toBeCloseTo(9.38, 1);
    });

    it('verifies dark text #0E1517 on primary button #3DB8C4 satisfies WCAG AAA (>= 7.0:1)', () => {
      const ratio = calculateContrastRatio(DARK_BG, PRIMARY_TEAL);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
      expect(ratio).toBeCloseTo(7.78, 1);
    });

    it('proves that white text #FFFFFF on primary button #3DB8C4 FAILS WCAG AA (only ~2.34:1), proving dark text is strictly mandatory', () => {
      const failRatio = calculateContrastRatio(WHITE_TEXT, PRIMARY_TEAL);
      expect(failRatio).toBeLessThan(4.5);
      expect(failRatio).toBeCloseTo(2.34, 1);
    });
  });

  describe('5. SettingsModal Component & Senior Accessibility', () => {
    it('does not render dialog when isOpen is false', () => {
      render(
        React.createElement(SettingsModal, {
          isOpen: false,
          onClose: () => {},
          currentTheme: 'system',
          onThemeChange: () => {},
          currentFontSize: 'normal',
          onFontSizeChange: () => {},
        })
      );
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders dialog with correct accessible attributes and 3 theme options', () => {
      const onThemeChange = vi.fn();
      const onFontSizeChange = vi.fn();
      const onClose = vi.fn();

      render(
        React.createElement(SettingsModal, {
          isOpen: true,
          onClose,
          currentTheme: 'system',
          onThemeChange,
          currentFontSize: 'normal',
          onFontSizeChange,
        })
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');

      // Theme options
      expect(screen.getByText('تلقائي')).toBeInTheDocument();
      expect(screen.getByText('فاتح')).toBeInTheDocument();
      expect(screen.getByText('داكن')).toBeInTheDocument();

      // Font size options
      expect(screen.getByText('عادي')).toBeInTheDocument();
      expect(screen.getByText('كبير')).toBeInTheDocument();
      expect(screen.getByText('كبير جداً')).toBeInTheDocument();

      // Interactions
      fireEvent.click(screen.getByText('داكن'));
      expect(onThemeChange).toHaveBeenCalledWith('dark');

      fireEvent.click(screen.getByText('كبير'));
      expect(onFontSizeChange).toHaveBeenCalledWith('large');

      // Close button
      const closeButtons = screen.getAllByRole('button', { name: /إغلاق/i });
      expect(closeButtons.length).toBeGreaterThan(0);
      fireEvent.click(closeButtons[0]);
      expect(onClose).toHaveBeenCalled();
    });

    it('verifies all interactive option touch targets meet minimum 48px/56px senior guidelines', () => {
      render(
        React.createElement(SettingsModal, {
          isOpen: true,
          onClose: () => {},
          currentTheme: 'dark',
          onThemeChange: () => {},
          currentFontSize: 'large',
          onFontSizeChange: () => {},
        })
      );

      // Find radio options
      const radios = screen.getAllByRole('radio');
      expect(radios.length).toBe(6);
      radios.forEach((radio) => {
        expect(radio.className).toContain('min-h-[56px]');
      });
    });
  });

  describe('6. Android System Bars XML Synchronization', () => {
    const lightStylesPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml');
    const nightStylesPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'values-night', 'styles.xml');

    it('verifies android/app/src/main/res/values/styles.xml exists with light status and nav bar colors', () => {
      expect(fs.existsSync(lightStylesPath)).toBe(true);
      const content = fs.readFileSync(lightStylesPath, 'utf8');

      // Status bar #006D77
      expect(content).toContain('<item name="android:statusBarColor">#006D77</item>');
      // Navigation bar #FFFFFF
      expect(content).toContain('<item name="android:navigationBarColor">#FFFFFF</item>');
      // Light status bar is false because #006D77 is dark teal
      expect(content).toContain('<item name="android:windowLightStatusBar">false</item>');
      // Light nav bar is true because #FFFFFF is light
      expect(content).toContain('<item name="android:windowLightNavigationBar">true</item>');
    });

    it('verifies android/app/src/main/res/values-night/styles.xml exists with dark status and nav bar colors', () => {
      expect(fs.existsSync(nightStylesPath)).toBe(true);
      const content = fs.readFileSync(nightStylesPath, 'utf8');

      // Status bar #0E1517 (dark background)
      expect(content).toContain('<item name="android:statusBarColor">#0E1517</item>');
      // Navigation bar #162124 (dark surface)
      expect(content).toContain('<item name="android:navigationBarColor">#162124</item>');
      // Light flags both false in dark mode
      expect(content).toContain('<item name="android:windowLightStatusBar">false</item>');
      expect(content).toContain('<item name="android:windowLightNavigationBar">false</item>');
    });
  });
});
