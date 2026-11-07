// Wochenplan und Einkaufsliste aus dem Kochbuch für den Startbildschirm.
//
// Das Kochbuch läuft unter derselben Adresse (…/kochbuch/) und speichert in IndexedDB „kochbuch“
// (Tabellen „plan“ und „shopping“). In der installierten „Familie Ulfert“-App teilen sich Startseite und
// Kochbuch diesen Speicher – deshalb kann die Startseite die Daten direkt lesen, ohne Zugangsdaten und offline.
// Nur lesen: Geschrieben wird ausschließlich vom Kochbuch selbst.

export interface PlanEntry {
  id: string;
  /** „JJJJ-MM-TT“ in Ortszeit */
  date: string;
  recipeId: string;
  title: string;
  order: number;
}

export interface ShopItem {
  id: string;
  name: string;
  checked: boolean;
  order: number;
}

export interface KochbuchData {
  plan: PlanEntry[];
  shopping: ShopItem[];
}

const DB_NAME = 'kochbuch';

/** Liest Wochenplan und Einkaufsliste. null, wenn das Kochbuch auf diesem Gerät noch nie geöffnet wurde. */
export function readKochbuch(): Promise<KochbuchData | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME);
    } catch {
      return resolve(null);
    }
    // Gibt es die Datenbank noch nicht, würde open() sie anlegen – das verhindern wir,
    // damit das Kochbuch beim ersten Start sauber seine eigene Datenbank einrichtet.
    req.onupgradeneeded = () => req.transaction?.abort();
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      const stores = ['plan', 'shopping'].filter((s) => db.objectStoreNames.contains(s));
      if (!stores.length) {
        db.close();
        return resolve({ plan: [], shopping: [] });
      }
      const out: KochbuchData = { plan: [], shopping: [] };
      try {
        const tx = db.transaction(stores, 'readonly');
        for (const s of stores) {
          const r = tx.objectStore(s).getAll();
          r.onsuccess = () => {
            if (s === 'plan') out.plan = r.result as PlanEntry[];
            else out.shopping = r.result as ShopItem[];
          };
        }
        tx.oncomplete = () => {
          db.close();
          resolve(out);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    };
  });
}

// ---------- Aufbereitung (reine Funktionen, getestet) ----------

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export interface PlanDay {
  date: string;
  label: string;
  meals: PlanEntry[];
}

/** Heute und die nächsten Tage: heute immer, sonst nur Tage, an denen etwas geplant ist */
export function upcomingDays(plan: PlanEntry[], today = new Date(), days = 7): PlanDay[] {
  const out: PlanDay[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(today, i);
    const key = dayKey(d);
    const meals = plan.filter((e) => e.date === key).sort((a, b) => a.order - b.order);
    if (i > 0 && !meals.length) continue;
    out.push({ date: key, label: i === 0 ? 'Heute' : i === 1 ? 'Morgen' : WEEKDAYS[d.getDay()], meals });
  }
  return out;
}

/** Offene Einträge der Einkaufsliste in ihrer Reihenfolge */
export function openItems(items: ShopItem[]): ShopItem[] {
  return items.filter((i) => !i.checked).sort((a, b) => a.order - b.order);
}
