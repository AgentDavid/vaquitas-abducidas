// Service worker: deja el juego jugable sin conexión.
// Sube VERSION cada vez que publiques cambios para que los jugadores reciban la versión nueva.
const VERSION = 'vaquitas-v4';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Página: primero red (para recibir actualizaciones), si no hay conexión, la copia guardada
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { caches.open(VERSION).then(c => c.put('index.html', r.clone())); return r; })
        .catch(() => caches.match('index.html'))
    );
    return;
  }
  // Resto (íconos, fuente de Google): caché primero y se guarda lo nuevo
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return r;
    }))
  );
});
