// Renders the CrazyGames cover images from store/cover.html into store/covers/.
// Needs a local server on the repo root and Playwright:
//   python3 -m http.server 8080 &  npm i --no-save playwright && node scripts/build-covers.mjs
import { mkdirSync } from 'node:fs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = process.env.COVER_URL || 'http://localhost:8080/store/cover.html';
const SIZES = [
  ['cover-landscape-1920x1080.png', 1920, 1080],
  ['cover-portrait-800x1200.png', 800, 1200],
  ['cover-square-800x800.png', 800, 800],
];

mkdirSync(new URL('../store/covers/', import.meta.url), { recursive: true });
const browser = await chromium.launch();
for (const [file, w, h] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${BASE}?w=${w}&h=${h}`);
  await page.waitForSelector('body[data-ready="1"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: new URL(`../store/covers/${file}`, import.meta.url).pathname });
  console.log('wrote store/covers/' + file);
  await page.close();
}
await browser.close();
