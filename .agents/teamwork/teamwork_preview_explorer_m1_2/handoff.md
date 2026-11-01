# Milestone 1 (M1) Explorer Handoff: PWA Shell, Web App Manifest & Service Worker Offline Caching

## 1. Observation
1. **Authoritative Requirements in `ORIGINAL_REQUEST.md`**:
   - Lines 5, 13: Application name is "دليلي الدوائي" (My Medication Guide) in Arabic with full Right-to-Left (RTL) layout.
   - Line 14: High-contrast medical palette specifies Deep Teal (`#006D77`), Warm White (`#F8F9FA`), Clear Dark Slate text (`#1D3557`), and soft amber warning highlights (`#FEF3C7` / `#F59E0B` / `#92400E`).
   - Line 48: "Configured PWA with valid Web App Manifest (`manifest.webmanifest`), app icons, theme color, and Service Worker for offline application shell caching."
   - Lines 61-62: "PWA manifest and service worker register cleanly and pass PWA readiness criteria."
2. **Architecture and File Layout in `PROJECT.md`**:
   - Lines 14, 43-44: Feature 4 ("PWA Web App Manifest: `manifest.webmanifest` with `#006D77` theme, Arabic metadata, standalone") and Feature 5 ("Service Worker Shell Caching: `public/sw.js` for offline app shell caching") are designated for Milestone 1 (M1).
   - Lines 165-170: Layout requires `public/manifest.webmanifest`, `public/sw.js`, `public/icon-192.png`, and `public/icon-512.png`.
   - Lines 195: Layout requires `src/main.tsx` ("React DOM root and service worker registration").
   - Line 200: Layout requires `tests/pwa.test.ts` ("Manifest and service worker validation").
3. **Dispatch Instructions from Orchestrator**:
   - Specify `public/manifest.webmanifest` with Arabic title "دليلي الدوائي", short_name, `dir: "rtl"`, `lang: "ar"`, `display: "standalone"`, `theme_color: "#006D77"`, `background_color: "#F8F9FA"`, icons (192x192, 512x512).
   - Specify `public/sw.js` with Stale-While-Revalidate caching strategy for HTML app shell, CSS, fonts, and scripts.
   - Specify registration of service worker in `src/main.tsx` with offline fallback support.
   - Recommend concrete file content specifications for the Worker.
4. **Environment Check**:
   - Node.js v24.21.0, npm 11.19.0 running on Windows.
   - Pure Node.js PNG binary generation using built-in `zlib` was executed and successfully validated generating 192x192 (926 bytes) and 512x512 (3547 bytes) PNG files without external dependencies.

---

## 2. Logic Chain
1. **Manifest Configuration**:
   - Based on W3C Web App Manifest specification and Lighthouse PWA criteria, the manifest requires Arabic strings (`name: "دليلي الدوائي"`, `short_name: "دليلي الدوائي"`), `dir: "rtl"`, `lang: "ar"`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `theme_color: "#006D77"`, and `background_color: "#F8F9FA"`.
   - Android adaptive icon requirements necessitate supplying both `purpose: "any"` and `purpose: "maskable"` entries for `icon-192.png` and `icon-512.png`.
2. **Service Worker Strategy & Lifecycle**:
   - **Pre-caching on `install`**: Critical shell assets (`/`, `/index.html`, `/manifest.webmanifest`, `/icon-192.png`, `/icon-512.png`) must be cached immediately during `install`. Using resilient per-asset caching prevents an error in one non-critical file from aborting installation. Invoking `self.skipWaiting()` ensures the worker activates without waiting for existing tabs.
   - **Cache Cleanup on `activate`**: Iterating over `caches.keys()` and deleting any cache other than `CACHE_NAME` (`dalili-app-shell-v1`) guarantees clean upgrades when new versions are deployed. Calling `self.clients.claim()` immediately controls existing uncontrolled clients.
   - **Stale-While-Revalidate on `fetch`**:
     - *Filter non-GET*: Methods like POST (used when transmitting images to Gemini API) must bypass caching.
     - *Bypass External APIs*: Requests to `generativelanguage.googleapis.com` must be excluded so vision AI calls always execute directly over network.
     - *Bypass Dev Tooling*: Vite HMR and dev endpoints (`/@vite/`, `/@fs/`, `?t=`) must be passed through to preserve live hot-reloading during development.
     - *Execution*: Check cache with `caches.match(request)`. If cached, return immediately; concurrently fetch over network and update cache upon HTTP 200 or opaque CORS response (such as Google Fonts). If not cached, await network fetch. If network fails and request is a navigation request (`request.mode === 'navigate'`), return cached `/index.html` to load the SPA offline.
3. **Registration Architecture in `src/main.tsx`**:
   - Separating registration into a dedicated service (`src/services/swRegistration.ts`) enables decoupled unit testing in Vitest without polluting the React DOM root mount.
   - `src/main.tsx` registers the worker on `window.load` in browser environments, while skipping execution under Vitest (`process.env.NODE_ENV !== 'test'`).
   - Registration handles `updatefound` and `statechange` to broadcast a `pwa-update-available` custom event when a newer build is waiting.
4. **Offline State Management**:
   - `src/services/networkStatus.ts` provides `isOnline()` and `subscribeToNetworkStatus()`, enabling components to seamlessly track connectivity and surface friendly Arabic offline notifications while maintaining access to saved local scans.

---

## 3. Caveats
1. **Google Fonts External Caching**: Cairo and Tajawal fonts are fetched from `fonts.googleapis.com` and `fonts.gstatic.com`. These return opaque responses (HTTP status 0) under CORS. The service worker logic explicitly checks `networkResponse.type === 'opaque' || networkResponse.status === 200` to ensure font stylesheets and font binaries are cached offline.
2. **Gemini AI API Calls Require Network**: The Gemini 1.5 Flash Vision API cannot operate offline. When offline, camera analysis should notify the user kindly in Arabic, while the 5-item scan history (`localStorage`) and audio readout (on-device Web Speech API) remain fully functional offline.
3. **Localhost vs HTTPS**: Modern browsers only permit Service Worker registration on `localhost`, `127.0.0.1`, or over `https://`. Local testing during development on `http://localhost:5173` will register without SSL issues.

---

## 4. Conclusion & Concrete File Specifications

### 4.1. File: `public/manifest.webmanifest`
```json
{
  "name": "دليلي الدوائي",
  "short_name": "دليلي الدوائي",
  "description": "تطبيق دليلي الدوائي لمساعدة كبار السن على قراءة وفهم علب الأدوية بسهولة وبخط كبير وواضح مع الدعم الصوتي الكامل.",
  "lang": "ar",
  "dir": "rtl",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#006D77",
  "background_color": "#F8F9FA",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "categories": [
    "medical",
    "health",
    "accessibility"
  ]
}
```

---

### 4.2. File: `public/sw.js`
```javascript
/**
 * دليلي الدوائي (My Medication Guide) - Service Worker
 * Strategy: Stale-While-Revalidate for HTML app shell, CSS, JS, fonts, and images.
 * Provides resilient offline fallback and background cache updates.
 */

const CACHE_NAME = 'dalili-app-shell-v1';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png'
];

// Install: pre-cache critical app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[SW] Pre-caching ${asset} failed:`, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up outdated caches and claim existing clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate with offline navigation fallback
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Only intercept HTTP/HTTPS GET requests
  if (request.method !== 'GET') {
    return;
  }
  if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) {
    return;
  }

  const url = new URL(request.url);

  // 2. Bypass Gemini Vision API requests (always live network)
  if (url.hostname.includes('googleapis.com') && url.pathname.includes('/models/')) {
    return;
  }

  // 3. Bypass Vite development server internals
  if (
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/@fs') ||
    url.pathname.includes('__vite_ping') ||
    url.searchParams.has('t')
  ) {
    return;
  }

  // 4. Stale-While-Revalidate execution
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);

      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            (networkResponse.status === 200 || networkResponse.type === 'opaque')
          ) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(async (fetchError) => {
          // If navigation request and network failed, serve cached index.html
          if (request.mode === 'navigate') {
            const fallbackHtml = (await cache.match('/index.html')) || (await cache.match('/'));
            if (fallbackHtml) {
              return fallbackHtml;
            }
          }
          // If we had a cached response, it was served immediately; return it here to prevent rejection
          if (cachedResponse) {
            return cachedResponse;
          }
          // Graceful offline fallback response
          return new Response('محتوى غير متوفر دون اتصال بالإنترنت', {
            status: 503,
            statusText: 'Service Unavailable (Offline)',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });

      // Serve from cache immediately if present (Stale), otherwise wait for network (Revalidate)
      return cachedResponse || fetchPromise;
    })
  );
});
```

---

### 4.3. File: `src/services/swRegistration.ts`
```typescript
/**
 * Service Worker Registration and Lifecycle Controller
 */

export interface SWRegistrationCallbacks {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

export async function registerServiceWorker(
  callbacks: SWRegistrationCallbacks = {}
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  return new Promise((resolve) => {
    const handleRegister = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        if (callbacks.onSuccess) {
          callbacks.onSuccess(registration);
        }

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (
                installingWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                if (callbacks.onUpdate) {
                  callbacks.onUpdate(registration);
                }
                window.dispatchEvent(new CustomEvent('pwa-update-available'));
              }
            });
          }
        });

        resolve(registration);
      } catch (error) {
        if (callbacks.onError && error instanceof Error) {
          callbacks.onError(error);
        }
        resolve(null);
      }
    };

    if (document.readyState === 'complete') {
      handleRegister();
    } else {
      window.addEventListener('load', handleRegister);
    }
  });
}

export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      return registration.unregister();
    }
  }
  return false;
}
```

---

### 4.4. File: `src/services/networkStatus.ts`
```typescript
/**
 * Network connectivity monitoring for PWA offline state management
 */

export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

export function subscribeToNetworkStatus(
  onChange: (online: boolean) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => onChange(true);
  const handleOffline = () => onChange(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
```

---

### 4.5. File: `src/main.tsx`
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './services/swRegistration';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Automatically register service worker in browser environment
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  registerServiceWorker({
    onSuccess: (reg) => {
      console.log('[PWA] Service Worker registered with scope:', reg.scope);
    },
    onUpdate: () => {
      console.log('[PWA] New version ready for refresh.');
    },
    onError: (err) => {
      console.warn('[PWA] Service Worker registration failed:', err);
    }
  });
}
```

---

### 4.6. File: `scripts/generate-icons.js` (Zero-Dependency Icon Generator)
```javascript
/**
 * Generates public/icon-192.png and public/icon-512.png using Node.js built-in zlib.
 * No external dependencies required.
 * Palette: Deep Teal #006D77, Warm White #F8F9FA, Amber #F59E0B, Dark Slate #1D3557.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function createMedicationIconPng(size) {
  const width = size;
  const height = size;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLen = 1 + width * 3;
  const raw = Buffer.alloc(height * rowLen);
  
  // Capsule dimensions
  const capHalfWidth = width * 0.28;
  const capRadius = height * 0.16;
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    const offset = y * rowLen;
    raw[offset] = 0;
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 3;
      // Background: Deep Teal #006D77
      let r = 0, g = 109, b = 119;
      
      const dx = x - cx;
      const dy = y - cy;
      let inCapsule = false;
      const isRightSide = dx > 0;

      if (Math.abs(dy) <= capRadius) {
        if (Math.abs(dx) <= capHalfWidth - capRadius) {
          inCapsule = true;
        } else if (dx < 0 && Math.hypot(dx + (capHalfWidth - capRadius), dy) <= capRadius) {
          inCapsule = true;
        } else if (dx > 0 && Math.hypot(dx - (capHalfWidth - capRadius), dy) <= capRadius) {
          inCapsule = true;
        }
      }

      if (inCapsule) {
        if (Math.abs(dx) < 2) {
          // Capsule divider: Dark Slate #1D3557
          r = 29; g = 53; b = 87;
        } else if (isRightSide) {
          // Right half: Amber #F59E0B
          r = 245; g = 158; b = 11;
        } else {
          // Left half: Warm White #F8F9FA
          r = 248; g = 249; b = 250;
        }
      }

      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }

  const idat = chunk('IDAT', zlib.deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, chunk('IHDR', ihdr), idat, iend]);
}

const publicDir = path.resolve(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createMedicationIconPng(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createMedicationIconPng(512));
console.log('Successfully generated public/icon-192.png and public/icon-512.png');
```

---

### 4.7. File: `tests/pwa.test.ts` (Automated Verification Test Suite)
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { registerServiceWorker } from '../src/services/swRegistration';
import { isOnline, subscribeToNetworkStatus } from '../src/services/networkStatus';

describe('PWA Web App Manifest (public/manifest.webmanifest)', () => {
  const manifestPath = path.resolve(__dirname, '../public/manifest.webmanifest');

  it('manifest file exists and parses as valid JSON', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const content = fs.readFileSync(manifestPath, 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('contains mandatory Arabic title, short_name, and RTL direction', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.name).toBe('دليلي الدوائي');
    expect(manifest.short_name).toBe('دليلي الدوائي');
    expect(manifest.dir).toBe('rtl');
    expect(manifest.lang).toBe('ar');
  });

  it('enforces standalone display and medical color palette tokens', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#006D77');
    expect(manifest.background_color).toBe('#F8F9FA');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
  });

  it('defines 192x192 and 512x512 PNG icons with proper purposes', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    const icon192 = manifest.icons.find((i: any) => i.sizes === '192x192');
    const icon512 = manifest.icons.find((i: any) => i.sizes === '512x512');

    expect(icon192).toBeDefined();
    expect(icon192.type).toBe('image/png');
    expect(icon192.src).toBe('/icon-192.png');

    expect(icon512).toBeDefined();
    expect(icon512.type).toBe('image/png');
    expect(icon512.src).toBe('/icon-512.png');
  });

  it('verifies icon PNG files exist in public directory with valid PNG signatures', () => {
    const p192 = path.resolve(__dirname, '../public/icon-192.png');
    const p512 = path.resolve(__dirname, '../public/icon-512.png');

    expect(fs.existsSync(p192)).toBe(true);
    expect(fs.existsSync(p512)).toBe(true);

    const b192 = fs.readFileSync(p192);
    const b512 = fs.readFileSync(p512);

    expect(b192.length).toBeGreaterThan(100);
    expect(b512.length).toBeGreaterThan(100);

    // PNG signature [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(b192.subarray(0, 8).equals(pngSignature)).toBe(true);
    expect(b512.subarray(0, 8).equals(pngSignature)).toBe(true);
  });
});

describe('Service Worker (public/sw.js)', () => {
  const swPath = path.resolve(__dirname, '../public/sw.js');

  it('sw.js file exists and is non-empty', () => {
    expect(fs.existsSync(swPath)).toBe(true);
    const content = fs.readFileSync(swPath, 'utf-8');
    expect(content.trim().length).toBeGreaterThan(0);
  });

  it('contains cache name, install, activate, and fetch listeners', () => {
    const content = fs.readFileSync(swPath, 'utf-8');
    expect(content).toContain('CACHE_NAME');
    expect(content).toContain("addEventListener('install'");
    expect(content).toContain("addEventListener('activate'");
    expect(content).toContain("addEventListener('fetch'");
  });

  it('calls skipWaiting and clients.claim for lifecycle control', () => {
    const content = fs.readFileSync(swPath, 'utf-8');
    expect(content).toContain('skipWaiting');
    expect(content).toContain('clients.claim');
  });

  it('implements Stale-While-Revalidate caching pattern with offline navigation fallback', () => {
    const content = fs.readFileSync(swPath, 'utf-8');
    expect(content).toContain('caches.open');
    expect(content).toContain('cache.match');
    expect(content).toContain('cache.put');
    expect(content).toContain('navigate');
    expect(content).toContain('/index.html');
  });

  it('bypasses Gemini AI requests and non-GET methods', () => {
    const content = fs.readFileSync(swPath, 'utf-8');
    expect(content).toContain("method !== 'GET'");
    expect(content).toContain('googleapis.com');
  });
});

describe('Service Worker Registration Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when serviceWorker is not supported in navigator', async () => {
    const originalNavigator = global.navigator;
    // @ts-ignore
    delete global.navigator;
    // @ts-ignore
    global.navigator = {};

    const reg = await registerServiceWorker();
    expect(reg).toBeNull();

    global.navigator = originalNavigator;
  });

  it('calls navigator.serviceWorker.register when supported', async () => {
    const mockRegistration = {
      scope: '/',
      addEventListener: vi.fn(),
      installing: null
    };
    const registerMock = vi.fn().mockResolvedValue(mockRegistration);

    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: { register: registerMock },
      configurable: true,
      writable: true
    });

    const onSuccess = vi.fn();
    const result = await registerServiceWorker({ onSuccess });

    expect(registerMock).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(onSuccess).toHaveBeenCalledWith(mockRegistration);
    expect(result).toBe(mockRegistration);
  });
});

describe('Network Status Utility', () => {
  it('isOnline returns true or false based on navigator.onLine', () => {
    expect(typeof isOnline()).toBe('boolean');
  });

  it('subscribeToNetworkStatus attaches and detaches event listeners', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const callback = vi.fn();

    const unsubscribe = subscribeToNetworkStatus(callback);
    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    unsubscribe();
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });
});
```

---

### 4.8. HTML Integration Snippet for `index.html`
The worker implementing `index.html` (M1 Explorer 3) must ensure the following tags are placed in the `<head>` of `index.html`:
```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#006D77" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="دليلي الدوائي" />
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

---

## 5. Verification Method

### 5.1. File Inspection
1. Verify `public/manifest.webmanifest` exists, contains valid JSON, and matches all Arabic metadata and palette values (`#006D77`, `#F8F9FA`).
2. Verify `public/sw.js` exists, contains `dalili-app-shell-v1`, `skipWaiting()`, `clients.claim()`, Stale-While-Revalidate caching, Gemini API bypass, and navigation fallback to `/index.html`.
3. Verify `public/icon-192.png` and `public/icon-512.png` exist and have non-zero file sizes with valid PNG headers.
4. Verify `src/main.tsx` mounts React root and invokes `registerServiceWorker()`.

### 5.2. Automated Test Execution
Run the following commands in Windows PowerShell:
```powershell
npm.cmd run test -- tests/pwa.test.ts
```
Expected output: 100% test pass (all manifest, service worker, registration, and network status tests passing).

### 5.3. Production Build Execution
```powershell
npm.cmd run build
```
Expected output:
- Zero TypeScript compiler errors.
- Successful copy of `manifest.webmanifest`, `sw.js`, and icons into `dist/`.

### 5.4. Invalidation Conditions
- Any missing required key in `manifest.webmanifest` (such as `name`, `theme_color`, or `icons`).
- Attempting to cache Gemini API POST requests or failing to bypass `generativelanguage.googleapis.com`.
- Hardcoding unhandled promise rejections in `sw.js` during network offline events.
