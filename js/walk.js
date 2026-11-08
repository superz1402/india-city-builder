// walk.js — street-level "wander" mode (v2 rehaul, mirrors buildacountry).
// You control THE one walker: WASD/arrow keys or the on-screen joystick,
// Shift to run, drag to look around, emotes with keys 1-4. Only FOUR fake
// humans share the street — the [NPC] residents of the deed book (owners.js),
// each tagged in their name so they read as pretend, not players.

import { S, MAP, isWalkable, nearestWalkable, gridAt } from './state.js';
import { cam, setZoom, isoOf, orbitBy } from './iso.js';
import { deedFor, RESIDENTS } from './owners.js';

export const EMOTES = ['wave', 'namaste', 'diya', 'heart'];

// ---------- you ----------
export const player = {
  x: 18.5, y: 20.5, dir: 1, moving: false, run: false,
  ph: 0, emote: null, emoteUntil: 0,
  type: 'kurta', col: '#fff3d6', col2: '#e8850c', skin: 1, scale: 1.15,
};

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
const joy = { x: 0, y: 0, active: false, gx: 0, gy: 0 }; // xy = on-screen stick, gxy = gamepad stick

export function walkActive() { return S.mode === 'walk'; }

// ---------- enter / exit ----------
let savedCam = null;

export function enterWalk() {
  if (S.mode === 'walk' || !S.grid.length) return;
  S.mode = 'walk';
  savedCam = { x: cam.x, y: cam.y, z: cam.z, rot: cam.rot, py: cam.py };
  // place the walker on a sensible street near the map centre
  const spot = nearestWalkable(Math.floor(MAP / 2), Math.floor(MAP / 2) + 2, 8) || { x: 18, y: 20 };
  player.x = spot.x + 0.5; player.y = spot.y + 0.5;
  cam.py = 0.62;
  const i = isoOf(player.x, player.y);
  cam.x = i.x; cam.y = i.y + 16;
  cam.rot = cam.rot || Math.PI / 4;
  setZoom(2.6);
  spawnWalkers();
  document.body.classList.add('walking');
  syncWalkButtons();
}

export function exitWalk() {
  if (S.mode !== 'walk') return;
  S.mode = 'plan';
  document.body.classList.remove('walking');
  walkers.length = 0;
  player.moving = false;
  if (savedCam) {
    cam.x = savedCam.x; cam.y = savedCam.y; cam.py = 0.5;
    setZoom(savedCam.z || 1.05);
  } else { cam.py = 0.5; setZoom(1.05); }
  syncWalkButtons();
}

function syncWalkButtons() {
  const run = document.getElementById('btn-run');
  if (run) {
    run.setAttribute('aria-pressed', String(player.run));
    run.classList.toggle('on', player.run);
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
      ax = player.x + (Math.random() * 10 - 5);
      ay = player.y + (Math.random() * 10 - 5);
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
export function doEmote(kind) {
  if (!walkActive() || !EMOTES.includes(kind)) return;
  const t = performance.now() / 1000;
  if (t - (doEmote.last || 0) < 1.5) return; // reference parity: waves rate-limit to one per 1.5s
  doEmote.last = t;
  player.emote = kind;
  player.emoteUntil = t + 2.4;
  // nearby residents sometimes answer back
  for (const w of walkers) {
    if (w.emote) continue;
    const d = Math.hypot(w.x - player.x, w.y - player.y);
    if (d < 4.5 && Math.random() < 0.55) {
      w.emote = kind === 'heart' ? 'heart' : kind;
      w.emoteUntil = performance.now() / 1000 + 2.2;
    }
  }
}
export function getEmotes() { return EMOTES; }

// gamepad: left stick walks, A/cross runs, X/square + B/circle emote
function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gx = 0, gy = 0, any = false;
  for (const p of pads) {
    if (!p) continue;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    if (Math.abs(ax) > 0.18 || Math.abs(ay) > 0.18) { gx = ax; gy = ay; any = true; }
    setRun(!!(p.buttons[0] && p.buttons[0].pressed));
    if (p.buttons[2] && p.buttons[2].pressed) doEmote('wave');
    if (p.buttons[1] && p.buttons[1].pressed) doEmote('heart');
  }
  joy.gx = gx; joy.gy = gy; // zeroed when no pad — never sticks
}

// ---------- per-frame update ----------
export function update(dt, t) {
  if (!walkActive()) return;
  pollGamepad();
  player.run = isRunning();

  // desired direction in screen space (joystick + gamepad + keys)
  let jx = joy.x + joy.gx, jy = joy.y + joy.gy;
  if (keys.KeyW || keys.ArrowUp) jy -= 1;
  if (keys.KeyS || keys.ArrowDown) jy += 1;
  if (keys.KeyA || keys.ArrowLeft) jx -= 1;
  if (keys.KeyD || keys.ArrowRight) jx += 1;
  const mag = Math.hypot(jx, jy);
  if (mag > 1) { jx /= mag; jy /= mag; }

  player.moving = mag > 0.08;
  if (player.moving) {
    // rotate the screen-space direction into world space (inverse cam yaw)
    const c = Math.cos(cam.rot), s = Math.sin(cam.rot);
    const wx = jx * c + jy * s;
    const wy = -jx * s + jy * c;
    const speed = (player.run ? 4.4 : 2.1) * Math.min(1, mag * 1.4);
    moveWithCollision(player, wx * speed * dt, wy * speed * dt);
    if (Math.abs(wx) > 0.12) player.dir = wx > 0 ? 1 : -1;
    player.ph += dt * (player.run ? 13 : 9);
  } else {
    player.ph += dt * 1.2; // idle breathing
  }

  // camera follows, softly
  const i = isoOf(player.x, player.y);
  const lead = 10;
  const tx = i.x + (player.moving ? (player.dir * lead) : 0);
  cam.x += (tx - cam.x) * Math.min(1, dt * 6);
  cam.y += (i.y + 16 - cam.y) * Math.min(1, dt * 6);

  updateWalkers(dt, t);
}

function moveWithCollision(a, dx, dy) {
  const R = 0.24;
  const canStand = (px, py) =>
    isWalkable(Math.floor(px - R), Math.floor(py - R)) && isWalkable(Math.floor(px + R), Math.floor(py - R)) &&
    isWalkable(Math.floor(px - R), Math.floor(py + R)) && isWalkable(Math.floor(px + R), Math.floor(py + R));
  // axis-separated so walkers slide along walls
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
  // wander a little around the current anchor tile
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

// people close enough to greet, for the "You + N nearby" chip
export function nearbyCount() {
  let n = 0;
  for (const w of walkers) if (Math.hypot(w.x - player.x, w.y - player.y) < 5.5) n++;
  return n;
}

export function getPlayer() { return player; }
export function getWalkers() { return walkers; }

// metaverse visits: drop the walker next to a tile (home, shop, search result)
export function teleportTo(x, y) {
  const s = nearestWalkable(Math.floor(x), Math.floor(y), 8) || { x: Math.floor(x), y: Math.floor(y) };
  player.x = s.x + 0.5; player.y = s.y + 0.5;
  player.moving = false;
  if (walkActive()) {
    const i = isoOf(player.x, player.y);
    cam.x = i.x; cam.y = i.y + 16;
  }
}
