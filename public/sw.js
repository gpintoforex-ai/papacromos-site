const CACHE_NAME = "papa-cromos-v2026-16";
const IMAGE_CACHE_NAME = "papa-cromos-images-v2026-04";
const IMAGE_CACHE_MAX_ENTRIES = 900;
const APP_SHELL = [
  "/logo.png",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/terms.html",
  "/privacy.html",
  "/disclaimer.html",
];

async function trimImageCache() {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const keys = await cache.keys();
  if (keys.length <= IMAGE_CACHE_MAX_ENTRIES) return;

  await Promise.all(keys.slice(0, keys.length - IMAGE_CACHE_MAX_ENTRIES).map((request) => cache.delete(request)));
}

function isCacheableImageRequest(request, url) {
  if (request.method !== "GET") return false;
  if (request.destination === "image") return true;

  return (
    url.origin === self.location.origin &&
    (
      url.pathname.startsWith("/stickers/") ||
      url.pathname.startsWith("/sticker-previews/") ||
      /\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)
    )
  );
}

async function fetchAndCacheImage(request) {
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    const responseClone = response.clone();
    caches.open(IMAGE_CACHE_NAME).then((cache) => {
      cache.put(request, responseClone).then(trimImageCache);
    });
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => ![CACHE_NAME, IMAGE_CACHE_NAME].includes(cacheName))
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (isCacheableImageRequest(request, url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetchAndCacheImage(request).catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .catch(() => caches.match("/index.html") || Response.error())
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || request.destination === "style" || request.destination === "script") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      });
    })
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Papa Cromos", body: event.data.text() };
  }

  const title = payload.title || "Papa Cromos";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const appUrl = new URL("/", self.location.origin).href;
      const visibleClient = clientList.find((client) => client.url.startsWith(self.location.origin));

      if (visibleClient) {
        visibleClient.focus();
        visibleClient.postMessage({ type: "push-notification-click", data: event.notification.data || {} });
        return;
      }

      return self.clients.openWindow(appUrl);
    })
  );
});
