/* Stock Hogar — Service Worker
 * v1: cachea el "app shell" para que la app abra offline,
 * y deja preparada (simulada) la estructura para push notifications reales
 * cuando en el futuro haya un backend que las dispare.
 */

const CACHE_NAME = 'stock-hogar-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Estrategia: network-first para navegación (HTML), cache-first para el resto.
// Así la app funciona offline pero toma cambios nuevos cuando hay conexión.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});

/* ---------------------------------------------------------------------
 * PREPARADO PARA PUSH NOTIFICATIONS REALES (no activo en esta versión)
 * ---------------------------------------------------------------------
 * Cuando exista un backend que envíe pushes (ej: "te queda poco detergente"),
 * el flujo sería:
 *   1. El front pide permiso y se suscribe con pushManager.subscribe({ ...VAPID pública })
 *   2. Esa suscripción se guarda en el backend
 *   3. El backend dispara un push y este listener lo muestra:
 *
 * self.addEventListener('push', (event) => {
 *   const data = event.data ? event.data.json() : {};
 *   event.waitUntil(
 *     self.registration.showNotification(data.title || 'Stock Hogar', {
 *       body: data.body || 'Tenés productos para reponer.',
 *       icon: '/icons/icon.svg',
 *       badge: '/icons/icon.svg',
 *       data: { url: data.url || '/' }
 *     })
 *   );
 * });
 *
 * Por ahora, la app dispara notificaciones LOCALES simuladas (ver
 * src/utils/notifications.js) usando self.registration.showNotification
 * directamente desde el cliente, sin servidor de push de por medio.
 * ------------------------------------------------------------------- */

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        self.clients.openWindow('/');
      }
    })
  );
});
