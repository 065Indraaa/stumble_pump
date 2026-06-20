// ============================================================
// STUMBLE PUMP — AudioManager
// Procedural Web Audio: SFX via oscillators/noise + ambient drone.
// No external audio files (per brief). Mute persists in localStorage.
// ============================================================
import { LS_MUTE } from '../config/constants.js';

let ctx = null, master = null, ambientNodes = [];
let muted = localStorage.getItem(LS_MUTE) === '1';

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMute(m) {
  muted = m;
  localStorage.setItem(LS_MUTE, m ? '1' : '0');
  if (master) master.gain.value = m ? 0 : 0.55;
}
export function isMuted() { return muted; }
export function unlock() { ensure(); }

function tone(freq, freq2, dur, type = 'sine', gain = 0.3) {
  ensure(); if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + dur);
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
}

function noise(dur, gain = 0.5, cutoff = 1800) {
  ensure(); if (!ctx) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); g.gain.value = gain;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
  src.connect(f); f.connect(g); g.connect(master); src.start();
}

export const SFX = {
  jump() { tone(440, 660, 0.12, 'sine', 0.3); },
  land() { noise(0.1, 0.4); },
  hit() { noise(0.32, 0.6); tone(120, 40, 0.3, 'sawtooth', 0.25); },
  qualify() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, f, 0.18, 'sine', 0.3), i * 90)); },
  eliminate() { tone(440, 110, 0.7, 'sawtooth', 0.3); },
  beep() { tone(880, 880, 0.07, 'square', 0.25); },
  go() { tone(660, 1320, 0.3, 'square', 0.35); },
  spin() { tone(1400, 300, 1.6, 'sawtooth', 0.18); },
  ding() { tone(1568, 1568, 0.4, 'sine', 0.3); },
  bounce() { tone(300, 900, 0.18, 'sine', 0.35); },
  coin() { tone(988, 1318, 0.12, 'square', 0.2); },
  click() { tone(660, 440, 0.06, 'square', 0.2); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, f, 0.25, 'triangle', 0.32), i * 110)); },
  countdownGo() { tone(880, 1760, 0.4, 'square', 0.4); },
};

export function startAmbient() {
  ensure(); if (!ctx) return; stopAmbient();
  [110, 164.81, 220].forEach((f) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; g.gain.value = 0.04;
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.1; lg.gain.value = 0.02; lfo.connect(lg); lg.connect(g.gain);
    o.connect(g); g.connect(master); o.start(); lfo.start();
    ambientNodes.push(o, lfo);
  });
}
export function stopAmbient() { ambientNodes.forEach((n) => { try { n.stop(); } catch (e) {} }); ambientNodes = []; }

export default { SFX, setMute, isMuted, unlock, startAmbient, stopAmbient };
