// ui.js — HUD, build menu, panels, notices, tile info, search, walk controls.
// DOM layer only: game rules live in state/sim/owners; pixels in render/arts.

import { S, MAP, pushNotice, recomputeStats, canPlace, place, removeAt, pinKnob, fmtMoney, clearUiDirty } from './state.js';
import { BUILDINGS, CATS, TIERS, KNOBS } from './data.js';
import { drawThumb, setGhost } from './render.js';
import { resolveKnobs } from './arts.js';
import { celebrate, celebrateCost, activeFestival } from './events.js';
import { saveGame, hasSave } from './save.js';
import { sfx, setEnabled, isEnabled } from './audio.js';
import { seasonOf } from './sim.js';
import { istLabel, rushLevel } from './clock.js';
import { isLensOn, setLensOn } from './tiltshift.js';
import { centerOn, setZoom, orbitBy } from './iso.js';
import { walkActive, enterWalk, exitWalk, doEmote, setJoystick, setRun, nearbyCount, getPlayer, teleportTo, getView, getWalkers } from './walk.js';
import { RESIDENTS, residentList, ownersAt, assignDeed, vacateDeed, homeOf, shopOf, statusOf, deedFor } from './owners.js';

const $ = (id) => document.getElementById(id);
let tool = null;
let lastHud = {};
let tapInfoHide = null;

export function getTool() { return tool; }

export function setTool(key, { silent = false } = {}) {
  if (walkActive()) key = null; // no building tools at street level
  tool = key;
  document.querySelectorAll('.build-card').forEach(c => c.classList.toggle('active', c.dataset.key === key));
  const chip = $('tool-chip'), canvas = $('game');
  if (key) {
    const isDoze = key === '__bulldoze';
    $('tool-chip-text').textContent = isDoze ? 'Bulldoze — tap buildings to remove (40% refund)' : `Placing: ${BUILDINGS[key].name} — tap the map`;
    chip.hidden = false;
    canvas.classList.add('tool');
    if (!silent) sfx.click();
  } else {
    chip.hidden = true;
    canvas.classList.remove('tool');
    setGhost(null);
    hideTileInfo();
  }
  clearUiDirty();
}

export function handleTap(tile, screen) {
  hideTileInfo();
  if (tile.x < 0 || tile.y < 0 || tile.x >= MAP || tile.y >= MAP) return;
  if (walkActive()) { showTileInfo(tile.x, tile.y, screen); return; }
  if (!tool) { showTileInfo(tile.x, tile.y, screen); return; }
  if (tool === '__bulldoze') {
    const g = S.grid[tile.y] && S.grid[tile.y][tile.x];
    if (!g) { pushNotice('Nothing to remove on that tile.', 'info'); return; }
    const r = removeAt(tile.x, tile.y);
    if (r.ok) { sfx.place(); pushNotice(`Removed ${BUILDINGS[g.k].name}. Refund ${fmtMoney(r.refund)}.`, 'info'); }
    return;
  }
  const c = canPlace(tile.x, tile.y, tool);
  const def = BUILDINGS[tool];
  if (!c.ok) { pushNotice(c.why, 'warn'); sfx.error(); return; }
  if (S.money < def.cost) { pushNotice(`Not enough paisa — need ${fmtMoney(def.cost)}.`, 'warn'); sfx.error(); return; }
  const r = place(tile.x, tile.y, tool);
  if (r.ok) {
    sfx.place();
    if (def.happy) sfx.coin();
  } else if (r.why) pushNotice(r.why, 'warn');
}

// ---------- build menu ----------
function buildMenu() {
  const tabs = $('cat-tabs'), items = $('build-items');
  tabs.innerHTML = ''; items.innerHTML = '';
  for (const cat of CATS) {
    const b = document.createElement('button');
    b.className = 'cat-tab'; b.textContent = cat.name;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', cat.id === 'house' ? 'true' : 'false');
    b.addEventListener('click', () => {
      sfx.click();
      tabs.querySelectorAll('.cat-tab').forEach(t => t.setAttribute('aria-selected', 'false'));
      b.setAttribute('aria-selected', 'true');
      fillItems(cat.id);
    });
    tabs.appendChild(b);
  }
  fillItems('house');
}

function fillItems(catId) {
  const items = $('build-items');
  items.innerHTML = '';
  const keys = Object.keys(BUILDINGS).filter(k => BUILDINGS[k].cat === catId)
    .sort((a, b) => BUILDINGS[a].cost - BUILDINGS[b].cost);
  for (const k of keys) {
    const d = BUILDINGS[k];
    const card = document.createElement('button');
    card.className = 'build-card'; card.dataset.key = k;
    const locked = (d.tier || 0) > S.tierIdx;
    if (locked) card.classList.add('locked');
    const cv = document.createElement('canvas');
    cv.width = 120; cv.height = 52;
    const name = document.createElement('span'); name.className = 'bc-name'; name.textContent = d.name;
    const cost = document.createElement('span'); cost.className = 'bc-cost'; cost.textContent = fmtMoney(d.cost);
    card.append(cv, name, cost);
    if (locked) {
      const lk = document.createElement('span'); lk.className = 'bc-lock';
      lk.textContent = `Unlocks at ${TIERS[d.tier].name}`;
      card.appendChild(lk);
    }
    card.title = d.desc;
    card.addEventListener('click', () => {
      if ((d.tier || 0) > S.tierIdx) {
        pushNotice(`${d.name} unlocks at ${TIERS[d.tier].name} (${TIERS[d.tier].pop} people). Grow more!`, 'info');
        sfx.error();
        return;
      }
      setTool(tool === k ? null : k);
    });
    items.appendChild(card);
    drawThumb(k, cv);
  }
  if (catId === 'decor') {
    // bulldoze lives with roads
    const card = document.createElement('button');
    card.className = 'build-card'; card.dataset.key = '__bulldoze';
    const cv = document.createElement('canvas'); cv.width = 120; cv.height = 52;
    const name = document.createElement('span'); name.className = 'bc-name'; name.textContent = 'Bulldoze';
    const cost = document.createElement('span'); cost.className = 'bc-cost'; cost.textContent = '+40% back';
    card.append(cv, name, cost);
    card.title = 'Remove buildings and roads. 40% refund.';
    card.addEventListener('click', () => setTool(tool === '__bulldoze' ? null : '__bulldoze'));
    items.appendChild(card);
  }
  if (tool) {
    document.querySelectorAll('.build-card').forEach(c => c.classList.toggle('active', c.dataset.key === tool));
  }
}

// ---------- HUD ----------
export function tick() {
  const now = performance.now();
  if (tick.last && now - tick.last < 220) return;
  tick.last = now;

  const happyLabel = S.happy >= 75 ? 'Happy' : S.happy >= 55 ? 'Content' : S.happy >= 40 ? 'Meh' : 'Upset';
  const vals = {
    money: fmtMoney(S.money), pop: String(Math.round(S.pop)),
    happy: `${happyLabel} ${Math.round(S.happy)}%`,
    day: `Day ${S.day} · ${seasonOf(S.day).name}`,
    clock: `${istLabel()} IST`,
    title: TIERS[S.tierIdx].name,
  };
  const el = {
    money: $('st-money'), pop: $('st-pop'), happy: $('st-happy'), day: $('st-day'), clock: $('st-clock'), title: $('town-title'),
  };
  if (lastHud.money !== vals.money) el.money.textContent = vals.money;
  if (lastHud.pop !== vals.pop) el.pop.textContent = vals.pop;
  if (lastHud.happy !== vals.happy) {
    el.happy.textContent = vals.happy;
    el.happy.style.color = S.happy >= 55 ? 'var(--good)' : S.happy >= 40 ? 'var(--warn)' : 'var(--bad)';
  }
  if (lastHud.day !== vals.day) el.day.textContent = vals.day;
  if (lastHud.clock !== vals.clock) el.clock.textContent = vals.clock;
  if (lastHud.title !== vals.title) el.title.textContent = vals.title;
  lastHud = vals;

  // walk mode chip — "Just you here" / "You + N nearby" (reference parity)
  if (walkActive()) {
    const n = nearbyCount();
    const txt = n > 0 ? `You + ${n} nearby` : 'Just you here';
    const chip = $('walk-chip');
    if (chip.textContent !== txt) chip.textContent = txt;
    // where-am-I chip — district + compass heading (you are the camera)
    const p0 = getPlayer();
    const where = $('walk-where');
    if (where) {
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const yaw = ((getView().yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const c = dirs[Math.round(yaw / (Math.PI / 4)) % 8];
      const dtxt = `${districtOf(Math.floor(p0.x), Math.floor(p0.y))} · ${c}`;
      if (where.textContent !== dtxt) where.textContent = dtxt;
      where.hidden = false;
    }
    drawWalkMap();
    // nearest deed chip (reference walkNear: whose home am I passing?)
    updateWalkNear();
  } else {
    const where = $('walk-where');
    if (where) where.hidden = true;
  }

  // rush-hour whispers (Toy Town Rush Hour): announce the tide, once each way
  if (S.grid.length) {
    const rl = rushLevel();
    if (rl >= 1.35 && !tick.rushOn) {
      tick.rushOn = true;
      pushNotice('Rush hour — the Mahanagar’s roads pack up. Horns optional, patience mandatory.', 'info');
    } else if (rl < 1.12 && tick.rushOn) {
      tick.rushOn = false;
      pushNotice('Rush hour is over — the streets breathe again.', 'info');
    }
  }

  // festival banner
  const fest = activeFestival();
  const banner = $('festival-banner');
  if (fest && S.festival) {
    banner.hidden = false;
    const cost = celebrateCost();
    const done = S.festival.celebrated;
    $('festival-text').textContent = `${fest.text} ${done ? '(celebrated)' : ''}`;
    const btn = $('btn-celebrate');
    btn.textContent = done ? 'Celebrated' : `Celebrate · ${fmtMoney(cost)}`;
    btn.disabled = done || S.money < cost;
    btn.title = done ? 'Already celebrated this festival' : S.money < cost ? `Need ${fmtMoney(cost)}` : 'Boost happiness for the rest of the festival';
  } else banner.hidden = true;

  // notices
  if (S.notices.length) {
    const feed = $('feed');
    for (const n of S.notices.splice(0, S.notices.length)) {
      const div = document.createElement('div');
      div.className = `notice ${n.kind}`;
      const icon = n.kind === 'good' ? '#i-coin' : n.kind === 'bad' || n.kind === 'warn' ? '#i-warn' : '#i-diya';
      div.innerHTML = `<svg class="ic" aria-hidden="true"><use href="${icon}"/></svg><span></span>`;
      div.querySelector('span').textContent = n.msg;
      feed.appendChild(div);
      while (feed.children.length > 4) feed.removeChild(feed.firstChild);
      setTimeout(() => { div.classList.add('out'); setTimeout(() => div.remove(), 320); }, 6000);
    }
  }

  // menu unlock refresh (cheap guard)
  if (tick.lastTier !== S.tierIdx) {
    tick.lastTier = S.tierIdx;
    buildMenu();
    setTool(tool, { silent: true });
  }
}

// the ward you're in — Mahanagar's five bands plus the riverside orchards.
// Mirrors generateCity's district bands (state.js).
function districtOf(x, y) {
  if (y <= 8) return 'Riverside orchards';
  if (x < 9) return y < 26 ? 'Green Belt' : 'West Fields';
  if (y < 17) return 'Civil Lines';
  if (y < 25) return 'CBD';
  if (y < 33) return 'Old Mohalla';
  if (y < 41) return 'Colony';
  return 'Industrial Edge';
}

// whose door is nearest while you walk — owned deeds show the owner's name,
// available buildings read as TO-LET (the street-level ownership scan)
function updateWalkNear() {
  const el = $('walk-near');
  if (!el) return;
  const p = getPlayer();
  let best = null, bd = 6;
  const px = Math.floor(p.x), py = Math.floor(p.y);
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    const x = px + dx, y = py + dy;
    const g = (S.grid[y] && S.grid[y][x]) || null;
    if (!g) continue;
    const kind = deedKindFor(g.k);
    if (!kind) continue;
    const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
    if (d < bd) { bd = d; best = { x, y, kind, key: g.k, own: ownersAt(x, y)[0] || null }; }
  }
  if (!best) { el.hidden = true; return; }
  let txt;
  if (best.own) txt = `${best.own.name}'s ${best.own.kind} · ${BUILDINGS[best.key].name}`;
  else txt = `TO-LET · ${BUILDINGS[best.key].name} — tap to inspect`;
  if (el.textContent !== txt) {
    el.textContent = txt;
    el.classList.toggle('owned', !!best.own);
  }
  el.hidden = false;
}

// ---------- tile info ----------
function deedKindFor(key) {
  const d = BUILDINGS[key];
  if (!d) return null;
  if (d.cat === 'house' || d.homes) return 'home';
  if (d.cat === 'shop' || d.cat === 'work' || d.cat === 'civic' || d.cat === 'faith' || d.income || d.jobs) return 'shop';
  return null;
}

function showTileInfo(x, y, screen) {
  const g = S.grid[y] && S.grid[y][x];
  const tv = S.terrain[y] && S.terrain[y][x];
  const box = $('tile-info');
  if (!g && !tv) return;
  let html = '';
  if (g) {
    const d = BUILDINGS[g.k];
    if (d) {
      html += `<b>${d.name}</b><span class="ti-line">${d.desc}</span>`;
      const lines = [];
      if (d.homes) lines.push(`Homes for ${d.homes}`);
      if (d.jobs) lines.push(`${d.jobs} jobs`);
      if (d.income) lines.push(`₹${d.income}/day`);
      if (d.food) lines.push(`${d.food} food/day`);
      if (d.water) lines.push(`+${d.water} water`);
      if (d.power) lines.push(`${d.power > 0 ? '+' : ''}${d.power} power`);
      if (d.happy) lines.push(`+${d.happy} khush-hali nearby`);
      if (lines.length) html += `<span class="ti-line">${lines.join(' · ')}</span>`;
      // parametric knobs (polyfork pattern: every look is an argument).
      // Seeded pick shows as the default; tapping a chip pins it per tile
      // (saved in v2); tapping the pinned chip again returns to the seed.
      const kdefs = KNOBS[g.k];
      if (kdefs && !walkActive()) {
        const cur = resolveKnobs(g.k, g.seed || 0);
        for (const [kn, kd] of Object.entries(kdefs)) {
          const opts = kd.options || Object.keys(kd.colors || {});
          const pinned = g.knobs && g.knobs[kn];
          const val = pinned || cur[kn];
          html += `<span class="ti-knob"><em>${kn}</em>${opts.map(op =>
            `<button class="knob-chip${op === val ? ' on' : ''}" data-knob="${kn}" data-val="${op}" ${op === val && pinned ? 'aria-pressed="true" title="Pinned — tap to return to the seeded look"' : ''}>${kd.colors ? `<i class="sw" style="background:${kd.colors[op]}"></i>` : ''}${op}</button>`
          ).join('')}</span>`;
        }
      }
      // ownership (metaverse deed book) + door status
      const own = ownersAt(x, y);
      if (own.length) {
        html += `<span class="ti-line ti-deed">${own.map(o => `${o.name} — ${o.kind}${o.vacant ? ' (vacant plot)' : ''}`).join('<br>')}`;
      }
      const kind = deedKindFor(g.k);
      if (kind) {
        const status = own.length
          ? `<span class="ti-status owned">ACQUIRED — ${own[0].name}</span>`
          : `<span class="ti-status vacant">TO-LET — available, no owner yet</span>`;
        html += status;
        html += `<button class="btn small" id="ti-assign" style="margin-top:8px;min-height:38px;padding:6px 12px">${own.length ? 'Change owner…' : 'Assign owner…'}</button>`;
      }
      if (!walkActive()) {
        const refund = Math.floor((d.cost || 0) * 0.4);
        html += `<button class="btn danger" id="ti-remove" style="margin-top:8px;min-height:36px;padding:6px 12px">Remove · +${fmtMoney(refund)}</button>`;
      }
    } else html += `<b>${g.k}</b>`;
  } else if (tv.w) {
    html += `<b>Water</b><span class="ti-line">${walkActive() ? 'The gully ends here — cross by the bridge.' : 'Build a bridge to cross.'}</span>`;
  } else {
    html += `<b>Open land</b><span class="ti-line">${walkActive() ? 'Take a stroll, meet the locals.' : 'Pick a building below, then tap here.'}</span>`;
  }
  html += `<span class="ti-coord tnum">tile ${x},${y}</span>`;
  box.innerHTML = html;
  box.hidden = false;
  const bw = 260, bh = 200;
  box.style.left = Math.max(8, Math.min(window.innerWidth - bw, screen.cx - bw / 2)) + 'px';
  box.style.top = Math.max(60, Math.min(window.innerHeight - bh - 140, screen.cy - 130)) + 'px';
  box.querySelectorAll('.knob-chip').forEach(ch => ch.addEventListener('click', (e) => {
    e.stopPropagation();
    const r = pinKnob(x, y, ch.dataset.knob, ch.classList.contains('on') && ch.getAttribute('aria-pressed') === 'true' ? null : ch.dataset.val);
    if (!r.ok) { pushNotice(r.why, 'bad'); return; }
    sfx.click(); showTileInfo(x, y, screen); // re-render chips + keep panel open
  }));
  const as = box.querySelector('#ti-assign');
  if (as) as.addEventListener('click', (e) => { e.stopPropagation(); openAssignPanel(x, y); });
  const rm = box.querySelector('#ti-remove');
  if (rm) rm.addEventListener('click', (e) => {
    e.stopPropagation();
    const r = removeAt(x, y);
    if (r.ok) { sfx.place(); pushNotice(`Removed. Refund ${fmtMoney(r.refund)}.`, 'info'); }
    hideTileInfo();
  });
  clearTimeout(tapInfoHide);
  tapInfoHide = setTimeout(hideTileInfo, 9000);
}
function hideTileInfo() { const b = $('tile-info'); if (b) b.hidden = true; }

// ---------- assign ownership panel ----------
let assignTile = null;

function openAssignPanel(x, y) {
  const g = S.grid[y] && S.grid[y][x];
  if (!g) return;
  const kind = deedKindFor(g.k);
  if (!kind) { pushNotice('Only homes and shops can have owners.', 'info'); return; }
  assignTile = { x, y, kind };
  $('assign-title').textContent = kind === 'home' ? `Give a home — ${BUILDINGS[g.k].name} (${x},${y})` : `Assign a shop — ${BUILDINGS[g.k].name} (${x},${y})`;
  const body = $('assign-body');
  const own = ownersAt(x, y);
  let html = '';
  if (own.length) {
    html += `<h3>Current deed</h3>` + own.map(o => {
      const d = deedFor(o.name);
      const locked = d && d.fromCode;
      return `<div class="deed-row"><div><b>${o.name}</b><small>${o.kind}</small></div>` +
        (locked ? `<span class="chip code">set in code</span>` : `<button class="chip danger" data-vacate="${o.name}">Vacate</button>`) + `</div>`;
    }).join('');
  }
  html += `<h3>Give to a resident</h3>`;
  html += `<div class="roster">` + RESIDENTS.map(n => `<button class="roster-btn" data-name="${n}">${n}</button>`).join('') + `</div>`;
  html += `<p class="panel-foot">To add new residents or fix deeds in code, edit <b>js/owners.js</b>.</p>`;
  body.innerHTML = html;
  openPanel('assign-panel');
}

function wireAssignPanel() {
  $('assign-body').addEventListener('click', (e) => {
    const vac = e.target.closest('[data-vacate]');
    if (vac && assignTile) {
      const r = vacateDeed(vac.dataset.vacate, assignTile.kind);
      if (r.ok) { pushNotice(`${vac.dataset.vacate} no longer ${assignTile.kind === 'home' ? 'lives here' : 'works here'}.`, 'info'); openAssignPanel(assignTile.x, assignTile.y); }
      else { pushNotice(r.why, 'warn'); }
      return;
    }
    const b = e.target.closest('.roster-btn');
    if (b && assignTile) {
      const r = assignDeed(b.dataset.name, assignTile.kind, assignTile.x, assignTile.y);
      if (r.ok) {
        sfx.coin();
        pushNotice(`${b.dataset.name} now ${assignTile.kind === 'home' ? 'lives' : 'works'} at tile ${assignTile.x},${assignTile.y}. They'll walk here on the IST clock.`, 'good');
        openAssignPanel(assignTile.x, assignTile.y);
      } else {
        pushNotice(r.why, 'warn'); sfx.error();
      }
    }
  });
}

// ---------- people & homes panel ----------
function fillDeeds() {
  const body = $('deeds-body');
  const rows = residentList().map(r => {
    const home = r.home ? `<button class="chip" data-visit="${r.home}" data-label="${r.name}'s home">Home · ${r.home}</button>` : '<span class="chip none">no home yet</span>';
    const shop = r.shop ? `<button class="chip" data-visit="${r.shop}" data-label="${r.name}'s shop">Shop · ${r.shop}</button>` : '';
    return `<div class="deed-row"><div class="deed-who"><b>${r.name}</b><small>${statusOf(r.name)}</small></div><div class="deed-chips">${home}${shop}</div></div>`;
  }).join('');
  body.innerHTML = rows + `<p class="panel-foot">Tap a chip to visit. Four fake humans ([NPC]) live here by design — edit them in code: <b>js/owners.js</b>.</p>`;
}

// ---------- visit (metaverse teleport) ----------
function visitTile(x, y, label) {
  closePanels(); hideTileInfo();
  if (walkActive()) {
    teleportTo(x, y);
    pushNotice(`You walk over to ${label}.`, 'info');
  } else {
    centerOn(x, y);
    setZoom(1.6);
    pushNotice(`Showing ${label}. Tap Walk to stand there yourself.`, 'info');
  }
}

// ---------- search (reference parity: find your home) ----------
function initSearch() {
  const input = $('search-input'), drop = $('search-drop');
  if (!input || !drop) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { drop.hidden = true; drop.innerHTML = ''; return; }
    const m = RESIDENTS.filter(n => n.toLowerCase().includes(q)).slice(0, 6);
    if (m.length) {
      drop.innerHTML = m.map(n => `<button data-name="${n}"><b>${n}</b><small>${statusOf(n)}</small></button>`).join('');
      drop.hidden = false;
    } else {
      drop.innerHTML = '<div class="search-empty">No resident by that name — add one in js/owners.js</div>';
      drop.hidden = false;
    }
  });
  drop.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const name = b.dataset.name;
    input.value = ''; drop.hidden = true;
    const home = homeOf(name), shop = shopOf(name);
    const t = home || shop;
    if (!t) { pushNotice(`${name} owns nothing yet — tap one of your homes or shops and assign it to them.`, 'info'); return; }
    visitTile(t.x, t.y, `${name}'s ${home ? 'home' : 'shop'}`);
  });
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#search-wrap')) drop.hidden = true;
  });
}

// ---------- walk controls ----------
function initJoystick() {
  const zone = $('joy'), knob = $('joy-knob');
  if (!zone || !knob) return;
  let pid = null, cx = 0, cy = 0;
  const R = 40;
  zone.addEventListener('pointerdown', (e) => {
    pid = e.pointerId;
    try { zone.setPointerCapture(pid); } catch (err) { /* stale pointer */ }
    const r = zone.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    move(e);
  });
  const move = (e) => {
    if (e.pointerId !== pid) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const m = Math.hypot(dx, dy);
    if (m > R) { dx = dx / m * R; dy = dy / m * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    setJoystick(dx / R, dy / R, true);
  };
  zone.addEventListener('pointermove', move);
  const end = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    knob.style.transform = 'translate(0px, 0px)';
    setJoystick(0, 0, false);
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
}

function initWalkControls() {
  initJoystick();
  $('btn-walk').addEventListener('click', () => {
    sfx.click();
    enterWalk();
    const hint = $('look-hint');
    if (hint) { hint.hidden = false; clearTimeout(initWalkControls.hintT); initWalkControls.hintT = setTimeout(() => { hint.hidden = true; }, 7000); }
    const phone = matchMedia('(pointer: coarse)').matches || window.innerWidth < 720;
    pushNotice(phone ? 'You are on the street — joystick to walk, drag to orbit the camera.' : 'You are on the street. WASD or arrows to walk, Q/E to swing the camera, Shift to run, drag to orbit the camera; 1-4 to emote.', 'good');
  });
  $('btn-exit-walk').addEventListener('click', () => { sfx.click(); exitWalk(); });
  $('btn-run').addEventListener('click', () => {
    setRun(!$('btn-run').classList.contains('on'));
    sfx.click();
  });
  document.querySelectorAll('.emote-btn').forEach(b => {
    b.addEventListener('click', () => { doEmote(b.dataset.emote); sfx.click(); });
  });
  $('btn-rot-l').addEventListener('click', () => { orbitBy(-Math.PI / 4); sfx.click(); });
  $('btn-rot-r').addEventListener('click', () => { orbitBy(Math.PI / 4); sfx.click(); });
  // any look input retires the first-time hint
  const hint = $('look-hint');
  if (hint) {
    const retire = () => { hint.hidden = true; };
    document.getElementById('game').addEventListener('pointerdown', retire, { once: false });
  }
}

// ---------- walk minimap (pocket GPS: roads, deeds, you) ----------
function drawWalkMap() {
  const cv = $('walk-map');
  if (!cv || !S.grid.length) return;
  const now = performance.now();
  if (drawWalkMap.last && now - drawWalkMap.last < 280) return;
  drawWalkMap.last = now;
  const c2 = cv.getContext('2d');
  const N = cv.width, sc = N / MAP;
  c2.clearRect(0, 0, N, N);
  c2.fillStyle = '#141a26';
  c2.fillRect(0, 0, N, N);
  for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++) {
    const tv = S.terrain[y] && S.terrain[y][x];
    const g = S.grid[y][x];
    if (tv && tv.w) c2.fillStyle = '#2e5d7a';
    else if (g && (g.k === 'road' || g.k === 'bridge')) c2.fillStyle = '#93a7b1';
    else if (g) c2.fillStyle = '#4d463a';
    else continue;
    c2.fillRect(x * sc, y * sc, sc + 0.5, sc + 0.5);
  }
  // deed markers: green = acquired, amber = TO-LET
  for (const d of RESIDENTS.map(deedFor)) {
    if (!d || !d.home) continue;
    const [hx, hy] = d.home.split(',').map(Number);
    c2.fillStyle = '#35d49a';
    c2.fillRect(hx * sc - 1, hy * sc - 1, sc + 2, sc + 2);
  }
  // the four [NPC]s
  c2.fillStyle = '#e8ecf4';
  for (const w of getWalkers()) c2.fillRect(w.x * sc - 1, w.y * sc - 1, 2.4, 2.4);
  // you: a heading arrow
  const p = getPlayer(), v = getView();
  c2.save();
  c2.translate(p.x * sc, p.y * sc);
  c2.rotate(v.yaw + Math.PI); // yaw 0 faces north (−y) → arrow up
  c2.fillStyle = '#ffb03a';
  c2.beginPath();
  c2.moveTo(0, -5); c2.lineTo(3.4, 4); c2.lineTo(0, 2.2); c2.lineTo(-3.4, 4);
  c2.closePath(); c2.fill();
  c2.restore();
}

// ---------- tilt-shift miniature lens ----------
function toggleLens() {
  const on = setLensOn(!isLensOn());
  syncLensBtn();
  sfx.click();
  pushNotice(on
    ? 'Tilt-Shift Miniature lens ON — your city is a toy model now. (Press T to toggle)'
    : 'Lens off — back to the plain working map.', 'info');
}
function syncLensBtn() {
  const b = $('btn-lens');
  if (!b) return;
  b.classList.toggle('on', isLensOn());
  b.setAttribute('aria-pressed', String(isLensOn()));
}

// ---------- panels ----------
const PANELS = ['menu-panel', 'stats-panel', 'help-panel', 'confirm-panel', 'deeds-panel', 'assign-panel'];

function openPanel(id) {
  for (const p of PANELS) $(p).hidden = p !== id;
  if (id === 'stats-panel') fillStats();
  if (id === 'deeds-panel') fillDeeds();
}
function closePanels() {
  for (const p of PANELS) $(p).hidden = true;
}
export function anyPanelOpen() {
  return [...PANELS, 'welcome'].some(id => !$(id).hidden);
}

function fillStats() {
  const st = S.stats || recomputeStats(), body = $('stats-body');
  const eaten = S.pop * 0.14;
  const foodDays = eaten > 0 ? (S.foodStock / eaten) : 99;
  const nextTier = TIERS[S.tierIdx + 1];
  const rows = [];
  const row = (k, v, cls = '') => rows.push(`<div class="row"><span>${k}</span><b class="${cls}">${v}</b></div>`);
  row('Population', `${Math.round(S.pop)} / ${st.homes} homes`);
  row('Khush-hali', `${Math.round(S.happy)}% ${S.happy >= 55 ? '· content' : '· needs work'}`, S.happy >= 55 ? 'ok' : 'short');
  row('Jobs', `${st.jobs} jobs for ~${Math.round(S.pop * 0.6)} workers`, st.jobs >= Math.round(S.pop * 0.6) ? 'ok' : 'short');
  row('Food', `${Math.round(S.foodStock)} in store · about ${foodDays > 90 ? '90+' : Math.round(foodDays)} days`, foodDays > 4 ? 'ok' : 'short');
  row('Water', `${Math.round(st.waterCap)} capacity vs ~${Math.round(S.pop * 0.16)} use`, st.waterCap >= S.pop * 0.16 ? 'ok' : 'short');
  row('Power', `${st.powerGen} generated vs ${st.powerUse} used`, st.powerGen >= st.powerUse ? 'ok' : 'short');
  row('Income', `${fmtMoney(S.lastNet || 0)} / day (net)`, (S.lastNet || 0) >= 0 ? 'ok' : 'short');
  row('Pollution', st.pol > 3 ? 'high — add parks and trees' : st.pol > 0 ? 'a little' : 'clean', st.pol > 3 ? 'short' : 'ok');
  row('Faith places', `${st.faiths} kinds${st.faiths >= 3 ? ' · unity bonus active' : ''}`);
  row('Buildings', String(st.buildings));
  if (nextTier) row('Next goal', `${nextTier.name} at ${nextTier.pop} people`);
  rows.push(`<h3>Tip</h3><p style="font-size:13px;color:var(--ink-soft)">Keep khush-hali above 55% and homes free — people arrive on their own, and taxes follow.</p>`);
  body.innerHTML = rows.join('');
}

// ---------- init ----------
export function initUi() {
  buildMenu();
  wireAssignPanel();

  $('btn-menu').addEventListener('click', () => { sfx.click(); openPanel('menu-panel'); });
  $('btn-stats').addEventListener('click', () => { sfx.click(); openPanel('stats-panel'); });
  $('btn-help').addEventListener('click', () => { sfx.click(); openPanel('help-panel'); });
  $('btn-deeds').addEventListener('click', () => { sfx.click(); openPanel('deeds-panel'); });
  $('btn-save').addEventListener('click', () => { sfx.coin(); saveGame(); });
  $('btn-new').addEventListener('click', () => { sfx.click(); openPanel('confirm-panel'); });
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closePanels));
  $('tool-cancel').addEventListener('click', () => setTool(null));

  $('btn-speed').addEventListener('click', () => {
    S.speed = S.speed === 1 ? 3 : S.speed === 3 ? 0 : 1;
    updateSpeedIcon();
    sfx.click();
  });
  $('btn-sound').addEventListener('click', () => {
    const on = !isEnabled();
    const ok = setEnabled(on);
    if (ok) {
      $('btn-sound').innerHTML = `<svg class="ic" aria-hidden="true"><use href="${on ? '#i-sound-on' : '#i-sound-off'}"/></svg>`;
      if (on) sfx.coin();
    }
  });
  $('btn-celebrate').addEventListener('click', () => {
    const r = celebrate();
    if (r.ok) { sfx.festival(); } else { pushNotice(r.why, 'warn'); sfx.error(); }
  });

  initWalkControls();
  initSearch();

  syncLensBtn();
  $('btn-lens').addEventListener('click', toggleLens);

  document.addEventListener('keydown', (e) => {
    // typing in the search box must never trigger game shortcuts
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'KeyT' && !anyPanelOpen()) { e.preventDefault(); toggleLens(); }
    if (e.code === 'Space' && !anyPanelOpen()) { e.preventDefault(); $('btn-speed').click(); }
    if (e.code === 'Escape') {
      if (anyPanelOpen()) closePanels();
      else if (tool) setTool(null);
    }
    if (walkActive() && /^Digit[1-4]$/.test(e.code) && !anyPanelOpen()) {
      doEmote(['wave', 'namaste', 'diya', 'heart'][Number(e.code.slice(5)) - 1]);
    }
  });

  window.addEventListener('apna:booted', () => {
    const welcome = $('welcome');
    if (hasSave()) $('btn-continue').hidden = false;
    welcome.hidden = false;
    $('btn-start').addEventListener('click', () => {
      welcome.hidden = true;
      window.__startNew();
      saveGame(true);
      setEnabled(false);
    });
    $('btn-continue').addEventListener('click', () => {
      welcome.hidden = true;
      window.__continue();
      sfx.coin();
    });
  });
}

export function updateSpeedIcon() {
  const b = $('btn-speed');
  const icon = S.speed === 0 ? '#i-play' : S.speed === 3 ? '#i-fast' : '#i-pause';
  b.innerHTML = `<svg class="ic" aria-hidden="true"><use href="${icon}"/></svg>`;
  b.setAttribute('aria-label', S.speed === 0 ? 'Resume' : 'Pause or change speed');
}
