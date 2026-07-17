// hivePOS service worker — installability + offline app shell.
//
// ponytail: hand-rolled (no Serwist/Workbox) to avoid a dependency + Next.js 16
// compat risk. ~60 lines covers the app-shell + runtime-caching model.
//
// Cache strategy:
//   - Precache the root shell on install.
//   - Navigation requests: cache-first (serve cached route HTML), network fallback,
//     final fallback to cached root (so an unvisited route still renders the shell
//     instead of a blank page).
//   - Same-origin GET (JS/CSS/RSC payloads/images): stale-while-revalidate. This is
//     what makes offline MENU NAVIGATION work — after the kasir visits a route once
//     online, its RSC payload + chunks are cached and served offline.
//   - /api/* GET: network-only. Mutations never reach the cache. When offline the
//     API fails cleanly, the OfflineBanner shows, and the IDB offline-create path
//     takes over — no stale-data risk.
//   - Non-GET + cross-origin: bypass (straight to network).

// VERSION is a placeholder — the real value is injected at build time by
// `scripts/gen-sw-version.mjs` (prebuild). Do not hand-edit; see that script.
const VERSION = "dev";
const SHELL_CACHE = `hivepos-shell-v${VERSION}`;
const RUNTIME_CACHE = `hivepos-runtime-v${VERSION}`;
const SHELL_PRECACHE = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // ponytail: manual fetch+put instead of cache.add() so we can skip caching
      // redirected responses. When a logged-in user installs the SW, middleware
      // redirects "/" → "/dashboard"; cache.add() would follow and store the
      // dashboard body under key "/" with redirected=true. Safari then refuses
      // to serve that cached entry on PWA reopen ("response served by service
      // worker has redirected"). Skipping redirected responses keeps the cache
      // clean; the navigation handler fetches fresh on cache miss.
      await Promise.all(
        SHELL_PRECACHE.map(async (url) => {
          try {
            const resp = await fetch(new Request(url, { cache: "reload" }));
            if (resp.ok && !resp.redirected) {
              await cache.put(url, resp.clone());
            }
          } catch {
            // Single asset failure shouldn't fail install.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET; everything else (POST/PUT/DELETE) goes straight to network.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Cross-origin: don't touch.
  if (url.origin !== self.location.origin) return;

  // /api/auth/session — network-first. The dashboard sidebar reads
  // session.user.permissions via useSession(); if this endpoint hard-fails
  // offline, the sidebar empties (all permission-gated nav items filter out).
  // Network-first (not SWR) is required so a post-logout reopen sees the fresh
  // logged-out response immediately — SWR would serve the stale logged-in
  // cache and the client would route into a broken dashboard.
  // Offline fallback to the last cached session keeps the sidebar rendered.
  if (url.pathname === "/api/auth/session") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          if (fresh.status === 200) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(req, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch {
          const cache = await caches.open(RUNTIME_CACHE);
          const cached = await cache.match(req);
          return cached || new Response("{}", { status: 503 });
        }
      })(),
    );
    return;
  }

  // /api/* (everything else) — network-only. Fail clean offline; IDB handles offline creates.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req));
    return;
  }

  // Navigation (HTML document requests): cache-first, network fallback, root fallback.
  // ponytail: skip caching redirected responses — when `/` redirects to
  // /dashboard or /login, caching the redirected body under key "/" poisons
  // future opens (browser serves dashboard HTML at "/", ERR_FAILED or a broken
  // half-rendered state after logout). Each real route URL gets cached on its
  // own visit; redirects are always re-fetched so cookie-driven routing wins.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached && !cached.redirected) return cached;
        try {
          const fresh = await fetch(req);
          // WebKit (iOS Safari) rejects SW-served Responses with redirected=true,
          // throwing "response served by service worker has redirected". Reconstruct
          // as a non-redirected Response so Safari accepts it. Body is the final
          // resolved body from the redirect chain. Still excluded from caching
          // (we only cache clean non-redirected fetches under their own URL).
          if (fresh.redirected) {
            const body = await fresh.blob();
            return new Response(body, {
              status: fresh.status,
              statusText: fresh.statusText,
              headers: fresh.headers,
            });
          }
          const cache = await caches.open(SHELL_CACHE);
          cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const root = await caches.match("/");
          if (root && !root.redirected) return root;
          return new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })(),
    );
    return;
  }

  // Same-origin GET (JS/CSS/RSC/img): stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          // Only cache valid, same-type responses.
          if (res && res.status === 200 && res.type === "basic") {
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })(),
  );
});
