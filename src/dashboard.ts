// Dashboard („Übersicht“): die Startseite der Familien-App, aufgebaut aus einzelnen Karten (Widgets).
//
// Neue Karte hinzufügen: eine Funktion schreiben, die HTML liefert (oder null, wenn sie gerade nichts
// zu zeigen hat), und sie in WIDGETS eintragen. Die Reihenfolge in WIDGETS ist die Reihenfolge auf der Seite.
import { APPS, formatDate, greeting } from './apps';
import { isoWeek, sameDay, weekDays } from './dates';
import { homeApps } from './home';
import { icon } from './icons';
import { appIcon, esc } from './views';
import { readJson } from './shared/html';
import { anstehend, gemerkt } from './ausflug/store';
import { shortIso, isoDate } from './ausflug/days';
import { openItems, upcomingDays, type KochbuchData } from './kochbuch';

export interface WidgetContext {
  now: Date;
  /** Wochenplan und Einkaufsliste aus dem Kochbuch (null: auf diesem Gerät noch keine Daten) */
  kochbuch: KochbuchData | null;
}

export interface Widget {
  id: string;
  /** "breit" nimmt auf großen Bildschirmen die ganze Zeile ein */
  breite?: 'breit' | 'normal';
  render(ctx: WidgetContext): string | null;
}

const card = (w: Widget, title: string, body: string, extra = '') =>
  `<section class="widget widget-${w.id}${w.breite === 'breit' ? ' is-wide' : ''}" aria-label="${esc(title)}">
    <header class="widget-head"><h2>${esc(title)}</h2>${extra}</header>
    ${body}
  </section>`;

const DAY = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });

// ---------- Diese Woche ----------
const woche: Widget = {
  id: 'woche',
  breite: 'breit',
  render({ now }) {
    const days = weekDays(now)
      .map((d) => {
        const today = sameDay(d, now);
        const weekend = d.getDay() === 0 || d.getDay() === 6;
        return `<li class="day${today ? ' is-today' : ''}${weekend ? ' is-weekend' : ''}"${today ? ' aria-current="date"' : ''}>
          <span class="day-name">${esc(DAY.format(d).replace('.', ''))}</span>
          <span class="day-num">${d.getDate()}</span>
        </li>`;
      })
      .join('');
    return card(this, 'Diese Woche', `<ol class="week">${days}</ol>`, `<span class="widget-meta">KW ${isoWeek(now)}</span>`);
  },
};

// ---------- Aus dem Kochbuch: Essen und Einkaufsliste ----------
/** Pfad des Kochbuchs, wenn es bei „Apps“ liegt */
const kochbuchPath = () => homeApps(APPS).find((a) => a.id === 'kochbuch')?.path ?? null;
const MAX_ITEMS = 6;

const essen: Widget = {
  id: 'essen',
  render({ now, kochbuch }) {
    const path = kochbuchPath();
    if (!path || !kochbuch) return null;
    const rows = upcomingDays(kochbuch.plan, now)
      .map(
        (d) => `<li class="plan-row${d.label === 'Heute' ? ' is-today' : ''}">
          <span class="plan-label">${esc(d.label)}</span>
          <span class="plan-meals">${
            d.meals.length
              ? d.meals
                  .map((m) => `<a class="meal" href="${esc(path)}#/rezepte/${encodeURIComponent(m.recipeId)}">${esc(m.title || 'Ohne Titel')}</a>`)
                  .join('')
              : `<a class="meal is-empty" href="${esc(path)}#/wochenplan">Noch nichts geplant</a>`
          }</span>
        </li>`,
      )
      .join('');
    return card(this, 'Essen', `<ul class="plan-list">${rows}</ul>`, `<a class="widget-link" href="${esc(path)}#/wochenplan">Wochenplan</a>`);
  },
};

const einkauf: Widget = {
  id: 'einkauf',
  render({ kochbuch }) {
    const path = kochbuchPath();
    if (!path || !kochbuch) return null;
    const open = openItems(kochbuch.shopping);
    const body = open.length
      ? `<ul class="shop-list">${open
          .slice(0, MAX_ITEMS)
          .map((i) => `<li><span class="shop-dot" aria-hidden="true"></span>${esc(i.name)}</li>`)
          .join('')}</ul>${
          open.length > MAX_ITEMS ? `<a class="shop-more" href="${esc(path)}#/einkauf">und ${open.length - MAX_ITEMS} weitere</a>` : ''
        }`
      : `<p class="shop-empty">Nichts offen – alles eingekauft.</p>`;
    return card(this, 'Einkaufsliste', body, `<a class="widget-link" href="${esc(path)}#/einkauf">${open.length ? `${open.length} offen` : 'Öffnen'}</a>`);
  },
};

// ---------- Schnellzugriff auf unsere Apps ----------
const schnellzugriff: Widget = {
  id: 'apps',
  render() {
    const apps = homeApps(APPS);
    if (!apps.length) return null;
    const items = apps
      .map((a) => `<li><a class="quick-app" href="${esc(a.path!)}">${appIcon(a, 'md')}<span>${esc(a.name)}</span></a></li>`)
      .join('');
    return card(this, 'Unsere Apps', `<ul class="quick">${items}</ul>`, `<a class="widget-link" href="#/apps">Alle</a>`);
  },
};

// ---------- Gemerkte Ausflüge (aus der App „Ausflüge“) ----------
const ausfluege: Widget = {
  id: 'ausfluege',
  render({ now }) {
    const list = anstehend(gemerkt(), isoDate(now)).slice(0, 3);
    if (!list.length) return null;
    const items = list
      .map(
        (i) => `<li><a class="mini-row" href="ausflug/">
          <span class="date-badge">${esc(i.datum ? shortIso(i.datum) : 'Jederzeit')}</span>
          <span class="mini-text"><strong>${esc(i.titel)}</strong><span>${esc([i.ort, i.uhrzeit].filter(Boolean).join(' · '))}</span></span>${icon('weiter', 'mini-go')}</a></li>`,
      )
      .join('');
    return card(this, 'Gemerkte Ausflüge', `<ul class="mini-list">${items}</ul>`, `<a class="widget-link" href="ausflug/">Neue suchen</a>`);
  },
};

// ---------- Neu in der Galerie ----------
interface GalerieVorschau {
  anzahl: number;
  neueste: { id: string; titel: string; datum: string; bild: string }[];
}
const galerie: Widget = {
  id: 'galerie',
  render() {
    const v = readJson<GalerieVorschau | null>('galerie-vorschau', null);
    if (!v?.neueste.length) return null;
    const bilder = v.neueste
      .filter((n) => n.bild.startsWith('data:image/'))
      .map((n) => `<li><img src="${esc(n.bild)}" alt="${esc(n.titel || 'Werk')}" /></li>`)
      .join('');
    return card(
      this,
      'Neu in der Galerie',
      `<a href="galerie/" class="thumbs-link"><ul class="thumbs">${bilder}</ul></a>`,
      `<a class="widget-link" href="galerie/">${v.anzahl} ${v.anzahl === 1 ? 'Werk' : 'Werke'}</a>`,
    );
  },
};

// ---------- Demnächst im Store ----------
const demnaechst: Widget = {
  id: 'demnaechst',
  render() {
    const soon = APPS.filter((a) => a.status !== 'live');
    if (!soon.length) return null;
    const items = soon
      .map(
        (a) => `<li><a class="mini-row" href="#/app/${encodeURIComponent(a.id)}">${appIcon(a, 'sm')}
          <span class="mini-text"><strong>${esc(a.name)}</strong><span>${esc(a.untertitel)}</span></span>${icon('weiter', 'mini-go')}</a></li>`,
      )
      .join('');
    return card(this, 'Demnächst', `<ul class="mini-list">${items}</ul>`);
  },
};

// ---------- Hinweis, solange das Dashboard noch wächst ----------
const mehr: Widget = {
  id: 'mehr',
  breite: 'breit',
  render() {
    return `<section class="widget widget-hint is-wide">
      <p><strong>Hier kommt mit der Zeit mehr dazu,</strong> zum Beispiel Termine oder fällige Aufgaben aus unseren Apps.</p>
    </section>`;
  },
};

export const WIDGETS: Widget[] = [woche, essen, einkauf, ausfluege, schnellzugriff, galerie, demnaechst, mehr];

export function dashboardView(now = new Date(), kochbuch: KochbuchData | null = null): string {
  const ctx: WidgetContext = { now, kochbuch };
  const cards = WIDGETS.map((w) => {
    try {
      return w.render(ctx);
    } catch (e) {
      console.error(`Widget ${w.id}:`, e);
      return null;
    }
  })
    .filter(Boolean)
    .join('');
  return `
    <header class="large-head">
      <p class="eyebrow">${esc(formatDate(now))}</p>
      <h1>${esc(greeting(now))}</h1>
      <p class="family">Familie Ulfert</p>
    </header>
    <div class="widgets">${cards}</div>`;
}
