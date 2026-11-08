// Das kleine Museum: Rahmen, Plaketten und die Staffelei für das neueste Werk.
// Rahmen und Neigung hängen fest am Werk (aus der ID berechnet), damit jedes Bild immer gleich hängt.
import { esc } from '../shared/html';
import type { Werk } from './db';

export const TECHNIKEN = [
  'Buntstift',
  'Wachsmalstift',
  'Filzstift',
  'Bleistift',
  'Wasserfarbe',
  'Fingerfarbe',
  'Kreide',
  'Collage',
  'Knete',
  'Gemischte Technik',
] as const;

export const RAHMEN = ['gold', 'holz', 'schwarz', 'weiss', 'bunt'] as const;
export type Rahmen = (typeof RAHMEN)[number];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export const rahmenFuer = (id: string): Rahmen => RAHMEN[hash(id) % RAHMEN.length];

/** Leicht schief, wie im echten Leben: −1,5° bis +1,5° */
export const neigungFuer = (id: string): number => ((hash(`${id}~`) % 7) - 3) * 0.5;

/** Inventarnummer nach Reihenfolge des Aufhängens (ältestes = 1) */
export function inventarNummern(werke: Werk[]): Map<string, string> {
  const sorted = [...werke].sort((a, b) => a.erstellt - b.erstellt || a.id.localeCompare(b.id));
  return new Map(sorted.map((w, i) => [w.id, String(i + 1).padStart(3, '0')]));
}

const JAHR = (datum: string) => datum.slice(0, 4);

/** Zweite Zeile der Plakette: „Wachsmalstift auf Papier, 2026“ */
export function technikZeile(w: Pick<Werk, 'technik' | 'datum'>): string {
  const t = w.technik?.trim();
  if (!t) return JAHR(w.datum);
  const aufPapier = ['Buntstift', 'Wachsmalstift', 'Filzstift', 'Bleistift', 'Wasserfarbe', 'Fingerfarbe', 'Kreide'].includes(t);
  return `${t}${aufPapier ? ' auf Papier' : ''}, ${JAHR(w.datum)}`;
}

/** klein: an der Wand (knapp), mittel: Staffelei, gross: Großansicht mit Notiz */
export function plakette(w: Werk, inv: string | undefined, groesse: 'klein' | 'mittel' | 'gross' = 'klein'): string {
  const sammlung = groesse === 'klein' ? (inv ? `Inv.-Nr. ${inv}` : '') : `Sammlung Familie Ulfert${inv ? ` · Inv.-Nr. ${inv}` : ''}`;
  return `<div class="plakette plakette-${groesse}" lang="de">
      <strong>${w.titel ? `„${esc(w.titel)}“` : 'Ohne Titel'}</strong>
      <span>${esc(technikZeile(w))}</span>
      ${groesse === 'gross' && w.notiz ? `<span class="plakette-notiz">${esc(w.notiz)}</span>` : ''}
      ${sammlung ? `<small>${esc(sammlung)}</small>` : ''}
    </div>`;
}

export function gerahmt(w: Werk, img: string): string {
  return `<span class="rahmen rahmen-${rahmenFuer(w.id)}"><span class="passepartout">${img}</span></span>`;
}

const DRAHT = `<svg class="draht" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
    <path d="M18 26 L50 5 L82 26" fill="none" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
  </svg><span class="nagel" aria-hidden="true"></span>`;

/** Ein Bild an der Wand: Nagel, Draht, Rahmen, Plakette */
export function exponat(w: Werk, img: string, inv: string | undefined): string {
  const label = `${w.titel || 'Ohne Titel'}, ${technikZeile(w)}`;
  return `<li class="exponat" style="--neigung:${neigungFuer(w.id)}deg">
      <button type="button" class="aufhaengung" data-werk="${esc(w.id)}" aria-label="${esc(label)}">
        ${DRAHT}
        ${gerahmt(w, img)}
      </button>
      ${plakette(w, inv)}
    </li>`;
}

/** Das neueste Werk auf der Staffelei */
export function staffelei(w: Werk, img: string, inv: string | undefined): string {
  return `<section class="staffelei-bereich" aria-label="Neu in der Ausstellung">
      <div class="staffelei">
        <svg class="beine" viewBox="0 0 200 320" preserveAspectRatio="none" aria-hidden="true">
          <path d="M100 0 L100 320" class="bein-hinten"/>
          <path d="M84 0 L22 320"/>
          <path d="M116 0 L178 320"/>
          <path d="M42 250 L158 250" class="strebe"/>
        </svg>
        <button type="button" class="leinwand" data-werk="${esc(w.id)}" aria-label="${esc(`Neu: ${w.titel || 'Ohne Titel'}`)}">
          ${img}
          <span class="sticker">Neu!</span>
        </button>
        <span class="ablage" aria-hidden="true"></span>
      </div>
      ${plakette(w, inv, 'mittel')}
    </section>`;
}

/** Leere Wand: ein leerer Rahmen wartet auf das erste Kunstwerk */
export function leereWand(): string {
  return `<div class="leere-wand">
      <div class="exponat" style="--neigung:-1deg">
        <span class="aufhaengung">${DRAHT}<span class="rahmen rahmen-gold"><span class="passepartout"><span class="leer-bild">?</span></span></span></span>
        <div class="plakette"><strong>Hier könnte Ihr Meisterwerk hängen</strong><span>Mit + ein Bild fotografieren</span><small>Sammlung Familie Ulfert</small></div>
      </div>
    </div>`;
}
