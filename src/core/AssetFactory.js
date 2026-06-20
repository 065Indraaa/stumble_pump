// ============================================================
// STUMBLE PUMP — AssetFactory
// Material library, procedural canvas textures, gradient maps,
// sky textures, and shared geometry caches. Procedural-only
// (no GLTF — per brief).
// ============================================================
import * as THREE from 'three';

// ---- 3-step toon gradient ramp (cheerful cartoon shading) ----
let _grad = null;
export function gradientMap() {
  if (_grad) return _grad;
  const g = new THREE.DataTexture(new Uint8Array([120, 200, 255]), 3, 1, THREE.RedFormat);
  g.magFilter = THREE.NearestFilter; g.minFilter = THREE.NearestFilter;
  g.needsUpdate = true;
  _grad = g;
  return g;
}

// ---- material factories ----
export function toonMat(color) { 
  return new THREE.MeshStandardMaterial({ 
    color, 
    roughness: 0.2, 
    metalness: 0.1 
  }); 
}
export function lambertMat(color) { return new THREE.MeshLambertMaterial({ color }); }
export function basicMat(color) { return new THREE.MeshBasicMaterial({ color }); }
export function metalMat(color, metal = 0.9, rough = 0.15) {
  return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
}
export function pbrMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, metalness: opts.metal ?? 0.0, roughness: opts.rough ?? 0.7,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
  });
}

// ---- texture loader + cache ----
const TEXLOADER = new THREE.TextureLoader();
const TEXCACHE = {};
export function tex(url) {
  if (!TEXCACHE[url]) {
    const t = TEXLOADER.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    TEXCACHE[url] = t;
  }
  return TEXCACHE[url];
}

// ---- billboard text sprite (canvas-based) ----
const _billboardCache = new Map();
export function makeBillboard(text, color = 0xffd700, scale = 7) {
  const key = text + '|' + color + '|' + scale;
  if (_billboardCache.has(key)) {
    const c = _billboardCache.get(key).clone();
    c.material = c.material.clone();
    return c;
  }
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const cx = cv.getContext('2d');
  cx.font = "bold 70px 'Fredoka One', sans-serif";
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.lineWidth = 10; cx.strokeStyle = '#1a1430';
  cx.strokeText(text, 256, 64);
  cx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  cx.fillText(text, 256, 64);
  const tex2d = new THREE.CanvasTexture(cv);
  tex2d.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex2d, transparent: true, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), mat);
  mesh.scale.setScalar(scale);
  _billboardCache.set(key, mesh);
  return mesh.clone();
}

// ---- nameplate label sprite ----
export function makeLabel(text) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const cx = cv.getContext('2d');
  cx.font = "bold 30px Inter, sans-serif";
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.lineWidth = 6; cx.strokeStyle = 'rgba(0,0,0,0.7)';
  cx.strokeText(text, 128, 32);
  cx.fillStyle = '#ffffff'; cx.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(2.4, 0.6, 1);
  spr.position.set(0, 2.2, 0);
  return spr;
}

// ---- black back-face outline (cartoon ink) ----
export function addOutline(mesh, thickness = 0.05) {
  const m = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: 0x1a1430, side: THREE.BackSide }));
  m.scale.multiplyScalar(1 + thickness);
  m.raycast = () => {};
  mesh.add(m);
  return m;
}
