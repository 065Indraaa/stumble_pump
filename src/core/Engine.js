// ============================================================
// STUMBLE PUMP — Engine
// Owns the renderer, scene, camera, lights, resize handling,
// clock, and the main animate loop driver.
// AAA-quality rendering: PBR materials, IBL environment reflections,
// player-following crisp shadows, contact shadows, and an
// auto-detected post-processing pipeline (SSAO + subtle bloom).
// ============================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
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
renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CAM_FOV, window.innerWidth / window.innerHeight, 0.1, 800);
// Apply portrait-aware FOV right away so the very first frame is framed well.
if (window.innerHeight > window.innerWidth) camera.fov = Math.min(82, CAM_FOV + 8);
camera.position.set(0, 6, 12);
camera.updateProjectionMatrix();

// ---- Image-Based Lighting (IBL) ----
// Generate a soft studio environment and assign it as scene.environment so
// every MeshStandardMaterial gets real reflections + sky ambient. Slightly
// dimmed so bright surfaces don't wash out (the envMap fills midtones, it
// shouldn't blow out highlights).
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;
scene.environmentIntensity = 0.35;   // muted env fill (was default 1.0 → too bright)

// ---- Lights: Bright, cheerful sunny day rig (Party Royale style) ----
const sun = new THREE.DirectionalLight(0xFFF4E0, 2.6);
sun.position.set(24, 40, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
// Tighter frustum = crisper shadows. We reposition the sun + target each
// frame to follow the player (see updateSunFollow), so a small frustum
// covers the on-screen action at high resolution everywhere in the arena.
sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
sun.shadow.camera.left = -34; sun.shadow.camera.right = 34;
sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.025;
scene.add(sun); scene.add(sun.target);

const ambient = new THREE.AmbientLight(0x88AAFF, 0.55);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0xFFFFFF, 0x4466AA, 0.85);
scene.add(hemi);

// rim light for character separation
const rim = new THREE.DirectionalLight(0xFFEECC, 0.7);
rim.position.set(-18, 14, -22);
scene.add(rim);

// ---- Player-following sun target (set externally by GameController) ----
let _sunFollow = null;   // THREE.Vector3 the shadow rig follows
export function setSunFollowTarget(v) { _sunFollow = v; }
function updateSunFollow() {
  if (!_sunFollow) return;
  // keep the sun offset relative to the follow point so shadows stay crisp
  sun.target.position.set(_sunFollow.x, 0, _sunFollow.z);
  sun.position.set(_sunFollow.x + 24, 40, _sunFollow.z + 18);
  sun.target.updateMatrixWorld();
  sun.shadow.camera.updateProjectionMatrix();
}

const clock = new THREE.Clock();

// ---- Post-processing pipeline (auto-detected) ----
// Full pipeline: RenderPass → SSAO (subtle ambient occlusion) → bloom (only
// catches bright emissives) → OutputPass (tone map + color space).
// Auto-detect: desktop always on; mobile on only if devicePixelRatio ≤ 2 and
// a tiny render benchmark passes; otherwise PBR-only (no composer).
let composer = null;
let bloomPass = null;
let ssaoPass = null;
let POST_ON = false;
let _ppAttempted = false;

function _deviceCanPostProcess() {
  if (!MOBILE) return true;
  // low-DPR phones (≤2) generally handle SSAO+bloom; very high DPR flagships
  // often throttle, so we still cap there.
  if (window.devicePixelRatio > 2) return false;
  // quick benchmark: time a single heavy render; if > 22ms skip post-fx.
  const t0 = performance.now();
  renderer.render(scene, camera);
  const ms = performance.now() - t0;
  return ms < 22;
}

export async function initPostProcessing() {
  if (_ppAttempted) return;       // only attempt once per session
  _ppAttempted = true;
  if (!_deviceCanPostProcess()) { POST_ON = false; return; }
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // SSAO — subtle, only darkens creases/contact areas. Output is the scene
    // color so we feed it forward to bloom/output.
    ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    ssaoPass.kernelRadius = 8;
    ssaoPass.minDistance = 0.002;
    ssaoPass.maxDistance = 0.1;
    composer.addPass(ssaoPass);
    // Bloom — extremely subtle. Only truly bright emissives (lamp globes,
    // lava, the trophy star) get a soft glow; normal bright surfaces must NOT
    // bloom into white haze (that was the "smoke/putih" complaint). High
    // threshold + low strength keeps the cheerful look crisp.
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.12, // strength (very subtle — was 0.35, too much white haze)
      0.4,  // radius (tighter)
      0.95  // threshold (only near-white emissives bloom)
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
    composer.setSize(window.innerWidth, window.innerHeight);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.5 : 2));
    POST_ON = true;
  } catch (e) {
    console.warn('[engine] post-processing init failed, falling back to PBR-only', e);
    composer = null; POST_ON = false;
  }
}
export function disablePostProcessing() {
  composer = null; bloomPass = null; ssaoPass = null; POST_ON = false;
}
export function setBloom(strength) { if (bloomPass) bloomPass.strength = strength; }
export function isPostOn() { return POST_ON; }


// ---- resize ----
window.addEventListener('resize', onResize);
function onResize() {
  const portrait = window.innerHeight > window.innerWidth;
  camera.fov = portrait ? Math.min(82, CAM_FOV + 8) : CAM_FOV;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.5 : 2));
  if (composer) {
    composer.setSize(window.innerWidth, window.innerHeight);
    if (ssaoPass) ssaoPass.setSize(window.innerWidth, window.innerHeight);
  }
}

// ---- quality toggle ----
export function setQuality(q) {
  localStorage.setItem(LS_QUALITY, q);
  const high = q === 'high';
  renderer.shadowMap.enabled = high;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1));
  if (high) initPostProcessing();
  else disablePostProcessing();
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
  try { physicsStep(dt); } catch (e) { console.error('[physics] step error', e); }
  updateSunFollow();
  if (frameCallback) {
    try { frameCallback(dt, t); }
    catch (e) {
      // A throwing frame callback must NOT kill the render loop.
      console.error('[frame] callback error (suppressed to keep loop alive)', e);
    }
  }
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
