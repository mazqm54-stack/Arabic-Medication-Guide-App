import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  getStoredFontSize,
  setStoredFontSize,
  applyFontSizeToDOM,
  FONT_SIZE_STORAGE_KEY,
} from '../src/services/preferencesStorage';
import { FontSizeToggle } from '../src/components/FontSizeToggle';
// @ts-expect-error - tailwind config is raw JS
import tailwindConfig from '../tailwind.config.js';

describe('Milestone 1: Typography, Readex Pro, Dynamic Rem Sizing & Touch Targets', () => {
  const projectRoot = path.resolve(__dirname, '..');

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  describe('1. Local Font Bundling ("Readex Pro")', () => {
    const fontsDir = path.join(projectRoot, 'src', 'assets', 'fonts');

    const expectedFonts = [
      { name: 'ReadexPro-Regular.woff2', weight: 400 },
      { name: 'ReadexPro-Medium.woff2', weight: 500 },
      { name: 'ReadexPro-SemiBold.woff2', weight: 600 },
      { name: 'ReadexPro-Bold.woff2', weight: 700 },
    ];

    it('verifies all 4 Readex Pro WOFF2 font files exist locally with valid WOFF2 magic headers', () => {
      expect(fs.existsSync(fontsDir)).toBe(true);

      for (const font of expectedFonts) {
        const fontPath = path.join(fontsDir, font.name);
        expect(fs.existsSync(fontPath)).toBe(true);

        const buffer = fs.readFileSync(fontPath);
        expect(buffer.length).toBeGreaterThan(100);

        // Valid WOFF2 magic bytes: 'wOF2' (0x77, 0x4F, 0x46, 0x32)
        const magic = buffer.subarray(0, 4).toString('ascii');
        expect(magic).toBe('wOF2');
      }
    });

    it('verifies index.html has zero external Google Fonts requests', () => {
      const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
      expect(indexHtml).not.toContain('fonts.googleapis.com');
      expect(indexHtml).not.toContain('fonts.gstatic.com');
      expect(indexHtml).not.toContain('family=Cairo');
      expect(indexHtml).not.toContain('family=Tajawal');
    });

    it('verifies src/index.css declares local @font-face for Readex Pro across all 4 weights', () => {
      const cssContent = fs.readFileSync(path.join(projectRoot, 'src', 'index.css'), 'utf8');

      expect(cssContent).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Readex Pro'[^}]*font-weight:\s*400/);
      expect(cssContent).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Readex Pro'[^}]*font-weight:\s*500/);
      expect(cssContent).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Readex Pro'[^}]*font-weight:\s*600/);
      expect(cssContent).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Readex Pro'[^}]*font-weight:\s*700/);

      expect(cssContent).toContain('./assets/fonts/ReadexPro-Regular.woff2');
      expect(cssContent).toContain('./assets/fonts/ReadexPro-Medium.woff2');
      expect(cssContent).toContain('./assets/fonts/ReadexPro-SemiBold.woff2');
      expect(cssContent).toContain('./assets/fonts/ReadexPro-Bold.woff2');
    });

    it('verifies tailwind.config.js configures sans and cairo alias to Readex Pro', () => {
      const sansFonts = tailwindConfig.theme.extend.fontFamily.sans;
      expect(sansFonts[0]).toContain('Readex Pro');

      const cairoAlias = tailwindConfig.theme.extend.fontFamily.cairo;
      expect(cairoAlias[0]).toContain('Readex Pro');
    });
  });

  describe('2. Dynamic Rem Root Font Sizing & 3 Selectable Levels', () => {
    it('verifies preferencesStorage defaults to "normal" (16px base font)', () => {
      expect(getStoredFontSize()).toBe('normal');
    });

    it('verifies preferencesStorage validates and persists all 3 font size levels', () => {
      setStoredFontSize('large');
      expect(getStoredFontSize()).toBe('large');
      expect(localStorage.getItem(FONT_SIZE_STORAGE_KEY)).toBe('large');

      setStoredFontSize('extra-large');
      expect(getStoredFontSize()).toBe('extra-large');
      expect(localStorage.getItem(FONT_SIZE_STORAGE_KEY)).toBe('extra-large');

      setStoredFontSize('normal');
      expect(getStoredFontSize()).toBe('normal');
      expect(localStorage.getItem(FONT_SIZE_STORAGE_KEY)).toBe('normal');
    });

    it('verifies preferencesStorage falls back to "normal" on corrupt or unknown values', () => {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, 'invalid_size_level');
      expect(getStoredFontSize()).toBe('normal');
    });

    it('verifies applyFontSizeToDOM updates root classes on documentElement', () => {
      applyFontSizeToDOM('normal');
      expect(document.documentElement.classList.contains('font-size-normal')).toBe(true);
      expect(document.documentElement.classList.contains('font-size-large')).toBe(false);

      applyFontSizeToDOM('large');
      expect(document.documentElement.classList.contains('font-size-large')).toBe(true);
      expect(document.documentElement.classList.contains('font-size-normal')).toBe(false);

      applyFontSizeToDOM('extra-large');
      expect(document.documentElement.classList.contains('font-size-extra-large')).toBe(true);
      expect(document.documentElement.classList.contains('font-size-large')).toBe(false);
    });

    it('verifies src/index.css contains dynamic root rem rules for normal (16px), large (19px), extra-large (23px)', () => {
      const cssContent = fs.readFileSync(path.join(projectRoot, 'src', 'index.css'), 'utf8');

      expect(cssContent).toMatch(/html\.font-size-normal[^{]*\{[^}]*font-size:\s*16px;[^}]*--touch-min:\s*48px;/s);
      expect(cssContent).toMatch(/html\.font-size-large[^{]*\{[^}]*font-size:\s*19px;[^}]*--touch-min:\s*56px;/s);
      expect(cssContent).toMatch(/html\.font-size-extra-large[^{]*\{[^}]*font-size:\s*23px;[^}]*--touch-min:\s*56px;/s);
    });

    it('verifies tailwind.config.js converts senior typography scale tokens to rem units', () => {
      const fontSizeConfig = tailwindConfig.theme.extend.fontSize;

      expect(fontSizeConfig['senior-xs'][0]).toBe('0.75rem');
      expect(fontSizeConfig['senior-sm'][0]).toBe('0.875rem');
      expect(fontSizeConfig['senior-base'][0]).toBe('1rem');
      expect(fontSizeConfig['senior-lg'][0]).toBe('1.1875rem');
      expect(fontSizeConfig['senior-xl'][0]).toBe('1.375rem');
      expect(fontSizeConfig['senior-2xl'][0]).toBe('1.625rem');
      expect(fontSizeConfig['senior-3xl'][0]).toBe('2rem');
    });

    it('verifies FontSizeToggle cycles through normal -> large -> extra-large -> normal', () => {
      const onToggle = vi.fn();
      const { rerender } = render(
        React.createElement(FontSizeToggle, { currentSize: 'normal', onToggle })
      );

      const button = screen.getByRole('button', { name: /تغيير حجم الخط/i });
      expect(button).toBeInTheDocument();
      expect(screen.getByText(/خط عادي/i)).toBeInTheDocument();

      fireEvent.click(button);
      expect(onToggle).toHaveBeenCalledWith('large');

      rerender(React.createElement(FontSizeToggle, { currentSize: 'large', onToggle }));
      expect(screen.getByText(/خط كبير/i)).toBeInTheDocument();

      fireEvent.click(button);
      expect(onToggle).toHaveBeenCalledWith('extra-large');

      rerender(React.createElement(FontSizeToggle, { currentSize: 'extra-large', onToggle }));
      expect(screen.getByText(/خط كبير جداً/i)).toBeInTheDocument();

      fireEvent.click(button);
      expect(onToggle).toHaveBeenCalledWith('normal');
    });
  });

  describe('3. Adaptive Touch Targets (48px / 56px)', () => {
    it('verifies custom matcher toHaveMinTouchTarget validates 48px base touch target', () => {
      const div48 = document.createElement('div');
      div48.className = 'min-h-[48px]';
      expect(div48).toHaveMinTouchTarget(48);

      const div56 = document.createElement('div');
      div56.className = 'min-h-[56px]';
      expect(div56).toHaveMinTouchTarget(48);
      expect(div56).toHaveMinTouchTarget(56);

      const divH12 = document.createElement('div');
      divH12.className = 'h-12';
      expect(divH12).toHaveMinTouchTarget(48);

      const divH14 = document.createElement('div');
      divH14.className = 'h-14';
      expect(divH14).toHaveMinTouchTarget(56);
    });

    it('verifies universal button touch target rule in src/index.css uses --touch-min with 48px fallback', () => {
      const cssContent = fs.readFileSync(path.join(projectRoot, 'src', 'index.css'), 'utf8');
      expect(cssContent).toMatch(/button,\s*\[role="button"\],[^}]*min-height:\s*var\(--touch-min,\s*48px\);/s);
    });

    it('verifies tailwind.config.js minHeight.touch is set to 48px', () => {
      expect(tailwindConfig.theme.extend.minHeight.touch).toBe('48px');
      expect(tailwindConfig.theme.extend.minHeight['touch-senior']).toBe('56px');
    });
  });
});
