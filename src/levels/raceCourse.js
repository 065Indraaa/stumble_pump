// ============================================================
// STUMBLE PUMP — raceCourse factory
// Builds a full race-to-finish map from a config object.
// Returns the map contract consumed by Actor + MatchState:
//   { type, group, killY, finishZ, qualifyTarget, startZ, length,
//     spawnPoints, solidObstacles, heightFn,
//     groundHeightAt, isWall, isPitAt, solidGroundAt,
//     onFell, checkActor, update, dispose }
// Obstacles: red candles, green trampolines, sweepers, pendulums,
//            pits + mover bridges, optional lava plane.
// ============================================================
import * as THREE from 'three';
import { scene, renderer, camera } from '../core/Engine.js';
import { lambertMat, basicMat, makeBillboard } from '../core/AssetFactory.js';
import {
  makeGridFloor, makeMoons, makeOrbs, makeFloatingCandles, makeChartLine,
  makeBuilding, clearScene, spawnGrid, make3DClouds, makeFloatingIslands, make3DTileFloor
} from './env.js';
import { makeRedCandle, updateRedCandle } from '../entities/RedCandle.js';
import { makeGreenTrampoline, updateGreenTrampoline, BOUNCE_VELOCITY } from '../entities/GreenTrampoline.js';
import { makeSweeper, updateSweeper } from '../entities/Sweeper.js';
import { makePendulum, updatePendulum } from '../entities/Pendulum.js';
import { makeMover, updateMover } from '../entities/MoverPlatform.js';
import { SFX } from '../core/AudioManager.js';
import { shakeCamera } from '../core/Engine.js';
import { SP_PALETTE } from '../config/constants.js';

export function buildRaceCourse(cfg) {
  clearScene();
  renderer.setClearColor(SP_PALETTE.sky);
  scene.fog = new THREE.Fog(SP_PALETTE.fog, 90, 300);
  const group = new THREE.Group();
  scene.add(group);
  const L = cfg.L, W = cfg.W, H = cfg.H;
  const heightFn = (z) => cfg.heightFn(THREE.MathUtils.clamp(z, 0, L));

  // 3D Procedural Sky Elements
  group.add(make3DClouds(40, 200, 50));
  group.add(makeFloatingIslands(15, 180));

  // 3D Tile Floor for the main race track (with pits)
  const floor = make3DTileFloor(W, L, 4, heightFn, SP_PALETTE.floor1, SP_PALETTE.floor2, cfg.pits || []);
  group.add(floor);

  // lane stripes down the center of the track (so floor reads as a "road")
  const stripeMat = lambertMat(SP_PALETTE.edge);
  for (let z = 4; z < L; z += 8) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 3), stripeMat);
    s.position.set(0, heightFn(z) + 0.04, z); group.add(s);
  }

  // side walls
  for (const sx of [-1, 1]) {
    const wallH = 8;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.5, wallH, L), lambertMat(SP_PALETTE.terrain));
    wall.position.set(sx * (W + 0.5), heightFn(L * 0.5) + wallH * 0.5 - 2, L / 2);
    wall.castShadow = true; wall.receiveShadow = true; group.add(wall);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, L), lambertMat(SP_PALETTE.edge));
    edge.position.set(sx * (W + 0.5), heightFn(L * 0.5) + wallH - 2, L / 2); group.add(edge);
    for (let z = 4; z < L; z += 12) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), lambertMat(SP_PALETTE.edge));
      p.position.set(sx * (W + 0.5), heightFn(z) + 1.2, z); group.add(p);
    }
  }
  // under-floor (fills void)
  const underGeo = new THREE.PlaneGeometry(W * 4, L); underGeo.rotateX(-Math.PI / 2);
  const underFloor = new THREE.Mesh(underGeo, lambertMat(SP_PALETTE.wall));
  underFloor.position.set(0, -12, L / 2); group.add(underFloor);

  group.add(makeGridFloor(540, -34, SP_PALETTE.grass));
  group.add(makeMoons());
  const orbs = makeOrbs(36, 90, 8); group.add(orbs);
  makeFloatingCandles(group, L, W, 22);
  makeChartLine(group, L, W, 4, SP_PALETTE.edge);

  // buildings along track — pastel palette
  const bPalette = [SP_PALETTE.floor1, SP_PALETTE.edge, SP_PALETTE.terrain, SP_PALETTE.wall, SP_PALETTE.floor2];
  const bTypes = ['cone', 'pyramid', 'dome', 'flat'];
  for (let z = 15; z < L - 10; z += 28) {
    for (const sx of [-1, 1]) {
      const bh = 5 + Math.random() * 6, bw = 4 + Math.random() * 2;
      const b = makeBuilding({ w: bw, d: bw, h: bh, color: bPalette[Math.floor(z) % bPalette.length], roofColor: bPalette[(Math.floor(z) + 2) % bPalette.length], roofType: bTypes[Math.floor(z / 28) % bTypes.length], winColor: SP_PALETTE.edge, flag: z % 56 === 0 });
      b.position.set(sx * (W + 6 + Math.random() * 3), 0, z);
      b.rotation.y = Math.random() * Math.PI;
      group.add(b);
    }
  }
  const grandstand = makeBuilding({ w: W * 2.2, d: 5, h: 12, color: SP_PALETTE.edge, roofColor: SP_PALETTE.terrain, roofType: 'flat', winColor: SP_PALETTE.edge, flag: false });
  grandstand.position.set(0, 0, L + 8); group.add(grandstand);

  // start gate
  const sgate = new THREE.Group();
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 12), lambertMat(SP_PALETTE.edge)); p.position.set(sx * (W - 1), heightFn(0) + 3, 0); sgate.add(p); }
  const sgTop = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 1, 0.8), lambertMat(SP_PALETTE.terrain)); sgTop.position.set(0, heightFn(0) + 6, 0); sgate.add(sgTop);
  group.add(sgate);

  // finish gate
  const gate = new THREE.Group();
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 8, 14), lambertMat(SP_PALETTE.terrain)); p.position.set(sx * (W - 1), heightFn(L) + 4, L); gate.add(p); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 1.1, 0.5), lambertMat(SP_PALETTE.terrain)); beam.position.set(0, heightFn(L) + 8, L); gate.add(beam);
  const gTop = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 0.8, 0.8), lambertMat(SP_PALETTE.edge)); gTop.position.set(0, heightFn(L) + 9, L); gate.add(gTop);
  group.add(gate);
  const finishText = makeBillboard(cfg.finishText || 'TO THE MOON', SP_PALETTE.terrain, 7);
  finishText.position.set(0, heightFn(L) + 11, L + 3); group.add(finishText);

  // ---- obstacles ----
  const candles = []; let candleTimer = 1.5;
  function spawnRedCandle() {
    const c = makeRedCandle((Math.random() - 0.5) * W * 1.7, heightFn(L * 0.9) + 3, L * 0.9);
    group.add(c.grp); candles.push(c);
  }
  if (cfg.candles) { for (let i = 0; i < 5; i++) spawnRedCandle(); }

  const tramps = [];
  if (cfg.tramps) {
    for (let i = 0; i < cfg.tramps; i++) {
      const z = L * (0.18 + i * (0.62 / cfg.tramps));
      const x = (i % 2 ? 1 : -1) * (W * 0.45);
      const t = makeGreenTrampoline(x, heightFn(z) + 2, z);
      group.add(t.grp); tramps.push(t);
    }
  }

  const sweepers = [];
  (cfg.sweepers || []).forEach((sd) => {
    const s = makeSweeper(sd.z, heightFn(sd.z) + 1.2, sd.len || W * 1.7, sd.sp || 1.8);
    group.add(s.pivot); sweepers.push(s);
  });

  const pendulums = [];
  (cfg.pendulums || []).forEach((pd) => {
    const p = makePendulum(pd.z, heightFn(pd.z) + 8, pd.x || 0, pd.amp || 1.1, pd.sp || 1.4);
    group.add(p.piv); pendulums.push(p);
  });

  const pits = cfg.pits || [];
  const movers = [];
  (cfg.movers || []).forEach((md) => {
    const m = makeMover({ z: md.z, x0: md.x0, x1: md.x1, w: md.w || 3, d: md.d || 3, sp: md.sp || 0.6, color: md.color || 0x5FCB88 });
    m.y = heightFn(md.z) - 0.3; m.mesh.position.y = m.y;
    group.add(m.mesh); movers.push(m);
  });

  if (cfg.lava) {
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(W * 2.4, L), new THREE.MeshBasicMaterial({ color: SP_PALETTE.lava, transparent: true, opacity: 0.8 }));
    lava.rotation.x = -Math.PI / 2; lava.position.set(0, -8, L / 2); group.add(lava);
  }

  const finishZ = L - 4;
  const killY = cfg.killY ?? -40;
  const solidObstacles = tramps.map((t) => ({ x: t.x, z: t.z, y: heightFn(t.z) + 2, r: 1.2, h: 4 }));

  // ---- ground/collision contract ----
  function groundHeightAt(x, z) {
    if (Math.abs(x) > W) return null;
    if (z < -6 || z > L + 6) return null;
    // mover surfaces bridge pits
    for (const mv of movers) {
      if (Math.abs(z - mv.z) < mv.d / 2 && Math.abs(x - mv.x) < mv.w / 2) return mv.y + 0.5;
    }
    // pits = fall through
    for (const p of pits) {
      const halfW = p.halfW ?? (W + 1);
      if (z > p.z0 && z < p.z1 && Math.abs(x) < halfW) return null;
    }
    return heightFn(z);
  }
  function isWall(x, z) {
    if (Math.abs(x) > W) return true;
    if (z < -2) return true;
    return false;
  }
  function isPitAt(x, z) {
    for (const p of pits) {
      const halfW = p.halfW ?? (W + 1);
      if (z > p.z0 && z < p.z1 && Math.abs(x) < halfW) return true;
    }
    return false;
  }
  function solidGroundAt(x, z) {
    if (Math.abs(x) > W - 0.6) return null;
    if (z < 1 || z > L - 1) return null;
    if (isPitAt(x, z)) return null;
    for (const mv of movers) {
      if (Math.abs(z - mv.z) < mv.d / 2 + 1.5 && Math.abs(x - mv.x) < mv.w / 2 + 1.5) return null;
    }
    return heightFn(z);
  }

  // ---- interaction (candles/sweepers/pendulums/tramp/finish) ----
  function onFell(a) {
    // race respawn at last safe checkpoint
    if (a.checkpoint) {
      a.pos.copy(a.checkpoint);
      a.vel.set(0, 0, 0);
      a.respawnStun = 0.4;
      a.respawns++;
      if (a.isPlayer) { SFX.hit(); shakeCamera(0.4, 0.25); }
    } else {
      a.pos.set(0, heightFn(2) + 2, 2); a.vel.set(0, 0, 0);
    }
  }

  function checkActor(a) {
    if (a.ragdoll || a.parked) return;
    const ax = a.pos.x, ay = a.pos.y, az = a.pos.z;
    // trampoline bounce
    for (const t of tramps) {
      if (Math.abs(ax - t.x) < 1.5 && Math.abs(az - t.z) < 1.5 && Math.abs(ay - (heightFn(t.z) + 2)) < 1.5) {
        a.vel.y = BOUNCE_VELOCITY; a.grounded = false;
        t.squash = 1;
        if (a.isPlayer) SFX.bounce();
      }
    }
    // red candle collision -> ragdoll + push
    for (const c of candles) {
      const dx = ax - c.x, dz = az - c.z;
      if (dx * dx + dz * dz < 2 && Math.abs(ay - (heightFn(c.z) + 3)) < 4) {
        if (!a.ragdoll) {
          a.startRagdoll(new THREE.Vector3(dx, 1, dz).normalize());
          if (a.isPlayer) shakeCamera(0.6, 0.3);
        }
      }
    }
    // sweeper tip -> ragdoll
    for (const s of sweepers) {
      const tipX = Math.sin(s.ang) * s.len, tipZ = Math.cos(s.ang) * s.len;
      const dx = ax - tipX, dz = az - (s.z);
      if (dx * dx + dz * dz < 2 && Math.abs(ay - s.y) < 2) {
        if (!a.ragdoll) a.startRagdoll(new THREE.Vector3(dx, 1, dz).normalize());
      }
    }
    // pendulum ball -> ragdoll
    for (const p of pendulums) {
      const ballY = p.baseY + Math.sin(p.piv.rotation.x) * 0 - 6;
      const dx = ax - p.x, dy = ay - (p.baseY - 6), dz = az - p.z;
      if (dx * dx + dz * dz < 2.4 && Math.abs(dy) < 2) {
        if (!a.ragdoll) a.startRagdoll(new THREE.Vector3(dx, 1, dz).normalize());
      }
    }
    // finish line qualification
    if (az >= finishZ && !a.qualified && !a.eliminated) {
      a.qualified = true;
    }
  }

  function update(dt, t) {
    orbs.userData.update(t);
    // candles spawn + drift
    candleTimer -= dt;
    if (cfg.candles && candleTimer <= 0 && candles.length < 10) { candleTimer = 1.5 + Math.random() * 1.8; spawnRedCandle(); }
    for (let i = candles.length - 1; i >= 0; i--) {
      const c = candles[i]; updateRedCandle(c, dt);
      if (c.z < 0) { group.remove(c.grp); candles.splice(i, 1); }
    }
    tramps.forEach((tr) => updateGreenTrampoline(tr, dt));
    sweepers.forEach((s) => updateSweeper(s, dt));
    pendulums.forEach((p) => updatePendulum(p, t));
    movers.forEach((m) => updateMover(m, t));
    finishText.lookAt(camera.position);
  }

  return {
    type: 'race', group, killY, finishZ, qualifyTarget: 16, startZ: 0, length: L,
    spawnPoints: spawnGrid(32, 0, 0),
    solidObstacles,
    heightFn,
    groundHeightAt, isWall, isPitAt, solidGroundAt,
    onFell, checkActor, update,
    surviveTime: null,
    safeTargetFor: null,
    dispose() { scene.remove(group); },
  };
}
