const CACHE_NAME = "touch-excellence-media-v1";
const MEDIA_FILES = [
  "./images/intro.mp4",
  "./video/Copy of Montaj  Gimik Majlis Apresiasi (Edisi 1.0) (1).mp4",
  "./video/montage-after-scan.mp4",
  "./video/majlis-animated-electronic-sound.mp4"
];

self.addEventListener("install", event => {
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("touch-excellence-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (!/\\.(mp4|webm|mp3|wav)$/i.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      event.waitUntil(cache.put(request, response.clone()));
    }
    return response;
  })());
});
