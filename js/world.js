// World map: hex regions, neighbors, ownership stats.
import { MAP_ROWS, COUNTRIES, FOOD_RES, WEAPON_RES, RESOURCES, RESOURCE_BONUS, NAME_A, NAME_B } from './data.js';
import { mulberry32, shuffle, pick } from './util.js';

export function createWorld(seed) {
  const rnd = mulberry32(seed);
  const regions = [];
  MAP_ROWS.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch !== '.') regions.push({ id: regions.length, r, c, owner: ch, origin: ch, res: null, name: '', capital: false });
    });
  });

  const used = new Set();
  for (const reg of regions) {
    let name;
    do name = pick(NAME_A, rnd) + pick(NAME_B, rnd);
    while (used.has(name));
    used.add(name);
    reg.name = name;
  }

  const world = { regions, campaigns: [], nextCampId: 1, nextAiTick: 0, seed };
  const idx = indexOf(world);

  for (const country of COUNTRIES) {
    const own = regions.filter((r) => r.owner === country.id);
    // Capital = region with the most same-owner neighbors.
    let best = own[0];
    let bestN = -1;
    for (const reg of own) {
      const n = idx.neighbors[reg.id].filter((id) => regions[id].owner === country.id).length;
      if (n > bestN) { best = reg; bestN = n; }
    }
    best.capital = true;
    // Two food + two weapon resources per country, spread randomly.
    const pool = shuffle(own.filter((r) => !r.capital), rnd);
    const foods = shuffle(FOOD_RES, rnd);
    const weps = shuffle(WEAPON_RES, rnd);
    if (pool[0]) pool[0].res = foods[0];
    if (pool[1]) pool[1].res = weps[0];
    if (pool[2]) pool[2].res = foods[1];
    if (pool[3]) pool[3].res = weps[1];
  }
  return world;
}

const indexCache = new WeakMap();

export function indexOf(world) {
  let idx = indexCache.get(world.regions);
  if (idx) return idx;
  const byPos = new Map(world.regions.map((r) => [r.r + ',' + r.c, r.id]));
  const neighbors = world.regions.map((reg) => {
    const odd = reg.r & 1;
    const d = odd
      ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]]
      : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
    return d.map(([dr, dc]) => byPos.get(reg.r + dr + ',' + (reg.c + dc))).filter((x) => x !== undefined);
  });
  idx = { neighbors };
  indexCache.set(world.regions, idx);
  return idx;
}

export const neighborsOf = (world, id) => indexOf(world).neighbors[id];

export const regionsOf = (world, cid) => world.regions.filter((r) => r.owner === cid);

export const isAlive = (world, cid) => world.regions.some((r) => r.owner === cid);

export function countryPower(world, cid) {
  return 1 + 0.08 * regionsOf(world, cid).length;
}

// Regions not owned by `cid` that touch a region owned by `cid`.
export function borderTargets(world, cid) {
  const idx = indexOf(world);
  return world.regions.filter(
    (r) => r.owner !== cid && idx.neighbors[r.id].some((n) => world.regions[n].owner === cid),
  );
}

export function distinctResources(world, cid, kind) {
  const set = new Set();
  for (const r of world.regions) if (r.owner === cid && r.res && RESOURCES[r.res].kind === kind) set.add(r.res);
  return [...set];
}

export function resourceBonus(world, cid, kind) {
  return 1 + RESOURCE_BONUS * distinctResources(world, cid, kind).length;
}
