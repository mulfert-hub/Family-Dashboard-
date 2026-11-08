import '@fontsource-variable/fraunces';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/instrument-sans/700.css';
import '../styles.css';
import './ausflug.css';
import { icon } from '../icons';
import { backBar, esc, readJson, writeJson } from '../shared/html';
import { AusflugError, getApiKey, KATEGORIEN, setApiKey, sucheAusfluege, type Idee, type Kategorie } from './claude';
import { daysFor, isoDate, shortIso, type Wann } from './days';
import { lastOrt, ortText, ortVonGps, ortVonName, saveOrt, type Ort } from './location';
import { anstehend, gemerkt, ideeId, istGemerkt, letzteSuche, merken, speichereSuche, type LetzteSuche } from './store';
import { wetterFuer } from './weather';

// ---------- Zustand ----------
interface Einstellungen {
  wann: Wann;
  tag: string;
  umkreisKm: number;
  interessen: Kategorie[];
  wuensche: string;
  eigenerOrt: string; // leer = Handy-Standort
}
const PREFS = 'ausflug-einstellungen';
const prefs: Einstellungen = {
  wann: 'wochenende',
  tag: isoDate(new Date()),
  umkreisKm: 60,
  interessen: [],
  wuensche: '',
  eigenerOrt: '',
  ...readJson<Partial<Einstellungen>>(PREFS, {}),
};
const savePrefs = () => writeJson(PREFS, prefs);

let ansicht: 'ergebnisse' | 'gemerkt' = 'ergebnisse';
let laeuft: { start: number; log: { art: string; text: string }[]; abort: AbortController; timer: number } | null = null;
let fehler: string | null = null;

const root = document.querySelector<HTMLDivElement>('#app')!;
const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

// ---------- Gerüst (einmal), Teile werden einzeln aktualisiert ----------
function shell(): void {
  const chips = (Object.keys(KATEGORIEN) as Kategorie[])
    .filter((k) => k !== 'sonstiges')
    .map((k) => `<button type="button" class="chip" data-interesse="${k}" aria-pressed="${prefs.interessen.includes(k)}">${esc(KATEGORIEN[k])}</button>`)
    .join('');
  const wann = (
    [
      ['heute', 'Heute'],
      ['morgen', 'Morgen'],
      ['wochenende', 'Wochenende'],
      ['tag', 'Datum'],
    ] as const
  )
    .map(([v, l]) => `<button type="button" class="seg" data-wann="${v}" aria-pressed="${prefs.wann === v}">${l}</button>`)
    .join('');
  root.innerHTML = `
    <main class="view sub-view">
      ${backBar()}
      <header class="large-head">
        <p class="eyebrow">Was ist los in der Nähe?</p>
        <h1>Ausflüge</h1>
      </header>

      <section class="widget form-card" aria-label="Suche">
        <div class="field">
          <span class="label">Wo</span>
          <div class="ort-row" id="ort"></div>
        </div>
        <div class="field">
          <span class="label">Wann</span>
          <div class="segments" role="group" aria-label="Wann">${wann}</div>
          <input type="date" class="input" id="tag" value="${esc(prefs.tag)}" min="${isoDate(new Date())}" ${prefs.wann === 'tag' ? '' : 'hidden'} />
        </div>
        <div class="field">
          <label class="label" for="umkreis">Umkreis <strong id="umkreis-wert">${prefs.umkreisKm} km</strong></label>
          <input type="range" id="umkreis" min="5" max="100" step="5" value="${prefs.umkreisKm}" />
        </div>
        <div class="field">
          <span class="label">Was <span class="hint">(nichts gewählt = alles)</span></span>
          <div class="chips">${chips}</div>
        </div>
        <div class="field">
          <label class="label" for="wuensche">Wünsche</label>
          <textarea class="input" id="wuensche" rows="2" placeholder="z. B. für ein Kind, nicht zu teuer, mit Hund">${esc(prefs.wuensche)}</textarea>
        </div>
        <div id="schluessel"></div>
        <button type="button" class="pill pill-big pill-wide" id="suchen">Ausflüge suchen</button>
        <p class="fine">Eine Suche dauert etwa 1–3 Minuten. Claude durchsucht dafür viele Seiten; das kostet über euren Claude-Schlüssel etwa 20–60 Cent.</p>
      </section>

      <div class="segments tabs-inline" role="tablist">
        <button type="button" class="seg" role="tab" data-ansicht="ergebnisse">Ergebnisse</button>
        <button type="button" class="seg" role="tab" data-ansicht="gemerkt">Gemerkt</button>
      </div>
      <section id="ausgabe" aria-live="polite"></section>
    </main>`;
  renderOrt();
  renderSchluessel();
  renderAusgabe();
}

function renderOrt(): void {
  const o = lastOrt();
  const el = $('#ort');
  if (prefs.eigenerOrt) {
    el.innerHTML = `<span class="ort-text">${icon('standort')}${esc(prefs.eigenerOrt)}</span>
      <button type="button" class="link" data-ort="gps">Handy-Standort nutzen</button>`;
  } else {
    el.innerHTML = `<span class="ort-text">${icon('standort')}${o && o.quelle === 'gps' ? `Standort: ${esc(ortText(o))}` : 'Aktueller Standort des Handys'}</span>
      <button type="button" class="link" data-ort="eingabe">Anderer Ort</button>`;
  }
}

function renderSchluessel(): void {
  const el = $('#schluessel');
  if (getApiKey()) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `<div class="key-box">
      <p><strong>Claude-Schlüssel fehlt.</strong> Er wird mit dem Kochbuch geteilt: Einmal eintragen genügt für beide Apps. Erstellen auf console.anthropic.com unter „API Keys“.</p>
      <div class="key-row"><input class="input" id="key" type="password" autocomplete="off" placeholder="sk-ant-…" /><button type="button" class="pill" id="key-save">Speichern</button></div>
    </div>`;
}

// ---------- Ausgabe: Fortschritt, Fehler, Ergebnisse oder Gemerktes ----------
function renderAusgabe(): void {
  root.querySelectorAll<HTMLButtonElement>('[data-ansicht]').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.ansicht === ansicht));
    if (b.dataset.ansicht === 'gemerkt') b.textContent = `Gemerkt${gemerkt().length ? ` (${gemerkt().length})` : ''}`;
  });
  const out = $('#ausgabe');
  const btn = $<HTMLButtonElement>('#suchen');
  btn.disabled = !!laeuft;
  btn.textContent = laeuft ? 'Sucht …' : 'Ausflüge suchen';

  if (ansicht === 'gemerkt') {
    const list = anstehend(gemerkt(), isoDate(new Date()));
    out.innerHTML = list.length
      ? `<ul class="ideen">${list.map((i) => ideeCard(i)).join('')}</ul>`
      : `<div class="empty"><p>Noch nichts gemerkt. Tippe bei einer Idee auf den Stern.</p></div>`;
    return;
  }
  if (laeuft) {
    const sek = Math.round((Date.now() - laeuft.start) / 1000);
    const log = laeuft.log.slice(-6).reverse();
    out.innerHTML = `<div class="widget progress">
        <div class="progress-head"><span class="spinner" aria-hidden="true"></span><strong>Claude sucht Ausflüge …</strong><span class="widget-meta">${sek} s</span></div>
        <ul class="log">${
          log.length
            ? log.map((l) => `<li>${l.art === 'suche' ? 'Sucht' : 'Liest'}: <span>${esc(l.text)}</span></li>`).join('')
            : '<li>Ermittelt Standort und Wetter …</li>'
        }</ul>
        <button type="button" class="link" id="abbrechen">Abbrechen</button>
      </div>`;
    return;
  }
  const s = letzteSuche();
  out.innerHTML = `${fehler ? `<div class="widget error" role="alert">${esc(fehler)}</div>` : ''}${s ? ergebnisHtml(s) : fehler ? '' : `<div class="empty"><p>Wähle oben, wann und wohin, und tippe auf „Ausflüge suchen“.</p></div>`}`;
}

function ergebnisHtml(s: LetzteSuche): string {
  const wetter = s.wetter.length
    ? `<ul class="wetter">${s.wetter.map((w) => `<li><strong>${esc(shortIso(w.datum))}</strong> ${esc(w.text)}, ${w.tmin}–${w.tmax} °C${w.regen >= 30 ? `, Regen ${w.regen} %` : ''}</li>`).join('')}</ul>`
    : '';
  const kosten = `${s.kosten.dollar.toFixed(2).replace('.', ',')} $`;
  return `
    <div class="result-head">
      <p><strong>${esc(s.ort)}</strong> · bis ${s.umkreisKm} km · ${s.tage.map((t) => esc(shortIso(t))).join(' + ')}</p>
      ${wetter}
    </div>
    ${s.ergebnis.hinweis ? `<p class="hinweis">${esc(s.ergebnis.hinweis)}</p>` : ''}
    ${
      s.ergebnis.ideen.length
        ? `<ul class="ideen">${s.ergebnis.ideen.map((i) => ideeCard(i)).join('')}</ul>`
        : `<div class="empty"><p>Leider nichts Passendes gefunden. Vielleicht mit größerem Umkreis?</p></div>`
    }
    <p class="fine center">Gesucht ${new Date(s.zeit).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} · ${s.kosten.suchen} Websuchen · ca. ${kosten}<br />Angaben ohne Gewähr – vor dem Losfahren bitte auf der Quelle prüfen.</p>`;
}

function ideeCard(i: Idee): string {
  const id = ideeId(i);
  const star = istGemerkt(i);
  const wann = [i.datum ? shortIso(i.datum) : i.typ === 'ausflugsziel' ? 'Jederzeit' : null, i.uhrzeit].filter(Boolean).join(' · ');
  const wo = [i.ort, i.entfernung_km != null ? `ca. ${Math.round(i.entfernung_km)} km` : null].filter(Boolean).join(' · ');
  const karte = `https://maps.apple.com/?q=${encodeURIComponent([i.titel, i.adresse ?? i.ort].join(', '))}`;
  return `<li class="widget idee" data-kat="${esc(i.kategorie)}">
      <div class="idee-top">
        <span class="tag tag-${esc(i.kategorie)}">${esc(KATEGORIEN[i.kategorie] ?? i.kategorie)}</span>
        ${i.drinnen ? '<span class="tag tag-plain">drinnen</span>' : ''}
        <span class="idee-wann">${esc(wann)}</span>
      </div>
      <h3>${esc(i.titel)}</h3>
      <p class="idee-wo">${esc(wo)}</p>
      <p class="idee-text">${esc(i.beschreibung)}</p>
      ${i.fuer_kinder ? `<p class="idee-kind"><strong>Für Kinder:</strong> ${esc(i.fuer_kinder)}</p>` : ''}
      ${i.kosten ? `<p class="idee-kosten">${esc(i.kosten)}</p>` : ''}
      <div class="idee-actions">
        <button type="button" class="act${star ? ' is-on' : ''}" data-merken="${esc(id)}" aria-pressed="${star}">${icon('stern')}<span>${star ? 'Gemerkt' : 'Merken'}</span></button>
        <a class="act" href="${esc(karte)}" target="_blank" rel="noopener">${icon('karte')}<span>Karte</span></a>
        ${/^https?:\/\//.test(i.quelle_url) ? `<a class="act" href="${esc(i.quelle_url)}" target="_blank" rel="noopener">${icon('link')}<span>${esc(i.quelle_name || 'Quelle')}</span></a>` : ''}
      </div>
    </li>`;
}

// ---------- Suche ----------
async function suchen(): Promise<void> {
  if (laeuft) return;
  if (!getApiKey()) {
    renderSchluessel();
    $<HTMLInputElement>('#key')?.focus();
    return;
  }
  fehler = null;
  ansicht = 'ergebnisse';
  const abort = new AbortController();
  laeuft = { start: Date.now(), log: [], abort, timer: window.setInterval(renderAusgabe, 1000) };
  renderAusgabe();
  zurAusgabe();
  try {
    let ort: Ort;
    if (prefs.eigenerOrt) ort = await ortVonName(prefs.eigenerOrt);
    else {
      ort = await ortVonGps();
      saveOrt(ort);
      renderOrt();
    }
    const tage = daysFor(prefs.wann, new Date(), prefs.tag);
    const wetter = await wetterFuer(ort.lat, ort.lon, tage).catch(() => []);
    const { ergebnis, kosten } = await sucheAusfluege(
      { ort, tage, umkreisKm: prefs.umkreisKm, interessen: prefs.interessen, wuensche: prefs.wuensche, wetter },
      (f) => {
        laeuft?.log.push(f);
        renderAusgabe();
      },
      abort.signal,
    );
    speichereSuche({ zeit: Date.now(), ort: ortText(ort), tage: tage.map(isoDate), umkreisKm: prefs.umkreisKm, ergebnis, kosten, wetter });
  } catch (e) {
    fehler = e instanceof Error ? e.message : String(e);
    if (e instanceof AusflugError && e.kind === 'auth') {
      if (/ungültig/.test(e.message)) setApiKey('');
      renderSchluessel();
    }
  } finally {
    if (laeuft) clearInterval(laeuft.timer);
    laeuft = null;
    renderAusgabe();
    zurAusgabe();
  }
}

/** Fortschritt bzw. Ergebnisse in den sichtbaren Bereich holen (das Formular ist lang) */
function zurAusgabe(): void {
  const el = root.querySelector('.tabs-inline');
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 70;
  window.scrollTo({ top: y, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

// ---------- Ereignisse ----------
root.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const wann = t.closest<HTMLButtonElement>('[data-wann]');
  if (wann) {
    prefs.wann = wann.dataset.wann as Wann;
    savePrefs();
    root.querySelectorAll('[data-wann]').forEach((b) => b.setAttribute('aria-pressed', String(b === wann)));
    $<HTMLInputElement>('#tag').hidden = prefs.wann !== 'tag';
    return;
  }
  const chip = t.closest<HTMLButtonElement>('[data-interesse]');
  if (chip) {
    const k = chip.dataset.interesse as Kategorie;
    prefs.interessen = prefs.interessen.includes(k) ? prefs.interessen.filter((x) => x !== k) : [...prefs.interessen, k];
    chip.setAttribute('aria-pressed', String(prefs.interessen.includes(k)));
    savePrefs();
    return;
  }
  const ort = t.closest<HTMLButtonElement>('[data-ort]');
  if (ort) {
    if (ort.dataset.ort === 'gps') prefs.eigenerOrt = '';
    else {
      const name = prompt('Von welchem Ort aus suchen? (Ort oder Postleitzahl)', lastOrt()?.name ?? '');
      if (!name?.trim()) return;
      prefs.eigenerOrt = name.trim();
    }
    savePrefs();
    renderOrt();
    return;
  }
  const merk = t.closest<HTMLButtonElement>('[data-merken]');
  if (merk) {
    const id = merk.dataset.merken!;
    const quelle = [...(letzteSuche()?.ergebnis.ideen ?? []), ...gemerkt()].find((i) => ideeId(i) === id);
    if (quelle) merken(quelle, !istGemerkt(quelle));
    renderAusgabe();
    return;
  }
  const tab = t.closest<HTMLButtonElement>('[data-ansicht]');
  if (tab) {
    ansicht = tab.dataset.ansicht as typeof ansicht;
    renderAusgabe();
    return;
  }
  if (t.closest('#suchen')) void suchen();
  if (t.closest('#abbrechen')) laeuft?.abort.abort();
  if (t.closest('#key-save')) {
    const v = $<HTMLInputElement>('#key').value.trim();
    if (!v.startsWith('sk-ant-')) {
      alert('Das sieht nicht wie ein Claude-API-Schlüssel aus (beginnt mit „sk-ant-“).');
      return;
    }
    setApiKey(v);
    fehler = null;
    renderSchluessel();
    renderAusgabe();
  }
});

root.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.id === 'umkreis') {
    prefs.umkreisKm = Number(t.value);
    $('#umkreis-wert').textContent = `${prefs.umkreisKm} km`;
  } else if (t.id === 'wuensche') prefs.wuensche = t.value;
  else if (t.id === 'tag') prefs.tag = t.value;
  else return;
  savePrefs();
});

// Gemerkte Ausflüge, deren Datum vorbei ist, fallen in der Ansicht automatisch weg
shell();

