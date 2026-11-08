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
