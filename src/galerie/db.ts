// Speicher der Galerie auf dem Handy (IndexedDB): Werke, Bilder und Merkzettel für Gelöschtes.
import Dexie, { type EntityTable } from 'dexie';

export interface Werk {
  id: string;
  titel: string;
  datum: string; // JJJJ-MM-TT, wann das Werk entstanden ist
  notiz: string;
  /** z. B. „Wachsmalstift“ – steht auf der Plakette (ältere Werke haben das Feld nicht) */
  technik?: string;
  erstellt: number;
  geaendert: number;
}

export interface Bild {
  id: string; // = Werk-ID
  blob: Blob; // bis 1800 px, JPEG
  thumb: Blob; // 480 px für die Übersicht
}

export interface Geloescht {
  id: string;
  zeit: number;
}

export const db = new Dexie('familie-galerie') as Dexie & {
  werke: EntityTable<Werk, 'id'>;
  bilder: EntityTable<Bild, 'id'>;
  geloescht: EntityTable<Geloescht, 'id'>;
};

db.version(1).stores({
  werke: 'id, datum, geaendert',
  bilder: 'id',
  geloescht: 'id',
});

export const neueId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
