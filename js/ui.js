// ui.js — HUD, build menu, panels, notices, tile info. DOM layer only:
// all game rules live in state/sim; all pixels live in render/arts.

import { S, pushNotice, recomputeStats, canPlace, place, removeAt, fmtMoney, clearUiDirty } from './state.js';
import { BUILDINGS, CATS, TIERS } from './data.js';
import { drawThumb, setGhost } from './render.js';
import { celebrate, celebrateCost, activeFestival } from './events.js';
import { saveGame, hasSave } from './save.js';
import { sfx, setEnabled, isEnabled } from './audio.js';
import { seasonOf } from './sim.js';

const $ = (id) => document.getElementById(id);
let tool = null;
let lastHud = {};
let tapInfoHide = null;

export function getTool() { return tool; }

export function setTool(key, { silent = false } = {}) {
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
  if (!tool) { showTileInfo(tile.x, tile.y, screen); return; }
  if (tile.x < 0 || tile.y < 0 || tile.x >= 36 || tile.y >= 36) return;
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
    title: TIERS[S.tierIdx].name,
  };
  const el = {
    money: $('st-money'), pop: $('st-pop'), happy: $('st-happy'), day: $('st-day'), title: $('town-title'),
  };
  if (lastHud.money !== vals.money) el.money.textContent = vals.money;
  if (lastHud.pop !== vals.pop) el.pop.textContent = vals.pop;
  if (lastHud.happy !== vals.happy) {
    el.happy.textContent = vals.happy;
    el.happy.style.color = S.happy >= 55 ? 'var(--good)' : S.happy >= 40 ? 'var(--warn)' : 'var(--bad)';
  }
  if (lastHud.day !== vals.day) el.day.textContent = vals.day;
  if (lastHud.title !== vals.title) el.title.textContent = vals.title;
  lastHud = vals;

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

// ---------- tile info ----------
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
      if (d.pol) lines.push(`${d.pol < 0 ? 'cleans' : 'pollutes'} ${Math.abs(d.pol)}`);
      if (lines.length) html += `<span class="ti-line">${lines.join(' · ')}</span>`;
      const refund = Math.floor((d.cost || 0) * 0.4);
      html += `<button class="btn danger" id="ti-remove" style="margin-top:8px;min-height:36px;padding:6px 12px">Remove · +${fmtMoney(refund)}</button>`;
    } else html += `<b>${g.k}</b>`;
  } else if (tv.w) {
    html += `<b>Water</b><span class="ti-line">Build a bridge to cross.</span>`;
  } else {
    html += `<b>Open land</b><span class="ti-line">Pick a building below, then tap here.</span>`;
  }
  box.innerHTML = html;
  box.hidden = false;
  const bw = 250, bh = 160;
  box.style.left = Math.max(8, Math.min(window.innerWidth - bw, screen.cx - bw / 2)) + 'px';
  box.style.top = Math.max(60, Math.min(window.innerHeight - bh - 140, screen.cy - 130)) + 'px';
  const rm = box.querySelector('#ti-remove');
  if (rm) rm.addEventListener('click', (e) => {
    e.stopPropagation();
    const r = removeAt(x, y);
    if (r.ok) { sfx.place(); pushNotice(`Removed. Refund ${fmtMoney(r.refund)}.`, 'info'); }
    hideTileInfo();
  });
  clearTimeout(tapInfoHide);
  tapInfoHide = setTimeout(hideTileInfo, 7000);
}
function hideTileInfo() { const b = $('tile-info'); if (b) b.hidden = true; }

// ---------- panels ----------
function openPanel(id) {
  for (const p of ['menu-panel', 'stats-panel', 'help-panel', 'confirm-panel']) $(p).hidden = p !== id;
  if (id === 'stats-panel') fillStats();
}
function closePanels() {
  for (const p of ['menu-panel', 'stats-panel', 'help-panel', 'confirm-panel']) $(p).hidden = true;
}
export function anyPanelOpen() {
  return ['menu-panel', 'stats-panel', 'help-panel', 'confirm-panel', 'welcome'].some(id => !$(id).hidden);
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

  $('btn-menu').addEventListener('click', () => { sfx.click(); openPanel('menu-panel'); });
  $('btn-stats').addEventListener('click', () => { sfx.click(); openPanel('stats-panel'); });
  $('btn-help').addEventListener('click', () => { sfx.click(); openPanel('help-panel'); });
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

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !anyPanelOpen()) { e.preventDefault(); $('btn-speed').click(); }
    if (e.code === 'Escape') {
      if (anyPanelOpen()) closePanels();
      else if (tool) setTool(null);
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
