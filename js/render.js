// render.js — draws one full frame: sky, terrain, depth-sorted buildings and
// agents, night-light pass, weather, festival effects, and the build ghost.
// v2: camera-yaw aware (drag to look around), street-level walk mode with
// your avatar, named residents with name tags, and emote bubbles.

import { S, MAP, gridAt, isWater } from './state.js';
import { TW, TH, cam, isoOf, screenToWorld, worldToScreen } from './iso.js';
import { drawBuilding, drawPerson, drawCow, drawVehicle, drawDoorPlate, lights, beginFrame, setLightOrigin } from './arts.js';
import { BUILDINGS } from './data.js';
import { deeds } from './owners.js';
import { isNight, hourOfDay, seasonOf } from './sim.js';
import { getAgents } from './agents.js';
import { getPlayer, getWalkers, walkActive } from './walk.js';
import { lensBegin, lensCompose, setLensBand, isLensOn } from './tiltshift.js';

let ctx = null, canvas = null, W = 0, H = 0, dpr = 1;
let vctx = null; // the visible canvas context (when the lens is off, this IS ctx)
let ghost = null; // {key, x, y, ok}
export function setGhost(g) { ghost = g; }

const fxCtx = { particles: [], splashes: [] };

export function initRender(c) {
  canvas = c; ctx = c.getContext('2d'); vctx = ctx;
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

  // ---- tilt-shift miniature lens: when on, the world draws offscreen and
  // lensCompose() lays the band blur + grade + vignette over the visible canvas
  ctx = lensBegin(W, H, dpr) || vctx;

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

  // ---- deed book index for this frame: "x,y" -> [{name, kind}] ----
  const deedMap = new Map();
  for (const d of deeds()) for (const kind of ['home', 'shop']) {
    if (!d[kind]) continue;
    const [tx, ty] = d[kind].split(',').map(Number);
    if (!Number.isFinite(tx)) continue;
    const key = tx + ',' + ty;
    if (!deedMap.has(key)) deedMap.set(key, []);
    deedMap.get(key).push({ name: d.name, kind });
  }
  const walking = walkActive();
  const pl = walking ? getPlayer() : null;

  // ---- lens: aim the sharp strip at the subject ("band follows one subject")
  // plan mode keeps it on the map focus; walk mode tracks YOU
  if (isLensOn()) {
    let fy = cam.py, fw = 0.16;
    if (walking && pl) {
      const pi = isoOf(pl.x, pl.y);
      const pp = worldToScreen(pi.x, pi.y + TH / 2);
      fy = Math.max(0.3, Math.min(0.72, pp.y / H));
      fw = 0.13;
    }
    setLensBand(fy, fw, Math.sin(cam.rot) * 0.05);
  }

  // ---- terrain pass + collect depth-sorted drawables ----
  // v5 ground: a warm dust ramp (no more olive mud), flecked texture, banked
  // water with a pale shelf; the plate system is capped and distance-ranked
  // so the street keeps its hierarchy.
  const drawables = [];
  const plates = [];
  const roadNb = (x, y) => { const g = gridAt(x, y); return !!g && (g.k === 'road' || g.k === 'bridge'); };
  const GROUND = ['#c9b78a', '#c2ae7e', '#d1c096', '#bda674', '#c5b283'];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = isoOf(x, y);
      const p = worldToScreen(i.x, i.y + TH / 2);
      const tv = S.terrain[y] && S.terrain[y][x];
      if (!tv) continue;
      if (tv.w) {
        const shimmer = 0.5 + 0.5 * Math.sin(t * 1.8 + tv.v);
        const bank = !(isWater(x - 1, y) && isWater(x + 1, y) && isWater(x, y - 1) && isWater(x, y + 1));
        if (bank) {
          ctx.fillStyle = `rgb(${74 + shimmer * 12},${142 + shimmer * 10},${172 + shimmer * 10})`;
          diamond(p.x, p.y); ctx.fill();
          ctx.fillStyle = 'rgba(228,244,248,.25)'; // pale shelf at the waterline
          diamond(p.x, p.y + 1, 0.9, 0.9); ctx.fill();
        } else {
          ctx.fillStyle = `rgb(${54 + shimmer * 12},${122 + shimmer * 10},${154 + shimmer * 12})`;
          diamond(p.x, p.y); ctx.fill();
        }
      } else {
        ctx.fillStyle = GROUND[tv.v % GROUND.length];
        diamond(p.x, p.y); ctx.fill();
        if (((tv.v >> 2) % 4) === 0) { // sparse fleck texture
          ctx.fillStyle = 'rgba(255,255,255,.05)';
          diamond(p.x, p.y - 1, 0.55, 0.55); ctx.fill();
        }
      }
      const gd = gridAt(x, y);
      if (gd) {
        drawables.push({ sy: p.y, k: gd.k, x, y, sd: gd.seed, kb: gd.knobs || null,
          rd: gd.k === 'road' ? { n: roadNb(x, y - 1), s: roadNb(x, y + 1), w: roadNb(x - 1, y), e: roadNb(x + 1, y) } : null });
        // ownership at the door: plates at street level, status dots on the map
        const kind = deedableKind(gd.k);
        if (kind) {
          const own = deedMap.get(x + ',' + y);
          if (walking && pl) {
            const dist = Math.hypot(x + 0.5 - pl.x, y + 0.5 - pl.y);
            const lim = own && own.length ? 9.5 : 6.2; // ACQUIRED carries farther than TO-LET whispers
            if (dist < lim) {
              plates.push({ dist, sx: p.x, sy: p.y, info: own && own.length ? { owned: true, name: own[0].name, kind: own[0].kind } : { owned: false, kind } });
            }
          } else if (!walking) {
            drawables.push({ sy: p.y + 1.5, sx: p.x, sy2: p.y + 1.5, dot: { owned: !!(own && own.length) } });
          }
        }
      }
    }
  }

  // nearest plates only, so ten signs never shout over one street
  plates.sort((a, b) => a.dist - b.dist);
  for (const pl2 of plates.slice(0, 9)) {
    drawables.push({ sy: pl2.sy + 2, sx: pl2.sx, sy2: pl2.sy + 2, plate: { dist: pl2.dist, info: pl2.info } });
  }

  // ---- ambient agents (people, vehicles, cows) ----
  // time-lapse rhythm (lens on, plan mode): agents step in 0.16-tile quantised
  // hops — wind-up toys on a model railway. Walk mode stays real time; cows
  // are above the law in both.
  const tlStep = isLensOn() && !walking ? 0.16 : 0;
  const agents = getAgents();
  for (const a of agents) {
    let ax = tlStep && a.kind !== 'cow' ? Math.round(a.x / tlStep) * tlStep : a.x;
    let ay = tlStep && a.kind !== 'cow' ? Math.round(a.y / tlStep) * tlStep : a.y;
    if (a.kind === 'vehicle') { // right-hand traffic: offset into the lane
      ax += -(a.mdy || 0) * 0.16;
      ay += (a.mdx || 0) * 0.16;
    }
    const i = isoOf(ax, ay);
    const p = worldToScreen(i.x, i.y + TH / 2);
    if (p.x < -60 || p.x > W + 60 || p.y < -80 || p.y > H + 80) continue;
    drawables.push({ sy: p.y + 0.5, agent: a, sx: p.x, sy2: p.y });
  }

  // ---- walk mode: true first person — YOU are the walker. No avatar body,
  // no "You" tag: a soft ground ring + a heading chevron mark your spot
  // (owner directive, issue #23; deviation from buildacountry's third-person
  // street view is documented in docs/WALK-REFERENCE.md).
  if (walking) {
    const pi = isoOf(pl.x, pl.y);
    const pp = worldToScreen(pi.x, pi.y + TH / 2);
    drawables.push({ sy: pp.y + 0.55, fp: true, sx: pp.x, sy2: pp.y });
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
      if (a.kind === 'vehicle') {
        // orient the sprite down its lane (screen angle incl. camera yaw),
        // smoothed so turns read as turns
        const mdx = a.mdx == null ? 1 : a.mdx, mdy = a.mdy || 0;
        const vxi = (mdx - mdy) * 32, vyi = (mdx + mdy) * 16;
        const crc = Math.cos(cam.rot), srn = Math.sin(cam.rot);
        const ta = Math.atan2(vxi * srn + vyi * crc, vxi * crc - vyi * srn);
        if (a.ang == null) a.ang = ta;
        else {
          let d = ta - a.ang;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          a.ang += d * 0.14;
        }
        ctx.rotate(a.ang);
      }
      setLightOrigin(dr.sx, dr.sy2, cam.z);
      if (a.kind === 'cow') drawCow(ctx, 0, 0, t, a.ph);
      else if (a.kind === 'person') drawPerson(ctx, 0, 0, a, t);
      else drawVehicle(ctx, 0, 0, a, t, night);
      ctx.restore();
    } else if (dr.fp) {
      // first-person footprint: soft ring at your feet + heading chevron
      const z = Math.max(1, cam.z);
      ctx.save();
      ctx.translate(dr.sx, dr.sy2);
      ctx.fillStyle = 'rgba(255,176,58,.16)';
      ctx.beginPath(); ctx.ellipse(0, 0, 8 * z, 3.4 * z, 0, 0, 7); ctx.fill();
      const ang = pl.hAng || 0;
      const moving = pl.moving;
      ctx.globalAlpha = moving ? 0.6 : 0.16;
      ctx.translate(Math.cos(ang) * 16 * z, Math.sin(ang) * 8 * z);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffb03a';
      ctx.beginPath();
      ctx.moveTo(7 * z, 0); ctx.lineTo(-3 * z, -4.6 * z); ctx.lineTo(-1 * z, 0); ctx.lineTo(-3 * z, 4.6 * z);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      if (pl.emote) drawEmoteBubble(dr.sx, dr.sy2 - 26 * z, pl.emote, t);
    } else if (dr.plate) {
      // door plate: ACQUIRED nameplate or TO-LET board, fading with distance
      ctx.save();
      ctx.translate(dr.sx, dr.sy2);
      const ps = Math.max(0.85, cam.z);
      ctx.scale(ps, ps);
      setLightOrigin(dr.sx, dr.sy2, ps);
      ctx.globalAlpha = Math.min(1, Math.max(0, (9.5 - dr.plate.dist) / 2.2));
      drawDoorPlate(ctx, 0, 0, dr.plate.info, t, night);
      ctx.globalAlpha = 1;
      ctx.restore();
    } else if (dr.dot) {
      // plan-mode doorstep status dot: green = acquired, amber = TO-LET
      ctx.save();
      ctx.translate(dr.sx, dr.sy2);
      ctx.scale(cam.z, cam.z);
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = dr.dot.owned ? 'rgba(53,212,154,.95)' : 'rgba(255,176,58,.92)';
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(4.8, 0); ctx.lineTo(0, 3); ctx.lineTo(-4.8, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
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
      if (dr.name) drawNameTag(dr.sx, dr.sy2 - 46 * cam.z, dr.name, false);
    } else {
      const i = isoOf(dr.x, dr.y);
      const p = worldToScreen(i.x, i.y);
      env.seed = dr.sd;
      env.knobs = dr.kb;
      env.roads = dr.rd;
      env.rot = cam.rot;
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
    // procedural street lamps on the road grid (no tiles consumed)
    if (S.grid.length) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const g = gridAt(x, y);
      if (!g || g.k !== 'road') continue;
      if ((x * 3 + y * 7) % 6 !== 0) continue;
      const i = isoOf(x, y);
      const p = worldToScreen(i.x, i.y + TH / 2);
      if (p.x < -20 || p.x > W + 20 || p.y < -40 || p.y > H + 40) continue;
      const top = 15 * Math.max(0.8, cam.z);
      ctx.strokeStyle = 'rgba(40,46,58,.9)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - top); ctx.stroke();
      ctx.fillStyle = '#ffe082';
      ctx.beginPath(); ctx.arc(p.x, p.y - top - 1.5, 1.8 * Math.max(0.8, cam.z), 0, 7); ctx.fill();
      lights.push({ x: p.x, y: p.y - top, r: 30, c: 'rgba(255,200,110,.20)' });
    }
    const na = hour >= 19.5 || hour < 5 ? 0.42 : 0.26;
    ctx.fillStyle = `rgba(12,16,52,${na})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const step = Math.max(1, Math.ceil(lights.length / 380)); // city-scale cap: keep the light pass cheap
    for (let li = 0; li < lights.length; li += step) {
      const l = lights[li];
      const rg = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * Math.max(0.7, cam.z * 0.8));
      rg.addColorStop(0, l.c); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(l.x, l.y, l.r * Math.max(0.7, cam.z * 0.8), 0, 7); ctx.fill();
    }
    // long-exposure headlight trails (lens native move, STYLE.md §8): at
    // night every vehicle drags a fading warm streak down its lane. Trails
    // stay smooth while the cars themselves time-lapse — exactly the
    // reference film's dawn opening.
    if (isLensOn()) {
      let trails = 0;
      for (const a of agents) {
        if (a.kind !== 'vehicle' || trails > 42) continue;
        const i = isoOf(a.x, a.y);
        const p = worldToScreen(i.x, i.y + TH / 2);
        if (p.x < -90 || p.x > W + 90 || p.y < -70 || p.y > H + 70) continue;
        const an = a.ang || 0;
        const L = 26 * cam.z;
        const tx = p.x - L * Math.cos(an), ty = p.y - L * Math.sin(an);
        const tg = ctx.createLinearGradient(p.x, p.y, tx, ty);
        tg.addColorStop(0, 'rgba(255,226,150,.4)');
        tg.addColorStop(1, 'rgba(255,226,150,0)');
        ctx.strokeStyle = tg;
        ctx.lineWidth = Math.max(1.5, 2.6 * cam.z);
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 3 * cam.z); ctx.lineTo(tx, ty - 3 * cam.z); ctx.stroke();
        trails++;
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- festival effects ----
  if (festival) festivalDay(t);

  // ---- weather ----
  if (season === 'monsoon') rain(t);
  if (season === 'winter') fog();
  if (season === 'summer') { ctx.fillStyle = 'rgba(255,150,40,.05)'; ctx.fillRect(0, 0, W, H); }

  // ---- cloud shadows sweeping the model (lens native move, day only) ----
  if (isLensOn() && !walking && !night && season !== 'monsoon') cloudShadows(t);

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

  // ---- tilt-shift compose: band blur + grade + vignette onto the screen ----
  // (last, so the build ghost lands inside the frame and gets graded too)
  lensCompose(vctx, { night });
}

function diamond(cx, cy, sx = 1, sy = 1) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - (TH / 2) * sy); ctx.lineTo(cx + (TW / 2) * sx, cy);
  ctx.lineTo(cx, cy + (TH / 2) * sy); ctx.lineTo(cx - (TW / 2) * sx, cy);
  ctx.closePath();
}

// kind of deed a building can carry (mirror of ui.js deedKindFor) — plates
// hang on homes and workplaces only, never on parks or lamps
function deedableKind(k) {
  const d = BUILDINGS[k];
  if (!d) return null;
  if (d.cat === 'house' || d.homes) return 'home';
  if (d.cat === 'shop' || d.cat === 'work' || d.cat === 'civic' || d.cat === 'faith' || d.income || d.jobs) return 'shop';
  return null;
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

// soft cloud shadows drifting across the miniature (STYLE.md "cloud shadows
// sweeping" native move) — three fat radial blobs on slow orbits
function cloudShadows(t) {
  for (let i = 0; i < 3; i++) {
    const x = ((t * 14 + i * 620) % (W + 700)) - 350;
    const y = H * (0.18 + 0.3 * i) + Math.sin(t * 0.07 + i * 2.1) * 46;
    const r = H * (0.3 + 0.08 * i);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(14,24,52,.09)');
    g.addColorStop(0.7, 'rgba(14,24,52,.05)');
    g.addColorStop(1, 'rgba(14,24,52,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
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
