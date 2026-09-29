// Renders the CrazyGames cover images from store/cover.html into store/marketing/covers/.
// Needs a local server on the repo root and Playwright:
//   python3 -m http.server 8080 &  npm i --no-save playwright && node scripts/build-covers.mjs
import { mkdirSync } from 'node:fs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = process.env.COVER_URL || 'http://localhost:8080/store/cover.html';
const SIZES = [
  ['cover-landscape-1920x1080.png', 1920, 1080],
  ['cover-portrait-800x1200.png', 800, 1200],
  ['cover-square-800x800.png', 800, 800],
  ['../logo/logo-transparent-2000x700.png', 2000, 700, 'logo'],
];

for (const d of ['covers', 'logo']) mkdirSync(new URL(`../store/marketing/${d}/`, import.meta.url), { recursive: true });
const browser = await chromium.launch();
for (const [file, w, h, mode] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${BASE}?w=${w}&h=${h}${mode ? '&' + mode : ''}`);
  await page.waitForSelector('body[data-ready="1"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: new URL(`../store/marketing/covers/${file}`, import.meta.url).pathname, omitBackground: !!mode });
  console.log('wrote ' + new URL(`../store/marketing/covers/${file}`, import.meta.url).pathname.replace(/.*\/store\//, 'store/'));
  await page.close();
}
await browser.close();
