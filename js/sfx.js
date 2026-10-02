// Tiny synthesized sound effects (WebAudio) so the game ships without audio assets.
let ctx = null;
let master = null;
let muted = false;
let noiseBuf = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

let onUnlock = null;
export function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended' && !document.hidden) c.resume().catch(() => {});
  onUnlock?.();
}

// The background music shares the context and master volume; it starts on the first tap.
export function onAudioUnlock(cb) { onUnlock = cb; }
export const audioCtx = () => (ctx ? { ctx, master } : null);

// Nothing plays while the game is in a background tab or app.
export function setHidden(h) {
  if (!ctx) return;
  if (h) ctx.suspend().catch(() => {});
  else ctx.resume().catch(() => {});
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}
export const isMuted = () => muted;

function tone(freq, dur, type = 'square', vol = 0.2, slide = 0, delay = 0) {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.3, freq = 1200, delay = 0) {
  const c = ensure();
  if (!c || muted) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(80, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur);
}

export const sfx = {
  click: () => tone(660, 0.05, 'square', 0.08),
  shot: () => { noise(0.12, 0.35, 2500); tone(140, 0.08, 'square', 0.1, -80); },
  hit: () => tone(900, 0.04, 'triangle', 0.12),
  head: () => { tone(1200, 0.05, 'triangle', 0.15); tone(1600, 0.06, 'triangle', 0.1, 0, 0.04); },
  kill: () => { tone(220, 0.15, 'sawtooth', 0.12, -120); noise(0.1, 0.15, 800); },
  hurt: () => { tone(120, 0.25, 'sawtooth', 0.2, -60); noise(0.2, 0.2, 600); },
  boom: () => { noise(0.6, 0.6, 900); tone(70, 0.5, 'sine', 0.4, -40); },
  coin: () => { tone(988, 0.07, 'square', 0.08); tone(1319, 0.12, 'square', 0.08, 0, 0.07); },
  error: () => tone(160, 0.15, 'square', 0.1, -40),
  work: () => { tone(330, 0.06, 'triangle', 0.12); tone(440, 0.08, 'triangle', 0.12, 0, 0.06); },
  eat: () => { tone(500, 0.05, 'sine', 0.15); tone(380, 0.07, 'sine', 0.15, 0, 0.07); },
  level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.1, 0, i * 0.09)),
  win: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, 0, i * 0.1)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, 0, i * 0.15)),
  alarm: () => { tone(700, 0.15, 'square', 0.08); tone(500, 0.15, 'square', 0.08, 0, 0.16); },
};
