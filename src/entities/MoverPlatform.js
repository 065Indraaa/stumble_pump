// ============================================================
// STUMBLE PUMP — MoverPlatform
// Oscillating kinematic platform that bridges pits/gaps.
// Visual: metal body + glowing edge trim + directional arrow decal.
// Position oscillates on X between x0 and x1.
// ============================================================
import * as THREE from 'three';
import { metalMat, pbrMat, basicMat } from '../core/AssetFactory.js';

export function makeMover({ z, x0, x1, w = 3, d = 3, sp = 0.6, color = 0x5FCB88 }) {
  const group = new THREE.Group();
  // metal body (slightly bevelled look via two stacked boxes)
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), metalMat(color, 0.3, 0.45));
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);
  // darker base skirt for depth
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.2, d * 0.96), metalMat(0x2A2A35, 0.5, 0.5));
  skirt.position.y = -0.35;
  group.add(skirt);
  // glowing edge trim around the top (emissive — reads as a moving platform)
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.04, 0.08, d + 0.04),
    pbrMat(color, { emissive: color, emissiveIntensity: 0.35, rough: 0.3 })
  );
  trim.position.y = 0.32;
  group.add(trim);
  // directional arrow decal on top (points in travel direction)
  const dir = x1 > x0 ? 1 : -1;
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 0.7, 3),
    basicMat(0xFFFFFF)
  );
  arrow.rotation.x = -Math.PI / 2;
  arrow.rotation.z = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  arrow.position.y = 0.34;
  group.add(arrow);

  group.position.set(x0, 0, z);
  return { mesh: group, z, x0, x1, w, d, sp, ph: Math.random() * Math.PI * 2, x: x0, y: 0 };
}

export function updateMover(m, t) {
  const mid = (m.x0 + m.x1) / 2;
  const amp = (m.x1 - m.x0) / 2;
  m.x = mid + Math.sin(t * m.sp + m.ph) * amp;
  m.mesh.position.x = m.x;
}
