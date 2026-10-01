// Records the CrazyGames preview videos (landscape 1920x1080, portrait 1080x1620, ~19 s) by playing the real game.
// Opening and closing frame is the cover (store/cover.html). Output: store/marketing/videos/*.mp4
// Needs a local server on the repo root, Playwright and ffmpeg:
//   python3 -m http.server 8080 &  npm i --no-save playwright && node scripts/build-preview-videos.mjs
// FFMPEG=/path/to/ffmpeg overrides the ffmpeg binary.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const BASE = process.env.GAME_URL || 'http://localhost:8080/';
const OUT = new URL('../store/marketing/videos/', import.meta.url).pathname;
const SHOTS = new URL('../store/marketing/screenshots/', import.meta.url).pathname;
const COVER_S = 1.5;

const FORMATS = [
  { file: 'preview-landscape-1920x1080.mp4', w: 1920, h: 1080, viewport: { width: 960, height: 540 }, scale: 2, mobile: false, shots: true },
  { file: 'preview-portrait-1080x1620.mp4', w: 1080, h: 1620, viewport: { width: 540, height: 810 }, scale: 2, mobile: true },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function record(browser, f) {
  const work = join(tmpdir(), `rr-video-${f.w}x${f.h}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  // Cover frame at the exact video size.
  const cp = await browser.newPage({ viewport: { width: f.w, height: f.h } });
  await cp.goto(`${BASE}store/cover.html?w=${f.w}&h=${f.h}`);
  await cp.waitForSelector('body[data-ready="1"]');
  await cp.waitForTimeout(300);
  await cp.screenshot({ path: join(work, 'cover.jpg'), type: 'jpeg', quality: 95 });
  await cp.close();

  const ctx = await browser.newContext({ viewport: f.viewport, deviceScaleFactor: f.scale, hasTouch: f.mobile, isMobile: f.mobile, locale: 'en-US' });
  const p = await ctx.newPage();
  await p.goto(BASE + 'index.html');
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForSelector('#menu:not([hidden])');
  await p.click('[data-act="slotNew"][data-slot="1"]');
  await p.fill('#start-name', 'Commander');
  await p.click('.country-card[data-id="DE"]');
  await p.click('[data-act="startGame"]');
  const dismiss = async () => {
    for (let i = 0; i < 4; i++) {
      await p.waitForTimeout(400);
      if (!(await p.isVisible('#modal'))) return;
      if (await p.isVisible('#modal [data-act="claimLogin"]')) await p.click('#modal [data-act="claimLogin"]');
      else await p.click('#modal [data-act="closeModal"]');
    }
  };
  await dismiss();

  // A citizen a few days into their career.
  await p.evaluate(() => {
    const { state: s, G } = window.__rr;
    Object.assign(s.player, { level: 14, strength: 3400, rankPoints: 9000, money: 6000, gold: 45 });
    for (const t of ['farm', 'bakery', 'mine', 'armory']) G.build(s, t);
    s.companies.forEach((c) => { c.pending = G.companyCap(s, c) * 0.8; });
    s.inv.food = [0, 200, 80, 40, 20, 10];
    s.inv.weapon = [0, 300, 100, 60, 40, 200];
    s.inv.bazooka = 5;
    s.player.money = 4250;
    s.player.energy = G.maxEnergy(s);
    s.tutorial && (s.tutorial.step = 99);
  });
  await p.click('#tabs [data-tab="home"]');
  await dismiss();

  // Capture every painted frame with its timestamp; keep only frames inside a marked scene.
  const cdp = await ctx.newCDPSession(p);
  const frames = [];
  let scene = null;
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    if (scene) frames.push({ t: metadata.timestamp, data, scene: scene.n });
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: f.w, maxHeight: f.h, everyNthFrame: 1 });
  const scenes = [];
  const shoot = async (fn) => {
    scene = { n: scenes.length, start: Date.now() / 1000 };
    await fn();
    scene.end = Date.now() / 1000;
    scenes.push(scene);
    scene = null;
  };

  // 1) Battle: headshots, combos and a bazooka blast.
  await p.click('#tabs [data-tab="war"]');
  await p.waitForTimeout(300);
  await p.click('[data-act="fight"]');
  await p.waitForSelector('#battle:not([hidden])');
  await p.waitForTimeout(1300);
  const box = await p.locator('#bcv').boundingBox();
  await p.click('[data-bact="wep"][data-q="5"]');
  await shoot(async () => {
    const t0 = Date.now();
    let baz = false;
    let shot = false;
    let tick = false;
    while (Date.now() - t0 < 7200) {
      if (!baz && Date.now() - t0 > 3800) {
        const tg = await p.evaluate(() => window.__rr.targets());
        if (tg.length >= 2) { await p.click('[data-bact="baz"]'); await p.mouse.click(box.x + tg[0].bx, box.y + tg[0].by); baz = true; await wait(350); continue; }
      }
      const tg = await p.evaluate(() => window.__rr.targets());
      if (tg.length) {
        const e = tg[Math.floor(Math.random() * tg.length)];
        const head = Math.random() < 0.6;
        await p.mouse.click(box.x + (head ? e.hx : e.bx), box.y + (head ? e.hy : e.by));
      }
      if (!tick && Date.now() - t0 > 1500) { tick = true; await p.evaluate(() => { window.__rr.state.world.nextAiTick = Date.now() - 1; }); } // allies' damage lands on screen
      if (f.shots && !shot && Date.now() - t0 > 5200) { shot = true; await p.screenshot({ path: SHOTS + '1-battle.png' }); }
      await wait(170);
    }
  });
  await p.click('[data-bact="leave"]');
  await p.waitForTimeout(500);
  if (await p.isVisible('#battle [data-bact="exit"]')) await p.click('#battle [data-bact="exit"]');
  await p.waitForTimeout(400);
  await dismiss();

  // 2) Home: the map of Europe with a region selected.
  await p.click('#tabs [data-tab="home"]');
  await p.waitForTimeout(400);
  await shoot(async () => {
    await wait(700);
    const r = await p.evaluate(() => {
      const s = window.__rr.state;
      const c = s.world.campaigns[0];
      return c ? c.region : s.world.regions.findIndex((x) => x.c === s.player.country);
    });
    await p.evaluate((id) => document.querySelector(`[data-act="region"][data-id="${id}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true })), r);
    await wait(1600);
  });

  // 3) Economy: collect production.
  await p.click('#tabs [data-tab="economy"]');
  await p.waitForTimeout(300);
  await shoot(async () => {
    await wait(600);
    await p.click('[data-act="collect"]');
    await wait(1700);
  });

  // 4) Home: train into a level up.
  await p.click('#tabs [data-tab="home"]');
  await p.waitForTimeout(300);
  await p.evaluate(() => { const s = window.__rr.state; s.player.xp = 30 + s.player.level * 20 - 1; });
  await shoot(async () => {
    await wait(500);
    await p.click('[data-act="train"]');
    await wait(2200);
  });

  await cdp.send('Page.stopScreencast');

  // Marketing screenshots of the other screens.
  if (f.shots) {
    await p.waitForTimeout(2500); // let the level-up banner fade
    for (const [n, tab] of [['2-home', 'home'], ['3-economy', 'economy'], ['4-market', 'market'], ['5-politics', 'politics'], ['6-citizens', 'people']]) {
      await p.click(`#tabs [data-tab="${tab}"]`);
      await p.waitForTimeout(500);
      await p.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
      await p.screenshot({ path: SHOTS + n + '.png' });
    }
  }
  await ctx.close();

  // Frames -> concat list with real durations, cover at both ends.
  const list = [`file '${join(work, 'cover.jpg')}'`, `duration ${COVER_S}`];
  let k = 0;
  for (const sc of scenes) {
    const fs = frames.filter((x) => x.scene === sc.n);
    fs.forEach((fr, i) => {
      const next = i + 1 < fs.length ? fs[i + 1].t : sc.end;
      const start = i === 0 ? Math.max(sc.start, fr.t) : fr.t;
      const d = Math.max(0.001, next - start);
      const path = join(work, `f${String(k++).padStart(5, '0')}.jpg`);
      writeFileSync(path, Buffer.from(fr.data, 'base64'));
      list.push(`file '${path}'`, `duration ${d.toFixed(4)}`);
    });
  }
  list.push(`file '${join(work, 'cover.jpg')}'`, `duration ${COVER_S}`, `file '${join(work, 'cover.jpg')}'`);
  writeFileSync(join(work, 'list.txt'), list.join('\n'));
  const vf = `scale=${f.w}:${f.h}:force_original_aspect_ratio=decrease,pad=${f.w}:${f.h}:(ow-iw)/2:(oh-ih)/2:color=0x0a0f1a,format=yuv420p`;
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(work, 'list.txt'),
    '-vf', vf, '-fps_mode', 'cfr', '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-an', '-movflags', '+faststart', join(OUT, f.file)]);
  const dur = scenes.reduce((a, s) => a + s.end - s.start, 0) + COVER_S * 2;
  console.log(`wrote store/marketing/videos/${f.file}: ${dur.toFixed(1)} s, ${k} frames (${(k / (dur - COVER_S * 2)).toFixed(0)} fps captured)`);
}

mkdirSync(OUT, { recursive: true });
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch();
for (const f of FORMATS) {
  if (process.argv[2] && !f.file.includes(process.argv[2])) continue;
  await record(browser, f);
}
await browser.close();
