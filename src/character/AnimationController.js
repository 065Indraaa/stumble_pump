// ============================================================
// STUMBLE PUMP — AnimationController
// Manual bone-tween state machine over a CharacterRig.
// 8 states: idle, run, jump, dive, fall, ragdoll, recover, celebrate.
// Uses per-bone lerp (lerpRot) toward target euler angles each frame.
// ============================================================
import * as THREE from 'three';
import { basicMat } from '../core/AssetFactory.js';

const _v1 = new THREE.Vector3();

export class AnimationController {
  constructor(rig) {
    this.rig = rig;
    this.b = rig.bones;
    this.state = 'idle';
    this.t = 0;
    this.jumpT = 0; this.diveT = 0;
    this.ragdollT = 0; this.recoverT = 0;
    this.idleTimer = 0; this.subIdle = 0;
    this.speed = 0;
    this.stars = [];
    this.lerpK = rig.jerky ? 0.55 : 0.25;
    this.ragVel = new THREE.Vector3();
    this.ragSpin = new THREE.Vector3();
  }

  set(state) {
    if (this.state === state) return;
    if (state === 'jump') this.jumpT = 0;
    if (state === 'dive') this.diveT = 0;
    if (state === 'ragdoll') { this.ragdollT = 0; this._initRagdoll(); }
    if (state === 'recover') { this.recoverT = 0; this._spawnStars(); }
    this.state = state;
  }

  _lerpRot(bone, x, y, z, k = 0.25) {
    if (!bone) return;
    const factor = 1 - Math.exp(-(k * 60) * (this.lastDt || 0.016));
    bone.rotation.x += (x - bone.rotation.x) * factor;
    bone.rotation.y += (y - bone.rotation.y) * factor;
    bone.rotation.z += (z - bone.rotation.z) * factor;
  }

  _resetPose(k = 0.2) {
    const b = this.b;
    ['l_upperarm', 'r_upperarm', 'l_lowerarm', 'r_lowerarm',
     'l_upperleg', 'r_upperleg', 'l_lowerleg', 'r_lowerleg',
     'chest', 'head', 'hips'].forEach((n) => { if (b[n]) this._lerpRot(b[n], 0, 0, 0, k); });
    b.hips.scale.lerp(_v1.set(1, 1, 1), k);
  }

  update(dt, t) {
    this.t += dt;
    this.lastDt = dt;
    const b = this.b;
    switch (this.state) {
      case 'idle':      this._idle(t, dt); break;
      case 'run':       this._run(t); break;
      case 'jump':      this._jump(dt); break;
      case 'dive':      this._dive(dt); break;
      case 'fall':      this._fall(t); break;
      case 'ragdoll':   this._ragdoll(dt); break;
      case 'recover':   this._recover(dt); break;
      case 'celebrate': this._celebrate(t); break;
    }
    this._skinFx(t);
    this._updateStars(dt);
  }

  _idle(t, dt) {
    const b = this.b;
    b.hips.position.y = 0.92 + Math.sin(t * 1.2) * 0.05;
    this._lerpRot(b.head, 0, Math.sin(t * 0.4) * 0.18, 0, 0.1);
    this._lerpRot(b.l_upperarm, Math.sin(t * 0.8) * 0.06, 0, 0.16, 0.15);
    this._lerpRot(b.r_upperarm, Math.sin(t * 0.8 + 1) * 0.06, 0, -0.16, 0.15);
    this._lerpRot(b.chest, 0, 0, 0, 0.1);
    this._lerpRot(b.l_upperleg, 0, 0, 0, 0.1); this._lerpRot(b.r_upperleg, 0, 0, 0, 0.1);
    b.hips.scale.lerp(_v1.set(1, 1, 1), 0.1);
    this.idleTimer += dt;
    if (this.idleTimer > 8) { this.subIdle = 2; this.idleTimer = 0; }
    if (this.subIdle > 0) {
      this.subIdle -= dt;
      this._lerpRot(b.l_lowerarm, -1.8, 0, 0, 0.18);
      this._lerpRot(b.head, 0.3, 0, 0, 0.12);
    }
  }

  _run(t) {
    const b = this.b, cyc = 9 + this.speed * 6, amp = 0.85 + this.speed * 0.25;
    this._lerpRot(b.l_upperleg, Math.sin(t * cyc) * amp, 0, 0, this.lerpK);
    this._lerpRot(b.r_upperleg, -Math.sin(t * cyc) * amp, 0, 0, this.lerpK);
    this._lerpRot(b.l_lowerleg, Math.max(0, Math.cos(t * cyc)) * 0.7, 0, 0, this.lerpK);
    this._lerpRot(b.r_lowerleg, Math.max(0, -Math.cos(t * cyc)) * 0.7, 0, 0, this.lerpK);
    this._lerpRot(b.l_upperarm, -Math.sin(t * cyc) * 1.1, 0, 0.12, this.lerpK);
    this._lerpRot(b.r_upperarm, Math.sin(t * cyc) * 1.1, 0, -0.12, this.lerpK);
    this._lerpRot(b.l_lowerarm, -0.5 + Math.sin(t * cyc) * 0.3, 0, 0, this.lerpK);
    this._lerpRot(b.r_lowerarm, -0.5 - Math.sin(t * cyc) * 0.3, 0, 0, this.lerpK);
    this._lerpRot(b.chest, -0.18, 0, 0, 0.2);
    b.hips.position.y = 0.92 + Math.abs(Math.sin(t * cyc)) * 0.05;
    b.hips.scale.lerp(_v1.set(1, 1, 1), 0.2);
  }

  _jump(dt) {
    this.jumpT += dt; const b = this.b; const p = this.jumpT;
    if (p < 0.1) { b.hips.scale.lerp(_v1.set(1.15, 0.78, 1.15), 0.4); }
    else if (p < 0.3) {
      b.hips.scale.lerp(_v1.set(0.9, 1.25, 0.9), 0.4);
      this._lerpRot(b.l_upperarm, -2.2, 0, 0.2, 0.3); this._lerpRot(b.r_upperarm, -2.2, 0, -0.2, 0.3);
    } else {
      b.hips.scale.lerp(_v1.set(1, 1, 1), 0.2);
      this._lerpRot(b.l_upperleg, 0.7, 0, 0, 0.2); this._lerpRot(b.r_upperleg, 0.7, 0, 0, 0.2);
      this._lerpRot(b.l_upperarm, 0, 0, 0.5, 0.2); this._lerpRot(b.r_upperarm, 0, 0, -0.5, 0.2);
    }
  }

  _dive(dt) {
    this.diveT += dt; const b = this.b;
    this._lerpRot(b.hips, -1.0, 0, 0, 0.3);
    this._lerpRot(b.l_upperarm, -2.6, 0, 0.15, 0.3); this._lerpRot(b.r_upperarm, -2.6, 0, -0.15, 0.3);
    this._lerpRot(b.l_upperleg, 0.4, 0, 0, 0.3); this._lerpRot(b.r_upperleg, 0.4, 0, 0, 0.3);
  }

  _fall(t) {
    const b = this.b;
    this._lerpRot(b.l_upperarm, -1.6, 0, 0.3, 0.2); this._lerpRot(b.r_upperarm, -1.6, 0, -0.3, 0.2);
    this._lerpRot(b.l_upperleg, Math.sin(t * 12) * 0.4, 0, 0.1, 0.2);
    this._lerpRot(b.r_upperleg, -Math.sin(t * 12) * 0.4, 0, -0.1, 0.2);
    this._lerpRot(b.head, -0.3, 0, 0, 0.15);
    b.hips.scale.lerp(_v1.set(1, 1, 1), 0.2);
  }

  _initRagdoll() {
    this.ragVel.set((Math.random() - 0.5) * 2, 6 + Math.random() * 2, (Math.random() - 0.5) * 2);
    this.ragSpin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    this.rig.setFace('shocked');
  }

  _ragdoll(dt) {
    this.ragdollT += dt; const b = this.b;
    const t = this.t * 9;
    b.l_upperarm.rotation.set(Math.sin(t) * 1.5, 0, 0.5 + Math.sin(t * 1.3));
    b.r_upperarm.rotation.set(Math.cos(t) * 1.5, 0, -0.5 - Math.cos(t * 1.1));
    b.l_upperleg.rotation.set(Math.sin(t * 0.8) * 1.2, 0, 0.3);
    b.r_upperleg.rotation.set(Math.cos(t * 0.9) * 1.2, 0, -0.3);
    b.head.rotation.set(Math.sin(t) * 0.5, Math.cos(t) * 0.5, 0);
    if (this.ragdollT > 1.5) this.set('recover');
  }

  _recover(dt) {
    this.recoverT += dt; const b = this.b;
    this._resetPose(0.15);
    this._lerpRot(b.head, 0, Math.sin(this.t * 16) * 0.4, 0, 0.3); // dizzy shake
    if (this.recoverT > 0.8) { this.rig.setFace('normal'); this.set('idle'); }
  }

  _celebrate(t) {
    const b = this.b;
    this._lerpRot(b.l_upperarm, -2.6, 0, 0.3 + Math.sin(t * 4) * 0.3, 0.2);
    this._lerpRot(b.r_upperarm, -2.6, 0, -0.3 - Math.sin(t * 4) * 0.3, 0.2);
    b.hips.position.y = 0.92 + Math.abs(Math.sin(t * 4)) * 0.12;
    this._lerpRot(b.hips, 0, Math.sin(t * 2) * 0.3, 0, 0.2);
    this.rig.setFace('celebrating');
  }

  _spawnStars() {
    this.stars = [];
    for (let i = 0; i < 5; i++) {
      const star = new THREE.Mesh(new THREE.TetrahedronGeometry(0.06), basicMat(0xffd700));
      this.rig.bones.head.add(star);
      this.stars.push({ mesh: star, ang: i / 5 * Math.PI * 2 });
    }
  }

  _updateStars(dt) {
    if (!this.stars.length) return;
    if (this.state !== 'recover') {
      this.stars.forEach((s) => s.mesh.parent?.remove(s.mesh));
      this.stars = [];
      return;
    }
    this.stars.forEach((s) => {
      s.ang += dt * 6;
      s.mesh.position.set(Math.cos(s.ang) * 0.4, 0.35, Math.sin(s.ang) * 0.4);
      s.mesh.rotation.x += dt * 8;
    });
  }

  _skinFx(t) {
    const c = this.rig, b = this.b;
    if (c.trembling && this.state === 'idle') {
      b.hips.position.x = Math.sin(t * 15) * 0.012;
      b.hips.position.z = Math.cos(t * 13) * 0.01;
    }
    if (c.sweatDrops) {
      c.sweatDrops.forEach((d, i) => { d.position.y = 0.2 + Math.sin(t * 4 + i) * 0.06; });
    }
    if (c.skinKey === 'trojan' && this.state === 'idle') {
      b.head.rotation.y = (t * 0.6) % (Math.PI * 2);
    }
  }
}
