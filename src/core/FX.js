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
  // shader-based effects (mesh effects, registered on FX so updateFX runs them)
  initShaderFX();
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

// ============================================================
// SHADER-BASED VFX (mesh effects, not point sprites)
// Each class exposes update(dt) + dispose() so updateFX/disposeFX pick them
// up automatically once registered on the FX object.
// ============================================================

// ---- ShockwaveRing: expanding additive ring on hard landings ----
// A flat ring that scales up + fades out over ~0.5s. Cheap, always reads as
// an impact even when the directional shadow isn't visible.
class ShockwaveRing {
  constructor() {
    this.active = [];   // array of live rings
    this._geo = new THREE.RingGeometry(0.5, 0.7, 32);
    this._mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
  }
  spawn(pos, color = 0xffffff) {
    const m = new THREE.Mesh(this._geo, this._mat.clone());
    m.material.color.setHex(color);
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, pos.y + 0.05, pos.z);
    m.scale.setScalar(0.5);
    scene.add(m);
    this.active.push({ mesh: m, t: 0, dur: 0.5 });
  }
  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const r = this.active[i];
      r.t += dt;
      const p = r.t / r.dur;
      if (p >= 1) {
        scene.remove(r.mesh); r.mesh.material.dispose();
        this.active.splice(i, 1);
        continue;
      }
      r.mesh.scale.setScalar(0.5 + p * 4.5);
      r.mesh.material.opacity = (1 - p) * 0.7;
    }
  }
  dispose() {
    this.active.forEach((r) => { scene.remove(r.mesh); r.mesh.material.dispose(); });
    this.active = [];
    this._geo.dispose(); this._mat.dispose();
  }
}

// ---- SpeedLines: real line-segment streaks behind the player on dive ----
// Streaks emanate backward from the player, fading quickly. Uses LineSegments
// with a vertex-color material so each streak can fade independently.
class SpeedLines {
  constructor() {
    this.MAX = 24;
    this.geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.MAX * 6);   // 2 verts per line × 3
    this.alpha = new Float32Array(this.MAX * 2);
    this.vel = [];
    for (let i = 0; i < this.MAX; i++) this.vel.push(new THREE.Vector3());
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.mat = new THREE.LineBasicMaterial({
      color: 0x5FCB88, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.lines = new THREE.LineSegments(this.geo, this.mat);
    this.lines.frustumCulled = false;
    scene.add(this.lines);
    this.life = new Float32Array(this.MAX);
  }
  spawn(pos, facing) {
    // spawn a streak: start at pos, velocity backward along -facing
    const i = (this._cur = (this._cur || 0) + 1) % this.MAX;
    const back = facing.clone().multiplyScalar(-1);
    const jitter = new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 1.5, (Math.random() - 0.5) * 0.8);
    const v = back.multiplyScalar(8).add(jitter);
    this.vel[i].copy(v);
    const p = new THREE.Vector3(pos.x, pos.y + 0.5, pos.z).add(jitter.clone().multiplyScalar(0.3));
    // both line endpoints start at p; the tail trails behind as it moves
    this.positions[i * 6] = p.x; this.positions[i * 6 + 1] = p.y; this.positions[i * 6 + 2] = p.z;
    this.positions[i * 6 + 3] = p.x; this.positions[i * 6 + 4] = p.y; this.positions[i * 6 + 5] = p.z;
    this.life[i] = 0.3;
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.MAX; i++) {
      if (this.life[i] <= 0) {
        // park offscreen
        this.positions[i * 6 + 1] = -9999; this.positions[i * 6 + 4] = -9999;
        continue;
      }
      any = true;
      this.life[i] -= dt;
      const v = this.vel[i];
      // head moves with velocity, tail lags (creates the streak)
      this.positions[i * 6] += v.x * dt;
      this.positions[i * 6 + 1] += v.y * dt;
      this.positions[i * 6 + 2] += v.z * dt;
      this.positions[i * 6 + 3] = this.positions[i * 6] - v.x * 0.06;
      this.positions[i * 6 + 4] = this.positions[i * 6 + 1] - v.y * 0.06;
      this.positions[i * 6 + 5] = this.positions[i * 6 + 2] - v.z * 0.06;
    }
    this.mat.opacity = any ? 0.9 : 0;
    this.geo.attributes.position.needsUpdate = true;
  }
  dispose() {
    scene.remove(this.lines); this.geo.dispose(); this.mat.dispose();
  }
}

// ---- EmoteBurst: radial star-burst when an emote fires ----
// A quick ring + spark particles outward from the character's head.
class EmoteBurst {
  constructor() { this.active = []; this._geo = new THREE.RingGeometry(0.4, 0.55, 24); }
  spawn(pos, color = 0xA3E635) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(this._geo, mat);
    m.position.set(pos.x, pos.y + 1.8, pos.z);
    m.scale.setScalar(0.3);
    scene.add(m);
    this.active.push({ mesh: m, t: 0, dur: 0.6 });
    // also emit a few spark particles if the pool exists
    if (FX.spark) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        FX.spark.spawn(
          new THREE.Vector3(pos.x, pos.y + 1.8, pos.z),
          new THREE.Vector3(Math.cos(a) * 3, 1 + Math.random() * 2, Math.sin(a) * 3),
          0.6, 1, color
        );
      }
    }
  }
  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const r = this.active[i];
      r.t += dt;
      const p = r.t / r.dur;
      if (p >= 1) { scene.remove(r.mesh); r.mesh.material.dispose(); this.active.splice(i, 1); continue; }
      r.mesh.scale.setScalar(0.3 + p * 2.2);
      r.mesh.material.opacity = (1 - p) * 0.9;
      r.mesh.lookAt(r.mesh.position.x, r.mesh.position.y + 1, r.mesh.position.z); // face camera-ish
    }
  }
  dispose() {
    this.active.forEach((r) => { scene.remove(r.mesh); r.mesh.material.dispose(); });
    this.active = []; this._geo.dispose();
  }
}

// Register the shader effects on the FX object so updateFX/disposeFX manage them.
export function initShaderFX() {
  if (!FX.shockwave) FX.shockwave = new ShockwaveRing();
  if (!FX.speedLines) FX.speedLines = new SpeedLines();
  if (!FX.emoteBurst) FX.emoteBurst = new EmoteBurst();
}
export function spawnShockwave(pos, color) { FX.shockwave?.spawn(pos, color); }
export function spawnSpeedStreaks(pos, facing) { for (let i = 0; i < 3; i++) FX.speedLines?.spawn(pos, facing); }
export function spawnEmoteBurst(pos, color) { FX.emoteBurst?.spawn(pos, color); }
