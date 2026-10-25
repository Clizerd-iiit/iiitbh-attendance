const CACHE_NAME = 'attendance-v4';

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

// ==========================================
// --- WEB PUSH NOTIFICATIONS EVENT HANDLERS ---
// ==========================================

self.addEventListener('push', function (event) {
  if (!event.data) return;

  let payload = {
    title: 'IIIT Bhagalpur AMS Alert',
    body: 'New announcement posted in portal',
    url: '/student/announcements',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'ams-announcement',
  };

  try {
    const json = event.data.json();
    payload = { ...payload, ...json };
  } catch (e) {
    payload.body = event.data.text() || payload.body;
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/icon-192x192.png',
    badge: payload.badge || '/icon-192x192.png',
    tag: payload.tag || 'ams-alert',
    vibrate: [200, 100, 200],
    renotify: true,
    requireInteraction: false,
    data: {
      url: payload.url || '/student/announcements',
      dateOfArrival: Date.now(),
    },
    actions: [
      {
        action: 'open',
        title: 'Open Announcement',
      },
      {
        action: 'close',
        title: 'Dismiss',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/student/announcements';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // 1. If a matching window is already open, focus it and navigate
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      // 2. Otherwise open a new window directly
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
