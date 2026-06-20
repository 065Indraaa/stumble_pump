// ============================================================
// STUMBLE PUMP — GreenCandleTrampoline
// Static green pad that bounces players up on contact.
// Detailed 3D procedural trampoline with rim and bouncy pad.
// ============================================================
import * as THREE from 'three';
import { lambertMat, metalMat, toonMat } from '../core/AssetFactory.js';

export const BOUNCE_VELOCITY = 19;

export function makeGreenTrampoline(x, y, z) {
  const grp = new THREE.Group();
  
  // Base support structure (metallic)
  const baseGeo = new THREE.CylinderGeometry(1.6, 1.8, 1.5, 16);
  const baseMat = metalMat(0x333344, 0.5, 0.4);
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = -0.75;
  base.castShadow = true;
  base.receiveShadow = true;
  grp.add(base);

  // Rim (Padded edge)
  const rimGeo = new THREE.TorusGeometry(1.5, 0.25, 16, 24);
  const rimMat = toonMat(0x111111);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0;
  rim.castShadow = true;
  grp.add(rim);

  // Bounce Pad (Green)
  const padGroup = new THREE.Group();
  const padGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.1, 24);
  const padMat = toonMat(0x4ADE80);
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.castShadow = true;
  pad.receiveShadow = true;
  padGroup.add(pad);
  
  // Add a Bullish Up Arrow on the pad
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0.6);
  arrowShape.lineTo(0.5, 0);
  arrowShape.lineTo(0.2, 0);
  arrowShape.lineTo(0.2, -0.6);
  arrowShape.lineTo(-0.2, -0.6);
  arrowShape.lineTo(-0.2, 0);
  arrowShape.lineTo(-0.5, 0);
  arrowShape.lineTo(0, 0.6);
  const arrowGeo = new THREE.ShapeGeometry(arrowShape);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const arrow = new THREE.Mesh(arrowGeo, arrowMat);
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.y = 0.06;
  padGroup.add(arrow);

  grp.add(padGroup);
  grp.position.set(x, y, z);
  return { grp, padGroup, x, z, squash: 0 };
}

export function updateGreenTrampoline(t, dt) {
  if (t.squash > 0) {
    t.squash = Math.max(0, t.squash - dt * 5);
    // Elastic easing for bounce effect
    const bounceOffset = Math.sin(t.squash * Math.PI) * 0.8;
    t.padGroup.position.y = -bounceOffset;
    t.padGroup.scale.set(1, 1 - bounceOffset*0.5, 1);
  } else {
    t.padGroup.position.y = 0;
    t.padGroup.scale.set(1, 1, 1);
  }
}
