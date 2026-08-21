const CACHE_NAME = 'sabores-costeros-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/firebase-config.js',
  '/js/auth.js',
  '/js/utils.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});