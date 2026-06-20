// ============================================================
// STUMBLE PUMP — Environment helpers (decor + buildings)
// Procedural scenery: grid floor, moons, orbs, mountains,
// neon poles, order-book shader floor, buildings, candles, chart line.
// ============================================================
import * as THREE from 'three';
import { scene, renderer } from '../core/Engine.js';
import { lambertMat, basicMat, toonMat, metalMat } from '../core/AssetFactory.js';
import { SP_PALETTE } from '../config/constants.js';

/** Remove every scene child except the lights owned by Engine. */
export function clearScene() {
  const keep = new Set(['DirectionalLight', 'AmbientLight', 'HemisphereLight']);
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const c = scene.children[i];
    if (keep.has(c.type)) continue;
    scene.remove(c);
  }
}

/** pump.fun dark navy clear + atmospheric fog (tinted by caller). */
export function setSynthwaveBackground(clear = 0x0B0E1A, fog = 0x14233A) {
  renderer.setClearColor(clear);
  scene.fog = new THREE.Fog(fog, 80, 280);
}

/** Mint-tinted grid floor (pump.fun tech-grid vibe, glow-free). */
export function makeGridFloor(size = 400, y = -6, color = 0x2FAE6A) {
  const grid = new THREE.GridHelper(size, 40, 0x5FCB88, color);
  grid.material.opacity = 0.35; grid.material.transparent = true;
  grid.position.y = y;
  return grid;
}

/** Mint-tinted "moons" (now pump.fun coin orbs in the sky). */
export function makeMoons() {
  const g = new THREE.Group();
  const positions = [[-40, 26, -90, 14], [55, 34, -110, 11], [10, 46, -130, 9]];
  positions.forEach(([x, y, z, r]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), basicMat(0xA3E635));
    m.position.set(x, y, z); m.scale.y = 0.6;
    g.add(m);
    // soft mint halo ring (flat torus, no emissive bloom)
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.15, r * 1.35, 40), basicMat(0x5FCB88));
    ring.position.copy(m.position); ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.random() * Math.PI;
    ring.material.transparent = true; ring.material.opacity = 0.18;
    g.add(ring);
  });
  return g;
}

export function makeOrbs(count = 50, range = 40, yBase = 2) {
  const palette = [SP_PALETTE.floor1, SP_PALETTE.floor2, SP_PALETTE.edge, SP_PALETTE.terrain, SP_PALETTE.cloud];
  const g = new THREE.Group();
  const orbs = [];
  for (let i = 0; i < count; i++) {
    const r = 0.12;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), basicMat(palette[i % palette.length]));
    m.position.set((Math.random() - 0.5) * range * 2, yBase + Math.random() * 6, (Math.random() - 0.5) * range * 2);
    m.userData.phase = Math.random() * Math.PI * 2;
    m.userData.baseY = m.position.y;
    g.add(m); orbs.push(m);
  }
  g.userData.update = (t) => { orbs.forEach((o) => { o.position.y = o.userData.baseY + Math.sin(t * 0.8 + o.userData.phase) * 0.5; o.rotation.y = t * 0.3; }); };
  return g;
}

export function makeMountains(z = -80, color = 0x1D3934) {
  const g = new THREE.Group();
  // Six distinct cone mountains evenly spaced from X=-130 to X=+130
  const xPositions = [-130, -78, -26, 26, 78, 130];
  const baseRadii  = [18, 21, 24, 20, 22, 19];
  const heights    = [20, 28, 38, 32, 25, 22];

  for (let i = 0; i < 6; i++) {
    const r = baseRadii[i] + i * 1.5;
    const h = heights[i] + i * 2;
    // Main mountain cone — 8-sided for a chunky low-poly silhouette
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 8),
      lambertMat(color)
    );
    // Base of cone sits exactly at Y=0: center is at h/2
    cone.position.set(xPositions[i], h / 2, z);
    cone.castShadow = true;
    g.add(cone);

    // Snow cap — smaller white cone sitting on the peak
    const capH = h * 0.22;
    const capR = r * 0.32;
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(capR, capH, 8),
      lambertMat(SP_PALETTE.cloud)
    );
    // Peak of main cone is at h/2 + h/2 = h from ground.
    // Cap center is at peak - capH/2 so cap bottom meets peak.
    cap.position.set(xPositions[i], h - capH / 2, z);
    g.add(cap);
  }
  return g;
}

/** Hex order-book shader floor (lobby centerpiece). pump.fun green/red orderbook. */
export function makeOrderBookFloor(radius = 30) {
  const geo = new THREE.CylinderGeometry(radius, radius, 1, 6);
  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv;
      float grid(vec2 p, float w){ vec2 g = abs(fract(p)-0.5); return step(w, min(g.x,g.y)); }
      void main(){
        vec2 p = vUv * 12.0;
        float gg = grid(p + vec2(0.0, uTime*0.4), 0.06);
        float bars = step(0.5, fract(vUv.y*14.0 - uTime*0.2));
        vec3 green = vec3(0.37,0.80,0.53); vec3 red = vec3(1.0,0.32,0.32);
        vec3 col = mix(red, green, bars);
        col *= (1.0 - gg*0.7);
        // darken toward edges for depth
        float vig = smoothstep(0.85, 0.15, length(vUv-0.5));
        col *= 0.55 + 0.45*vig;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.update = (t) => { uniforms.uTime.value = t; };
  return mesh;
}

/** Mint-tipped marker poles around lobby perimeter (no glow). */
export function makeNeonPoles(radius = 29) {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 8), metalMat(0x4F8CFF, 0.5, 0.4));
    pole.position.set(Math.cos(a) * radius, 4, Math.sin(a) * radius);
    g.add(pole);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), basicMat(0xA3E635));
    cap.position.set(Math.cos(a) * radius, 8.2, Math.sin(a) * radius);
    g.add(cap);
  }
  return g;
}

export function makeBuilding(opts = {}) {
  const w = opts.w ?? 6, d = opts.d ?? 6, h = opts.h ?? 10;
  const color     = opts.color     ?? SP_PALETTE.wall;
  const roofColor = opts.roofColor ?? SP_PALETTE.terrain;
  const roofType  = opts.roofType  ?? 'cone';
  const winColor  = opts.winColor  ?? SP_PALETTE.floor2;
  const accent    = opts.accent    ?? SP_PALETTE.terrain;
  const g = new THREE.Group();

  // ----------------------------------------------------------------
  // BASE — height 1.5, bottom at Y=0, center at Y=0.75
  // ----------------------------------------------------------------
  const BASE_H = 1.5;
  const baseMat = lambertMat(0x232636);
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, BASE_H, d + 0.8), baseMat);
  base.position.y = BASE_H / 2; // 0.75 → bottom at Y=0
  base.castShadow = true; base.receiveShadow = true;
  g.add(base);

  // Thin trim lip at very bottom
  const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(w + 1.0, 0.35, d + 1.0), lambertMat(0x11141F));
  baseTrim.position.y = 0.175; // 0 to 0.35
  g.add(baseTrim);

  // Corner quoins sitting on the base
  const quoinGeo = new THREE.BoxGeometry(0.3, 0.6, 0.3);
  const quoinMat = lambertMat(0x3A3F55);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const q = new THREE.Mesh(quoinGeo, quoinMat);
    // quoin center at Y = BASE_H - 0.3 so it rests on top of base slab
    q.position.set(sx * (w / 2 + 0.35), BASE_H - 0.3, sz * (d / 2 + 0.35));
    g.add(q);
  }

  // ----------------------------------------------------------------
  // MAIN BODY — base bottom = BASE_H, center = BASE_H + h/2
  // ----------------------------------------------------------------
  const bodyY = BASE_H + h / 2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambertMat(color));
  body.position.y = bodyY;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);

  // ----------------------------------------------------------------
  // WINDOWS — grid-based, Z = ±(d/2 + 0.02) for front/back faces
  // ----------------------------------------------------------------
  const cols = Math.max(2, Math.floor(w / 1.4));
  const rows = Math.max(2, Math.floor(h / 1.4));
  const winW = (w / cols) * 0.55;
  const winH = (h / rows) * 0.55;
  const winGeo = new THREE.BoxGeometry(winW, winH, 0.08);
  const winMat = new THREE.MeshStandardMaterial({
    color: winColor, emissive: 0xFFB820,
    emissiveIntensity: 0.45, roughness: 0.35, metalness: 0.3,
  });

  // Front face
  const totalFront = cols * rows;
  const frontInst = new THREE.InstancedMesh(winGeo, winMat, totalFront);
  const m = new THREE.Matrix4();
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = -w / 2 + (c + 0.5) * (w / cols);
      const wy = BASE_H + (r + 0.5) * (h / rows);
      m.makeTranslation(wx, wy, d / 2 + 0.02);
      frontInst.setMatrixAt(idx++, m);
    }
  }
  frontInst.instanceMatrix.needsUpdate = true;
  g.add(frontInst);

  // Back face
  const backInst = frontInst.clone();
  backInst.material = winMat;
  let bidx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = -w / 2 + (c + 0.5) * (w / cols);
      const wy = BASE_H + (r + 0.5) * (h / rows);
      m.makeTranslation(wx, wy, -(d / 2 + 0.02));
      backInst.setMatrixAt(bidx++, m);
    }
  }
  backInst.instanceMatrix.needsUpdate = true;
  g.add(backInst);

  // Side windows (left + right)
  const sCols = Math.max(2, Math.floor(d / 1.4));
  const swW = (d / sCols) * 0.5;
  const sideWinGeo = new THREE.BoxGeometry(0.08, winH, swW);
  const sideInstL = new THREE.InstancedMesh(sideWinGeo, winMat, sCols * rows);
  const sideInstR = new THREE.InstancedMesh(sideWinGeo, winMat, sCols * rows);
  let si = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < sCols; c++) {
      const sx = -d / 2 + (c + 0.5) * (d / sCols);
      const sy = BASE_H + (r + 0.5) * (h / rows);
      m.makeTranslation(-w / 2 - 0.04, sy, sx); sideInstL.setMatrixAt(si, m);
      m.makeTranslation( w / 2 + 0.04, sy, sx); sideInstR.setMatrixAt(si, m);
      si++;
    }
  }
  sideInstL.instanceMatrix.needsUpdate = true;
  sideInstR.instanceMatrix.needsUpdate = true;
  g.add(sideInstL, sideInstR);

  // ----------------------------------------------------------------
  // STOREFRONT (awning, sign, door) — all at ground-floor level
  // ----------------------------------------------------------------
  const awn = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.18, 1.1), lambertMat(accent));
  awn.position.set(0, 2.0, d / 2 + 0.45);
  g.add(awn);
  const stripeMat = lambertMat(0x11141F);
  for (let i = -2; i <= 2; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 1.2), stripeMat);
    slat.position.set(i * (w * 0.18), 2.0, d / 2 + 0.5);
    g.add(slat);
  }
  const awnSupportL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), lambertMat(0x3A3F55));
  awnSupportL.position.set(-w * 0.4, 1.5, d / 2 + 0.55);
  g.add(awnSupportL);
  const awnSupportR = awnSupportL.clone();
  awnSupportR.position.x = w * 0.4;
  g.add(awnSupportR);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.35, 0.08), lambertMat(0x11141F));
  sign.position.set(0, 2.55, d / 2 + 0.06);
  g.add(sign);
  const signDot = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), basicMat(0xA3E635));
  signDot.position.set(-w * 0.18, 2.55, d / 2 + 0.11);
  g.add(signDot);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.7, 0.1), lambertMat(0x0B0E1A));
  doorFrame.position.set(0, 0.9, d / 2 + 0.03);
  g.add(doorFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.04), lambertMat(0x2FAE6A));
  door.position.set(0, 0.85, d / 2 + 0.08);
  g.add(door);
  const doorKnob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), metalMat(0xFFD23F, 0.9, 0.2));
  doorKnob.position.set(0.22, 0.85, d / 2 + 0.12);
  g.add(doorKnob);

  // ----------------------------------------------------------------
  // ROOF — positioned above body top (BASE_H + h)
  // roofH tracks the apex/top of the roof shape
  // ----------------------------------------------------------------
  const roofBase = BASE_H + h; // Y where body top surface is
  let roof;
  let roofApex = roofBase; // will be updated per type

  if (roofType === 'cone') {
    const rh = h * 0.42;
    roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, rh, 4), lambertMat(roofColor));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = roofBase + rh / 2; // bottom of cone at roofBase
    roofApex = roofBase + rh;
  } else if (roofType === 'pyramid') {
    const rh = h * 0.38;
    roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, rh, 4), lambertMat(roofColor));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = roofBase + rh / 2;
    roofApex = roofBase + rh;
  } else if (roofType === 'dome') {
    const rr = w * 0.55;
    roof = new THREE.Mesh(
      new THREE.SphereGeometry(rr, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      lambertMat(roofColor)
    );
    roof.position.y = roofBase; // flat side of hemisphere sits on body top
    roofApex = roofBase + rr;
  } else {
    // flat parapet
    const rh = 0.5;
    roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, rh, d + 0.3), lambertMat(roofColor));
    roof.position.y = roofBase + rh / 2;
    roofApex = roofBase + rh;
  }
  roof.castShadow = true;
  g.add(roof);

  // Rooftop props (flat + dome only) — all placed above roofApex
  if (roofType === 'flat' || roofType === 'dome') {
    // AC unit: bottom at roofApex
    const acH = 0.6;
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.2, acH, 1.0), lambertMat(0x6B7387));
    ac.position.set(w * 0.2, roofApex + acH / 2, -d * 0.1);
    ac.castShadow = true;
    g.add(ac);

    // Antenna: base at roofApex
    const antH = 2.2;
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, antH, 6), lambertMat(0x3A3F55));
    ant.position.set(-w * 0.25, roofApex + antH / 2, d * 0.2);
    g.add(ant);
    const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), basicMat(0xFF5151));
    antTip.position.set(-w * 0.25, roofApex + antH + 0.1, d * 0.2);
    g.add(antTip);

    // Water tank: bottom at roofApex
    const tankH = 0.9;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, tankH, 10), lambertMat(0x4F8CFF));
    tank.position.set(w * 0.3, roofApex + tankH / 2, d * 0.25);
    g.add(tank);
  }

  // ---- Vertical accent stripe on a body corner ----
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, h * 0.85, 0.18), lambertMat(accent));
  stripe.position.set(w / 2 - 0.12, BASE_H + h / 2, d / 2 - 0.12);
  g.add(stripe);

  // ---- Optional flag pole: base at roofApex ----
  if (opts.flag) {
    const poleH = 3.0;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, poleH, 6), lambertMat(0x6B7387));
    pole.position.y = roofApex + poleH / 2;
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6), basicMat(SP_PALETTE.terrain));
    flag.position.set(0.5, roofApex + poleH, 0);
    g.add(flag);
  }
  return g;
}

export function makeBuildingCluster(centerX, centerZ, count, radius, palette) {
  const g = new THREE.Group();
  const types = ['cone', 'pyramid', 'dome', 'flat', 'cone', 'pyramid'];
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    const r = radius * (0.5 + Math.random() * 0.5);
    const b = makeBuilding({
      w: 4 + Math.random() * 3, d: 4 + Math.random() * 3, h: 6 + Math.random() * 8,
      color: palette[i % palette.length], roofColor: palette[(i + 2) % palette.length],
      roofType: types[i % types.length], winColor: 0xFFD23F,
    });
    b.position.set(centerX + Math.cos(a) * r, 0, centerZ + Math.sin(a) * r);
    b.rotation.y = Math.random() * Math.PI;
    g.add(b);
  }
  return g;
}

export function makeFloatingCandles(group, L, W, count) {
  const matUp = basicMat(0x5FCB88), matDn = basicMat(0xFF5151);
  for (let i = 0; i < count; i++) {
    const up = Math.random() > 0.5;
    const h = 1 + Math.random() * 2.5;
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, h, 0.6), up ? matUp : matDn);
    c.position.set((Math.random() - 0.5) * W * 3, 4 + Math.random() * 8, Math.random() * L);
    c.userData.phase = Math.random() * Math.PI * 2;
    c.userData.baseY = c.position.y;
    group.add(c);
  }
}

export function makeChartLine(group, L, W, y0, color) {
  const pts = [];
  for (let i = 0; i < 40; i++) {
    const u = i / 39;
    pts.push(new THREE.Vector3((Math.random() - 0.5) * W * 1.6, y0 + Math.sin(u * Math.PI * 4) * 2 + Math.random(), u * L));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.12, 8, false), basicMat(color));
  tube.renderOrder = -5;
  group.add(tube);
  return tube;
}

export function spawnGrid(n, baseX, baseZ) {
  const pts = [];
  const cols = 8;
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    pts.push(new THREE.Vector3(baseX + (c - cols / 2) * 1.6, 2, baseZ - r * 2 - 2));
  }
  return pts;
}

// ---- 100% Real 3D Procedural Elements ----

export function make3DClouds(count = 25, radius = 200, heightY = 60) {
  const group = new THREE.Group();
  const cloudMat = lambertMat(SP_PALETTE.cloud);
  // Shared unit-sphere geometry; each puff is an independently scaled clone
  const unitGeo = new THREE.SphereGeometry(1, 10, 10);

  // Puff layout relative to cloud-group origin (Y=0 of cloud group)
  // Base puffs spread along XZ, top puffs raised +2 to +4 units
  const PUFF_CONFIGS = [
    { x: 0,    y: 0, z: 0,    sx: 3.5, sy: 2.2, sz: 3.5 },  // centre base
    { x: -2.8, y: 0, z: 0.5,  sx: 2.8, sy: 1.8, sz: 2.8 },  // left base
    { x:  2.8, y: 0, z: 0.5,  sx: 2.8, sy: 1.8, sz: 2.8 },  // right base
    { x:  0.8, y: 0, z:-2.5,  sx: 2.6, sy: 1.6, sz: 2.6 },  // back base
    { x: -0.8, y: 0, z: 2.5,  sx: 2.4, sy: 1.5, sz: 2.4 },  // front base
    { x: 0,    y: 3, z: 0,    sx: 2.2, sy: 2.0, sz: 2.2 },  // centre top
    { x: -1.5, y: 2, z: 0.5,  sx: 1.8, sy: 1.5, sz: 1.8 },  // top-left
  ];

  const cloudGroups = [];

  for (let i = 0; i < count; i++) {
    const cloud = new THREE.Group();

    // Deterministic even angle distribution; slight radius jitter per index
    const angle = (i / count) * Math.PI * 2;
    const rJitter = radius * (0.85 + (i % 3) * 0.075); // subtle radius variation
    const yJitter = (i % 5 - 2) * 5; // ±5 variance only

    // Uniform cluster scale so clouds range 6–12 world units wide, 3–6 tall
    const clusterScale = 0.9 + (i % 4) * 0.25; // 0.9 – 1.65 → ~6–12 wide

    // Determine how many puffs this cloud uses (5 to 7)
    const numPuffs = 5 + (i % 3); // 5, 6 or 7

    for (let j = 0; j < numPuffs; j++) {
      const cfg = PUFF_CONFIGS[j];
      const puff = new THREE.Mesh(unitGeo, cloudMat);
      puff.scale.set(cfg.sx * clusterScale, cfg.sy * clusterScale, cfg.sz * clusterScale);
      puff.position.set(cfg.x * clusterScale, cfg.y * clusterScale, cfg.z * clusterScale);
      cloud.add(puff);
    }

    const baseX = Math.cos(angle) * rJitter;
    const baseZ = Math.sin(angle) * rJitter;
    const baseY = heightY + yJitter;
    cloud.position.set(baseX, baseY, baseZ);

    // Gentle X-drift animation using closure variables
    const capturedI = i;
    const capturedBaseX = baseX;
    cloud.userData.update = (t) => {
      cloud.position.x = capturedBaseX + Math.sin(t * 0.1 + capturedI * 0.8) * 3;
    };

    cloudGroups.push(cloud);
    group.add(cloud);
  }

  // Group-level update calls each cloud's own updater
  group.userData.update = (t) => {
    for (const c of cloudGroups) c.userData.update(t);
  };

  return group;
}

export function makeFloatingIslands(count = 8, radius = 180) {
  const group = new THREE.Group();
  const grassMat = lambertMat(SP_PALETTE.grass);   // 0x5FCB88
  const dirtMat  = lambertMat(SP_PALETTE.dirt);    // 0x8B5A2B
  const trunkMat = lambertMat(SP_PALETTE.dirt);
  const leafMat  = lambertMat(SP_PALETTE.terrain); // 0x5FCB88 darker

  // Geometry constants (shared across all islands)
  const TOP_R = 10, TOP_H = 2;        // flat disk top
  const BOT_R = 9,  BOT_H = 15;       // rocky tapered cone under
  const TRUNK_R = 0.3, TRUNK_H = 2.5; // tree trunk
  const LEAF_R = 2.5;                  // leaf sphere

  const islandGroups = [];

  for (let i = 0; i < count; i++) {
    const island = new THREE.Group();

    // ---- Flat top disk: center at Y=0, so top surface at Y = TOP_H/2 = 1 ----
    const top = new THREE.Mesh(new THREE.CylinderGeometry(TOP_R, TOP_R, TOP_H, 16), grassMat);
    top.position.y = 0; // group-local: top surface at +TOP_H/2 = +1
    top.castShadow = true; top.receiveShadow = true;
    island.add(top);

    // ---- Rocky cone: inverted (point down), attached under the top disk ----
    // Cone center must be at Y = -(TOP_H/2 + BOT_H/2) = -(1 + 7.5) = -8.5
    const bot = new THREE.Mesh(new THREE.ConeGeometry(BOT_R, BOT_H, 10), dirtMat);
    bot.position.y = -(TOP_H / 2 + BOT_H / 2); // -8.5
    bot.rotation.x = Math.PI; // flip so point faces down
    bot.castShadow = true;
    island.add(bot);

    // ---- Tree: trunk base sits on top surface of disk (Y = +TOP_H/2 = +1) ----
    const trunkBase = TOP_H / 2;                       // +1 in island-local space
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(TRUNK_R, TRUNK_R, TRUNK_H, 8),
      trunkMat
    );
    trunk.position.y = trunkBase + TRUNK_H / 2;        // center of trunk
    island.add(trunk);

    // Leaf sphere sits on trunk top
    const leafY = trunkBase + TRUNK_H + LEAF_R;        // center of leaf sphere
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(LEAF_R, 10, 10), leafMat);
    leaves.position.y = leafY;
    island.add(leaves);

    // ---- Deterministic placement: evenly-spaced angles, staggered height ----
    const angle  = (i / count) * Math.PI * 2;
    const rJitter = radius * (0.7 + (i % 4) * 0.075); // radius variation w/o random
    const baseY  = 25 + i * 8;  // stagger Y per island index

    island.position.set(
      Math.cos(angle) * rJitter,
      baseY,
      Math.sin(angle) * rJitter
    );
    // No Y-rotation — islands look odd spinning

    // Gentle Y-bob animation
    const capturedI = i;
    const capturedBaseY = baseY;
    island.userData.update = (t) => {
      island.position.y = capturedBaseY + Math.sin(t * 0.4 + capturedI * 1.2) * 1.5;
    };

    islandGroups.push(island);
    group.add(island);
  }

  // Group-level updater delegates to each island
  group.userData.update = (t) => {
    for (const isl of islandGroups) isl.userData.update(t);
  };

  return group;
}

export function make3DTileFloor(w, l, tileSize, heightFn, color1 = 0x4A90E2, color2 = 0xFFD23F, pits = []) {
  const widthTiles  = Math.ceil((w * 2) / tileSize);
  const lengthTiles = Math.ceil(l / tileSize);

  // Slight inset gap so tiles read as individual blocks
  const actualSize = tileSize - 0.05;

  // Tile height = tileSize * 0.5 (not 0.8 — avoids over-tall blocks)
  const TILE_H = tileSize * 0.5;
  const tileGeo = new THREE.BoxGeometry(actualSize, TILE_H, actualSize);

  const mat1 = metalMat(color1, 0.2, 0.4);
  const mat2 = metalMat(color2, 0.2, 0.4);

  // Extra slots for the border curb tiles (2 rows × widthTiles each)
  const maxTiles = widthTiles * (lengthTiles + 10);
  const inst1 = new THREE.InstancedMesh(tileGeo, mat1, maxTiles);
  const inst2 = new THREE.InstancedMesh(tileGeo, mat2, maxTiles);
  inst1.castShadow = true; inst1.receiveShadow = true;
  inst2.castShadow = true; inst2.receiveShadow = true;

  const m = new THREE.Matrix4();
  let idx1 = 0, idx2 = 0;

  const wOffset = (widthTiles * tileSize) / 2;

  // ---- Helper: place one tile choosing color by checkerboard ----
  const placeTile = (x, z, worldX, worldZ, tH, tW, tD) => {
    // worldY: top surface of tile = heightFn(worldZ)
    // center of tile = heightFn(worldZ) - tH/2
    const worldY = heightFn(worldZ) - (tH / 2);
    const mat4 = new THREE.Matrix4();
    mat4.makeScale(tW / actualSize, tH / TILE_H, tD / actualSize);
    mat4.setPosition(worldX, worldY, worldZ);
    if ((x + z) % 2 === 0) inst1.setMatrixAt(idx1++, mat4);
    else                    inst2.setMatrixAt(idx2++, mat4);
  };

  for (let z = -2; z <= lengthTiles + 2; z++) {
    for (let x = 0; x < widthTiles; x++) {
      const worldZ = z * tileSize;
      const worldX = x * tileSize - wOffset + (tileSize / 2);

      // Pit skip
      let inPit = false;
      for (const p of pits) {
        if (worldZ > p.z0 - tileSize * 0.5 && worldZ < p.z1 + tileSize * 0.5) {
          inPit = true; break;
        }
      }
      if (inPit) continue;

      // ---- Standard interior tile ----
      // worldY: tile center so TOP surface = heightFn(worldZ)
      const worldY = heightFn(worldZ) - (TILE_H / 2);
      m.makeTranslation(worldX, worldY, worldZ);
      if ((x + z) % 2 === 0) inst1.setMatrixAt(idx1++, m);
      else                    inst2.setMatrixAt(idx2++, m);
    }
  }

  inst1.count = idx1; inst2.count = idx2;
  inst1.instanceMatrix.needsUpdate = true;
  inst2.instanceMatrix.needsUpdate = true;

  const group = new THREE.Group();
  group.add(inst1, inst2);

  // ---- Border / curb tiles at Z=0 edge and Z=L edge ----
  // Curb is tileSize*1.1 wide, tileSize*0.6 tall — slightly raised vs interior
  const CURB_H = tileSize * 0.6;
  const CURB_W = tileSize * 1.1;
  const curbGeo = new THREE.BoxGeometry(CURB_W - 0.05, CURB_H, CURB_W - 0.05);
  const curbMat = metalMat(SP_PALETTE.edge, 0.15, 0.5);
  const curbInst = new THREE.InstancedMesh(curbGeo, curbMat, widthTiles * 2);
  curbInst.castShadow = true; curbInst.receiveShadow = true;
  let ci = 0;
  const mc = new THREE.Matrix4();

  for (let x = 0; x < widthTiles; x++) {
    const worldX = x * tileSize - wOffset + (tileSize / 2);

    // Near edge (Z = 0)
    const z0 = 0;
    mc.makeTranslation(worldX, heightFn(z0) - CURB_H / 2, z0);
    curbInst.setMatrixAt(ci++, mc);

    // Far edge (Z = L)
    const zL = l;
    mc.makeTranslation(worldX, heightFn(zL) - CURB_H / 2, zL);
    curbInst.setMatrixAt(ci++, mc);
  }
  curbInst.count = ci;
  curbInst.instanceMatrix.needsUpdate = true;
  group.add(curbInst);

  return group;
}
