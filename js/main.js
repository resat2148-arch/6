// Boot, save/load, action dispatch and CrazyGames SDK hooks.
import * as G from './game.js';
import * as SDK from './sdk.js';
import { sfx, unlock, setMuted } from './sfx.js';
import {
  ui, renderTab, renderTop, liveUpdate, renderStart, toast, openModal, closeModal, modalOpen, banner, helpHtml, zoomMap,
  offersModal, listModal,
} from './ui.js';
import { initBattle, openBattle, isOpen as battleOpen, setAdPause, debugTargets } from './battle.js';
import { CONFIG, GAME_TITLE, MEDALS, GOLD_SHOP, RAW_ICON, HOUSES, MARKET, countryById } from './data.js';
import { fmt, fmtMoney, fmtTime, esc } from './util.js';

const SAVE_KEY = 'republic-rising-save-v1';
const ENERGY_AD_COOLDOWN = 4 * 60 * 1000;

let state = null;
// Pre-select the player's own country when the browser language reveals it (tr-TR -> Turkey).
function localCountry() {
  const langs = navigator.languages || [navigator.language || ''];
  for (const l of langs) {
    const region = (l.split('-')[1] || '').toUpperCase();
    if (countryById(region)) return region;
    const lang = { tr: 'TR', de: 'DE', fr: 'FR', es: 'ES', it: 'IT', pl: 'PL', nl: 'NL', pt: 'PT', ro: 'RO', el: 'GR', hu: 'HU', cs: 'CZ', sv: 'SE',
      da: 'DK', fi: 'FI', nb: 'NO', uk: 'UA', ru: 'RU', bg: 'BG', hr: 'HR', sr: 'RS', sk: 'SK', sl: 'SI', et: 'EE', lv: 'LV', lt: 'LT' }[l.split('-')[0]];
    if (lang) return lang;
  }
  return 'DE';
}
let pickedCountry = localCountry();
let quietLog = null; // collects toasts during offline catch-up
let dirty = false;
let started = false;

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ persistence
function save() {
  if (!state) return;
  try { SDK.saveData(SAVE_KEY, JSON.stringify(state)); } catch (e) { console.warn('save failed', e); }
}

async function load() {
  try {
    const raw = await SDK.loadData(SAVE_KEY);
    if (!raw) return null;
    return G.migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('load failed', e);
    return null;
  }
}

// ------------------------------------------------------------------ events from the rules engine
G.bus.on('toast', ({ text, kind }) => {
  if (quietLog) quietLog.push(text);
  else toast(text, kind);
  dirty = true;
});
G.bus.on('levelup', ({ level, gold }) => {
  if (quietLog) return;
  sfx.level();
  banner(`LEVEL ${level}!`, `+${gold} 🪙 · energy refilled`);
  SDK.happytime();
  dirty = true;
});
G.bus.on('rankup', ({ rank }) => { if (!quietLog) toast(`🎖️ Promoted to ${rank}!`, 'good'); });
G.bus.on('medal', ({ medal }) => {
  if (quietLog) { quietLog.push(`${medal.icon} Medal earned: ${medal.name}`); return; }
  sfx.coin();
  toast(`${medal.icon} Medal: ${medal.name} (+${medal.gold} 🪙)`, 'gold');
});
G.bus.on('election', ({ won, office }) => {
  const name = G.OFFICES[office].name;
  const msg = won ? `🗳️ You won the ${name} election!` : `🗳️ You lost the ${name} election. Try again!`;
  if (quietLog) quietLog.push(msg);
  else { toast(msg, won ? 'gold' : 'bad'); if (won) { sfx.win(); SDK.happytime(); } }
  dirty = true;
});
G.bus.on('campaign', (c) => {
  if (!quietLog && G.playerSide(state, c) === 'def') sfx.alarm();
  dirty = true;
});
G.bus.on('campaignEnd', ({ won, region, c }) => {
  const side = G.playerSide(state, c);
  let msg;
  if (side === 'att') msg = won ? `🏳️ ${region.name} conquered!` : `❌ Attack on ${region.name} failed.`;
  else msg = won ? `🛡️ ${region.name} defended!` : `💔 ${region.name} was lost.`;
  if (quietLog) quietLog.push(msg);
  else {
    toast(msg, won ? 'gold' : 'bad');
    if (won) SDK.happytime();
  }
  dirty = true;
});
G.bus.on('victory', () => {
  if (quietLog) return;
  sfx.win();
  SDK.happytime();
  openModal(`<h2>🌍 World domination!</h2><p>${G.pc(state).name} rules every region on the map. Your name will be remembered forever.</p>
    <div class="row"><button class="btn primary" data-act="closeModal">Glory!</button></div>`);
});

// ------------------------------------------------------------------ ads
SDK.on('adStart', () => { setMuted(true); setAdPause(true); });
SDK.on('adEnd', () => { setMuted(!!state?.settings.muted || SDK.muteRequested()); setAdPause(false); });
SDK.on('settings', () => setMuted(!!state?.settings.muted || SDK.muteRequested()));

async function maybeMidgame() {
  const now = Date.now();
  if (now - state.timers.lastMidgame < CONFIG.midgameCooldownMs) return;
  if ((state.counters.roundPlay || 0) < 2) return;
  state.timers.lastMidgame = now;
  await SDK.showMidgame();
}

async function rewarded(onReward) {
  const okAd = await SDK.showRewarded();
  if (okAd) { onReward(); sfx.coin(); }
  else toast('Ad not available right now. Try again later.', 'bad');
  save();
  refresh();
}

// ------------------------------------------------------------------ battle
function startFight(id) {
  if (battleOpen()) return;
  closeModal();
  const okOpen = openBattle(state, id, {
    onExit: async (nextId) => {
      refresh();
      save();
      await maybeMidgame();
      if (nextId !== null && nextId !== undefined && (nextId === 'training' || G.campaignById(state, nextId))) startFight(nextId);
    },
    onRoundEnd: () => { save(); },
    onAdRefill: () => energyAd(),
    onNeedBazooka: () => {},
  });
  if (!okOpen) { toast('That battle is already over.', 'bad'); refresh(); }
}

function energyAd() {
  const now = Date.now();
  const wait = (state.timers.lastEnergyAd || 0) + ENERGY_AD_COOLDOWN - now;
  if (wait > 0) { toast(`Supply drop available in ${fmtTime(wait)}`, 'bad'); return; }
  rewarded(() => {
    state.timers.lastEnergyAd = Date.now();
    G.refillEnergy(state);
    toast('⚡ Supply drop! Energy and reserve refilled.', 'good');
  });
}

// ------------------------------------------------------------------ actions
function result(r, onOk) {
  if (!r.ok) { sfx.error(); toast(r.msg, 'bad'); return false; }
  onOk?.(r);
  refresh();
  return true;
}

function refresh() {
  if (!state || !started) return;
  renderTab(state);
  dirty = false;
}

const actions = {
  tab: (d) => { ui.tab = d.tab; if (d.tab === 'people') G.count(state, 'rankView'); sfx.click(); $('view').scrollTop = 0; refresh(); },
  rankSet: (d) => { ui[d.k] = d.v; sfx.click(); refresh(); },
  work: () => result(G.work(state), (r) => { sfx.work(); toast(`🛠️ Worked: +💰${fmtMoney(r.money)}`, 'good'); }),
  train: () => result(G.train(state), (r) => { sfx.work(); toast(`🏋️ Trained: +${r.gain} strength`, 'good'); }),
  eat: () => result(G.eat(state), (r) => { sfx.eat(); closeModal(); toast(`🍞 +${Math.round(r.gained)} energy`, 'good'); }),
  fight: (d) => startFight(d.id === 'training' ? 'training' : Number(d.id)),
  claimTutorial: () => result(G.claimTutorial(state), (r) => { sfx.coin(); toast(`🎯 Mission complete: ${G.rewardText(r.reward)}`, 'gold'); }),
  claimDaily: (d) => result(G.claimDaily(state, d.id), () => sfx.coin()),
  claimDailyBonus: () => result(G.claimDailyBonus(state), () => { sfx.win(); SDK.happytime(); toast('📅 Daily bonus claimed!', 'gold'); }),
  build: (d) => result(G.build(state, d.type), () => { sfx.coin(); toast('🏗️ Company built!', 'good'); }),
  upLevel: (d) => result(G.upgradeLevel(state, Number(d.id)), () => sfx.coin()),
  upQuality: (d) => result(G.upgradeQuality(state, Number(d.id)), () => sfx.coin()),
  collect: () => result(G.collectAll(state), (r) => collectToast(r)),
  collectDouble: () => {
    if (!state.companies.length) { toast('Build a company first.', 'bad'); return; }
    rewarded(() => {
      state.timers.lastDoubleCollect = Date.now();
      const r = G.collectAll(state, 2);
      if (r.ok) collectToast(r);
    });
  },
  unlockFacility: (d) => result(G.unlockFacility(state, d.id), () => { sfx.coin(); toast('🏋️ Facility unlocked!', 'good'); }),
  buy: (d) => result(G.buy(state, d.key, Number(d.n)), (r) => {
    sfx.coin();
    toast(`🛒 Bought ${fmt(r.qty)} ${MARKET[d.key].name} for 💰${fmtMoney(r.cost)}${r.partial ? ' (all you could afford)' : ''}`, 'good');
  }),
  offers: (d) => openModal(offersModal(state, d.key)),
  buyOffer: (d) => {
    const r = G.buyOffer(state, Number(d.id), Number(d.n));
    if (!r.ok) { sfx.error(); toast(r.msg, 'bad'); return; }
    sfx.coin();
    toast(`🛒 Bought ${fmt(r.qty)} ${MARKET[r.key].name} for 💰${fmtMoney(r.cost)}`, 'good');
    openModal(offersModal(state, r.key));
    refresh();
  },
  listModal: (d) => openModal(listModal(state, d.key)),
  postOffer: (d) => {
    const r = G.postOffer(state, d.key, Number($('offer-qty').value), Number($('offer-price').value));
    if (!r.ok) { sfx.error(); toast(r.msg, 'bad'); return; }
    closeModal();
    sfx.coin();
    toast('📋 Offer posted. Citizens will buy it if the price is right.', 'good');
    refresh();
  },
  cancelOffer: (d) => {
    const r = G.cancelOffer(state, Number(d.id));
    if (!r.ok) { toast(r.msg, 'bad'); return; }
    if (modalOpen()) closeModal();
    toast('Offer cancelled; goods returned.', 'info');
    refresh();
  },
  sell: (d) => result(G.sell(state, d.key, Number(d.n)), (r) => { sfx.coin(); toast(`Sold to a trader for 💰${fmtMoney(r.gain)}`, 'good'); }),
  buyGold: () => result(G.buyGold(state), () => sfx.coin()),
  sellGold: () => result(G.sellGold(state), () => sfx.coin()),
  freeGold: () => rewarded(() => { state.timers.lastFreeGold = Date.now(); state.player.gold += 2; toast('🪙 +2 gold', 'gold'); }),
  goldShop: (d) => result(G.buyGoldItem(state, d.key), () => { sfx.coin(); toast(`${GOLD_SHOP[d.key].icon} ${GOLD_SHOP[d.key].name} acquired`, 'good'); }),
  joinParty: () => result(G.joinParty(state), () => toast('🏛️ You joined a political party!', 'good')),
  run: (d) => result(G.runFor(state, d.office), () => toast('🗳️ Candidacy registered. Good luck!', 'good')),
  policy: (d) => result(G.setPolicy(state, d.key), () => toast('📜 Policy enacted.', 'good')),
  newspaper: () => result(G.createNewspaper(state, $('news-name')?.value), () => toast('📰 Newspaper founded!', 'good')),
  article: () => result(G.writeArticle(state, $('article-title')?.value), (r) => toast(`📰 Article published: +${r.gain} subscribers`, 'good')),
  voteArticle: (d) => result(G.voteArticle(state, Number(d.id)), () => sfx.click()),
  region: (d) => { if (ui.dragged) return; ui.sel = Number(d.id); sfx.click(); refresh(); },
  mapZoom: (d) => zoomMap(Number(d.z)),
  declareWar: (d) => result(G.declareWar(state, Number(d.id)), () => sfx.alarm()),
  resist: (d) => result(G.startResistance(state, Number(d.id))),
  energyMenu: () => openEnergyMenu(),
  moveIn: (d) => result(G.moveIn(state, Number(d.q)), () => {
    const h = HOUSES[Number(d.q)];
    sfx.win();
    toast(`${h.icon} You moved into a ${h.name}: +${h.energy} max energy, +${h.regen * 100}% regen`, 'good');
  }),
  energyBar: () => { result(G.useEnergyBar(state), () => { sfx.eat(); closeModal(); }); },
  energyAd: () => { closeModal(); energyAd(); },
  mute: () => {
    state.settings.muted = !state.settings.muted;
    setMuted(state.settings.muted || SDK.muteRequested());
    $('tb-mute').textContent = state.settings.muted ? '🔇' : '🔊';
    save();
  },
  help: () => openModal(helpHtml()),
  closeModal: () => {
    closeModal();
    if (state?.daily.loginPending) setTimeout(showLoginReward, 250);
  },
  claimLogin: () => { const r = G.claimLogin(state); closeModal(); if (r.ok) { sfx.coin(); toast(`🎁 ${G.rewardText(r.reward)}`, 'gold'); } refresh(); },
  claimLoginDouble: () => { closeModal(); rewarded(() => { const r = G.claimLogin(state, 2); if (r.ok) toast(`🎁 2× ${G.rewardText(r.reward)}`, 'gold'); }); },
  reset: () => openModal(`<h2>Reset progress?</h2><p>This deletes your citizen, companies and medals.</p>
    <div class="row"><button class="btn danger" data-act="resetConfirm">Delete everything</button><button class="btn" data-act="closeModal">Cancel</button></div>`),
  resetConfirm: () => { SDK.removeData(SAVE_KEY); state = null; location.reload(); },
  pickCountry: (d, el) => {
    pickedCountry = d.id;
    document.querySelectorAll('.country-card').forEach((b) => b.classList.toggle('sel', b === el));
    sfx.click();
  },
  startGame: () => {
    const name = ($('start-name').value || '').trim().slice(0, 18) || 'Citizen';
    state = G.newGame({ name, country: pickedCountry });
    G.openFirstFront(state);
    G.tick(state);
    $('start').hidden = true;
    enterGame();
    openModal(helpHtml());
    save();
  },
};

function collectToast(r) {
  sfx.coin();
  const parts = Object.entries(r.got).map(([k, n]) => {
    const icon = RAW_ICON[k] || (k.startsWith('food') ? '🍞' : k.startsWith('house') ? '🏠' : '🔫');
    return `${icon}${fmt(n)}${/\d$/.test(k) ? ' Q' + k.slice(-1) : ''}`;
  });
  toast(`📦 Collected ${parts.join(' ')}`, 'good');
  if (r.starved) toast('Some factories lacked raw materials.', 'bad');
}

function openEnergyMenu() {
  const p = state.player;
  const wait = (state.timers.lastEnergyAd || 0) + ENERGY_AD_COOLDOWN - Date.now();
  const food = state.inv.food.reduce((a, b) => a + b, 0);
  openModal(`<h2>⚡ Energy</h2>
    <p>Energy <b>${Math.floor(p.energy)} / ${G.maxEnergy(state)}</b> · Food reserve <b>${Math.floor(p.reserve)} / ${G.maxReserve(state)}</b></p>
    <p class="muted small">Energy regenerates +1 every ${CONFIG.energyRegenMs / 1000}s${G.housingRegen(state) > 1 ? ` (×${G.housingRegen(state).toFixed(1)} from your house)` : ''}. The food reserve refills +1/s — eat food to convert it into energy. A house raises your max energy and regeneration.</p>
    <div class="col">
      <button class="btn primary" data-act="eat">🍞 Eat food (${food} in stock)</button>
      <button class="btn" data-act="energyBar">⚡ Energy bar: +50 (🪙${GOLD_SHOP.energyBar.gold})</button>
      <button class="btn ad" data-act="energyAd" ${wait > 0 ? 'disabled' : ''}>📺 Supply drop: full refill ${wait > 0 ? `(${fmtTime(wait)})` : ''}</button>
      <button class="btn ghost" data-act="closeModal">Close</button>
    </div>`);
}

function showLoginReward() {
  const r = state.daily.loginPending;
  if (!r) return;
  openModal(`<h2>🎁 Daily reward — day ${state.daily.streak}</h2>
    <p>Come back every day for bigger rewards!</p>
    <p class="big-reward">${G.rewardText(r)}</p>
    <div class="row"><button class="btn primary" data-act="claimLogin">Claim</button><button class="btn ad" data-act="claimLoginDouble">📺 Claim 2×</button></div>`);
}

// ------------------------------------------------------------------ main loop
function enterGame() {
  started = true;
  $('app').hidden = false;
  $('tb-mute').textContent = state.settings.muted ? '🔇' : '🔊';
  setMuted(state.settings.muted || SDK.muteRequested());
  refresh();
  SDK.gameplayStart();
  let lastSave = Date.now();
  setInterval(() => {
    if (!state) return;
    G.tick(state);
    renderTop(state);
    if (dirty && !battleOpen() && !modalOpen() && ['home', 'war', 'map', 'people'].includes(ui.tab) && document.activeElement?.tagName !== 'INPUT') refresh();
    if (Date.now() - lastSave > 10000) { save(); lastSave = Date.now(); }
  }, 500);
  setInterval(() => { if (state && !battleOpen()) liveUpdate(state); }, 1000);
  if (state.daily.loginPending) setTimeout(() => { if (!modalOpen()) showLoginReward(); }, 400);
}

document.addEventListener('click', (e) => {
  unlock();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (el.id === 'modal' && e.target !== el) return;
  const f = actions[el.dataset.act];
  if (f) f(el.dataset, el);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalOpen()) closeModal(); });
document.addEventListener('visibilitychange', () => {
  if (!started) return;
  if (document.hidden) { SDK.gameplayStop(); save(); } else SDK.gameplayStart();
});
window.addEventListener('pagehide', save);

async function boot() {
  document.title = GAME_TITLE;
  await SDK.initSDK();
  SDK.loadingStart();
  initBattle();
  const saved = await load();
  if (saved) {
    state = saved;
    const away = Date.now() - state.lastTick;
    quietLog = [];
    const before = { money: state.player.money, pending: G.pendingTotal(state) };
    G.tick(state);
    const log = quietLog;
    quietLog = null;
    SDK.loadingStop();
    $('loading').hidden = true;
    enterGame();
    if (away > 2 * 60 * 1000 && !state.daily.loginPending) {
      const prod = G.pendingTotal(state) - before.pending;
      openModal(`<h2>Welcome back, ${esc(state.player.name)}!</h2>
        <p class="muted">You were away for ${fmtTime(away)}.</p>
        ${prod > 1 ? `<p>🏭 Your companies produced <b>${fmt(prod)}</b> units — collect them in Economy.</p>` : ''}
        ${log.length ? `<ul class="help">${log.slice(-6).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        <div class="row"><button class="btn primary" data-act="closeModal">Continue</button></div>`);
    }
  } else {
    SDK.loadingStop();
    $('loading').hidden = true;
    const uname = await SDK.getUsername();
    renderStart(uname || `Citizen${Math.floor(1000 + Math.random() * 9000)}`, pickedCountry);
  }
}

boot();

// Debug handle for local testing.
window.__rr = { get state() { return state; }, G, targets: debugTargets };
