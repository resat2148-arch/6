import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../js/game.js';
import { CONFIG, COUNTRIES, rankThreshold, RANKS, superSoldierThreshold } from '../js/data.js';
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

test('damage formula: 10*(1+S/400)*(1+R/5)*(1+FP/100)', () => {
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

test('battle: shooting consumes weapons and energy; hits go straight onto the shared wall', () => {
  const s = fresh();
  G.openFirstFront(s, T0);
  const camp = s.world.campaigns.find((c) => G.playerSide(s, c));
  assert.ok(camp, 'player always has a battle');
  assert.equal(camp.endsAt - camp.started, 5 * 60 * 1000, 'single 5-minute round');
  const setup = G.roundSetup(s, camp.id);
  assert.ok(setup.enemyHp > 0 && setup.endsAt === camp.endsAt);
  const w0 = s.inv.weapon[1];
  const shot = G.shoot(s, 1);
  assert.equal(shot.q, 1);
  assert.equal(s.inv.weapon[1], w0 - 1);
  assert.equal(s.player.energy, 99);
  const side = setup.side === 'att' ? 'dmgAtt' : 'dmgDef';
  const before = camp[side];
  assert.ok(G.battleHit(s, camp.id, 100));
  assert.equal(camp[side] - before, 100 * G.playerBoost(s), 'rookie boost applies to the wall');
  assert.equal(camp.fighters.P, 100);
  const res = G.finishVisit(s, setup, { dmg: 100, kills: 3, headshots: 1 });
  assert.ok(res.money > 0 && res.xp > 0 && res.rp === 10);
  assert.ok(G.campaignById(s, camp.id), 'leaving does not end the battle');
});

test('a battle ends after 5 minutes and the bigger wall takes the region', () => {
  const s = fresh();
  s.politics.president = true;
  const target = borderTargets(s.world, 'TR').find((r) => !s.world.campaigns.some((c) => c.region === r.id));
  const camp = G.declareWar(s, target.id, T0).campaign;
  assert.ok(G.battleHit(s, camp.id, 1e7), 'overwhelming damage from the player');
  const regionId = camp.region;
  G.tick(s, T0 + 4 * 60 * 1000);
  assert.ok(G.campaignById(s, camp.id), 'still running after 4 minutes');
  G.tick(s, T0 + 5 * 60 * 1000 + 1);
  assert.equal(G.campaignById(s, camp.id), undefined, 'over after 5 minutes');
  assert.equal(s.world.regions[regionId].owner, 'TR');
  assert.equal(s.counters.conquest, 1);
  assert.equal(s.counters.roundWin, 1);
  assert.equal(s.medals.battleHero, 1, 'top damage of the battle');
  const r = s.battleResults[0];
  assert.ok(r.won && r.fought && r.id === camp.id);
});

test('a defended region stays when the attacker has less on the wall', () => {
  const s = fresh();
  G.openFirstFront(s, T0);
  let camp = s.world.campaigns.find((c) => G.playerSide(s, c) === 'def');
  if (!camp) {
    s.world.campaigns = s.world.campaigns.filter((c) => !G.playerSide(s, c));
    const mine = s.world.regions.find((r) => r.owner === 'TR' && r.name === 'Marmara');
    const foe = s.world.regions.find((r) => r.owner !== 'TR' && neighborsOf(s.world, mine.id).includes(r.id));
    s.politics.president = false;
    camp = { id: 999, att: foe.owner, def: 'TR', region: mine.id, type: 'war', started: T0, endsAt: T0 + 300000, playerDmg: 0, dmgAtt: 0, dmgDef: 0, baseAtt: 1000, baseDef: 1000, fighters: {} };
    s.world.campaigns.push(camp);
  }
  camp.dmgAtt = 0;
  G.battleHit(s, camp.id, 1e6);
  const regionId = camp.region;
  s.world.campaigns = [camp];
  s.world.nextAiTick = T0 + 1e9;
  G.tick(s, camp.endsAt + 1);
  assert.equal(s.world.regions[regionId].owner, 'TR');
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
  // the player always has a front, unless their occupied homeland is busy with other nations' battles
  assert.ok(s.world.campaigns.some((c) => G.playerSide(s, c) || s.world.regions[c.region].origin === 'ME') || s.world.regions.every((r) => r.owner === 'ME') || !s.world.regions.some((r) => r.origin === 'ME' && r.owner !== 'ME'));
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
  assert.ok(fought || s.feed.some((f) => /conquered|liberated|capitulated|rules all/.test(f.text)) || Object.values(s.nationStats || {}).some((n) => n.won), 'damage reaches campaigns');
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

test('training grounds: build and upgrade facilities from Q1 to Q5', () => {
  const s = fresh();
  assert.equal(G.facilityQ(s, 'weights'), 1);
  assert.equal(G.trainGain(s), 5);
  s.player.gold = 0;
  assert.equal(G.upgradeFacility(s, 'weights').ok, false, 'needs gold');
  s.player.gold = 1000;
  const g0 = s.player.gold;
  const r = G.upgradeFacility(s, 'weights');
  assert.ok(r.ok);
  assert.equal(r.q, 2);
  assert.equal(s.player.gold, g0 - 3);
  assert.equal(G.trainGain(s), 6.3, 'Q2 weights = 5 x 1.25');
  assert.ok(G.upgradeFacility(s, 'special').ok, 'build special forces (Q1)');
  assert.equal(G.facilityQ(s, 'special'), 1);
  for (let i = 0; i < 10; i++) G.upgradeFacility(s, 'special');
  assert.equal(G.facilityQ(s, 'special'), 5, 'capped at Q5');
  assert.equal(G.upgradeFacility(s, 'special').ok, false);
  assert.equal(G.trainGain(s), 6.3 + 22);
  const str = s.player.strength;
  G.train(s);
  assert.equal(s.player.strength, str + 28.3);
});

test('old boolean facilities become qualities; Super Soldier thresholds grow', () => {
  const s = fresh();
  const raw = JSON.parse(JSON.stringify(s));
  raw.facilities = { weights: true, climbing: true, shooting: false, special: false };
  const m = G.migrate(raw, T0);
  assert.deepEqual(m.facilities, { weights: 1, climbing: 1, shooting: 0, special: 0 });
  assert.equal(G.trainGain(m), 7.5);
  const t = [1, 2, 3].map((k) => superSoldierThreshold(k));
  assert.deepEqual(t, [250, 758, 1450]);
  s.player.strengthGained = 700;
  s.player.energy = 100;
  G.train(s);
  assert.equal(s.medals.superSoldier, 1, 'one medal at 705 strength gained, not two');
});

test('country ranking covers every nation and tracks battle records', () => {
  const s = fresh();
  const rows = G.nationRanking(s, 'regions');
  assert.equal(rows.length, COUNTRIES.length);
  assert.equal(rows[0].id, 'RU', 'Russia starts with the most regions');
  assert.ok(rows.find((n) => n.me).citizens >= 2, 'the player counts as a citizen');
  assert.ok(G.nationRank(s, 'regions') >= 1);
  s.politics.president = true;
  const target = borderTargets(s.world, 'TR').find((r) => !s.world.campaigns.some((c) => c.region === r.id));
  const loser = target.owner;
  const camp = G.declareWar(s, target.id, T0).campaign;
  G.battleHit(s, camp.id, 1e7);
  G.tick(s, camp.endsAt + 1);
  assert.equal(s.nationStats.TR.won, 1);
  assert.equal(s.nationStats.TR.conquered, 1);
  assert.equal(s.nationStats[loser].lost, 1);
  for (const by of Object.keys(G.NATION_METRICS)) assert.equal(G.nationRanking(s, by).length, COUNTRIES.length);
});

test('population follows territory: winners grow, losers shrink, migrants move between them', async () => {
  const { populationTarget, populationStep, populationOf, POP_SCALE } = await import('../js/citizens.js');
  assert.ok(populationTarget(1) < populationTarget(7) && populationTarget(7) < populationTarget(16));
  assert.equal(populationTarget(0), POP_SCALE, 'a wiped nation keeps a resistance cell');
  const s = fresh();
  for (const c of COUNTRIES) {
    const regions = s.world.regions.filter((r) => r.owner === c.id).length;
    assert.equal(populationOf(s, c.id), populationTarget(regions), `${c.name} starts at its target`);
  }
  // Turkey takes all of Greece.
  const greek = s.world.regions.filter((r) => r.owner === 'GR');
  greek.forEach((r) => { r.owner = 'TR'; });
  const trTarget = populationTarget(s.world.regions.filter((r) => r.owner === 'TR').length);
  const ids = s.citizens.map((b) => b.id);
  const grPresident = s.citizens.find((b) => b.c === 'GR' && b.pres);
  const news = { budget: 0, feed: () => {} };
  for (let i = 0; i < 40; i++) populationStep(s, news, () => 0);
  assert.equal(populationOf(s, 'TR'), trTarget, 'Turkey grew to its target');
  const before = populationOf(s, 'DE');
  populationStep(s, news, () => 0);
  assert.equal(populationOf(s, 'DE'), before, 'a nation at its target does not change');
  assert.equal(populationOf(s, 'GR'), populationTarget(0), 'Greece shrank to one resistance citizen');
  assert.ok(grPresident && grPresident.c === 'GR', 'the president stays');
  assert.deepEqual(s.citizens.slice(0, ids.length).map((b) => b.id), ids, 'ids stay stable');
  s.citizens.forEach((b, i) => assert.equal(b.id, i));
  assert.ok(s.citizens.some((b) => b.c === 'TR' && b.fem !== undefined));
});

test('five times the citizens: packed saves round-trip and old saves are filled up', async () => {
  const { POP_SCALE, populationTarget, populationOf } = await import('../js/citizens.js');
  assert.equal(POP_SCALE, 5);
  const s = fresh();
  assert.ok(s.citizens.length > 900, `about a thousand citizens (${s.citizens.length})`);
  for (let i = 1; i <= 30; i++) G.tick(s, T0 + i * CONFIG.aiTickMs);
  s.citizens[3].c = null; // someone emigrated: the slot is kept
  const packed = JSON.parse(JSON.stringify(G.packSave(s)));
  assert.ok(!packed.citizens && Array.isArray(packed.cz));
  assert.ok(JSON.stringify(packed).length < JSON.stringify(s).length * 0.75, 'packed save is smaller');
  const back = G.migrate(packed);
  assert.equal(back.citizens.length, s.citizens.length);
  back.citizens.forEach((b, i) => assert.equal(b.id, i));
  const a = s.citizens.find((b) => b.co && b.np) || s.citizens[0];
  const b = back.citizens[a.id];
  for (const k of ['n', 'c', 'p', 'lvl', 'cong', 'pres']) assert.deepEqual(b[k], a[k], k);
  assert.deepEqual(b.co, a.co);
  assert.deepEqual(b.np, a.np);
  assert.ok(Math.abs(b.m - a.m) < 0.01 && Math.abs(b.str - a.str) < 0.1);
  // An old save with the old (1x) population grows to the new size when loaded.
  const old = JSON.parse(JSON.stringify(s));
  delete old.popScale;
  const keep = new Set();
  old.citizens = old.citizens.filter((x) => { if (!x.c || keep.has(x.c)) return false; keep.add(x.c); return true; }).map((x, i) => ({ ...x, id: i }));
  const up = G.migrate(old);
  for (const c of ['DE', 'FR', 'TR']) {
    const regions = up.world.regions.filter((r) => r.owner === c).length;
    assert.equal(populationOf(up, c), populationTarget(regions), `${c} filled to its target`);
  }
  assert.equal(up.popScale, POP_SCALE);
  assert.equal(G.migrate(JSON.parse(JSON.stringify(G.packSave(up)))).citizens.length, up.citizens.length, 'no second fill');
});

test('conquest pace: losing the capital breaks a nation, big nations fight on several fronts', async () => {
  const { neighborsOf: nb, morale } = await import('../js/world.js');
  const s = fresh('TR');
  const w = s.world;
  const cap = w.regions.find((r) => r.origin === 'PL' && r.capital);
  const plBefore = regionsOf(w, 'PL').length;
  w.campaigns = [{ id: 999, att: 'DE', def: 'PL', region: cap.id, type: 'war', started: T0, endsAt: T0 + 1, playerDmg: 0, dmgAtt: 1e12, dmgDef: 0, fighters: {}, baseAtt: 1, baseDef: 1 }];
  s.lastTick = T0;
  s.world.nextAiTick = T0 + 10 * 60000;
  G.tick(s, T0 + 2);
  assert.equal(cap.owner, 'DE', 'the capital fell');
  const left = regionsOf(w, 'PL');
  assert.ok(left.length < plBefore - 1, `more than the capital changed hands (${plBefore} -> ${left.length})`);
  assert.ok(left.every((r) => !nb(w, r.id).some((n) => w.regions[n].owner === 'DE')) || left.length === 0, 'nothing left along the German border');
  assert.ok(morale(w, 'PL') < morale(w, 'DE'), 'broken morale without the capital');
  // A large nation attacks on several fronts at once.
  const t = fresh('TR');
  t.world.regions.forEach((r) => { if (['UA', 'BY', 'FI', 'EE', 'LV', 'LT', 'PL'].includes(r.owner)) r.owner = 'RU'; });
  t.world.aggr = Object.fromEntries(COUNTRIES.map((c) => [c.id, c.id === 'RU' ? 1.65 : 0.35])); // a hungry Russia
  let most = 0;
  for (let i = 1; i <= 60; i++) {
    G.tick(t, T0 + i * CONFIG.aiTickMs);
    most = Math.max(most, t.world.campaigns.filter((c) => c.att === 'RU').length);
  }
  assert.ok(most >= 3, `Russia ran ${most} attacks at once`);
});

test('a nation that rules all of Europe is crowned, then a new era starts', () => {
  const s = fresh('TR');
  const w = s.world;
  w.regions.forEach((r) => { r.owner = 'FR'; });
  w.campaigns = [];
  let now = T0;
  const step = () => { now += CONFIG.aiTickMs; s.lastTick = now - CONFIG.aiTickMs; s.world.nextAiTick = now; G.tick(s, now); };
  step();
  // the player's resistance may break the crown again; keep France on top for the test
  w.campaigns = [];
  w.regions.forEach((r) => { r.owner = 'FR'; });
  step();
  assert.ok(w.domination && w.domination.by === 'FR', 'France is crowned');
  assert.equal(s.nationStats.FR.titles, 1);
  assert.equal(s.eras[0].by, 'FR');
  for (let t = 0; t < CONFIG.newEraDelayMs / CONFIG.aiTickMs + 2 && w.domination; t++) {
    w.campaigns = [];
    w.regions.forEach((r) => { r.owner = 'FR'; });
    step();
  }
  assert.ok(!w.domination, 'a new era began');
  assert.ok(w.regions.every((r) => r.owner === r.origin || w.campaigns.some((c) => c.region === r.id)), 'nations are back within their old borders');
  const sizes = {};
  for (const r of w.regions) sizes[r.owner] = (sizes[r.owner] || 0) + 1;
  assert.ok(Object.keys(sizes).length >= 36, 'every nation is alive again');
  assert.equal(s.nationStats.FR.titles, 1, 'the title stays in the record');
});

test('battle board ranks everyone by damage on the wall, the player included', () => {
  const s = fresh('DE');
  G.openFirstFront(s, T0);
  const c = G.activeFronts(s)[0];
  const side = G.playerSide(s, c);
  const foe = side === 'att' ? c.def : c.att;
  for (let i = 1; i <= 6; i++) G.tick(s, T0 + i * CONFIG.aiTickMs);
  const live = G.campaignById(s, c.id);
  if (!live) return; // the battle ended early in this world
  G.battleHit(s, live.id, 500);
  const bd = G.battleBoard(s, live);
  const mine = bd[side];
  const you = mine.find((r) => r.you);
  assert.ok(you, 'the player is on their side of the board');
  assert.equal(you.dmg, 500 * G.playerBoost(s), 'the player counts what the wall received');
  for (const k of ['att', 'def']) for (let i = 1; i < bd[k].length; i++) assert.ok(bd[k][i - 1].dmg >= bd[k][i].dmg, 'best first');
  assert.ok(bd[side === 'att' ? 'def' : 'att'].every((r) => r.c === foe && !r.you), 'enemies listed on their side');
  assert.ok(mine.filter((r) => !r.you).every((r) => r.c === s.player.country));
});

test('nothing moves while the player is away: every clock resumes where it stopped', () => {
  const s = fresh('DE');
  let now = T0;
  for (let i = 0; i < 25; i++) { now += CONFIG.aiTickMs; G.tick(s, now); }
  s.inv.house[2] = 1;
  G.moveIn(s, 2, now);
  s.timers.lastEnergyAd = now - 1000;
  s.player.energy = 10;
  const left = (t) => t - s.lastTick;
  const snap = () => ({
    owners: s.world.regions.map((r) => r.owner).join(),
    camps: s.world.campaigns.map((c) => `${c.id}:${left(c.endsAt)}`).join(),
    sorties: s.world.campaigns.reduce((a, c) => a + (c.live || []).length, 0),
    nextAi: left(s.world.nextAiTick),
    election: left(s.politics.nextElection),
    house: left(s.housing[2]),
    ad: left(s.timers.lastEnergyAd),
    energy: Math.round(s.player.energy),
    pending: s.companies.map((c) => Math.round(c.pending)).join(),
  });
  const before = snap();
  const away = G.resume(s, now + 3 * 3600 * 1000);
  assert.equal(away, 3 * 3600 * 1000);
  assert.deepEqual(snap(), before, 'three hours away changed nothing');
  // and the game goes on normally afterwards
  G.tick(s, s.lastTick + 500);
  assert.equal(s.world.regions.map((r) => r.owner).join(), before.owners);
  assert.ok(s.player.energy >= 10);
});
