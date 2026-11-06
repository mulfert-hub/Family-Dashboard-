// App-Verzeichnis der Familie: liest apps.json und bereitet die Einträge für die Startseite auf.
import data from '../apps.json';

export type AppStatus = 'live' | 'bald';

export interface FamilyApp {
  id: string;
  name: string;
  beschreibung: string;
  icon: string;
  farbe: string;
  status: AppStatus;
  /** Pfad relativ zur Startseite, z. B. "kochbuch/" (nur bei status "live") */
  path?: string;
  /** Eigenes Repository, aus dem die App beim Veröffentlichen gebaut wird */
  repo?: string;
  branch?: string;
}

export function parseApps(raw: unknown): FamilyApp[] {
  const list = (raw as { apps?: unknown })?.apps;
  if (!Array.isArray(list)) throw new Error('apps.json: Feld "apps" fehlt');
  const ids = new Set<string>();
  return list.map((a, i) => {
    const app = a as Partial<FamilyApp>;
    if (!app.id || !app.name) throw new Error(`apps.json: Eintrag ${i + 1} braucht "id" und "name"`);
    if (ids.has(app.id)) throw new Error(`apps.json: "${app.id}" kommt doppelt vor`);
    ids.add(app.id);
    if (app.status !== 'live' && app.status !== 'bald') throw new Error(`apps.json: "${app.id}" hat einen unbekannten Status`);
    if (app.status === 'live' && !app.path) throw new Error(`apps.json: "${app.id}" ist live, aber ohne "path"`);
    if (app.path && !/^[a-z0-9-]+\/$/.test(app.path)) throw new Error(`apps.json: "${app.id}" – path muss wie "name/" aussehen`);
    return {
      id: app.id,
      name: app.name,
      beschreibung: app.beschreibung ?? '',
      icon: app.icon ?? app.id,
      farbe: app.farbe ?? '#8c847b',
      status: app.status,
      path: app.path,
      repo: app.repo,
      branch: app.branch,
    };
  });
}

export const APPS: FamilyApp[] = parseApps(data);

/** Begrüßung passend zur Tageszeit */
export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Hallo';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}

export function formatDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}
