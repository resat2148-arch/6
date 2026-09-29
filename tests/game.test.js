import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../js/game.js';
import { CONFIG, COUNTRIES, rankThreshold, RANKS } from '../js/data.js';
import { EU_REGIONS } from '../js/europe.js';
import { createWorld, neighborsOf, regionsOf, borderTargets } from '../js/world.js';

const T0 = 1_700_000_000_000;
const fresh = (country = 'TR') => G.newGame({ name: 'Tester', country, now: T0, seed: 42 });

test('world: real Europe map is connected, every country has one capital', () => {
  const w = createWorld(7);
  assert.equal(w.regions.length, EU_REGIONS.length);
  const seen = new Set([0]);
  const q = [0];
  while (q.length) for (const n of neighborsOf(w, q.shift())) if (!seen.has(n)) { seen.add(n); q.push(n); }
  assert.equal(seen.size, w.regions.length, 'map must be connected');
  for (let i = 0; i < w.regions.length; i++) for (const n of neighborsOf(w, i)) assert.ok(neighborsOf(w, n).includes(i), 'symmetric');
  assert.ok(COUNTRIES.length >= 35);
  for (const c of COUNTRIES) {
    const own = regionsOf(w, c.id);
    assert.ok(own.length >= 1, `${c.name} has regions`);
    assert.equal(own.filter((r) => r.capital).length, 1, `${c.name} capital`);
    assert.equal(own.filter((r) => r.res).length, Math.min(4, own.length));
    assert.ok(borderTargets(w, c.id).length > 0, `${c.name} has a border`);
  }
  const tr = regionsOf(w, 'TR').map((r) => r.name);
  assert.ok(tr.includes('Marmara') && tr.includes('Central Anatolia'));
});

test('old v1 saves are rejected instead of loading a broken map', () => {
  const s = fresh();
  const raw = JSON.parse(JSON.stringify(s));
  raw.v = 1;
  assert.equal(G.migrate(raw, T0), null);
});

test('world generation is deterministic per seed', () => {
  assert.deepEqual(createWorld(99).regions, createWorld(99).regions);
});

test('work / train consume energy and reward the player', () => {
  const s = fresh();
  const m0 = s.player.money;
  assert.ok(G.work(s).ok);
  assert.equal(s.player.energy, 90);
  assert.ok(s.player.money > m0);
  assert.ok(G.train(s).ok);
  assert.equal(s.player.strength, 105);
  s.player.energy = 5;
  assert.equal(G.work(s).ok, false);
  assert.equal(G.train(s).ok, false);
});

test('eat converts reserve into energy using food', () => {
  const s = fresh();
  s.player.energy = 40;
  const r = G.eat(s);
  assert.ok(r.ok);
  assert.equal(Math.round(s.player.energy), 100);
  assert.equal(Math.round(s.player.reserve), 240);
  assert.equal(s.inv.food[1], 34);
  assert.equal(G.eat(s).ok, false, 'already full');
  s.player.energy = 0;
  s.player.reserve = 0;
  assert.equal(G.eat(s).ok, false, 'no reserve');
});

test('damage formula follows eRepublik: 10*(1+S/400)*(1+R/5)*(1+FP/100)', () => {
  const s = fresh();
  assert.equal(G.hitDamage(s, 0), 10 * 1.25 * 1 * 0.5);
  assert.equal(G.hitDamage(s, 5), 10 * 1.25 * 1 * 2);
  s.player.rankPoints = rankThreshold(5);
  assert.equal(G.rankIndex(s.player.rankPoints), 5);
  assert.equal(G.hitDamage(s, 1), 10 * 1.25 * 2 * 1.2);
  assert.equal(RANKS[0], 'Recruit');
});

test('level up grants gold and refills energy', () => {
  const s = fresh();
  s.player.energy = 0;
  const g0 = s.player.gold;
  G.addXp(s, G.xpToNext(1));
  assert.equal(s.player.level, 2);
  assert.equal(s.player.gold, g0 + 1);
  assert.equal(s.player.energy, G.maxEnergy(s));
});

test('market buy/sell and gold exchange', () => {
  const s = fresh();
  s.player.money = 100;
  assert.ok(G.buy(s, 'weapon2', 10).ok);
  assert.equal(s.inv.weapon[2], 10);
  assert.ok(G.sell(s, 'weapon2', 10).ok);
  assert.equal(s.inv.weapon[2], 0);
  assert.equal(G.sell(s, 'weapon2', 1).ok, false);
  assert.equal(G.buyGold(s).ok, false);
  s.player.money = 500;
  assert.ok(G.buyGold(s).ok);
  assert.equal(s.player.gold, 6);
});

test('companies produce over time and factories convert raw', () => {
  const s = fresh();
  s.player.money = 10000;
  assert.ok(G.build(s, 'farm').ok);
  assert.ok(G.build(s, 'bakery').ok);
  assert.equal(G.build(s, 'mine').ok, false, 'slot limit at level 1');
  G.tick(s, T0 + 10 * 60000);
  const food0 = s.inv.food[1];
  const r = G.collectAll(s);
  assert.ok(r.ok);
  assert.ok(s.inv.food[1] > food0, 'bakery produced food');
  assert.ok(s.inv.foodRaw > 0, 'leftover raw');
  // storage cap
  G.tick(s, T0 + 100 * 3600000);
  for (const c of s.companies) assert.ok(c.pending <= G.companyCap(s, c) + 1e-6);
});

test('battle round: shooting consumes weapons and energy, finishing updates campaign', () => {
  const s = fresh();
  G.tick(s, T0 + CONFIG.aiTickMs + 1);
  const camp = s.world.campaigns.find((c) => G.playerSide(s, c));
  assert.ok(camp, 'player always has a campaign');
  const setup = G.roundSetup(s, camp.id);
  assert.ok(setup.enemyHp > 0 && setup.enemyDps > 0);
  const w0 = s.inv.weapon[1];
  const shot = G.shoot(s, 1);
  assert.equal(shot.q, 1);
  assert.equal(s.inv.weapon[1], w0 - 1);
  assert.equal(s.player.energy, 99);
  const res = G.finishRound(s, setup, { dmg: 5000, kills: 30, headshots: 5, won: true }, T0 + 60000);
  assert.ok(res.money > 0 && res.xp > 0);
  const c2 = G.campaignById(s, camp.id);
  const wins = setup.side === 'att' ? c2.attWins : c2.defWins;
  assert.equal(wins, 1);
});

test('winning 3 rounds conquers the region', () => {
  const s = fresh();
  G.tick(s, T0 + CONFIG.aiTickMs + 1);
  let camp = s.world.campaigns.find((c) => G.playerSide(s, c) === 'att');
  if (!camp) {
    s.world.campaigns = s.world.campaigns.filter((c) => !G.playerSide(s, c));
    s.politics.president = true;
    const target = borderTargets(s.world, 'TR')[0];
    camp = G.declareWar(s, target.id, T0 + 30000).campaign;
  }
  const regionId = camp.region;
  for (let i = 0; i < 3; i++) {
    const setup = G.roundSetup(s, camp.id);
    G.finishRound(s, setup, { dmg: 1000, kills: 5, headshots: 0, won: true }, T0 + 40000 + i);
  }
  assert.equal(s.world.regions[regionId].owner, 'TR');
  assert.equal(G.campaignById(s, camp.id), undefined);
  assert.equal(s.counters.conquest, 1);
});

test('world simulation keeps running and never breaks invariants', () => {
  const s = fresh('ME');
  for (let i = 1; i <= 400; i++) G.tick(s, T0 + i * CONFIG.aiTickMs);
  const regionsInBattle = s.world.campaigns.map((c) => c.region);
  assert.equal(new Set(regionsInBattle).size, regionsInBattle.length, 'one battle per region');
  for (const c of s.world.campaigns) {
    assert.notEqual(c.att, c.def);
    assert.equal(s.world.regions[c.region].owner, c.def);
  }
  assert.ok(s.world.campaigns.some((c) => G.playerSide(s, c)) || s.world.regions.every((r) => r.owner === 'ME') || !s.world.regions.some((r) => r.origin === 'ME' && r.owner !== 'ME'));
});

test('tutorial progresses and pays rewards', () => {
  const s = fresh();
  assert.equal(G.claimTutorial(s).ok, false);
  G.work(s);
  const m = s.player.money;
  assert.ok(G.claimTutorial(s).ok);
  assert.equal(s.player.money, m + 20);
  assert.equal(s.tutorial.step, 1);
});

test('daily missions reset per day and login streak grows', () => {
  const s = fresh();
  G.tick(s, T0 + 1000);
  assert.equal(s.daily.missions.length, 4);
  assert.equal(s.daily.streak, 1);
  assert.ok(G.claimLogin(s).ok);
  G.tick(s, T0 + 86400000 + 1000);
  assert.equal(s.daily.streak, 2);
  assert.ok(s.daily.loginPending);
});

test('elections: AI candidates run, seats fill, a popular player wins', () => {
  const s = fresh();
  s.player.level = 10;
  s.player.money = 1000;
  assert.equal(G.runFor(s, 'congress').ok, false, 'needs party');
  assert.ok(G.joinParty(s).ok);
  assert.ok(G.runFor(s, 'congress').ok);
  s.politics.news = { name: 'Test Times', subs: 100000, articles: 0 };
  assert.ok(G.winChance(s, 'congress') > 0.9);
  G.tick(s, s.politics.nextElection);
  const res = s.politics.lastResult;
  assert.equal(res.type, 'congress');
  assert.ok(res.rows.length > res.seats, 'more candidates than seats');
  assert.equal(res.rows.filter((r) => r.won).length, res.seats);
  assert.equal(s.politics.congress, true);
  assert.equal(s.medals.congressMember, 1);
  assert.equal(G.congressOf(s).length, res.seats - 1, 'other seats go to AI citizens');
  // Presidential election: AI congress members compete.
  G.tick(s, s.politics.nextElection);
  assert.equal(s.politics.lastResult.type, 'president');
  const presBots = s.citizens.filter((b) => b.c === 'TR' && b.pres);
  assert.ok(presBots.length === 1 && s.politics.presidentName === presBots[0].n, 'an AI citizen governs');
  assert.ok(Object.keys(s.presidents).length >= 30, 'foreign nations elected presidents');
});

test('elections: an unknown candidate loses to strong rivals and loses the seat', () => {
  const s = fresh();
  s.politics.party = true;
  s.politics.congress = true;
  s.player.level = 8;
  s.player.money = 1000;
  for (const b of s.citizens.filter((x) => x.c === 'TR')) { b.lvl = 30; b.amb = 1; b.np = { name: 'X', subs: 5000, articles: 0 }; }
  assert.ok(G.winChance(s, 'congress') < 0.1);
  G.tick(s, s.politics.nextElection);
  assert.equal(s.politics.congress, false, 'did not run again: seat lost');
});

test('press: citizens publish, player articles and votes', () => {
  const s = fresh();
  assert.ok(s.citizens.some((b) => b.np), 'some citizens own newspapers');
  for (let i = 1; i <= 30; i++) G.tick(s, T0 + i * CONFIG.aiTickMs);
  assert.ok(s.articles.length > 0, 'citizens published');
  const a = s.articles.find((x) => x.a !== 'P');
  assert.ok(a.title.length > 5);
  assert.ok(G.voteArticle(s, a.id).ok);
  assert.equal(G.voteArticle(s, a.id).ok, false, 'one vote per article');
  s.player.level = 5;
  s.player.gold = 10;
  assert.ok(G.createNewspaper(s, 'Daily Test').ok);
  assert.ok(G.writeArticle(s, 'Hello Europe', T0 + 99 * CONFIG.aiTickMs).ok);
  assert.equal(s.articles[0].title, 'Hello Europe');
  assert.equal(s.articles[0].a, 'P');
});

test('save migration keeps progress and fills new fields', () => {
  const s = fresh();
  s.player.money = 1234;
  const raw = JSON.parse(JSON.stringify(s));
  delete raw.timers;
  const m = G.migrate(raw, T0);
  assert.equal(m.player.money, 1234);
  assert.ok(m.timers);
  assert.equal(G.migrate(null), null);
});

test('houses raise max energy and regen, stack by quality and expire', () => {
  const s = fresh();
  assert.equal(G.moveIn(s, 1, T0).ok, false, 'must own a house');
  s.player.money = 1000;
  assert.ok(G.buy(s, 'house2', 1).ok);
  s.inv.house[1] = 1;
  assert.ok(G.moveIn(s, 2, T0).ok);
  assert.ok(G.moveIn(s, 1, T0).ok);
  G.tick(s, T0 + 1000);
  assert.equal(G.maxEnergy(s), 100 + 20 + 40);
  assert.ok(Math.abs(G.housingRegen(s) - 1.3) < 1e-9);
  s.player.energy = 0;
  G.tick(s, T0 + 1000 + CONFIG.energyRegenMs * 10);
  assert.ok(Math.abs(s.player.energy - 13) < 1e-6, 'regen is 30% faster');
  G.tick(s, T0 + CONFIG.houseDurationMs + 5000);
  assert.equal(G.activeHouses(s).length, 0);
  assert.equal(G.maxEnergy(s), 100);
});

test('construction company turns building materials into houses', () => {
  const s = fresh();
  s.player.money = 100000;
  s.player.level = 3;
  assert.ok(G.build(s, 'quarry').ok);
  assert.ok(G.build(s, 'construction').ok);
  G.tick(s, T0 + 60 * 60000);
  assert.ok(G.collectAll(s).ok);
  assert.equal(s.inv.house[1], 6, '0.1 houses/min for an hour');
  assert.equal(s.inv.houseRaw, 3600 - 600);
});

test('AI citizens live, fight, produce and trade', () => {
  const s = fresh();
  assert.ok(s.citizens.length > 150);
  for (const c of COUNTRIES) assert.ok(s.citizens.some((b) => b.c === c.id), `${c.name} has citizens`);
  assert.ok(s.citizens.every((b) => b.n && b.n.includes(' ')));
  assert.ok(s.market.offers.length > 50, 'market seeded with offers');
  const str0 = s.citizens.reduce((a, b) => a + b.str, 0);
  for (let i = 1; i <= 60; i++) G.tick(s, T0 + i * CONFIG.aiTickMs);
  assert.ok(s.citizens.reduce((a, b) => a + b.str, 0) > str0, 'citizens train');
  assert.ok(s.citizens.some((b) => b.dmg > 0), 'citizens fight');
  const fought = s.world.campaigns.some((c) => Object.keys(c.fighters || {}).length);
  assert.ok(fought || s.feed.some((f) => /conquered|liberated/.test(f.text)), 'damage reaches campaigns');
  for (const kind of ['food', 'weapon']) {
    assert.ok([1, 2, 3, 4, 5].some((q) => G.offersFor(s, kind + q).length > 0), `some ${kind} on offer`);
  }
  assert.ok(G.offersFor(s, 'foodRaw').length + G.offersFor(s, 'weaponRaw').length > 0, 'raw materials on offer');
});

test('buying takes the cheapest offer and pays the citizen seller', () => {
  const s = fresh();
  s.player.money = 1000;
  const best = G.offersFor(s, 'weapon1')[0];
  const seller = s.citizens[best.seller];
  const m0 = seller.m;
  const r = G.buy(s, 'weapon1', 5);
  assert.ok(r.ok);
  assert.ok(Math.abs(r.cost - best.price * 5) < 1e-9);
  assert.ok(Math.abs(seller.m - m0 - best.price * 5) < 1e-9);
  s.market.offers = [];
  const imp = G.buy(s, 'weapon1', 10);
  assert.ok(imp.ok, 'state import when the order book is empty');
  assert.ok(Math.abs(imp.cost - G.importPrice('weapon1') * 10) < 1e-9);
});

test('player offers are bought by citizens; cancelling returns goods', () => {
  const s = fresh();
  s.inv.food[2] = 500;
  assert.ok(G.postOffer(s, 'food2', 400, 0.05).ok);
  assert.equal(s.inv.food[2], 100);
  const m0 = s.player.money;
  for (let i = 1; i <= 15; i++) G.tick(s, T0 + i * CONFIG.aiTickMs);
  assert.ok(s.player.money > m0, 'citizens bought the cheap offer');
  assert.ok((s.counters.sale || 0) > 0);
  const left = G.myOffers(s)[0];
  if (left) {
    const q = left.qty;
    assert.ok(G.cancelOffer(s, left.id).ok);
    assert.equal(s.inv.food[2], 100 + q);
  }
  assert.equal(G.postOffer(s, 'food2', 99999, 1).ok, false);
});

test('saves from the fictional-map version keep the citizen progress', () => {
  const old = JSON.parse(JSON.stringify(fresh()));
  old.v = 1;
  old.player.country = 'A';
  old.player.level = 12;
  old.player.money = 4321;
  old.player.strength = 900;
  old.inv.weapon[3] = 77;
  old.companies = [{ id: 1, type: 'farm', q: 1, lvl: 3, pending: 0 }];
  old.medals = { hardWorker: 2 };
  assert.ok(G.isLegacySave(old));
  assert.equal(G.migrate(old, T0), null, 'not loaded as-is');
  const s = G.upgradeLegacy(old, 'PL', T0);
  assert.equal(s.player.country, 'PL');
  assert.equal(s.player.level, 12);
  assert.equal(s.player.money, 4321);
  assert.equal(s.player.strength, 900);
  assert.equal(s.inv.weapon[3], 77);
  assert.equal(s.companies[0].lvl, 3);
  assert.equal(s.medals.hardWorker, 2);
  assert.equal(s.v, G.migrate(s, T0).v, 'upgraded save loads normally');
});
