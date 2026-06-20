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
  clearScene, make3DClouds, makeFloatingIslands, make3DTileFloor,
  makeTree, makeBush, makeRock, makeHillsRing, spawnGrid,
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
  // Theme colors: each level (Bonding/Moon/Liquidation) supplies its own sky,
  // fog and world palette so the arena reads as the intended environment —
  // not always the green grass default.
  const SKY = cfg.clear ?? SP_PALETTE.sky;
  const FOG = cfg.fog ?? SP_PALETTE.fog;
  const TERRAIN = cfg.terrainColor ?? SP_PALETTE.terrain;
  const EDGE = cfg.edgeColor ?? SP_PALETTE.edge;
  const GRID = cfg.gridColor ?? SP_PALETTE.floor2;
  const backdrop = cfg.backdrop || 'bonding';
  renderer.setClearColor(SKY);
  scene.fog = new THREE.Fog(FOG, 90, 300);
  const group = new THREE.Group();
  scene.add(group);
  const L = cfg.L, W = cfg.W, H = cfg.H;
  const heightFn = (z) => cfg.heightFn(THREE.MathUtils.clamp(z, 0, L));

  // 3D Procedural Sky Elements — backdrop-aware so a space map doesn't get
  // fluffy white clouds and a lava map doesn't get green floating islands.
  if (backdrop === 'moon') {
    // dark space: distant stars only (no clouds, no islands)
    const starGeo = new THREE.SphereGeometry(0.6, 5, 4);
    const starMat = basicMat(0xFFFFFF);
    const starInst = new THREE.InstancedMesh(starGeo, starMat, 160);
    const m4 = new THREE.Matrix4();
    for (let s = 0; s < 160; s++) {
      m4.makeTranslation((Math.random() - 0.5) * 500, 30 + Math.random() * 120, Math.random() * L);
      starInst.setMatrixAt(s, m4);
    }
    starInst.instanceMatrix.needsUpdate = true;
    group.add(starInst);
  } else if (backdrop === 'liquidation') {
    // smoky hellscape: dark drifting embers + sparse dark clouds
    group.add(make3DClouds(8, 220, 60));
  } else {
    // default grass world: cheerful clouds + floating islands
    group.add(make3DClouds(40, 200, 50));
    group.add(makeFloatingIslands(15, 180));
  }

  // 3D Tile Floor for the main race track (with pits)
  const floor = make3DTileFloor(W, L, 4, heightFn, SP_PALETTE.floor1, GRID, cfg.pits || []);
  group.add(floor);

  // lane stripes down the center of the track
  const stripeMat = lambertMat(EDGE);
  for (let z = 4; z < L; z += 8) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 3), stripeMat);
    s.position.set(0, heightFn(z) + 0.04, z); group.add(s);
  }

  // side walls (theme-coloured so each map reads distinctly)
  for (const sx of [-1, 1]) {
    const wallH = 8;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.5, wallH, L), lambertMat(TERRAIN));
    wall.position.set(sx * (W + 0.5), heightFn(L * 0.5) + wallH * 0.5 - 2, L / 2);
    wall.castShadow = true; wall.receiveShadow = true; group.add(wall);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, L), lambertMat(EDGE));
    edge.position.set(sx * (W + 0.5), heightFn(L * 0.5) + wallH - 2, L / 2); group.add(edge);
    for (let z = 4; z < L; z += 12) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), lambertMat(EDGE));
      p.position.set(sx * (W + 0.5), heightFn(z) + 1.2, z); group.add(p);
    }
  }

  // ---- Ground world under/around the track (backdrop-specific) ----
  // Always a displaced plane following the track height curve (no staircase),
  // but the surface material + scattered decor change per theme:
  //   bonding → grass + trees + bushes + hills
  //   moon    → grey regolith + craters + rocks (no hills)
  //   liquidation → dark rock + lava cracks + ember pits
  const GRASS_DROP = 1.0;
  const GROUND_HALF_W = W + 16;
  const grassGeo = new THREE.PlaneGeometry(GROUND_HALF_W * 2, L + 8, 2, Math.max(8, Math.round(L / 6)));
  grassGeo.rotateX(-Math.PI / 2);
  {
    const p = grassGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const zw = p.getZ(i) + (L + 8) / 2;
      const zc = THREE.MathUtils.clamp(zw, 0, L);
      p.setY(i, heightFn(zc) - GRASS_DROP);
    }
    p.needsUpdate = true;
    grassGeo.computeVertexNormals();
  }
  const surfaceMat = backdrop === 'moon' ? lambertMat(0x4A4A5A)
    : backdrop === 'liquidation' ? lambertMat(0x2A1414)
    : lambertMat(TERRAIN);
  const grassMesh = new THREE.Mesh(grassGeo, surfaceMat);
  grassMesh.position.z = (L + 8) / 2;
  grassMesh.receiveShadow = true;
  group.add(grassMesh);

  // Solid dark floor far below as a safety backdrop (theme-coloured)
  const underGeo = new THREE.PlaneGeometry(GROUND_HALF_W * 2 + 60, L + 60);
  underGeo.rotateX(-Math.PI / 2);
  const underFloor = new THREE.Mesh(underGeo, lambertMat(backdrop === 'moon' ? 0x0B0C1A : backdrop === 'liquidation' ? 0x180404 : SP_PALETTE.dirt));
  underFloor.position.set(0, heightFn(L * 0.5) - 14, L / 2);
  underFloor.receiveShadow = true;
  group.add(underFloor);

  // ---- Backdrop-specific scattered decor ----
  const groundY = (z) => heightFn(THREE.MathUtils.clamp(z, 0, L)) - GRASS_DROP;
  if (backdrop === 'moon') {
    // craters + moon rocks along both sides
    for (let z = 12; z < L; z += 22) {
      for (const sx of [-1, 1]) {
        const x = sx * (W + 5 + (z % 8));
        const cy = groundY(z);
        const crater = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.3, 0.4, 10), lambertMat(0x353545));
        crater.position.set(x, cy + 0.2, z); crater.receiveShadow = true; group.add(crater);
        const rock = makeRock(x, z, 0.8 + (z % 5) * 0.15, 0x6A6A7A);
        rock.position.y = cy; group.add(rock);
      }
    }
  } else if (backdrop === 'liquidation') {
    // glowing lava cracks + ember pits along both sides
    for (let z = 12; z < L; z += 16) {
      for (const sx of [-1, 1]) {
        const x = sx * (W + 5 + (z % 6));
        const cy = groundY(z);
        const pit = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.5, 10), lambertMat(0x4A1010));
        pit.position.set(x, cy + 0.2, z); pit.receiveShadow = true; group.add(pit);
        const ember = new THREE.Mesh(new THREE.CircleGeometry(1.1, 10), basicMat(0xFF5500));
        ember.rotation.x = -Math.PI / 2; ember.position.set(x, cy + 0.46, z); group.add(ember);
      }
    }
  } else {
    // default grass world: trees + bushes + rocks + distant hills
    let _seed = 9753;
    const _rnd = () => { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; };
    const treeCols = [TERRAIN, 0x4FAE6A, 0x6BCB95, TERRAIN];
    for (let z = 12; z < L; z += 18) {
      for (const sx of [-1, 1]) {
        if (_rnd() < 0.7) {
          const x = sx * (W + 4 + _rnd() * 8);
          const sc = 0.9 + _rnd() * 0.8;
          const tree = makeTree(x, z, sc, treeCols[Math.floor(z / 18) % treeCols.length]);
          tree.position.y = groundY(z); group.add(tree);
        } else {
          const x = sx * (W + 4 + _rnd() * 6);
          const sc = 0.7 + _rnd() * 0.5;
          const b = makeBush(x, z, sc, treeCols[Math.floor(z / 18) % treeCols.length]);
          b.position.y = groundY(z); group.add(b);
        }
      }
    }
    for (let i = 0; i < 10; i++) {
      const z = (_seed = (_seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff * L;
      const sx = (_seed = (_seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff < 0.5 ? -1 : 1;
      const x = sx * (W + 5 + ((_seed = (_seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 10);
      const sc = 0.7 + ((_seed = (_seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 0.9;
      const r = makeRock(x, z, sc, [0x9AA0AA, 0xB0B6C0, 0x8C909A][i % 3]);
      r.position.y = groundY(z); group.add(r);
    }
    const hills = makeHillsRing(95, 18);
    hills.position.set(0, 0, L / 2);
    group.add(hills);
  }

  // Per-level themed decor (each level supplies its own unique elements)
  if (typeof cfg.buildDecor === 'function') {
    cfg.buildDecor(group, L, W, heightFn);
  }

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
