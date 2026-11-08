// catalog.mjs — generates catalog.json from the code-side registries
// (adapted from lucas-martinic/polyfork-catalog: content lives in code,
// and a machine-readable index is generated so tools/owners can consume it).
//
//   node scripts/catalog.mjs            # writes catalog.json at repo root
//
// v3 (this version) adopts the polyfork catalog SCHEMA itself:
//   site / licence / api / counts / kits[] / assets[]
// Each asset carries its stats, art refs and PARAMETRIC KNOBS — the
// polyfork "a model is a program" idea adapted to procedural canvas.
// The old `buildings` key is renamed `assets` (single source, no dupes).

import { writeFileSync } from 'node:fs';

// data.js is pure ESM; owners.js touches localStorage only inside try/catch,
// so both import cleanly under Node.
const { BUILDINGS, CATS, TIERS, SEASONS, FESTIVALS, OUTFITS, KITS, KNOBS } =
  await import(new URL('../js/data.js', import.meta.url));
const owners = await import(new URL('../js/owners.js', import.meta.url));

const SITE = 'https://superz1402.github.io/india-city-builder/';
const REPO = 'https://github.com/superz1402/india-city-builder';

const kitOf = Object.fromEntries(KITS.map((k) => [k.cat, k.id]));
const SEASON_ASSETS = ['wheat', 'paddy', 'mango']; // react to the season knob natively

const assets = Object.entries(BUILDINGS).map(([key, d]) => ({
  id: key,
  title: d.name,
  type: d.cat === 'decor' ? (key === 'tree' ? 'nature' : 'prop') : 'building',
  kit: kitOf[d.cat] || null,
  category: d.cat,
  stats: {
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
  },
  description: d.desc || '',
  // polyfork-style knob descriptor: options list (+ colour map when the
  // knob is a colourway). Absent = asset has no knobs (seeded variety only).
  ...(KNOBS[key]
    ? {
        knobs: Object.fromEntries(
          Object.entries(KNOBS[key]).map(([n, kd]) => [
            n,
            kd.colors ? { options: Object.keys(kd.colors), colors: kd.colors } : { options: kd.options },
          ])
        ),
      }
    : {}),
  ...(SEASON_ASSETS.includes(key) ? { seasonResponse: SEASONS.map((s) => s.id) } : {}),
  def: `js/data.js BUILDINGS.${key}`,
  art: `js/arts.js drawBuilding case '${d.draw}'`,
}));

const kits = KITS.map((k) => ({
  id: k.id,
  name: k.name,
  category: k.cat,
  desc: k.desc,
  parts: assets.filter((a) => a.category === k.cat).length,
}));

const residents = owners.residentList().map((r) => ({
  name: r.name,
  home: r.home || null,
  shop: r.shop || null,
  deedSource: r.fromCode ? 'code' : 'in-game',
}));

const catalog = {
  site: SITE,
  licence: `${REPO}/blob/main/LICENSE`,
  api: `${SITE}llms.txt`,
  repo: REPO,
  game: 'Apna Shehar — India City Builder',
  version: 3,
  generator: 'scripts/catalog.mjs (schema adapted from lucas-martinic/polyfork-catalog)',
  generatedAt: new Date().toISOString(),
  clock: 'Asia/Kolkata (UTC+05:30) — real time drives day/night',
  counts: {
    assets: assets.length,
    kits: kits.length,
    knobbed: assets.filter((a) => a.knobs).length,
    residents: residents.length,
    categories: CATS.length,
    festivals: FESTIVALS.length,
    tiers: TIERS.length,
  },
  kits,
  assets,
  residents,
  deeds: owners.deeds(),
  tiers: TIERS,
  seasons: SEASONS,
  festivals: FESTIVALS.map((f) => ({ id: f.id, name: f.name, text: f.text })),
  outfitFamilies: OUTFITS.map((o) => ({ type: o.type, colors: o.colors.length })),
  howToExtend: {
    addBuilding: 'js/data.js BUILDINGS + one draw case in js/arts.js',
    addResident: 'js/owners.js RESIDENTS (max 4, keep the [NPC] tag)',
    assignDeed: 'js/owners.js ASSIGNMENTS (tiles as "x,y")',
    pinKnob: 'place(x, y, key, { knobs: { <knob>: <option> } }) — see KNOBS in js/data.js',
    regenerate: 'node scripts/catalog.mjs',
  },
};

const out = new URL('../catalog.json', import.meta.url).pathname;
writeFileSync(out, JSON.stringify(catalog, null, 2) + '\n');
console.log(
  `catalog.json (v3) written: ${catalog.counts.assets} assets in ${catalog.counts.kits} kits, ` +
  `${catalog.counts.knobbed} with knobs, ${catalog.counts.residents} residents, ${catalog.counts.festivals} festivals`
);
