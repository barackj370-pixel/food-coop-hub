const CACHE_NAME = 'kpl-offline-v2';
const DYNAMIC_CACHE = 'kpl-dynamic-v2';

// Install Event: Skip waiting to activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate Event: Claim clients so the SW controls the page immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME && key !== DYNAMIC_CACHE) {
              return caches.delete(key);
            }
          })
        );
      })
    ])
  );
});

// Fetch Event: Network First for API, Cache First for Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. API Requests (Supabase, Google AI) - Network Only (Fail fast if offline)
  if (url.hostname.includes('supabase') || url.hostname.includes('googleapis') || url.hostname.includes('google')) {
    return;
  }

  // 2. App Assets (HTML, JS, CSS, Images) - Stale-While-Revalidate or Cache-First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Update Cache
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback if network fails
          return cachedResponse; 
        });

      // Return cached response immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});