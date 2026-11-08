// iso.js — isometric projection, orbit camera, and unified mouse/touch input.
// Control model mirrors the original buildacountry: drag to pan (or to orbit
// the walk camera in walk mode), wheel/pinch to zoom, tap to place or inspect.
// v2 adds a camera yaw (cam.rot): the world rotates around its focus while
// sprites stay upright — "drag to look around" at street level.

export const TW = 64, TH = 32;
import { S, MAP } from './state.js';

export const cam = { x: 0, y: 0, z: 1, rot: 0, py: 0.5 }; // py = screen-y anchor for the focus point

export function isoOf(x, y) { return { x: (x - y) * (TW / 2), y: (x + y) * (TH / 2) }; }

function rotCache() { return { c: Math.cos(cam.rot), s: Math.sin(cam.rot) }; }

export function screenToWorld(sx, sy) {
  const { c, s } = rotCache();
  const rx = (sx - vw / 2) / cam.z;
  const ry = (sy - vh * cam.py) / cam.z;
  // inverse-rotate the screen offset into world space
  const wx = rx * c + ry * s;
  const wy = -rx * s + ry * c;
  return { x: wx + cam.x, y: wy + cam.y };
}

export function worldToScreen(ix, iy) {
  const { c, s } = rotCache();
  const dx = ix - cam.x, dy = iy - cam.y;
  return {
    x: (dx * c - dy * s) * cam.z + vw / 2,
    y: (dx * s + dy * c) * cam.z + vh * cam.py,
  };
}

export function screenToTile(sx, sy) {
  const w = screenToWorld(sx, sy);
  const fx = (w.x / (TW / 2) + w.y / (TH / 2)) / 2;
  const fy = (w.y / (TH / 2) - w.x / (TW / 2)) / 2;
  return { x: Math.floor(fx + 0.5), y: Math.floor(fy + 0.5) };
}

let vw = 0, vh = 0, canvas = null;
export function resize(w, h) {
  vw = w; vh = h;
  clampCam();
}
export function centerOn(tx, ty) {
  const i = isoOf(tx, ty);
  cam.x = i.x; cam.y = i.y + TH / 2;
  clampCam();
}
export function orbitBy(d) {
  cam.rot += d;
  if (cam.rot > Math.PI) cam.rot -= Math.PI * 2;
  if (cam.rot < -Math.PI) cam.rot += Math.PI * 2;
}
export function setOrbit(a) { cam.rot = a; }

export function setZoom(z, pivot) {
  const walk = S.mode === 'walk';
  const min = walk ? 1.5 : 0.45, max = walk ? 4.6 : 2.4;
  z = Math.max(min, Math.min(max, z));
  if (pivot) {
    const before = screenToWorld(pivot.sx, pivot.sy);
    cam.z = z;
    const after = screenToWorld(pivot.sx, pivot.sy);
    cam.x += before.x - after.x; cam.y += before.y - after.y;
  } else cam.z = z;
  clampCam();
}
function clampCam() {
  if (S.mode === 'walk') return; // walk camera follows the player, no clamp
  const i = isoOf(MAP / 2, MAP / 2);
  const span = MAP * (TW / 2) * 0.72;
  cam.x = Math.max(i.x - span, Math.min(i.x + span, cam.x));
  cam.y = Math.max(i.y - span * 0.5, Math.min(i.y + span * 0.5, cam.y));
}

// ---------- input ----------
const pointers = new Map();
let pinchDist = 0, downInfo = null, moved = false;
let onTapTile = null, onDragStart = null, onLook = null;

export function initInput(el, handlers) {
  canvas = el; onTapTile = handlers.onTapTile; onDragStart = handlers.onDragStart;
  onLook = handlers.onLook || null;

  el.addEventListener('pointerdown', (e) => {
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* stale pointer id — harmless */ }
    pointers.set(e.pointerId, { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      downInfo = { sx: e.clientX, sy: e.clientY, t: performance.now() };
      moved = false;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });

  el.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;

    if (pointers.size === 1) {
      if (Math.hypot(e.clientX - downInfo.sx, e.clientY - downInfo.sy) > 9) {
        if (!moved) { moved = true; el.classList.add('dragging'); onDragStart && onDragStart(); }
        if (S.mode === 'walk') {
          if (onLook) onLook(dx, dy);        // street level: drag = orbit the camera around you
        } else {
          cam.x -= dx / cam.z; cam.y -= dy / cam.z;
          clampCam();
        }
      }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0 && S.mode !== 'walk') {
        const mid = { sx: (a.x + b.x) / 2, sy: (a.y + b.y) / 2 };
        setZoom(cam.z * (d / pinchDist), mid);
      }
      pinchDist = d;
      moved = true;
    }
  });

  const up = (e) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    el.classList.remove('dragging');
    if (p && pointers.size === 0 && downInfo && !moved) {
      const dtms = performance.now() - downInfo.t;
      if (dtms < 450) {
        const r = canvas.getBoundingClientRect();
        onTapTile(screenToTile(e.clientX - r.left, e.clientY - r.top), { cx: e.clientX, cy: e.clientY });
      }
    }
    if (pointers.size < 2) pinchDist = 0;
    if (pointers.size === 0) downInfo = null;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);

  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (S.mode === 'walk') return; // first person has a fixed focal length
    const r = canvas.getBoundingClientRect();
    const factor = Math.exp(-e.deltaY * 0.0012);
    setZoom(cam.z * factor, { sx: e.clientX - r.left, sy: e.clientY - r.top });
  }, { passive: false });

  // block iOS page zoom gestures
  el.addEventListener('gesturestart', (e) => e.preventDefault());
}

export function zoomBy(f) { setZoom(cam.z * f); }
