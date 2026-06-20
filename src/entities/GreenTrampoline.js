// ============================================================
// STUMBLE PUMP — GreenCandleTrampoline
// Static green pad that bounces players up on contact.
// Squash animation on landing (decays back). Map's checkActor
// applies vel.y = BOUNCE on overlap; this module owns visuals + squash state.
// ============================================================
import * as THREE from 'three';
import { lambertMat } from '../core/AssetFactory.js';

export const BOUNCE_VELOCITY = 19;

export function makeGreenTrampoline(x, y, z) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), lambertMat(0x16A34A));
  body.castShadow = true; grp.add(body);
  const top = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), lambertMat(0x4ADE80));
  top.rotation.x = -Math.PI / 2; top.position.y = 2.02; grp.add(top);
  grp.position.set(x, y, z);
  return { grp, x, z, squash: 0 };
}

export function updateGreenTrampoline(t, dt) {
  if (t.squash > 0) {
    t.squash = Math.max(0, t.squash - dt * 4);
    const s = 1 - t.squash * 0.2;
    const s2 = 1 + t.squash * 0.2;
    t.grp.scale.set(s2, s, s2);
  } else {
    t.grp.scale.set(1, 1, 1);
  }
}
