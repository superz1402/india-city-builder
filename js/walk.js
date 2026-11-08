// walk.js — street mode v5.2 (issue #24): buildacountry-parity walk.
// The person walking the city is YOU and you can SEE yourself: a visible
// avatar (green kurta) walks the streets while the camera follows behind and
// above. Dragging ORBITS the camera around you — the land itself is anchored
// and never slides. While you walk forward the camera slowly swings back in
// behind you; walls behind you pull the camera in. Calibrated against the
// real buildacountry WALK source (reference/buildacountry): pitch clamp
// 0.05–0.9, drag gain 0.008 touch / 0.005 mouse, auto-follow dt*1.6.
// Distance/pitch defaults retuned to our smaller lot scale (5.4/7.4, 0.26).

import { S, MAP, isWalkable, nearestWalkable } from './state.js';
import { deedFor, RESIDENTS } from './owners.js';
import { cam, setZoom } from './iso.js';

export const EMOTES = ['wave', 'namaste', 'diya', 'heart'];

// you: position + heading + gait. `yaw` is the CAMERA orbit angle (where the
// camera looks from), `ang` is which way your BODY faces. pitch = camera
// down-tilt (0.05 nearly level … 0.9 high bird view), like the reference.
export const view = {
  x: 24.5, y: 24.5,
  yaw: Math.PI,          // camera starts behind you, you facing the chowk
  ang: Math.PI,          // your body faces south toward the chowk on entry
  pitch: 0.26,           // camera a little above and behind you, looking down
  distCd: 0,             // smoothed camera distance (wall pull-in)
  lookHold: 0,           // suppresses auto-follow for a beat after a drag
  bob: 0,                // walk bounce (kept for the HUD runner icon)
  ph: 0,                 // gait phase (drives the walk cycle)
  moving: false, run: false,
  emote: null, emoteUntil: 0,
};

// the avatar the camera follows — your body on the street
export const player = {
  get x() { return view.x; }, set x(v) { view.x = v; },
  get y() { return view.y; }, set y(v) { view.y = v; },
  get ang() { return view.ang; },
  get ph() { return view.ph; },
  get moving() { return view.moving; }, set moving(v) { view.moving = v; },
  get run() { return view.run; },
  get emote() { return view.emote; },
  get emoteUntil() { return view.emoteUntil; },
  type: 'kurta', col: '#3fae4e', skin: 1, scale: 1.06, name: 'You',
};

export function getView() { return view; }

// named residents walking the streets (spawned for walk mode)
const walkers = [];
// one outfit per NPC (4 citizens, matching owners.js — never more)
const walkerOutfits = [
  { type: 'kurta', col: '#ffd54f', skin: 0 },   // [NPC] Ramu
  { type: 'saree', col: '#d81b60', skin: 2 },   // [NPC] Meera
  { type: 'turban', col: '#1565c0', skin: 3 },  // [NPC] Arjun
  { type: 'salwar', col: '#4dd0e1', skin: 1 },  // [NPC] Zoya
];

const keys = Object.create(null);
const joy = { x: 0, y: 0, active: false, gx: 0, gy: 0, lx: 0, ly: 0 }; // gxy = gamepad left stick, lxy = gamepad right stick (look)

export function walkActive() { return S.mode === 'walk'; }

// ---------- enter / exit ----------
let savedCam = null;

export function enterWalk() {
  if (S.mode === 'walk' || !S.grid.length) return;
  S.mode = 'walk';
  savedCam = { x: cam.x, y: cam.y, z: cam.z, rot: cam.rot, py: cam.py };
  // place yourself on a sensible street near the map centre, facing the chowk
  const spot = nearestWalkable(Math.floor(MAP / 2), Math.floor(MAP / 2) - 2, 8) || { x: 24, y: 22 };
  view.x = spot.x + 0.5; view.y = spot.y + 0.5;
  view.yaw = Math.PI; view.ang = Math.PI; view.pitch = 0.26; view.bob = 0; view.distCd = 0;
  spawnWalkers();
  document.body.classList.add('walking');
  syncWalkButtons();
}

export function exitWalk() {
  if (S.mode !== 'walk') return;
  S.mode = 'plan';
  document.body.classList.remove('walking');
  walkers.length = 0;
  view.moving = false;
  if (document.pointerLockElement) document.exitPointerLock();
  if (savedCam) {
    cam.x = savedCam.x; cam.y = savedCam.y; cam.py = 0.5;
    setZoom(savedCam.z || 1.05);
  } else { cam.py = 0.5; setZoom(1.05); }
  syncWalkButtons();
}

function syncWalkButtons() {
  const run = document.getElementById('btn-run');
  if (run) {
    run.setAttribute('aria-pressed', String(view.run));
    run.classList.toggle('on', view.run);
  }
}

// ---------- residents on the street ----------
function spawnWalkers() {
  walkers.length = 0;
  RESIDENTS.forEach((name, i) => {
    const deed = deedFor(name);
    const o = walkerOutfits[i % walkerOutfits.length];
    let ax, ay;
    if (deed && deed.home) {
      const [hx, hy] = deed.home.split(',').map(Number);
      ax = hx + 0.5; ay = hy + 1.8; // just outside the door
    } else {
      ax = view.x + (Math.random() * 10 - 5);
      ay = view.y + (Math.random() * 10 - 5);
    }
    const spot = nearestWalkable(Math.floor(ax), Math.floor(ay), 4);
    walkers.push({
      kind: 'resident', name, deed: deed || null,
      x: spot ? spot.x + 0.5 : ax, y: spot ? spot.y + 0.5 : ay,
      hx: spot ? spot.x : Math.floor(ax), hy: spot ? spot.y : Math.floor(ay),
      tx: spot ? spot.x + 0.5 : ax, ty: spot ? spot.y + 0.5 : ay,
      wait: Math.random() * 2, ph: Math.random() * 6.28, speed: 0.5 + Math.random() * 0.4,
      dir: 1, scale: 0.95 + Math.random() * 0.2, emote: null, emoteUntil: 0,
      ...o,
    });
  });
}

// ---------- input plumbing ----------
let runToggle = false;
export function setKey(code, down) { keys[code] = down; }
export function clearKeys() { for (const k in keys) keys[k] = false; }
export function setJoystick(x, y, active) { joy.x = x; joy.y = y; joy.active = active; }
export function setRun(on) { runToggle = !!on; syncWalkButtons(); }
export function isRunning() { return runToggle || !!keys.ShiftLeft || !!keys.ShiftRight; }

// drag look — ORBIT the camera around yourself (the land stays anchored).
// Gains calibrated from the buildacountry source: 0.008/px on touch,
// 0.005/px on mouse; vertical gain ×0.7, pitch clamped to [0.05, 0.9].
const touchLook = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const LOOK_S = touchLook ? 0.008 : 0.005;
export function setLook(dx, dy) {
  view.yaw -= dx * LOOK_S;
  if (view.yaw > Math.PI) view.yaw -= Math.PI * 2;
  if (view.yaw < -Math.PI) view.yaw += Math.PI * 2;
  view.pitch = Math.max(0.05, Math.min(0.9, view.pitch + dy * LOOK_S * 0.7));
  view.lookHold = performance.now() / 1000 + 0.4; // pause auto-follow while looking
}
export function turnBy(d) {
  view.yaw -= d;
  if (view.yaw > Math.PI) view.yaw -= Math.PI * 2;
  if (view.yaw < -Math.PI) view.yaw += Math.PI * 2;
}

export function doEmote(kind) {
  if (!walkActive() || !EMOTES.includes(kind)) return;
  const t = performance.now() / 1000;
  if (t - (doEmote.last || 0) < 1.5) return;
  doEmote.last = t;
  view.emote = kind; view.emoteUntil = t + 2.4;
  // nearby residents answer back
  for (const w of walkers) {
    if (w.emote) continue;
    const d = Math.hypot(w.x - view.x, w.y - view.y);
    if (d < 4.5 && Math.random() < 0.55) {
      w.emote = kind === 'heart' ? 'heart' : kind;
      w.emoteUntil = performance.now() / 1000 + 2.2;
    }
  }
}
export function getEmotes() { return EMOTES; }
export function nearbyCount() {
  let n = 0;
  for (const w of walkers) if (Math.hypot(w.x - view.x, w.y - view.y) < 5.5) n++;
  return n;
}

// gamepad: left stick walks, right stick looks, A/cross runs, X/B emote
function pollGamepad(dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gx = 0, gy = 0, lx = 0, ly = 0;
  for (const p of pads) {
    if (!p) continue;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    if (Math.abs(ax) > 0.18 || Math.abs(ay) > 0.18) { gx = ax; gy = ay; }
    const rx = p.axes[2] || 0, ry = p.axes[3] || 0;
    if (Math.abs(rx) > 0.22) lx = rx;
    if (Math.abs(ry) > 0.22) ly = ry;
    setRun(!!(p.buttons[0] && p.buttons[0].pressed));
    if (p.buttons[2] && p.buttons[2].pressed) doEmote('wave');
    if (p.buttons[1] && p.buttons[1].pressed) doEmote('heart');
  }
  joy.gx = gx; joy.gy = gy; joy.lx = lx; joy.ly = ly;
}

// ---------- per-frame update ----------
export function update(dt, t) {
  if (!walkActive()) return;
  pollGamepad(dt);
  view.run = isRunning();
  if (view.emote && t > view.emoteUntil) view.emote = null;

  // desired move in camera space: up = away from the camera (reference rule)
  let fwd = -joy.y - joy.gy, str = joy.x + joy.gx;
  if (keys.KeyW || keys.ArrowUp) fwd -= 1;
  if (keys.KeyS || keys.ArrowDown) fwd += 1;
  if (keys.KeyD || keys.ArrowRight) str += 1;
  if (keys.KeyA || keys.ArrowLeft) str -= 1;
  // Q/E orbit the camera; arrows now walk (buildacountry parity)
  let turn = 0;
  if (keys.KeyQ) turn -= 1;
  if (keys.KeyE) turn += 1;
  if (turn) turnBy(turn * dt * 2.2);
  if (joy.lx) view.yaw -= joy.lx * dt * 2.8;
  if (joy.ly) view.pitch = Math.max(0.05, Math.min(0.9, view.pitch + joy.ly * dt * 1.4));

  const mag = Math.hypot(fwd, str);
  view.moving = mag > 0.12;
  player.moving = view.moving;
  if (view.moving) {
    if (mag > 1) { fwd /= mag; str /= mag; }
    // move relative to where the camera looks
    const fx = Math.sin(view.yaw), fy = -Math.cos(view.yaw);
    const rx = Math.cos(view.yaw), ry = Math.sin(view.yaw);
    const wx = fx * fwd + rx * str;
    const wy = fy * fwd + ry * str;
    const speed = (view.run ? 5.4 : 3.0) * Math.min(1, mag * 1.4);
    moveWithCollision(view, wx * speed * dt, wy * speed * dt);
    // your body swings to face where you move (dt*12, like the reference)
    const ta = Math.atan2(wx, -wy);
    let da = ta - view.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
    view.ang += da * Math.min(1, dt * 12);
    // the camera slowly swings in behind you while you walk forward
    if (fwd < -0.3 && t > (view.lookHold || 0)) {
      let dy2 = view.ang - view.yaw; dy2 = Math.atan2(Math.sin(dy2), Math.cos(dy2));
      view.yaw += dy2 * Math.min(1, dt * 1.6 * mag);
    }
    view.ph += dt * (view.run ? 11 : 7.5);
    view.bob = Math.abs(Math.sin(view.ph)) * (view.run ? 0.05 : 0.035);
  } else {
    view.bob += (0 - view.bob) * Math.min(1, dt * 6);
    view.ph += dt * 1.2;
  }

  updateWalkers(dt, t);
}

function moveWithCollision(a, dx, dy) {
  const R = 0.24;
  const canStand = (px, py) =>
    isWalkable(Math.floor(px - R), Math.floor(py - R)) && isWalkable(Math.floor(px + R), Math.floor(py - R)) &&
    isWalkable(Math.floor(px - R), Math.floor(py + R)) && isWalkable(Math.floor(px + R), Math.floor(py + R));
  // axis-separated so you slide along walls instead of sticking
  const nx = a.x + dx;
  if (canStand(nx, a.y)) a.x = nx;
  const ny = a.y + dy;
  if (canStand(a.x, ny)) a.y = ny;
}

function updateWalkers(dt, t) {
  for (const w of walkers) {
    if (w.emote && t > w.emoteUntil) w.emote = null;
    const dx = w.tx - w.x, dy = w.ty - w.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.08) {
      w.wait -= dt;
      if (w.wait > 0) continue;
      pickWalkerTarget(w);
    } else {
      const sp = w.speed * dt;
      w.x += (dx / dist) * Math.min(sp, dist);
      w.y += (dy / dist) * Math.min(sp, dist);
      if (Math.abs(dx) > 0.05) w.dir = dx > 0 ? 1 : -1;
      w.ph += dt * 8;
    }
  }
}

function pickWalkerTarget(w) {
  for (let tries = 0; tries < 8; tries++) {
    const nx = w.hx + Math.floor(Math.random() * 7 - 3);
    const ny = w.hy + Math.floor(Math.random() * 7 - 3);
    if (isWalkable(nx, ny)) {
      w.tx = nx + 0.5; w.ty = ny + 0.5;
      w.hx = nx; w.hy = ny;
      break;
    }
  }
  w.wait = 1 + Math.random() * 4;
}

export function getPlayer() { return player; }
export function getWalkers() { return walkers; }

// metaverse visits: drop yourself next to a tile (home, shop, search result)
export function teleportTo(x, y) {
  const s = nearestWalkable(Math.floor(x), Math.floor(y), 8) || { x: Math.floor(x), y: Math.floor(y) };
  view.x = s.x + 0.5; view.y = s.y + 0.5;
  view.moving = false; view.distCd = 0;
}
