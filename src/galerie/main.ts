import '@fontsource-variable/fraunces';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/instrument-sans/700.css';
import '../styles.css';
import './galerie.css';
import { icon } from '../icons';
import { backBar, esc, writeJson } from '../shared/html';
import { db, neueId, type Werk } from './db';
import { dataUrl, prepare } from './image';
import { exponat, gerahmt, inventarNummern, KUENSTLERIN, leereWand, plakette, staffelei, TECHNIKEN } from './museum';
import { AuthError, einrichten, letzteSync, synchronisieren, trennen, zugang } from './sync';

const root = document.querySelector<HTMLDivElement>('#app')!;
const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
const MONAT = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const TAG = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

let urls: string[] = [];
let syncText = '';
let syncFehler = false;

// ---------- Gerüst ----------
function shell(): void {
  root.innerHTML = `
    <main class="view sub-view">
      ${backBar()}
      <header class="large-head">
        <p class="eyebrow">Museum Ulfert · Werke von ${KUENSTLERIN}</p>
        <h1>Galerie</h1>
        <p class="sync-line" id="sync"></p>
      </header>
      <div id="werke"></div>
    </main>
    <label class="fab" aria-label="Neues Werk aufhängen">
      ${icon('plus')}
      <input type="file" accept="image/*" multiple id="datei" hidden />
    </label>
    <dialog class="sheet" id="sheet"></dialog>
    <dialog class="viewer" id="viewer"></dialog>`;
}

async function renderWerke(): Promise<void> {
  const werke = (await db.werke.toArray()).sort((a, b) => b.datum.localeCompare(a.datum) || b.erstellt - a.erstellt);
  const bilder = new Map((await db.bilder.toArray()).map((b) => [b.id, b]));
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls = [];
  const el = $('#werke');
  if (!werke.length) {
    el.innerHTML = leereWand();
    return;
  }
  const inv = inventarNummern(werke);
  const img = (w: Werk) => {
    const b = bilder.get(w.id);
    if (!b) return `<span class="leer-bild">${icon('galerie')}</span>`;
    const u = URL.createObjectURL(b.thumb);
    urls.push(u);
    return `<img src="${u}" alt="" loading="lazy" />`;
  };
  // Das zuletzt aufgehängte Werk steht vorn auf der Staffelei
  const neuestes = werke.reduce((a, b) => (b.erstellt > a.erstellt ? b : a));
  // Säle nach Monaten
  const saele = new Map<string, Werk[]>();
  for (const w of werke) {
    const k = w.datum.slice(0, 7);
    saele.set(k, [...(saele.get(k) ?? []), w]);
  }
  el.innerHTML =
    staffelei(neuestes, img(neuestes), inv.get(neuestes.id)) +
    [...saele]
      .map(
        ([monat, list]) => `<section class="saal">
          <h2><span class="saal-schild">Saal ${esc(MONAT.format(parseIso(`${monat}-01`)))}</span><span class="saal-anzahl">${list.length} ${list.length === 1 ? 'Werk' : 'Werke'}</span></h2>
          <ul class="wand">${list.map((w) => exponat(w, img(w), inv.get(w.id))).join('')}</ul>
        </section>`,
      )
      .join('');
  void vorschauSpeichern(werke, bilder);
}

function renderSync(): void {
  const z = zugang();
  const el = $('#sync');
  if (!z) {
    el.innerHTML = `<button type="button" class="link" data-sync="einrichten">${icon('sync')} Synchronisation einrichten</button>`;
    return;
  }
  const t = letzteSync();
  const zeit = t ? `zuletzt ${new Date(t).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}` : 'noch nie';
  el.innerHTML = `<button type="button" class="link${syncFehler ? ' is-error' : ''}" data-sync="jetzt">${icon('sync')} ${esc(syncText || `Synchronisiert ${zeit}`)}</button>`;
}

/** Kleine Vorschau für die Übersicht der Familien-App (liegt im gemeinsamen Speicher) */
async function vorschauSpeichern(werke: Werk[], bilder: Map<string, { thumb: Blob }>): Promise<void> {
  const neueste = await Promise.all(
    werke.slice(0, 4).map(async (w) => ({
      id: w.id,
      titel: w.titel,
      datum: w.datum,
      bild: bilder.get(w.id) ? await dataUrl(bilder.get(w.id)!.thumb, 200).catch(() => '') : '',
    })),
  );
  writeJson('galerie-vorschau', { anzahl: werke.length, neueste });
}

// ---------- Synchronisation ----------
let syncTimer = 0;
function spaeterSync(): void {
  clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => void sync(), 1500);
}

async function sync(): Promise<void> {
  if (!zugang()) return;
  syncFehler = false;
  try {
    const r = await synchronisieren((t) => {
      syncText = t;
      renderSync();
    });
    syncText = '';
    if (r.runter || r.hoch) await renderWerke();
  } catch (e) {
    syncFehler = true;
    syncText = e instanceof AuthError ? 'GitHub-Token ungültig – bitte neu einrichten' : e instanceof Error ? e.message : String(e);
  }
  renderSync();
}

// ---------- Werk anlegen / bearbeiten ----------
function sheetForm(w: Partial<Werk>, vorschau: string, neu: boolean): void {
  const sheet = $<HTMLDialogElement>('#sheet');
  sheet.innerHTML = `
    <form method="dialog" class="sheet-body" id="werk-form">
      <div class="sheet-head">
        <button type="button" class="link" data-close>Abbrechen</button>
        <strong>${neu ? 'Neues Werk aufhängen' : 'Plakette bearbeiten'}</strong>
        <button type="submit" class="link link-strong">${neu ? 'Aufhängen' : 'Sichern'}</button>
      </div>
      ${vorschau ? `<img class="sheet-img" src="${vorschau}" alt="" />` : ''}
      <div class="field"><label class="label" for="titel">Titel</label>
        <input class="input" id="titel" name="titel" value="${esc(w.titel ?? '')}" placeholder="z. B. Sonnenuntergang mit Katze" autocomplete="off" /></div>
      <div class="field"><label class="label" for="technik">Technik</label>
        <select class="input" id="technik" name="technik">
          <option value="">– keine Angabe –</option>
          ${TECHNIKEN.map((t) => `<option${w.technik === t ? ' selected' : ''}>${t}</option>`).join('')}
        </select></div>
      <div class="field"><label class="label" for="datum">Entstanden am</label>
        <input class="input" id="datum" name="datum" type="date" value="${esc(w.datum ?? isoDate(new Date()))}" max="${isoDate(new Date())}" /></div>
      <div class="field"><label class="label" for="notiz">Was ${KUENSTLERIN} dazu sagt</label>
        <textarea class="input" id="notiz" name="notiz" rows="2" placeholder="Was sie dazu erzählt hat …">${esc(w.notiz ?? '')}</textarea></div>
    </form>`;
  sheet.showModal();
}

let neuesBild: { blob: Blob; thumb: Blob } | null = null;
let bearbeiteId: string | null = null;

async function dateienGewaehlt(files: FileList): Promise<void> {
  const list = [...files].filter((f) => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name));
  if (!list.length) return;
  if (list.length === 1) {
    neuesBild = await prepare(list[0]);
    bearbeiteId = null;
    const u = URL.createObjectURL(neuesBild.thumb);
    urls.push(u);
    sheetForm({}, u, true);
    return;
  }
  // Mehrere Bilder: direkt aufnehmen, Titel später ergänzen
  for (const f of list) {
    const b = await prepare(f);
    const id = neueId();
    const now = Date.now();
    const datum = isoDate(new Date(Math.min(f.lastModified || now, now)));
    await db.transaction('rw', db.werke, db.bilder, async () => {
      await db.werke.put({ id, titel: '', datum, notiz: '', erstellt: now, geaendert: now });
      await db.bilder.put({ id, ...b });
    });
  }
  await renderWerke();
  spaeterSync();
}

async function formSichern(form: HTMLFormElement): Promise<void> {
  const data = new FormData(form);
  const titel = String(data.get('titel') ?? '').trim();
  const datum = String(data.get('datum') || isoDate(new Date()));
  const notiz = String(data.get('notiz') ?? '').trim();
  const technik = String(data.get('technik') ?? '').trim();
  const now = Date.now();
  if (bearbeiteId) {
    await db.werke.update(bearbeiteId, { titel, datum, notiz, technik, geaendert: now });
  } else if (neuesBild) {
    const id = neueId();
    const bild = neuesBild;
    await db.transaction('rw', db.werke, db.bilder, async () => {
      await db.werke.put({ id, titel, datum, notiz, technik, erstellt: now, geaendert: now });
      await db.bilder.put({ id, ...bild });
    });
  }
  neuesBild = null;
  bearbeiteId = null;
  await renderWerke();
  spaeterSync();
}

// ---------- Großansicht ----------
async function zeigeWerk(id: string): Promise<void> {
  const w = await db.werke.get(id);
  if (!w) return;
  const b = await db.bilder.get(id);
  const viewer = $<HTMLDialogElement>('#viewer');
  const u = b ? URL.createObjectURL(b.blob) : '';
  if (u) urls.push(u);
  const inv = inventarNummern(await db.werke.toArray()).get(id);
  viewer.innerHTML = `
    <div class="viewer-body">
      <div class="viewer-top"><button type="button" class="round" data-close aria-label="Schließen">${icon('schliessen')}</button></div>
      <div class="viewer-bild">${gerahmt(w, u ? `<img src="${u}" alt="${esc(w.titel)}" />` : `<span class="leer-bild">${icon('galerie')}</span>`)}</div>
      ${plakette(w, inv, 'gross')}
      <p class="viewer-date">Entstanden am ${esc(TAG.format(parseIso(w.datum)))}</p>
      <div class="viewer-actions">
        ${b && 'share' in navigator ? `<button type="button" class="act" data-teilen="${esc(id)}">${icon('teilen')}<span>Teilen</span></button>` : ''}
        <button type="button" class="act" data-bearbeiten="${esc(id)}">${icon('stift')}<span>Plakette bearbeiten</span></button>
        <button type="button" class="act act-danger" data-loeschen="${esc(id)}">${icon('muell')}<span>Abhängen</span></button>
      </div>
    </div>`;
  viewer.showModal();
}

async function loeschen(id: string): Promise<void> {
  const w = await db.werke.get(id);
  if (!confirm(`„${w?.titel || 'Dieses Werk'}“ abhängen? Das Bild wird gelöscht und verschwindet auf allen Handys.`)) return;
  await db.transaction('rw', db.werke, db.bilder, db.geloescht, async () => {
    await db.werke.delete(id);
    await db.bilder.delete(id);
    await db.geloescht.put({ id, zeit: Date.now() });
  });
  $<HTMLDialogElement>('#viewer').close();
  await renderWerke();
  spaeterSync();
}

async function teilen(id: string): Promise<void> {
  const w = await db.werke.get(id);
  const b = await db.bilder.get(id);
  if (!w || !b) return;
  const file = new File([b.blob], `${(w.titel || 'Werk').replace(/[^\wäöüÄÖÜß -]/g, '')}.jpg`, { type: 'image/jpeg' });
  try {
    await navigator.share({ files: [file], title: w.titel || 'Aus unserer Galerie', text: w.titel ? `${w.titel} (${TAG.format(parseIso(w.datum))})` : undefined });
  } catch {
    /* abgebrochen */
  }
}

// ---------- Synchronisation einrichten ----------
function syncSheet(): void {
  const sheet = $<HTMLDialogElement>('#sheet');
  const z = zugang();
  sheet.innerHTML = `
    <form method="dialog" class="sheet-body" id="sync-form">
      <div class="sheet-head">
        <button type="button" class="link" data-close>Abbrechen</button>
        <strong>Synchronisation</strong>
        <button type="submit" class="link link-strong">Verbinden</button>
      </div>
      <p class="fine">Die Galerie nutzt dasselbe private GitHub-Daten-Repository wie das Kochbuch (Ordner <code>galerie/</code>). Ist die Synchronisation im Kochbuch eingerichtet, übernimmt die Galerie sie automatisch.</p>
      <div class="field"><label class="label" for="repo">Daten-Repository</label>
        <input class="input" id="repo" name="repo" placeholder="benutzer/kochbuch-daten" value="${esc(z?.repo ?? '')}" autocomplete="off" autocapitalize="off" /></div>
      <div class="field"><label class="label" for="token">Token</label>
        <input class="input" id="token" name="token" type="password" placeholder="github_pat_…" autocomplete="off" /></div>
      <p class="fine" id="sync-msg"></p>
      ${z?.quelle === 'galerie' ? '<button type="button" class="link is-error" data-sync="trennen">Verbindung trennen</button>' : ''}
    </form>`;
  sheet.showModal();
}

// ---------- Ereignisse ----------
root.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.id === 'datei' && t.files?.length) {
    void dateienGewaehlt(t.files).catch((err) => alert(err instanceof Error ? err.message : String(err)));
    t.value = '';
  }
});

root.addEventListener('submit', (e) => {
  const form = e.target as HTMLFormElement;
  if (form.id === 'werk-form') void formSichern(form);
  if (form.id === 'sync-form') {
    e.preventDefault();
    const d = new FormData(form);
    const msg = $('#sync-msg');
    msg.textContent = 'Prüft …';
    einrichten(String(d.get('repo') ?? ''), String(d.get('token') ?? ''))
      .then(() => {
        $<HTMLDialogElement>('#sheet').close();
        renderSync();
        void sync();
      })
      .catch((err) => (msg.textContent = err instanceof Error ? err.message : String(err)));
  }
});

root.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const dialog = t.closest('dialog');
  if (t.closest('[data-close]') && dialog) {
    dialog.close();
    return;
  }
  // Tipp auf den dunklen Hintergrund schließt die Großansicht
  if (t.classList.contains('viewer') || t.classList.contains('viewer-body')) {
    (t.closest('dialog') as HTMLDialogElement).close();
    return;
  }
  const werk = t.closest<HTMLButtonElement>('[data-werk]');
  if (werk) return void zeigeWerk(werk.dataset.werk!);
  const bearb = t.closest<HTMLButtonElement>('[data-bearbeiten]');
  if (bearb) {
    const id = bearb.dataset.bearbeiten!;
    $<HTMLDialogElement>('#viewer').close();
    void db.werke.get(id).then((w) => {
      if (!w) return;
      bearbeiteId = id;
      neuesBild = null;
      sheetForm(w, '', false);
    });
    return;
  }
  const del = t.closest<HTMLButtonElement>('[data-loeschen]');
  if (del) return void loeschen(del.dataset.loeschen!);
  const share = t.closest<HTMLButtonElement>('[data-teilen]');
  if (share) return void teilen(share.dataset.teilen!);
  const s = t.closest<HTMLButtonElement>('[data-sync]');
  if (s) {
    if (s.dataset.sync === 'einrichten') syncSheet();
    else if (s.dataset.sync === 'trennen') {
      trennen();
      $<HTMLDialogElement>('#sheet').close();
      renderSync();
    } else if (syncFehler && /Token/.test(syncText)) syncSheet();
    else void sync();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void sync();
});
window.addEventListener('online', () => void sync());

shell();
renderSync();
void renderWerke().then(sync);
