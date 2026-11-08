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
}

let laeuft: Promise<SyncErgebnis> | null = null;

/** Einmal synchronisieren. Läuft schon eine, wird auf sie gewartet. */
export function synchronisieren(onStatus?: (text: string) => void): Promise<SyncErgebnis> {
  laeuft ??= lauf(onStatus).finally(() => (laeuft = null));
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
    for (const w of neu.werke) {
      const lokal = await db.bilder.get(w.id);
      if (lokal && !remoteBilder.has(w.id)) {
        onStatus?.(`Lädt Bild hoch: ${w.titel || 'ohne Titel'}`);
        await gh.write(`${IMG}/${w.id}.jpg`, await blobToBase64(lokal.blob), `Galerie: Bild ${w.titel || w.id}`);
        hoch++;
      } else if (!lokal && remoteBilder.has(w.id)) {
        onStatus?.(`Lädt Bild: ${w.titel || 'ohne Titel'}`);
        const blob = await gh.readBlob(remoteBilder.get(w.id)!.path);
        const jpeg = blob.type ? blob : new Blob([blob], { type: 'image/jpeg' });
        await db.bilder.put({ id: w.id, blob: jpeg, thumb: await thumbFrom(jpeg) });
        runter++;
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
    return { hoch, runter };
  }
  throw new Error('Andere Handys speichern gerade gleichzeitig – bitte gleich noch einmal versuchen.');
}

export const letzteSync = () => readJson<number | null>('galerie-letzte-sync', null);
export { AuthError };
