// Service worker: keeps a copy of the app shell so the app works offline
// after the first visit. Same-origin requests go to the network first, so
// anyone online always gets the latest deploy, and the cache is refreshed
// with every response; the cache is only used when the network fails.
//
// Both placeholders below are filled in at build time (see _config.ts): the
// version changes whenever any built file does, which makes the browser
// install the new worker and precache the new shell in the background.

const VERSION = "__SW_VERSION__";
const PRECACHE = "__SW_PRECACHE__";

const CACHE = `subs-tracker-${VERSION}`;
const FONTS_CACHE = "subs-tracker-fonts";
const FONTS_ORIGIN = "https://fonts.bunny.net";

// Past this, a slow network falls back to the cached copy (if any), while
// the network response still refreshes the cache for the next visit
const NETWORK_TIMEOUT = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) =>
        // "no-cache" skips the HTTP cache so the new shell is really fresh
        cache.addAll(
          PRECACHE.map((url) => new Request(url, { cache: "no-cache" })),
        )
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE && key !== FONTS_CACHE)
            .map((key) => caches.delete(key)),
        )
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(event));
  } else if (url.origin === FONTS_ORIGIN) {
    event.respondWith(staleWhileRevalidate(event));
  }
});

function networkFirst(event) {
  const { request } = event;

  // Revalidate with the server instead of trusting the HTTP cache, which on
  // GitHub Pages could otherwise serve a previous deploy for 10 minutes
  const network = fetch(request, { cache: "no-cache" });
  event.waitUntil(updateCache(CACHE, request, network));

  return caches.match(request, { ignoreSearch: true }).then((cached) => {
    if (!cached) return network;

    const timeout = new Promise((resolve) =>
      setTimeout(() => resolve(cached), NETWORK_TIMEOUT)
    );
    return Promise.race([network.catch(() => cached), timeout]);
  });
}

function staleWhileRevalidate(event) {
  const { request } = event;
  const network = fetch(request);
  event.waitUntil(updateCache(FONTS_CACHE, request, network));

  return caches.match(request).then((cached) => cached ?? network);
}

// Stores a copy of a successful network response, ignoring network errors
async function updateCache(name, request, network) {
  try {
    const response = await network;
    if (!response.ok || response.redirected) return;
    const copy = response.clone();
    const cache = await caches.open(name);
    await cache.put(request, copy);
  } catch {
    // Offline: keep what is already cached
  }
}
