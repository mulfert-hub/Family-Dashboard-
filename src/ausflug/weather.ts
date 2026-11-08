// Wettervorhersage (Open-Meteo, ohne Schlüssel) für die gewählten Tage
import { isoDate } from './days';

export interface Wetter {
  datum: string;
  text: string;
  tmax: number;
  tmin: number;
  regen: number; // Wahrscheinlichkeit in %
}

// WMO-Wettercodes → kurze Beschreibung
export function wetterText(code: number): string {
  if (code === 0) return 'sonnig';
  if (code <= 2) return 'heiter';
  if (code === 3) return 'bewölkt';
  if (code <= 48) return 'neblig';
  if (code <= 57) return 'Nieselregen';
  if (code <= 67) return 'Regen';
  if (code <= 77) return 'Schnee';
  if (code <= 82) return 'Regenschauer';
  if (code <= 86) return 'Schneeschauer';
  return 'Gewitter';
}

export async function wetterFuer(lat: number, lon: number, tage: Date[]): Promise<Wetter[]> {
  const start = isoDate(tage[0]);
  const end = isoDate(tage[tage.length - 1]);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${start}&end_date=${end}`;
  const res = await fetch(url);
  if (!res.ok) return []; // z. B. Tag liegt zu weit in der Zukunft
  const d = (await res.json()) as {
    daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[] };
  };
  const t = d.daily;
  if (!t) return [];
  return t.time.map((datum, i) => ({
    datum,
    text: wetterText(t.weather_code[i]),
    tmax: Math.round(t.temperature_2m_max[i]),
    tmin: Math.round(t.temperature_2m_min[i]),
    regen: t.precipitation_probability_max[i] ?? 0,
  }));
}
