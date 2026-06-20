const CACHE_VERSION = 'v1'
const STATIC_CACHE = `tvstation-static-${CACHE_VERSION}`
const DYNAMIC_CACHE = `tvstation-dynamic-${CACHE_VERSION}`
const OFFLINE_URL = '/offline.html'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => caches.delete(name))
        )
      })
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') {
    return
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/api')) {
    event.respondWith(handleApiRequest(request))
    return
  }

  if (url.origin === self.location.origin) {
    event.respondWith(handleStaticRequest(request))
    return
  }

  event.respondWith(handleExternalRequest(request))
})

async function handleStaticRequest(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    if (request.mode === 'navigate') {
      const offlinePage = await caches.match(OFFLINE_URL)
      if (offlinePage) {
        return offlinePage
      }
    }

    return new Response('离线模式 - 资源不可用', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  }
}

async function handleApiRequest(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    return new Response(
      JSON.stringify({ code: 503, message: '离线模式 - 数据不可用，请检查网络连接' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }
    )
  }
}

async function handleExternalRequest(request) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    return new Response('', { status: 503 })
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data && event.data.type === 'CACHE_URLS') {
    const { urls } = event.data
    event.waitUntil(
      caches.open(DYNAMIC_CACHE)
        .then((cache) => cache.addAll(urls))
        .then(() => event.source.postMessage({ type: 'CACHE_DONE' }))
    )
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((names) => Promise.all(names.map((n) => caches.delete(n))))
        .then(() => event.source.postMessage({ type: 'CACHE_CLEARED' }))
    )
  }
})

self.addEventListener('sync', (event) => {
  if (event.tag === 'upload-pending-files') {
    event.waitUntil(self.clients.matchAll()
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_UPLOAD' })
        })
      })
    )
  }
})
