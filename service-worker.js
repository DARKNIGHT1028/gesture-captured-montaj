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
self.addEventListener("message", event => {
  if (event.data?.type !== "CACHE_MEDIA") return;
  const port = event.ports?.[0];
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    let done = 0;
    for (const path of MEDIA_FILES) {
      try {
        const url = new URL(path, self.registration.scope).href;
        const cached = await cache.match(url);
        if (!cached) {
          const response = await fetch(url, { cache: "no-store" });
          if (!response.ok || response.type === "opaque") throw new Error("HTTP " + response.status);
          await cache.put(url, response);
        }
      } catch (error) {
        port?.postMessage({ type: "progress", done, total: MEDIA_FILES.length, file: path, error: String(error) });
        continue;
      }
      done++;
      port?.postMessage({ type: "progress", done, total: MEDIA_FILES.length, file: path });
    }
    port?.postMessage({ type: "complete", done, total: MEDIA_FILES.length });
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
