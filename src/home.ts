// Welche Apps auf dem Startbildschirm liegen. Gespeichert wird nur, was jemand entfernt hat:
// So erscheinen neu fertiggestellte Apps automatisch, und „Laden“ im Store holt eine App zurück.
import type { FamilyApp } from './apps';

const KEY = 'familie-ausgeblendet';

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* privater Modus o. Ä.: dann nur bis zum Neuladen */
  }
}

export function homeApps(apps: FamilyApp[], hidden: string[] = read()): FamilyApp[] {
  return apps.filter((a) => a.status === 'live' && !hidden.includes(a.id));
}

export function isOnHome(id: string): boolean {
  return !read().includes(id);
}

export function setOnHome(id: string, on: boolean): void {
  const ids = read().filter((x) => x !== id);
  if (!on) ids.push(id);
  write(ids);
}
