// events.js — festival lifecycle, celebration spending, and one-off hooks.

import { S, pushNotice, fmtMoney } from './state.js';
import { FESTIVALS, ECON } from './data.js';

export function spawnFestivalFx(id) {
  // visuals are driven by render.js from S.festival; audio hooks live in ui
  S.burstSeq = (S.burstSeq || 0) + 1;
}

export function endFestivalFx() {
  S.burstSeq = (S.burstSeq || 0) + 1;
}

export function activeFestival() {
  return S.festival ? FESTIVALS.find(f => f.id === S.festival.id) : null;
}

export function celebrateCost() {
  const fest = activeFestival();
  if (!fest) return 0;
  return Math.round(fest.costBase + S.pop * ECON.costCelebration);
}

export function celebrate() {
  const fest = activeFestival();
  if (!fest) return { ok: false, why: 'No festival today' };
  if (S.festival.celebrated) return { ok: false, why: 'Already celebrated this one — wait for the next festival' };
  const cost = celebrateCost();
  if (S.money < cost) return { ok: false, why: `Need ${fmtMoney(cost)} to celebrate` };
  S.money -= cost;
  S.festival.celebrated = true;
  S.burstSeq = (S.burstSeq || 0) + 1;
  pushNotice(`${fest.name} celebrated across the shehar! Khush-hali rises.`, 'good');
  return { ok: true };
}
