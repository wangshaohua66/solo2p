const CACHE_NAME = 'camphub_cache_v1';
const OFFLINE_QUEUE_DB = 'camphub_sync_queue';
const STATIC_ASSETS = [
  '/',
  '/css/site.css',
  '/js/app.js',
  '/manifest.json',
  '/Account/Login',
  '/Account/Register'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // ignore failures
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => {});
          return resp;
        }).catch(() => cached || caches.match('/images/placeholder.jpg'));
      })
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).then((resp) => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => {});
        return resp;
      }).catch(() =>
        caches.match(request).then((cached) =>
          cached || new Response(JSON.stringify({
            success: false,
            message: '网络异常，已缓存数据可能过期',
            offline: true
          }), { headers: { 'Content-Type': 'application/json' } })
        )
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((resp) => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => {});
        return resp;
      }).catch(() => cached || caches.match('/Account/Login'));
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-outbox') {
    event.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  const allClients = await self.clients.matchAll();
  if (!allClients.length) return;

  try {
    const response = await allClients[0].postMessage({ type: 'SYNC_REQUEST' });
    return response;
  } catch (e) {
    console.warn('Sync failed, will retry', e);
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
