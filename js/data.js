// data.js — building definitions, economy constants, tiers, festivals.
// All numbers are per game day unless noted. Balance target: a new player
// reaches Kasba (~120 pop) in about 15–20 minutes of relaxed play.

export const CATS = [
  { id: 'house', name: 'Homes' },
  { id: 'farm',  name: 'Farms' },
  { id: 'shop',  name: 'Bazaar' },
  { id: 'civic', name: 'Seva' },
  { id: 'faith', name: 'Faith' },
  { id: 'fun',   name: 'Fun' },
  { id: 'work',  name: 'Industry' },
  { id: 'decor', name: 'Roads' },
];

// def fields: cost, upkeep, jobs, homes, food, water(capacity), power(+gen / -demand
// written as negative), income, happy, cover(radius), pol, tier(unlock pop),
// pw (needs power for income), desc, draw (art function key in arts.js)
export const BUILDINGS = {
  // ---- Homes ----
  jhuggi:   { name: 'Jhuggi',        cat: 'house', cost: 400,   upkeep: 1,  homes: 5,  pw: 0, tier: 0,   draw: 'jhuggi',   desc: 'A tarp-and-mud home. Humble, but home.' },
  kaccha:   { name: 'Kaccha Ghar',   cat: 'house', cost: 1100,  upkeep: 2,  homes: 9,  pw: 0, tier: 0,   draw: 'kaccha',   desc: 'Mud walls, thatch roof, cool in summer.' },
  pakka:    { name: 'Pakka Ghar',    cat: 'house', cost: 3600,  upkeep: 5,  homes: 16, pw: -1, tier: 0,  draw: 'pakka',    desc: 'Brick and cement with a rooftop tank.' },
  haveli:   { name: 'Haveli',        cat: 'house', cost: 8500,  upkeep: 10, homes: 18, pw: -1, happy: 2, tier: 2, draw: 'haveli', desc: 'Carved jharokhas around a courtyard.' },
  bungalow: { name: 'Bungalow',      cat: 'house', cost: 7500,  upkeep: 8,  homes: 8,  pw: -1, happy: 3, tier: 3, draw: 'bungalow', desc: 'A gated garden house for one lucky family.' },
  flats:    { name: 'Flat Block',    cat: 'house', cost: 13000, upkeep: 18, homes: 44, pw: -3, jobs: 2, tier: 3, draw: 'flats', desc: 'Four floors of city life and drying clothes.' },

  // ---- Farms ----
  wheat:  { name: 'Wheat Field',  cat: 'farm', cost: 900,  upkeep: 3, jobs: 2, food: 34, tier: 0, draw: 'wheat',  desc: 'Golden in harvest season. Feeds the shehar.' },
  paddy:  { name: 'Rice Paddy',   cat: 'farm', cost: 1200, upkeep: 3, jobs: 2, food: 28, tier: 0, draw: 'paddy',  desc: 'Loves the monsoon — food doubles when it rains.' },
  dairy:  { name: 'Dairy',        cat: 'farm', cost: 2400, upkeep: 6, jobs: 2, food: 12, income: 30, tier: 1, draw: 'dairy', desc: 'Fresh doodh every morning.' },
  mango:  { name: 'Mango Orchard',cat: 'farm', cost: 1500, upkeep: 2, jobs: 1, food: 6,  income: 20, happy: 2, tier: 1, draw: 'mango', desc: 'Aam ka baagh. Shade and sweetness.' },

  // ---- Bazaar ----
  chai:     { name: 'Chai Tapri',      cat: 'shop', cost: 650,   upkeep: 1,  jobs: 1, income: 20,  happy: 1, tier: 0, draw: 'chai',     desc: 'Cutting chai, bun-maska, full Adda.' },
  kirana:   { name: 'Kirana Shop',     cat: 'shop', cost: 2600,  upkeep: 4,  jobs: 2, income: 55,  pw: -1, tier: 0, draw: 'kirana', desc: 'Udhaar-khata open, biscuits stacked high.' },
  dhaba:    { name: 'Dhaba',           cat: 'shop', cost: 4200,  upkeep: 7,  jobs: 3, income: 95,  happy: 2, pw: -1, tier: 1, draw: 'dhaba', desc: 'Tandoori roti, charpais, truck-wala swag.' },
  bazaar:   { name: 'Bazaar',          cat: 'shop', cost: 7000,  upkeep: 12, jobs: 8, income: 210, happy: 2, pw: -2, tier: 1, draw: 'bazaar', desc: 'Canopy stalls selling everything, loudly.' },
  saree:    { name: 'Saree Shop',      cat: 'shop', cost: 5500,  upkeep: 5,  jobs: 3, income: 105, pw: -1, tier: 2, draw: 'saree', desc: 'Kanjivaram to cotton, folded like rainbows.' },
  jeweller: { name: 'Jewellery Shop',  cat: 'shop', cost: 10000, upkeep: 8,  jobs: 3, income: 230, pw: -1, tier: 3, draw: 'jeweller', desc: 'For weddings, festivals and safe keeping.' },
  bank:     { name: 'Bank',            cat: 'shop', cost: 15000, upkeep: 14, jobs: 6, income: 300, pw: -2, tier: 3, draw: 'bank', desc: 'Loans, lockers, and a queue by 10 am.' },
  cinema:   { name: 'Cinema Hall',     cat: 'shop', cost: 12000, upkeep: 12, jobs: 5, income: 140, happy: 5, pw: -3, tier: 2, draw: 'cinema', desc: 'Hand-painted posters, interval samosa.' },

  // ---- Seva (civic) ----
  school:    { name: 'School',          cat: 'civic', cost: 6000,  upkeep: 12, jobs: 6, happy: 6, cover: 6, pw: -1, tier: 1, draw: 'school', desc: 'Prayer assembly, chalk dust, bright futures.' },
  hospital:  { name: 'Hospital',        cat: 'civic', cost: 12000, upkeep: 20, jobs: 8, happy: 8, cover: 7, pw: -3, tier: 2, draw: 'hospital', desc: 'Clean wards and a green ambulance.' },
  panchayat: { name: 'Panchayat Bhavan',cat: 'civic', cost: 5000,  upkeep: 8,  happy: 4, cover: 9, tier: 1, draw: 'panchayat', desc: 'Where the shehar debates and decides.' },
  police:    { name: 'Police Chowki',   cat: 'civic', cost: 4200,  upkeep: 8,  jobs: 3, happy: 3, cover: 8, tier: 1, draw: 'police', desc: 'Keeps the gully peace.' },
  watertank: { name: 'Water Tank',      cat: 'civic', cost: 3200,  upkeep: 4, water: 70, pw: -1, tier: 0, draw: 'watertank', desc: 'Overhead tank + hand pumps below.' },
  substation:{ name: 'Substation',      cat: 'civic', cost: 7000,  upkeep: 6,  jobs: 1, power: 90, tier: 0, draw: 'substation', desc: 'Transformer ki gun gun — steady bijli.' },
  solar:     { name: 'Solar Farm',      cat: 'civic', cost: 9000,  upkeep: 3,  power: 55, happy: 1, tier: 2, draw: 'solar', desc: 'Rooftop-of-the-city. Clean bijli.' },
  busstand:  { name: 'Bus Stand',       cat: 'civic', cost: 6000,  upkeep: 9,  jobs: 4, happy: 3, cover: 10, tier: 2, draw: 'busstand', desc: 'Blue-red buses, conductor ki awaaz.' },

  // ---- Faith ----
  mandir:    { name: 'Mandir',    cat: 'faith', cost: 3000, upkeep: 3, happy: 7, cover: 9, tier: 0, draw: 'mandir', desc: 'Bells at dawn, diyas at dusk.' },
  masjid:    { name: 'Masjid',    cat: 'faith', cost: 3000, upkeep: 3, happy: 7, cover: 9, tier: 0, draw: 'masjid', desc: 'The azaan and a cool green dome.' },
  gurudwara: { name: 'Gurudwara', cat: 'faith', cost: 3200, upkeep: 3, happy: 7, cover: 9, food: 8, tier: 0, draw: 'gurudwara', desc: 'Langar for all — feeds the shehar daily.' },
  church:    { name: 'Church',    cat: 'faith', cost: 3000, upkeep: 3, happy: 7, cover: 9, tier: 0, draw: 'church', desc: 'Carols in December, quiet all year.' },

  // ---- Fun ----
  park:   { name: 'Park',          cat: 'fun', cost: 800,  upkeep: 1, happy: 4, cover: 5,  pol: -1.5, tier: 0, draw: 'park', desc: 'Peepal tree, swings, morning walkers.' },
  maidan: { name: 'Cricket Maidan',cat: 'fun', cost: 1400, upkeep: 2, happy: 5, cover: 7,  tier: 0, draw: 'maidan', desc: 'Gully cricket. Last man batting.' },
  mela:   { name: 'Mela Ground',   cat: 'fun', cost: 8000, upkeep: 6, happy: 8, cover: 12, pw: -2, tier: 2, draw: 'mela', desc: 'Ferris wheel and jalebi smoke. Festivals shine here.' },

  // ---- Industry ----
  kiln:    { name: 'Brick Kiln',    cat: 'work', cost: 6000,  upkeep: 6,  jobs: 8,  income: 180, pol: 8,  tier: 2, draw: 'kiln', desc: 'Chimney red at sunset. Keeps masons busy.' },
  factory: { name: 'Small Factory', cat: 'work', cost: 9000,  upkeep: 10, jobs: 12, income: 290, pol: 6, pw: -5, tier: 2, draw: 'factory', desc: 'Jobs galore — bring trees to balance.' },
  textile: { name: 'Textile Mill',  cat: 'work', cost: 15000, upkeep: 16, jobs: 22, income: 520, pol: 10, pw: -8, tier: 3, draw: 'textile', desc: 'Looms clack day and night.' },

  // ---- Roads & decor ----
  road:  { name: 'Road',        cat: 'decor', cost: 60,  tier: 0, draw: 'road',  desc: 'Autos, cows and cricket all share it.' },
  bridge:{ name: 'Bridge',      cat: 'decor', cost: 350, tier: 0, draw: 'bridge', desc: 'Crosses water. Also the best adda at sunset.' },
  tree:  { name: 'Neem Tree',   cat: 'decor', cost: 80,  happy: 1, cover: 3, pol: -0.6, tier: 0, draw: 'tree', desc: 'Shade, clean air, and evening charcha.' },
  lamp:  { name: 'Street Lamp', cat: 'decor', cost: 140, happy: 1, cover: 4, tier: 0, draw: 'lamp', desc: 'Solar lamp — glows at night.' },
  flag:  { name: 'Flag Post',   cat: 'decor', cost: 200, happy: 2, cover: 5, tier: 0, draw: 'flag', desc: 'Tiranga on top. Pride every day.' },
};

export const TIERS = [
  { pop: 0,    name: 'Chhota Gaon', hin: 'छोटा गाँव' },
  { pop: 120,  name: 'Kasba',       hin: 'कस्बा' },
  { pop: 350,  name: 'Town',        hin: 'टाउन' },
  { pop: 800,  name: 'Shahar',      hin: 'शहर' },
  { pop: 1500, name: 'Mahanagar',   hin: 'महानगर' },
];

export const SEASONS = [
  { id: 'summer',  name: 'Summer' },
  { id: 'monsoon', name: 'Monsoon' },
  { id: 'winter',  name: 'Winter' },
  { id: 'harvest', name: 'Harvest' },
];
export const SEASON_DAYS = 24; // length of one season in game days

// Festival calendar: one festival every FEST_EVERY days, in rotation.
export const FEST_EVERY = 10;
export const FESTIVALS = [
  { id: 'diwali', name: 'Diwali', days: 3, boost: 9, costBase: 1500,
    text: 'Diwali! The shehar glows with diyas.', celebrate: 'Light up the whole gully — ₹',
    fx: 'diyas' },
  { id: 'eid', name: 'Eid', days: 2, boost: 8, costBase: 1200,
    text: 'Eid Mubarak! Lanterns swing over the lanes.', celebrate: 'Host a community feast — ₹',
    fx: 'lanterns' },
  { id: 'holi', name: 'Holi', days: 2, boost: 8, costBase: 1000,
    text: 'Holi hai! Colours fly across the maidan.', celebrate: 'Throw a mega colour party — ₹',
    fx: 'holi' },
  { id: 'republic', name: 'Republic Day', days: 1, boost: 6, costBase: 900,
    text: 'Republic Day! Tirangas line the main road.', celebrate: 'Fund a flag parade — ₹',
    fx: 'tricolor' },
  { id: 'baisakhi', name: 'Baisakhi', days: 2, boost: 5, costBase: 800,
    text: 'Baisakhi harvest! Farm income doubles today.', celebrate: 'Sponsor the bhangra stage — ₹',
    fx: 'harvest' },
];

// Random event weights (picked per day when conditions apply)
export const EVENTS = {
  cowJamChance: 0.18,      // needs >=2 cows
  pilgrimChance: 0.15,     // needs >=3 faith buildings
  weddingChance: 0.10,     // needs >=1 bazaar or mandir
};

export const ECON = {
  startMoney: 25000,
  startPop: 8,
  taxPerPop: 2.2,          // base ₹ / citizen / day, scaled by happiness
  foodPerPop: 0.14,        // food units eaten per citizen per day
  waterPerPop: 0.16,       // water units needed per citizen per day
  baseWater: 30,           // hand-pump baseline capacity
  growthDays: 1,           // population updates every day tick
  daySeconds: 14,          // real seconds per game day at 1x speed
  costCelebration: 1.2,    // celebrate cost scale per 100 pop
};

export const OUTFITS = [
  { type: 'saree',  colors: ['#d81b60', '#e8850c', '#7b1fa2', '#c62828', '#00897b'] },
  { type: 'kurta',  colors: ['#f5f5f5', '#ffd54f', '#90caf9', '#a5d6a7'] },
  { type: 'salwar', colors: ['#f06292', '#4dd0e1', '#ba68c8', '#fff176'] },
  { type: 'dhoti',  colors: ['#fafafa', '#ffe0b2'] },
  { type: 'lungi',  colors: ['#33691e', '#0277bd'] },
  { type: 'turban', colors: ['#f57f17', '#1565c0', '#ffffff', '#e8850c'] },
  { type: 'school', colors: ['#1a237e', '#b71c1c', '#1b5e20'] },
];
