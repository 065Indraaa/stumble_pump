// ============================================================
// STUMBLE PUMP — Pendulum (wrecking ball)
// Swinging ball on a chain. Knocks players within radius (ragdoll).
// Visual: pivot + chain links + spiked metal ball with emissive core.
// ============================================================
import * as THREE from 'three';
import { lambertMat, metalMat, pbrMat } from '../core/AssetFactory.js';

const _chainGeo = new THREE.TorusGeometry(0.12, 0.04, 6, 10);
const _spikeGeo = new THREE.ConeGeometry(0.18, 0.5, 6);

export function makePendulum(z, baseY, x, amp, sp) {
  const piv = new THREE.Group();
  piv.position.set(x, baseY, z);

  // anchor cap at the pivot point
  const anchor = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.4, 10), metalMat(0x4A4A55, 0.8, 0.35));
  anchor.castShadow = true; piv.add(anchor);

  // chain: 8 torus links running down the rope length
  const chainMat = metalMat(0x6B6B75, 0.9, 0.3);
  const ropeLen = 6;
  const linkCount = 8;
  for (let i = 0; i < linkCount; i++) {
    const link = new THREE.Mesh(_chainGeo, chainMat);
    const yy = -(i + 0.5) * (ropeLen / linkCount);
    link.position.y = yy;
    link.rotation.set(Math.PI / 2, i % 2 ? Math.PI / 2 : 0, 0); // alternating links
    link.castShadow = true;
    piv.add(link);
  }

  // wrecking ball — heavy dark metal with an emissive energy core
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 16), metalMat(0x3A2A4A, 0.85, 0.25));
  ball.position.y = -ropeLen;
  ball.castShadow = true; ball.receiveShadow = true;
  piv.add(ball);

  // glowing core band around the ball (emissive — reads as a hazard)
  const core = new THREE.Mesh(
    new THREE.TorusGeometry(1.18, 0.08, 8, 24),
    pbrMat(0xA77BFF, { emissive: 0x7755CC, emissiveIntensity: 0.6, rough: 0.3 })
  );
  core.position.y = -ropeLen;
  core.rotation.x = Math.PI / 2;
  piv.add(core);

  // spikes radiating from the ball
  const spikeMat = metalMat(0x5A5A65, 0.9, 0.2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(_spikeGeo, spikeMat);
    // place around the ball's equator
    spike.position.set(Math.cos(a) * 1.15, -ropeLen, Math.sin(a) * 1.15);
    spike.rotation.z = Math.PI / 2;
    spike.rotation.y = -a;
    spike.castShadow = true;
    piv.add(spike);
  }

  return { piv, ball, z, x, baseY, amp, sp, ph: Math.random() * 6 };
}

export function updatePendulum(p, t) {
  p.piv.rotation.x = Math.sin(t * p.sp + p.ph) * p.amp;
}
