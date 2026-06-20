// ============================================================
// STUMBLE PUMP — Waiting Platform (Lobby)
// Hexagonal floating platform with order-book shader floor.
// Players roam freely, emote, idle. Bots drop in until 32/32.
// Minimal map contract (no finishZ/spawnPoints/checkActor).
// ============================================================
import * as THREE from 'three';
import { scene, renderer } from '../core/Engine.js';
import { lambertMat, basicMat, makeBackdrop } from '../core/AssetFactory.js';
import {
  clearScene, setSynthwaveBackground, makeGridFloor, makeMoons,
  makeOrbs, makeMountains, makeOrderBookFloor, makeNeonPoles,
  makeFloatingCandles, makeBuilding, makeBuildingCluster,
} from './env.js';
import { SFX } from '../core/AudioManager.js';

export function buildLobby() {
  clearScene(); setSynthwaveBackground();
  const group = new THREE.Group(); scene.add(group);
  group.add(makeBackdrop('menu_bg', { radius: 200, height: 160, y: 40 }));

  const floor = makeOrderBookFloor(26); floor.position.y = -0.5; group.add(floor);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(27, 28, 3, 6), lambertMat(0x4A90D9));
  base.position.y = -2.5; base.receiveShadow = true; group.add(base);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(26.5, 0.3, 8, 48), lambertMat(0xFF6B35));
  edge.rotation.x = -Math.PI / 2; edge.position.y = -0.05; group.add(edge);
  group.add(makeNeonPoles(25));
  group.add(makeGridFloor(400, -7));
  group.add(makeMoons());
  group.add(makeMountains(-90, 0x6BB077));
  const orbs = makeOrbs(50, 50, 1); group.add(orbs);
  makeFloatingCandles(group, 60, 30, 18);

  // ring of buildings
  const palette = [0xFF6B35, 0xFBBF24, 0x22C55E, 0x3B82F6, 0xEC4899, 0x8B5CF6];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const b = makeBuilding({ w: 5, d: 5, h: 10 + (i % 3) * 4, color: palette[i], roofColor: palette[(i + 2) % 6], roofType: ['cone', 'pyramid', 'dome', 'flat'][i % 4], winColor: 0xFBBF24 });
    b.position.set(Math.cos(a) * 55, 0, Math.sin(a) * 55); b.rotation.y = -a;
    group.add(b);
  }
  group.add(makeBuildingCluster(0, -120, 8, 30, palette));

  // ambient rising coin sparks
  let coinTimer = 0;

  return {
    type: 'lobby', group, killY: -30, solidObstacles: [],
    groundHeightAt(x, z) { return (x * x + z * z < 25 * 25) ? 0 : null; },
    isWall(x, z) { return (x * x + z * z >= 25 * 25); },
    onFell(a) {
      a.pos.set((Math.random() - 0.5) * 8, 6, (Math.random() - 0.5) * 8);
      a.vel.set(0, 0, 0);
    },
    update(dt, t) {
      floor.userData.update(t);
      orbs.userData.update(t);
      coinTimer -= dt;
      if (coinTimer <= 0) {
        coinTimer = 0.3;
        // visual only — handled by FX in MatchState if needed
      }
    },
    dispose() { scene.remove(group); },
  };
}
