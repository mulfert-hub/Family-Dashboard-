import '@fontsource-variable/fraunces';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/instrument-sans/700.css';
import './styles.css';
import { findApp } from './apps';
import { setOnHome } from './home';
import { parseRoute, type Tab } from './router';
import { initUpdates } from './update';
import { dashboardView } from './dashboard';
import { readKochbuch, type KochbuchData } from './kochbuch';
import { appsView, detailView, esc, notFoundView, storeView, tabBar } from './views';

const root = document.querySelector<HTMLDivElement>('#app')!;
let lastKey = '';
// Wochenplan und Einkaufsliste aus dem Kochbuch (wird nach dem ersten Zeichnen nachgeladen)
let kochbuch: KochbuchData | null = null;
let kochbuchJson = 'null';

function render(): void {
  const route = parseRoute(location.hash);
  let body: string;
  let tab: Tab = 'entdecken';
  if (route.name === 'start') {
    body = dashboardView(new Date(), kochbuch);
    tab = 'start';
  } else if (route.name === 'apps') {
    body = appsView();
    tab = 'apps';
  } else if (route.name === 'entdecken') {
    body = storeView();
  } else {
    const app = findApp(route.id);
    body = app ? detailView(app) : notFoundView();
    document.title = app ? `${app.name} – Familie Ulfert` : 'Familie Ulfert';
  }
  if (route.name !== 'app') document.title = 'Familie Ulfert';
  const key = JSON.stringify(route);
  root.innerHTML = `<main class="view view-${route.name}">${body}<footer class="foot">Version ${esc(__APP_VERSION__)}</footer></main>${tabBar(tab)}`;
  if (key !== lastKey) window.scrollTo(0, 0);
  lastKey = key;
}

function go(): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (doc.startViewTransition && !reduce) doc.startViewTransition(render);
  else render();
}

// „Laden“ legt die App auf den Startbildschirm, „Entfernen“ nimmt sie wieder herunter
root.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const install = target.closest<HTMLButtonElement>('[data-install]');
  if (install) {
    e.preventDefault();
    install.classList.add('is-loading');
    install.textContent = '';
    install.setAttribute('aria-busy', 'true');
    setOnHome(install.dataset.install!, true);
    setTimeout(render, 650);
    return;
  }
  const remove = target.closest<HTMLButtonElement>('[data-remove]');
  if (remove) {
    setOnHome(remove.dataset.remove!, false);
    render();
  }
});

/** Kochbuch-Daten neu lesen und nur bei Änderungen neu zeichnen */
async function refreshKochbuch(): Promise<void> {
  const data = await readKochbuch();
  const json = JSON.stringify(data);
  if (json === kochbuchJson) return;
  kochbuch = data;
  kochbuchJson = json;
  if (parseRoute(location.hash).name === 'start') render();
}

window.addEventListener('hashchange', () => {
  go();
  void refreshKochbuch();
});
// Datum, Begrüßung, Essen und Einkaufsliste aktuell halten, wenn die App aus dem Hintergrund zurückkommt
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    render();
    void refreshKochbuch();
  }
});
// Das Kochbuch gleicht im Hintergrund mit dem anderen Handy ab – ab und zu nachsehen
window.setInterval(() => {
  if (document.visibilityState === 'visible' && parseRoute(location.hash).name === 'start') void refreshKochbuch();
}, 20_000);

render();
void refreshKochbuch();
initUpdates();
