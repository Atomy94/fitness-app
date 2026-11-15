// Service Worker: macht die App offline nutzbar.
// Alle Dateien werden beim ersten Öffnen auf dem Gerät gespeichert und danach von dort geladen.
// UPDATE: VERSION erhöhen (gleich wie in js/version.js). Dann holt sich das iPhone beim
// nächsten Öffnen alle Dateien neu. Neue Dateien müssen in DATEIEN stehen (ein Test prüft das).

const VERSION = '1.5.1';
const CACHE = `fitness-${VERSION}`;
const DATEIEN = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/cloud.js',
  './js/db.js',
  './js/store.js',
  './js/version.js',
  './js/core/bewertung.js',
  './js/core/checkin.js',
  './js/core/claude-dateien.js',
  './js/core/datum.js',
  './js/core/demo.js',
  './js/core/dropbox.js',
  './js/core/erstimport.js',
  './js/core/import.js',
  './js/core/kraft.js',
  './js/core/rezepte.js',
  './js/core/state.js',
  './js/core/zahl.js',
  './js/core/ziele.js',
  './js/ui/cloud.js',
  './js/ui/dom.js',
  './js/ui/fortschritt.js',
  './js/ui/heute.js',
  './js/ui/kalender.js',
  './js/ui/mehr.js',
  './js/ui/rezepte.js',
  './js/ui/symbole.js',
  './js/ui/tag.js',
  './js/ui/training.js',
  './js/ui/vorschau.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n.startsWith('fitness-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((treffer) => treffer || fetch(e.request)),
  );
});
