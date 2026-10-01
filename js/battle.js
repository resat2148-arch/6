// Real-time battle round: tap enemy soldiers popping up from the trenches.
// Every shot costs energy (and a weapon if equipped); damage follows the damage formula in game.js.
import { countryById, CONFIG, FOOD_ENERGY } from './data.js';
import * as G from './game.js';
import { sfx } from './sfx.js';
import { flagSvg } from './flags.js';
import { fmt, randRange, clamp, esc } from './util.js';
import {
  buildBackground, buildCover, buildVignette, soldierSprite, clearSprites, setFlagListener, flagImage, sprites, drawCarbine, SOLDIER_MUZZLE,
  allySprite, clearAllySprites, ALLY_MUZZLE,
} from './battle-art.js';

const $ = (id) => document.getElementById(id);

let S = null;
let hooks = {};
let canvas;
let ctx;
let W = 0;
let H = 0;
let dpr = 1;
let unit = 1;
let scene = null;
let hudTop = 0;

export const isOpen = () => !!S;

export function initBattle() {
  canvas = $('bcv');
  ctx = canvas.getContext('2d');
  setFlagListener(() => { clearSprites(); clearAllySprites(); }); // soldiers wear a flag patch once its image has loaded
  window.addEventListener('resize', () => { if (S) { resize(); buildBg(); } });
  canvas.addEventListener('pointerdown', onPointer);
  canvas.addEventListener('pointermove', (e) => { if (S) S.aim = toLocal(e); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  $('battle').addEventListener('click', onHudClick);
  document.addEventListener('visibilitychange', () => { if (S) S.paused = document.hidden || S.adPause; });
}

export function setAdPause(p) {
  if (!S) return;
  S.adPause = p;
  S.paused = p || document.hidden;
}

export function openBattle(state, campId, h) {
  const setup = G.roundSetup(state, campId);
  if (!setup) return false;
  hooks = h || {};
  $('battle').hidden = false;
  S = {
    state, setup, t: 0, phase: 'intro', introT: 0,
    enemies: [], parts: [], floats: [], tracers: [],
    dmg: 0, kills: 0, headshots: 0, combo: 0, lastHit: -9, spawnT: 0.2,
    q: G.bestWeapon(state), armed: false, shake: 0, hurt: 0, muzzle: 0,
    aim: null, paused: document.hidden, adPause: false, last: performance.now(), hudT: 0, raf: 0,
    msgT: 0, wallShown: null, visitDone: false,
    recoil: 0, flash: 0, marks: [], rockets: [], inTracers: [], smoke: [], smokeT: 0, skyT: 1.5, sky: [],
    allies: [], fSnap: { ...(G.campaignById(state, campId)?.fighters || {}) }, allyT: 0,
    board: boardPref(),
  };
  flagImage(setup.me);
  flagImage(setup.foe);
  setupHud(); // fills the bottom panel first: the carbine sits above it
  renderBoard();
  resize();
  buildBg();
  $('b-result').hidden = true;
  S.raf = requestAnimationFrame(loop);
  return true;
}

export function closeBattle() {
  if (!S) return;
  cancelAnimationFrame(S.raf);
  S = null;
  $('battle').hidden = true;
  $('b-board').hidden = true;
}

// ------------------------------------------------------------ layout
function resize() {
  const r = $('battle').getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(320, r.width);
  H = Math.max(240, r.height);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  unit = clamp(Math.min(H / 560, W / 480), 0.7, 1.7);
  // keep the carbine above the bottom panel (two rows tall on phones)
  const panel = document.querySelector('.b-bottom');
  hudTop = panel ? panel.getBoundingClientRect().top - r.top : H;
}

const rows = () => [
  { y: H * 0.45, s: unit * 0.74 },
  { y: H * 0.68, s: unit * 1.1 },
];

// Static layers are drawn once per size; smoke, embers and flashes animate on top.
function buildBg() {
  clearSprites();
  scene = {
    bg: buildBackground(W, H, dpr, unit),
    covers: rows().map((r) => buildCover(W, r.y, r.s, dpr)),
    vignette: buildVignette(W, H, dpr),
    smokeSrc: [
      { x: W * randRange(0.1, 0.24), y: H * 0.41, k: 1 },
      { x: W * randRange(0.52, 0.66), y: H * 0.42, k: 0.8 },
      { x: W * 0.86, y: H * 0.535, k: 1.2 },
    ],
    embers: Array.from({ length: W > 700 ? 30 : 18 }, () => ember(true)),
  };
  layoutAllies();
}

// ------------------------------------------------------------ damage ranking
// Open by default on wide screens; on phones it starts folded behind the 📊 chip.
function boardPref() {
  try { const v = localStorage.getItem('rr-board'); if (v !== null) return v === '1'; } catch { /* ignore */ }
  return window.innerWidth > 760;
}

const BOARD_ROWS = 5;
function boardSide(rows, cid, total, cls) {
  const shown = rows.slice(0, BOARD_ROWS);
  const youAt = rows.findIndex((r) => r.you);
  const line = (r, i) => `<div class="row ${r.you ? 'you' : ''}"><i>${i + 1}</i><span>${r.you ? '⭐ ' : ''}${esc(r.name)} <small>Lv ${r.lvl}</small></span><b>${fmt(r.dmg)}</b></div>`;
  return `<section class="${cls}">
    <header>${flagSvg(cid)} ${esc(countryById(cid).name)} <small>· ${rows.length}</small><b>${fmt(total)}</b></header>
    ${shown.length ? shown.map(line).join('') : '<div class="empty">No hits yet</div>'}
    ${youAt >= BOARD_ROWS ? `<div class="row gap">…</div>${line(rows[youAt], youAt)}` : ''}
  </section>`;
}

function renderBoard() {
  const el = $('b-board');
  document.querySelector('.b-boardbtn')?.classList.toggle('on', !!S?.board);
  if (!S || !S.board) { el.hidden = true; return; }
  const c = G.campaignById(S.state, S.setup.campId);
  if (!c) return; // keep the last ranking on screen when the battle ends
  const bd = G.battleBoard(S.state, c);
  const mine = S.setup.side === 'def' ? 'def' : 'att';
  const foe = mine === 'att' ? 'def' : 'att';
  el.innerHTML = boardSide(bd[mine], S.setup.me, bd.wall[mine], 'ally') + boardSide(bd[foe], S.setup.foe, bd.wall[foe], 'foe');
  el.hidden = false;
}

// ------------------------------------------------------------ allied citizens beside you
// Citizens of your country who fight in this battle crouch behind the near cover at the screen edges,
// shoot at the enemy line and show their real damage when it reaches the wall.
function layoutAllies() {
  const sF = clamp(1.15 * unit, 0.85, 1.7);
  const base = Math.min(H * 0.97, hudTop - 2);
  const xs = W > 760 ? [[0.08, false], [0.27, false], [0.93, true]] : [[0.07, false], [0.93, true]];
  const old = S.allies || [];
  S.allies = xs.map(([fx, mirror], i) => ({
    ...(old[i] || { id: null, fireT: randRange(0.3, 1.2), flash: 0, recoil: 0, rage: 0, lastBurst: -9 }),
    x: W * fx, base, s: sF, mirror,
  }));
  scene.front = buildCover(W, base, sF * 0.8, dpr);
  refreshAllies(true);
}

const myFighters = () => {
  const c = G.campaignById(S.state, S.setup.campId);
  const cit = S.state.citizens || [];
  return Object.entries(c?.fighters || {}).filter(([id]) => id !== 'P' && cit[Number(id)]?.c === S.setup.me);
};

function refreshAllies(fill) {
  const cit = S.state.citizens || [];
  const shown = new Set(S.allies.map((a) => a.id));
  const ranked = myFighters().sort((a, b) => b[1] - a[1]).map(([id]) => Number(id)).filter((id) => !shown.has(id));
  const fought = new Set(myFighters().map(([id]) => Number(id)));
  for (const a of S.allies) {
    // keep whoever already fights here; someone only waiting in position makes room for a real fighter
    if (a.id !== null && cit[a.id]?.c === S.setup.me && (fought.has(a.id) || !ranked.length)) continue;
    let id = ranked.shift();
    if (id === undefined && fill) {
      // nobody has fought yet: soldiers of your country are already in position
      const pool = cit.filter((b) => b.c === S.setup.me && !shown.has(b.id));
      id = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : undefined;
    }
    a.id = id ?? null;
    if (a.id !== null) shown.add(a.id);
  }
}

// Real damage from the world simulation lands on the wall in bursts: show who dealt it.
function allyBursts() {
  const now = S.t;
  for (const [key, dmg] of myFighters()) {
    const delta = dmg - (S.fSnap[key] || 0);
    S.fSnap[key] = dmg;
    if (delta <= 0) continue;
    const id = Number(key);
    let a = S.allies.find((x) => x.id === id);
    if (!a) {
      a = S.allies.filter((x) => now - x.lastBurst > 2.5).sort((x, y) => x.lastBurst - y.lastBurst)[0];
      if (!a) continue;
      a.id = id;
    }
    a.lastBurst = now;
    a.rage = 3;
    a.fireT = Math.min(a.fireT, 0.1);
    const top = a.base - 118 * a.s;
    S.floats.push({ x: a.x, y: top - 14 * unit, text: `+${fmt(delta)}`, color: '#86efac', size: 20 * Math.max(0.8, unit), life: 1.6, max: 1.6, vy: 30 });
  }
}

function allyMuzzle(a) {
  return { x: a.x + (a.mirror ? -1 : 1) * ALLY_MUZZLE.x * a.s, y: a.base + ALLY_MUZZLE.y * a.s };
}

function allyShoot(a) {
  const targets = S.enemies.filter((e) => !e.dead && e.rise >= 1);
  if (!targets.length) return;
  const e = targets[Math.floor(Math.random() * targets.length)];
  const g = enemyGeom(e);
  const head = Math.random() < 0.3;
  const tx = head ? g.hx : g.bx + g.bw / 2 + randRange(-6, 6) * e.s;
  const ty = head ? g.hy : g.by + randRange(10, 30) * e.s;
  const m = allyMuzzle(a);
  S.tracers.push({ x1: m.x, y1: m.y, x2: tx, y2: ty, life: 0.06, ally: true });
  a.flash = 0.06;
  a.recoil = 1;
  sparks(tx, ty, head ? 6 : 4, 300);
  e.hitT = 0.08;
  e.kick = 0.6;
  e.hp -= e.maxHp * (head ? 0.45 : 0.22);
  if (e.hp <= 0) {
    e.dead = true;
    e.deadT = 0;
    puff(e.x, e.y - 20 * e.s, 'dust', 12, 0.8, 0.6);
  }
}

function updateAllies(dt) {
  S.allyT -= dt;
  if (S.allyT <= 0) { S.allyT = 0.5; allyBursts(); refreshAllies(false); renderBoard(); }
  for (const a of S.allies) {
    a.flash = Math.max(0, a.flash - dt);
    a.recoil = Math.max(0, a.recoil - dt * 8);
    a.rage = Math.max(0, a.rage - dt);
    if (a.id === null || S.phase !== 'fight') continue;
    a.fireT -= dt;
    if (a.fireT <= 0) {
      allyShoot(a);
      a.fireT = randRange(0.9, 2.2) * (a.rage > 0 ? 0.4 : 1);
    }
  }
}

function ember(anywhere) {
  return {
    x: Math.random() * W, y: anywhere ? Math.random() * H : H + 10,
    vx: randRange(8, 30), vy: -randRange(15, 45), life: randRange(3, 7), size: randRange(1, 2.6), tw: Math.random() * 6,
  };
}

function toLocal(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// ------------------------------------------------------------ HUD
function setupHud() {
  const { setup } = S;
  $('b-flag-me').innerHTML = flagSvg(setup.me, 'flag big');
  $('b-flag-foe').innerHTML = flagSvg(setup.foe, 'flag big');
  $('b-name-me').textContent = countryById(setup.me).name;
  $('b-name-foe').textContent = countryById(setup.foe).name;
  $('b-fill').style.background = countryById(setup.me).color;
  $('b-bar').style.background = countryById(setup.foe).color;
  $('b-title').textContent = setup.title;
  $('b-round').textContent = 'Single round';
  $('b-score').textContent = setup.boost > 1 ? `Rookie boost ×${setup.boost.toFixed(1)}` : `D${setup.division}`;
  const weps = $('b-weps');
  weps.innerHTML = [0, 1, 2, 3, 4, 5].map((q) =>
    `<button class="b-wep" data-bact="wep" data-q="${q}" title="${q ? 'Weapon Q' + q : 'Bare hands (50% damage)'}"><span>${q ? 'Q' + q : '✊'}</span><small id="b-wq${q}"></small></button>`,
  ).join('');
  updateHud();
}

function updateHud() {
  const st = S.state;
  const p = st.player;
  const mx = G.maxEnergy(st);
  const pct = S.wallShown ?? wallPct();
  $('b-fill').style.width = pct.toFixed(1) + '%';
  $('b-wallpct').textContent = pct.toFixed(1) + '%';
  $('b-timer').textContent = fmtSec(timeLeft());
  $('b-timebox').classList.toggle('low', timeLeft() < 30 && S.phase !== 'done');
  $('b-dmg').textContent = fmt(S.dmg);
  $('b-kills').textContent = S.kills;
  $('b-allies').textContent = fmt(myFighters().length);
  $('b-combo').textContent = S.combo > 1 ? `x${S.combo}` : '-';
  $('b-energy-fill').style.width = clamp((p.energy / mx) * 100, 0, 100) + '%';
  $('b-energy-txt').textContent = `${Math.floor(p.energy)} / ${mx}`;
  $('b-reserve').textContent = `🍞 reserve ${Math.floor(p.reserve)}`;
  const food = st.inv.food.reduce((a, b) => a + b, 0);
  $('b-eat-n').textContent = food;
  for (let q = 0; q <= 5; q++) {
    const el = $('b-wq' + q);
    if (el) el.textContent = q ? fmt(st.inv.weapon[q]) : '∞';
    el?.parentElement.classList.toggle('on', q === S.q);
    el?.parentElement.classList.toggle('empty', q > 0 && st.inv.weapon[q] <= 0);
  }
  $('b-baz-n').textContent = st.inv.bazooka;
  $('b-baz').classList.toggle('armed', S.armed);
  $('b-noen').hidden = !(S.phase === 'fight' && p.energy < CONFIG.shotEnergy);
  $('b-foodprice').textContent = G.quote(st, 'food1', 20).cost.toFixed(2);
  $('b-dmgper').textContent = fmt(G.hitDamage(st, effectiveQ()));
}

const fmtSec = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function effectiveQ() {
  let q = S.q;
  while (q > 0 && S.state.inv.weapon[q] <= 0) q--;
  return q;
}

function onHudClick(e) {
  const b = e.target.closest('[data-bact]');
  if (!b || !S) return;
  const act = b.dataset.bact;
  const st = S.state;
  if (act === 'wep') { S.q = +b.dataset.q; sfx.click(); }
  else if (act === 'eat') {
    const r = G.eat(st);
    if (r.ok) { sfx.eat(); floatText(W / 2, H * 0.8, `+${Math.round(r.gained)} ⚡`, '#86efac', 26); }
    else { sfx.error(); flashMsg(r.msg); }
  } else if (act === 'baz') {
    if (st.inv.bazooka <= 0) { sfx.error(); flashMsg('No bazookas. Get them in the Market (gold) or watch an ad.'); hooks.onNeedBazooka?.(); }
    else { S.armed = !S.armed; sfx.click(); }
  } else if (act === 'board') {
    S.board = !S.board;
    try { localStorage.setItem('rr-board', S.board ? '1' : '0'); } catch { /* ignore */ }
    sfx.click();
    renderBoard();
  } else if (act === 'leave') {
    if (S.phase === 'intro') { closeBattle(); hooks.onExit?.(null); }
    else if (S.phase === 'fight') leaveBattle();
  } else if (act === 'buyfood') {
    const r = G.buy(st, 'food1', 20);
    if (r.ok) { sfx.coin(); G.eat(st); floatText(W / 2, H * 0.8, '+20 🍞', '#86efac', 24); }
    else { sfx.error(); flashMsg(r.msg); }
  } else if (act === 'adfill') {
    hooks.onAdRefill?.();
  } else if (act === 'next') {
    const id = b.dataset.id ? Number(b.dataset.id) : S.setup.campId;
    closeBattle();
    hooks.onExit?.(id);
  } else if (act === 'exit') {
    closeBattle();
    hooks.onExit?.(null);
  }
  if (S) updateHud();
}

function flashMsg(text) {
  const el = $('b-msg');
  el.textContent = text;
  el.hidden = false;
  S.msgT = 2.2;
}

// ------------------------------------------------------------ simulation
// Reads the shared wall of the running battle (the last known one once it has ended).
function sides() {
  const { setup } = S;
  const c = G.campaignById(S.state, setup.campId);
  if (!c) return S.lastSides || { me: 1, foe: 1 };
  const w = G.battleWall(c);
  S.lastSides = setup.side === 'att' ? { me: w.att, foe: w.def } : { me: w.def, foe: w.att };
  return S.lastSides;
}

function wallPct() {
  const { me, foe } = sides();
  return (me / Math.max(1, me + foe)) * 100;
}

function timeLeft() {
  return Math.max(0, (S.setup.endsAt - Date.now()) / 1000);
}

function spawn() {
  const rs = rows();
  const ri = Math.random() < 0.45 ? 0 : 1;
  const row = rs[ri];
  const margin = 50 * row.s;
  let x = 0;
  for (let tries = 0; tries < 12; tries++) {
    x = randRange(W * 0.08 + margin, W * 0.92 - margin);
    if (!S.enemies.some((e) => !e.dead && e.row === ri && Math.abs(e.x - x) < 70 * row.s)) break;
  }
  const hp = S.setup.enemyHp;
  const speedUp = 1 - Math.min(0.3, S.t / 200);
  S.enemies.push({
    x, row: ri, y: row.y, s: row.s, hp, maxHp: hp, rise: 0, dead: false, deadT: 0, hitT: 0, laser: randRange(0.3, 0.7), kick: 0,
    fireAt: S.t + randRange(2.6, 4.0) * speedUp, bob: Math.random() * 6,
  });
  S.enemies.sort((a, b) => a.row - b.row);
}

function enemyFire(e) {
  G.takeHit(S.state);
  e.fireAt = S.t + randRange(2.4, 3.6);
  e.flash = 0.12;
  const mz = enemyMuzzle(e);
  for (let i = 0; i < 3; i++) S.inTracers.push({ x1: mz.x, y1: mz.y, x2: W * e.laser + randRange(-60, 60), y2: H + 20, life: 0.08 + i * 0.03 });
  S.hurt = 0.45;
  S.shake = 0.35;
  S.combo = 0;
  sfx.hurt();
  floatText(W / 2, H * 0.86, `-${CONFIG.enemyShotEnergy} ⚡`, '#fca5a5', 24);
}

function update(dt) {
  if (S.msgT > 0) { S.msgT -= dt; if (S.msgT <= 0) $('b-msg').hidden = true; }
  // The wall glides toward its real value (citizen damage lands in bursts every world tick).
  const target = wallPct();
  S.wallShown = S.wallShown === null ? target : S.wallShown + (target - S.wallShown) * Math.min(1, dt * 2.5);
  // Real battles run on the world clock: when it is over, the rules engine removes it.
  if (S.phase !== 'done' && !G.campaignById(S.state, S.setup.campId)) { battleOver(); return; }
  if (S.phase === 'intro') {
    S.introT += dt;
    if (S.introT >= 2) S.phase = 'fight';
    effects(dt);
    return;
  }
  if (S.phase !== 'fight') { effects(dt); return; }
  S.t += dt;
  const alive = S.enemies.filter((e) => !e.dead).length;
  const maxAlive = W > 760 ? 5 : W > 480 ? 4 : 3;
  S.spawnT -= dt;
  if (alive < maxAlive && (S.spawnT <= 0 || (alive < 2 && S.spawnT < 0.7))) {
    spawn();
    S.spawnT = randRange(0.6, 1.1);
  }
  for (const e of S.enemies) {
    if (e.dead) { e.deadT += dt; continue; }
    e.rise = Math.min(1, e.rise + dt * 4);
    if (e.flash > 0) e.flash -= dt;
    if (e.hitT > 0) e.hitT -= dt;
    e.kick = Math.max(0, e.kick - dt * 6);
    if (S.t >= e.fireAt) enemyFire(e);
  }
  S.enemies = S.enemies.filter((e) => !e.dead || e.deadT < 0.9);
  updateAllies(dt);
  effects(dt);
}

function effects(dt) {
  S.shake = Math.max(0, S.shake - dt);
  S.hurt = Math.max(0, S.hurt - dt);
  S.muzzle = Math.max(0, S.muzzle - dt);
  S.recoil = Math.max(0, S.recoil - dt * 9);
  S.flash = Math.max(0, S.flash - dt * 3);
  for (const p of S.parts) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.g || 0) * dt;
    if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
    if (p.grow) p.r += p.grow * dt;
    if (p.vr) p.rot += p.vr * dt;
    p.life -= dt;
  }
  S.parts = S.parts.filter((p) => p.life > 0);
  if (S.parts.length > 420) S.parts.splice(0, S.parts.length - 420);
  for (const f of S.floats) { f.y -= f.vy * dt; f.life -= dt; }
  S.floats = S.floats.filter((f) => f.life > 0);
  for (const t of S.tracers) t.life -= dt;
  S.tracers = S.tracers.filter((t) => t.life > 0);
  for (const t of S.inTracers) t.life -= dt;
  S.inTracers = S.inTracers.filter((t) => t.life > 0);
  for (const m of S.marks) m.life -= dt;
  S.marks = S.marks.filter((m) => m.life > 0);
  for (const r of S.rockets) {
    r.t += dt;
    const k = Math.min(1, r.t / r.dur);
    const x = r.x0 + (r.x1 - r.x0) * k;
    const y = r.y0 + (r.y1 - r.y0) * k - Math.sin(k * Math.PI) * 30 * unit;
    S.parts.push({ kind: 'puff', spr: 'smoke', x, y, vx: randRange(-8, 8), vy: randRange(-12, -4), r: 6 * unit, grow: 30 * unit, life: 0.7, max: 0.7, alpha: 0.55 });
    r.x = x; r.y = y;
    if (k >= 1) { r.done = true; explosion(r.x1, r.y1); }
  }
  S.rockets = S.rockets.filter((r) => !r.done);
  // the city burns: smoke columns, embers, distant artillery
  S.smokeT -= dt;
  if (S.smokeT <= 0) {
    S.smokeT = 0.28;
    for (const src of scene.smokeSrc) {
      S.smoke.push({ x: src.x + randRange(-5, 5) * unit, y: src.y, vx: randRange(5, 14) * unit, vy: -randRange(14, 24) * unit * src.k, r: randRange(9, 15) * unit * src.k, grow: 10 * unit * src.k, life: 6.5, max: 6.5 });
    }
  }
  for (const p of S.smoke) { p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.grow * dt; p.life -= dt; }
  S.smoke = S.smoke.filter((p) => p.life > 0);
  for (const e of scene.embers) {
    e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt;
    if (e.life <= 0 || e.y < -10 || e.x > W + 10) Object.assign(e, ember(false), { x: Math.random() * W });
  }
  S.skyT -= dt;
  if (S.skyT <= 0) {
    S.skyT = randRange(1.8, 4.5);
    S.sky.push({ x: randRange(0.05, 0.95) * W, y: H * randRange(0.36, 0.42), r: randRange(50, 120) * unit, life: 0.45, max: 0.45 });
  }
  for (const f of S.sky) f.life -= dt;
  S.sky = S.sky.filter((f) => f.life > 0);
}

function floatText(x, y, text, color, size = 18) {
  S.floats.push({ x, y, text, color, size: size * Math.max(0.8, unit), life: 0.9, max: 0.9, vy: 60 });
}

function burst(x, y, color, n, speed = 160) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random());
    S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 380, life: 0.35 + Math.random() * 0.35, color, size: 2 + Math.random() * 3 });
  }
}

function sparks(x, y, n, speed = 420) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random());
    S.parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g: 900, drag: 2, life: randRange(0.12, 0.3), size: 1.6 });
  }
}

function puff(x, y, spr = 'dust', r = 10, life = 0.6, alpha = 0.8) {
  S.parts.push({ kind: 'puff', spr, x, y, vx: randRange(-14, 14), vy: randRange(-30, -10), r: r * unit, grow: r * 3.2 * unit, life, max: life, alpha });
}

function brass() {
  const m = muzzlePos();
  const ex = m.px + Math.cos(m.a) * m.len * 0.3;
  const ey = m.py + Math.sin(m.a) * m.len * 0.3;
  S.parts.push({ kind: 'brass', x: ex, y: ey, vx: randRange(140, 260) * unit, vy: -randRange(180, 300) * unit, g: 1300, rot: 0, vr: randRange(-20, 20), life: 0.7 });
}

// The player's carbine pivots below the screen and points at the cursor / last tap.
function muzzlePos() {
  const aim = S.aim || { x: W / 2, y: H * 0.5 };
  const px = W * 0.72;
  const py = Math.min(H + 30 * unit, hudTop + 90 * unit);
  const a = Math.atan2(aim.y - py, aim.x - px);
  const len = Math.min(H * 0.38, 260 * unit);
  const back = S.recoil * 22 * unit;
  const reach = len + 18 * unit - back;
  return { x: px + Math.cos(a) * reach, y: py + Math.sin(a) * reach, a: a - S.recoil * 0.05 * Math.sign(Math.cos(a) || 1), px, py, len, flip: Math.cos(a) < 0 ? -1 : 1 };
}

function enemyMuzzle(e) {
  const g = enemyGeom(e);
  return { x: e.x + SOLDIER_MUZZLE.x * e.s, y: g.top + SOLDIER_MUZZLE.y * e.s };
}

function hitTest(pt) {
  for (let i = S.enemies.length - 1; i >= 0; i--) {
    const e = S.enemies[i];
    if (e.dead || e.rise < 0.5) continue;
    const g = enemyGeom(e);
    const dxh = pt.x - g.hx;
    const dyh = pt.y - g.hy;
    const hr = Math.max(g.hr * 1.25, 13);
    if (dxh * dxh + dyh * dyh <= hr * hr) return { e, head: true };
    const pad = Math.max(0, 22 - g.bw / 2);
    if (pt.x >= g.bx - pad && pt.x <= g.bx + g.bw + pad && pt.y >= g.by && pt.y <= e.y + 6 * e.s) return { e, head: false };
  }
  return null;
}

function onPointer(e) {
  if (!S) return;
  e.preventDefault();
  const pt = toLocal(e);
  S.aim = pt;
  if (S.phase !== 'fight' || S.paused) return;
  const st = S.state;
  if (S.armed) { fireBazooka(pt); return; }
  const target = hitTest(pt);
  if (!target) {
    S.combo = 0;
    const m = muzzlePos();
    S.tracers.push({ x1: m.x, y1: m.y, x2: pt.x, y2: pt.y, life: 0.06 });
    S.recoil = 1;
    S.muzzle = 0.05;
    puff(pt.x, pt.y, 'dust', 6, 0.5, 0.7);
    burst(pt.x, pt.y, '#8c7b62', 5, 90);
    return;
  }
  const shot = G.shoot(st, S.q);
  if (!shot) { sfx.error(); flashMsg('Out of energy! Eat food.'); return; }
  S.combo = S.t - S.lastHit < 1.0 ? S.combo + 1 : 1;
  S.lastHit = S.t;
  const mult = 1 + Math.min(S.combo, 20) * 0.025;
  const dmg = shot.dmg * mult * (target.head ? 2 : 1);
  const en = target.e;
  const dealt = Math.min(en.hp, dmg);
  en.hp -= dmg;
  en.hitT = 0.1;
  S.dmg += dmg;
  G.battleHit(S.state, S.setup.campId, dmg);
  S.muzzle = 0.06;
  S.recoil = 1;
  en.kick = 1;
  const m = muzzlePos();
  S.tracers.push({ x1: m.x, y1: m.y, x2: pt.x, y2: pt.y, life: 0.07 });
  brass();
  sfx.shot();
  if (target.head) {
    S.headshots++;
    sfx.head();
    floatText(pt.x, pt.y - 12, `HEADSHOT ${fmt(dmg)}`, '#ffd34d', 21);
  } else {
    sfx.hit();
    floatText(pt.x, pt.y - 12, fmt(dmg), '#f8fafc', 17);
  }
  sparks(pt.x, pt.y, target.head ? 10 : 6);
  puff(pt.x, pt.y, 'dust', 5, 0.4, 0.5);
  if (S.combo >= 5 && S.combo % 5 === 0) floatText(W / 2, H * 0.3, `COMBO ×${S.combo}`, '#fb923c', 30);
  if (en.hp <= 0) kill(en);
  S.marks.push({ x: pt.x, y: pt.y, life: 0.28, max: 0.28, kind: en.hp <= 0 ? 'kill' : target.head ? 'head' : 'hit' });
  void dealt;
}

function kill(en, delay = 0) {
  en.dead = true;
  en.deadT = -delay; // a bazooka victim falls when the rocket lands
  S.kills++;
  if (!delay) {
    sfx.kill();
    puff(en.x, en.y - 20 * en.s, 'dust', 14, 0.9, 0.7);
    burst(en.x, en.y - 30 * en.s, '#6b6250', 10, 120);
  }
  if (Math.random() < 0.06) {
    const drop = Math.random() < 0.5 ? 'food1' : 'weapon1';
    const n = drop === 'food1' ? 2 : 10;
    G.invAdd(S.state, drop, n);
    floatText(en.x, en.y - 70 * en.s, drop === 'food1' ? `+${n} 🍞` : `+${n} 🔫`, '#86efac', 18);
  }
}

// The damage counts at once; the rocket flies for a moment and the blast follows.
function fireBazooka(pt) {
  const r = G.useBazooka(S.state, S.setup);
  if (!r) { S.armed = false; return; }
  const m = muzzlePos();
  const dur = 0.24;
  S.recoil = 1;
  S.shake = 0.25;
  sfx.shot();
  let total = r.wall;
  for (const e of S.enemies) {
    if (e.dead) continue;
    total += Math.min(e.hp, r.perEnemy);
    e.hp -= r.perEnemy;
    kill(e, dur);
  }
  S.dmg += total;
  G.battleHit(S.state, S.setup.campId, total);
  S.rockets.push({ x0: m.x, y0: m.y, x1: pt.x, y1: pt.y, x: m.x, y: m.y, t: 0, dur, total });
  S.armed = false;
}

function explosion(x, y) {
  sfx.boom();
  S.shake = 0.8;
  S.flash = 1;
  S.parts.push({ kind: 'fire', x, y, vx: 0, vy: 0, r: 30 * unit, grow: 260 * unit, life: 0.45, max: 0.45 });
  S.parts.push({ x, y, vx: 0, vy: 0, life: 0.4, ring: true, size: 10, color: '#fff7ed' });
  for (let i = 0; i < 10; i++) S.parts.push({ kind: 'puff', spr: 'smoke', x: x + randRange(-50, 50) * unit, y: y + randRange(-30, 20) * unit, vx: randRange(-40, 40), vy: randRange(-60, -20), r: randRange(20, 40) * unit, grow: 60 * unit, life: randRange(1.2, 2), max: 2, alpha: 0.8 });
  sparks(x, y, 40, 700);
  burst(x, y, '#2a2620', 26, 420);
  const rk = S.rockets.find((r) => r.x1 === x && r.y1 === y);
  floatText(x, y - 40 * unit, `BOOM ${fmt(rk ? rk.total : 0)}`, '#fb923c', 32);
  for (const e of S.enemies) if (e.dead && e.deadT < 0) { e.deadT = 0; puff(e.x, e.y - 20 * e.s, 'dust', 14, 0.9, 0.7); }
}

function visitResult() {
  if (S.visitDone) return null;
  S.visitDone = true;
  return G.finishVisit(S.state, S.setup, { dmg: Math.round(S.dmg), kills: S.kills, headshots: S.headshots });
}

// Leaving a real battle: your damage stays on the wall, the battle keeps running without you.
function leaveBattle() {
  S.phase = 'done';
  const res = visitResult();
  const left = timeLeft();
  showCard({
    cls: '',
    title: 'LEFT THE BATTLE',
    sub: `Your damage stays on the wall (${wallPct().toFixed(1)}% for ${countryById(S.setup.me).name}). The battle ends in ${fmtSec(left)}.`,
    res,
    buttons: `<button class="btn primary" data-bact="next">Back to the fight</button>`,
  });
  hooks.onRoundEnd?.(null, res);
}

// The 5 minutes are up while you are on the battlefield.
function battleOver() {
  S.phase = 'done';
  const res = visitResult();
  const r = (S.state.battleResults || []).find((x) => x.id === S.setup.campId);
  const won = r ? r.won : wallPct() > 50;
  won ? sfx.win() : sfx.lose();
  const reg = S.setup.regionName;
  const outcome = S.setup.side === 'att'
    ? (won ? `🏳️ ${reg} has been conquered!` : `The attack on ${reg} failed.`)
    : (won ? `🛡️ ${reg} has been defended!` : `${reg} has fallen to the enemy.`);
  const next = G.activeFronts(S.state)[0];
  const extra = r && r.fought && won ? '<p class="rewards">Victory bonus: 🪙 +2 · 💰 +' + (50 + S.state.player.level * 5) + '</p>' : '';
  const medals = [...(r?.medals || []), ...(res?.medals || [])];
  showCard({
    cls: won ? 'win' : 'lose',
    title: won ? 'VICTORY' : 'DEFEAT',
    sub: `Final wall ${(r ? r.pct : wallPct()).toFixed(1)}% for ${countryById(S.setup.me).name}`,
    res,
    extra: extra + `<p class="camp">${outcome}</p>` + (r?.top?.length ? `<p class="small muted">Top fighters: ${r.top.slice(0, 3).map(([id, d]) => `${esc(fighterName(id))} ${fmt(d)}`).join(' · ')}</p>` : ''),
    medals,
    buttons: next ? `<button class="btn primary" data-bact="next" data-id="${next.id}">Next battle</button>` : '',
  });
  hooks.onRoundEnd?.(won, res);
}

function fighterName(id) {
  if (id === 'P') return S.state.player.name;
  return S.state.citizens?.[Number(id)]?.n || 'Citizen';
}

const MEDAL_NAMES = { battleHero: 'Battle Hero', truePatriot: 'True Patriot', campaignHero: 'Campaign Hero', resistanceHero: 'Resistance Hero' };

function showCard({ cls, title, sub, res, extra = '', medals, buttons }) {
  const list = medals || res?.medals || [];
  const medalHtml = list.map((m) => `<span class="pill gold">🎖️ ${MEDAL_NAMES[m] || m}</span>`).join(' ');
  const el = $('b-result');
  el.innerHTML = `
    <div class="b-card ${cls}">
      <h2>${title}</h2>
      <p class="muted">${sub}</p>
      <div class="b-res-grid">
        <div><b>${fmt(S.dmg)}</b><span>Damage</span></div>
        <div><b>${S.kills}</b><span>Kills</span></div>
        <div><b>${S.headshots}</b><span>Headshots</span></div>
      </div>
      ${res ? `<p class="rewards">💰 +${res.money.toFixed(2)} &nbsp; ✨ +${res.xp} XP &nbsp; 🎖️ +${fmt(res.rp)} rank pts</p>` : ''}
      ${medalHtml ? `<p>${medalHtml}</p>` : ''}
      ${extra}
      <div class="row">${buttons}<button class="btn" data-bact="exit">Back to HQ</button></div>
    </div>`;
  el.hidden = false;
}

// ------------------------------------------------------------ rendering
// Hit boxes follow the soldier sprite (battle-art.js): head centre 58 units above the cover line.
function enemyGeom(e) {
  const s = e.s;
  const ease = 1 - Math.pow(1 - e.rise, 3);
  const off = (1 - ease) * 70 * s + Math.sin((S.t + e.bob) * 3) * 1.2 * s + e.kick * 3 * s;
  const top = e.y + off;
  return {
    hx: e.x, hy: top - 58 * s, hr: 11 * s,
    bx: e.x - 16 * s, by: top - 46 * s, bw: 32 * s,
    top,
  };
}

function drawEnemy(e) {
  const s = e.s;
  const g = enemyGeom(e);
  const sp = soldierSprite(S.setup.foe, s, dpr);
  const b = sp.box;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, e.y + 6 * s);
  ctx.clip();
  const falling = e.dead && e.deadT >= 0;
  if (falling) {
    ctx.globalAlpha = Math.max(0, 1 - e.deadT / 0.85);
    ctx.translate(e.x, e.y);
    ctx.rotate(-Math.min(1.3, e.deadT * 4.5) * (e.x > W / 2 ? -1 : 1));
    ctx.translate(-e.x, -e.y + e.deadT * 50 * s);
  }
  const x = e.x + b.x * s;
  const y = g.top + b.y * s;
  ctx.drawImage(sp.img, x, y, b.w * s, b.h * s);
  if (e.hitT > 0 && !falling) {
    ctx.globalAlpha = Math.min(1, e.hitT * 10);
    ctx.drawImage(sp.white, x, y, b.w * s, b.h * s);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (e.flash > 0) {
    const mz = enemyMuzzle(e);
    const r = 34 * s;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(sprites().glow, mz.x - r, mz.y - r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(255,240,190,.95)';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rr = (i % 2 ? 3 : randRange(9, 15)) * s;
      ctx.lineTo(mz.x + Math.cos(a) * rr, mz.y + Math.sin(a) * rr);
    }
    ctx.fill();
    ctx.restore();
  }
  if (e.dead || e.rise < 1) return;
  // health bar
  const w = 34 * s;
  const pct = clamp(e.hp / e.maxHp, 0, 1);
  const hy = g.hy - g.hr - 20 * s;
  ctx.fillStyle = 'rgba(5,8,14,.7)';
  roundRect(e.x - w / 2 - 1, hy - 1, w + 2, 5 * s + 2, 3);
  ctx.fill();
  ctx.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#facc15' : '#f87171';
  roundRect(e.x - w / 2, hy, Math.max(2, w * pct), 5 * s, 2);
  ctx.fill();
  // about to fire: laser sight on you and red target brackets
  const left = e.fireAt - S.t;
  if (left < 0.9) {
    const k = 1 - left / 0.9;
    const mz = enemyMuzzle(e);
    const pulse = 0.55 + 0.45 * Math.sin(S.t * 30);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,40,40,${0.25 + 0.5 * k * pulse})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(mz.x, mz.y);
    ctx.lineTo(W * e.laser, H + 20);
    ctx.stroke();
    const rdot = 16 * s;
    ctx.globalAlpha = 0.9 * pulse;
    ctx.drawImage(sprites().red, mz.x - rdot / 2, mz.y - rdot / 2, rdot, rdot);
    ctx.restore();
    const bx = e.x - 26 * s;
    const by = g.hy - 20 * s;
    const bw = 52 * s;
    const bh = 72 * s;
    const c = 9 * s;
    ctx.strokeStyle = `rgba(255,${Math.round(60 + 120 * (1 - pulse))},60,.95)`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(bx, by + c); ctx.lineTo(bx, by); ctx.lineTo(bx + c, by);
    ctx.moveTo(bx + bw - c, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + c);
    ctx.moveTo(bx, by + bh - c); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + c, by + bh);
    ctx.moveTo(bx + bw - c, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - c);
    ctx.stroke();
    // warning chevron
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(e.x, hy - 16 * s);
    ctx.lineTo(e.x + 8 * s, hy - 3 * s);
    ctx.lineTo(e.x - 8 * s, hy - 3 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${10 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('!', e.x, hy - 5 * s);
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawWorld() {
  const sp = sprites();
  ctx.drawImage(scene.bg, 0, 0, W, H);
  // distant artillery lighting the horizon
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const f of S.sky) {
    const k = f.life / f.max;
    ctx.globalAlpha = k * 0.8;
    ctx.drawImage(sp.glow, f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
  }
  // fires at the foot of the smoke columns
  for (const src of scene.smokeSrc) {
    const r = (26 + Math.sin(S.t * 9 + src.x) * 4) * unit * src.k;
    ctx.globalAlpha = 0.7;
    ctx.drawImage(sp.fire, src.x - r, src.y - r * 0.8, r * 2, r * 1.6);
  }
  ctx.restore();
  for (const p of S.smoke) {
    const k = p.life / p.max;
    ctx.globalAlpha = Math.min(1, (1 - k) * 4) * k * 0.9;
    ctx.drawImage(sp.smoke, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  }
  ctx.globalAlpha = 1;
}

function drawParticles() {
  const sp = sprites();
  for (const p of S.parts) {
    if (p.kind === 'puff') {
      const k = p.life / p.max;
      ctx.globalAlpha = p.alpha * k;
      ctx.drawImage(sp[p.spr], p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    } else if (p.kind === 'brass') {
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = '#d4a63a';
      ctx.fillRect(-4 * unit, -1.6 * unit, 8 * unit, 3.2 * unit);
      ctx.fillStyle = '#f5d27a';
      ctx.fillRect(-4 * unit, -1.6 * unit, 8 * unit, 1 * unit);
      ctx.restore();
    } else if (p.ring) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(255,237,213,${p.life / 0.4})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (0.4 - p.life) * 520 * unit, 0, Math.PI * 2);
      ctx.stroke();
    } else if (!p.kind) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, p.life * 3);
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
  // light: sparks and fireballs
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of S.parts) {
    if (p.kind === 'spark') {
      ctx.strokeStyle = `rgba(255,${200 + Math.round(Math.random() * 50)},120,${Math.min(1, p.life * 6)})`;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
      ctx.stroke();
    } else if (p.kind === 'fire') {
      const k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.drawImage(sp.fire, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      ctx.globalAlpha = 1;
    }
  }
  for (const e of scene.embers) {
    const a = 0.45 + 0.45 * Math.sin(S.t * 6 + e.tw);
    ctx.fillStyle = `rgba(255,${150 + Math.round(a * 60)},70,${a})`;
    ctx.fillRect(e.x, e.y, e.size * unit, e.size * unit);
  }
  ctx.restore();
}

function drawTracers() {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  for (const t of S.tracers) {
    const k = t.life / 0.07;
    ctx.strokeStyle = t.ally ? `rgba(180,255,170,${0.3 * k})` : `rgba(255,190,90,${0.35 * k})`;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,245,210,${0.95 * k})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
  for (const t of S.inTracers) {
    ctx.strokeStyle = `rgba(255,120,80,${Math.min(1, t.life * 10)})`;
    ctx.lineWidth = 2.5;
    const mx = t.x1 + (t.x2 - t.x1) * 0.55;
    const my = t.y1 + (t.y2 - t.y1) * 0.55;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
  for (const r of S.rockets) {
    const sp = sprites();
    const rad = 26 * unit;
    ctx.drawImage(sp.fire, r.x - rad, r.y - rad, rad * 2, rad * 2);
  }
  ctx.restore();
}

function drawAllies() {
  const cit = S.state.citizens || [];
  for (const a of S.allies) {
    if (a.id === null) continue;
    const b = cit[a.id];
    if (!b) continue;
    const sp = allySprite(S.setup.me, a.s, dpr);
    const bx = sp.box;
    const kick = a.recoil * 3 * a.s;
    ctx.save();
    ctx.translate(a.x, a.base + kick);
    if (a.mirror) ctx.scale(-1, 1);
    ctx.drawImage(sp.img, bx.x * a.s, bx.y * a.s, bx.w * a.s, bx.h * a.s);
    ctx.restore();
    if (a.flash > 0) {
      const m = allyMuzzle(a);
      const r = 30 * a.s;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(sprites().glow, m.x - r, m.y - r, r * 2, r * 2);
      ctx.restore();
    }
    // near cover in front of the ally
    const fr = scene.front;
    const w = 70 * a.s;
    const sx = Math.max(0, a.x - w);
    const sw = Math.min(W, a.x + w) - sx;
    if (sw > 0) ctx.drawImage(fr.img, sx * dpr, 0, sw * dpr, fr.img.height, sx, fr.top, sw, fr.h);
    // name tag
    const top = a.base - 118 * a.s;
    const label = `${b.n} · Lv ${b.lvl}`;
    ctx.font = `700 ${Math.max(10, 11 * unit)}px system-ui, sans-serif`;
    const tw = ctx.measureText(label).width;
    const fw = 14 * Math.max(0.8, unit);
    const pw = tw + fw + 16;
    const px = clamp(a.x - pw / 2, 4, W - pw - 4);
    const ph = 18 * Math.max(0.85, unit);
    ctx.fillStyle = a.rage > 0 ? 'rgba(22,101,52,.85)' : 'rgba(8,12,22,.72)';
    roundRect(px, top - ph, pw, ph, ph / 2);
    ctx.fill();
    ctx.strokeStyle = a.rage > 0 ? 'rgba(134,239,172,.8)' : 'rgba(255,255,255,.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const f = flagImage(S.setup.me);
    if (f.ready) ctx.drawImage(f.img, px + 6, top - ph / 2 - fw * 0.33, fw, fw * 0.66);
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'left';
    ctx.fillText(label, px + fw + 10, top - ph * 0.3);
  }
}

function drawFloats() {
  ctx.textAlign = 'center';
  for (const f of S.floats) {
    const k = f.life / f.max;
    const pop = k > 0.85 ? 1 + (k - 0.85) * 2.5 : 1;
    ctx.globalAlpha = Math.min(1, f.life * 2.5);
    ctx.font = `italic 900 ${f.size * pop}px system-ui, sans-serif`;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawReticle() {
  if (S.aim && S.phase === 'fight') {
    const { x, y } = S.aim;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.8)';
    ctx.shadowBlur = 3;
    if (S.armed) {
      const r = 30 * unit;
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fb923c';
      ctx.font = `800 ${11 * unit}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('ROCKET', x, y + r * 1.6 + 14 * unit);
    } else {
      const gap = (7 + S.recoil * 10) * unit;
      const len = 9 * unit;
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - gap - len, y); ctx.lineTo(x - gap, y);
      ctx.moveTo(x + gap, y); ctx.lineTo(x + gap + len, y);
      ctx.moveTo(x, y - gap - len); ctx.lineTo(x, y - gap);
      ctx.moveTo(x, y + gap); ctx.lineTo(x, y + gap + len);
      ctx.stroke();
      ctx.fillStyle = '#ff3b3b';
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // hit markers
  for (const m of S.marks) {
    const k = m.life / m.max;
    const big = m.kind === 'kill' ? 1.5 : m.kind === 'head' ? 1.25 : 1;
    const a = 6 * unit * big;
    const b = 13 * unit * big;
    ctx.strokeStyle = m.kind === 'kill' ? `rgba(255,70,70,${k})` : m.kind === 'head' ? `rgba(255,215,80,${k})` : `rgba(255,255,255,${k})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.moveTo(m.x + dx * a, m.y + dy * a);
      ctx.lineTo(m.x + dx * b, m.y + dy * b);
    }
    ctx.stroke();
  }
}

function drawIntro() {
  const t = S.introT;
  ctx.fillStyle = 'rgba(3,6,12,.45)';
  ctx.fillRect(0, 0, W, H);
  const cy = H * 0.42;
  const bandH = 120 * unit;
  const gr = ctx.createLinearGradient(0, cy - bandH / 2, 0, cy + bandH / 2);
  gr.addColorStop(0, 'rgba(8,12,22,0)');
  gr.addColorStop(0.2, 'rgba(8,12,22,.85)');
  gr.addColorStop(0.8, 'rgba(8,12,22,.85)');
  gr.addColorStop(1, 'rgba(8,12,22,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, cy - bandH / 2, W, bandH);
  const slide = Math.min(1, t / 0.35);
  const ease = 1 - Math.pow(1 - slide, 3);
  const fw = 66 * unit;
  const fh = 44 * unit;
  const me = flagImage(S.setup.me);
  const foe = flagImage(S.setup.foe);
  const lx = -fw + (W * 0.16 + fw) * ease;
  const rx = W + fw - (W * 0.16 + fw * 2) * ease;
  for (const [f, x] of [[me, lx], [foe, rx]]) {
    if (!f.ready) continue;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = 12;
    ctx.drawImage(f.img, x, cy - fh / 2, fw, fh);
    ctx.restore();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(226,232,240,.8)';
  ctx.font = `800 ${13 * unit}px system-ui, sans-serif`;
  ctx.fillText(S.setup.title.toUpperCase(), W / 2, cy - 30 * unit);
  const fight = t >= 1.2;
  const pop = fight ? 1 + Math.max(0, 0.25 - (t - 1.2)) * 2 : 1;
  ctx.font = `italic 900 ${46 * unit * pop}px system-ui, sans-serif`;
  ctx.fillStyle = fight ? '#ffd34d' : '#fff';
  ctx.shadowColor = 'rgba(0,0,0,.7)';
  ctx.shadowBlur = 10;
  ctx.fillText(fight ? 'FIGHT!' : `${fmtSec(timeLeft())} LEFT`, W / 2, cy + 18 * unit);
  ctx.shadowBlur = 0;
  ctx.font = `600 ${Math.max(11, 12.5 * unit)}px system-ui, sans-serif`;
  ctx.fillStyle = '#cbd5e1';
  const tip = 'Tap enemies to shoot · Aim for the head · Take them out before they fire';
  const lines = ctx.measureText(tip).width > W - 24 ? ['Tap enemies to shoot · Aim for the head', 'Take them out before they fire'] : [tip];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, cy + bandH / 2 + 14 * unit + i * 17));
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sh = S.shake > 0 ? S.shake * 14 : 0;
  const ox = (Math.random() - 0.5) * sh;
  const oy = (Math.random() - 0.5) * sh;
  ctx.save();
  ctx.translate(ox, oy);
  drawWorld();
  const rs = rows();
  for (let ri = 0; ri < rs.length; ri++) {
    for (const e of S.enemies) if (e.row === ri) drawEnemy(e);
    const cv = scene.covers[ri];
    ctx.drawImage(cv.img, 0, cv.top, W, cv.h);
    if (ri === 0) {
      // haze puts the far line further away
      ctx.fillStyle = 'rgba(150,120,100,.12)';
      ctx.fillRect(-20, 0, W + 40, cv.top + cv.h);
    }
  }
  drawTracers();
  drawParticles();
  drawAllies();
  drawFloats();
  ctx.restore();

  const m = muzzlePos();
  ctx.save();
  ctx.translate(ox * 0.5, oy * 0.5);
  drawCarbine(ctx, m, unit, S.recoil, S.muzzle > 0 ? S.muzzle / 0.06 : 0, S.armed);
  ctx.restore();
  drawReticle();

  ctx.drawImage(scene.vignette, 0, 0, W, H);
  if (S.flash > 0) {
    ctx.fillStyle = `rgba(255,236,200,${S.flash * 0.45})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (S.hurt > 0) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(220,38,38,0)');
    v.addColorStop(1, `rgba(200,20,20,${S.hurt * 1.1})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
  if (S.phase === 'intro') drawIntro();
  if (S.paused && S.phase !== 'done') {
    ctx.fillStyle = 'rgba(3,6,12,.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = `italic 900 ${34 * unit}px system-ui, sans-serif`;
    ctx.fillText('PAUSED', W / 2, H / 2);
  }
}

function loop(now) {
  if (!S) return;
  const dt = Math.min(0.05, (now - S.last) / 1000);
  S.last = now;
  if (!S.paused) update(dt);
  if (!S) return;
  draw();
  S.hudT -= dt;
  if (S.hudT <= 0) { S.hudT = 0.1; updateHud(); }
  S.raf = requestAnimationFrame(loop);
}

// Food helper for the "out of energy" prompt.
export const foodEnergyTotal = (st) => st.inv.food.reduce((a, n, q) => a + n * FOOD_ENERGY[q], 0);

// Test hook: visible enemy hitboxes in canvas coordinates.
export function debugTargets() {
  if (!S) return [];
  return S.enemies.filter((e) => !e.dead && e.rise >= 1).map((e) => {
    const g = enemyGeom(e);
    return { hx: g.hx, hy: g.hy, bx: g.bx + g.bw / 2, by: g.by + 18 * e.s };
  });
}
