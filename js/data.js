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
  { id: 'work',  name: 'Companies' },
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
  chawl:    { name: 'Chawl',         cat: 'house', cost: 6500,  upkeep: 12, homes: 30, pw: -1, tier: 2, draw: 'chawl', desc: 'Rows of one-room homes around a shared courtyard — Mumbai spirit.' },
  flats:    { name: 'Flat Block',    cat: 'house', cost: 13000, upkeep: 18, homes: 44, pw: -3, jobs: 2, tier: 3, draw: 'flats', desc: 'Four floors of city life and drying clothes.' },
  villa:    { name: 'Modern Villa',  cat: 'house', cost: 15000, upkeep: 14, homes: 10, pw: -2, happy: 3, tier: 3, draw: 'villa', desc: 'Glass balconies, a car porch, and a brass plate at the gate.' },

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
  mall:     { name: 'Shopping Mall',   cat: 'shop', cost: 22000, upkeep: 22, jobs: 20, income: 520, happy: 3, pw: -5, tier: 3, draw: 'mall', desc: 'Escalators, food court, and AC you pay for.' },
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
  office:  { name: 'Company Office',cat: 'work', cost: 14000, upkeep: 12, jobs: 18, income: 420, pw: -4, tier: 2, draw: 'office', desc: 'Glass-fronted offices where the city logs in every morning.' },
  tower:   { name: 'Corporate Tower',cat: 'work', cost: 30000, upkeep: 26, jobs: 40, income: 900, pw: -8, tier: 3, draw: 'tower', desc: 'The skyline. WFH cancelled.' },
  hotel:   { name: 'Hotel',         cat: 'work', cost: 18000, upkeep: 16, jobs: 14, income: 380, happy: 2, pw: -3, tier: 3, draw: 'hotel', desc: 'Banquets, buffet breakfast, and a revolving door.' },
  petrol:  { name: 'Petrol Pump',   cat: 'work', cost: 7000,  upkeep: 6,  jobs: 4,  income: 160, pw: -1, tier: 2, draw: 'petrol', desc: 'Canopy, pumps, and a patient queue of autos.' },

  // ---- Roads & decor ----
  road:  { name: 'Road',        cat: 'decor', cost: 60,  tier: 0, draw: 'road',  desc: 'Autos, cows and cricket all share it.' },
  bridge:{ name: 'Bridge',      cat: 'decor', cost: 350, tier: 0, draw: 'bridge', desc: 'Crosses water. Also the best adda at sunset.' },
  tree:  { name: 'Neem Tree',   cat: 'decor', cost: 80,  happy: 1, cover: 3, pol: -0.6, tier: 0, draw: 'tree', desc: 'Shade, clean air, and evening charcha.' },
  lamp:  { name: 'Street Lamp', cat: 'decor', cost: 140, happy: 1, cover: 4, tier: 0, draw: 'lamp', desc: 'Solar lamp — glows at night.' },
  flag:  { name: 'Flag Post',   cat: 'decor', cost: 200, happy: 2, cover: 5, tier: 0, draw: 'flag', desc: 'Tiranga on top. Pride every day.' },
};

// ---- Kits & knobs (adapted from lucas-martinic/polyfork-catalog) ----
// KITS: themed families — one palette, one scale, everything in a kit
// belongs to the same world. Each kit maps 1:1 to a building category.
export const KITS = [
  { id: 'mohalla-homes', name: 'Mohalla Homes',  cat: 'house', desc: 'Jhuggi tarp to haveli jharokhas — the gully where everyone lives.' },
  { id: 'kheti-baadi',   name: 'Kheti-Baadi',    cat: 'farm',  desc: 'Fields, paddies and orchards that feed the shehar.' },
  { id: 'bazaar-line',   name: 'Bazaar Line',    cat: 'shop',  desc: 'Chai tapri to bank — commerce, loudly.' },
  { id: 'seva-sadan',    name: 'Seva Sadan',     cat: 'civic', desc: 'Public seva — school, hospital, bijli, paani.' },
  { id: 'bhakti-sthal',  name: 'Bhakti Sthal',   cat: 'faith', desc: 'Mandir, masjid, gurudwara, church — side by side, always.' },
  { id: 'maidan-jashn',  name: 'Maidan & Jashn', cat: 'fun',   desc: 'Parks, cricket and the mela that lights up festivals.' },
  { id: 'loom-mill',     name: 'Loom & Mill',    cat: 'work',  desc: 'Kilns, factories and mills — jobs, with smoke.' },
  { id: 'gully-sajja',   name: 'Gully Sajja',    cat: 'decor', desc: 'Roads, trees, lamps — the trim that makes lanes lived-in.' },
];

// KNOBS: parametric per-asset options (polyfork's "a model is a program",
// adapted to procedural canvas). Option 0 of every knob is the ORIGINAL
// look, so old cities render exactly as before; other options are
// kit-coherent recolours or variant switches.
//  - knob with `colors`: option name -> hex colourway (per-plot pick).
//  - knob with `options`: variant switch, interpreted in the arts.js case.
// Resolution is deterministic per plot seed (see arts.js resolveKnobs),
// and `place(x, y, key, { knobs: { tarp: 'teal' } })` pins one per tile.
export const KNOBS = {
  jhuggi:    { tarp:     { colors: { slate: '#5e7d9a', clay: '#7a6a58', teal: '#4e7d74', plum: '#7a5568' } } },
  kaccha:    { wall:     { colors: { cream: '#e8d3b0', rose: '#dcbf94', sand: '#e6cfa5', wheat: '#d9c49a' } },
               roof:     { options: ['thatch', 'tile'] } },
  pakka:     { paint:    { colors: { cream: '#ddc7a2', teal: '#8fbcb3', pink: '#d9a7b0', ochre: '#d9b36a' } } },
  haveli:    { stone:    { colors: { sandstone: '#e2c294', marble: '#eceff1', redstone: '#c98a6b' } } },
  bungalow:  { paint:    { colors: { ivory: '#f2e3c8', sage: '#ccd8c2', sky: '#c3d6e2' } },
               roof:     { options: ['clay', 'slate'] } },
  flats:     { paint:    { colors: { mist: '#cfd8dc', sand: '#e0d5bd', sage: '#c2cdbd' } } },
  chai:      { awning:   { colors: { slate: '#37474f', red: '#8a3b32', green: '#2e5d43' } } },
  kirana:    { awning:   { options: ['red', 'teal', 'orange'] } },
  dhaba:     { canopy:   { colors: { sky: '#4dd0e1', saffron: '#ffb74d', leaf: '#4caf7d' } } },
  saree:     { silks:    { options: ['rainbow', 'ruby', 'peacock'] } },
  mandir:    { shikhara: { options: ['gold', 'white', 'terracotta'] } },
  masjid:    { dome:     { colors: { green: '#1b5e20', white: '#eceff1', teal: '#00897b' } } },
  gurudwara: { dome:     { colors: { gold: '#d4a017', copper: '#b87333', white: '#eceff1' } } },
  panchayat: { dome:     { colors: { terracotta: '#c96f2f', green: '#2e7d32', blue: '#1565c0' } } },
  chawl:     { wash:     { colors: { multicolour: '#d81b60', pastel: '#90caf9', plain: '#b0bec5' } } },
  villa:     { paint:    { colors: { ivory: '#f5efe0', concrete: '#d7dbde', sand: '#e6d2ac' } },
               porch:    { options: ['car', 'garden'] } },
  office:    { glass:    { colors: { azure: '#7fb8d8', teal: '#6fb8b0', smoke: '#9aa7b0' } } },
  tower:     { crown:    { colors: { saffron: '#ff8f00', white: '#eceff1', emerald: '#2e7d32' } } },
  mall:      { signage:  { options: ['magenta', 'saffron', 'teal'] } },
  hotel:     { board:    { colors: { gold: '#d4a017', blue: '#1565c0', green: '#2e7d32' } } },
  petrol:    { canopy:   { colors: { red: '#c62828', blue: '#1565c0', green: '#2e7d32' } } },
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
  startMoney: 45000,   // Mahanagar Edition: the city is pre-built; the treasury funds growth
  startPop: 8,         // overwritten by newGame() with the city's actual residents
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
