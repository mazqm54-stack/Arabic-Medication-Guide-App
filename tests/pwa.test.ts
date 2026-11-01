import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('PWA Configuration and Assets', () => {
  it('has a valid manifest.webmanifest with Arabic RTL and required theme settings', () => {
    const manifestPath = path.resolve(__dirname, '../public/manifest.webmanifest');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw);

    expect(manifest.name).toBe('دليلي الدوائي');
    expect(manifest.short_name).toBe('دليلي الدوائي');
    expect(manifest.dir).toBe('rtl');
    expect(manifest.lang).toBe('ar');
    expect(manifest.theme_color).toBe('#006D77');
    expect(manifest.background_color).toBe('#F8F9FA');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  it('has public/sw.js with service worker caching logic', () => {
    const swPath = path.resolve(__dirname, '../public/sw.js');
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toContain('CACHE_NAME');
    expect(swContent).toContain('addEventListener');
  });

  it('has generated PWA icons icon-192.png and icon-512.png', () => {
    const icon192 = path.resolve(__dirname, '../public/icon-192.png');
    const icon512 = path.resolve(__dirname, '../public/icon-512.png');

    expect(fs.existsSync(icon192)).toBe(true);
    expect(fs.existsSync(icon512)).toBe(true);
    expect(fs.statSync(icon192).size).toBeGreaterThan(0);
    expect(fs.statSync(icon512).size).toBeGreaterThan(0);
  });
});
