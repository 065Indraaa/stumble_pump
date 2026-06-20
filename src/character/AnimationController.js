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
    this.landT = 0;
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
    if (state === 'land') this.landT = 0;
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
      case 'land':      this._land(dt); break;
      case 'ragdoll':   this._ragdoll(dt); break;
      case 'recover':   this._recover(dt); break;
      case 'celebrate': this._celebrate(t); break;
      // emotes — each is a looping expressive pose
      case 'dance':     this._emoteDance(t); break;
      case 'wave':      this._emoteWave(t); break;
      case 'taunt':     this._emoteTaunt(t); break;
      case 'point':     this._emotePoint(t); break;
      case 'flex':      this._emoteFlex(t); break;
      case 'cry':       this._emoteCry(t); break;
    }
    this._skinFx(t);
    this._updateStars(dt);
  }

  // ===== EMOTE ANIMATIONS =====
  // Each is a distinct looping pose so players can express in-lobby/arena.
  _emoteDance(t) {
    const b = this.b;
    // side-to-side hip sway + raised alternating arms (disco)
    b.hips.position.y = 0.56 + Math.abs(Math.sin(t * 6)) * 0.06;
    b.hips.position.x = Math.sin(t * 3) * 0.06;
    this._lerpRot(b.hips, 0, Math.sin(t * 3) * 0.25, 0, 0.2);
    this._lerpRot(b.l_upperarm, -2.6, 0, 0.4 + Math.sin(t * 6) * 0.3, 0.25);
    this._lerpRot(b.r_upperarm, -2.6, 0, -0.4 - Math.sin(t * 6) * 0.3, 0.25);
    this._lerpRot(b.l_lowerarm, -1.4, 0, 0, 0.25);
    this._lerpRot(b.r_lowerarm, -1.4, 0, 0, 0.25);
    this._lerpRot(b.head, 0, Math.sin(t * 3) * 0.3, 0, 0.2);
    this.rig.setFace('celebrating');
  }
  _emoteWave(t) {
    const b = this.b;
    // right arm raised, waving side to side
    this._lerpRot(b.r_upperarm, -2.9, 0, -0.3, 0.25);
    this._lerpRot(b.r_lowerarm, -0.3 + Math.sin(t * 8) * 0.5, 0, 0, 0.3);
    this._lerpRot(b.l_upperarm, 0.1, 0, 0.15, 0.2);
    this._lerpRot(b.head, 0, Math.sin(t * 2) * 0.15, 0, 0.2);
    b.hips.position.y = 0.56 + Math.sin(t * 4) * 0.02;
    this.rig.setFace('celebrating');
  }
  _emoteTaunt(t) {
    const b = this.b;
    // both hands on hips, chest out, slight lean back + head bob
    this._lerpRot(b.l_upperarm, 0.6, 0, 0.5, 0.25);
    this._lerpRot(b.r_upperarm, 0.6, 0, -0.5, 0.25);
    this._lerpRot(b.l_lowerarm, -1.2, 0, 0, 0.25);
    this._lerpRot(b.r_lowerarm, -1.2, 0, 0, 0.25);
    this._lerpRot(b.chest, -0.2, 0, 0, 0.2);
    this._lerpRot(b.head, -0.15, Math.sin(t * 5) * 0.2, Math.sin(t * 2) * 0.1, 0.25);
    b.hips.position.y = 0.56;
    this.rig.setFace('celebrating');
  }
  _emotePoint(t) {
    const b = this.b;
    // right arm extended forward pointing, slight forward lean
    this._lerpRot(b.r_upperarm, -1.5, 0, -0.1, 0.25);
    this._lerpRot(b.r_lowerarm, 0, 0, 0, 0.25);
    this._lerpRot(b.l_upperarm, 0.1, 0, 0.2, 0.2);
    this._lerpRot(b.chest, -0.15, Math.sin(t * 1.5) * 0.1, 0, 0.2);
    this._lerpRot(b.head, 0, Math.sin(t * 1.5) * 0.1, 0, 0.2);
    b.hips.position.y = 0.56;
    this.rig.setFace('normal');
  }
  _emoteFlex(t) {
    const b = this.b;
    // both arms flexed up (biceps pose), slight bounce
    this._lerpRot(b.l_upperarm, -2.4, 0, 0.9, 0.25);
    this._lerpRot(b.r_upperarm, -2.4, 0, -0.9, 0.25);
    this._lerpRot(b.l_lowerarm, -2.0, 0, 0, 0.25);
    this._lerpRot(b.r_lowerarm, -2.0, 0, 0, 0.25);
    this._lerpRot(b.chest, -0.25, 0, 0, 0.2);
    b.hips.position.y = 0.56 + Math.abs(Math.sin(t * 4)) * 0.04;
    this.rig.setFace('celebrating');
  }
  _emoteCry(t) {
    const b = this.b;
    // hunched, hands to face, trembling
    this._lerpRot(b.chest, 0.35, 0, 0, 0.2);
    this._lerpRot(b.l_upperarm, -1.2, 0, 0.6, 0.25);
    this._lerpRot(b.r_upperarm, -1.2, 0, -0.6, 0.25);
    this._lerpRot(b.l_lowerarm, -1.8, 0, 0, 0.25);
    this._lerpRot(b.r_lowerarm, -1.8, 0, 0, 0.25);
    this._lerpRot(b.head, 0.4, 0, 0, 0.2);
    b.hips.position.x = Math.sin(t * 14) * 0.012;
    b.hips.position.y = 0.5;
    this.rig.setFace('shocked');
  }

  _idle(t, dt) {
    const b = this.b;
    // gentle breathing — slightly deeper than before, asymmetric inhale/exhale
    const breath = Math.sin(t * 1.1);
    b.hips.position.y = 0.56 + breath * 0.035;
    // subtle weight shift left/right so the pose isn't perfectly symmetrical
    b.hips.position.x = Math.sin(t * 0.5) * 0.015;
    this._lerpRot(b.head, Math.sin(t * 0.7) * 0.05, Math.sin(t * 0.4) * 0.18, 0, 0.1);
    // arms hang with a soft sway (offset phases, not mirrored)
    this._lerpRot(b.l_upperarm, 0.05 + Math.sin(t * 0.8) * 0.05, 0, 0.14, 0.12);
    this._lerpRot(b.r_upperarm, 0.05 + Math.sin(t * 0.8 + 0.6) * 0.05, 0, -0.14, 0.12);
    this._lerpRot(b.chest, breath * 0.02, 0, 0, 0.1);
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
    const b = this.b;
    const sp = this.speed || 0;
    // cycle frequency + amplitude scale with speed (faster sprint = faster stride)
    const cyc = 8.5 + sp * 6;
    const amp = 0.7 + sp * 0.35;
    const s = Math.sin(t * cyc), c = Math.cos(t * cyc);
    // ---- BODY LEAN: chest pitches forward proportional to speed ----
    // upright at idle, ~0.28 rad lean at full sprint (reads as momentum)
    this._lerpRot(b.chest, -0.05 - sp * 0.28, 0, 0, 0.18);
    this._lerpRot(b.hips, -sp * 0.06, 0, 0, 0.18);
    // ---- VERTICAL BOB: double-lobe gait (heel-strike + toe-off) ----
    // abs(sin) gives 2 bumps per cycle — natural asymmetric running bounce
    const bob = Math.abs(s);
    b.hips.position.y = 0.56 + bob * 0.085;
    // ---- LATERAL SWAY: pelvis rocks side-to-side, opposite to stride ----
    b.hips.position.x = c * 0.04;
    // pelvis counter-rotates slightly against the shoulders (natural gait)
    this._lerpRot(b.hips, -sp * 0.06, -c * 0.12 * sp, 0, 0.2);
    // ---- LEGS: smooth sinusoidal swing, slight per-limb asymmetry ----
    // (broke the perfect mirror by offsetting phase by a fraction)
    this._lerpRot(b.l_upperleg, s * amp, 0, 0.04, this.lerpK);
    this._lerpRot(b.r_upperleg, -s * amp, 0, -0.04, this.lerpK);
    // knees bend smoothly on the back-swing (no sharp max(0,cos) snap)
    this._lerpRot(b.l_lowerleg, Math.max(0, -c) * 0.9 + 0.1, 0, 0, this.lerpK);
    this._lerpRot(b.r_lowerleg, Math.max(0, c) * 0.9 + 0.1, 0, 0, this.lerpK);
    // ---- ARMS: counter-swing to legs, elbows bend naturally ----
    this._lerpRot(b.l_upperarm, -s * (0.9 + sp * 0.3), 0, 0.14, this.lerpK);
    this._lerpRot(b.r_upperarm, s * (0.9 + sp * 0.3), 0, -0.14, this.lerpK);
    this._lerpRot(b.l_lowerarm, -0.6 + Math.max(0, -s) * 0.4, 0, 0, this.lerpK);
    this._lerpRot(b.r_lowerarm, -0.6 + Math.max(0, s) * 0.4, 0, 0, this.lerpK);
    // head looks slightly ahead in the travel direction
    this._lerpRot(b.head, -sp * 0.12, 0, 0, 0.2);
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

  /** Landing impact: squash on touchdown (hips compress, knees bend) then
   *  recover to neutral over ~0.18s — gives weight to landings instead of
   *  snapping straight to idle/run. */
  _land(dt) {
    this.landT += dt;
    const b = this.b;
    const p = this.landT;
    if (p < 0.07) {
      // impact squash: wider+shorter, knees bent, arms out for balance
      b.hips.scale.lerp(_v1.set(1.18, 0.74, 1.18), 0.5);
      this._lerpRot(b.l_upperleg, 0.5, 0, 0.05, 0.4);
      this._lerpRot(b.r_upperleg, 0.5, 0, -0.05, 0.4);
      this._lerpRot(b.l_lowerleg, 0.8, 0, 0, 0.4);
      this._lerpRot(b.r_lowerleg, 0.8, 0, 0, 0.4);
      this._lerpRot(b.l_upperarm, -0.6, 0, 0.3, 0.4);
      this._lerpRot(b.r_upperarm, -0.6, 0, -0.3, 0.4);
      this._lerpRot(b.chest, 0.15, 0, 0, 0.3);
    } else {
      // recover to neutral
      b.hips.scale.lerp(_v1.set(1, 1, 1), 0.25);
      this._resetPose(0.2);
    }
    if (p > 0.18) this.set('idle');
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
    b.hips.position.y = 0.56 + Math.abs(Math.sin(t * 4)) * 0.12;
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
