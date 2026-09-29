// DOM rendering for the management screens. Actions are dispatched by main.js via data-act attributes.
import * as G from './game.js';
import {
  CONFIG, COUNTRIES, RESOURCES, RANKS, rankThreshold, MEDALS, COMPANY_TYPES, MARKET, GOLD_SHOP,
  FACILITIES, POLICIES, FOOD_ENERGY, WEAPON_FP, countryById, GAME_TITLE, DAILY_BONUS, HOUSES, RAW_ICON,
} from './data.js';
import { flagSvg } from './flags.js';
import { fmt, fmtMoney, fmtTime, esc } from './util.js';
import { MAP_W, MAP_H, EU_REGIONS, EU_PATHS, EU_NEUTRAL, EU_BORDERS } from './europe.js';
import { PERSONAS, botRank, citizensOf, sellerName } from './citizens.js';
import { neighborsOf, regionsOf, isAlive, countryPower, distinctResources, resourceBonus } from './world.js';

const $ = (id) => document.getElementById(id);
export const ui = { tab: 'home', sel: null, vb: null, dragged: false, rankScope: 'country', rankBy: 'dmg' };

export const TABS = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'war', icon: '⚔️', label: 'War' },
  { id: 'map', icon: '🗺️', label: 'Map' },
  { id: 'economy', icon: '🏭', label: 'Economy' },
  { id: 'market', icon: '🛒', label: 'Market' },
  { id: 'politics', icon: '🏛️', label: 'Politics' },
  { id: 'people', icon: '👥', label: 'Citizens' },
  { id: 'medals', icon: '🎖️', label: 'Medals' },
];

// ------------------------------------------------------------------ toasts & modals
export function toast(text, kind = 'info') {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3100);
}

export function openModal(html, cls = '') {
  const m = $('modal');
  m.innerHTML = `<div class="modal-card ${cls}">${html}</div>`;
  m.hidden = false;
}
export function closeModal() {
  $('modal').hidden = true;
  $('modal').innerHTML = '';
}
export const modalOpen = () => !$('modal').hidden;

export function banner(title, sub) {
  const el = $('banner');
  el.innerHTML = `<div class="banner-in"><b>${title}</b><span>${sub || ''}</span></div>`;
  el.hidden = false;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(banner.t);
  banner.t = setTimeout(() => { el.hidden = true; }, 2600);
}

// ------------------------------------------------------------------ helpers
const bar = (pct, cls = '') => `<div class="bar ${cls}"><div style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%"></div></div>`;
const btn = (label, act, attrs = '', cls = '') => `<button class="btn ${cls}" data-act="${act}" ${attrs}>${label}</button>`;
const cName = (id) => countryById(id).name;

function avatarSvg(color) {
  return `<svg viewBox="0 0 64 64" class="avatar"><rect width="64" height="64" rx="14" fill="${color}" opacity=".25"/>
  <circle cx="32" cy="26" r="11" fill="#e7c3a0"/><path d="M19 24a13 12 0 0 1 26 0z" fill="#374151"/><rect x="16" y="22" width="32" height="4" rx="2" fill="#1f2937"/>
  <path d="M12 60c2-12 10-18 20-18s18 6 20 18z" fill="${color}"/></svg>`;
}

export function activeCampaigns(s) {
  return s.world.campaigns.filter((c) => G.playerSide(s, c)).sort((a, b) => a.deadline - b.deadline);
}

// ------------------------------------------------------------------ top bar
export function renderTop(s) {
  const p = s.player;
  const mx = G.maxEnergy(s);
  $('tb-flag').innerHTML = flagSvg(p.country);
  $('tb-name').textContent = p.name;
  $('tb-level').textContent = `Lv ${p.level}`;
  $('tb-xpfill').style.width = ((p.xp / G.xpToNext(p.level)) * 100).toFixed(1) + '%';
  $('tb-energyfill').style.width = Math.min(100, (p.energy / mx) * 100).toFixed(1) + '%';
  $('tb-reservefill').style.width = Math.min(100, (p.reserve / G.maxReserve(s)) * 100).toFixed(1) + '%';
  $('tb-energytxt').textContent = `${Math.floor(p.energy)}/${mx}`;
  $('tb-money').textContent = fmtMoney(p.money);
  $('tb-gold').textContent = fmt(p.gold);
  const alerts = activeCampaigns(s).length;
  const wb = $('badge-war');
  wb.hidden = !alerts;
  wb.textContent = alerts;
  const tut = G.tutorialStep(s);
  const pr = G.tutorialProgress(s);
  document.querySelectorAll('#tabs [data-tab]').forEach((b) => {
    b.classList.toggle('on', b.dataset.tab === ui.tab);
    b.classList.toggle('hint', !!(tut && tut.tab === b.dataset.tab && b.dataset.tab !== ui.tab && pr.cur < pr.n));
  });
  const eb = $('badge-eco');
  const full = s.companies.some((c) => c.pending >= G.companyCap(s, c) * 0.5);
  eb.hidden = !full;
}

// ------------------------------------------------------------------ live values (1s refresh without re-render)
export function liveUpdate(s) {
  const now = Date.now();
  document.querySelectorAll('[data-cd]').forEach((el) => {
    el.textContent = fmtTime(Number(el.dataset.cd) - now);
  });
  document.querySelectorAll('[data-pend]').forEach((el) => {
    const c = s.companies.find((x) => x.id === Number(el.dataset.pend));
    if (!c) return;
    const cap = G.companyCap(s, c);
    el.querySelector('.bar > div').style.width = ((c.pending / cap) * 100).toFixed(1) + '%';
    el.querySelector('.pend-n').textContent = fmt(c.pending);
  });
  const e = $('home-energy');
  if (e) e.textContent = `${Math.floor(s.player.energy)} / ${G.maxEnergy(s)} ⚡ · reserve ${Math.floor(s.player.reserve)}`;
}

// ------------------------------------------------------------------ start screen
export function renderStart(defaultName, picked) {
  const count = (id) => EU_REGIONS.filter((r) => r.c === id).length;
  const cards = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)).map((c) => `
    <button class="country-card ${c.id === picked ? 'sel' : ''}" data-act="pickCountry" data-id="${c.id}" style="--cc:${c.color}">
      ${flagSvg(c.id, 'flag big')}
      <b>${c.name}</b><small>${count(c.id)} region${count(c.id) > 1 ? 's' : ''}</small>
    </button>`).join('');
  $('start').innerHTML = `
    <div class="start-card">
      <div class="logo">⭐ ${GAME_TITLE}</div>
      <p class="tag">Work. Train. Fight. Build an empire and rule a nation.</p>
      <label class="field"><span>Citizen name</span><input id="start-name" maxlength="18" value="${esc(defaultName)}" autocomplete="off"></label>
      <p class="muted small">Choose your citizenship — big nations are safer, small ones are a challenge</p>
      <div class="country-grid">${cards}</div>
      <button class="btn primary big" data-act="startGame">Become a citizen</button>
    </div>`;
  $('start').hidden = false;
  const grid = document.querySelector('.country-grid');
  const sel = grid.querySelector('.sel');
  if (sel) grid.scrollTop = sel.offsetTop - grid.offsetTop - grid.clientHeight / 2 + sel.offsetHeight / 2;
}

// ------------------------------------------------------------------ tab renderers
export function renderTab(s) {
  const v = $('view');
  const fn = { home, war, map, economy, market, politics, people, medals }[ui.tab] || home;
  const scroll = v.scrollTop;
  v.innerHTML = fn(s);
  v.scrollTop = scroll;
  if (ui.tab === 'map') bindMap();
  renderTop(s);
  liveUpdate(s);
}

function home(s) {
  const p = s.player;
  const c = G.pc(s);
  const ri = G.rankIndex(p.rankPoints);
  const cur = rankThreshold(ri);
  const next = rankThreshold(ri + 1);
  const rankPct = ri + 1 < RANKS.length ? ((p.rankPoints - cur) / (next - cur)) * 100 : 100;
  const food = s.inv.food.reduce((a, b) => a + b, 0);
  const camps = activeCampaigns(s);
  const urgent = camps[0];

  const tut = G.tutorialStep(s);
  const pr = G.tutorialProgress(s);
  const tutHtml = tut
    ? `<div class="card mission ${pr.cur >= pr.n ? 'ready' : ''}">
        <h3>🎯 Mission ${s.tutorial.step + 1}</h3>
        <p>${tut.text}</p>
        ${bar((pr.cur / pr.n) * 100)}
        <div class="row spread"><small class="muted">Reward: ${G.rewardText(tut.reward)}</small>
        ${pr.cur >= pr.n ? btn('Claim', 'claimTutorial', '', 'primary') : tut.tab ? btn('Go', 'tab', `data-tab="${tut.tab}"`) : `<small>${pr.cur}/${pr.n}</small>`}</div>
      </div>`
    : '';

  const dm = G.dailyMissions(s);
  const allClaimed = dm.length && dm.every((m) => m.claimed);
  const dailyHtml = `<div class="card">
      <h3>📅 Daily orders</h3>
      ${dm.map((m) => `<div class="daily ${m.claimed ? 'claimed' : ''}">
        <span>${m.text}</span>${bar((m.cur / m.n) * 100, 'thin')}
        ${m.claimed ? '<small>✔</small>' : m.done ? btn('+1 🪙', 'claimDaily', `data-id="${m.id}"`, 'primary small') : `<small>${m.cur}/${m.n}</small>`}
      </div>`).join('')}
      <div class="row spread"><small class="muted">All done: ${G.rewardText(DAILY_BONUS)} + full energy</small>
      ${s.daily.bonusClaimed ? '<small>✔ claimed</small>' : btn('Bonus', 'claimDailyBonus', allClaimed ? '' : 'disabled', 'small')}</div>
    </div>`;

  return `<section class="grid">
    <div class="card citizen" style="--cc:${c.color}">
      <div class="row">${avatarSvg(c.color)}
        <div class="grow"><h2>${esc(p.name)}</h2>
          <div class="muted">${flagSvg(c.id)} Citizen of ${c.name} · D${G.division(p.level)}</div>
          <div class="muted" id="home-energy"></div></div></div>
      <div class="stats">
        <div><span>Level</span><b>${p.level}</b>${bar((p.xp / G.xpToNext(p.level)) * 100, 'thin xp')}</div>
        <div><span>Strength</span><b>${fmt(p.strength)}</b></div>
        <div><span>Rank</span><b class="rank">${RANKS[ri]}</b>${bar(rankPct, 'thin rank')}</div>
        <div><span>Hit (best weapon)</span><b>${fmt(G.hitDamage(s, G.bestWeapon(s)))}</b></div>
      </div>
    </div>
    <div class="card actions">
      <h3>Daily routine</h3>
      <div class="act-grid">
        <button class="act work" data-act="work"><i>🛠️</i><b>Work</b><small>−${CONFIG.workEnergy}⚡ · +💰${fmtMoney(G.salary(s))}</small></button>
        <button class="act train" data-act="train"><i>🏋️</i><b>Train</b><small>−${CONFIG.trainEnergy}⚡ · +${G.trainGain(s)} 💪</small></button>
        <button class="act eat" data-act="eat"><i>🍞</i><b>Eat</b><small>${food} food in stock</small></button>
        <button class="act fight" data-act="${urgent ? 'fight' : 'tab'}" ${urgent ? `data-id="${urgent.id}"` : 'data-tab="war"'}><i>⚔️</i><b>Fight</b>
          <small>${urgent ? esc(s.world.regions[urgent.region].name) : 'Choose a battle'}</small></button>
      </div>
    </div>
    ${housingCard(s)}
    ${s.feed.length ? `<div class="card"><div class="row spread"><h3>📰 Europe news</h3>${btn('More', 'tab', 'data-tab="people"', 'small ghost')}</div>
      ${s.feed.slice(0, 4).map((f) => `<div class="news">${esc(f.text)}</div>`).join('')}</div>` : ''}
    ${tutHtml}
    ${dailyHtml}
    <div class="card">
      <h3>🎒 Inventory</h3>
      <div class="inv">
        ${[1, 2, 3, 4, 5].map((q) => `<div title="Food Q${q} (+${FOOD_ENERGY[q]} energy)">🍞<b>${fmt(s.inv.food[q])}</b><small>Q${q}</small></div>`).join('')}
        ${[1, 2, 3, 4, 5].map((q) => `<div title="Weapon Q${q} (+${WEAPON_FP[q]}% firepower)">🔫<b>${fmt(s.inv.weapon[q])}</b><small>Q${q}</small></div>`).join('')}
        ${[1, 2, 3, 4, 5].map((q) => `<div title="${HOUSES[q].name} (Q${q})">${HOUSES[q].icon}<b>${fmt(s.inv.house[q])}</b><small>Q${q}</small></div>`).join('')}
        <div title="Food raw">🌾<b>${fmt(s.inv.foodRaw)}</b><small>raw</small></div>
        <div title="Weapon raw">⛓️<b>${fmt(s.inv.weaponRaw)}</b><small>raw</small></div>
        <div title="Building materials">🧱<b>${fmt(s.inv.houseRaw)}</b><small>raw</small></div>
        <div title="Bazooka">🚀<b>${s.inv.bazooka}</b><small>bazooka</small></div>
      </div>
    </div>
  </section>`;
}

function housingCard(s) {
  const active = G.activeHouses(s);
  const best = active.length ? HOUSES[active[active.length - 1]] : null;
  const owned = [1, 2, 3, 4, 5].filter((q) => s.inv.house[q] > 0);
  const bonusE = G.housingEnergy(s);
  const bonusR = Math.round((G.housingRegen(s) - 1) * 100);
  return `<div class="card housing">
    <h3>🏠 Housing</h3>
    <div class="row">
      <div class="house-pic ${best ? '' : 'none'}">${best ? best.icon : '⛺'}</div>
      <div class="grow">
        <b>${best ? `You live in a ${best.name}` : 'You have no house'}</b>
        <div class="muted small">${best ? `+${bonusE} max energy · +${bonusR}% energy regen` : 'Houses raise your max energy and energy regeneration.'}</div>
      </div>
    </div>
    ${active.map((q) => `<div class="kv"><span>${HOUSES[q].icon} ${HOUSES[q].name} Q${q} <small class="muted">+${HOUSES[q].energy}⚡ · +${HOUSES[q].regen * 100}%</small></span><b data-cd="${s.housing[q]}"></b></div>`).join('')}
    ${owned.length ? `<div class="row house-own">${owned.map((q) => btn(`${HOUSES[q].icon} Move into ${HOUSES[q].name} (${s.inv.house[q]})`, 'moveIn', `data-q="${q}"`, 'small primary')).join('')}</div>` : ''}
    <div class="row spread"><small class="muted">Different qualities stack. A house lasts ${CONFIG.houseDurationMs / 3600000}h; moving in again extends it.</small>
    ${btn('Buy houses', 'tab', 'data-tab="market"', 'small')}</div>
  </div>`;
}

function campRow(s, c, joinable) {
  const reg = s.world.regions[c.region];
  const side = G.playerSide(s, c);
  const type = c.type === 'rw' ? 'Resistance' : side === 'att' ? 'Attack' : side === 'def' ? 'Defense' : 'War';
  return `<div class="camp ${side ? 'mine' : ''}">
    <div class="camp-flags">${flagSvg(c.att)}<span>vs</span>${flagSvg(c.def)}</div>
    <div class="grow">
      <b>${esc(reg.name)}${reg.capital ? ' ★' : ''}</b> <span class="pill ${side === 'def' ? 'red' : ''}">${type}</span>
      <div class="muted small">${cName(c.att)} ${c.attWins} : ${c.defWins} ${cName(c.def)} · Round ${c.round}
      ${side ? ` · auto-resolves in <span data-cd="${c.deadline}"></span>` : ''}</div>
    </div>
    ${joinable ? btn('Fight', 'fight', `data-id="${c.id}"`, 'primary') : ''}
    ${side ? topFighters(s, c) : ''}
  </div>`;
}

function topFighters(s, c) {
  const f = Object.entries(c.fighters || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const mine = G.playerSide(s, c);
  const allies = (mine === 'att' ? c.dmgAtt : c.dmgDef) || 0;
  const foes = (mine === 'att' ? c.dmgDef : c.dmgAtt) || 0;
  return `<div class="fighters">
    <small class="muted">Since last round: allied citizens 💥${fmt(allies)} · enemy citizens 💥${fmt(foes)}</small>
    ${f.length ? `<small>Top fighters: ${f.map(([id, d]) => `${who(s, id === 'P' ? 'P' : Number(id))} ${fmt(d)}`).join(' · ')}</small>` : ''}
  </div>`;
}

function war(s) {
  const mine = activeCampaigns(s);
  const others = s.world.campaigns.filter((c) => !G.playerSide(s, c));
  const p = s.player;
  const ri = G.rankIndex(p.rankPoints);
  const setupPreview = mine[0] ? G.roundSetup(s, mine[0].id) : null;
  return `<section class="grid">
    <div class="card span2">
      <h3>⚔️ Your country's battles</h3>
      ${mine.length ? mine.map((c) => campRow(s, c, true)).join('') : '<p class="muted">No active campaigns. A new front will open soon…</p>'}
      ${setupPreview ? `<p class="muted small">Enemy strength: ${setupPreview.difficulty < 0.8 ? '🟢 weak' : setupPreview.difficulty < 1 ? '🟡 even' : '🔴 strong'} · Win ${CONFIG.roundsToWin} rounds to take the region. If you don't fight, the campaign resolves without you.</p>` : ''}
    </div>
    <div class="card">
      <h3>🎯 Training war</h3>
      <p class="muted">Practice any time against weaker troops. Half rewards, no map changes.</p>
      ${btn('Start training round', 'fight', 'data-id="training"')}
    </div>
    <div class="card">
      <h3>🪖 Military profile</h3>
      <div class="kv"><span>Rank</span><b>${RANKS[ri]}</b></div>
      <div class="kv"><span>Rank points</span><b>${fmt(p.rankPoints)} / ${fmt(rankThreshold(ri + 1))}</b></div>
      <div class="kv"><span>Strength</span><b>${fmt(p.strength)}</b></div>
      <div class="kv"><span>Division</span><b>D${G.division(p.level)}</b></div>
      <div class="kv"><span>Total damage</span><b>${fmt(p.damage)}</b></div>
      <div class="dmg-table">${[0, 1, 2, 3, 4, 5].map((q) => `<div><small>${q ? 'Q' + q : '✊'}</small><b>${fmt(G.hitDamage(s, q))}</b></div>`).join('')}</div>
      <p class="muted small">Damage = 10 × (1 + Strength/400) × (1 + Rank/5) × weapon firepower. Headshots ×2, combos up to +50%.</p>
    </div>
    <div class="card span2">
      <h3>🌍 World battles</h3>
      ${others.length ? others.map((c) => campRow(s, c, false)).join('') : '<p class="muted">The world is quiet… for now.</p>'}
    </div>
  </section>`;
}

// ------------------------------------------------------------------ map
const FULL_VB = [0, 0, MAP_W, MAP_H];

export function mapSvg(s, sel) {
  const vb = ui.vb || FULL_VB;
  const battle = new Map(s.world.campaigns.map((c) => [c.region, c]));
  const me = s.player.country;
  const colors = Object.fromEntries(COUNTRIES.map((c) => [c.id, c]));
  let fills = '';
  let marks = '';
  for (const r of s.world.regions) {
    const own = colors[r.owner];
    const b = battle.get(r.id);
    const g = EU_REGIONS[r.id];
    const cls = ['rg', r.id === sel ? 'sel' : '', r.owner === me ? 'mine' : ''].join(' ');
    fills += `<path class="${cls}" d="${EU_PATHS[r.id]}" fill="${own.color}" data-act="region" data-id="${r.id}"/>`;
    if (r.origin !== r.owner) marks += `<circle cx="${g.x}" cy="${g.y}" r="3.2" fill="${colors[r.origin].color}" stroke="#000" stroke-width=".8"/>`;
    if (r.capital) marks += `<text x="${g.x}" y="${g.y - 4}" class="cap">★</text>`;
    if (r.res) marks += `<text x="${g.x}" y="${g.y + 9}" class="res">${RESOURCES[r.res].icon}</text>`;
    if (b) marks += `<text x="${g.x + 7}" y="${g.y + 3}" class="bat">⚔️</text>`;
    marks += `<text x="${g.x}" y="${g.y + (r.res ? 15 : 8)}" class="lbl">${esc(r.name)}</text>`;
  }
  const zoomed = vb[2] < MAP_W / 2.2;
  return `<svg id="map-svg" class="map ${zoomed ? 'zoomed' : ''}" viewBox="${vb.map((v) => v.toFixed(1)).join(' ')}" preserveAspectRatio="xMidYMid meet">
    <rect x="-2000" y="-2000" width="${MAP_W + 4000}" height="${MAP_H + 4000}" class="sea"/>
    <path d="${EU_NEUTRAL}" class="neutral"/>
    <g class="regions">${fills}</g>
    <path d="${EU_BORDERS}" class="borders"/>
    ${sel !== null && sel !== undefined ? `<path d="${EU_PATHS[sel]}" class="sel-outline"/>` : ''}
    <g class="marks">${marks}</g>
  </svg>
  <div class="map-ctl"><button class="icon-btn" data-act="mapZoom" data-z="1.6" title="Zoom in">＋</button><button class="icon-btn" data-act="mapZoom" data-z="0.625" title="Zoom out">－</button><button class="icon-btn" data-act="mapZoom" data-z="0" title="Show all">⤢</button></div>`;
}

// Pan (drag), zoom (wheel / pinch / buttons) by rewriting the SVG viewBox in place.
function setVb(svg, vb) {
  const w = Math.min(MAP_W * 1.2, Math.max(MAP_W / 12, vb[2]));
  const h = (w * MAP_H) / MAP_W;
  const cx = vb[0] + vb[2] / 2;
  const cy = vb[1] + vb[3] / 2;
  const x = Math.min(MAP_W - w / 3, Math.max(-w * 2 / 3, cx - w / 2));
  const y = Math.min(MAP_H - h / 3, Math.max(-h * 2 / 3, cy - h / 2));
  ui.vb = [x, y, w, h];
  svg.setAttribute('viewBox', ui.vb.map((v) => v.toFixed(1)).join(' '));
  svg.classList.toggle('zoomed', w < MAP_W / 2.2);
}

export function zoomMap(factor, cx, cy) {
  const svg = document.getElementById('map-svg');
  if (!svg) return;
  if (!factor) { ui.vb = null; setVb(svg, FULL_VB); ui.vb = null; return; }
  const vb = ui.vb || FULL_VB;
  const px = cx ?? vb[0] + vb[2] / 2;
  const py = cy ?? vb[1] + vb[3] / 2;
  const w = vb[2] / factor;
  const h = vb[3] / factor;
  setVb(svg, [px - ((px - vb[0]) / vb[2]) * w, py - ((py - vb[1]) / vb[3]) * h, w, h]);
}

export function bindMap() {
  const svg = document.getElementById('map-svg');
  if (!svg) return;
  const pts = new Map();
  let start = null;
  const toMap = (e) => {
    const r = svg.getBoundingClientRect();
    const vb = ui.vb || FULL_VB;
    const scale = Math.max(vb[2] / r.width, vb[3] / r.height);
    const ox = (r.width - vb[2] / scale) / 2;
    const oy = (r.height - vb[3] / scale) / 2;
    return { x: vb[0] + (e.clientX - r.left - ox) * scale, y: vb[1] + (e.clientY - r.top - oy) * scale, scale };
  };
  svg.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    ui.dragged = false;
    start = { vb: [...(ui.vb || FULL_VB)], x: e.clientX, y: e.clientY, dist: 0 };
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      start.dist = Math.hypot(a.x - b.x, a.y - b.y);
      start.mid = toMap({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
    }
  });
  svg.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && start.dist) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const f = d / start.dist;
      const w = start.vb[2] / f;
      const h = start.vb[3] / f;
      const m = start.mid;
      setVb(svg, [m.x - ((m.x - start.vb[0]) / start.vb[2]) * w, m.y - ((m.y - start.vb[1]) / start.vb[3]) * h, w, h]);
      ui.dragged = true;
      return;
    }
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!ui.dragged && Math.hypot(dx, dy) < 6) return;
    ui.dragged = true;
    const r = svg.getBoundingClientRect();
    const scale = Math.max(start.vb[2] / r.width, start.vb[3] / r.height);
    setVb(svg, [start.vb[0] - dx * scale, start.vb[1] - dy * scale, start.vb[2], start.vb[3]]);
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (pts.size === 1) {
      const [p] = [...pts.values()];
      start = { vb: [...(ui.vb || FULL_VB)], x: p.x, y: p.y, dist: 0 };
    } else if (!pts.size) start = null;
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const m = toMap(e);
    zoomMap(e.deltaY < 0 ? 1.25 : 0.8, m.x, m.y);
  }, { passive: false });
}

function regionPanel(s, id) {
  if (id === null || id === undefined) return '<p class="muted">Tap a region to inspect it.</p>';
  const r = s.world.regions[id];
  const own = countryById(r.owner);
  const camp = s.world.campaigns.find((c) => c.region === id);
  const nbrs = neighborsOf(s.world, id).map((n) => s.world.regions[n]);
  let actions = '';
  if (camp) {
    actions += campRow(s, camp, !!G.playerSide(s, camp));
  } else {
    const dw = G.canDeclareWar(s, id);
    if (dw.ok) actions += btn('⚔️ Declare war', 'declareWar', `data-id="${id}"`, 'primary');
    else if (s.politics.president && r.owner !== s.player.country) actions += `<p class="muted small">${dw.msg}</p>`;
    if (r.origin === s.player.country && r.owner !== s.player.country) actions += btn('✊ Start resistance (5 🪙)', 'resist', `data-id="${id}"`, 'primary');
  }
  return `<div class="region-panel">
    <h3>${flagSvg(r.owner)} ${esc(r.name)} ${r.capital ? '<span class="pill gold">Capital</span>' : ''}</h3>
    <div class="kv"><span>Owner</span><b>${own.name}</b></div>
    ${r.origin !== r.owner ? `<div class="kv"><span>Occupied from</span><b>${cName(r.origin)}</b></div>` : ''}
    <div class="kv"><span>Resource</span><b>${r.res ? `${RESOURCES[r.res].icon} ${RESOURCES[r.res].name} (+${20}% ${RESOURCES[r.res].kind})` : '—'}</b></div>
    <div class="kv"><span>Borders</span><b>${[...new Set(nbrs.map((n) => n.owner))].map((o) => flagSvg(o)).join(' ')}</b></div>
    ${actions}
    ${!s.politics.president && r.owner !== s.player.country && !camp ? '<p class="muted small">Only the President can declare war. Run for office in Politics!</p>' : ''}
  </div>`;
}

function map(s) {
  const counts = COUNTRIES.map((c) => ({ c, n: regionsOf(s.world, c.id).length })).sort((a, b) => b.n - a.n);
  const total = s.world.regions.length;
  const mine = regionsOf(s.world, s.player.country).length;
  return `<section class="map-wrap">
    <div class="card map-card">
      <div class="row spread"><h3>🗺️ World map</h3><small class="muted">${G.pc(s).name} controls ${mine}/${total} regions (${Math.round((mine / total) * 100)}%)</small></div>
      <div id="map-holder">${mapSvg(s, ui.sel)}</div>
      <p class="muted small">Drag to move, pinch or scroll to zoom. ★ capital · colored dot = occupied (original owner) · ⚔️ battle · icons = resources (+20% production each)</p>
    </div>
    <div class="side">
      <div class="card" id="region-panel">${regionPanel(s, ui.sel)}</div>
      <div class="card">
        <h3>🏆 Nations</h3>
        <div class="nations">${counts.map(({ c, n }) => `<div class="kv ${c.id === s.player.country ? 'me' : ''}"><span>${flagSvg(c.id)} ${c.name}</span><b>${n ? `${n} regions` : '<span class="red">wiped</span>'}</b></div>`).join('')}</div>
      </div>
    </div>
  </section>`;
}

// ------------------------------------------------------------------ economy
function economy(s) {
  const me = s.player.country;
  const alive = isAlive(s.world, me);
  const fr = distinctResources(s.world, me, 'food');
  const wr = distinctResources(s.world, me, 'weapon');
  const now = Date.now();
  const dblWait = s.timers.lastDoubleCollect + CONFIG.doubleCollectCooldownMs - now;
  const list = s.companies.map((c) => {
    const T = COMPANY_TYPES[c.type];
    const rate = G.companyRate(s, c);
    const cap = G.companyCap(s, c);
    const needs = T.kind === 'factory' ? `needs ${c.q * (T.rawMult || 1)} ${RAW_ICON[T.input]} each` : `${RAW_ICON[T.output]} raw`;
    return `<div class="company">
      <i>${T.icon}</i>
      <div class="grow">
        <b>${T.name}${T.kind === 'factory' ? ` Q${c.q}` : ''}</b> <small class="muted">Lv ${c.lvl} · ${fmt(rate)}/min · ${needs}</small>
        <div data-pend="${c.id}" class="pend">${bar((c.pending / cap) * 100, 'thin')}<small><span class="pend-n">${fmt(c.pending)}</span> / ${fmt(cap)}</small></div>
      </div>
      <div class="col">
        ${c.lvl < G.MAX_COMPANY_LEVEL ? btn(`Lv+ 💰${fmt(G.levelUpCost(c))}`, 'upLevel', `data-id="${c.id}"`, 'small') : ''}
        ${T.kind === 'factory' && c.q < 5 ? btn(`Q+ 🪙${G.qualityUpCost(c)}`, 'upQuality', `data-id="${c.id}"`, 'small') : ''}
      </div>
    </div>`;
  }).join('');
  return `<section class="grid">
    <div class="card span2">
      <div class="row spread"><h3>🏭 Your companies (${s.companies.length}/${G.companyLimit(s)})</h3>
        <div class="row">${btn('Collect all', 'collect', '', 'primary')}
        ${btn(dblWait > 0 ? `📺 2× in <span data-cd="${s.timers.lastDoubleCollect + CONFIG.doubleCollectCooldownMs}"></span>` : '📺 Collect 2×', 'collectDouble', dblWait > 0 ? 'disabled' : '', 'ad')}</div></div>
      ${list || '<p class="muted">You don\'t own any companies yet. Build a Farm to start producing!</p>'}
      <p class="muted small">Companies keep producing while you are away (storage: ${CONFIG.companyStorageMinutes / 60}h). Factories convert raw materials when you collect.</p>
    </div>
    <div class="card">
      <h3>🏗️ Build</h3>
      ${Object.entries(COMPANY_TYPES).map(([k, T]) => `<div class="build">
        <i>${T.icon}</i><div class="grow"><b>${T.name}</b><small class="muted">${T.desc}</small></div>
        ${btn(`💰${fmt(G.buildCost(s, k))}`, 'build', `data-type="${k}"`, 'small')}
      </div>`).join('')}
    </div>
    <div class="card">
      <h3>🌍 National resources</h3>
      ${alive ? '' : '<p class="red">Your country has no regions — no resource bonuses.</p>'}
      <div class="kv"><span>Food bonus</span><b>+${Math.round((resourceBonus(s.world, me, 'food') - 1) * 100)}% ${fr.map((r) => RESOURCES[r].icon).join('')}</b></div>
      <div class="kv"><span>Weapon bonus</span><b>+${Math.round((resourceBonus(s.world, me, 'weapon') - 1) * 100)}% ${wr.map((r) => RESOURCES[r].icon).join('')}</b></div>
      <p class="muted small">Conquer regions with new resources to boost your Farms and Mines.</p>
      <h3>🏋️ Training grounds</h3>
      ${FACILITIES.map((f) => `<div class="kv"><span>${f.icon} ${f.name} (+${f.gain})</span>
        ${s.facilities[f.id] ? '<b class="green">✔</b>' : btn(`Unlock 🪙${f.gold}`, 'unlockFacility', `data-id="${f.id}"`, 'small')}</div>`).join('')}
    </div>
  </section>`;
}

// ------------------------------------------------------------------ market
const ago = (ms) => (ms < 60000 ? 'just now' : ms < 3600000 ? `${Math.floor(ms / 60000)}m ago` : `${Math.floor(ms / 3600000)}h ago`);
const priceTxt = (p) => (p < 10 ? p.toFixed(p < 1 ? 3 : 2) : fmtMoney(p));
const who = (s, seller) => { const w = sellerName(s, seller); return `${w.c ? flagSvg(w.c) : ''} ${esc(w.name)}`; };

function marketRow(s, key) {
  const m = MARKET[key];
  const avg = s.market.prices[key];
  const best = G.offersFor(s, key, 'P')[0];
  const stock = G.offersFor(s, key, 'P').reduce((a, o) => a + o.qty, 0);
  const have = G.invGet(s, key);
  const bulk = key.endsWith('Raw') ? [100, 1000] : key.startsWith('house') ? [1, 5] : [10, 100];
  const offerTxt = best
    ? `best 💰${priceTxt(best.price)} · ${who(s, best.seller)} · ${fmt(stock)} for sale`
    : `<span class="red">no offers</span> · state import 💰${priceTxt(G.importPrice(key))}`;
  return `<div class="mrow">
    <i>${m.icon}</i>
    <div class="grow"><b>${m.name}</b> <small class="muted">avg 💰${priceTxt(avg)} · you own ${fmt(have)}</small>
      <small class="offer-line">${offerTxt}</small></div>
    <div class="row mbtns">
      ${bulk.map((n) => btn(`Buy ${fmt(n)}`, 'buy', `data-key="${key}" data-n="${n}"`, 'small')).join('')}
      ${btn('Offers', 'offers', `data-key="${key}"`, 'small ghost')}
      ${have > 0 ? btn('Post offer', 'listModal', `data-key="${key}"`, 'small') : ''}
      ${have > 0 ? btn(`Sell now 💰${priceTxt(G.traderPrice(s, key))}`, 'sell', `data-key="${key}" data-n="${Math.min(have, bulk[0])}"`, 'small ghost') : ''}
      ${key.startsWith('house') && have > 0 ? btn('Move in', 'moveIn', `data-q="${key.slice(-1)}"`, 'small primary') : ''}
    </div>
  </div>`;
}

export function offersModal(s, key) {
  const list = G.offersFor(s, key).slice(0, 12);
  const m = MARKET[key];
  return `<h2>${m.icon} ${m.name} offers</h2>
    <p class="muted small">Average price 💰${priceTxt(s.market.prices[key])}. Citizens restock every few seconds.</p>
    <div class="offer-list">${list.length ? list.map((o) => `<div class="kv">
      <span>${who(s, o.seller)}<br><small class="muted">${fmt(o.qty)} × 💰${priceTxt(o.price)}</small></span>
      ${o.seller === 'P' ? btn('Cancel', 'cancelOffer', `data-id="${o.id}"`, 'small ghost') : `<span class="row">${btn(`Buy ${fmt(Math.min(o.qty, key.startsWith('house') ? 1 : 10))}`, 'buyOffer', `data-id="${o.id}" data-n="${Math.min(o.qty, key.startsWith('house') ? 1 : 10)}"`, 'small')}${o.qty > 10 ? btn(`Buy ${fmt(Math.min(o.qty, 500))}`, 'buyOffer', `data-id="${o.id}" data-n="${Math.min(o.qty, 500)}"`, 'small') : ''}</span>`}
    </div>`).join('') : '<p>No offers right now.</p>'}</div>
    <div class="row"><button class="btn" data-act="closeModal">Close</button></div>`;
}

export function listModal(s, key) {
  const m = MARKET[key];
  const best = G.offersFor(s, key, 'P')[0];
  const suggest = best ? Math.max(0.001, best.price * 0.98) : s.market.prices[key];
  const have = G.invGet(s, key);
  return `<h2>Post offer: ${m.icon} ${m.name}</h2>
    <p class="muted small">You own ${fmt(have)}. Cheapest competing offer: ${best ? `💰${priceTxt(best.price)}` : 'none'}. Citizens buy the cheapest offers first; you are paid when they buy.</p>
    <label class="field"><span>Quantity</span><input id="offer-qty" type="number" min="1" max="${have}" value="${have}"></label>
    <label class="field"><span>Price per unit (💰)</span><input id="offer-price" type="number" min="0.001" step="0.001" value="${suggest.toFixed(3)}"></label>
    <div class="row"><button class="btn primary" data-act="postOffer" data-key="${key}">Post offer</button><button class="btn" data-act="closeModal">Cancel</button></div>`;
}

function myOffersCard(s) {
  const mine = G.myOffers(s);
  return `<div class="card span2">
    <h3>📋 Market — ${fmt(s.market.offers.length)} offers from citizens across Europe</h3>
    <p class="muted small">Buy buttons take the cheapest offers first. Post your own offers and AI citizens will buy them. "Sell now" sells instantly to a trader at 70% of the average price.</p>
    ${mine.length ? mine.map((o) => `<div class="kv"><span>${MARKET[o.key].icon} ${MARKET[o.key].name}: ${fmt(o.qty)} × 💰${priceTxt(o.price)}</span>${btn('Cancel', 'cancelOffer', `data-id="${o.id}"`, 'small ghost')}</div>`).join('') : '<p class="muted small">You have no active offers.</p>'}
  </div>`;
}

function market(s) {
  const now = Date.now();
  const fg = s.timers.lastFreeGold + CONFIG.freeGoldCooldownMs - now;
  return `<section class="grid wide">
    ${myOffersCard(s)}
    <div class="card">
      <h3>🍞 Food</h3><p class="muted small">Food turns your reserve into usable energy. Q1 = +10 … Q5 = +50.</p>
      ${[1, 2, 3, 4, 5].map((q) => marketRow(s, 'food' + q)).join('')}
    </div>
    <div class="card">
      <h3>🔫 Weapons</h3><p class="muted small">One weapon per shot. Firepower Q1 +20% … Q5 +100%.</p>
      ${[1, 2, 3, 4, 5].map((q) => marketRow(s, 'weapon' + q)).join('')}
    </div>
    <div class="card">
      <h3>🏠 Houses</h3><p class="muted small">Move in from the Home tab. Each quality adds max energy and faster energy regen for ${CONFIG.houseDurationMs / 3600000}h; qualities stack.</p>
      ${[1, 2, 3, 4, 5].map((q) => marketRow(s, 'house' + q)).join('')}
    </div>
    <div class="card">
      <h3>⛏️ Raw materials</h3>
      ${marketRow(s, 'foodRaw')}${marketRow(s, 'weaponRaw')}${marketRow(s, 'houseRaw')}
      <p class="muted small">Prices move every minute. Selling returns ${CONFIG.sellRatio * 100}% of the price.</p>
    </div>
    <div class="card">
      <h3>🪙 Gold</h3>
      <div class="kv"><span>Buy 1 gold</span>${btn(`💰${CONFIG.goldBuyPrice}`, 'buyGold', '', 'small')}</div>
      <div class="kv"><span>Sell 1 gold</span>${btn(`+💰${CONFIG.goldSellPrice}`, 'sellGold', '', 'small ghost')}</div>
      <div class="kv"><span>Free gold</span>${btn(fg > 0 ? `📺 in <span data-cd="${s.timers.lastFreeGold + CONFIG.freeGoldCooldownMs}"></span>` : '📺 +2 🪙', 'freeGold', fg > 0 ? 'disabled' : '', 'small ad')}</div>
      <h3>✨ Gold shop</h3>
      ${Object.entries(GOLD_SHOP).map(([k, it]) => `<div class="mrow"><i>${it.icon}</i><div class="grow"><b>${it.name}</b><small class="muted"> ${it.desc}</small></div>${btn(`🪙${it.gold}`, 'goldShop', `data-key="${k}"`, 'small')}</div>`).join('')}
    </div>
  </section>`;
}

// ------------------------------------------------------------------ politics
function politics(s) {
  const pol = s.politics;
  const c = G.pc(s);
  const role = pol.president ? 'President' : pol.congress ? 'Congress member' : pol.party ? 'Party member' : 'Citizen';
  const office = pol.electionType;
  const o = G.OFFICES[office];
  const news = pol.news;
  const now = Date.now();
  const artWait = s.timers.lastArticle + CONFIG.articleCooldownMs - now;
  let runHtml;
  if (pol.candidate) runHtml = `<p>🗳️ You are running for <b>${G.OFFICES[pol.candidate].name}</b>. Win chance ~${Math.round(G.winChance(s, pol.candidate) * 100)}%.</p>`;
  else {
    const offices = Object.entries(G.OFFICES).filter(([k]) => !(k === 'congress' && pol.congress));
    runHtml = offices.map(([k, of]) => `<div class="kv"><span>Run for ${of.name} (Lv ${of.level}+, ~${Math.round(G.winChance(s, k) * 100)}%)</span>${btn(`💰${of.cost}`, 'run', `data-office="${k}"`, 'small')}</div>`).join('');
  }
  return `<section class="grid">
    <div class="card" style="--cc:${c.color}">
      <h3>${flagSvg(c.id, 'flag big')} ${c.name}</h3>
      <div class="kv"><span>President</span><b>${pol.president ? '👑 You' : `${esc(pol.presidentName)} <small class="muted">(AI citizen)</small>`}</b></div>
      <div class="kv"><span>Your role</span><b>${role}</b></div>
      <div class="kv"><span>Citizens</span><b>${citizensOf(s, c.id).length + 1}</b></div>
      <div class="kv"><span>Regions</span><b>${regionsOf(s.world, c.id).length}</b></div>
      <div class="kv"><span>Military power</span><b>${countryPower(s.world, c.id).toFixed(2)}</b></div>
      <div class="kv"><span>Popularity</span><b>${fmt(G.popularity(s))}</b></div>
      ${pol.president ? `<h3>📜 National policy</h3>${Object.entries(POLICIES).map(([k, p]) => `<div class="kv"><span>${p.name} <small class="muted">${p.desc}</small></span>${pol.policy === k ? '<b class="green">Active</b>' : btn('Enact', 'policy', `data-key="${k}"`, 'small')}</div>`).join('')}
        <p class="muted small">As President you choose where to attack: open the Map and declare war on a bordering region.</p>` : ''}
    </div>
    <div class="card">
      <h3>🗳️ Elections</h3>
      <div class="kv"><span>Next: ${o.name} election</span><b data-cd="${pol.nextElection}"></b></div>
      ${pol.party ? runHtml : `<p>Join a party to start your political career.</p>${btn('Join party', 'joinParty', '', 'primary')} <small class="muted">Level 3+</small>`}
      <p class="muted small">Congress: +20% salary, +1 🪙 per election. President: +2 🪙 per election, declares wars and sets national policy. Popularity (level, medals, newspaper subscribers) raises your chances.</p>
    </div>
    <div class="card">
      <h3>📰 Newspaper</h3>
      ${news ? `<div class="kv"><span>${esc(news.name)}</span><b>${fmt(news.subs)} subscribers</b></div>
        <div class="kv"><span>Articles</span><b>${news.articles}</b></div>
        ${btn(artWait > 0 ? `Next article in <span data-cd="${s.timers.lastArticle + CONFIG.articleCooldownMs}"></span>` : '✍️ Publish article (+5 XP)', 'article', artWait > 0 ? 'disabled' : '', 'primary')}`
      : `<p class="muted">Found a newspaper to gain subscribers, popularity and the Media Mogul medal.</p>
        <label class="field"><span>Name</span><input id="news-name" maxlength="28" placeholder="The ${c.name} Herald"></label>
        ${btn('Found newspaper (🪙2)', 'newspaper', '', 'primary')} <small class="muted">Level 5+</small>`}
    </div>
  </section>`;
}

// ------------------------------------------------------------------ citizens
const RANK_BY = {
  dmg: { label: 'Damage', val: (x) => x.dmg },
  str: { label: 'Strength', val: (x) => x.str },
  lvl: { label: 'Level', val: (x) => x.lvl * 1e6 + x.xp },
  m: { label: 'Wealth', val: (x) => x.m },
};

function people(s) {
  const p = s.player;
  const me = { n: p.name, c: p.country, lvl: p.level, xp: p.xp, str: p.strength, dmg: p.damage, m: p.money, rank: G.rankName(s), you: true };
  const pool = (ui.rankScope === 'country' ? citizensOf(s, p.country) : s.citizens)
    .map((b) => ({ n: b.n, c: b.c, lvl: b.lvl, xp: b.xp, str: b.str, dmg: b.dmg, m: b.m, rank: botRank(b), p: b.p, co: b.co }));
  pool.push(me);
  const val = RANK_BY[ui.rankBy].val;
  pool.sort((a, b) => val(b) - val(a));
  const myPos = pool.findIndex((x) => x.you) + 1;
  const shown = pool.slice(0, 15);
  const showVal = (x) => ui.rankBy === 'm' ? '💰' + fmt(x.m) : ui.rankBy === 'lvl' ? 'Lv ' + x.lvl : fmt(RANK_BY[ui.rankBy].val(x));
  const tabBtn = (k, v, label) => `<button class="btn small ${ui[k] === v ? 'primary' : 'ghost'}" data-act="rankSet" data-k="${k}" data-v="${v}">${label}</button>`;
  const countryCount = citizensOf(s, p.country).length;
  return `<section class="grid">
    <div class="card span2">
      <div class="row spread"><h3>🏅 Rankings</h3>
        <div class="row">${tabBtn('rankScope', 'country', G.pc(s).name)}${tabBtn('rankScope', 'world', 'Europe')}</div></div>
      <div class="row rank-by">${Object.entries(RANK_BY).map(([k, r]) => tabBtn('rankBy', k, r.label)).join('')}</div>
      <div class="ranking">${shown.map((x, i) => `<div class="rk ${x.you ? 'me' : ''}">
        <b class="pos">${i + 1}</b>${flagSvg(x.c)}
        <span class="grow"><b>${esc(x.n)}</b>${x.you ? ' <span class="pill gold">you</span>' : ''}<br><small class="muted">Lv ${x.lvl} · ${x.rank}${x.p ? ` · ${PERSONAS[x.p].icon} ${PERSONAS[x.p].name}` : ''}${x.co ? ` · owns ${COMPANY_TYPES[x.co.t].icon}` : ''}</small></span>
        <b>${showVal(x)}</b></div>`).join('')}</div>
      ${myPos > 15 ? `<p class="muted small">You are #${myPos} of ${pool.length}.</p>` : ''}
    </div>
    <div class="card">
      <h3>📰 Europe news</h3>
      ${s.feed.length ? s.feed.slice(0, 14).map((f) => `<div class="news"><small class="muted">${ago(Date.now() - f.t)}</small> ${esc(f.text)}</div>`).join('') : '<p class="muted">News will appear as citizens act.</p>'}
    </div>
    <div class="card">
      <h3>👥 Society</h3>
      <div class="kv"><span>Citizens of ${G.pc(s).name}</span><b>${countryCount + 1}</b></div>
      <div class="kv"><span>Citizens in Europe</span><b>${s.citizens.length + 1}</b></div>
      <div class="kv"><span>Active market offers</span><b>${fmt(s.market.offers.length)}</b></div>
      <p class="muted small">AI citizens live like you: they work, train, eat, fight in their country's battles, run companies and trade on the market. Their damage decides battles you are not fighting in, and your allies' damage makes your own rounds easier.</p>
    </div>
  </section>`;
}

// ------------------------------------------------------------------ medals
function medals(s) {
  const p = s.player;
  const cnt = s.counters;
  return `<section class="grid">
    <div class="card span2">
      <h3>🎖️ Medals</h3>
      <div class="medals">${Object.entries(MEDALS).map(([k, m]) => `<div class="medal ${s.medals[k] ? 'got' : ''}">
        <i>${m.icon}</i><b>${m.name}</b><small>${m.desc}</small><span>×${s.medals[k] || 0} · +${m.gold}🪙</span></div>`).join('')}</div>
    </div>
    <div class="card">
      <h3>📊 Career</h3>
      <div class="kv"><span>Times worked</span><b>${fmt(p.works)}</b></div>
      <div class="kv"><span>Strength</span><b>${fmt(p.strength)}</b></div>
      <div class="kv"><span>Enemies defeated</span><b>${fmt(cnt.kill || 0)}</b></div>
      <div class="kv"><span>Headshots</span><b>${fmt(cnt.headshot || 0)}</b></div>
      <div class="kv"><span>Rounds won / played</span><b>${fmt(cnt.roundWin || 0)} / ${fmt(cnt.roundPlay || 0)}</b></div>
      <div class="kv"><span>Regions conquered</span><b>${fmt(cnt.conquest || 0)}</b></div>
      <div class="kv"><span>Total damage</span><b>${fmt(p.damage)}</b></div>
    </div>
    <div class="card">
      <h3>⚙️ Game</h3>
      ${btn('Sound on/off', 'mute')}
      ${btn('How to play', 'help')}
      <p class="muted small">Progress saves automatically.</p>
      ${btn('Reset progress', 'reset', '', 'ghost danger')}
    </div>
  </section>`;
}

export function helpHtml() {
  return `<h2>How to play</h2>
  <ul class="help">
    <li><b>Energy ⚡</b> powers everything: working, training and every shot in battle. It regenerates slowly.</li>
    <li><b>Food reserve 🍞</b> refills quickly. <b>Eat</b> food to turn reserve into usable energy.</li>
    <li><b>Work</b> earns money. <b>Train</b> raises strength, which raises your damage.</li>
    <li><b>Fight</b>: tap enemies before they shoot you. Headshots deal double damage, fast hits build combos. Push the wall above 50% by the end of the round to win it. Win ${CONFIG.roundsToWin} rounds to take a region.</li>
    <li><b>Citizens 👥</b>: hundreds of AI citizens live the same life: they fight in battles, run companies and post offers on the Market. Buy from them, sell to them, and climb the rankings.</li>
    <li><b>Rank</b> grows with damage and multiplies your damage further.</li>
    <li><b>Houses 🏠</b> raise your max energy and energy regeneration for a few hours. Buy them on the Market or build them with a Construction company.</li>
    <li><b>Companies</b> produce raw materials, food and weapons — even while you are away. Owning resource regions boosts production.</li>
    <li><b>Politics</b>: join a party, get elected to Congress, then become President to choose wars and national policy.</li>
    <li>Goal: lead your nation to rule the whole map!</li>
  </ul>
  <div class="row">${btn('Got it', 'closeModal', '', 'primary')}</div>`;
}
