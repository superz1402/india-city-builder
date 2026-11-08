// audio.js — procedural WebAudio: a gentle tabla-ish loop, a tanpura drone,
// and small SFX. No audio files; everything is synthesized. Starts muted
// until the player enables sound (autoplay-policy friendly).

let ctxA = null, master = null, musicBus = null, sfxBus = null;
let enabled = false, loopTimer = null, step = 0, droneNodes = [];

function ensure() {
  if (ctxA) return true;
  try {
    ctxA = new (window.AudioContext || window.webkitAudioContext)();
    master = ctxA.createGain(); master.gain.value = 0; master.connect(ctxA.destination);
    musicBus = ctxA.createGain(); musicBus.gain.value = 0.9; musicBus.connect(master);
    sfxBus = ctxA.createGain(); sfxBus.gain.value = 1.0; sfxBus.connect(master);
    return true;
  } catch (e) { return false; }
}

function noiseBuffer() {
  const len = ctxA.sampleRate * 0.25;
  const buf = ctxA.createBuffer(1, len, ctxA.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
let _noise = null;

// one tabla stroke: membrane-ish pitch drop + optional noise slap
function stroke(t, freq = 96, slap = 0.3, gain = 0.5) {
  const o = ctxA.createOscillator(), g = ctxA.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.09);
  g.gain.setValueAtTime(gain * 0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  o.connect(g).connect(musicBus);
  o.start(t); o.stop(t + 0.2);
  if (slap > 0 && _noise) {
    const n = ctxA.createBufferSource(); n.buffer = _noise;
    const ng = ctxA.createGain(), f = ctxA.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.8;
    ng.gain.setValueAtTime(slap * gain * 0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(f).connect(ng).connect(musicBus);
    n.start(t); n.stop(t + 0.08);
  }
}

// 8-step teental-ish loop at ~92 bpm
const PATTERN = [
  { f: 98, s: 0.2, g: 1 }, { f: 0, s: 0, g: 0 }, { f: 210, s: 0.8, g: 0.5 }, { f: 98, s: 0.2, g: 0.8 },
  { f: 0, s: 0, g: 0 }, { f: 260, s: 0.9, g: 0.45 }, { f: 210, s: 0.7, g: 0.5 }, { f: 98, s: 0.2, g: 0.7 },
];

function startLoop() {
  stopLoop();
  const stepDur = 60 / 92 / 2;
  let next = ctxA.currentTime + 0.1;
  loopTimer = setInterval(() => {
    if (!ctxA) return;
    while (next < ctxA.currentTime + 0.3) {
      const p = PATTERN[step % 8];
      if (p.g > 0) stroke(next, p.f, p.s, p.g);
      step++; next += stepDur;
    }
  }, 120);
}
function stopLoop() { if (loopTimer) { clearInterval(loopTimer); loopTimer = null; } }

function startDrone() {
  const freqs = [110, 164.8]; // sa - pa
  for (const f of freqs) {
    const o = ctxA.createOscillator(), g = ctxA.createGain(), fl = ctxA.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f;
    fl.type = 'lowpass'; fl.frequency.value = 320; fl.Q.value = 0.6;
    g.gain.value = 0.035;
    o.connect(fl).connect(g).connect(musicBus);
    o.start();
    droneNodes.push(o);
  }
}

export function setEnabled(on) {
  enabled = on;
  if (on) {
    if (!ensure()) return false;
    if (ctxA.state === 'suspended') ctxA.resume();
    if (!_noise) _noise = noiseBuffer();
    if (!droneNodes.length) startDrone();
    if (!loopTimer) startLoop();
    master.gain.setTargetAtTime(0.5, ctxA.currentTime, 0.2);
  } else if (ctxA) {
    master.gain.setTargetAtTime(0, ctxA.currentTime, 0.1);
  }
  return true;
}
export function isEnabled() { return enabled; }

function blip(freq, dur, type = 'sine', gain = 0.25, slide = 0) {
  if (!enabled || !ctxA) return;
  const t = ctxA.currentTime;
  const o = ctxA.createOscillator(), g = ctxA.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  click() { blip(660, 0.06, 'triangle', 0.12); },
  place() { blip(160, 0.14, 'sine', 0.3, 70); },
  coin() { blip(880, 0.09, 'sine', 0.18); setTimeout(() => blip(1318, 0.12, 'sine', 0.16), 70); },
  error() { blip(220, 0.16, 'square', 0.1, 180); },
  moo() { blip(200, 0.5, 'sawtooth', 0.12, 130); },
  festival() { [523, 587, 698, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sawtooth', 0.08), i * 130)); },
  // rush-hour traffic: the classic two-tone Indian horn, muted and distant —
  // adapted from the tilt-shift demo's "tuned car-horn chords" (low-passed
  // square pair, quiet enough to sit under the tabla loop)
  horn() {
    if (!enabled || !ctxA) return;
    const t0 = ctxA.currentTime;
    const toot = (f, at, dur, g) => {
      const o = ctxA.createOscillator(), gn = ctxA.createGain(), fl = ctxA.createBiquadFilter();
      o.type = 'square'; o.frequency.setValueAtTime(f, t0 + at);
      fl.type = 'lowpass'; fl.frequency.value = 850; fl.Q.value = 1.4;
      gn.gain.setValueAtTime(0.0001, t0 + at);
      gn.gain.exponentialRampToValueAtTime(g, t0 + at + 0.035);
      gn.gain.setValueAtTime(g, t0 + at + dur * 0.6);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(fl).connect(gn).connect(sfxBus);
      o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
    };
    toot(392, 0, 0.2, 0.035);
    toot(330, 0.24, 0.22, 0.03);
  },
};
