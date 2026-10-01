// Procedural art for the battle screen: a ruined modern city at dusk, cover lines,
// soldiers in modern gear and the player's carbine. Everything is drawn once into
// offscreen canvases (sprites) so each frame only composites images.
import { countryById } from './data.js';
import { flagSvg } from './flags.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// Mixes two colours ('#rrggbb' or 'rgb()') -> 'rgb()'.
export function mix(a, b, t) {
  const p = (h) => (h[0] === '#' ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : h.match(/\d+/g).slice(0, 3).map(Number));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ------------------------------------------------------------ soft sprites
function softSprite(size, stops) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

let soft = null;
export function sprites() {
  if (soft) return soft;
  soft = {
    smoke: softSprite(128, [[0, 'rgba(70,72,78,.55)'], [0.45, 'rgba(60,62,68,.32)'], [1, 'rgba(50,52,58,0)']]),
    dust: softSprite(96, [[0, 'rgba(170,150,120,.55)'], [0.5, 'rgba(150,130,100,.25)'], [1, 'rgba(140,120,90,0)']]),
    fire: softSprite(128, [[0, 'rgba(255,250,220,1)'], [0.2, 'rgba(255,200,90,.95)'], [0.5, 'rgba(240,100,30,.6)'], [1, 'rgba(160,30,10,0)']]),
    glow: softSprite(128, [[0, 'rgba(255,230,160,.9)'], [0.35, 'rgba(255,170,70,.35)'], [1, 'rgba(255,120,40,0)']]),
    red: softSprite(64, [[0, 'rgba(255,80,60,.95)'], [0.4, 'rgba(255,40,40,.35)'], [1, 'rgba(255,0,0,0)']]),
  };
  return soft;
}

// ------------------------------------------------------------ flags as images (for patches and the intro)
const flagImgs = {};
let onFlagLoad = () => {};
export function setFlagListener(f) { onFlagLoad = f; }
export function flagImage(id) {
  if (flagImgs[id]) return flagImgs[id];
  const svg = flagSvg(id).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="60" ');
  const img = new Image();
  const rec = { img, ready: false };
  img.onload = () => { rec.ready = true; onFlagLoad(id); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  flagImgs[id] = rec;
  return rec;
}

// ------------------------------------------------------------ soldier sprite
// Local units: (0,0) is where the soldier meets the top of his cover; head centre (0,-58), radius 11.
// The hit boxes in battle.js use the same numbers.
const BOX = { x: -36, y: -80, w: 72, h: 92 };
export const SOLDIER_MUZZLE = { x: -29, y: -15 };
const spriteCache = new Map();
export function clearSprites() { spriteCache.clear(); }

function hash(s) { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

export function soldierSprite(id, s, dpr) {
  const key = `${id}|${s.toFixed(3)}|${dpr}`;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const k = s * dpr;
  const c = canvas(BOX.w * k, BOX.h * k);
  const g = c.getContext('2d');
  g.setTransform(k, 0, 0, k, -BOX.x * k, -BOX.y * k);
  paintSoldier(g, id);
  const white = canvas(c.width, c.height);
  const wg = white.getContext('2d');
  wg.drawImage(c, 0, 0);
  wg.globalCompositeOperation = 'source-in';
  wg.fillStyle = 'rgba(255,255,255,.92)';
  wg.fillRect(0, 0, c.width, c.height);
  const sp = { img: c, white, box: BOX };
  spriteCache.set(key, sp);
  return sp;
}

function paintSoldier(g, id) {
  const cc = countryById(id);
  const tint = cc ? cc.color : '#6b7280';
  const desert = hash(id) % 3 === 0;
  const uni = mix(desert ? '#8a7d5e' : '#56604a', tint, 0.22);
  const uniD = mix(desert ? '#5e5440' : '#363d2e', tint, 0.18);
  const vest = mix(desert ? '#7a6c4f' : '#414836', tint, 0.12);
  const vestD = mix(desert ? '#544a36' : '#2b3024', tint, 0.1);
  const helm = mix(desert ? '#9a8c66' : '#5f6449', tint, 0.1);
  const helmD = mix(desert ? '#665b42' : '#3a3e2c', tint, 0.08);
  const OUT = 'rgba(6,8,12,.6)';
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // shadow behind the soldier
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.beginPath();
  g.ellipse(2, -20, 24, 40, 0, 0, TAU);
  g.fill();

  // torso
  let gr = g.createLinearGradient(-20, 0, 20, 0);
  gr.addColorStop(0, uni);
  gr.addColorStop(1, uniD);
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(-18, 10);
  g.lineTo(-20, -33);
  g.quadraticCurveTo(-20, -46, -8, -47);
  g.lineTo(8, -47);
  g.quadraticCurveTo(20, -46, 20, -33);
  g.lineTo(18, 10);
  g.closePath();
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 1.3;
  g.stroke();
  // camo blotches
  g.save();
  g.clip();
  g.fillStyle = 'rgba(0,0,0,.14)';
  for (const [x, y, rx, ry] of [[-14, -30, 5, 3], [12, -12, 6, 3], [-10, 0, 4, 3], [14, -36, 4, 2.5]]) { g.beginPath(); g.ellipse(x, y, rx, ry, 0.5, 0, TAU); g.fill(); }
  g.restore();

  // plate carrier
  gr = g.createLinearGradient(0, -42, 0, 6);
  gr.addColorStop(0, vest);
  gr.addColorStop(1, vestD);
  g.fillStyle = gr;
  rr(g, -13.5, -42, 27, 48, 4);
  g.fill();
  g.strokeStyle = OUT;
  g.stroke();
  g.fillStyle = vestD;
  g.fillRect(-12.5, -47, 5, 7);
  g.fillRect(7.5, -47, 5, 7);
  // admin pouch + magazine pouches
  g.fillStyle = mix('#000000', vest, 0.75);
  rr(g, -9, -38, 18, 8, 1.5);
  g.fill();
  for (const x of [-12, -3.5, 5]) {
    g.fillStyle = vestD;
    rr(g, x, -24, 7.5, 13, 1.5);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.12)';
    g.fillRect(x + 0.5, -24, 6.5, 2);
  }
  // MOLLE webbing
  g.strokeStyle = 'rgba(0,0,0,.28)';
  g.lineWidth = 0.7;
  for (const y of [-8, -4, 0]) { g.beginPath(); g.moveTo(-12, y); g.lineTo(12, y); g.stroke(); }
  // radio antenna
  g.strokeStyle = '#15171b';
  g.lineWidth = 1.1;
  g.beginPath();
  g.moveTo(12, -44);
  g.lineTo(17, -66);
  g.stroke();

  // flag patch on the shoulder
  const f = flagImage(id);
  g.save();
  g.translate(-19.5, -41);
  g.rotate(-0.12);
  g.fillStyle = '#e5e7eb';
  g.fillRect(-0.6, -0.6, 10.2, 7.2);
  if (f.ready) g.drawImage(f.img, 0, 0, 9, 6);
  else { g.fillStyle = tint; g.fillRect(0, 0, 9, 6); }
  g.restore();

  // arms (behind the rifle)
  g.strokeStyle = uniD;
  g.lineWidth = 7.5;
  g.beginPath();
  g.moveTo(-16, -40);
  g.quadraticCurveTo(-22, -28, -15, -21);
  g.stroke();
  g.beginPath();
  g.moveTo(15, -41);
  g.quadraticCurveTo(18, -30, 11, -24);
  g.stroke();

  // rifle across the chest, muzzle towards the viewer's left
  g.save();
  g.translate(2, -26);
  g.rotate(-0.35);
  const metal = '#1d2025';
  g.fillStyle = '#16181c';
  rr(g, 10, -3.2, 11, 7, 2); g.fill(); // stock
  g.fillStyle = metal;
  rr(g, -7, -3.6, 18, 7.2, 1.5); g.fill(); // receiver
  g.fillStyle = '#131518';
  g.beginPath(); g.moveTo(-0.5, 3.4); g.lineTo(4, 3.4); g.lineTo(3, 12.5); g.lineTo(-2.5, 11.8); g.closePath(); g.fill(); // magazine
  g.beginPath(); g.moveTo(7.5, 3.4); g.lineTo(10.5, 3.4); g.lineTo(11.8, 9.5); g.lineTo(9, 9.8); g.closePath(); g.fill(); // grip
  g.fillStyle = '#2a2e35';
  rr(g, -23, -3, 17, 6, 1.4); g.fill(); // handguard
  g.fillStyle = 'rgba(0,0,0,.45)';
  for (let x = -21; x < -8; x += 3.2) g.fillRect(x, -0.8, 1.8, 1.6);
  g.fillStyle = '#0e0f12';
  g.fillRect(-30, -1.3, 8, 2.6); // barrel
  g.fillRect(-33, -1.9, 3.5, 3.8); // muzzle device
  g.fillStyle = '#121418';
  rr(g, -5, -8.5, 10, 4.8, 1.4); g.fill(); // optic
  g.fillStyle = 'rgba(80,190,255,.75)';
  g.beginPath(); g.arc(-4.6, -6.1, 1.6, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.18)';
  g.fillRect(-7, -3.6, 18, 1.2); // receiver highlight
  // gloves
  g.fillStyle = '#1b1d21';
  g.beginPath(); g.arc(-15, 0.5, 3.4, 0, TAU); g.fill();
  g.beginPath(); g.arc(9.5, 4.5, 3.2, 0, TAU); g.fill();
  g.restore();

  // neck + head (balaclava)
  g.fillStyle = '#23262c';
  g.fillRect(-5, -50, 10, 5);
  gr = g.createRadialGradient(-3, -61, 2, 0, -58, 12);
  gr.addColorStop(0, '#3a3f47');
  gr.addColorStop(1, '#1d2025');
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, -58, 11, 0, TAU); g.fill();
  // goggles
  g.fillStyle = '#121418';
  rr(g, -11.5, -63, 23, 7.2, 3.2); g.fill();
  gr = g.createLinearGradient(-10, -62, 10, -56);
  gr.addColorStop(0, '#f59e0b');
  gr.addColorStop(0.5, '#7c3a12');
  gr.addColorStop(1, '#1e3a5f');
  g.fillStyle = gr;
  rr(g, -9.8, -61.8, 19.6, 4.9, 2.4); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.65)';
  g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(-7, -60.5); g.lineTo(-3, -60.5); g.stroke();
  // helmet
  gr = g.createRadialGradient(-5, -72, 1, 0, -64, 16);
  gr.addColorStop(0, mix('#ffffff', helm, 0.7));
  gr.addColorStop(0.45, helm);
  gr.addColorStop(1, helmD);
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(-14.5, -61);
  g.bezierCurveTo(-15, -77, 15, -77, 14.5, -61);
  g.lineTo(13, -60);
  g.quadraticCurveTo(0, -63, -13, -60);
  g.closePath();
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 1.2;
  g.stroke();
  g.fillStyle = helmD;
  g.fillRect(-15, -66, 3, 5); // side rails
  g.fillRect(12, -66, 3, 5);
  g.fillStyle = '#16181c';
  rr(g, -3.5, -75, 7, 4.5, 1.2); g.fill(); // NVG mount
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.lineWidth = 0.9;
  g.beginPath(); g.moveTo(-13, -67); g.quadraticCurveTo(0, -71, 13, -67); g.stroke(); // band
}

// ------------------------------------------------------------ static background
export function buildBackground(W, H, dpr, unit) {
  const c = canvas(W * dpr, H * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const hz = H * 0.43;

  // sky
  let gr = g.createLinearGradient(0, 0, 0, hz);
  gr.addColorStop(0, '#0a1322');
  gr.addColorStop(0.45, '#1c2c42');
  gr.addColorStop(0.78, '#4b4a58');
  gr.addColorStop(1, '#c2704a');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, hz + 2);
  // low sun
  gr = g.createRadialGradient(W * 0.76, hz - H * 0.02, 0, W * 0.76, hz - H * 0.02, H * 0.42);
  gr.addColorStop(0, 'rgba(255,190,120,.75)');
  gr.addColorStop(0.15, 'rgba(255,150,90,.35)');
  gr.addColorStop(1, 'rgba(255,120,80,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, hz + 2);
  // cloud streaks
  for (let i = 0; i < 9; i++) {
    const x = rand(-0.1, 1) * W;
    const y = rand(0.04, 0.32) * H;
    const w = rand(120, 320) * unit;
    gr = g.createRadialGradient(x, y, 0, x, y, w);
    gr.addColorStop(0, `rgba(255,${180 + Math.round(y / H * 120)},170,${rand(0.05, 0.11)})`);
    gr.addColorStop(1, 'rgba(255,200,170,0)');
    g.save();
    g.translate(x, y);
    g.scale(1, 0.16);
    g.translate(-x, -y);
    g.fillStyle = gr;
    g.fillRect(x - w, y - w, w * 2, w * 2);
    g.restore();
  }

  // far skyline
  skyline(g, W, hz, H, unit, { base: hz + 2, hMin: 0.05, hMax: 0.17, wMin: 16, wMax: 54, col: '#3d4559', win: 0.05, broken: 0.25 });
  // haze over the far city
  gr = g.createLinearGradient(0, hz - H * 0.18, 0, hz + 4);
  gr.addColorStop(0, 'rgba(190,120,100,0)');
  gr.addColorStop(1, 'rgba(200,120,90,.35)');
  g.fillStyle = gr;
  g.fillRect(0, hz - H * 0.18, W, H * 0.18 + 4);
  // pylons and wires
  pylons(g, W, hz, unit);
  // closer ruins
  skyline(g, W, hz, H, unit, { base: hz + 6, hMin: 0.025, hMax: 0.1, wMin: 24, wMax: 70, col: '#232a3a', win: 0, broken: 0.6, holes: true });
  crane(g, W * rand(0.3, 0.5), hz + 4, H * 0.2, unit);

  // ground
  gr = g.createLinearGradient(0, hz, 0, H);
  gr.addColorStop(0, '#4a4438');
  gr.addColorStop(0.25, '#36322a');
  gr.addColorStop(1, '#17150f');
  g.fillStyle = gr;
  g.fillRect(0, hz, W, H - hz);
  // road to the horizon
  const vx = W * 0.44;
  g.fillStyle = 'rgba(25,25,28,.55)';
  g.beginPath();
  g.moveTo(vx - W * 0.02, hz);
  g.lineTo(vx + W * 0.02, hz);
  g.lineTo(W * 0.98, H);
  g.lineTo(-W * 0.1, H);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(230,200,120,.35)';
  for (let i = 0; i < 9; i++) {
    const t0 = Math.pow(i / 9, 1.8);
    const t1 = Math.pow((i + 0.45) / 9, 1.8);
    const y0 = hz + (H - hz) * t0;
    const y1 = hz + (H - hz) * t1;
    const x0 = vx + (W * 0.44 - vx) * t0;
    const x1 = vx + (W * 0.44 - vx) * t1;
    g.lineWidth = 1 + t1 * 6 * unit;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  // craters and rubble, larger towards the viewer
  for (let i = 0; i < 7; i++) {
    const t = rand(0.12, 0.95);
    const y = hz + (H - hz) * t;
    const x = rand(0, W);
    const r = (18 + 70 * t) * unit;
    gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(10,9,7,.75)');
    gr.addColorStop(0.65, 'rgba(25,22,18,.45)');
    gr.addColorStop(0.85, 'rgba(120,105,80,.25)');
    gr.addColorStop(1, 'rgba(120,105,80,0)');
    g.save();
    g.translate(x, y); g.scale(1, 0.32); g.translate(-x, -y);
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
  }
  for (let i = 0; i < 260; i++) {
    const t = Math.pow(Math.random(), 0.7);
    const y = hz + (H - hz) * t;
    const x = rand(0, W);
    const sz = (0.8 + t * 5) * unit * rand(0.5, 1.4);
    g.fillStyle = Math.random() < 0.5 ? `rgba(20,18,14,${rand(0.3, 0.7)})` : `rgba(150,135,110,${rand(0.15, 0.4)})`;
    g.beginPath();
    g.moveTo(x, y - sz * 0.6);
    g.lineTo(x + sz, y);
    g.lineTo(x + sz * 0.3, y + sz * 0.4);
    g.lineTo(x - sz * 0.8, y + sz * 0.1);
    g.closePath();
    g.fill();
  }
  // wrecks
  wreck(g, W * 0.86, H * 0.56, 1.0 * unit, 'apc');
  wreck(g, W * 0.1, H * 0.6, 0.9 * unit, 'car');
  return c;
}

function skyline(g, W, hz, H, unit, o) {
  let x = -10;
  while (x < W + 10) {
    const w = rand(o.wMin, o.wMax) * unit;
    const h = rand(o.hMin, o.hMax) * H;
    const top = o.base - h;
    g.fillStyle = o.col;
    g.beginPath();
    g.moveTo(x, o.base);
    if (Math.random() < o.broken) {
      // a shelled top: jagged outline
      g.lineTo(x, top + h * 0.25);
      const n = 4 + Math.floor(Math.random() * 4);
      for (let i = 1; i < n; i++) g.lineTo(x + (w * i) / n, top + rand(0, h * 0.45));
      g.lineTo(x + w, top + h * rand(0.1, 0.5));
    } else {
      g.lineTo(x, top);
      g.lineTo(x + w, top);
      if (Math.random() < 0.3) { g.lineTo(x + w, top); g.moveTo(x + w * 0.5, top); }
    }
    g.lineTo(x + w, o.base);
    g.closePath();
    g.fill();
    if (Math.random() < 0.25) {
      g.strokeStyle = o.col;
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x + w * 0.6, top); g.lineTo(x + w * 0.6, top - rand(8, 22) * unit); g.stroke();
    }
    if (o.win) {
      g.fillStyle = 'rgba(255,200,130,.55)';
      for (let yy = top + 5 * unit; yy < o.base - 4; yy += 6 * unit) {
        for (let xx = x + 3 * unit; xx < x + w - 3 * unit; xx += 5 * unit) if (Math.random() < o.win) g.fillRect(xx, yy, 1.6 * unit, 2 * unit);
      }
    }
    if (o.holes) {
      g.fillStyle = 'rgba(5,6,10,.7)';
      for (let i = 0; i < 4; i++) if (Math.random() < 0.6) g.fillRect(x + rand(0.1, 0.7) * w, top + rand(0.3, 0.8) * h, rand(3, 9) * unit, rand(2, 6) * unit);
      g.strokeStyle = 'rgba(0,0,0,.35)';
      g.lineWidth = 1;
      for (let yy = top + 7 * unit; yy < o.base; yy += 7 * unit) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
    }
    x += w + rand(-2, 6) * unit;
  }
}

function pylons(g, W, hz, unit) {
  const xs = [W * 0.05, W * 0.33, W * 0.62, W * 0.93];
  const h = 34 * unit;
  g.strokeStyle = 'rgba(30,34,46,.9)';
  g.lineWidth = 1.2;
  for (const x of xs) {
    g.beginPath();
    g.moveTo(x - 5 * unit, hz + 3); g.lineTo(x, hz - h); g.lineTo(x + 5 * unit, hz + 3);
    g.moveTo(x - 8 * unit, hz - h * 0.8); g.lineTo(x + 8 * unit, hz - h * 0.8);
    g.stroke();
  }
  g.lineWidth = 0.8;
  g.strokeStyle = 'rgba(20,24,34,.7)';
  for (let i = 0; i + 1 < xs.length; i++) {
    for (const side of [-8, 8]) {
      g.beginPath();
      g.moveTo(xs[i] + side * unit, hz - h * 0.8);
      g.quadraticCurveTo((xs[i] + xs[i + 1]) / 2, hz - h * 0.45, xs[i + 1] + side * unit, hz - h * 0.8);
      g.stroke();
    }
  }
}

function crane(g, x, base, h, unit) {
  g.strokeStyle = 'rgba(24,28,40,.95)';
  g.lineWidth = 2 * unit;
  g.beginPath();
  g.moveTo(x, base); g.lineTo(x, base - h);
  g.moveTo(x - h * 0.25, base - h * 0.92); g.lineTo(x + h * 0.75, base - h * 0.92);
  g.stroke();
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(x, base - h * 1.05); g.lineTo(x + h * 0.7, base - h * 0.92);
  g.moveTo(x + h * 0.55, base - h * 0.92); g.lineTo(x + h * 0.55, base - h * 0.6);
  g.stroke();
}

function wreck(g, x, y, s, type) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.beginPath(); g.ellipse(0, 4, 60, 9, 0, 0, TAU); g.fill();
  const gr = g.createLinearGradient(0, -40, 0, 4);
  gr.addColorStop(0, '#3b3a36');
  gr.addColorStop(1, '#18171a');
  g.fillStyle = gr;
  g.beginPath();
  if (type === 'apc') {
    g.moveTo(-52, 0); g.lineTo(-48, -22); g.lineTo(-30, -30); g.lineTo(34, -30); g.lineTo(50, -16); g.lineTo(52, 0);
  } else {
    g.moveTo(-38, 0); g.lineTo(-36, -14); g.lineTo(-18, -16); g.lineTo(-8, -28); g.lineTo(18, -28); g.lineTo(28, -14); g.lineTo(40, -12); g.lineTo(40, 0);
  }
  g.closePath();
  g.fill();
  if (type === 'apc') {
    g.fillRect(-6, -40, 20, 10); // turret
    g.fillRect(12, -37, 28, 3); // gun
  }
  g.fillStyle = '#0e0e10';
  const wheels = type === 'apc' ? [-36, -14, 10, 32] : [-24, 24];
  for (const wx of wheels) { g.beginPath(); g.arc(wx, 0, type === 'apc' ? 8 : 7, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(160,80,40,.35)'; // scorch / rust
  g.beginPath(); g.ellipse(-8, -20, 14, 6, 0.2, 0, TAU); g.fill();
  g.restore();
}

// ------------------------------------------------------------ cover lines (HESCO, concrete, sandbags)
export function buildCover(W, y, s, dpr) {
  const top = y - 6 * s;
  const h = 46 * s;
  const c = canvas(W * dpr, (h + 10 * s) * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, -top * dpr);
  // contact shadow
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fillRect(0, y + 32 * s, W, 8 * s);
  let x = -rand(0, 30) * s;
  let last = '';
  while (x < W) {
    const pick = Math.random();
    let type = pick < 0.4 ? 'hesco' : pick < 0.7 ? 'concrete' : 'bags';
    if (type === last && Math.random() < 0.6) type = type === 'hesco' ? 'concrete' : 'hesco';
    last = type;
    const w = (type === 'hesco' ? 46 : type === 'concrete' ? 40 : 52) * s;
    const t = y + rand(0, 3) * s;
    if (type === 'hesco') hesco(g, x, t, w, y + 36 * s - t, s);
    else if (type === 'concrete') concrete(g, x, t, w, y + 36 * s - t, s);
    else bags(g, x, t, w, y + 36 * s - t, s);
    x += w - 1.5 * s;
  }
  return { img: c, top, h: h + 10 * s };
}

function hesco(g, x, y, w, h, s) {
  let gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, '#b29a6c');
  gr.addColorStop(1, '#6f5f42');
  g.fillStyle = gr;
  rr(g, x, y, w, h, 2.5 * s);
  g.fill();
  g.save();
  rr(g, x, y, w, h, 2.5 * s);
  g.clip();
  g.strokeStyle = 'rgba(40,34,24,.5)';
  g.lineWidth = 0.9;
  for (let xx = x + 5 * s; xx < x + w; xx += 6.5 * s) { g.beginPath(); g.moveTo(xx, y); g.lineTo(xx, y + h); g.stroke(); }
  for (let yy = y + 6 * s; yy < y + h; yy += 6.5 * s) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
  gr = g.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, 'rgba(255,255,255,.12)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0)');
  gr.addColorStop(1, 'rgba(0,0,0,.25)');
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
  g.restore();
  g.fillStyle = '#8f7a54';
  rr(g, x - 0.5 * s, y - 2.5 * s, w + s, 4 * s, 2 * s); // sand bulging over the top
  g.fill();
  g.strokeStyle = 'rgba(30,26,18,.6)';
  g.lineWidth = 1;
  rr(g, x, y, w, h, 2.5 * s);
  g.stroke();
}

function concrete(g, x, y, w, h, s) {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, '#a3a7aa');
  gr.addColorStop(0.15, '#868b8f');
  gr.addColorStop(1, '#4e5256');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(x + 4 * s, y);
  g.lineTo(x + w - 4 * s, y);
  g.lineTo(x + w - 2 * s, y + h * 0.55);
  g.lineTo(x + w, y + h);
  g.lineTo(x, y + h);
  g.lineTo(x + 2 * s, y + h * 0.55);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(20,22,24,.55)';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.fillRect(x + 4 * s, y, w - 8 * s, 1.5 * s);
  if (Math.random() < 0.55) {
    // hazard stripes
    g.save();
    g.beginPath();
    g.rect(x + 3 * s, y + h * 0.42, w - 6 * s, 5 * s);
    g.clip();
    g.fillStyle = '#d6a419';
    g.fillRect(x, y + h * 0.42, w, 5 * s);
    g.fillStyle = '#1c1c1c';
    for (let xx = x - 10 * s; xx < x + w + 10 * s; xx += 7 * s) {
      g.beginPath();
      g.moveTo(xx, y + h * 0.42 + 5 * s);
      g.lineTo(xx + 3.5 * s, y + h * 0.42 + 5 * s);
      g.lineTo(xx + 8.5 * s, y + h * 0.42);
      g.lineTo(xx + 5 * s, y + h * 0.42);
      g.closePath();
      g.fill();
    }
    g.restore();
  }
  // chips and bullet marks
  g.fillStyle = 'rgba(40,42,44,.55)';
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + rand(0.15, 0.85) * w, y + rand(0.1, 0.4) * h, rand(0.8, 1.8) * s, 0, TAU); g.fill(); }
}

function bags(g, x, y, w, h, s) {
  const rows = 3;
  const bh = h / rows;
  for (let r = 0; r < rows; r++) {
    const yy = y + r * bh;
    const off = r % 2 ? -w / 6 : 0;
    for (let i = -1; i < 3; i++) {
      const bx = x + off + i * (w / 2.6);
      const bw = w / 2.4;
      if (bx > x + w || bx + bw < x) continue;
      const gr = g.createLinearGradient(0, yy, 0, yy + bh);
      gr.addColorStop(0, r ? '#8a8262' : '#9a9170');
      gr.addColorStop(1, '#5c5741');
      g.fillStyle = gr;
      g.save();
      g.beginPath();
      g.rect(x, y - 3 * s, w, h + 3 * s);
      g.clip();
      rr(g, bx, yy - (r ? 0 : 1.5 * s), bw, bh + 1.5 * s, bh * 0.45);
      g.fill();
      g.strokeStyle = 'rgba(30,28,20,.55)';
      g.lineWidth = 0.9;
      g.stroke();
      g.restore();
    }
  }
}

export function buildVignette(W, H, dpr) {
  const c = canvas(W * dpr, H * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const gr = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.8);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(0,0,0,.6)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  return c;
}

// ------------------------------------------------------------ player's carbine (drawn each frame: it moves)
// m: { px, py, a, len, flip }, recoil 0..1, flash 0..1
export function drawCarbine(g, m, unit, recoil, flash, armed) {
  const L = m.len;
  const u = unit;
  g.save();
  g.translate(m.px, m.py);
  g.rotate(m.a);
  g.scale(1, m.flip);
  g.translate(-recoil * 22 * u, 0);
  const steel = '#1b1e23';
  if (armed) {
    // launcher tube instead of the rifle
    let gr = g.createLinearGradient(0, -18 * u, 0, 18 * u);
    gr.addColorStop(0, '#5a6447');
    gr.addColorStop(0.5, '#3e4631');
    gr.addColorStop(1, '#242a1c');
    g.fillStyle = gr;
    rr(g, -40 * u, -17 * u, L + 40 * u, 34 * u, 10 * u);
    g.fill();
    g.fillStyle = '#15180f';
    rr(g, L - 16 * u, -20 * u, 22 * u, 40 * u, 6 * u);
    g.fill();
    g.fillStyle = '#2b2f22';
    rr(g, L * 0.35, -30 * u, 30 * u, 14 * u, 3 * u);
    g.fill();
    g.fillStyle = '#d6a419';
    g.fillRect(L * 0.6, -17 * u, 8 * u, 34 * u);
    g.restore();
    return;
  }
  // stock / receiver
  let gr = g.createLinearGradient(0, -16 * u, 0, 16 * u);
  gr.addColorStop(0, '#3a3f47');
  gr.addColorStop(0.35, steel);
  gr.addColorStop(1, '#0f1114');
  g.fillStyle = gr;
  rr(g, -60 * u, -15 * u, L * 0.5 + 60 * u, 30 * u, 6 * u);
  g.fill();
  // magazine
  g.fillStyle = '#121418';
  g.beginPath();
  g.moveTo(L * 0.22, 14 * u);
  g.lineTo(L * 0.22 + 26 * u, 14 * u);
  g.lineTo(L * 0.22 + 20 * u, 62 * u);
  g.lineTo(L * 0.22 - 6 * u, 58 * u);
  g.closePath();
  g.fill();
  // handguard with M-LOK slots
  gr = g.createLinearGradient(0, -12 * u, 0, 12 * u);
  gr.addColorStop(0, '#4a5058');
  gr.addColorStop(0.4, '#2a2e35');
  gr.addColorStop(1, '#15171b');
  g.fillStyle = gr;
  rr(g, L * 0.46, -12 * u, L * 0.4, 24 * u, 4 * u);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,.55)';
  for (let x = L * 0.5; x < L * 0.82; x += 15 * u) rr(g, x, -3 * u, 9 * u, 6 * u, 2.5 * u), g.fill();
  // top rail
  g.fillStyle = '#0d0f12';
  g.fillRect(-10 * u, -19 * u, L * 0.86, 5 * u);
  g.fillStyle = 'rgba(255,255,255,.12)';
  for (let x = -8 * u; x < L * 0.85; x += 6 * u) g.fillRect(x, -19 * u, 2.5 * u, 1.5 * u);
  // barrel + muzzle brake
  g.fillStyle = '#0b0c0e';
  g.fillRect(L * 0.84, -5 * u, L * 0.13, 10 * u);
  g.fillStyle = '#16181c';
  rr(g, L * 0.95, -7.5 * u, 18 * u, 15 * u, 3 * u);
  g.fill();
  // holographic sight
  g.fillStyle = '#16181c';
  rr(g, L * 0.08, -44 * u, 52 * u, 26 * u, 5 * u);
  g.fill();
  g.fillStyle = 'rgba(120,200,255,.18)';
  rr(g, L * 0.08 + 6 * u, -40 * u, 40 * u, 16 * u, 3 * u);
  g.fill();
  g.fillStyle = 'rgba(255,60,60,.95)';
  g.beginPath(); g.arc(L * 0.08 + 26 * u, -32 * u, 2.2 * u, 0, TAU); g.fill();
  // foregrip + gloved hand
  g.fillStyle = '#121418';
  rr(g, L * 0.62, 10 * u, 14 * u, 30 * u, 5 * u);
  g.fill();
  gr = g.createLinearGradient(0, 0, 0, 40 * u);
  gr.addColorStop(0, '#3b3f36');
  gr.addColorStop(1, '#1f221c');
  g.fillStyle = gr;
  rr(g, L * 0.57, 4 * u, 34 * u, 26 * u, 11 * u);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,.4)';
  g.lineWidth = 1.5 * u;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(L * 0.6 + i * 9 * u, 8 * u); g.lineTo(L * 0.6 + i * 9 * u, 26 * u); g.stroke(); }
  // sleeve
  g.fillStyle = '#3f4636';
  g.beginPath();
  g.moveTo(L * 0.57, 12 * u);
  g.lineTo(L * 0.3, 90 * u);
  g.lineTo(L * 0.1, 90 * u);
  g.lineTo(L * 0.58, 26 * u);
  g.closePath();
  g.fill();
  // receiver highlight
  g.fillStyle = 'rgba(255,255,255,.08)';
  g.fillRect(-58 * u, -13 * u, L * 0.5 + 56 * u, 3 * u);
  g.restore();
  if (flash > 0) muzzleFlash(g, m, recoil, unit, flash);
}

function muzzleFlash(g, m, recoil, unit, k) {
  const x = m.px + Math.cos(m.a) * (m.len + 18 * unit - recoil * 22 * unit);
  const y = m.py + Math.sin(m.a) * (m.len + 18 * unit - recoil * 22 * unit);
  const sp = sprites();
  g.save();
  g.globalCompositeOperation = 'lighter';
  const r = 70 * unit * (0.7 + k * 0.5);
  g.globalAlpha = Math.min(1, k * 1.4);
  g.drawImage(sp.glow, x - r, y - r, r * 2, r * 2);
  g.translate(x, y);
  g.rotate(m.a + rand(-0.2, 0.2));
  g.fillStyle = 'rgba(255,240,190,.95)';
  g.beginPath();
  const spikes = 7;
  for (let i = 0; i < spikes * 2; i++) {
    const ang = (i / (spikes * 2)) * TAU;
    const rr2 = (i % 2 ? 6 : rand(16, 30)) * unit * (ang < 0.6 || ang > TAU - 0.6 ? 1.8 : 1);
    g.lineTo(Math.cos(ang) * rr2, Math.sin(ang) * rr2);
  }
  g.closePath();
  g.fill();
  g.restore();
}

// ------------------------------------------------------------ allied citizen, seen from behind
// Crouched behind the near cover, rifle raised towards the enemy lines (up and to the right).
// Local units: (0,0) is the top of the near cover; mirrored for allies on the right side.
const ABOX = { x: -44, y: -108, w: 120, h: 128 };
export const ALLY_MUZZLE = { x: 64, y: -99 };
const allyCache = new Map();

export function allySprite(id, s, dpr) {
  const key = `${id}|${s.toFixed(3)}|${dpr}`;
  if (allyCache.has(key)) return allyCache.get(key);
  const k = s * dpr;
  const c = canvas(ABOX.w * k, ABOX.h * k);
  const g = c.getContext('2d');
  g.setTransform(k, 0, 0, k, -ABOX.x * k, -ABOX.y * k);
  paintAlly(g, id);
  const sp = { img: c, box: ABOX };
  allyCache.set(key, sp);
  return sp;
}
export function clearAllySprites() { allyCache.clear(); }

function paintAlly(g, id) {
  const cc = countryById(id);
  const tint = cc ? cc.color : '#6b7280';
  const uni = mix('#56604a', tint, 0.25);
  const uniD = mix('#363d2e', tint, 0.2);
  const vest = mix('#454c39', tint, 0.12);
  const vestD = mix('#2b3024', tint, 0.1);
  const helm = mix('#646a4d', tint, 0.1);
  const OUT = 'rgba(6,8,12,.6)';
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(0, -18, 34, 46, 0, 0, TAU); g.fill();
  // back and shoulders
  let gr = g.createLinearGradient(-26, 0, 26, 0);
  gr.addColorStop(0, uniD);
  gr.addColorStop(0.5, uni);
  gr.addColorStop(1, uniD);
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(-25, 20); g.lineTo(-28, -36); g.quadraticCurveTo(-28, -56, -10, -58); g.lineTo(10, -58); g.quadraticCurveTo(28, -56, 28, -36); g.lineTo(25, 20); g.closePath();
  g.fill();
  g.strokeStyle = OUT; g.lineWidth = 1.4; g.stroke();
  // plate carrier back panel + hydration pack
  gr = g.createLinearGradient(0, -52, 0, 12);
  gr.addColorStop(0, vest);
  gr.addColorStop(1, vestD);
  g.fillStyle = gr;
  rr(g, -18, -52, 36, 62, 5); g.fill(); g.strokeStyle = OUT; g.stroke();
  g.fillStyle = mix('#000000', vest, 0.7);
  rr(g, -11, -46, 22, 30, 5); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 0.8;
  for (const y of [-10, -5, 0, 5]) { g.beginPath(); g.moveTo(-16, y); g.lineTo(16, y); g.stroke(); }
  // flag patch
  const f = flagImage(id);
  g.save();
  g.translate(-27, -50); g.rotate(0.12);
  g.fillStyle = '#e5e7eb'; g.fillRect(-0.7, -0.7, 13.4, 9.4);
  if (f.ready) g.drawImage(f.img, 0, 0, 12, 8); else { g.fillStyle = tint; g.fillRect(0, 0, 12, 8); }
  g.restore();
  // arms reaching up to the rifle
  g.strokeStyle = uniD; g.lineWidth = 11;
  g.beginPath(); g.moveTo(-20, -50); g.quadraticCurveTo(-4, -86, 24, -86); g.stroke();
  g.strokeStyle = uni; g.lineWidth = 10;
  g.beginPath(); g.moveTo(21, -52); g.quadraticCurveTo(36, -60, 34, -68); g.stroke();
  // rifle (stock at the shoulder, muzzle into the scene)
  g.save();
  g.translate(30, -64);
  g.rotate(-0.8);
  g.fillStyle = '#16181c'; rr(g, -8, -4, 14, 9, 2); g.fill();
  g.fillStyle = '#1d2025'; rr(g, 4, -4.5, 20, 9, 2); g.fill();
  g.fillStyle = '#131518'; g.beginPath(); g.moveTo(12, 4.5); g.lineTo(18, 4.5); g.lineTo(17, 15); g.lineTo(11, 14); g.closePath(); g.fill();
  g.fillStyle = '#2a2e35'; rr(g, 22, -3.5, 18, 7, 2); g.fill();
  g.fillStyle = '#0e0f12'; g.fillRect(39, -1.6, 9, 3.2);
  g.fillStyle = '#121418'; rr(g, 8, -10, 11, 6, 1.5); g.fill();
  g.restore();
  // gloves
  g.fillStyle = '#1b1d21';
  g.beginPath(); g.arc(25, -86, 4.4, 0, TAU); g.fill();
  g.beginPath(); g.arc(34, -69, 4.2, 0, TAU); g.fill();
  // neck, ear protection, helmet from behind
  g.fillStyle = '#23262c'; g.fillRect(-7, -64, 14, 9);
  g.fillStyle = '#15171b';
  g.beginPath(); g.arc(-15, -66, 5, 0, TAU); g.fill();
  g.beginPath(); g.arc(15, -66, 5, 0, TAU); g.fill();
  gr = g.createRadialGradient(-6, -84, 2, 0, -74, 19);
  gr.addColorStop(0, mix('#ffffff', helm, 0.72));
  gr.addColorStop(0.5, helm);
  gr.addColorStop(1, mix('#000000', helm, 0.6));
  g.fillStyle = gr;
  g.beginPath(); g.ellipse(0, -75, 17, 15.5, 0, 0, TAU); g.fill();
  g.strokeStyle = OUT; g.lineWidth = 1.3; g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-16, -72); g.quadraticCurveTo(0, -66, 16, -72); g.stroke();
  g.fillStyle = '#16181c'; rr(g, -6, -78, 12, 8, 2); g.fill(); // battery pack
  g.fillStyle = 'rgba(80,255,120,.8)'; g.fillRect(-1, -76, 2, 2); // IR strobe
}
