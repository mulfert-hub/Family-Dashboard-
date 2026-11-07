import { describe, expect, it } from 'vitest';
import { openItems, upcomingDays, type PlanEntry } from '../src/kochbuch';

const sat = new Date(2026, 10, 7, 9); // Samstag, 7. Nov. 2026
const e = (date: string, title: string, order = 0): PlanEntry => ({ id: `${date}-${title}`, date, recipeId: title, title, order });

describe('Wochenplan auf dem Startbildschirm', () => {
  it('zeigt heute immer, sonst nur geplante Tage der nächsten Woche', () => {
    const days = upcomingDays([e('2026-11-09', 'Suppe'), e('2026-11-08', 'Pasta', 1), e('2026-11-08', 'Salat', 0), e('2026-11-20', 'Später'), e('2026-11-01', 'Vorbei')], sat);
    expect(days.map((d) => [d.label, d.meals.map((m) => m.title)])).toEqual([
      ['Heute', []],
      ['Morgen', ['Salat', 'Pasta']],
      ['Montag', ['Suppe']],
    ]);
  });
});

describe('Einkaufsliste auf dem Startbildschirm', () => {
  it('nur offene Einträge, in Reihenfolge', () => {
    const items = [
      { id: 'a', name: 'Milch', checked: false, order: 2 },
      { id: 'b', name: 'Brot', checked: true, order: 0 },
      { id: 'c', name: 'Eier', checked: false, order: 1 },
    ];
    expect(openItems(items).map((i) => i.name)).toEqual(['Eier', 'Milch']);
  });
});
