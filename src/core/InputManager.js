// ============================================================
// STUMBLE PUMP — InputManager
// Keyboard + touch + mouse-drag -> game intents.
// Exposes a singleton `Input` with consumed flags for one-shot intents.
// ============================================================
import * as THREE from 'three';
import { MOBILE, canvas } from './Engine.js';

export const Input = {
  keys: {},
  move: new THREE.Vector2(),   // x=strafe, y=forward (-1..1)
  jump: false,
  dive: false,
  emote: false,
  emoteKey: null,              // which emote was requested (null = equipped default)
  camYaw: 0.0,
  camPitch: 0.28,
  joy: { active: false, dx: 0, dy: 0 },
  _dragging: false, _lastX: 0, _lastY: 0,
  consumeJump() { if (this.jump) { this.jump = false; return true; } return false; },
  consumeDive() { if (this.dive) { this.dive = false; return true; } return false; },
  // returns the chosen emote key, or null if none requested
  consumeEmote() { if (this.emote) { this.emote = false; const k = this.emoteKey; this.emoteKey = null; return k || 'dance'; } return null; },
  // fire an emote (used by keyboard E = equipped, wheel = specific)
  triggerEmote(key = null) { this.emote = true; this.emoteKey = key; },
};

window.addEventListener('keydown', (e) => {
  Input.keys[e.code] = true;
  if (e.code === 'Space') { Input.jump = true; e.preventDefault(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'ControlLeft') Input.dive = true;
  if (e.code === 'KeyE') {
    // E plays the equipped emote (read from shared store, default 'dance')
    const equipped = (window.__spEquippedEmote) || 'dance';
    Input.triggerEmote(equipped);
  }
});
window.addEventListener('keyup', (e) => { Input.keys[e.code] = false; });
window.addEventListener('blur', () => { Input.keys = {}; Input.move.set(0, 0); });

// mouse drag for camera orbit (desktop)
canvas.addEventListener('mousedown', (e) => { Input._dragging = true; Input._lastX = e.clientX; Input._lastY = e.clientY; });
window.addEventListener('mouseup', () => { Input._dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (!Input._dragging) return;
  const dx = e.clientX - Input._lastX, dy = e.clientY - Input._lastY;
  Input._lastX = e.clientX; Input._lastY = e.clientY;
  Input.camYaw -= dx * 0.005;
  Input.camPitch = Math.max(-0.2, Math.min(0.9, Input.camPitch + dy * 0.004));
});

// touch camera rotate (right thumb swipe) handled by mobile controls
export function applyTouchCamera(dx, dy) {
  Input.camYaw -= dx * 0.005;
  Input.camPitch = Math.max(-0.2, Math.min(0.9, Input.camPitch + dy * 0.004));
}

/** Read keyboard into Input.move (desktop). Returns the move vector. */
export function readKeyboardMove() {
  let x = 0, y = 0;
  // Note: Three.js -Z is forward. We map W (forward) to y=-1.
  if (Input.keys['KeyW'] || Input.keys['ArrowUp']) y -= 1;
  if (Input.keys['KeyS'] || Input.keys['ArrowDown']) y += 1;
  if (Input.keys['KeyA'] || Input.keys['ArrowLeft']) x -= 1;
  if (Input.keys['KeyD'] || Input.keys['ArrowRight']) x += 1;
  if (!MOBILE) {
    Input.move.set(x, y);
    if (Input.move.lengthSq() > 1) Input.move.normalize();
  }
  return Input.move;
}

// ---- mobile virtual joystick (left half) + touch-drag camera (right half) ----
let joyEl = null, knobEl = null, joyId = null, joyCx = 0, joyCy = 0;
const JOY_R = 56;
// right-half touch-drag camera state (separate touch id from joystick)
let camId = null, camLastX = 0, camLastY = 0;

export function initMobileControls() {
  if (!MOBILE) return;
  joyEl = document.getElementById('joystick');
  knobEl = document.getElementById('joy-knob');
  if (!joyEl) return;
  // touchstart: left half → joystick; right half (not on a button) → camera drag
  window.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      const onLeft = t.clientX < window.innerWidth * 0.5;
      if (onLeft && !Input.joy.active) {
        Input.joy.active = true; joyId = t.identifier;
        joyCx = t.clientX; joyCy = t.clientY;
        if (joyEl) { joyEl.style.left = (t.clientX - 70) + 'px'; joyEl.style.top = (t.clientY - 70) + 'px'; joyEl.style.display = 'flex'; }
      } else if (!onLeft && camId === null) {
        // only grab the right-half touch if it didn't land on an action button
        const target = document.elementFromPoint(t.clientX, t.clientY);
        const onButton = target && target.closest && target.closest('button');
        if (!onButton) { camId = t.identifier; camLastX = t.clientX; camLastY = t.clientY; }
      }
    }
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    for (const t of e.touches) {
      // joystick move
      if (Input.joy.active && t.identifier === joyId) {
        let dx = t.clientX - joyCx, dy = t.clientY - joyCy;
        const d = Math.hypot(dx, dy);
        if (d > JOY_R) { dx = dx / d * JOY_R; dy = dy / d * JOY_R; }
        if (knobEl) knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
        Input.joy.dx = dx / JOY_R; Input.joy.dy = dy / JOY_R;
        Input.move.set(Input.joy.dx, Input.joy.dy);
        if (Input.move.lengthSq() > 1) Input.move.normalize();
      }
      // camera drag (right half)
      if (camId !== null && t.identifier === camId) {
        const dx = t.clientX - camLastX, dy = t.clientY - camLastY;
        camLastX = t.clientX; camLastY = t.clientY;
        applyTouchCamera(dx, dy);
      }
    }
  }, { passive: true });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        Input.joy.active = false; joyId = null;
        Input.joy.dx = 0; Input.joy.dy = 0; Input.move.set(0, 0);
        if (knobEl) knobEl.style.transform = 'translate(0,0)';
        if (joyEl) joyEl.style.display = 'none';
      }
      if (t.identifier === camId) { camId = null; }
    }
  };
  window.addEventListener('touchend', end);
  window.addEventListener('touchcancel', end);
}

export function mobileJumpBtn() { if (MOBILE) { const b = document.getElementById('btn-jump'); if (b) b.addEventListener('touchstart', (e) => { e.preventDefault(); Input.jump = true; }, { passive: false }); } }
export function mobileDiveBtn() { if (MOBILE) { const b = document.getElementById('btn-dive'); if (b) b.addEventListener('touchstart', (e) => { e.preventDefault(); Input.dive = true; }, { passive: false }); } }
// Emote button: quick tap = equipped emote, long-press (180ms) = open wheel.
// Uses touchstart/touchend timing; if the wheel is showing, taps are handled
// by the wheel itself (its own listeners call Input.triggerEmote).
export function mobileEmoteBtn() {
  if (!MOBILE) return;
  const b = document.getElementById('btn-emote');
  if (!b) return;
  let pressTimer = null, moved = false, startX = 0, startY = 0;
  b.addEventListener('touchstart', (e) => {
    e.preventDefault();
    moved = false;
    const t = e.changedTouches[0];
    startX = t.clientX; startY = t.clientY;
    // long-press → open the emote wheel
    pressTimer = setTimeout(() => {
      pressTimer = null;
      window.dispatchEvent(new CustomEvent('sp_open_emote_wheel', { detail: { x: startX, y: startY } }));
    }, 180);
  }, { passive: false });
  b.addEventListener('touchmove', (e) => {
    const t = e.changedTouches[0];
    if (Math.hypot(t.clientX - startX, t.clientY - startY) > 10) moved = true;
  }, { passive: true });
  b.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    else return; // long-press already fired (wheel open) — don't also quick-trigger
    if (!moved) {
      // quick tap → equipped emote
      Input.triggerEmote(window.__spEquippedEmote || 'dance');
    }
  }, { passive: false });
}
