// ============================================================
// STUMBLE PUMP — Bonding Curve Climb (Race map config)
// Theme: Crypto candlestick charts, rising bonding curve, pump.fun logo
// ============================================================
import * as THREE from 'three';
import { lambertMat, basicMat } from '../core/AssetFactory.js';
import { SP_PALETTE } from '../config/constants.js';
import { buildRaceCourse } from './raceCourse.js';

/**
 * Themed decorations: giant 3D crypto candlestick chart pillars along both sides.
 * The chart "pumps" from flat at start to sky-high at end — mirroring the sigmoid.
 */
function buildDecor(group, L, W, heightFn) {
  // ----- Candlestick chart pillars (outside the track on both sides) -----
  const CANDLE_SPACING = 24;
  const SIDE_OFFSET = W + 5;
  const candleHeights = [3, 5, 4, 8, 6, 12, 9, 15, 11, 18, 14, 20]; // pumping chart

  for (let i = 0; i < candleHeights.length; i++) {
    const z = 20 + i * CANDLE_SPACING;
    if (z > L - 20) break;
    const cH = candleHeights[i % candleHeights.length];
    const isGreen = i % 3 !== 0; // mostly green (pumping)
    const color = isGreen ? SP_PALETTE.terrain : SP_PALETTE.lava;
    const groundY = heightFn(z);

    for (const sx of [-1, 1]) {
      const x = sx * SIDE_OFFSET;
      // Candle body (box)
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, cH, 3.5),
        lambertMat(color)
      );
      body.position.set(x, groundY + cH / 2, z);
      body.castShadow = true; body.receiveShadow = true;
      group.add(body);

      // Wick top
      const wickH = cH * 0.4;
      const wickTop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, wickH, 6),
        lambertMat(color)
      );
      wickTop.position.set(x, groundY + cH + wickH / 2, z);
      group.add(wickTop);

      // Wick bottom
      const wickBotH = cH * 0.25;
      const wickBot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, wickBotH, 6),
        lambertMat(color)
      );
      wickBot.position.set(x, groundY - wickBotH / 2, z);
      group.add(wickBot);

      // Candle top cap (highlight)
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.3, 3.6),
        lambertMat(isGreen ? 0x7EEEC7 : 0xFF7777)
      );
      cap.position.set(x, groundY + cH + 0.15, z);
      group.add(cap);
    }
  }

  // ----- "PUMP" banner arches over the track at key moments -----
  const archPositions = [L * 0.25, L * 0.5, L * 0.75];
  const archLabels = ['BUY', 'PUMP', 'MOON'];
  for (let i = 0; i < archPositions.length; i++) {
    const z = archPositions[i];
    const baseY = heightFn(z);
    const archH = 10;

    // Left pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, archH, 8),
      lambertMat(SP_PALETTE.edge)
    );
    // Right pole
    for (const sx of [-1, 1]) {
      const p = pole.clone();
      p.position.set(sx * (W + 0.5), baseY + archH / 2, z);
      p.castShadow = true; group.add(p);
    }

    // Crossbar
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(W * 2 + 1, 0.9, 0.9),
      lambertMat(SP_PALETTE.floor2)
    );
    bar.position.set(0, baseY + archH, z);
    bar.castShadow = true; group.add(bar);

    // Pennant triangles hanging from bar
    for (let p = -3; p <= 3; p += 2) {
      const pennant = new THREE.Mesh(
        new THREE.ConeGeometry(0.6, 1.4, 3),
        lambertMat(p % 4 === 0 ? SP_PALETTE.terrain : SP_PALETTE.floor1)
      );
      pennant.rotation.z = Math.PI;
      pennant.position.set(p * 1.8, baseY + archH - 1.2, z);
      group.add(pennant);
    }
  }

  // ----- Rocket at finish line -----
  const finZ = L - 15;
  const rocketBase = heightFn(finZ);
  const rocketGroup = new THREE.Group();
  rocketGroup.position.set(0, rocketBase, finZ);

  // Body cylinder
  const rBody = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 2, 12, 12),
    lambertMat(0xE0E8F0)
  );
  rBody.position.y = 7; rBody.castShadow = true; rocketGroup.add(rBody);

  // Nose cone
  const rNose = new THREE.Mesh(
    new THREE.ConeGeometry(1.8, 4, 12),
    lambertMat(SP_PALETTE.terrain)
  );
  rNose.position.y = 15; rNose.castShadow = true; rocketGroup.add(rNose);

  // Fins (4 fins, evenly placed)
  for (let f = 0; f < 4; f++) {
    const a = (f / 4) * Math.PI * 2;
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 3.5, 2.5),
      lambertMat(SP_PALETTE.edge)
    );
    fin.position.set(Math.cos(a) * 2.1, 2.5, Math.sin(a) * 2.1);
    fin.rotation.y = a;
    fin.castShadow = true; rocketGroup.add(fin);
  }

  // Pump.fun logo ring around rocket
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(5, 0.3, 8, 24),
    lambertMat(SP_PALETTE.floor2)
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 1; rocketGroup.add(ring);

  group.add(rocketGroup);

  // ----- Chart line along left wall (decorative tube) -----
  const chartPts = [];
  for (let i = 0; i <= 20; i++) {
    const u = i / 20;
    const z2 = u * L;
    const chartH = heightFn(z2) + 5 + Math.pow(u, 1.5) * 15;
    chartPts.push(new THREE.Vector3(-(W + 3), chartH, z2));
  }
  const chartCurve = new THREE.CatmullRomCurve3(chartPts);
  const chartTube = new THREE.Mesh(
    new THREE.TubeGeometry(chartCurve, 60, 0.25, 8, false),
    lambertMat(SP_PALETTE.terrain)
  );
  chartTube.castShadow = true; group.add(chartTube);
}

export function buildBondingCurve() {
  const L = 280, W = 14, H = 24;
  return buildRaceCourse({
    name: 'BONDING CURVE CLIMB',
    L, W, H,
    clear: 0x87CEFA, fog: 0xE0F6FF,
    terrainColor: SP_PALETTE.terrain, edgeColor: SP_PALETTE.floor2, gridColor: 0xFFFFFF,
    backdrop: 'bonding',
    heightFn: (z) => {
      const u = z / L;
      return H / (1 + Math.exp(-(u - 0.5) * 11)) + Math.sin(u * Math.PI * 5) * 1.2;
    },
    candles: true, tramps: 7,
    sweepers: [
      { z: L * 0.25, sp: 1.7 }, { z: L * 0.42, sp: -2.1 }, { z: L * 0.58, sp: 2.4 },
      { z: L * 0.72, sp: -2.8 }, { z: L * 0.85, sp: 3.0 },
    ],
    pendulums: [
      { z: L * 0.35, x: 0, amp: 0.8, sp: 1.4 },
      { z: L * 0.65, x: 2, amp: 0.9, sp: 1.7 },
      { z: L * 0.80, x: -2, amp: 0.9, sp: 1.9 },
    ],
    pits: [{ z0: L * 0.50, z1: L * 0.56 }],
    movers: [{ z: L * 0.53, x0: -8, x1: 8, w: 4, d: 5, sp: 0.9, color: 0x4F8CFF }],
    finishText: 'TO THE MOON',
    killY: -40,
    buildDecor,
  });
}
