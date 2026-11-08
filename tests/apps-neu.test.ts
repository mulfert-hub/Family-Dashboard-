import { describe, expect, it } from 'vitest';
import { daysFor, isoDate } from '../src/ausflug/days';
import { parseErgebnis } from '../src/ausflug/claude';
import { anstehend, ideeId, type GemerkteIdee } from '../src/ausflug/store';
import { zusammenfuehren, leererStand } from '../src/galerie/merge';
import type { Werk } from '../src/galerie/db';

describe('Ausflüge: Tage', () => {
  const mi = new Date(2026, 10, 4); // Mittwoch
  it('Wochenende unter der Woche = kommender Sa + So', () => {
    expect(daysFor('wochenende', mi).map(isoDate)).toEqual(['2026-11-07', '2026-11-08']);
  });
  it('Wochenende am Samstag und Sonntag', () => {
    expect(daysFor('wochenende', new Date(2026, 10, 7)).map(isoDate)).toEqual(['2026-11-07', '2026-11-08']);
    expect(daysFor('wochenende', new Date(2026, 10, 8)).map(isoDate)).toEqual(['2026-11-08']);
  });
  it('Heute, Morgen und ein bestimmter Tag', () => {
    expect(daysFor('heute', mi).map(isoDate)).toEqual(['2026-11-04']);
    expect(daysFor('morgen', new Date(2026, 11, 31)).map(isoDate)).toEqual(['2027-01-01']);
    expect(daysFor('tag', mi, '2026-12-24').map(isoDate)).toEqual(['2026-12-24']);
  });
});

const idee = {
  titel: 'Kinderflohmarkt',
  typ: 'veranstaltung' as const,
  kategorie: 'flohmarkt' as const,
  datum: '2026-11-08',
  uhrzeit: '10–14 Uhr',
  ort: 'Musterstadt',
  adresse: null,
  entfernung_km: 4,
  beschreibung: 'Kinder verkaufen Spielsachen.',
  fuer_kinder: 'Selbst Stand machen',
  kosten: 'kostenlos',
  drinnen: true,
  quelle_url: 'https://example.org/termine',
  quelle_name: 'Gemeinde',
};

describe('Ausflüge: Antwort von Claude', () => {
  it('liest gültiges JSON', () => {
    const r = parseErgebnis({ content: [{ type: 'text', text: JSON.stringify({ ideen: [idee], hinweis: null }), citations: null }] });
    expect(r.ideen[0].titel).toBe('Kinderflohmarkt');
  });
  it('meldet Unbrauchbares', () => {
    expect(() => parseErgebnis({ content: [{ type: 'text', text: 'Leider nichts', citations: null }] })).toThrow(/verwertbare/);
  });
  it('zeigt nur anstehende gemerkte Ideen, nach Datum', () => {
    const g = (datum: string | null, n: number): GemerkteIdee => ({ ...idee, datum, titel: `T${n}`, id: ideeId({ ...idee, datum, titel: `T${n}` }), gemerkt: n });
    const list = anstehend([g('2026-11-20', 1), g('2026-11-01', 2), g(null, 3), g('2026-11-08', 4)], '2026-11-08');
    expect(list.map((x) => x.titel)).toEqual(['T4', 'T1', 'T3']);
  });
});

describe('Galerie: zusammenführen', () => {
  const w = (id: string, geaendert: number, titel = id): Werk => ({ id, titel, datum: '2026-11-01', notiz: '', erstellt: 1, geaendert });
  it('neuere Änderung gewinnt, beide Seiten bleiben erhalten', () => {
    const a = { ...leererStand(), werke: [w('x', 5, 'neu'), w('a', 1)] };
    const b = { ...leererStand(), werke: [w('x', 2, 'alt'), w('b', 1)] };
    const m = zusammenfuehren(a, b);
    expect(m.werke.map((x) => x.id).sort()).toEqual(['a', 'b', 'x']);
    expect(m.werke.find((x) => x.id === 'x')?.titel).toBe('neu');
  });
  it('gelöscht bleibt gelöscht, außer es wurde danach geändert', () => {
    const a = { ...leererStand(), geloescht: [{ id: 'x', zeit: 10 }, { id: 'y', zeit: 10 }] };
    const b = { ...leererStand(), werke: [w('x', 5), w('y', 20)] };
    const m = zusammenfuehren(a, b);
    expect(m.werke.map((x) => x.id)).toEqual(['y']);
    expect(m.geloescht.map((g) => g.id)).toEqual(['x', 'y']);
  });
});

import { inventarNummern, neigungFuer, rahmenFuer, RAHMEN, technikZeile } from '../src/galerie/museum';

describe('Galerie: Museum', () => {
  it('Rahmen und Neigung sind je Werk immer gleich und im erlaubten Bereich', () => {
    for (const id of ['a', 'mw7j2tsl-nivmhi', 'xyz-123']) {
      expect(rahmenFuer(id)).toBe(rahmenFuer(id));
      expect(RAHMEN).toContain(rahmenFuer(id));
      expect(Math.abs(neigungFuer(id))).toBeLessThanOrEqual(1.5);
    }
  });
  it('Plakette: Technik und Jahr', () => {
    expect(technikZeile({ technik: 'Wachsmalstift', datum: '2026-11-08' })).toBe('Wachsmalstift auf Papier, 2026');
    expect(technikZeile({ technik: 'Knete', datum: '2025-03-01' })).toBe('Knete, 2025');
    expect(technikZeile({ datum: '2026-01-01' })).toBe('2026');
  });
  it('Inventarnummern nach Reihenfolge des Aufhängens', () => {
    const w = (id: string, erstellt: number) => ({ id, titel: '', datum: '2026-11-01', notiz: '', erstellt, geaendert: erstellt });
    const inv = inventarNummern([w('b', 20), w('a', 10), w('c', 30)]);
    expect([inv.get('a'), inv.get('b'), inv.get('c')]).toEqual(['001', '002', '003']);
  });
});
