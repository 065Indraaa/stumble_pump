// ============================================================
// STUMBLE PUMP — Sweeper
// Rotating horizontal bar that knocks players (ragdoll at the tip).
// Visual: post + rotating bar + end caps. The pivot group rotates.
// ============================================================
import * as THREE from 'three';
import { lambertMat } from '../core/AssetFactory.js';

export function makeSweeper(z, baseY, len, sp) {
  const pivot = new THREE.Group();
  pivot.position.set(0, baseY, z);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2, 10), lambertMat(0x64748B));
  post.position.y = 0; pivot.add(post);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 0.55), lambertMat(0xEF4444));
  bar.position.y = 0.9; pivot.add(bar);
  for (const e of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), lambertMat(0xF87171));
    cap.position.set(e * len / 2, 0.9, 0); pivot.add(cap);
  }
  return { pivot, bar, z, y: baseY + 1.2, len: len / 2, sp, ang: Math.random() * 6 };
}

export function updateSweeper(s, dt) {
  s.ang += s.sp * dt;
  s.pivot.rotation.y = s.ang;
}
