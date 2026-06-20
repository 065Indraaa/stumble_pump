// ============================================================
// STUMBLE PUMP — Liquidation Lane (Race map config)
// Theme: Crypto liquidation — red danger rails, lava pots,
//   liquidation bar meters, falling "REKT" signs
// ============================================================
import * as THREE from 'three';
import { lambertMat, basicMat } from '../core/AssetFactory.js';
import { SP_PALETTE } from '../config/constants.js';
import { buildRaceCourse } from './raceCourse.js';

/**
 * Themed decorations: danger railings, lava pots, liquidation health bars,
 * skull/REKT warning signs — all dripping tension.
 */
function buildDecor(group, L, W, heightFn) {
  const DANGER_RED   = 0xCC2222;
  const LAVA_RED     = 0xFF4400;
  const DARK_ROCK    = 0x3A2020;
  const WARNING_YLW  = SP_PALETTE.floor2;
  const SAFE_GREEN   = SP_PALETTE.terrain;

  // ----- Danger railings along both sides of track -----
  // Alternating red/yellow hazard-stripe posts every 8 units
  for (let z = 10; z < L - 10; z += 8) {
    const baseY = heightFn(z);
    for (const sx of [-1, 1]) {
      const x = sx * (W - 0.5);

      // Post
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.2, 2.5, 6),
        lambertMat(z % 16 === 0 ? WARNING_YLW : DANGER_RED)
      );
      post.position.set(x, baseY + 1.25, z);
      post.castShadow = true; group.add(post);

      // Cap on post
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 8, 6),
        basicMat(z % 16 === 0 ? DANGER_RED : WARNING_YLW)
      );
      cap.position.set(x, baseY + 2.65, z);
      group.add(cap);
    }
  }

  // ----- Horizontal hazard rail connecting posts -----
  // One solid rail per side at height 1.8
  for (const sx of [-1, 1]) {
    const railPts = [];
    for (let i = 0; i <= 20; i++) {
      const z = (i / 20) * (L - 20) + 10;
      railPts.push(new THREE.Vector3(sx * (W - 0.5), heightFn(z) + 1.8, z));
    }
    const railCurve = new THREE.CatmullRomCurve3(railPts);
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(railCurve, 60, 0.1, 6, false),
      lambertMat(DANGER_RED)
    );
    group.add(rail);
  }

  // ----- Lava Pots (decorative caldrons outside track) -----
  const lavaPotPositions = [
    { z: L * 0.12, sx: -1 }, { z: L * 0.12, sx: 1 },
    { z: L * 0.30, sx: -1 }, { z: L * 0.30, sx: 1 },
    { z: L * 0.50, sx: -1 }, { z: L * 0.50, sx: 1 },
    { z: L * 0.68, sx: -1 }, { z: L * 0.68, sx: 1 },
    { z: L * 0.86, sx: -1 }, { z: L * 0.86, sx: 1 },
  ];
  for (const lp of lavaPotPositions) {
    const baseY = heightFn(lp.z);
    const x = lp.sx * (W + 4);
    const potGroup = new THREE.Group();
    potGroup.position.set(x, baseY, lp.z);

    // Tripod legs
    for (let l = 0; l < 3; l++) {
      const la = (l / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.15, 2.5, 6),
        lambertMat(DARK_ROCK)
      );
      leg.position.set(Math.cos(la) * 1.2, 1.0, Math.sin(la) * 1.2);
      leg.rotation.z = Math.cos(la) * 0.35;
      leg.rotation.x = Math.sin(la) * 0.35;
      potGroup.add(leg);
    }

    // Cauldron body
    const cauldron = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.7),
      lambertMat(0x4A3030)
    );
    cauldron.position.y = 2.2;
    cauldron.rotation.x = Math.PI;
    potGroup.add(cauldron);

    // Lava surface (glowing orange disc inside cauldron)
    const lavaDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 12),
      basicMat(LAVA_RED)
    );
    lavaDisc.rotation.x = -Math.PI / 2;
    lavaDisc.position.y = 2.4;
    potGroup.add(lavaDisc);

    // Lava bubbles (small spheres on surface)
    for (let b = 0; b < 4; b++) {
      const ba = b / 4 * Math.PI * 2;
      const bubble = new THREE.Mesh(
        new THREE.SphereGeometry(0.18 + Math.sin(ba) * 0.08, 6, 5),
        basicMat(LAVA_RED)
      );
      bubble.position.set(Math.cos(ba) * 0.7, 2.55, Math.sin(ba) * 0.7);
      potGroup.add(bubble);
    }

    group.add(potGroup);
  }

  // ----- Liquidation Bar Meters (health-bar style warning props) -----
  // Vertical bars like a liquidation percentage meter on each side
  const meterPositions = [L * 0.20, L * 0.45, L * 0.70, L * 0.92];
  for (let i = 0; i < meterPositions.length; i++) {
    const z = meterPositions[i];
    const baseY = heightFn(z);
    const sx = i % 2 === 0 ? -1 : 1;
    const x = sx * (W + 3);

    const meterGroup = new THREE.Group();
    meterGroup.position.set(x, baseY, z);

    // Frame
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 8.5, 0.4),
      lambertMat(0x2A1A1A)
    );
    frame.position.y = 4.25; meterGroup.add(frame);

    // Fill (percentage drops as you get further into level)
    const fillPct = Math.max(0.05, 1 - (i / meterPositions.length) * 0.95);
    const fillH = 7.5 * fillPct;
    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, fillH, 0.45),
      lambertMat(fillPct > 0.5 ? SAFE_GREEN : fillPct > 0.2 ? WARNING_YLW : DANGER_RED)
    );
    fill.position.y = 0.5 + fillH / 2; meterGroup.add(fill);

    // "LIQ %" label plate
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.8, 0.3),
      lambertMat(DANGER_RED)
    );
    plate.position.y = 9.2; meterGroup.add(plate);

    group.add(meterGroup);
  }

  // ----- REKT warning skull signs (billboard frames at bad spots) -----
  const rektPositions = [L * 0.22, L * 0.48, L * 0.75];
  for (const z of rektPositions) {
    const baseY = heightFn(z);
    const signGroup = new THREE.Group();
    signGroup.position.set(0, baseY + 7, z);

    // Sign board
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(6, 2.5, 0.3),
      lambertMat(WARNING_YLW)
    );
    signGroup.add(board);

    // Diagonal hazard stripes on board
    for (let s = -2; s <= 2; s++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 2.6, 0.35),
        lambertMat(DANGER_RED)
      );
      stripe.position.x = s * 1.1;
      stripe.rotation.z = Math.PI / 5;
      signGroup.add(stripe);
    }

    // Sign pole
    const signPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 7.5, 6),
      lambertMat(0x4A3030)
    );
    signPole.position.y = -3.75;
    signGroup.add(signPole);

    group.add(signGroup);
  }
}

export function buildLiquidationLane() {
  const L = 260, W = 11, H = 16;
  return buildRaceCourse({
    name: 'LIQUIDATION LANE',
    L, W, H,
    clear: 0x1A0A0A, fog: 0x3A1208,
    terrainColor: 0x3A1208, edgeColor: 0xCC2222, gridColor: 0x2FAE6A,
    backdrop: 'liquidation',
    heightFn: (z) => { const u = z / L; return H * (1 - u) + Math.sin(u * Math.PI * 5) * 2.5; },
    candles: true, tramps: 3, lava: true,
    pits: [
      { z0: L * 0.18, z1: L * 0.26 }, { z0: L * 0.35, z1: L * 0.43 },
      { z0: L * 0.52, z1: L * 0.60 }, { z0: L * 0.70, z1: L * 0.78 },
      { z0: L * 0.85, z1: L * 0.92 },
    ],
    movers: [
      { z: L * 0.22, x0: -6, x1: 6, w: 3, d: 3.5, sp: 1.0, color: SP_PALETTE.terrain },
      { z: L * 0.39, x0: 6, x1: -6, w: 3, d: 3.5, sp: 1.1, color: SP_PALETTE.terrain },
      { z: L * 0.56, x0: -5, x1: 5, w: 3, d: 3.5, sp: 1.2, color: SP_PALETTE.terrain },
      { z: L * 0.74, x0: 5, x1: -5, w: 3, d: 3.5, sp: 1.3, color: SP_PALETTE.terrain },
      { z: L * 0.89, x0: -4, x1: 4, w: 3, d: 3.5, sp: 1.4, color: SP_PALETTE.terrain },
    ],
    sweepers: [{ z: L * 0.30, sp: 2.6 }, { z: L * 0.48, sp: -3.0 }, { z: L * 0.65, sp: 3.2 }, { z: L * 0.82, sp: -3.5 }],
    pendulums: [{ z: L * 0.45, amp: 1.1, sp: 2.0 }, { z: L * 0.80, amp: 1.2, sp: 2.4 }],
    finishText: 'SURVIVED',
    killY: -30,
    buildDecor,
  });
}
