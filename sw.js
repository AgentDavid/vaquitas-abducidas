// Service worker: deja el juego jugable sin conexión.
// Sube VERSION cada vez que publiques cambios para que los jugadores reciban la versión nueva.
const VERSION = 'vaquitas-v14';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'crm.js', 'vendor/crm-games.js', 'crm-config'];

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
  const url = new URL(req.url);
  // La API del CRM y los videos de Elektra (otro dominio) siempre van a la red, sin caché
  if (url.origin !== location.origin && url.hostname !== 'fonts.googleapis.com' && url.hostname !== 'fonts.gstatic.com') return;
  // Código y config del programa de premios: primero red (revalidando la caché HTTP, que Cloudflare
  // alarga a 4 h), para que una llave o versión nueva llegue al instante
  if (url.pathname.endsWith('/crm.js') || url.pathname.endsWith('/crm-config')) {
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; })
        .catch(() => caches.match(req))
    );
    return;
  }
  // Página: primero red (para recibir actualizaciones), si no hay conexión, la copia guardada
  if (req.mode === 'navigate') {
    // Otras páginas (privacidad.html) no deben pisar la copia del juego
    if (!url.pathname.endsWith('/') && !url.pathname.endsWith('/index.html')) return;
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
