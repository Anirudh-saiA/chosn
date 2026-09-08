/**
 * Web push service worker (Day 14). Deliberately minimal — this app has
 * no other reason for a service worker (no offline mode, no asset
 * caching strategy), so this file exists solely to receive push events
 * for subscribed users who aren't currently on the site and turn them
 * into an OS-level notification.
 */

self.addEventListener('push', (event) => {
  let data = { title: 'CHOSN', body: 'A drop just went live.', dropEventId: null, styleCode: null };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Malformed payload — still show a generic notification rather than
    // silently dropping it; a push that arrives but shows nothing looks
    // like a bug to the person who granted permission expecting one.
  }

  const url = data.styleCode ? `/sneakers/${encodeURIComponent(data.styleCode)}` : '/';

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon',
      tag: data.dropEventId ? `drop-${data.dropEventId}` : undefined, // replaces a stale notification for the same drop rather than stacking duplicates
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
