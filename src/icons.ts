// Symbole für die App-Kacheln (24er-Raster, Strichstärke über CSS).
const PATHS: Record<string, string> = {
  kochbuch:
    '<path d="M12 6.5C10.3 5.3 7.9 4.9 5.5 5.2v12.3c2.4-.3 4.8.1 6.5 1.3 1.7-1.2 4.1-1.6 6.5-1.3V5.2c-2.4-.3-4.8.1-6.5 1.3z"/><path d="M12 6.5v12.3"/><path d="M8 9.5h1.8M8 12.5h1.8"/>',
  haushalt:
    '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.6V19h12V9.6"/><path d="M10 19v-4.5h4V19"/>',
  aufgaben:
    '<rect x="4.5" y="4.5" width="15" height="15" rx="3.5"/><path d="M8.5 12.2l2.4 2.4 4.6-5"/>',
  mehr: '<path d="M12 7v10M7 12h10"/>',
};

export function icon(name: string): string {
  const body = PATHS[name] ?? PATHS.mehr;
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
