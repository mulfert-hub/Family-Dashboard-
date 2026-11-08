// Synchronisation der Galerie über das private GitHub-Daten-Repository.
// Nutzt dieselben Zugangsdaten wie das Kochbuch, falls dort eingerichtet; die Galerie liegt im
// Ordner galerie/ und berührt die Dateien des Kochbuchs (kochbuch.json, bilder/) nicht.
import { readJson, writeJson } from '../shared/html';
import { AuthError, blobToBase64, ConflictError, GitHubClient, parseRepo, textToBase64 } from '../shared/github';
import { db } from './db';
import { thumbFrom } from './image';
import { leererStand, zusammenfuehren, type Stand } from './merge';

const DIR = 'galerie';
const DATA = `${DIR}/galerie.json`;
const IMG = `${DIR}/bilder`;
const OWN = 'galerie-sync-github';
const KOCHBUCH = 'kochbuch-sync-github';

interface Zugang {
  repo: string;
  token: string;
}

export function zugang(): (Zugang & { quelle: 'galerie' | 'kochbuch' }) | null {
  const own = readJson<Partial<Zugang>>(OWN, {});
  if (own.repo && own.token) return { repo: own.repo, token: own.token, quelle: 'galerie' };
  const k = readJson<Partial<Zugang> & { enabled?: boolean }>(KOCHBUCH, {});
  if (k.enabled && k.repo && k.token) return { repo: k.repo, token: k.token, quelle: 'kochbuch' };
  return null;
}

export async function einrichten(repoText: string, token: string): Promise<void> {
  const r = parseRepo(repoText);
  if (!r) throw new Error('Repository bitte als „benutzer/name“ angeben.');
  const gh = new GitHubClient(token.trim(), r.owner, r.repo);
  const info = await gh.checkRepo();
  if (!info.private) throw new Error('Das Repository ist öffentlich. Für Familienfotos bitte ein privates Repository verwenden.');
  if (!info.canWrite) throw new Error('Der Token darf in dieses Repository nicht schreiben.');
  writeJson(OWN, { repo: `${r.owner}/${r.repo}`, token: token.trim() });
}

export function trennen(): void {
  try {
    localStorage.removeItem(OWN);
  } catch {
    /* ignorieren */
  }
}

async function lokalerStand(): Promise<Stand> {
  return { version: 1, werke: await db.werke.toArray(), geloescht: await db.geloescht.toArray() };
}

export interface SyncErgebnis {
  hoch: number;
  runter: number;
  /** Bilder, die gerade nicht übertragen werden konnten (nächster Versuch beim nächsten Abgleich) */
  fehlend: number;
  /** Hat sich auf diesem Handy etwas geändert (neue, geänderte oder gelöschte Werke)? */
  geaendert: boolean;
}

const stempel = async () =>
  (await db.werke.toArray())
    .map((w) => `${w.id}:${w.geaendert}`)
    .sort()
    .join('|');

let laeuft: Promise<SyncErgebnis> | null = null;
let nochmal = false;

/**
 * Synchronisieren. Läuft schon eine, wird danach direkt noch einmal synchronisiert –
 * sonst blieben Bilder liegen, die während des Abgleichs dazugekommen sind.
 */
export function synchronisieren(onStatus?: (text: string) => void): Promise<SyncErgebnis> {
  if (laeuft) {
    nochmal = true;
    return laeuft;
  }
  laeuft = (async () => {
    let gesamt: SyncErgebnis = { hoch: 0, runter: 0, fehlend: 0, geaendert: false };
    do {
      nochmal = false;
      const r = await lauf(onStatus);
      gesamt = { hoch: gesamt.hoch + r.hoch, runter: gesamt.runter + r.runter, fehlend: r.fehlend, geaendert: gesamt.geaendert || r.geaendert };
    } while (nochmal);
    return gesamt;
  })().finally(() => (laeuft = null));
  return laeuft;
}

async function lauf(onStatus?: (text: string) => void): Promise<SyncErgebnis> {
  const z = zugang();
  if (!z) throw new Error('Keine Synchronisation eingerichtet.');
  if (!navigator.onLine) throw new Error('Offline – wird später synchronisiert.');
  const r = parseRepo(z.repo)!;
  const gh = new GitHubClient(z.token, r.owner, r.repo);
  let hoch = 0;
  let runter = 0;
  let fehlend = 0;
  const vorher = await stempel();

  for (let versuch = 0; versuch < 4; versuch++) {
    onStatus?.('Synchronisiert …');
    const remote = await gh.readText(DATA);
    const remoteStand: Stand = remote ? { ...leererStand(), ...(JSON.parse(remote.text) as Partial<Stand>) } : leererStand();
    const neu = zusammenfuehren(await lokalerStand(), remoteStand);

    // 1. Lokal übernehmen
    await db.transaction('rw', db.werke, db.bilder, db.geloescht, async () => {
      const ids = new Set(neu.werke.map((w) => w.id));
      const weg = (await db.werke.toCollection().primaryKeys()).filter((id) => !ids.has(id));
      await db.werke.bulkDelete(weg);
      await db.bilder.bulkDelete(weg);
      await db.werke.bulkPut(neu.werke);
      await db.geloescht.bulkPut(neu.geloescht);
    });

    // 2. Bilder abgleichen (erst hochladen, dann die Liste schreiben – so fehlt anderen Handys nie ein Bild)
    const remoteBilder = new Map((await gh.list(IMG)).map((f) => [f.path.slice(IMG.length + 1).replace(/\.\w+$/, ''), f]));
    fehlend = 0;
    for (const w of neu.werke) {
      const lokal = await db.bilder.get(w.id);
      try {
        if (lokal && !remoteBilder.has(w.id)) {
          onStatus?.(`Lädt Bild hoch: ${w.titel || 'ohne Titel'}`);
          try {
            await gh.write(`${IMG}/${w.id}.jpg`, await blobToBase64(lokal.blob), `Galerie: Bild ${w.titel || w.id}`);
          } catch (e) {
            // Gibt es die Datei schon (z. B. von einem abgebrochenen Versuch), ist das in Ordnung
            if (!(e instanceof ConflictError)) throw e;
          }
          hoch++;
        } else if (!lokal && remoteBilder.has(w.id)) {
          onStatus?.(`Lädt Bild: ${w.titel || 'ohne Titel'}`);
          const blob = await gh.readBlob(remoteBilder.get(w.id)!.path);
          const jpeg = blob.type.startsWith('image/') ? blob : new Blob([blob], { type: 'image/jpeg' });
          await db.bilder.put({ id: w.id, blob: jpeg, thumb: await thumbFrom(jpeg) });
          runter++;
        } else if (!lokal) {
          fehlend++; // Bild ist noch auf keinem Server – das andere Handy lädt es hoffentlich gleich hoch
        }
      } catch (e) {
        if (e instanceof AuthError) throw e;
        console.warn('Galerie: Bild nicht übertragen', w.id, e);
        fehlend++;
      }
    }

    // 3. Liste schreiben, falls sich etwas geändert hat
    const text = JSON.stringify(neu, null, 1);
    if (!remote || remote.text !== text) {
      try {
        await gh.write(DATA, textToBase64(text), 'Galerie aktualisiert', remote?.sha);
      } catch (e) {
        if (e instanceof ConflictError) continue; // anderes Handy war schneller → neu zusammenführen
        throw e;
      }
    }

    // 4. Bilder gelöschter Werke entfernen
    const lebend = new Set(neu.werke.map((w) => w.id));
    for (const g of neu.geloescht) {
      const f = remoteBilder.get(g.id);
      if (f && !lebend.has(g.id)) await gh.remove(f.path, f.sha, 'Galerie: Bild entfernt').catch(() => {});
    }
    writeJson('galerie-letzte-sync', Date.now());
    return { hoch, runter, fehlend, geaendert: (await stempel()) !== vorher };
  }
  throw new Error('Andere Handys speichern gerade gleichzeitig – bitte gleich noch einmal versuchen.');
}

export const letzteSync = () => readJson<number | null>('galerie-letzte-sync', null);
export { AuthError };
