// Hash-Routing (funktioniert auf GitHub Pages ohne Serverkonfiguration)
export type Route = { name: 'start' } | { name: 'apps' } | { name: 'entdecken' } | { name: 'app'; id: string };
export type Tab = 'start' | 'apps' | 'entdecken';

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'apps') return { name: 'apps' };
  if (parts[0] === 'entdecken') return { name: 'entdecken' };
  if (parts[0] === 'app' && parts[1]) return { name: 'app', id: decodeURIComponent(parts[1]) };
  return { name: 'start' };
}
