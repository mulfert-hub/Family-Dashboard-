// Erzeugt die PNG-Icons aus public/icons/icon.svg (braucht Playwright mit Chromium).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright: lokal installiert oder global vorhanden
const { chromium } = createRequire(import.meta.url)('playwright');

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
// Maskierbar: volle Fläche ohne runde Ecken, Motiv in der sicheren Zone (80 %)
const inner = svg.replace(/^[\s\S]*?<rect[^>]*\/>/, '').replace(/<\/svg>\s*$/, '');
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#2f6b4f"/><g transform="translate(51.2 51.2) scale(.8)">${inner}</g></svg>`;
// Apple: iOS rundet selbst ab, daher ebenfalls volle Fläche
const apple = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#2f6b4f"/><g transform="translate(25.6 25.6) scale(.9)">${inner}</g></svg>`;

const jobs = [
  ['icon-192.png', svg, 192],
  ['icon-512.png', svg, 512],
  ['icon-maskable-512.png', maskable, 512],
  ['apple-touch-icon.png', apple, 180],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, src, size] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="data:image/svg+xml;base64,${Buffer.from(src).toString('base64')}">`,
  );
  await page.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname, omitBackground: true });
  console.log('✓', name);
}
await browser.close();
