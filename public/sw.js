const CACHE = 'notesync-shell-v1'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('notesync-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())))
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    try { const response = await fetch(event.request); if (response.ok) cache.put(event.request, response.clone()); return response }
    catch { return (await cache.match(event.request)) || (event.request.mode === 'navigate' ? cache.match('./') : undefined) || Response.error() }
  }))
})
