// Themed background scenes for each tab, drawn as SVG once and cached as CSS urls.
// Dark and low in contrast so the cards on top stay readable.
import { mulberry32 } from './util.js';

const VW = 1600;
const VH = 1000;
const cache = {};

export function tabBackground(tab) {
  if (!cache[tab]) {
    const make = SCENES[tab] || SCENES.home;
    const svg = make(mulberry32(tab.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7)));
    cache[tab] = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  }
  return cache[tab];
}

// ------------------------------------------------------------ helpers
const f = (n) => Math.round(n * 10) / 10;

function doc(defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMax slice">
<defs><filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>${defs}</defs>${body}</svg>`;
}

function sky(id, stops) {
  return {
    def: `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`,
    el: `<rect width="${VW}" height="${VH}" fill="url(#${id})"/>`,
  };
}

function glow(id, cx, cy, r, color, op) {
  return {
    def: `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`,
    el: `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>`,
  };
}

function stars(rnd, n, maxY, op = 0.6) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<circle cx="${f(rnd() * VW)}" cy="${f(rnd() * maxY)}" r="${f(0.6 + rnd() * 1.4)}" fill="#fff" opacity="${f(op * (0.3 + rnd() * 0.7))}"/>`;
  return s;
}

// A row of buildings standing on baseY; optional lit windows and broken tops.
function skyline(rnd, o) {
  let path = '';
  const wins = ['', '', '']; // three brightness levels, one path each
  let x = -20;
  while (x < VW + 20) {
    const w = o.wMin + rnd() * (o.wMax - o.wMin);
    const h = o.hMin + rnd() * (o.hMax - o.hMin);
    const top = o.base - h;
    if (o.broken && rnd() < o.broken) {
      path += `M${f(x)} ${o.base}L${f(x)} ${f(top + h * 0.2)}`;
      const n = 3 + Math.floor(rnd() * 4);
      for (let i = 1; i < n; i++) path += `L${f(x + (w * i) / n)} ${f(top + rnd() * h * 0.4)}`;
      path += `L${f(x + w)} ${f(top + h * 0.3 * rnd())}L${f(x + w)} ${o.base}Z`;
    } else {
      path += `M${f(x)} ${o.base}L${f(x)} ${f(top)}L${f(x + w)} ${f(top)}L${f(x + w)} ${o.base}Z`;
      if (o.spires && rnd() < o.spires) path += `M${f(x + w / 2 - 1.5)} ${f(top)}L${f(x + w / 2 - 1.5)} ${f(top - 20 - rnd() * 40)}L${f(x + w / 2 + 1.5)} ${f(top - 20 - rnd() * 40)}L${f(x + w / 2 + 1.5)} ${f(top)}Z`;
    }
    if (o.win) {
      for (let yy = top + 10; yy < o.base - 8; yy += 14) {
        for (let xx = x + 6; xx < x + w - 8; xx += 11) if (rnd() < o.win) wins[Math.floor(rnd() * 3)] += `M${f(xx)} ${f(yy)}h4v6h-4Z`;
      }
    }
    x += w + (o.gap || 0) * rnd();
  }
  return `<path d="${path}" fill="${o.color}"/>${wins.map((d, i) => (d ? `<path d="${d}" fill="${o.winColor}" opacity="${0.4 + i * 0.2}"/>` : '')).join('')}`;
}

function smoke(rnd, x, y, n, color, op) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const t = i / n;
    s += `<circle cx="${f(x + t * 160 + (rnd() - 0.5) * 40)}" cy="${f(y - t * 380)}" r="${f(24 + t * 90)}" fill="${color}" opacity="${f(op * (1 - t * 0.7))}"/>`;
  }
  return `<g filter="url(#blur)">${s}</g>`;
}

function beam(x, y, angle, len, color, op) {
  const a = (angle * Math.PI) / 180;
  const w = 0.07;
  const x1 = x + Math.cos(a - w) * len;
  const y1 = y + Math.sin(a - w) * len;
  const x2 = x + Math.cos(a + w) * len;
  const y2 = y + Math.sin(a + w) * len;
  return `<path d="M${x} ${y}L${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}Z" fill="${color}" opacity="${op}" filter="url(#soft)"/>`;
}

function flag(x, y, h, color, wave = 0) {
  return `<rect x="${x}" y="${y}" width="3" height="${h}" fill="#0b0f18"/>
<path d="M${x + 3} ${y + 2}q20 ${-6 - wave} 40 0t40 0v28q-20 ${6 + wave} -40 0t-40 0Z" fill="${color}" opacity=".75"/>`;
}

function crowd(rnd, base, n, color, scale = 1) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = (i / n) * VW + rnd() * (VW / n);
    const h = (34 + rnd() * 16) * scale;
    const r = 7 * scale;
    s += `<circle cx="${f(x)}" cy="${f(base - h - r * 0.6)}" r="${f(r)}"/><path d="M${f(x - 12 * scale)} ${base}Q${f(x - 13 * scale)} ${f(base - h)} ${f(x)} ${f(base - h)}Q${f(x + 13 * scale)} ${f(base - h)} ${f(x + 12 * scale)} ${base}Z"/>`;
    if (rnd() < 0.08) s += `<rect x="${f(x + 8 * scale)}" y="${f(base - h - 46 * scale)}" width="${f(2 * scale)}" height="${f(46 * scale)}"/><rect x="${f(x + 10 * scale)}" y="${f(base - h - 46 * scale)}" width="${f(26 * scale)}" height="${f(16 * scale)}" opacity=".8"/>`;
  }
  return `<g fill="${color}">${s}</g>`;
}

// ------------------------------------------------------------ scenes
const SCENES = {
  // Capital at night: skyline, government dome, searchlights, moon.
  home(rnd) {
    const sk = sky('s', [[0, '#070d1a'], [0.55, '#122038'], [0.82, '#1f2c48'], [1, '#2a2f45']]);
    const moon = glow('m', 1260, 170, 160, '#cfe0ff', 0.25);
    const city = glow('c', 800, 820, 700, '#f5b83d', 0.16);
    const dome = `<g fill="#0e1626">
<rect x="680" y="640" width="240" height="140"/><rect x="660" y="620" width="280" height="24"/>
<path d="M710 620Q800 480 890 620Z"/><rect x="796" y="470" width="8" height="40"/>
${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${692 + i * 33}" y="650" width="10" height="120" fill="#162238"/>`).join('')}
</g>${flag(797, 400, 72, '#f5b83d', 2)}`;
    return doc(sk.def + moon.def + city.def, sk.el + stars(rnd, 140, 520) + moon.el + `<circle cx="1260" cy="170" r="42" fill="#dfe8ff" opacity=".55"/>`
      + beam(600, 800, -110, 900, '#9fb8ff', 0.08) + beam(1000, 800, -72, 900, '#9fb8ff', 0.07) + beam(300, 820, -60, 800, '#f5d58a', 0.05)
      + city.el
      + skyline(rnd, { base: 800, hMin: 120, hMax: 330, wMin: 50, wMax: 120, gap: 8, color: '#111b2e', win: 0.18, winColor: '#ffd88a', spires: 0.15 })
      + dome
      + skyline(rnd, { base: 1000, hMin: 160, hMax: 260, wMin: 90, wMax: 200, gap: 0, color: '#0a1120', win: 0.08, winColor: '#ffcc70' }));
  },

  // Front line at dusk: burning ruins, smoke, searchlights, tanks and wire.
  war(rnd) {
    const sk = sky('s', [[0, '#0b0d16'], [0.45, '#2a1418'], [0.75, '#6b2a1a'], [1, '#a2441c']]);
    const fire = glow('g', 800, 780, 760, '#ff6a2a', 0.35);
    let tanks = '';
    for (const [x, s] of [[260, 1], [1180, 1.25], [1420, 0.8]]) {
      tanks += `<g transform="translate(${x} 860) scale(${s})" fill="#0a0a0e"><path d="M-90 0L-78 -26L70 -26L92 0Z"/><rect x="-46" y="-48" width="70" height="24" rx="6"/><rect x="20" y="-42" width="90" height="8"/><rect x="-96" y="0" width="192" height="16" rx="8"/></g>`;
    }
    let wire = '';
    for (let x = 0; x < VW; x += 60) wire += `<path d="M${x} 960q15 -20 30 0t30 0" stroke="#050507" stroke-width="3" fill="none"/><path d="M${x + 10} 930l0 70" stroke="#050507" stroke-width="4"/>`;
    let jets = '';
    for (const [x, y, s] of [[1050, 180, 1], [1150, 230, 0.8]]) jets += `<path transform="translate(${x} ${y}) scale(${s}) rotate(-8)" d="M-40 0L30 -4L44 0L30 4ZM-6 -2L-20 -24L-12 -24L10 -2ZM-6 2L-20 24L-12 24L10 2ZM-36 -1L-46 -12L-40 -12L-30 -1Z" fill="#0d0d12"/>`;
    let flak = '';
    for (let i = 0; i < 26; i++) flak += `<circle cx="${f(200 + rnd() * 1200)}" cy="${f(60 + rnd() * 330)}" r="${f(1.5 + rnd() * 3)}" fill="#ffb36b" opacity="${f(0.3 + rnd() * 0.6)}"/>`;
    return doc(sk.def + fire.def, sk.el + fire.el + flak
      + beam(380, 860, -100, 900, '#ffd9a0', 0.1) + beam(1240, 860, -62, 900, '#ffd9a0', 0.08)
      + skyline(rnd, { base: 820, hMin: 100, hMax: 300, wMin: 50, wMax: 130, gap: 30, color: '#1a0f12', broken: 0.7, win: 0.03, winColor: '#ff8a3a' })
      + smoke(rnd, 300, 700, 9, '#1a1414', 0.55) + smoke(rnd, 980, 720, 9, '#1a1414', 0.5) + smoke(rnd, 1380, 760, 8, '#201818', 0.45)
      + jets
      + `<path d="M0 880Q400 840 800 870T1600 860V1000H0Z" fill="#0c0a0c"/>` + tanks + wire);
  },

  // Industrial district: factories, chimneys with smoke, cranes, gears in the sky.
  economy(rnd) {
    const sk = sky('s', [[0, '#0d0f16'], [0.5, '#2a2014'], [0.85, '#5c3f18'], [1, '#7a5418']]);
    const sun = glow('g', 520, 760, 620, '#ffb547', 0.32);
    const gear = (cx, cy, r, op) => {
      let d = '';
      const n = 12;
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2;
        const rr = i % 2 ? r : r * 1.16;
        d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`;
      }
      return `<path d="${d}Z" fill="none" stroke="#f5b83d" stroke-width="3" opacity="${op}"/><circle cx="${cx}" cy="${cy}" r="${f(r * 0.35)}" fill="none" stroke="#f5b83d" stroke-width="3" opacity="${op}"/>`;
    };
    let factories = '';
    for (let x = 40; x < VW; x += 260 + rnd() * 80) {
      const w = 200 + rnd() * 60;
      const y = 760 + rnd() * 40;
      let saw = `M${f(x)} 1000L${f(x)} ${f(y)}`;
      for (let i = 0; i < 5; i++) saw += `L${f(x + (w / 5) * i + w / 10)} ${f(y - 40)}L${f(x + (w / 5) * (i + 1))} ${f(y)}`;
      saw += `L${f(x + w)} 1000Z`;
      factories += `<path d="${saw}" fill="#120e0a"/>`;
      for (let i = 0; i < 4; i++) factories += `<rect x="${f(x + 20 + i * 44)}" y="${f(y + 40)}" width="22" height="14" fill="#ffb547" opacity="${f(0.25 + rnd() * 0.4)}"/>`;
      if (rnd() < 0.7) {
        const cx = x + w * (0.6 + rnd() * 0.3);
        const ch = 220 + rnd() * 120;
        factories += `<path d="M${f(cx - 16)} ${f(y)}L${f(cx - 10)} ${f(y - ch)}L${f(cx + 10)} ${f(y - ch)}L${f(cx + 16)} ${f(y)}Z" fill="#100c08"/><rect x="${f(cx - 12)}" y="${f(y - ch + 18)}" width="24" height="6" fill="#d9480f" opacity=".5"/>`;
        factories = smoke(rnd, cx, y - ch, 7, '#3a3026', 0.4) + factories;
      }
    }
    const tanks = `<g fill="#0f0c09"><rect x="1240" y="820" width="120" height="180" rx="60"/><rect x="1380" y="850" width="90" height="150" rx="45"/></g>`;
    const crane = `<g stroke="#0e0b08" stroke-width="10" fill="none"><path d="M1130 1000V470M1060 490H1420M1130 450L1400 490M1340 490V640"/></g><rect x="1320" y="640" width="40" height="30" fill="#0e0b08"/>`;
    return doc(sk.def + sun.def, sk.el + sun.el + gear(1260, 240, 120, 0.1) + gear(1420, 380, 70, 0.08) + gear(260, 200, 80, 0.07)
      + skyline(rnd, { base: 800, hMin: 60, hMax: 160, wMin: 80, wMax: 160, gap: 20, color: '#1c150e', win: 0.04, winColor: '#ffb547' })
      + crane + factories + tanks);
  },

  // Trade port and exchange: container stacks, gantry cranes, a ship and a rising chart.
  market(rnd) {
    const sk = sky('s', [[0, '#061016'], [0.55, '#0b2a2c'], [0.85, '#114a46'], [1, '#156059']]);
    const g1 = glow('g', 1000, 720, 700, '#2dd4bf', 0.22);
    let chart = '';
    let y = 520;
    let line = 'M80 520';
    for (let i = 0; i < 26; i++) {
      const x = 80 + i * 56;
      const o = y;
      y = Math.max(140, Math.min(560, y + (rnd() - 0.62) * 70));
      const up = y < o;
      chart += `<line x1="${x}" y1="${f(Math.min(o, y) - 14)}" x2="${x}" y2="${f(Math.max(o, y) + 14)}" stroke="${up ? '#4ade80' : '#f87171'}" stroke-width="2" opacity=".25"/><rect x="${x - 9}" y="${f(Math.min(o, y))}" width="18" height="${f(Math.max(4, Math.abs(o - y)))}" fill="${up ? '#4ade80' : '#f87171'}" opacity=".22"/>`;
      line += `L${x} ${f(y)}`;
    }
    chart += `<path d="${line}" stroke="#5eead4" stroke-width="3" fill="none" opacity=".35"/>`;
    const cols = ['#9a3412', '#1d4ed8', '#15803d', '#a16207', '#7e22ce', '#b91c1c', '#0e7490'];
    let boxes = '';
    for (let stack = 0; stack < 9; stack++) {
      const x0 = 40 + stack * 175;
      const rows = 2 + Math.floor(rnd() * 4);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 2; c++) {
          const col = cols[Math.floor(rnd() * cols.length)];
          boxes += `<rect x="${x0 + c * 78}" y="${1000 - 70 - r * 42}" width="74" height="38" fill="${col}" opacity=".45"/><path d="M${x0 + c * 78 + 8} ${1000 - 66 - r * 42}v30M${x0 + c * 78 + 20} ${1000 - 66 - r * 42}v30M${x0 + c * 78 + 32} ${1000 - 66 - r * 42}v30M${x0 + c * 78 + 44} ${1000 - 66 - r * 42}v30M${x0 + c * 78 + 56} ${1000 - 66 - r * 42}v30" stroke="#000" stroke-opacity=".25"/>`;
        }
      }
    }
    const gantry = (x) => `<g stroke="#071413" stroke-width="12" fill="none"><path d="M${x} 1000V560M${x + 120} 1000V560M${x - 60} 580H${x + 260}M${x} 700H${x + 120}"/></g>`;
    const ship = `<path d="M980 860H1560L1520 920H1010Z" fill="#06100f"/><rect x="1060" y="800" width="380" height="60" fill="#0a1b1a"/><rect x="1420" y="760" width="60" height="100" fill="#06100f"/>`;
    return doc(sk.def + g1.def, sk.el + stars(rnd, 70, 400, 0.4) + g1.el + chart + ship + gantry(380) + gantry(860) + boxes);
  },

  // Parliament: columns and dome under spotlights, flags, people in front.
  politics(rnd) {
    const sk = sky('s', [[0, '#0a0a1c'], [0.55, '#1c1838'], [0.85, '#2e2556'], [1, '#3b2c66']]);
    const g1 = glow('g', 800, 600, 640, '#a78bfa', 0.22);
    let cols = '';
    for (let i = 0; i < 12; i++) cols += `<rect x="${430 + i * 64}" y="640" width="26" height="250" fill="#1c1a33"/><rect x="${426 + i * 64}" y="630" width="34" height="12" fill="#211e3d"/>`;
    const building = `<g fill="#141228">
<rect x="380" y="880" width="840" height="120"/><rect x="400" y="600" width="800" height="40"/>
<path d="M380 600L800 470L1220 600Z"/><rect x="700" y="380" width="200" height="100"/>
<path d="M700 380Q800 210 900 380Z"/><rect x="796" y="190" width="8" height="40"/>
<rect x="340" y="960" width="920" height="40" fill="#0f0d20"/></g>${cols}${flag(797, 120, 76, '#a78bfa', 3)}`;
    return doc(sk.def + g1.def, sk.el + stars(rnd, 90, 420, 0.5) + g1.el
      + beam(560, 1000, -78, 1000, '#c4b5fd', 0.1) + beam(1040, 1000, -102, 1000, '#c4b5fd', 0.1) + beam(800, 1000, -90, 900, '#ddd6fe', 0.06)
      + skyline(rnd, { base: 900, hMin: 80, hMax: 220, wMin: 60, wMax: 130, gap: 10, color: '#100e22', win: 0.08, winColor: '#c4b5fd' })
      + building + flag(220, 760, 200, '#60a5fa', 4) + flag(1360, 760, 200, '#f87171', 4)
      + crowd(rnd, 1000, 46, '#07060f', 1.1));
  },

  // Citizens: apartment blocks with lit windows, street lamps, a rally.
  people(rnd) {
    const sk = sky('s', [[0, '#0b0816'], [0.55, '#1f1230'], [0.85, '#3b1846'], [1, '#4a1b4f']]);
    const g1 = glow('g', 800, 820, 760, '#f472b6', 0.2);
    let lamps = '';
    for (let x = 120; x < VW; x += 320) {
      lamps += `<rect x="${x}" y="760" width="6" height="200" fill="#0a0710"/><path d="M${x + 3} 760q30 -10 44 6" stroke="#0a0710" stroke-width="6" fill="none"/>`;
      const l = glow(`l${x}`, x + 46, 770, 110, '#fde68a', 0.35);
      lamps = `<defs>${l.def}</defs>${l.el}` + lamps;
    }
    return doc(sk.def + g1.def, sk.el + stars(rnd, 80, 380, 0.5) + g1.el
      + skyline(rnd, { base: 860, hMin: 220, hMax: 520, wMin: 120, wMax: 220, gap: 30, color: '#150d22', win: 0.32, winColor: '#fcd34d' })
      + skyline(rnd, { base: 940, hMin: 120, hMax: 260, wMin: 140, wMax: 260, gap: 10, color: '#0f0919', win: 0.22, winColor: '#fbbf24' })
      + lamps + crowd(rnd, 1000, 60, '#06040b', 1.2));
  },

  // Hall of honour: golden rays, a laurel wreath and a star.
  medals(rnd) {
    const sk = sky('s', [[0, '#0a0c16'], [0.6, '#151526'], [1, '#221c14']]);
    const g1 = glow('g', 800, 440, 620, '#f5b83d', 0.28);
    let rays = '';
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const a2 = a + 0.05;
      rays += `<path d="M800 440L${f(800 + Math.cos(a) * 1400)} ${f(440 + Math.sin(a) * 1400)}L${f(800 + Math.cos(a2) * 1400)} ${f(440 + Math.sin(a2) * 1400)}Z" fill="#f5b83d" opacity="${i % 2 ? 0.035 : 0.06}"/>`;
    }
    let laurel = '';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 13; i++) {
        const t = i / 12;
        const a = Math.PI * (0.62 + t * 0.78);
        const x = 800 + side * Math.cos(a) * -260;
        const y = 440 + Math.sin(a) * 260;
        const rot = (side * (a * 180) / Math.PI) + (side > 0 ? 0 : 180);
        laurel += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="34" ry="12" transform="rotate(${f(rot + side * 40)} ${f(x)} ${f(y)})" fill="#f5b83d" opacity=".16"/>`;
      }
    }
    let star = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 60 : 140;
      star += `${i ? 'L' : 'M'}${f(800 + Math.cos(a) * r)} ${f(440 + Math.sin(a) * r)}`;
    }
    let ribbons = '';
    for (let i = 0; i < 7; i++) {
      const x = 140 + i * 220;
      const c = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2', '#db2777'][i];
      ribbons += `<path d="M${x} 1000V860L${x + 30} 840L${x + 60} 860V1000Z" fill="${c}" opacity=".18"/><circle cx="${x + 30}" cy="820" r="26" fill="#f5b83d" opacity=".12"/>`;
    }
    return doc(sk.def + g1.def, sk.el + rays + g1.el + stars(rnd, 60, 900, 0.35) + laurel + `<path d="${star}Z" fill="#f5b83d" opacity=".12"/>` + ribbons);
  },
};
