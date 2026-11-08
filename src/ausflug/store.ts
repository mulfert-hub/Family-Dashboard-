// Gespeichert auf dem Handy: letzte Suche und gemerkte Ideen (die Übersicht zeigt die gemerkten an).
import { readJson, writeJson } from '../shared/html';
import type { Ergebnis, Idee, Kosten } from './claude';

export interface LetzteSuche {
  zeit: number;
  ort: string;
  tage: string[];
  umkreisKm: number;
  ergebnis: Ergebnis;
  kosten: Kosten;
  wetter: { datum: string; text: string; tmax: number; tmin: number; regen: number }[];
}

export type GemerkteIdee = Idee & { id: string; gemerkt: number };

export const LETZTE = 'ausflug-letzte-suche';
export const GEMERKT = 'ausflug-gemerkt';

export const ideeId = (i: Pick<Idee, 'titel' | 'datum' | 'ort'>) => `${i.datum ?? ''}|${i.titel}|${i.ort}`.toLowerCase();

export const letzteSuche = () => readJson<LetzteSuche | null>(LETZTE, null);
export const speichereSuche = (s: LetzteSuche) => writeJson(LETZTE, s);

export const gemerkt = () => readJson<GemerkteIdee[]>(GEMERKT, []);
export const istGemerkt = (i: Idee) => gemerkt().some((g) => g.id === ideeId(i));

export function merken(i: Idee, an: boolean): void {
  const id = ideeId(i);
  const list = gemerkt().filter((g) => g.id !== id);
  if (an) list.push({ ...i, id, gemerkt: Date.now() });
  writeJson(GEMERKT, list);
}

/** Gemerkte Ideen, die noch anstehen (Ausflugsziele ohne Datum zählen immer), nach Datum sortiert */
export function anstehend(list: GemerkteIdee[], heute: string): GemerkteIdee[] {
  return list
    .filter((g) => !g.datum || g.datum >= heute)
    .sort((a, b) => (a.datum ?? '9999').localeCompare(b.datum ?? '9999') || a.gemerkt - b.gemerkt);
}
