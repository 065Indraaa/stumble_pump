// ============================================================
// STUMBLE PUMP — Lobby (Waiting Room)
// Structured circular arena plaza. No floating coins.
// All geometry is solid, precise, non-clipping.
// ============================================================
import * as THREE from 'three';
import { scene, renderer } from '../core/Engine.js';
import { lambertMat, metalMat } from '../core/AssetFactory.js';
import { clearScene, make3DClouds, makeFloatingIslands, makeGroundDisc, makeHillsRing, makeForestScatter, makeBannerArch, makeFenceRing, makeSkyDome } from './env.js';
import { SP_PALETTE } from '../config/constants.js';

// ── Geometry helpers ──────────────────────────────────────────────────────
function addBox(parent, w, h, d, color, x = 0, y = 0, z = 0, ry = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    lambertMat(color)
  );
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}
function addCyl(parent, rt, rb, h, seg, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, seg),
    lambertMat(color)
  );
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}

export function buildLobby() {
  clearScene();
  renderer.setClearColor(SP_PALETTE.lobbySky);
  scene.fog = new THREE.Fog(SP_PALETTE.lobbyFog, 90, 280);
  const group = new THREE.Group(); scene.add(group);

  // ── SKY ────────────────────────────────────────────────────────────────
  // Real atmospheric skydome (gradient sphere) instead of a flat clear color.
  scene.add(makeSkyDome('lobby'));
  group.add(make3DClouds(20, 160, 55));
  group.add(makeFloatingIslands(8, 130));
  // distant rolling hills ring fills the horizon
  group.add(makeHillsRing(110, 18));

  // ── WORLD GROUND (solid grass disc under the arena — no floating void) ─
  group.add(makeGroundDisc(110, SP_PALETTE.terrain, SP_PALETTE.dirt));
  // forest scattered between the arena wall and the hills
  group.add(makeForestScatter(46, 100, 24680));

  // ── ARENA DIMENSIONS ────────────────────────────────────────────────────
  const ARENA_R = 26;       // playable circle radius
  const TILE    = 4;        // tile size
  const TILE_H  = 1.2;     // tile height — top surface must be exactly Y=0
  const TILE_Y  = -(TILE_H / 2); // center so top = 0

  // ── CHECKERBOARD TILE FLOOR ────────────────────────────────────────────
  const mat1 = metalMat(SP_PALETTE.floor1, 0.15, 0.5);
  const mat2 = metalMat(SP_PALETTE.floor2, 0.15, 0.5);
  const tileGeo = new THREE.BoxGeometry(TILE - 0.1, TILE_H, TILE - 0.1);
  const COLS = 14, ROWS = 14;
  const maxTiles = COLS * ROWS;
  const inst1 = new THREE.InstancedMesh(tileGeo, mat1, maxTiles);
  const inst2 = new THREE.InstancedMesh(tileGeo, mat2, maxTiles);
  inst1.receiveShadow = true; inst2.receiveShadow = true;
  let i1 = 0, i2 = 0;
  const m4 = new THREE.Matrix4();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const wx = (c - COLS / 2 + 0.5) * TILE;
      const wz = (r - ROWS / 2 + 0.5) * TILE;
      if (wx * wx + wz * wz > ARENA_R * ARENA_R) continue; // only inside circle
      m4.makeTranslation(wx, TILE_Y, wz);
      if ((r + c) % 2 === 0) inst1.setMatrixAt(i1++, m4);
      else inst2.setMatrixAt(i2++, m4);
    }
  }
  inst1.count = i1; inst2.count = i2;
  inst1.instanceMatrix.needsUpdate = true;
  inst2.instanceMatrix.needsUpdate = true;
  group.add(inst1, inst2);

  // ── CENTER HEX PAD (decorative raised disc, characters spawn here) ──────
  // Top of disc exactly flush with floor Y=0
  const PAD_H = 0.35;
  const hexPad = new THREE.Mesh(
    new THREE.CylinderGeometry(5.5, 5.5, PAD_H, 6),
    metalMat(SP_PALETTE.terrain, 0.2, 0.5)
  );
  hexPad.position.y = PAD_H / 2; // bottom at 0, top at 0.35 — just a thin raised pad
  hexPad.castShadow = true; hexPad.receiveShadow = true;
  group.add(hexPad);

  // Hex pad edge ring — sits right on top of pad surface
  const hexRim = new THREE.Mesh(
    new THREE.TorusGeometry(5.5, 0.14, 8, 6),
    lambertMat(SP_PALETTE.floor2)
  );
  hexRim.rotation.x = -Math.PI / 2;
  hexRim.position.y = PAD_H + 0.01; // on top of pad
  group.add(hexRim);

  // ── ARENA WALL SEGMENTS ────────────────────────────────────────────────
  // 16 wall panels around a circle of radius ARENA_R + 1.5
  // Panel bottom at TILE_Y (flush with floor bottom), top at Y=4
  const WALL_R    = ARENA_R + 1.5;
  const PANEL_W   = 10.8;   // chord width for 16 panels
  const PANEL_BOT = TILE_Y; // bottom of panel aligns with bottom of floor tiles
  const PANEL_H   = 4.0 - PANEL_BOT; // total height so top is at Y=4
  const PANEL_CY  = PANEL_BOT + PANEL_H / 2; // center Y
  const SEGS      = 16;
  const panelColors = [SP_PALETTE.terrain, SP_PALETTE.edge];

  for (let i = 0; i < SEGS; i++) {
    const a   = (i / SEGS) * Math.PI * 2;
    const wx  = Math.cos(a) * WALL_R;
    const wz  = Math.sin(a) * WALL_R;
    const col = panelColors[i % 2];

    // Main panel body
    const panel = addBox(group, PANEL_W, PANEL_H, 1.0, col, wx, PANEL_CY, wz, -a + Math.PI / 2);

    // Cap stripe on top (sits directly on top of panel — no gap, no overlap)
    addBox(group, PANEL_W, 0.4, 1.05, SP_PALETTE.floor2, wx, PANEL_CY + PANEL_H / 2 + 0.2, wz, -a + Math.PI / 2);
  }

  // Outer backing torus (solid ring that fills the gap between panels)
  const torusBack = new THREE.Mesh(
    new THREE.TorusGeometry(WALL_R, 0.55, 8, 48),
    lambertMat(SP_PALETTE.wall)
  );
  torusBack.rotation.x = -Math.PI / 2;
  torusBack.position.y = PANEL_CY;
  group.add(torusBack);

  // ── BANNER POLES (4 poles at diagonal compass points, inside wall) ──────
  const bannerColors = [SP_PALETTE.terrain, SP_PALETTE.edge, SP_PALETTE.floor1, SP_PALETTE.floor2];
  const POLE_H = 7.0;
  const POLE_Y_CENTER = POLE_H / 2; // base at Y=0, top at POLE_H

  for (let i = 0; i < 4; i++) {
    const a  = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const pr = WALL_R - 2.0;
    const px = Math.cos(a) * pr;
    const pz = Math.sin(a) * pr;

    // Pole shaft — base at Y=0 so it stands on the floor
    addCyl(group, 0.14, 0.14, POLE_H, 8, 0xB0B0C0, px, POLE_Y_CENTER, pz);

    // Banner (solid box, not a transparent plane)
    addBox(group, 1.8, 2.6, 0.15, bannerColors[i], px, POLE_H - 1.1, pz);
  }

  // ── SPECTATOR STANDS (4 grandstands outside wall ring) ─────────────────
  // Each stand: base bottom at Y = TILE_Y (same depth as floor), no clipping
  const standPalette = [SP_PALETTE.floor1, SP_PALETTE.terrain, SP_PALETTE.edge, SP_PALETTE.floor2];
  for (let i = 0; i < 4; i++) {
    const a  = (i / 4) * Math.PI * 2;
    const sr = WALL_R + 10;
    const sx = Math.cos(a) * sr;
    const sz = Math.sin(a) * sr;
    const ry = -a + Math.PI / 2;

    // Base block — base at Y = TILE_Y, top at Y = 4
    const STAND_H = 4.0;
    const stand = addBox(group, 18, STAND_H, 5, standPalette[i], sx, TILE_Y + STAND_H / 2, sz, ry);

    // 3 stepped risers as children of stand so they rotate with it
    const RISER_H = 0.7;
    const RISER_D = 1.5;
    for (let step = 0; step < 3; step++) {
      const riser = new THREE.Mesh(
        new THREE.BoxGeometry(18, RISER_H, RISER_D),
        lambertMat(step % 2 === 0 ? SP_PALETTE.floor2 : SP_PALETTE.floor1)
      );
      // Each riser stacks cleanly: bottom edge of lowest = top of stand base
      riser.position.set(0, STAND_H / 2 + RISER_H / 2 + step * RISER_H, -RISER_D * (step - 1));
      riser.castShadow = true; riser.receiveShadow = true;
      stand.add(riser);
    }
  }

  // ── BANNER ARCHES inside the arena (2 cheer gates flanking the spawn) ──
  const archN = makeBannerArch(16, 8, SP_PALETTE.edge, SP_PALETTE.floor2);
  archN.position.set(0, 0, -16);
  group.add(archN);
  const archS = makeBannerArch(16, 8, SP_PALETTE.terrain, SP_PALETTE.floor1);
  archS.position.set(0, 0, 16);
  archS.rotation.y = Math.PI;
  group.add(archS);

  // (The decorative fence ring was removed — it clipped through the spectator
  // stands at the cardinal points. The arena wall + stands already read as a
  // solid boundary.)

  // ── PLAYABLE CONTRACT ──────────────────────────────────────────────────
  return {
    type: 'lobby',
    group,
    killY: -30,
    solidObstacles: [],
    groundHeightAt(x, z) {
      // The whole circle is solid ground. The center hex pad (r<5.5) is a
      // raised podium — return its top (PAD_H) so characters stand ON it,
      // not clipping through it.
      const r2 = x * x + z * z;
      if (r2 > ARENA_R * ARENA_R) return null;
      if (r2 < 5.5 * 5.5) return PAD_H;   // on the raised pad
      return 0;                            // main floor
    },
    isWall(x, z) {
      return (x * x + z * z >= ARENA_R * ARENA_R);
    },
    onFell(a) {
      a.pos.set((Math.random() - 0.5) * 8, 4, (Math.random() - 0.5) * 8);
      a.vel.set(0, 0, 0);
    },
    update(dt, t) {
      // animate the procedural clouds + islands for a living sky
      for (const child of group.children) {
        if (typeof child.userData?.update === 'function') child.userData.update(t);
      }
    },
    dispose() { scene.remove(group); },
  };
}
