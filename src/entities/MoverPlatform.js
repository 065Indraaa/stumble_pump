// ============================================================
// STUMBLE PUMP — MoverPlatform
// Oscillating kinematic platform that bridges pits/gaps.
// Visual: box. Position oscillates on X between x0 and x1.
// groundHeightAt returns its surface when player is over it.
// ============================================================
import * as THREE from 'three';
import { lambertMat } from '../core/AssetFactory.js';

export function makeMover({ z, x0, x1, w = 3, d = 3, sp = 0.6, color = 0x5FCB88 }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), lambertMat(color));
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.position.set(x0, 0, z);
  return { mesh, z, x0, x1, w, d, sp, ph: Math.random() * Math.PI * 2, x: x0, y: 0 };
}

export function updateMover(m, t) {
  const mid = (m.x0 + m.x1) / 2;
  const amp = (m.x1 - m.x0) / 2;
  m.x = mid + Math.sin(t * m.sp + m.ph) * amp;
  m.mesh.position.x = m.x;
}
