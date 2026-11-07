// Mitteilungen für alle Apps der Familie.
//
// Auf dem iPhone weckt iOS bei einer Push-Nachricht den Service Worker der installierten App –
// das ist der Service Worker dieser Startseite, auch wenn die Nachricht z. B. vom Haushaltsplan
// stammt. Darum zeigt dieser Service Worker die Mitteilungen aller Apps an.
// Wird per importScripts in den von Workbox erzeugten Service Worker eingebunden (vite.config.ts).
//
// Erwartete Nachricht (JSON): { title, body?, tag?, url?, count?, app? }

// Apps fragen nach, ob sie Push über diesen Service Worker laufen lassen können
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'familie-push-ping' && e.ports && e.ports[0]) {
    e.ports[0].postMessage({ type: 'familie-push-pong' });
  }
});

async function rememberPush(data) {
  try {
    const c = await caches.open('familie-push');
    await c.put(
      self.location.origin + '/__familie-last-push.json',
      new Response(JSON.stringify({ at: new Date().toISOString(), title: data.title || '', app: data.app || '', by: 'familie' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  } catch {
    /* ignorieren */
  }
}

self.addEventListener('push', (e) => {
  e.waitUntil(
    (async () => {
      let data = {};
      try {
        data = e.data ? e.data.json() : {};
      } catch {
        data = { title: e.data ? e.data.text() : '' };
      }
      await rememberPush(data);
      const title = data.title || 'Familie Ulfert';
      const options = { body: data.body || '', icon: 'icons/icon-192.png', data: { url: data.url || null } };
      if (data.tag) options.tag = data.tag;
      try {
        await self.registration.showNotification(title, options);
      } catch {
        await self.registration.showNotification(title, { body: data.body || '' });
      }
      try {
        if (typeof data.count === 'number' && self.navigator.setAppBadge) await self.navigator.setAppBadge(data.count);
      } catch {
        /* nicht unterstützt */
      }
    })(),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const exact = all.find((c) => c.url.split('#')[0] === target.split('#')[0]);
      if (exact) {
        exact.postMessage('refresh');
        return exact.focus();
      }
      for (const c of all) {
        try {
          const nav = await c.navigate(target);
          if (nav) return nav.focus();
        } catch {
          /* gehört zu einem anderen Service Worker */
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
