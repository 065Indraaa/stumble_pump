// ============================================================
// STUMBLE PUMP — Pendulum (wrecking ball)
// Swinging ball on a rope. Knocks players within radius (ragdoll).
// Visual: pivot group + rope + ball. piv.rotation.x oscillates.
// ============================================================
import * as THREE from 'three';
import { lambertMat } from '../core/AssetFactory.js';

export function makePendulum(z, baseY, x, amp, sp) {
  const piv = new THREE.Group();
  piv.position.set(x, baseY, z);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 6), lambertMat(0x78350F));
  rope.position.y = -3; piv.add(rope);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 16), lambertMat(0x8B5CF6));
  ball.position.y = -6; piv.add(ball);
  return { piv, ball, z, x, baseY, amp, sp, ph: Math.random() * 6 };
}

export function updatePendulum(p, t) {
  p.piv.rotation.x = Math.sin(t * p.sp + p.ph) * p.amp;
}
