// ============================================================
// STUMBLE PUMP — Sweeper
// Rotating horizontal bar that knocks players (ragdoll at the tip).
// Upgraded 3D procedural Sweeper with padded arms and bolted base.
// ============================================================
import * as THREE from 'three';
import { lambertMat, metalMat, toonMat } from '../core/AssetFactory.js';

export function makeSweeper(z, baseY, len, sp) {
  const pivot = new THREE.Group();
  pivot.position.set(0, baseY, z);

  // Sturdy bolted base (Hexagonal prism)
  const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.6, 6);
  const baseMat = metalMat(0x333344, 0.4, 0.4);
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.3;
  pivot.add(base);

  // Rotating post
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.5, 12), metalMat(0x6B7387, 0.7, 0.3));
  post.position.y = 1.25; 
  pivot.add(post);

  // Arm joint (Motor housing)
  const motor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), metalMat(0xFF8A3D, 0.8, 0.2));
  motor.position.y = 1.9;
  pivot.add(motor);

  // Padded sweeper arm
  // We use a capsule to give it a soft, padded pool-noodle look
  const armRadius = 0.45;
  const armLength = len;
  const armGeo = new THREE.CapsuleGeometry(armRadius, armLength, 8, 16);
  const armMat = toonMat(0xFF5151); // Red padding
  const bar = new THREE.Mesh(armGeo, armMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 1.9; 
  pivot.add(bar);

  // Mint and white caution stripes wrapping the arm
  const stripeGeo = new THREE.TorusGeometry(armRadius + 0.02, 0.06, 8, 16);
  const stripeMat1 = toonMat(0xA3E635);
  const stripeMat2 = toonMat(0xffffff);
  for (let i = -armLength/2 + 1; i <= armLength/2 - 1; i += 1.5) {
    const s1 = new THREE.Mesh(stripeGeo, stripeMat1);
    s1.rotation.y = Math.PI / 2;
    s1.position.set(i, 1.9, 0);
    pivot.add(s1);
    
    const s2 = new THREE.Mesh(stripeGeo, stripeMat2);
    s2.rotation.y = Math.PI / 2;
    s2.position.set(i + 0.75, 1.9, 0);
    pivot.add(s2);
  }

  // Large padded end caps
  for (const e of [-1, 1]) {
    const capGeo = new THREE.SphereGeometry(armRadius + 0.25, 16, 16);
    const capMat = toonMat(0x4ADE80);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(e * armLength / 2, 1.9, 0); 
    // Add small spikes to the end caps
    const spikeGeo = new THREE.ConeGeometry(0.2, 0.6, 6);
    const spikeMat = metalMat(0x333344);
    for(let a=0; a<Math.PI*2; a+=Math.PI/2) {
       const spike = new THREE.Mesh(spikeGeo, spikeMat);
       spike.rotation.x = a;
       spike.position.y = Math.sin(a)*0.6;
       spike.position.z = Math.cos(a)*0.6;
       cap.add(spike);
    }
    pivot.add(cap);
  }

  // The 'bar' mesh is tracked for collision, but the whole pivot rotates
  return { pivot, bar, z, y: baseY + 1.9, len: len / 2, sp, ang: Math.random() * 6 };
}

export function updateSweeper(s, dt) {
  s.ang += s.sp * dt;
  s.pivot.rotation.y = s.ang;
}
