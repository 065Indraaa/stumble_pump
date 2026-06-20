// ============================================================
// STUMBLE PUMP — RedCandleObstacle
// Big red rolling candle that slides down a slope and knocks players.
// Upgraded 3D procedural candlestick with glowing flame and stylized body.
// ============================================================
import * as THREE from 'three';
import { lambertMat, basicMat, metalMat } from '../core/AssetFactory.js';

export function makeRedCandle(x, y, z) {
  const grp = new THREE.Group();
  
  // Outer Candle Body (Stylized octagonal prism)
  const bodyGeo = new THREE.CylinderGeometry(1.2, 1.2, 6, 8);
  const bodyMat = lambertMat(0xFF3333);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  grp.add(body);

  // Inner core / wick housing (Darker)
  const coreGeo = new THREE.CylinderGeometry(0.5, 0.5, 6.2, 8);
  const coreMat = metalMat(0x661111, 0.4, 0.3);
  const core = new THREE.Mesh(coreGeo, coreMat);
  grp.add(core);

  // Warning Stripes (White) around the candle
  const stripeGeo = new THREE.TorusGeometry(1.2, 0.1, 8, 8);
  const stripeMat = basicMat(0xffffff);
  for(let sy = -2; sy <= 2; sy+=2) {
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = sy;
    grp.add(stripe);
  }

  // Wick
  const wickGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.5, 6);
  const wickMat = lambertMat(0x222222);
  const wick = new THREE.Mesh(wickGeo, wickMat);
  wick.position.y = 3.6;
  grp.add(wick);

  // Glowing Flame
  const flameGeo = new THREE.ConeGeometry(0.6, 1.5, 12);
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xFFD23F,
    emissive: 0xFF8A3D,
    emissiveIntensity: 0.7,
    transparent: true,
    opacity: 0.9
  });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.y = 4.8;
  // A slight bloom wrapper for the flame
  const flameGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xFF8A3D, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending })
  );
  flame.add(flameGlow);
  grp.add(flame);

  grp.position.set(x, y, z);
  return { grp, flame, x, z, vz: -(6 + Math.random() * 5), roll: 0, time: 0 };
}

export function updateRedCandle(c, dt) {
  c.z += c.vz * dt;
  c.roll += Math.abs(c.vz) * dt * 0.3;
  c.time += dt * 8;
  
  c.grp.position.z = c.z;
  c.grp.rotation.x = c.roll;
  
  // Flicker the flame
  c.flame.scale.set(
    1 + Math.sin(c.time)*0.1,
    1 + Math.cos(c.time * 1.3)*0.1,
    1 + Math.sin(c.time)*0.1
  );
}
