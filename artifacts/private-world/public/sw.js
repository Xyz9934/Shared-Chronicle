const APP_BASE_PATH = '/Shared-Chronicle/';

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Private World';
  const options = {
    body: payload.body || 'You have a new message.',
    tag: payload.tag || payload.data?.messageId || 'private-world-message',
    data: payload.data || { screen: 'chat' },
    icon: `${APP_BASE_PATH}assets/images/icon_2.png`,
    badge: `${APP_BASE_PATH}assets/images/icon_2.png`,
  };

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const visibleClient = clients.find((client) => client.visibilityState === 'visible');
      if (visibleClient) {
        visibleClient.postMessage({ type: 'PRIVATE_WORLD_PUSH', payload });
        return undefined;
      }
      return self.registration.showNotification(title, options);
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = event.notification.data?.screen === 'chat' ? `${APP_BASE_PATH}` : `${APP_BASE_PATH}`;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      if (existing) {
        existing.navigate(targetPath);
        return existing.focus();
      }
      return self.clients.openWindow(targetPath);
    }),
  );
});
