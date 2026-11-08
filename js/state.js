// state.js — game state, map generation, placement rules, daily aggregates.
// No DOM access here; UI and rendering subscribe to state changes.

import { BUILDINGS, TIERS, ECON } from './data.js';

export const MAP = 36; // map is MAP x MAP tiles

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
  v: 1,                 // save version (save.js migrations key off this)
  seed: 1,
  day: 1,
  tday: 0,              // seconds elapsed in current day
  speed: 1,             // 0 | 1 | 3
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

  // starter hamlet near the centre: a couple of homes, a road, a tree line
  const cx = Math.floor(MAP / 2), cy = Math.floor(MAP / 2);
  for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 5; x <= cx + 5; x++) {
    if (S.terrain[y][x].w) { S.terrain[y][x].w = false; } // dry a pocket if river bends in
  }
  placeRaw(cx - 1, cy, 'jhuggi'); placeRaw(cx + 1, cy, 'jhuggi');
  placeRaw(cx, cy - 1, 'kaccha');
  for (let x = cx - 3; x <= cx + 3; x++) placeRaw(x, cy + 1, 'road');
  placeRaw(cx - 3, cy + 2, 'tree'); placeRaw(cx + 3, cy + 2, 'tree');
  placeRaw(cx + 2, cy - 2, 'wheat');
  recomputeStats(true);
  pushNotice('Welcome to your gaon! Build homes and a farm to grow.', 'info');
}

function placeRaw(x, y, key) {
  S.grid[y][x] = { k: key, born: S.day, seed: (x * 31 + y * 17) % 97 };
  S.counts[key] = (S.counts[key] || 0) + 1;
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

export function place(x, y, key) {
  const def = BUILDINGS[key];
  if (!def) return { ok: false, why: 'Unknown building' };
  const c = canPlace(x, y, key);
  if (!c.ok) return c;
  if (S.money < def.cost) return { ok: false, why: `Need ₹${def.cost.toLocaleString('en-IN')}` };
  const g = S.grid[y][x];
  if (g && S.grid[y][x].k === 'tree') S.counts.tree = Math.max(0, (S.counts.tree || 1) - 1);
  placeRaw(x, y, key);
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
    st.powerUse += Math.max(0, -(d.power || 0));
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
export function gridAt(x, y) { return (x < 0 || y < 0 || x >= MAP || y >= MAP) ? null : S.grid[y][x]; }
export function isWater(x, y) { return (x < 0 || y < 0 || x >= MAP || y >= MAP) ? false : S.terrain[y][x].w; }
export function isRoad(x, y) { const g = gridAt(x, y); return !!g && (g.k === 'road' || g.k === 'bridge'); }
export function fmtMoney(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
