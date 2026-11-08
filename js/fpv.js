// fpv.js — TRUE FIRST-PERSON street view (v5 rehaul, issue #23).
// The person walking the city is YOU: there is no avatar body and no "You"
// tag — the camera sits at eye height exactly where you stand, and the city
// is drawn around you with a real perspective projection (painter-sorted
// boxes with rooflines, sun from the SE, kerbed roads with lane dashes and
// zebra crossings, billboards for trees and people, rush-hour traffic you
// share the street with, and hanging door plates that say who owns what).
//
// Pure Canvas 2D, zero dependencies, same warm palette as plan mode
// (js/palette.js). The tilt-shift lens composes over this frame too.

import { S, MAP, gridAt, districtOf } from './state.js';
import { BUILDINGS, KNOBS } from './data.js';
import { PAL, FACE_LIGHT, shade, mix, daylight, hazeCol } from './palette.js';
import { resolveKnobs, drawPerson, drawCow, drawDoorPlate } from './arts.js';
import { hourOfDay, seasonOf } from './sim.js';
import { getAgents } from './agents.js';
import { getWalkers, getView } from './walk.js';
import { deeds } from './owners.js';
import { lensBegin, lensCompose, setLensBand, isLensOn } from './tiltshift.js';

let canvas = null, vctx = null, ctx = null, W = 0, H = 0, dpr = 1;
export function initFpv(c) {
  canvas = c; vctx = c.getContext('2d');
  resizeFpv();
  window.addEventListener('resize', resizeFpv);
}
function resizeFpv() {
  if (!canvas) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ---------------- camera ----------------
const cam = { x: 24, y: 24, eye: 1.62, fx: 0, fy: 1, rx: -1, ry: 0, FL: 800, horizon: 400, yaw: 0 };
function updateCam() {
  const v = getView();
  cam.x = v.x; cam.y = v.y;
  cam.eye = 1.62 + (v.bob || 0);
  cam.yaw = v.yaw;
  cam.fx = Math.sin(v.yaw); cam.fy = -Math.cos(v.yaw);   // forward (yaw=0 faces north/−y)
  cam.rx = Math.cos(v.yaw); cam.ry = Math.sin(v.yaw);    // right hand
  cam.FL = H * 1.04;
  cam.horizon = H * 0.5 + Math.tan(v.pitch || 0) * cam.FL;
}

function project(wx, wy, wz) {
  const dx = wx - cam.x, dy = wy - cam.y;
  const d = dx * cam.fx + dy * cam.fy;
  if (d < 0.12) return null;
  const lat = dx * cam.rx + dy * cam.ry;
  const s = cam.FL / d;
  return { x: W / 2 + lat * s, y: cam.horizon - (wz - cam.eye) * s, s, d };
}
// ground-plane point under a screen pixel (null when the ray misses the ground)
function groundPoint(sx, sy) {
  const dh = sy - cam.horizon;
  if (dh < 1.5) return null;
  const d = cam.FL * cam.eye / dh;
  if (d > 110) return null;
  const lat = (sx - W / 2) * d / cam.FL;
  return { x: cam.x + cam.fx * d + cam.rx * lat, y: cam.y + cam.fy * d + cam.ry * lat };
}

// world-space quad helper — pts: [[x,y,z]×4]
function quad(pts, fill) {
  const p0 = project(pts[0][0], pts[0][1], pts[0][2]);
  if (!p0) return null;
  const rest = [];
  for (let i = 1; i < 4; i++) {
    const p = project(pts[i][0], pts[i][1], pts[i][2]);
    if (!p) return null;
    rest.push(p);
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  for (const p of rest) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fill();
  return { p0, rest };
}

// ---------------- sky ----------------
const SKY_KEYS = [
  [0, '#070c1f', '#131b36'], [5, '#070c1f', '#131b36'], [6.2, '#6d5390', '#f0a45f'],
  [7.6, '#6fa5d8', '#e8d9b8'], [9, '#74b0e0', '#d5e9f2'], [16, '#74b0e0', '#d5e9f2'],
  [18.2, '#d97e4a', '#f6c688'], [19.5, '#453268', '#c05a52'], [21, '#070c1f', '#131b36'], [24, '#070c1f', '#131b36'],
];
function skyCols(h) {
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (h >= SKY_KEYS[i][0] && h <= SKY_KEYS[i + 1][0]) {
      const f = (h - SKY_KEYS[i][0]) / (SKY_KEYS[i + 1][0] - SKY_KEYS[i][0] || 1);
      return [mix(SKY_KEYS[i][1], SKY_KEYS[i + 1][1], f), mix(SKY_KEYS[i][2], SKY_KEYS[i + 1][2], f)];
    }
  }
  return [SKY_KEYS[0][1], SKY_KEYS[0][2]];
}
const stars = Array.from({ length: 130 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12543.98;
  return { x: a - Math.floor(a), y: b - Math.floor(b), r: 0.5 + ((a * 7) % 1) * 0.9 };
});
function drawSky(t, hour, dl) {
  const [top, bot] = skyCols(hour);
  const g = ctx.createLinearGradient(0, 0, 0, Math.max(4, cam.horizon));
  g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, Math.max(0, cam.horizon) + 1);
  // stars fade in with darkness
  const starA = Math.max(0, Math.min(1, (0.62 - dl.amb) / 0.3));
  if (starA > 0.02) {
    ctx.fillStyle = '#e8ecff';
    for (const st of stars) {
      const sx = st.x * W, sy = st.y * Math.max(1, cam.horizon - 8);
      ctx.globalAlpha = starA * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + st.x * 40)));
      ctx.fillRect(sx, sy, st.r, st.r);
    }
    ctx.globalAlpha = 1;
  }
  // sun / moon travel east → west with the real IST clock
  const dayT = (hour - 6) / 12.6;
  if (dayT > -0.05 && dayT < 1.05) {
    const sx = W * (0.06 + 0.88 * dayT), sy = cam.horizon - Math.sin(Math.max(0, Math.min(1, dayT)) * Math.PI) * H * 0.36;
    const warm = mix('#fff3d6', '#ff9a4d', Math.min(1, Math.abs(dayT - 0.5) * 1.6));
    const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 42);
    rg.addColorStop(0, warm); rg.addColorStop(0.25, warm); rg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.globalAlpha = 0.85; ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(sx, sy, 42, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  } else {
    const mx = W * (0.72 - 0.4 * Math.sin(hour * 0.5)), my = cam.horizon * 0.32;
    ctx.fillStyle = '#e8ecf4';
    ctx.beginPath(); ctx.arc(mx, my, 9, 0, 7); ctx.fill();
    ctx.fillStyle = mix('#070c1f', '#131b36', 0.5);
    ctx.beginPath(); ctx.arc(mx - 3.4, my - 2.2, 7.6, 0, 7); ctx.fill();
  }
  // day clouds — soft drifting blobs near the horizon
  if (dl.amb > 0.5) {
    ctx.fillStyle = `rgba(255,255,255,${0.14 * dl.amb})`;
    for (let i = 0; i < 3; i++) {
      const cx = ((t * 9 + i * 460) % (W + 500)) - 250;
      const cy = cam.horizon - H * (0.10 + 0.06 * i) + Math.sin(t * 0.05 + i) * 6;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 90 + i * 30, 15 + i * 4, 0, 0, 7);
      ctx.ellipse(cx + 60, cy + 6, 55 + i * 20, 11 + i * 3, 0, 0, 7);
      ctx.fill();
    }
  }
}

// ---------------- ground ----------------
function groundBounds() {
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, any = false;
  for (const [sx, sy] of [[0, H], [W, H], [0, cam.horizon + 14], [W, cam.horizon + 14], [W / 2, H], [W / 2, cam.horizon + 14]]) {
    const gp = groundPoint(sx, sy);
    if (!gp) continue;
    any = true;
    minX = Math.min(minX, gp.x); maxX = Math.max(maxX, gp.x);
    minY = Math.min(minY, gp.y); maxY = Math.max(maxY, gp.y);
  }
  if (!any) { minX = cam.x - 10; maxX = cam.x + 10; minY = cam.y - 10; maxY = cam.y + 10; }
  const R = 28;
  const x0 = Math.max(0, Math.floor(Math.max(minX, cam.x - R)) - 1);
  const x1 = Math.min(MAP - 1, Math.ceil(Math.min(maxX, cam.x + R)) + 1);
  const y0 = Math.max(0, Math.floor(Math.max(minY, cam.y - R)) - 1);
  const y1 = Math.min(MAP - 1, Math.ceil(Math.min(maxY, cam.y + R)) + 1);
  return { x0, x1, y0, y1 };
}
function tileQuad(x, y, fill, z = 0) {
  return quad([[x, y, z], [x + 1, y, z], [x + 1, y + 1, z], [x, y + 1, z]], fill);
}
function isRoadLike(x, y) {
  const g = gridAt(x, y);
  return !!g && (g.k === 'road' || g.k === 'bridge');
}
function drawGround(t, dl, season) {
  // base earth fill below the horizon (covers far gaps between tiles)
  const base = mix(mix(PAL.dustDeep, '#6a7a4a', 0.35), hazeCol(dl), 0.55);
  ctx.fillStyle = base;
  ctx.fillRect(0, Math.max(0, cam.horizon - 1), W, H - Math.max(0, cam.horizon - 1));
  const bb = groundBounds();
  for (let y = bb.y0; y <= bb.y1; y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      // cheap reject: tile centre depth + screen bounds
      const c = project(x + 0.5, y + 0.5, 0);
      if (!c || c.d > 34) continue;
      const m = 46 * c.s;
      if (c.x < -m - 60 || c.x > W + m + 60) continue;
      const tv = S.terrain[y] && S.terrain[y][x];
      if (!tv) continue;
      const g = gridAt(x, y);
      if (tv.w) { // river / pond with a living edge
        const shim = 0.5 + 0.5 * Math.sin(t * 1.6 + tv.v);
        tileQuad(x, y, mix(mix(PAL.water, PAL.waterDeep, (tv.v % 5) / 6), hazeCol(dl), fogT(c.d)));
        if (shim > 0.72) tileQuad(x + 0.2, y + 0.2, 'rgba(255,255,255,.07)');
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (nx < 0 || ny < 0 || nx >= MAP || ny >= MAP || S.terrain[ny][nx].w) continue;
          const e = edgeQuad(x, y, nx, ny, 0.09);
          if (e) quad(e, 'rgba(231,244,248,.5)');
        }
        continue;
      }
      if (g && (g.k === 'road' || g.k === 'bridge')) { drawRoadTile(x, y, g, c, dl); continue; }
      if (g) { tileQuad(x, y, mix(PAL.dustDeep, hazeCol(dl), fogT(c.d))); continue; } // courtyard apron
      // open ground: kerbside dust footpath vs grass
      const nearRoad = isRoadLike(x - 1, y) || isRoadLike(x + 1, y) || isRoadLike(x, y - 1) || isRoadLike(x, y + 1);
      let fill;
      if (nearRoad) fill = (tv.v % 3) ? PAL.dust : PAL.dustDeep;
      else if (g === null && (S.grid[y][x] === null)) {
        fill = (tv.v % 4 === 2) ? PAL.grassDeep : PAL.grass;
      }
      if (season === 'winter') fill = mix(fill, '#c8cbb8', 0.25);
      tileQuad(x, y, mix(fill, hazeCol(dl), fogT(c.d)));
    }
  }
}
function fogT(d) { return Math.max(0, Math.min(0.85, (d - 13) / 17)); }
// thin strip just inside the tile edge that faces the neighbour (nx,ny)
function edgeQuad(x, y, nx, ny, w) {
  if (nx === x - 1) return [[x, y, 0], [x + w, y, 0], [x + w, y + 1, 0], [x, y + 1, 0]];
  if (nx === x + 1) return [[x + 1 - w, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x + 1 - w, y + 1, 0]];
  if (ny === y - 1) return [[x, y, 0], [x + 1, y, 0], [x + 1, y + w, 0], [x, y + w, 0]];
  return [[x, y + 1 - w, 0], [x + 1, y + 1 - w, 0], [x + 1, y + 1, 0], [x, y + 1, 0]];
}
function drawRoadTile(x, y, g, c, dl) {
  const hz = hazeCol(dl);
  const asphalt = g.k === 'bridge' ? mix('#8a6a4c', hz, fogT(c.d)) : mix((x + y) % 2 ? PAL.road : PAL.roadDeep, hz, fogT(c.d));
  tileQuad(x, y, asphalt);
  const n = isRoadLike(x, y - 1), s = isRoadLike(x, y + 1), e = isRoadLike(x + 1, y), w = isRoadLike(x - 1, y);
  if (g.k === 'bridge') { // rails over water
    quad(edgeQuad(x, y, x, y - 1, 0.09), shade('#6d4c41', 0.9));
    quad(edgeQuad(x, y, x, y + 1, 0.09), shade('#6d4c41', 0.9));
    return;
  }
  // kerbs where the road meets footpath/green
  const kerb = 'rgba(179,166,143,.75)';
  if (!n && !S.terrain[y - 1][x].w) quad(edgeQuad(x, y, x, y - 1, 0.055), kerb);
  if (!s && y + 1 < MAP && !S.terrain[y + 1][x].w) quad(edgeQuad(x, y, x, y + 1, 0.055), kerb);
  if (!e && x + 1 < MAP && !S.terrain[y][x + 1].w) quad(edgeQuad(x, y, x + 1, y, 0.055), kerb);
  if (!w && !S.terrain[y][x - 1].w) quad(edgeQuad(x, y, x - 1, y, 0.055), kerb);
  // lane dash along the road axis (skipped at junctions)
  if (c.d < 26) {
    const dash = 'rgba(239,230,207,.5)';
    if (n && s && !e && !w) quad([[x + .47, y + .18, 0], [x + .53, y + .18, 0], [x + .53, y + .82, 0], [x + .47, y + .82, 0]], dash);
    else if (e && w && !n && !s) quad([[x + .18, y + .47, 0], [x + .82, y + .47, 0], [x + .82, y + .53, 0], [x + .18, y + .53, 0]], dash);
    else if (n && s && e && w) { // chowk: zebra crossings on each approach
      const z = 'rgba(239,230,207,.66)';
      if (c.d < 20) {
        for (let i = 0; i < 4; i++) {
          const o = 0.1 + i * 0.2;
          quad([[x + .14, y + o, 0], [x + .86, y + o, 0], [x + .86, y + o + .07, 0], [x + .14, y + o + .07, 0]], z);
          quad([[x + o, y + .14, 0], [x + o + .07, y + .14, 0], [x + o + .07, y + .86, 0], [x + o, y + .86, 0]], z);
        }
      }
    }
  }
}

// ---------------- building looks (shared warm kit) ----------------
const LOOKS = {
  jhuggi:    { w: .74, h: .58, wall: '#5e7d9a', roofType: 'tarp' },
  kaccha:    { w: .8,  h: .7,  wall: '#cfa96f', roofType: 'hip', rh: .22, roof: '#b89044' },
  pakka:     { w: .84, h: 1.0, wall: PAL.cream, roofType: 'slab', floors: 2, tank: true, chhajja: true },
  chawl:     { w: .95, h: 1.15, wall: PAL.sand, roofType: 'slab', floors: 2, balcony: true },
  haveli:    { w: .92, h: 1.22, wall: '#e2c294', roofType: 'dome', dr: .3, floors: 2, chhajja: true, arch: true },
  bungalow:  { w: .78, h: .82, wall: '#f2e3c8', roofType: 'hip', rh: .26, roof: PAL.terracotta, floors: 1, garden: true },
  flats:     { w: .8,  h: 2.35, wall: PAL.mint, roofType: 'slab', floors: 4, tank: true, balcony: true },
  villa:     { w: .72, h: 1.02, wall: PAL.whitewash, roofType: 'slab', floors: 2, balcony: true, porch: true },
  chai:      { w: .7,  h: .6,  wall: '#8a3b32', roofType: 'slab', shop: 'CHAI', awn: '#37474f' },
  kirana:    { w: .78, h: .72, wall: PAL.sand, roofType: 'slab', shop: 'KIRANA', awn: '#c4553a' },
  dhaba:     { w: .85, h: .78, wall: PAL.terracotta, roofType: 'slab', shop: 'DHABA', awn: '#4caf7d' },
  bazaar:    { w: .95, h: .72, wall: '#e8850c', roofType: 'slab', shop: 'BAZAAR', awn: '#8a3b32', stalls: true },
  saree:     { w: .85, h: .92, wall: PAL.jaipur, roofType: 'slab', shop: 'SAREES', awn: '#d81b60' },
  jeweller:  { w: .85, h: 1.02, wall: PAL.cream, roofType: 'slab', shop: 'JEWELLERS', awn: PAL.gold },
  bank:      { w: .9,  h: 1.6, wall: '#eceff1', roofType: 'slab', floors: 3, shop: 'BANK', glass: PAL.glass },
  cinema:    { w: .9,  h: 1.3, wall: '#c85a54', roofType: 'slab', shop: 'CINEMA', awn: '#fdd835' },
  mall:      { w: .95, h: 1.55, wall: '#eceff1', roofType: 'slab', floors: 2, shop: 'MALL', glass: '#b3e5fc' },
  school:    { w: .9,  h: .92, wall: '#e6cfa5', roofType: 'hip', rh: .2, roof: PAL.terracotta, floors: 1, shop: 'SCHOOL' },
  hospital:  { w: .9,  h: 1.45, wall: '#eef3f0', roofType: 'slab', floors: 3, shop: 'HOSPITAL' },
  panchayat: { w: .85, h: .95, wall: '#e2c294', roofType: 'hip', rh: .2, roof: PAL.terracotta, shop: 'PANCHAYAT' },
  police:    { w: .8,  h: .8,  wall: '#cfd8dc', roofType: 'slab', shop: 'POLICE' },
  watertank: { w: .58, h: 1.55, wall: '#cfd8dc', roofType: 'slab', legs: true },
  substation:{ w: .8,  h: .72, wall: '#b0bec5', roofType: 'slab', fence: true },
  solar:     { w: .95, h: .16, wall: '#263238', roofType: 'panels' },
  busstand:  { w: .95, h: .85, wall: '#cfd8dc', roofType: 'slab', shop: 'BUS STAND', awn: '#c62828' },
  mandir:    { w: .8,  h: 1.15, wall: '#e8d5ae', roofType: 'spire', spire: .68, spireCol: PAL.gold, arch: true },
  masjid:    { w: .85, h: .95, wall: '#eee8d2', roofType: 'dome', dr: .32, domeCol: '#2e7d32', arch: true },
  gurudwara: { w: .85, h: .92, wall: PAL.whitewash, roofType: 'dome', dr: .3, domeCol: PAL.gold, arch: true },
  church:    { w: .8,  h: 1.05, wall: '#f5f5f0', roofType: 'spire', spire: .55, spireCol: '#78909c', arch: true },
  kiln:      { w: .6,  h: .9,  wall: PAL.terracottaDark, roofType: 'chimney' },
  factory:   { w: .9,  h: 1.05, wall: '#b0bec5', roofType: 'sawtooth' },
  textile:   { w: .95, h: 1.25, wall: '#c85a54', roofType: 'slab', floors: 2, shop: 'MILL', chimney: true },
  office:    { w: .84, h: 2.15, wall: '#e8ecef', roofType: 'slab', floors: 4, glass: PAL.glass },
  tower:     { w: .72, h: 4.3, wall: '#cfd8dc', roofType: 'slab', floors: 9, glass: '#8fb8d0', crown: true },
  hotel:     { w: .8,  h: 2.45, wall: '#efe6d8', roofType: 'slab', floors: 5, shop: 'HOTEL', tank: true },
  petrol:    { w: .95, h: .4,  wall: '#c8d2cc', roofType: 'canopy', canopyCol: '#c62828' },
  dairy:     { w: .7,  h: .5,  wall: PAL.whitewash, roofType: 'hip', rh: .18, roof: PAL.terracotta },
  mela:      { w: 0,   h: 0,   wall: '', roofType: 'ground', groundCol: '#c9a97e' },
  park:      { w: 0,   h: 0,   wall: '', roofType: 'ground', groundCol: PAL.grassPark, tree: true },
  maidan:    { w: 0,   h: 0,   wall: '', roofType: 'ground', groundCol: '#8db35e', pitch: true },
  wheat:     { w: 0,   h: 0,   wall: '', roofType: 'crop', cropCol: '#d9b354' },
  paddy:     { w: 0,   h: 0,   wall: '', roofType: 'crop', cropCol: '#6f9a52' },
  flower:    { w: 0,   h: 0,   wall: '', roofType: 'crop', cropCol: '#d98a8f' },
};
function lookFor(k, seed, knobs) {
  const ck = k + ':' + (seed || 0) + ':' + (knobs ? JSON.stringify(knobs) : '');
  let L = LOOKS._cache && LOOKS._cache.get(ck);
  if (L) return L;
  const base = LOOKS[k];
  if (!base) return null;
  L = { ...base };
  const K = { ...resolveKnobs(k, seed || 0), ...(knobs || {}) };
  const col = (name, opt) => KNOBS[name] && KNOBS[name][opt] && KNOBS[name][opt].colors ? KNOBS[name][opt].colors[K[opt]] : null;
  let c;
  if ((c = col('pakka', 'paint'))) L.wall = c;
  if ((c = col('flats', 'paint'))) L.wall = c;
  if ((c = col('bungalow', 'paint'))) L.wall = c;
  if ((c = col('villa', 'paint'))) L.wall = c;
  if ((c = col('haveli', 'stone'))) L.wall = c;
  if ((c = col('jhuggi', 'tarp'))) L.wall = c;
  if ((c = col('office', 'glass'))) L.glass = c;
  if ((c = col('mall', 'signage'))) L.awn = c;
  if (k === 'tower' && KNOBS.tower && K.crown) L.crownCol = KNOBS.tower.crown.colors[K.crown];
  if (k === 'bungalow' && K.roof === 'slate') L.roof = '#5a6670';
  if (k === 'kaccha' && K.roof === 'tile') L.roof = '#b3552e';
  if (k === 'kirana' && K.awning) L.awn = { red: '#c4553a', teal: '#2e6e63', orange: '#e8850c' }[K.awning] || L.awn;
  LOOKS._cache = LOOKS._cache || new Map();
  LOOKS._cache.set(ck, L);
  return L;
}

// __PART2__
