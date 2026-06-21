// ============================================================
// STUMBLE PUMP — SceneManager
// Finite-state machine over game screens + modes.
// Modes: boot, auth, menu, customize, lobby, roulette, match,
//        result, winner, rooms, room-waiting, history.
// Each mode has optional enter/exit/update hooks registered by the
// gameplay layer. This module only owns transitions + DOM screen show/hide.
// ============================================================
import { MOBILE } from './Engine.js';
import { setTouchScreenMode as _setTouchMode } from './InputManager.js';

const SCREENS = [
  'auth-screen', 'main-menu', 'customize', 'lobby-ui', 'roulette-ui',
  'match-hud', 'result-ui', 'rooms-screen', 'room-waiting',
  'winner-screen', 'history-screen',
];

export const state = {
  mode: 'boot',
  map: null,
  actors: [],
  player: null,
  preview: null,
  remotes: new Map(),
  modeT: 0,
  data: {},
  fov: 70,
};

const hooks = {};  // mode -> { enter, exit, update }

export function register(mode, { enter, exit, update } = {}) {
  hooks[mode] = { enter, exit, update };
}

export function showScreen(id) {
  SCREENS.forEach((s) => document.getElementById(s)?.classList.add('hidden'));
  if (id) document.getElementById(id)?.classList.remove('hidden');
  if (id !== 'match-hud') {
    ['objective-badge', 'race-progress'].forEach((e) => document.getElementById(e)?.classList.add('hidden'));
    document.getElementById('arena-intro')?.classList.remove('show');
  }
}

export function setMode(mode) {
  if (state.mode === mode) return;
  const prev = hooks[state.mode];
  if (prev?.exit) { try { prev.exit(); } catch (e) { console.warn(e); } }
  state.mode = mode;
  state.modeT = 0;
  // Enable touch controls (joystick + drag-camera) ONLY in lobby/match.
  // On menu/customize/rooms/roulette/result the touch handlers stay off so
  // taps on those screens don't spawn a ghost joystick or rotate the camera.
  _setTouchMode(mode === 'lobby' || mode === 'match');
  const next = hooks[mode];
  if (next?.enter) { try { next.enter(); } catch (e) { console.warn(e); } }
}

export function tick(dt, t) {
  state.modeT += dt;
  const h = hooks[state.mode];
  if (h?.update) h.update(dt, t);
}

export function isMobileLayout() { return MOBILE; }

export function disposeActors() {
  state.actors.forEach((a) => a.dispose());
  state.actors = [];
  state.player = null;
  state.remotes = new Map();
}

export function disposeMap() {
  if (state.map) { state.map.dispose?.(); state.map = null; }
}
