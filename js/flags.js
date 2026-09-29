// Procedural SVG flags for the fictional nations.
import { countryById } from './data.js';

function emblem(kind, cx, cy, r, color) {
  switch (kind) {
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="${color}"/>`;
    }
    case 'circle':
      return `<circle cx="${cx}" cy="${cy}" r="${r * 0.8}" fill="none" stroke="${color}" stroke-width="${r * 0.35}"/>`;
    case 'cross':
      return `<rect x="${cx - r * 1.6}" y="${cy - r * 0.25}" width="${r * 3.2}" height="${r * 0.5}" fill="${color}"/>` +
        `<rect x="${cx - r * 0.25}" y="${cy - r * 1.6}" width="${r * 0.5}" height="${r * 3.2}" fill="${color}"/>`;
    case 'sun': {
      let rays = '';
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        rays += `<line x1="${cx + Math.cos(a) * r * 0.6}" y1="${cy + Math.sin(a) * r * 0.6}" x2="${cx + Math.cos(a) * r * 1.1}" y2="${cy + Math.sin(a) * r * 1.1}" stroke="${color}" stroke-width="${r * 0.18}" stroke-linecap="round"/>`;
      }
      return rays + `<circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="${color}"/>`;
    }
    case 'diamond':
      return `<polygon points="${cx},${cy - r} ${cx + r * 0.7},${cy} ${cx},${cy + r} ${cx - r * 0.7},${cy}" fill="${color}"/>`;
    default:
      return '';
  }
}

export function flagSvg(id, cls = 'flag') {
  const c = countryById(id);
  if (!c) return '';
  const { dir, colors, emblem: em } = c.flag;
  const w = 30;
  const h = 20;
  let bands = '';
  colors.forEach((col, i) => {
    if (dir === 'h') bands += `<rect x="0" y="${(i * h) / colors.length}" width="${w}" height="${h / colors.length + 0.2}" fill="${col}"/>`;
    else bands += `<rect x="${(i * w) / colors.length}" y="0" width="${w / colors.length + 0.2}" height="${h}" fill="${col}"/>`;
  });
  const emColor = { A: '#fde047', B: '#fde047', C: '#fbbf24', D: '#b91c1c', E: '#e879f9', F: '#166534' }[c.id];
  const cx = em === 'cross' ? 11 : w / 2;
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" aria-label="${c.name} flag" role="img">${bands}${emblem(em, cx, h / 2, 5, emColor)}<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="none" stroke="rgba(0,0,0,.35)"/></svg>`;
}
