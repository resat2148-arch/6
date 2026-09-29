// Static game data and balance knobs.
// Core rules are adapted from eRepublik (work / train / fight, energy + food,
// damage formula, military ranks, resource bonuses, campaigns, politics),
// compressed so one real-time session feels like several eRepublik days.

export const SAVE_VERSION = 1;
export const GAME_TITLE = 'Republic Rising';

export const CONFIG = {
  energyRegenMs: 5000, // +1 usable energy every 5 s
  reserveRegenMs: 1000, // +1 food reserve ("potential energy") every second
  energyCap: 400,
  offlineCapMs: 8 * 3600 * 1000,
  workEnergy: 10,
  trainEnergy: 10,
  shotEnergy: 1,
  enemyShotEnergy: 4,
  roundSeconds: 60,
  roundsToWin: 3,
  aiTickMs: 20000,
  aiRoundMinMs: 40000,
  aiRoundMaxMs: 75000,
  maxAiCampaigns: 4,
  aiWarChance: 0.12,
  rwChance: 0.03,
  defenseBonus: 1.15,
  playerCampaignTimeoutMs: 8 * 60 * 1000,
  electionEveryMs: 10 * 60 * 1000,
  articleCooldownMs: 3 * 60 * 1000,
  marketShiftMs: 60000,
  sellRatio: 0.8,
  goldBuyPrice: 120,
  goldSellPrice: 80,
  companyStorageMinutes: 180,
  midgameCooldownMs: 3 * 60 * 1000,
  doubleCollectCooldownMs: 5 * 60 * 1000,
  freeGoldCooldownMs: 10 * 60 * 1000,
  houseDurationMs: 4 * 3600 * 1000, // a house lasts 4 hours of real time
};

// Fictional nations (keeps the game free of real-world political baggage).
export const COUNTRIES = [
  { id: 'A', name: 'Valoria', color: '#3b82f6', dark: '#1e3a8a', motto: 'Strength through unity',
    flag: { dir: 'h', colors: ['#1e40af', '#f8fafc', '#1e40af'], emblem: 'star' } },
  { id: 'B', name: 'Karthos', color: '#ef4444', dark: '#7f1d1d', motto: 'Iron and fire',
    flag: { dir: 'v', colors: ['#111827', '#dc2626', '#111827'], emblem: 'circle' } },
  { id: 'C', name: 'Norvik', color: '#14b8a6', dark: '#134e4a', motto: 'The north endures',
    flag: { dir: 'h', colors: ['#0f766e', '#e2e8f0'], emblem: 'cross' } },
  { id: 'D', name: 'Solmara', color: '#eab308', dark: '#713f12', motto: 'Under the golden sun',
    flag: { dir: 'v', colors: ['#ca8a04', '#fef3c7', '#b91c1c'], emblem: 'sun' } },
  { id: 'E', name: 'Drakmir', color: '#a855f7', dark: '#4c1d95', motto: 'Fear no shadow',
    flag: { dir: 'h', colors: ['#581c87', '#0f172a', '#581c87'], emblem: 'diamond' } },
  { id: 'F', name: 'Esteran', color: '#22c55e', dark: '#14532d', motto: 'Rooted, rising',
    flag: { dir: 'v', colors: ['#15803d', '#f8fafc', '#15803d'], emblem: 'star' } },
];

export const countryById = (id) => COUNTRIES.find((c) => c.id === id);

// Hex map, odd rows shifted right. Letters = starting owner, '.' = sea.
export const MAP_ROWS = [
  '..AAA..BBB..',
  '.AAAA.BBBBB.',
  '.AAACCCBBB..',
  '..ACCCCDDD..',
  '.EECCC.DDDD.',
  'EEEEFF.DDD..',
  '.EEFFFFF.D..',
  '..EFFFF.....',
];

export const RESOURCES = {
  grain: { kind: 'food', icon: '🌾', name: 'Grain' },
  fish: { kind: 'food', icon: '🐟', name: 'Fish' },
  fruit: { kind: 'food', icon: '🍎', name: 'Fruits' },
  cattle: { kind: 'food', icon: '🐄', name: 'Cattle' },
  deer: { kind: 'food', icon: '🦌', name: 'Deer' },
  iron: { kind: 'weapon', icon: '⛓️', name: 'Iron' },
  oil: { kind: 'weapon', icon: '🛢️', name: 'Oil' },
  saltpeter: { kind: 'weapon', icon: '🧪', name: 'Saltpeter' },
  rubber: { kind: 'weapon', icon: '🌳', name: 'Rubber' },
  aluminum: { kind: 'weapon', icon: '🔩', name: 'Aluminum' },
};
export const FOOD_RES = Object.keys(RESOURCES).filter((k) => RESOURCES[k].kind === 'food');
export const WEAPON_RES = Object.keys(RESOURCES).filter((k) => RESOURCES[k].kind === 'weapon');
export const RESOURCE_BONUS = 0.2; // +20% production per distinct resource

export const NAME_A = ['Vel', 'Mar', 'Kor', 'Ast', 'Bel', 'Dun', 'Fal', 'Gor', 'Hal', 'Isen', 'Jor', 'Kal', 'Lor',
  'Mir', 'Nor', 'Ost', 'Pel', 'Ros', 'Sar', 'Tal', 'Ul', 'Var', 'Wes', 'Yor', 'Zan', 'Bra', 'Cel', 'Dra', 'Esk', 'Tor'];
export const NAME_B = ['ania', 'via', 'heim', 'dor', 'mark', 'land', 'ora', 'ith', 'ova', 'gard', 'esk', 'ium',
  'ara', 'onia', 'burg', 'wyn', 'ria', 'stan', 'vale', 'mont'];

// Military ranks (eRepublik naming). Index = rank level used in the damage formula.
const RANK_BASE = ['Private', 'Corporal', 'Sergeant', 'Lieutenant', 'Captain', 'Major', 'Commander',
  'Lt Colonel', 'Colonel', 'General', 'Field Marshal', 'Supreme Marshal', 'National Force',
  'World Class Force', 'Legendary Force', 'God of War', 'Titan'];
export const RANKS = ['Recruit', ...RANK_BASE.flatMap((b) => [b, b + ' *', b + ' **', b + ' ***'])];
export const rankThreshold = (i) => (i <= 0 ? 0 : Math.round(25 * Math.pow(i, 2.3)));

// Food quality -> energy restored. Weapon quality -> firepower (eRepublik style).
export const FOOD_ENERGY = [0, 10, 20, 30, 40, 50];
export const WEAPON_FP = [0, 20, 40, 60, 80, 100];

export const MARKET = {
  foodRaw: { name: 'Food raw', icon: '🌾', base: 0.02 },
  weaponRaw: { name: 'Weapon raw', icon: '⛓️', base: 0.03 },
  food1: { name: 'Food Q1', icon: '🍞', base: 0.3 },
  food2: { name: 'Food Q2', icon: '🍞', base: 0.6 },
  food3: { name: 'Food Q3', icon: '🍞', base: 0.9 },
  food4: { name: 'Food Q4', icon: '🍞', base: 1.2 },
  food5: { name: 'Food Q5', icon: '🍞', base: 1.5 },
  weapon1: { name: 'Weapon Q1', icon: '🔫', base: 0.2 },
  weapon2: { name: 'Weapon Q2', icon: '🔫', base: 0.4 },
  weapon3: { name: 'Weapon Q3', icon: '🔫', base: 0.6 },
  weapon4: { name: 'Weapon Q4', icon: '🔫', base: 0.8 },
  weapon5: { name: 'Weapon Q5', icon: '🔫', base: 1.0 },
  houseRaw: { name: 'Building materials', icon: '🧱', base: 0.04 },
  house1: { name: 'Hut (Q1)', icon: '🛖', base: 40 },
  house2: { name: 'Cottage (Q2)', icon: '🏠', base: 100 },
  house3: { name: 'Townhouse (Q3)', icon: '🏡', base: 220 },
  house4: { name: 'Villa (Q4)', icon: '🏘️', base: 450 },
  house5: { name: 'Mansion (Q5)', icon: '🏰', base: 900 },
};

export const RAW_ICON = { foodRaw: '🌾', weaponRaw: '⛓️', houseRaw: '🧱' };

// Houses (eRepublik style): each quality you live in adds max energy and faster energy regeneration.
// Different qualities stack; a house wears out after CONFIG.houseDurationMs.
export const HOUSES = [
  null,
  { name: 'Hut', icon: '🛖', energy: 20, regen: 0.1 },
  { name: 'Cottage', icon: '🏠', energy: 40, regen: 0.2 },
  { name: 'Townhouse', icon: '🏡', energy: 60, regen: 0.3 },
  { name: 'Villa', icon: '🏘️', energy: 80, regen: 0.4 },
  { name: 'Mansion', icon: '🏰', energy: 100, regen: 0.5 },
];

export const GOLD_SHOP = {
  bazooka: { name: 'Bazooka', icon: '🚀', gold: 2, desc: 'One massive blast that hits every enemy on screen.' },
  energyBar: { name: 'Energy Bar', icon: '⚡', gold: 1, desc: '+50 energy instantly (ignores food reserve).' },
};

export const COMPANY_TYPES = {
  farm: { name: 'Farm', icon: '🌾', kind: 'raw', output: 'foodRaw', res: 'food', rate: 60, cost: 150,
    desc: 'Produces food raw materials. Boosted by food resources your country owns.' },
  mine: { name: 'Mine', icon: '⛏️', kind: 'raw', output: 'weaponRaw', res: 'weapon', rate: 60, cost: 150,
    desc: 'Produces weapon raw materials. Boosted by weapon resources your country owns.' },
  bakery: { name: 'Bakery', icon: '🍞', kind: 'factory', output: 'food', input: 'foodRaw', rate: 12, cost: 400,
    desc: 'Turns food raw into food. Each unit needs Q raw.' },
  armory: { name: 'Arms Factory', icon: '🔫', kind: 'factory', output: 'weapon', input: 'weaponRaw', rate: 25, cost: 600,
    desc: 'Turns weapon raw into weapons. Each unit needs Q raw.' },
  quarry: { name: 'Quarry', icon: '🪨', kind: 'raw', output: 'houseRaw', res: null, rate: 60, cost: 250,
    desc: 'Produces building materials for houses.' },
  construction: { name: 'Construction Co.', icon: '🏗️', kind: 'factory', output: 'house', input: 'houseRaw', rate: 0.1, rawMult: 100, cost: 1200,
    desc: 'Builds houses. Each house needs 100 × Q building materials.' },
};

export const FACILITIES = [
  { id: 'weights', name: 'Weights Room', icon: '🏋️', gain: 5, gold: 0 },
  { id: 'climbing', name: 'Climbing Center', icon: '🧗', gain: 2.5, gold: 5 },
  { id: 'shooting', name: 'Shooting Range', icon: '🎯', gain: 5, gold: 15 },
  { id: 'special', name: 'Special Forces Center', icon: '🪖', gain: 10, gold: 40 },
];

export const POLICIES = {
  production: { name: 'Industrial Plan', desc: '+15% company production', mult: 1.15 },
  damage: { name: 'Military Doctrine', desc: '+10% damage for all citizens', mult: 1.1 },
  salary: { name: 'Minimum Wage Act', desc: '+20% salaries', mult: 1.2 },
};

export const MEDALS = {
  hardWorker: { name: 'Hard Worker', icon: '🛠️', desc: 'Work 30 times', gold: 5 },
  superSoldier: { name: 'Super Soldier', icon: '💪', desc: 'Gain 250 strength', gold: 5 },
  battleHero: { name: 'Battle Hero', icon: '🎖️', desc: 'Top damage in a battle round', gold: 3 },
  campaignHero: { name: 'Campaign Hero', icon: '🏆', desc: 'Top fighter of a won campaign', gold: 5 },
  truePatriot: { name: 'True Patriot', icon: '🛡️', desc: 'Deal 20,000 damage for your country', gold: 5 },
  resistanceHero: { name: 'Resistance Hero', icon: '✊', desc: 'Win a resistance war you fought in', gold: 5 },
  congressMember: { name: 'Congress Member', icon: '🏛️', desc: 'Get elected to Congress', gold: 5 },
  president: { name: 'Country President', icon: '👑', desc: 'Get elected President', gold: 5 },
  mediaMogul: { name: 'Media Mogul', icon: '📰', desc: 'Reach newspaper subscriber milestones', gold: 5 },
  tycoon: { name: 'Tycoon', icon: '🏭', desc: 'Own 5 companies', gold: 5 },
};
export const MEDIA_MILESTONES = [100, 500, 1000, 2500, 5000, 10000];
export const PATRIOT_STEP = 20000;

// Tutorial chain modelled on eRepublik's starter missions.
export const TUTORIAL = [
  { text: 'Work at your job to earn money', ev: 'work', n: 1, reward: { money: 20 } },
  { text: 'Train to increase your strength', ev: 'train', n: 1, reward: { gold: 1 } },
  { text: 'Open the War tab and defeat 10 enemies', ev: 'kill', n: 10, reward: { weapon1: 100 }, tab: 'war' },
  { text: 'Eat food to refill energy from your reserve', ev: 'eat', n: 1, reward: { food2: 10 } },
  { text: 'Buy food or weapons on the Market', ev: 'buy', n: 1, reward: { weapon2: 50 }, tab: 'market' },
  { text: 'Win a battle round', ev: 'roundWin', n: 1, reward: { gold: 2 }, tab: 'war' },
  { text: 'Build a Farm in the Economy tab', cond: (s) => s.companies.some((c) => c.type === 'farm'), reward: { money: 100 }, tab: 'economy' },
  { text: 'Build a Bakery to turn raw materials into food', cond: (s) => s.companies.some((c) => c.type === 'bakery'), reward: { gold: 2 }, tab: 'economy' },
  { text: 'Collect production from your companies', ev: 'collect', n: 1, reward: { money: 50 }, tab: 'economy' },
  { text: 'Buy a house on the Market and move in', ev: 'moveIn', n: 1, reward: { gold: 2 }, tab: 'market' },
  { text: 'Reach level 3 and join a political party', cond: (s) => s.politics.party, reward: { gold: 1 }, tab: 'politics' },
  { text: 'Reach level 5', cond: (s) => s.player.level >= 5, reward: { gold: 5 } },
  { text: 'Found a newspaper and publish an article', ev: 'article', n: 1, reward: { gold: 3 }, tab: 'politics' },
  { text: 'Help your country conquer a region', ev: 'conquest', n: 1, reward: { gold: 5, bazooka: 2 }, tab: 'war' },
];

export const DAILY_POOL = [
  { id: 'work', text: 'Work 5 times', ev: 'work', n: 5 },
  { id: 'train', text: 'Train 5 times', ev: 'train', n: 5 },
  { id: 'kill', text: 'Defeat 150 enemies', ev: 'kill', n: 150 },
  { id: 'round', text: 'Win 2 battle rounds', ev: 'roundWin', n: 2 },
  { id: 'collect', text: 'Collect production 3 times', ev: 'collect', n: 3 },
  { id: 'eat', text: 'Eat food 3 times', ev: 'eat', n: 3 },
  { id: 'head', text: 'Land 40 headshots', ev: 'headshot', n: 40 },
];
export const DAILY_COUNT = 4;
export const DAILY_REWARD_GOLD = 1;
export const DAILY_BONUS = { gold: 3, bazooka: 1 };

export const LOGIN_REWARDS = [
  { money: 100 },
  { food2: 20 },
  { gold: 2 },
  { weapon2: 200 },
  { gold: 3 },
  { bazooka: 3 },
  { gold: 8, food3: 30 },
];

export const PRESIDENT_NAMES = ['Aldric Stone', 'Mira Vance', 'Tomas Hale', 'Ines Korr', 'Viktor Lund',
  'Sela Marsh', 'Oren Blackwood', 'Lena Frost', 'Dario Quill', 'Nadia Rook', 'Felix Ward', 'Ysolde Grey'];
