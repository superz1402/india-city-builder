// render.js — draws one full frame: sky, terrain, depth-sorted buildings and
// agents, night-light pass, weather, festival effects, and the build ghost.
// v2: camera-yaw aware (drag to look around), street-level walk mode with
// your avatar, named residents with name tags, and emote bubbles.

import { S, MAP, gridAt } from './state.js';
import { TW, TH, cam, isoOf, screenToWorld, worldToScreen } from './iso.js';
import { drawBuilding, drawPerson, drawCow, drawVehicle, lights, beginFrame, setLightOrigin } from './arts.js';
import { isNight, hourOfDay, seasonOf } from './sim.js';
import { getAgents } from './agents.js';
import { getPlayer, getWalkers, walkActive } from './walk.js';

let ctx = null, canvas = null, W = 0, H = 0, dpr = 1;
let ghost = null; // {key, x, y, ok}
export function setGhost(g) { ghost = g; }

const fxCtx = { particles: [], splashes: [] };

export function initRender(c) {
  canvas = c; ctx = c.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

export function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function skyColors(h) {
  // keyframed by REAL IST hour: [night, dawn, noon, dusk]
  const keys = [
    [0, [13, 18, 44]], [5.5, [13, 18, 44]], [7, [255, 183, 128]], [10, [168, 214, 235]],
    [16, [168, 214, 235]], [18.5, [244, 150, 90]], [20, [58, 48, 90]], [21.5, [13, 18, 44]], [24, [13, 18, 44]],
  ];
  for (let i = 0; i < keys.length - 1; i++) {
    if (h >= keys[i][0] && h <= keys[i + 1][0]) {
      const f = (h - keys[i][0]) / (keys[i + 1][0] - keys[i][0] || 1);
      const a = keys[i][1], b = keys[i + 1][1];
      return a.map((v, j) => Math.round(v + (b[j] - v) * f));
    }
  }
  return [13, 18, 44];
}

export function render(now) {
  const t = now / 1000;
  const night = isNight();
  const hour = hourOfDay();
  const season = seasonOf(S.day).id;
  const festival = S.festival ? S.festival.id : null;
  beginFrame();

  // ---- sky (real IST hour drives it) ----
  const [r, g, b] = skyColors(hour);
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, `rgb(${r},${g},${b})`);
  grd.addColorStop(1, `rgb(${Math.round(r * 0.82 + 20)},${Math.round(g * 0.82 + 24)},${Math.round(b * 0.82 + 18)})`);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // ---- visible tile bounds (corner mapping is rotation-safe) ----
  const corners = [screenToWorld(0, 0), screenToWorld(W, 0), screenToWorld(0, H), screenToWorld(W, H)];
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const c of corners) {
    const fx = (c.x / (TW / 2) + c.y / (TH / 2)) / 2;
    const fy = (c.y / (TH / 2) - c.x / (TW / 2)) / 2;
    minX = Math.min(minX, fx); maxX = Math.max(maxX, fx);
    minY = Math.min(minY, fy); maxY = Math.max(maxY, fy);
  }
  const x0 = Math.max(0, Math.floor(minX) - 3), x1 = Math.min(MAP - 1, Math.ceil(maxX) + 3);
  const y0 = Math.max(0, Math.floor(minY) - 3), y1 = Math.min(MAP - 1, Math.ceil(maxY) + 4);

  // ---- terrain pass + collect depth-sorted drawables ----
  // v2 sort key: screen y after camera yaw — correct painter order at any orbit.
  const drawables = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = isoOf(x, y);
      const p = worldToScreen(i.x, i.y + TH / 2);
      const tv = S.terrain[y] && S.terrain[y][x];
      if (!tv) continue;
      if (tv.w) {
        const shimmer = 0.5 + 0.5 * Math.sin(t * 1.8 + tv.v);
        ctx.fillStyle = `rgb(${58 + shimmer * 14},${122 + shimmer * 10},${158 + shimmer * 12})`;
        diamond(p.x, p.y); ctx.fill();
      } else {
        const g = 148 + (tv.v % 5) * 7;
        ctx.fillStyle = `rgb(${g + 24},${g + 22},${(tv.v % 3) * 6 + 84})`;
        diamond(p.x, p.y); ctx.fill();
      }
      const gd = gridAt(x, y);
      if (gd) drawables.push({ sy: p.y, k: gd.k, x, y, sd: gd.seed, kb: gd.knobs || null });
    }
  }

  // ---- ambient agents (people, vehicles, cows) ----
  const agents = getAgents();
  for (const a of agents) {
    const i = isoOf(a.x, a.y);
    const p = worldToScreen(i.x, i.y + TH / 2);
    if (p.x < -60 || p.x > W + 60 || p.y < -80 || p.y > H + 80) continue;
    drawables.push({ sy: p.y + 0.5, agent: a, sx: p.x, sy2: p.y });
  }

  // ---- walk mode: you + named residents ----
  const walking = walkActive();
  if (walking) {
    const pl = getPlayer();
    const pi = isoOf(pl.x, pl.y);
    const pp = worldToScreen(pi.x, pi.y + TH / 2);
    drawables.push({ sy: pp.y + 0.6, person: pl, sx: pp.x, sy2: pp.y, isPlayer: true });
    for (const w of getWalkers()) {
      const wi = isoOf(w.x, w.y);
      const wp = worldToScreen(wi.x, wi.y + TH / 2);
      if (wp.x < -60 || wp.x > W + 60 || wp.y < -80 || wp.y > H + 80) continue;
      drawables.push({ sy: wp.y + 0.6, person: w, sx: wp.x, sy2: wp.y, name: w.name });
    }
  }

  // ---- sort & draw world objects ----
  drawables.sort((a, b) => a.sy - b.sy);
  const env = { t, night, season, festival, seed: 0 };
  for (const dr of drawables) {
    if (dr.agent) {
      const a = dr.agent;
      ctx.save();
      ctx.translate(dr.sx, dr.sy2);
      ctx.scale(cam.z, cam.z);
      setLightOrigin(dr.sx, dr.sy2, cam.z);
      if (a.kind === 'cow') drawCow(ctx, 0, 0, t, a.ph);
      else if (a.kind === 'person') drawPerson(ctx, 0, 0, a, t);
      else drawVehicle(ctx, 0, 0, a, t, night);
      ctx.restore();
    } else if (dr.person) {
      const a = dr.person;
      ctx.save();
      ctx.translate(dr.sx, dr.sy2);
      ctx.scale(cam.z, cam.z);
      setLightOrigin(dr.sx, dr.sy2, cam.z);
      drawPerson(ctx, 0, 0, a, t);
      ctx.restore();
      if (a.emote) drawEmoteBubble(dr.sx, dr.sy2 - 34 * cam.z, a.emote, t);
      if (dr.isPlayer) drawNameTag(dr.sx, dr.sy2 - 46 * cam.z, 'You', true);
      else if (dr.name) drawNameTag(dr.sx, dr.sy2 - 46 * cam.z, dr.name, false);
    } else {
      const i = isoOf(dr.x, dr.y);
      const p = worldToScreen(i.x, i.y);
      env.seed = dr.sd;
      env.knobs = dr.kb;
      setLightOrigin(p.x, p.y, cam.z);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(cam.z, cam.z);
      drawBuilding(ctx, dr.k, 0, 0, env);
      ctx.restore();
    }
  }

  // ---- night pass (lights are screen-space, collected during draws) ----
  if (night) {
    if (festival) festivalNight(t);
    const na = hour >= 19.5 || hour < 5 ? 0.5 : 0.3;
    ctx.fillStyle = `rgba(12,16,52,${na})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const rg = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * Math.max(0.7, cam.z * 0.8));
      rg.addColorStop(0, l.c); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(l.x, l.y, l.r * Math.max(0.7, cam.z * 0.8), 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- festival effects ----
  if (festival) festivalDay(t);

  // ---- weather ----
  if (season === 'monsoon') rain(t);
  if (season === 'winter') fog();
  if (season === 'summer') { ctx.fillStyle = 'rgba(255,150,40,.05)'; ctx.fillRect(0, 0, W, H); }

  // ---- build ghost (plan mode only) ----
  if (ghost && ghost.x != null) {
    const i = isoOf(ghost.x, ghost.y);
    const p = worldToScreen(i.x, i.y);
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = ghost.ok ? 'rgba(46,204,113,.30)' : 'rgba(231,76,60,.30)';
    diamond(p.x, p.y + TH / 2 * cam.z); ctx.fill();
    ctx.strokeStyle = ghost.ok ? '#2ecc71' : '#e74c3c';
    ctx.lineWidth = 2; diamond(p.x, p.y + TH / 2 * cam.z); ctx.stroke();
    if (ghost.ok && ghost.key !== '__bulldoze') {
      setLightOrigin(p.x, p.y, cam.z);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(cam.z, cam.z);
      drawBuilding(ctx, ghost.key, 0, 0, { t, night, season, festival, seed: (ghost.x * 31 + ghost.y * 17) % 97 });
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

function diamond(cx, cy) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - TH / 2); ctx.lineTo(cx + TW / 2, cy);
  ctx.lineTo(cx, cy + TH / 2); ctx.lineTo(cx - TW / 2, cy);
  ctx.closePath();
}

// ---------- name tags & emote bubbles (screen space, walk mode) ----------
function drawNameTag(x, y, text, isPlayer) {
  ctx.save();
  ctx.font = `700 ${Math.max(10, Math.round(9 * Math.max(1, cam.z * 0.55)))}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 12;
  const h = 16;
  ctx.fillStyle = isPlayer ? 'rgba(232,133,12,.94)' : 'rgba(20,16,10,.72)';
  ctx.beginPath();
  const rx = x - w / 2, ry = y - h / 2, rad = 8;
  ctx.moveTo(rx + rad, ry);
  ctx.arcTo(x + w / 2, ry, x + w / 2, ry + h, rad);
  ctx.arcTo(x + w / 2, ry + h, rx, ry + h, rad);
  ctx.arcTo(rx, ry + h, rx, ry, rad);
  ctx.arcTo(rx, ry, x + w / 2, ry, rad);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff7ea';
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

function drawEmoteBubble(x, y, kind, t) {
  const pop = Math.min(1, ((t * 1) % 1) * 8); // snappy pop-in
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  ctx.fillStyle = 'rgba(255,250,241,.96)';
  ctx.strokeStyle = 'rgba(36,28,18,.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-4, 11); ctx.lineTo(0, 17); ctx.lineTo(4, 11);
  ctx.closePath(); ctx.fill();
  ctx.translate(0, 0.5);
  if (kind === 'heart') {
    ctx.fillStyle = '#e0304e';
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.bezierCurveTo(-7, 0, -5, -6, 0, -2.5);
    ctx.bezierCurveTo(5, -6, 7, 0, 0, 5);
    ctx.fill();
  } else if (kind === 'diya') {
    ctx.fillStyle = '#b45309';
    ctx.beginPath(); ctx.ellipse(0, 3.5, 6.5, 2.6, 0, 0, 7); ctx.fill();
    const fl = Math.sin(t * 9) * 0.8;
    ctx.fillStyle = '#ff9800';
    ctx.beginPath(); ctx.ellipse(fl, -1.5, 2.2, 3.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.ellipse(fl, -0.8, 1.1, 2, 0, 0, 7); ctx.fill();
  } else if (kind === 'wave') {
    ctx.strokeStyle = '#f5b880'; ctx.lineWidth = 4.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2, 5); ctx.lineTo(-2, -3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, -2); ctx.lineTo(-2, -6.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, -2); ctx.lineTo(1.5, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -1); ctx.lineTo(5, -4.5); ctx.stroke();
    ctx.strokeStyle = 'rgba(36,28,18,.5)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(7, -6); ctx.lineTo(9.5, -8); ctx.moveTo(8, -1.5); ctx.lineTo(11, -2.5); ctx.stroke();
  } else if (kind === 'namaste') {
    ctx.strokeStyle = '#c98850'; ctx.lineWidth = 3.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(-2, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, 5); ctx.lineTo(2, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(0, 6.5); ctx.lineTo(5, 5); ctx.stroke();
  }
  ctx.restore();
}

// ---------- festival effects (night: diyas + lanterns; day: colour + parade) ----------
function festivalNight(t) {
  setLightOrigin(0, 0, 1); // festival lights are computed directly in screen space
  const id = S.festival && S.festival.id;
  if (id === 'diwali') {
    for (let y = 0; y < MAP; y += 2) for (let x = 0; x < MAP; x += 2) {
      const g = gridAt(x, y);
      if (!g || g.k !== 'road') continue;
      const i = isoOf(x, y);
      const p = worldToScreen(i.x, i.y + TH / 2);
      if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;
      const fl = 0.6 + 0.4 * Math.sin(t * 7 + x * 3 + y);
      ctx.fillStyle = `rgba(255,${Math.round(150 + fl * 60)},60,.95)`;
      ctx.beginPath(); ctx.arc(p.x, p.y + 6 * cam.z, 1.8 * Math.max(0.7, cam.z), 0, 7); ctx.fill();
      lights.push({ x: p.x, y: p.y + 6 * cam.z, r: 13, c: `rgba(255,170,60,${0.16 * fl})` });
    }
  }
  if (id === 'eid') {
    for (let i = 0; i < 5; i++) {
      const ph = (t * 0.05 + i / 5) % 1;
      const x = W * (0.12 + 0.19 * i) + Math.sin(t + i) * 8;
      const y = H * 0.35 - ph * H * 0.3;
      ctx.fillStyle = ['#f57f17', '#00897b', '#c62828', '#7b1fa2', '#e8850c'][i];
      ctx.beginPath(); ctx.ellipse(x, y, 4.5, 6, 0, 0, 7); ctx.fill();
      lights.push({ x, y, r: 16, c: 'rgba(255,190,90,.20)' });
    }
  }
}

function festivalDay(t) {
  const id = S.festival && S.festival.id;
  // celebration burst (Celebrate button)
  if (S.burstSeq !== festivalDay.lastSeq) {
    festivalDay.lastSeq = S.burstSeq;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 120;
      fxCtx.particles.push({
        x: W / 2, y: H * 0.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 1.2,
        col: id === 'holi'
          ? ['#d81b60', '#f57f17', '#00897b', '#7b1fa2'][i % 4]
          : ['#ffd54f', '#ff8f00', '#e53935', '#fff'][i % 4],
      });
    }
  }
  if (id === 'holi' && Math.random() < 0.02) {
    const x = Math.random() * W, y = Math.random() * H * 0.7;
    fxCtx.splashes.push({ x, y, r: 0, col: ['#d81b60', '#f57f17', '#00897b', '#7b1fa2'][Math.floor(Math.random() * 4)] });
  }
  fxCtx.splashes = fxCtx.splashes.filter(s => s.r < 30);
  for (const s of fxCtx.splashes) {
    s.r += 0.35;
    ctx.globalAlpha = Math.max(0, 1 - s.r / 30) * 0.5;
    ctx.fillStyle = s.col;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.45, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (id === 'diwali' && Math.random() < 0.012) {
    const x = W * (0.15 + Math.random() * 0.7), y = H * (0.1 + Math.random() * 0.3);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      fxCtx.particles.push({ x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: 1, col: ['#ffd54f', '#ff8f00', '#e53935', '#ab47bc'][i % 4], g: 26 });
    }
  }
  fxCtx.particles = fxCtx.particles.filter(p => p.life > 0);
  for (const p of fxCtx.particles) {
    p.life -= 0.012;
    p.x += p.vx * 0.016; p.y += p.vy * 0.016;
    p.vy += (p.g || 40) * 0.016;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (id === 'republic') {
    for (let i = 0; i < 6; i++) {
      const x = W * (i / 5.5) - 40, y = 70 + Math.sin(t + i) * 3;
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 70, y + 18, x + 140, y); ctx.stroke();
      for (let j = 1; j < 7; j++) {
        const bx = x + j * 20, by = y + Math.sin((j / 7) * Math.PI) * 13;
        ctx.fillStyle = ['#ff8f00', '#fff', '#128807'][j % 3];
        ctx.beginPath(); ctx.moveTo(bx - 4, by); ctx.lineTo(bx + 4, by); ctx.lineTo(bx, by + 7); ctx.closePath(); ctx.fill();
      }
    }
  }
}

// ---------- weather ----------
let rainDrops = null;
function rain(t) {
  if (!rainDrops) {
    rainDrops = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }));
  }
  ctx.strokeStyle = 'rgba(180,205,235,.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const d of rainDrops) {
    d.y += 0.024 * d.s; d.x += 0.004;
    if (d.y > 1) { d.y = -0.05; d.x = Math.random(); }
    const px = d.x * W, py = d.y * H;
    ctx.moveTo(px, py); ctx.lineTo(px - 3, py + 11 * d.s);
  }
  ctx.stroke();
}

function fog() {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
  g.addColorStop(0, 'rgba(235,238,240,0)');
  g.addColorStop(1, 'rgba(235,238,240,.34)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ---------- build-menu thumbnails ----------
export function drawThumb(key, cv) {
  const c2 = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  c2.clearRect(0, 0, w, h);
  c2.save();
  c2.translate(w / 2, h - 7);
  c2.scale(0.6, 0.6);
  c2.fillStyle = '#5da24a';
  c2.beginPath();
  c2.moveTo(0, -16); c2.lineTo(32, 0); c2.lineTo(0, 16); c2.lineTo(-32, 0);
  c2.closePath(); c2.fill();
  try { drawBuilding(c2, key, 0, -TH / 2, { t: 0.4, night: false, season: 'monsoon', festival: null, seed: 7 }); }
  catch (e) { /* thumb fails silently, card still usable */ }
  c2.restore();
}
