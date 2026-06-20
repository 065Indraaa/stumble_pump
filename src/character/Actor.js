// ============================================================
// STUMBLE PUMP — Actor
// Kinematic-position-based capsule moved by code (preserves tuned feel),
// with Rapier handling terrain/obstacle collision queries via ray casts
// and sensor intersections. This is the pragmatic Rapier integration:
// gameplay constants stay identical, but collision comes from the
// physics world instead of hand-rolled heightfield sampling.
//
// Brain types: 'player', 'lobbyBot', 'raceBot', 'survivalBot', 'remote'.
// ============================================================
import * as THREE from 'three';
import { CharacterRig } from './CharacterRig.js';
import { AnimationController } from './AnimationController.js';
import { RagdollController } from './RagdollController.js';
import { addKinematicCapsule, removeBody, castRayDown } from '../core/PhysicsWorld.js';
import { scene, MOBILE } from '../core/Engine.js';
import { Input, readKeyboardMove } from '../core/InputManager.js';
import { SFX } from '../core/AudioManager.js';
import { spawnDust, spawnSpeedLines, spawnSpeedStreaks, FX, spawnShockwave, spawnEmoteBurst } from '../core/FX.js';
import {
  GRAVITY, MOVE_SPEED, ACCEL, FRICTION, JUMP_VELOCITY,
  DIVE_SPEED, DIVE_LOCK, COYOTE_TIME, JUMP_BUFFER, CHARACTER_RADIUS,
} from '../config/constants.js';
import { SKINS } from './skins.js';
import { makeLabel, contactShadowTexture } from '../core/AssetFactory.js';

const _wish = new THREE.Vector3();

export class Actor {
  constructor(skinKey, isPlayer = false, brain = 'player') {
    this.rig = new CharacterRig(skinKey, isPlayer);
    this.anim = new AnimationController(this.rig);
    this.ragdollCtrl = new RagdollController(this);
    this.isPlayer = isPlayer;
    this.brain = brain;
    this.root = this.rig.root;
    this.pos = this.root.position;
    this.vel = new THREE.Vector3();
    this.grounded = true;
    this.facing = 0;
    this.diveLock = 0;
    this.jumpHeld = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.ragdoll = false;
    this.ragTimer = 0;
    this.skill = 0.7 + Math.random() * 0.3;
    this.qualified = false;
    this.eliminated = false;
    this.dead = false;
    this.finishPos = 0;
    this.target = new THREE.Vector3();
    this.repick = 0;
    this.trailTimer = 0;
    this.checkpoint = new THREE.Vector3(0, 2, 0);
    this.respawnStun = 0;
    this.respawns = 0;
    this.parked = false;
    this._isRealPeer = false;

    // Rapier kinematic capsule for collision queries (visual root drives position)
    this.body = addKinematicCapsule({
      r: CHARACTER_RADIUS, halfH: 0.5,
      x: this.pos.x, y: this.pos.y, z: this.pos.z,
      tag: isPlayer ? 'player' : 'actor', entity: this,
      friction: 0.0, restitution: 0,
    })?.body;

    scene.add(this.root);

    // Fake contact-shadow blob: a soft dark radial texture on a horizontal
    // plane that sits on the ground directly under the character. It scales
    // down + fades as the character rises (jump/fall), so they never look
    // like they're floating. Cheaper and crisper than relying on the
    // directional shadow map at distance.
    const csMat = new THREE.MeshBasicMaterial({
      map: contactShadowTexture(),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    this.contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), csMat);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.02;
    this.contactShadow.renderOrder = -1;
    scene.add(this.contactShadow);
  }

  startRagdoll(dir) {
    if (this.ragdoll) return;
    this.ragdoll = true;
    this.ragTimer = 0;
    this.ragdollCtrl.start(dir);
    if (this.isPlayer) { SFX.hit(); }
  }

  /** Decide desired move vector (camera-relative for player). */
  _decideMove(dt, t, ctx) {
    const m = new THREE.Vector2();
    if (this.brain === 'player') {
      if (!MOBILE) readKeyboardMove();
      m.copy(Input.move);
    } else if (this.brain === 'lobbyBot') {
      this.repick -= dt;
      if (this.repick <= 0 || this.pos.distanceTo(this.target) < 1.5) {
        this.repick = 2 + Math.random() * 3;
        const a = Math.random() * Math.PI * 2, r = Math.random() * 24;
        this.target.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      }
      const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.5) m.set(dx / d, -dz / d);
    } else if (this.brain === 'raceBot') {
      const goalZ = ctx.finishZ;
      const strafe = Math.sin(t * 0.8 + this.skill * 6) * 0.4;
      m.set(strafe, this.pos.z < goalZ ? 1 : 0);
      if (Math.random() < 0.0006) this.startRagdoll();
    } else if (this.brain === 'survivalBot') {
      this.repick -= dt;
      const safe = ctx.safeTargetFor && ctx.safeTargetFor(this);
      if (safe) {
        const dx = safe.x - this.pos.x, dz = safe.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.4) m.set(dx / d, -dz / d);
      }
    }
    return m;
  }

  update(dt, t, ctx) {
    if (this.parked) { this.anim.set('celebrate'); this.anim.update(dt, t); this._updateContactShadow(ctx); return; }
    if (this.ragdoll) {
      this.ragdollCtrl.update(dt, ctx);
      this.anim.update(dt, t);
      this._syncBody();
      this._updateContactShadow(ctx);
      return;
    }
    if (this.respawnStun > 0) this.respawnStun -= dt;
    const stunned = this.respawnStun > 0;

    const m = this._decideMove(dt, t, ctx);
    if (stunned) m.set(0, 0);

    // camera-relative movement for player
    let wishX = m.x, wishZ = m.y;
    if (this.isPlayer && this.brain === 'player') {
      const yaw = Input.camYaw;
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
      wishX = m.x * cosY + m.y * sinY;
      wishZ = -m.x * sinY + m.y * cosY;
    }
    _wish.set(wishX, 0, wishZ);
    const moving = _wish.lengthSq() > 0.01;

    if (this.diveLock > 0) this.diveLock -= dt;

    // jump
    let jumpReq = false;
    if (this.brain === 'player') jumpReq = Input.consumeJump();
    else if (this.brain === 'lobbyBot' && Math.random() < 0.002) jumpReq = true;
    this.jumpBuffer = jumpReq ? JUMP_BUFFER : Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && this.grounded && this.diveLock <= 0 && !stunned && this.coyote >= 0) {
      this.vel.y = JUMP_VELOCITY;
      this.grounded = false;
      this.anim.set('jump');
      SFX.jump();
      this.jumpBuffer = 0;
      this.coyote = -1;
    }

    // dive
    const diveReq = this.brain === 'player' ? Input.consumeDive() : false;
    if (diveReq && this.diveLock <= 0 && this.grounded && !stunned) {
      this.diveLock = DIVE_LOCK;
      const f = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
      this.vel.x = f.x * DIVE_SPEED; this.vel.z = f.z * DIVE_SPEED;
      this.anim.set('dive');
      if (this.isPlayer) { spawnSpeedLines(this.pos, f); spawnSpeedStreaks(this.pos, f); }
    }

    // horizontal movement — accelerate toward wish dir with smooth accel curve
    const spd = MOVE_SPEED * (this.brain.includes('Bot') && this.brain !== 'lobbyBot' ? this.skill : (this.brain === 'lobbyBot' ? 0.55 : 1));
    if (this.diveLock <= 0) {
      if (moving) {
        _wish.normalize();
        // frame-rate independent accel toward target velocity (smooth ease)
        const accelK = 1 - Math.exp(-ACCEL * dt);
        this.vel.x += (_wish.x * spd - this.vel.x) * accelK;
        this.vel.z += (_wish.z * spd - this.vel.z) * accelK;
        // smooth turn toward desired facing — frame-rate-independent
        // (exponential approach instead of linear slew, so it feels the
        // same at 30/60/144fps and eases naturally into the new heading)
        const desiredFacing = Math.atan2(_wish.x, _wish.z);
        let delta = desiredFacing - this.facing;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        this.facing += delta * (1 - Math.exp(-12 * dt));
      } else {
        const decay = Math.max(0, 1 - FRICTION * dt);
        this.vel.x *= decay; this.vel.z *= decay;
      }
    }

    // gravity
    this.vel.y -= GRAVITY * dt;
    this.pos.addScaledVector(this.vel, dt);

    // ground collision via Rapier ray cast down (fallback to ctx.heightfn)
    const groundY = this._groundHeight(ctx);
    if (groundY !== null && this.pos.y <= groundY + 0.001) {
      const wasAirborne = !this.grounded;
      const impactSpeed = this.vel.y;
      if (wasAirborne && impactSpeed < -4) {
        const impactPos = new THREE.Vector3(this.pos.x, this.pos.y + 0.05, this.pos.z);
        if (this.isPlayer) { spawnDust(impactPos); SFX.land(); }
        // shader shockwave on hard landings (visible even without shadow)
        if (impactSpeed < -6) spawnShockwave(impactPos, 0xFFFFFF);
        // hard landing → squash animation (weight + follow-through)
        if (impactSpeed < -6) this.anim.set('land');
      }
      this.pos.y = groundY; this.vel.y = 0; this.grounded = true;
      this.coyote = COYOTE_TIME;
      if (ctx.solidGroundAt) {
        const sg = ctx.solidGroundAt(this.pos.x, this.pos.z);
        if (sg !== null) this.checkpoint.set(this.pos.x, sg, this.pos.z);
      }
    } else {
      this.grounded = false;
      this.coyote -= dt;
      // solid wall push-back (arena boundary)
      if (groundY === null && !this.ragdoll && ctx.isWall && ctx.isWall(this.pos.x, this.pos.z)) {
        this._pushBackInside(ctx);
      }
    }

    // solid obstacle collision (candles/trampolines) via ctx-provided list
    if (ctx.solidObstacles && !this.ragdoll) {
      for (const obs of ctx.solidObstacles) {
        const dx = this.pos.x - obs.x, dz = this.pos.z - obs.z;
        const distXZ = Math.hypot(dx, dz);
        const minDist = obs.r + CHARACTER_RADIUS;
        if (distXZ < minDist && Math.abs(this.pos.y - obs.y) < obs.h * 0.5 + 0.5) {
          const push = (minDist - distXZ) / Math.max(0.001, distXZ);
          this.pos.x += dx * push; this.pos.z += dz * push;
          this.vel.x *= 0.5; this.vel.z *= 0.5;
        }
      }
    }

    // fell off world
    if (this.pos.y < ctx.killY) ctx.onFell(this);

    // map-specific obstacle interactions (candles/sweepers/pendulums/finish)
    ctx.checkActor?.(this);

    // facing smoothing (frame-rate independent & handles wrapping)
    let fDelta = -this.facing - this.root.rotation.y;
    while (fDelta > Math.PI) fDelta -= Math.PI * 2;
    while (fDelta < -Math.PI) fDelta += Math.PI * 2;
    this.root.rotation.y += fDelta * (1 - Math.exp(-20 * dt));
    if (!this.ragdoll) { this.root.rotation.x = 0; this.root.rotation.z = 0; }

    // animation state selection
    // 'land' plays through its squash→recover before yielding to run/idle,
    // so hard landings get visible weight instead of being overwritten.
    if (this.anim.state === 'land') {
      // keep the land animation until it finishes; allow dive override
      if (this.diveLock > 0) this.anim.set('dive');
    } else if (this.diveLock > 0) this.anim.set('dive');
    else if (!this.grounded) this.anim.set(this.vel.y < -1 ? 'fall' : 'jump');
    else if (moving) { this.anim.set('run'); this.anim.speed = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / MOVE_SPEED); }
    else this.anim.set('idle');

    // emote — plays the chosen emote (keyboard E = equipped, wheel = specific)
    if (this.isPlayer) {
      const ek = Input.consumeEmote();
      if (ek) {
        const valid = ['dance', 'wave', 'taunt', 'point', 'flex', 'cry'];
        const key = valid.includes(ek) ? ek : 'celebrate';
        this.anim.set(key);
        // shader burst above the head when an emote fires
        spawnEmoteBurst(this.pos, key === 'cry' ? 0x60A5FA : 0xA3E635);
      }
    }
    // any emote state cancels back to idle/run when the player moves or jumps
    const isEmoting = ['celebrate', 'dance', 'wave', 'taunt', 'point', 'flex', 'cry'].includes(this.anim.state);
    if (isEmoting && (moving || jumpReq)) this.anim.set('idle');

    // shiller rocket trail
    if (this.rig.skinKey === 'shiller' && this.anim.state === 'run' && FX.spark) {
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.04;
        FX.spark.spawn(
          new THREE.Vector3(this.pos.x, this.pos.y + 0.4, this.pos.z),
          new THREE.Vector3((Math.random() - 0.5), 1.5, (Math.random() - 0.5)),
          0.5, 0.8 + Math.random() * 0.4, Math.random() > 0.5 ? 0xff6b00 : 0xffd700
        );
      }
    }

    this.anim.update(dt, t);
    this._syncBody();
    this._updateContactShadow(ctx);
  }

  /** Position/scale/fade the contact-shadow blob under the character. */
  _updateContactShadow(ctx) {
    if (!this.contactShadow) return;
    // ground height at current XZ (for placing the blob flush on the floor)
    const gy = ctx.groundHeightAt ? ctx.groundHeightAt(this.pos.x, this.pos.z) : null;
    const groundY = gy !== null ? gy : this.pos.y;
    this.contactShadow.position.set(this.pos.x, groundY + 0.02, this.pos.z);
    // height above ground → shrink + fade so jumps/falls read correctly
    const h = Math.max(0, this.pos.y - groundY);
    const s = Math.max(0.55, 1.0 - h * 0.06);
    this.contactShadow.scale.set(s, s, 1);
    this.contactShadow.material.opacity = Math.max(0.12, 0.5 - h * 0.03);
    // hide entirely when falling far below the arena (out of world)
    this.contactShadow.visible = gy !== null;
  }

  /** Resolve ground height: prefer Rapier ray cast; fall back to ctx.groundHeightAt. */
  _groundHeight(ctx) {
    // Use ctx.groundHeightAt as authoritative (maps provide heightfield semantics
    // including pits/movers). Rapier is used for obstacle sensors, not terrain here.
    if (ctx.groundHeightAt) return ctx.groundHeightAt(this.pos.x, this.pos.z);
    const hit = castRayDown(this.pos.x, this.pos.y, this.pos.z, 6, this.body);
    return hit ? hit.y : null;
  }

  _pushBackInside(ctx) {
    const samples = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
    let best = null, bestDist = 2.0;
    for (const [dx, dz] of samples) {
      for (const step of [0.5, 1.0, 1.6, 2.0]) {
        if (ctx.groundHeightAt(this.pos.x + dx * step, this.pos.z + dz * step) !== null) {
          if (step < bestDist) { bestDist = step; best = { x: dx, z: dz }; }
          break;
        }
      }
    }
    if (best) {
      this.pos.x += best.x * 0.6;
      this.pos.z += best.z * 0.6;
      this.vel.x *= 0.15; this.vel.z *= 0.15;
    }
  }

  _syncBody() {
    if (this.body) this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
  }

  addNameplate(text) { this.root.add(makeLabel(text)); }

  dispose() {
    if (this.body) { removeBody(this.body); this.body = null; }
    scene.remove(this.root);
    if (this.contactShadow) {
      scene.remove(this.contactShadow);
      this.contactShadow.geometry.dispose();
      this.contactShadow = null;
    }
    this.rig.dispose();
  }
}
