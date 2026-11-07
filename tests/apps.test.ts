import { beforeEach, describe, expect, it } from 'vitest';
import { APPS, greeting, parseApps } from '../src/apps';
import { homeApps } from '../src/home';
import { parseRoute } from '../src/router';

describe('apps.json', () => {
  it('ist gültig und enthält das Kochbuch', () => {
    const kochbuch = APPS.find((a) => a.id === 'kochbuch');
    expect(kochbuch?.status).toBe('live');
    expect(kochbuch?.path).toBe('kochbuch/');
    expect(kochbuch?.screenshots.length).toBeGreaterThan(0);
  });

  it('enthält den Haushaltsplan', () => {
    const haushalt = APPS.find((a) => a.id === 'haushalt');
    expect(haushalt?.status).toBe('live');
    expect(haushalt?.path).toBe('haushalt/');
    expect(haushalt?.repo).toBe('mulfert-hub/Haushaltsapp');
  });

  it('meldet fehlerhafte Einträge', () => {
    expect(() => parseApps({})).toThrow();
    expect(() => parseApps({ apps: [{ id: 'x', name: 'X', status: 'live' }] })).toThrow(/path/);
    expect(() => parseApps({ apps: [{ id: 'x', name: 'X', status: 'live', path: '/x' }] })).toThrow(/path/);
    expect(() => parseApps({ apps: [{ id: 'X Y', name: 'X', status: 'bald' }] })).toThrow(/id/);
    expect(() =>
      parseApps({ apps: [{ id: 'x', name: 'X', status: 'bald' }, { id: 'x', name: 'Y', status: 'bald' }] }),
    ).toThrow(/doppelt/);
  });

  it('füllt fehlende Angaben auf', () => {
    const [a] = parseApps({ apps: [{ id: 'x', name: 'X', status: 'bald' }] });
    expect(a).toMatchObject({ funktionen: [], screenshots: [], highlight: false, kategorie: 'Familie' });
  });
});

describe('Startbildschirm', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
  });
  it('zeigt fertige Apps, außer ausgeblendeten', () => {
    const apps = parseApps({
      apps: [
        { id: 'a', name: 'A', status: 'live', path: 'a/' },
        { id: 'b', name: 'B', status: 'live', path: 'b/' },
        { id: 'c', name: 'C', status: 'bald' },
      ],
    });
    expect(homeApps(apps, []).map((x) => x.id)).toEqual(['a', 'b']);
    expect(homeApps(apps, ['a']).map((x) => x.id)).toEqual(['b']);
  });
});

describe('Routen', () => {
  it('erkennt Start, Entdecken und App-Seiten', () => {
    expect(parseRoute('')).toEqual({ name: 'start' });
    expect(parseRoute('#/')).toEqual({ name: 'start' });
    expect(parseRoute('#/entdecken')).toEqual({ name: 'entdecken' });
    expect(parseRoute('#/app/kochbuch')).toEqual({ name: 'app', id: 'kochbuch' });
  });
});

describe('Begrüßung', () => {
  it('passt zur Tageszeit', () => {
    expect(greeting(new Date(2026, 0, 1, 8))).toBe('Guten Morgen');
    expect(greeting(new Date(2026, 0, 1, 14))).toBe('Hallo');
    expect(greeting(new Date(2026, 0, 1, 20))).toBe('Guten Abend');
    expect(greeting(new Date(2026, 0, 1, 23))).toBe('Gute Nacht');
  });
});
