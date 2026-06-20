// ============================================================
// STUMBLE PUMP — RedCandleObstacle
// Big red rolling candle that slides down a slope and knocks players.
// Visual: box body + wick. Logic handled by the map's checkActor
// (impulse + ragdoll on proximity). This module just builds the mesh
// and tracks position/velocity for the map's update loop.
// ============================================================
import * as THREE from 'three';
import { lambertMat } from '../core/AssetFactory.js';

export function makeRedCandle(x, y, z) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 6, 1.9), lambertMat(0xEF4444));
  body.castShadow = true; grp.add(body);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2, 8), lambertMat(0xDC2626));
  wick.position.y = 4; grp.add(wick);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 8), lambertMat(0xFBBF24));
  flame.position.y = 5.2; grp.add(flame);
  grp.position.set(x, y, z);
  return { grp, x, z, vz: -(6 + Math.random() * 5), roll: 0 };
}

export function updateRedCandle(c, dt) {
  c.z += c.vz * dt;
  c.roll += Math.abs(c.vz) * dt * 0.3;
  c.grp.position.z = c.z;
  c.grp.rotation.x = c.roll;
}
