// Baut alle Apps aus apps.json, die ein eigenes Repository haben, und legt sie als Unterordner
// in dist/ ab (z. B. dist/kochbuch/). Vorher muss die Startseite gebaut sein (npm run build).
//
// Umgebungsvariablen:
//   BASE_PATH   Pfad der Startseite auf dem Server, z. B. /Family-Dashboard-/ (Standard: /)
//   APPS_LOCAL  optional: id=Ordner,… – lokale Kopie statt Klonen, z. B. kochbuch=../Kochbuch
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const dist = join(root, 'dist');
const srcDir = join(root, '.apps-src');
const base = process.env.BASE_PATH ?? '/';
const local = Object.fromEntries(
  (process.env.APPS_LOCAL ?? '')
    .split(',')
    .filter(Boolean)
    .map((e) => e.split('=').map((s) => s.trim())),
);

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/ fehlt – zuerst „npm run build“ ausführen.');
  process.exit(1);
}

const { apps } = JSON.parse(readFileSync(join(root, 'apps.json'), 'utf8'));
const run = (cmd, args, cwd, env = {}) =>
  execFileSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });

for (const app of apps) {
  if (app.status !== 'live' || !app.repo || !app.path) continue;
  console.log(`\n▶ ${app.name} (${app.repo}) → ${base}${app.path}`);

  let dir = local[app.id] ? resolve(root, local[app.id]) : join(srcDir, app.id);
  if (!local[app.id]) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(srcDir, { recursive: true });
    run('git', ['clone', '--depth', '1', '--branch', app.branch ?? 'main', `https://github.com/${app.repo}.git`, dir], root);
  }

  run('npm', ['ci', '--no-audit', '--no-fund'], dir);
  run('npm', ['run', 'build'], dir, {
    BASE_PATH: `${base}${app.path}`,
    // Für den Knopf „Familie Ulfert“ in der App: zurück zur Startseite
    VITE_FAMILIE_URL: base,
  });

  const target = join(dist, app.path);
  rmSync(target, { recursive: true, force: true });
  cpSync(join(dir, 'dist'), target, { recursive: true });
  console.log(`✓ ${app.name} liegt in dist/${app.path}`);
}
