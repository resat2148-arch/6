// Elections with AI candidates. Congress: the most voted candidates take the country's seats.
// President: Congress members run; the winner governs until the next presidential election.
import { COUNTRIES } from './data.js';
import { regionsOf } from './world.js';
import { botPopularity } from './press.js';
import { clamp } from './util.js';

export const CAMPAIGN_COST = { congress: 100, president: 500 };

export function congressSeats(s, cid) {
  const people = s.citizens.filter((b) => b.c === cid).length;
  return Math.max(1, Math.min(clamp(2 + Math.floor(regionsOf(s.world, cid).length / 3), 2, 6), Math.floor(people * 0.6)));
}
const electorate = (s, cid) => 300 + 200 * regionsOf(s.world, cid).length;
const ambition = (b) => botPopularity(b) * (0.5 + b.amb);

// AI candidates for the player's country (plus the player when running).
export function candidates(s, type, cid, playerPop, withPlayer) {
  const bots = s.citizens.filter((b) => b.c === cid && b.amb !== undefined);
  let pool;
  if (type === 'congress') {
    const seats = congressSeats(s, cid);
    const sorted = bots.sort((a, b) => ambition(b) - ambition(a));
    pool = sorted.filter((b) => b.lvl >= 5).slice(0, seats + 3);
    if (pool.length < seats + 2) pool = sorted.slice(0, seats + 3);
  } else {
    pool = bots.filter((b) => b.cong).sort((a, b) => ambition(b) - ambition(a)).slice(0, 3);
    if (!pool.length) pool = bots.sort((a, b) => ambition(b) - ambition(a)).slice(0, 2);
  }
  const list = pool.map((b) => ({ id: b.id, pop: botPopularity(b) }));
  if (withPlayer) list.push({ id: 'P', pop: playerPop });
  return list;
}

export function vote(s, cid, cands, rnd = Math.random) {
  // Campaign luck: a strong election day can beat a bigger name.
  const weights = cands.map((c) => Math.max(5, c.pop) * (0.45 + rnd() * 1.1));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const voters = electorate(s, cid);
  return cands
    .map((c, i) => ({ id: c.id, pop: c.pop, votes: Math.round((weights[i] / total) * voters) }))
    .sort((a, b) => b.votes - a.votes);
}

// Share of simulated elections the player would win right now.
export function estimateChance(s, type, playerPop, runs = 150) {
  const cid = s.player.country;
  const cands = candidates(s, type, cid, playerPop, true);
  const seats = type === 'congress' ? congressSeats(s, cid) : 1;
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    const rows = vote(s, cid, cands);
    if (rows.slice(0, seats).some((r) => r.id === 'P')) wins++;
  }
  return wins / runs;
}

// Presidents of all AI nations (the player's country is handled by its own election).
export function electForeignPresidents(s) {
  const out = [];
  for (const c of COUNTRIES) {
    if (c.id === s.player.country) continue;
    const bots = s.citizens.filter((b) => b.c === c.id);
    if (!bots.length) continue;
    bots.forEach((b) => { b.pres = false; });
    const rows = vote(s, c.id, bots.sort((a, b) => ambition(b) - ambition(a)).slice(0, 3).map((b) => ({ id: b.id, pop: botPopularity(b) })));
    const w = s.citizens[rows[0].id];
    w.pres = true;
    s.presidents[c.id] = w.id;
    out.push(w);
  }
  return out;
}

// Seats a congress for every nation without holding an election (new game).
export function seatInitialGovernments(s) {
  for (const c of COUNTRIES) {
    const bots = s.citizens.filter((b) => b.c === c.id).sort((a, b) => ambition(b) - ambition(a));
    bots.slice(0, congressSeats(s, c.id)).forEach((b) => { b.cong = true; });
    if (bots[0]) { bots[0].pres = true; s.presidents[c.id] = bots[0].id; }
  }
}
