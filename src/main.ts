import '@fontsource-variable/fraunces';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/600.css';
import './styles.css';
import { APPS, formatDate, greeting, type FamilyApp } from './apps';
import { icon } from './icons';
import { initUpdates } from './update';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function tile(app: FamilyApp): string {
  const inner = `
    <span class="tile-icon" style="--app:${esc(app.farbe)}">${icon(app.icon)}</span>
    <span class="tile-text">
      <span class="tile-name">${esc(app.name)}</span>
      <span class="tile-desc">${esc(app.beschreibung)}</span>
    </span>`;
  if (app.status === 'live' && app.path) {
    return `<li><a class="tile" href="${esc(app.path)}">${inner}<span class="tile-go">${chevron}</span></a></li>`;
  }
  return `<li><div class="tile is-soon" aria-disabled="true">${inner}<span class="badge">Bald</span></div></li>`;
}

const chevron =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 6l6 6-6 6"/></svg>';

function render(): void {
  const now = new Date();
  const live = APPS.filter((a) => a.status === 'live');
  const soon = APPS.filter((a) => a.status !== 'live');
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <header class="hero">
      <p class="eyebrow"><span class="greet">${greeting(now)}</span> · ${formatDate(now)}</p>
      <h1>Familie Ulfert</h1>
    </header>
    <main>
      <section aria-labelledby="h-apps">
        <h2 id="h-apps" class="section-title">Unsere Apps</h2>
        <ul class="tiles">${live.map(tile).join('')}</ul>
      </section>
      ${
        soon.length
          ? `<section aria-labelledby="h-soon">
              <h2 id="h-soon" class="section-title">In Arbeit</h2>
              <ul class="tiles">${soon.map(tile).join('')}</ul>
            </section>`
          : ''
      }
    </main>
    <footer class="foot">Version ${esc(__APP_VERSION__)}</footer>`;
}

render();
// Datum und Begrüßung aktuell halten, wenn die App aus dem Hintergrund zurückkommt
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});
initUpdates();
