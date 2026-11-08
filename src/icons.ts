// Symbole (24er-Raster). App-Symbole liegen weiß auf dem farbigen App-Icon.
const PATHS: Record<string, string> = {
  kochbuch:
    '<path d="M12 6.5C10.3 5.3 7.9 4.9 5.5 5.2v12.3c2.4-.3 4.8.1 6.5 1.3 1.7-1.2 4.1-1.6 6.5-1.3V5.2c-2.4-.3-4.8.1-6.5 1.3z"/><path d="M12 6.5v12.3"/><path d="M8 9.5h1.8M8 12.5h1.8"/>',
  haushalt: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.6V19h12V9.6"/><path d="M10 19v-4.5h4V19"/>',
  aufgaben: '<rect x="4.5" y="4.5" width="15" height="15" rx="3.5"/><path d="M8.5 12.2l2.4 2.4 4.6-5"/>',
  ausflug: '<path d="M12 20.5s-6-5.4-6-10.2a6 6 0 0 1 12 0c0 4.8-6 10.2-6 10.2z"/><circle cx="12" cy="10.2" r="2.2"/>',
  galerie: '<rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17l4.5-4.2 3 2.7 2.8-2.6L19.5 17"/>',
  mehr: '<path d="M12 7v10M7 12h10"/>',
  // weitere Bedienelemente
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  standort: '<path d="M12 20.5s-6-5.4-6-10.2a6 6 0 0 1 12 0c0 4.8-6 10.2-6 10.2z"/><circle cx="12" cy="10.2" r="2.2"/>',
  stern: '<path d="M12 4.5l2.3 4.7 5.2.8-3.7 3.6.9 5.1L12 16.3l-4.7 2.4.9-5.1-3.7-3.6 5.2-.8z"/>',
  link: '<path d="M10 14l4-4"/><path d="M8.5 11.5l-1.8 1.8a3 3 0 0 0 4.2 4.2l1.8-1.8"/><path d="M15.5 12.5l1.8-1.8a3 3 0 0 0-4.2-4.2l-1.8 1.8"/>',
  karte: '<path d="M9 5.5l-5 2v11l5-2 6 2 5-2v-11l-5 2z"/><path d="M9 5.5v11M15 7.5v11"/>',
  teilen: '<path d="M12 4.5v10"/><path d="M8.5 8L12 4.5 15.5 8"/><path d="M7 11.5H6v8h12v-8h-1"/>',
  muell: '<path d="M5.5 7.5h13"/><path d="M9.5 7.5V5.5h5v2"/><path d="M7 7.5l.8 11h8.4l.8-11"/>',
  stift: '<path d="M14.5 6l3.5 3.5L9 18.5H5.5V15z"/>',
  schliessen: '<path d="M7 7l10 10M17 7L7 17"/>',
  sync: '<path d="M19 12a7 7 0 0 1-12 4.9"/><path d="M5 12a7 7 0 0 1 12-4.9"/><path d="M17 3.5v3.6h-3.6"/><path d="M7 20.5v-3.6h3.6"/>',
  // Bedienelemente
  start:
    '<rect x="4" y="4" width="7" height="9" rx="2"/><rect x="13" y="4" width="7" height="5" rx="2"/><rect x="13" y="11" width="7" height="9" rx="2"/><rect x="4" y="15" width="7" height="5" rx="2"/>',
  apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>',
  entdecken: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  zurueck: '<path d="M14.5 6l-6 6 6 6"/>',
  check: '<path d="M5.5 12.5l4 4 9-9"/>',
  weiter: '<path d="M9.5 6l6 6-6 6"/>',
};

export function icon(name: string, cls = ''): string {
  const body = PATHS[name] ?? PATHS.mehr;
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
