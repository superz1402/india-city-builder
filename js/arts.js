// arts.js — the procedural Indian art kit. Every building, person, vehicle
// and cow is drawn with canvas paths; no image assets ship with the game.

import { TW, TH } from './iso.js';
import { KNOBS } from './data.js';

export const P = {
  skin: ['#8d5524', '#a9714b', '#c68642', '#7c4a2d'],
  saree: ['#d81b60', '#e8850c', '#7b1fa2', '#c62828', '#00897b', '#5d4037'],
  kurta: ['#f5f5f5', '#ffd54f', '#90caf9', '#a5d6a7'],
  roofTile: '#b3552e', wall: ['#e8d3b0', '#dcbf94', '#e6cfa5', '#d9c49a'],
  trim: '#7c4a03', green: '#2e7d32', darkGreen: '#1b5e20',
  water: '#4a90b8', waterDeep: '#3a6f92',
  road: '#4a423a', roadLine: '#e8d3b0',
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

// iso box: footprint fraction w,d of the tile, height H px. Returns top-center.
function box(ctx, cx, cy, w, d, H, color, opts = {}) {
  const hw = (TW / 2) * w, hh = (TH / 2) * d;
  const T = { x: cx, y: cy - hh }, R = { x: cx + hw, y: cy }, B = { x: cx, y: cy + hh }, L = { x: cx - hw, y: cy };
  // left face
  ctx.fillStyle = hexShade(color, 0.78);
  ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(B.x, B.y); ctx.lineTo(B.x, B.y - H); ctx.lineTo(L.x, L.y - H); ctx.closePath(); ctx.fill();
  // right face
  ctx.fillStyle = hexShade(color, 0.62);
  ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(R.x, R.y); ctx.lineTo(R.x, R.y - H); ctx.lineTo(B.x, B.y - H); ctx.closePath(); ctx.fill();
  // top face
  ctx.fillStyle = hexShade(color, opts.topLight || 1.06);
  ctx.beginPath(); ctx.moveTo(T.x, T.y - H); ctx.lineTo(R.x, R.y - H); ctx.lineTo(B.x, B.y - H); ctx.lineTo(L.x, L.y - H); ctx.closePath(); ctx.fill();
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

function windowRow(ctx, x0, y0, w, n, lit, gap = 4) {
  const ww = Math.min(7, (w - gap * (n - 1)) / n), wh = ww * 1.15;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = lit ? '#ffd166' : '#3d3630';
    ctx.fillRect(x0 + i * (ww + gap), y0 - wh, ww, wh);
  }
  if (lit) for (let i = 0; i < n; i++) pushLight({ x: x0 + i * (ww + gap) + ww / 2, y: y0 - wh / 2, r: 11, c: 'rgba(255,190,90,.20)' });
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
      box(ctx, cx, cy, 0.74, 0.74, 10, c, { topLight: 0.95 });
      ctx.fillStyle = 'rgba(30,30,35,.25)';
      diamondPath(ctx, cx, cy - 10, 0.8, 0.8); ctx.fill();
      ctx.strokeStyle = '#3b2f23'; ctx.beginPath(); ctx.moveTo(cx - 14, cy - 2); ctx.lineTo(cx - 14, cy - 22); ctx.stroke();
      flagTri(ctx, cx - 14, cy - 22, 9, 7, rng(2) > 0.5 ? '#d81b60' : '#4dd0e1', o.t, o.seed);
      break;
    }
    case 'kaccha': {
      box(ctx, cx, cy, 0.8, 0.8, 13, KNOBS.kaccha.wall.colors[K.wall] || P.wall[0]);
      // roof knob: thatch (original) or clay tile
      if (K.roof === 'tile') {
        ctx.fillStyle = '#b3552e';
        ctx.beginPath(); ctx.moveTo(cx, cy - 26); ctx.lineTo(cx + 24, cy - 10); ctx.lineTo(cx, cy - 2); ctx.lineTo(cx - 24, cy - 10); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#8a4b1d'; ctx.lineWidth = 1;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 9, cy - 24 + Math.abs(i) * 5); ctx.lineTo(cx + i * 9, cy - 9 + Math.abs(i) * 4); ctx.stroke(); }
      } else {
        ctx.fillStyle = '#b89044';
        ctx.beginPath(); ctx.moveTo(cx, cy - 26); ctx.lineTo(cx + 24, cy - 10); ctx.lineTo(cx, cy - 2); ctx.lineTo(cx - 24, cy - 10); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#8a6a2f'; ctx.lineWidth = 1;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 9, cy - 24 + Math.abs(i) * 5); ctx.lineTo(cx + i * 9, cy - 9 + Math.abs(i) * 4); ctx.stroke(); }
      }
      archRow(ctx, cx - 16, cy - 4, 12, 1, '#5b4630');
      break;
    }
    case 'pakka': {
      const t = box(ctx, cx, cy, 0.84, 0.84, 20, KNOBS.pakka.paint.colors[K.paint] || '#ddc7a2', { edge: '#b09b74' });
      ctx.fillStyle = '#c9b28a';
      ctx.beginPath(); ctx.moveTo(cx - 26, cy - 12); ctx.lineTo(cx, cy - 4); ctx.lineTo(cx + 26, cy - 12); ctx.lineTo(cx, cy - 20); ctx.closePath(); ctx.fill();
      windowRow(ctx, cx - 15, cy - 9, 30, 3, lit);
      windowRow(ctx, cx - 12, cy - 24, 24, 3, lit);
      // rooftop water tank (Sintex!)
      ctx.fillStyle = '#22262b'; ctx.fillRect(cx + 8, t.y - 8, 8, 7);
      ctx.fillStyle = '#39404a'; ctx.beginPath(); ctx.ellipse(cx + 12, t.y - 8, 4, 2, 0, 0, 7); ctx.fill();
      break;
    }
    case 'haveli': {
      const t = box(ctx, cx, cy, 0.92, 0.92, 22, KNOBS.haveli.stone.colors[K.stone] || '#e2c294', { edge: '#a97f4a' });
      archRow(ctx, cx - 26, cy - 8, 22, 2, '#7c4a03');
      archRow(ctx, cx + 4, cy - 8, 22, 2, '#7c4a03');
      archRow(ctx, cx - 16, cy - 26, 32, 3, '#7c4a03');
      dome(ctx, cx - 20, t.y - 4, 6, '#c96f2f'); dome(ctx, cx + 20, t.y - 4, 6, '#c96f2f');
      dome(ctx, cx, t.y - 8, 8, '#b3552e');
      break;
    }
    case 'bungalow': {
      box(ctx, cx, cy, 0.66, 0.66, 15, KNOBS.bungalow.paint.colors[K.paint] || '#f2e3c8', { edge: '#c9b28a' });
      ctx.fillStyle = K.roof === 'slate' ? '#5a6670' : '#b3552e';
      ctx.beginPath(); ctx.moveTo(cx - 22, cy - 15); ctx.lineTo(cx, cy - 30); ctx.lineTo(cx + 22, cy - 15); ctx.lineTo(cx, cy - 8); ctx.closePath(); ctx.fill();
      // garden
      ctx.fillStyle = '#2e7d32';
      diamondPath(ctx, cx + 20, cy + 2, 0.24, 0.24); ctx.fill();
      diamondPath(ctx, cx - 20, cy + 2, 0.24, 0.24); ctx.fill();
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx - 6, cy + 10); ctx.lineTo(cx + 6, cy + 10); ctx.stroke();
      windowRow(ctx, cx - 12, cy - 10, 24, 3, lit);
      break;
    }
    case 'flats': {
      const t = box(ctx, cx, cy, 0.8, 0.8, 46, KNOBS.flats.paint.colors[K.paint] || '#cfd8dc', { edge: '#90a4ae' });
      for (let f = 0; f < 4; f++) {
        windowRow(ctx, cx - 20, cy - 10 - f * 10, 16, 2, lit);
        windowRow(ctx, cx + 4, cy - 10 - f * 10, 16, 2, lit);
        ctx.fillStyle = '#b0bec5'; ctx.fillRect(cx - 2, cy - 14 - f * 10, 5, 3); // AC units
      }
      ctx.fillStyle = '#e8d3b0'; diamondPath(ctx, cx, cy, 0.95, 0.95); ctx.fill();
      ctx.fillStyle = '#37474f'; ctx.fillRect(cx + 6, t.y - 7, 9, 6);
      ctx.fillStyle = '#d81b60'; ctx.fillRect(cx - 20, t.y + 2, 3, 8); ctx.fillRect(cx - 20, t.y + 2, 12, 2); // drying clothes line
      break;
    }
    case 'wheat': {
      const season = o.season;
      const golden = season === 'harvest' ? '#e8b84b' : season === 'winter' ? '#9aa84b' : '#c9c04b';
      ctx.fillStyle = golden; diamondPath(ctx, cx, cy, 0.94, 0.94); ctx.fill();
      ctx.strokeStyle = hexShade(golden, 0.72); ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 8 - 14, cy + i * 4 + 7); ctx.lineTo(cx + i * 8 + 14, cy + i * 4 - 7); ctx.stroke(); }
      ctx.fillStyle = hexShade(golden, 1.15);
      for (let i = 0; i < 6; i++) { const rx = cx + (rng(i) - 0.5) * 40, ry = cy + (rng(i + 9) - 0.5) * 18; ctx.fillRect(rx, ry - 3, 1.5, 4); }
      break;
    }
    case 'paddy': {
      const flooded = o.season === 'monsoon';
      ctx.fillStyle = flooded ? '#4a7d94' : '#5d8a4a'; diamondPath(ctx, cx, cy, 0.94, 0.94); ctx.fill();
      if (flooded) { ctx.fillStyle = 'rgba(255,255,255,.14)'; diamondPath(ctx, cx - 4, cy - 2, 0.5, 0.5); ctx.fill(); }
      ctx.strokeStyle = flooded ? '#1b5e20' : '#33691e'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) {
        const rx = cx + (rng(i) - 0.5) * 44, ry = cy + (rng(i + 5) - 0.5) * 20;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + 1, ry - 5); ctx.stroke();
      }
      break;
    }
    case 'dairy': {
      box(ctx, cx, cy, 0.7, 0.7, 13, '#e6e0d4', { edge: '#b8a78d' });
      ctx.fillStyle = '#795548'; ctx.fillRect(cx - 18, cy - 4, 10, 3);
      // grazing cow next door (static deco cow)
      drawMiniCow(ctx, cx + 16, cy + 6, o.t, o.seed + 3);
      break;
    }
    case 'mango': {
      ctx.fillStyle = '#4e7d3a'; diamondPath(ctx, cx, cy, 0.94, 0.94); ctx.fill();
      for (const [dx, dy] of [[-12, -2], [4, -8], [12, 4], [-2, 6]]) {
        ctx.fillStyle = '#6d4c41'; ctx.fillRect(cx + dx - 1, cy + dy - 10, 2.5, 9);
        ctx.fillStyle = rng(dx) > 0.5 ? '#2e7d32' : '#388e3c';
        ctx.beginPath(); ctx.arc(cx + dx, cy + dy - 13, 7.5, 0, 7); ctx.fill();
        if (o.season === 'harvest' || o.season === 'summer') { ctx.fillStyle = '#fbc02d'; ctx.beginPath(); ctx.arc(cx + dx + 3, cy + dy - 11, 1.6, 0, 7); ctx.fill(); }
      }
      break;
    }
    case 'chai': {
      box(ctx, cx, cy, 0.5, 0.5, 9, '#8d6e63');
      ctx.fillStyle = KNOBS.chai.awning.colors[K.awning] || '#37474f';
      ctx.beginPath(); ctx.moveTo(cx - 12, cy - 16); ctx.lineTo(cx + 12, cy - 16); ctx.lineTo(cx + 15, cy - 11); ctx.lineTo(cx - 15, cy - 11); ctx.closePath(); ctx.fill();
      // kettle + steam
      ctx.fillStyle = '#cfd8dc'; ctx.beginPath(); ctx.arc(cx + 8, cy - 3, 3, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.moveTo(cx + 8, cy - 7); ctx.quadraticCurveTo(cx + 10 + Math.sin(o.t * 2) * 2, cy - 12, cx + 8, cy - 16); ctx.stroke();
      ctx.fillStyle = '#5d4037'; ctx.fillRect(cx - 12, cy + 3, 12, 2.5); // bench
      if (lit) pushLight({ x: cx, y: cy - 10, r: 12, c: 'rgba(255,180,80,.16)' });
      break;
    }
    case 'kirana': {
      box(ctx, cx, cy, 0.78, 0.78, 16, '#f0e0be', { edge: '#b09b74' });
      // striped awning (colourway knob)
      const awc = { red: '#c62828', teal: '#00695c', orange: '#e8850c' }[K.awning] || '#c62828';
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? awc : '#fff'; ctx.fillRect(cx - 18 + i * 9, cy - 12, 9, 3.5); }
      windowRow(ctx, cx - 13, cy - 6, 26, 3, lit);
      ctx.fillStyle = '#d7a86e'; ctx.beginPath(); ctx.arc(cx - 16, cy + 4, 3, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(cx - 12, cy + 5, 2.4, 0, 7); ctx.fill();
      break;
    }
    case 'dhaba': {
      box(ctx, cx, cy, 0.76, 0.76, 14, '#c96f2f', { edge: '#8a4b1d' });
      ctx.fillStyle = KNOBS.dhaba.canopy.colors[K.canopy] || '#4dd0e1';
      ctx.beginPath(); ctx.moveTo(cx - 20, cy - 20); ctx.lineTo(cx + 20, cy - 20); ctx.lineTo(cx + 24, cy - 14); ctx.lineTo(cx - 24, cy - 14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 6px system-ui'; ctx.textAlign = 'center'; ctx.fillText('DHABA', cx, cy - 16);
      // charpai
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx - 16, cy + 8); ctx.lineTo(cx - 4, cy + 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 15, cy + 10); ctx.lineTo(cx - 15, cy + 5); ctx.moveTo(cx - 5, cy + 10); ctx.lineTo(cx - 5, cy + 5); ctx.stroke();
      // tandoor
      ctx.fillStyle = '#b3552e'; ctx.beginPath(); ctx.ellipse(cx + 14, cy + 6, 4, 5, 0, 0, 7); ctx.fill();
      if (lit) pushLight({ x: cx, y: cy - 8, r: 15, c: 'rgba(255,170,60,.15)' });
      break;
    }
    case 'bazaar': {
      ctx.fillStyle = '#c9b28a'; diamondPath(ctx, cx, cy, 0.96, 0.96); ctx.fill();
      const tents = [[-13, -4, '#d81b60'], [6, -8, '#00897b'], [2, 6, '#f57f17']];
      for (const [dx, dy, col] of tents) {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(cx + dx, cy + dy - 12); ctx.lineTo(cx + dx + 12, cy + dy - 5); ctx.lineTo(cx + dx, cy + dy + 2); ctx.lineTo(cx + dx - 12, cy + dy - 5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(cx + dx - 6, cy + dy - 1, 12, 3);
      }
      // goods
      ctx.fillStyle = '#fbc02d'; ctx.beginPath(); ctx.arc(cx - 4, cy + 9, 2.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(cx + 1, cy + 10, 2.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#43a047'; ctx.beginPath(); ctx.arc(cx + 6, cy + 9, 2.2, 0, 7); ctx.fill();
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
      break;
    }
    case 'jeweller': {
      box(ctx, cx, cy, 0.78, 0.78, 17, '#efe0c8', { edge: '#c9a227' });
      ctx.fillStyle = '#7c4a03'; ctx.font = 'bold 6px system-ui'; ctx.textAlign = 'center'; ctx.fillText('JEWELLERS', cx, cy - 19);
      // glitter
      for (let i = 0; i < 3; i++) {
        const gx = cx - 8 + i * 8, gsp = 0.4 + 0.6 * Math.abs(Math.sin(o.t * 2 + i));
        ctx.fillStyle = `rgba(255,215,0,${gsp})`;
        ctx.beginPath(); ctx.arc(gx, cy - 8, 2, 0, 7); ctx.fill();
      }
      if (lit) pushLight({ x: cx, y: cy - 14, r: 14, c: 'rgba(255,215,0,.15)' });
      break;
    }
    case 'bank': {
      box(ctx, cx, cy, 0.84, 0.84, 20, '#eceff1', { edge: '#90a4ae' });
      ctx.fillStyle = '#b0bec5';
      for (let i = 0; i < 3; i++) ctx.fillRect(cx - 12 + i * 10, cy - 14, 4, 12);
      ctx.fillStyle = '#37474f'; ctx.font = 'bold 6px system-ui'; ctx.textAlign = 'center'; ctx.fillText('BANK', cx, cy - 22);
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
      ctx.fillStyle = '#fff'; ctx.font = 'bold 5.5px system-ui'; ctx.textAlign = 'center'; ctx.fillText('VIDYALAYA', cx, cy - 22);
      // flag
      ctx.strokeStyle = '#455a64'; ctx.beginPath(); ctx.moveTo(cx + 16, cy - 6); ctx.lineTo(cx + 16, cy - 30); ctx.stroke();
      tricolor(ctx, cx + 16, cy - 30, 9, 6, o.t, o.seed);
      archRow(ctx, cx - 14, cy - 5, 28, 3, '#5b4630');
      break;
    }
    case 'hospital': {
      box(ctx, cx, cy, 0.86, 0.86, 22, '#f5f5f5', { edge: '#b0bec5' });
      ctx.fillStyle = '#e53935';
      ctx.fillRect(cx - 3, cy - 24, 6, 16); ctx.fillRect(cx - 8, cy - 19, 16, 6);
      windowRow(ctx, cx - 16, cy - 10, 32, 4, lit);
      // ambulance
      ctx.fillStyle = '#2e7d32'; ctx.fillRect(cx - 22, cy + 4, 12, 5);
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - 19, cy + 5, 4, 3);
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
      ctx.beginPath(); ctx.arc(cx, cy - 24, 2.5, 0, 7); ctx.fill(); // blue lamp
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
      // shikhara: stacked tiers
      let wy = cy - 12, ww = 22;
      const skc = { gold: ['#d4a017', '#c96f2f'], white: ['#fafafa', '#c9b28a'], terracotta: ['#c96f2f', '#a35d3f'] }[K.shikhara] || ['#d4a017', '#c96f2f'];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = skc[i % 2];
        ctx.beginPath(); ctx.moveTo(cx, wy - ww * 0.42); ctx.lineTo(cx + ww * 0.55, wy); ctx.lineTo(cx, wy + ww * 0.42); ctx.lineTo(cx - ww * 0.55, wy); ctx.closePath(); ctx.fill();
        wy -= 7; ww *= 0.72;
      }
      ctx.fillStyle = '#d4a017'; ctx.beginPath(); ctx.arc(cx, wy - 2, 2.2, 0, 7); ctx.fill(); // kalash
      ctx.strokeStyle = '#7c4a03'; ctx.beginPath(); ctx.moveTo(cx, wy - 2); ctx.lineTo(cx, wy - 14); ctx.stroke();
      flagTri(ctx, cx, wy - 14, 9, 8, P.saffron, o.t, o.seed);
      archRow(ctx, cx - 12, cy - 5, 24, 2, '#7c4a03');
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
      if (lit) pushLight({ x: cx, y: cy - 10, r: 15, c: 'rgba(255,240,200,.15)' });
      break;
    }
    case 'park': {
      ctx.fillStyle = '#5da24a'; diamondPath(ctx, cx, cy, 0.96, 0.96); ctx.fill();
      // peepal tree
      ctx.fillStyle = '#6d4c41'; ctx.fillRect(cx - 2, cy - 14, 3.5, 13);
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath(); ctx.arc(cx - 5, cy - 16, 8, 0, 7); ctx.arc(cx + 4, cy - 18, 7, 0, 7); ctx.arc(cx, cy - 22, 6, 0, 7); ctx.fill();
      // swing
      ctx.strokeStyle = '#6d4c41';
      ctx.beginPath(); ctx.moveTo(cx + 12, cy + 2); ctx.lineTo(cx + 12, cy - 10); ctx.moveTo(cx + 18, cy - 2); ctx.lineTo(cx + 18, cy - 10); ctx.moveTo(cx + 10, cy - 10); ctx.lineTo(cx + 20, cy - 10); ctx.stroke();
      break;
    }
    case 'maidan': {
      ctx.fillStyle = '#6aa84f'; diamondPath(ctx, cx, cy, 0.96, 0.96); ctx.fill();
      ctx.fillStyle = '#c9b28a';
      ctx.beginPath(); ctx.moveTo(cx - 6, cy - 6); ctx.lineTo(cx + 6, cy - 12); ctx.lineTo(cx + 6, cy - 6); ctx.lineTo(cx - 6, cy); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#f5f5f5'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx + 1, cy - 9); ctx.lineTo(cx + 1, cy - 13); ctx.moveTo(cx + 3, cy - 8.4); ctx.lineTo(cx + 3, cy - 12.6); ctx.moveTo(cx + 5, cy - 7.8); ctx.lineTo(cx + 5, cy - 12); ctx.stroke();
      break;
    }
    case 'mela': {
      ctx.fillStyle = '#c9b28a'; diamondPath(ctx, cx, cy, 0.96, 0.96); ctx.fill();
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
      if (lit) lights.push({ x: fx, y: fy, r: 26, c: 'rgba(255,180,120,.2)' });
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
      ctx.fillStyle = '#fff'; ctx.font = 'bold 6px system-ui'; ctx.textAlign = 'center'; ctx.fillText('MILL', cx, cy - 25);
      break;
    }
    case 'road': {
      ctx.fillStyle = P.road; diamondPath(ctx, cx, cy, 0.98, 0.98); ctx.fill();
      ctx.fillStyle = P.roadLine;
      ctx.fillRect(cx - 1.2, cy - 3, 2.4, 6);
      break;
    }
    case 'bridge': {
      ctx.fillStyle = '#8d6e63'; diamondPath(ctx, cx, cy, 0.98, 0.98); ctx.fill();
      ctx.fillStyle = '#a1887f'; diamondPath(ctx, cx, cy - 2, 0.8, 0.8); ctx.fill();
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(cx - 30, cy - 8, 60, 2); ctx.fillRect(cx - 30, cy + 6, 60, 2);
      ctx.fillStyle = P.roadLine; ctx.fillRect(cx - 1.2, cy - 3, 2.4, 6);
      break;
    }
    case 'tree': drawTree(ctx, cx, cy, o.seed, o.season); break;
    case 'lamp': {
      ctx.strokeStyle = '#455a64'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy + 2); ctx.lineTo(cx, cy - 18); ctx.stroke();
      ctx.fillStyle = night ? '#ffe082' : '#90a4ae';
      ctx.beginPath(); ctx.arc(cx, cy - 20, 3, 0, 7); ctx.fill();
      if (night) pushLight({ x: cx, y: cy - 20, r: 24, c: 'rgba(255,220,130,.22)' });
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
  ctx.fillStyle = '#6d4c41'; ctx.fillRect(cx - 1.5, cy - 10 * r, 3, 10 * r);
  const c = season === 'winter' ? '#7d8f56' : '#2e7d32';
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(cx - 5 * r, cy - 12 * r, 6.5 * r, 0, 7);
  ctx.arc(cx + 5 * r, cy - 13 * r, 6 * r, 0, 7);
  ctx.arc(cx, cy - 18 * r, 7 * r, 0, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.beginPath(); ctx.arc(cx - 2 * r, cy - 20 * r, 4 * r, 0, 7); ctx.fill();
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

export function drawVehicle(ctx, x, y, v, t, night) {
  ctx.save();
  ctx.translate(x, y);
  const flip = v.dir < 0 ? -1 : 1;
  ctx.scale(flip, 1);
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 3.2, 0, 0, 7); ctx.fill();
  switch (v.kind) {
    case 'auto': {
      ctx.fillStyle = '#212121';
      ctx.beginPath(); ctx.arc(-6, 0, 2.4, 0, 7); ctx.arc(6, 0, 2.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#1b5e20'; ctx.fillRect(-8, -8, 14, 7);
      ctx.fillStyle = '#fdd835';
      ctx.beginPath();
      ctx.moveTo(-9, -8); ctx.quadraticCurveTo(0, -12, 8, -8); ctx.lineTo(8, -5); ctx.lineTo(-9, -5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#263238'; ctx.fillRect(-2, -7.4, 3.6, 2.8);
      if (night) lights.push({ x: x + 9 * flip, y: y - 4, r: 10, c: 'rgba(255,240,180,.25)' });
      break;
    }
    case 'bus': {
      ctx.fillStyle = '#263238';
      ctx.beginPath(); ctx.arc(-8, 0, 2.6, 0, 7); ctx.arc(8, 0, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#c62828'; ctx.fillRect(-14, -10, 28, 8);
      ctx.fillStyle = '#b71c1c'; ctx.fillRect(-14, -3.4, 28, 2);
      ctx.fillStyle = '#b3e5fc';
      for (let i = 0; i < 4; i++) ctx.fillRect(-12 + i * 6.4, -8.6, 4.4, 3.6);
      if (night) lights.push({ x: x + 15 * flip, y: y - 4, r: 13, c: 'rgba(255,240,180,.25)' });
      break;
    }
    case 'truck': {
      ctx.fillStyle = '#263238';
      ctx.beginPath(); ctx.arc(-9, 0, 2.6, 0, 7); ctx.arc(7, 0, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8850c'; ctx.fillRect(-13, -11, 22, 9);
      ctx.fillStyle = '#43a047'; ctx.fillRect(9, -9, 6, 7);
      ctx.fillStyle = '#263238'; ctx.fillRect(11, -8, 2.4, 3);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 4px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('HORN OK', -2, -6);
      ctx.fillStyle = '#d81b60'; ctx.fillText('PLEASE', -2, -1.6);
      if (night) lights.push({ x: x + 16 * flip, y: y - 4, r: 13, c: 'rgba(255,240,180,.25)' });
      break;
    }
    case 'cycle': {
      ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(-4, -0.5, 2.6, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(4, -0.5, 2.6, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, -0.5); ctx.lineTo(0, -6); ctx.lineTo(4, -0.5); ctx.lineTo(-4, -0.5); ctx.stroke();
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
      // bull + cart, driver
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
  }
  ctx.restore();
}
