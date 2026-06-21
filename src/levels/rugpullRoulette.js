// ============================================================
// STUMBLE PUMP — Rugpull Roulette (Survival map)
// 7x7 grid of hex platforms. Every few seconds 1-5 platforms
// flash red, then drop permanently. Progressive difficulty.
// Coins spawn on random platforms. Last-half survive.
// ============================================================
import * as THREE from 'three';
import { scene, renderer } from '../core/Engine.js';
import { lambertMat, basicMat } from '../core/AssetFactory.js';
import { clearScene, make3DClouds, makeFloatingIslands, makeGroundDisc, makeHillsRing, makeForestScatter, makeSkyDome } from './env.js';
import { makeHexPlatform, warnPlatform, updateHexPlatform } from '../entities/HexPlatform.js';
import { SFX } from '../core/AudioManager.js';
import { SP_PALETTE } from '../config/constants.js';

export function buildRugpull() {
  clearScene();
  renderer.setClearColor(SP_PALETTE.sky);
  scene.fog = new THREE.Fog(SP_PALETTE.fog, 55, 200);
  const group = new THREE.Group(); scene.add(group);
  // Themed playful skydome (mint→blue gradient) for the rug casino
  scene.add(makeSkyDome('rugpull'));
  group.add(make3DClouds(20, 150, 45));
  group.add(makeFloatingIslands(8, 125));
  // distant rolling hills ring fills the horizon
  group.add(makeHillsRing(115, 18));

  // ---- Ground world below the floating arena (no empty void) ----
  // The hex platforms hover above a solid grass world ringed by forest, so
  // when a player falls they drop toward real scenery, not empty space.
  group.add(makeGroundDisc(120, SP_PALETTE.terrain, SP_PALETTE.dirt));
  group.add(makeForestScatter(55, 110, 35791));

  // arena ring
  const arenaRing = new THREE.Mesh(new THREE.TorusGeometry(28, 0.4, 12, 64), lambertMat(SP_PALETTE.terrain));
  arenaRing.rotation.x = -Math.PI / 2; arenaRing.position.y = -0.5; group.add(arenaRing);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1), lambertMat(SP_PALETTE.wall));
    wall.position.set(Math.cos(a) * 28, 1, Math.sin(a) * 28);
    wall.rotation.y = -a + Math.PI / 2; wall.castShadow = true; group.add(wall);
    // accent cap
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.3, 1.05), lambertMat(SP_PALETTE.edge));
    cap.position.set(Math.cos(a) * 28, 2.5, Math.sin(a) * 28);
    cap.rotation.y = -a + Math.PI / 2; group.add(cap);
  }
  // ── THEMED DECOR: Rug Casino ─────────────────────────────────────────
  // Instead of generic buildings: giant roulette wheel centrepiece above arena,
  // coin stack towers around ring, casino cage at cardinal points, warning lights.

  // Giant rug-wheel on 4 SOLID SUPPORT PILLARS (not hovering in the air)
  // Pillars stand from Y=0 up to Y=14 where the wheel sits
  const WHEEL_Y = 14;
  const PILLAR_H = WHEEL_Y;        // from floor to wheel centre
  const PILLAR_R = 18;             // radius of pillar ring
  for (let p = 0; p < 4; p++) {
    const pa = (p / 4) * Math.PI * 2;
    const px2 = Math.cos(pa) * PILLAR_R, pz2 = Math.sin(pa) * PILLAR_R;
    // Shaft: base at Y=0, centre at PILLAR_H/2
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.5, PILLAR_H, 10),
      lambertMat(0x555566)
    );
    shaft.position.set(px2, PILLAR_H / 2, pz2);
    shaft.castShadow = true; group.add(shaft);
    // Capital at top flush with wheel
    const cap2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.4, 0.6, 10),
      lambertMat(SP_PALETTE.floor2)
    );
    cap2.position.set(px2, PILLAR_H + 0.3, pz2);
    group.add(cap2);
  }

  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(0, WHEEL_Y, 0);
  group.add(wheelGroup);

  // Wheel disc
  const wheelDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 0.6, 24),
    lambertMat(0x1A1A2E)
  );
  wheelDisc.castShadow = true; wheelGroup.add(wheelDisc);

  // Wheel segments (alternating red/green like roulette)
  for (let s = 0; s < 12; s++) {
    const a = (s / 12) * Math.PI * 2;
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.7, 7),
      lambertMat(s % 2 === 0 ? SP_PALETTE.lava : SP_PALETTE.terrain)
    );
    seg.position.set(Math.cos(a + Math.PI / 12) * 4.5, 0.65, Math.sin(a + Math.PI / 12) * 4.5);
    seg.rotation.y = -(a + Math.PI / 12);
    wheelGroup.add(seg);
  }

  // Wheel rim ring
  const wheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(9, 0.4, 8, 32),
    lambertMat(SP_PALETTE.floor2)
  );
  wheelRim.rotation.x = -Math.PI / 2; wheelGroup.add(wheelRim);

  // Wheel hub
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 1.2, 12),
    lambertMat(SP_PALETTE.edge)
  );
  hub.position.y = 0.9; wheelGroup.add(hub);

  // Cross spokes (4 solid beams from hub to rim)
  for (let sp = 0; sp < 4; sp++) {
    const sa = (sp / 4) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.4, 8),
      lambertMat(0x888898)
    );
    spoke.rotation.y = sa;
    wheelGroup.add(spoke);
  }

  // ----- Coin stack towers (4 cardinal points outside ring) -----
  const coinStackPositions = [
    { a: 0 }, { a: Math.PI / 2 }, { a: Math.PI }, { a: Math.PI * 1.5 }
  ];
  for (const cs of coinStackPositions) {
    const csr = 36;
    const cx = Math.cos(cs.a) * csr, cz = Math.sin(cs.a) * csr;
    const towerGroup = new THREE.Group();
    towerGroup.position.set(cx, 0, cz);
    group.add(towerGroup);

    // Stack of coins (10 coins, each slightly different radius for organic look)
    const coinH = 0.5;
    for (let ci = 0; ci < 10; ci++) {
      const coinMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.8 - ci * 0.04, 1.8 - ci * 0.04, coinH, 16),
        lambertMat(SP_PALETTE.floor2)
      );
      coinMesh.position.y = ci * (coinH + 0.05) + coinH / 2;
      coinMesh.castShadow = true; towerGroup.add(coinMesh);

      // Rim edge on every other coin
      if (ci % 2 === 0) {
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(1.8 - ci * 0.04, 0.08, 6, 16),
          lambertMat(SP_PALETTE.edge)
        );
        rim.rotation.x = -Math.PI / 2;
        rim.position.y = ci * (coinH + 0.05) + coinH;
        towerGroup.add(rim);
      }
    }
  }

  // ----- Warning signal lights (8 poles around arena) -----
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const lr = 31.5;
    const lx = Math.cos(a) * lr, lz = Math.sin(a) * lr;

    // Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.18, 6, 6),
      lambertMat(0x444455)
    );
    pole.position.set(lx, 3, lz); pole.castShadow = true; group.add(pole);

    // Light head
    const lightColor = i % 2 === 0 ? SP_PALETTE.lava : SP_PALETTE.floor2;
    const lightHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 10, 8),
      basicMat(lightColor)
    );
    lightHead.position.set(lx, 6.6, lz); group.add(lightHead);

    // Light hood
    const hood = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 0.6, 8),
      lambertMat(0x222233)
    );
    hood.position.set(lx, 7.3, lz); group.add(hood);
  }

  // 7x7 platform grid — pastel platform colors
  const plats = [];
  const N = 7, gap = 6.5;
  const platColors = [SP_PALETTE.floor1, SP_PALETTE.floor2, SP_PALETTE.terrain, SP_PALETTE.edge];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = (i - (N - 1) / 2) * gap, z = (j - (N - 1) / 2) * gap;
    const col = platColors[(i + j) % platColors.length];
    const p = makeHexPlatform(x, z, col);
    group.add(p.grp); plats.push(p);
  }

  // coins — gold coins
  const coins = [];
  for (let i = 0; i < 8; i++) {
    const p = plats[Math.floor(Math.random() * plats.length)];
    if (p.state !== 'idle') continue;
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 16), lambertMat(SP_PALETTE.edge));
    coin.material.emissive = new THREE.Color(SP_PALETTE.edge); coin.material.emissiveIntensity = 0.5;
    coin.position.set(p.x, 1.5, p.z); coin.rotation.x = Math.PI / 2; group.add(coin);
    coins.push({ mesh: coin, px: p.x, pz: p.z, collected: false, spin: 0 });
  }

  let rugTimer = 4;
  let waveNum = 0;

  function safeTargetFor(a) {
    let best = null, bd = 1e9;
    for (const p of plats) {
      if (p.state !== 'idle') continue;
      const d = (p.x - a.pos.x) ** 2 + (p.z - a.pos.z) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best ? { x: best.x, z: best.z } : null;
  }

  return {
    type: 'survival', group, killY: -18, qualifyTarget: 0, surviveTime: 60,
    spawnPoints: plats.slice(0, 32).map((p) => new THREE.Vector3(p.x, 2, p.z)),
    solidObstacles: [],
    groundHeightAt(x, z) {
      for (const p of plats) {
        if (p.state === 'falling' || p.state === 'gone') continue;
        const dx = x - p.x, dz = z - p.z;
        if (dx * dx + dz * dz < 2.6 * 2.6) return p.baseY + 0.3;
      }
      return null;
    },
    onFell(a) {
      if (!a.eliminated) { a.eliminated = true; a.dead = true; }
      a.root.visible = false;
    },
    safeTargetFor,
    checkActor(a) {
      for (const c of coins) {
        if (c.collected) continue;
        const dx = a.pos.x - c.px, dz = a.pos.z - c.pz;
        if (dx * dx + dz * dz < 1.5 && Math.abs(a.pos.y - 1.5) < 2) {
          c.collected = true; c.mesh.visible = false;
          if (a.isPlayer) SFX.coin();
        }
      }
    },
    update(dt, t) {
      arenaRing.rotation.z += 0.002;
      // Slowly spin the giant roulette wheel
      wheelGroup.rotation.y += 0.004;
      coins.forEach((c) => {
        if (!c.collected) { c.spin += dt * 3; c.mesh.rotation.z = c.spin; c.mesh.position.y = 1.5 + Math.sin(t * 2 + c.spin) * 0.2; }
      });
      rugTimer -= dt;
      if (rugTimer <= 0) {
        waveNum++;
        const elapsed = 60 - (this._timerRef || 60);
        const intensity = Math.min(5, 1 + Math.floor(elapsed / 12));
        rugTimer = Math.max(0.8, 3.5 - elapsed * 0.04);
        for (let n = 0; n < intensity; n++) {
          const live = plats.filter((p) => p.state === 'idle');
          if (live.length > 6) warnPlatform(live[Math.floor(Math.random() * live.length)], Math.max(0.8, 1.8 - elapsed * 0.01));
        }
      }
      for (const p of plats) updateHexPlatform(p, dt);
    },
    set timerRef(v) { this._timerRef = v; },
    dispose() { scene.remove(group); },
  };
}
