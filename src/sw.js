/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL, cleanupOutdatedCaches } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

// Written by hand rather than generated because a generated service worker
// can't carry push handlers. Everything below the caching section is what the
// generated one was missing.

precacheAndRoute(self.__WB_MANIFEST);

// Precaches left by earlier builds are dead weight and, worse, a source of
// half-matched shells. Drop them on activate.
cleanupOutdatedCaches();

/**
 * SPA routing, with the network as a backstop.
 *
 * The cached shell answers navigations so deep links work offline and instantly.
 * The try/catch is belt-and-braces: a navigation whose handler rejects gives the
 * user a blank document — no error, no content, no way back except clearing site
 * data — and that is the worst failure this worker can produce.
 *
 * Worth being precise about what this does and does not fix, because the
 * obvious story is wrong. An *evicted* precache entry is already safe:
 * Workbox's PrecacheStrategy defaults to fallbackToNetwork, and a controlled
 * test — delete index.html from the precache, then load a deep link — renders
 * fine with or without this handler. What is left uncovered is a handler that
 * rejects outright, chiefly createHandlerBoundToURL throwing 'non-precached-url'
 * when index.html never made it into the manifest. That is a build
 * misconfiguration rather than a runtime event, so this is cheap insurance, not
 * a bug fix.
 *
 * The denylist below is the part with a known trigger behind it.
 */
const serveShell = createHandlerBoundToURL('index.html');

async function navigationHandler(params) {
  try {
    const cached = await serveShell(params);
    if (cached) return cached;
  } catch {
    // Nothing to report — the point is that we carry on rather than reject.
  }
  return fetch(params.request);
}

registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [
      // Paths Supabase owns — a cached response there would be actively wrong.
      /^\/rest\//, /^\/auth\//, /^\/functions\//,
      // Vercel's own routes, including the deployment-protection bounce. The
      // worker must not shadow an auth redirect it cannot complete: that is
      // exactly what turned a protected preview deep link into a blank page.
      /^\/_vercel\//, /[?&]_vercel_share=/,
    ],
  })
);

// The app decides when to swap builds (see ReloadPrompt), so the worker waits
// to be told rather than taking over mid-pick.
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ─── Push ───────────────────────────────────────────────────────────────────

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() };
  }

  const title = payload.title || 'Under Achievers';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // Lets a later reminder replace an earlier one rather than stacking up
    // several notices about the same deadline.
    tag: payload.tag || 'under-achievers',
    renotify: !!payload.tag,
    data: { url: payload.url || '/' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  // Focus an open window if there is one; a second copy of the app helps nobody.
  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if ('focus' in client) {
        if ('navigate' in client) await client.navigate(target).catch(() => {});
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
