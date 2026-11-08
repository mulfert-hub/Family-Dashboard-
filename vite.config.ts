import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Für GitHub Pages wird BASE_PATH=/<repo-name>/ gesetzt, lokal ist es "/".
const base = process.env.BASE_PATH ?? '/';
const version = (process.env.GITHUB_SHA ?? 'lokal').slice(0, 7);

// Unterordner der Apps aus eigenen Repositories (z. B. kochbuch/): Diese Seiten gehören den Apps selbst
// und ihren eigenen Service Workern – der Service Worker der Startseite darf sie nicht abfangen.
// Apps ohne "repo" (Ausflüge, Galerie) liegen in diesem Repository und werden hier mitgebaut.
const apps: Array<{ path?: string; repo?: string }> = JSON.parse(readFileSync(new URL('./apps.json', import.meta.url), 'utf8')).apps;
const appPaths = apps.filter((a) => a.repo).map((a) => a.path).filter((p): p is string => !!p);
const localPages = apps.filter((a) => !a.repo && a.path).map((a) => a.path!.replace(/\/$/, ''));
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: {
    rollupOptions: {
      input: Object.fromEntries([
        ['index', fileURLToPath(new URL('./index.html', import.meta.url))],
        ...localPages.map((p) => [p, fileURLToPath(new URL(`./${p}/index.html`, import.meta.url))]),
      ]),
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      workbox: {
        // Zeigt Push-Mitteilungen aller Apps der Familie an (public/familie-push.js)
        importScripts: ['familie-push.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2,webmanifest}'],
        globIgnores: appPaths.map((p) => `${p}**`),
        navigateFallback: 'index.html',
        navigateFallbackDenylist: appPaths.map((p) => new RegExp(`/${escapeRe(p)}`)),
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      manifest: {
        id: '.',
        name: 'Familie Ulfert',
        short_name: 'Familie',
        description: 'Alle Apps der Familie Ulfert an einem Ort.',
        lang: 'de',
        dir: 'ltr',
        start_url: '.',
        // Der Bereich umfasst auch die Unterordner der Apps: So bleiben Kochbuch & Co. im
        // installierten Zustand im Vollbild, statt in einem Browserfenster aufzugehen.
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fffcf8',
        theme_color: '#fffcf8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
