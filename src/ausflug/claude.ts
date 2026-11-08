// Ausflugssuche mit Claude: Websuche + Seiten lesen, Antwort als festes JSON-Format.
// Der API-Schlüssel ist derselbe wie im Kochbuch (liegt nur auf diesem Handy, geht direkt an Anthropic).
import Anthropic from '@anthropic-ai/sdk';
import * as z from 'zod/v4';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { longDate } from './days';
import type { Ort } from './location';
import type { Wetter } from './weather';

const KEY_STORAGE = 'kochbuch-anthropic-key'; // gemeinsam mit dem Kochbuch
const MODEL = 'claude-opus-5-5';

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}
export function setApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignorieren */
  }
}

export const KATEGORIEN = {
  flohmarkt: 'Flohmarkt',
  fest: 'Fest',
  markt: 'Markt',
  natur: 'Natur',
  kinder: 'Für Kinder',
  kultur: 'Kultur',
  sport: 'Sport & Baden',
  sonstiges: 'Sonstiges',
} as const;
export type Kategorie = keyof typeof KATEGORIEN;

const IdeeSchema = z.object({
  titel: z.string().describe('Kurzer Name der Veranstaltung oder des Ziels'),
  typ: z.enum(['veranstaltung', 'ausflugsziel']).describe('veranstaltung = findet nur an diesem Termin statt; ausflugsziel = dauerhaft geöffnet'),
  kategorie: z.enum(Object.keys(KATEGORIEN) as [Kategorie, ...Kategorie[]]),
  datum: z.string().nullable().describe('Datum im Format JJJJ-MM-TT, bei Ausflugszielen der passende Tag aus dem Zeitraum, sonst null'),
  uhrzeit: z.string().nullable().describe('z. B. „10–17 Uhr“, null wenn unbekannt'),
  ort: z.string().describe('Ort bzw. Ortsteil'),
  adresse: z.string().nullable().describe('Adresse oder Treffpunkt, falls bekannt'),
  entfernung_km: z.number().nullable().describe('Ungefähre Entfernung vom Standort in km (Luftlinie)'),
  beschreibung: z.string().describe('1–3 Sätze: was erwartet einen'),
  fuer_kinder: z.string().nullable().describe('Was daran für Kinder schön ist, null wenn nichts Besonderes'),
  kosten: z.string().nullable().describe('Eintritt oder „kostenlos“, null wenn unbekannt'),
  drinnen: z.boolean().describe('true, wenn es überwiegend drinnen stattfindet'),
  quelle_url: z.string().describe('Adresse der Seite, auf der Termin und Ort stehen'),
  quelle_name: z.string().describe('Name der Quelle, z. B. „Gemeinde Musterstadt“'),
});

export const ErgebnisSchema = z.object({
  ideen: z.array(IdeeSchema),
  hinweis: z.string().nullable().describe('Kurzer Hinweis an die Familie, z. B. wenn wenig gefunden wurde; sonst null'),
});

export type Idee = z.infer<typeof IdeeSchema>;
export type Ergebnis = z.infer<typeof ErgebnisSchema>;

export interface Anfrage {
  ort: Ort;
  tage: Date[];
  umkreisKm: number;
  interessen: Kategorie[];
  wuensche: string;
  wetter: Wetter[];
}

export interface Fortschritt {
  art: 'suche' | 'seite';
  text: string;
}

export interface Kosten {
  dollar: number;
  suchen: number;
}

export class AusflugError extends Error {
  constructor(
    message: string,
    public kind: 'auth' | 'network' | 'rate' | 'refusal' | 'other',
  ) {
    super(message);
  }
}

const SYSTEM = `Du hilfst einer Familie mit Tochter, Ausflüge und Veranstaltungen in ihrer Umgebung zu finden.

So gehst du vor:
- Suche gründlich und aus mehreren Richtungen: Flohmarkt- und Trödelmarkt-Kalender, Veranstaltungskalender der Gemeinden, Städte und Landkreise, Lokalzeitungen, regionale Tourismusseiten, Vereinsseiten, Kirchengemeinden, Museen, Tierparks. Suche gezielt nach Begriffen wie „Flohmarkt“, „Kinderflohmarkt“, „Dorffest“, „Straßenfest“, „Markt“, „Martinsmarkt“, „Weihnachtsmarkt“, „Kinder“ zusammen mit Orten im Umkreis und dem Datum.
- Nimm nur Veranstaltungen auf, deren Datum im gesuchten Zeitraum liegt und auf der Quelle steht. Erfinde nichts. Wenn Datum oder Ort unklar sind, lass die Idee weg.
- Öffne bei Bedarf die Seite selbst, um Datum, Uhrzeit und Ort zu prüfen.
- Ergänze 2–4 dauerhafte Ausflugsziele (typ „ausflugsziel“), die an den Tagen geöffnet haben und zum Wetter passen. Bei Regen bevorzugt drinnen.
- Bleib im angegebenen Umkreis. Schätze die Entfernung (Luftlinie) vom Standort.
- Höchstens 14 Ideen, sortiert nach Datum, dann nach Entfernung. Lieber weniger, dafür verlässlich.
- Schreibe auf Deutsch, freundlich und knapp.`;

function anfrageText(a: Anfrage, now: Date): string {
  const ort = [a.ort.name, a.ort.kreis, a.ort.land].filter(Boolean).join(', ');
  const wetter = a.wetter.length
    ? a.wetter.map((w) => `${w.datum}: ${w.text}, ${w.tmin}–${w.tmax} °C, Regenrisiko ${w.regen} %`).join('\n')
    : 'keine Vorhersage verfügbar';
  const interessen = a.interessen.length ? a.interessen.map((k) => KATEGORIEN[k]).join(', ') : 'alles, was Familien Spaß macht';
  return `Heute ist ${longDate(now)}.
Standort: ${ort} (Koordinaten ${a.ort.lat.toFixed(4)}, ${a.ort.lon.toFixed(4)})
Umkreis: bis ${a.umkreisKm} km
Zeitraum: ${a.tage.map(longDate).join(' und ')}
Wetter:
${wetter}
Interessen: ${interessen}
Wünsche: ${a.wuensche.trim() || 'keine besonderen'}`;
}

/** Preis von Claude Opus 5.5 (Dollar je Million Token) und Websuche (Dollar je Suche) */
function kostenVon(usage: Anthropic.Beta.BetaUsage[]): Kosten {
  let dollar = 0;
  let suchen = 0;
  for (const u of usage) {
    dollar += (u.input_tokens * 4 + (u.cache_creation_input_tokens ?? 0) * 5 + (u.cache_read_input_tokens ?? 0) * 0.2 + u.output_tokens * 20) / 1e6;
    const s = u.server_tool_use?.web_search_requests ?? 0;
    suchen += s;
    dollar += s * 0.01;
  }
  return { dollar, suchen };
}

export async function sucheAusfluege(
  a: Anfrage,
  onFortschritt: (f: Fortschritt) => void,
  signal?: AbortSignal,
): Promise<{ ergebnis: Ergebnis; kosten: Kosten }> {
  const apiKey = getApiKey();
  if (!apiKey) throw new AusflugError('Für die Suche wird ein Claude-API-Schlüssel benötigt.', 'auth');
  if (!navigator.onLine) throw new AusflugError('Keine Internetverbindung.', 'network');

  // Direkter Aufruf aus dem Browser ist hier gewollt: eigener Schlüssel, eigenes Gerät, kein Server dazwischen.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
  const format = betaZodOutputFormat(ErgebnisSchema);
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    {
      type: 'web_search_20260209',
      name: 'web_search',
      max_uses: 15,
      user_location: {
        type: 'approximate',
        city: a.ort.name,
        ...(a.ort.land ? { region: a.ort.land } : {}),
        country: a.ort.laendercode,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
      },
    },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 10, max_content_tokens: 20000 },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: anfrageText(a, new Date()) }];
  const usage: Anthropic.Beta.BetaUsage[] = [];
  let final: Anthropic.Beta.BetaMessage | undefined;

  try {
    for (let round = 0; round < 5; round++) {
      const stream = client.beta.messages.stream(
        {
          model: MODEL,
          max_tokens: 32000,
          system: SYSTEM,
          messages,
          tools,
          output_config: { effort: 'medium', format },
          // Falls Claude eine Anfrage fälschlich ablehnt, versucht Anthropic sie mit einem passenden Ersatzmodell
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        },
        { signal },
      );
      stream.on('contentBlock', (block) => {
        if (block.type !== 'server_tool_use') return;
        const input = block.input as { query?: string; url?: string };
        if (block.name === 'web_search' && input.query) onFortschritt({ art: 'suche', text: input.query });
        if (block.name === 'web_fetch' && input.url) {
          let host = input.url;
          try {
            host = new URL(input.url).hostname.replace(/^www\./, '');
          } catch {
            /* Adresse so lassen */
          }
          onFortschritt({ art: 'seite', text: host });
        }
      });
      final = await stream.finalMessage();
      usage.push(final.usage);
      // Server-Werkzeuge können pausieren → mit der bisherigen Antwort fortsetzen
      if (final.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: final.content as Anthropic.Beta.BetaContentBlockParam[] });
    }
  } catch (e) {
    if (e instanceof Anthropic.APIUserAbortError) throw new AusflugError('Suche abgebrochen.', 'other');
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      throw new AusflugError('Der API-Schlüssel ist ungültig oder hat keine Berechtigung.', 'auth');
    if (e instanceof Anthropic.RateLimitError) throw new AusflugError('Zu viele Anfragen – bitte kurz warten und erneut versuchen.', 'rate');
    if (e instanceof Anthropic.APIConnectionError) throw new AusflugError('Keine Verbindung zu Claude.', 'network');
    if (e instanceof Anthropic.APIError) throw new AusflugError(`Claude-Fehler (${e.status}): ${e.message}`, 'other');
    throw e;
  }

  if (!final) throw new AusflugError('Claude hat nicht geantwortet.', 'other');
  if (final.stop_reason === 'refusal') throw new AusflugError('Claude hat die Anfrage abgelehnt.', 'refusal');
  return { ergebnis: parseErgebnis(final), kosten: kostenVon(usage) };
}

/** Text der Antwort lesen und gegen das Schema prüfen */
export function parseErgebnis(msg: Pick<Anthropic.Beta.BetaMessage, 'content'>): Ergebnis {
  const text = msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  try {
    const parsed = ErgebnisSchema.safeParse(JSON.parse(text));
    if (parsed.success) return parsed.data;
  } catch {
    /* unten melden */
  }
  throw new AusflugError('Claude hat keine verwertbare Antwort geliefert. Bitte noch einmal versuchen.', 'other');
}
