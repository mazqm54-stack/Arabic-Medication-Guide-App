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
        .catch(async () => {
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
