// ============================================================
// STUMBLE PUMP — Moon Mission (Race map config)
// Theme: Space — moon craters, asteroid rocks, satellites, stars
// ============================================================
import * as THREE from 'three';
import { lambertMat, basicMat } from '../core/AssetFactory.js';
import { SP_PALETTE } from '../config/constants.js';
import { buildRaceCourse } from './raceCourse.js';

/**
 * Space-themed decorations: moon rocks / craters on sides, floating asteroids,
 * satellite dishes, and a giant crescent moon at the finish.
 */
function buildDecor(group, L, W, heightFn) {
  const MOON_COLOR   = 0xC8C8D4; // pale grey moon surface
  const ROCK_COLOR   = 0x9090A0;
  const CRATER_COLOR = 0x6868A0;
  const DARK_SKY     = 0x08091A;

  // ----- Moon crater platforms along track sides -----
  // These are decorative (not on path), evenly spaced
  for (let i = 0; i < 12; i++) {
    const z = 20 + i * 22;
    if (z > L - 20) break;
    const baseY = heightFn(z);

    for (const sx of [-1, 1]) {
      const x = sx * (W + 4 + (i % 3) * 2);

      // Crater dish (flat disc with raised rim)
      const craterBase = new THREE.Mesh(
        new THREE.CylinderGeometry(4, 3.8, 0.6, 12),
        lambertMat(MOON_COLOR)
      );
      craterBase.position.set(x, baseY + 0.3, z);
      craterBase.castShadow = true; craterBase.receiveShadow = true;
      group.add(craterBase);

      // Crater inner depression (darker disc slightly inset)
      const craterInner = new THREE.Mesh(
        new THREE.CylinderGeometry(2.8, 2.6, 0.3, 12),
        lambertMat(CRATER_COLOR)
      );
      craterInner.position.set(x, baseY + 0.5, z);
      group.add(craterInner);

      // Random rocks around crater
      const rockCount = 3 + (i % 3);
      for (let r = 0; r < rockCount; r++) {
        const ra = (r / rockCount) * Math.PI * 2 + i * 0.5;
        const rr = 3 + Math.sin(ra + i) * 1.2;
        const rh = 0.5 + Math.sin(ra * 3) * 0.5;
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(rh, 0),
          lambertMat(ROCK_COLOR)
        );
        rock.position.set(
          x + Math.cos(ra) * rr,
          baseY + rh * 0.5,
          z + Math.sin(ra) * rr
        );
        rock.rotation.set(ra, ra * 0.7, 0);
        rock.castShadow = true; group.add(rock);
      }
    }
  }

  // ----- Floating asteroids (off-track, in the air) -----
  const asteroidPositions = [
    { z: L * 0.15, x: -20, y: 18 },
    { z: L * 0.32, x: 22,  y: 22 },
    { z: L * 0.50, x: -18, y: 28 },
    { z: L * 0.68, x: 25,  y: 20 },
    { z: L * 0.85, x: -22, y: 25 },
  ];
  for (const ap of asteroidPositions) {
    const asteroidGroup = new THREE.Group();
    const baseY = heightFn(ap.z);

    // Main body
    const asteroid = new THREE.Mesh(
      new THREE.DodecahedronGeometry(4 + Math.sin(ap.z) * 2, 1),
      lambertMat(ROCK_COLOR)
    );
    asteroid.castShadow = true; asteroidGroup.add(asteroid);

    // Craters on asteroid
    for (let c = 0; c < 4; c++) {
      const ca = c / 4 * Math.PI * 2;
      const crater = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        lambertMat(CRATER_COLOR)
      );
      crater.position.set(Math.cos(ca) * 3, Math.sin(ca) * 3, 1);
      crater.rotation.set(Math.sin(ca), ca, 0);
      asteroidGroup.add(crater);
    }

    asteroidGroup.position.set(ap.x, baseY + ap.y, ap.z);
    asteroidGroup.rotation.set(Math.sin(ap.z) * 0.3, ap.z * 0.01, Math.cos(ap.z) * 0.2);
    group.add(asteroidGroup);
  }

  // ----- Satellite dishes (along track sides at intervals) -----
  const dishPositions = [L * 0.3, L * 0.55, L * 0.8];
  for (let i = 0; i < dishPositions.length; i++) {
    const z = dishPositions[i];
    const baseY = heightFn(z);
    const sx = i % 2 === 0 ? -1 : 1;
    const x = sx * (W + 3);

    const dishGroup = new THREE.Group();
    dishGroup.position.set(x, baseY, z);

    // Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.25, 4.5, 8),
      lambertMat(0x888898)
    );
    pole.position.y = 2.25; pole.castShadow = true; dishGroup.add(pole);

    // Dish bowl (half-sphere)
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      lambertMat(0xD0D0E0)
    );
    dish.position.y = 5;
    dish.rotation.x = -Math.PI / 4 * (1 + i * 0.3);
    dish.castShadow = true; dishGroup.add(dish);

    // Receiver arm
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2, 6),
      lambertMat(0x888898)
    );
    arm.position.set(0, 6.8, 0.8);
    arm.rotation.x = Math.PI / 4;
    dishGroup.add(arm);

    // Signal dot (blinking emitter at tip)
    const signal = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      basicMat(SP_PALETTE.terrain)
    );
    signal.position.set(0, 8, 1.8);
    dishGroup.add(signal);

    group.add(dishGroup);
  }

  // ----- Giant crescent moon at finish line -----
  const moonZ = L - 8;
  const moonY = heightFn(moonZ) + 20;

  // Full sphere
  const moonFull = new THREE.Mesh(
    new THREE.SphereGeometry(12, 24, 18),
    lambertMat(MOON_COLOR)
  );
  moonFull.position.set(0, moonY, moonZ - 20);
  moonFull.castShadow = true; group.add(moonFull);

  // Moon craters (decorative on surface)
  const moonCraterData = [
    [-3, 4, 11], [5, -2, 11], [-6, -5, 11], [2, 8, 10]
  ];
  for (const [cx, cy, cr] of moonCraterData) {
    const mc = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 10),
      lambertMat(CRATER_COLOR)
    );
    const r = 12.1;
    mc.position.set(cx, cy, Math.sqrt(r * r - cx * cx - cy * cy));
    mc.position.add(moonFull.position);
    group.add(mc);
  }

  // ----- Stars (far background spheres, very distant) -----
  const starGeo = new THREE.SphereGeometry(0.3, 4, 4);
  const starMat = basicMat(0xFFFFFF);
  const starInst = new THREE.InstancedMesh(starGeo, starMat, 200);
  const mat4 = new THREE.Matrix4();
  for (let s = 0; s < 200; s++) {
    const sx2 = (Math.random() - 0.5) * 400;
    const sy  = 20 + Math.random() * 80;
    const sz  = Math.random() * L;
    mat4.makeTranslation(sx2, sy, sz);
    starInst.setMatrixAt(s, mat4);
  }
  starInst.instanceMatrix.needsUpdate = true;
  group.add(starInst);
}

export function buildMoonMission() {
  const L = 300, W = 13, H = 30;
  return buildRaceCourse({
    name: 'MOON MISSION',
    L, W, H,
    clear: 0x05060F, fog: 0x0B1024,
    terrainColor: 0x14233A, edgeColor: SP_PALETTE.floor2, gridColor: 0x2FAE6A,
    backdrop: 'moon',
    heightFn: (z) => { const u = z / L; return u * H + Math.sin(u * Math.PI * 4) * 2; },
    candles: false, tramps: 4,
    pits: [
      { z0: L * 0.20, z1: L * 0.28 }, { z0: L * 0.38, z1: L * 0.46 },
      { z0: L * 0.60, z1: L * 0.68 }, { z0: L * 0.78, z1: L * 0.84 },
    ],
    movers: [
      { z: L * 0.24, x0: -7, x1: 7, sp: 0.8, color: SP_PALETTE.floor1 },
      { z: L * 0.42, x0: 7, x1: -7, sp: 0.7, color: SP_PALETTE.terrain },
      { z: L * 0.64, x0: -6, x1: 6, w: 3.5, d: 4, sp: 1.0, color: SP_PALETTE.floor1 },
      { z: L * 0.81, x0: 6, x1: -6, w: 3.5, d: 4, sp: 1.1, color: SP_PALETTE.terrain },
    ],
    pendulums: [
      { z: L * 0.33, amp: 1.0, sp: 1.5 }, { z: L * 0.52, amp: 1.2, sp: 1.8 },
      { z: L * 0.72, amp: 1.1, sp: 2.0 }, { z: L * 0.90, amp: 1.3, sp: 2.4 },
    ],
    sweepers: [{ z: L * 0.15, sp: 2.0 }, { z: L * 0.55, sp: -2.5 }, { z: L * 0.88, sp: 3.0 }],
    finishText: 'MOON LANDED',
    killY: -45,
    buildDecor,
  });
}
