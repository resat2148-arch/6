// AI citizens: they live the same loop as the player — work, train, eat, fight in their country's
// battles, run companies, post market offers, buy what they need, level up and rank up.
import {
  COUNTRIES, COMPANY_TYPES, MARKET, FOOD_ENERGY, WEAPON_FP, RANKS, rankThreshold, rankIndexOf, xpToNextLevel, countryById,
} from './data.js';
import { EU_REGIONS } from './europe.js';
import { citizenName } from './names.js';
import { takeOffers, listOffer, offersFor, pruneOffers } from './market.js';
import { mulberry32, pick, clamp } from './util.js';
import { pressStep, newspaperName } from './press.js';

// Personalities: chance per world tick to fight / work / train, and how often they found companies.
export const PERSONAS = {
  s: { name: 'Soldier', icon: '🪖', fight: 0.85, work: 0.35, train: 0.6, company: 0.25 },
  w: { name: 'Worker', icon: '🛠️', fight: 0.4, work: 0.8, train: 0.45, company: 0.35 },
  t: { name: 'Tycoon', icon: '🏭', fight: 0.25, work: 0.6, train: 0.25, company: 0.95 },
};
const COMPANY_WEIGHTS = [['farm', 7], ['mine', 11], ['quarry', 7], ['bakery', 21], ['armory', 30], ['construction', 25]];
const BOT_PROD_MULT = 1.2; // one AI citizen stands in for a handful of real players' output
const TICKS_PER_MIN = 3; // world tick = 20 s
export const CITIZEN_WALL_WEIGHT = 0.15 / 5; // 0.15 split across POP_SCALE times as many citizens

export const botMaxEnergy = (b) => Math.min(400, 100 + (b.lvl - 1) * 10);
export const botTrainGain = (b) => 5 + (b.lvl >= 8 ? 2.5 : 0) + (b.lvl >= 15 ? 5 : 0) + (b.lvl >= 25 ? 10 : 0);
export const botHit = (b, q) => 10 * (1 + b.str / 400) * (1 + rankIndexOf(b.rp) / 5) * (q ? 1 + WEAPON_FP[q] / 100 : 0.5);
export const botRank = (b) => RANKS[rankIndexOf(b.rp)];

function weighted(list, rnd) {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let r = rnd() * total;
  for (const [v, w] of list) { r -= w; if (r <= 0) return v; }
  return list[0][0];
}

// Population follows territory: more regions, more citizens (and more damage in battles).
// A nation without regions keeps a single resistance citizen.
// POP_SCALE citizens stand where one stood before; their wall weight is divided by the same factor.
export const POP_SCALE = 5;
export const populationTarget = (regions) => POP_SCALE * (regions > 0 ? Math.round(2 + 0.75 * regions) : 1);

function makeCitizen(id, cid, rnd, newcomer = false, taken = []) {
  const { name, female } = citizenName(cid, rnd, taken);
  const lvl = newcomer ? 1 + Math.floor(rnd() * 6) : 1 + Math.floor(rnd() * rnd() * 32);
  const p = weighted([['s', 40], ['w', 35], ['t', 25]], rnd);
  const b = {
    id, n: name, fem: female, c: cid, p, lvl, xp: 0,
    str: Math.round(100 + lvl * 35 * (0.6 + rnd() * 0.8)),
    rp: rankThreshold(Math.floor(lvl * 1.5 * (0.5 + rnd() * 0.7))),
    m: Math.round(80 + lvl * 40 * rnd()), e: 100, fe: 150, w: [0, 0, 0, 0, 0, 0],
    dmg: 0, co: null, stock: 0, px: 0, last: 0, amb: rnd(), np: null, cong: false, pres: false,
  };
  if (lvl >= 5 && (b.amb > 0.65 || rnd() < 0.08)) b.np = { name: newspaperName(b, rnd), subs: Math.floor(lvl * (2 + rnd() * 10)), articles: 0 };
  b.w[clamp(Math.ceil(lvl / 7), 1, 5)] = 100 + lvl * 15;
  if (!newcomer && rnd() < PERSONAS[p].company) {
    b.co = { t: weighted(COMPANY_WEIGHTS, rnd), q: clamp(1 + Math.floor(lvl / 8 + rnd() * 2), 1, 5), l: clamp(1 + Math.floor(rnd() * 3 + lvl / 8), 1, 10) };
  }
  return b;
}

export function createCitizens(seed) {
  const rnd = mulberry32(seed ^ 0x5eed);
  const list = [];
  for (const c of COUNTRIES) {
    const n = populationTarget(EU_REGIONS.filter((r) => r.c === c.id).length);
    for (let i = 0; i < n; i++) list.push(makeCitizen(list.length, c.id, rnd, false, list.filter((b) => b.c === c.id).map((b) => b.n)));
  }
  return list;
}

// Old saves were made with fewer citizens per region: fill every nation up to today's target at once.
export function fillPopulation(s, rnd = Math.random) {
  const regions = {};
  for (const r of s.world.regions) regions[r.owner] = (regions[r.owner] || 0) + 1;
  let added = 0;
  for (const c of COUNTRIES) {
    const missing = populationTarget(regions[c.id] || 0) - populationOf(s, c.id);
    for (let i = 0; i < missing; i++) {
      const slot = s.citizens.findIndex((x) => !x.c);
      const id = slot >= 0 ? slot : s.citizens.length;
      s.citizens[id] = makeCitizen(id, c.id, rnd, false, s.citizens.filter((x) => x.c === c.id).map((x) => x.n));
      added++;
    }
  }
  return added;
}

// Saves keep citizens as short arrays (ids are the indexes): about a third of the object size.
const r2 = (n) => Math.round(n * 100) / 100;
export function packCitizens(list) {
  return list.map((b) => (b.c
    ? [b.n, b.fem ? 1 : 0, b.c, b.p, b.lvl, Math.round(b.xp), Math.round(b.str * 10) / 10, Math.round(b.rp), r2(b.m), Math.round(b.e), Math.round(b.fe), b.w,
      Math.round(b.dmg), b.co ? [b.co.t, b.co.q, b.co.l] : 0, Math.round(b.stock || 0), Math.round((b.px || 0) * 1000) / 1000, b.last || 0, r2(b.amb ?? 0.5),
      b.np ? [b.np.name, b.np.subs, b.np.articles] : 0, b.cong ? 1 : 0, b.pres ? 1 : 0]
    : [b.n || 'Citizen']));
}

export function unpackCitizens(rows) {
  return rows.map((t, id) => {
    if (t.length === 1) {
      return { id, n: t[0], fem: false, c: null, p: 'w', lvl: 1, xp: 0, str: 100, rp: 0, m: 0, e: 0, fe: 0, w: [0, 0, 0, 0, 0, 0], dmg: 0, co: null, stock: 0, px: 0, last: 0, amb: 0.5, np: null, cong: false, pres: false };
    }
    const [n, fem, c, p, lvl, xp, str, rp, m, e, fe, w, dmg, co, stock, px, last, amb, np, cong, pres] = t;
    return {
      id, n, fem: !!fem, c, p, lvl, xp, str, rp, m, e, fe, w, dmg, co: co ? { t: co[0], q: co[1], l: co[2] } : null, stock, px, last, amb,
      np: np ? { name: np[0], subs: np[1], articles: np[2] } : null, cong: !!cong, pres: !!pres,
    };
  });
}

// Active citizens only: emigrants who left Europe keep their slot (ids are indexes) but have no country.
export const activeCitizens = (s) => s.citizens.filter((b) => b.c);

export function populationOf(s, cid) {
  let n = 0;
  for (const b of s.citizens) if (b.c === cid) n++;
  return n;
}

// A newcomer takes the slot of someone who left Europe, so the save does not grow forever.
function newcomer(s, cid, rnd) {
  const slot = s.citizens.findIndex((x) => !x.c);
  const id = slot >= 0 ? slot : s.citizens.length;
  const b = makeCitizen(id, cid, rnd, true, s.citizens.filter((x) => x.c === cid).map((x) => x.n));
  if (slot >= 0) {
    s.articles = (s.articles || []).filter((a) => a.a !== id);
    for (const c of s.world.campaigns) if (c.fighters) delete c.fighters[id];
  }
  s.citizens[id] = b;
  return b;
}

// Moves each nation's population one step toward its target: surplus citizens emigrate to nations
// that need people, newcomers fill the rest, and anyone with nowhere to go leaves Europe.
export function populationStep(s, news, rnd = Math.random) {
  const regions = {};
  for (const r of s.world.regions) regions[r.owner] = (regions[r.owner] || 0) + 1;
  const player = s.player.country;
  // The target counts AI citizens; the player always comes on top of it.
  const gap = {};
  for (const c of COUNTRIES) gap[c.id] = populationTarget(regions[c.id] || 0) - populationOf(s, c.id);
  // A big gap moves a few people per step (populations are POP_SCALE times larger than they used to be).
  const step = (g) => Math.min(3, Math.ceil(Math.abs(g) / 2));
  const leaving = [];
  for (const c of COUNTRIES) {
    if (gap[c.id] >= 0 || rnd() > 0.35) continue;
    const pool = s.citizens.filter((b) => b.c === c.id && !b.pres);
    // The least rooted citizens go first: low level, no seat in Congress.
    pool.sort((a, b) => (a.cong - b.cong) || (a.lvl - b.lvl));
    leaving.push(...pool.slice(0, step(gap[c.id])));
  }
  const moves = [];
  for (const c of COUNTRIES) {
    if (gap[c.id] <= 0 || rnd() > 0.35) continue;
    for (let k = step(gap[c.id]); k > 0; k--) {
      const from = leaving.shift();
      if (from) {
        moves.push({ b: from, from: from.c, to: c.id });
        from.c = c.id;
        from.cong = false;
      } else {
        const b = newcomer(s, c.id, rnd);
        if (c.id === player && news.budget > 0) { news.budget--; news.feed(`👶 ${b.n} became a new citizen of ${countryById(c.id).name}`); }
      }
    }
  }
  for (const b of leaving) {
    const from = b.c;
    b.c = null;
    b.cong = false;
    s.market.offers = s.market.offers.filter((o) => o.seller !== b.id);
    if (from === player && news.budget > 0) { news.budget--; news.feed(`✈️ ${b.n} left ${countryById(from).name} for good`); }
  }
  for (const m of moves) {
    if (news.budget <= 0) break;
    if (m.from === player || m.to === player || rnd() < 0.3) {
      news.budget--;
      news.feed(`🧳 ${m.b.n} moved from ${countryById(m.from).name} to ${countryById(m.to).name}`);
    }
  }
  return { moves: moves.length, left: leaving.length };
}

const productKey = (co) => {
  const T = COMPANY_TYPES[co.t];
  return T.kind === 'raw' ? T.output : T.output + co.q;
};

// Initial stock so the market is never empty on a new game.
export function seedMarket(s) {
  for (const b of s.citizens) {
    if (!b.co) continue;
    const key = productKey(b.co);
    b.px = MARKET[key].base * (0.9 + Math.random() * 0.3);
    const perTick = (COMPANY_TYPES[b.co.t].rate * b.co.l * BOT_PROD_MULT) / TICKS_PER_MIN;
    const qty = Math.floor(perTick * 12);
    if (qty > 0) { listOffer(s, b.id, key, qty, round2(b.px)); b.last = qty; }
  }
}

const round2 = (v) => Math.max(0.01, Math.round(v * 100) / 100);

export function feed(s, text) {
  s.feed.unshift({ t: s.lastTick, text });
  if (s.feed.length > 40) s.feed.length = 40;
}

const flag = (c) => countryById(c)?.name || c;

// ---------------------------------------------------------------- one world tick
export function citizensStep(s, now) {
  const fronts = new Map();
  for (const c of s.world.campaigns) {
    for (const side of ['att', 'def']) {
      const cid = c[side];
      if (!fronts.has(cid)) fronts.set(cid, []);
      fronts.get(cid).push({ c, side });
    }
  }
  const news = { budget: 3 };
  for (const b of s.citizens) {
    if (!b.c) continue;
    const P = PERSONAS[b.p];
    const mx = botMaxEnergy(b);
    b.e = Math.min(mx, b.e + 4);
    if (b.fe > 0 && b.e < mx - 5) {
      const g = Math.min(b.fe, mx - b.e, 25);
      b.fe -= g;
      b.e += g;
    }
    if (b.co) produce(s, b, news);
    const front = fronts.get(b.c);
    if (front && b.e >= 15 && Math.random() < P.fight) fight(s, b, pick(front), news);
    if (b.e >= 10 && Math.random() < P.work) {
      b.e -= 10;
      b.m += 10 + b.lvl * 1.5;
      b.xp += 2;
    }
    if (b.e >= 10 && Math.random() < P.train) {
      b.e -= 10;
      b.str += botTrainGain(b);
      b.xp += 2;
    }
    shop(s, b);
    invest(s, b, news);
    grow(s, b, news);
  }
  pruneOffers(s);
  const press = { budget: news.budget, feed: (t) => feed(s, t) };
  pressStep(s, press);
  populationStep(s, { budget: 1, feed: press.feed });
}

function fight(s, b, { c, side }, news) {
  const shots = Math.min(Math.floor(b.e) - 5, 10 + Math.floor(Math.random() * 25));
  if (shots <= 0) return;
  let q = 5;
  while (q > 0 && b.w[q] <= 0) q--;
  const armed = q ? Math.min(shots, b.w[q]) : 0;
  const dmg = Math.round(botHit(b, q) * armed + botHit(b, 0) * (shots - armed));
  if (q) b.w[q] -= armed;
  b.e -= shots;
  // Citizens stand in for a whole population, so each one's hits weigh less on the wall than a hero's.
  const wall = Math.round(dmg * CITIZEN_WALL_WEIGHT);
  if (side === 'att') c.dmgAtt = (c.dmgAtt || 0) + wall;
  else c.dmgDef = (c.dmgDef || 0) + wall;
  c.fighters = c.fighters || {};
  c.fighters[b.id] = (c.fighters[b.id] || 0) + wall;
  b.dmg += dmg;
  const before = rankIndexOf(b.rp);
  b.rp += dmg / 10;
  b.xp += 1 + Math.floor(shots / 4);
  const after = rankIndexOf(b.rp);
  if (news.budget > 0 && after > before && after % 4 === 1 && after > 8) {
    news.budget--;
    feed(s, `🎖️ ${b.n} (${flag(b.c)}) was promoted to ${RANKS[after]}`);
  } else if (news.budget > 0 && dmg > 6000 && Math.random() < 0.25) {
    news.budget--;
    feed(s, `⚔️ ${b.n} (${flag(b.c)}) dealt ${dmg.toLocaleString('en-US')} damage in the battle for ${s.world.regions[c.region].name}`);
  }
}

function produce(s, b, news) {
  const T = COMPANY_TYPES[b.co.t];
  const key = productKey(b.co);
  if (!b.px) b.px = MARKET[key].base;
  // React to demand: unsold stock lowers the asking price, a sell-out raises it.
  const mine = s.market.offers.find((o) => o.seller === b.id && o.key === key);
  const left = mine ? mine.qty : 0;
  if (b.last > 0) {
    if (left === 0) b.px *= 1.05;
    else if (left >= b.last * 0.9) b.px *= 0.97;
  }
  b.px = clamp(b.px, MARKET[key].base * 0.7, MARKET[key].base * 2.5);
  let units = (T.rate * b.co.l * BOT_PROD_MULT) / TICKS_PER_MIN;
  // A warehouse full of unsold goods: the company idles this tick.
  if (left > units * 8) { b.last = left; return; }
  if (T.kind === 'factory') {
    const per = b.co.q * (T.rawMult || 1);
    const need = Math.ceil(units * per);
    // Buy raw materials from the market when they are cheaper than producing them in-house.
    const inhouse = MARKET[T.input].base * 1.3;
    const r = takeOffers(s, T.input, need, b.id, { maxPrice: inhouse, maxMoney: b.m * 0.5 });
    b.m -= r.cost;
    const rest = need - r.qty;
    const affordable = Math.min(rest, Math.floor(Math.max(0, b.m * 0.5) / inhouse));
    b.m -= affordable * inhouse;
    units = Math.min(units, (r.qty + affordable) / per);
  }
  b.stock += units;
  const whole = Math.floor(b.stock);
  if (whole > 0) {
    b.stock -= whole;
    listOffer(s, b.id, key, whole, round2(b.px));
    if (news.budget > 0 && whole >= 400 && Math.random() < 0.08) {
      news.budget--;
      feed(s, `🛒 ${b.n} (${flag(b.c)}) listed ${whole.toLocaleString('en-US')} ${MARKET[key].name} at 💰${round2(b.px)}`);
    }
  }
  const after = s.market.offers.find((o) => o.seller === b.id && o.key === key);
  b.last = after ? after.qty : 0;
}

function buy(s, b, key, qty, maxMult) {
  const r = takeOffers(s, key, qty, b.id, { maxPrice: s.market.prices[key] * maxMult, maxMoney: Math.max(0, b.m) });
  b.m -= r.cost;
  return r.qty;
}

function shop(s, b) {
  if (b.fe < 80) {
    // Pick the food with the best energy per coin on offer right now.
    let bestQ = 0;
    let bestVal = Infinity;
    for (let fq = 1; fq <= 5; fq++) {
      const o = offersFor(s, 'food' + fq, b.id)[0];
      if (o && o.price / FOOD_ENERGY[fq] < bestVal) { bestVal = o.price / FOOD_ENERGY[fq]; bestQ = fq; }
    }
    if (bestQ) {
      const got = buy(s, b, 'food' + bestQ, Math.ceil(120 / FOOD_ENERGY[bestQ]), 1.8);
      b.fe += got * FOOD_ENERGY[bestQ];
    }
  }
  const arms = b.w.reduce((a, n) => a + n, 0);
  if (PERSONAS[b.p].fight >= 0.4 && arms < 60) {
    for (let q = 5; q >= 1; q--) {
      const o = offersFor(s, 'weapon' + q, b.id)[0];
      if (!o || o.price * 150 > b.m * 0.4) continue;
      const got = buy(s, b, 'weapon' + q, 150, 1.6);
      if (got) { b.w[q] += got; break; }
    }
  }
  // Wealthy citizens live in houses: a steady sink for construction companies.
  if (b.m > 1500 && Math.random() < 0.04) {
    for (let q = 5; q >= 1; q--) {
      const o = offersFor(s, 'house' + q, b.id)[0];
      if (o && o.price < b.m * 0.15) { buy(s, b, 'house' + q, 1, 1.8); break; }
    }
  }
}

function invest(s, b, news) {
  if (Math.random() > 0.03) return;
  if (!b.co && Math.random() < PERSONAS[b.p].company && b.m > 800) {
    b.co = { t: weighted(COMPANY_WEIGHTS, Math.random), q: clamp(Math.ceil(b.lvl / 8), 1, 5), l: 1 };
    b.m -= 400;
    b.px = 0;
    if (news.budget > 0) { news.budget--; feed(s, `🏗️ ${b.n} (${flag(b.c)}) founded a ${COMPANY_TYPES[b.co.t].name}`); }
  } else if (b.co && b.co.l < 10 && b.m > 600 * b.co.l) {
    b.m -= 300 * b.co.l;
    b.co.l++;
  } else if (b.co && COMPANY_TYPES[b.co.t].kind === 'factory' && b.co.q < 5 && b.m > 3000 * b.co.q) {
    b.m -= 1500 * b.co.q;
    b.co.q++;
    b.px = 0;
  }
}

function grow(s, b, news) {
  while (b.xp >= xpToNextLevel(b.lvl)) {
    b.xp -= xpToNextLevel(b.lvl);
    b.lvl++;
    b.e = Math.max(b.e, botMaxEnergy(b));
    if (b.lvl % 10 === 0 && news.budget > 0) { news.budget--; feed(s, `⭐ ${b.n} (${flag(b.c)}) reached level ${b.lvl}`); }
  }
}

// ---------------------------------------------------------------- queries for UI / politics
export function citizensOf(s, cid) {
  return s.citizens.filter((b) => b.c === cid);
}

export function topCitizen(s, cid) {
  const list = citizensOf(s, cid);
  if (!list.length) return null;
  return list.reduce((best, b) => (b.lvl * 10 + b.dmg / 2000 > best.lvl * 10 + best.dmg / 2000 ? b : best));
}

export function sellerName(s, seller) {
  if (seller === 'P') return { name: s.player.name + ' (you)', c: s.player.country };
  const b = s.citizens[seller];
  return b ? { name: b.n, c: b.c } : { name: 'Unknown', c: null };
}
