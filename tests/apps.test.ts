import { describe, expect, it } from 'vitest';
import { APPS, greeting, parseApps } from '../src/apps';

describe('apps.json', () => {
  it('ist gültig und enthält das Kochbuch', () => {
    const kochbuch = APPS.find((a) => a.id === 'kochbuch');
    expect(kochbuch?.status).toBe('live');
    expect(kochbuch?.path).toBe('kochbuch/');
  });

  it('meldet fehlerhafte Einträge', () => {
    expect(() => parseApps({})).toThrow();
    expect(() => parseApps({ apps: [{ id: 'x', name: 'X', status: 'live' }] })).toThrow(/path/);
    expect(() => parseApps({ apps: [{ id: 'x', name: 'X', status: 'live', path: '/x' }] })).toThrow(/path/);
    expect(() =>
      parseApps({ apps: [{ id: 'x', name: 'X', status: 'bald' }, { id: 'x', name: 'Y', status: 'bald' }] }),
    ).toThrow(/doppelt/);
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
