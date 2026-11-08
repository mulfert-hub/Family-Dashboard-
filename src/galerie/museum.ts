// Das kleine Museum: ein Raum mit Wand und Parkett, Rahmen und Plaketten – ein Werk pro Wandstück.
// Rahmen und Neigung hängen fest am Werk (aus der ID berechnet), damit jedes Bild immer gleich hängt.
import { esc } from '../shared/html';
import type { Werk } from './db';

/** Die Künstlerin – steht auf jeder Plakette */
export const KUENSTLERIN = 'Thea';

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
  const nr = inv ? `<span class="inv">Inv.-Nr. ${inv}</span>` : '';
  const unten = groesse === 'klein' ? `${KUENSTLERIN}${nr ? ` · ${nr}` : ''}` : `Sammlung Familie Ulfert${nr ? ` · ${nr}` : ''}`;
  return `<div class="plakette plakette-${groesse}" lang="de">
      <strong>${w.titel ? `„${esc(w.titel)}“` : 'Ohne Titel'}</strong>
      <span>${groesse === 'klein' ? '' : `${KUENSTLERIN} · `}${esc(technikZeile(w))}</span>
      ${groesse === 'gross' && w.notiz ? `<span class="plakette-notiz">${esc(w.notiz)}</span>` : ''}
      <small>${unten}</small>
    </div>`;
}

/** Jedes Werk kommt in den Holzrahmen der Ausstellung – wie der leere Rahmen im Museum, nur endlich gefüllt */
export function gerahmt(_w: Werk, img: string): string {
  return `<span class="rahmen rahmen-galerie"><span class="passepartout">${img}</span></span>`;
}

const DRAHT = `<svg class="draht" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
    <path d="M18 26 L50 5 L82 26" fill="none" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
  </svg><span class="nagel" aria-hidden="true"></span>`;

/** Ein Wandstück im Museumsraum: Lichtkegel, Nagel, Draht, Rahmen und daneben die Plakette */
export function wandstueck(w: Werk, img: string, inv: string | undefined, neu = false): string {
  const label = `${w.titel || 'Ohne Titel'}, ${technikZeile(w)} – groß ansehen`;
  return `<li class="wandstueck" data-id="${esc(w.id)}" style="--neigung:${neigungFuer(w.id)}deg">
      <span class="spot" aria-hidden="true"></span>
      <div class="haengung">
        <button type="button" class="aufhaengung" data-werk="${esc(w.id)}" aria-label="${esc(label)}">
          ${DRAHT}
          ${gerahmt(w, img)}
          ${neu ? '<span class="sticker">Neu!</span>' : ''}
        </button>
      </div>
      ${plakette(w, inv, 'mittel')}
    </li>`;
}

/** Der Museumsraum: Decke mit Strahlerschiene, Wand, Parkett – die Werke hängen nebeneinander zum Wischen */
export function museumsraum(stuecke: string[], mehrere: boolean): string {
  const pfeile = mehrere
    ? `<button type="button" class="raum-pfeil raum-pfeil-links" data-schritt="-1" aria-label="Vorheriges Werk"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6l-6 6 6 6"/></svg></button>
       <button type="button" class="raum-pfeil raum-pfeil-rechts" data-schritt="1" aria-label="Nächstes Werk"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 6l6 6-6 6"/></svg></button>`
    : '';
  return `<section class="museum" aria-label="Ausstellung" aria-roledescription="Karussell">
      <span class="decke" aria-hidden="true"></span>
      <span class="boden" aria-hidden="true"></span>
      <ul class="raum-spur" id="spur" tabindex="0">${stuecke.join('')}</ul>
      ${pfeile}
    </section>`;
}

/** Leere Wand: ein leerer Rahmen wartet auf das erste Kunstwerk */
export function leereWand(): string {
  return museumsraum(
    [
      `<li class="wandstueck leere-wand" style="--neigung:-1deg">
        <span class="spot" aria-hidden="true"></span>
        <div class="haengung">
          <span class="aufhaengung">${DRAHT}<span class="rahmen rahmen-galerie"><span class="passepartout"><span class="leer-bild">?</span></span></span></span>
        </div>
        <div class="plakette plakette-mittel"><strong>Hier könnte Ihr Meisterwerk hängen</strong><span>Mit + ein Bild von ${KUENSTLERIN} fotografieren</span><small>Künstlerin: ${KUENSTLERIN}</small></div>
      </li>`,
    ],
    false,
  );
}
