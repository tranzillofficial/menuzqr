/* MenuzQR service worker — install-to-home-screen + push notifications.
 * Plain JavaScript on purpose: it is served as-is, outside the bundler. */

const CACHE = "menuzqr-v2";
const PRECACHE = [
  "/notification-sound.mp3",
  "/icons/icon-192.png",
  "/icons/badge-96.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Deliberately narrow. The dashboard is live data, so this worker does NOT
 * cache pages — a stale order board is worse than no order board, and an
 * over-eager offline fallback turns a one-second network blip into a hard
 * error page. Only the alert assets are served cache-first, so the chime still
 * plays on a flaky restaurant Wi-Fi. Everything else goes straight to the
 * network, untouched. (A fetch handler has to exist at all for the browser to
 * offer "install".) */
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!PRECACHE.includes(url.pathname)) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {};
  }

  const title = data.title || "MenuzQR";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: data.tag || "menuzqr",
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [180, 90, 180, 90, 260],
    data: { url: data.url || "/dashboard/orders", kind: data.kind || "" },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // A tab that is open but not focused should still make our own sound.
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        client.postMessage({ type: "menuzqr-push", data });
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard/orders";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch (error) {
              /* cross-origin or unsupported; the focus is enough */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
