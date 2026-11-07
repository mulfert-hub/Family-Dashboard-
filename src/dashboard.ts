// Dashboard („Übersicht“): die Startseite der Familien-App, aufgebaut aus einzelnen Karten (Widgets).
//
// Neue Karte hinzufügen: eine Funktion schreiben, die HTML liefert (oder null, wenn sie gerade nichts
// zu zeigen hat), und sie in WIDGETS eintragen. Die Reihenfolge in WIDGETS ist die Reihenfolge auf der Seite.
import { APPS, formatDate, greeting } from './apps';
import { isoWeek, sameDay, weekDays } from './dates';
import { homeApps } from './home';
import { icon } from './icons';
import { appIcon, esc } from './views';

export interface WidgetContext {
  now: Date;
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
      <p><strong>Hier kommt mit der Zeit mehr dazu,</strong> zum Beispiel Termine, die Einkaufsliste oder fällige Aufgaben aus unseren Apps.</p>
    </section>`;
  },
};

export const WIDGETS: Widget[] = [woche, schnellzugriff, demnaechst, mehr];

export function dashboardView(now = new Date()): string {
  const ctx: WidgetContext = { now };
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
