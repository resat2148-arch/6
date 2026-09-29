// Boot, save/load, action dispatch and CrazyGames SDK hooks.
import * as G from './game.js';
import * as SDK from './sdk.js';
import * as Store from './storage.js';
import { sfx, unlock, setMuted } from './sfx.js';
import {
  ui, renderTab, renderTop, liveUpdate, renderStart, toast, openModal, closeModal, modalOpen, banner, helpHtml, zoomMap,
  offersModal, listModal, renderMenu, renderGoodbye, settingsHtml,
} from './ui.js';
import { initBattle, openBattle, isOpen as battleOpen, setAdPause, debugTargets } from './battle.js';
import { CONFIG, GAME_TITLE, MEDALS, GOLD_SHOP, RAW_ICON, HOUSES, MARKET, countryById } from './data.js';
import { fmt, fmtMoney, fmtTime, esc } from './util.js';

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
let saveTimer = 0;
let legacySave = null; // a v1 save waiting for the player to pick a real country
let pendingLoad = null; // the save just read from a slot, until its catch-up summary is shown
let pendingSlot = 0; // the career slot a new citizen will be saved into
let slots = []; // title screen summaries of the careers
let loadingSlot = false;
let replacing = false; // the new citizen overwrites a filled slot
let loopsStarted = false;
const MUTE_KEY = 'republic-rising-muted';
const menuMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } };

function save() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  if (state) Store.saveNow(state);
}

// Coalesces bursts of clicks into one write shortly after the last one.
function requestSave() {
  if (!saveTimer) saveTimer = setTimeout(save, 300);
}

function saveAndFlush() {
  save();
  Store.flushCloud();
}

// Newest readable save of a career across device, backup and cloud; old map versions are kept for upgrading.
async function load(n) {
  const found = await Store.loadCandidates(n);
  for (const { save: raw, source } of found) {
    if (G.isLegacySave(raw)) return { legacy: raw };
    const s = G.migrate(raw);
    if (s) return { state: s, source };
  }
  return null;
}

// What the title screen shows about each career.
async function refreshSlots() {
  const found = await Store.slotSummaries();
  slots = found.map(({ slot, save: raw }) => {
    if (!raw) return { slot, save: null };
    const legacy = G.isLegacySave(raw);
    let rank = '';
    try { rank = G.rankName(raw); } catch { /* shown without a rank */ }
    return { slot, save: true, legacy, name: raw.player.name || 'Citizen', country: legacy ? null : raw.player.country,
      level: raw.player.level || 1, rank, lastPlayed: raw.lastTick || Date.now() };
  });
  return slots;
}
const slotInfo = (n) => slots.find((c) => c.slot === n);

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
      if (nextId !== null && nextId !== undefined && G.campaignById(state, nextId)) startFight(nextId);
    },
    onRoundEnd: () => { saveAndFlush(); },
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
  rankSet: (d) => { ui[d.k] = d.k === 'nationAll' ? d.v === '1' : d.v; sfx.click(); refresh(); },
  work: () => result(G.work(state), (r) => { sfx.work(); toast(`🛠️ Worked: +💰${fmtMoney(r.money)}`, 'good'); }),
  train: () => result(G.train(state), (r) => { sfx.work(); toast(`🏋️ Trained: +${r.gain} strength`, 'good'); }),
  eat: () => result(G.eat(state), (r) => { sfx.eat(); closeModal(); toast(`🍞 +${Math.round(r.gained)} energy`, 'good'); }),
  fight: (d) => startFight(Number(d.id)),
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
  upFacility: (d) => result(G.upgradeFacility(state, d.id), (r) => {
    sfx.coin();
    toast(r.q === 1 ? `🏋️ Facility built: +${r.gain} strength per training` : `🏋️ Upgraded to Q${r.q}: +${r.gain} strength per training`, 'good');
  }),
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
    try { localStorage.setItem(MUTE_KEY, state.settings.muted ? '1' : '0'); } catch { /* ignore */ }
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
  reset: () => openModal(`<h2>Delete this career?</h2><p>This deletes <b>${esc(state.player.name)}</b> with all companies and medals. Your other careers are kept.</p>
    <div class="row"><button class="btn danger" data-act="resetConfirm">Delete career</button><button class="btn" data-act="closeModal">Cancel</button></div>`),
  resetConfirm: () => {
    clearTimeout(saveTimer);
    saveTimer = 0;
    Store.wipe(Store.currentSlot());
    state = null; // nothing left to save
    started = false;
    SDK.gameplayStop();
    showMenu();
  },
  exportSave: async () => {
    save();
    const code = await Store.exportCode(state);
    openModal(`<h2>💾 Backup code</h2>
      <p class="muted small">This code holds career ${Store.currentSlot()} (${esc(state.player.name)}). Keep it somewhere safe and paste it on another device (Main menu → Settings → Restore from code) to continue there.</p>
      <textarea id="save-code" class="code" readonly>${code}</textarea>
      <div class="row"><button class="btn primary" data-act="copyCode">Copy</button><button class="btn" data-act="closeModal">Close</button></div>`);
  },
  copyCode: () => {
    const el = $('save-code');
    navigator.clipboard?.writeText(el.value).then(() => toast('Backup code copied.', 'good')).catch(() => { el.select(); toast('Select the code and copy it.', 'info'); });
    if (!navigator.clipboard) { el.select(); toast('Select the code and copy it.', 'info'); }
  },
  importSave: () => {
    // In game the code replaces the open career; on the title screen the player picks the slot.
    const pick = state ? '' : `<label class="field"><span>Restore into</span><select id="import-slot">${slots.map((c) => `
      <option value="${c.slot}" ${c.save ? '' : 'selected'}>Career ${c.slot} — ${c.save ? `${esc(c.name)} (replaced)` : 'empty'}</option>`).join('')}</select></label>`;
    const first = slots.find((c) => !c.save);
    openModal(`<h2>♻️ Restore from code</h2>
      <p class="muted small">${state ? `This replaces career ${Store.currentSlot()} (${esc(state.player.name)}) with the backup.` : 'Pick the career slot the backup goes into. A citizen already in that slot is replaced.'}</p>
      ${pick}
      <textarea id="save-code" class="code" placeholder="RR1:..."></textarea>
      <div class="row"><button class="btn primary" data-act="importConfirm">Restore</button><button class="btn" data-act="closeModal">Cancel</button></div>`);
    const sel = $('import-slot');
    if (sel) sel.value = String(first ? first.slot : Store.lastPlayedSlot() || 1);
  },
  importConfirm: async () => {
    try {
      const raw = await Store.importCode($('save-code').value);
      const s = G.isLegacySave(raw) ? G.upgradeLegacy(raw, state?.player.country || pickedCountry) : G.migrate(raw);
      if (!s) throw new Error('This backup is from an incompatible version.');
      s.lastTick = Math.min(s.lastTick, Date.now());
      const target = state ? Store.currentSlot() : Number($('import-slot').value) || 1;
      clearTimeout(saveTimer);
      saveTimer = 0;
      Store.setSlot(target);
      state = s; // the save handlers now write this state into the chosen slot
      Store.saveNow(s);
      Store.flushCloud();
      closeModal();
      if (started) { started = false; SDK.gameplayStop(); }
      pendingLoad = null;
      continueGame();
      toast(`♻️ Backup restored into career ${target}.`, 'gold');
    } catch (e) { sfx.error(); toast(e.message || 'Could not read that code.', 'bad'); }
  },
  pickCountry: (d, el) => {
    pickedCountry = d.id;
    document.querySelectorAll('.country-card').forEach((b) => b.classList.toggle('sel', b === el));
    sfx.click();
  },
  slotPlay: async (d) => {
    if (loadingSlot) return;
    sfx.click();
    const n = Number(d.slot);
    loadingSlot = true;
    const saved = await load(n).finally(() => { loadingSlot = false; });
    if (!saved) { toast('This save is from an incompatible version and cannot be continued.', 'bad'); return; }
    Store.setSlot(n);
    pendingSlot = n;
    replacing = false;
    if (saved.legacy) { legacySave = saved.legacy; openCountrySelect(); return; }
    legacySave = null;
    state = saved.state;
    pendingLoad = saved;
    continueGame();
  },
  slotNew: (d) => {
    sfx.click();
    const c = slotInfo(Number(d.slot));
    if (c?.save) {
      openModal(`<h2>New game in career ${c.slot}?</h2>
        <p><b>${esc(c.name)}</b>${c.legacy ? '' : ` (level ${c.level})`} will be replaced by your new citizen, with all companies and medals. Your other careers are kept. You can still go back until you become a citizen.</p>
        <div class="row"><button class="btn danger" data-act="slotNewConfirm" data-slot="${c.slot}">Replace career</button><button class="btn" data-act="closeModal">Cancel</button></div>`);
      return;
    }
    actions.slotNewConfirm(d);
  },
  slotNewConfirm: (d) => {
    closeModal();
    pendingSlot = Number(d.slot);
    replacing = !!slotInfo(pendingSlot)?.save;
    legacySave = null;
    openCountrySelect();
  },
  slotDelete: (d) => {
    const c = slotInfo(Number(d.slot));
    if (!c?.save) return;
    openModal(`<h2>Delete career ${c.slot}?</h2>
      <p><b>${esc(c.name)}</b>${c.legacy ? '' : ` (level ${c.level})`} will be deleted with all companies and medals. Your other careers are kept.</p>
      <div class="row"><button class="btn danger" data-act="slotDeleteConfirm" data-slot="${c.slot}">Delete career</button><button class="btn" data-act="closeModal">Cancel</button></div>`);
  },
  slotDeleteConfirm: async (d) => {
    Store.wipe(Number(d.slot));
    closeModal();
    toast('Career deleted.', 'info');
    renderMenu(await refreshSlots(), Store.lastPlayedSlot(), showExit());
  },
  menuSettings: () => openModal(settingsHtml(menuMuted())),
  menuMute: () => {
    const m = !menuMuted();
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
    setMuted(m || SDK.muteRequested());
    $('tb-mute').textContent = m ? '🔇' : '🔊';
    openModal(settingsHtml(m));
  },
  menuExit: () => {
    try { window.close(); } catch { /* browsers only close tabs a script opened */ }
    renderGoodbye();
  },
  menuBack: () => { $('start').hidden = true; legacySave = null; renderMenu(slots, Store.lastPlayedSlot(), showExit()); },
  openMenu: () => showMenu(),
  startGame: () => {
    if (replacing && !legacySave) Store.wipe(pendingSlot, { keepCloud: true }); // no backup of the replaced citizen
    replacing = false;
    Store.setSlot(pendingSlot || 1);
    const name = ($('start-name').value || '').trim().slice(0, 18) || 'Citizen';
    state = legacySave ? G.upgradeLegacy(legacySave, pickedCountry) : G.newGame({ name, country: pickedCountry });
    if (legacySave) toast('Your citizen moved to the new map of Europe with all progress kept.', 'gold');
    legacySave = null;
    G.openFirstFront(state);
    G.tick(state);
    pendingLoad = null;
    enterGame();
    openModal(helpHtml());
    saveAndFlush();
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
  // Another career may have been open: start on Home with nothing selected on its map.
  Object.assign(ui, { tab: 'home', sel: null, vb: null });
  $('menu').hidden = true;
  $('start').hidden = true;
  $('app').hidden = false;
  state.settings.muted = state.settings.muted || menuMuted();
  $('tb-mute').textContent = state.settings.muted ? '🔇' : '🔊';
  setMuted(state.settings.muted || SDK.muteRequested());
  refresh();
  SDK.gameplayStart();
  if (state.daily.loginPending) setTimeout(() => { if (!modalOpen()) showLoginReward(); }, 400);
  if (loopsStarted) return;
  loopsStarted = true;
  let lastSave = Date.now();
  setInterval(() => {
    if (!state || !started) return;
    G.tick(state);
    renderTop(state);
    if (dirty && !battleOpen() && !modalOpen() && ['home', 'war', 'map', 'people'].includes(ui.tab) && document.activeElement?.tagName !== 'INPUT') refresh();
    if (Date.now() - lastSave > 5000) { save(); lastSave = Date.now(); }
  }, 500);
  setInterval(() => { if (state && started && !battleOpen()) liveUpdate(state); }, 1000);
}

// ------------------------------------------------------------------ title screen
// CrazyGames (and its local test mode) hosts the game in its own page, so there is nothing to exit to.
const showExit = () => SDK.environment() === 'disabled';

// Saves the open career, closes it and lists all careers again.
async function showMenu() {
  if (started) { saveAndFlush(); SDK.gameplayStop(); }
  started = false;
  state = null;
  closeModal();
  $('toasts').innerHTML = ''; // messages from the closed career
  $('app').hidden = true;
  $('start').hidden = true;
  renderMenu(slots, Store.lastPlayedSlot(), showExit()); // instant, then refreshed with the save just written
  renderMenu(await refreshSlots(), Store.lastPlayedSlot(), showExit());
}

async function openCountrySelect() {
  $('menu').hidden = true;
  const uname = await SDK.getUsername();
  renderStart(legacySave?.player.name || uname || `Citizen${Math.floor(1000 + Math.random() * 9000)}`, pickedCountry, !!legacySave);
}

// Continue a save: catch up on the time away, then show what happened.
function continueGame() {
  const source = pendingLoad?.source;
  const fresh = !!pendingLoad;
  pendingLoad = null;
  const away = Date.now() - state.lastTick;
  quietLog = [];
  const before = G.pendingTotal(state);
  G.tick(state);
  const log = quietLog;
  quietLog = null;
  enterGame();
  save();
  if (source === 'backup') toast('Your last save was damaged, so we restored the backup from a minute earlier.', 'info');
  if (fresh && away > 2 * 60 * 1000) {
    const prod = G.pendingTotal(state) - before;
    openModal(`<h2>Welcome back, ${esc(state.player.name)}!</h2>
      <p class="muted">You were away for ${fmtTime(away)}. Your progress was saved${source === 'cloud' ? ' in the cloud' : ' on this device'} and restored.</p>
      ${prod > 1 ? `<p>🏭 Your companies produced <b>${fmt(prod)}</b> units — collect them in Economy.</p>` : ''}
      ${log.length ? `<ul class="help">${log.slice(-6).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      <div class="row"><button class="btn primary" data-act="closeModal">Continue</button></div>`);
  }
}

document.addEventListener('click', (e) => {
  unlock();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (el.id === 'modal' && e.target !== el) return;
  const f = actions[el.dataset.act];
  if (f) {
    f(el.dataset, el);
    if (started) requestSave();
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalOpen()) closeModal(); });
document.addEventListener('visibilitychange', () => {
  if (!started) return;
  if (document.hidden) { SDK.gameplayStop(); saveAndFlush(); } else SDK.gameplayStart();
});
window.addEventListener('pagehide', saveAndFlush);
window.addEventListener('beforeunload', save);

async function boot() {
  document.title = GAME_TITLE;
  await Promise.all([SDK.initSDK(), Store.initCloud()]);
  SDK.loadingStart();
  initBattle();
  await Store.migrateSingleSave(); // a save from before careers becomes career 1
  await refreshSlots();
  setMuted(menuMuted() || SDK.muteRequested());
  SDK.loadingStop();
  $('loading').hidden = true;
  renderMenu(slots, Store.lastPlayedSlot(), showExit());
}

boot();

// Debug handle for local testing.
window.__rr = { get state() { return state; }, G, targets: debugTargets, Store };
