// tiltshift.js — "Tilt-Shift Miniature" post-processing.
// Adapted from lemo-opuscar styles/tilt-shift (film: "Toy Town Rush Hour").
// The source demo runs three.js shader passes (circle-of-confusion + gather
// + grade); we re-implement the GRAMMAR of the style dependency-free on
// canvas 2D, per STYLE.md:
//   1. BLUR BAND — only a thin (tilt-able) horizontal strip of the frame is
//      sharp; everything above and below melts into blur. Two masked blur
//      layers give the gradual "depth of field grows with distance" falloff
//      (sharp core → light blur ring → heavy blur edges).
//   2. GRADE — strong saturation boost, soft added contrast, slightly warm
//      highlights, a vignette; saturation is LOWERED at night (§2).
//   3. THE BAND FOLLOWS THE SUBJECT — render.js aims it at the map focus in
//      plan mode and at the PLAYER in walk mode ("band follows one subject").
//   4. Native moves live here too: nothing — render.js owns in-world effects
//      (light trails, cloud shadows); this module is pure post.
// Zero images, zero libraries: blur = downscale/upscale round trips, masks =
// destination-in gradients, grade = ctx.filter with a graceful fallback.

// Default ON only where it can hold frame-rate: desktop pointers. Phones/
// tablets pay ~2.75x per frame for the two masked blur pipelines (measured
// 8 vs 22 fps in walk mode) — the owner asked for the SMOOTHEST rendering,
// so coarse-pointer devices start with the lens OFF and can still flip it
// on from the lens button (an explicit toggle always wins over the default).
let pref = (() => {
  try {
    const saved = localStorage.getItem('apna-shehar-lens-v1');
    if (saved !== null) return saved !== '0';          // explicit user choice
  } catch (e) { /* storage blocked — fall through to capability default */ }
  const coarse = typeof matchMedia === 'function' &&
    (matchMedia('(pointer: coarse)').matches || matchMedia('(hover: none)').matches);
  return !coarse;
})();

let sharp = null, light = null, heavy = null, tmpA = null, tmpB = null, tmpC = null;
let lw = 0, lh = 0, ldpr = 1;
const band = { y: 0.5, w: 0.16, tilt: 0 };

export function isLensOn() { return pref; }
export function lensPref() { return pref; }

export function setLensOn(on) {
  pref = !!on;
  try { localStorage.setItem('apna-shehar-lens-v1', pref ? '1' : '0'); } catch (e) { /* ignore */ }
  return pref;
}

// render.js aims the sharp strip every frame (normalised y, half-width in
// screen heights, tilt in radians). Defaults read like the reference: band
// through the middle, gentle tilt.
export function setLensBand(y, w, tilt) {
  band.y = y; band.w = w; band.tilt = tilt || 0;
}

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function alloc(W, H, dpr) {
  lw = W; lh = H; ldpr = dpr;
  const w = Math.max(2, Math.round(W * dpr)), h = Math.max(2, Math.round(H * dpr));
  sharp = mk(w, h); light = mk(w, h); heavy = mk(w, h);
  tmpA = mk(Math.max(2, w >> 1), Math.max(2, h >> 1)); // 1/2 — light blur source
  tmpB = mk(Math.max(2, w >> 3), Math.max(2, h >> 3)); // 1/8 — heavy blur source
  tmpC = mk(Math.max(2, Math.round(w / 3)), Math.max(2, Math.round(h / 3))); // smoothing step
}

// Called by render.js at the top of every frame while the lens is on.
// Returns the context the whole world should draw into (offscreen), or null
// when the lens is off (caller keeps drawing straight to the visible canvas).
export function lensBegin(W, H, dpr) {
  if (!pref) return null;
  // cap the sharp target a touch below full dpr — after band blur + grade
  // the difference is invisible and city-scale frames stay cheap
  const eff = Math.min(dpr, 1.75);
  if (!sharp || lw !== W || lh !== H || ldpr !== eff) alloc(W, H, eff);
  const c = sharp.getContext('2d');
  c.setTransform(eff, 0, 0, eff, 0, 0);
  c.clearRect(0, 0, W, H);
  return c;
}

// One downscale/upscale round trip into `dst` from `src` via `mid` (already
// sized). imageSmoothing does the softening — works in every browser, no
// ctx.filter needed for the blur half of the effect.
function blurInto(src, mid, dst) {
  const mc = mid.getContext('2d');
  mc.setTransform(1, 0, 0, 1, 0, 0);
  mc.clearRect(0, 0, mid.width, mid.height);
  mc.imageSmoothingEnabled = true; mc.imageSmoothingQuality = 'high';
  mc.drawImage(src, 0, 0, mid.width, mid.height);
  const dc = dst.getContext('2d');
  dc.setTransform(1, 0, 0, 1, 0, 0);
  dc.clearRect(0, 0, dst.width, dst.height);
  dc.imageSmoothingEnabled = true; dc.imageSmoothingQuality = 'high';
  dc.drawImage(mid, 0, 0, mid.width, mid.height, 0, 0, dst.width, dst.height);
}

// Heavy blur takes an extra smoothing hop (1/8 → 1/3 → full) so the boxy
// downsample artifacts wash out into a clean gaussian-ish melt.
function blurHeavyInto(src) {
  const bc = tmpB.getContext('2d');
  bc.setTransform(1, 0, 0, 1, 0, 0);
  bc.clearRect(0, 0, tmpB.width, tmpB.height);
  bc.imageSmoothingEnabled = true; bc.imageSmoothingQuality = 'high';
  bc.drawImage(src, 0, 0, tmpB.width, tmpB.height);
  const cc = tmpC.getContext('2d');
  cc.setTransform(1, 0, 0, 1, 0, 0);
  cc.clearRect(0, 0, tmpC.width, tmpC.height);
  cc.imageSmoothingEnabled = true; cc.imageSmoothingQuality = 'high';
  cc.drawImage(tmpB, 0, 0, tmpB.width, tmpB.height, 0, 0, tmpC.width, tmpC.height);
  const hc = heavy.getContext('2d');
  hc.setTransform(1, 0, 0, 1, 0, 0);
  hc.clearRect(0, 0, heavy.width, heavy.height);
  hc.imageSmoothingEnabled = true; hc.imageSmoothingQuality = 'high';
  hc.drawImage(tmpC, 0, 0, tmpC.width, tmpC.height, 0, 0, heavy.width, heavy.height);
}

// Mask a full-size blur layer with the tilted sharp band (blur = visible
// OUTSIDE the band). kCenter/halfWidth/falloff are in device px. The gradient
// axis is rotated by band.tilt, so the strip can lean like a real tilted lens.
function maskLayer(cv, halfW, falloff) {
  const c = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'destination-in';
  c.translate(w / 2, h / 2);
  c.rotate(band.tilt);
  const halfD = Math.hypot(w, h) / 2 + 2;
  const k = (band.y - 0.5) * h; // band centre offset in px along the axis
  const at = (v) => Math.max(0, Math.min(1, (v + halfD) / (2 * halfD)));
  const top = k - halfW, bot = k + halfW;
  // [offset, alpha] — alpha is blur visibility: 1 at frame edges, 0 in band
  const raw = [
    [0, 1],
    [at(top - falloff), 0],
    [at(top - falloff * 0.45), 0.5],
    [at(top), 0],
    [at(bot), 0],
    [at(bot + falloff * 0.45), 0.5],
    [at(bot + falloff), 0],
    [1, 1],
  ];
  const g = c.createLinearGradient(0, -halfD, 0, halfD);
  let prev = -1;
  for (const [o, a] of raw) {
    if (o <= prev + 0.001) continue; // keep stops strictly increasing
    g.addColorStop(o, `rgba(0,0,0,${a})`);
    prev = o;
  }
  c.fillStyle = g;
  c.fillRect(-halfD, -halfD, halfD * 2, halfD * 2);
  c.restore();
}

// Composite the finished frame onto the visible canvas.
// opts: { night } — grade is gentler at night (STYLE.md §2).
export function lensCompose(dst, opts = {}) {
  if (!pref || !sharp || !dst) return;
  const night = !!opts.night;
  const w = sharp.width, h = sharp.height;

  blurInto(sharp, tmpA, light);
  blurHeavyInto(sharp);
  maskLayer(light, band.w * h * 1.15, h * 0.13);
  maskLayer(heavy, band.w * h * 2.1, h * 0.34);

  dst.save();
  dst.setTransform(1, 0, 0, 1, 0, 0);
  dst.imageSmoothingEnabled = true; dst.imageSmoothingQuality = 'high';

  // grade: "saturated, sunny, freshly painted model" — softened at night
  const sat = night ? 1.14 : 1.36, con = night ? 1.05 : 1.1;
  const canFilter = typeof dst.filter === 'string';
  if (canFilter) dst.filter = `saturate(${sat}) contrast(${con})`;
  dst.drawImage(sharp, 0, 0);
  if (canFilter) dst.filter = 'none';
  dst.drawImage(light, 0, 0);
  dst.drawImage(heavy, 0, 0);

  // slightly warm highlights (day only)
  if (!night) {
    dst.globalCompositeOperation = 'overlay';
    dst.fillStyle = 'rgba(255,186,120,.05)';
    dst.fillRect(0, 0, w, h);
    dst.globalCompositeOperation = 'source-over';
  }

  // vignette, x-axis widened ×1.25 like the reference shader
  dst.save();
  dst.translate(w / 2, h / 2);
  dst.scale(1.25, 1);
  const r = Math.hypot(w / 2, h / 2);
  const vg = dst.createRadialGradient(0, 0, Math.min(w, h) * 0.42, 0, 0, r);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, night ? 'rgba(8,6,24,.42)' : 'rgba(20,10,30,.28)');
  dst.fillStyle = vg;
  dst.fillRect(-w, -h, w * 2, h * 2);
  dst.restore();

  dst.restore();
}
