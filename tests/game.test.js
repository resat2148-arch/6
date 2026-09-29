import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../js/game.js';
import { CONFIG, COUNTRIES, MAP_ROWS, rankThreshold, RANKS } from '../js/data.js';
import { createWorld, neighborsOf, regionsOf, borderTargets } from '../js/world.js';

const T0 = 1_700_000_000_000;
const fresh = (country = 'A') => G.newGame({ name: 'Tester', country, now: T0, seed: 42 });

test('world: every region is reachable and each country has a capital + resources', () => {
  const w = createWorld(7);
  const land = MAP_ROWS.join('').replace(/\./g, '').length;
  assert.equal(w.regions.length, land);
  const seen = new Set([0]);
  const q = [0];
  while (q.length) for (const n of neighborsOf(w, q.shift())) if (!seen.has(n)) { seen.add(n); q.push(n); }
  assert.equal(seen.size, w.regions.length, 'map must be connected');
  for (const c of COUNTRIES) {
    const own = regionsOf(w, c.id);
    assert.ok(own.length >= 8, `${c.name} too small`);
    assert.equal(own.filter((r) => r.capital).length, 1);
    assert.equal(own.filter((r) => r.res).length, 4);
    assert.ok(borderTargets(w, c.id).length > 0);
  }
  assert.equal(new Set(w.regions.map((r) => r.name)).size, w.regions.length, 'unique names');
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
    const target = borderTargets(s.world, 'A')[0];
    camp = G.declareWar(s, target.id, T0 + 30000).campaign;
  }
  const regionId = camp.region;
  for (let i = 0; i < 3; i++) {
    const setup = G.roundSetup(s, camp.id);
    G.finishRound(s, setup, { dmg: 1000, kills: 5, headshots: 0, won: true }, T0 + 40000 + i);
  }
  assert.equal(s.world.regions[regionId].owner, 'A');
  assert.equal(G.campaignById(s, camp.id), undefined);
  assert.equal(s.counters.conquest, 1);
});

test('world simulation keeps running and never breaks invariants', () => {
  const s = fresh('C');
  for (let i = 1; i <= 400; i++) G.tick(s, T0 + i * CONFIG.aiTickMs);
  const regionsInBattle = s.world.campaigns.map((c) => c.region);
  assert.equal(new Set(regionsInBattle).size, regionsInBattle.length, 'one battle per region');
  for (const c of s.world.campaigns) {
    assert.notEqual(c.att, c.def);
    assert.equal(s.world.regions[c.region].owner, c.def);
  }
  assert.ok(s.world.campaigns.some((c) => G.playerSide(s, c)) || s.world.regions.every((r) => r.owner === 'C'));
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

test('elections: winning congress awards medal', () => {
  const s = fresh();
  s.player.level = 10;
  s.player.money = 1000;
  assert.equal(G.runFor(s, 'congress').ok, false, 'needs party');
  assert.ok(G.joinParty(s).ok);
  assert.ok(G.runFor(s, 'congress').ok);
  const rnd = Math.random;
  Math.random = () => 0;
  try { G.tick(s, s.politics.nextElection); } finally { Math.random = rnd; }
  assert.equal(s.politics.congress, true);
  assert.equal(s.medals.congressMember, 1);
  assert.equal(s.politics.electionType, 'president');
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
