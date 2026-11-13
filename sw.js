// Service worker: cache-first for the app's own files (offline + install). API data is never cached here;
// match data is cached in localStorage by app.js. Cross-origin requests (ESPN, club logos) pass straight through.
importScripts('version.js');
const CACHE_VERSION = 'fns-' + self.APP_VERSION;
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'views/table.js', 'views/matches.js', 'views/team.js', 'views/settings.js', 'main.js', 'store.js', 'backup.js', 'version.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('fns-') && k !== CACHE_VERSION).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
