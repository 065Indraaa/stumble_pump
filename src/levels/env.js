// ============================================================
// STUMBLE PUMP — Environment helpers (decor + buildings)
// Procedural scenery: grid floor, moons, orbs, mountains,
// neon poles, order-book shader floor, buildings, candles, chart line.
// ============================================================
import * as THREE from 'three';
import { scene, renderer } from '../core/Engine.js';
import { lambertMat, basicMat, toonMat, metalMat } from '../core/AssetFactory.js';

/** Remove every scene child except the lights owned by Engine. */
export function clearScene() {
  const keep = new Set(['DirectionalLight', 'AmbientLight', 'HemisphereLight']);
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const c = scene.children[i];
    if (keep.has(c.type)) continue;
    scene.remove(c);
  }
}

export function setSynthwaveBackground() {
  renderer.setClearColor(0x7DD3F0);
  scene.fog = new THREE.Fog(0xA8E6F5, 80, 260);
}

export function makeGridFloor(size = 400, y = -6, color = 0x88CCEE) {
  const grid = new THREE.GridHelper(size, 40, 0xffffff, 0xB0E0E6);
  grid.position.y = y;
  grid.material.opacity = 0.5; grid.material.transparent = true;
  return grid;
}

export function makeMoons() {
  const g = new THREE.Group();
  const positions = [[-40, 26, -90, 14], [55, 34, -110, 11], [10, 46, -130, 9]];
  positions.forEach(([x, y, z, r]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), basicMat(0xffffff));
    m.position.set(x, y, z); m.scale.y = 0.6;
    g.add(m);
  });
  return g;
}

export function makeOrbs(count = 50, range = 40, yBase = 2) {
  const palette = [0xFF6B35, 0xFBBF24, 0x22C55E, 0x3B82F6, 0xEC4899, 0x8B5CF6];
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

export function makeMountains(z = -80, color = 0x6BB077) {
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

/** Hex order-book shader floor (lobby centerpiece). */
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
        // moving bars (order book rows)
        float bars = step(0.5, fract(vUv.y*14.0 - uTime*0.2));
        vec3 green = vec3(0.13,0.80,0.36); vec3 red = vec3(0.93,0.27,0.27);
        vec3 col = mix(red, green, bars);
        col *= (1.0 - gg*0.7);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.update = (t) => { uniforms.uTime.value = t; };
  return mesh;
}

export function makeNeonPoles(radius = 29) {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 8), metalMat(0x60a5fa, 0.6, 0.3));
    pole.position.set(Math.cos(a) * radius, 4, Math.sin(a) * radius);
    g.add(pole);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), basicMat(0x60a5fa));
    cap.position.set(Math.cos(a) * radius, 8.2, Math.sin(a) * radius);
    g.add(cap);
  }
  return g;
}

export function makeBuilding(opts = {}) {
  const w = opts.w ?? 6, d = opts.d ?? 6, h = opts.h ?? 10;
  const color = opts.color ?? 0xFF6B35;
  const roofColor = opts.roofColor ?? 0xE0531C;
  const roofType = opts.roofType ?? 'cone';
  const winColor = opts.winColor ?? 0xFBBF24;
  const g = new THREE.Group();
  // base
  const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 1, d + 0.6), lambertMat(0x64748b));
  base.position.y = 0.5; base.castShadow = true; base.receiveShadow = true; g.add(base);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.3, d + 0.7), lambertMat(0x475569));
  trim.position.y = 0.2; g.add(trim);
  // body
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambertMat(color));
  body.position.y = 1 + h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
  // window grid on each face
  const winMat = basicMat(winColor);
  const cols = Math.max(1, Math.floor(w / 1.5));
  const rows = Math.max(1, Math.floor(h / 1.5));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const wx = -w / 2 + (c + 0.5) * (w / cols);
    const wy = 1 + (r + 0.5) * (h / rows);
    const wz = d / 2 + 0.01;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w / cols * 0.6, h / rows * 0.6), winMat);
    win.position.set(wx, wy, wz); g.add(win);
    const win2 = win.clone(); win2.position.z = -wz; win2.rotation.y = Math.PI; g.add(win2);
  }
  // door
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.4), lambertMat(0x1e293b));
  door.position.set(0, 0.7, d / 2 + 0.02); g.add(door);
  // roof
  let roof;
  if (roofType === 'cone') roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.7, h * 0.4, 4), lambertMat(roofColor));
  else if (roofType === 'pyramid') roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.7, h * 0.4, 4), lambertMat(roofColor));
  else if (roofType === 'dome') roof = new THREE.Mesh(new THREE.SphereGeometry(w * 0.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambertMat(roofColor));
  else roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.6, d + 0.4), lambertMat(roofColor));
  roof.position.y = 1 + h + (roofType === 'flat' ? 0.3 : h * 0.2);
  if (roofType === 'cone' || roofType === 'pyramid') roof.rotation.y = Math.PI / 4;
  roof.castShadow = true; g.add(roof);
  if (opts.flag) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), lambertMat(0x94a3b8));
    pole.position.y = 1 + h + h * 0.4 + 1.5; g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6), basicMat(0xff6b35));
    flag.position.set(0.5, 1 + h + h * 0.4 + 2.5, 0); g.add(flag);
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
      roofType: types[i % types.length], winColor: 0xFBBF24,
    });
    b.position.set(centerX + Math.cos(a) * r, 0, centerZ + Math.sin(a) * r);
    b.rotation.y = Math.random() * Math.PI;
    g.add(b);
  }
  return g;
}

export function makeFloatingCandles(group, L, W, count) {
  const matUp = basicMat(0x22C55E), matDn = basicMat(0xEF4444);
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
