// Generates js/europe.js: projected Europe map with real countries split into real regions.
// Country borders come from Natural Earth (world-atlas, 1:50m). Each country is divided into
// regions by clipping a Voronoi diagram of real regional centres to the country's shape.
// Usage: npm i --no-save world-atlas topojson-client topojson-simplify d3-geo d3-delaunay polygon-clipping
//        node scripts/build-map.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { feature, mesh } from 'topojson-client';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { geoConicConformal, geoPath } from 'd3-geo';
import { Delaunay } from 'd3-delaunay';
import polygonClipping from 'polygon-clipping';

const root = new URL('..', import.meta.url).pathname;
const topo = JSON.parse(readFileSync(root + 'node_modules/world-atlas/countries-50m.json', 'utf8'));

// [id, name, Natural Earth names, preferred color, regions [name, lon, lat, capital?]]
const COUNTRIES = [
  ['PT', 'Portugal', ['Portugal'], '#16a34a', [['Norte', -8.1, 41.6], ['Centro', -7.9, 40.2], ['Lisbon', -8.8, 38.9, 1], ['Alentejo', -7.9, 38.0]]],
  ['ES', 'Spain', ['Spain'], '#f59e0b', [['Galicia', -7.9, 42.8], ['Basque Country', -2.4, 42.9], ['Catalonia', 1.5, 41.8], ['Aragon', -0.7, 41.4],
    ['Castile and León', -4.8, 41.8], ['Madrid', -3.7, 40.4, 1], ['Castilla-La Mancha', -2.6, 39.3], ['Valencia', -0.6, 39.2], ['Extremadura', -6.2, 39.2], ['Andalusia', -4.6, 37.4]]],
  ['FR', 'France', ['France'], '#2563eb', [['Brittany', -3.0, 48.1], ['Normandy', 0.1, 49.1], ['Île-de-France', 2.5, 48.7, 1], ['Hauts-de-France', 2.8, 50.0],
    ['Grand Est', 5.6, 48.7], ['Pays de la Loire', -0.8, 47.4], ['Centre-Val de Loire', 1.7, 47.4], ['Burgundy', 4.8, 47.2], ['Nouvelle-Aquitaine', 0.0, 45.0],
    ['Auvergne-Rhône-Alpes', 4.5, 45.5], ['Occitanie', 2.0, 43.7], ['Provence', 6.0, 43.9], ['Corsica', 9.1, 42.15]]],
  ['GB', 'United Kingdom', ['United Kingdom'], '#b91c1c', [['Scotland', -4.2, 56.8], ['Northern Ireland', -6.7, 54.6], ['North England', -2.0, 54.3],
    ['Wales', -3.7, 52.3], ['Midlands', -1.5, 52.6], ['London', -0.4, 51.4, 1], ['South West England', -3.6, 50.8]]],
  ['IE', 'Ireland', ['Ireland'], '#22c55e', [['Leinster', -6.9, 53.2, 1], ['Munster', -8.6, 52.3], ['Connacht', -8.8, 53.8]]],
  ['BE', 'Belgium', ['Belgium'], '#eab308', [['Flanders', 4.0, 51.0, 1], ['Wallonia', 5.0, 50.3]]],
  ['NL', 'Netherlands', ['Netherlands'], '#ea580c', [['Holland', 4.6, 52.2, 1], ['Brabant', 5.3, 51.6], ['Groningen', 6.6, 53.1]]],
  ['DE', 'Germany', ['Germany'], '#475569', [['Schleswig-Holstein', 9.7, 54.2], ['Lower Saxony', 9.3, 52.7], ['Mecklenburg', 12.4, 53.7], ['Berlin-Brandenburg', 13.4, 52.4, 1],
    ['North Rhine-Westphalia', 7.5, 51.4], ['Hesse', 9.0, 50.6], ['Saxony', 13.3, 51.0], ['Thuringia', 11.0, 50.9], ['Rhineland-Palatinate', 7.3, 49.9],
    ['Baden-Württemberg', 9.0, 48.5], ['Bavaria', 11.5, 48.9]]],
  ['CH', 'Switzerland', ['Switzerland'], '#dc2626', [['Romandy', 6.7, 46.6], ['Bern', 7.8, 46.8, 1], ['Zurich', 9.0, 47.35]]],
  ['AT', 'Austria', ['Austria'], '#e11d48', [['Vienna', 16.0, 48.2, 1], ['Tyrol', 11.3, 47.1], ['Styria', 15.0, 47.2]]],
  ['IT', 'Italy', ['Italy', 'San Marino', 'Vatican'], '#16a34a', [['Piedmont', 7.8, 45.0], ['Lombardy', 9.8, 45.6], ['Veneto', 12.0, 45.7], ['Emilia-Romagna', 11.0, 44.5],
    ['Tuscany', 11.1, 43.4], ['Lazio', 12.8, 41.9, 1], ['Campania', 14.8, 40.9], ['Apulia', 16.6, 40.9], ['Calabria', 16.3, 39.0], ['Sicily', 14.1, 37.5], ['Sardinia', 9.0, 40.0]]],
  ['DK', 'Denmark', ['Denmark'], '#be123c', [['Jutland', 9.2, 56.2], ['Zealand', 11.8, 55.4, 1]]],
  ['NO', 'Norway', ['Norway'], '#b91c1c', [['Eastern Norway', 10.5, 60.5, 1], ['Western Norway', 6.5, 60.9], ['Trøndelag', 11.0, 63.5], ['Northern Norway', 14.5, 66.4]]],
  ['SE', 'Sweden', ['Sweden'], '#2563eb', [['Scania', 13.5, 55.9], ['Götaland', 14.0, 57.6], ['Svealand', 16.0, 59.6, 1], ['Norrland', 15.5, 63.0], ['Norrbotten', 20.5, 66.5]]],
  ['FI', 'Finland', ['Finland', 'Åland'], '#0ea5e9', [['Uusimaa', 25.0, 60.5, 1], ['Western Finland', 23.0, 62.4], ['Eastern Finland', 28.5, 62.5], ['Lapland', 26.0, 67.5]]],
  ['EE', 'Estonia', ['Estonia'], '#0284c7', [['Harju', 24.8, 59.2, 1], ['Tartu', 26.6, 58.3]]],
  ['LV', 'Latvia', ['Latvia'], '#9f1239', [['Riga', 24.1, 56.9, 1], ['Latgale', 27.0, 56.4]]],
  ['LT', 'Lithuania', ['Lithuania'], '#ca8a04', [['Vilnius', 25.2, 54.8, 1], ['Samogitia', 22.5, 55.7]]],
  ['PL', 'Poland', ['Poland'], '#e11d48', [['Pomerania', 18.0, 54.1], ['West Pomerania', 15.2, 53.5], ['Greater Poland', 17.0, 52.3], ['Masovia', 21.0, 52.3, 1],
    ['Podlaskie', 22.9, 53.3], ['Silesia', 17.8, 50.5], ['Lesser Poland', 20.3, 49.9], ['Lublin', 22.9, 51.2]]],
  ['CZ', 'Czechia', ['Czechia'], '#1d4ed8', [['Bohemia', 14.0, 49.9, 1], ['Moravia', 17.0, 49.4]]],
  ['SK', 'Slovakia', ['Slovakia'], '#4f46e5', [['Western Slovakia', 17.8, 48.3, 1], ['Eastern Slovakia', 21.0, 48.8]]],
  ['HU', 'Hungary', ['Hungary'], '#15803d', [['Central Hungary', 19.4, 47.5, 1], ['Transdanubia', 17.5, 46.9], ['Great Plain', 20.9, 46.9]]],
  ['SI', 'Slovenia', ['Slovenia'], '#0d9488', [['Slovenia', 14.8, 46.1, 1]]],
  ['HR', 'Croatia', ['Croatia'], '#dc2626', [['Zagreb', 16.0, 45.8, 1], ['Dalmatia', 16.3, 43.6], ['Slavonia', 18.2, 45.4]]],
  ['BA', 'Bosnia and Herzegovina', ['Bosnia and Herz.'], '#1e40af', [['Bosnia', 17.9, 44.4, 1], ['Herzegovina', 17.8, 43.3]]],
  ['RS', 'Serbia', ['Serbia'], '#9f1239', [['Vojvodina', 19.9, 45.3], ['Belgrade', 20.6, 44.3, 1], ['South Serbia', 21.8, 43.3]]],
  ['ME', 'Montenegro', ['Montenegro'], '#a16207', [['Montenegro', 19.3, 42.8, 1]]],
  ['MK', 'North Macedonia', ['Macedonia'], '#f97316', [['North Macedonia', 21.7, 41.6, 1]]],
  ['AL', 'Albania', ['Albania'], '#991b1b', [['Albania', 20.0, 41.2, 1]]],
  ['GR', 'Greece', ['Greece'], '#0ea5e9', [['Thrace', 25.5, 41.1], ['Thessaloniki', 22.9, 40.7], ['Epirus', 20.8, 39.6], ['Thessaly', 22.2, 39.5],
    ['Attica', 23.7, 38.1, 1], ['Peloponnese', 22.2, 37.5], ['Crete', 24.9, 35.2]]],
  ['BG', 'Bulgaria', ['Bulgaria'], '#16a34a', [['Sofia', 23.3, 42.7, 1], ['Northern Bulgaria', 25.0, 43.3], ['Plovdiv', 25.0, 42.1], ['Varna', 27.5, 43.1]]],
  ['RO', 'Romania', ['Romania'], '#eab308', [['Transylvania', 24.3, 46.4], ['Banat', 21.7, 45.6], ['Crișana', 22.3, 47.0], ['Moldavia', 26.8, 47.1],
    ['Muntenia', 25.8, 44.6, 1], ['Oltenia', 23.7, 44.5], ['Dobruja', 28.4, 44.5]]],
  ['MD', 'Moldova', ['Moldova'], '#7c3aed', [['Moldova', 28.6, 47.2, 1]]],
  ['UA', 'Ukraine', ['Ukraine'], '#facc15', [['Kyiv', 30.5, 50.4, 1], ['Galicia', 24.0, 49.7], ['Volhynia', 25.3, 51.1], ['Podolia', 28.3, 49.2], ['Odesa', 30.3, 46.9],
    ['Chernihiv', 32.0, 51.5], ['Dnipro', 35.0, 48.4], ['Kharkiv', 36.3, 49.7], ['Donbas', 38.2, 48.1], ['Crimea', 34.1, 45.3]]],
  ['BY', 'Belarus', ['Belarus'], '#65a30d', [['Minsk', 27.6, 53.9, 1], ['Brest', 25.0, 52.4], ['Vitebsk', 29.0, 55.2], ['Gomel', 30.0, 52.3]]],
  ['RU', 'Russia', ['Russia'], '#7c3aed', [['Kaliningrad', 21.0, 54.7], ['Saint Petersburg', 30.3, 59.6], ['Karelia', 33.0, 63.5], ['Murmansk', 33.5, 68.0],
    ['Pskov', 29.5, 57.5], ['Moscow', 37.6, 55.7, 1], ['Smolensk', 32.8, 54.8], ['Kursk', 36.0, 51.8], ['Voronezh', 40.0, 51.0], ['Rostov', 40.5, 47.8],
    ['Kuban', 39.5, 45.2], ['Arkhangelsk', 42.0, 63.5], ['Yaroslavl', 39.8, 58.0], ['Nizhny Novgorod', 44.0, 56.3], ['Volgograd', 44.0, 49.3], ['Stavropol', 43.0, 44.8]]],
  ['TR', 'Turkey', ['Turkey'], '#dc2626', [['Marmara', 28.3, 40.0], ['Aegean', 28.3, 38.6], ['Mediterranean', 32.5, 37.0], ['Central Anatolia', 33.5, 39.3, 1],
    ['Black Sea', 36.5, 41.0], ['Eastern Anatolia', 41.5, 39.3], ['Southeastern Anatolia', 39.5, 37.6]]],
];

// Sea crossings so islands and straits stay reachable.
const SEA_LINKS = [
  ['London', 'Hauts-de-France'], ['London', 'Flanders'], ['Northern Ireland', 'Scotland'], ['Leinster', 'Wales'],
  ['Zealand', 'Scania'], ['Jutland', 'Eastern Norway'], ['Uusimaa', 'Harju'], ['Svealand', 'Western Finland'],
  ['Sicily', 'Calabria'], ['Sardinia', 'Corsica'], ['Corsica', 'Provence'], ['Corsica', 'Tuscany'], ['Apulia', 'Albania'],
  ['Crete', 'Peloponnese'], ['Crete', 'Attica'], ['Crimea', 'Kuban'], ['Aegean', 'Attica'], ['Holland', 'London'],
];

const PALETTE = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2', '#ea580c', '#65a30d', '#db2777', '#4f46e5',
  '#0d9488', '#ca8a04', '#9f1239', '#475569', '#0ea5e9', '#a16207'];

// ------------------------------------------------------------ geometry prep
const simplified = simplify(presimplify(topo), quantile(presimplify(topo), 0.35));
const countriesGeo = feature(simplified, simplified.objects.countries);
const byName = new Map();
for (const f of countriesGeo.features) {
  if (!byName.has(f.properties.name)) byName.set(f.properties.name, []);
  byName.get(f.properties.name).push(f);
}

const W = 1000;
// Densified so the edges follow parallels/meridians instead of great circles.
const bboxRing = [];
for (let x = -11; x <= 46; x++) bboxRing.push([x, 34]);
for (let y = 34; y <= 71; y++) bboxRing.push([46, y]);
for (let x = 46; x >= -11; x--) bboxRing.push([x, 71]);
for (let y = 71; y >= 34; y--) bboxRing.push([-11, y]);
const bboxFeature = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [bboxRing.reverse()] } };

// Internationally recognised borders: the source data draws Crimea inside Russia.
const TRANSFERS = [['RU', 'UA', [34.1, 45.3]]];
const projection = geoConicConformal().parallels([38, 62]).rotate([-17, 0]).fitWidth(W, bboxFeature);
const bounds = geoPath(projection).bounds(bboxFeature);
const H = Math.ceil(bounds[1][1] - bounds[0][1]);
projection.translate([projection.translate()[0], projection.translate()[1] - bounds[0][1]]);
projection.clipExtent([[0, 0], [W, H]]);

function ringsOf(geo) {
  const rings = [];
  let cur = null;
  const ctx = {
    moveTo(x, y) { cur = [[x, y]]; rings.push(cur); },
    lineTo(x, y) { cur.push([x, y]); },
    closePath() { cur = null; },
    arc() {},
  };
  geoPath(projection, ctx)(geo);
  return rings.filter((r) => r.length >= 3);
}

function unionRings(rings) {
  if (!rings.length) return [];
  let acc = [[rings[0]]];
  for (let i = 1; i < rings.length; i++) acc = polygonClipping.union(acc, [[rings[i]]]);
  return acc;
}

function inside(pt, mp) {
  let hit = false;
  for (const poly of mp) for (const ring of poly) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  return hit;
}

const r1 = (v) => Math.round(v * 10) / 10;
const pathOf = (mp) => mp.map((poly) => poly.map((ring) => 'M' + ring.map(([x, y]) => `${r1(x)},${r1(y)}`).join('L') + 'Z').join('')).join('');
const area = (mp) => mp.reduce((a, poly) => a + poly.reduce((b, ring, k) => {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return b + (k ? -1 : 1) * Math.abs(s / 2);
}, 0), 0);

// ------------------------------------------------------------ build regions
const used = new Set();
const regions = [];
const countries = [];
const countryRings = new Map();
for (const [id, name, neNames] of COUNTRIES) {
  const feats = neNames.flatMap((n) => byName.get(n) || []);
  if (!feats.length) throw new Error('No geometry for ' + name);
  neNames.forEach((n) => used.add(n));
  countryRings.set(id, feats.flatMap((f) => ringsOf(f)));
}
for (const [from, to, lonlat] of TRANSFERS) {
  const pt = projection(lonlat);
  const src = countryRings.get(from);
  const idx = src.findIndex((ring) => inside(pt, [[ring]]));
  if (idx < 0) { console.warn('! transfer ring not found', from, to); continue; }
  countryRings.get(to).push(src.splice(idx, 1)[0]);
}
for (const [id, name, , color, regs] of COUNTRIES) {
  const shape = unionRings(countryRings.get(id));
  const seeds = regs.map(([, lon, lat]) => projection([lon, lat]));
  seeds.forEach((s, i) => { if (!inside(s, shape)) console.warn(`! seed outside ${name}: ${regs[i][0]}`); });
  let cells;
  if (regs.length === 1) cells = [shape];
  else {
    const vor = Delaunay.from(seeds).voronoi([-10, -10, W + 10, H + 10]);
    cells = regs.map((_, i) => polygonClipping.intersection([[vor.cellPolygon(i)]], shape));
  }
  countries.push({ id, name, color });
  regs.forEach(([rname, , , cap], i) => {
    if (!cells[i].length) console.warn(`! empty region ${rname}`);
    regions.push({ name: rname, c: id, cap: cap ? 1 : 0, x: r1(seeds[i][0]), y: r1(seeds[i][1]), mp: cells[i] });
  });
}

// ------------------------------------------------------------ adjacency (shared border vertices)
const key = (x, y) => `${Math.round(x * 2)},${Math.round(y * 2)}`;
const owners = new Map();
regions.forEach((reg, i) => {
  const seen = new Set();
  for (const poly of reg.mp) for (const ring of poly) for (const [x, y] of ring) {
    const k = key(x, y);
    if (seen.has(k)) continue;
    seen.add(k);
    if (!owners.has(k)) owners.set(k, []);
    owners.get(k).push(i);
  }
});
const shared = new Map();
for (const ids of owners.values()) {
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const k = ids[a] < ids[b] ? `${ids[a]}-${ids[b]}` : `${ids[b]}-${ids[a]}`;
    shared.set(k, (shared.get(k) || 0) + 1);
  }
}
const neighbors = regions.map(() => new Set());
for (const [k, n] of shared) {
  if (n < 2) continue;
  const [a, b] = k.split('-').map(Number);
  neighbors[a].add(b);
  neighbors[b].add(a);
}
for (const [a, b] of SEA_LINKS) {
  const ia = regions.findIndex((r) => r.name === a);
  const ib = regions.findIndex((r) => r.name === b);
  if (ia < 0 || ib < 0) throw new Error('Bad sea link ' + a + ' / ' + b);
  neighbors[ia].add(ib);
  neighbors[ib].add(ia);
}

// connectivity check
const seen = new Set([0]);
const q = [0];
while (q.length) for (const n of neighbors[q.shift()]) if (!seen.has(n)) { seen.add(n); q.push(n); }
const lonely = regions.filter((_, i) => !seen.has(i)).map((r) => r.name);
if (lonely.length) console.warn('! unreachable regions:', lonely.join(', '));

// ------------------------------------------------------------ colors: neighbors get distinct colors
const cAdj = new Map(countries.map((c) => [c.id, new Set()]));
regions.forEach((r, i) => neighbors[i].forEach((j) => { if (regions[j].c !== r.c) cAdj.get(r.c).add(regions[j].c); }));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const dist = (a, b) => { const [x, y] = [hex(a), hex(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const assigned = new Map();
for (const c of [...countries].sort((a, b) => cAdj.get(b.id).size - cAdj.get(a.id).size)) {
  const taken = [...cAdj.get(c.id)].map((n) => assigned.get(n)).filter(Boolean);
  const ok = (col) => taken.every((t) => dist(t, col) > 90);
  let col = c.color;
  if (!ok(col)) col = PALETTE.find(ok) || col;
  assigned.set(c.id, col);
}
countries.forEach((c) => { c.color = assigned.get(c.id); });

// ------------------------------------------------------------ backdrop: neutral land + borders
const neutral = countriesGeo.features.filter((f) => !used.has(f.properties.name));
const path1 = geoPath(projection).digits(1);
const neutralPath = path1({ type: 'FeatureCollection', features: neutral });
const bordersPath = path1(mesh(simplified, simplified.objects.countries, (a, b) => a !== b));

const out = `// Generated by scripts/build-map.mjs from Natural Earth 1:50m (public domain). Do not edit by hand.
export const MAP_W = ${W};
export const MAP_H = ${H};
export const EU_COUNTRIES = ${JSON.stringify(countries)};
export const EU_REGIONS = ${JSON.stringify(regions.map(({ name, c, cap, x, y }) => ({ name, c, cap, x, y })))};
export const EU_NEIGHBORS = ${JSON.stringify(neighbors.map((s) => [...s].sort((a, b) => a - b)))};
export const EU_PATHS = ${JSON.stringify(regions.map((r) => pathOf(r.mp)))};
export const EU_NEUTRAL = ${JSON.stringify(neutralPath)};
export const EU_BORDERS = ${JSON.stringify(bordersPath)};
`;
writeFileSync(root + 'js/europe.js', out);
const small = regions.map((r) => [r.name, Math.round(area(r.mp))]).sort((a, b) => a[1] - b[1]).slice(0, 6);
console.log(`regions ${regions.length}, countries ${countries.length}, size ${(out.length / 1024).toFixed(0)} KB, map ${W}x${H}`);
console.log('smallest regions (px²):', small.map((s) => s.join(' ')).join(', '));
