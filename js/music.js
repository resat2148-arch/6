// Background music synthesized with WebAudio, so the game still ships without audio files:
// "Homeland", a calm D-minor theme for menus and the map, and "Front Line", a march for battles.
import { audioCtx, onAudioUnlock, isMuted } from './sfx.js';

const KEY = 'republic-rising-music';
const VOL = 0.3; // under the sound effects
const LOOKAHEAD = 0.5; // seconds of music scheduled ahead of the clock
const FADE = 1.2;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

// Bass note and three pad notes of each chord (MIDI numbers).
const CH = {
  Dm: { b: 38, p: [57, 62, 65] },
  Bb: { b: 34, p: [58, 62, 65] },
  F: { b: 41, p: [57, 60, 65] },
  C: { b: 36, p: [55, 60, 64] },
  Gm: { b: 43, p: [55, 58, 62] },
  A: { b: 33, p: [57, 61, 64] },
};

// ------------------------------------------------------------------ instruments
// Each voice writes into o.out (dry) and, by its `wet` share, into o.send (reverb).
function voice(o, g, wet) {
  g.connect(o.out);
  if (wet) {
    const s = o.c.createGain();
    s.gain.value = wet;
    g.connect(s).connect(o.send);
  }
}

function osc(o, type, m, t, end, detune = 0) {
  const s = o.c.createOscillator();
  s.type = type;
  s.frequency.value = mtof(m);
  s.detune.value = detune;
  s.start(t);
  s.stop(end);
  return s;
}

function adsr(o, t, a, vol, hold, rel) {
  const g = o.c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.setValueAtTime(vol, t + Math.max(a, hold));
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, hold) + rel);
  return g;
}

function lowpass(o, freq, q = 0.5) {
  const f = o.c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

const I = {
  // Warm strings: two detuned saws, slow swell, long tail into the next chord.
  pad(o, t, m, dur, vol) {
    const g = adsr(o, t, 0.9, vol, dur, 1.4);
    const f = lowpass(o, 1000);
    for (const d of [-8, 8]) osc(o, 'sawtooth', m, t, t + dur + 1.5, d).connect(f);
    f.connect(g);
    voice(o, g, 0.7);
  },
  pluck(o, t, m, vol) {
    const g = o.c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    osc(o, 'triangle', m, t, t + 1.2).connect(g);
    const h = o.c.createGain();
    h.gain.value = 0.3;
    osc(o, 'sine', m + 12, t, t + 1.2).connect(h).connect(g);
    voice(o, g, 0.6);
  },
  bass(o, t, m, dur, vol, saw = false) {
    const g = adsr(o, t, 0.02, vol, dur * 0.8, dur * 0.4 + 0.1);
    const f = lowpass(o, saw ? 320 : 600, saw ? 2 : 0.5);
    osc(o, saw ? 'sawtooth' : 'triangle', m, t, t + dur + 0.6).connect(f);
    osc(o, 'sine', m, t, t + dur + 0.6).connect(g);
    f.connect(g);
    voice(o, g, 0.1);
  },
  // Flute-like lead for the calm theme, French horn for the march.
  lead(o, t, m, dur, vol, horn = false) {
    const g = adsr(o, t, horn ? 0.07 : 0.16, vol, dur, horn ? 0.3 : 0.6);
    const f = lowpass(o, horn ? 500 : 2400, horn ? 1.2 : 0.4);
    if (horn) {
      f.frequency.setValueAtTime(500, t);
      f.frequency.linearRampToValueAtTime(2200, t + 0.12);
      f.frequency.linearRampToValueAtTime(1300, t + 0.4);
    }
    const lfo = o.c.createOscillator();
    lfo.frequency.value = 5.2;
    const depth = o.c.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(horn ? 7 : 11, t + 0.35);
    lfo.connect(depth);
    lfo.start(t);
    lfo.stop(t + dur + 0.8);
    const voices = horn ? [['sawtooth', -5], ['sawtooth', 5]] : [['triangle', 0], ['sine', 3]];
    for (const [type, d] of voices) {
      const s = osc(o, type, m, t, t + dur + 0.8, d);
      depth.connect(s.detune);
      s.connect(f);
    }
    f.connect(g);
    voice(o, g, 0.55);
  },
  staccato(o, t, m, vol) {
    const g = o.c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    const f = lowpass(o, 2600, 1);
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.12);
    osc(o, 'sawtooth', m, t, t + 0.16).connect(f).connect(g);
    voice(o, g, 0.25);
  },
  noise(o, t, dur, vol, type, freq, wet) {
    const src = o.c.createBufferSource();
    src.buffer = o.noise;
    const f = o.c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = o.c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g);
    src.start(t, Math.random() * 1.2);
    src.stop(t + dur + 0.02);
    voice(o, g, wet);
  },
  kick(o, t, vol) {
    const s = o.c.createOscillator();
    s.frequency.setValueAtTime(150, t);
    s.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    const g = o.c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    s.connect(g);
    s.start(t);
    s.stop(t + 0.4);
    voice(o, g, 0);
  },
  snare(o, t, vol) {
    I.noise(o, t, 0.17, vol, 'bandpass', 2200, 0.25);
    const g = o.c.createGain();
    g.gain.setValueAtTime(vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    const s = osc(o, 'triangle', 54, t, t + 0.1);
    s.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    s.connect(g);
    voice(o, g, 0.1);
  },
  hat: (o, t, vol) => I.noise(o, t, 0.045, vol, 'highpass', 7500, 0),
  crash: (o, t, vol) => I.noise(o, t, 1.6, vol, 'highpass', 4500, 0.5),
  timpani(o, t, m, vol) {
    const g = o.c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    const s = osc(o, 'sine', m, t, t + 1.6);
    s.frequency.setValueAtTime(mtof(m) * 1.06, t);
    s.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.12);
    s.connect(g);
    voice(o, g, 0.45);
    I.noise(o, t, 0.12, vol * 0.4, 'lowpass', 400, 0.3);
  },
};

// ------------------------------------------------------------------ the two themes
// A track schedules one whole bar at a time; `i` counts bars since the track started.
const HOMELAND = {
  bpm: 76,
  chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Gm', 'Bb', 'A'],
  // [16th step, note, length in 16ths] per bar, for the second half of the 16-bar loop.
  melody: [
    [[0, 69, 8], [8, 74, 4], [12, 76, 4]],
    [[0, 77, 12], [12, 76, 4]],
    [[0, 72, 8], [8, 69, 8]],
    [[0, 67, 12], [12, 64, 4]],
    [[0, 69, 4], [4, 74, 4], [8, 77, 4], [12, 81, 4]],
    [[0, 79, 8], [8, 77, 4], [12, 74, 4]],
    [[0, 74, 8], [8, 77, 8]],
    [[0, 76, 16]],
  ],
  bar(o, t, i, sp) {
    const pos = i % 16;
    const ch = CH[this.chords[pos % 8]];
    const dur = sp * 16;
    ch.p.forEach((m) => I.pad(o, t, m, dur, 0.035));
    I.bass(o, t, ch.b, dur * 0.95, 0.2);
    if (pos % 8 === 0) I.timpani(o, t, ch.b + 12, 0.32);
    if (i < 4) return; // the strings open alone
    const arp = [ch.p[0] + 12, ch.p[1] + 12, ch.p[2] + 12, ch.p[0] + 24];
    [0, 1, 2, 3, 2, 1, 2, 1].forEach((k, n) => I.pluck(o, t + n * sp * 2, arp[k], n % 4 === 0 ? 0.075 : 0.05));
    if (pos >= 8) for (const [s, m, len] of this.melody[pos - 8]) I.lead(o, t + s * sp, m, len * sp * 0.92, 0.075);
  },
};

const FRONT_LINE = {
  bpm: 132,
  chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A'],
  melody: [
    [[0, 62, 6], [6, 65, 2], [8, 69, 8]],
    [[0, 74, 8], [8, 72, 4], [12, 69, 4]],
    [[0, 70, 8], [8, 69, 4], [12, 65, 4]],
    [[0, 67, 12], [12, 64, 4]],
    [[0, 62, 6], [6, 65, 2], [8, 69, 8]],
    [[0, 74, 8], [8, 77, 8]],
    [[0, 74, 8], [8, 70, 8]],
    [[0, 69, 8], [8, 73, 8]],
  ],
  ostinato: [0, 0, 7, 0, 0, 7, 0, 12, 0, 0, 7, 0, 0, 7, 12, 7],
  bar(o, t, i, sp) {
    const at = (s) => t + s * sp;
    if (i === 0) { // a snare roll calls the troops
      for (let s = 0; s < 16; s++) I.snare(o, at(s), 0.03 + s * 0.012);
      I.timpani(o, t, 38, 0.3);
      I.timpani(o, at(12), 45, 0.3);
      return;
    }
    const pos = (i - 1) % 16;
    const ch = CH[this.chords[pos % 8]];
    const fill = pos % 8 === 7;
    if (pos % 8 === 0) I.crash(o, t, 0.07);
    if (pos % 4 === 0) I.timpani(o, t, ch.b + 12, 0.34);
    ch.p.forEach((m) => I.pad(o, t, m, sp * 16, 0.02));
    for (let s = 0; s < 16; s++) {
      I.staccato(o, at(s), ch.b + 24 + this.ostinato[s], s === 0 || s === 3 || s === 6 ? 0.09 : 0.055);
      if (s % 2 === 0) I.bass(o, at(s), ch.b, sp * 1.6, 0.15, true);
      if (s % 2 === 0) I.hat(o, at(s), s % 4 === 2 ? 0.035 : 0.02);
      if (s === 0 || s === 8 || (s === 10 && pos % 2)) I.kick(o, at(s), 0.42);
      if (fill && s >= 8) I.snare(o, at(s), 0.08 + (s - 8) * 0.025);
      else if (s === 4 || s === 12) I.snare(o, at(s), 0.2);
      else if (s === 15 || s === 7) I.snare(o, at(s), 0.05);
    }
    if (pos >= 8) for (const [s, m, len] of this.melody[pos - 8]) I.lead(o, at(s), m, len * sp * 0.9, 0.085, true);
    else I.lead(o, t, ch.p[2], sp * 15, 0.03, true);
  },
};

const TRACKS = { calm: HOMELAND, battle: FRONT_LINE };

// ------------------------------------------------------------------ output chain
function makeNoise(c) {
  const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// A hall: stereo noise decaying over ~2 s.
function makeReverb(c) {
  const len = Math.floor(c.sampleRate * 2.2);
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  const v = c.createConvolver();
  v.buffer = b;
  return v;
}

// music volume → compressor → dest, with a shared reverb.
function chain(c, dest) {
  const vol = c.createGain();
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 3;
  vol.connect(comp).connect(dest);
  const verb = makeReverb(c);
  const wet = c.createGain();
  wet.gain.value = 0.35;
  verb.connect(wet).connect(vol);
  return { c, vol, verb, noise: makeNoise(c) };
}

// ------------------------------------------------------------------ player
let enabled = (() => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } })();
let mood = 'calm';
let out = null; // the live chain
let cur = null; // { name, gain, bar, next }
let timer = 0;

function startTrack(name) {
  const { c } = out;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(1, c.currentTime + FADE);
  gain.connect(out.vol);
  const send = c.createGain();
  send.connect(out.verb);
  cur = { name, gain, send, bar: 0, next: c.currentTime + 0.08 };
}

function stopTrack() {
  if (!cur) return;
  const { c } = out;
  const { gain, send } = cur;
  gain.gain.cancelScheduledValues(c.currentTime);
  gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + FADE);
  send.gain.setTargetAtTime(0, c.currentTime, FADE / 3);
  setTimeout(() => { gain.disconnect(); send.disconnect(); }, (FADE + 5) * 1000); // after the last scheduled bar rings out
  cur = null;
}

function pump() {
  const { c } = out;
  if (c.state !== 'running') return;
  if (!enabled || isMuted()) { stopTrack(); return; } // silent music costs nothing
  if (cur && cur.name !== mood) stopTrack();
  if (!cur) startTrack(mood);
  const track = TRACKS[cur.name];
  const sp = 60 / track.bpm / 4;
  if (cur.next < c.currentTime) cur.next = c.currentTime + 0.05; // the page stalled: skip, never rush
  while (cur.next < c.currentTime + LOOKAHEAD) {
    track.bar({ c, out: cur.gain, send: cur.send, noise: out.noise }, cur.next, cur.bar++, sp);
    cur.next += sp * 16;
  }
}

function boot() {
  const a = audioCtx();
  if (!a || out) return;
  out = chain(a.ctx, a.master);
  out.vol.gain.value = VOL;
  timer = setInterval(pump, 150);
  pump();
}
onAudioUnlock(boot);

export const musicOn = () => enabled;

export function setMusic(on) {
  enabled = on;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
  if (out) pump();
}

// 'calm' on menus and the map, 'battle' at the front.
export function setMood(m) {
  mood = m;
  if (out) pump();
}

// Renders a theme without the live context (store previews and level checks).
export async function renderTheme(name, seconds, sampleRate = 44100) {
  const c = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const o = chain(c, c.destination);
  o.vol.gain.value = VOL * 0.5; // the in-game level (sound effects master is 0.5)
  const send = c.createGain();
  send.connect(o.verb);
  const track = TRACKS[name];
  const sp = 60 / track.bpm / 4;
  for (let i = 0, t = 0.05; t < seconds; i++, t += sp * 16) track.bar({ c, out: o.vol, send, noise: o.noise }, t, i, sp);
  return c.startRendering();
}

export const debugMusic = () => ({ enabled, mood, playing: cur?.name || null, bar: cur?.bar || 0, timer: !!timer });
