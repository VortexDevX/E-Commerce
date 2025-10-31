/* eslint-disable no-restricted-globals */
const CACHE_VERSION = "v1";
const APP_CACHE = `luxora-app-${CACHE_VERSION}`;
const ASSET_CACHE = `luxora-assets-${CACHE_VERSION}`;
const API_CACHE = `luxora-api-${CACHE_VERSION}`;

const CORE_ASSETS = [
  "/",
  "/offline",
  "/ecommerce-favicon.ico",
  "/fallback.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![APP_CACHE, ASSET_CACHE, API_CACHE].includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isSameOrigin(url) {
  try {
    const u = new URL(url);
    return u.origin === self.location.origin;
  } catch {
    return false;
  }
}

function isAsset(req) {
  const url = typeof req === "string" ? req : req.url;
  return /\.(?:png|jpg|jpeg|webp|gif|svg|ico|css|js|woff2?)$/i.test(url);
}

function isProductsApi(req) {
  const url = typeof req === "string" ? req : req.url;
  return (
    isSameOrigin(url) &&
    url.includes("/api/products") &&
    (!req.method || req.method === "GET")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Never intercept Next.js dev/prod assets to avoid HMR issues and stale bundles
  if (request.url.includes("/_next/")) return;

  // Navigations: network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches
            .open(APP_CACHE)
            .then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match("/offline");
        })
    );
    return;
  }

  // Static assets: cache-first
  if (isAsset(request)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((res) => {
            caches
              .open(ASSET_CACHE)
              .then((cache) => cache.put(request, res.clone()));
            return res;
          })
          .catch(() => undefined);
      })
    );
    return;
  }

  // Product API: stale-while-revalidate
  if (isProductsApi(request)) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default: network, fallback to cache
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
