// Standort: Handy-GPS → Ortsname (OpenStreetMap/Nominatim). Alternativ ein eingetippter Ort.
import { readJson, writeJson } from '../shared/html';

export interface Ort {
  name: string; // z. B. „Musterstadt“
  kreis?: string;
  land?: string; // Bundesland
  laendercode: string; // „DE“
  lat: number;
  lon: number;
  quelle: 'gps' | 'eingabe';
  zeit: number;
}

const KEY = 'ausflug-ort';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

export const lastOrt = () => readJson<Ort | null>(KEY, null);
export const saveOrt = (o: Ort) => writeJson(KEY, o);

export function position(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Dieses Gerät kann seinen Standort nicht bestimmen.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? 'Kein Zugriff auf den Standort. Bitte in den Einstellungen erlauben oder einen Ort eintippen.'
              : 'Der Standort konnte nicht bestimmt werden. Bitte einen Ort eintippen.',
          ),
        ),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  county?: string;
  state?: string;
  country_code?: string;
}

function fromAddress(a: NominatimAddress, lat: number, lon: number, quelle: Ort['quelle'], fallbackName: string): Ort {
  return {
    name: a.city ?? a.town ?? a.village ?? a.municipality ?? a.suburb ?? fallbackName,
    kreis: a.county,
    land: a.state,
    laendercode: (a.country_code ?? 'de').toUpperCase(),
    lat,
    lon,
    quelle,
    zeit: Date.now(),
  };
}

export async function ortVonGps(): Promise<Ort> {
  const { lat, lon } = await position();
  try {
    const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=12&addressdetails=1&accept-language=de&lat=${lat}&lon=${lon}`);
    if (!res.ok) throw new Error(String(res.status));
    const d = (await res.json()) as { address?: NominatimAddress };
    return fromAddress(d.address ?? {}, lat, lon, 'gps', 'Aktueller Standort');
  } catch {
    // Ohne Ortsnamen geht es trotzdem: Claude bekommt dann nur die Koordinaten
    return { name: 'Aktueller Standort', laendercode: 'DE', lat, lon, quelle: 'gps', zeit: Date.now() };
  }
}

export async function ortVonName(name: string): Promise<Ort> {
  const res = await fetch(`${NOMINATIM}/search?format=jsonv2&limit=1&addressdetails=1&accept-language=de&q=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error('Der Ort konnte nicht gesucht werden.');
  const list = (await res.json()) as { lat: string; lon: string; address?: NominatimAddress }[];
  if (!list.length) throw new Error(`„${name}“ wurde nicht gefunden.`);
  const r = list[0];
  return fromAddress(r.address ?? {}, Number(r.lat), Number(r.lon), 'eingabe', name);
}

export function ortText(o: Ort): string {
  return [o.name, o.kreis && o.kreis !== o.name ? o.kreis : null].filter(Boolean).join(', ');
}
