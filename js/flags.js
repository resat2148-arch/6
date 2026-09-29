// Simplified SVG flags of the playable European countries (30×20 viewBox, no external assets).
import { countryById } from './data.js';

const W = 30;
const H = 20;

function bands(dir, colors, ratios = colors.map(() => 1)) {
  const total = ratios.reduce((a, b) => a + b, 0);
  let pos = 0;
  return colors.map((c, i) => {
    const size = (ratios[i] / total) * (dir === 'h' ? H : W);
    const r = dir === 'h'
      ? `<rect x="0" y="${pos.toFixed(2)}" width="${W}" height="${(size + 0.2).toFixed(2)}" fill="${c}"/>`
      : `<rect x="${pos.toFixed(2)}" y="0" width="${(size + 0.2).toFixed(2)}" height="${H}" fill="${c}"/>`;
    pos += size;
    return r;
  }).join('');
}

const bg = (c) => `<rect width="${W}" height="${H}" fill="${c}"/>`;

function nordic(back, cross, inner) {
  let s = bg(back) + `<rect x="8" y="0" width="5" height="${H}" fill="${cross}"/><rect x="0" y="7.5" width="${W}" height="5" fill="${cross}"/>`;
  if (inner) s += `<rect x="9.25" y="0" width="2.5" height="${H}" fill="${inner}"/><rect x="0" y="8.75" width="${W}" height="2.5" fill="${inner}"/>`;
  return s;
}

function star(cx, cy, r, color, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.4 : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${color}"/>`;
}

const shield = (x, y, w, h, fill, stroke = '#fff') =>
  `<path d="M${x},${y}h${w}v${h * 0.6}q0,${h * 0.4} -${w / 2},${h * 0.4}q-${w / 2},0 -${w / 2},-${h * 0.4}z" fill="${fill}" stroke="${stroke}" stroke-width=".6"/>`;

const FLAGS = {
  PT: () => bands('v', ['#006600', '#ff0000'], [2, 3]) + '<circle cx="12" cy="10" r="4.2" fill="#ffcc00"/><circle cx="12" cy="10" r="2.6" fill="#ff0000" stroke="#fff" stroke-width=".6"/>',
  ES: () => bands('h', ['#c60b1e', '#ffc400', '#c60b1e'], [1, 2, 1]) + shield(6.5, 7, 4, 6, '#c60b1e', '#ffc400'),
  FR: () => bands('v', ['#0055a4', '#ffffff', '#ef4135']),
  GB: () => bg('#012169') +
    '<path d="M0,0L30,20M30,0L0,20" stroke="#fff" stroke-width="4"/>' +
    '<path d="M0,0L30,20M30,0L0,20" stroke="#c8102e" stroke-width="1.4"/>' +
    '<path d="M15,0V20M0,10H30" stroke="#fff" stroke-width="6"/>' +
    '<path d="M15,0V20M0,10H30" stroke="#c8102e" stroke-width="3.4"/>',
  IE: () => bands('v', ['#169b62', '#ffffff', '#ff883e']),
  BE: () => bands('v', ['#000000', '#fdda24', '#ef3340']),
  NL: () => bands('h', ['#ae1c28', '#ffffff', '#21468b']),
  DE: () => bands('h', ['#000000', '#dd0000', '#ffce00']),
  CH: () => bg('#da291c') + '<rect x="13" y="4" width="4" height="12" fill="#fff"/><rect x="9" y="8" width="12" height="4" fill="#fff"/>',
  AT: () => bands('h', ['#ed2939', '#ffffff', '#ed2939']),
  IT: () => bands('v', ['#009246', '#ffffff', '#ce2b37']),
  DK: () => nordic('#c8102e', '#ffffff'),
  NO: () => nordic('#ba0c2f', '#ffffff', '#00205b'),
  SE: () => nordic('#006aa7', '#fecc00'),
  FI: () => nordic('#ffffff', '#003580'),
  EE: () => bands('h', ['#0072ce', '#000000', '#ffffff']),
  LV: () => bands('h', ['#9e3039', '#ffffff', '#9e3039'], [2, 1, 2]),
  LT: () => bands('h', ['#fdb913', '#006a44', '#c1272d']),
  PL: () => bands('h', ['#ffffff', '#dc143c']),
  CZ: () => bands('h', ['#ffffff', '#d7141a']) + '<polygon points="0,0 15,10 0,20" fill="#11457e"/>',
  SK: () => bands('h', ['#ffffff', '#0b4ea2', '#ee1c25']) + shield(6, 4.5, 7, 10, '#ee1c25') + '<rect x="9" y="6" width="1" height="6" fill="#fff"/><rect x="7.6" y="7.6" width="3.8" height="1" fill="#fff"/>',
  HU: () => bands('h', ['#ce2939', '#ffffff', '#477050']),
  SI: () => bands('h', ['#ffffff', '#005da4', '#ed1c24']) + shield(6, 3.5, 5, 7, '#005da4', '#ed1c24'),
  HR: () => bands('h', ['#ff0000', '#ffffff', '#171796']) +
    '<g transform="translate(12.5 5)"><rect width="5" height="7" fill="#fff" stroke="#171796" stroke-width=".4"/>' +
    [0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].filter((c) => (r + c) % 2 === 0).map((c) => `<rect x="${c}" y="${r * 1.4}" width="1" height="1.4" fill="#ff0000"/>`).join('')).join('') + '</g>',
  BA: () => bg('#002395') + '<polygon points="8,0 22,0 22,20" fill="#fecb00"/>' +
    [0, 1, 2, 3, 4, 5, 6].map((i) => star(6 + i * 2.3, 1.2 + i * 2.9, 1.1, '#fff')).join(''),
  RS: () => bands('h', ['#c6363c', '#0c4076', '#ffffff']) + shield(7, 4.5, 5, 8, '#c6363c', '#e8c35a'),
  ME: () => bg('#d4af37') + '<rect x="1.2" y="1.2" width="27.6" height="17.6" fill="#c40308"/><circle cx="15" cy="10" r="4" fill="#d4af37"/>',
  MK: () => bg('#d20000') + '<path d="M15,10L0,0H4ZM15,10L30,0H26ZM15,10L0,20H4ZM15,10L30,20H26ZM15,10L13,0H17ZM15,10L13,20H17ZM15,10L0,8V12ZM15,10L30,8V12Z" fill="#ffe600"/><circle cx="15" cy="10" r="3.2" fill="#ffe600" stroke="#d20000" stroke-width=".7"/>',
  AL: () => bg('#e41e20') + '<path d="M15,5l-3,-2l-1,2l-4,-1l2,3l-3,1l4,2l-2,2l4,0l1,4l2,-3l2,3l1,-4l4,0l-2,-2l4,-2l-3,-1l2,-3l-4,1l-1,-2z" fill="#000"/>',
  GR: () => bands('h', ['#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf']) +
    '<rect width="11.1" height="11.1" fill="#0d5eaf"/><rect x="4.45" y="0" width="2.2" height="11.1" fill="#fff"/><rect x="0" y="4.45" width="11.1" height="2.2" fill="#fff"/>',
  BG: () => bands('h', ['#ffffff', '#00966e', '#d62612']),
  RO: () => bands('v', ['#002b7f', '#fcd116', '#ce1126']),
  MD: () => bands('v', ['#0046ae', '#ffd200', '#cc092f']) + shield(12.5, 6, 5, 8, '#b07e3b', '#7a4b1c'),
  UA: () => bands('h', ['#0057b7', '#ffd700']),
  BY: () => bands('h', ['#c8313e', '#4aa657'], [2, 1]) + '<rect width="4" height="20" fill="#fff"/>' +
    [0, 1, 2, 3, 4].map((i) => `<polygon points="2,${1 + i * 4} 3.6,${3 + i * 4} 2,${5 + i * 4} 0.4,${3 + i * 4}" fill="#c8313e"/>`).join(''),
  RU: () => bands('h', ['#ffffff', '#0039a6', '#d52b1e']),
  TR: () => bg('#e30a17') + '<circle cx="11.5" cy="10" r="5" fill="#fff"/><circle cx="12.75" cy="10" r="4" fill="#e30a17"/>' + star(17.4, 10, 2.3, '#fff', 0),
};

export function flagSvg(id, cls = 'flag') {
  const c = countryById(id);
  if (!c) return '';
  const body = (FLAGS[id] || (() => bg(c.color)))();
  return `<svg class="${cls}" viewBox="0 0 ${W} ${H}" aria-label="${c.name} flag" role="img">${body}<rect x="0.25" y="0.25" width="${W - 0.5}" height="${H - 0.5}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width=".5"/></svg>`;
}
