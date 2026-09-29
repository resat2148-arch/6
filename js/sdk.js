// CrazyGames SDK v3 wrapper with safe fallbacks for local development / other hosts.
// Docs: https://docs.crazygames.com/sdk/intro/
const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

let sdk = null;
let env = 'disabled';
let playing = false;
let adPlaying = false;
const listeners = { adStart: [], adEnd: [], settings: [] };

function loadScript(src, timeoutMs) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    const timer = setTimeout(() => reject(new Error('SDK load timeout')), timeoutMs);
    el.src = src;
    el.async = true;
    el.onload = () => { clearTimeout(timer); resolve(); };
    el.onerror = () => { clearTimeout(timer); reject(new Error('SDK load failed')); };
    document.head.appendChild(el);
  });
}

export async function initSDK() {
  if (window.RR_NO_SDK) return env; // standalone test builds skip the portal SDK
  try {
    if (!window.CrazyGames?.SDK) await loadScript(SDK_URL, 5000);
    const S = window.CrazyGames?.SDK;
    if (!S) return env;
    await S.init();
    sdk = S;
    env = S.environment || 'disabled';
    try {
      S.game.addSettingsChangeListener?.((settings) => listeners.settings.forEach((f) => f(settings)));
    } catch { /* optional */ }
  } catch (e) {
    console.info('[sdk] running without CrazyGames SDK:', e.message);
  }
  return env;
}

export const environment = () => env;
const active = () => sdk && env !== 'disabled';

export const on = (ev, f) => listeners[ev].push(f);

export function muteRequested() {
  try { return !!sdk?.game?.settings?.muteAudio; } catch { return false; }
}

export function loadingStart() { try { if (active()) sdk.game.loadingStart(); } catch { /* ignore */ } }
export function loadingStop() { try { if (active()) sdk.game.loadingStop(); } catch { /* ignore */ } }

export function gameplayStart() {
  if (playing || adPlaying) return;
  playing = true;
  try { if (active()) sdk.game.gameplayStart(); } catch { /* ignore */ }
}

export function gameplayStop() {
  if (!playing) return;
  playing = false;
  try { if (active()) sdk.game.gameplayStop(); } catch { /* ignore */ }
}

export function happytime() { try { if (active()) sdk.game.happytime(); } catch { /* ignore */ } }

export const isAdPlaying = () => adPlaying;

function requestAd(type) {
  return new Promise((resolve) => {
    if (!active()) {
      // No SDK (local file / other host): simulate success so features stay testable.
      resolve(type === 'rewarded');
      return;
    }
    const wasPlaying = playing;
    const finish = (okFlag) => {
      if (adPlaying) {
        adPlaying = false;
        listeners.adEnd.forEach((f) => f());
      }
      if (wasPlaying) gameplayStart();
      resolve(okFlag);
    };
    try {
      sdk.ad.requestAd(type, {
        adStarted: () => {
          gameplayStop();
          adPlaying = true;
          listeners.adStart.forEach((f) => f());
        },
        adFinished: () => finish(true),
        adError: (err) => { console.info('[sdk] ad error', err); finish(false); },
      });
    } catch (e) {
      finish(false);
    }
  });
}

export const showRewarded = () => requestAd('rewarded');
export const showMidgame = () => requestAd('midgame');

export async function getUsername() {
  try {
    if (!active() || !sdk.user?.isUserAccountAvailable) return null;
    const u = await sdk.user.getUser();
    return u?.username || null;
  } catch { return null; }
}

// Persistent storage: CrazyGames data module when on the portal (cloud sync), localStorage otherwise.
export function loadData(key) {
  try {
    if (env === 'crazygames' && sdk?.data) return sdk.data.getItem(key);
  } catch { /* fall through */ }
  try { return localStorage.getItem(key); } catch { return null; }
}

export function saveData(key, value) {
  try {
    if (env === 'crazygames' && sdk?.data) { sdk.data.setItem(key, value); return; }
  } catch { /* fall through */ }
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

export function removeData(key) {
  try { if (env === 'crazygames' && sdk?.data) sdk.data.removeItem(key); } catch { /* ignore */ }
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}
