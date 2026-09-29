// World map: real European regions, neighbors, ownership stats.
import { COUNTRIES, FOOD_RES, WEAPON_RES, RESOURCES, RESOURCE_BONUS } from './data.js';
import { EU_REGIONS, EU_NEIGHBORS } from './europe.js';
import { mulberry32, shuffle } from './util.js';

export function createWorld(seed) {
  const rnd = mulberry32(seed);
  const regions = EU_REGIONS.map((r, id) => ({ id, name: r.name, owner: r.c, origin: r.c, res: null, capital: !!r.cap }));
  const foods = shuffle(FOOD_RES, rnd);
  const weps = shuffle(WEAPON_RES, rnd);
  let fi = 0;
  let wi = 0;
  for (const country of COUNTRIES) {
    // Up to two food + two weapon resources per country, alternating.
    const own = shuffle(regions.filter((r) => r.owner === country.id), rnd).slice(0, 4);
    own.forEach((reg, i) => {
      reg.res = i % 2 === 0 ? foods[fi++ % foods.length] : weps[wi++ % weps.length];
    });
  }
  return { regions, campaigns: [], nextCampId: 1, nextAiTick: 0, seed };
}

export const neighborsOf = (world, id) => EU_NEIGHBORS[id];
export const regionsOf = (world, cid) => world.regions.filter((r) => r.owner === cid);

export const isAlive = (world, cid) => world.regions.some((r) => r.owner === cid);

export function countryPower(world, cid) {
  return 1 + 0.08 * regionsOf(world, cid).length;
}

// Regions not owned by `cid` that touch a region owned by `cid`.
export function borderTargets(world, cid) {
  return world.regions.filter(
    (r) => r.owner !== cid && EU_NEIGHBORS[r.id].some((n) => world.regions[n].owner === cid),
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
