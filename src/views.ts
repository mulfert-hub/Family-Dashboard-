// Ansichten als HTML-Bausteine: Startbildschirm, Entdecken (Store) und App-Detailseite.
import { APPS, formatDate, type FamilyApp } from './apps';
import { homeApps, isOnHome } from './home';
import { icon } from './icons';
import type { Tab } from './router';

export { esc } from './shared/html';
import { esc } from './shared/html';

export function appIcon(app: FamilyApp, size: 'sm' | 'md' | 'lg' | 'xl' = 'md'): string {
  return `<span class="app-icon app-icon-${size}${app.status === 'bald' ? ' is-soon' : ''}" style="--app:${esc(app.farbe)}">${icon(app.icon)}</span>`;
}

/** Der runde Knopf wie im App Store: Öffnen, Laden oder Bald */
export function actionButton(app: FamilyApp, big = false): string {
  const cls = `pill${big ? ' pill-big' : ''}`;
  if (app.status !== 'live' || !app.path) return `<span class="${cls} pill-soon" aria-disabled="true">Bald</span>`;
  if (isOnHome(app.id)) return `<a class="${cls}" href="${esc(app.path)}" aria-label="${esc(app.name)} öffnen">Öffnen</a>`;
  return `<button type="button" class="${cls} pill-get" data-install="${esc(app.id)}" aria-label="${esc(app.name)} auf den Startbildschirm laden">Laden</button>`;
}

const detailHref = (app: FamilyApp) => `#/app/${encodeURIComponent(app.id)}`;

// ---------- Apps (Startbildschirm mit Symbolen) ----------
export function appsView(): string {
  const apps = homeApps(APPS);
  const soon = APPS.filter((a) => a.status !== 'live');
  return `
    <header class="large-head">
      <p class="eyebrow">Familie Ulfert</p>
      <h1>Apps</h1>
    </header>
    ${
      apps.length
        ? `<ul class="springboard" aria-label="Meine Apps">
            ${apps
              .map(
                (a) => `<li><a class="spring-app" href="${esc(a.path!)}">${appIcon(a, 'lg')}<span class="spring-label">${esc(a.name)}</span></a></li>`,
              )
              .join('')}
          </ul>`
        : `<div class="empty">
            <p>Noch keine Apps hier.</p>
            <a class="pill pill-big" href="#/entdecken">Apps entdecken</a>
          </div>`
    }
    ${
      soon.length
        ? `<section class="card-section">
            <div class="section-head"><h2>Demnächst</h2><a href="#/entdecken" class="see-all">Alle ansehen</a></div>
            <ul class="rows">${soon.map((a) => row(a)).join('')}</ul>
          </section>`
        : ''
    }`;
}

// ---------- Entdecken ----------
function row(app: FamilyApp): string {
  return `
    <li class="row">
      <a class="row-main" href="${detailHref(app)}">
        ${appIcon(app, 'md')}
        <span class="row-text">
          <span class="row-name">${esc(app.name)}</span>
          <span class="row-sub">${esc(app.untertitel)}</span>
        </span>
      </a>
      ${actionButton(app)}
    </li>`;
}

function featured(app: FamilyApp): string {
  const shot = app.screenshots[0];
  return `
    <a class="feature" href="${detailHref(app)}" style="--app:${esc(app.farbe)}">
      <span class="feature-text">
        <span class="feature-kicker">Unsere App</span>
        <span class="feature-title">${esc(app.name)}</span>
        <span class="feature-sub">${esc(app.untertitel)}</span>
      </span>
      ${shot ? `<img class="feature-shot" src="${esc(shot)}" alt="" loading="lazy" />` : ''}
      <span class="feature-foot">
        ${appIcon(app, 'sm')}
        <span class="feature-foot-text"><strong>${esc(app.name)}</strong><span>${esc(app.kategorie)}</span></span>
      </span>
    </a>`;
}

export function storeView(now = new Date()): string {
  const live = APPS.filter((a) => a.status === 'live');
  const soon = APPS.filter((a) => a.status !== 'live');
  const hero = APPS.find((a) => a.highlight) ?? live[0];
  return `
    <header class="large-head">
      <p class="eyebrow">${esc(formatDate(now))}</p>
      <h1>Entdecken</h1>
    </header>
    ${hero ? featured(hero) : ''}
    <section class="card-section">
      <div class="section-head"><h2>Unsere Apps</h2></div>
      <ul class="rows">${live.map(row).join('')}</ul>
    </section>
    ${
      soon.length
        ? `<section class="card-section">
            <div class="section-head"><h2>Demnächst</h2></div>
            <ul class="rows">${soon.map(row).join('')}</ul>
          </section>`
        : ''
    }`;
}

// ---------- Detailseite ----------
export function detailView(app: FamilyApp): string {
  const status = app.status === 'live' ? 'Fertig' : 'In Arbeit';
  return `
    <nav class="nav-bar">
      <a class="nav-back" href="#/entdecken">${icon('zurueck')}<span>Entdecken</span></a>
    </nav>
    <header class="detail-head">
      ${appIcon(app, 'xl')}
      <div class="detail-title">
        <h1>${esc(app.name)}</h1>
        <p class="detail-sub">${esc(app.untertitel)}</p>
        <div class="detail-action">${actionButton(app, true)}</div>
      </div>
    </header>
    <dl class="facts">
      <div><dt>Kategorie</dt><dd>${esc(app.kategorie)}</dd></div>
      <div><dt>Status</dt><dd>${status}</dd></div>
      <div><dt>Von</dt><dd>Familie Ulfert</dd></div>
    </dl>
    ${
      app.screenshots.length
        ? `<section class="shots-section" aria-label="Bildschirmfotos">
            <div class="shots">${app.screenshots
              .map((s, i) => `<img src="${esc(s)}" alt="${esc(app.name)}, Bildschirmfoto ${i + 1}" loading="lazy" />`)
              .join('')}</div>
          </section>`
        : app.status !== 'live'
          ? `<div class="placeholder" style="--app:${esc(app.farbe)}">${appIcon(app, 'lg')}<p>Diese App bauen wir gerade.</p></div>`
          : ''
    }
    ${app.beschreibung ? `<section class="text-section"><p>${esc(app.beschreibung)}</p></section>` : ''}
    ${
      app.funktionen.length
        ? `<section class="text-section">
            <h2>Das kann sie</h2>
            <ul class="features">${app.funktionen.map((f) => `<li>${icon('check')}<span>${esc(f)}</span></li>`).join('')}</ul>
          </section>`
        : ''
    }
    ${
      app.status === 'live' && isOnHome(app.id)
        ? `<section class="text-section"><button type="button" class="link-danger" data-remove="${esc(app.id)}">Vom Startbildschirm entfernen</button></section>`
        : ''
    }`;
}

export function notFoundView(): string {
  return `
    <nav class="nav-bar"><a class="nav-back" href="#/entdecken">${icon('zurueck')}<span>Entdecken</span></a></nav>
    <div class="empty"><p>Diese App gibt es (noch) nicht.</p></div>`;
}

export function tabBar(active: Tab | null): string {
  const tab = (id: Tab, label: string, href: string) =>
    `<a class="tab${active === id ? ' is-active' : ''}" href="${href}"${active === id ? ' aria-current="page"' : ''}>${icon(id)}<span>${label}</span></a>`;
  return `<nav class="tab-bar" aria-label="Bereiche">${tab('start', 'Übersicht', '#/')}${tab('apps', 'Apps', '#/apps')}${tab('entdecken', 'Entdecken', '#/entdecken')}</nav>`;
}
