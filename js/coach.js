// On-screen onboarding: a pulsing ring and a short bubble on the one thing to do next (the current mission).
// No text walls: each guided mission is a single tap target. "Skip" ends the guidance.
import * as G from './game.js';
import { ONBOARDING_STEPS } from './data.js';

const $ = (id) => document.getElementById(id);
const q = (sel) => document.querySelector(sel);
let lastKey = '';

// What to point at for the current mission, depending on the open tab.
function target(s, ui) {
  const st = G.tutorialStep(s);
  if (!st || s.tutorial.skip || s.tutorial.step >= ONBOARDING_STEPS + 2) return null;
  const pr = G.tutorialProgress(s);
  const onHome = ui.tab === 'home';
  const home = { el: q('#tabs [data-tab="home"]'), text: '🏠 Back to Home' };
  if (pr.cur >= pr.n) return { el: q('#view [data-act="claimTutorial"]'), text: '🎁 Mission complete! Claim your reward' };
  switch (st.ev) {
    case 'kill':
      if (onHome) return { el: q('#view .act.fight'), text: '⚔️ Fight for your country' };
      if (ui.tab === 'war') return { el: q('#view [data-act="fight"]'), text: '⚔️ Join the battle' };
      return { el: q('#tabs [data-tab="war"]'), text: '⚔️ Go to War' };
    case 'work': return onHome ? { el: q('#view .act.work'), text: '🛠️ Work to earn money' } : home;
    case 'train': return onHome ? { el: q('#view .act.train'), text: '🏋️ Train to get stronger' } : home;
    case 'eat': return onHome ? { el: q('#view .act.eat'), text: '🍞 Eat to refill energy' } : home;
    case 'buy':
      if (ui.tab === 'market') return { el: q('#view [data-act="buy"]'), text: '🛒 Buy something you need' };
      return { el: q('#tabs [data-tab="market"]'), text: '🛒 Open the Market' };
    case 'rankView': return { el: q('#tabs [data-tab="people"]'), text: '👥 See who fights best' };
    default: return null;
  }
}

export function updateCoach(s, ui, blocked) {
  const box = $('coach');
  const t = s && !blocked ? target(s, ui) : null;
  const r = t?.el?.getBoundingClientRect();
  if (!t || !t.el || !r.width || !r.height) { box.hidden = true; return; }
  // bring the target into view once per step
  const key = `${s.tutorial.step}|${ui.tab}|${t.text}`;
  if (key !== lastKey) {
    lastKey = key;
    if (t.el.closest('#view') && (r.bottom > innerHeight - 10 || r.top < 60)) t.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  box.hidden = false;
  const ring = box.querySelector('.coach-ring');
  const pad = 6;
  Object.assign(ring.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
  const bub = box.querySelector('.coach-bubble');
  bub.querySelector('b').textContent = t.text;
  const bw = bub.offsetWidth;
  const bh = bub.offsetHeight;
  const below = r.bottom + pad + 12 + bh < innerHeight;
  const left = Math.max(8, Math.min(innerWidth - bw - 8, r.left + r.width / 2 - bw / 2));
  bub.style.left = `${left}px`;
  bub.style.top = `${below ? r.bottom + pad + 12 : r.top - pad - 12 - bh}px`;
  bub.classList.toggle('above', !below);
  bub.style.setProperty('--ax', `${Math.max(14, Math.min(bw - 14, r.left + r.width / 2 - left))}px`);
}
