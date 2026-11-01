import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Zero-Secret Client & Build Verification', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const srcDir = path.join(projectRoot, 'src');
  const distDir = path.join(projectRoot, 'dist');

  function getFilesRecursively(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getFilesRecursively(fullPath));
      } else if (!/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|eot)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const forbiddenPatterns = [
    { name: 'Google API Key Pattern', regex: /AIza[0-9A-Za-z-_]{35}/ },
    { name: 'Literal AIzaSy Prefix', regex: /AIzaSy/ },
    { name: 'Legacy LocalStorage Key', regex: /dalili_gemini_api_key_v1/ },
    { name: 'ApiKeyModal Component', regex: /ApiKeyModal/ },
    { name: 'apiKeyStorage Module', regex: /apiKeyStorage/ },
    { name: 'Direct Upstream Gemini Endpoint', regex: /generativelanguage\.googleapis\.com/ },
  ];

  it('guarantees src/ contains zero secrets or client API key storage logic', () => {
    const srcFiles = getFilesRecursively(srcDir);
    expect(srcFiles.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const relPath = path.relative(projectRoot, file);

      for (const { name, regex } of forbiddenPatterns) {
        if (regex.test(content)) {
          violations.push(`${name} found in ${relPath}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('guarantees dist/ contains zero secrets when build output exists', () => {
    if (!fs.existsSync(distDir)) {
      console.warn('[SecretScan] dist/ directory does not exist, skipping build output test.');
      return;
    }

    const distFiles = getFilesRecursively(distDir);
    const violations: string[] = [];

    for (const file of distFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const relPath = path.relative(projectRoot, file);

      for (const { name, regex } of forbiddenPatterns) {
        if (regex.test(content)) {
          violations.push(`${name} found in ${relPath}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
