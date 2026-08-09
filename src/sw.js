/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

// Written by hand rather than generated because a generated service worker
// can't carry push handlers. Everything below the caching section is what the
// generated one was missing.

precacheAndRoute(self.__WB_MANIFEST);

// SPA routing: any navigation falls back to the cached shell, except the paths
// Supabase owns — a cached response there would be actively wrong.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/rest\//, /^\/auth\//, /^\/functions\//],
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
