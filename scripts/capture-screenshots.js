/**
 * Offline headless Chrome screenshot capture suite for Dalili Medication Guide.
 * Captures the complete 84-combination matrix:
 * 2 viewports (360x800, 320x640)
 * x 2 theme modes (light, dark)
 * x 3 font sizes (normal, large, extra-large)
 * x 7 screens (home, medicine_result, prescription_result, unclear_photo, medicines, history, settings)
 * = 84 screenshots total.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const distIndex = path.join(projectRoot, 'dist', 'index.html');
const screenshotsDir = path.join(projectRoot, 'screenshots');
const tempUserDataDir = path.join(projectRoot, '.chrome_headless_temp');

if (!fs.existsSync(distIndex)) {
  console.error('Error: dist/index.html not found. Run npm run build first.');
  process.exit(1);
}

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const viewports = [
  { name: '360x800', width: 360, height: 800 },
  { name: '320x640', width: 320, height: 640 },
];

const themes = ['light', 'dark'];
const fontSizes = ['normal', 'large', 'extra-large'];

const screens = [
  { id: 'home', label: 'Home Screen' },
  { id: 'medicine_result', label: 'Medicine Result' },
  { id: 'prescription_result', label: 'Prescription Result (with Low-Confidence Item)' },
  { id: 'unclear_photo', label: 'Unclear Photo Error' },
  { id: 'medicines', label: 'My Medicines (أدويتي)' },
  { id: 'history', label: 'Scan History (السجل)' },
  { id: 'settings', label: 'Settings Modal' },
];

async function runScreenshotSuite() {
  console.log('======================================================================');
  console.log(' Dalili Medication Guide - 84-Combination Screenshot Suite (F48)');
  console.log('======================================================================\n');
  console.log(`Chrome Binary:  ${chromePath}`);
  console.log(`Target Index:   ${distIndex}`);
  console.log(`Output Folder:  ${screenshotsDir}\n`);

  const baseUrl = 'file:///' + distIndex.replace(/\\/g, '/');
  let capturedCount = 0;
  let errorCount = 0;
  const results = [];

  for (const vp of viewports) {
    for (const theme of themes) {
      for (const fontSize of fontSizes) {
        for (const scr of screens) {
          const fileName = `${scr.id}__${theme}__${fontSize}__${vp.name}.png`;
          const outputPath = path.join(screenshotsDir, fileName);

          const pageUrl = `${baseUrl}?mock=${scr.id}&theme=${theme}&fontSize=${fontSize}&mockWidth=${vp.width}&viewport=${vp.name}`;

          try {
            execFileSync(
              chromePath,
              [
                '--headless=new',
                '--disable-gpu',
                '--no-sandbox',
                '--disable-web-security',
                '--allow-file-access-from-files',
                '--force-device-scale-factor=1',
                '--hide-scrollbars',
                `--window-size=${vp.width},${vp.height}`,
                `--user-data-dir=${tempUserDataDir}`,
                `--screenshot=${outputPath}`,
                pageUrl,
              ],
              {
                stdio: ['ignore', 'pipe', 'pipe'],
                encoding: 'utf8',
                timeout: 15000,
              }
            );

            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
              const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(1);
              capturedCount++;
              results.push({
                file: fileName,
                viewport: vp.name,
                theme,
                fontSize,
                screen: scr.id,
                sizeKb,
                status: 'OK',
              });
              process.stdout.write(`\r  [${capturedCount}/84] Captured: ${fileName} (${sizeKb} KB)`);
            } else {
              errorCount++;
              results.push({
                file: fileName,
                viewport: vp.name,
                theme,
                fontSize,
                screen: scr.id,
                status: 'FAIL_EMPTY',
              });
              console.error(`\n  [FAIL] Empty or missing screenshot: ${fileName}`);
            }
          } catch (err) {
            errorCount++;
            results.push({
              file: fileName,
              viewport: vp.name,
              theme,
              fontSize,
              screen: scr.id,
              status: 'ERROR',
              error: err.message,
            });
            console.error(`\n  [ERROR] Failed capturing ${fileName}:`, err.message);
          }
        }
      }
    }
  }

  // Cleanup temp Chrome user data directory
  if (fs.existsSync(tempUserDataDir)) {
    try {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error on Windows file lock
    }
  }

  console.log('\n\n======================================================================');
  console.log(` Screenshot Matrix Execution Summary:`);
  console.log(` Total Combinations Attempted: 84`);
  console.log(` Successfully Captured:        ${capturedCount}`);
  console.log(` Failed:                       ${errorCount}`);
  console.log('======================================================================\n');

  if (errorCount > 0) {
    console.error('Screenshot suite completed with failures.');
    process.exit(1);
  }

  console.log('All 84 screenshots captured successfully without errors.');
}

runScreenshotSuite().catch((err) => {
  console.error('Fatal screenshot runner failure:', err);
  process.exit(1);
});
