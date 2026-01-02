// Service Worker Reset
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', (event) => {
  // Pass-through (no caching)
  event.respondWith(fetch(event.request));
});