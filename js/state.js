// state.js — game state, map generation, placement rules, daily aggregates.
// No DOM access here; UI and rendering subscribe to state changes.

import { BUILDINGS, TIERS, ECON, KNOBS } from './data.js';

export const MAP = 48; // Mahanagar Edition: the city map grew from 36×36

// Deed tiles the city generator reserves for the four [NPC] residents.
// js/owners.js ASSIGNMENTS must quote exactly these tiles (a node test
// asserts the two files stay in sync).
export const CITY_DEED_TILES = {
  ramu:  { home: '13,32', shop: '20,32' },   // pakka ghar + kirana, Old Mohalla bazaar
  meera: { home: '12,34', shop: '28,24' },   // flat block, Colony + saree shop, CBD
  arjun: { home: '13,10', shop: '22,26' },   // bungalow, Civil Lines + dhaba, Bazaar St
  zoya:  { home: '29,16', shop: '36,24' },   // villa, Civil Lines + company office, CBD
};

// ---- seeded RNG (mulberry32) for reproducible terrain ----
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const S = {
  v: 2,                 // save version (save.js migrations key off this; v2 = knob overrides)
  seed: 1,
  day: 1,
  tday: 0,              // seconds elapsed in current day
  speed: 1,             // 0 | 1 | 3
  mode: 'plan',         // 'plan' (isometric overview) | 'walk' (street level)
  money: ECON.startMoney,
  pop: ECON.startPop,
  happy: 55,
  foodStock: 60,
  grid: [],             // grid[y][x] = null | {k, born} (buildings/roads/bridges)
  terrain: [],          // terrain[y][x] = {w:bool, v:int} (static)
  counts: {},           // building key -> count
  festival: null,       // {id, endDay, celebrated}
  nextFestDay: 10,
  festIndex: 0,
  notices: [],          // queued notices drained by ui.js
  uid: 1,               // agent ids
  stats: null,          // daily aggregate cache (recomputeStats)
  tierIdx: 0,
  powerCut: false,      // load-shedding active today
  jamUntil: 0,          // real-time timestamp for cow jams
  startedAt: Date.now(),
};

export function pushNotice(msg, kind = 'info') {
  S.notices.push({ id: S.uid++, msg, kind, at: Date.now() });
  if (S.notices.length > 40) S.notices.splice(0, S.notices.length - 40);
}

// ---------- terrain generation ----------
export function generateTerrain(seed) {
  const rng = makeRng(seed);
  const T = [];
  for (let y = 0; y < MAP; y++) {
    T.push([]);
    for (let x = 0; x < MAP; x++) {
      // a river winding along the top-left corner plus a small pond bottom-right
      const riverEdge = 4.6 + Math.sin(x * 0.42 + seed % 7) * 1.7;
      const isWater = (y < riverEdge) || (x > MAP - 8 && y > MAP - 9 && Math.hypot(x - (MAP - 4.5), y - (MAP - 4.5)) < 3.6);
      T[y].push({ w: isWater, v: Math.floor(rng() * 100) }); // v = visual variant
    }
  }
  return T;
}

export function newGame(seed = (Date.now() % 100000)) {
  S.seed = seed;
  S.day = 1; S.tday = 0; S.speed = 1;
  S.money = ECON.startMoney; S.pop = ECON.startPop; S.happy = 55; S.foodStock = 60;
  S.grid = Array.from({ length: MAP }, () => Array(MAP).fill(null));
  S.terrain = generateTerrain(seed);
  S.counts = {}; S.festival = null; S.nextFestDay = 10; S.festIndex = 0;
  S.notices = []; S.tierIdx = 0; S.powerCut = false; S.jamUntil = 0;
  S.startedAt = Date.now();

  generateCity();
  recomputeStats(true);

  // a pre-built city arrives lived-in: fill a healthy share of the housing
  // (civic infra below is sized so day one runs green, growth pressures it later)
  S.pop = Math.min(S.stats.homes, Math.max(150, Math.round(S.stats.homes * 0.42)));
  S.tierIdx = currentTierIdx();
  pushNotice('Welcome to Apna Shehar — a whole Mahanagar, built and waiting. Walk its streets!', 'info');
}

// ═════════════════════════════════════════════════════════════════════
//  MAHANAGAR — the pre-built city, laid out entirely in code.
//
//  Avenues every 8 tiles both directions make a grid of 7×7 blocks
//  (with a river bridge crossing on each vertical avenue). Each block
//  ring is filled with its district's buildings facing the streets;
//  block interiors are courtyards: parks, faith places, civic landmarks
//  or farmland. Four deed tiles are reserved for the [NPC] residents.
// ═════════════════════════════════════════════════════════════════════
const AVENUES = [9, 17, 25, 33, 41];

// block interior ring fill — walks the perimeter clockwise from NW corner.
// v5: optional knobsFn gives each district a coherent paint story (the
// polyfork knob system, applied per-block by generateCity).
function ringFill(x0, y0, x1, y1, list, reserved, rstate, knobsFn = null) {
  const cells = [];
  for (let x = x0; x <= x1; x++) cells.push([x, y0]);
  for (let y = y0 + 1; y <= y1; y++) cells.push([x1, y]);
  for (let x = x1 - 1; x >= x0; x--) cells.push([x, y1]);
  for (let y = y1 - 1; y > y0; y--) cells.push([x0, y]);
  cells.forEach(([x, y], i) => {
    if (S.grid[y][x] || S.terrain[y][x].w) return;
    if (reserved.has(x + ',' + y)) return;
    const key = list[(i + rstate.o) % list.length];
    placeRaw(x, y, key, knobsFn ? knobsFn(x, y, key) : null);
    rstate.o = (rstate.o + (i % 3 === 0 ? 1 : 0)) % Math.max(1, list.length);
  });
}

// courtyard fill — green centres with breathing gaps for walkers
function courtyardFill(x0, y0, x1, y1, list, knobsFn = null) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (S.grid[y][x] || S.terrain[y][x].w) continue;
    if ((x + y) % 3 === 0) continue; // walker gaps
    const key = list[(x * 5 + y * 3) % list.length];
    placeRaw(x, y, key, knobsFn ? knobsFn(x, y, key) : null);
  }
}

// ---- district paint stories (every value is a legal KNOBS option) ----
const pick = (arr, x, y, salt = 0) => arr[Math.abs(x * 7 + y * 13 + salt * 29) % arr.length];
const MOHALLA = {
  pakka: (x, y) => ({ paint: pick(['pink', 'ochre', 'teal', 'cream'], x, y) }),          // jaipur-pink gullies
  kaccha: (x, y) => ({ wall: pick(['rose', 'cream', 'wheat'], x, y), roof: pick(['tile', 'thatch'], x, y, 1) }),
  chawl: (x, y) => ({ wash: pick(['multicolour', 'pastel', 'plain'], x, y) }),
};
const CIVIL = {
  bungalow: (x, y) => ({ paint: pick(['ivory', 'sage', 'sky'], x, y), roof: pick(['clay', 'slate'], x, y, 2) }),
  haveli: (x, y) => ({ stone: pick(['sandstone', 'redstone', 'marble'], x, y) }),
  pakka: (x, y) => ({ paint: pick(['cream', 'ochre'], x, y) }),
  villa: (x, y) => ({ paint: pick(['ivory', 'concrete', 'sand'], x, y) }),
};
const CBD = { office: (x, y) => ({ glass: pick(['azure', 'teal', 'smoke'], x, y) }) };
const COLONY = {
  flats: (x, y) => ({ paint: pick(['sand', 'sage', 'mist'], x, y) }),
  pakka: (x, y) => ({ paint: pick(['cream', 'teal'], x, y) }),
  chawl: MOHALLA.chawl,
};
const knobsFor = (dirs) => (x, y, key) => (dirs[key] ? dirs[key](x, y) : null);

export function generateCity() {
  const reserved = new Set(Object.values(CITY_DEED_TILES).flatMap(d => [d.home, d.shop]));
  const rstate = { o: 0 };

  // ---- landmark tiles the deed book quotes (placed first, exactly) ----
  placeRaw(13, 32, 'pakka');    // [NPC] Ramu  — home
  placeRaw(20, 32, 'kirana');   // [NPC] Ramu  — shop
  placeRaw(12, 34, 'flats');    // [NPC] Meera — home
  placeRaw(28, 24, 'saree');    // [NPC] Meera — shop
  placeRaw(13, 10, 'bungalow'); // [NPC] Arjun — home
  placeRaw(22, 26, 'dhaba');    // [NPC] Arjun — shop
  placeRaw(29, 16, 'villa');    // [NPC] Zoya  — home
  placeRaw(36, 24, 'office');   // [NPC] Zoya  — shop

  // ---- roads: avenues every 8 tiles, bridges where they meet the river ----
  for (const y of AVENUES) for (let x = 0; x < MAP; x++) {
    if (S.terrain[y][x].w || S.grid[y][x]) continue;
    placeRaw(x, y, 'road');
  }
  for (const x of AVENUES) for (let y = 0; y < MAP; y++) {
    if (S.terrain[y][x].w) { if (y < 9 && !S.grid[y][x]) placeRaw(x, y, 'bridge'); continue; }
    if (!S.grid[y][x]) placeRaw(x, y, 'road');
  }
  // chowk widening: double-wide around the central crossing (23–27 × 23–27)
  for (let y = 23; y <= 27; y++) for (let x = 23; x <= 27; x++) {
    if (!S.terrain[y][x].w && !S.grid[y][x]) placeRaw(x, y, 'road');
  }

  // ---- Block band A (y 10–16): CIVIL LINES — bungalows, havelis, villas ----
  const civilA = ['bungalow', 'haveli', 'bungalow', 'pakka', 'bungalow'];
  const civilB = ['bungalow', 'villa', 'haveli', 'bungalow'];
  ringFill(10, 10, 16, 16, civilA, reserved, rstate, knobsFor(CIVIL));
  courtyardFill(11, 11, 15, 15, ['tree', 'tree', 'park', 'tree']);
  placeRaw(15, 13, 'watertank');
  ringFill(18, 10, 24, 16, civilB, reserved, rstate, knobsFor(CIVIL));
  courtyardFill(19, 11, 23, 15, ['tree', 'park', 'tree']);
  ringFill(26, 10, 32, 16, civilA, reserved, rstate, knobsFor(CIVIL));
  courtyardFill(27, 11, 31, 15, ['tree', 'tree', 'park']);
  ringFill(34, 10, 40, 16, civilB, reserved, rstate, knobsFor(CIVIL));
  courtyardFill(35, 11, 39, 15, ['tree', 'park', 'tree', 'tree']);
  placeRaw(37, 13, 'watertank');
  ringFill(42, 10, 47, 16, ['mango', 'wheat', 'tree', 'mango'], reserved, rstate);

  // ---- Block band B (y 18–24): CBD — companies, tower, mall, hotel ----
  const cbdRing = ['office', 'office', 'bank', 'office', 'cinema', 'office', 'jeweller', 'office'];
  ringFill(10, 18, 16, 24, cbdRing, reserved, rstate, knobsFor(CBD));
  courtyardFill(11, 19, 15, 23, ['tree', 'tree']);
  ringFill(18, 18, 24, 24, cbdRing, reserved, rstate, knobsFor(CBD));
  placeRaw(21, 21, 'tower'); // the skyline
  placeRaw(23, 19, 'flag'); placeRaw(19, 23, 'tree'); placeRaw(23, 23, 'tree');
  ringFill(26, 18, 32, 24, cbdRing, reserved, rstate, knobsFor(CBD));
  placeRaw(29, 21, 'mall');
  placeRaw(27, 19, 'tree'); placeRaw(31, 19, 'hotel');
  ringFill(34, 18, 40, 24, cbdRing, reserved, rstate, knobsFor(CBD));
  courtyardFill(35, 19, 39, 23, ['tree', 'tree']);
  ringFill(42, 18, 47, 24, cbdRing, reserved, rstate, knobsFor(CBD));

  // ---- Block band C (y 26–32): OLD MOHALLA & BAZAAR ----
  ringFill(10, 26, 16, 32, ['pakka', 'kaccha', 'pakka', 'chawl', 'pakka'], reserved, rstate, knobsFor(MOHALLA));
  placeRaw(13, 29, 'mandir'); placeRaw(11, 29, 'masjid');
  placeRaw(15, 29, 'gurudwara'); placeRaw(13, 31, 'church'); placeRaw(13, 27, 'tree');
  ringFill(18, 26, 24, 32, ['chai', 'kirana', 'bazaar', 'chai', 'saree', 'kirana', 'dhaba', 'chai', 'bazaar'], reserved, rstate);
  placeRaw(21, 29, 'chai'); placeRaw(19, 31, 'tree'); placeRaw(23, 31, 'watertank');
  ringFill(26, 26, 32, 32, ['chawl', 'pakka', 'chawl', 'pakka', 'kaccha', 'chawl'], reserved, rstate, knobsFor(MOHALLA));
  placeRaw(29, 29, 'watertank'); placeRaw(27, 27, 'police');
  ringFill(34, 26, 40, 32, ['pakka', 'kaccha', 'pakka', 'chai', 'pakka'], reserved, rstate, knobsFor(MOHALLA));
  placeRaw(37, 29, 'cinema'); placeRaw(39, 27, 'tree'); placeRaw(35, 31, 'tree');
  ringFill(42, 26, 47, 32, ['pakka', 'kaccha', 'pakka', 'tree'], reserved, rstate, knobsFor(MOHALLA));

  // ---- Block band D (y 34–40): COLONY — flats, schools, parks ----
  ringFill(10, 34, 16, 40, ['flats', 'pakka', 'flats', 'pakka', 'flats'], reserved, rstate, knobsFor(COLONY));
  placeRaw(13, 37, 'school'); placeRaw(15, 39, 'park'); placeRaw(11, 39, 'tree');
  ringFill(18, 34, 24, 40, ['flats', 'pakka', 'flats', 'pakka'], reserved, rstate, knobsFor(COLONY));
  placeRaw(21, 37, 'maidan'); placeRaw(19, 39, 'park'); placeRaw(23, 39, 'tree');
  ringFill(26, 34, 32, 40, ['flats', 'pakka', 'flats', 'chawl', 'flats'], reserved, rstate, knobsFor(COLONY));
  placeRaw(29, 37, 'hospital'); placeRaw(31, 39, 'watertank'); placeRaw(27, 39, 'tree');
  ringFill(34, 34, 40, 40, ['pakka', 'flats', 'pakka', 'flats'], reserved, rstate, knobsFor(COLONY));
  placeRaw(37, 37, 'busstand'); placeRaw(39, 39, 'substation'); placeRaw(35, 39, 'tree');
  ringFill(42, 34, 47, 40, ['pakka', 'flats', 'pakka'], reserved, rstate, knobsFor(COLONY));
  placeRaw(45, 37, 'mela'); placeRaw(43, 39, 'tree');

  // ---- Block band E (y 42–47): INDUSTRIAL EDGE & FIELDS ----
  ringFill(10, 42, 16, 47, ['wheat', 'wheat', 'dairy', 'wheat'], reserved, rstate);
  ringFill(18, 42, 24, 47, ['paddy', 'wheat', 'paddy', 'dairy'], reserved, rstate);
  ringFill(26, 42, 32, 47, ['kiln', 'wheat', 'tree', 'kiln'], reserved, rstate);
  placeRaw(29, 45, 'watertank');
  ringFill(34, 42, 40, 47, ['factory', 'textile', 'petrol', 'substation'], reserved, rstate);
  placeRaw(36, 44, 'factory'); placeRaw(38, 45, 'textile'); placeRaw(35, 43, 'petrol'); placeRaw(39, 44, 'substation');
  ringFill(42, 42, 47, 47, ['mango', 'tree', 'mango'], reserved, rstate); // pond sits east

  // ---- Green belt west of the first avenue + river north bank ----
  for (const [gy0, gy1] of [[10, 16], [18, 24], [26, 32], [34, 40]]) {
    courtyardFill(0, gy0, 8, gy1, ['tree', 'wheat', 'tree', 'park', 'tree', 'mango']);
  }
  courtyardFill(0, 42, 8, 47, ['wheat', 'tree', 'paddy', 'mango']); // the south-west corner was bare dust
  placeRaw(5, 29, 'watertank'); placeRaw(7, 37, 'substation'); placeRaw(7, 21, 'substation');
  // dense riverside: orchard rows up north, a breathing tree wall below the bank
  for (let x = 0; x < MAP; x++) for (let y = 0; y <= 8; y++) {
    if (S.grid[y][x] || S.terrain[y][x].w) continue;
    if (y <= 3) placeRaw(x, y, (x + y) % 3 === 0 ? 'mango' : 'wheat');
    else {
      if ((x * 5 + y * 3) % 7 === 0) continue; // small clearings
      placeRaw(x, y, x % 3 === 0 ? 'mango' : 'tree');
    }
  }
}

function placeRaw(x, y, key, knobs = null) {
  if (S.terrain[y] && S.terrain[y][x] && S.terrain[y][x].w && key !== 'bridge') return; // never build on water
  const prev = S.grid[y][x];
  if (prev) S.counts[prev.k] = Math.max(0, (S.counts[prev.k] || 1) - 1); // re-placing keeps counts honest
  const cell = { k: key, born: S.day, seed: (x * 31 + y * 17) % 97 };
  if (knobs && Object.keys(knobs).length) cell.knobs = { ...knobs };
  S.grid[y][x] = cell;
  S.counts[key] = (S.counts[key] || 0) + 1;
}

// Validate a knob pin against the KNOBS registry (data.js). Returns
// { ok, knobs | why } — unknown knob or bad option value gets a helpful
// message listing the valid options.
function validateKnobs(key, knobs) {
  if (!knobs || typeof knobs !== 'object') return { ok: true, knobs: null };
  const defs = KNOBS[key] || {};
  const out = {};
  for (const [name, val] of Object.entries(knobs)) {
    const kd = defs[name];
    if (!kd) {
      const names = Object.keys(defs);
      return { ok: false, why: names.length ? `${BUILDINGS[key].name} knobs: ${names.join(', ')}` : `${BUILDINGS[key].name} has no knobs` };
    }
    const valid = kd.options || Object.keys(kd.colors || {});
    if (!valid.includes(val)) return { ok: false, why: `${name}: '${val}' — valid options: ${valid.join(', ')}` };
    out[name] = val;
  }
  return { ok: true, knobs: Object.keys(out).length ? out : null };
}

// ---------- placement rules ----------
export function canPlace(x, y, key) {
  if (x < 0 || y < 0 || x >= MAP || y >= MAP) return { ok: false, why: 'Outside the map' };
  const def = BUILDINGS[key];
  const t = S.terrain[y][x];
  const g = S.grid[y][x];
  if (key === 'bridge') {
    if (!t.w) return { ok: false, why: 'Bridges go over water' };
    if (g) return { ok: false, why: 'Tile already in use' };
    return { ok: true };
  }
  if (t.w) return { ok: false, why: 'Water — build a bridge here' };
  if (g) {
    const cur = BUILDINGS[g.k];
    if (g.k === 'tree' && key !== 'tree') { /* allow replacing trees */ }
    else return { ok: false, why: `${cur ? cur.name : 'Something'} is already here` };
  }
  return { ok: true };
}

export function place(x, y, key, opts = {}) {
  const def = BUILDINGS[key];
  if (!def) return { ok: false, why: 'Unknown building' };
  const kv = validateKnobs(key, opts.knobs);
  if (!kv.ok) return kv;
  const c = canPlace(x, y, key);
  if (!c.ok) return c;
  if (S.money < def.cost) return { ok: false, why: `Need ₹${def.cost.toLocaleString('en-IN')}` };
  const g = S.grid[y][x];
  if (g && S.grid[y][x].k === 'tree') S.counts.tree = Math.max(0, (S.counts.tree || 1) - 1);
  placeRaw(x, y, key, kv.knobs);
  S.money -= def.cost;
  recomputeStats();
  return { ok: true };
}

export function removeAt(x, y) {
  const g = S.grid[y][x];
  if (!g) return { ok: false, why: 'Nothing to remove' };
  const def = BUILDINGS[g.k];
  const refund = Math.floor((def.cost || 0) * 0.4);
  S.grid[y][x] = null;
  S.counts[g.k] = Math.max(0, (S.counts[g.k] || 1) - 1);
  S.money += refund;
  recomputeStats();
  return { ok: true, refund };
}

// Pin one knob on an existing building (polyfork-style in-game knob UI).
// Visual only: no money, no stats. `value: null` unpins that knob so the
// plot falls back to its seeded look. Pins persist via save v2.
export function pinKnob(x, y, name, value) {
  const g = S.grid[y] && S.grid[y][x];
  if (!g) return { ok: false, why: 'Nothing here' };
  const defs = KNOBS[g.k] || {};
  const kd = defs[name];
  if (!kd) {
    const names = Object.keys(defs);
    return { ok: false, why: names.length ? `${BUILDINGS[g.k].name} knobs: ${names.join(', ')}` : `${BUILDINGS[g.k].name} has no knobs` };
  }
  const valid = kd.options || Object.keys(kd.colors || {});
  if (value === null) {
    if (g.knobs) { delete g.knobs[name]; if (!Object.keys(g.knobs).length) delete g.knobs; }
    return { ok: true };
  }
  if (!valid.includes(value)) return { ok: false, why: `${name}: '${value}' — valid options: ${valid.join(', ')}` };
  g.knobs = { ...(g.knobs || {}), [name]: value };
  return { ok: true };
}

// ---------- daily aggregates ----------
export function recomputeStats(silent = false) {
  const st = {
    homes: 0, jobs: 0, food: 0, waterCap: ECON.baseWater, powerGen: 0, powerUse: 0,
    income: 0, upkeep: 0, happyPts: 0, pol: 0, faiths: 0, faithKinds: new Set(),
    counts: { ...S.counts }, buildings: 0,
  };
  const happyB = [];
  for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
    const g = S.grid[y][x];
    if (!g) continue;
    const d = BUILDINGS[g.k];
    if (!d) continue;
    st.buildings++;
    st.homes += d.homes || 0;
    st.jobs += d.jobs || 0;
    st.food += d.food || 0;
    st.waterCap += d.water || 0;
    st.powerGen += Math.max(0, d.power || 0);
    // demand: `power` (negative = demand, unused by current defs) plus `pw`
    // (the negative demand flag every consumer building actually carries)
    st.powerUse += Math.max(0, -(d.power || 0)) + Math.max(0, -(d.pw || 0));
    st.income += d.income || 0;
    st.upkeep += d.upkeep || 0;
    st.pol += d.pol || 0;
    if (d.happy) happyB.push({ x, y, h: d.happy, cover: d.cover || 0 });
    if (d.cat === 'faith') st.faithKinds.add(g.k);
  }
  st.faiths = st.faithKinds.size;

  // happiness points count only if they serve homes (or standalone decor)
  let served = 0;
  for (const b of happyB) {
    if (b.cover === 0) { served += b.h; continue; }
    let near = false;
    for (let dy = -b.cover; dy <= b.cover && !near; dy++) {
      for (let dx = -b.cover; dx <= b.cover && !near; dx++) {
        const yy = b.y + dy, xx = b.x + dx;
        if (yy < 0 || xx < 0 || yy >= MAP || xx >= MAP) continue;
        const g = S.grid[yy][xx];
        if (g && BUILDINGS[g.k] && BUILDINGS[g.k].homes) near = true;
      }
    }
    served += near ? b.h : Math.round(b.h * 0.35);
  }
  st.happyPts = served;
  st.tierIdx = currentTierIdx();
  S.stats = st;
  if (!silent) uiDirty = true;
}

export let uiDirty = true;
export function clearUiDirty() { uiDirty = false; }

export function currentTierIdx() {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) if (S.pop >= TIERS[i].pop) idx = i;
  return idx;
}

// helpers used across modules
export function gridAt(x, y) { return (x < 0 || y < 0 || x >= MAP || y >= MAP || !S.grid[y]) ? null : S.grid[y][x]; }
export function isWater(x, y) { return (x < 0 || y < 0 || x >= MAP || y >= MAP) ? false : S.terrain[y][x].w; }
export function isRoad(x, y) { const g = gridAt(x, y); return !!g && (g.k === 'road' || g.k === 'bridge'); }
export function fmtMoney(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }

// neighbourhood names for the walk-HUD place chip (you always know where you are)
export function districtOf(x, y) {
  if (y < 9) return 'River Bank';
  if (x < 9) return y < 42 ? 'Green Belt' : 'West Fields';
  if (y <= 16) return x >= 42 ? 'East Bungalows' : 'Civil Lines';
  if (y <= 24) return x >= 42 ? 'East End' : 'CBD — City Centre';
  if (y <= 32) return x >= 42 ? 'East Bazaar' : 'Old Mohalla & Bazaar';
  if (y <= 40) return 'Colony';
  return x >= 42 ? 'Pond Side' : 'Industrial Edge';
}

// walkers can stand on open land and roads/bridges; buildings, trees, water block
export function isWalkable(x, y) {
  if (x < 0 || y < 0 || x >= MAP || y >= MAP) return false;
  if (S.terrain[y][x].w) return false;
  const g = S.grid[y][x];
  return !g || g.k === 'road' || g.k === 'bridge';
}
export function nearestWalkable(x, y, radius = 6) {
  if (isWalkable(x, y)) return { x, y };
  for (let r = 1; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = x + dx, ny = y + dy;
      if (isWalkable(nx, ny)) return { x: nx, y: ny };
    }
  }
  return null;
}
