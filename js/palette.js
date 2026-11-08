// palette.js — the one warm Indian palette shared by BOTH cameras.
// v5 First-Person Rehaul (issue #23): the iso map and the street-level
// first-person view must read as the same city, so every surface colour
// lives here. Also hosts the light model: the sun sits in the SOUTH-EAST
// all day (one consistent direction), so SE faces are lit, NW faces are
// in shade, in plan view and at street level alike.

export const PAL = {
  // walls
  terracotta: '#c4553a', terracottaDark: '#8f3a26',
  cream: '#f1e3c8', creamShade: '#d9c39c',
  sand: '#e5d3ac', sandDark: '#c9b489',
  jaipur: '#d98a8f', jaipurDark: '#b06570',
  jodhpur: '#5b7fa6', jodhpurDark: '#3d5a78',
  mint: '#9ec3a8', mintDark: '#6f9a7c',
  whitewash: '#f4efe2',
  // trim
  gold: '#d4a017', saffron: '#ff8f00', teal: '#2e6e63', slate: '#4a545e',
  wood: '#8a6242', woodDark: '#5d4037',
  // ground
  dust: '#cbb894', dustDeep: '#b7a37e',
  grass: '#9ab76a', grassDeep: '#7ba054', grassPark: '#8fbc6f',
  road: '#45403a', roadDeep: '#37332e', kerb: '#b3a68f', lane: '#efe6cf',
  water: '#4a90b8', waterDeep: '#39759c', foam: '#e7f4f8',
  // glass & night
  glass: '#9cc4de', glassDark: '#5e829c',
  windowLit: '#ffd166', windowDark: '#39434e',
};

// face brightness for the SE sun — indexed the same way in both renderers
export const FACE_LIGHT = { S: 1.0, E: 0.9, W: 0.72, N: 0.62, T: 1.07 };

// shade("#c4553a", 0.8) → darkened; f>1 lightens toward warm white
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f <= 1) {
    r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f);
  } else {
    const k = f - 1;
    r = Math.round(r + (255 - r) * k); g = Math.round(g + (255 - g) * k); b = Math.round(b + (255 - b) * k);
  }
  return `rgb(${r},${g},${b})`;
}

// mix two hex/rgb colors by t (0 = a, 1 = b) — used for distance haze
export function mix(a, b, t) {
  const pa = parseCol(a), pb = parseCol(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function parseCol(c) {
  if (!c) return [128, 128, 128]; // never crash on a missing colour
  if (c[0] === '#') {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/(\d+)[, ]+(\d+)[, ]+(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : [128, 128, 128];
}

// real-IST ambient light: smooth dawn/dusk ramps, deep blue-slate night floor.
// Returns { amb (0.34..1), warm (0..1 orange cast), night (bool) }
export function daylight(h) {
  // keyframes: [hour, ambient, warm]
  const K = [[0, .36, 0], [5, .36, 0], [6.2, .62, .55], [7.5, .88, .3], [9, 1, .1],
    [16, 1, .08], [17.6, .92, .35], [18.8, .7, .6], [19.8, .46, .3], [21, .36, 0], [24, .36, 0]];
  for (let i = 0; i < K.length - 1; i++) {
    if (h >= K[i][0] && h <= K[i + 1][0]) {
      const f = (h - K[i][0]) / (K[i + 1][0] - K[i][0] || 1);
      return { amb: K[i][1] + (K[i + 1][1] - K[i][1]) * f, warm: K[i][2] + (K[i + 1][2] - K[i][2]) * f, night: h >= 19.4 || h < 5.8 };
    }
  }
  return { amb: .36, warm: 0, night: true };
}

// haze (fog) colour for a given daylight state — the far world melts into this
export function hazeCol(dl) {
  const a = dl.amb;
  if (dl.night) return mix('#131a33', '#1a2340', a);
  const base = mix('#cfd8e4', '#f5ddba', dl.warm);
  return mix('#131a33', base, a);
}
