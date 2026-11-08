// walk.js — TRUE first-person street mode (v5 rehaul, issue #23).
// The person walking the city is YOU: there is no avatar and no "You" tag —
// `view` IS the camera (eye height, yaw, pitch, head-bob). WASD/arrows or the
// joystick move you, Shift runs, drag or click-to-lock the mouse to look
// around, Q/E or left/right arrows turn, keys 1-4 emote (nearby [NPC]
// residents answer back). Deliberate deviation from buildacountry's
// third-person walker — documented in docs/WALK-REFERENCE.md.

import { S, MAP, isWalkable, nearestWalkable } from './state.js';
import { deedFor, RESIDENTS } from './owners.js';
import { cam, setZoom } from './iso.js';

export const EMOTES = ['wave', 'namaste', 'diya', 'heart'];

// the first-person camera state (the player has no rendered body)
export const view = {
  x: 24.5, y: 24.5,
  yaw: Math.PI,          // facing south toward the chowk on entry
  pitch: -0.04,          // a touch downward, like standing eyes
  bob: 0,                // head-bob offset added to eye height
  ph: 0,                 // gait phase (drives bob + chevron pulse)
  moving: false, run: false,
  emote: null, emoteUntil: 0,
};

// logical self (position mirror used by ui.js and the deed scan)
export const player = {
  get x() { return view.x; }, set x(v) { view.x = v; },
  get y() { return view.y; }, set y(v) { view.y = v; },
  moving: false, run: false,
  emote: null, emoteUntil: 0,
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
  view.yaw = Math.PI; view.pitch = -0.04; view.bob = 0;
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

// mouse/pointer look — fed by iso.js drag + pointer-lock
export function setLook(dx, dy) {
  view.yaw += dx * 0.0031;
  if (view.yaw > Math.PI) view.yaw -= Math.PI * 2;
  if (view.yaw < -Math.PI) view.yaw += Math.PI * 2;
  view.pitch = Math.max(-0.42, Math.min(0.42, view.pitch - dy * 0.0026));
}
export function turnBy(d) {
  view.yaw += d;
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

  // desired move in local space: forward / strafe
  let fwd = -joy.y - joy.gy, str = joy.x + joy.gx;
  if (keys.KeyW) fwd -= 1;
  if (keys.KeyS) fwd += 1;
  if (keys.KeyD) str += 1;
  if (keys.KeyA) str -= 1;
  // arrows + Q/E turn (street feel: you swing your head, not strafe)
  let turn = 0;
  if (keys.ArrowLeft || keys.KeyQ) turn -= 1;
  if (keys.ArrowRight || keys.KeyE) turn += 1;
  if (turn) turnBy(turn * dt * 2.5);
  if (joy.lx) view.yaw += joy.lx * dt * 2.8;
  if (joy.ly) view.pitch = Math.max(-0.42, Math.min(0.42, view.pitch + joy.ly * dt * 2.0));

  const mag = Math.hypot(fwd, str);
  view.moving = mag > 0.12;
  player.moving = view.moving;
  if (view.moving) {
    if (mag > 1) { fwd /= mag; str /= mag; }
    const fx = Math.sin(view.yaw), fy = -Math.cos(view.yaw);
    const rx = Math.cos(view.yaw), ry = Math.sin(view.yaw);
    const wx = fx * fwd + rx * str;
    const wy = fy * fwd + ry * str;
    const speed = (view.run ? 4.4 : 2.1) * Math.min(1, mag * 1.4);
    moveWithCollision(view, wx * speed * dt, wy * speed * dt);
    view.ph += dt * (view.run ? 13 : 9);
    view.bob = Math.abs(Math.sin(view.ph)) * (view.run ? 0.055 : 0.04);
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
  view.moving = false;
}
