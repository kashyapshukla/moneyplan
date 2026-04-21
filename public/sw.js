const CACHE_NAME = "moneyplan-v1";

const PRECACHE_URLS = [
  "/",
  "/dashboard",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API routes: network-first (never serve stale API data)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: "Offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Static assets (_next/static): cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached ?? fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Pages: network-first with cache fallback
  // Auth-protected pages are excluded from cache to avoid serving stale authenticated content
  const UNCACHED_PATHS = ["/dashboard", "/transactions", "/budgets", "/goals", "/net-worth",
    "/recurring", "/calendar", "/reports", "/ai-chat", "/settings", "/investments"];

  event.respondWith(
    fetch(request)
      .then((res) => {
        // Only cache non-authenticated pages (sign-in, static pages)
        const isAuthPage = UNCACHED_PATHS.some(
          (p) => url.pathname === p || url.pathname.startsWith(p + "/")
        );
        if (res.ok && !isAuthPage) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});
