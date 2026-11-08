// clock.js — real Indian Standard Time (IST, UTC+05:30, no DST).
// The sky, street lamps, festivals-of-light and citizen schedules follow the
// ACTUAL clock in India, so the shehar is alive at the same hour its people
// are. Nothing here is accelerated: 8 pm IST looks like 8 pm IST.

const IST_OFFSET_MIN = 330; // India = UTC+05:30

function istDate() {
  const now = new Date();
  // local -> UTC -> IST (getTimezoneOffset is minutes to ADD to local for UTC)
  return new Date(now.getTime() + (now.getTimezoneOffset() + IST_OFFSET_MIN) * 60000);
}

export function istParts() {
  const d = istDate();
  return {
    h: d.getHours(),
    m: d.getMinutes(),
    s: d.getSeconds(),
    hour: d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600,
    minutes: d.getHours() * 60 + d.getMinutes(),
  };
}

// 0..24 float, IST
export function hourOfDay() { return istParts().hour; }

// India's practical night: street lamps ~7 pm to ~5:30 am
export function isNight() { const h = hourOfDay(); return h >= 19 || h < 5.5; }

export function isEvening() { const h = hourOfDay(); return h >= 17 && h < 19; }

export function isMorning() { const h = hourOfDay(); return h >= 5.5 && h < 10; }

export function istLabel() {
  const p = istParts();
  const h12 = ((p.h + 11) % 12) + 1;
  const ampm = p.h < 12 ? 'am' : 'pm';
  return `${h12}:${String(p.m).padStart(2, '0')} ${ampm}`;
}

// Phase of day used for citizen schedules and ambience.
export function dayPhase() {
  const h = hourOfDay();
  if (h < 5) return 'night';
  if (h < 9) return 'dawn';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 19.5) return 'evening';
  return 'night';
}

// ---- Toy Town Rush Hour (adapted from lemo-opuscar styles/tilt-shift) ----
// India's real commute rhythm, read off the IST clock: the roads wake into a
// morning peak around 8–11, breathe at midday, pack up again 5–8:30 pm, and
// thin right out late at night ("Six a.m. One car. One note.").
function tri(x, a, p, b) {
  if (x <= a || x >= b) return 0;
  return x < p ? (x - a) / (p - a) : (b - x) / (b - p);
}

// Traffic density multiplier, ~0.25 (sleeping streets) to ~2.1 (gridlock-ish).
export function rushLevel(h = hourOfDay()) {
  const m = tri(h, 7.2, 9.4, 11.6);    // morning peak
  const e = tri(h, 16.4, 18.6, 21.0);  // evening peak
  let r = 0.5 + m * 1.6 + e * 1.6;     // midday breathes at ~0.5, peaks at 2.1
  if (h >= 23 || h < 5.5) r *= 0.5;    // late night: the Mahanagar sleeps
  return Math.min(2.1, r);
}

// Pedestrian commute swell, 0..1 (people flood the streets at the same hours).
export function commuteLevel(h = hourOfDay()) {
  return Math.max(tri(h, 7.2, 9.4, 11.6), tri(h, 16.4, 18.6, 21.0));
}
