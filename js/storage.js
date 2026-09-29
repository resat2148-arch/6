// Layered save system so progress survives closing the tab, a killed mobile browser or a corrupt write.
// There are SLOTS separate careers; each has:
//  1. Local: a localStorage main key + a rotating backup key (written first, read on every start).
//  2. CrazyGames data module (cloud sync for signed-in players) via sdk.js.
//  3. Hosted preview cloud: the viewer's private document per slot in the page's `db` capability.
// On start the device save and the cloud save of a slot are read and the newest valid one wins;
// the backup is used only when the device save is unreadable.
import * as SDK from './sdk.js';

export const SLOTS = 3;
const BASE = 'republic-rising-save-v1';
const LAST_SLOT = 'republic-rising-last-slot';
const keyOf = (n) => `${BASE}-slot${n}`;
const bakOf = (n) => `${keyOf(n)}-bak`;
const CLOUD_INTERVAL_MS = 15000;
const CLOUD_MAX_BYTES = 240000;

let slot = 1;
let cloud = null; // { db, id } when the hosted `db` store is usable
let cloudPending = null; // { slot, json }
let cloudTimer = 0;
let lastCloud = 0;
let lastBackup = 0;

export const status = { lastSave: 0, lastCloud: 0, cloud: false, cloudError: '' };

const parse = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && v.player ? v : null;
  } catch { return null; }
};

const localGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const localSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
const cloudRef = (n) => (cloud ? cloud.db.doc(`data/users/${cloud.id}/save${n}`) : null);

// Which career every save call writes to. Pending cloud writes of the previous career go out first.
export function setSlot(n) {
  if (n !== slot) flushCloud();
  slot = n;
  lastBackup = 0;
  localSet(LAST_SLOT, String(n));
}
export const currentSlot = () => slot;
export const lastPlayedSlot = () => Number(localGet(LAST_SLOT)) || 0;

// Hosted preview only: resolves quickly to false everywhere else (e.g. on CrazyGames).
export async function initCloud(timeoutMs = 4000) {
  const use = window.claude?.use;
  if (typeof use !== 'function') return false;
  const attempt = (async () => {
    const [db, user] = await Promise.all([use('db'), use('user')]);
    if (!db || !user) return null;
    const id = await user.id();
    if (!id) return null;
    return { db, id };
  })().catch(() => null);
  cloud = await Promise.race([attempt, new Promise((r) => setTimeout(() => r(null), timeoutMs))]);
  status.cloud = !!cloud;
  return status.cloud;
}

// Before careers existed there was a single save: it becomes career 1 (device and cloud copies).
export async function migrateSingleSave() {
  const oldDevice = parse(await SDK.loadData(BASE)) || parse(localGet(BASE));
  let oldCloud = null;
  if (cloud) {
    try {
      const snap = await cloud.db.doc(`data/users/${cloud.id}/save`).get();
      if (snap.exists) oldCloud = parse(snap.data().save);
    } catch { /* keep going without it */ }
  }
  const old = [oldDevice, oldCloud].filter(Boolean).sort((a, b) => (b.lastTick || 0) - (a.lastTick || 0))[0];
  if (!old) return false;
  const existing = await loadCandidates(1);
  if (!existing.length) {
    const json = JSON.stringify(old);
    SDK.saveData(keyOf(1), json);
    localSet(keyOf(1), json);
    const bak = localGet(`${BASE}-bak`);
    if (parse(bak)) localSet(bakOf(1), bak);
    if (cloud) await cloudRef(1).set({ save: shrink(json), at: Date.now() }).catch(() => {});
    if (!lastPlayedSlot()) localSet(LAST_SLOT, '1');
  }
  SDK.removeData(BASE);
  try { localStorage.removeItem(BASE); localStorage.removeItem(`${BASE}-bak`); } catch { /* ignore */ }
  if (cloud) cloud.db.doc(`data/users/${cloud.id}/save`).delete().catch(() => {});
  return true;
}

// All readable saves of one career, newest first.
export async function loadCandidates(n = slot) {
  const found = [];
  const add = (raw, source) => { const v = parse(raw); if (v) found.push({ save: v, source }); };
  add(await SDK.loadData(keyOf(n)), 'device');
  add(localGet(keyOf(n)), 'device');
  // The backup only stands in for a damaged or missing main save.
  if (!found.length) add(localGet(bakOf(n)), 'backup');
  if (cloud) {
    try {
      const snap = await cloudRef(n).get();
      if (snap.exists) add(snap.data().save, 'cloud');
    } catch (e) { status.cloudError = e?.code || 'unavailable'; }
  }
  return found.sort((a, b) => (b.save.lastTick || 0) - (a.save.lastTick || 0));
}

// The newest save of every career (null for an empty slot), for the title screen.
export async function slotSummaries() {
  const out = [];
  for (let n = 1; n <= SLOTS; n++) out.push({ slot: n, ...((await loadCandidates(n))[0] || { save: null }) });
  return out;
}

export function saveNow(state) {
  if (!state) return;
  let json;
  try { json = JSON.stringify(state); } catch (e) { console.warn('save failed', e); return; }
  const now = Date.now();
  const key = keyOf(slot);
  // Keep the previous good save as a backup before overwriting the main key.
  if (now - lastBackup > 60000 || !localGet(bakOf(slot))) {
    const prev = localGet(key);
    if (parse(prev)) localSet(bakOf(slot), prev);
    lastBackup = now;
  }
  SDK.saveData(key, json);
  localSet(key, json);
  status.lastSave = now;
  queueCloud(json);
}

function shrink(json) {
  if (json.length <= CLOUD_MAX_BYTES) return json;
  const s = JSON.parse(json);
  s.feed = (s.feed || []).slice(0, 8);
  s.articles = (s.articles || []).slice(0, 12);
  return JSON.stringify(s);
}

function queueCloud(json) {
  if (!cloud) return;
  cloudPending = { slot, json };
  const wait = lastCloud + CLOUD_INTERVAL_MS - Date.now();
  if (wait <= 0) flushCloud();
  else if (!cloudTimer) cloudTimer = setTimeout(flushCloud, wait);
}

export function flushCloud() {
  clearTimeout(cloudTimer);
  cloudTimer = 0;
  if (!cloud || !cloudPending) return;
  const { slot: n, json } = cloudPending;
  cloudPending = null;
  lastCloud = Date.now();
  cloudRef(n).set({ save: shrink(json), at: lastCloud }).then(() => {
    status.lastCloud = Date.now();
    status.cloudError = '';
  }).catch((e) => {
    status.cloudError = e?.code || 'unavailable';
    // No write access or the store is gone: keep saving on this device only.
    if (['invalid_argument', 'not_granted', 'revoked', 'capability_disabled', 'capability_removed'].includes(e?.code)) {
      cloud = null;
      status.cloud = false;
    }
  });
}

export function wipe(n = slot) {
  if (cloudPending?.slot === n) cloudPending = null;
  SDK.removeData(keyOf(n));
  try { localStorage.removeItem(keyOf(n)); localStorage.removeItem(bakOf(n)); } catch { /* ignore */ }
  if (cloud) cloudRef(n).delete().catch(() => {});
  if (lastPlayedSlot() === n) { try { localStorage.removeItem(LAST_SLOT); } catch { /* ignore */ } }
}

// ---------------------------------------------------------------- backup codes (manual transfer)
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function exportCode(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  if (typeof CompressionStream === 'function') return 'RR1:' + b64(await pipe(bytes, new CompressionStream('gzip')));
  return 'RR0:' + b64(bytes);
}

export async function importCode(code) {
  const c = String(code || '').trim().replace(/\s+/g, '');
  let bytes;
  if (c.startsWith('RR1:')) {
    if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot read compressed codes.');
    bytes = await pipe(unb64(c.slice(4)), new DecompressionStream('gzip'));
  } else if (c.startsWith('RR0:')) bytes = unb64(c.slice(4));
  else throw new Error('That is not a Republic Rising backup code.');
  const save = parse(new TextDecoder().decode(bytes));
  if (!save) throw new Error('The backup code is damaged.');
  return save;
}
