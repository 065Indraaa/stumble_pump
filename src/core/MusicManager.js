// ============================================================
// STUMBLE PUMP — MusicManager
// Procedural background music via Web Audio (no external files).
// Two distinct generative loops:
//   - 'menu'   : chill upbeat major-key pad + arpeggio (~100 BPM)
//   - 'match'  : energetic driving bass + lead (~132 BPM)
// Respects the shared mute state from AudioManager. Switching modes
// cross-fades smoothly. start()/stop() are idempotent.
// ============================================================

// Shared AudioContext + master gain come from AudioManager (single ctx).
import { unlock as _audioUnlock } from './AudioManager.js';

let ctx = null, master = null, musicGain = null;
let schedTimer = null;
let mode = null;            // 'menu' | 'match' | null
let nextNoteTime = 0;
let step = 0;
let activeVoices = [];

function ensureContext() {
  if (ctx) return;
  // AudioManager owns the shared ctx/master on window.__spAudioCtx/__spMaster.
  // Calling unlock() ensures it's created + resumed (also a user-gesture unlock).
  _audioUnlock();
  ctx = window.__spAudioCtx || null;
  master = window.__spMaster || null;
}

// --- mode definitions: scales + patterns (step indices into the scale) ---
// C major pentatonic for menu (always consonant), A minor for match (driving).
const MODES = {
  menu: {
    bpm: 100,
    scale: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25],
    pad: [0, 3, 4, 2],
    arp: [0, 2, 4, 2, 5, 4, 2, 0, 1, 4, 6, 4, 5, 4, 2, 0],
    bass: [0, -1, -1, 0, -1, 0, -1, -1],
    bassOctave: -2,
    leadType: 'triangle',
    bassType: 'sine',
    padType: 'sine',
    leadGain: 0.10,
    bassGain: 0.14,
    padGain: 0.05,
  },
  match: {
    bpm: 132,
    scale: [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00],
    pad: [0, 5, 3, 4],
    arp: [0, 2, 4, 7, 4, 2, 5, 2, 3, 4, 6, 4, 2, 0, 4, 2],
    bass: [0, 0, -1, 0, -1, 5, -1, 0],
    bassOctave: -2,
    leadType: 'square',
    bassType: 'sawtooth',
    padType: 'sawtooth',
    leadGain: 0.08,
    bassGain: 0.12,
    padGain: 0.04,
  },
};

function _scheduleNote(freq, time, dur, type, gain) {
  if (!ctx || !musicGain) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, time);
  // soft attack + exponential release to avoid clicks
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(gain, time + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  o.connect(g); g.connect(musicGain);
  o.start(time);
  o.stop(time + dur + 0.05);
  activeVoices.push(o);
  // prune voice list (oscillators auto-stop)
  if (activeVoices.length > 64) activeVoices.splice(0, 32);
}

function _scaleFreq(scale, idx, octaveShift = 0) {
  if (idx < 0) return null;
  const n = scale.length;
  // wrap into the scale, shifting octave as needed
  let i = idx % n;
  let oct = octaveShift + Math.floor(idx / n);
  return scale[i] * Math.pow(2, oct);
}

function _scheduler() {
  if (!ctx || !mode) return;
  const m = MODES[mode];
  const secPerStep = 60 / m.bpm / 2; // eighth notes
  // schedule ahead by ~0.2s
  while (nextNoteTime < ctx.currentTime + 0.2) {
    const s = step % m.arp.length;
    // --- lead arpeggio ---
    const arpIdx = m.arp[s];
    if (arpIdx >= 0) {
      const f = _scaleFreq(m.scale, arpIdx, 1);
      if (f) _scheduleNote(f, nextNoteTime, secPerStep * 0.9, m.leadType, m.leadGain);
    }
    // --- bass line (slower: changes every 2 steps) ---
    if (s % 2 === 0) {
      const bassIdx = m.bass[Math.floor(s / 2) % m.bass.length];
      if (bassIdx >= 0) {
        const f = _scaleFreq(m.scale, bassIdx, m.bassOctave);
        if (f) _scheduleNote(f, nextNoteTime, secPerStep * 1.8, m.bassType, m.bassGain);
      }
    }
    // --- pad chord (every 8 steps, sustained) ---
    if (s % 8 === 0) {
      const chordRoot = m.pad[(Math.floor(step / 8)) % m.pad.length];
      // triad: root, third, fifth (scale indices)
      [chordRoot, chordRoot + 2, chordRoot + 4].forEach((ci) => {
        const f = _scaleFreq(m.scale, ci, 0);
        if (f) _scheduleNote(f, nextNoteTime, secPerStep * 7.5, m.padType, m.padGain);
      });
    }
    nextNoteTime += secPerStep;
    step++;
  }
}

/** Start (or switch) the generative music loop. mode: 'menu' | 'match'. */
export function setMusicMode(newMode) {
  ensureContext();
  if (!ctx) return;
  if (mode === newMode && schedTimer) return; // already playing this mode
  mode = newMode;
  if (!musicGain) {
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(window.__spMaster || ctx.destination);
  }
  // cross-fade in
  musicGain.gain.cancelScheduledValues(ctx.currentTime);
  musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
  musicGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.8);
  nextNoteTime = ctx.currentTime + 0.1;
  step = 0;
  if (!schedTimer) {
    schedTimer = setInterval(_scheduler, 50);
  }
}

/** Stop music entirely (cross-fade out, clear scheduler). */
export function stopMusic() {
  mode = null;
  if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
  if (musicGain && ctx) {
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
  }
  // let running voices finish naturally (they self-stop)
}

export function isMusicPlaying() { return !!mode; }

export default { setMusicMode, stopMusic, isMusicPlaying };
