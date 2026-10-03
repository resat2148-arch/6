// Daily routine screens, full screen like the battle: the factory (work), the training camp (train)
// and the mess hall (eat). Tapping while the gauge marker is in the gold zone gives a perfect shift
// or session (bonus in game.js); "All" spends the remaining energy at once without the bonus.
import { CONFIG, FACILITIES, countryById } from './data.js';
import * as G from './game.js';
import { sfx } from './sfx.js';
import { flagImage } from './battle-art.js';
import {
  buildRoutineBg, conveyorY, drawPerson, drawHammer, drawBench, drawCrate, drawBarbell, drawFlag, drawTable, drawTray, drawSpoon,
} from './routine-art.js';
import { fmt, fmtMoney, clamp, esc } from './util.js';
import { ico, iconize, iconizeHtml, fillTextIcons } from './icons.js';

const $ = (id) => document.getElementById(id);
const MODES = {
  work: { name: 'Work', place: 'Factory', ic: 'factory', dur: 0.5, hit: 0.62 },
  train: { name: 'Train', place: 'Training camp', ic: 'train', dur: 0.8, hit: 0.55 },
  eat: { name: 'Eat', place: 'Mess hall', ic: 'hall', dur: 0.95, hit: 0.42 },
};
const PERFECT = 0.09; // half width of the gold zone (gauge 0..1)
const SWEEP = 0.95; // seconds for the marker to cross the gauge

let R = null;
let hooks = {};
let canvas;
let ctx;
let W = 0;
let H = 0;
let dpr = 1;
let L = { fy: 0, cx: 0, s: 1 };
let bg = null;

export const isOpen = () => !!R;

export function initRoutine() {
  canvas = $('rcv');
  ctx = canvas.getContext('2d');
  window.addEventListener('resize', () => { if (R) layout(); });
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); if (R) act(false); });
  $('routine').addEventListener('click', onClick);
  document.addEventListener('keydown', (e) => {
    if (!R || e.repeat || !(e.code === 'Space' || e.code === 'Enter')) return;
    if (document.querySelector('#modal:not([hidden])')) return;
    e.preventDefault();
    act(false);
  });
}

export function openRoutine(state, mode, h) {
  hooks = h || {};
  R = {
    state, mode, t: 0, last: performance.now(), raf: 0,
    anim: null, floats: [], parts: [], crates: [], crateT: 0, hudT: 0, blinkT: 2,
    plate: 1, session: { work: { n: 0, sum: 0, perfect: 0 }, train: { n: 0, sum: 0, perfect: 0 }, eat: { n: 0, sum: 0 } },
    streak: 0, gauge0: performance.now(),
  };
  flagImage(state.player.country);
  $('routine').hidden = false;
  setMode(mode);
  if (hooks.coach && mode !== 'eat') coachGauge();
  R.raf = requestAnimationFrame(loop);
}

export function closeRoutine() {
  if (!R) return;
  cancelAnimationFrame(R.raf);
  R = null;
  bg = null;
  $('r-leave').classList.remove('pulse');
  $('routine').hidden = true;
}

function setMode(mode) {
  R.mode = mode;
  R.anim = null;
  R.floats = [];
  R.parts = [];
  $('routine').dataset.mode = mode;
  document.querySelectorAll('#routine .r-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  $('r-gauge').hidden = mode === 'eat';
  hud(true);
  layout();
}

// ------------------------------------------------------------ layout
function layout() {
  const r = $('routine').getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(320, r.width);
  H = Math.max(260, r.height);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const top = $('routine').querySelector('.r-top').getBoundingClientRect().bottom - r.top;
  const panel = $('routine').querySelector('.r-bottom').getBoundingClientRect().top - r.top;
  const fy = clamp(panel - 14, top + 150, H - 20);
  const s = clamp(Math.min((fy - top - 20) / 215, W / 270), 0.5, 1.6);
  L = { fy, cx: W / 2, s };
  bg = buildRoutineBg(R.mode, W, H, dpr, L);
  R.crates = [];
  for (let x = -40; x < W + 40; x += rnd(90, 160) * s) R.crates.push(crate(x));
}

const rnd = (a, b) => a + Math.random() * (b - a);
const crate = (x) => ({ x, label: ['🍞', '🔫', '🧱', ''][Math.floor(Math.random() * 4)] });

// ------------------------------------------------------------ HUD
function hud(full) {
  const st = R.state;
  const p = st.player;
  const m = MODES[R.mode];
  const mx = G.maxEnergy(st);
  $('r-energy-fill').style.width = `${clamp((p.energy / mx) * 100, 0, 100)}%`;
  $('r-energy-txt').textContent = `${Math.floor(p.energy)}/${mx}`;
  $('r-reserve').textContent = `🥫 ${Math.floor(p.reserve)}`;
  const foodN = st.inv.food.reduce((a, n) => a + n, 0);
  const sess = R.session[R.mode];
  const cost = R.mode === 'work' ? CONFIG.workEnergy : CONFIG.trainEnergy;
  const left = Math.floor(p.energy / cost);
  if (!full && R.hudN === `${Math.floor(p.energy)}|${Math.floor(p.reserve)}|${foodN}|${sess.n}|${Math.round(p.money)}`) return;
  R.hudN = `${Math.floor(p.energy)}|${Math.floor(p.reserve)}|${foodN}|${sess.n}|${Math.round(p.money)}`;
  $('r-title').innerHTML = `${ico(m.ic, 'amber')} ${m.place}`;
  let sub;
  let chips;
  let main;
  if (R.mode === 'work') {
    sub = `Salary 💰${fmtMoney(G.salary(st))} per shift · gold zone +${CONFIG.perfectWorkBonus * 100}%`;
    chips = [`🛠️ Shifts <b>${sess.n}</b>`, `💰 <b>+${fmtMoney(sess.sum)}</b>`, `⭐ Perfect <b>${sess.perfect}</b>`];
    main = `<b>Work</b><small>−${cost}⚡ · +💰${fmtMoney(G.salary(st))}</small>`;
  } else if (R.mode === 'train') {
    const fac = FACILITIES.map((f) => { const q = G.facilityQ(st, f.id); return `<span class="${q ? '' : 'dim'}" title="${f.name}">${f.icon}${q ? `Q${q}` : '–'}</span>`; }).join(' ');
    sub = `+${G.trainGain(st)} 💪 per session · gold zone +${CONFIG.perfectTrainBonus * 100}% · ${fac}`;
    chips = [`🏋️ Sessions <b>${sess.n}</b>`, `💪 <b>+${fmt(Math.round(sess.sum * 10) / 10)}</b>`, `⭐ Perfect <b>${sess.perfect}</b>`, `Strength <b>${fmt(p.strength)}</b>`];
    main = `<b>Train</b><small>−${cost}⚡ · +${G.trainGain(st)} 💪</small>`;
  } else {
    sub = 'Food turns your 🥫 reserve into ⚡ energy. Better food, more energy per meal.';
    chips = [1, 2, 3, 4, 5].filter((q) => st.inv.food[q] > 0).map((q) => `🍞Q${q} <b>${fmt(st.inv.food[q])}</b>`);
    if (!chips.length) chips = ['<span class="red">No food</span>'];
    chips.push(`⚡ <b>+${fmt(Math.round(sess.sum))}</b> eaten`);
    main = `<b>Eat</b><small>${p.energy >= mx - 0.5 ? 'Energy full' : `up to +${Math.round(Math.min(mx - p.energy, p.reserve))}⚡`}</small>`;
  }
  $('r-sub').innerHTML = iconizeHtml(sub);
  $('r-chips').innerHTML = iconizeHtml(chips.map((c) => `<div class="b-chip">${c}</div>`).join(''));
  $('r-main').innerHTML = iconizeHtml(main);
  $('r-main').classList.toggle('empty', R.mode !== 'eat' && left < 1);
  $('r-all').hidden = R.mode === 'eat';
  $('r-all-n').textContent = `×${left}`;
  $('r-all').disabled = left < 1;
  $('r-eat').hidden = R.mode === 'eat';
  $('r-eat-n').textContent = fmt(foodN);
  $('r-eat').classList.toggle('pulse', R.mode !== 'eat' && left < 1 && foodN > 0);
  $('r-buy').hidden = R.mode !== 'eat';
  $('r-foodprice').textContent = G.quote(st, 'food1', 20).cost.toFixed(2);
  $('r-ad').hidden = !(left < 1 || R.mode === 'eat');
}

function onClick(e) {
  const b = e.target.closest('[data-ract]');
  if (!b || !R || b.disabled) return;
  const a = b.dataset.ract;
  const st = R.state;
  if (a === 'mode') { if (b.dataset.mode !== R.mode) { sfx.click(); setMode(b.dataset.mode); } }
  else if (a === 'do') act(false);
  else if (a === 'all') act(true);
  else if (a === 'eat') { sfx.click(); setMode('eat'); }
  else if (a === 'buy') {
    const r = G.buy(st, 'food1', 20);
    if (r.ok) { sfx.coin(); floatText(L.cx, L.fy - 120 * L.s, '+20 🍞', '#86efac', 22); hooks.onChange?.(); }
    else { sfx.error(); flashMsg(r.msg); }
  } else if (a === 'ad') hooks.onAdRefill?.();
  else if (a === 'leave') { closeRoutine(); hooks.onExit?.(); return; }
  hud(true);
}

// A new player is shown the gold zone once per visit.
function coachGauge() {
  const touch = matchMedia('(pointer: coarse)').matches;
  flashMsg(`👆 ${touch ? 'Tap' : 'Click (or press Space)'} when the marker is in the gold zone: +${(R.mode === 'work' ? CONFIG.perfectWorkBonus : CONFIG.perfectTrainBonus) * 100}%`, 4500);
}

let msgTimer = 0;
function flashMsg(text, ms = 2200) {
  const el = $('r-msg');
  el.innerHTML = iconize(esc(text));
  el.hidden = false;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// ------------------------------------------------------------ actions
// The gauge marker sweeps back and forth; 0.5 is the middle of the gold zone.
function gaugePos() {
  const t = ((performance.now() - R.gauge0) / 1000 / SWEEP) % 2;
  return t < 1 ? t : 2 - t;
}

function act(all) {
  const st = R.state;
  if (R.mode === 'eat') return eatNow();
  const fn = R.mode === 'work' ? G.work : G.train;
  if (all) {
    let n = 0;
    let sum = 0;
    for (;;) {
      const r = fn(st);
      if (!r.ok) break;
      n++;
      sum += R.mode === 'work' ? r.money : r.gain;
    }
    if (!n) return outOfEnergy();
    record(n, sum, false);
    start(sum, n, false);
    return;
  }
  const perfect = Math.abs(gaugePos() - 0.5) <= PERFECT;
  const r = fn(st, perfect);
  if (!r.ok) return outOfEnergy(r.msg);
  record(1, R.mode === 'work' ? r.money : r.gain, perfect);
  start(R.mode === 'work' ? r.money : r.gain, 1, perfect);
}

function outOfEnergy(msg) {
  sfx.error();
  flashMsg(msg || 'Not enough energy. Eat food or wait.');
  hud(true);
}

function record(n, sum, perfect) {
  const s = R.session[R.mode];
  s.n += n;
  s.sum += sum;
  if (perfect) s.perfect++;
  R.streak = perfect ? R.streak + 1 : 0;
  hooks.onChange?.();
  hud(true);
  missionCheck();
}

// A guided mission done here: point back to HQ, where the reward is claimed.
function missionCheck() {
  if (!hooks.missionReady?.()) return;
  $('r-leave').classList.add('pulse');
  setTimeout(() => { if (R) flashMsg('🎯 Mission complete! ⟵ HQ to claim your reward', 3500); }, 700);
}

function start(value, n, perfect) {
  R.anim = { t: 0, dur: MODES[R.mode].dur, hit: false, value, n, perfect };
  if (perfect) {
    sfx.perfect();
    $('r-gauge').classList.remove('hit');
    void $('r-gauge').offsetWidth;
    $('r-gauge').classList.add('hit');
  }
  if (R.mode === 'train') sfx.lift();
}

function eatNow() {
  const st = R.state;
  const r = G.eat(st);
  if (!r.ok) {
    sfx.error();
    flashMsg(r.msg);
    hud(true);
    return;
  }
  R.session.eat.n += r.eaten;
  R.session.eat.sum += r.gained;
  R.plate = 1;
  R.anim = { t: 0, dur: MODES.eat.dur * Math.min(3, r.eaten), bites: Math.min(3, r.eaten), value: r.gained, n: r.eaten, hit: false };
  hooks.onChange?.();
  hud(true);
  missionCheck();
}

// The reward appears when the hammer lands, the bar locks out or the spoon reaches the mouth.
function impact(pts) {
  const a = R.anim;
  const s = L.s;
  if (R.mode === 'work') {
    sfx.clank();
    sparks(pts.tool.x, pts.tool.y, a.perfect ? 26 : 14);
    const txt = a.n > 1 ? `${a.n} shifts · +💰${fmtMoney(a.value)}` : `+💰${fmtMoney(a.value)}`;
    floatText(side(1), pts.head.y + 20 * s, txt, '#fde68a', a.n > 1 ? 24 : 22);
    for (let i = 0; i < Math.min(12, 3 + a.n); i++) R.parts.push({ k: 'coin', x: pts.tool.x, y: pts.tool.y - 10 * s, vx: rnd(-90, 90) * s, vy: rnd(-330, -200) * s, life: rnd(0.7, 1.1), t: 0 });
  } else if (R.mode === 'train') {
    sfx.work();
    const txt = a.n > 1 ? `${a.n} sessions · +${fmt(Math.round(a.value * 10) / 10)} 💪` : `+${a.value} 💪`;
    floatText(side(1), pts.head.y, txt, '#c4b5fd', a.n > 1 ? 24 : 22);
    for (let i = 0; i < 6; i++) R.parts.push({ k: 'sweat', x: pts.head.x + rnd(-12, 12) * s, y: pts.head.y, vx: rnd(-80, 80) * s, vy: rnd(-160, -60) * s, life: 0.7, t: 0 });
    for (let i = 0; i < 8; i++) R.parts.push({ k: 'dust', x: L.cx + rnd(-50, 50) * s, y: L.fy, vx: rnd(-60, 60) * s, vy: rnd(-40, -10) * s, life: 0.8, t: 0, r: rnd(6, 14) * s });
  } else {
    sfx.bite();
    if (!a.shown) {
      a.shown = true;
      sfx.eat();
      floatText(side(1), pts.head.y - 10 * s, `+${Math.round(a.value)} ⚡`, '#86efac', 24);
    }
    for (let i = 0; i < 6; i++) R.parts.push({ k: 'orb', x: pts.head.x + rnd(-10, 10) * s, y: pts.head.y + 10 * s, vx: rnd(-40, 40) * s, vy: rnd(-220, -140) * s, life: 0.9, t: 0 });
  }
  if (a.perfect) {
    floatText(side(-1), pts.head.y + 10 * s, R.streak > 1 ? `PERFECT ×${R.streak}` : 'PERFECT!', '#facc15', 26);
  }
}

// Beside the citizen, inside the screen.
const side = (sgn) => clamp(L.cx + sgn * 120 * L.s, 80, W - 80);

function sparks(x, y, n) {
  for (let i = 0; i < n; i++) {
    const ang = rnd(Math.PI * 1.05, Math.PI * 1.95);
    const v = rnd(160, 420) * L.s;
    R.parts.push({ k: 'spark', x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: rnd(0.25, 0.55), t: 0 });
  }
}

function floatText(x, y, text, color, size) {
  R.floats.push({ x, y, text, color, size, t: 0 });
}

// ------------------------------------------------------------ poses
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpPose = (A, B, t) => {
  const o = {};
  for (const k of Object.keys(A)) o[k] = Array.isArray(A[k]) ? A[k].map((v, i) => lerp(v, B[k][i], t)) : (typeof A[k] === 'number' ? lerp(A[k], B[k], t) : B[k]);
  return o;
};
const STAND = [0.06, 0.02];
const P = {
  workRest: { la: [0.3, -1.25], ra: [0.45, -1.2], ll: STAND, rl: STAND, hm: 1.65 },
  workUp: { la: [0.3, -1.2], ra: [2.55, 3.3], ll: STAND, rl: STAND, hm: 3.5 },
  workHit: { la: [0.32, -1.3], ra: [0.45, -1.92], ll: STAND, rl: STAND, hm: 0.55 },
  rack: { la: [0.55, 2.9], ra: [0.55, 2.9], ll: STAND, rl: STAND },
  dip: { la: [0.6, 2.85], ra: [0.6, 2.85], ll: [0.38, -0.22], rl: [0.38, -0.22] },
  lock: { la: [2.72, 2.95], ra: [2.72, 2.95], ll: STAND, rl: STAND },
  sit: { la: [0.35, -1.4, 1], ra: [0.35, -1.4, 1], ll: STAND, rl: STAND, seated: true },
  spoon: { la: [0.35, -1.4, 1], ra: [0.6, -2.5, 0.55], ll: STAND, rl: STAND, seated: true },
};

function pose(dt) {
  const a = R.anim;
  const breathe = Math.sin(R.t * 2.2) * 0.03;
  let p;
  let mouth = 0;
  let strain = false;
  if (R.mode === 'work') {
    p = P.workRest;
    if (a) {
      const t = a.t / a.dur;
      p = t < 0.45 ? lerpPose(P.workRest, P.workUp, ease(t / 0.45))
        : t < MODES.work.hit ? lerpPose(P.workUp, P.workHit, ((t - 0.45) / (MODES.work.hit - 0.45)) ** 2)
          : lerpPose(P.workHit, P.workRest, ease((t - MODES.work.hit) / (1 - MODES.work.hit)));
    }
  } else if (R.mode === 'train') {
    p = P.rack;
    if (a) {
      const t = a.t / a.dur;
      strain = t > 0.2 && t < 0.75;
      p = t < 0.22 ? lerpPose(P.rack, P.dip, ease(t / 0.22))
        : t < 0.55 ? lerpPose(P.dip, P.lock, ease((t - 0.22) / 0.33))
          : t < 0.7 ? P.lock : lerpPose(P.lock, P.rack, ease((t - 0.7) / 0.3));
    }
  } else {
    p = P.sit;
    if (a) {
      const per = a.dur / a.bites;
      const t = (a.t % per) / per;
      p = t < 0.42 ? lerpPose(P.sit, P.spoon, ease(t / 0.42)) : t < 0.6 ? P.spoon : lerpPose(P.spoon, P.sit, ease((t - 0.6) / 0.4));
      if (t > 0.38 && t < 0.62) mouth = 1;
      else if (t >= 0.62) mouth = 0.4 * Math.abs(Math.sin(a.t * 18));
    }
  }
  return { ...p, la: [p.la[0] + breathe, p.la[1], p.la[2]], ra: [p.ra[0] + breathe, p.ra[1], p.ra[2]], mouth, strain, blink: R.blinkT < 0.12 };
}

function look() {
  const col = countryById(R.state.player.country)?.color || '#3b82f6';
  const base = { skin: '#e2b48f', hair: '#3b2a1e', shoes: '#1f2937' };
  if (R.mode === 'work') return { ...base, shirt: '#2f4b7c', shirt2: '#203458', sleeve: '#2f4b7c', pants: '#24395f', vest: true, hat: true };
  if (R.mode === 'train') return { ...base, shirt: col, shirt2: shade(col), pants: '#30343b', tank: true, shorts: true, shoes: '#e5e7eb' };
  return { ...base, shirt: '#4d5a3a', shirt2: '#384229', sleeve: '#4d5a3a', pants: '#3a4229', patch: col };
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v * 0.7);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ------------------------------------------------------------ frame
function update(dt) {
  R.t += dt;
  R.blinkT -= dt;
  if (R.blinkT < 0) R.blinkT = rnd(2, 4.5);
  if (R.anim) {
    const a = R.anim;
    const prev = a.t;
    a.t = R.freeze != null ? R.freeze * a.dur : a.t + dt;
    const hitAt = MODES[R.mode].hit;
    if (R.mode === 'eat') {
      const per = a.dur / a.bites;
      if (Math.floor((prev + per * (1 - hitAt)) / per) !== Math.floor((a.t + per * (1 - hitAt)) / per)) a.pendingHit = true;
      R.plate = Math.max(0.15, 1 - (a.t / a.dur) * 0.85);
    } else if (!a.hit && a.t >= a.dur * hitAt) { a.hit = true; a.pendingHit = true; }
    if (a.t >= a.dur && R.freeze == null) R.anim = null;
  } else if (R.mode === 'eat' && R.plate < 1) R.plate = Math.min(1, R.plate + dt * 0.4);
  // conveyor
  if (R.mode === 'work') for (const c of R.crates) { c.x += 34 * L.s * dt; if (c.x > W + 40) { c.x -= W + 100; c.label = crate(0).label; } }
  for (const p of R.parts) {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.k === 'orb' ? -60 : p.k === 'dust' || p.k === 'steam' ? 0 : 900) * L.s * dt;
  }
  R.parts = R.parts.filter((p) => p.t < p.life);
  for (const f of R.floats) f.t += dt;
  R.floats = R.floats.filter((f) => f.t < 1.4);
  $('r-mk').style.left = `${gaugePos() * 100}%`;
  R.hudT -= dt;
  if (R.hudT <= 0) { R.hudT = 0.25; hud(false); }
}

function draw() {
  const g = ctx;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (bg) g.drawImage(bg, 0, 0, W, H);
  const { fy, cx, s } = L;
  const pts = {};
  const p = pose();
  if (R.mode === 'work') {
    const by = conveyorY(fy, s);
    for (const c of R.crates) drawCrate(g, c.x, by - 3 * s, s * 0.9, c.label);
    const hands = drawPerson(g, cx, fy, s, p, look());
    const glowK = R.anim ? Math.max(0, 1 - Math.abs(R.anim.t / R.anim.dur - MODES.work.hit) * 4) : 0;
    const bench = drawBench(g, cx, fy, s, glowK);
    // the left hand holds the workpiece; draw the hammer over the bench
    pts.tool = drawHammer(g, hands.rh, s, p.hm);
    pts.head = hands.head;
    pts.bench = bench;
  } else if (R.mode === 'train') {
    drawFlag(g, flagImage(R.state.player.country), cx - 150 * s, fy - 20 * s, s, R.t);
    const hands = drawPerson(g, cx, fy, s, p, look());
    const q = Math.max(1, ...FACILITIES.map((f) => G.facilityQ(R.state, f.id)));
    drawBarbell(g, hands.lh, hands.rh, s, ['#1f2937', '#b91c1c', '#1d4ed8', '#15803d', '#ca8a04'].slice(0, Math.min(5, 1 + q)));
    pts.head = hands.head;
  } else {
    const hands = drawPerson(g, cx, fy, s, p, look());
    const top = drawTable(g, cx, fy, s, W);
    const best = [5, 4, 3, 2, 1].find((q) => R.state.inv.food[q] > 0) || 0;
    const plate = drawTray(g, cx, top, s, best, R.plate);
    // the hand and spoon are drawn over the table edge
    g.fillStyle = '#e2b48f';
    g.beginPath(); g.arc(hands.rh.x, hands.rh.y, 6.2 * s, 0, Math.PI * 2); g.fill();
    drawSpoon(g, hands.rh, s);
    if (Math.random() < 0.12) R.parts.push({ k: 'steam', x: plate.x + rnd(-14, 14) * s, y: plate.y, vx: rnd(-6, 6) * s, vy: rnd(-40, -25) * s, life: 1.6, t: 0, r: rnd(5, 10) * s });
    pts.head = hands.head;
  }
  if (R.anim?.pendingHit) { R.anim.pendingHit = false; impact(pts); }
  drawParticles(g);
  drawFloats(g);
}

function drawParticles(g) {
  for (const p of R.parts) {
    const k = 1 - p.t / p.life;
    if (p.k === 'spark') {
      g.strokeStyle = `rgba(255,${180 + Math.round(60 * k)},80,${k})`;
      g.lineWidth = 2 * L.s;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); g.stroke();
    } else if (p.k === 'coin') {
      g.fillStyle = `rgba(250,204,21,${k})`;
      g.beginPath(); g.ellipse(p.x, p.y, 5 * L.s * Math.abs(Math.cos(p.t * 12)) + 1, 5 * L.s, 0, 0, Math.PI * 2); g.fill();
    } else if (p.k === 'sweat') {
      g.fillStyle = `rgba(186,230,253,${k})`;
      g.beginPath(); g.arc(p.x, p.y, 2.5 * L.s, 0, Math.PI * 2); g.fill();
    } else if (p.k === 'orb') {
      g.fillStyle = `rgba(134,239,172,${k * 0.9})`;
      g.beginPath(); g.arc(p.x, p.y, 4 * L.s, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = p.k === 'steam' ? `rgba(255,255,255,${0.16 * k})` : `rgba(150,130,100,${0.35 * k})`;
      g.beginPath(); g.arc(p.x, p.y, p.r * (1.6 - k * 0.6), 0, Math.PI * 2); g.fill();
    }
  }
}

function drawFloats(g) {
  g.textAlign = 'center';
  for (const f of R.floats) {
    const k = f.t / 1.4;
    g.globalAlpha = Math.min(1, (1 - k) * 2);
    const sz = f.size * L.s * (f.t < 0.12 ? 0.7 + f.t * 2.5 : 1);
    g.font = `900 ${Math.round(Math.max(14, sz))}px system-ui, sans-serif`;
    const half = g.measureText(f.text).width / 2 + 8;
    const x = Math.max(half, Math.min(W - half, f.x)); // a long word stays on narrow screens
    g.lineWidth = 4;
    fillTextIcons(g, f.text, x, f.y - k * 60 * L.s, f.color, 'rgba(0,0,0,.65)');
  }
  g.globalAlpha = 1;
}

function loop(now) {
  if (!R) return;
  const dt = Math.min(0.05, (now - R.last) / 1000);
  R.last = now;
  update(dt);
  draw();
  R.raf = requestAnimationFrame(loop);
}

// freeze: hold the action animation at this fraction (0..1) for screenshots.
export function debugRoutine(freeze) {
  if (!R) return null;
  if (freeze !== undefined) R.freeze = freeze;
  return { mode: R.mode, session: R.session, anim: !!R.anim, gauge: gaugePos(), L, W, H };
}
