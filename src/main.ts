import '@fontsource-variable/fraunces';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/instrument-sans/700.css';
import './styles.css';
import { findApp } from './apps';
import { setOnHome } from './home';
import { parseRoute } from './router';
import { initUpdates } from './update';
import { detailView, esc, notFoundView, startView, storeView, tabBar } from './views';

const root = document.querySelector<HTMLDivElement>('#app')!;
let lastKey = '';

function render(): void {
  const route = parseRoute(location.hash);
  let body: string;
  let tab: 'start' | 'entdecken' = 'entdecken';
  if (route.name === 'start') {
    body = startView();
    tab = 'start';
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

window.addEventListener('hashchange', go);
// Datum und Begrüßung aktuell halten, wenn die App aus dem Hintergrund zurückkommt
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});

render();
initUpdates();
