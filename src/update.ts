// Updates der installierten App: Service Worker regelmäßig prüfen und bei neuer Version neu laden.
// Auf dem iPhone wird eine Homescreen-App oft nur „aufgeweckt“ statt neu gestartet.
export async function initUpdates(): Promise<void> {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });
  const { registerSW } = await import('virtual:pwa-register');
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg?.update().catch(() => {});
      });
      setInterval(() => reg?.update().catch(() => {}), 60 * 60 * 1000);
    },
  });
}
