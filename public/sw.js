// Employee Connect service worker -- exists so the browser can install the site as an app. It deliberately caches NOTHING: the app is online-only (live HR data,
// signed-in API calls, the SignalR channel), and a new deploy must be picked up at once. Every request goes straight to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  // Remove any cache an earlier version might have made, then take over the open pages.
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// A fetch handler is present (some browsers expect one for an installable app) but it never answers: the browser does the normal network request.
self.addEventListener("fetch", () => {});
