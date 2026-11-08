// arts.js — the procedural Indian art kit (v5 rehaul). Every building,
// person, vehicle and cow is drawn with canvas paths; no image assets ship
// with the game. v5: consistent sun (lit left face / shaded right face),
// contact shadows that ground every structure on the dust, framed windows
// with warm night light, chhajjas / parapets / water tanks / signboards,
// direction-aware road art (kerbs, lane dashes, zebra crossings), traffic
// that points down its lane, and door plates that whisper instead of shout.

import { TW, TH } from './iso.js';
import { KNOBS } from './data.js';

export const P = {
  skin: ['#8d5524', '#a9714b', '#c68642', '#7c4a2d'],
  saree: ['#d81b60', '#e8850c', '#7b1fa2', '#c62828', '#00897b', '#5d4037'],
  kurta: ['#f5f5f5', '#ffd54f', '#90caf9', '#a5d6a7'],
  roofTile: '#bf5b30', wall: ['#efdfbd', '#e5d0a8', '#ecd9b2', '#dfc99e'],
  trim: '#7c4a03', green: '#2e7d32', darkGreen: '#1b5e20',
  water: '#4a90b8', waterDeep: '#3a6f92',
  road: '#414855', roadLine: '#efe0b4',
  gold: '#d4a017', saffron: '#ff8f00', white: '#fafafa', green2: '#1b5e20',
};

function hexShade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * f)));
  g = Math.max(0, Math.min(255, Math.round(g * f)));
  b = Math.max(0, Math.min(255, Math.round(b * f)));
  return `rgb(${r},${g},${b})`;
}

function diamondPath(ctx, cx, cy, sx = 1, sy = 1) {
  const hw = (TW / 2) * sx, hh = (TH / 2) * sy;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// iso box: footprint fraction w,d of the tile, height H px. Returns top-center.
// v5: contact shadow first (the model sits ON the ground, not in it), then the
// three faces with a steady sun from the upper-left, then a light roof rim.
function box(ctx, cx, cy, w, d, H, color, opts = {}) {
  const hw = (TW / 2) * w, hh = (TH / 2) * d;
  const T = { x: cx, y: cy - hh }, R = { x: cx + hw, y: cy }, B = { x: cx, y: cy + hh }, L = { x: cx - hw, y: cy };
  if (!opts.noShadow) {
    ctx.fillStyle = 'rgba(40,26,12,.15)';
    diamondPath(ctx, cx + 2.4, cy + 1.1, w * 1.05 + 0.04, d * 1.05 + 0.04);
    ctx.fill();
  }
  // left face (sun side)
  ctx.fillStyle = hexShade(color, 0.84);
  ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(B.x, B.y); ctx.lineTo(B.x, B.y - H); ctx.lineTo(L.x, L.y - H); ctx.closePath(); ctx.fill();
  // right face (shade side)
  ctx.fillStyle = hexShade(color, 0.64);
  ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(R.x, R.y); ctx.lineTo(R.x, R.y - H); ctx.lineTo(B.x, B.y - H); ctx.closePath(); ctx.fill();
  // top face
  ctx.fillStyle = hexShade(color, opts.topLight || 1.08);
  ctx.beginPath(); ctx.moveTo(T.x, T.y - H); ctx.lineTo(R.x, R.y - H); ctx.lineTo(B.x, B.y - H); ctx.lineTo(L.x, L.y - H); ctx.closePath(); ctx.fill();
  // light roof rim on the two far edges
  ctx.strokeStyle = 'rgba(255,246,220,.34)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(L.x, L.y - H); ctx.lineTo(T.x, T.y - H); ctx.lineTo(R.x, R.y - H); ctx.stroke();
  if (opts.edge) {
    ctx.strokeStyle = opts.edge; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(T.x, T.y - H); ctx.lineTo(R.x, R.y - H); ctx.lineTo(B.x, B.y - H); ctx.lineTo(L.x, L.y - H); ctx.closePath(); ctx.stroke();
  }
  return { x: cx, y: cy - H, halfW: hw, halfH: hh };
}

function dome(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.82, 0, Math.PI, 0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - r, y);
  ctx.quadraticCurveTo(x - r * 0.4, y + r * 0.5, x, y + r * 0.55);
  ctx.quadraticCurveTo(x + r * 0.4, y + r * 0.5, x + r, y);
  ctx.fill();
  ctx.fillStyle = hexShade(color, 0.75);
  ctx.beginPath(); ctx.ellipse(x + r * 0.4, y - r * 0.25, r * 0.35, r * 0.3, 0, Math.PI, 0); ctx.fill();
}

function flagTri(ctx, x, y, w, h, color, t, phase = 0) {
  const wv = Math.sin(t * 3 + phase) * w * 0.14;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h * 0.28 + wv); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
}

function tricolor(ctx, x, y, w, h, t, phase = 0) {
  const wv = Math.sin(t * 2.4 + phase) * w * 0.1;
  const bands = [P.saffron, '#ffffff', '#128807'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = bands[i];
    ctx.beginPath();
    ctx.moveTo(x, y + (h / 3) * i);
    ctx.quadraticCurveTo(x + w / 2, y + (h / 3) * i + wv, x + w, y + (h / 3) * i);
    ctx.lineTo(x + w, y + (h / 3) * (i + 1));
    ctx.quadraticCurveTo(x + w / 2, y + (h / 3) * (i + 1) + wv, x, y + (h / 3) * (i + 1));
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#00007a';
  ctx.beginPath(); ctx.arc(x + w / 2 + wv / 2, y + h / 2, h * 0.09, 0, 7); ctx.fill();
}

// v5 window: dark frame, warm two-tone pane when lit, a sky glint by day,
// a center mullion — reads as a window, not a slot. Same call signature as
// the old flat windowRow so every existing case upgrades for free.
function windowRow(ctx, x0, y0, w, n, lit, gap = 4) {
  const ww = Math.min(7, (w - gap * (n - 1)) / n), wh = ww * 1.15;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (ww + gap), y = y0 - wh;
    ctx.fillStyle = '#5b4a33'; // frame
    ctx.fillRect(x - 1, y - 1, ww + 2, wh + 2);
    if (lit) {
      ctx.fillStyle = '#ffe093';
      ctx.fillRect(x, y, ww, wh);
      ctx.fillStyle = '#f2a63c';
      ctx.fillRect(x, y + wh * 0.55, ww, wh * 0.45);
    } else {
      ctx.fillStyle = '#39424d';
      ctx.fillRect(x, y, ww, wh);
      ctx.fillStyle = 'rgba(255,255,255,.22)'; // sky glint
      ctx.fillRect(x, y, ww, Math.max(1, wh * 0.3));
    }
    ctx.strokeStyle = 'rgba(20,14,8,.4)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(x, y + wh / 2); ctx.lineTo(x + ww, y + wh / 2); ctx.stroke();
    if (lit) pushLight({ x: x + ww / 2, y: y + wh / 2, r: 9, c: 'rgba(255,190,90,.15)' });
  }
}

// arched doorway with a step — the front door most homes were missing
function doorArch(ctx, x, y, w, h, col = '#503a26') {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h * 0.62);
  ctx.arc(x + w / 2, y - h * 0.62, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.2)';
  ctx.fillRect(x, y - 1, w, 1.4); // threshold
}

// black Sintex tank on a brick trestle — the skyline of every Indian roof
function tankOnStilts(ctx, x, y, s = 1) {
  ctx.strokeStyle = '#7a5a40'; ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(x - 3 * s, y); ctx.lineTo(x - 2 * s, y - 5 * s);
  ctx.moveTo(x + 3 * s, y); ctx.lineTo(x + 2 * s, y - 5 * s);
  ctx.stroke();
  ctx.fillStyle = '#22262b';
  roundRectPath(ctx, x - 4 * s, y - 11 * s, 8 * s, 6.4 * s, 2 * s); ctx.fill();
  ctx.fillStyle = '#3b424c';
  ctx.beginPath(); ctx.ellipse(x, y - 11 * s, 4 * s, 1.6 * s, 0, 0, 7); ctx.fill();
}

// window AC box jutting out
function acBox(ctx, x, y, s = 1) {
  ctx.fillStyle = '#b9c2c9';
  roundRectPath(ctx, x - 2.6 * s, y - 3 * s, 5.2 * s, 3 * s, 0.8 * s); ctx.fill();
  ctx.fillStyle = '#7d8a93';
  ctx.fillRect(x - 2.6 * s, y - 1.4 * s, 5.2 * s, 0.8 * s);
}

// striped shop awning with a scalloped hem
function awning(ctx, cx, y, w, cA, cB = '#fff8ec') {
  const n = Math.max(3, Math.round(w / 9));
  const sw = w / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? cA : cB;
    ctx.fillRect(cx - w / 2 + i * sw, y, sw, 4);
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + i * sw, y + 4);
    ctx.quadraticCurveTo(cx - w / 2 + i * sw + sw / 2, y + 6.4, cx - w / 2 + (i + 1) * sw, y + 4);
    ctx.fill();
  }
}

// shop signboard: dark plank, hand-painted lettering
function signBoard(ctx, cx, y, w, text, inkCol = '#ffd54f', boardCol = '#101820') {
  ctx.fillStyle = boardCol;
  roundRectPath(ctx, cx - w / 2, y - 6.4, w, 7.4, 1.6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,213,79,.55)'; ctx.lineWidth = 0.8;
  roundRectPath(ctx, cx - w / 2 + 1, y - 5.4, w - 2, 5.4, 1.2); ctx.stroke();
  ctx.fillStyle = inkCol; ctx.font = '700 4.6px Outfit, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y - 2.6);
}

function archRow(ctx, x0, y0, w, n, color) {
  const aw = w / n;
  for (let i = 0; i < n; i++) {
    const ax = x0 + i * aw + aw * 0.22, awd = aw * 0.56;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ax, y0);
    ctx.lineTo(ax, y0 - awd * 0.9);
    ctx.arc(ax + awd / 2, y0 - awd * 0.9, awd / 2, Math.PI, 0);
    ctx.lineTo(ax + awd, y0);
    ctx.closePath(); ctx.fill();
  }
}

function smoke(ctx, x, y, t, seed = 0) {
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.35 + i / 3 + seed) % 1;
    const sx = x + Math.sin((t + i) * 0.9) * 4 + ph * 6;
    const sy = y - ph * 26;
    ctx.fillStyle = `rgba(90,90,95,${0.28 * (1 - ph)})`;
    ctx.beginPath(); ctx.arc(sx, sy, 2.5 + ph * 5, 0, 7); ctx.fill();
  }
}

// Exported lights collector: render.js reads it for the night light pass.
export let lights = [];
export function beginFrame() { lights = []; }

// Lights are recorded in local building space; render.js sets the current
// draw origin+zoom so the night pass can plot them in screen space.
let _lo = [0, 0, 1];
export function setLightOrigin(ox, oy, z) { _lo = [ox, oy, z]; }
function pushLight(o) {
  lights.push({ x: _lo[0] + o.x * _lo[2], y: _lo[1] + o.y * _lo[2], r: o.r, c: o.c });
}

// ================= parametric knobs (adapted from polyfork) =================
// Every placed building resolves its knobs deterministically from the plot
// seed — the same tile always wears the same look — and an optional pinned
// override (cell.knobs, saved with the city) wins over the seed pick.
function pickKnob(options, seed, salt) {
  const v = Math.sin(((seed || 0) + salt * 37.7) * 12.9898) * 43758.5453;
  return options[Math.floor((v - Math.floor(v)) * options.length) % options.length];
}
const _knobCache = new Map();
export function resolveKnobs(key, seed) {
  const ck = key + ':' + (seed || 0);
  let k = _knobCache.get(ck);
  if (!k) {
    k = {};
    const defs = KNOBS[key];
    if (defs) { let salt = 1; for (const n of Object.keys(defs)) k[n] = pickKnob(defs[n].options || Object.keys(defs[n].colors), seed, salt++); }
    _knobCache.set(ck, k);
  }
  return { ...k };
}

// ================= BUILDINGS =================
export function drawBuilding(ctx, key, sx, sy, o) {
  const cx = sx, cy = sy + TH / 2;
  const rng = (n) => { const v = Math.sin((o.seed + n * 37.7) * 12.9898) * 43758.5453; return v - Math.floor(v); };
  const K = resolveKnobs(key, o.seed || 0);
  if (o.knobs) for (const [n, v] of Object.entries(o.knobs)) K[n] = v;
  const night = o.night, lit = night || o.festival === 'diwali';
  switch (key) {
    case 'jhuggi': {
      const c = KNOBS.jhuggi.tarp.colors[K.tarp] || '#5e7d9a';
      // brick plinth under the tarp
      ctx.fillStyle = '#8a5a3d';
      diamondPath(ctx, cx, cy, 0.78, 0.78); ctx.fill();
      ctx.strokeStyle = 'rgba(50,30,18,.4)'; ctx.lineWidth = 0.7;
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath(); ctx.moveTo(cx + i * 10, cy + i * 4); ctx.lineTo(cx + i * 18, cy - i * 2); ctx.stroke();
      }
      box(ctx, cx, cy, 0.72, 0.72, 10, c, { topLight: 0.95 });
      // tarp wrinkles + rope ties
      ctx.strokeStyle = 'rgba(20,22,28,.28)'; ctx.lineWidth = 0.9;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(cx + i * 8, cy - 9); ctx.lineTo(cx + i * 8 + 3, cy - 1); ctx.stroke();
      }
      ctx.strokeStyle = '#3b2f23'; ctx.beginPath(); ctx.moveTo(cx - 14, cy - 2); ctx.lineTo(cx - 14, cy - 22); ctx.stroke();
      flagTri(ctx, cx - 14, cy - 22, 9, 7, rng(2) > 0.5 ? '#d81b60' : '#4dd0e1', o.t, o.seed);
      // the pot by the door
      ctx.fillStyle = '#b3552e';
      ctx.beginPath(); ctx.ellipse(cx + 12, cy + 4, 2.6, 2, 0, 0, 7); ctx.fill();
      if (lit) pushLight({ x: cx, y: cy - 6, r: 12, c: 'rgba(255,180,90,.14)' });
      break;
    }
    case 'kaccha': {
      const wall = KNOBS.kaccha.wall.colors[K.wall] || P.wall[0];
      box(ctx, cx, cy, 0.8, 0.8, 13, wall, { edge: '#a08b64' });
      // mud-wall speckle
      ctx.fillStyle = 'rgba(120,90,50,.16)';
      for (let i = 0; i < 7; i++) {
        const rx = cx - 18 + rng(i) * 34, ry = cy - 3 - rng(i + 4) * 9;
        ctx.fillRect(rx, ry, 1.6, 1.2);
      }
      // roof knob: thatch (layered fronds) or clay tile
      if (K.roof === 'tile') {
        ctx.fillStyle = P.roofTile;
        ctx.beginPath(); ctx.moveTo(cx, cy - 26); ctx.lineTo(cx + 24, cy - 10); ctx.lineTo(cx, cy - 2); ctx.lineTo(cx - 24, cy - 10); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#8a4b1d'; ctx.lineWidth = 1;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 9, cy - 24 + Math.abs(i) * 5); ctx.lineTo(cx + i * 9, cy - 9 + Math.abs(i) * 4); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(255,240,210,.25)';
        ctx.beginPath(); ctx.moveTo(cx - 24, cy - 10); ctx.lineTo(cx, cy - 26); ctx.stroke();
      } else {
        ctx.fillStyle = '#b89044';
        ctx.beginPath(); ctx.moveTo(cx, cy - 27); ctx.lineTo(cx + 25, cy - 10); ctx.lineTo(cx, cy - 2); ctx.lineTo(cx - 25, cy - 10); ctx.closePath(); ctx.fill();
        // thatch fringe rows
        ctx.strokeStyle = '#8a6a2f'; ctx.lineWidth = 1;
        for (let r2 = 0; r2 < 3; r2++) {
          const yy = cy - 22 + r2 * 6, spread = 6 + r2 * 7;
          ctx.beginPath(); ctx.moveTo(cx - spread, yy); ctx.lineTo(cx, yy - 3.5); ctx.lineTo(cx + spread, yy); ctx.stroke();
        }
      }
      doorArch(ctx, cx - 6, cy - 3, 7, 8, '#5b4630');
      // clay pot by the step
      ctx.fillStyle = '#c96f2f';
      ctx.beginPath(); ctx.ellipse(cx + 13, cy + 3, 2.4, 2.6, 0, 0, 7); ctx.fill();
      if (lit) pushLight({ x: cx - 4, y: cy - 6, r: 12, c: 'rgba(255,180,90,.14)' });
      break;
    }
    case 'pakka': {
      const t = box(ctx, cx, cy, 0.84, 0.84, 20, KNOBS.pakka.paint.colors[K.paint] || '#ddc7a2', { edge: '#b09b74' });
      // chhajja: the projecting eave slab over the ground floor
      ctx.fillStyle = '#a9825a';
      ctx.beginPath();
      ctx.moveTo(cx - 24, cy - 13); ctx.lineTo(cx, cy - 4.5); ctx.lineTo(cx + 24, cy - 13);
      ctx.lineTo(cx + 24, cy - 15); ctx.lineTo(cx, cy - 6.5); ctx.lineTo(cx - 24, cy - 15);
      ctx.closePath(); ctx.fill();
      windowRow(ctx, cx - 15, cy - 9, 26, 3, lit);
      windowRow(ctx, cx - 12, cy - 24, 24, 3, lit);
      doorArch(ctx, cx - 2, cy - 2, 8, 9, '#4e3826');
      // roof parapet
      ctx.fillStyle = hexShade('#ddc7a2', 0.86);
      ctx.beginPath();
      ctx.moveTo(cx - 26, cy - 12); ctx.lineTo(cx, cy - 3.4); ctx.lineTo(cx + 26, cy - 12);
      ctx.lineTo(cx + 26, cy - 14.6); ctx.lineTo(cx, cy - 6); ctx.lineTo(cx - 26, cy - 14.6);
      ctx.closePath(); ctx.fill();
      // rooftop water tank on its trestle + bucket
      tankOnStilts(ctx, cx + 12, t.y - 2, 1);
      ctx.fillStyle = '#c96f2f'; ctx.fillRect(cx - 14, t.y - 3, 3, 3);
      break;
    }
    case 'haveli': {
      const stone = KNOBS.haveli.stone.colors[K.stone] || '#e2c294';
      const t = box(ctx, cx, cy, 0.92, 0.92, 22, stone, { edge: '#a97f4a' });
      // jharokha: projecting balcony boxes with arch tops on the left face
      for (const jx of [cx - 24, cx - 10]) {
        ctx.fillStyle = hexShade(stone, 1.05);
        roundRectPath(ctx, jx, cy - 20, 9, 10, 2); ctx.fill();
        ctx.fillStyle = '#7c4a03';
        ctx.beginPath();
        ctx.moveTo(jx + 1.5, cy - 20);
        ctx.arc(jx + 4.5, cy - 20, 3, Math.PI, 0);
        ctx.lineTo(jx + 7.5, cy - 16); ctx.lineTo(jx + 1.5, cy - 16);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#a97f4a'; ctx.fillRect(jx - 1, cy - 10.5, 11, 1.6); // balcony slab
      }
      archRow(ctx, cx - 26, cy - 8, 22, 2, '#7c4a03');
      archRow(ctx, cx + 4, cy - 8, 22, 2, '#7c4a03');
      archRow(ctx, cx - 16, cy - 26, 32, 3, '#7c4a03');
      dome(ctx, cx - 20, t.y - 4, 6, '#c96f2f'); dome(ctx, cx + 20, t.y - 4, 6, '#c96f2f');
      dome(ctx, cx, t.y - 8, 8, '#b3552e');
      ctx.strokeStyle = '#d4a017'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cx, t.y - 16); ctx.lineTo(cx, t.y - 21); ctx.stroke();
      if (lit) pushLight({ x: cx, y: cy - 10, r: 18, c: 'rgba(255,190,110,.14)' });
      break;
    }
    case 'bungalow': {
      // compound wall + gate posts around the plot
      ctx.strokeStyle = '#cfc0a0'; ctx.lineWidth = 2;
      diamondPath(ctx, cx, cy + 1, 0.97, 0.97); ctx.stroke();
      ctx.fillStyle = '#b9a67e';
      ctx.fillRect(cx - 2, cy - 13, 4, 4); ctx.fillRect(cx + 10, cy - 8, 4, 4); // gate pillars
      // lawn
      ctx.fillStyle = '#4c8f43';
      diamondPath(ctx, cx, cy + 1, 0.9, 0.9); ctx.fill();
      ctx.fillStyle = '#5da24a';
      diamondPath(ctx, cx - 8, cy + 2, 0.4, 0.4); ctx.fill();
      diamondPath(ctx, cx + 14, cy - 2, 0.32, 0.32); ctx.fill();
      // the house
      box(ctx, cx, cy - 2, 0.6, 0.6, 14, KNOBS.bungalow.paint.colors[K.paint] || '#f2e3c8', { edge: '#c9b28a' });
      ctx.fillStyle = K.roof === 'slate' ? '#5a6670' : P.roofTile;
      ctx.beginPath(); ctx.moveTo(cx - 21, cy - 17); ctx.lineTo(cx, cy - 31); ctx.lineTo(cx + 21, cy - 17); ctx.lineTo(cx, cy - 9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,214,.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - 21, cy - 17); ctx.lineTo(cx, cy - 31); ctx.stroke();
      // veranda posts + rail
      ctx.strokeStyle = '#8d6e53'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 6); ctx.lineTo(cx - 8, cy - 2);
      ctx.moveTo(cx + 8, cy + 6); ctx.lineTo(cx + 8, cy - 2);
      ctx.moveTo(cx - 10, cy - 2); ctx.lineTo(cx + 10, cy - 2);
      ctx.stroke();
      windowRow(ctx, cx - 11, cy - 9, 22, 3, lit);
      doorArch(ctx, cx - 3, cy + 4, 6, 6, '#4e3826');
      // garden path from gate to veranda
      ctx.strokeStyle = 'rgba(226,212,178,.8)'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(cx, cy + 10); ctx.lineTo(cx, cy + 4); ctx.stroke();
      if (lit) pushLight({ x: cx, y: cy + 4, r: 14, c: 'rgba(255,205,120,.14)' });
      break;
    }
    case 'flats': {
      // stilt floor: pillars + parking shadow, then 3 lived-in floors
      ctx.fillStyle = '#9aa2a8';
      for (const px of [cx - 18, cx - 6, cx + 8, cx + 18]) ctx.fillRect(px, cy - 8, 3, 8);
      ctx.fillStyle = 'rgba(30,30,40,.25)';
      diamondPath(ctx, cx + 6, cy - 3, 0.5, 0.4); ctx.fill(); // parked car shadow
      ctx.fillStyle = '#8fa3ad'; roundRectPath(ctx, cx - 2, cy - 7, 12, 4.6, 1.6); ctx.fill();
      const t = box(ctx, cx, cy - 8, 0.8, 0.8, 40, KNOBS.flats.paint.colors[K.paint] || '#cfd8dc', { edge: '#90a4ae' });
      for (let f = 0; f < 4; f++) {
        const fy = cy - 18 - f * 10;
        // balcony rail + windows on both faces
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.fillRect(cx - 20, fy, 17, 1.6); ctx.fillRect(cx + 3, fy, 17, 1.6);
        windowRow(ctx, cx - 20, fy - 1, 16, 2, lit);
        windowRow(ctx, cx + 4, fy - 1, 16, 2, lit);
        acBox(ctx, cx + 21, fy - 3.4, 1);
      }
      tankOnStilts(ctx, cx + 8, t.y - 1, 1.2);
      // drying clothes line
      const wc = '#d81b60';
      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(cx - 22, t.y + 4); ctx.quadraticCurveTo(cx - 14, t.y + 7, cx - 6, t.y + 4); ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? wc : '#4dd0e1';
        ctx.fillRect(cx - 19 + i * 4.4, t.y + 5, 3, 4);
      }
      break;
    }
    case 'wheat': {
      const season = o.season;
      const golden = season === 'harvest' ? '#e2b04a' : season === 'winter' ? '#96a24b' : '#c4b44e';
      ctx.fillStyle = golden; diamondPath(ctx, cx, cy, 0.96, 0.96); ctx.fill();
      // furrow rows
      ctx.strokeStyle = hexShade(golden, 0.78); ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 8 - 14, cy + i * 4 + 7); ctx.lineTo(cx + i * 8 + 14, cy + i * 4 - 7); ctx.stroke(); }
      // stalks with heads
      ctx.strokeStyle = hexShade(golden, 0.66); ctx.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const rx = cx + (rng(i) - 0.5) * 44, ry = cy + (rng(i + 9) - 0.5) * 18;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, ry - 4.5); ctx.stroke();
        ctx.fillStyle = hexShade(golden, 1.22);
        ctx.beginPath(); ctx.ellipse(rx, ry - 5.4, 1.1, 2, 0, 0, 7); ctx.fill();
      }
      break;
    }
    case 'paddy': {
      const flooded = o.season === 'monsoon';
      ctx.fillStyle = flooded ? '#4a7d94' : '#57843f'; diamondPath(ctx, cx, cy, 0.96, 0.96); ctx.fill();
      if (flooded) { ctx.fillStyle = 'rgba(255,255,255,.16)'; diamondPath(ctx, cx - 4, cy - 2, 0.5, 0.5); ctx.fill(); }
      // planted rows (a real grid, not confetti)
      ctx.strokeStyle = flooded ? '#1b5e20' : '#3c6b23'; ctx.lineWidth = 1.2;
      for (let r2 = -2; r2 <= 2; r2++) for (let c2 = -2; c2 <= 2; c2++) {
        const rx = cx + c2 * 9 + r2 * 4, ry = cy + r2 * 5 + c2 * 1.5;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + 1, ry - 5); ctx.stroke();
        ctx.beginPath(); ctx.arc(rx + 1, ry - 5.6, 1.5, 0, 7); ctx.stroke();
      }
      break;
    }
    case 'dairy': {
      box(ctx, cx, cy, 0.7, 0.7, 13, '#e6e0d4', { edge: '#b8a78d' });
      ctx.fillStyle = '#795548'; ctx.fillRect(cx - 18, cy - 4, 10, 3);
      signBoard(ctx, cx, cy - 16, 18, 'DOODH', '#fff3d6', '#5d4037');
      drawMiniCow(ctx, cx + 16, cy + 6, o.t, o.seed + 3);
      break;
    }
    case 'mango': {
      ctx.fillStyle = '#4e7d3a'; diamondPath(ctx, cx, cy, 0.96, 0.96); ctx.fill();
      ctx.fillStyle = 'rgba(30,50,20,.2)'; diamondPath(ctx, cx + 2, cy + 2, 0.8, 0.8); ctx.fill();
      for (const [dx, dy] of [[-12, -2], [4, -8], [12, 4], [-2, 6]]) {
        ctx.fillStyle = '#5d4436'; ctx.fillRect(cx + dx - 1.2, cy + dy - 10, 2.6, 9);
        ctx.fillStyle = '#256b28';
        ctx.beginPath(); ctx.arc(cx + dx - 2, cy + dy - 12, 6.4, 0, 7); ctx.fill();
        ctx.fillStyle = rng(dx) > 0.5 ? '#2e7d32' : '#388e3c';
        ctx.beginPath(); ctx.arc(cx + dx + 2, cy + dy - 14, 6, 0, 7); ctx.fill();
        ctx.fillStyle = '#4d9e4c';
        ctx.beginPath(); ctx.arc(cx + dx, cy + dy - 16, 3.6, 0, 7); ctx.fill();
        if (o.season === 'harvest' || o.season === 'summer') {
          ctx.fillStyle = '#fbc02d';
          ctx.beginPath(); ctx.arc(cx + dx + 3, cy + dy - 11, 1.6, 0, 7); ctx.arc(cx + dx - 3, cy + dy - 13, 1.4, 0, 7); ctx.fill();
        }
      }
      break;
    }
    case 'chai': {
      // the tapri: wooden stall, scalloped awning, kettle on the stove
      box(ctx, cx, cy, 0.52, 0.52, 9, '#8d6e63', { edge: '#6d4c41' });
      const awc = KNOBS.chai.awning.colors[K.awning] || '#37474f';
      awning(ctx, cx, cy - 16, 26, awc);
      // glass jars of biscuits on the counter
      ctx.fillStyle = '#d7ccc8'; ctx.fillRect(cx - 10, cy - 8, 4, 3.4);
      ctx.fillStyle = '#a1887f'; ctx.fillRect(cx - 5, cy - 8, 4, 3.4);
      // kettle + steam
      ctx.fillStyle = '#cfd8dc'; ctx.beginPath(); ctx.arc(cx + 8, cy - 3, 3, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.moveTo(cx + 8, cy - 7); ctx.quadraticCurveTo(cx + 10 + Math.sin(o.t * 2) * 2, cy - 12, cx + 8, cy - 16); ctx.stroke();
      ctx.fillStyle = '#5d4037'; ctx.fillRect(cx - 12, cy + 3, 12, 2.5); // bench
      // menu board leaning on the wall
      ctx.fillStyle = '#2e3b2e'; ctx.fillRect(cx + 12, cy - 8, 6, 8);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(cx + 13, cy - 5.6); ctx.lineTo(cx + 17, cy - 5.6); ctx.moveTo(cx + 13, cy - 3.6); ctx.lineTo(cx + 17, cy - 3.6); ctx.stroke();
      if (lit) pushLight({ x: cx, y: cy - 10, r: 14, c: 'rgba(255,180,80,.18)' });
      break;
    }
    case 'kirana': {
      box(ctx, cx, cy, 0.78, 0.78, 16, '#f0e0be', { edge: '#b09b74' });
      const awm = { red: '#c62828', teal: '#00695c', orange: '#e8850c' }[K.awning] || '#c62828';
      awning(ctx, cx, cy - 13, 34, awm);
      // open shutter + goods: sacks of rice, biscuit crates
      ctx.fillStyle = '#6b5636';
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 4); ctx.lineTo(cx - 6, cy - 4); ctx.lineTo(cx - 6, cy - 10); ctx.lineTo(cx - 14, cy - 10);
      ctx.closePath(); ctx.fill(); // half-raised shutter
      ctx.fillStyle = '#d9c49a';
      ctx.beginPath(); ctx.ellipse(cx - 15, cy + 3, 3.4, 2.6, 0, 0, 7); ctx.ellipse(cx - 10, cy + 4.4, 3, 2.4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#c9a227'; ctx.fillRect(cx + 8, cy + 1, 7, 4);
      windowRow(ctx, cx - 4, cy - 6, 14, 2, lit);
      signBoard(ctx, cx, cy - 20, 26, 'KIRANA', '#ffe9a8', '#27402e');
      if (lit) pushLight({ x: cx, y: cy - 8, r: 15, c: 'rgba(255,200,120,.15)' });
      break;
    }
    case 'dhaba': {
      box(ctx, cx, cy, 0.76, 0.76, 14, '#c96f2f', { edge: '#8a4b1d' });
      const cc = KNOBS.dhaba.canopy.colors[K.canopy] || '#4dd0e1';
      awning(ctx, cx, cy - 19, 40, cc, '#f6f1e4');
      signBoard(ctx, cx, cy - 25, 30, 'DHABA', '#ffd54f', '#5d2a10');
      // charpai
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx - 16, cy + 8); ctx.lineTo(cx - 4, cy + 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 15, cy + 10); ctx.lineTo(cx - 15, cy + 5); ctx.moveTo(cx - 5, cy + 10); ctx.lineTo(cx - 5, cy + 5); ctx.stroke();
      // tandoor with live embers
      ctx.fillStyle = '#b3552e'; ctx.beginPath(); ctx.ellipse(cx + 14, cy + 6, 4, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(255,${120 + Math.round(Math.abs(Math.sin(o.t * 5)) * 80)},50,.9)`;
      ctx.beginPath(); ctx.ellipse(cx + 14, cy + 2.6, 1.8, 1, 0, 0, 7); ctx.fill();
      // stacked plates
      ctx.fillStyle = '#e0e0e0'; ctx.beginPath(); ctx.ellipse(cx + 5, cy + 6, 3, 1.2, 0, 0, 7); ctx.fill();
      if (lit) pushLight({ x: cx, y: cy - 8, r: 16, c: 'rgba(255,170,60,.17)' });
      break;
    }
    case 'bazaar': {
      ctx.fillStyle = '#cdbb92'; diamondPath(ctx, cx, cy, 0.98, 0.98); ctx.fill();
      const tents = [[-13, -4, '#d81b60'], [6, -8, '#00897b'], [2, 6, '#f57f17']];
      for (const [dx, dy, col] of tents) {
        ctx.fillStyle = 'rgba(40,26,12,.14)';
        ctx.beginPath(); ctx.ellipse(cx + dx + 2, cy + dy + 3, 12, 4, 0, 0, 7); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(cx + dx, cy + dy - 12); ctx.lineTo(cx + dx + 12, cy + dy - 5); ctx.lineTo(cx + dx, cy + dy + 2); ctx.lineTo(cx + dx - 12, cy + dy - 5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx + dx, cy + dy - 12); ctx.lineTo(cx + dx, cy + dy + 2); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(cx + dx - 6, cy + dy - 1, 12, 3);
      }
      // goods: fruit piles and sacks
      ctx.fillStyle = '#fbc02d'; ctx.beginPath(); ctx.arc(cx - 4, cy + 9, 2.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(cx + 1, cy + 10, 2.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#43a047'; ctx.beginPath(); ctx.arc(cx + 6, cy + 9, 2.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#d9c49a'; ctx.beginPath(); ctx.ellipse(cx - 9, cy + 8, 2.8, 2, 0, 0, 7); ctx.fill();
      // marigold garland strung across
      ctx.strokeStyle = '#e8850c'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - 14, cy - 12); ctx.quadraticCurveTo(cx, cy - 6, cx + 14, cy - 12); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const gx = cx - 12 + i * 6, gy = cy - 8.6 - Math.sin((i / 4) * Math.PI) * 3.4;
        ctx.fillStyle = i % 2 ? '#ffb300' : '#e8850c';
        ctx.beginPath(); ctx.arc(gx, gy, 1.3, 0, 7); ctx.fill();
      }
      if (lit) pushLight({ x: cx, y: cy - 8, r: 20, c: 'rgba(255,200,120,.15)' });
      break;
    }
    case 'saree': {
      box(ctx, cx, cy, 0.78, 0.78, 16, '#fce4ec', { edge: '#ad7a8c' });
      const cols = K.silks === 'ruby' ? ['#d81b60', '#b71c1c', '#e8850c', '#f8bbd0', '#c62828']
                 : K.silks === 'peacock' ? ['#00897b', '#7b1fa2', '#1565c0', '#26c6da', '#4a148c']
                 : ['#d81b60', '#e8850c', '#7b1fa2', '#00897b', '#c62828'];
      for (let i = 0; i < 5; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(cx - 15 + i * 6, cy - 24, 4, 12); }
      windowRow(ctx, cx - 12, cy - 6, 22, 3, lit);
      signBoard(ctx, cx, cy - 27, 24, 'SAREES', '#f8bbd0', '#4a148c');
      if (lit) pushLight({ x: cx, y: cy - 10, r: 15, c: 'rgba(255,170,200,.15)' });
      break;
    }
    case 'jeweller': {
      box(ctx, cx, cy, 0.78, 0.78, 17, '#efe0c8', { edge: '#c9a227' });
      awning(ctx, cx, cy - 14, 26, '#7c4a03', '#f3e3b8');
      // glitter
      for (let i = 0; i < 3; i++) {
        const gx = cx - 8 + i * 8, gsp = 0.4 + 0.6 * Math.abs(Math.sin(o.t * 2 + i));
        ctx.fillStyle = `rgba(255,215,0,${gsp})`;
        ctx.beginPath(); ctx.arc(gx, cy - 8, 2, 0, 7); ctx.fill();
      }
      signBoard(ctx, cx, cy - 21, 30, 'JEWELLERS', '#ffd54f', '#101820');
      if (lit) pushLight({ x: cx, y: cy - 14, r: 14, c: 'rgba(255,215,0,.15)' });
      break;
    }
    case 'bank': {
      box(ctx, cx, cy, 0.84, 0.84, 20, '#eceff1', { edge: '#90a4ae' });
      // colonnade + steps
      ctx.fillStyle = '#b0bec5';
      for (let i = 0; i < 3; i++) ctx.fillRect(cx - 12 + i * 10, cy - 14, 4, 12);
      ctx.fillStyle = '#cfd8dc';
      ctx.beginPath(); ctx.moveTo(cx - 10, cy + 4); ctx.lineTo(cx + 10, cy - 4); ctx.lineTo(cx + 10, cy - 1); ctx.lineTo(cx - 10, cy + 7); ctx.closePath(); ctx.fill();
      signBoard(ctx, cx, cy - 24, 24, 'BANK', '#cfd8dc', '#263238');
      if (lit) pushLight({ x: cx, y: cy - 10, r: 15, c: 'rgba(200,220,255,.12)' });
      break;
    }
    case 'cinema': {
      const t = box(ctx, cx, cy, 0.9, 0.9, 24, '#7b1fa2', { edge: '#4a0f66' });
      // billboard
      ctx.fillStyle = '#ffd54f'; ctx.fillRect(cx - 18, t.y - 16, 36, 14);
      ctx.fillStyle = '#d81b60'; ctx.beginPath(); ctx.arc(cx - 10, t.y - 9, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a237e'; ctx.fillRect(cx - 2, t.y - 14, 14, 10);
      // marquee bulbs
      for (let i = 0; i < 6; i++) {
        const on = Math.sin(o.t * 4 + i) > -0.2;
        ctx.fillStyle = on ? '#fff176' : '#8d6e63';
        ctx.beginPath(); ctx.arc(cx - 15 + i * 6, t.y + 4, 1.5, 0, 7); ctx.fill();
      }
      if (lit) pushLight({ x: cx, y: t.y - 8, r: 22, c: 'rgba(255,220,120,.18)' });
      break;
    }
    case 'school': {
      const t = box(ctx, cx, cy, 0.86, 0.86, 18, '#fff8e1', { edge: '#c9b28a' });
      ctx.fillStyle = '#1a237e'; ctx.fillRect(cx - 22, cy - 26, 44, 4);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 5.5px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('VIDYALAYA', cx, cy - 22);
      // flag
      ctx.strokeStyle = '#455a64'; ctx.beginPath(); ctx.moveTo(cx + 16, cy - 6); ctx.lineTo(cx + 16, cy - 30); ctx.stroke();
      tricolor(ctx, cx + 16, cy - 30, 9, 6, o.t, o.seed);
      archRow(ctx, cx - 14, cy - 5, 28, 3, '#5b4630');
      windowRow(ctx, cx - 20, cy - 16, 18, 3, lit);
      // blackboard propped by the gate
      ctx.fillStyle = '#2e3b2e'; ctx.fillRect(cx - 24, cy + 1, 7, 5);
      break;
    }
    case 'hospital': {
      box(ctx, cx, cy, 0.86, 0.86, 22, '#f5f5f5', { edge: '#b0bec5' });
      ctx.fillStyle = '#e53935';
      ctx.fillRect(cx - 3, cy - 24, 6, 16); ctx.fillRect(cx - 8, cy - 19, 16, 6);
      windowRow(ctx, cx - 16, cy - 10, 32, 4, lit);
      windowRow(ctx, cx - 14, cy - 20, 28, 4, lit);
      // ambulance
      ctx.fillStyle = '#2e7d32'; roundRectPath(ctx, cx - 22, cy + 1, 13, 5.4, 1.4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - 19, cy + 2.4, 4, 3);
      ctx.strokeStyle = '#e53935'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(cx - 12.4, cy + 2); ctx.lineTo(cx - 12.4, cy + 5); ctx.moveTo(cx - 14, cy + 3.5); ctx.lineTo(cx - 11, cy + 3.5); ctx.stroke();
      if (lit) pushLight({ x: cx, y: cy - 10, r: 16, c: 'rgba(255,240,240,.14)' });
      break;
    }
    case 'panchayat': {
      const t = box(ctx, cx, cy, 0.84, 0.84, 18, '#e8d3b0', { edge: '#a97f4a' });
      dome(ctx, cx, t.y - 3, 8, KNOBS.panchayat.dome.colors[K.dome] || '#c96f2f');
      ctx.fillStyle = '#b0bec5'; ctx.fillRect(cx - 10, cy - 4, 20, 3);
      archRow(ctx, cx - 18, cy - 6, 36, 3, '#7c4a03');
      break;
    }
    case 'police': {
      box(ctx, cx, cy, 0.68, 0.68, 13, '#eceff1', { edge: '#78909c' });
      ctx.fillStyle = '#1a237e'; ctx.fillRect(cx - 15, cy - 16, 30, 3.5);
      ctx.fillStyle = '#fbc02d';
      ctx.beginPath(); ctx.arc(cx, cy - 24, 2.5, 0, 7); ctx.fill(); // beacon lamp
      if (lit) pushLight({ x: cx, y: cy - 24, r: 8, c: 'rgba(80,120,255,.25)' });
      ctx.fillStyle = '#e53935'; ctx.fillRect(cx + 10, cy + 4, 8, 2);
      break;
    }
    case 'watertank': {
      ctx.fillStyle = '#78909c';
      ctx.fillRect(cx - 8, cy - 26, 3, 22); ctx.fillRect(cx + 5, cy - 26, 3, 22); ctx.fillRect(cx - 2, cy - 24, 3, 20);
      ctx.fillStyle = '#37474f';
      ctx.beginPath(); ctx.ellipse(cx, cy - 32, 12, 8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#455a64'; ctx.fillRect(cx - 12, cy - 32, 24, 7);
      ctx.beginPath(); ctx.ellipse(cx, cy - 25, 12, 4, 0, 0, Math.PI); ctx.fill();
      break;
    }
    case 'substation': {
      ctx.fillStyle = '#9e9e9e'; diamondPath(ctx, cx, cy, 0.92, 0.92); ctx.fill();
      ctx.strokeStyle = '#616161'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - 20, cy + 2); ctx.lineTo(cx + 20, cy + 2); ctx.stroke();
      box(ctx, cx, cy - 2, 0.45, 0.4, 12, '#8d9aa5', { edge: '#546e7a' });
      for (const dx of [-12, 12]) {
        ctx.strokeStyle = '#78909c'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(cx + dx, cy - 2); ctx.lineTo(cx + dx, cy - 20); ctx.stroke();
        ctx.fillStyle = '#cfd8dc';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(cx + dx, cy - 8 - i * 5, 2.6, 1.4, 0, 0, 7); ctx.fill(); }
      }
      const z = 0.5 + 0.5 * Math.sin(o.t * 6);
      if (night) pushLight({ x: cx, y: cy - 12, r: 9, c: `rgba(120,180,255,${0.08 + z * 0.07})` });
      break;
    }
    case 'solar': {
      ctx.fillStyle = '#b0a880'; diamondPath(ctx, cx, cy, 0.94, 0.94); ctx.fill();
      for (const [dx, dy] of [[-14, -4], [2, -10], [-4, 4], [12, 0]]) {
        ctx.fillStyle = '#26418f';
        ctx.beginPath(); ctx.moveTo(cx + dx - 9, cy + dy); ctx.lineTo(cx + dx + 9, cy + dy - 5); ctx.lineTo(cx + dx + 9, cy + dy - 9); ctx.lineTo(cx + dx - 9, cy + dy - 4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(cx + dx - 4, cy + dy - 1); ctx.lineTo(cx + dx + 5, cy + dy - 6); ctx.stroke();
      }
      break;
    }
    case 'busstand': {
      ctx.fillStyle = '#b0a880'; diamondPath(ctx, cx, cy, 0.96, 0.96); ctx.fill();
      // shelter
      ctx.fillStyle = '#0277bd';
      ctx.beginPath(); ctx.moveTo(cx - 16, cy - 18); ctx.lineTo(cx + 14, cy - 22); ctx.lineTo(cx + 14, cy - 17); ctx.lineTo(cx - 16, cy - 13); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#455a64'; ctx.beginPath(); ctx.moveTo(cx - 14, cy - 15); ctx.lineTo(cx - 14, cy + 2); ctx.moveTo(cx + 12, cy - 19); ctx.lineTo(cx + 12, cy + 2); ctx.stroke();
      // bus
      ctx.fillStyle = '#1565c0'; ctx.fillRect(cx + 2, cy + 2, 16, 7);
      ctx.fillStyle = '#ffd54f'; for (let i = 0; i < 3; i++) ctx.fillRect(cx + 4 + i * 4.5, cy + 3.5, 3, 3);
      break;
    }
    case 'mandir': {
      box(ctx, cx, cy, 0.8, 0.8, 12, '#e8c87a', { edge: '#a97f4a' });
      // plinth steps
      ctx.fillStyle = '#d9b268';
      diamondPath(ctx, cx, cy + 3, 0.94, 0.94); ctx.fill();
      // shikhara: stacked, ribbed tiers
      let wy = cy - 12, ww = 22;
      const skc = { gold: ['#d4a017', '#c96f2f'], white: ['#fafafa', '#c9b28a'], terracotta: ['#c96f2f', '#a35d3f'] }[K.shikhara] || ['#d4a017', '#c96f2f'];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = skc[i % 2];
        ctx.beginPath(); ctx.moveTo(cx, wy - ww * 0.42); ctx.lineTo(cx + ww * 0.55, wy); ctx.lineTo(cx, wy + ww * 0.42); ctx.lineTo(cx - ww * 0.55, wy); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(60,36,10,.3)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(cx - ww * 0.55, wy); ctx.lineTo(cx + ww * 0.55, wy); ctx.stroke();
        wy -= 7; ww *= 0.72;
      }
      ctx.fillStyle = '#d4a017'; ctx.beginPath(); ctx.arc(cx, wy - 2, 2.2, 0, 7); ctx.fill(); // kalash
      ctx.strokeStyle = '#7c4a03'; ctx.beginPath(); ctx.moveTo(cx, wy - 2); ctx.lineTo(cx, wy - 14); ctx.stroke();
      flagTri(ctx, cx, wy - 14, 9, 8, P.saffron, o.t, o.seed);
      doorArch(ctx, cx - 4, cy - 2, 8, 9, '#7c4a03');
      // brass bell hanging from the eave
      ctx.strokeStyle = '#7c4a03'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(cx - 14, cy - 14); ctx.lineTo(cx - 14, cy - 9); ctx.stroke();
      ctx.fillStyle = '#d4a017'; ctx.beginPath(); ctx.arc(cx - 14, cy - 8, 1.6, 0, 7); ctx.fill();
      if (lit) { pushLight({ x: cx, y: cy - 4, r: 18, c: 'rgba(255,170,60,.2)' }); }
      break;
    }
    case 'masjid': {
      const t = box(ctx, cx, cy, 0.82, 0.82, 14, '#e8f5e9', { edge: '#81a68a' });
      const dc = KNOBS.masjid.dome.colors[K.dome] || '#1b5e20';
      dome(ctx, cx, t.y - 2, 9, dc);
      // minaret
      ctx.fillStyle = '#e8f5e9'; ctx.fillRect(cx + 16, cy - 34, 4.5, 26);
      dome(ctx, cx + 18.2, cy - 36, 3.4, dc);
      // crescent
      ctx.fillStyle = '#d4a017';
      ctx.beginPath(); ctx.arc(cx + 18.2, cy - 42, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8f5e9'; ctx.beginPath(); ctx.arc(cx + 19.4, cy - 42.8, 2.4, 0, 7); ctx.fill();
      archRow(ctx, cx - 14, cy - 6, 28, 3, dc);
      if (lit) pushLight({ x: cx, y: cy - 10, r: 16, c: 'rgba(140,220,160,.15)' });
      break;
    }
    case 'gurudwara': {
      const t = box(ctx, cx, cy, 0.84, 0.84, 15, '#fafafa', { edge: '#c9b28a' });
      const gd = KNOBS.gurudwara.dome.colors[K.dome] || '#d4a017';
      dome(ctx, cx, t.y - 2, 8.5, gd);
      ctx.fillStyle = '#fafafa'; ctx.fillRect(cx - 20, cy - 38, 4, 26);
      dome(ctx, cx - 18, cy - 40, 3, gd);
      // nishan sahib
      ctx.fillStyle = '#9e9e9e'; ctx.fillRect(cx + 15, cy - 40, 2.4, 30);
      ctx.fillStyle = '#e8850c';
      ctx.beginPath(); ctx.moveTo(cx + 17.4, cy - 40); ctx.lineTo(cx + 17.4, cy - 28); ctx.lineTo(cx + 28, cy - 34); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#1a237e'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx + 21, cy - 34, 2.6, 0, 7); ctx.stroke();
      archRow(ctx, cx - 14, cy - 6, 28, 3, '#b08040');
      if (lit) pushLight({ x: cx, y: cy - 12, r: 16, c: 'rgba(255,200,100,.16)' });
      break;
    }
    case 'church': {
      const t = box(ctx, cx, cy, 0.78, 0.78, 15, '#f5f0ea', { edge: '#b8a78d' });
      // steeple
      ctx.fillStyle = '#f5f0ea'; ctx.fillRect(cx + 12, cy - 34, 6, 22);
      ctx.fillStyle = '#78909c';
      ctx.beginPath(); ctx.moveTo(cx + 9, cy - 34); ctx.lineTo(cx + 15, cy - 44); ctx.lineTo(cx + 21, cy - 34); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(cx + 15, cy - 44); ctx.lineTo(cx + 15, cy - 50); ctx.moveTo(cx + 11.5, cy - 47); ctx.lineTo(cx + 18.5, cy - 47); ctx.stroke();
      archRow(ctx, cx - 12, cy - 6, 20, 2, '#5b4630');
      windowRow(ctx, cx - 16, cy - 16, 14, 2, lit);
      if (lit) pushLight({ x: cx, y: cy - 10, r: 15, c: 'rgba(255,240,200,.15)' });
      break;
    }
    case 'park': {
      ctx.fillStyle = '#54994a'; diamondPath(ctx, cx, cy, 0.97, 0.97); ctx.fill();
      // winding path
      ctx.strokeStyle = 'rgba(226,212,178,.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 20, cy + 6); ctx.quadraticCurveTo(cx, cy - 2, cx + 18, cy + 4); ctx.stroke();
      // peepal tree
      ctx.fillStyle = 'rgba(30,22,10,.16)';
      ctx.beginPath(); ctx.ellipse(cx - 2, cy - 1, 9, 3.4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6d4c35'; ctx.fillRect(cx - 3.4, cy - 14, 3.8, 13);
      ctx.fillStyle = '#256b28';
      ctx.beginPath(); ctx.arc(cx - 7, cy - 16, 7.6, 0, 7); ctx.arc(cx + 4, cy - 18, 6.8, 0, 7); ctx.fill();
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath(); ctx.arc(cx - 1, cy - 22, 6.4, 0, 7); ctx.arc(cx + 6, cy - 20, 4.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#43a047';
      ctx.beginPath(); ctx.arc(cx - 4, cy - 24, 3.4, 0, 7); ctx.fill();
      // swing
      ctx.strokeStyle = '#6d4c41';
      ctx.beginPath(); ctx.moveTo(cx + 12, cy + 2); ctx.lineTo(cx + 12, cy - 10); ctx.moveTo(cx + 18, cy - 2); ctx.lineTo(cx + 18, cy - 10); ctx.moveTo(cx + 10, cy - 10); ctx.lineTo(cx + 20, cy - 10); ctx.stroke();
      ctx.strokeStyle = 'rgba(90,60,40,.5)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(cx + 13, cy - 10); ctx.lineTo(cx + 13, cy - 5); ctx.moveTo(cx + 17, cy - 10); ctx.lineTo(cx + 17, cy - 5); ctx.stroke();
      ctx.fillStyle = '#8d6e53'; ctx.fillRect(cx + 12, cy - 5, 6, 1.6);
      // flowerbed
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = ['#e57373', '#ffb74d', '#f06292', '#ba68c8'][i];
        ctx.beginPath(); ctx.arc(cx + 16 - i * 2.6, cy + 9 - (i % 2) * 2, 1.3, 0, 7); ctx.fill();
      }
      break;
    }
    case 'maidan': {
      ctx.fillStyle = '#5d9c4c'; diamondPath(ctx, cx, cy, 0.97, 0.97); ctx.fill();
      // pitch
      ctx.fillStyle = '#c9b28a';
      ctx.beginPath(); ctx.moveTo(cx - 6, cy - 6); ctx.lineTo(cx + 6, cy - 12); ctx.lineTo(cx + 6, cy - 6); ctx.lineTo(cx - 6, cy); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#f5f5f5'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx + 1, cy - 9); ctx.lineTo(cx + 1, cy - 13); ctx.moveTo(cx + 3, cy - 8.4); ctx.lineTo(cx + 3, cy - 12.6); ctx.moveTo(cx + 5, cy - 7.8); ctx.lineTo(cx + 5, cy - 12); ctx.stroke();
      // boundary chalk
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1;
      diamondPath(ctx, cx, cy, 0.7, 0.7); ctx.stroke();
      break;
    }
    case 'mela': {
      ctx.fillStyle = '#cdbb92'; diamondPath(ctx, cx, cy, 0.96, 0.96); ctx.fill();
      // ferris wheel (animated)
      const fx = cx - 2, fy = cy - 26, r = 15;
      ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(fx - 8, cy + 2); ctx.lineTo(fx, fy); ctx.lineTo(fx + 8, cy + 2); ctx.stroke();
      const rot = o.t * 0.8;
      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(fx, fy, r, 0, 7); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = rot + (i / 8) * Math.PI * 2;
        const px = fx + Math.cos(a) * r, py = fy + Math.sin(a) * r;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(px, py); ctx.stroke();
        const cols = ['#d81b60', '#f57f17', '#00897b', '#7b1fa2'];
        ctx.fillStyle = cols[i % 4];
        ctx.beginPath(); ctx.arc(px, py + 2, 2.4, 0, 7); ctx.fill();
      }
      // stalls
      for (const [dx, dy, c] of [[14, 2, '#e8850c'], [-18, 4, '#c62828']]) {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(cx + dx, cy + dy - 9); ctx.lineTo(cx + dx + 8, cy + dy - 4); ctx.lineTo(cx + dx, cy + dy + 1); ctx.lineTo(cx + dx - 8, cy + dy - 4); ctx.closePath(); ctx.fill();
      }
      if (lit) pushLight({ x: fx, y: fy, r: 26, c: 'rgba(255,180,120,.2)' });
      break;
    }
    case 'kiln': {
      box(ctx, cx, cy, 0.6, 0.6, 8, '#b3552e', { topLight: 0.9 });
      ctx.fillStyle = '#8d4a24';
      ctx.beginPath(); ctx.ellipse(cx, cy - 16, 10, 12, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#5d3a1a'; ctx.beginPath(); ctx.ellipse(cx, cy - 26, 3, 4.5, 0, 0, 7); ctx.fill();
      smoke(ctx, cx, cy - 30, o.t, o.seed);
      // brick stacks
      ctx.fillStyle = '#c96f2f'; ctx.fillRect(cx + 10, cy + 2, 8, 3); ctx.fillRect(cx + 12, cy - 1, 8, 3);
      break;
    }
    case 'factory': {
      const t = box(ctx, cx, cy, 0.9, 0.9, 18, '#b0bec5', { edge: '#78909c' });
      // sawtooth roof
      ctx.fillStyle = '#90a4ae';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(cx - 18 + i * 13, t.y + 6); ctx.lineTo(cx - 11 + i * 13, t.y - 3); ctx.lineTo(cx - 4 + i * 13, t.y + 6); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#78909c'; ctx.fillRect(cx + 14, cy - 34, 5, 18);
      smoke(ctx, cx + 16.5, cy - 34, o.t, o.seed);
      windowRow(ctx, cx - 16, cy - 8, 30, 4, lit);
      break;
    }
    case 'textile': {
      const t = box(ctx, cx, cy, 0.95, 0.8, 22, '#c85a54', { edge: '#8a3a36' });
      for (let f = 0; f < 2; f++) windowRow(ctx, cx - 22, cy - 8 - f * 11, 44, 5, lit);
      ctx.fillStyle = '#78909c'; ctx.fillRect(cx + 18, cy - 38, 5, 20);
      smoke(ctx, cx + 20.5, cy - 38, o.t, o.seed + 2);
      signBoard(ctx, cx, cy - 27, 22, 'MILL', '#ffd54f', '#5d2a2a');
      break;
    }
    case 'chawl': {
      // long two-storey row with a shared courtyard in front
      box(ctx, cx, cy - 4, 0.95, 0.5, 24, '#d9c9a3', { edge: '#b8a67e' });
      box(ctx, cx, cy + 10, 0.95, 0.34, 16, '#e0d2ae', { edge: '#b8a67e' });
      windowRow(ctx, cx - 24, cy - 12, 20, 4, lit);
      windowRow(ctx, cx + 2, cy - 12, 20, 4, lit);
      windowRow(ctx, cx - 14, cy + 4, 28, 5, lit);
      doorArch(ctx, cx - 20, cy + 7, 5, 5, '#5b4630');
      doorArch(ctx, cx - 6, cy + 8, 5, 5, '#5b4630');
      doorArch(ctx, cx + 8, cy + 7, 5, 5, '#5b4630');
      // stair tower + rooftop tank
      ctx.fillStyle = '#c96f2f'; ctx.fillRect(cx + 26, cy - 30, 6, 24);
      ctx.fillStyle = '#37474f'; ctx.fillRect(cx + 25, cy - 33, 8, 4);
      // drying clothes across the courtyard (knob)
      const wc = (KNOBS.chawl && KNOBS.chawl.wash.colors[K.wash]) || '#d81b60';
      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(cx - 20, cy + 2); ctx.quadraticCurveTo(cx, cy + 5, cx + 20, cy + 2); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? wc : hexShade(wc, 0.75);
        ctx.fillRect(cx - 18 + i * 6.4, cy + 3, 3.4, 4.2);
      }
      break;
    }
    case 'villa': {
      // compound lawn + modern flat-roof house + porch/garden knob
      ctx.fillStyle = '#8fbb84'; diamondPath(ctx, cx, cy, 0.98, 0.98); ctx.fill();
      // driveway strip to the street
      ctx.fillStyle = 'rgba(210,205,195,.8)';
      ctx.beginPath(); ctx.moveTo(cx + 2, cy + 12); ctx.lineTo(cx + 8, cy + 9); ctx.lineTo(cx + 12, cy + 3); ctx.lineTo(cx + 6, cy + 6); ctx.closePath(); ctx.fill();
      const t = box(ctx, cx - 3, cy - 3, 0.58, 0.5, 15, (KNOBS.villa && KNOBS.villa.paint.colors[K.paint]) || '#f5efe0', { edge: '#c9b28a' });
      ctx.fillStyle = '#90a4ae'; // parapet rim
      ctx.fillRect(cx - 20, t.y - 2.4, 40, 2.2);
      // glass balcony band
      ctx.fillStyle = '#b3e5fc'; ctx.fillRect(cx - 14, cy - 12, 22, 5);
      ctx.strokeStyle = '#78909c'; ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - 14 + i * 7, cy - 12); ctx.lineTo(cx - 14 + i * 7, cy - 7); ctx.stroke(); }
      // porch: parked car or flower garden
      if (K.porch === 'car') {
        ctx.fillStyle = '#c62828'; roundRectPath(ctx, cx + 8, cy + 4, 14, 5, 2); ctx.fill();
        ctx.fillStyle = '#b3e5fc'; ctx.fillRect(cx + 11, cy + 2.2, 8, 3);
        ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(cx + 11, cy + 9.4, 1.7, 0, 7); ctx.arc(cx + 19, cy + 9.4, 1.7, 0, 7); ctx.fill();
      } else {
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = ['#e57373', '#ffb74d', '#f06292', '#ba68c8', '#ffd54f'][i];
          ctx.beginPath(); ctx.arc(cx + 6 + i * 3.6, cy + 6 - (i % 2), 1.5, 0, 7); ctx.fill();
        }
      }
      // brass name plate at the gate
      ctx.fillStyle = '#d4a017'; roundRectPath(ctx, cx - 22, cy + 4, 8, 3.4, 1); ctx.fill();
      windowRow(ctx, cx - 12, cy - 8, 12, 2, lit);
      if (lit) pushLight({ x: cx - 18, y: cy + 2, r: 9, c: 'rgba(255,215,120,.25)' });
      break;
    }
    case 'office': {
      // glass-fronted company office with boarded nameplate
      const glass = (KNOBS.office && KNOBS.office.glass.colors[K.glass]) || '#7fb8d8';
      box(ctx, cx, cy, 0.84, 0.84, 30, '#e8ecef', { edge: '#b0bec5' });
      // curtain-glass bands on both faces + a diagonal reflection streak
      ctx.fillStyle = glass;
      for (let f = 0; f < 3; f++) {
        const yb = cy - 4 - f * 9;
        ctx.fillRect(cx - 22, yb - 5, 20, 6);
        ctx.fillRect(cx + 2, yb - 9, 20, 6);
      }
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.moveTo(cx - 20, cy - 3); ctx.lineTo(cx - 12, cy - 3); ctx.lineTo(cx - 4, cy - 27); ctx.lineTo(cx - 12, cy - 27); ctx.closePath(); ctx.fill();
      // ground canopy + company board
      ctx.fillStyle = '#37474f'; ctx.fillRect(cx - 12, cy + 6, 24, 2.2);
      signBoard(ctx, cx, cy - 1, 32, 'PVT · LTD · CO', '#7fe3a0', '#101820');
      if (lit) pushLight({ x: cx, y: cy - 2, r: 22, c: 'rgba(140,220,255,.16)' });
      break;
    }
    case 'tower': {
      // corporate tower: glass stripes, crown knob, beacon spire
      const crown = (KNOBS.tower && KNOBS.tower.crown.colors[K.crown]) || '#ff8f00';
      const hw = (TW / 2) * 0.72, hh = (TH / 2) * 0.72, H = 64;
      box(ctx, cx, cy, 0.72, 0.72, H, '#cfd8dc', { edge: '#90a4ae' });
      // glass stripes up both faces (parallelograms follow each face's slope)
      ctx.fillStyle = '#8fb8d0';
      for (let i = 0; i < 3; i++) {
        const fx = cx - hw + 4 + i * (hw * 0.62), gx = cx + 4 + i * (hw * 0.62);
        const fy = cy + (fx - (cx - hw)) * 0.5, gy = cy + hh - (gx - cx) * 0.5;
        ctx.beginPath(); // left face stripe
        ctx.moveTo(fx, fy); ctx.lineTo(fx + 5, fy + 2.5);
        ctx.lineTo(fx + 5, fy + 2.5 - H + 6); ctx.lineTo(fx, fy - H + 6);
        ctx.closePath(); ctx.fill();
        ctx.beginPath(); // right face stripe
        ctx.moveTo(gx, gy); ctx.lineTo(gx + 5, gy - 2.5);
        ctx.lineTo(gx + 5, gy - 2.5 - H + 6); ctx.lineTo(gx, gy - H + 6);
        ctx.closePath(); ctx.fill();
      }
      // crown band + spire
      ctx.fillStyle = crown; ctx.fillRect(cx - hw + 2, cy - hh - H + 1, hw * 1.7, 3);
      if (lit) pushLight({ x: cx, y: cy - hh - H, r: 26, c: 'rgba(255,170,80,.20)' });
      ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx, cy - hh - H); ctx.lineTo(cx, cy - hh - H - 12); ctx.stroke();
      const blink = Math.sin(o.t * 4) > 0.2;
      ctx.fillStyle = blink ? '#ff5252' : '#5c1a1a';
      ctx.beginPath(); ctx.arc(cx, cy - hh - H - 13, 1.6, 0, 7); ctx.fill();
      // podium
      box(ctx, cx, cy + hh * 0.55, 0.96, 0.4, 7, '#b0bec5', { edge: '#90a4ae' });
      break;
    }
    case 'hotel': {
      const bc = (KNOBS.hotel && KNOBS.hotel.board.colors[K.board]) || '#d4a017';
      box(ctx, cx, cy, 0.8, 0.8, 36, '#efe6d8', { edge: '#cbb89a' });
      for (let f = 0; f < 4; f++) {
        windowRow(ctx, cx - 20, cy - 8 - f * 8.4, 16, 2, lit);
        windowRow(ctx, cx + 4, cy - 8 - f * 8.4, 16, 2, lit);
      }
      // portico + sign board
      ctx.fillStyle = '#8d6e63'; ctx.fillRect(cx - 10, cy + 8, 20, 2);
      signBoard(ctx, cx, cy + 3, 28, 'HOTEL', bc, '#101820');
      tankOnStilts(ctx, cx + 16, cy - 40, 1.1); // rooftop tank
      if (lit) pushLight({ x: cx, y: cy + 2, r: 20, c: 'rgba(255,200,120,.18)' });
      break;
    }
    case 'mall': {
      const sc = { magenta: '#e91e63', saffron: '#ff8f00', teal: '#00897b' }[K.signage] || '#e91e63';
      box(ctx, cx, cy, 0.98, 0.86, 22, '#eceff1', { edge: '#b0bec5' });
      // glass atrium + signage band
      ctx.fillStyle = '#b3e5fc'; ctx.fillRect(cx - 26, cy - 4, 52, 8);
      ctx.fillStyle = '#78909c'; for (let i = 0; i < 8; i++) ctx.fillRect(cx - 25 + i * 7, cy - 4, 1.2, 8);
      ctx.fillStyle = sc; ctx.fillRect(cx - 26, cy - 12, 52, 5);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 5.4px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('MALL', cx, cy - 8);
      windowRow(ctx, cx - 20, cy - 18, 40, 5, lit);
      // food-court dome + AC units
      dome(ctx, cx + 16, cy - 22, 5, '#ffb74d');
      acBox(ctx, cx - 18, cy - 24, 1.1); acBox(ctx, cx - 6, cy - 24, 1.1);
      if (lit) pushLight({ x: cx, y: cy - 10, r: 26, c: 'rgba(255,140,190,.18)' });
      break;
    }
    case 'petrol': {
      const cc = (KNOBS.petrol && KNOBS.petrol.canopy.colors[K.canopy]) || '#c62828';
      // forecourt
      ctx.fillStyle = '#c8d2cc'; diamondPath(ctx, cx, cy, 0.98, 0.98); ctx.fill();
      // canopy pillars + slab
      ctx.fillStyle = '#90a4ae'; ctx.fillRect(cx - 14, cy - 12, 2.4, 12); ctx.fillRect(cx + 12, cy - 12, 2.4, 12);
      ctx.fillStyle = cc;
      ctx.beginPath(); ctx.moveTo(cx - 24, cy - 12); ctx.lineTo(cx, cy - 20); ctx.lineTo(cx + 24, cy - 12); ctx.lineTo(cx, cy - 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = hexShade(cc, 0.75); ctx.beginPath(); ctx.moveTo(cx - 24, cy - 12); ctx.lineTo(cx, cy - 20); ctx.lineTo(cx, cy - 17.4); ctx.lineTo(cx - 24, cy - 9.6); ctx.closePath(); ctx.fill();
      // pumps + price pole
      ctx.fillStyle = '#37474f'; ctx.fillRect(cx - 8, cy - 4, 4, 5); ctx.fillRect(cx + 5, cy - 4, 4, 5);
      ctx.fillStyle = '#eceff1'; ctx.fillRect(cx - 7, cy - 3, 2, 2); ctx.fillRect(cx + 6, cy - 3, 2, 2);
      ctx.strokeStyle = '#607d8b'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cx + 22, cy + 6); ctx.lineTo(cx + 22, cy - 16); ctx.stroke();
      ctx.fillStyle = '#101820'; ctx.fillRect(cx + 19, cy - 21, 6.4, 5);
      ctx.fillStyle = '#ffd54f'; ctx.font = 'bold 3.4px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('₹/L', cx + 22.2, cy - 17.4);
      if (lit) pushLight({ x: cx, y: cy - 14, r: 22, c: 'rgba(255,240,190,.20)' });
      break;
    }
    case 'road': {
      // v5 street art: asphalt, kerbs, direction-aware lane dashes, zebra
      // studs where lanes meet. o.roads = {n,e,s,w} comes from render.js.
      const rd = o.roads || { n: true, s: true, e: false, w: false };
      ctx.fillStyle = P.road;
      diamondPath(ctx, cx, cy, 0.99, 0.99); ctx.fill();
      // worn inner patch
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      diamondPath(ctx, cx, cy - 0.8, 0.78, 0.78); ctx.fill();
      // pale kerb along the two far rims
      ctx.strokeStyle = 'rgba(216,221,229,.5)'; ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx - TW / 2 * 0.99, cy);
      ctx.lineTo(cx, cy - TH / 2 * 0.99);
      ctx.lineTo(cx + TW / 2 * 0.99, cy);
      ctx.stroke();
      const rot = o.rot || 0;
      const nRoads = (rd.n ? 1 : 0) + (rd.s ? 1 : 0) + (rd.e ? 1 : 0) + (rd.w ? 1 : 0);
      if (nRoads >= 3) {
        // crossing: zebra studs on every arm
        ctx.fillStyle = 'rgba(245,240,225,.5)';
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const has = (dx === 0 && dy === -1 && rd.n) || (dx === 0 && dy === 1 && rd.s) ||
                      (dx === -1 && dy === 0 && rd.w) || (dx === 1 && dy === 0 && rd.e);
          if (!has) continue;
          const ang = Math.atan2((dx + dy) * 16, (dx - dy) * 32) + rot;
          const mx = cx + (dx - dy) * 11, my = cy + (dx + dy) * 5.5;
          ctx.save();
          ctx.translate(mx, my); ctx.rotate(ang);
          ctx.fillRect(2.2, -8, 3, 2.2); ctx.fillRect(2.2, -2.6, 3, 2.2); ctx.fillRect(2.2, 2.8, 3, 2.2);
          ctx.restore();
        }
      } else {
        // straight run: dashes down the lane axis
        const vert = rd.n || rd.s;
        const ang = Math.atan2(16, vert ? -32 : 32) + rot;
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(ang);
        ctx.fillStyle = 'rgba(240,226,180,.5)';
        ctx.fillRect(-13, -1, 6.5, 2); ctx.fillRect(-3.25, -1, 6.5, 2); ctx.fillRect(6.5, -1, 6.5, 2);
        // the odd manhole
        if ((o.seed % 11) === 0) {
          ctx.fillStyle = 'rgba(20,24,30,.5)';
          ctx.beginPath(); ctx.ellipse(4, -8, 2.6, 1.6, 0, 0, 7); ctx.fill();
        }
        ctx.restore();
      }
      break;
    }
    case 'bridge': {
      // stone deck with plank lines and railings along the avenue axis
      ctx.fillStyle = '#9a8a76'; diamondPath(ctx, cx, cy, 0.99, 0.99); ctx.fill();
      ctx.fillStyle = '#877663'; diamondPath(ctx, cx, cy - 1.5, 0.86, 0.86); ctx.fill();
      ctx.strokeStyle = 'rgba(60,48,36,.35)'; ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 11 - 10, cy + i * 5.5 - 2);
        ctx.lineTo(cx + i * 11 + 10, cy + i * 5.5 - 10);
        ctx.stroke();
      }
      const ang = Math.atan2(16, -32) + (o.rot || 0); // bridges carry the vertical avenues
      ctx.save();
      ctx.translate(cx, cy - 4); ctx.rotate(ang);
      ctx.strokeStyle = '#6d5c48'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-26, -9); ctx.lineTo(26, -9); ctx.moveTo(-26, 9); ctx.lineTo(26, 9); ctx.stroke();
      ctx.lineWidth = 1;
      for (const px of [-22, -11, 0, 11, 22]) {
        ctx.beginPath(); ctx.moveTo(px, -9); ctx.lineTo(px, 9); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = P.roadLine; ctx.fillRect(cx - 1.2, cy - 5, 2.4, 6);
      break;
    }
    case 'tree': drawTree(ctx, cx, cy, o.seed, o.season); break;
    case 'lamp': {
      ctx.strokeStyle = '#455a64'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy + 2); ctx.lineTo(cx, cy - 18); ctx.stroke();
      // cross-arm so the lamp reads at a distance
      ctx.beginPath(); ctx.moveTo(cx - 3.4, cy - 18); ctx.lineTo(cx + 3.4, cy - 18); ctx.stroke();
      ctx.fillStyle = night ? '#ffe082' : '#9fb2bd';
      ctx.beginPath(); ctx.arc(cx, cy - 20, 3, 0, 7); ctx.fill();
      if (night) pushLight({ x: cx, y: cy - 20, r: 26, c: 'rgba(255,220,130,.22)' });
      break;
    }
    case 'flag': {
      ctx.strokeStyle = '#455a64'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy + 2); ctx.lineTo(cx, cy - 26); ctx.stroke();
      ctx.fillStyle = '#d4a017'; ctx.beginPath(); ctx.arc(cx, cy - 27, 1.8, 0, 7); ctx.fill();
      tricolor(ctx, cx, cy - 26, 13, 9, o.t, o.seed);
      break;
    }
  }
}

export function drawTree(ctx, cx, cy, seed, season) {
  const r = ((seed * 13.7) % 1) * 0.3 + 0.85;
  // ground shadow
  ctx.fillStyle = 'rgba(30,22,10,.16)';
  ctx.beginPath(); ctx.ellipse(cx + 2, cy + 1, 8 * r, 3.2 * r, 0, 0, 7); ctx.fill();
  // tapered trunk
  ctx.fillStyle = '#6d4c35';
  ctx.beginPath();
  ctx.moveTo(cx - 1.7, cy);
  ctx.quadraticCurveTo(cx - 1.1, cy - 6 * r, cx - 2.4, cy - 11 * r);
  ctx.lineTo(cx + 1.3, cy - 11 * r);
  ctx.quadraticCurveTo(cx + 1.5, cy - 5 * r, cx + 2.3, cy);
  ctx.closePath(); ctx.fill();
  // canopy: dark under-layer, mid mass, sun-lit crown
  const winter = season === 'winter';
  ctx.fillStyle = winter ? '#5f7142' : '#256b28';
  ctx.beginPath(); ctx.arc(cx - 5.5 * r, cy - 10 * r, 6.4 * r, 0, 7); ctx.arc(cx + 5 * r, cy - 11 * r, 6 * r, 0, 7); ctx.fill();
  ctx.fillStyle = winter ? '#7d8f56' : '#2e7d32';
  ctx.beginPath(); ctx.arc(cx - 2 * r, cy - 14 * r, 7.2 * r, 0, 7); ctx.arc(cx + 4.5 * r, cy - 15.5 * r, 5.6 * r, 0, 7); ctx.fill();
  ctx.fillStyle = winter ? '#93a468' : '#43a047';
  ctx.beginPath(); ctx.arc(cx - 1 * r, cy - 17.5 * r, 4.6 * r, 0, 7); ctx.arc(cx + 5.5 * r, cy - 18 * r, 3.4 * r, 0, 7); ctx.fill();
}

function drawMiniCow(ctx, x, y, t, seed) {
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath(); ctx.ellipse(x, y - 4, 7, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#616161';
  ctx.beginPath(); ctx.ellipse(x + 3, y - 5, 3, 2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#eceff1';
  ctx.beginPath(); ctx.ellipse(x - 7, y - 6, 3.4, 3, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#bdbdbd'; ctx.lineWidth = 1.2;
  for (const dx of [-5, 5]) { ctx.beginPath(); ctx.moveTo(x + dx, y - 1); ctx.lineTo(x + dx, y + 2); ctx.stroke(); }
}

// ================= AGENTS =================
export function drawPerson(ctx, x, y, a, t) {
  const bob = Math.abs(Math.sin(t * 9 + a.ph)) * 1.2;
  const s = a.scale || 1;
  ctx.save();
  ctx.translate(x, y);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.ellipse(0, 0.5, 3.6 * s, 1.6 * s, 0, 0, 7); ctx.fill();
  const skin = P.skin[a.skin];
  const legSw = Math.sin(t * 9 + a.ph) * 2 * s;
  ctx.strokeStyle = '#3e3128'; ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(-1.4 * s, -4 * s); ctx.lineTo(-1.4 * s + legSw, 0);
  ctx.moveTo(1.4 * s, -4 * s); ctx.lineTo(1.4 * s - legSw, 0);
  ctx.stroke();
  const oy = -4 * s - bob;
  switch (a.type) {
    case 'saree': {
      ctx.fillStyle = a.col;
      ctx.beginPath();
      ctx.moveTo(-2.6 * s, oy); ctx.lineTo(2.6 * s, oy); ctx.lineTo(1.8 * s, oy - 6 * s); ctx.lineTo(-1.8 * s, oy - 6 * s);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = a.col; ctx.lineWidth = 1.4 * s;
      ctx.beginPath(); ctx.moveTo(1.2 * s, oy - 6 * s); ctx.quadraticCurveTo(3 * s, oy - 2 * s, 0.5 * s, oy); ctx.stroke();
      break;
    }
    case 'kurta': case 'dhoti': {
      ctx.fillStyle = a.col;
      ctx.fillRect(-1.9 * s, oy - 6 * s, 3.8 * s, 5.4 * s);
      ctx.strokeStyle = a.type === 'dhoti' ? '#e8e0d0' : '#4e4034'; ctx.lineWidth = 1.5 * s;
      break;
    }
    case 'salwar': {
      ctx.fillStyle = a.col;
      ctx.fillRect(-2 * s, oy - 6 * s, 4 * s, 4.4 * s);
      ctx.fillStyle = hexShade(a.col, 0.7);
      ctx.fillRect(-2 * s, oy - 2.4 * s, 4 * s, 1.8 * s);
      break;
    }
    case 'lungi': {
      ctx.fillStyle = a.col; ctx.fillRect(-2.2 * s, oy - 4.6 * s, 4.4 * s, 4.6 * s);
      ctx.fillStyle = hexShade(a.col, 1.2); ctx.fillRect(-2.2 * s, oy - 1.4 * s, 4.4 * s, 1);
      ctx.fillStyle = a.col; ctx.fillRect(-1.8 * s, oy - 6.4 * s, 3.6 * s, 2.2 * s);
      break;
    }
    case 'turban': case 'kurta-turban': {
      ctx.fillStyle = a.col2 || '#f5f5f5';
      ctx.fillRect(-1.9 * s, oy - 6 * s, 3.8 * s, 5.4 * s);
      break;
    }
    case 'school': {
      ctx.fillStyle = a.col; ctx.fillRect(-1.8 * s, oy - 5.6 * s, 3.6 * s, 5 * s);
      ctx.fillStyle = '#5d4037'; ctx.fillRect(-2.6 * s, oy - 5 * s, 1.4 * s, 2 * s); // satchel
      break;
    }
  }
  // head
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, oy - 7.6 * s, 1.9 * s, 0, 7); ctx.fill();
  if (a.type === 'turban' || a.type === 'kurta-turban') {
    ctx.fillStyle = a.col;
    ctx.beginPath(); ctx.arc(0, oy - 8.4 * s, 2 * s, Math.PI, 0); ctx.fill();
  } else if (a.type === 'saree' || a.type === 'salwar') {
    ctx.strokeStyle = a.col; ctx.lineWidth = 1 * s;
    ctx.beginPath(); ctx.arc(0, oy - 7.6 * s, 2.1 * s, Math.PI * 1.15, Math.PI * 1.95); ctx.stroke();
  } else {
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(0, oy - 8.3 * s, 1.8 * s, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  }
  // pot carrier
  if (a.pot) {
    ctx.fillStyle = '#b3552e';
    ctx.beginPath(); ctx.ellipse(0, oy - 10.6 * s, 2.2 * s, 1.7 * s, 0, 0, 7); ctx.fill();
  }
  // holi colour dust
  if (a.holi) {
    ctx.fillStyle = a.holi;
    ctx.beginPath(); ctx.arc(-1.5 * s, oy - 4 * s, 1.3 * s, 0, 7); ctx.fill();
  }
  ctx.restore();
}

export function drawCow(ctx, x, y, t, seed) {
  const bob = Math.sin(t * 2 + seed) * 0.4;
  ctx.save(); ctx.translate(x, y + bob);
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 3, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#c9b28a'; ctx.lineWidth = 1.6;
  for (const dx of [-5, -2, 3, 6]) { ctx.beginPath(); ctx.moveTo(dx, -5); ctx.lineTo(dx, 0); ctx.stroke(); }
  ctx.fillStyle = '#f5f5f0';
  ctx.beginPath(); ctx.ellipse(0, -7, 8.5, 4.4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#8d8d86';
  ctx.beginPath(); ctx.ellipse(3, -8, 3.4, 2.2, 0.4, 0, 7); ctx.fill();
  // hump + head
  ctx.fillStyle = '#f0efe8';
  ctx.beginPath(); ctx.ellipse(-2, -11, 3.4, 2.6, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-9, -9, 3.2, 2.6, -0.3, 0, 7); ctx.fill();
  ctx.fillStyle = '#e0e0d8';
  ctx.beginPath(); ctx.ellipse(-12, -7.6, 2, 1.6, 0, 0, 7); ctx.fill();
  // horns + ears
  ctx.strokeStyle = '#8d8d86'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-10, -11.4); ctx.lineTo(-11.4, -13.6); ctx.moveTo(-7.6, -11.6); ctx.lineTo(-6.8, -13.6); ctx.stroke();
  // tail
  ctx.beginPath(); ctx.moveTo(8.2, -8); ctx.quadraticCurveTo(10.5, -6, 10, -2.4); ctx.stroke();
  ctx.restore();
}

// v5 traffic: every vehicle is drawn NOSE TOWARD +x in local space; render.js
// rotates the sprite down its lane (screen angle incl. camera yaw) and offsets
// it to the right-hand side of the road, so two-way lanes actually read as
// two-way. Night lamps go through pushLight so they land at the true nose.
export function drawVehicle(ctx, x, y, v, t, night) {
  ctx.save();
  ctx.translate(x, y);
  const ca = Math.cos(v.ang || 0), sa = Math.sin(v.ang || 0);
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath(); ctx.ellipse(0, 1, 11, 3.4, 0, 0, 7); ctx.fill();
  switch (v.kind) {
    case 'auto': {
      // green body, yellow canopy, one headlamp — nose at +x
      ctx.fillStyle = '#1c1c1e';
      ctx.beginPath(); ctx.arc(6.4, 0, 2.3, 0, 7); ctx.arc(-5.6, 0, 2.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#1b5e20'; roundRectPath(ctx, -8, -8, 14.4, 7, 2.2); ctx.fill();
      ctx.fillStyle = '#fdd835';
      ctx.beginPath();
      ctx.moveTo(-8, -8); ctx.quadraticCurveTo(-1, -12.4, 6.4, -8.4); ctx.lineTo(6.4, -5); ctx.lineTo(-8, -5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#263238'; ctx.fillRect(2.2, -7.6, 3.4, 3); // windshield
      ctx.fillStyle = '#fdd835'; ctx.fillRect(-8, -5, 14.4, 1.2);
      if (night) pushLight({ x: ca * 8, y: sa * 8 - 4, r: 10, c: 'rgba(255,240,180,.25)' });
      break;
    }
    case 'bus': {
      ctx.fillStyle = '#263238';
      ctx.beginPath(); ctx.arc(9, 0, 2.6, 0, 7); ctx.arc(-8, 0, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#c62828'; roundRectPath(ctx, -14, -10, 28.4, 8.4, 2.4); ctx.fill();
      ctx.fillStyle = '#b71c1c'; ctx.fillRect(-14, -3.4, 28.4, 2);
      ctx.fillStyle = '#b3e5fc';
      for (let i = 0; i < 4; i++) ctx.fillRect(-12 + i * 6.4, -8.6, 4.4, 3.6);
      ctx.fillStyle = '#ffe082'; ctx.fillRect(12.4, -7.6, 1.8, 2.4); // headlamp
      if (night) pushLight({ x: ca * 15, y: sa * 15 - 4, r: 13, c: 'rgba(255,240,180,.25)' });
      break;
    }
    case 'truck': {
      ctx.fillStyle = '#263238';
      ctx.beginPath(); ctx.arc(-9, 0, 2.6, 0, 7); ctx.arc(8, 0, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8850c'; roundRectPath(ctx, -13, -11, 22, 9, 1.6); ctx.fill(); // cargo
      ctx.fillStyle = '#43a047'; roundRectPath(ctx, 9.4, -9, 6, 7, 1.4); ctx.fill();   // cab
      ctx.fillStyle = '#263238'; ctx.fillRect(11.4, -8, 2.4, 3); // windshield
      ctx.fillStyle = '#fff'; ctx.font = 'bold 4px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('HORN OK', -2, -7.4);
      ctx.fillStyle = '#d81b60'; ctx.fillText('PLEASE', -2, -3);
      if (night) pushLight({ x: ca * 16, y: sa * 16 - 4, r: 13, c: 'rgba(255,240,180,.25)' });
      break;
    }
    case 'cycle': {
      ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(4, -0.5, 2.6, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(-4, -0.5, 2.6, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, -0.5); ctx.lineTo(0, -6); ctx.lineTo(-4, -0.5); ctx.lineTo(4, -0.5); ctx.stroke();
      const ped = Math.sin(t * 8 + v.ph) * 1.4;
      ctx.fillStyle = v.riderCol || '#37474f';
      ctx.fillRect(-1.4, -11, 3, 4.4);
      ctx.fillStyle = '#8d5524';
      ctx.beginPath(); ctx.arc(0, -12, 1.8, 0, 7); ctx.fill();
      ctx.strokeStyle = '#3e3128'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(0, -6.6); ctx.lineTo(ped, -2); ctx.moveTo(0, -6.6); ctx.lineTo(-ped, -2); ctx.stroke();
      break;
    }
    case 'bullock': {
      // bull up front (+x), cart and driver behind
      ctx.fillStyle = '#263238';
      ctx.beginPath(); ctx.arc(2, 0, 3.4, 0, 7); ctx.arc(12, 0, 3.4, 0, 7); ctx.fill();
      ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(2, -1); ctx.lineTo(12, -1); ctx.stroke();
      ctx.fillStyle = '#a1887f'; ctx.fillRect(-6, -7, 14, 5);
      ctx.fillStyle = '#c96f2f'; ctx.fillRect(-4, -9.6, 10, 2.6);
      ctx.fillStyle = '#6d4c41';
      ctx.beginPath(); ctx.ellipse(-11, -6, 4.4, 3, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-15.4, -6.4, 2.4, 2, -0.4, 0, 7); ctx.fill();
      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(-14.4, -8.6); ctx.lineTo(-16.4, -11); ctx.moveTo(-11.6, -8.8); ctx.lineTo(-10.6, -11); ctx.stroke();
      ctx.fillStyle = '#8d5524'; ctx.beginPath(); ctx.arc(-8, -11, 1.7, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8850c'; ctx.fillRect(-9.4, -13.4, 2.8, 2.2);
      break;
    }
    case 'car': {
      // hatchback — the city's workhorse
      ctx.fillStyle = '#212121';
      ctx.beginPath(); ctx.arc(7, 0, 2.4, 0, 7); ctx.arc(-7, 0, 2.4, 0, 7); ctx.fill();
      ctx.fillStyle = v.bodyCol || '#c62828';
      roundRectPath(ctx, -11, -8, 22, 6.4, 2.2); ctx.fill();
      ctx.fillStyle = hexShade(v.bodyCol || '#c62828', 0.82);
      roundRectPath(ctx, -7, -12.4, 12.5, 5.4, 2); ctx.fill(); // cabin sits toward the rear
      ctx.fillStyle = '#b3e5fc'; ctx.fillRect(-5.4, -11.4, 4.4, 3.4); ctx.fillRect(0.2, -11.4, 4.4, 3.4);
      ctx.fillStyle = '#ffe082'; ctx.fillRect(9.6, -7.2, 1.6, 2); // headlamp
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-10, -7.6, 20, 1.1); // shoulder line
      if (night) pushLight({ x: ca * 12, y: sa * 12 - 4, r: 11, c: 'rgba(255,244,200,.28)' });
      break;
    }
    case 'taxi': {
      // kaali-peeli taxi
      ctx.fillStyle = '#212121';
      ctx.beginPath(); ctx.arc(7, 0, 2.4, 0, 7); ctx.arc(-7, 0, 2.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#fdd835'; roundRectPath(ctx, -11, -8, 22, 6.4, 2.2); ctx.fill();
      ctx.fillStyle = '#212121'; roundRectPath(ctx, -7, -12.4, 12.5, 5.4, 2); ctx.fill(); // black cabin
      ctx.fillStyle = '#b3e5fc'; ctx.fillRect(-5.4, -11.4, 4.4, 3.4); ctx.fillRect(0.2, -11.4, 4.4, 3.4);
      ctx.fillStyle = '#fdd835'; ctx.fillRect(-2.4, -13.4, 4.8, 1.6); // roof sign
      if (night) pushLight({ x: ca * 12, y: sa * 12 - 4, r: 11, c: 'rgba(255,244,200,.28)' });
      break;
    }
  }
  ctx.restore();
}

// ================= DOOR PLATES (Mahanagar ownership at the door) =================
// Drawn in SCREEN space by render.js, already translated to the tile base and
// scaled. v5 plate discipline: ACQUIRED stays a proud green nameplate with the
// owner's name; TO-LET becomes a small hanging card that whispers instead of
// shouting — the street keeps its hierarchy (buildings > roads > people > signs).
export function drawDoorPlate(ctx, x, y, info, t, night) {
  ctx.save();
  ctx.translate(x, y);
  const sway = Math.sin(t * 1.5 + x * 0.03) * 0.6; // a bit of breeze
  if (info.owned) {
    ctx.translate(sway, 0);
    // posts
    ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-9, -9); ctx.moveTo(9, 0); ctx.lineTo(9, -9); ctx.stroke();
    ctx.font = '700 5.5px Outfit, system-ui, sans-serif';
    const label = info.name || 'ACQUIRED';
    const bw = Math.max(26, ctx.measureText(label).width + 10);
    const bh = 13;
    const bx = -bw / 2, by = -9 - bh;
    ctx.fillStyle = 'rgba(19,42,26,.95)'; roundRectPath(ctx, bx, by, bw, bh, 2.2); ctx.fill();
    ctx.strokeStyle = '#d4a017'; ctx.lineWidth = 0.9; roundRectPath(ctx, bx + 1, by + 1, bw - 2, bh - 2, 1.6); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd54f'; ctx.font = '700 3px Outfit, system-ui, sans-serif';
    ctx.fillText('ACQUIRED', 0, by + 4.6);
    ctx.fillStyle = '#fff8e1'; ctx.font = '700 5.5px Outfit, system-ui, sans-serif';
    ctx.fillText(label, 0, by + 10.6);
    if (night) pushLight({ x: 0, y: by + bh / 2, r: 17, c: 'rgba(120,255,170,.16)' });
  } else {
    // small hanging TO-LET card on a short hook — quiet, half-size
    ctx.translate(sway * 0.7, 0);
    ctx.strokeStyle = '#6b5636'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -4.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -6.6); ctx.lineTo(0, -4.6); ctx.lineTo(6, -6.6); ctx.stroke();
    ctx.fillStyle = 'rgba(252,248,238,.94)';
    roundRectPath(ctx, -11, -15.4, 22, 9.4, 1.8); ctx.fill();
    ctx.strokeStyle = '#b3261e'; ctx.lineWidth = 0.9;
    roundRectPath(ctx, -10, -14.4, 20, 7.4, 1.4); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#b3261e';
    ctx.font = '800 4.6px Outfit, system-ui, sans-serif';
    ctx.fillText('TO-LET', 0, -10.6);
    if (night) pushLight({ x: 0, y: -11, r: 11, c: 'rgba(255,205,120,.12)' });
  }
  ctx.restore();
}
