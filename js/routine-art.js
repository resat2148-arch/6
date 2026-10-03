// Procedural art for the daily routine screens: a factory floor (work), a training camp (train)
// and a mess hall (eat). Static layers are drawn once per size; the citizen is drawn every frame
// from a pose (joint angles) so one figure can hammer, lift a barbell and eat.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function glow(g, x, y, r, col) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, col);
  gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

// ------------------------------------------------------------ backgrounds
// L: { fy: floor line (feet), cx: citizen x, s: citizen scale }
export function buildRoutineBg(mode, W, H, dpr, L) {
  const c = canvas(W * dpr, H * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (mode === 'work') factory(g, W, H, L);
  else if (mode === 'train') camp(g, W, H, L);
  else messHall(g, W, H, L);
  // vignette
  const gr = g.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.78);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(0,0,0,.55)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  return c;
}

function factory(g, W, H, { fy, s }) {
  const wallEnd = fy - 150 * s; // where the far wall meets the floor
  let gr = g.createLinearGradient(0, 0, 0, wallEnd);
  gr.addColorStop(0, '#121a26');
  gr.addColorStop(0.6, '#253042');
  gr.addColorStop(1, '#323b49');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, wallEnd + 2);
  // tall factory windows with daylight
  const wy = H * 0.1;
  const wh = Math.max(40, (wallEnd - wy) * 0.62);
  const ww = Math.max(54, 92 * s);
  for (let x = -ww * 0.3; x < W; x += ww * 1.45) {
    gr = g.createLinearGradient(0, wy, 0, wy + wh);
    gr.addColorStop(0, 'rgba(150,190,230,.55)');
    gr.addColorStop(1, 'rgba(230,220,190,.42)');
    g.fillStyle = gr;
    g.fillRect(x, wy, ww, wh);
    g.strokeStyle = '#0e141e';
    g.lineWidth = 3;
    g.strokeRect(x, wy, ww, wh);
    g.lineWidth = 1.6;
    for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(x + (ww * i) / 3, wy); g.lineTo(x + (ww * i) / 3, wy + wh); g.stroke(); }
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x, wy + (wh * i) / 4); g.lineTo(x + ww, wy + (wh * i) / 4); g.stroke(); }
    // shaft of light falling to the floor
    gr = g.createLinearGradient(x, wy, x + ww * 1.6, fy);
    gr.addColorStop(0, 'rgba(255,240,205,.13)');
    gr.addColorStop(1, 'rgba(255,240,205,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x, wy + wh * 0.2);
    g.lineTo(x + ww, wy);
    g.lineTo(x + ww * 2.6, fy + 30 * s);
    g.lineTo(x + ww * 1.2, fy + 30 * s);
    g.closePath();
    g.fill();
  }
  // roof trusses
  const ty = H * 0.045;
  g.strokeStyle = '#0b1019';
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(0, ty); g.lineTo(W, ty); g.moveTo(0, ty + 34 * s); g.lineTo(W, ty + 34 * s); g.stroke();
  g.lineWidth = 2.5;
  g.beginPath();
  for (let x = 0, k = 0; x < W + 40; x += 40 * s, k++) { g.moveTo(x, ty); g.lineTo(x + 40 * s, ty + 34 * s); }
  g.stroke();
  // machines along the far wall
  press(g, W * 0.1, wallEnd, s);
  press(g, W * 0.9, wallEnd, s * 0.9);
  shelves(g, W * 0.27, wallEnd, s);
  shelves(g, W * 0.73, wallEnd, s);
  // conveyor frame (crates are drawn live)
  const by = conveyorY(fy, s);
  g.fillStyle = '#1b2029';
  g.fillRect(0, by, W, 12 * s);
  g.fillStyle = '#3c4452';
  g.fillRect(0, by - 3 * s, W, 4 * s);
  for (let x = 10 * s; x < W; x += 60 * s) {
    g.fillStyle = '#12161d';
    g.fillRect(x, by + 12 * s, 6 * s, wallEnd + 40 * s - by);
  }
  // floor
  gr = g.createLinearGradient(0, wallEnd, 0, H);
  gr.addColorStop(0, '#4a4f57');
  gr.addColorStop(0.35, '#3a3e45');
  gr.addColorStop(1, '#1a1c21');
  g.fillStyle = gr;
  g.fillRect(0, wallEnd, W, H - wallEnd);
  g.strokeStyle = 'rgba(0,0,0,.25)';
  g.lineWidth = 1;
  for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(W / 2 + i * 40 * s, wallEnd); g.lineTo(W / 2 + i * 220 * s, H); g.stroke(); }
  // yellow safety lane
  g.fillStyle = 'rgba(234,179,8,.75)';
  for (const y of [fy + 18 * s, wallEnd + 10 * s]) g.fillRect(0, y, W, 4 * s);
  for (let i = 0; i < 40; i++) {
    const x = rand(0, W);
    const y = rand(wallEnd, H);
    g.fillStyle = `rgba(0,0,0,${rand(0.05, 0.16)})`;
    g.beginPath(); g.ellipse(x, y, rand(10, 40) * s, rand(3, 9) * s, 0, 0, TAU); g.fill();
  }
}

export const conveyorY = (fy, s) => fy - 196 * s;

function press(g, x, base, s) {
  const w = 70 * s;
  const h = 150 * s;
  g.fillStyle = '#2b3442';
  g.fillRect(x - w / 2, base - h, w, h);
  g.fillStyle = '#1a212c';
  g.fillRect(x - w / 2 + 8 * s, base - h * 0.62, w - 16 * s, h * 0.3);
  // hazard stripes
  g.save();
  g.beginPath(); g.rect(x - w / 2, base - 16 * s, w, 12 * s); g.clip();
  for (let i = -4; i < 12; i++) {
    g.fillStyle = i % 2 ? '#eab308' : '#111';
    g.beginPath();
    g.moveTo(x - w / 2 + i * 10 * s, base - 4 * s);
    g.lineTo(x - w / 2 + i * 10 * s + 10 * s, base - 16 * s);
    g.lineTo(x - w / 2 + i * 10 * s + 20 * s, base - 16 * s);
    g.lineTo(x - w / 2 + i * 10 * s + 10 * s, base - 4 * s);
    g.fill();
  }
  g.restore();
  g.fillStyle = '#ef4444';
  g.beginPath(); g.arc(x + w * 0.3, base - h + 12 * s, 4 * s, 0, TAU); g.fill();
  glow(g, x + w * 0.3, base - h + 12 * s, 14 * s, 'rgba(255,80,60,.5)');
}

function shelves(g, x, base, s) {
  const w = 110 * s;
  const h = 120 * s;
  g.strokeStyle = '#151b25';
  g.lineWidth = 4 * s;
  g.strokeRect(x - w / 2, base - h, w, h);
  for (let k = 1; k < 3; k++) {
    const y = base - (h * k) / 3;
    g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.stroke();
    for (let b = 0; b < 3; b++) {
      if (Math.random() < 0.25) continue;
      const bw = rand(22, 30) * s;
      const bh = rand(16, 26) * s;
      const bx = x - w / 2 + 6 * s + b * 34 * s;
      g.fillStyle = ['#8a6a43', '#7a5c38', '#596474'][b % 3];
      g.fillRect(bx, y - bh - 2 * s, bw, bh);
      g.fillStyle = 'rgba(255,255,255,.08)';
      g.fillRect(bx, y - bh - 2 * s, bw, 3 * s);
    }
  }
}

function camp(g, W, H, { fy, s }) {
  const hz = fy - 130 * s;
  let gr = g.createLinearGradient(0, 0, 0, hz);
  gr.addColorStop(0, '#3d79b8');
  gr.addColorStop(0.55, '#86b4dc');
  gr.addColorStop(1, '#f2d7ab');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, hz + 2);
  glow(g, W * 0.18, hz - H * 0.06, H * 0.35, 'rgba(255,236,190,.6)');
  // far mountains, then wooded hills
  ridge(g, W, hz, H * 0.14, '#7d93ad', 7);
  ridge(g, W, hz, H * 0.08, '#4e6a63', 11);
  ridge(g, W, hz + 2, H * 0.035, '#2f4a37', 23);
  // ground
  gr = g.createLinearGradient(0, hz, 0, H);
  gr.addColorStop(0, '#7c8a4e');
  gr.addColorStop(0.3, '#6b6a3d');
  gr.addColorStop(1, '#3a3220');
  g.fillStyle = gr;
  g.fillRect(0, hz, W, H - hz);
  // camp at the horizon: tents and a watchtower
  for (const [x, k] of [[0.08, 1], [0.2, 0.8], [0.82, 0.9], [0.93, 1.1]]) tent(g, W * x, hz + 8 * s, 46 * s * k);
  tower(g, W * 0.7, hz + 6 * s, s);
  // obstacle course: wall, climbing frame, range targets
  obstacleWall(g, W * 0.18, hz + 40 * s, s);
  climbFrame(g, W * 0.33, hz + 30 * s, s);
  for (const [x, k] of [[0.79, 0.8], [0.86, 0.85], [0.93, 0.9]]) target(g, W * x, hz + 34 * s, s * k);
  // dirt running track
  g.strokeStyle = 'rgba(160,120,80,.45)';
  g.lineWidth = 14 * s;
  g.beginPath(); g.ellipse(W / 2, hz + 60 * s, W * 0.62, 30 * s, 0, Math.PI * 0.95, Math.PI * 2.05); g.stroke();
  // grass tufts
  for (let i = 0; i < 160; i++) {
    const t = Math.pow(Math.random(), 0.8);
    const y = hz + (H - hz) * t;
    const x = rand(0, W);
    const h = (2 + t * 9) * s;
    g.strokeStyle = Math.random() < 0.5 ? 'rgba(60,80,30,.6)' : 'rgba(150,160,80,.45)';
    g.lineWidth = 1 + t;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-2, 2) * s, y - h); g.stroke();
  }
  // rubber mat under the citizen + weight rack behind
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(W / 2, fy + 4 * s, 120 * s, 18 * s, 0, 0, TAU); g.fill();
  g.fillStyle = '#26282c';
  g.beginPath();
  g.moveTo(W / 2 - 120 * s, fy + 12 * s); g.lineTo(W / 2 + 120 * s, fy + 12 * s);
  g.lineTo(W / 2 + 98 * s, fy - 16 * s); g.lineTo(W / 2 - 98 * s, fy - 16 * s);
  g.closePath(); g.fill();
  rack(g, W / 2 + 150 * s, fy - 4 * s, s);
  sandbags(g, W / 2 - 190 * s, fy + 10 * s, s);
}

function ridge(g, W, base, h, col, n) {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(0, base);
  for (let i = 0; i <= n; i++) g.lineTo((W * i) / n, base - h * (0.45 + Math.random() * 0.55));
  g.lineTo(W, base);
  g.closePath();
  g.fill();
}

function tent(g, x, y, w) {
  g.fillStyle = '#4d5a33';
  g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x, y - w * 0.55); g.lineTo(x + w / 2, y); g.closePath(); g.fill();
  g.fillStyle = '#2e361e';
  g.beginPath(); g.moveTo(x - w * 0.1, y); g.lineTo(x, y - w * 0.3); g.lineTo(x + w * 0.1, y); g.closePath(); g.fill();
}

function tower(g, x, y, s) {
  g.strokeStyle = '#4b3a28';
  g.lineWidth = 3 * s;
  g.beginPath();
  g.moveTo(x - 16 * s, y); g.lineTo(x - 10 * s, y - 70 * s);
  g.moveTo(x + 16 * s, y); g.lineTo(x + 10 * s, y - 70 * s);
  g.moveTo(x - 14 * s, y - 20 * s); g.lineTo(x + 12 * s, y - 45 * s);
  g.moveTo(x + 14 * s, y - 20 * s); g.lineTo(x - 12 * s, y - 45 * s);
  g.stroke();
  g.fillStyle = '#5d4830';
  g.fillRect(x - 16 * s, y - 86 * s, 32 * s, 18 * s);
  g.fillStyle = '#3b2d1d';
  g.beginPath(); g.moveTo(x - 20 * s, y - 86 * s); g.lineTo(x, y - 98 * s); g.lineTo(x + 20 * s, y - 86 * s); g.closePath(); g.fill();
}

function obstacleWall(g, x, y, s) {
  const w = 70 * s;
  const h = 46 * s;
  g.fillStyle = '#7a5a36';
  g.fillRect(x - w / 2, y - h, w, h);
  g.strokeStyle = 'rgba(40,25,10,.6)';
  g.lineWidth = 1.5 * s;
  for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x - w / 2, y - (h * i) / 5); g.lineTo(x + w / 2, y - (h * i) / 5); g.stroke(); }
  g.fillStyle = '#4a3520';
  g.fillRect(x - w / 2 - 3 * s, y - h - 4 * s, 6 * s, h + 4 * s);
  g.fillRect(x + w / 2 - 3 * s, y - h - 4 * s, 6 * s, h + 4 * s);
}

function climbFrame(g, x, y, s) {
  g.strokeStyle = '#3b3f45';
  g.lineWidth = 3 * s;
  const h = 80 * s;
  g.beginPath();
  g.moveTo(x - 30 * s, y); g.lineTo(x - 30 * s, y - h);
  g.moveTo(x + 30 * s, y); g.lineTo(x + 30 * s, y - h);
  g.moveTo(x - 34 * s, y - h); g.lineTo(x + 34 * s, y - h);
  g.stroke();
  g.strokeStyle = '#b08a52';
  g.lineWidth = 2.2 * s;
  for (const dx of [-12, 8]) {
    g.beginPath();
    g.moveTo(x + dx * s, y - h);
    g.quadraticCurveTo(x + (dx + 3) * s, y - h / 2, x + dx * s, y - 8 * s);
    g.stroke();
  }
}

function target(g, x, y, s) {
  g.fillStyle = '#5b4632';
  g.fillRect(x - 2 * s, y - 30 * s, 4 * s, 30 * s);
  const r = 13 * s;
  [['#f3f4f6', 1], ['#111827', 0.75], ['#f3f4f6', 0.5], ['#dc2626', 0.25]].forEach(([c, k]) => {
    g.fillStyle = c;
    g.beginPath(); g.arc(x, y - 38 * s, r * k, 0, TAU); g.fill();
  });
}

function rack(g, x, y, s) {
  g.strokeStyle = '#1f2328';
  g.lineWidth = 5 * s;
  g.beginPath();
  g.moveTo(x - 26 * s, y); g.lineTo(x - 20 * s, y - 110 * s);
  g.moveTo(x + 26 * s, y); g.lineTo(x + 20 * s, y - 110 * s);
  g.moveTo(x - 30 * s, y); g.lineTo(x + 30 * s, y);
  g.stroke();
  for (let i = 0; i < 3; i++) {
    const py = y - 24 * s - i * 30 * s;
    g.fillStyle = '#383c42';
    g.fillRect(x - 24 * s, py - 2 * s, 48 * s, 4 * s);
    for (const dx of [-14, 14]) {
      g.fillStyle = ['#b91c1c', '#1d4ed8', '#15803d'][i];
      rr(g, x + dx * s - 4 * s, py - 13 * s, 8 * s, 22 * s, 2 * s);
      g.fill();
    }
  }
}

function sandbags(g, x, y, s) {
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4 - row; i++) {
      const bx = x + (i - (3 - row) / 2) * 30 * s;
      const by = y - row * 14 * s;
      g.fillStyle = row % 2 ? '#8a7b57' : '#7b6c4a';
      g.beginPath(); g.ellipse(bx, by - 7 * s, 16 * s, 8 * s, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(40,30,15,.4)';
      g.lineWidth = 1;
      g.stroke();
    }
  }
}

function messHall(g, W, H, { fy, s }) {
  const wallEnd = fy - 120 * s;
  const panel = wallEnd - 70 * s;
  let gr = g.createLinearGradient(0, 0, 0, panel);
  gr.addColorStop(0, '#2c3a32');
  gr.addColorStop(1, '#46594a');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, panel);
  // wood panelling
  gr = g.createLinearGradient(0, panel, 0, wallEnd);
  gr.addColorStop(0, '#6b4728');
  gr.addColorStop(1, '#4a3019');
  g.fillStyle = gr;
  g.fillRect(0, panel, W, wallEnd - panel);
  g.strokeStyle = 'rgba(0,0,0,.25)';
  g.lineWidth = 1.5;
  for (let x = 0; x < W; x += 28 * s) { g.beginPath(); g.moveTo(x, panel); g.lineTo(x, wallEnd); g.stroke(); }
  g.fillStyle = '#3a2512';
  g.fillRect(0, panel - 5 * s, W, 6 * s);
  // windows with evening sky
  const wy = H * 0.12;
  const wh = Math.max(36, (panel - wy) * 0.5);
  const ww = 64 * s;
  for (let x = W * 0.04; x < W; x += W > 700 ? W * 0.3 : W * 0.5) {
    gr = g.createLinearGradient(0, wy, 0, wy + wh);
    gr.addColorStop(0, '#24365a');
    gr.addColorStop(1, '#d28a5a');
    g.fillStyle = gr;
    g.fillRect(x, wy, ww, wh);
    g.strokeStyle = '#2a1a0c';
    g.lineWidth = 4;
    g.strokeRect(x, wy, ww, wh);
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(x + ww / 2, wy); g.lineTo(x + ww / 2, wy + wh); g.moveTo(x, wy + wh / 2); g.lineTo(x + ww, wy + wh / 2); g.stroke();
  }
  // menu board
  const mx = W * 0.63;
  const my = H * 0.13;
  const mw = Math.min(170 * s, W * 0.3);
  const mh = mw * 0.62;
  g.fillStyle = '#5a3a1e';
  rr(g, mx - 5, my - 5, mw + 10, mh + 10, 6); g.fill();
  g.fillStyle = '#1e2a24';
  g.fillRect(mx, my, mw, mh);
  g.fillStyle = 'rgba(240,240,230,.85)';
  g.font = `800 ${Math.round(14 * s)}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.fillText('TODAY', mx + mw / 2, my + 20 * s);
  g.font = `600 ${Math.round(10 * s)}px system-ui, sans-serif`;
  ['Bean soup', 'Bread & cheese', 'Beef stew'].forEach((t, i) => g.fillText(t, mx + mw / 2, my + (38 + i * 15) * s));
  // clock
  const cx = W * 0.42;
  const cy = H * 0.16;
  g.fillStyle = '#f1ead8';
  g.beginPath(); g.arc(cx, cy, 15 * s, 0, TAU); g.fill();
  g.strokeStyle = '#3a2512'; g.lineWidth = 3 * s; g.stroke();
  g.lineWidth = 2 * s;
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 7 * s, cy - 6 * s); g.moveTo(cx, cy); g.lineTo(cx, cy - 11 * s); g.stroke();
  // serving counter with pots
  const ky = wallEnd - 4 * s;
  g.fillStyle = '#8f99a6';
  g.fillRect(W * 0.55, ky - 44 * s, W * 0.45, 44 * s);
  g.fillStyle = '#c3cbd5';
  g.fillRect(W * 0.55, ky - 48 * s, W * 0.45, 6 * s);
  for (const k of [0.62, 0.75, 0.88]) pot(g, W * k, ky - 48 * s, s);
  // floor tiles
  const ty = wallEnd + 28 * s;
  gr = g.createLinearGradient(0, wallEnd, 0, H);
  gr.addColorStop(0, '#5a4c3c');
  gr.addColorStop(1, '#241c14');
  g.fillStyle = gr;
  g.fillRect(0, wallEnd, W, H - wallEnd);
  g.fillStyle = 'rgba(0,0,0,.16)';
  const rows = 9;
  for (let r = 0; r < rows; r++) {
    const y0 = wallEnd + ((H - wallEnd) * r * r) / (rows * rows);
    const y1 = wallEnd + ((H - wallEnd) * (r + 1) * (r + 1)) / (rows * rows);
    const tw = 26 * s * (1 + r * 0.5);
    for (let x = (r % 2) * tw; x < W; x += tw * 2) g.fillRect(x, y0, tw, y1 - y0);
  }
  // other diners at a back table
  for (const k of [0.08, 0.2, 0.32, 0.8, 0.92]) diner(g, W * k, ty, s * 0.8);
  g.fillStyle = '#5d3d20';
  g.fillRect(0, ty, W * 0.42, 10 * s);
  g.fillRect(W * 0.72, ty, W * 0.28, 10 * s);
  // pendant lamps
  for (const k of [0.25, 0.75]) {
    const lx = W * k;
    g.strokeStyle = '#111';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(lx, 0); g.lineTo(lx, H * 0.07); g.stroke();
    g.fillStyle = '#1f2937';
    g.beginPath(); g.moveTo(lx - 16 * s, H * 0.07 + 12 * s); g.lineTo(lx - 6 * s, H * 0.07); g.lineTo(lx + 6 * s, H * 0.07); g.lineTo(lx + 16 * s, H * 0.07 + 12 * s); g.closePath(); g.fill();
    glow(g, lx, H * 0.07 + 14 * s, 160 * s, 'rgba(255,200,120,.22)');
  }
}

function pot(g, x, y, s) {
  g.fillStyle = '#5b6470';
  rr(g, x - 18 * s, y - 24 * s, 36 * s, 24 * s, 4 * s); g.fill();
  g.fillStyle = '#7b8592';
  g.fillRect(x - 20 * s, y - 26 * s, 40 * s, 4 * s);
}

function diner(g, x, y, s) {
  g.fillStyle = '#2b3528';
  g.beginPath(); g.ellipse(x, y - 14 * s, 20 * s, 18 * s, 0, Math.PI, TAU); g.fill();
  g.fillRect(x - 20 * s, y - 14 * s, 40 * s, 14 * s);
  g.fillStyle = '#3a2c22';
  g.beginPath(); g.arc(x, y - 42 * s, 11 * s, 0, TAU); g.fill();
}

// ------------------------------------------------------------ the citizen
// Angles are measured from straight down, positive = away from the body, π = straight up.
// P: { la, ra, ll, rl: [upper, lower] angles, seated, lean }; feet stand on y = 0 unless seated.
const UP = 31;
const FORE = 29;
const THIGH = 44;
const SHIN = 42;

// k shortens the upper arm when the elbow comes towards the viewer (bringing a spoon to the mouth).
function limb(x, y, sgn, [a, b, k = 1], l1, l2) {
  const ex = x + sgn * Math.sin(a) * l1 * k;
  const ey = y + Math.cos(a) * l1 * k;
  return { e: { x: ex, y: ey }, h: { x: ex + sgn * Math.sin(b) * l2, y: ey + Math.cos(b) * l2 } };
}

function seg(g, a, b, w, col) {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
}

// Returns the hands and head in screen coordinates (for props and particles).
export function drawPerson(g, x, y, s, P, look) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  // place the hips so the lower foot touches the floor
  const legs = [[-1, P.ll], [1, P.rl]].map(([sgn, ang]) => ({ sgn, ...limb(sgn * 10, 0, sgn, ang, THIGH, SHIN) }));
  const hipY = P.seated ? -63 : -Math.max(...legs.map((l) => l.h.y)) - 6;
  const shY = hipY - 52;
  const out = {};
  if (!P.seated) {
    for (const l of legs) {
      const hip = { x: l.sgn * 10, y: hipY };
      const knee = { x: l.e.x, y: l.e.y + hipY };
      const foot = { x: l.h.x, y: l.h.y + hipY };
      seg(g, hip, knee, 16, look.pants);
      seg(g, knee, foot, look.shorts ? 11 : 14, look.shorts ? look.skin : look.pants);
      g.fillStyle = look.shoes;
      g.beginPath(); g.ellipse(foot.x + l.sgn * 3, foot.y + 3, 10, 5, 0, 0, TAU); g.fill();
    }
    if (look.shorts) {
      g.fillStyle = look.pants;
      rr(g, -20, hipY - 6, 40, 26, 6); g.fill();
    }
  }
  // torso
  g.fillStyle = look.pants;
  rr(g, -19, hipY - 8, 38, 16, 6); g.fill();
  const tg = g.createLinearGradient(-24, 0, 24, 0);
  tg.addColorStop(0, look.shirt);
  tg.addColorStop(1, look.shirt2);
  if (look.tank) { // bare shoulders under a tank top
    g.fillStyle = look.skin;
    rr(g, -24, shY - 3, 48, 22, 10); g.fill();
  }
  g.fillStyle = tg;
  g.beginPath();
  const sw = look.tank ? 16 : 24;
  g.moveTo(-sw, shY + (look.tank ? 4 : 0));
  g.quadraticCurveTo(0, shY - 5, sw, shY + (look.tank ? 4 : 0));
  g.lineTo(18, hipY - 4);
  g.lineTo(-18, hipY - 4);
  g.closePath();
  g.fill();
  if (look.vest) {
    g.fillStyle = '#f97316';
    g.beginPath();
    g.moveTo(-21, shY + 4); g.lineTo(-8, shY + 2); g.lineTo(-6, hipY - 4); g.lineTo(-18, hipY - 4); g.closePath();
    g.moveTo(21, shY + 4); g.lineTo(8, shY + 2); g.lineTo(6, hipY - 4); g.lineTo(18, hipY - 4); g.closePath();
    g.fill();
    g.fillStyle = 'rgba(230,240,240,.9)';
    g.fillRect(-20, hipY - 22, 13, 4);
    g.fillRect(7, hipY - 22, 13, 4);
  }
  if (look.patch) {
    g.fillStyle = look.patch;
    rr(g, 8, shY + 10, 9, 7, 1.5); g.fill();
  }
  // neck and head
  g.fillStyle = look.skin;
  g.fillRect(-5, shY - 12, 10, 12);
  const hx = (P.lean || 0) * 8;
  const hy = shY - 26;
  g.fillStyle = look.skin;
  g.beginPath(); g.ellipse(hx - 13, hy + 2, 3.5, 5, 0, 0, TAU); g.ellipse(hx + 13, hy + 2, 3.5, 5, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(hx, hy, 13.5, 16, 0, 0, TAU); g.fill();
  if (look.hat) {
    g.fillStyle = '#facc15';
    g.beginPath(); g.ellipse(hx, hy - 7, 15, 13, 0, Math.PI, TAU); g.fill();
    g.fillRect(hx - 19, hy - 8, 38, 4);
    g.fillStyle = 'rgba(255,255,255,.35)';
    g.fillRect(hx - 2, hy - 19, 4, 11);
  } else {
    g.fillStyle = look.hair;
    g.beginPath(); g.ellipse(hx, hy - 7, 14, 10, 0, Math.PI * 1.02, TAU - 0.02); g.fill();
    g.fillRect(hx - 14, hy - 8, 4, 8);
    g.fillRect(hx + 10, hy - 8, 4, 8);
  }
  g.fillStyle = '#1f2937';
  const blink = P.blink ? 0.6 : 2.2;
  g.fillRect(hx - 6.5, hy + 1, 3, blink);
  g.fillRect(hx + 3.5, hy + 1, 3, blink);
  g.strokeStyle = 'rgba(60,30,20,.75)';
  g.lineWidth = 1.6;
  if (P.mouth) { g.fillStyle = '#5b2a1e'; g.beginPath(); g.ellipse(hx, hy + 9, 3.2, 2.6 * P.mouth, 0, 0, TAU); g.fill(); }
  else if (P.strain) { g.beginPath(); g.moveTo(hx - 4, hy + 9); g.lineTo(hx + 4, hy + 9); g.stroke(); }
  else { g.beginPath(); g.arc(hx, hy + 6, 4, 0.3, Math.PI - 0.3); g.stroke(); }
  out.head = { x: x + hx * s, y: y + hy * s };
  // arms in front of the body
  for (const [sgn, ang, key] of [[-1, P.la, 'lh'], [1, P.ra, 'rh']]) {
    const sh = { x: sgn * 20, y: shY + 5 };
    const { e, h } = limb(sh.x, sh.y, sgn, ang, UP, FORE);
    seg(g, sh, e, 13, look.tank ? look.skin : look.sleeve || look.shirt);
    seg(g, e, h, 10.5, look.skin);
    g.fillStyle = look.skin;
    g.beginPath(); g.arc(h.x, h.y, 6.2, 0, TAU); g.fill();
    out[key] = { x: x + h.x * s, y: y + h.y * s, a: sgn * Math.sin(ang[1]), b: Math.cos(ang[1]) };
  }
  g.restore();
  return out;
}

// ------------------------------------------------------------ props
// dir: the handle's direction (0 = down, π/2 = to the right, π = up).
export function drawHammer(g, h, s, dir) {
  h = { ...h, a: Math.sin(dir), b: Math.cos(dir) };
  const len = 27 * s;
  const ex = h.x + h.a * len;
  const ey = h.y + h.b * len;
  g.strokeStyle = '#8b5a2b';
  g.lineWidth = 5 * s;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(h.x - h.a * 6 * s, h.y - h.b * 6 * s); g.lineTo(ex, ey); g.stroke();
  // head across the handle
  g.save();
  g.translate(ex, ey);
  g.rotate(Math.atan2(h.b, h.a));
  const gr = g.createLinearGradient(0, -8 * s, 0, 8 * s);
  gr.addColorStop(0, '#d1d5db');
  gr.addColorStop(1, '#4b5563');
  g.fillStyle = gr;
  rr(g, -5 * s, -11 * s, 14 * s, 22 * s, 3 * s); g.fill();
  g.restore();
  return { x: ex, y: ey };
}

export function drawBench(g, cx, fy, s, glowK) {
  const top = fy - 92 * s;
  const w = 220 * s;
  g.fillStyle = '#2a2f37';
  g.fillRect(cx - w / 2 + 10 * s, top + 10 * s, 12 * s, fy - top - 10 * s);
  g.fillRect(cx + w / 2 - 22 * s, top + 10 * s, 12 * s, fy - top - 10 * s);
  g.fillRect(cx - w / 2 + 10 * s, fy - 34 * s, w - 20 * s, 6 * s);
  const gr = g.createLinearGradient(0, top, 0, top + 16 * s);
  gr.addColorStop(0, '#7b8794');
  gr.addColorStop(1, '#3f4752');
  g.fillStyle = gr;
  rr(g, cx - w / 2, top, w, 16 * s, 3 * s); g.fill();
  // the hot workpiece
  const px = cx + 4 * s;
  g.fillStyle = '#474d57';
  g.fillRect(px - 26 * s, top - 7 * s, 52 * s, 7 * s);
  const k = 0.35 + glowK * 0.65;
  g.fillStyle = `rgba(255,${Math.round(120 + 90 * k)},60,${k})`;
  g.fillRect(px - 16 * s, top - 7 * s, 32 * s, 4 * s);
  glow(g, px, top - 4 * s, 40 * s, `rgba(255,140,40,${(0.25 + 0.4 * glowK).toFixed(2)})`);
  // a vice on the left end
  g.fillStyle = '#1f3b63';
  g.fillRect(cx - w / 2 + 14 * s, top - 18 * s, 26 * s, 18 * s);
  g.fillStyle = '#94a3b8';
  g.fillRect(cx - w / 2 + 10 * s, top - 22 * s, 34 * s, 5 * s);
  return { x: px, y: top - 6 * s };
}

export function drawCrate(g, x, y, s, label) {
  const w = 34 * s;
  g.fillStyle = '#9a7445';
  g.fillRect(x - w / 2, y - w, w, w);
  g.strokeStyle = 'rgba(60,40,20,.7)';
  g.lineWidth = 2 * s;
  g.strokeRect(x - w / 2, y - w, w, w);
  g.beginPath(); g.moveTo(x - w / 2, y - w); g.lineTo(x + w / 2, y); g.stroke();
  if (label) {
    g.font = `${Math.round(15 * s)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText(label, x, y - w * 0.3);
  }
}

export function drawBarbell(g, lh, rh, s, plates) {
  const ext = 52 * s;
  const dx = rh.x - lh.x;
  const dy = rh.y - lh.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const a = { x: lh.x - ux * ext, y: lh.y - uy * ext };
  const b = { x: rh.x + ux * ext, y: rh.y + uy * ext };
  g.strokeStyle = '#c0c6cf';
  g.lineWidth = 4 * s;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  for (const [p, sgn] of [[a, 1], [b, -1]]) {
    plates.forEach((col, i) => {
      const off = (8 + i * 9) * s * sgn;
      const h = (46 - i * 6) * s;
      g.fillStyle = col;
      rr(g, p.x + ux * off - 4 * s, p.y + uy * off - h / 2, 8 * s, h, 2.5 * s);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.18)';
      g.fillRect(p.x + ux * off - 4 * s, p.y + uy * off - h / 2, 2 * s, h);
    });
  }
}

export function drawFlag(g, rec, x, y, s, t) {
  g.strokeStyle = '#d1d5db';
  g.lineWidth = 3 * s;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 130 * s); g.stroke();
  if (!rec?.ready) return;
  const w = 54 * s;
  const h = 36 * s;
  const strips = 12;
  for (let i = 0; i < strips; i++) {
    const k = i / strips;
    const off = Math.sin(t * 4 - k * 5) * 3 * s * k;
    g.drawImage(rec.img, (rec.img.width * i) / strips, 0, rec.img.width / strips + 1, rec.img.height, x + w * k, y - 128 * s + off, w / strips + 1, h);
  }
}

export function drawTable(g, cx, fy, s, W) {
  const top = fy - 70 * s;
  const gr = g.createLinearGradient(0, top, 0, top + 18 * s);
  gr.addColorStop(0, '#8a5a32');
  gr.addColorStop(1, '#5a3a1e');
  g.fillStyle = gr;
  g.fillRect(cx - Math.min(W * 0.48, 260 * s), top, Math.min(W * 0.96, 520 * s), 18 * s);
  g.fillStyle = '#3a2512';
  g.fillRect(cx - Math.min(W * 0.48, 260 * s), top + 18 * s, Math.min(W * 0.96, 520 * s), fy - top);
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.fillRect(cx - Math.min(W * 0.48, 260 * s), top + 18 * s, Math.min(W * 0.96, 520 * s), 8 * s);
  return top;
}

// Tray with a plate of the best food in stock; k = how much is left (0..1).
export function drawTray(g, cx, top, s, q, k) {
  g.fillStyle = '#9aa5b1';
  rr(g, cx - 70 * s, top - 6 * s, 140 * s, 10 * s, 3 * s); g.fill();
  g.fillStyle = '#f8fafc';
  g.beginPath(); g.ellipse(cx + 6 * s, top - 7 * s, 40 * s, 9 * s, 0, 0, TAU); g.fill();
  g.fillStyle = '#e2e8f0';
  g.beginPath(); g.ellipse(cx + 6 * s, top - 8 * s, 30 * s, 6 * s, 0, 0, TAU); g.fill();
  const cols = [null, '#d6a35c', '#c98a3c', '#a5522a', '#8b3a1e', '#7a2d14'];
  if (q && k > 0.02) {
    g.fillStyle = cols[q];
    g.beginPath(); g.ellipse(cx + 6 * s, top - 10 * s, 24 * s * (0.4 + 0.6 * k), (5 + 7 * k) * s, 0, Math.PI, TAU); g.fill();
    if (q >= 3) { // a stew gets vegetables
      g.fillStyle = '#16a34a';
      g.beginPath(); g.arc(cx - 2 * s, top - 13 * s * k, 2.5 * s, 0, TAU); g.arc(cx + 14 * s, top - 12 * s * k, 2.2 * s, 0, TAU); g.fill();
      g.fillStyle = '#f97316';
      g.beginPath(); g.arc(cx + 6 * s, top - 15 * s * k, 2.4 * s, 0, TAU); g.fill();
    }
  }
  // cup and bread
  g.fillStyle = '#e5e7eb';
  rr(g, cx + 52 * s, top - 26 * s, 14 * s, 20 * s, 3 * s); g.fill();
  g.fillStyle = '#c08a4a';
  g.beginPath(); g.ellipse(cx - 50 * s, top - 9 * s, 13 * s, 7 * s, 0, 0, TAU); g.fill();
  return { x: cx + 6 * s, y: top - 12 * s };
}

export function drawSpoon(g, h, s) {
  g.strokeStyle = '#cbd5e1';
  g.lineWidth = 2.6 * s;
  g.lineCap = 'round';
  const ex = h.x - h.a * 4 * s + 12 * s * (h.a >= 0 ? -0.6 : 0.6);
  const ey = h.y - 14 * s;
  g.beginPath(); g.moveTo(h.x, h.y); g.lineTo(ex, ey); g.stroke();
  g.fillStyle = '#e2e8f0';
  g.beginPath(); g.ellipse(ex, ey, 4 * s, 2.6 * s, 0, 0, TAU); g.fill();
}
