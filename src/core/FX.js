// ============================================================
// STUMBLE PUMP — FX (particle system)
// Object-pooled GPU-light particles: spark, dust, confetti.
// Each pool pre-allocates N THREE.Points using a shared BufferGeometry.
// ============================================================
import * as THREE from 'three';
import { scene } from './Engine.js';
import { CONFETTI_COLORS } from '../config/constants.js';

export const FX = {};

class ParticlePool {
  constructor(name, max, size, color, gravity = 9.8, sizeAttenuation = true, opacity = 1) {
    this.name = name; this.max = max; this.size = size;
    this.gravity = gravity; this.opacity = opacity;
    this.geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(max * 3);
    this.velocities = new Float32Array(max * 3);
    this.lives = new Float32Array(max);
    this.maxLives = new Float32Array(max);
    this.colors = new Float32Array(max * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.mat = new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, opacity,
      sizeAttenuation, depthWrite: false, blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.cursor = 0;
    this._baseColor = new THREE.Color(color || 0xffffff);
    scene.add(this.points);
  }
  spawn(pos, vel, life, sizeMul, colorHex) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.positions[i * 3] = pos.x; this.positions[i * 3 + 1] = pos.y; this.positions[i * 3 + 2] = pos.z;
    this.velocities[i * 3] = vel.x; this.velocities[i * 3 + 1] = vel.y; this.velocities[i * 3 + 2] = vel.z;
    this.lives[i] = life; this.maxLives[i] = life;
    const c = colorHex != null ? new THREE.Color(colorHex) : this._baseColor;
    this.colors[i * 3] = c.r; this.colors[i * 3 + 1] = c.g; this.colors[i * 3 + 2] = c.b;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.lives[i] <= 0) { continue; }
      this.lives[i] -= dt;
      if (this.lives[i] <= 0) { this.positions[i * 3 + 1] = -9999; continue; }
      this.velocities[i * 3 + 1] -= this.gravity * dt;
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
  dispose() {
    scene.remove(this.points);
    this.geo.dispose(); this.mat.dispose();
  }
}

// Confetti uses tiny box instances via Points with bigger size + additive-ish blending
export function initFX() {
  disposeFX();
  FX.spark = new ParticlePool('spark', 200, 0.18, 0xff6b00, 9.8, true, 1);
  FX.dust = new ParticlePool('dust', 120, 0.25, 0xccccdd, 4.0, true, 0.7);
  FX.confetti = new ParticlePool('confetti', 400, 0.35, 0xffffff, 5.0, true, 1);
}
export function disposeFX() {
  Object.values(FX).forEach((p) => p.dispose());
  for (const k of Object.keys(FX)) delete FX[k];
}
export function updateFX(dt) { Object.values(FX).forEach((p) => p.update(dt)); }

// ---- burst helpers ----
export function spawnDust(pos) {
  if (!FX.dust) return;
  for (let i = 0; i < 6; i++) {
    FX.dust.spawn(pos, new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2), 0.5, 1, 0xccccdd);
  }
}
export function spawnSpeedLines(pos, facing) {
  if (!FX.spark) return;
  for (let i = 0; i < 8; i++) {
    FX.spark.spawn(
      new THREE.Vector3(pos.x + facing.x, pos.y + 0.5 + Math.random(), pos.z + facing.z),
      facing.clone().multiplyScalar(6),
      0.3, 0.6, 0x5FCB88
    );
  }
}
export function spawnConfettiBurst(pos, count = 60) {
  if (!FX.confetti) return;
  for (let i = 0; i < count; i++) {
    FX.confetti.spawn(
      new THREE.Vector3(pos.x + (Math.random() - 0.5) * 6, pos.y + 8 + Math.random() * 2, pos.z + (Math.random() - 0.5) * 6),
      new THREE.Vector3((Math.random() - 0.5) * 3, -(2 + Math.random() * 3), (Math.random() - 0.5) * 3),
      2.5, 1, CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    );
  }
}
