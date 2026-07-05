var CACHE = 'tea-v11';
var ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

// Red primero: siempre intenta traer la última versión; usa la caché solo sin conexión.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.indexOf('/.netlify/') !== -1) return; // no cachear la función de IA
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (r) { return r || caches.match('./index.html'); });
    })
  );
});
