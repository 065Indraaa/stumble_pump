// ============================================================
// STUMBLE PUMP — Rugpull Roulette (Survival map)
// 7x7 grid of hex platforms. Every few seconds 1-5 platforms
// flash red, then drop permanently. Progressive difficulty.
// Coins spawn on random platforms. Last-half survive.
// ============================================================
import * as THREE from 'three';
import { scene, renderer } from '../core/Engine.js';
import { lambertMat, basicMat } from '../core/AssetFactory.js';
import { clearScene, setSynthwaveBackground, makeGridFloor, makeMoons, makeOrbs, makeBuilding, make3DClouds, makeFloatingIslands } from './env.js';
import { makeHexPlatform, warnPlatform, updateHexPlatform } from '../entities/HexPlatform.js';
import { SFX } from '../core/AudioManager.js';
import { SP_PALETTE } from '../config/constants.js';

export function buildRugpull() {
  clearScene(); 
  renderer.setClearColor(SP_PALETTE.sky);
  scene.fog = new THREE.Fog(SP_PALETTE.fog, 50, 150);
  const group = new THREE.Group(); scene.add(group);
  group.add(make3DClouds(20, 140, 40));
  group.add(makeFloatingIslands(8, 120));
  group.add(makeGridFloor(320, -22, SP_PALETTE.grass));
  group.add(makeMoons());
  const orbs = makeOrbs(30, 50, 6); group.add(orbs);

  // void floor
  const voidFloor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), lambertMat(SP_PALETTE.wall));
  voidFloor.rotation.x = -Math.PI / 2; voidFloor.position.y = -20; group.add(voidFloor);

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
  // buildings around arena — pastel palette
  const bPalette = [SP_PALETTE.floor1, SP_PALETTE.edge, SP_PALETTE.terrain, SP_PALETTE.floor2, SP_PALETTE.wall];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const bx = Math.cos(a) * 42, bz = Math.sin(a) * 42;
    const bh = 7 + (i % 3) * 4;
    const b = makeBuilding({ w: 5, d: 5, h: bh, color: bPalette[i % 5], roofColor: bPalette[(i + 2) % 5], roofType: ['cone', 'pyramid', 'dome', 'flat'][i % 4], winColor: SP_PALETTE.edge });
    b.position.set(bx, 0, bz); b.rotation.y = -a; group.add(b);
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
      orbs.userData.update(t);
      arenaRing.rotation.z += 0.002;
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
