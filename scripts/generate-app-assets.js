/**
 * Standalone pure Node.js asset generator for Dalili Medication Guide.
 * Generates:
 * 1. Adaptive Android launcher icons (ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png)
 * 2. Vector foreground & background XML drawables
 * 3. Light & Dark splash screens across Android drawable densities
 * 4. PWA Web icons (public/icon-192.png, public/icon-512.png)
 *
 * Uses built-in node:zlib, node:fs, node:path without external dependencies.
 */

import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// CRC32 table for PNG chunk checksums
const crcTable = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

/**
 * Creates an RGBA PNG buffer from a pixel generator function.
 * pixelFn(x, y, width, height) => [r, g, b, a] (0-255)
 */
function createPngRgba(width, height, pixelFn) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const rowLen = 1 + width * 4;
  const raw = Buffer.alloc(height * rowLen);

  for (let y = 0; y < height; y++) {
    const offset = y * rowLen;
    raw[offset] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 4;
      const [r, g, b, a] = pixelFn(x, y, width, height);
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }

  const idat = pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 }));
  const iend = pngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), idat, iend]);
}

/**
 * Render prescription sheet with capsule symbol on a canvas.
 * Handles both light mode and dark mode palettes.
 */
function renderPrescriptionIcon(x, y, width, height, isDark = false, isForegroundOnly = false, isRound = false) {
  const cx = width / 2;
  const cy = height / 2;
  const size = Math.min(width, height);

  // Background check
  let bgR = 0, bgG = 109, bgB = 119, bgA = 255; // Teal #006D77
  if (isDark) {
    bgR = 14; bgG = 21; bgB = 23; // Dark #0E1517
  }

  if (isForegroundOnly) {
    bgA = 0; // Transparent background for adaptive foreground
  } else if (isRound) {
    const distFromCenter = Math.hypot(x - cx, y - cy);
    const radius = size * 0.48;
    if (distFromCenter > radius) {
      return [0, 0, 0, 0];
    }
  }

  // Current pixel defaults to background
  let [r, g, b, a] = [bgR, bgG, bgB, bgA];

  // Prescription Sheet Dimensions
  // If foreground-only, scale to 66% safe zone of 108dp adaptive specification
  const scale = isForegroundOnly ? 0.38 : (isRound ? 0.50 : 0.54);
  const sheetW = size * scale;
  const sheetH = sheetW * 1.30;

  const sheetLeft = cx - sheetW / 2;
  const sheetRight = cx + sheetW / 2;
  const sheetTop = cy - sheetH / 2;
  const sheetBottom = cy + sheetH / 2;

  // Check if inside prescription sheet bounding box
  if (x >= sheetLeft && x <= sheetRight && y >= sheetTop && y <= sheetBottom) {
    const foldSize = sheetW * 0.28;
    const isFoldRegion = (x >= sheetRight - foldSize) && (y <= sheetTop + foldSize);
    const foldCutoff = (x - (sheetRight - foldSize)) + (sheetTop + foldSize - y) > foldSize;

    if (isFoldRegion && foldCutoff) {
      // Outside folded corner: retains background
    } else {
      // Inside paper sheet
      if (isDark) {
        r = 22; g = 33; b = 36; a = 255; // Dark surface #162124
      } else {
        r = 255; g = 255; b = 255; a = 255; // Clean White #FFFFFF
      }

      // Check folded flap triangle
      if (isFoldRegion && !foldCutoff) {
        if (isDark) {
          r = 29; g = 43; b = 47; // #1D2B2F
        } else {
          r = 226; g = 232; b = 240; // Slate-200 #E2E8F0
        }
      }

      // Document ruled lines (subtle medical notes)
      const lineH = Math.max(1, Math.round(size * 0.015));
      const lineLeft = sheetLeft + sheetW * 0.16;
      const lineRight = sheetRight - sheetW * 0.16;
      const foldLineRight = sheetRight - foldSize - sheetW * 0.05;

      const line1Y = sheetTop + sheetH * 0.18;
      const line2Y = sheetTop + sheetH * 0.26;
      const line3Y = sheetBottom - sheetH * 0.22;
      const line4Y = sheetBottom - sheetH * 0.14;

      const isLine1 = (y >= line1Y && y < line1Y + lineH && x >= lineLeft && x <= foldLineRight);
      const isLine2 = (y >= line2Y && y < line2Y + lineH && x >= lineLeft && x <= foldLineRight);
      const isLine3 = (y >= line3Y && y < line3Y + lineH && x >= lineLeft && x <= lineRight);
      const isLine4 = (y >= line4Y && y < line4Y + lineH && x >= lineLeft && x <= lineRight * 0.85);

      if (isLine1 || isLine2 || isLine3 || isLine4) {
        if (isDark) {
          r = 45; g = 62; b = 68; // Dark muted line
        } else {
          r = 203; g = 213; b = 225; // #CBD5E1
        }
      }

      // Center Capsule Symbol
      const capCy = cy + sheetH * 0.04;
      const capLen = sheetW * 0.62;
      const capR = sheetH * 0.13;
      const capLeft = cx - capLen / 2;
      const capRight = cx + capLen / 2;

      const cdx = x - cx;
      const cdy = y - capCy;

      let inCapsule = false;
      if (Math.abs(cdy) <= capR) {
        if (x >= capLeft + capR && x <= capRight - capR) {
          inCapsule = true;
        } else if (x < capLeft + capR && Math.hypot(x - (capLeft + capR), cdy) <= capR) {
          inCapsule = true;
        } else if (x > capRight - capR && Math.hypot(x - (capRight - capR), cdy) <= capR) {
          inCapsule = true;
        }
      }

      if (inCapsule) {
        // Divider line in center
        const dividerWidth = Math.max(1, Math.round(size * 0.015));
        if (Math.abs(cdx) <= dividerWidth / 2) {
          r = 29; g = 53; b = 87; // Dark Slate #1D3557
        } else if (cdx < 0) {
          // Left half: Brand Teal #006D77 (or glowing #3DB8C4 in dark mode)
          if (isDark) {
            r = 61; g = 184; b = 196; // Teal #3DB8C4
          } else {
            r = 0; g = 109; b = 119; // Deep Teal #006D77
          }
        } else {
          // Right half: Warm Amber #F59E0B
          r = 245; g = 158; b = 11;
        }
      }
    }
  }

  return [r, g, b, a];
}

/**
 * Render Splash Screen.
 * Places a prominent centered medical logo on light #006D77 or dark #0E1517 background.
 */
function renderSplashScreen(x, y, width, height, isDark = false) {
  const cx = width / 2;
  const cy = height / 2;
  const baseDim = Math.min(width, height);

  // Background
  let [r, g, b, a] = isDark ? [14, 21, 23, 255] : [0, 109, 119, 255];

  // Subtle circular emblem halo
  const haloRadius = baseDim * 0.28;
  const dist = Math.hypot(x - cx, y - cy);
  if (dist <= haloRadius) {
    if (isDark) {
      // Glow #162124
      r = 22; g = 33; b = 36;
    } else {
      // Slightly lighter teal emblem halo #087F8A
      r = 8; g = 127; b = 138;
    }
  }

  // Draw logo within halo
  const logoSize = baseDim * 0.44;
  const logoLeft = cx - logoSize / 2;
  const logoTop = cy - logoSize / 2;

  if (x >= logoLeft && x < logoLeft + logoSize && y >= logoTop && y < logoTop + logoSize) {
    const lx = x - logoLeft;
    const ly = y - logoTop;
    const [lr, lg, lb, la] = renderPrescriptionIcon(lx, ly, logoSize, logoSize, isDark, true, false);
    if (la > 0) {
      r = lr; g = lg; b = lb; a = la;
    }
  }

  return [r, g, b, a];
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function main() {
  console.log('====================================================');
  console.log(' Dalili Medication Guide - App Asset Generator');
  console.log('====================================================\n');

  const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

  // 1. Android Adaptive Launcher Icon XML Configurations
  console.log('[1/5] Generating Android Adaptive Icon XML configurations...');

  // values/ic_launcher_background.xml
  const valuesDir = path.join(resDir, 'values');
  ensureDir(valuesDir);
  const backgroundXml = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#006D77</color>\n</resources>\n`;
  fs.writeFileSync(path.join(valuesDir, 'ic_launcher_background.xml'), backgroundXml);

  // drawable/ic_launcher_background.xml
  const drawableDir = path.join(resDir, 'drawable');
  ensureDir(drawableDir);
  const drawableBgXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#006D77"
        android:pathData="M0,0h108v108h-108z" />
</vector>
`;
  fs.writeFileSync(path.join(drawableDir, 'ic_launcher_background.xml'), drawableBgXml);

  // drawable-v24/ic_launcher_foreground.xml (Android Vector Drawable of prescription sheet with capsule)
  const drawableV24Dir = path.join(resDir, 'drawable-v24');
  ensureDir(drawableV24Dir);
  const foregroundXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <!-- Prescription Paper Sheet with folded corner -->
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M35,26 L63,26 L73,36 L73,82 C73,84.2 71.2,86 69,86 L35,86 C32.8,86 31,84.2 31,82 L31,30 C31,27.8 32.8,26 35,26 Z" />
    <!-- Folded Corner Flap -->
    <path
        android:fillColor="#E2E8F0"
        android:pathData="M63,26 L63,36 L73,36 Z" />
    <!-- Document Lines -->
    <path
        android:strokeColor="#CBD5E1"
        android:strokeWidth="1.5"
        android:strokeLineCap="round"
        android:pathData="M37,33 L58,33 M37,74 L67,74 M37,78 L57,78" />
    <!-- Prescription Capsule: Left Half (Teal #006D77) -->
    <path
        android:fillColor="#006D77"
        android:pathData="M44,48 C44,44.7 46.7,42 50,42 L54,42 L54,58 L50,58 C46.7,58 44,55.3 44,52 Z" />
    <!-- Prescription Capsule: Right Half (Amber #F59E0B) -->
    <path
        android:fillColor="#F59E0B"
        android:pathData="M54,42 L58,42 C61.3,42 64,44.7 64,48 L64,52 C64,55.3 61.3,58 58,58 L54,58 Z" />
    <!-- Capsule Divider Line -->
    <path
        android:strokeColor="#1D3557"
        android:strokeWidth="1.5"
        android:pathData="M54,42 L54,58" />
</vector>
`;
  fs.writeFileSync(path.join(drawableV24Dir, 'ic_launcher_foreground.xml'), foregroundXml);
  console.log('   ✓ values/ic_launcher_background.xml (#006D77)');
  console.log('   ✓ drawable/ic_launcher_background.xml');
  console.log('   ✓ drawable-v24/ic_launcher_foreground.xml');

  // 2. Android Mipmap Launcher Icons (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
  console.log('\n[2/5] Generating Android Mipmap Icons across densities...');
  const mipmapDensities = [
    { name: 'mdpi', size: 48, fgSize: 108 },
    { name: 'hdpi', size: 72, fgSize: 162 },
    { name: 'xhdpi', size: 96, fgSize: 216 },
    { name: 'xxhdpi', size: 144, fgSize: 324 },
    { name: 'xxxhdpi', size: 192, fgSize: 432 },
  ];

  for (const density of mipmapDensities) {
    const dir = path.join(resDir, `mipmap-${density.name}`);
    ensureDir(dir);

    // ic_launcher.png (square/squircle)
    const squarePng = createPngRgba(density.size, density.size, (x, y, w, h) =>
      renderPrescriptionIcon(x, y, w, h, false, false, false)
    );
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), squarePng);

    // ic_launcher_round.png (round)
    const roundPng = createPngRgba(density.size, density.size, (x, y, w, h) =>
      renderPrescriptionIcon(x, y, w, h, false, false, true)
    );
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), roundPng);

    // ic_launcher_foreground.png (foreground on transparent)
    const fgPng = createPngRgba(density.fgSize, density.fgSize, (x, y, w, h) =>
      renderPrescriptionIcon(x, y, w, h, false, true, false)
    );
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), fgPng);

    console.log(`   ✓ mipmap-${density.name}: ic_launcher (${density.size}x${density.size}), round, fg (${density.fgSize}x${density.fgSize})`);
  }

  // 3. PWA Web Icons in public/
  console.log('\n[3/5] Generating PWA Icons in public/...');
  const publicDir = path.join(projectRoot, 'public');
  ensureDir(publicDir);

  const icon192 = createPngRgba(192, 192, (x, y, w, h) =>
    renderPrescriptionIcon(x, y, w, h, false, false, false)
  );
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);

  const icon512 = createPngRgba(512, 512, (x, y, w, h) =>
    renderPrescriptionIcon(x, y, w, h, false, false, false)
  );
  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);
  console.log('   ✓ public/icon-192.png');
  console.log('   ✓ public/icon-512.png');

  // 4. Android Splash Screens (Light & Dark)
  console.log('\n[4/5] Generating Light & Dark Splash Screens...');

  // Default drawable/splash.png (light) and splash_dark.png (dark)
  const defaultLightSplash = createPngRgba(480, 800, (x, y, w, h) => renderSplashScreen(x, y, w, h, false));
  const defaultDarkSplash = createPngRgba(480, 800, (x, y, w, h) => renderSplashScreen(x, y, w, h, true));

  fs.writeFileSync(path.join(drawableDir, 'splash.png'), defaultLightSplash);
  fs.writeFileSync(path.join(drawableDir, 'splash_dark.png'), defaultDarkSplash);

  // drawable-night/splash.png
  const drawableNightDir = path.join(resDir, 'drawable-night');
  ensureDir(drawableNightDir);
  fs.writeFileSync(path.join(drawableNightDir, 'splash.png'), defaultDarkSplash);

  // Density-specific splash screens
  const splashDensities = [
    { name: 'mdpi', portW: 320, portH: 480, landW: 480, landH: 320 },
    { name: 'hdpi', portW: 480, portH: 800, landW: 800, landH: 480 },
    { name: 'xhdpi', portW: 720, portH: 1280, landW: 1280, landH: 720 },
    { name: 'xxhdpi', portW: 960, portH: 1600, landW: 1600, landH: 960 },
    { name: 'xxxhdpi', portW: 1280, portH: 1920, landW: 1920, landH: 1280 },
  ];

  for (const s of splashDensities) {
    // Portrait (Light)
    const portDir = path.join(resDir, `drawable-port-${s.name}`);
    ensureDir(portDir);
    const portLight = createPngRgba(s.portW, s.portH, (x, y, w, h) => renderSplashScreen(x, y, w, h, false));
    fs.writeFileSync(path.join(portDir, 'splash.png'), portLight);

    // Landscape (Light)
    const landDir = path.join(resDir, `drawable-land-${s.name}`);
    ensureDir(landDir);
    const landLight = createPngRgba(s.landW, s.landH, (x, y, w, h) => renderSplashScreen(x, y, w, h, false));
    fs.writeFileSync(path.join(landDir, 'splash.png'), landLight);

    // Portrait (Dark - drawable-port-night-*)
    const portNightDir = path.join(resDir, `drawable-port-night-${s.name}`);
    ensureDir(portNightDir);
    const portDark = createPngRgba(s.portW, s.portH, (x, y, w, h) => renderSplashScreen(x, y, w, h, true));
    fs.writeFileSync(path.join(portNightDir, 'splash.png'), portDark);

    // Landscape (Dark - drawable-land-night-*)
    const landNightDir = path.join(resDir, `drawable-land-night-${s.name}`);
    ensureDir(landNightDir);
    const landDark = createPngRgba(s.landW, s.landH, (x, y, w, h) => renderSplashScreen(x, y, w, h, true));
    fs.writeFileSync(path.join(landNightDir, 'splash.png'), landDark);

    console.log(`   ✓ drawable-port-${s.name} (${s.portW}x${s.portH}) & land (${s.landW}x${s.landH}) [Light & Dark]`);
  }

  // 5. Update values-night/styles.xml with splash_dark background
  console.log('\n[5/5] Updating values-night/styles.xml with dark splash theme...');
  const valuesNightDir = path.join(resDir, 'values-night');
  ensureDir(valuesNightDir);
  const stylesNightXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="android:statusBarColor">#0E1517</item>
        <item name="android:navigationBarColor">#162124</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash_dark</item>
    </style>
</resources>
`;
  fs.writeFileSync(path.join(valuesNightDir, 'styles.xml'), stylesNightXml);
  console.log('   ✓ values-night/styles.xml updated with splash_dark');

  console.log('\n====================================================');
  console.log(' All App Assets Successfully Generated!');
  console.log('====================================================');
}

main().catch(err => {
  console.error('Fatal error generating assets:', err);
  process.exit(1);
});
