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

import { S, MAP, gridAt } from './state.js';
import { BUILDINGS, KNOBS } from './data.js';
import { PAL, FACE_LIGHT, shade, mix, daylight, hazeCol } from './palette.js';
import { resolveKnobs, drawPerson, drawCow, drawDoorPlate, drawTree } from './arts.js';
import { hourOfDay, seasonOf } from './sim.js';
import { getAgents } from './agents.js';
import { getWalkers, getView, getPlayer } from './walk.js';
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
// v5.2 (issue #24): buildacountry-parity third-person orbit. The camera hangs
// BEHIND and ABOVE the visible avatar, orbiting with drag while the land
// stays anchored. Pitch is a real view tilt now (0.05–0.9), so the ground
// plane is projected with a full pitch rotation — not an eye-height horizon.
const cam = { x: 24, y: 24, eye: 5, fx: 0, fy: 1, rx: -1, ry: 0, FL: 800, horizon: 400, yaw: 0, pitch: 0.26, sinP: 0.26, cosP: 0.97, cd: 0 };
let lastT = 0;
function updateCam(t) {
  const v = getView();
  const portrait = H > W;
  // orbit distance tuned to our lot scale (reference: 8.4 / 11.5 on bigger lots)
  const want = portrait ? 8.2 : 6.2;
  cam.yaw = v.yaw;
  cam.fx = Math.sin(v.yaw); cam.fy = -Math.cos(v.yaw);   // view forward (yaw=0 faces north/−y)
  cam.rx = Math.cos(v.yaw); cam.ry = Math.sin(v.yaw);    // right hand
  cam.FL = H * 1.04;
  // wall behind you pulls the camera in (ray-march, reference rule)
  const bx = -cam.fx, by = -cam.fy, cp = Math.cos(v.pitch);
  let dist = 2.8;
  const blocked = (px, py) => {
    const tx = Math.floor(px), ty = Math.floor(py);
    if (tx < 0 || ty < 0 || tx >= MAP || ty >= MAP) return true;
    const g = gridAt(tx, ty);
    if (g && (g.k === 'road' || g.k === 'bridge' || g.k === 'tree' || g.k === 'mango' || g.k === 'lamp' || g.k === 'flag' || g.k === 'park' || g.k === 'maidan' || g.k === 'wheat' || g.k === 'paddy' || g.k === 'flower' || g.k === 'mela')) return false;
    return !!(S.grid[ty] && S.grid[ty][tx]);
  };
  while (dist < want && !blocked(v.x + bx * dist * cp, v.y + by * dist * cp)) dist += 0.25;
  if (dist < want) dist = Math.max(2.8, dist - 0.6);
  // fast in, slow out (reference smoothing)
  cam.cd = cam.cd > 0 ? (dist < cam.cd ? dist : cam.cd + (dist - cam.cd) * Math.min(1, (t - lastT) * 3)) : dist;
  lastT = t;
  const lift = (want - cam.cd) * 0.35;   // closer camera looks down a bit more, so you still see yourself
  // the camera hangs BEHIND you (bx,by) at distance cd, eye raised by the pitch
  cam.x = v.x + bx * cam.cd * cp;
  cam.y = v.y + by * cam.cd * cp;
  cam.eye = 1.7 + Math.sin(v.pitch) * cam.cd + lift;
  // the projection aims at your chest (1.45) — the reference lookAt rig, so
  // you stay framed just below centre at ANY camera distance (issue #24)
  cam.pitch = Math.atan2(cam.eye - 1.45, Math.max(0.7, cam.cd * cp));
  cam.sinP = Math.sin(cam.pitch); cam.cosP = Math.cos(cam.pitch);
  cam.horizon = H * 0.5 - Math.tan(cam.pitch) * cam.FL;
}

function project(wx, wy, wz) {
  const dx = wx - cam.x, dy = wy - cam.y;
  const d = dx * cam.fx + dy * cam.fy;
  if (d < 0.14) return null;
  const lat = dx * cam.rx + dy * cam.ry;
  const h = wz - cam.eye;
  const zc = d * cam.cosP - h * cam.sinP;   // depth along the tilted view axis
  if (zc < 0.14) return null;
  const s = cam.FL / zc;
  return { x: W * 0.5 + lat * s, y: cam.horizon - (h / cam.cosP) * s, s, d };
}
// ground-plane point under a screen pixel (null when the ray misses the ground)
function groundPoint(sx, sy) {
  if (sy < cam.horizon + 1.5) return null;
  // sy = horizon − (h/cosP)·FL/zc with h = −eye on the ground → solve zc
  const zc = cam.eye * cam.FL / ((sy - cam.horizon) * cam.cosP);
  const d = (zc - cam.eye * cam.sinP) / cam.cosP;
  if (d > 110) return null;
  const lat = (sx - W * 0.5) * zc / cam.FL;
  return { x: cam.x + cam.fx * d + cam.rx * lat, y: cam.y + cam.fy * d + cam.ry * lat };
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
const skyGrad = { key: '', ctx: null, g: null };
function drawSky(t, hour, dl) {
  const [top, bot] = skyCols(hour);
  // cached gradient (rebuild only when the hour bucket or horizon moves)
  const hz = Math.max(4, cam.horizon);
  const sk = `${Math.round(hour * 4)}|${Math.round(hz / 8)}`;
  let g = skyGrad.g;
  if (!g || skyGrad.key !== sk || skyGrad.ctx !== ctx) {
    g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    skyGrad.key = sk; skyGrad.ctx = ctx; skyGrad.g = g;
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, hz + 1);
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
  const R = 30;
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
      if (!c || c.d > 40) continue;
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
      if (g && (g.k === 'tree' || g.k === 'mango')) { // orchards keep their lawn
        tileQuad(x, y, mix(PAL.grass, hazeCol(dl), fogT(c.d)));
        continue;
      }
      if (g && GROUND_KEYS.has(g.k)) continue; // parks/crops/maidans painted by drawGroundSpecials
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
  const land = (xx, yy) => xx >= 0 && yy >= 0 && xx < MAP && yy < MAP && !S.terrain[yy][xx].w;
  if (!n && land(x, y - 1)) quad(edgeQuad(x, y, x, y - 1, 0.055), kerb);
  if (!s && land(x, y + 1)) quad(edgeQuad(x, y, x, y + 1, 0.055), kerb);
  if (!e && land(x + 1, y)) quad(edgeQuad(x, y, x + 1, y, 0.055), kerb);
  if (!w && land(x - 1, y)) quad(edgeQuad(x, y, x - 1, y, 0.055), kerb);
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

// ---------------- generic world quad with near-plane clipping ----------------
function clipNear(pts) {
  const NEAR = 0.14;
  const dp = (p) => (p[0] - cam.x) * cam.fx + (p[1] - cam.y) * cam.fy;
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const da = dp(a), db = dp(b);
    if (da >= NEAR) out.push(a);
    if ((da >= NEAR) !== (db >= NEAR)) {
      const f = (NEAR - da) / (db - da);
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
    }
  }
  return out.length >= 3 ? out : null;
}
function quad(pts, fill) {
  const cl = clipNear(pts);
  if (!cl) return null;
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < cl.length; i++) {
    const p = project(cl[i][0], cl[i][1], cl[i][2]);
    if (!p) return null;
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();
  return true;
}
function rgbaOf(col, a) {
  const m = col[0] === '#' ? [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)]
    : (col.match(/(\d+)[, ]+(\d+)[, ]+(\d+)/) || [0, 128, 128, 128]).slice(1).map(Number);
  return `rgba(${m[0]},${m[1]},${m[2]},${a})`;
}
function warmCol(col, dl) { return dl.warm > 0.04 ? mix(col, '#ff9d5c', dl.warm * 0.2) : col; }
// simple axis-aligned box (vehicles, tanks, stalls, chimneys…)
function box3d(x0, y0, x1, y1, z0, hh, color, dl, topCol) {
  const hz = dl ? hazeCol(dl) : '#000';
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const fog = fogT(Math.hypot(cx - cam.x, cy - cam.y));
  const f = (c) => mix(c, hz, fog);
  const lit = dl ? (0.4 + 0.6 * dl.amb) : 1;
  if (cam.y > y1) quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z0 + hh], [x0, y1, z0 + hh]], f(mix(shade(color, FACE_LIGHT.S * lit), '#141b30', (1 - (dl ? dl.amb : 1)) * 0.5)));
  if (cam.y < y0) quad([[x1, y0, z0], [x0, y0, z0], [x0, y0, z0 + hh], [x1, y0, z0 + hh]], f(mix(shade(color, FACE_LIGHT.N * lit), '#141b30', (1 - (dl ? dl.amb : 1)) * 0.5)));
  if (cam.x > x1) quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z0 + hh], [x1, y0, z0 + hh]], f(mix(shade(color, FACE_LIGHT.E * lit), '#141b30', (1 - (dl ? dl.amb : 1)) * 0.5)));
  if (cam.x < x0) quad([[x0, y1, z0], [x0, y0, z0], [x0, y0, z0 + hh], [x0, y1, z0 + hh]], f(mix(shade(color, FACE_LIGHT.W * lit), '#141b30', (1 - (dl ? dl.amb : 1)) * 0.5)));
  if (cam.eye > z0 + hh) quad([[x0, y0, z0 + hh], [x1, y0, z0 + hh], [x1, y1, z0 + hh], [x0, y1, z0 + hh]], f(shade(topCol || color, 1.06 * lit)));
}

// ---------------- buildings ----------------
const lights = []; // screen-space night lights, drained by nightPass()
function doorSide(x, y) {
  if (isRoadLike(x, y + 1)) return 'S';
  if (isRoadLike(x, y - 1)) return 'N';
  if (isRoadLike(x + 1, y)) return 'E';
  if (isRoadLike(x - 1, y)) return 'W';
  return 'S';
}
function deedableKind(k) {
  const d = BUILDINGS[k];
  if (!d) return null;
  if (d.cat === 'house' || d.homes) return 'home';
  if (d.cat === 'shop' || d.cat === 'work' || d.cat === 'civic' || d.cat === 'faith' || d.income || d.jobs) return 'shop';
  return null;
}
function drawBuilding3D(dr, env) {
  const { x, y, k, t, dl } = dr;
  const L = lookFor(k, dr.seed, dr.knobs);
  if (!L || !L.w) return;
  const inset = (1 - L.w) / 2;
  const x0 = x + inset, x1 = x + 1 - inset, y0 = y + inset, y1 = y + 1 - inset;
  const h = L.h;
  const night = env.dl.night;
  // contact shadow rim (sun sits SE, so the pool hugs the footprint)
  quad([[x0 - .05, y0 - .05, .004], [x1 + .07, y0 + .02, .004], [x1 + .02, y1 + .07, .004], [x0 - .07, y1 - .02, .004]], 'rgba(28,22,14,.2)');
  // visible side faces, farthest first
  const door = doorSide(x, y);
  const faces = [];
  if (cam.y > y1) faces.push({ id: 'S', a: [x0, y1], b: [x1, y1], d: cam.y - y1, lit: FACE_LIGHT.S, out: [0, 1] });
  if (cam.y < y0) faces.push({ id: 'N', a: [x1, y0], b: [x0, y0], d: y0 - cam.y, lit: FACE_LIGHT.N, out: [0, -1] });
  if (cam.x > x1) faces.push({ id: 'E', a: [x1, y0], b: [x1, y1], d: cam.x - x1, lit: FACE_LIGHT.E, out: [1, 0] });
  if (cam.x < x0) faces.push({ id: 'W', a: [x0, y1], b: [x0, y0], d: x0 - cam.x, lit: FACE_LIGHT.W, out: [-1, 0] });
  faces.sort((a, b) => b.d - a.d);
  for (const f of faces) drawWall(x, y, f, L, h, env, f.id === door);
  drawRoof(x, y, x0, y0, x1, y1, h, L, env);
  // hanging door plate — only when you are close to the door (plate discipline)
  const kind = deedableKind(k);
  if (kind) {
    const own = env.deedMap.get(x + ',' + y);
    const dist = Math.hypot(x + 0.5 - cam.x, y + 0.5 - cam.y);
    if (dist < 4.8) {
      const dp = doorWorld(x, y, door, inset);
      const p = project(dp[0], dp[1], Math.min(h * 0.86, 0.94));
      if (p) {
        const a = Math.max(0, Math.min(1, (4.8 - dist) / 1.4));
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        const sc = Math.max(0.5, Math.min(1.5, p.s * 0.05));
        ctx.scale(sc, sc);
        drawDoorPlate(ctx, 0, 0, own ? { owned: true, name: own.name, kind: own.kind } : { owned: false, kind }, t, night);
        ctx.restore();
        if (night) lights.push({ x: p.x, y: p.y + 6 * sc, r: 15 * sc, c: own ? 'rgba(120,255,170,.13)' : 'rgba(255,205,120,.11)' });
      }
    }
  }
}
function doorWorld(x, y, side, inset) {
  if (side === 'S') return [x + 0.5, y + 1 - inset + 0.02];
  if (side === 'N') return [x + 0.5, y + inset - 0.02];
  if (side === 'E') return [x + 1 - inset + 0.02, y + 0.5];
  return [x + inset - 0.02, y + 0.5];
}
// one wall from world a→b with windows, shopfront and door
function drawWall(x, y, f, L, h, env, doorHere) {
  const { dl, t, night } = env;
  const ax = f.a[0], ay = f.a[1], bx = f.b[0], by = f.b[1];
  const A = project(ax, ay, 0), B = project(bx, by, 0);
  if (!A || !B) return;
  const fog = fogT(A.d);
  const nightShade = (1 - dl.amb) * 0.55;
  const wallFill = mix(shade(mix(warmCol(L.wall, dl), '#1c2440', nightShade), f.lit * (0.5 + 0.5 * dl.amb)), hazeCol(dl), fog);
  quad([[ax, ay, 0], [bx, by, 0], [bx, by, h], [ax, ay, h]], wallFill);
  const ox = f.out[0] * 0.012, oy = f.out[1] * 0.012;
  const at = (u, v) => [ax + (bx - ax) * u + ox, ay + (by - ay) * u + oy, v];
  // windows (floors above the ground floor)
  if (L.floors && A.d < 26) {
    const len = Math.hypot(bx - ax, by - ay);
    const cols = Math.max(2, Math.min(5, Math.round(len * 3)));
    const bandH = (h - 0.4) / L.floors;
    for (let fl = 0; fl < L.floors; fl++) {
      const v0 = 0.38 + fl * bandH, v1 = v0 + bandH * 0.5;
      if (v1 > h - 0.06) break;
      for (let ci = 0; ci < cols; ci++) {
        const uw = (0.72 / cols) * 0.6;
        const u0 = 0.14 + (ci + 0.5) * (0.72 / cols) - uw / 2;
        const lit = nightShade > 0.2 && ((x * 31 + y * 17 + fl * 7 + ci * 13) % 10) < 5;
        const wc = lit ? PAL.windowLit : (L.glass ? mix(L.glass, '#123', 0.25) : PAL.windowDark);
        quad([at(u0, v0), at(u0 + uw, v0), at(u0 + uw, v1), at(u0, v1)], mix(wc, hazeCol(dl), fog));
        if (lit) {
          const mid = project((at(u0, v0)[0] + at(u0 + uw, v0)[0]) / 2, (at(u0, v0)[1] + at(u0 + uw, v0)[1]) / 2, (v0 + v1) / 2);
          if (mid && fl < 3) lights.push({ x: mid.x, y: mid.y, r: 9, c: 'rgba(255,196,100,.16)' });
        }
      }
    }
  }
  // ground floor: shopfront or plain door
  const isShop = L.shop && doorHere;
  if (isShop) {
    const front = mix(shade(mix('#3a3126', '#1c2440', nightShade), f.lit), hazeCol(dl), fog);
    quad([at(0.16, 0), at(0.84, 0), at(0.84, 0.52), at(0.16, 0.52)], front);
    // shutter slats
    for (let i = 1; i < 5; i++) {
      const v = i * 0.104;
      quad([at(0.16, v - 0.008), at(0.84, v - 0.008), at(0.84, v + 0.008), at(0.16, v + 0.008)], mix(shade(front, 1.35), hazeCol(dl), fog));
    }
    // signboard band
    quad([at(0.08, 0.6), at(0.92, 0.6), at(0.92, 0.82), at(0.08, 0.82)], mix('#1c2430', hazeCol(dl), fog));
    if (A.d < 14) {
      const cp = project((ax + bx) / 2 + ox * 2, (ay + by) / 2 + oy * 2, 0.71 * h);
      if (cp) {
        ctx.fillStyle = '#ffe9b8';
        ctx.font = `700 ${Math.max(7, Math.min(13, cp.s * 0.1))}px Outfit, system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(L.shop, cp.x, cp.y);
      }
    }
    if (night) lights.push({ x: A.x + (B.x - A.x) / 2, y: A.y + (B.y - A.y) / 2 - h * 0.6 * A.s, r: 24, c: 'rgba(255,210,130,.16)' });
  } else if (doorHere) {
    const dc = L.arch ? PAL.woodDark : (k2door(x, y) || PAL.teal);
    quad([at(0.4, 0), at(0.6, 0), at(0.6, 0.58), at(0.4, 0.58)], mix(shade(dc, f.lit), hazeCol(dl), fog));
    if (L.arch) quad([at(0.42, 0.58), at(0.58, 0.58), at(0.55, 0.68), at(0.45, 0.68)], mix(shade(dc, f.lit), hazeCol(dl), fog));
    quad([at(0.385, 0), at(0.4, 0), at(0.4, 0.6), at(0.385, 0.6)], mix(shade(PAL.wood, f.lit * 0.8), hazeCol(dl), fog));
    quad([at(0.6, 0), at(0.615, 0), at(0.615, 0.6), at(0.6, 0.6)], mix(shade(PAL.wood, f.lit * 0.8), hazeCol(dl), fog));
  }
  // awning over the shopfront
  if (isShop && L.awn) {
    const o = 0.16;
    const a0 = [ax + (bx - ax) * 0.1 - f.out[0] * o, ay + (by - ay) * 0.1 - f.out[1] * o];
    const a1 = [ax + (bx - ax) * 0.9 - f.out[0] * o, ay + (by - ay) * 0.9 - f.out[1] * o];
    quad([[a0[0], a0[1], 0.66 * h], [a1[0], a1[1], 0.66 * h], [a1[0] + f.out[0] * 0.001, a1[1] + f.out[1] * 0.001, 0.56 * h], [a0[0] + f.out[0] * 0.001, a0[1] + f.out[1] * 0.001, 0.56 * h]], mix(shade(L.awn, f.lit), hazeCol(dl), fog));
  }
}
function k2door(x, y) { // deterministic cheerful door colours per plot
  const cols = [PAL.teal, PAL.jodhpur, PAL.terracotta, PAL.jaipur];
  return cols[(x * 7 + y * 5) % 4];
}
function drawRoof(x, y, x0, y0, x1, y1, h, L, env) {
  const { dl, t } = env;
  const amb = 0.5 + 0.5 * dl.amb;
  const wallC = mix(warmCol(L.wall, dl), '#1c2440', (1 - dl.amb) * 0.55);
  switch (L.roofType) {
    case 'slab': {
      quad([[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], mix(shade(wallC, 1.05 * amb), hazeCol(dl), fogT(Math.hypot(x + .5 - cam.x, y + .5 - cam.y))));
      if (cam.y > y1) quad([[x0 - .02, y1 + .02, h], [x1 + .02, y1 + .02, h], [x1 + .02, y1 + .02, h + .07], [x0 - .02, y1 + .02, h + .07]], shade(wallC, 0.72 * amb));
      if (cam.x > x1) quad([[x1 + .02, y0 - .02, h], [x1 + .02, y1 + .02, h], [x1 + .02, y1 + .02, h + .07], [x1 + .02, y0 - .02, h + .07]], shade(wallC, 0.88 * amb));
      if (L.chhajja) { // the deep sun-shade ledge every old Indian house wears
        const o = 0.06, cz = h * 0.72;
        quad([[x0 - o, y0 - o, cz], [x1 + o, y0 - o, cz], [x1 + o, y1 + o, cz], [x0 - o, y1 + o, cz]], mix(shade(wallC, 0.9 * amb), hazeCol(dl), 0.2));
      }
      if (L.balcony) {
        const o = 0.05, cz = h * 0.5;
        quad([[x0 - o, y0 - o, cz], [x1 + o, y0 - o, cz], [x1 + o, y1 + o, cz], [x0 - o, y1 + o, cz]], mix(shade(wallC, 0.82 * amb), hazeCol(dl), 0.2));
      }
      if (L.tank) box3d(x + 0.26, y + 0.26, x + 0.44, y + 0.44, h + 0.07, 0.13, '#39404a', dl);
      break;
    }
    case 'hip': {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ah = h + (L.rh || 0.24);
      const rf = mix(warmCol(L.roof || PAL.terracotta, dl), '#1c2440', (1 - dl.amb) * 0.5);
      const fog = fogT(Math.hypot(cx - cam.x, cy - cam.y));
      if (cam.y > y1) quad([[x0, y1, h], [x1, y1, h], [cx, cy, ah]], mix(shade(rf, 0.95 * amb), hazeCol(dl), fog));
      if (cam.y < y0) quad([[x1, y0, h], [x0, y0, h], [cx, cy, ah]], mix(shade(rf, 0.66 * amb), hazeCol(dl), fog));
      if (cam.x > x1) quad([[x1, y0, h], [x1, y1, h], [cx, cy, ah]], mix(shade(rf, 0.86 * amb), hazeCol(dl), fog));
      if (cam.x < x0) quad([[x0, y1, h], [x0, y0, h], [cx, cy, ah]], mix(shade(rf, 0.74 * amb), hazeCol(dl), fog));
      if (L.garden) { // bungalow lawn corners
        quad([[x + 0.04, y + 0.72, 0.006], [x + 0.24, y + 0.72, 0.006], [x + 0.24, y + 0.94, 0.006], [x + 0.04, y + 0.94, 0.006]], '#7ba054');
        quad([[x + 0.76, y + 0.72, 0.006], [x + 0.96, y + 0.72, 0.006], [x + 0.96, y + 0.94, 0.006], [x + 0.76, y + 0.94, 0.006]], '#7ba054');
      }
      break;
    }
    case 'dome': {
      const p = project((x0 + x1) / 2, (y0 + y1) / 2, h);
      if (p) {
        const r = (L.dr || 0.3) * p.s;
        ctx.fillStyle = mix(shade(warmCol(L.domeCol || '#b3552e', dl), 0.9 * amb), hazeCol(dl), fogT(p.d));
        ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.8, 0, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.18, r, r * 0.42, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = mix(shade(warmCol(L.domeCol || '#b3552e', dl), 1.15 * amb), hazeCol(dl), fogT(p.d));
        ctx.beginPath(); ctx.ellipse(p.x - r * 0.25, p.y - r * 0.3, r * 0.3, r * 0.24, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = PAL.gold;
        ctx.beginPath(); ctx.arc(p.x, p.y - r * 0.85, Math.max(1, p.s * 0.016), 0, 7); ctx.fill();
      }
      break;
    }
    case 'spire': {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ah = h + (L.spire || 0.5);
      const rf = mix(warmCol(L.spireCol || PAL.gold, dl), '#1c2440', (1 - dl.amb) * 0.5);
      const fog = fogT(Math.hypot(cx - cam.x, cy - cam.y));
      if (cam.y > y1) quad([[x0, y1, h], [x1, y1, h], [cx, cy, ah]], mix(shade(rf, 0.98 * amb), hazeCol(dl), fog));
      if (cam.x > x1) quad([[x1, y0, h], [x1, y1, h], [cx, cy, ah]], mix(shade(rf, 0.82 * amb), hazeCol(dl), fog));
      if (cam.x < x0) quad([[x0, y1, h], [x0, y0, h], [cx, cy, ah]], mix(shade(rf, 0.7 * amb), hazeCol(dl), fog));
      if (cam.y < y0) quad([[x1, y0, h], [x0, y0, h], [cx, cy, ah]], mix(shade(rf, 0.62 * amb), hazeCol(dl), fog));
      break;
    }
    case 'canopy': { // petrol pump
      const cc = mix(warmCol(L.canopyCol, dl), '#1c2440', (1 - dl.amb) * 0.5);
      for (const [px, py] of [[x0 + .1, y0 + .1], [x1 - .1, y0 + .1], [x0 + .1, y1 - .1], [x1 - .1, y1 - .1]])
        box3d(px - .025, py - .025, px + .025, py + .025, 0, h * 0.9, '#90a4ae', dl);
      box3d(x0 - .04, y0 - .04, x1 + .04, y1 + .04, h * 0.9, h * 0.1, cc, dl);
      box3d(x + .3, y + .38, x + .4, y + .48, 0, 0.3, '#37474f', dl);
      box3d(x + .6, y + .38, x + .7, y + .48, 0, 0.3, '#37474f', dl);
      break;
    }
    case 'panels': {
      quad([[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], mix(shade('#3d5a78', 1.1 * amb), hazeCol(dl), 0.2));
      for (let i = 1; i < 4; i++) {
        const u = i / 4;
        quad([[x0 + (x1 - x0) * u, y0, h], [x0 + (x1 - x0) * u + 0.012, y0, h], [x0 + (x1 - x0) * u + 0.012, y1, h], [x0 + (x1 - x0) * u, y1, h]], 'rgba(180,220,255,.35)');
      }
      break;
    }
    case 'sawtooth': {
      const rf = mix(shade('#90a4ae', 0.95 * amb), hazeCol(dl), 0.15);
      const n = 3, w3 = (x1 - x0) / n;
      for (let i = 0; i < n; i++) {
        const a = x0 + i * w3;
        quad([[a, y0, h], [a + w3 * 0.7, y0, h + 0.14], [a + w3 * 0.7, y1, h + 0.14], [a, y1, h]], rf);
      }
      break;
    }
    case 'chimney': {
      box3d(x1 - 0.2, y0 + 0.06, x1 - 0.06, y0 + 0.2, h, 0.8, shade(PAL.terracottaDark, 0.9), dl);
      const p = project(x1 - 0.13, y0 + 0.13, h + 0.85);
      if (p && env.dl.amb > 0.4) {
        for (let i = 0; i < 3; i++) {
          const ph = ((t * 0.3 + i / 3) % 1);
          ctx.fillStyle = `rgba(120,120,128,${0.22 * (1 - ph)})`;
          ctx.beginPath(); ctx.arc(p.x + ph * 8, p.y - ph * 34, 2.5 + ph * 7, 0, 7); ctx.fill();
        }
      }
      break;
    }
    case 'tarp': { // jhuggi: sagging tarp + a proud little flag
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      quad([[x0, y0, h], [x1, y0, h], [cx, cy, h + 0.1], [x0, y1, h + 0.02]], mix(shade('#2e3844', 1.1 * amb), hazeCol(dl), 0.2));
      const pole = project(cx, cy, h + 0.42);
      const base = project(cx, cy, h + 0.02);
      if (pole && base) {
        ctx.strokeStyle = '#3b2f23'; ctx.lineWidth = Math.max(1, base.s * 0.006);
        ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(pole.x, pole.y); ctx.stroke();
        const fl = Math.sin(t * 3 + x) * 2;
        ctx.fillStyle = (x + y) % 2 ? '#d81b60' : '#4dd0e1';
        ctx.beginPath();
        ctx.moveTo(pole.x, pole.y); ctx.lineTo(pole.x + 7 + fl, pole.y + 2); ctx.lineTo(pole.x, pole.y + 5); ctx.closePath(); ctx.fill();
      }
      break;
    }
  }
  if (L.crown) { // corporate tower crown + beacon
    const cc = L.crownCol || PAL.saffron;
    quad([[x0 - .02, y0 - .02, h - .1], [x1 + .02, y0 - .02, h - .1], [x1 + .02, y1 + .02, h - .1], [x0 - .02, y1 + .02, h - .1]], mix(cc, hazeCol(dl), 0.2));
    const p = project((x0 + x1) / 2, (y0 + y1) / 2, h + 0.2);
    if (p) {
      const blink = Math.sin(t * 4) > 0.2;
      ctx.fillStyle = blink ? '#ff5252' : '#5c1a1a';
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.2, p.s * 0.014), 0, 7); ctx.fill();
      if (blink) lights.push({ x: p.x, y: p.y, r: 12, c: 'rgba(255,90,90,.3)' });
    }
  }
  if (L.fence) { // substation picket
    quad([[x0 - .03, y0 - .03, 0], [x1 + .03, y0 - .03, 0], [x1 + .03, y0 + .01, 0], [x0 - .03, y0 + .01, 0]].map(p => [p[0], p[1], 0.28]), mix(shade(PAL.slate, 1.1), hazeCol(dl), 0.2));
  }
  if (L.stalls) { // bazaar stall canopies out front
    const door = doorSide(x, y);
    const dw = doorWorld(x, y, door, (1 - L.w) / 2);
    const off = 0.28;
    const sx = dw[0] + (door === 'S' ? -0.16 : door === 'N' ? 0.1 : 0);
    const sy = dw[1] + (door === 'S' ? 0.16 : door === 'N' ? -0.16 : door === 'E' ? -0.16 : 0.1);
    box3d(sx - .12, sy - .12, sx + .12, sy + .12, 0.42, 0.08, off % 1 ? '#c4553a' : '#c4553a', dl, '#e8850c');
    box3d(sx - .1, sy - .1, sx + .1, sy + .1, 0, 0.42, '#8a6242', dl);
  }
}

// ---------------- ground-key extras & billboards ----------------
const GROUND_KEYS = new Set(['park', 'maidan', 'mela', 'wheat', 'paddy', 'flower', 'tree', 'mango', 'lamp', 'flag']);
const sprites = new Map();
function mkSprite(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'));
  return cv;
}
function treeSpriteSync(seed, season) {
  const key = 'tree' + (seed % 5) + season;
  let s = sprites.get(key);
  if (!s) {
    s = mkSprite(76, 96, (c) => drawTree(c, 38, 88, seed % 5, season));
    sprites.set(key, s);
  }
  return s;
}
function personSprite(a) {
  // v5.2: drawPerson is a plan-mode pixel sketch (~13px tall) — render it
  // enlarged inside the sprite canvas or street people are invisible specks
  const key = `p|${a.type}|${a.col}|${a.skin}|${a.pot ? 1 : 0}`;
  let s = sprites.get(key);
  if (!s) {
    s = mkSprite(96, 184, (c) => {
      c.translate(48, 172); c.scale(9.8, 9.8);
      drawPerson(c, 0, 0, { ...a, scale: 1, ph: 0.7, emote: null }, 0);
    });
    sprites.set(key, s);
  }
  return s;
}
function cowSprite(seed) {
  const key = 'cow' + (seed % 3);
  let s = sprites.get(key);
  if (!s) {
    s = mkSprite(128, 96, (c) => {
      c.translate(64, 88); c.scale(6, 6);
      drawCow(c, 0, 0, 0, seed % 3);
    });
    sprites.set(key, s);
  }
  return s;
}
function drawBillSprite(p, spr, worldH, fogMax = 0.75) {
  const hpx = worldH * p.s;
  if (hpx < 2.5) return;
  const fog = Math.min(fogMax, fogT(p.d));
  const iw = hpx * (spr.width / spr.height);
  ctx.globalAlpha = 1 - fog;
  ctx.drawImage(spr, p.x - iw / 2, p.y - hpx, iw, hpx);
  ctx.globalAlpha = 1;
}

function drawTreeShadow(wx, wy) {
  quad([[wx - .16, wy + .08, .004], [wx + .16, wy + .08, .004], [wx + .1, wy + .2, .004], [wx - .1, wy + .2, .004]], 'rgba(28,22,14,.14)');
}

// ---------------- drawables & passes ----------------
const drawables = [];
function collectBuildings(bb, env) {
  for (let y = bb.y0; y <= bb.y1; y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      const g = S.grid[y] && S.grid[y][x];
      if (!g) continue;
      const c = project(x + 0.5, y + 0.5, 0);
      if (!c || c.d > 38) continue;
      if (g.k === 'tree' || g.k === 'mango') {
        drawables.push({ type: 'tree', d: c.d, wx: x + 0.5, wy: y + 0.5, seed: g.seed, season: env.season });
      } else if (g.k === 'lamp') {
        drawables.push({ type: 'lamp', d: c.d, wx: x + 0.5, wy: y + 0.5 });
      } else if (g.k === 'flag') {
        drawables.push({ type: 'flag', d: c.d, wx: x + 0.5, wy: y + 0.5, seed: g.seed });
      } else if (!GROUND_KEYS.has(g.k)) {
        drawables.push({ type: 'box', d: c.d, x, y, k: g.k, seed: g.seed, knobs: g.knobs || null });
      }
      if (g.k === 'park') drawables.push({ type: 'tree', d: c.d + 0.01, wx: x + 0.5, wy: y + 0.5, seed: g.seed, season: env.season });
      // street lamps live on road corners too (same rule as plan view)
      if (g.k === 'road' && (x * 3 + y * 7) % 6 === 0) {
        drawables.push({ type: 'lamp', d: c.d, wx: x + 0.82, wy: y + 0.82 });
      }
    }
  }
}
function collectAgents(env) {
  for (const a of getAgents()) {
    const c = project(a.x, a.y, 0);
    if (!c || c.d > 30) continue;
    if (a.kind === 'vehicle' && a.vkind !== 'cycle' && a.vkind !== 'bullock') drawables.push({ type: 'veh', d: c.d, a });
    else if (a.kind === 'vehicle' && a.vkind === 'bullock') drawables.push({ type: 'bill', d: c.d, wx: a.x, wy: a.y, spr: cowSprite(2), h: 0.72 });
    else if (a.kind === 'vehicle') drawables.push({ type: 'bill', d: c.d, wx: a.x, wy: a.y, spr: personSprite({ type: 'kurta', col: a.riderCol || '#37474f', skin: 1 }), h: 1.0 });
    else if (a.kind === 'cow') drawables.push({ type: 'bill', d: c.d, wx: a.x, wy: a.y, spr: cowSprite(a.ph || 1), h: 0.62 });
    else drawables.push({ type: 'bill', d: c.d, wx: a.x, wy: a.y, spr: personSprite(a), h: 1.3 * (a.scale || 1) });
  }
}
function collectWalkers(env) {
  for (const w of getWalkers()) {
    const c = project(w.x, w.y, 0);
    if (!c || c.d > 28) continue;
    drawables.push({ type: 'walker', d: c.d, w, spr: personSprite(w) });
  }
  // YOU — the visible walker the camera follows (issue #24)
  const pl = getPlayer();
  const pc = project(pl.x, pl.y, 0);
  if (pc && pc.d > 0.4 && pc.d < 30) drawables.push({ type: 'walker', d: pc.d, w: pl, spr: personSprite(pl), isPlayer: true });
}
function drawLamp(dr, env) {
  const { dl } = env;
  const p = project(dr.wx, dr.wy, 0);
  if (!p) return;
  box3d(dr.wx - 0.025, dr.wy - 0.025, dr.wx + 0.025, dr.wy + 0.025, 0, 1.9, '#3a424c', dl);
  const top = project(dr.wx, dr.wy, 1.98);
  if (!top) return;
  const headR = Math.max(1.5, top.s * 0.02);
  ctx.fillStyle = dl.night ? '#ffe082' : mix('#90a4ae', hazeCol(dl), 0.3);
  ctx.beginPath(); ctx.arc(top.x, top.y, headR, 0, 7); ctx.fill();
  if (dl.night) {
    lights.push({ x: top.x, y: top.y, r: 34, c: 'rgba(255,214,130,.22)' });
    const g = project(dr.wx, dr.wy, 0.01);
    if (g) lights.push({ x: g.x, y: g.y, r: 20, c: 'rgba(255,214,130,.10)' });
  }
}
function drawFlag(dr, env) {
  const { dl, t } = env;
  box3d(dr.wx - 0.02, dr.wy - 0.02, dr.wx + 0.02, dr.wy + 0.02, 0, 2.2, '#4a545e', dl);
  const top = project(dr.wx, dr.wy, 2.15);
  if (!top) return;
  const wv = Math.sin(t * 2.6 + dr.seed) * 2.4;
  const fw = Math.max(10, top.s * 0.09), fh = fw * 0.62;
  const bands = [PAL.saffron, '#ffffff', '#128807'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = bands[i];
    ctx.beginPath();
    ctx.moveTo(top.x + 1, top.y - fh / 2 + (i * fh) / 3);
    ctx.lineTo(top.x + 1 + fw + wv, top.y - fh / 2 + (i * fh) / 3 + fh * 0.1);
    ctx.lineTo(top.x + 1 + fw + wv, top.y - fh / 2 + ((i + 1) * fh) / 3);
    ctx.lineTo(top.x + 1, top.y - fh / 2 + ((i + 1) * fh) / 3);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#00007a';
  ctx.beginPath(); ctx.arc(top.x + 1 + fw / 2 + wv / 2, top.y, fh * 0.1, 0, 7); ctx.fill();
}
function drawVehicle3D(dr, env) {
  const a = dr.a;
  const { dl } = env;
  // lane vectors from agents.js (persisted), fall back to the move delta
  const mdx = a.mdx != null ? a.mdx : (a.tx || a.x) - a.x;
  const mdy = a.mdy != null ? a.mdy : (a.ty || a.y) - a.y;
  const horiz = Math.abs(mdx) >= Math.abs(mdy);
  const dims = { car: [0.58, 0.3, 0.26], taxi: [0.58, 0.3, 0.26], auto: [0.42, 0.28, 0.3], bus: [1.0, 0.36, 0.5], truck: [0.92, 0.34, 0.46] }[a.vkind] || [0.58, 0.3, 0.26];
  let [L, Wd, Hh] = dims;
  const x0 = a.x - (horiz ? L : Wd) / 2, x1 = a.x + (horiz ? L : Wd) / 2;
  const y0 = a.y - (horiz ? Wd : L) / 2, y1 = a.y + (horiz ? Wd : L) / 2;
  // shadow
  quad([[x0 + .03, y0 + .05, 0.003], [x1 + .05, y0 + .08, 0.003], [x1 + .03, y1 + .06, 0.003], [x0, y1 + .03, 0.003]], 'rgba(20,16,10,.2)');
  const bodyCol = a.vkind === 'taxi' ? '#fdd835' : a.vkind === 'bus' ? '#c62828' : a.vkind === 'truck' ? '#e8850c' : a.bodyCol || '#c62828';
  box3d(x0, y0, x1, y1, 0.06, Hh, bodyCol, dl);
  // cabin toward the rear (forward = the lane direction)
  const fwd = (horiz ? Math.sign(mdx) : Math.sign(mdy)) || a.dir || 1;
  const cx0 = horiz ? x0 + (fwd > 0 ? L * 0.08 : L * 0.42) : x0 + 0.06;
  const cx1 = horiz ? x0 + (fwd > 0 ? L * 0.58 : L * 0.92) : x1 - 0.06;
  const cy0 = !horiz ? y0 + (fwd > 0 ? L * 0.08 : L * 0.42) : y0 + 0.05;
  const cy1 = !horiz ? y0 + (fwd > 0 ? L * 0.58 : L * 0.92) : y1 - 0.05;
  const cabCol = a.vkind === 'taxi' ? '#212121' : a.vkind === 'auto' ? '#fdd835' : shade(bodyCol, 0.8);
  box3d(cx0, cy0, cx1, cy1, 0.06 + Hh, 0.15, cabCol, dl, shade(bodyCol, 0.9));
  // glass band
  box3d(cx0 + 0.02, cy0 + 0.02, cx1 - 0.02, cy1 - 0.02, 0.06 + Hh, 0.1, mix('#b3e5fc', '#39434e', dl.night ? 0.6 : 0.1), dl);
  if (dl.night && dr.d < 18) {
    // headlights + tail lights + a pool of light on the road ahead
    const fx = horiz ? (fwd > 0 ? x1 : x0) : a.x;
    const fy = horiz ? a.y : (fwd > 0 ? y1 : y0);
    const hp = project(fx, fy, 0.22);
    if (hp) {
      ctx.fillStyle = 'rgba(255,244,200,.95)';
      ctx.beginPath(); ctx.arc(hp.x - 3, hp.y, 1.6, 0, 7); ctx.arc(hp.x + 3, hp.y, 1.6, 0, 7); ctx.fill();
      lights.push({ x: hp.x, y: hp.y, r: 22, c: 'rgba(255,240,180,.28)' });
      const bx0 = fx + (horiz ? (fwd > 0 ? 0.05 : -1.45) : -0.2);
      const by0 = fy + (horiz ? -0.2 : (fwd > 0 ? 0.05 : -1.45));
      const bx1 = bx0 + (horiz ? 1.4 : 0.4);
      const by1 = by0 + (horiz ? 0.4 : 1.4);
      quad([[bx0, by0, 0.01], [bx1, by0, 0.01], [bx1, by1, 0.01], [bx0, by1, 0.01]], 'rgba(255,240,190,.09)');
    }
    const tx = horiz ? (fwd > 0 ? x0 : x1) : a.x;
    const ty = horiz ? a.y : (fwd > 0 ? y0 : y1);
    const tp = project(tx, ty, 0.22);
    if (tp) {
      ctx.fillStyle = 'rgba(255,70,70,.9)';
      ctx.beginPath(); ctx.arc(tp.x - 2.4, tp.y, 1.1, 0, 7); ctx.arc(tp.x + 2.4, tp.y, 1.1, 0, 7); ctx.fill();
    }
  }
}
function drawWalker(dr, env) {
  const { w } = dr;
  const t = env.t;
  const p = project(w.x, w.y, 0);
  if (!p) return;
  const bobP = w.moving ? Math.abs(Math.sin(w.ph || 0)) * 0.05 : 0; // walk bounce
  // v5.2 fix: drawBillSprite takes WORLD units (it multiplies by p.s itself) —
  // the old code passed pixels here, double-scaling every street person
  const worldH = 1.7 * (w.scale || 1) * (1 + bobP); // sprite canvas ≈ 1.25-lot person
  const hpx = worldH * p.s;
  if (hpx < 2.5) return;
  ctx.fillStyle = 'rgba(0,0,0,.17)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, hpx * 0.14, hpx * 0.05, 0, 0, 7); ctx.fill();
  drawBillSprite(p, dr.spr, worldH, 0.6);
  if (dr.isPlayer || p.d < 8.5) {
    drawTag(p.x, p.y - hpx - 9, dr.isPlayer ? 'You' : (w.name || ''));
  }
  if (w.emote) emoteBubble(p.x, p.y - hpx - 26, w.emote, t);
}
function drawTag(x, y, text) {
  ctx.save();
  ctx.font = '700 10px Outfit, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(16,13,8,.74)';
  ctx.beginPath();
  const r = 8, h = 16;
  ctx.moveTo(x - w / 2 + r, y - h / 2);
  ctx.arcTo(x + w / 2, y - h / 2, x + w / 2, y + h / 2, r);
  ctx.arcTo(x + w / 2, y + h / 2, x - w / 2, y + h / 2, r);
  ctx.arcTo(x - w / 2, y + h / 2, x - w / 2, y - h / 2, r);
  ctx.arcTo(x - w / 2, y - h / 2, x + w / 2, y - h / 2, r);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd9a3';
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}
function emoteBubble(x, y, kind, t) {
  const pop = Math.min(1, ((t * 1) % 1) * 8);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  ctx.fillStyle = 'rgba(255,250,241,.96)';
  ctx.strokeStyle = 'rgba(36,28,18,.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4, 11); ctx.lineTo(0, 17); ctx.lineTo(4, 11); ctx.closePath(); ctx.fill();
  if (kind === 'heart') {
    ctx.fillStyle = '#e0304e';
    ctx.beginPath(); ctx.moveTo(0, 5);
    ctx.bezierCurveTo(-7, 0, -5, -6, 0, -2.5);
    ctx.bezierCurveTo(5, -6, 7, 0, 0, 5); ctx.fill();
  } else if (kind === 'diya') {
    ctx.fillStyle = '#b45309';
    ctx.beginPath(); ctx.ellipse(0, 3.5, 6.5, 2.6, 0, 0, 7); ctx.fill();
    const fl = Math.sin(t * 9) * 0.8;
    ctx.fillStyle = '#ff9800';
    ctx.beginPath(); ctx.ellipse(fl, -1.5, 2.2, 3.6, 0, 0, 7); ctx.fill();
  } else if (kind === 'wave') {
    ctx.strokeStyle = '#f5b880'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2, 5); ctx.lineTo(-2, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(-3, -7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, -2); ctx.lineTo(3.5, -6); ctx.stroke();
  } else if (kind === 'namaste') {
    ctx.strokeStyle = '#c98850'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(-2, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, 5); ctx.lineTo(2, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(0, 6.5); ctx.lineTo(5, 5); ctx.stroke();
  }
  ctx.restore();
}

// ---------------- post passes ----------------
// one cached radial glow sprite per colour — replaces hundreds of per-frame
// createRadialGradient calls (the single biggest street-mode frame cost)
const glowSprites = new Map();
function glowSprite(col) {
  let s = glowSprites.get(col);
  if (!s) {
    if (glowSprites.size > 28) { glowSprites.clear(); } // flicker variants recycle
    s = mkSprite(128, 128, (c) => {
      const rg = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg; c.fillRect(0, 0, 128, 128);
    });
    glowSprites.set(col, s);
  }
  return s;
}
function nightPass(dl) {
  ctx.fillStyle = `rgba(10,14,40,${Math.max(0, (1 - dl.amb) * 0.42)})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const step = Math.max(1, Math.ceil(lights.length / 240));
  for (let i = 0; i < lights.length; i += step) {
    const l = lights[i];
    const spr = glowSprite(l.c);
    ctx.drawImage(spr, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}
const hazeGrads = new Map(); // key → {ctx, g}
function horizonHaze(dl) {
  const c = hazeCol(dl);
  const hk = `${Math.round(hourOfDay() * 4)}|${Math.round(cam.horizon / 8)}`;
  let e = hazeGrads.get(hk);
  if (!e || e.ctx !== ctx) {
    const g = ctx.createLinearGradient(0, cam.horizon - H * 0.13, 0, cam.horizon + H * 0.09);
    g.addColorStop(0, rgbaOf(c, 0));
    g.addColorStop(0.55, rgbaOf(c, 0.5));
    g.addColorStop(1, rgbaOf(c, 0));
    e = { ctx, g };
    if (hazeGrads.size > 24) hazeGrads.clear();
    hazeGrads.set(hk, e);
  }
  ctx.fillStyle = e.g;
  ctx.fillRect(0, cam.horizon - H * 0.13, W, H * 0.23);
}
let rainDrops = null;
function weather(season, t, dl) {
  if (season === 'monsoon') {
    if (!rainDrops) rainDrops = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }));
    ctx.strokeStyle = 'rgba(180,205,235,.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of rainDrops) {
      d.y += 0.028 * d.s; d.x += 0.004;
      if (d.y > 1) { d.y = -0.05; d.x = Math.random(); }
      const px = d.x * W, py = d.y * H;
      ctx.moveTo(px, py); ctx.lineTo(px - 3, py + 12 * d.s);
    }
    ctx.stroke();
  } else if (season === 'winter') {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, 'rgba(235,238,240,0)');
    g.addColorStop(1, 'rgba(235,238,240,.32)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else if (season === 'summer') {
    ctx.fillStyle = `rgba(255,150,40,${0.05 * dl.amb})`;
    ctx.fillRect(0, 0, W, H);
  }
}
function festivalPass(t, id, dl) {
  if (id === 'diwali') {
    // diyas lining the kerbs near you
    const bb = groundBounds();
    for (let y = bb.y0; y <= bb.y1; y += 2) for (let x = bb.x0; x <= bb.x1; x += 2) {
      if (!isRoadLike(x, y)) continue;
      const p = project(x + 0.5, y + 0.86, 0.02);
      if (!p || p.d > 15) continue;
      const fl = 0.6 + 0.4 * Math.sin(t * 7 + x * 3 + y);
      ctx.fillStyle = `rgba(255,${Math.round(150 + fl * 60)},60,.95)`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.7, 0, 7); ctx.fill();
      lights.push({ x: p.x, y: p.y, r: 13, c: `rgba(255,170,60,${0.18 * fl})` });
    }
  } else if (id === 'eid') {
    for (let i = 0; i < 5; i++) {
      const ph = (t * 0.05 + i / 5) % 1;
      const x = W * (0.12 + 0.19 * i) + Math.sin(t + i) * 8;
      const y = cam.horizon * 0.7 - ph * H * 0.25;
      ctx.fillStyle = ['#f57f17', '#00897b', '#c62828', '#7b1fa2', '#e8850c'][i];
      ctx.beginPath(); ctx.ellipse(x, y, 4.5, 6, 0, 0, 7); ctx.fill();
      lights.push({ x, y, r: 16, c: 'rgba(255,190,90,.2)' });
    }
  } else if (id === 'holi' && Math.random() < 0.03) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = ['#d81b60', '#f57f17', '#00897b', '#7b1fa2'][Math.floor(Math.random() * 4)];
    ctx.beginPath(); ctx.ellipse(Math.random() * W, H * (0.3 + Math.random() * 0.5), 30, 12, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ---------------- main entry ----------------
export function fpvRender(now) {
  if (!vctx || !S.grid.length) return;
  const t = now / 1000;
  const hour = hourOfDay();
  const dl0 = daylight(hour);
  // v5.2: the streets stay readable after dark — raised ambient floor in walk
  // mode only (plan view keeps the real IST mood untouched)
  const dl = dl0.night ? { ...dl0, amb: Math.max(dl0.amb, 0.46) } : dl0;
  const season = seasonOf(S.day).id;
  const festival = S.festival ? S.festival.id : null;
  lights.length = 0;
  // v5.2: the toy-town lens stays in PLAN mode — street level draws straight
  // to the canvas (crisper, and skips three full-frame blur round trips)
  const lens = isLensOn() && S.mode === 'plan';
  ctx = lens ? (lensBegin(W, H, dpr) || vctx) : vctx;
  updateCam(t);

  drawSky(t, hour, dl);
  drawables.length = 0;
  const bb = groundBounds();
  // ground-key colours (parks, crops, maidans) painted in the ground pass
  drawGroundSpecials(bb, dl, season);
  drawGround(t, dl, season);
  const env = { t, dl, season, festival, night: dl.night };
  env.deedMap = new Map();
  for (const d of deeds()) for (const kind of ['home', 'shop']) {
    if (!d[kind]) continue;
    const [tx, ty] = d[kind].split(',').map(Number);
    if (Number.isFinite(tx)) env.deedMap.set(tx + ',' + ty, { name: d.name, kind });
  }
  collectBuildings(bb, env);
  collectAgents(env);
  collectWalkers(env);
  drawables.sort((a, b) => b.d - a.d);
  for (const dr of drawables) {
    if (dr.type === 'box') drawBuilding3D({ ...dr, t }, env);
    else if (dr.type === 'tree') { const p = project(dr.wx, dr.wy, 0); if (p) { drawTreeShadow(dr.wx, dr.wy); drawBillSprite(p, treeSpriteSync(dr.seed, dr.season), 2.0); } }
    else if (dr.type === 'bill') { const p = project(dr.wx, dr.wy, 0); if (p && dr.h > 0) drawBillSprite(p, dr.spr, dr.h); }
    else if (dr.type === 'lamp') drawLamp(dr, env);
    else if (dr.type === 'flag') drawFlag(dr, env);
    else if (dr.type === 'veh') drawVehicle3D(dr, env);
    else if (dr.type === 'walker') drawWalker(dr, env);
  }
  horizonHaze(dl);
  if (dl.night || dl.amb < 0.6) nightPass(dl);
  if (festival) festivalPass(t, festival, dl);
  weather(season, t, dl);
  if (lens) {
    setLensBand(Math.max(0.24, Math.min(0.78, cam.horizon / H)), 0.42, Math.sin(cam.yaw) * 0.03);
    lensCompose(vctx, { night: dl.night });
  }
}
// parks, maidans, crops and mela grounds — painted flat in the ground pass
function drawGroundSpecials(bb, dl, season) {
  for (let y = bb.y0; y <= bb.y1; y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      const g = S.grid[y] && S.grid[y][x];
      if (!g) continue;
      const c = project(x + 0.5, y + 0.5, 0);
      if (!c || c.d > 36) continue;
      const L = LOOKS[g.k];
      if (!L) continue;
      if (L.roofType === 'ground') {
        tileQuad(x, y, mix(L.groundCol, hazeCol(dl), fogT(c.d)));
        if (L.pitch) {
          quad([[x + .2, y + .2, .006], [x + .8, y + .2, .006], [x + .8, y + .8, .006], [x + .2, y + .8, .006]], 'rgba(255,255,255,.16)');
        }
      } else if (L.roofType === 'crop') {
        tileQuad(x, y, mix(L.cropCol, hazeCol(dl), fogT(c.d)));
        if (c.d < 16) {
          const rowC = 'rgba(0,0,0,.08)';
          for (let i = 0; i < 3; i++) {
            const o = 0.2 + i * 0.25;
            quad([[x + .08, y + o, .006], [x + .92, y + o, .006], [x + .92, y + o + .05, .006], [x + .08, y + o + .05, .006]], rowC);
          }
        }
      }
    }
  }
}

