// catalog.mjs — generates catalog.json from the code-side registries
// (adapted from lucas-martinic/polyfork-catalog: content lives in code,
// and a machine-readable index is generated so tools/owners can consume it).
//
//   node scripts/catalog.mjs            # writes catalog.json at repo root
//
// The catalog is committed to the repo: it is the single source a CLI,
// spreadsheet, or future agent can read to know EVERYTHING in the city
// (buildings, stats, residents, deeds, festivals, tiers) without parsing JS.

import { writeFileSync } from 'node:fs';

// data.js is pure ESM; owners.js touches localStorage only inside try/catch,
// so both import cleanly under Node.
const { BUILDINGS, CATS, TIERS, SEASONS, FESTIVALS, OUTFITS } = await import(
  new URL('../js/data.js', import.meta.url)
);
const owners = await import(new URL('../js/owners.js', import.meta.url));

const buildings = Object.entries(BUILDINGS).map(([key, d]) => ({
  key,
  name: d.name,
  category: d.cat,
  cost: d.cost || 0,
  upkeep: d.upkeep || 0,
  homes: d.homes || 0,
  jobs: d.jobs || 0,
  food: d.food || 0,
  water: d.water || 0,
  power: d.power || 0,
  income: d.income || 0,
  happiness: d.happy || 0,
  pollution: d.pol || 0,
  unlockTier: d.tier || 0,
  description: d.desc || '',
}));

const residents = owners.residentList().map((r) => ({
  name: r.name,
  home: r.home || null,
  shop: r.shop || null,
  deedSource: r.fromCode ? 'code' : 'in-game',
}));

const catalog = {
  game: 'Apna Shehar — India City Builder',
  version: 2,
  generator: 'scripts/catalog.mjs (adapted from lucas-martinic/polyfork-catalog)',
  generatedAt: new Date().toISOString(),
  clock: 'Asia/Kolkata (UTC+05:30) — real time drives day/night',
  counts: {
    buildings: buildings.length,
    residents: residents.length,
    categories: CATS.length,
    festivals: FESTIVALS.length,
    tiers: TIERS.length,
  },
  categories: CATS,
  buildings,
  residents,
  deeds: owners.deeds(),
  tiers: TIERS,
  seasons: SEASONS,
  festivals: FESTIVALS.map((f) => ({ id: f.id, name: f.name, text: f.text })),
  outfitFamilies: OUTFITS.map((o) => ({ type: o.type, colors: o.colors.length })),
  howToExtend: {
    addBuilding: 'js/data.js BUILDINGS + one draw case in js/arts.js',
    addResident: 'js/owners.js RESIDENTS',
    assignDeed: 'js/owners.js ASSIGNMENTS (tiles as "x,y")',
  },
};

const out = new URL('../catalog.json', import.meta.url).pathname;
writeFileSync(out, JSON.stringify(catalog, null, 2) + '\n');
console.log(
  `catalog.json written: ${catalog.counts.buildings} buildings, ${catalog.counts.residents} residents, ${catalog.counts.festivals} festivals`
);
