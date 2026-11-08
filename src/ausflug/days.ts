// Welche Tage gemeint sind („Heute“, „Morgen“, „Wochenende“, ein bestimmter Tag)
export type Wann = 'heute' | 'morgen' | 'wochenende' | 'tag';

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function daysFor(wann: Wann, now: Date, tag?: string): Date[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (wann === 'heute') return [today];
  if (wann === 'morgen') return [addDays(today, 1)];
  if (wann === 'tag' && tag) {
    const [y, m, d] = tag.split('-').map(Number);
    return [new Date(y, m - 1, d)];
  }
  // Wochenende: heute Samstag → Sa+So, heute Sonntag → nur So, sonst das kommende Wochenende
  const dow = today.getDay();
  if (dow === 6) return [today, addDays(today, 1)];
  if (dow === 0) return [today];
  const sat = addDays(today, 6 - dow);
  return [sat, addDays(sat, 1)];
}

const LONG = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const SHORT = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
export const longDate = (d: Date) => LONG.format(d);
export const shortDate = (d: Date) => SHORT.format(d);

/** „2026-11-08“ → „So., 8.11.“ */
export function shortIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return SHORT.format(new Date(y, m - 1, d));
}
