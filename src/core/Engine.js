// ============================================================
// STUMBLE PUMP — Engine
// Owns the renderer, scene, camera, lights, resize handling,
// clock, and the main animate loop driver.
// Graphics are deliberately bright/cheerful (Stumble Guys style).
// Post-processing is feature-flagged via quality setting.
// ============================================================
import * as THREE from 'three';
import { CAM_FOV, isMobile, LS_QUALITY } from '../config/constants.js';
import { step as physicsStep } from './PhysicsWorld.js';

const canvas = document.getElementById('game-canvas');
const MOBILE = isMobile();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !MOBILE,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CAM_FOV, window.innerWidth / window.innerHeight, 0.1, 800);
camera.position.set(0, 6, 12);

// ---- Lights: bright cheerful outdoor 3-point rig ----
const sun = new THREE.DirectionalLight(0xffffff, 1.7);
sun.position.set(24, 36, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 180;
sun.shadow.camera.left = -75; sun.shadow.camera.right = 75;
sun.shadow.camera.top = 75; sun.shadow.camera.bottom = -75;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun); scene.add(sun.target);

const ambient = new THREE.AmbientLight(0xB0D8F0, 0.9);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0x87CEEB, 0x8FD4A0, 0.85);
scene.add(hemi);

// rim light from behind for character separation
const rim = new THREE.DirectionalLight(0xffe8c4, 0.5);
rim.position.set(-18, 14, -22);
scene.add(rim);

const clock = new THREE.Clock();

// ---- Post-processing: DISABLED (clean, bright, non-neon look) ----
// The user prefers a clean bright look without bloom/glow on any page.
// We keep no-op stubs so setQuality()/setBloom() don't break, but never
// attach an EffectComposer. Rendering goes straight through renderer.render().
let composer = null;
let bloomPass = null;
let POST_ON = false;

export async function initPostProcessing() { /* no-op — bloom disabled for clean look */ }
export function disablePostProcessing() { composer = null; bloomPass = null; POST_ON = false; }

export function setBloom() { /* no-op — neon bloom intentionally disabled */ }
export function isPostOn() { return false; }


// ---- resize ----
window.addEventListener('resize', onResize);
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.5 : 2));
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}

// ---- quality toggle ----
export function setQuality(q) {
  localStorage.setItem(LS_QUALITY, q);
  const high = q === 'high';
  renderer.shadowMap.enabled = high;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1));
  if (high && !POST_ON) initPostProcessing();
  if (!high) disablePostProcessing();
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}

// ---- main loop driver ----
let frameCallback = null;
export function setFrameCallback(fn) { frameCallback = fn; }

function renderFrame() {
  if (POST_ON && composer) composer.render();
  else renderer.render(scene, camera);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  physicsStep(dt);
  if (frameCallback) frameCallback(dt, t);
  renderFrame();
}

export function startLoop() { animate(); }

// ---- camera shake ----
const camShake = { intensity: 0, dur: 0, t: 0 };
export function shakeCamera(intensity, duration) {
  camShake.intensity = Math.max(camShake.intensity, intensity);
  camShake.dur = Math.max(camShake.dur, duration);
  camShake.t = camShake.dur;
}
function applyCamShake() {
  if (camShake.t <= 0) return;
  camShake.t -= 1 / 60;
  const k = Math.max(0, camShake.t / camShake.dur) * camShake.intensity;
  camera.position.x += (Math.random() - 0.5) * k;
  camera.position.y += (Math.random() - 0.5) * k;
  camera.position.z += (Math.random() - 0.5) * k;
}
export function tickCamShake() { applyCamShake(); }

export { scene, camera, renderer, sun, ambient, hemi, rim, clock, MOBILE, canvas };
