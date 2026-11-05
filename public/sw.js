// Lets the app open with no signal at the gym. Your data is not involved: it lives in
// IndexedDB, and requests to api.github.com pass straight through this worker.
const CACHE = 'dashboard-v1';
const PHOTOS = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/';
const NETWORK_TIMEOUT = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const html = await (await fetch('./', { cache: 'no-cache' })).text();
      const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await cache.addAll(['./', './exercises.json', ...assets]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Newest version when online. The cached copy when the network fails or stalls.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  });
  if (!cached) return network;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_TIMEOUT));
  return Promise.race([network.catch(() => cached), timeout]);
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin === self.location.origin) event.respondWith(networkFirst(request));
  else if (request.url.startsWith(PHOTOS)) event.respondWith(cacheFirst(request));
});
