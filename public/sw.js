const CACHE_NAME = 'sabores-costeros-v1';

const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/auth.js',
  '/js/utils.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        urlsToCache.map(url => {
          return fetch(url).then(response => {
            if (response.ok) return cache.put(url, response);
          }).catch(() => {});
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // No interceptar APIs externas
  if (
    url.includes('googleapis.com') ||
    url.includes('openstreetmap.org') ||
    url.includes('unpkg.com') ||
    url.includes('/api/')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
