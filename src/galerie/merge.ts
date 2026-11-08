// Stand von zwei Geräten zusammenführen: Je Werk gewinnt die neuere Änderung,
// gelöschte Werke bleiben gelöscht (Merkzettel mit Zeitpunkt).
import type { Geloescht, Werk } from './db';

export interface Stand {
  version: 1;
  werke: Werk[];
  geloescht: Geloescht[];
}

export const leererStand = (): Stand => ({ version: 1, werke: [], geloescht: [] });

export function zusammenfuehren(a: Stand, b: Stand): Stand {
  const tote = new Map<string, number>();
  for (const g of [...a.geloescht, ...b.geloescht]) tote.set(g.id, Math.max(tote.get(g.id) ?? 0, g.zeit));
  const werke = new Map<string, Werk>();
  for (const w of [...a.werke, ...b.werke]) {
    const vorher = werke.get(w.id);
    if (!vorher || w.geaendert > vorher.geaendert) werke.set(w.id, w);
  }
  for (const [id, zeit] of tote) {
    const w = werke.get(id);
    if (w && w.geaendert <= zeit) werke.delete(id);
  }
  return {
    version: 1,
    werke: [...werke.values()].sort((x, y) => y.datum.localeCompare(x.datum) || y.erstellt - x.erstellt),
    geloescht: [...tote].map(([id, zeit]) => ({ id, zeit })).sort((x, y) => x.id.localeCompare(y.id)),
  };
}
