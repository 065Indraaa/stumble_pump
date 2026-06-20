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
export function toonMat(color) { return new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() }); }
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

// ---- sky themes per arena ----
export const SKY_THEMES = {
  bonding:     { top: '#5BC0F8', mid: '#7DD3F0', bot: '#A8E6F5', glow: '#E0F4FA', sun: '#FFF6D6', stars: false },
  rugpull:     { top: '#5B2C9E', mid: '#8B5CF6', bot: '#C4B5FD', glow: '#F5F3FF', sun: '#FFE4B0', stars: true },
  moon:        { top: '#0B1E4D', mid: '#1E3A8A', bot: '#3B82F6', glow: '#DBEAFE', sun: '#E8EEFF', stars: true },
  liquidation: { top: '#7C2D12', mid: '#EA580C', bot: '#FB923C', glow: '#FFF7ED', sun: '#FFE6B0', stars: false },
  menu_bg:     { top: '#3B82F6', mid: '#60A5FA', bot: '#A8E6F5', glow: '#E0F4FA', sun: '#FFF6D6', stars: false },
};

const SKY_TEX_CACHE = {};
export function makeSkyTexture(themeKey) {
  if (SKY_TEX_CACHE[themeKey]) return SKY_TEX_CACHE[themeKey];
  const th = SKY_THEMES[themeKey] || SKY_THEMES.menu_bg;
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 512;
  const cx = cv.getContext('2d');
  const g = cx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, th.top); g.addColorStop(0.55, th.mid); g.addColorStop(0.85, th.bot); g.addColorStop(1, th.glow);
  cx.fillStyle = g; cx.fillRect(0, 0, 16, 512);
  if (th.stars) {
    cx.fillStyle = '#ffffff';
    for (let i = 0; i < 80; i++) {
      const y = Math.random() * 340; const a = 0.25 + Math.random() * 0.6;
      cx.globalAlpha = a; cx.fillRect(Math.random() * 16, y, 1, 1);
    }
    cx.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  SKY_TEX_CACHE[themeKey] = t;
  return t;
}

// ---- curved panoramic backdrop (cylinder facing inward) ----
export function makeBackdrop(themeKey, opts = {}) {
  const radius = opts.radius || 240;
  const height = opts.height || 150;
  const yPos = opts.y != null ? opts.y : 30;
  const startAngle = opts.start != null ? opts.start : 0;
  const lenAngle = opts.len != null ? opts.len : Math.PI * 2;
  const geo = new THREE.CylinderGeometry(radius, radius, height, 48, 1, true, startAngle, lenAngle);
  const mat = new THREE.MeshBasicMaterial({ map: makeSkyTexture(themeKey), side: THREE.BackSide, fog: false, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(opts.x || 0, yPos, opts.z || 0);
  mesh.rotation.y = opts.rot || 0;
  mesh.renderOrder = -10;
  return mesh;
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
