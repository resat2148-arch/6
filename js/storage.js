// Layered save system so progress survives closing the tab, a killed mobile browser or a corrupt write.
//  1. Local: localStorage main slot + a rotating backup slot (written first, read on every start).
//  2. CrazyGames data module (cloud sync for signed-in players) via sdk.js.
//  3. Hosted preview cloud: the viewer's private document in the page's `db` capability, when present.
// On start the device save and the cloud save are read and the newest valid one wins;
// the backup slot is used only when the device save is unreadable.
import * as SDK from './sdk.js';

const KEY = 'republic-rising-save-v1';
const BAK = KEY + '-bak';
const CLOUD_INTERVAL_MS = 15000;
const CLOUD_MAX_BYTES = 240000;

let cloud = null; // { ref } when the hosted `db` store is usable
let cloudPending = null;
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

// Hosted preview only: resolves quickly to false everywhere else (e.g. on CrazyGames).
export async function initCloud(timeoutMs = 4000) {
  const use = window.claude?.use;
  if (typeof use !== 'function') return false;
  const attempt = (async () => {
    const [db, user] = await Promise.all([use('db'), use('user')]);
    if (!db || !user) return null;
    const id = await user.id();
    if (!id) return null;
    return { ref: db.doc(`data/users/${id}/save`) };
  })().catch(() => null);
  cloud = await Promise.race([attempt, new Promise((r) => setTimeout(() => r(null), timeoutMs))]);
  status.cloud = !!cloud;
  return status.cloud;
}

// All readable saves, newest first.
export async function loadCandidates() {
  const found = [];
  const add = (raw, source) => { const v = parse(raw); if (v) found.push({ save: v, source }); };
  add(await SDK.loadData(KEY), 'device');
  add(localGet(KEY), 'device');
  // The backup only stands in for a damaged or missing main save.
  if (!found.length) add(localGet(BAK), 'backup');
  if (cloud) {
    try {
      const snap = await cloud.ref.get();
      if (snap.exists) add(snap.data().save, 'cloud');
    } catch (e) { status.cloudError = e?.code || 'unavailable'; }
  }
  return found.sort((a, b) => (b.save.lastTick || 0) - (a.save.lastTick || 0));
}

export function saveNow(state) {
  if (!state) return;
  let json;
  try { json = JSON.stringify(state); } catch (e) { console.warn('save failed', e); return; }
  const now = Date.now();
  // Keep the previous good save as a backup before overwriting the main slot.
  if (now - lastBackup > 60000 || !localGet(BAK)) {
    const prev = localGet(KEY);
    if (parse(prev)) localSet(BAK, prev);
    lastBackup = now;
  }
  SDK.saveData(KEY, json);
  localSet(KEY, json);
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
  cloudPending = json;
  const wait = lastCloud + CLOUD_INTERVAL_MS - Date.now();
  if (wait <= 0) flushCloud();
  else if (!cloudTimer) cloudTimer = setTimeout(flushCloud, wait);
}

export function flushCloud() {
  clearTimeout(cloudTimer);
  cloudTimer = 0;
  if (!cloud || !cloudPending) return;
  const body = shrink(cloudPending);
  cloudPending = null;
  lastCloud = Date.now();
  cloud.ref.set({ save: body, at: lastCloud }).then(() => {
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

export function wipe() {
  SDK.removeData(KEY);
  try { localStorage.removeItem(KEY); localStorage.removeItem(BAK); } catch { /* ignore */ }
  if (cloud) cloud.ref.delete().catch(() => {});
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
