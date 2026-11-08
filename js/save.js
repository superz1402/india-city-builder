// save.js — versioned localStorage saves (per emberwake convention: a version
// field first so future migrations stay possible). Autosave lives in main.js.
// v2 adds knob overrides ({"x,y": {knob: option}}) — v1 saves load unchanged
// (they simply have no pins; every building falls back to its seeded look).

import { S, MAP, generateTerrain, recomputeStats, pushNotice } from './state.js';

const KEY = 'apna-shehar-save-v1';

export function saveGame(silent = false) {
  try {
    const rows = [];
    let knobData = null;
    for (let y = 0; y < MAP; y++) {
      let row = '';
      for (let x = 0; x < MAP; x++) {
        const g = S.grid[y][x];
        row += g ? g.k : '.';
        row += ' ';
        if (g && g.knobs) {
          if (!knobData) knobData = {};
          knobData[x + ',' + y] = g.knobs;
        }
      }
      rows.push(row.trim());
    }
    const data = {
      v: S.v, seed: S.seed, day: S.day, tday: S.tday,
      money: Math.round(S.money), pop: S.pop, happy: S.happy, foodStock: S.foodStock,
      tierIdx: S.tierIdx, festIndex: S.festIndex, nextFestDay: S.nextFestDay,
      festival: S.festival, counts: S.counts,
      grid: rows, startedAt: S.startedAt,
    };
    if (knobData) data.knobs = knobData; // v2: pinned parametric knobs per tile
    localStorage.setItem(KEY, JSON.stringify(data));
    if (!silent) pushNotice('City saved.', 'good');
    return true;
  } catch (e) {
    if (!silent) pushNotice('Could not save (storage blocked?). Your city still plays, but progress will not persist.', 'bad');
    return false;
  }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    // v1 and v2 both load; v2 may carry knob overrides (migration: none
    // needed — v1 tiles without pins render their seeded look as before)
    if (!d || (d.v !== 1 && d.v !== 2) || !Array.isArray(d.grid) || d.grid.length !== MAP) return false;
    S.seed = d.seed; S.day = d.day; S.tday = d.tday || 0;
    S.money = d.money; S.pop = d.pop; S.happy = d.happy; S.foodStock = d.foodStock;
    S.tierIdx = d.tierIdx || 0; S.festIndex = d.festIndex || 0;
    S.nextFestDay = d.nextFestDay || (S.day + 10);
    S.festival = d.festival || null; S.counts = d.counts || {};
    S.startedAt = d.startedAt || Date.now();
    S.terrain = generateTerrain(S.seed);
    S.grid = Array.from({ length: MAP }, () => Array(MAP).fill(null));
    for (let y = 0; y < MAP; y++) {
      const cells = d.grid[y].split(' ');
      for (let x = 0; x < MAP && x < cells.length; x++) {
        if (cells[x] && cells[x] !== '.') {
          S.grid[y][x] = { k: cells[x], born: 1, seed: (x * 31 + y * 17) % 97 };
        }
      }
    }
    // rehydrate v2 knob pins into their grid cells
    if (d.knobs && typeof d.knobs === 'object') {
      for (const [k, v] of Object.entries(d.knobs)) {
        const [x, y] = k.split(',').map(Number);
        if (Number.isInteger(x) && Number.isInteger(y) && S.grid[y] && S.grid[y][x]) {
          S.grid[y][x].knobs = v;
        }
      }
    }
    recomputeStats(true);
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
