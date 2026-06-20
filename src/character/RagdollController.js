// ============================================================
// STUMBLE PUMP — RagdollController
// Lightweight procedural ragdoll (visual-only, NOT Rapier joints).
// We keep the kinematic capsule driving root position, but the
// rig's bones flail procedurally while gravity + simple floor bounce
// is applied to the root. This preserves gameplay (player still gets
// knocked + recovers) without the complexity/cost of 8 Rapier bodies.
//
// The legacy game used this same approach and it felt good; we keep
// it for feel-consistency. A full physics-joint ragdoll can be added
// later as a polish toggle if desired.
// ============================================================
import * as THREE from 'three';

export class RagdollController {
  constructor(actor) {
    this.actor = actor;
    this.active = false;
    this.timer = 0;
    this.duration = 1.5;
    this.spin = new THREE.Vector3();
    this.knockVel = new THREE.Vector3();
  }

  start(dir) {
    this.active = true;
    this.timer = 0;
    const d = dir || new THREE.Vector3((Math.random() - 0.5), 1, (Math.random() - 0.5)).normalize();
    this.knockVel.set(d.x * 8, 9, d.z * 8);
    this.spin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    this.actor.anim.set('ragdoll');
  }

  update(dt, ctx) {
    if (!this.active) return;
    this.timer += dt;
    const a = this.actor;
    // gravity + integrate on our own velocity (decoupled from normal move)
    this.knockVel.y -= 26 * dt;
    a.pos.addScaledVector(this.knockVel, dt);
    this.knockVel.x *= 0.96; this.knockVel.z *= 0.96;
    // ground bounce
    if (ctx && ctx.groundHeightAt) {
      const gh = ctx.groundHeightAt(a.pos.x, a.pos.z);
      if (gh !== null && a.pos.y <= gh) {
        a.pos.y = gh;
        this.knockVel.y *= -0.3;
        this.knockVel.x *= 0.7; this.knockVel.z *= 0.7;
      }
    }
    // tumble rotation
    a.root.rotation.z += this.spin.z * dt * 0.3;
    a.root.rotation.x += this.spin.x * dt * 0.3;
    if (ctx && a.pos.y < ctx.killY) ctx.onFell(a);
    if (this.timer >= this.duration) {
      this.active = false;
      a.ragdoll = false;
      a.root.rotation.set(0, a.root.rotation.y, 0);
      a.anim.set('recover');
    }
  }
}
