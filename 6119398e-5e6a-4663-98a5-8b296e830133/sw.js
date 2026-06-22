const CACHE_NAME = 'jewelry-recycle-v1';
const PRECACHE_URLS = [
    './',
    './index.html',
    './css/style.css',
    './app.js',
    './store.js',
    './manifest.json',
    './utils/widget-factory.js',
    './utils/gold-price.js',
    './utils/report-generator.js',
    './components/recycle-form.js',
    './components/inspection-panel.js',
    './components/price-calculator.js',
    './components/history-table.js'
];
const CDN_CACHE = 'jewelry-recycle-cdn-v1';
const CDN_ORIGINS = [
    'https://cdn.jsdelivr.net'
];

self.addEventListener('install', (event) => {
    console.log('[SW] 安装, 预缓存资源');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)).catch(err => {
            console.warn('[SW] 预缓存部分失败:', err);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] 激活, 清理旧缓存');
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME && k !== CDN_CACHE).map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    if (CDN_ORIGINS.some(o => url.origin === o)) {
        event.respondWith(
            caches.open(CDN_CACHE).then(async (cache) => {
                const cached = await cache.match(req);
                if (cached) {
                    const fetchPromise = fetch(req).then(res => {
                        if (res && res.status === 200) cache.put(req, res.clone());
                        return res;
                    }).catch(() => cached);
                    return cached || fetchPromise;
                }
                try {
                    const res = await fetch(req);
                    if (res && res.status === 200) cache.put(req, res.clone());
                    return res;
                } catch (e) {
                    return cached || Response.error();
                }
            })
        );
        return;
    }

    if (url.origin === location.origin) {
        event.respondWith(
            caches.match(req).then(cached => {
                const fetchPromise = fetch(req).then(res => {
                    if (res && res.status === 200 && req.url.indexOf('chrome-extension') === -1) {
                        caches.open(CACHE_NAME).then(c => c.put(req, res.clone())).catch(() => {});
                    }
                    return res;
                }).catch(() => cached || caches.match('./index.html'));
                return cached || fetchPromise;
            })
        );
    }
});

self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
