const CACHE_NAME = 'attendance-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // NEVER intercept API calls, Auth endpoints, or non-GET requests (like POST logins)
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return; 
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
