// Player + AI citizen marketplace: sellers post offers (ilan), buyers take the cheapest ones.
// When the order book is empty the player can still buy expensive state imports.
import { MARKET } from './data.js';
import { clamp } from './util.js';

export const IMPORT_MULT = 1.8;
export const TRADER_MULT = 0.7; // instant "sell to trader" price vs average
const MAX_OFFERS_PER_ITEM = 40;

export const importPrice = (key) => MARKET[key].base * IMPORT_MULT;
export const traderPrice = (s, key) => s.market.prices[key] * TRADER_MULT;

export function offersFor(s, key, exclude) {
  return s.market.offers
    .filter((o) => o.key === key && o.qty > 0 && o.seller !== exclude)
    .sort((a, b) => a.price - b.price);
}

export const bestOffer = (s, key, exclude) => offersFor(s, key, exclude)[0] || null;
export const supply = (s, key, exclude) => offersFor(s, key, exclude).reduce((a, o) => a + o.qty, 0);

function recordTrade(s, key, price) {
  const base = MARKET[key].base;
  s.market.prices[key] = clamp(s.market.prices[key] * 0.9 + price * 0.1, base * 0.3, base * 4);
}

function pay(s, seller, amount, key, n) {
  if (seller === 'P') {
    s.player.money += amount;
    const sold = (s.market.sold ||= {});
    sold[key] = sold[key] || { n: 0, m: 0 };
    sold[key].n += n;
    sold[key].m += amount;
  } else {
    const b = s.citizens[seller];
    if (b) b.m += amount;
  }
}

// Cost of buying `qty` right now (cheapest offers first, then imports if allowed).
export function quote(s, key, qty, buyer = 'P', allowImport = true) {
  let left = qty;
  let cost = 0;
  for (const o of offersFor(s, key, buyer)) {
    if (left <= 0) break;
    const n = Math.min(left, o.qty);
    cost += n * o.price;
    left -= n;
  }
  if (allowImport && left > 0) { cost += left * importPrice(key); left = 0; }
  return { cost, qty: qty - left };
}

// Buys up to `qty` units; the caller deducts `cost` from the buyer.
export function takeOffers(s, key, qty, buyer, { maxPrice = Infinity, maxMoney = Infinity, allowImport = false, only = null } = {}) {
  let got = 0;
  let cost = 0;
  const list = only ? [only] : offersFor(s, key, buyer);
  for (const o of list) {
    if (got >= qty || o.price > maxPrice) break;
    const afford = Math.floor((maxMoney - cost) / o.price + 1e-9);
    const n = Math.min(qty - got, o.qty, afford);
    if (n <= 0) break;
    o.qty -= n;
    got += n;
    cost += n * o.price;
    pay(s, o.seller, n * o.price, key, n);
    recordTrade(s, key, o.price);
  }
  if (allowImport && got < qty) {
    const p = importPrice(key);
    const n = Math.min(qty - got, Math.floor((maxMoney - cost) / p + 1e-9));
    if (n > 0) { got += n; cost += n * p; }
  }
  if (got) s.market.offers = s.market.offers.filter((o) => o.qty > 0);
  return { qty: got, cost };
}

// One offer per seller and item: new stock is added and the price is updated.
export function listOffer(s, seller, key, qty, price) {
  if (qty <= 0) return null;
  let o = s.market.offers.find((x) => x.seller === seller && x.key === key);
  if (o) { o.qty += qty; o.price = price; }
  else {
    o = { id: s.market.nextOfferId++, seller, key, qty, price };
    s.market.offers.push(o);
  }
  return o;
}

// Keeps the order book small: drops the most expensive citizen offers beyond the cap.
export function pruneOffers(s) {
  const byKey = new Map();
  for (const o of s.market.offers) {
    if (!byKey.has(o.key)) byKey.set(o.key, []);
    byKey.get(o.key).push(o);
  }
  const keep = new Set();
  for (const list of byKey.values()) {
    list.sort((a, b) => a.price - b.price);
    list.forEach((o, i) => { if (i < MAX_OFFERS_PER_ITEM || o.seller === 'P') keep.add(o); });
  }
  s.market.offers = s.market.offers.filter((o) => keep.has(o) && o.qty > 0);
}
