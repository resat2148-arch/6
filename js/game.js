// Core game rules. Pure state manipulation (no DOM) so it can run in Node tests.
import {
  CONFIG, COUNTRIES, RANKS, rankThreshold, MEDALS, COMPANY_TYPES, MARKET, GOLD_SHOP, FOOD_ENERGY, WEAPON_FP,
  FACILITIES, FACILITY_MAX_Q, FACILITY_QUALITY_MULT, superSoldierThreshold, POLICIES, TUTORIAL, DAILY_POOL, DAILY_COUNT, DAILY_REWARD_GOLD, DAILY_BONUS, LOGIN_REWARDS,
  MEDIA_MILESTONES, PATRIOT_STEP, PRESIDENT_NAMES, SAVE_VERSION, HOUSES, countryById, rankIndexOf, xpToNextLevel,
} from './data.js';
import {
  createWorld, neighborsOf, regionsOf, isAlive, countryPower, borderTargets, resourceBonus,
} from './world.js';
import { clamp, pick, randRange, shuffle, dayKey } from './util.js';
import { createCitizens, seedMarket, citizensStep, topCitizen, feed } from './citizens.js';
import { articleTitle, addArticle, botPopularity } from './press.js';
import {
  candidates, vote, estimateChance, congressSeats, electForeignPresidents, seatInitialGovernments, CAMPAIGN_COST,
} from './elections.js';
import {
  takeOffers, listOffer, traderPrice, quote, offersFor, importPrice,
} from './market.js';

// ---------------------------------------------------------------- events
export const bus = {
  l: {},
  on(e, f) { (this.l[e] ||= []).push(f); },
  emit(e, d) { (this.l[e] || []).forEach((f) => f(d)); },
};
const toast = (text, kind = 'info') => bus.emit('toast', { text, kind });
const ok = (extra = {}) => ({ ok: true, ...extra });
const fail = (msg) => ({ ok: false, msg });

// ---------------------------------------------------------------- setup
export function newGame({ name, country, now = Date.now(), seed = Math.floor(Math.random() * 1e9) }) {
  const world = createWorld(seed);
  world.nextAiTick = now + CONFIG.aiTickMs;
  const prices = {};
  for (const k in MARKET) prices[k] = MARKET[k].base;
  const s = {
    v: SAVE_VERSION,
    created: now,
    lastTick: now,
    player: {
      name, country, level: 1, xp: 0, strength: 100, rankPoints: 0,
      energy: 100, reserve: 300, money: 50, gold: 5,
      works: 0, strengthGained: 0, patriotDmg: 0, damage: 0,
    },
    inv: {
      foodRaw: 0, weaponRaw: 0, houseRaw: 0,
      food: [0, 40, 0, 0, 0, 0], weapon: [0, 300, 0, 0, 0, 0], house: [0, 0, 0, 0, 0, 0], bazooka: 2,
    },
    housing: {},
    facilities: { weights: 1, climbing: 0, shooting: 0, special: 0 },
    companies: [],
    nextCompanyId: 1,
    market: { prices, offers: [], nextOfferId: 1, sold: {} },
    citizens: createCitizens(seed),
    feed: [],
    articles: [],
    nextArticleId: 1,
    presidents: {},
    world,
    politics: {
      party: false, congress: false, president: false, candidate: null,
      electionType: 'congress', nextElection: now + CONFIG.electionEveryMs,
      presidentName: pick(PRESIDENT_NAMES), policy: null, news: null, lastResult: null, voted: [],
    },
    medals: {},
    counters: {},
    tutorial: { step: 0, base: 0 },
    daily: { day: null, missions: [], base: {}, claimed: [], bonusClaimed: false, streak: 0, lastLogin: null, loginPending: null },
    timers: { lastArticle: 0, lastDoubleCollect: 0, lastMidgame: now, lastFreeGold: 0 },
    flags: { victory: false },
    settings: { muted: false },
  };
  seedMarket(s);
  seatInitialGovernments(s);
  const pres = s.citizens[s.presidents[country]];
  if (pres) s.politics.presidentName = pres.n;
  return s;
}

// A brand-new citizen always has a front to fight on.
export function openFirstFront(s, now = Date.now()) {
  ensurePlayerCampaign(s, now);
}

// Fill any fields missing from older saves.
export function migrate(saved, now = Date.now()) {
  if (!saved || typeof saved !== 'object' || !saved.player || !saved.world) return null;
  if (saved.v !== SAVE_VERSION) return null; // incompatible world map: start a new citizen
  const fresh = newGame({ name: saved.player.name || 'Citizen', country: saved.player.country || 'A', now });
  const merge = (dst, src) => {
    for (const k in src) {
      if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) merge(dst[k], src[k]);
      else dst[k] = src[k];
    }
    return dst;
  };
  const s = merge(fresh, saved);
  s.world = saved.world;
  for (const f of FACILITIES) s.facilities[f.id] = facilityQ(s, f.id);
  // Saves from before AI politics: give every nation a government.
  if (saved.citizens && !saved.citizens.some((b) => b.amb !== undefined)) {
    s.presidents = {};
    s.citizens.forEach((b) => { b.amb = Math.random(); b.cong = false; b.pres = false; });
    seatInitialGovernments(s);
  }
  s.v = SAVE_VERSION;
  return s;
}

// Saves from the fictional-map version (v1): keep the citizen's progress, move them to a real country.
export const isLegacySave = (saved) => !!saved && saved.v === 1 && !!saved.player;

export function upgradeLegacy(saved, country, now = Date.now()) {
  const s = newGame({ name: saved.player.name || 'Citizen', country, now });
  for (const k of ['level', 'xp', 'strength', 'rankPoints', 'energy', 'reserve', 'money', 'gold', 'works', 'strengthGained', 'patriotDmg', 'damage']) {
    if (typeof saved.player[k] === 'number') s.player[k] = saved.player[k];
  }
  if (saved.inv) {
    for (const k of ['foodRaw', 'weaponRaw', 'houseRaw', 'bazooka']) if (typeof saved.inv[k] === 'number') s.inv[k] = saved.inv[k];
    for (const k of ['food', 'weapon', 'house']) if (Array.isArray(saved.inv[k])) s.inv[k] = saved.inv[k].slice(0, 6);
  }
  for (const k of ['housing', 'facilities', 'medals', 'counters', 'tutorial', 'settings']) if (saved[k]) s[k] = { ...s[k], ...saved[k] };
  for (const f of FACILITIES) s.facilities[f.id] = facilityQ(s, f.id);
  if (Array.isArray(saved.companies)) { s.companies = saved.companies; s.nextCompanyId = saved.nextCompanyId || saved.companies.length + 1; }
  if (saved.politics) {
    s.politics.party = !!saved.politics.party;
    s.politics.news = saved.politics.news || null;
  }
  return s;
}

// ---------------------------------------------------------------- derived stats
export const pc = (s) => countryById(s.player.country);
export const maxEnergy = (s) => Math.min(CONFIG.energyCap, 100 + (s.player.level - 1) * 10) + housingEnergy(s);

// ---------------------------------------------------------------- housing
export function activeHouses(s, now = s.lastTick) {
  const h = s.housing || {};
  return [1, 2, 3, 4, 5].filter((q) => (h[q] || 0) > now);
}
export const housingEnergy = (s, now) => activeHouses(s, now).reduce((a, q) => a + HOUSES[q].energy, 0);
export const housingRegen = (s, now) => 1 + activeHouses(s, now).reduce((a, q) => a + HOUSES[q].regen, 0);

export function moveIn(s, q, now = Date.now()) {
  if (!HOUSES[q]) return fail('Unknown house.');
  if (s.inv.house[q] <= 0) return fail(`You don't own a ${HOUSES[q].name}. Buy one on the Market.`);
  s.inv.house[q]--;
  s.housing[q] = Math.max(s.housing[q] || 0, now) + CONFIG.houseDurationMs;
  count(s, 'moveIn');
  return ok({ until: s.housing[q] });
}
export const maxReserve = (s) => maxEnergy(s) * 3;
export const xpToNext = xpToNextLevel;
export const division = (lvl) => (lvl < 10 ? 1 : lvl < 20 ? 2 : lvl < 35 ? 3 : 4);

export const rankIndex = rankIndexOf;
export const rankName = (s) => RANKS[rankIndex(s.player.rankPoints)];

export function policyMult(s, kind) {
  const pol = s.politics.president && s.politics.policy;
  return pol === kind ? POLICIES[kind].mult : 1;
}

export const weaponMult = (q) => (q === 0 ? 0.5 : 1 + WEAPON_FP[q] / 100);

// eRepublik damage formula: 10 * (1 + S/400) * (1 + Rank/5) * (1 + Firepower/100)
export function baseHit(s) {
  const p = s.player;
  return 10 * (1 + p.strength / 400) * (1 + rankIndex(p.rankPoints) / 5) * policyMult(s, 'damage');
}
export const hitDamage = (s, q) => baseHit(s) * weaponMult(q);

function expectedBase(level) {
  const S = 100 + 40 * (level - 1);
  const R = Math.min(RANKS.length - 1, Math.floor((level - 1) * 1.6));
  return 10 * (1 + S / 400) * (1 + R / 5);
}
// Reference hit used to scale enemies: partly your own power, partly a typical player of your level.
export const refHit = (s) => Math.pow(baseHit(s), 0.6) * Math.pow(expectedBase(s.player.level), 0.4) * 1.2;

export const salary = (s) => (10 + s.player.level * 1.5) * (s.politics.congress ? 1.2 : 1) * policyMult(s, 'salary');

// Quality 0-5 of a training facility (older saves stored true/false for built or not).
export function facilityQ(s, id) {
  const v = s.facilities[id];
  return typeof v === 'number' ? clamp(Math.floor(v), 0, FACILITY_MAX_Q) : v ? 1 : 0;
}
export const facilityGain = (f, q) => Math.round(f.gain * FACILITY_QUALITY_MULT[q] * 10) / 10;
export const trainGain = (s) => Math.round(FACILITIES.reduce((a, f) => a + facilityGain(f, facilityQ(s, f.id)), 0) * 10) / 10;
export const nextSuperSoldier = (s) => superSoldierThreshold((s.medals.superSoldier || 0) + 1);

export const bestWeapon = (s) => { for (let q = 5; q >= 1; q--) if (s.inv.weapon[q] > 0) return q; return 0; };

// ---------------------------------------------------------------- progression
export function count(s, ev, n = 1) {
  s.counters[ev] = (s.counters[ev] || 0) + n;
}

export function addXp(s, n) {
  const p = s.player;
  p.xp += n;
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    const g = p.level % 5 === 0 ? 5 : 1;
    p.gold += g;
    p.energy = Math.max(p.energy, maxEnergy(s));
    bus.emit('levelup', { level: p.level, gold: g });
  }
}

export function addRankPoints(s, n) {
  const before = rankIndex(s.player.rankPoints);
  s.player.rankPoints += n;
  const after = rankIndex(s.player.rankPoints);
  if (after > before) bus.emit('rankup', { rank: RANKS[after] });
}

export function awardMedal(s, id) {
  s.medals[id] = (s.medals[id] || 0) + 1;
  s.player.gold += MEDALS[id].gold;
  bus.emit('medal', { id, medal: MEDALS[id] });
}

export function giveReward(s, r, mult = 1) {
  for (const k in r) {
    const n = r[k] * mult;
    if (k === 'money') s.player.money += n;
    else if (k === 'gold') s.player.gold += n;
    else if (k === 'energy') s.player.energy = Math.min(maxEnergy(s), s.player.energy + n);
    else invAdd(s, k, n);
  }
}

export function rewardText(r) {
  const names = { money: '💰', gold: '🪙', bazooka: '🚀', energy: '⚡' };
  return Object.entries(r).map(([k, v]) => {
    if (names[k]) return `${names[k]} ${v}`;
    const m = MARKET[k];
    return m ? `${m.icon} ${v} ${m.name}` : `${v} ${k}`;
  }).join('  ');
}

// ---------------------------------------------------------------- inventory
const FLAT_ITEMS = ['foodRaw', 'weaponRaw', 'houseRaw', 'bazooka'];

export function invGet(s, key) {
  if (FLAT_ITEMS.includes(key)) return s.inv[key];
  const m = /^(food|weapon|house)(\d)$/.exec(key);
  if (m) return s.inv[m[1]][+m[2]];
  return 0;
}
export function invAdd(s, key, n) {
  if (FLAT_ITEMS.includes(key)) { s.inv[key] += n; return; }
  const m = /^(food|weapon|house)(\d)$/.exec(key);
  if (m) s.inv[m[1]][+m[2]] += n;
}

// ---------------------------------------------------------------- daily actions
export function work(s) {
  const p = s.player;
  if (p.energy < CONFIG.workEnergy) return fail('Not enough energy. Eat food or wait.');
  p.energy -= CONFIG.workEnergy;
  const m = salary(s);
  p.money += m;
  p.works++;
  addXp(s, 2);
  count(s, 'work');
  if (p.works % 30 === 0) awardMedal(s, 'hardWorker');
  return ok({ money: m });
}

export function train(s) {
  const p = s.player;
  if (p.energy < CONFIG.trainEnergy) return fail('Not enough energy. Eat food or wait.');
  p.energy -= CONFIG.trainEnergy;
  const g = trainGain(s);
  p.strength += g;
  p.strengthGained += g;
  addXp(s, 2);
  count(s, 'train');
  while (p.strengthGained >= nextSuperSoldier(s)) awardMedal(s, 'superSoldier');
  return ok({ gain: g });
}

export function eat(s) {
  const p = s.player;
  const mx = maxEnergy(s);
  let gained = 0;
  let eaten = 0;
  while (p.energy < mx - 0.5 && p.reserve >= 1) {
    const need = Math.min(mx - p.energy, p.reserve);
    let q = 0;
    for (let i = 5; i >= 1; i--) if (s.inv.food[i] > 0 && FOOD_ENERGY[i] <= need) { q = i; break; }
    if (!q) for (let i = 1; i <= 5; i++) if (s.inv.food[i] > 0) { q = i; break; }
    if (!q) break;
    const amt = Math.min(FOOD_ENERGY[q], need);
    s.inv.food[q]--;
    p.energy += amt;
    p.reserve -= amt;
    gained += amt;
    eaten++;
  }
  if (!eaten) {
    if (p.energy >= mx - 0.5) return fail('Energy is already full.');
    if (p.reserve < 1) return fail('Food reserve is empty. It refills over time.');
    return fail('No food! Buy some on the Market.');
  }
  count(s, 'eat');
  return ok({ gained, eaten });
}

export function useEnergyBar(s) {
  if (s.player.gold < GOLD_SHOP.energyBar.gold) return fail('Not enough gold.');
  s.player.gold -= GOLD_SHOP.energyBar.gold;
  s.player.energy = Math.min(maxEnergy(s) + 50, s.player.energy + 50);
  return ok();
}

export function refillEnergy(s) {
  s.player.energy = Math.max(s.player.energy, maxEnergy(s));
  s.player.reserve = Math.max(s.player.reserve, maxReserve(s));
}

// Builds a facility (to Q1) or raises its quality by one step.
export function upgradeFacility(s, id) {
  const f = FACILITIES.find((x) => x.id === id);
  if (!f) return fail('Unknown facility.');
  const q = facilityQ(s, id);
  if (q >= FACILITY_MAX_Q) return fail('Already at maximum quality.');
  const cost = f.cost[q];
  if (s.player.gold < cost) return fail(`Not enough gold (${cost} needed).`);
  s.player.gold -= cost;
  s.facilities[id] = q + 1;
  count(s, 'facilityUp');
  return ok({ q: q + 1, gain: facilityGain(f, q + 1) });
}

// ---------------------------------------------------------------- market (offers from AI citizens and the player)
export { quote, offersFor, importPrice, traderPrice };

// Buys from the cheapest offers first; state imports fill the rest at a premium.
export function buy(s, key, qty) {
  if (!MARKET[key] || qty <= 0) return fail('Invalid item.');
  const r = takeOffers(s, key, qty, 'P', { maxMoney: s.player.money, allowImport: true });
  if (!r.qty) return fail('Not enough money.');
  s.player.money -= r.cost;
  invAdd(s, key, r.qty);
  count(s, 'buy');
  return ok({ cost: r.cost, qty: r.qty, partial: r.qty < qty });
}

export function buyOffer(s, offerId, qty) {
  const o = s.market.offers.find((x) => x.id === offerId);
  if (!o || o.qty <= 0) return fail('That offer is gone.');
  if (o.seller === 'P') return fail('That is your own offer.');
  const r = takeOffers(s, o.key, Math.min(qty, o.qty), 'P', { maxMoney: s.player.money, only: o });
  if (!r.qty) return fail('Not enough money.');
  s.player.money -= r.cost;
  invAdd(s, o.key, r.qty);
  count(s, 'buy');
  return ok({ cost: r.cost, qty: r.qty, key: o.key });
}

// Instant sale to a trader at 70% of the average price.
export function sell(s, key, qty) {
  if (!MARKET[key] || qty <= 0) return fail('Invalid item.');
  if (invGet(s, key) < qty) return fail('You don\'t have that many.');
  const gain = traderPrice(s, key) * qty;
  invAdd(s, key, -qty);
  s.player.money += gain;
  return ok({ gain });
}

// Post a sell offer (ilan): goods leave the inventory until sold or cancelled.
export function postOffer(s, key, qty, price) {
  if (!MARKET[key]) return fail('Invalid item.');
  qty = Math.floor(qty);
  price = Math.round(price * 1000) / 1000;
  if (!(qty > 0)) return fail('Enter a quantity.');
  if (!(price > 0) || price > MARKET[key].base * 20) return fail('Enter a sensible price.');
  if (invGet(s, key) < qty) return fail('You don\'t have that many.');
  invAdd(s, key, -qty);
  listOffer(s, 'P', key, qty, price);
  count(s, 'post');
  return ok();
}

export function cancelOffer(s, offerId) {
  const o = s.market.offers.find((x) => x.id === offerId && x.seller === 'P');
  if (!o) return fail('Offer not found.');
  invAdd(s, o.key, o.qty);
  s.market.offers = s.market.offers.filter((x) => x !== o);
  return ok();
}

export const myOffers = (s) => s.market.offers.filter((o) => o.seller === 'P');

export function buyGold(s, n = 1) {
  const cost = CONFIG.goldBuyPrice * n;
  if (s.player.money < cost) return fail('Not enough money.');
  s.player.money -= cost;
  s.player.gold += n;
  return ok();
}

export function sellGold(s, n = 1) {
  if (s.player.gold < n) return fail('Not enough gold.');
  s.player.gold -= n;
  s.player.money += CONFIG.goldSellPrice * n;
  return ok();
}

export function buyGoldItem(s, key, n = 1) {
  const it = GOLD_SHOP[key];
  if (!it) return fail('Invalid item.');
  if (s.player.gold < it.gold * n) return fail('Not enough gold.');
  if (key === 'energyBar') return useEnergyBar(s);
  s.player.gold -= it.gold * n;
  invAdd(s, key, n);
  return ok();
}

// ---------------------------------------------------------------- companies
export const companyLimit = (s) => 2 + Math.floor(s.player.level / 3);

export function buildCost(s, type) {
  const owned = s.companies.filter((c) => c.type === type).length;
  return Math.round(COMPANY_TYPES[type].cost * (1 + 0.6 * owned));
}
export const levelUpCost = (c) => Math.round(COMPANY_TYPES[c.type].cost * 0.8 * Math.pow(1.7, c.lvl));
export const qualityUpCost = (c) => c.q * 4;
export const MAX_COMPANY_LEVEL = 10;

export function companyRate(s, c) {
  const T = COMPANY_TYPES[c.type];
  let rate = T.rate * c.lvl * policyMult(s, 'production');
  if (T.kind === 'raw' && T.res) rate *= resourceBonus(s.world, s.player.country, T.res);
  return rate; // units per minute
}
export const companyCap = (s, c) => companyRate(s, c) * CONFIG.companyStorageMinutes;

export function build(s, type) {
  const T = COMPANY_TYPES[type];
  if (!T) return fail('Unknown company.');
  if (s.companies.length >= companyLimit(s)) return fail('Company limit reached. Level up for more slots.');
  const cost = buildCost(s, type);
  if (s.player.money < cost) return fail('Not enough money.');
  s.player.money -= cost;
  s.companies.push({ id: s.nextCompanyId++, type, q: 1, lvl: 1, pending: 0 });
  count(s, 'build');
  if (s.companies.length >= 5 * ((s.medals.tycoon || 0) + 1)) awardMedal(s, 'tycoon');
  return ok();
}

export function upgradeLevel(s, id) {
  const c = s.companies.find((x) => x.id === id);
  if (!c) return fail('No such company.');
  if (c.lvl >= MAX_COMPANY_LEVEL) return fail('Max level.');
  const cost = levelUpCost(c);
  if (s.player.money < cost) return fail('Not enough money.');
  s.player.money -= cost;
  c.lvl++;
  return ok();
}

export function upgradeQuality(s, id) {
  const c = s.companies.find((x) => x.id === id);
  if (!c || COMPANY_TYPES[c.type].kind !== 'factory') return fail('Only factories have quality.');
  if (c.q >= 5) return fail('Max quality.');
  const cost = qualityUpCost(c);
  if (s.player.gold < cost) return fail('Not enough gold.');
  s.player.gold -= cost;
  c.q++;
  return ok();
}

export function collectAll(s, mult = 1) {
  const got = {};
  let any = false;
  let starved = false;
  const add = (k, n) => { got[k] = (got[k] || 0) + n; };
  for (const c of s.companies) {
    const T = COMPANY_TYPES[c.type];
    if (T.kind !== 'raw') continue;
    const n = Math.floor(c.pending * mult);
    if (n > 0) { s.inv[T.output] += n; add(T.output, n); any = true; }
    c.pending -= Math.floor(c.pending);
  }
  for (const c of s.companies) {
    const T = COMPANY_TYPES[c.type];
    if (T.kind !== 'factory') continue;
    const capacity = Math.floor(c.pending * mult);
    const per = c.q * (T.rawMult || 1);
    const can = Math.min(capacity, Math.floor(s.inv[T.input] / per));
    if (can < capacity) starved = true;
    if (can > 0) {
      s.inv[T.input] -= can * per;
      const key = T.output + c.q;
      invAdd(s, key, can);
      add(key, can);
      any = true;
      c.pending = Math.max(0, c.pending - can / mult);
    }
  }
  if (!any) return fail(starved ? 'Factories need raw materials. Build a Farm/Mine or buy raw.' : 'Nothing to collect yet.');
  count(s, 'collect');
  return ok({ got, starved });
}

export const pendingTotal = (s) => s.companies.reduce((a, c) => a + c.pending, 0);

// ---------------------------------------------------------------- politics & media
export function popularity(s) {
  const medals = Object.values(s.medals).reduce((a, b) => a + b, 0);
  const subs = s.politics.news ? s.politics.news.subs : 0;
  return Math.round(subs + s.player.level * 5 + medals * 10 + (s.politics.congress ? 50 : 0));
}

export function joinParty(s) {
  if (s.politics.party) return fail('Already a party member.');
  if (s.player.level < 3) return fail('Reach level 3 to join a party.');
  s.politics.party = true;
  count(s, 'party');
  return ok();
}

export function voteArticle(s, id) {
  const a = s.articles.find((x) => x.id === id);
  if (!a) return fail('Article not found.');
  if (a.a === 'P') return fail('You cannot vote for your own article.');
  if (s.politics.voted.includes(id)) return fail('You already voted for this article.');
  s.politics.voted.push(id);
  if (s.politics.voted.length > 120) s.politics.voted.shift();
  a.votes++;
  const b = s.citizens[a.a];
  if (b?.np) b.np.subs++;
  addXp(s, 1);
  count(s, 'vote');
  return ok();
}

export const OFFICES = {
  congress: { name: 'Congress', level: 8, cost: 100 },
  president: { name: 'President', level: 15, cost: 500 },
};

// Simulated against the AI citizens who would run against you right now.
export const winChance = (s, office) => estimateChance(s, office, popularity(s));

export const rivals = (s, office) => candidates(s, office, s.player.country, popularity(s), false)
  .map((c) => ({ ...c, b: s.citizens[c.id] }));

export const congressOf = (s) => s.citizens.filter((b) => b.c === s.player.country && b.cong);
export { congressSeats, botPopularity };

export function runFor(s, office) {
  const o = OFFICES[office];
  if (!o) return fail('Unknown office.');
  if (!s.politics.party) return fail('Join a party first.');
  if (s.player.level < o.level) return fail(`Reach level ${o.level} first.`);
  if (office === 'president' && !s.politics.congress) return fail('You must be a Congress member first.');
  if (s.politics.candidate) return fail('You are already a candidate.');
  if (s.player.money < o.cost) return fail('Not enough money for the campaign.');
  s.player.money -= o.cost;
  s.politics.candidate = office;
  return ok();
}

function resolveElection(s, now) {
  const pol = s.politics;
  const type = pol.electionType;
  const cid = s.player.country;
  const running = pol.candidate === type;
  const cands = candidates(s, type, cid, popularity(s), running);
  // AI candidates pay for their campaigns too.
  for (const c of cands) if (c.id !== 'P') s.citizens[c.id].m -= Math.min(s.citizens[c.id].m, CAMPAIGN_COST[type]);
  const rows = vote(s, cid, cands);
  const seats = type === 'congress' ? congressSeats(s, cid) : 1;
  const winners = new Set(rows.slice(0, seats).map((r) => r.id));
  const home = s.citizens.filter((b) => b.c === cid);
  if (type === 'congress') {
    home.forEach((b) => { b.cong = winners.has(b.id); });
    pol.congress = winners.has('P');
    const names = rows.slice(0, seats).map((r) => (r.id === 'P' ? s.player.name : s.citizens[r.id].n));
    if (s.feed) feed(s, `🏛️ New Congress of ${pc(s).name}: ${names.join(', ')}`);
  } else {
    home.forEach((b) => { b.pres = false; });
    pol.president = false;
    pol.policy = pol.policy && winners.has('P') ? pol.policy : null;
    const w = rows[0];
    if (w && w.id === 'P') { pol.president = true; pol.presidentName = s.player.name; }
    else if (w) { s.citizens[w.id].pres = true; s.presidents[cid] = w.id; pol.presidentName = s.citizens[w.id].n; }
    if (s.feed && w) feed(s, `👑 ${pol.presidentName} was elected President of ${pc(s).name}`);
    const foreign = electForeignPresidents(s);
    if (s.feed && foreign.length) {
      const big = foreign.filter((b) => ['DE', 'FR', 'GB', 'RU', 'IT', 'ES', 'PL', 'UA'].includes(b.c)).slice(0, 2);
      for (const b of big) feed(s, `👑 ${b.n} is the new President of ${countryById(b.c).name}`);
    }
  }
  pol.lastResult = { type, t: now, seats, rows: rows.map((r) => ({ id: r.id, votes: r.votes, won: winners.has(r.id) })) };
  if (running) {
    const won = winners.has('P');
    if (won) awardMedal(s, type === 'congress' ? 'congressMember' : 'president');
    bus.emit('election', { won, office: type });
  }
  pol.candidate = null;
  if (pol.congress) s.player.gold += 1;
  if (pol.president) s.player.gold += 2;
  pol.electionType = type === 'congress' ? 'president' : 'congress';
  pol.nextElection = now + CONFIG.electionEveryMs;
}

export function setPolicy(s, key) {
  if (!s.politics.president) return fail('Only the President can set policy.');
  if (!POLICIES[key]) return fail('Unknown policy.');
  s.politics.policy = key;
  return ok();
}

export function createNewspaper(s, name) {
  if (s.politics.news) return fail('You already own a newspaper.');
  if (s.player.level < 5) return fail('Reach level 5 to found a newspaper.');
  if (s.player.gold < 2) return fail('Founding a newspaper costs 2 gold.');
  s.player.gold -= 2;
  s.politics.news = { name: (name || '').trim().slice(0, 28) || `The ${pc(s).name} Herald`, subs: 0, articles: 0 };
  return ok();
}

export function suggestTitle(s) {
  const p = s.player;
  return articleTitle(s, { n: p.name, c: p.country, amb: 0.8, lvl: p.level, p: 'w', rp: p.rankPoints, cong: s.politics.congress, pres: s.politics.president });
}

export function writeArticle(s, title, now = Date.now()) {
  const n = s.politics.news;
  if (!n) return fail('Found a newspaper first.');
  const wait = s.timers.lastArticle + CONFIG.articleCooldownMs - now;
  if (wait > 0) return fail('Your readers need time. Try again soon.');
  const clean = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 80) || suggestTitle(s);
  s.timers.lastArticle = now;
  const gain = 2 + Math.floor(Math.random() * (4 + n.subs / 20));
  n.subs += gain;
  n.articles++;
  addArticle(s, 'P', s.player.country, n.name, clean);
  addXp(s, 5);
  count(s, 'article');
  while ((s.medals.mediaMogul || 0) < MEDIA_MILESTONES.length && n.subs >= MEDIA_MILESTONES[s.medals.mediaMogul || 0]) {
    awardMedal(s, 'mediaMogul');
  }
  return ok({ gain });
}

// ---------------------------------------------------------------- war
export function playerSide(s, c) {
  const me = s.player.country;
  if (c.att === me) return 'att';
  if (c.def === me) return 'def';
  return null;
}

export const campaignById = (s, id) => s.world.campaigns.find((c) => c.id === id);
export const activeFronts = (s) => s.world.campaigns.filter((c) => playerSide(s, c)).sort((a, b) => a.endsAt - b.endsAt);

function makeCampaign(s, att, def, regionId, type, now) {
  const c = {
    id: s.world.nextCampId++, att, def, region: regionId, type, started: now,
    endsAt: now + CONFIG.battleMs, playerDmg: 0, dmgAtt: 0, dmgDef: 0, fighters: {},
  };
  setBattleBase(s, c);
  const side = playerSide(s, c);
  if (side) {
    const reg = s.world.regions[regionId];
    const foe = countryById(side === 'att' ? def : att).name;
    if (type === 'rw' && side === 'att') toast(`✊ Resistance war started in ${reg.name}!`, 'war');
    else if (side === 'att') toast(`⚔️ ${pc(s).name} attacks ${reg.name} (${foe})!`, 'war');
    else toast(`🚨 ${foe} is attacking ${reg.name}! Defend it!`, 'war');
    bus.emit('campaign', c);
  }
  s.world.campaigns.push(c);
  return c;
}

export function canDeclareWar(s, regionId) {
  const w = s.world;
  const me = s.player.country;
  const reg = w.regions[regionId];
  if (!s.politics.president) return fail('Only the President can declare war.');
  if (!reg || reg.owner === me) return fail('Choose an enemy region.');
  if (!neighborsOf(w, regionId).some((n) => w.regions[n].owner === me)) return fail('Region must border your country.');
  if (w.campaigns.some((c) => c.region === regionId)) return fail('A battle is already raging there.');
  if (w.campaigns.some((c) => c.att === me)) return fail('Your army is already on campaign.');
  return ok();
}

export function declareWar(s, regionId, now = Date.now()) {
  const r = canDeclareWar(s, regionId);
  if (!r.ok) return r;
  const c = makeCampaign(s, s.player.country, s.world.regions[regionId].owner, regionId, 'war', now);
  return ok({ campaign: c });
}

export function canStartResistance(s, regionId) {
  const w = s.world;
  const reg = w.regions[regionId];
  if (!reg || reg.origin !== s.player.country || reg.owner === s.player.country) return fail('Only occupied regions of your homeland.');
  if (w.campaigns.some((c) => c.region === regionId)) return fail('A battle is already raging there.');
  if (s.player.gold < 5) return fail('Starting a resistance costs 5 gold.');
  return ok();
}

export function startResistance(s, regionId, now = Date.now()) {
  const r = canStartResistance(s, regionId);
  if (!r.ok) return r;
  s.player.gold -= 5;
  const c = makeCampaign(s, s.player.country, s.world.regions[regionId].owner, regionId, 'rw', now);
  return ok({ campaign: c });
}

function endCampaign(s, c, now) {
  const w = s.world;
  w.campaigns = w.campaigns.filter((x) => x !== c);
  const reg = w.regions[c.region];
  const wall = battleWall(c);
  const attWon = wall.att > wall.def;
  const side = playerSide(s, c);
  if (attWon) {
    const loser = reg.owner;
    reg.owner = c.att;
    if (s.feed) feed(s, `${c.type === 'rw' ? '✊' : '🏳️'} ${countryById(c.att).name} ${c.type === 'rw' ? 'liberated' : 'conquered'} ${reg.name} from ${countryById(loser).name}`);
    if (!isAlive(w, loser)) {
      toast(`💀 ${countryById(loser).name} has been wiped from the map!`, 'war');
      w.campaigns = w.campaigns.filter((x) => x.att !== loser || x.type === 'rw');
    }
  }
  if (side) {
    const won = (side === 'att') === attWon;
    const medals = [];
    const fought = c.playerDmg > 0;
    if (won && side === 'att') count(s, 'conquest');
    if (fought) {
      count(s, 'battlePlay');
      const top = Object.entries(c.fighters || {}).sort((a, b) => b[1] - a[1])[0];
      if (top && top[0] === 'P') { awardMedal(s, 'battleHero'); medals.push('battleHero'); }
      if (won) {
        count(s, 'roundWin');
        s.player.gold += 2;
        s.player.money += 50 + s.player.level * 5;
        const sideCitizens = side === 'att' ? c.dmgAtt : c.dmgDef;
        if (c.playerDmg * playerBoost(s) >= sideCitizens * 0.25) { awardMedal(s, 'campaignHero'); medals.push('campaignHero'); }
        if (c.type === 'rw' && side === 'att') { awardMedal(s, 'resistanceHero'); medals.push('resistanceHero'); }
      }
    }
    const result = {
      id: c.id, won, fought, medals, region: reg.name, side, attWon,
      pct: side === 'att' ? wall.attPct : 100 - wall.attPct,
      playerDmg: c.playerDmg,
      top: Object.entries(c.fighters || {}).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
    s.battleResults = [result, ...(s.battleResults || [])].slice(0, 8);
    bus.emit('campaignEnd', { c, won, region: reg, result });
  }
  if (!s.flags.victory && w.regions.every((r) => r.owner === s.player.country)) {
    s.flags.victory = true;
    bus.emit('victory', {});
  }
}

// ---------------------------------------------------------------- battles: one round, 5 minutes, one shared wall
// Each side starts with a base from its nation's strength; every point of damage from AI citizens and the
// player is added on top. When the timer runs out the side with the bigger total takes (or keeps) the region.
const BATTLE_BASE = 4000;

function setBattleBase(s, c) {
  c.baseAtt = Math.round(countryPower(s.world, c.att) * BATTLE_BASE * randRange(0.85, 1.15));
  c.baseDef = Math.round(countryPower(s.world, c.def) * CONFIG.defenseBonus * BATTLE_BASE * randRange(0.85, 1.15));
}

export function battleWall(c) {
  const att = (c.baseAtt || 0) + (c.dmgAtt || 0);
  const def = (c.baseDef || 0) + (c.dmgDef || 0);
  return { att, def, attPct: (att / Math.max(1, att + def)) * 100 };
}

// New players hit harder in real battles so their first fights matter (fades out by level 10).
export const playerBoost = (s) => (s.player.level < 10 ? 1 + (2 * (10 - s.player.level)) / 9 : 1);

function resolveDueBattles(s, now) {
  for (const c of s.world.campaigns.slice()) {
    if (!c.endsAt) { c.endsAt = now + CONFIG.battleMs * Math.random(); setBattleBase(s, c); }
    if (now >= c.endsAt) endCampaign(s, c, now);
  }
}

function ensurePlayerCampaign(s, now) {
  const w = s.world;
  const me = s.player.country;
  if (w.campaigns.some((c) => playerSide(s, c))) return;
  const busy = new Set(w.campaigns.map((c) => c.region));
  if (!isAlive(w, me)) {
    const occ = w.regions.filter((r) => r.origin === me && r.owner !== me && !busy.has(r.id));
    if (occ.length) { const r = pick(occ); makeCampaign(s, me, r.owner, r.id, 'rw', now); }
    return;
  }
  const attackable = borderTargets(w, me).filter((r) => !busy.has(r.id));
  const defendable = regionsOf(w, me).filter((r) => !busy.has(r.id) && neighborsOf(w, r.id).some((n) => w.regions[n].owner !== me));
  if (!s.politics.president && attackable.length && (Math.random() < 0.55 || !defendable.length)) {
    const t = pick(attackable);
    makeCampaign(s, me, t.owner, t.id, 'war', now);
  } else if (defendable.length) {
    const t = pick(defendable);
    const foes = [...new Set(neighborsOf(w, t.id).map((n) => w.regions[n].owner).filter((o) => o !== me))];
    makeCampaign(s, pick(foes), me, t.id, 'war', now);
  }
}

function aiStep(s, now) {
  const w = s.world;
  if (s.citizens) citizensStep(s, now);
  resolveDueBattles(s, now);
  const aiCount = () => w.campaigns.filter((c) => !playerSide(s, c)).length;
  const busy = new Set(w.campaigns.map((c) => c.region));
  const attacking = new Set(w.campaigns.map((c) => c.att));
  for (const country of shuffle(COUNTRIES)) {
    if (aiCount() >= CONFIG.maxAiCampaigns) break;
    if (country.id === s.player.country) continue;
    if (attacking.has(country.id) || !isAlive(w, country.id)) continue;
    if (Math.random() > CONFIG.aiWarChance) continue;
    const targets = borderTargets(w, country.id).filter((r) => !busy.has(r.id) && r.owner !== s.player.country);
    if (!targets.length) continue;
    const t = pick(targets);
    makeCampaign(s, country.id, t.owner, t.id, 'war', now);
    busy.add(t.id);
    attacking.add(country.id);
  }
  // Resistance wars by AI nations.
  for (const r of w.regions) {
    if (r.owner === r.origin || busy.has(r.id) || attacking.has(r.origin)) continue;
    if (r.origin === s.player.country) continue;
    if (Math.random() < CONFIG.rwChance) {
      makeCampaign(s, r.origin, r.owner, r.id, 'rw', now);
      busy.add(r.id);
      attacking.add(r.origin);
    }
  }
  ensurePlayerCampaign(s, now);
}

// ---------------------------------------------------------------- the battle scene
// Real battles: the scene joins the running 5-minute battle; every hit goes straight onto the wall.
// Training war: a private 60-second practice round against a simulated enemy.
export function roundSetup(s, campId) {
  const training = campId === 'training';
  const c = training ? null : campaignById(s, campId);
  if (!training && !c) return null;
  const side = training ? 'att' : playerSide(s, c);
  if (!side) return null;
  const me = s.player.country;
  const foe = training
    ? COUNTRIES.filter((x) => x.id !== me)[(s.counters.roundPlay || 0) % (COUNTRIES.length - 1)].id
    : side === 'att' ? c.def : c.att;
  const ref = refHit(s);
  const reg = training ? null : s.world.regions[c.region];
  const f = s.player.level <= 3 ? 0.4 : 0.55;
  return {
    campId, training, side, me, foe,
    regionName: training ? 'Training Grounds' : reg.name,
    title: training ? 'Training War' : c.type === 'rw' ? `Resistance: ${reg.name}` : `Battle for ${reg.name}`,
    endsAt: training ? 0 : c.endsAt,
    seconds: CONFIG.trainingSeconds,
    boost: training ? 1 : playerBoost(s),
    ref,
    enemyHp: ref * 3 * (training ? 1 : 1 + 0.1 * (countryPower(s.world, foe) - 1)),
    // Training only: simulated sides of the practice wall.
    enemyDps: f * ref * 3,
    allyDps: 0.3 * ref * 3,
    wallBase: ref * 40,
    division: division(s.player.level),
  };
}

// Adds one hit to a running battle. Returns false when the battle is already over.
export function battleHit(s, campId, dmg) {
  const c = campaignById(s, campId);
  if (!c) return false;
  const side = playerSide(s, c);
  if (!side) return false;
  const counted = dmg * playerBoost(s);
  if (side === 'att') c.dmgAtt = (c.dmgAtt || 0) + counted;
  else c.dmgDef = (c.dmgDef || 0) + counted;
  c.playerDmg += dmg;
  c.fighters = c.fighters || {};
  c.fighters.P = (c.fighters.P || 0) + dmg;
  return true;
}

// One shot from the battle scene. Consumes energy + a weapon; returns base damage or null.
export function shoot(s, preferredQ) {
  const p = s.player;
  if (p.energy < CONFIG.shotEnergy) return null;
  let q = preferredQ;
  while (q > 0 && s.inv.weapon[q] <= 0) q--;
  if (q > 0) s.inv.weapon[q]--;
  p.energy -= CONFIG.shotEnergy;
  return { q, dmg: hitDamage(s, q) };
}

export function takeHit(s) {
  s.player.energy = Math.max(0, s.player.energy - CONFIG.enemyShotEnergy);
}

export function useBazooka(s, setup) {
  if (s.inv.bazooka <= 0) return null;
  s.inv.bazooka--;
  return { perEnemy: setup.enemyHp * 2.5, wall: setup.ref * 25 };
}

// Rewards for one visit to the battlefield (leaving, or the battle ending while you fight).
// Victory bonuses and battle medals are handed out when the battle itself ends.
export function finishVisit(s, setup, result) {
  const { dmg, kills, headshots, won } = result;
  const p = s.player;
  const t = setup.training ? 0.5 : 1;
  const money = (kills * 0.3 + (setup.training ? (won ? 10 : 4) : 0)) * (1 + p.level * 0.1) * t;
  const xp = Math.round((kills + (setup.training ? (won ? 10 : 3) : Math.floor(dmg / (setup.ref * 20)))) * t);
  const rp = Math.round((dmg / 10) * t);
  p.money += money;
  p.damage += dmg;
  addXp(s, xp);
  addRankPoints(s, rp);
  count(s, 'kill', kills);
  count(s, 'headshot', headshots);
  count(s, 'roundPlay');
  if (setup.training && won) count(s, 'trainingWin');
  const medals = [];
  if (!setup.training) {
    p.patriotDmg += dmg;
    while (Math.floor(p.patriotDmg / PATRIOT_STEP) > (s.medals.truePatriot || 0)) { awardMedal(s, 'truePatriot'); medals.push('truePatriot'); }
  }
  return { money, xp, rp, medals };
}

// ---------------------------------------------------------------- missions
export function tutorialStep(s) {
  return TUTORIAL[s.tutorial.step] || null;
}

export function tutorialProgress(s) {
  const st = tutorialStep(s);
  if (!st) return null;
  if (st.cond) return { cur: st.cond(s) ? 1 : 0, n: 1 };
  const cur = Math.min(st.n, (s.counters[st.ev] || 0) - s.tutorial.base);
  return { cur, n: st.n };
}

export function claimTutorial(s) {
  const st = tutorialStep(s);
  const pr = tutorialProgress(s);
  if (!st || pr.cur < pr.n) return fail('Mission not complete yet.');
  giveReward(s, st.reward);
  s.tutorial.step++;
  const next = tutorialStep(s);
  s.tutorial.base = next && next.ev ? s.counters[next.ev] || 0 : 0;
  return ok({ reward: st.reward });
}

function checkDaily(s, now) {
  const d = s.daily;
  const key = dayKey(now);
  if (d.day === key) return;
  const prev = d.day;
  d.day = key;
  d.missions = shuffle(DAILY_POOL).slice(0, DAILY_COUNT).map((m) => m.id);
  d.base = {};
  for (const id of d.missions) {
    const m = DAILY_POOL.find((x) => x.id === id);
    d.base[id] = s.counters[m.ev] || 0;
  }
  d.claimed = [];
  d.bonusClaimed = false;
  const yesterday = dayKey(now - 86400000);
  d.streak = prev === yesterday ? d.streak + 1 : 1;
  d.loginPending = LOGIN_REWARDS[(d.streak - 1) % LOGIN_REWARDS.length];
}

export function dailyMissions(s) {
  return s.daily.missions.map((id) => {
    const m = DAILY_POOL.find((x) => x.id === id);
    const cur = Math.min(m.n, (s.counters[m.ev] || 0) - (s.daily.base[id] || 0));
    return { ...m, cur, done: cur >= m.n, claimed: s.daily.claimed.includes(id) };
  });
}

export function claimDaily(s, id) {
  const m = dailyMissions(s).find((x) => x.id === id);
  if (!m || !m.done || m.claimed) return fail('Not ready.');
  s.daily.claimed.push(id);
  s.player.gold += DAILY_REWARD_GOLD;
  return ok();
}

export function claimDailyBonus(s) {
  const all = dailyMissions(s);
  if (s.daily.bonusClaimed || !all.length || !all.every((m) => m.claimed)) return fail('Complete all daily missions first.');
  s.daily.bonusClaimed = true;
  giveReward(s, DAILY_BONUS);
  refillEnergy(s);
  return ok();
}

export function claimLogin(s, mult = 1) {
  const r = s.daily.loginPending;
  if (!r) return fail('Nothing to claim.');
  giveReward(s, r, mult);
  s.daily.loginPending = null;
  return ok({ reward: r });
}

// ---------------------------------------------------------------- time
export function tick(s, now = Date.now()) {
  let dt = now - s.lastTick;
  if (dt <= 0) return 0;
  dt = Math.min(dt, CONFIG.offlineCapMs);
  s.lastTick = now;
  const p = s.player;
  const mx = maxEnergy(s);
  if (p.energy < mx) p.energy = Math.min(mx, p.energy + (dt / CONFIG.energyRegenMs) * housingRegen(s, now));
  for (const q in s.housing) {
    if (s.housing[q] <= now) {
      delete s.housing[q];
      toast(`${HOUSES[q].icon} Your ${HOUSES[q].name} has worn out. Buy a new house to keep the bonus.`, 'bad');
    }
  }
  const mr = maxReserve(s);
  if (p.reserve < mr) p.reserve = Math.min(mr, p.reserve + dt / CONFIG.reserveRegenMs);

  for (const c of s.companies) c.pending = Math.min(companyCap(s, c), c.pending + (companyRate(s, c) * dt) / 60000);

  let steps = 0;
  while (s.world.nextAiTick <= now && steps < 40) {
    aiStep(s, s.world.nextAiTick);
    s.world.nextAiTick += CONFIG.aiTickMs;
    steps++;
  }
  if (s.world.nextAiTick <= now) s.world.nextAiTick = now + CONFIG.aiTickMs;
  resolveDueBattles(s, now);

  if (now >= s.politics.nextElection) resolveElection(s, now);
  const sold = s.market.sold;
  if (sold && Object.keys(sold).length) {
    let total = 0;
    const parts = Object.entries(sold).map(([k, v]) => { total += v.m; count(s, 'sale', v.n); return `${v.n.toLocaleString('en-US')} × ${MARKET[k].name}`; });
    toast(`🛒 Citizens bought ${parts.join(', ')} from you (+💰${total.toFixed(2)})`, 'good');
    s.market.sold = {};
  }
  checkDaily(s, now);
  return dt;
}
