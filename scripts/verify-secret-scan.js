#!/usr/bin/env node

/**
 * Automated Secret Scanner for Dalili Medication Guide
 * Scans client source code ('src/') and production build ('dist/')
 * to guarantee ZERO secrets or client-side API key logic exist.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SCAN_DIRS = ['src', 'dist'];

// Patterns that MUST NOT exist in client source code or client build artifacts
const FORBIDDEN_RULES = [
  {
    name: 'Google Gemini API Key Pattern (AIza...)',
    regex: /AIza[0-9A-Za-z-_]{35}/g,
  },
  {
    name: 'Literal AIzaSy Prefix',
    regex: /AIzaSy[0-9A-Za-z-_]{5,}/g,
  },
  {
    name: 'Legacy API Key LocalStorage Identifier',
    regex: /dalili_gemini_api_key_v1/g,
  },
  {
    name: 'Obsolete ApiKeyModal Component Reference',
    regex: /ApiKeyModal/g,
  },
  {
    name: 'Obsolete apiKeyStorage Service Reference',
    regex: /apiKeyStorage/g,
  },
  {
    name: 'Direct Upstream Gemini Endpoint Call in Client',
    regex: /generativelanguage\.googleapis\.com/g,
  },
];

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }
  return arrayOfFiles;
}

function runSecretScan() {
  console.log('====================================================');
  console.log('DALILI MEDICATION GUIDE - ZERO-SECRET AUDIT SCAN');
  console.log('====================================================');

  let totalFilesScanned = 0;
  const violations = [];

  for (const dir of SCAN_DIRS) {
    const fullDirPath = path.join(projectRoot, dir);
    if (!fs.existsSync(fullDirPath)) {
      if (dir === 'dist') {
        console.warn(`[SecretScan] Warning: '${dir}' folder does not exist. Run 'npm run build' first for complete verification.`);
      }
      continue;
    }

    const files = getAllFiles(fullDirPath);
    for (const filePath of files) {
      // Skip binary image assets and fonts
      if (/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|eot)$/i.test(filePath)) {
        continue;
      }

      totalFilesScanned++;
      const relativePath = path.relative(projectRoot, filePath);
      const content = fs.readFileSync(filePath, 'utf8');

      for (const rule of FORBIDDEN_RULES) {
        rule.regex.lastIndex = 0;
        let match;
        while ((match = rule.regex.exec(content)) !== null) {
          // Calculate line number
          const upToMatch = content.substring(0, match.index);
          const lineNumber = upToMatch.split('\n').length;
          violations.push({
            rule: rule.name,
            file: relativePath,
            line: lineNumber,
            matchSnippet: match[0],
          });
        }
      }
    }
  }

  console.log(`Scanned ${totalFilesScanned} client files across: ${SCAN_DIRS.join(', ')}\n`);

  if (violations.length > 0) {
    console.error(`FAILED: Found ${violations.length} forbidden secret/legacy pattern(s):\n`);
    for (const v of violations) {
      console.error(`  - [${v.rule}] in ${v.file}:${v.line}`);
      console.error(`    Found: "${v.matchSnippet}"`);
    }
    console.error('\nImmediate Remediation Required: Remove secrets/references from client bundle.');
    process.exit(1);
  }

  console.log('PASSED: 0 secrets, 0 API key prompts, and 0 direct Google endpoints found in client!');
  console.log('All client code and build artifacts conform to the Zero-Secret mandate.\n');
  process.exit(0);
}

runSecretScan();
