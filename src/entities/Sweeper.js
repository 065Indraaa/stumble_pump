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
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2, 12), lambertMat(0x6B7387));
  post.position.y = 0; pivot.add(post);
  // mint-tipped hazard bar with warning stripes look (red body, mint end caps)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 0.55), lambertMat(0xFF5151));
  bar.position.y = 0.9; pivot.add(bar);
  // mint stripe down the bar center for visibility against dark terrain
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(len * 0.98, 0.12, 0.57), lambertMat(0xA3E635));
  stripe.position.y = 0.9; pivot.add(stripe);
  for (const e of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 12), lambertMat(0xFF8A3D));
    cap.position.set(e * len / 2, 0.9, 0); pivot.add(cap);
  }
  return { pivot, bar, z, y: baseY + 1.2, len: len / 2, sp, ang: Math.random() * 6 };
}

export function updateSweeper(s, dt) {
  s.ang += s.sp * dt;
  s.pivot.rotation.y = s.ang;
}
