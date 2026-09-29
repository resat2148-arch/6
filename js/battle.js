// Real-time battle round: tap enemy soldiers popping up from the trenches.
// Every shot costs energy (and a weapon if equipped); damage follows the eRepublik formula.
import { countryById, CONFIG, FOOD_ENERGY } from './data.js';
import * as G from './game.js';
import { sfx } from './sfx.js';
import { flagSvg } from './flags.js';
import { fmt, randRange, clamp, esc } from './util.js';

const $ = (id) => document.getElementById(id);

let S = null;
let hooks = {};
let canvas;
let ctx;
let W = 0;
let H = 0;
let dpr = 1;
let unit = 1;
let bg = null;

export const isOpen = () => !!S;

export function initBattle() {
  canvas = $('bcv');
  ctx = canvas.getContext('2d');
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
  };
  resize();
  buildBg();
  setupHud();
  $('b-result').hidden = true;
  S.raf = requestAnimationFrame(loop);
  return true;
}

export function closeBattle() {
  if (!S) return;
  cancelAnimationFrame(S.raf);
  S = null;
  $('battle').hidden = true;
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
}

const rows = () => [
  { y: H * 0.45, s: unit * 0.74 },
  { y: H * 0.68, s: unit * 1.1 },
];

function buildBg() {
  const mk = (base, amp, n) => {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push([(i / n) * W, base - Math.random() * amp]);
    return pts;
  };
  bg = {
    far: mk(H * 0.36, H * 0.14, 9),
    near: mk(H * 0.42, H * 0.08, 14),
    clouds: Array.from({ length: 5 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.22, r: 30 + Math.random() * 50, v: 4 + Math.random() * 8 })),
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
  $('b-round').textContent = setup.training ? 'Practice' : 'Single round';
  $('b-score').textContent = setup.boost > 1 ? `Rookie boost ×${setup.boost.toFixed(1)}` : `D${setup.division}`;
  $('b-leave').textContent = setup.training ? 'Retreat' : 'Leave';
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
  $('b-dmg').textContent = fmt(S.dmg);
  $('b-kills').textContent = S.kills;
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
  } else if (act === 'leave') {
    if (S.phase === 'intro') { closeBattle(); hooks.onExit?.(null); }
    else if (S.phase === 'fight') {
      if (S.setup.training) endRound(true);
      else leaveBattle();
    }
  } else if (act === 'buyfood') {
    const r = G.buy(st, 'food1', 20);
    if (r.ok) { sfx.coin(); G.eat(st); floatText(W / 2, H * 0.8, '+20 🍞', '#86efac', 24); }
    else { sfx.error(); flashMsg(r.msg); }
  } else if (act === 'adfill') {
    hooks.onAdRefill?.();
  } else if (act === 'next') {
    const id = b.dataset.id ? (b.dataset.id === 'training' ? 'training' : Number(b.dataset.id)) : S.setup.campId;
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
// Training uses a simulated wall; real battles read the shared wall of the running battle.
function sides() {
  const { setup } = S;
  if (setup.training) {
    const el = Math.min(S.t, setup.seconds);
    return { me: setup.wallBase + setup.allyDps * el + S.dmg, foe: setup.wallBase + setup.enemyDps * el };
  }
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
  if (S.setup.training) return S.phase === 'intro' ? S.setup.seconds : Math.max(0, S.setup.seconds - S.t);
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
    x, row: ri, y: row.y, s: row.s, hp, maxHp: hp, rise: 0, dead: false, deadT: 0, hitT: 0,
    fireAt: S.t + randRange(2.6, 4.0) * speedUp, bob: Math.random() * 6,
  });
  S.enemies.sort((a, b) => a.row - b.row);
}

function enemyFire(e) {
  G.takeHit(S.state);
  e.fireAt = S.t + randRange(2.4, 3.6);
  e.flash = 0.12;
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
  if (!S.setup.training && S.phase !== 'done' && !G.campaignById(S.state, S.setup.campId)) { battleOver(); return; }
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
    if (S.t >= e.fireAt) enemyFire(e);
  }
  S.enemies = S.enemies.filter((e) => !e.dead || e.deadT < 0.9);
  if (S.setup.training && S.t >= S.setup.seconds) endRound(false);
  effects(dt);
}

function effects(dt) {
  S.shake = Math.max(0, S.shake - dt);
  S.hurt = Math.max(0, S.hurt - dt);
  S.muzzle = Math.max(0, S.muzzle - dt);
  for (const p of S.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; p.life -= dt; }
  S.parts = S.parts.filter((p) => p.life > 0);
  for (const f of S.floats) { f.y -= f.vy * dt; f.life -= dt; }
  S.floats = S.floats.filter((f) => f.life > 0);
  for (const t of S.tracers) t.life -= dt;
  S.tracers = S.tracers.filter((t) => t.life > 0);
  for (const c of bg.clouds) { c.x += c.v * dt; if (c.x - c.r > W) c.x = -c.r; }
}

function floatText(x, y, text, color, size = 18) {
  S.floats.push({ x, y, text, color, size: size * Math.max(0.8, unit), life: 0.9, vy: 60 });
}

function burst(x, y, color, n, speed = 160) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random());
    S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 380, life: 0.35 + Math.random() * 0.35, color, size: 2 + Math.random() * 3 });
  }
}

function muzzlePos() {
  const aim = S.aim || { x: W / 2, y: H * 0.5 };
  const px = W * 0.7;
  const py = H + 10;
  const a = Math.atan2(aim.y - py, aim.x - px);
  const len = Math.min(H * 0.34, 230 * unit);
  return { x: px + Math.cos(a) * len, y: py + Math.sin(a) * len, a, px, py, len };
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
    S.tracers.push({ x1: m.x, y1: m.y, x2: pt.x, y2: pt.y, life: 0.05 });
    burst(pt.x, pt.y, '#a8a29e', 4, 60);
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
  if (!S.setup.training) G.battleHit(S.state, S.setup.campId, dmg);
  S.muzzle = 0.06;
  const m = muzzlePos();
  S.tracers.push({ x1: m.x, y1: m.y, x2: pt.x, y2: pt.y, life: 0.06 });
  sfx.shot();
  if (target.head) {
    S.headshots++;
    sfx.head();
    floatText(pt.x, pt.y - 10, `HEADSHOT ${fmt(dmg)}`, '#fde047', 20);
  } else {
    sfx.hit();
    floatText(pt.x, pt.y - 10, fmt(dmg), '#f8fafc', 17);
  }
  burst(pt.x, pt.y, '#fcd34d', 6);
  if (en.hp <= 0) kill(en);
  void dealt;
}

function kill(en) {
  en.dead = true;
  en.deadT = 0;
  S.kills++;
  sfx.kill();
  burst(en.x, en.y - 30 * en.s, '#d6d3d1', 12, 120);
  if (Math.random() < 0.06) {
    const drop = Math.random() < 0.5 ? 'food1' : 'weapon1';
    const n = drop === 'food1' ? 2 : 10;
    G.invAdd(S.state, drop, n);
    floatText(en.x, en.y - 70 * en.s, drop === 'food1' ? `+${n} 🍞` : `+${n} 🔫`, '#86efac', 18);
  }
}

function fireBazooka(pt) {
  const r = G.useBazooka(S.state, S.setup);
  S.armed = false;
  if (!r) return;
  sfx.boom();
  S.shake = 0.7;
  let total = r.wall;
  for (const e of S.enemies) {
    if (e.dead) continue;
    total += Math.min(e.hp, r.perEnemy);
    e.hp -= r.perEnemy;
    kill(e);
  }
  S.dmg += total;
  if (!S.setup.training) G.battleHit(S.state, S.setup.campId, total);
  for (let i = 0; i < 3; i++) burst(pt.x + randRange(-40, 40), pt.y + randRange(-20, 20), i ? '#f97316' : '#fde047', 30, 320);
  S.parts.push({ x: pt.x, y: pt.y, vx: 0, vy: 0, life: 0.4, ring: true, size: 10, color: '#fff7ed' });
  floatText(pt.x, pt.y - 30, `BOOM ${fmt(total)}`, '#fb923c', 30);
}

// Training war only: a private 60-second round.
function endRound(retreat) {
  if (S.phase === 'done') return;
  S.phase = 'done';
  let { me, foe } = sides();
  if (retreat) {
    const rem = Math.max(0, S.setup.seconds - S.t);
    me += S.setup.allyDps * rem;
    foe += S.setup.enemyDps * rem;
  }
  const won = me > foe;
  const res = G.finishVisit(S.state, S.setup, { dmg: Math.round(S.dmg), kills: S.kills, headshots: S.headshots, won });
  won ? sfx.win() : sfx.lose();
  showCard({
    cls: won ? 'win' : 'lose',
    title: won ? 'PRACTICE WON' : 'PRACTICE LOST',
    sub: `Wall ${((me / (me + foe)) * 100).toFixed(1)}% · Training wars never change the map.`,
    res,
    buttons: `<button class="btn primary" data-bact="next" data-id="training">Train again</button>`,
  });
  hooks.onRoundEnd?.(won, res);
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
function enemyGeom(e) {
  const s = e.s;
  const ease = 1 - Math.pow(1 - e.rise, 3);
  const off = (1 - ease) * 70 * s + Math.sin((S.t + e.bob) * 3) * 1.2 * s;
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
  const c = countryById(S.setup.foe);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, e.y + 6 * s);
  ctx.clip();
  if (e.dead) {
    ctx.globalAlpha = Math.max(0, 1 - e.deadT / 0.8);
    ctx.translate(e.x, e.y);
    ctx.rotate(-Math.min(1.2, e.deadT * 4) * (e.x > W / 2 ? -1 : 1));
    ctx.translate(-e.x, -e.y + e.deadT * 40 * s);
  }
  // torso
  ctx.fillStyle = e.hitT > 0 ? '#fff' : c.dark;
  roundRect(g.bx, g.by, g.bw, 52 * s, 8 * s);
  ctx.fill();
  ctx.fillStyle = c.color;
  ctx.fillRect(g.bx + 4 * s, g.by + 8 * s, g.bw - 8 * s, 5 * s);
  // rifle
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(e.x - 18 * s, g.by + 22 * s);
  ctx.lineTo(e.x + 10 * s, g.by + 8 * s);
  ctx.stroke();
  if (e.flash > 0) {
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(e.x + 12 * s, g.by + 7 * s, 9 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // head + helmet
  ctx.fillStyle = e.hitT > 0 ? '#fff' : '#e7c3a0';
  ctx.beginPath();
  ctx.arc(g.hx, g.hy, g.hr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#374151';
  ctx.beginPath();
  ctx.arc(g.hx, g.hy - 2 * s, g.hr * 1.15, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(g.hx - g.hr * 1.35, g.hy - 3 * s, g.hr * 2.7, 3 * s);
  ctx.fillStyle = '#111';
  ctx.fillRect(g.hx - 5 * s, g.hy + 1 * s, 3 * s, 3 * s);
  ctx.fillRect(g.hx + 2 * s, g.hy + 1 * s, 3 * s, 3 * s);
  ctx.restore();
  if (!e.dead && e.rise >= 1) {
    // hp bar
    const w = 36 * s;
    const pct = clamp(e.hp / e.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(e.x - w / 2, g.hy - g.hr - 14 * s, w, 5 * s);
    ctx.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#facc15' : '#f87171';
    ctx.fillRect(e.x - w / 2, g.hy - g.hr - 14 * s, w * pct, 5 * s);
    const left = e.fireAt - S.t;
    if (left < 0.8) {
      const blink = Math.floor(S.t * 10) % 2 === 0;
      ctx.strokeStyle = blink ? '#ef4444' : '#fecaca';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.arc(g.hx, g.hy, g.hr * 2 + (left / 0.8) * 10 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.font = `bold ${16 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('!', e.x, g.hy - g.hr - 18 * s);
    }
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

function sandbags(y, s) {
  const step = 34 * s;
  for (let layer = 0; layer < 2; layer++) {
    const yy = y + 8 * s + layer * 11 * s;
    const off = layer ? step / 2 : 0;
    for (let x = -step + off; x < W + step; x += step) {
      ctx.fillStyle = layer ? '#a38a5c' : '#b89d6b';
      ctx.beginPath();
      ctx.ellipse(x, yy, step * 0.55, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,45,25,.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

function poly(pts, bottom, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(W, bottom);
  ctx.closePath();
  ctx.fill();
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sh = S.shake > 0 ? S.shake * 14 : 0;
  ctx.save();
  ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.45);
  sky.addColorStop(0, '#0b1426');
  sky.addColorStop(0.6, '#3b2f4a');
  sky.addColorStop(1, '#c46b3c');
  ctx.fillStyle = sky;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  for (const c of bg.clouds) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 20, c.r * 1.8, c.r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  poly(bg.far, H * 0.5, '#2b2d45');
  poly(bg.near, H * 0.5, '#3a3a4f');
  const ground = ctx.createLinearGradient(0, H * 0.42, 0, H);
  ground.addColorStop(0, '#4a4a35');
  ground.addColorStop(1, '#2f3222');
  ctx.fillStyle = ground;
  ctx.fillRect(-20, H * 0.42, W + 40, H);

  const rs = rows();
  for (let ri = 0; ri < rs.length; ri++) {
    for (const e of S.enemies) if (e.row === ri) drawEnemy(e);
    sandbags(rs[ri].y, rs[ri].s);
  }

  // tracers
  ctx.lineCap = 'round';
  for (const t of S.tracers) {
    ctx.strokeStyle = 'rgba(253, 230, 138, .85)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }

  // player rifle
  const m = muzzlePos();
  ctx.save();
  ctx.translate(m.px, m.py);
  ctx.rotate(m.a);
  ctx.fillStyle = '#3f2a1a';
  roundRect(-20, -14 * unit, m.len * 0.55, 28 * unit, 8 * unit);
  ctx.fill();
  ctx.fillStyle = '#1f2937';
  roundRect(m.len * 0.35, -7 * unit, m.len * 0.65, 14 * unit, 4 * unit);
  ctx.fill();
  ctx.fillStyle = '#111827';
  ctx.fillRect(m.len * 0.5, -12 * unit, 18 * unit, 5 * unit);
  ctx.restore();
  if (S.muzzle > 0) {
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 16 * unit, 0, Math.PI * 2);
    ctx.fill();
  }

  // particles
  for (const p of S.parts) {
    if (p.ring) {
      ctx.strokeStyle = `rgba(255,237,213,${p.life / 0.4})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (0.4 - p.life) * 500 * unit, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.min(1, p.life * 3);
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // floating numbers
  ctx.textAlign = 'center';
  for (const f of S.floats) {
    ctx.globalAlpha = Math.min(1, f.life * 2.5);
    ctx.font = `800 ${f.size}px system-ui, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,.7)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // crosshair
  if (S.aim && S.phase === 'fight') {
    const { x, y } = S.aim;
    ctx.strokeStyle = S.armed ? '#fb923c' : 'rgba(255,255,255,.85)';
    ctx.lineWidth = 2;
    const r = (S.armed ? 26 : 14) * unit;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.moveTo(x - r - 6, y); ctx.lineTo(x - r + 6, y);
    ctx.moveTo(x + r - 6, y); ctx.lineTo(x + r + 6, y);
    ctx.moveTo(x, y - r - 6); ctx.lineTo(x, y - r + 6);
    ctx.moveTo(x, y + r - 6); ctx.lineTo(x, y + r + 6);
    ctx.stroke();
  }

  if (S.hurt > 0) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(220,38,38,0)');
    v.addColorStop(1, `rgba(220,38,38,${S.hurt})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  if (S.phase === 'intro') {
    const t = S.introT;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${48 * unit}px system-ui, sans-serif`;
    const txt = t < 1.2 ? (S.setup.training ? 'TRAINING' : `${fmtSec(timeLeft())} LEFT`) : 'FIGHT!';
    ctx.fillText(txt, W / 2, H * 0.42);
    ctx.font = `600 ${16 * unit}px system-ui, sans-serif`;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('Tap enemies to shoot • Aim for the head • Kill them before they fire', W / 2, H * 0.42 + 40 * unit);
  }
  if (S.paused && S.phase !== 'done') {
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = `800 ${32 * unit}px system-ui, sans-serif`;
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
