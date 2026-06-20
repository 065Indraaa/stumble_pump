// ============================================================
// STUMBLE PUMP — Bright Playground (Lobby)
// Hexagonal floating platform, bright colors, party vibe.
// ============================================================
import * as THREE from 'three';
import { scene, renderer } from '../core/Engine.js';
import { lambertMat, basicMat, metalMat, toonMat } from '../core/AssetFactory.js';
import {
  clearScene, makeMoons, makeOrbs, makeMountains, makeFloatingCandles,
  make3DClouds, makeFloatingIslands, make3DTileFloor
} from './env.js';
import { SP_PALETTE } from '../config/constants.js';

export function buildLobby() {
  clearScene();
  // Clear to soft sky and matching fog
  renderer.setClearColor(SP_PALETTE.sky);
  scene.fog = new THREE.Fog(SP_PALETTE.fog, 80, 250);
  const group = new THREE.Group(); scene.add(group);
  
  // Real 3D Sky Elements
  group.add(make3DClouds(30, 180, 50));
  group.add(makeFloatingIslands(10, 150));

  // Main 3D Tile Platform
  const floorHeightFn = () => -1;
  const floor = make3DTileFloor(16, 16, 4, floorHeightFn, SP_PALETTE.floor1, SP_PALETTE.floor2);
  group.add(floor);

  // Soft bumper edge (Stumble Guys style padding)
  const edgeGeo = new THREE.TorusGeometry(28, 1.2, 16, 48);
  const edgeMat = toonMat(SP_PALETTE.edge); // soft orange/yellow bumper
  const edge = new THREE.Mesh(edgeGeo, edgeMat);
  edge.rotation.x = -Math.PI / 2; edge.position.y = 0; edge.receiveShadow = true; group.add(edge);

  // Decorative trampolines/bumpers around the edge
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const bump = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.5, 16), toonMat(SP_PALETTE.terrain));
    bump.position.set(Math.cos(a) * 22, 0.25, Math.sin(a) * 22);
    bump.receiveShadow = true; bump.castShadow = true;
    group.add(bump);
  }

  // Floating props (abstract coins/stars)
  const orbs = makeOrbs(40, 50, 4); group.add(orbs);

  let coinTimer = 0;

  return {
    type: 'lobby', group, killY: -30, solidObstacles: [],
    groundHeightAt(x, z) { return (x * x + z * z < 28 * 28) ? 0 : null; },
    isWall(x, z) { return (x * x + z * z >= 28 * 28); },
    onFell(a) {
      a.pos.set((Math.random() - 0.5) * 8, 6, (Math.random() - 0.5) * 8);
      a.vel.set(0, 0, 0);
    },
    update(dt, t) {
      if (orbs && orbs.userData.update) orbs.userData.update(t);
      coinTimer -= dt;
      if (coinTimer <= 0) {
        coinTimer = 0.3;
      }
    },
    dispose() { scene.remove(group); },
  };
}
