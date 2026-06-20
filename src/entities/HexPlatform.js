// ============================================================
// STUMBLE PUMP — HexPlatform
// Rugpull survival platform with state machine: idle → warning → falling → gone.
// warning: red emissive blink + scale pulse. falling: drops with gravity.
// gone: hidden (permanent elimination — no respawn, harder/more strategic).
// groundHeightAt returns null when state != idle (player falls through).
// ============================================================
import * as THREE from 'three';
import { lambertMat } from '../core/AssetFactory.js';

export function makeHexPlatform(x, z, col, baseY = -0.3) {
  // StandardMaterial (PBR) with emissive — picks up IBL reflections AND
  // supports the warning-state emissive blink. Was raw MeshLambertMaterial.
  const mat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, emissive: 0x000000, roughness: 0.5, metalness: 0.1 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.6, 6), mat);
  top.receiveShadow = true; top.castShadow = true;
  // chamfer base
  const cham = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.7, 0.2, 6), lambertMat(col));
  cham.position.y = -0.4; top.add(cham);
  // stem
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 20, 6), lambertMat(0x6B5B95));
  stem.position.y = -10.3; top.add(stem);
  // edge ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.1, 8, 24), lambertMat(col));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.31; top.add(ring);
  const grp = new THREE.Group(); grp.add(top); grp.position.set(x, baseY, z);
  return { grp, mat, top, ring, x, z, state: 'idle', y0: baseY, fallV: 0, warnT: 0, baseY, col };
}

export function warnPlatform(p, duration = 1.5) {
  if (p.state !== 'idle') return;
  p.state = 'warning'; p.warnT = duration;
}

export function updateHexPlatform(p, dt) {
  if (p.state === 'warning') {
    p.warnT -= dt;
    const blink = Math.sin(p.warnT * 22) > 0;
    p.mat.emissive.setHex(blink ? 0xCC0000 : 0x000000);
    const s = 1 + (blink ? 0.08 : 0);
    p.grp.scale.set(s, 1, s);
    if (p.ring) p.ring.material.color.setHex(blink ? 0xEF4444 : p.col);
    if (p.warnT <= 0) {
      p.state = 'falling'; p.fallV = 0;
      p.mat.emissive.setHex(0x330000);
      if (p.ring) p.ring.material.color.setHex(0x991B1B);
    }
  } else if (p.state === 'falling') {
    p.fallV += dt * 12;
    p.baseY -= p.fallV * dt;
    p.grp.position.y = p.baseY;
    p.grp.rotation.x += dt * 0.8;
    p.grp.rotation.z += dt * 0.5;
    if (p.baseY < -16) { p.state = 'gone'; p.grp.visible = false; }
  }
  // 'gone' platforms stay gone (permanent)
}
