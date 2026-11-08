// agents.js — people, vehicles and sacred cows that bring the shehar alive.
// Movement model: random-walk over the road/footpath graph. Vehicles stick
// to roads; cows go anywhere on land and sometimes stop on the road.

import { S, MAP, gridAt, isWater, isRoad, makeRng } from './state.js';
import { OUTFITS, BUILDINGS } from './data.js';
import { drawPerson, drawCow, drawVehicle } from './arts.js';

const rng = makeRng(20260101);
let agents = [];
let spawnAcc = 0;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function pickOutfit() {
  const o = OUTFITS[Math.floor(rng() * OUTFITS.length)];
  return {
    type: o.type,
    col: o.colors[Math.floor(rng() * o.colors.length)],
    col2: o.colors[Math.floor(rng() * o.colors.length)],
    skin: Math.floor(rng() * 4),
  };
}

function makePerson(x, y) {
  const p = pickOutfit();
  return {
    kind: 'person', x, y, tx: x, ty: y,
    speed: 0.55 + rng() * 0.5,
    ph: rng() * 6.28,
    scale: 0.9 + rng() * 0.35,
    pot: p.type === 'saree' && rng() < 0.25,
    holi: null,
    ...p,
  };
}

function makeVehicle(x, y) {
  const shops = (S.counts.bazaar || 0) + (S.counts.dhaba || 0) + (S.counts.kirana || 0);
  const companies = (S.counts.office || 0) + (S.counts.tower || 0) + (S.counts.mall || 0) + (S.counts.hotel || 0);
  let vkind = 'auto';
  const r = rng();
  if (companies > 4 && r < 0.3) vkind = 'car';        // Mahanagar: offices bring cars
  else if (r < 0.42) vkind = 'car';
  else if (r < 0.52) vkind = 'taxi';                  // kaali-peeli
  else if (r < 0.62) vkind = 'auto';
  else if (shops > 4 && r < 0.72) vkind = 'bus';
  else if (shops > 3 && r < 0.8) vkind = 'truck';
  else if (r < 0.9) vkind = 'cycle';
  else vkind = 'bullock';
  const bodyCols = ['#c62828', '#1565c0', '#2e7d32', '#f5f5f5', '#6d4c41', '#7b1fa2', '#37474f'];
  return {
    kind: 'vehicle', vkind, x, y, tx: x, ty: y, dir: 1, ph: rng() * 6.28,
    speed: vkind === 'cycle' ? 0.9 : vkind === 'bullock' ? 0.4 : vkind === 'bus' ? 0.75 : vkind === 'car' ? 1.15 : vkind === 'taxi' ? 1.05 : 0.95,
    bodyCol: bodyCols[Math.floor(rng() * bodyCols.length)],
    riderCol: ['#37474f', '#c62828', '#1565c0'][Math.floor(rng() * 3)],
  };
}

function makeCow(x, y) {
  return { kind: 'cow', x, y, tx: x, ty: y, speed: 0.16 + rng() * 0.12, ph: rng() * 6.28, wait: 0 };
}

export function cowCount() { return agents.filter(a => a.kind === 'cow').length; }
export function getAgents() { return agents; }

function randomSpawnTile(needRoad) {
  for (let tries = 0; tries < 40; tries++) {
    const x = 2 + Math.floor(rng() * (MAP - 4));
    const y = 2 + Math.floor(rng() * (MAP - 4));
    if (isWater(x, y)) continue;
    const g = gridAt(x, y);
    if (needRoad) { if (g && (g.k === 'road' || g.k === 'bridge')) return { x, y }; }
    else if (!g) return { x, y };
  }
  return null;
}

// choose next target tile from current tile
function nextTarget(a, roadOnly) {
  const cx = Math.round(a.tx), cy = Math.round(a.ty);
  const opts = [];
  for (const [dx, dy] of DIRS) {
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= MAP || ny >= MAP) continue;
    if (isWater(nx, ny)) continue;
    const g = gridAt(nx, ny);
    const road = g && (g.k === 'road' || g.k === 'bridge');
    if (roadOnly) { if (road) opts.push([nx, ny]); }
    else if (!g || road) opts.push([nx, ny]);
  }
  if (!opts.length) return null;
  // prefer continuing straight for natural paths
  return opts[Math.floor(rng() * opts.length)];
}

export function update(dt, t) {
  if (!S.grid.length) return; // no city yet (welcome screen)
  // population scaling (Mahanagar caps: a city breathes deeper than a gaon)
  const wantPeople = Math.max(6, Math.min(110, Math.round(S.pop * 0.22)));
  const shops = Object.entries(S.counts).reduce((n, [k, c]) => n + ((BUILDINGS[k] && BUILDINGS[k].income) ? c : 0), 0);
  const wantVehicles = Math.max(6, Math.min(26, Math.round(shops * 0.28)));
  const wantCows = Math.min(7, 1 + Math.floor(S.pop / 200) + (S.counts.dairy ? 2 : 0));

  spawnAcc += dt;
  if (spawnAcc > 0.4) {
    spawnAcc = 0;
    const people = agents.filter(a => a.kind === 'person').length;
    const vehicles = agents.filter(a => a.kind === 'vehicle').length;
    const cows = agents.filter(a => a.kind === 'cow').length;
    if (people < wantPeople) { const s = randomSpawnTile(false); if (s) agents.push(makePerson(s.x, s.y)); }
    if (vehicles < wantVehicles) { const s = randomSpawnTile(true); if (s) agents.push(makeVehicle(s.x, s.y)); }
    if (cows < wantCows) { const s = randomSpawnTile(false); if (s) agents.push(makeCow(s.x, s.y)); }
    // retire a few extras (people fade when population target drops)
    if (people > wantPeople + 4) {
      const idx = agents.findIndex(a => a.kind === 'person' && !a.parade);
      if (idx >= 0) agents.splice(idx, 1);
    }
    if (vehicles > wantVehicles + 3) {
      const idx = agents.findIndex(a => a.kind === 'vehicle');
      if (idx >= 0) agents.splice(idx, 1);
    }
  }

  // holi colours
  if (S.festival && S.festival.id === 'holi') {
    for (const a of agents) if (a.kind === 'person' && !a.holi && Math.random() < dt * 0.3) {
      a.holi = ['#d81b60', '#f57f17', '#00897b', '#7b1fa2'][Math.floor(Math.random() * 4)];
    }
  } else {
    for (const a of agents) if (a.holi && Math.random() < dt * 0.1) a.holi = null;
  }

  // parade on Republic Day
  if (S.festival && S.festival.id === 'republic' && S.festival.endDay - S.day >= 0 && agents.filter(a => a.parade).length < 8 && Math.random() < dt * 0.5) {
    const s = randomSpawnTile(true);
    if (s) {
      const p = makePerson(s.x, s.y);
      p.parade = true; p.speed = 0.4;
      agents.push(p);
    }
  } else if (!S.festival) {
    agents = agents.filter(a => !a.parade);
  }

  // movement
  const jam = performance.now() < S.jamUntil;
  for (const a of agents) {
    const dx = a.tx - a.x, dy = a.ty - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05) {
      // arrived: pick next
      const roadOnly = a.kind === 'vehicle';
      const n = nextTarget(a, roadOnly);
      if (n) { a.tx = n[0]; a.ty = n[1]; if (n[0] !== Math.round(a.x)) a.dir = n[0] > a.x ? 1 : -1; }
      else { a.tx = Math.round(a.x); a.ty = Math.round(a.y); }
      if (a.kind === 'cow' && Math.random() < 0.25) a.wait = 1 + Math.random() * 3; // cows idle. a lot.
      continue;
    }
    let sp = a.speed * dt;
    if (a.kind === 'vehicle' && jam) sp = 0;
    if (a.kind === 'cow') { a.wait -= dt; if (a.wait > 0) continue; }
    a.x += (dx / dist) * Math.min(sp, dist);
    a.y += (dy / dist) * Math.min(sp, dist);
  }
}

export function clearAgents() { agents = []; }
