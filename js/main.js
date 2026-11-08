// main.js — boot, game loop, input wiring, autosave, error surface.
// v2: street-level walk mode is updated per frame; keys feed the walker.

import { S, MAP, newGame, pushNotice, canPlace } from './state.js';
import { initInput, centerOn, setZoom, zoomBy, cam, resize as camResize, screenToTile } from './iso.js';
import { initRender, render, setGhost, resize as renderResize } from './render.js';
import { tick as simTick } from './sim.js';
import { update as agentsUpdate, clearAgents } from './agents.js';
import { update as walkUpdate, walkActive, setKey, clearKeys } from './walk.js';
import { initUi, handleTap, tick as uiTick, setTool, getTool, updateSpeedIcon } from './ui.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { sfx } from './audio.js';
import { BUILDINGS } from './data.js';
import { initFpv } from './fpv.js';
import { setLook } from './walk.js';

const canvas = document.getElementById('game');
const $ = (id) => document.getElementById(id);

function bootError(msg) {
  const b = $('boot-error');
  b.hidden = false;
  const btn = b.querySelector('button');
  btn.onclick = () => location.reload();
  if (msg) {
    const span = document.createElement('span');
    span.style.cssText = 'font-size:12px;color:var(--ink-soft);max-width:340px;word-break:break-word';
    span.textContent = String(msg && msg.message ? msg.message : msg);
    b.insertBefore(span, btn);
  }
  if (msg) console.error('[boot]', msg);
}

function startNew() {
  clearAgents();
  newGame();
  clearSave();
  centerOn(MAP / 2, MAP / 2);
  setZoom(window.innerWidth < 720 ? 0.8 : 1.05);
  setTool(null);
  updateSpeedIcon();
}
function continueSaved() {
  if (!loadGame()) {
    startNew();
    pushNotice('Old town save retired — welcome to the pre-built Mahanagar.', 'info');
    return;
  }
  clearAgents();
  centerOn(MAP / 2, MAP / 2);
  setZoom(window.innerWidth < 720 ? 0.8 : 1.05);
  setTool(null);
  updateSpeedIcon();
  pushNotice(`Welcome back to ${S.day > 2 ? 'day ' + S.day : 'your shehar'}.`, 'good');
}
window.__startNew = startNew;
window.__continue = continueSaved;

// ghost preview follows the pointer while a tool is active (plan mode only)
let lastGhostTile = null;
canvas.addEventListener('pointermove', (e) => {
  if (walkActive() || !getTool()) { if (lastGhostTile) { lastGhostTile = null; setGhost(null); } return; }
  const r = canvas.getBoundingClientRect();
  const t = screenToTile(e.clientX - r.left, e.clientY - r.top);
  if (lastGhostTile && lastGhostTile.x === t.x && lastGhostTile.y === t.y) return;
  lastGhostTile = t;
  if (t.x < 0 || t.y < 0 || t.x >= MAP || t.y >= MAP) { setGhost(null); return; }
  let ok;
  if (getTool() === '__bulldoze') ok = !!(S.grid[t.y] && S.grid[t.y][t.x]);
  else ok = canPlace(t.x, t.y, getTool()).ok && S.money >= BUILDINGS[getTool()].cost;
  setGhost({ key: getTool(), x: t.x, y: t.y, ok });
});

// ---------- keyboard: walker + UI ----------
const WALK_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
document.addEventListener('keydown', (e) => {
  if (walkActive() && WALK_KEYS.includes(e.code)) {
    setKey(e.code, true);
    if (e.code.startsWith('Arrow')) e.preventDefault();
  }
});
document.addEventListener('keyup', (e) => {
  if (WALK_KEYS.includes(e.code)) setKey(e.code, false);
});
window.addEventListener('blur', clearKeys);

function loop(last) {
  return function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      simTick(dt);
      agentsUpdate(dt, now / 1000);
      walkUpdate(dt, now / 1000);
      render(now);
      uiTick();
    } catch (e) {
      bootError(e);
      return; // stop the loop; error surface is visible
    }
    requestAnimationFrame(frame);
  };
}

function init() {
  initRender(canvas);
  initFpv(canvas); // true first-person street camera (walk mode)
  camResize(canvas.clientWidth, canvas.clientHeight);

  initInput(canvas, {
    onTapTile: (tile, screen) => handleTap(tile, screen),
    onDragStart: () => { /* pan/orbit started; ghost will refresh on next move */ },
    onLook: (dx, dy) => setLook(dx, dy), // street level: drag/lock = turn your head
  });

  initUi();

  // camera buttons
  $('cam-in').addEventListener('click', () => zoomBy(1.25));
  $('cam-out').addEventListener('click', () => zoomBy(0.8));
  $('boot-reload').addEventListener('click', () => location.reload());

  window.addEventListener('resize', () => {
    camResize(canvas.clientWidth, canvas.clientHeight);
    renderResize();
  });

  // autosave: every 10s, when tab hides, and on unload
  setInterval(() => saveGame(true), 10000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(true); });
  window.addEventListener('beforeunload', () => saveGame(true));

  window.addEventListener('error', (e) => bootError(e.message || e.error));
  window.addEventListener('unhandledrejection', (e) => bootError(e.reason));

  // start: welcome panel decides new vs continue
  dispatchEvent(new Event('apna:booted'));
  updateSpeedIcon();
  requestAnimationFrame(loop(performance.now()));
}

try {
  init();
} catch (e) {
  bootError(e);
}
