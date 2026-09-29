// Newspapers and articles written by AI citizens (and the player). Titles are generated from
// what is actually happening: fronts, elections, presidents and market prices.
import { EU_REGIONS } from './europe.js';
import { MARKET, countryById, rankIndexOf } from './data.js';
import { pick } from './util.js';

const MAX_ARTICLES = 60;

// Popularity drives elections: subscribers, experience, military rank and current office.
export const botPopularity = (b) =>
  Math.round((b.np ? b.np.subs : 0) + b.lvl * 5 + rankIndexOf(b.rp) * 2 + (b.cong ? 50 : 0) + (b.pres ? 80 : 0));

export function newspaperName(b, rnd = Math.random) {
  const c = countryById(b.c).name;
  const regions = EU_REGIONS.filter((r) => r.c === b.c).map((r) => r.name);
  const last = b.n.split(' ').slice(1).join(' ');
  return pick([
    `The ${c} Times`, `${c} Today`, `Voice of ${c}`, `The ${pick(regions, rnd)} Herald`, `${last} Daily`,
    `The ${pick(regions, rnd)} Post`, `${c} Observer`, `The Free ${c}`, `${last}'s Chronicle`, `${c} Front Line`,
  ], rnd);
}

export function frontsOf(s, cid) {
  return s.world.campaigns.filter((c) => c.att === cid || c.def === cid);
}

export function articleTitle(s, b) {
  const c = countryById(b.c).name;
  const titles = [];
  const front = pick(frontsOf(s, b.c).length ? frontsOf(s, b.c) : [null]);
  if (front) {
    const reg = s.world.regions[front.region].name;
    const foe = countryById(front.att === b.c ? front.def : front.att).name;
    const attacking = front.att === b.c;
    titles.push(
      attacking ? `On to ${reg}: why ${c} will win this war` : `${c} must hold ${reg}!`,
      `All soldiers to ${reg}, the front needs you`,
      `${foe}'s ${attacking ? 'defence is crumbling' : 'aggression will not go unanswered'}`,
      `Battle report: ${reg}, round ${front.round}`,
    );
  }
  const pol = s.politics;
  const isHome = b.c === s.player.country;
  const pres = isHome ? pol.presidentName : null;
  if (pres && pres !== b.n) titles.push(b.amb > 0.75 ? `Why ${pres} is failing ${c}` : `We stand with President ${pres}`);
  if (b.pres) titles.push(`Presidential address to the citizens of ${c}`, `My government's plan for ${c}`);
  if (isHome && b.amb > 0.55 && b.lvl >= 8) {
    const office = pol.electionType === 'congress' ? 'Congress' : 'President';
    if (office === 'Congress' || b.cong) titles.push(`Vote ${b.n} for ${office}!`, `${b.n}: a new voice for ${c}`);
  }
  const q = 1 + Math.floor(Math.random() * 5);
  const wp = s.market.prices['weapon' + q];
  const fp = s.market.prices.food2;
  titles.push(
    `Weapon Q${q} at 💰${wp.toFixed(2)}: time to stock up?`,
    `Food prices are ${fp > MARKET.food2.base ? 'rising' : 'falling'}, and here is why`,
    `Citizens of ${c}, unite!`,
    'Guide: how to train efficiently',
    'Tycoon tips: raw materials are the new gold',
    `Welcome, new citizens of ${c}!`,
    `Interview with a ${b.p === 's' ? 'veteran soldier' : b.p === 't' ? 'business owner' : 'hard worker'} of ${c}`,
  );
  return pick(titles);
}

export function addArticle(s, author, c, paper, title) {
  s.articles.unshift({ id: s.nextArticleId++, a: author, c, paper, title, t: s.lastTick, votes: 0 });
  if (s.articles.length > MAX_ARTICLES) s.articles.length = MAX_ARTICLES;
}

// One world tick of the press: citizens publish, readers vote, votes bring subscribers.
export function pressStep(s, news) {
  for (const b of s.citizens) {
    if (b.amb === undefined) b.amb = Math.random();
    if (!b.np) {
      if (b.amb > 0.6 && b.lvl >= 5 && b.m > 300 && Math.random() < 0.004) {
        b.np = { name: newspaperName(b), subs: 0, articles: 0 };
        b.m -= 200;
        if (news.budget > 0) { news.budget--; news.feed(`📰 ${b.n} (${countryById(b.c).name}) founded ${b.np.name}`); }
      }
      continue;
    }
    if (Math.random() < 0.006 + b.amb * 0.006) {
      addArticle(s, b.id, b.c, b.np.name, articleTitle(s, b));
      b.np.articles++;
      b.np.subs += 1 + Math.floor(Math.random() * 3);
    }
  }
  // Readers vote on fresh articles; popular papers attract more readers.
  const now = s.lastTick;
  for (const a of s.articles) {
    const age = now - a.t;
    if (age > 15 * 60000) continue;
    const paperSubs = a.a === 'P' ? s.politics.news?.subs || 0 : s.citizens[a.a]?.np?.subs || 0;
    const chance = 0.25 + Math.min(0.5, paperSubs / 400);
    if (Math.random() < chance) {
      const v = 1 + Math.floor(Math.random() * 3);
      a.votes += v;
      const gain = Math.random() < 0.6 ? 1 : 0;
      if (a.a === 'P') { if (s.politics.news) s.politics.news.subs += gain; }
      else if (s.citizens[a.a]?.np) s.citizens[a.a].np.subs += gain;
    }
  }
}

export const authorOf = (s, a) => (a.a === 'P' ? { n: s.player.name, c: s.player.country, you: true } : s.citizens[a.a]);
