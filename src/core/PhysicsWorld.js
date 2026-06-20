// ============================================================
// STUMBLE PUMP — PhysicsWorld
// Rapier3D WASM wrapper. Fixed-timestep accumulator.
// Owns the Rapier World, event queue (sensors/contacts), and a
// registry mapping entity ids -> Rapier colliders for ray/shape casts.
// ============================================================
import RAPIER from '@dimforge/rapier3d-compat';
import { GRAVITY, FIXED_DT, MAX_SUBSTEPS } from '../config/constants.js';

let world = null;
let eventQueue = null;
let accumulator = 0;
let ready = false;
const registry = new Map();   // collider handle -> { entity, type, tag }

// active dynamic bodies pending impulse, cleared each step
const postStepCallbacks = [];

/** Async init — must await before any body creation. */
export async function init() {
  if (ready) return;
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
  world.timestep = FIXED_DT;
  // integrate velocities more reliably for fast horizontal motion (dive)
  world.integrationParameters.dt = FIXED_DT;
  eventQueue = new RAPIER.EventQueue(true);
  ready = true;
  return world;
}

export function getWorld() { return world; }
export function isReady() { return ready; }

/** Create a fixed (static) cuboid collider attached to world. Returns collider. */
export function addFixedBox({ hx, hy, hz, x = 0, y = 0, z = 0, rotY = 0, tag = null, entity = null, friction = 0.7, restitution = 0 }) {
  if (!ready) return null;
  const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
    .setTranslation(x, y, z)
    .setFriction(friction)
    .setRestitution(restitution);
  if (rotY) desc.setRotation({ x: 0, y: Math.sin(rotY * 0.5), z: 0, w: Math.cos(rotY * 0.5) });
  const col = world.createCollider(desc);
  if (tag || entity) registry.set(col.handle, { entity, type: tag });
  return col;
}

/** Fixed cylinder collider (Z-up default in rapier is Y, cylinder is along Y). */
export function addFixedCylinder({ r, h, x = 0, y = 0, z = 0, rotY = 0, tag = null, entity = null, friction = 0.7, restitution = 0 }) {
  if (!ready) return null;
  const desc = RAPIER.ColliderDesc.cylinder(h * 0.5, r)
    .setTranslation(x, y, z)
    .setFriction(friction)
    .setRestitution(restitution);
  if (rotY) desc.setRotation({ x: 0, y: Math.sin(rotY * 0.5), z: 0, w: Math.cos(rotY * 0.5) });
  const col = world.createCollider(desc);
  if (tag || entity) registry.set(col.handle, { entity, type: tag });
  return col;
}

/** Create a dynamic rigid body with a box collider. Returns { body, collider }. */
export function addDynamicBox({ hx, hy, hz, x = 0, y = 0, z = 0, mass = 1, friction = 0.5, restitution = 0, ccd = false, tag = null, entity = null, linDamping = 0.4, angDamping = 0.6 }) {
  if (!ready) return null;
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y, z)
    .setLinearDamping(linDamping)
    .setAngularDamping(angDamping);
  if (ccd) bodyDesc.enableCcd(true);
  const body = world.createRigidBody(bodyDesc);
  const colDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
    .setMass(mass)
    .setFriction(friction)
    .setRestitution(restitution);
  const col = world.createCollider(colDesc, body);
  if (tag || entity) registry.set(col.handle, { entity, type: tag });
  return { body, collider: col };
}

/** Kinematic-position-based body (we move it every frame via setNextTranslation). */
export function addKinematicBox({ hx, hy, hz, x = 0, y = 0, z = 0, mass = 1, friction = 0.5, restitution = 0, tag = null, entity = null, sensor = false }) {
  if (!ready) return null;
  const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z);
  const body = world.createRigidBody(bodyDesc);
  const colDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
    .setMass(mass).setFriction(friction).setRestitution(restitution);
  if (sensor) colDesc.setSensor(true);
  const col = world.createCollider(colDesc, body);
  if (tag || entity) registry.set(col.handle, { entity, type: tag });
  return { body, collider: col };
}

/** Kinematic capsule (along Y). */
export function addKinematicCapsule({ r, halfH, x = 0, y = 0, z = 0, mass = 1, friction = 0.4, restitution = 0, tag = null, entity = null }) {
  if (!ready) return null;
  const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z);
  const body = world.createRigidBody(bodyDesc);
  const colDesc = RAPIER.ColliderDesc.capsule(halfH, r).setMass(mass).setFriction(friction).setRestitution(restitution);
  const col = world.createCollider(colDesc, body);
  if (tag || entity) registry.set(col.handle, { entity, type: tag });
  return { body, collider: col };
}

/** Fixed (static) sensor — for finish line, trampoline, hazard triggers. */
export function addSensorBox({ hx, hy, hz, x = 0, y = 0, z = 0, tag, entity = null }) {
  if (!ready) return null;
  const col = world.createCollider(
    RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setSensor(true)
  );
  registry.set(col.handle, { entity, type: tag });
  return col;
}

export function removeBody(b) { if (ready && b) world.removeRigidBody(b); }
export function removeCollider(c) { if (ready && c) world.removeCollider(c); }

export function lookupByHandle(handle) { return registry.get(handle); }

/** Ray cast straight down from (x,y,z) up to maxDist. Returns {hit, y, entity, type} or null. */
export function castRayDown(x, y, z, maxDist = 8, excludeBody = null) {
  if (!ready) return null;
  const ray = new RAPIER.Ray({ x, y: y + 0.1, z }, { x: 0, y: -1, z: 0 });
  const hit = world.castRayAndGetNormal(ray, maxDist + 0.2, true, undefined, undefined, excludeBody, undefined, undefined);
  if (hit.timeOfImpact === undefined || hit.timeOfImpact < 0) return null;
  const colHandle = hit.collider?.handle;
  const reg = colHandle !== undefined ? registry.get(colHandle) : null;
  return {
    hit: true,
    y: (y + 0.1) - hit.timeOfImpact,
    entity: reg?.entity ?? null,
    type: reg?.type ?? null,
    collider: hit.collider,
    normal: hit.normal,
  };
}

/** Shape-cast a sphere horizontally for wall/obstacle probing. Returns nearest hit or null. */
export function castShapeAhead(origin, dir, radius, maxDist, excludeBody = null) {
  if (!ready) return null;
  // Use raycast along dir as a cheap forward probe (good enough for our use)
  const ray = new RAPIER.Ray(
    { x: origin.x, y: origin.y, z: origin.z },
    { x: dir.x, y: dir.y, z: dir.z }
  );
  const hit = world.castRay(ray, maxDist, true, undefined, undefined, excludeBody, undefined, undefined);
  if (hit.timeOfImpact === undefined || hit.timeOfImpact < 0) return null;
  const colHandle = hit.collider?.handle;
  const reg = colHandle !== undefined ? registry.get(colHandle) : null;
  return { dist: hit.timeOfImpact, entity: reg?.entity ?? null, type: reg?.type ?? null, collider: hit.collider };
}

/** Drain intersection events (sensor overlaps) into a callback. */
export function forEachIntersection(cb) {
  if (!ready) return;
  eventQueue.drainIntersectionEvents((e) => {
    const a = registry.get(e.collider1.handle);
    const b = registry.get(e.collider2.handle);
    cb(a, b, e);
  });
}
export function forEachContact(cb) {
  if (!ready) return;
  eventQueue.drainContactForceEvents((e) => {
    const a = registry.get(e.collider1.handle);
    const b = registry.get(e.collider2.handle);
    cb(a, b, e);
  });
}

/** Advance simulation by real dt using a fixed-step accumulator. */
export function step(dt) {
  if (!ready) return;
  accumulator += Math.min(dt, 0.1);
  let steps = 0;
  while (accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
    world.step(eventQueue);
    accumulator -= FIXED_DT;
    steps++;
  }
  for (const fn of postStepCallbacks) { try { fn(); } catch (e) {} }
  postStepCallbacks.length = 0;
}

export function afterStep(fn) { postStepCallbacks.push(fn); }

/** Clear all bodies/colliders for a clean map reload. */
export function reset() {
  if (!ready) { return; }
  // Recreate a fresh world to dispose everything reliably.
  world.free();
  world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
  world.timestep = FIXED_DT;
  registry.clear();
  accumulator = 0;
}

export const RAPIER_API = RAPIER;
