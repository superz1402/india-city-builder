// owners.js — THE DEED BOOK: who owns which home and shop. Metaverse-style
// ownership for Apna Shehar.
//
// ═══════════════════════════════════════════════════════════════════════
//  CITY OWNER'S GUIDE — this is the file you edit to give people property.
// ═══════════════════════════════════════════════════════════════════════
//
//  ABOUT FAKE HUMANS (NPCs): the city keeps the pretend crowd small on
//  purpose — FOUR named NPCs, each tagged with a [NPC] bracket so nobody
//  mistakes them for real people. The reference city (buildacountry) does
//  the same: one real walker (you), a few citizens, everyone else is
//  scenery. Keep it that way unless the owner asks otherwise.
//
// 1) ADD A PERSON: append a name to RESIDENTS below (use the [NPC] tag).
// 2) GIVE THEM A HOME / SHOP: add a line to ASSIGNMENTS with the tile as
//    "x,y" (column x, row y on the 36×36 map — tap any building in game
//    to see its tile in the info card).
//
//      export const ASSIGNMENTS = [
//        { name: '[NPC] Aarav', home: '17,18', shop: '22,15' },
//      ];
//
//  • `home` / `shop` are optional — a person can have both, either, or none
//    (residents without property simply wander the city as visitors).
//  • A deed is attached to the TILE, not the building: rebuild on that tile
//    and the deed still holds. Bulldoze it and the deed shows as vacant.
//  • Assignments made inside the game (tap a home → "Assign owner") are
//    stored in the browser and merge on top of this list. This file wins
//    for the same name, so code is always the source of truth.
//  • Residents follow real Indian time: home at night, at the shop by day,
//    out for evening strolls. Tap any house in-game to see who lives there,
//    or use the search box to find a person's home.
//
// ═══════════════════════════════════════════════════════════════════════

import { S, MAP, gridAt } from './state.js';
import { BUILDINGS } from './data.js';
import { dayPhase } from './clock.js';

// v2: deed names changed to [NPC] names, so the old key is retired — stale
// in-game assignments for retired names must never ghost into the book.
const DEEDS_KEY = 'apna-shehar-deeds-v2';

// The people of the shehar. FOUR fake humans max (owner rule: "don't add
// fake humans — 4 is enough, bracket-name them npc"). Each starts outside
// their home tile, wanders the gullies, and appears in search.
export const RESIDENTS = [
  '[NPC] Ramu',
  '[NPC] Meera',
  '[NPC] Arjun',
  '[NPC] Zoya',
];

// Code-side deeds (see guide above). Mahanagar Edition: every resident now
// holds a home AND a shop across the pre-built city (state.js reserves these
// exact tiles in generateCity() — a node test asserts the sync).
// Deeds attach to TILES: rebuild on the tile and the deed still holds.
export const ASSIGNMENTS = [
  { name: '[NPC] Ramu',  home: '13,32', shop: '20,32' },  // pakka ghar + kirana, Old Mohalla
  { name: '[NPC] Meera', home: '12,34', shop: '28,24' },  // flat block + saree shop, CBD
  { name: '[NPC] Arjun', home: '13,10', shop: '22,26' },  // bungalow, Civil Lines + dhaba
  { name: '[NPC] Zoya',  home: '29,16', shop: '36,24' },  // villa, Civil Lines + company office
];

// ---------- merged deed list (code + in-game) ----------
let userDeeds = [];
try {
  const raw = localStorage.getItem(DEEDS_KEY);
  if (raw) userDeeds = JSON.parse(raw) || [];
} catch (e) { userDeeds = []; }

function persist() {
  try { localStorage.setItem(DEEDS_KEY, JSON.stringify(userDeeds)); } catch (e) { /* storage blocked; deeds still work this session */ }
}

// merged: code ASSIGNMENTS first, then any in-game assignments for people
// not already covered by code.
export function deeds() {
  const out = ASSIGNMENTS.map(a => ({ ...a, fromCode: true }));
  for (const d of userDeeds) {
    if (!out.some(a => a.name === d.name)) out.push({ ...d, fromCode: false });
  }
  return out.filter(d => d.name);
}

export function deedFor(name) {
  const code = ASSIGNMENTS.find(a => a.name === name);
  if (code) return { ...code, fromCode: true };
  const u = userDeeds.find(a => a.name === name);
  return u ? { ...u, fromCode: false } : null;
}

// In-game assignment (never overwrites a code deed; code is source of truth)
export function assignDeed(name, kind, x, y) {
  if (!RESIDENTS.includes(name)) return { ok: false, why: `${name} is not on the residents list — add them in js/owners.js` };
  const code = ASSIGNMENTS.find(a => a.name === name);
  if (code && code[kind]) return { ok: false, why: `${name}'s ${kind} is fixed in code (js/owners.js)` };
  let d = userDeeds.find(a => a.name === name);
  if (!d) { d = { name }; userDeeds.push(d); }
  d[kind] = `${x},${y}`;
  persist();
  return { ok: true };
}

export function vacateDeed(name, kind) {
  const code = ASSIGNMENTS.find(a => a.name === name);
  if (code && code[kind]) return { ok: false, why: `${name}'s ${kind} is fixed in code (js/owners.js)` };
  const d = userDeeds.find(a => a.name === name);
  if (d) { delete d[kind]; persist(); }
  return { ok: true };
}

// ---------- tile lookups ----------
function parseTile(s) {
  if (!s || typeof s !== 'string') return null;
  const [x, y] = s.split(',').map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || y < 0 || x >= MAP || y >= MAP) return null;
  return { x, y };
}

// who owns (or works) at tile x,y — returns [{name, kind, vacant}]
export function ownersAt(x, y) {
  const out = [];
  for (const d of deeds()) {
    for (const kind of ['home', 'shop']) {
      const t = parseTile(d[kind]);
      if (t && t.x === x && t.y === y) {
        const g = gridAt(x, y);
        const def = g ? BUILDINGS[g.k] : null;
        const stillStanding = !!(def && (kind === 'shop' ? (def.income || def.jobs || def.cat === 'shop' || def.cat === 'work' || def.cat === 'civic' || def.cat === 'faith') : (def.homes || def.cat === 'house')));
        out.push({ name: d.name, kind, vacant: !stillStanding });
      }
    }
  }
  return out;
}

// deed tile (or null) for a resident's current anchor by time of day
export function anchorOf(name) {
  const d = deedFor(name);
  if (!d) return null;
  const phase = dayPhase();
  const shopT = parseTile(d.shop);
  const homeT = parseTile(d.home);
  if (phase === 'night' || phase === 'dawn') return homeT || shopT;
  if (phase === 'morning' || phase === 'afternoon') return shopT || homeT;
  return shopT || homeT || null; // evening: out and about unless anchored
}

export function homeOf(name) { return parseTile((deedFor(name) || {}).home); }
export function shopOf(name) { return parseTile((deedFor(name) || {}).shop); }

// human-readable status, driven by the real IST clock
export function statusOf(name) {
  const d = deedFor(name);
  const phase = dayPhase();
  const hasShop = d && d.shop;
  const hasHome = d && d.home;
  if (!hasHome && !hasShop) {
    switch (phase) {
      case 'night': return 'Night owl, out wandering';
      case 'dawn': return 'Catching the dawn at the gully corner';
      case 'morning': return 'Out for errands';
      case 'afternoon': return 'Wandering the bazaar';
      default: return 'On an evening stroll';
    }
  }
  switch (phase) {
    case 'night': return hasHome ? 'Home for the night' : 'Closing up late';
    case 'dawn': return hasHome ? 'Waking up at home' : 'Opening early';
    case 'morning': return hasShop ? 'Minding their shop' : 'Out for errands';
    case 'afternoon': return hasShop ? 'At their shop' : 'At work in the bazaar';
    default: return hasShop ? 'Wrapping up at the shop' : 'On an evening stroll';
  }
}

export function residentList() {
  return RESIDENTS.map(name => {
    const d = deedFor(name);
    return { name, home: d ? d.home : null, shop: d ? d.shop : null, fromCode: d ? !!d.fromCode : false };
  });
}
