// sim.js — the deep economy: daily tick, money, food, water, power,
// happiness, population growth, seasons, tiers, random events.

import { S, pushNotice, recomputeStats, currentTierIdx, fmtMoney, MAP } from './state.js';
import { BUILDINGS, TIERS, SEASONS, SEASON_DAYS, ECON, FESTIVALS, FEST_EVERY, EVENTS } from './data.js';
import { spawnFestivalFx, endFestivalFx } from './events.js';
import { cowCount as agentsCowCount } from './agents.js';
import { hourOfDay, isNight } from './clock.js';

// v2: the sky and lamps follow the REAL Indian clock (IST). Re-exported here
// so render/ui keep a single import surface.
export { hourOfDay, isNight };
export function seasonOf(day) { return SEASONS[Math.floor((day - 1) / SEASON_DAYS) % 4]; }

export function tick(dt) {
  // No city yet (welcome screen up, grid empty): the clock must not advance —
  // newDay() would recomputeStats on an empty grid and crash the loop.
  if (S.speed === 0 || !S.grid.length) return;
  S.tday += dt * S.speed;
  let guard = 0;
  while (S.tday >= ECON.daySeconds && guard++ < 5) {
    S.tday -= ECON.daySeconds;
    newDay();
  }
}

function mult() {
  let m = 1;
  const fest = S.festival && FESTIVALS.find(f => f.id === S.festival.id);
  if (fest) m *= 1.2;
  if (seasonOf(S.day).id === 'harvest') m *= 1.1;
  return m;
}

function newDay() {
  S.day++;
  if (!S.stats) recomputeStats(true);
  const st = S.stats, season = seasonOf(S.day);
  const poweredOk = st.powerGen >= st.powerUse;

  // ---- money ----
  let inc = 0;
  const shopFactor = (S.powerCut || !poweredOk) ? 0.5 : 1;
  for (const [k, n] of Object.entries(S.counts)) {
    const d = BUILDINGS[k];
    if (!d) continue;
    let base = (d.income || 0) * n;
    if (d.pw && !poweredOk) base *= shopFactor;
    if (d.cat === 'farm' && (season.id === 'harvest' || (season.id === 'monsoon' && k === 'paddy'))) base *= 1.6;
    if (d.cat === 'farm' && k === 'paddy' && season.id !== 'monsoon') base *= 0.85;
    inc += base;
  }
  const tax = S.pop * ECON.taxPerPop * (0.5 + S.happy / 100) * mult();
  const net = inc + tax - st.upkeep;
  S.money = Math.max(0, S.money + net);
  S.lastNet = net;

  // ---- food ----
  let foodProd = st.food;
  if (season.id === 'monsoon') foodProd *= 1.15;
  const eaten = S.pop * ECON.foodPerPop;
  S.foodStock = Math.max(0, S.foodStock + foodProd - eaten);
  const hungry = S.foodStock <= 0.5;

  // ---- water ----
  let waterDemand = S.pop * ECON.waterPerPop;
  if (season.id === 'summer') waterDemand *= 1.25;
  if (season.id === 'monsoon') waterDemand *= 0.6;
  const thirsty = waterDemand > st.waterCap;

  // ---- power ----
  S.powerCut = st.powerUse > 0 && !poweredOk;
  if (S.powerCut && Math.random() < 0.6) {
    pushNotice('Load-shedding today — powered shops earn half. Build a Substation.', 'warn');
  }

  // ---- happiness ----
  let h = 42 + st.happyPts;
  if (st.faiths >= 3) h += 6;                       // unity bonus across faiths
  h -= Math.max(0, st.pol) * 0.8;
  if (hungry) h -= 10;
  if (thirsty) h -= 6;
  if (S.powerCut) h -= 4;
  const workforce = Math.round(S.pop * 0.6);
  if (workforce > 0 && st.jobs < workforce) h -= Math.min(12, (workforce - st.jobs) * 0.25);
  if (S.festival) {
    const fest = FESTIVALS.find(f => f.id === S.festival.id);
    h += fest.boost + (S.festival.celebrated ? 6 : 0);
  }
  if (season.id === 'monsoon') h += 1;
  S.happy = Math.max(5, Math.min(100, h));

  // ---- population ----
  const housing = st.homes;
  if (S.happy >= 45 && !hungry && housing > S.pop) {
    S.pop = Math.min(housing, S.pop + Math.max(1, Math.round((housing - S.pop) * 0.08)));
  } else if (S.happy < 35 || hungry) {
    const leaving = Math.max(1, Math.round(S.pop * 0.02));
    S.pop = Math.max(ECON.startPop * 0.5, S.pop - leaving);
    if (hungry) pushNotice('Food shortage! People are leaving. Build another farm.', 'bad');
    else if (thirsty) pushNotice('Water is running short in summer. Build a Water Tank.', 'bad');
  }

  // ---- tier ups ----
  const t = currentTierIdx();
  if (t > S.tierIdx) {
    S.tierIdx = t;
    pushNotice(`${TIERS[t].name}! Your settlement grew — new buildings unlocked.`, 'good');
  }

  // ---- festivals ----
  if (S.festival && S.day > S.festival.endDay) {
    S.festival = null;
    endFestivalFx();
    S.nextFestDay = S.day + FEST_EVERY;
    pushNotice('The festival lights come down. The shehar hums along.', 'info');
  }
  if (!S.festival && S.day >= S.nextFestDay) {
    const f = FESTIVALS[S.festIndex % FESTIVALS.length];
    S.festIndex++;
    S.festival = { id: f.id, endDay: S.day + f.days, celebrated: false };
    spawnFestivalFx(f.id);
    pushNotice(f.text, 'good');
  }

  // ---- random flavour events ----
  randomEvents(st);

  recomputeStats();
}

function randomEvents(st) {
  if (agentsCowCount() >= 2 && Math.random() < EVENTS.cowJamChance) {
    pushNotice('A cow has claimed the main road. Traffic waits. The cow is right.', 'warn');
    S.jamUntil = performance.now() + 16000;
  }
  if (st.faiths >= 3 && Math.random() < EVENTS.pilgrimChance) {
    const gift = Math.round(S.pop * 2.5 + 80);
    S.money += gift;
    pushNotice(`Pilgrims pass through your shehar and donate ${fmtMoney(gift)} at the faith places.`, 'good');
  }
  if ((S.counts.bazaar || S.counts.mandir) && Math.random() < EVENTS.weddingChance) {
    const gift = Math.round(120 + Math.random() * 200);
    S.money += gift;
    pushNotice(`A big fat wedding in the gully! Band, lights, and ${fmtMoney(gift)} into local shops.`, 'good');
  }
  if (st.powerUse > 0 && st.powerGen >= st.powerUse && Math.random() < 0.08) {
    pushNotice('Bijli board praises your shehar: power surplus earns a small rebate.', 'good');
    S.money += 100;
  }
}
