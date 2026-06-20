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
  const geo = new THREE.PlaneGeometry(260, 50, 40, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setY(i, Math.abs(Math.sin(x * 0.05)) * 8 + Math.random() * 2);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, lambertMat(color));
  m.position.set(0, 5, z);
  return m;
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
  // pump.fun building palette — rich, saturated, dark-on-navy reads well
  const color = opts.color ?? 0x1D3934;
  const roofColor = opts.roofColor ?? 0x5FCB88;
  const roofType = opts.roofType ?? 'cone';
  const winColor = opts.winColor ?? 0xFFD23F;
  const accent = opts.accent ?? 0x5FCB88;
  const g = new THREE.Group();

  // ---- stone base + beveled corner trim (sits wider than body) ----
  const baseMat = lambertMat(0x232636);
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 1.2, d + 0.8), baseMat);
  base.position.y = 0.6; base.castShadow = true; base.receiveShadow = true; g.add(base);
  const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(w + 1.0, 0.35, d + 1.0), lambertMat(0x11141F));
  baseTrim.position.y = 0.2; g.add(baseTrim);
  // corner quoins (instanced cubes) — authored detail at building corners
  const quoinGeo = new THREE.BoxGeometry(0.3, 0.6, 0.3);
  const quoinMat = lambertMat(0x3A3F55);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const q = new THREE.Mesh(quoinGeo, quoinMat);
    q.position.set(sx * (w / 2 + 0.35), 0.6, sz * (d / 2 + 0.35));
    g.add(q);
  }

  // ---- main body (saturated pump.fun facade) ----
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambertMat(color));
  body.position.y = 1.2 + h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);

  // ---- window grid via InstancedMesh (front + back faces, efficient) ----
  const cols = Math.max(2, Math.floor(w / 1.4));
  const rows = Math.max(2, Math.floor(h / 1.4));
  const winW = (w / cols) * 0.55, winH = (h / rows) * 0.55;
  const winGeo = new THREE.BoxGeometry(winW, winH, 0.08);
  // warm gold windows (mild emissive so they read as "lit" — NOT bloom-heavy)
  const winMat = new THREE.MeshStandardMaterial({ color: winColor, emissive: 0xFFB820, emissiveIntensity: 0.45, roughness: 0.35, metalness: 0.3 });
  // front face windows
  const totalFront = cols * rows;
  const frontInst = new THREE.InstancedMesh(winGeo, winMat, totalFront);
  const m = new THREE.Matrix4();
  let idx = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const wx = -w / 2 + (c + 0.5) * (w / cols);
    const wy = 1.2 + (r + 0.5) * (h / rows);
    m.makeTranslation(wx, wy, d / 2 + 0.04);
    frontInst.setMatrixAt(idx++, m);
  }
  frontInst.instanceMatrix.needsUpdate = true;
  g.add(frontInst);
  // back face windows (reuse same instanced mesh via clone with flip)
  const backInst = frontInst.clone();
  backInst.material = winMat;
  let bidx = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const wx = -w / 2 + (c + 0.5) * (w / cols);
    const wy = 1.2 + (r + 0.5) * (h / rows);
    m.makeTranslation(wx, wy, -(d / 2 + 0.04));
    m.scale(new THREE.Vector3(1, 1, 1));
    backInst.setMatrixAt(bidx++, m);
  }
  backInst.instanceMatrix.needsUpdate = true;
  g.add(backInst);

  // ---- side windows (left + right) so building isn't a flat slab ----
  const sCols = Math.max(2, Math.floor(d / 1.4));
  const swW = (d / sCols) * 0.5, swH = winH;
  const sideWinGeo = new THREE.BoxGeometry(0.08, swH, swW);
  const sideInstL = new THREE.InstancedMesh(sideWinGeo, winMat, sCols * rows);
  const sideInstR = new THREE.InstancedMesh(sideWinGeo, winMat, sCols * rows);
  let si = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < sCols; c++) {
    const sx = -d / 2 + (c + 0.5) * (d / sCols);
    const sy = 1.2 + (r + 0.5) * (h / rows);
    m.makeTranslation(-w / 2 - 0.04, sy, sx); sideInstL.setMatrixAt(si, m);
    m.makeTranslation(w / 2 + 0.04, sy, sx); sideInstR.setMatrixAt(si, m);
    si++;
  }
  sideInstL.instanceMatrix.needsUpdate = true; sideInstR.instanceMatrix.needsUpdate = true;
  g.add(sideInstL, sideInstR);

  // ---- storefront: pump.fun mint awning + sign panel + door ----
  const awn = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.18, 1.1), lambertMat(accent));
  awn.position.set(0, 2.0, d / 2 + 0.45); g.add(awn);
  // awning stripes (alternating color slats) for visual richness
  const stripeMat = lambertMat(0x11141F);
  for (let i = -2; i <= 2; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 1.2), stripeMat);
    slat.position.set(i * (w * 0.18), 2.0, d / 2 + 0.5); g.add(slat);
  }
  const awnSupportL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), lambertMat(0x3A3F55));
  awnSupportL.position.set(-w * 0.4, 1.5, d / 2 + 0.55); g.add(awnSupportL);
  const awnSupportR = awnSupportL.clone(); awnSupportR.position.x = w * 0.4; g.add(awnSupportR);
  // sign panel above door (mint accent plaque)
  const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.35, 0.08), lambertMat(0x11141F));
  sign.position.set(0, 2.55, d / 2 + 0.06); g.add(sign);
  const signDot = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16), basicMat(0xA3E635));
  signDot.position.set(-w * 0.18, 2.55, d / 2 + 0.11); g.add(signDot);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.7, 0.1), lambertMat(0x0B0E1A));
  doorFrame.position.set(0, 0.9, d / 2 + 0.03); g.add(doorFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.04), lambertMat(0x2FAE6A));
  door.position.set(0, 0.85, d / 2 + 0.08); g.add(door);
  const doorKnob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), metalMat(0xFFD23F, 0.9, 0.2));
  doorKnob.position.set(0.22, 0.85, d / 2 + 0.12); g.add(doorKnob);

  // ---- rooftop detail varies by type ----
  const roofY = 1.2 + h;
  let roof;
  if (roofType === 'cone') {
    roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, h * 0.42, 4), lambertMat(roofColor));
    roof.rotation.y = Math.PI / 4; roof.position.y = roofY + h * 0.18;
  } else if (roofType === 'pyramid') {
    roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, h * 0.38, 4), lambertMat(roofColor));
    roof.rotation.y = Math.PI / 4; roof.position.y = roofY + h * 0.16;
  } else if (roofType === 'dome') {
    roof = new THREE.Mesh(new THREE.SphereGeometry(w * 0.55, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), lambertMat(roofColor));
    roof.position.y = roofY;
  } else { // flat roof — parapet + rooftop clutter
    roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.5, d + 0.3), lambertMat(roofColor));
    roof.position.y = roofY + 0.2;
  }
  roof.castShadow = true; g.add(roof);

  // rooftop props for flat/dome (AC unit, antenna, water tank)
  if (roofType === 'flat' || roofType === 'dome') {
    // AC unit box
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.0), lambertMat(0x6B7387));
    ac.position.set(w * 0.2, roofY + 0.7, -d * 0.1); ac.castShadow = true; g.add(ac);
    // antenna
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), lambertMat(0x3A3F55));
    ant.position.set(-w * 0.25, roofY + 1.3, d * 0.2); g.add(ant);
    const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), basicMat(0xFF5151));
    antTip.position.set(-w * 0.25, roofY + 2.4, d * 0.2); g.add(antTip);
    // water tank (cylinder)
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 0.9, 10), lambertMat(0x4F8CFF));
    tank.position.set(w * 0.3, roofY + 0.9, d * 0.25); g.add(tank);
  }

  // ---- vertical accent stripe down one corner (color-coded) ----
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, h * 0.85, 0.18), lambertMat(accent));
  stripe.position.set(w / 2 - 0.12, 1.2 + h / 2, d / 2 - 0.12); g.add(stripe);

  if (opts.flag) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), lambertMat(0x6B7387));
    pole.position.y = roofY + 1.5; g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6), basicMat(0x5FCB88));
    flag.position.set(0.5, roofY + 2.5, 0); g.add(flag);
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
  const cloudMat = lambertMat(0xFFFFFF); // fluffy white clouds
  const geo = new THREE.SphereGeometry(1, 12, 12);
  
  for (let i = 0; i < count; i++) {
    const cloud = new THREE.Group();
    const numPuffs = 4 + Math.floor(Math.random() * 4);
    for(let j=0; j<numPuffs; j++) {
      const puff = new THREE.Mesh(geo, cloudMat);
      const s = 5 + Math.random() * 8;
      puff.scale.set(s, s * 0.6, s);
      puff.position.set((Math.random()-0.5)*s, (Math.random()-0.5)*s*0.3, (Math.random()-0.5)*s);
      cloud.add(puff);
    }
    const a = Math.random() * Math.PI * 2;
    const r = radius * 0.4 + Math.random() * radius * 0.6;
    cloud.position.set(Math.cos(a) * r, heightY + Math.random() * 30, Math.sin(a) * r);
    cloud.rotation.y = Math.random() * Math.PI;
    group.add(cloud);
  }
  return group;
}

export function makeFloatingIslands(count = 8, radius = 180) {
  const group = new THREE.Group();
  const islandMat = lambertMat(0x5FCB88); // Mint green grass top
  const dirtMat = lambertMat(0x8B5A2B); // dirt bottom
  
  for (let i=0; i<count; i++) {
    const island = new THREE.Group();
    // top grass
    const top = new THREE.Mesh(new THREE.CylinderGeometry(8, 7.5, 2, 8), islandMat);
    top.position.y = 1;
    top.castShadow = true; top.receiveShadow = true;
    island.add(top);
    // bottom dirt cone
    const bot = new THREE.Mesh(new THREE.ConeGeometry(7.5, 12, 8), dirtMat);
    bot.position.y = -6;
    bot.rotation.x = Math.PI;
    island.add(bot);
    
    const a = Math.random() * Math.PI * 2;
    const r = radius * 0.5 + Math.random() * radius * 0.5;
    island.position.set(Math.cos(a) * r, 20 + Math.random() * 50, Math.sin(a) * r);
    group.add(island);
  }
  return group;
}

export function make3DTileFloor(w, l, tileSize, heightFn, color1 = 0x4A90E2, color2 = 0xFFD23F, pits = []) {
  const widthTiles = Math.ceil((w * 2) / tileSize);
  const lengthTiles = Math.ceil(l / tileSize);
  
  // Create a slight gap so they look like individual blocks
  const actualSize = tileSize - 0.05;
  const tileGeo = new THREE.BoxGeometry(actualSize, tileSize * 0.8, actualSize);
  
  // High quality shiny material for tiles (Stumble Guys vibe)
  const mat1 = metalMat(color1, 0.2, 0.4); 
  const mat2 = metalMat(color2, 0.2, 0.4); 
  
  // Allocate extra space since we loop from -2 to lengthTiles + 2
  const maxTiles = widthTiles * (lengthTiles + 6);
  const inst1 = new THREE.InstancedMesh(tileGeo, mat1, maxTiles);
  const inst2 = new THREE.InstancedMesh(tileGeo, mat2, maxTiles);
  inst1.castShadow = true; inst1.receiveShadow = true;
  inst2.castShadow = true; inst2.receiveShadow = true;
  
  const m = new THREE.Matrix4();
  let idx1 = 0, idx2 = 0;
  
  const wOffset = (widthTiles * tileSize) / 2;
  
  for (let z = -2; z <= lengthTiles + 2; z++) { // Overlap ends slightly
    for (let x = 0; x < widthTiles; x++) {
      const worldZ = z * tileSize;
      const worldX = x * tileSize - wOffset + (tileSize/2);
      
      // Check if this tile falls inside any pit
      let inPit = false;
      for (const p of pits) {
        if (worldZ > p.z0 - tileSize * 0.5 && worldZ < p.z1 + tileSize * 0.5) {
          inPit = true;
          break;
        }
      }
      if (inPit) continue;

      // Floor Y is exactly at heightFn, block center is offset by half its height
      const worldY = heightFn(worldZ) - (tileSize * 0.4); 
      
      m.makeTranslation(worldX, worldY, worldZ);
      if ((x + z) % 2 === 0) {
        inst1.setMatrixAt(idx1++, m);
      } else {
        inst2.setMatrixAt(idx2++, m);
      }
    }
  }
  inst1.count = idx1; inst2.count = idx2;
  inst1.instanceMatrix.needsUpdate = true;
  inst2.instanceMatrix.needsUpdate = true;
  
  const group = new THREE.Group();
  group.add(inst1, inst2);
  return group;
}
