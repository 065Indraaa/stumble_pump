// ============================================================
// STUMBLE PUMP — CharacterRig (Chunky Blob Edition)
// Procedural chibi built from Three.js primitives.
// Style: short, wide, glossy vinyl blob (Fall Guys / Among Us vibe)
//   - big head ~50% of torso, sits directly on body (no visible neck)
//   - large glossy bulging eyes (anime sparkle)
//   - stubby capsule limbs, round hands/feet
//   - signature antenna + LED backpack on every skin
//   - 13 KOL skins each get bespoke accessories
//
// CONTRACT (must not change — AnimationController + Actor rely on these):
//   bones: hips, spine, chest, neck, head, l/r_upperarm, l/r_lowerarm,
//          l/r_upperleg, l/r_lowerleg, l/r_hand, l/r_foot,
//          headMesh, torsoMesh, mouth, browL, browR, irisL[], irisR[],
//          eyeGroups
//   API:   this.root, this.bones, this.skinExtras, this.skinKey,
//          this.skin, this.isPlayer, this.faceState, this.jerky,
//          this.trembling, this.sweatDrops, setFace(), dispose()
// ============================================================
import * as THREE from 'three';
import { toonMat, basicMat, metalMat, pbrMat, addOutline } from '../core/AssetFactory.js';
import { SKINS } from './skins.js';

// Shared glossy body material factory — vinyl/plastik look.
function vinylMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.06 });
}
// Super-glossy wet eye material (clearcoat for the anime sparkle).
function eyeMat(color) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.1 });
}

export class CharacterRig {
  constructor(skinKey, isPlayer = false) {
    this.skinKey = skinKey;
    this.isPlayer = isPlayer;
    this.skin = SKINS[skinKey] || SKINS.shiller;
    this.root = new THREE.Object3D();
    this.bones = {};
    this.faceState = 'normal';
    this.skinExtras = [];
    this.jerky = this.skinKey === 'trojan';
    this.trembling = this.skinKey === 'paperhand';
    this.sweatDrops = null;
    this._build();
  }

  _part(geo, mat, parent, x = 0, y = 0, z = 0, outline = false) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    if (outline) addOutline(m, 0.045);
    return m;
  }

  _bone(name, parent, x = 0, y = 0, z = 0) {
    const b = new THREE.Object3D();
    b.position.set(x, y, z);
    parent.add(b);
    this.bones[name] = b;
    return b;
  }

  _build() {
    const s = this.skin;
    const bodyMat = s.metal ? metalMat(s.body, 0.9, 0.14) : vinylMat(s.body);
    const limbMat = s.metal ? metalMat(s.body, 0.9, 0.14) : vinylMat(s.body);
    this.bodyMat = bodyMat;
    this.limbMat = limbMat;

    // ---- spine chain (chunky proportions) ----
    // Hips lower + body fuses into one bean silhouette.
    const hips = this._bone('hips', this.root, 0, 0.62, 0);
    // Wide rounded hip block (the bean's base)
    const hipMesh = this._part(new THREE.SphereGeometry(0.30, 24, 20), bodyMat, hips, 0, 0, 0, true);
    hipMesh.scale.set(1.15, 0.85, 1.0);

    const spine = this._bone('spine', hips, 0, 0.14, 0);
    const chest = this._bone('chest', spine, 0, 0.20, 0);
    // Torso: a fat rounded form that reads as one blob with the hips.
    const torso = this._part(new THREE.SphereGeometry(0.32, 24, 20), bodyMat, chest, 0, -0.02, 0, true);
    torso.scale.set(1.05, 1.15, 0.95);
    this.bones.torsoMesh = torso;

    // waist seam — a thin torus where hips meet torso (visual break, hi-detail)
    const seam = this._part(new THREE.TorusGeometry(0.30, 0.025, 8, 20), bodyMat, chest, 0, -0.16, 0);
    seam.rotation.x = Math.PI / 2;
    seam.scale.set(1.1, 1.1, 1.0);

    // Neck is super short (head sits almost directly on body)
    const neck = this._bone('neck', chest, 0, 0.10, 0);
    const head = this._bone('head', neck, 0, 0.30, 0);
    // Big sphere head (~50% torso height)
    const headMesh = this._part(new THREE.SphereGeometry(0.36, 32, 28), bodyMat, head, 0, 0, 0, true);
    this.bones.headMesh = headMesh;

    // ---- signature antenna (every skin gets one) ----
    const antShaft = this._part(new THREE.CylinderGeometry(0.012, 0.018, 0.28, 6), limbMat, head, 0, 0.42, 0);
    antShaft.rotation.z = 0.15;
    const antTip = this._part(new THREE.SphereGeometry(0.045, 10, 8), pbrMat(s.accent, { emissive: s.accent, emissiveIntensity: 0.6, rough: 0.3 }), head, 0.06, 0.56, 0);
    this.skinExtras.push(antShaft, antTip);

    this._buildFace(head);
    this._buildArms(chest, limbMat);
    this._buildLegs(hips, limbMat);

    // ---- signature LED backpack (every skin gets one) ----
    const pack = this._part(new THREE.BoxGeometry(0.34, 0.42, 0.16, 2, 2, 2), vinylMat(0x1B1D27), chest, 0, 0.02, -0.30, true);
    // 4 glowing LED dots on the backpack
    const ledMat = pbrMat(s.accent, { emissive: s.accent, emissiveIntensity: 1.0, rough: 0.2 });
    for (let i = 0; i < 4; i++) {
      const lx = (i % 2 === 0 ? -1 : 1) * 0.08;
      const ly = (i < 2 ? 1 : -1) * 0.08;
      const led = this._part(new THREE.SphereGeometry(0.022, 8, 6), ledMat, pack, lx, ly, -0.09);
      this.skinExtras.push(led);
    }
    this.skinExtras.push(pack);

    this._applySkin(s);
  }

  _buildFace(head) {
    // glossy wet eyes with iris/pupil/highlight (anime cute)
    const eyeWhiteMat = eyeMat(0xffffff);
    const irisMat = eyeMat(0x1b6fd8);
    const pupilMat = basicMat(0x0a0a14);
    const browMat = vinylMat(0x241a12);
    this.bones.eyeGroups = {};
    this.bones.irisL = []; this.bones.irisR = [];

    for (const sx of [-1, 1]) {
      const side = sx < 0 ? 'L' : 'R';
      const eyeG = new THREE.Object3D();
      eyeG.position.set(sx * 0.14, 0.04, 0.30);   // wider + forward on the big head
      head.add(eyeG);
      this.bones.eyeGroups[side] = eyeG;

      // big bulging white
      const eg = this._part(new THREE.SphereGeometry(0.13, 20, 18), eyeWhiteMat, eyeG, 0, 0, 0);
      eg.scale.z = 0.6;

      // iris (colored ring)
      const iris = this._part(new THREE.SphereGeometry(0.075, 16, 14), irisMat, eyeG, 0, 0, 0.06);
      iris.scale.z = 0.4;
      // pupil
      const pupil = this._part(new THREE.SphereGeometry(0.04, 14, 12), pupilMat, eyeG, 0, 0, 0.095);
      pupil.scale.z = 0.3;
      // anime sparkle highlight
      const highlight = this._part(new THREE.SphereGeometry(0.022, 8, 8), basicMat(0xffffff), eyeG, -0.025, 0.03, 0.105);
      highlight.scale.z = 0.4;

      if (side === 'L') this.bones.irisL = [iris, pupil, highlight];
      else this.bones.irisR = [iris, pupil, highlight];

      // expressive eyebrow
      const brow = this._part(new THREE.CylinderGeometry(0.022, 0.022, 0.13, 8), browMat, eyeG, 0, 0.16, 0.04);
      brow.rotation.z = Math.PI / 2;
      brow.rotation.y = sx * 0.2;
      this.bones['brow' + side] = brow;
    }

    // cute curved mouth
    const mouthGeo = new THREE.TorusGeometry(0.08, 0.018, 8, 16, Math.PI);
    const mouth = this._part(mouthGeo, basicMat(0x3a1a1a), head, 0, -0.13, 0.34);
    mouth.rotation.x = Math.PI;
    this.bones.mouth = mouth;
    // inner mouth depth (dark sphere behind for hi-detail)
    const innerMouth = this._part(new THREE.SphereGeometry(0.07, 12, 10), basicMat(0x1a0808), head, 0, -0.13, 0.30);
    innerMouth.scale.set(1, 0.6, 0.5);
    this.skinExtras.push(innerMouth);
  }

  _buildArms(chest, limbMat) {
    for (const sx of [-1, 1]) {
      const side = sx < 0 ? 'L' : 'R';
      // shoulder slightly out + lower on the fat body
      const shoulder = this._bone('shoulder' + side, chest, sx * 0.32, 0.08, 0);
      const upper = this._bone(side.toLowerCase() + '_upperarm', shoulder, 0, -0.04, 0);
      this._part(new THREE.CapsuleGeometry(0.085, 0.16, 6, 12), limbMat, upper, 0, -0.12, 0, true);

      const lower = this._bone(side.toLowerCase() + '_lowerarm', upper, 0, -0.22, 0);
      this._part(new THREE.CapsuleGeometry(0.075, 0.14, 6, 12), limbMat, lower, 0, -0.11, 0, true);

      // round chunky hand with a single thumb bump (hi-detail suggestion)
      const handGroup = new THREE.Group();
      handGroup.position.set(0, -0.20, 0);
      this._part(new THREE.SphereGeometry(0.09, 14, 12), limbMat, handGroup, 0, 0, 0, true);
      const thumb = this._part(new THREE.SphereGeometry(0.035, 8, 8), limbMat, handGroup, sx * -0.07, 0.02, 0.04);
      thumb.scale.set(0.8, 1, 0.9);
      lower.add(handGroup);
      this.bones[side.toLowerCase() + '_hand'] = handGroup;
    }
  }

  _buildLegs(hips, limbMat) {
    for (const sx of [-1, 1]) {
      const side = sx < 0 ? 'L' : 'R';
      const hip = this._bone('hip' + side, hips, sx * 0.13, -0.04, 0);
      const upper = this._bone(side.toLowerCase() + '_upperleg', hip, 0, -0.04, 0);
      this._part(new THREE.CapsuleGeometry(0.10, 0.14, 6, 12), limbMat, upper, 0, -0.11, 0, true);

      const lower = this._bone(side.toLowerCase() + '_lowerleg', upper, 0, -0.20, 0);
      this._part(new THREE.CapsuleGeometry(0.085, 0.12, 6, 12), limbMat, lower, 0, -0.10, 0, true);

      // chunky rounded shoe with a sole ring (hi-detail)
      const foot = this._part(new THREE.CapsuleGeometry(0.09, 0.14, 8, 12), limbMat, lower, 0, -0.18, 0.06, true);
      foot.rotation.x = Math.PI / 2;
      const sole = this._part(new THREE.CylinderGeometry(0.095, 0.095, 0.04, 12), vinylMat(0x1B1D27), lower, 0, -0.26, 0.06);
      this.bones[side.toLowerCase() + '_foot'] = foot;
      this.skinExtras.push(sole);
    }
  }

  _applySkin(s) {
    if (this.skinKey === 'shiller') this._shillerExtras(s);
    else if (this.skinKey === 'devsus') this._devsusExtras(s);
    else if (this.skinKey === 'trojan') this._trojanExtras(s);
    else if (this.skinKey === 'paperhand') this._paperhandExtras(s);
    // AAA KOL Models (bespoke accessories on the chunky body)
    else if (this.skinKey === 'whale') this._ansemExtras(s);
    else if (this.skinKey === 'validator') this._tolyExtras(s);
    else if (this.skinKey === 'rpcwiz') this._mertExtras(s);
    else if (this.skinKey === 'orange') this._orangieExtras(s);
    else if (this.skinKey === 'cigarchad') this._cigarchadExtras(s);
    else if (this.skinKey === 'cupsey') this._cupseyExtras(s);
    else if (this.skinKey === 'percent') this._percentExtras(s);
    else if (this.skinKey === 'frogdegen') this._frogExtras(s);
    else if (this.skinKey === 'diamond') this._diamondExtras(s);
    else this._genericExtras(s);
  }

  // ---- Ansem (@blknoiz06): backward cap, cuban chain, SOL pendant, diamond studs ----
  _ansemExtras(s) {
    this.bones.headMesh.material = vinylMat(0x7c4921); this.bones.headMesh.material.needsUpdate = true;
    const capMat = vinylMat(0x111424);
    const capBase = new THREE.Mesh(new THREE.SphereGeometry(0.38, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat);
    capBase.position.y = 0.08; this.bones.head.add(capBase);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.06, 28, 1, false, 0, Math.PI), capMat);
    brim.rotation.x = -Math.PI / 2; brim.rotation.z = Math.PI; brim.position.set(0, 0.08, -0.32); this.bones.head.add(brim);

    // cuban link chain around the neck base
    const chainGroup = new THREE.Group(); chainGroup.position.set(0, 0.12, 0.18); chainGroup.rotation.x = Math.PI / 2 + 0.2;
    const linkGeo = new THREE.TorusGeometry(0.035, 0.012, 6, 10); const goldMat = metalMat(0xffd700, 0.95, 0.15);
    for (let i = 0; i < 18; i++) {
      const link = new THREE.Mesh(linkGeo, goldMat); const a = (i / 18) * Math.PI * 2;
      link.position.set(Math.cos(a) * 0.20, Math.sin(a) * 0.20, 0);
      link.rotation.x = (i % 2 === 0) ? Math.PI / 2 : 0; link.rotation.y = a;
      chainGroup.add(link);
    }
    this.bones.chest.add(chainGroup);
    // SOL pendant
    const pendant = new THREE.Mesh(new THREE.OctahedronGeometry(0.055), metalMat(0xA77BFF, 0.9, 0.2));
    pendant.position.set(0, 0.0, 0.24); this.bones.chest.add(pendant);
    // diamond stud earrings
    for (const sx of [-1, 1]) {
      const stud = new THREE.Mesh(new THREE.OctahedronGeometry(0.038), metalMat(0xffffff, 1.0, 0.05));
      stud.position.set(sx * 0.37, -0.02, 0.04); this.bones.head.add(stud); this.skinExtras.push(stud);
    }
    this.skinExtras.push(capBase, brim, chainGroup, pendant);
  }

  // ---- Toly: sculpted beard, thick frame glasses, bald ----
  _tolyExtras(s) {
    this.bones.headMesh.material = vinylMat(0xf1c27d); this.bones.headMesh.material.needsUpdate = true;
    const beardGeo = new THREE.SphereGeometry(0.38, 28, 22, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45);
    const beardMat = vinylMat(0x3d332c);
    const beard = new THREE.Mesh(beardGeo, beardMat); beard.position.y = -0.02; this.bones.head.add(beard);
    const must = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.14, 6, 10), beardMat);
    must.rotation.z = Math.PI / 2; must.position.set(0, -0.06, 0.36); this.bones.head.add(must);

    const glassMat = vinylMat(0x1A1A2A); const lensMat = metalMat(0x88CCFF, 0.4, 0.2);
    for (const sx of [-1, 1]) {
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.02, 8, 20), glassMat);
      frame.position.set(sx * 0.15, 0.05, 0.34); frame.scale.set(1, 0.6, 1); this.bones.head.add(frame);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.01, 20), lensMat);
      lens.rotation.x = Math.PI / 2; lens.position.set(sx * 0.15, 0.05, 0.34); lens.scale.set(1, 1, 0.6); this.bones.head.add(lens);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.014, 0.22), glassMat); arm.position.set(sx * 0.26, 0.05, 0.24); this.bones.head.add(arm);
      this.skinExtras.push(frame, lens, arm);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.014, 0.02), glassMat); bridge.position.set(0, 0.05, 0.35); this.bones.head.add(bridge);
    this.skinExtras.push(beard, must, bridge);
  }

  // ---- Mert: beanie with folds, hoodie, round glasses ----
  _mertExtras(s) {
    const hoodieMat = vinylMat(0x1e3a8a);
    this.bones.torsoMesh.material = hoodieMat; this.bones.torsoMesh.scale.set(1.15, 1.15, 1.1);
    const pocket = this._part(new THREE.BoxGeometry(0.28, 0.13, 0.05), hoodieMat, this.bones.chest, 0, -0.1, 0.24, true);
    const hood = this._part(new THREE.TorusGeometry(0.24, 0.07, 12, 20), hoodieMat, this.bones.head, 0, -0.28, 0.04);
    hood.rotation.x = Math.PI / 2;

    const beanieMat = vinylMat(0x1B1D27);
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.39, 22, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), beanieMat);
    beanie.position.y = 0.09; beanie.scale.set(1, 1.1, 1); this.bones.head.add(beanie);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 12, 28), vinylMat(0x2E3142));
    cuff.rotation.x = Math.PI / 2; cuff.position.set(0, 0.07, 0); this.bones.head.add(cuff);
    const hair = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 8, 14, Math.PI), vinylMat(0x111111));
    hair.rotation.x = Math.PI / 2; hair.position.set(0, 0.02, 0.04); this.bones.head.add(hair);

    const ringMat = metalMat(0x11141F, 0.5, 0.5);
    for (const sx of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.014, 12, 20), ringMat);
      ring.position.set(sx * 0.15, 0.04, 0.35); this.bones.head.add(ring); this.skinExtras.push(ring);
    }
    this.skinExtras.push(pocket, hood, beanie, cuff, hair);
  }

  // ---- Orangie: pure orange body + meme eyes ----
  _orangieExtras(s) {
    this.bones.headMesh.material = vinylMat(0xFF7A00); this.bones.headMesh.material.needsUpdate = true;
    this.bones.torsoMesh.material = vinylMat(0xFF7A00);
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.39, 22, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), vinylMat(0xFF7A00));
    beanie.position.y = 0.09; this.bones.head.add(beanie);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.05, 12, 28), vinylMat(0xCC5A00));
    cuff.rotation.x = Math.PI / 2; cuff.position.set(0, 0.07, 0); this.bones.head.add(cuff);
    this.skinExtras.push(beanie, cuff);
  }

  // ---- Cigar Chad: suit, collar, tie, cigar, gold shades ----
  _cigarchadExtras(s) {
    const suit = this._part(new THREE.CylinderGeometry(0.26, 0.31, 0.5, 22), vinylMat(0x1B1D27), this.bones.chest, 0, -0.04, 0);
    const collar = this._part(new THREE.ConeGeometry(0.13, 0.16, 4), basicMat(0xF4F6FB), this.bones.chest, 0, 0.06, 0.20);
    collar.rotation.y = Math.PI / 4;
    const tie = this._part(new THREE.BoxGeometry(0.06, 0.26, 0.03), metalMat(0xFFD23F, 0.8, 0.25), this.bones.chest, 0, -0.02, 0.21);
    const cigar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 14), vinylMat(0x6B3A1A));
    cigar.rotation.z = Math.PI / 2; cigar.position.set(0.11, -0.13, 0.35); this.bones.head.add(cigar);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.045, 14), metalMat(0xFFD23F, 0.9, 0.2));
    band.rotation.z = Math.PI / 2; band.position.set(0.05, -0.13, 0.35); this.bones.head.add(band);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), basicMat(0xFF5151));
    ember.position.set(0.23, -0.13, 0.35); this.bones.head.add(ember);

    const frameMat = metalMat(0xFFD23F, 0.9, 0.1);
    const shades = new THREE.Group(); shades.position.set(0, 0.04, 0.36);
    this._part(new THREE.BoxGeometry(0.32, 0.045, 0.03), frameMat, shades, 0, 0, 0);
    this._part(new THREE.BoxGeometry(0.13, 0.075, 0.04), basicMat(0x111111), shades, -0.085, 0, 0);
    this._part(new THREE.BoxGeometry(0.13, 0.075, 0.04), basicMat(0x111111), shades, 0.085, 0, 0);
    this.bones.head.add(shades);
    this.skinExtras.push(suit, collar, tie, cigar, band, ember, shades);
  }

  // ---- Cupsey: cup body + straw ----
  _cupseyExtras(s) {
    const cup = this._part(new THREE.CylinderGeometry(0.30, 0.22, 0.5, 22, 1, false), vinylMat(0xF4F6FB), this.bones.chest, 0, -0.02, 0);
    const sleeve = this._part(new THREE.CylinderGeometry(0.275, 0.275, 0.13, 22, 1, false), vinylMat(0xC97A2A), this.bones.chest, 0, -0.06, 0);
    const lid = this._part(new THREE.CylinderGeometry(0.31, 0.31, 0.05, 22), vinylMat(0x5FCB88), this.bones.chest, 0, 0.24, 0);
    const straw = this._part(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 10), vinylMat(0xA3E635), this.bones.head, 0.09, 0.45, 0);
    straw.rotation.z = 0.3;
    this.skinExtras.push(cup, sleeve, lid, straw);
  }

  // ---- Percent: cap + HUD lens ----
  _percentExtras(s) {
    const capBase = new THREE.Mesh(new THREE.SphereGeometry(0.38, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), vinylMat(0x2FAE6A));
    capBase.position.y = 0.08; this.bones.head.add(capBase);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.06, 22, 1, false, 0, Math.PI), vinylMat(0x1D3934));
    brim.rotation.x = -Math.PI / 2; brim.position.set(0, 0.08, 0.30); this.bones.head.add(brim);
    const hud = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 22), metalMat(0x11141F, 0.7, 0.3));
    hud.rotation.x = Math.PI / 2; hud.position.set(0.15, 0.04, 0.35); this.bones.head.add(hud);
    const hudLens = new THREE.Mesh(new THREE.CircleGeometry(0.07, 22), basicMat(0xA3E635));
    hudLens.position.set(0.15, 0.04, 0.38); this.bones.head.add(hudLens);
    this.skinExtras.push(capBase, brim, hud, hudLens);
  }

  // ---- Frog Degen: frog eyes + grin ----
  _frogExtras(s) {
    this.bones.headMesh.material = vinylMat(0x5FCB88); this.bones.headMesh.material.needsUpdate = true;
    for (const sx of [-1, 1]) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 18), vinylMat(0xA3E635));
      bulb.position.set(sx * 0.17, 0.34, 0.12); this.bones.head.add(bulb);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), basicMat(0x0B0E1A));
      pupil.position.set(sx * 0.17, 0.38, 0.24); this.bones.head.add(pupil);
      this.skinExtras.push(bulb, pupil);
    }
    for (const arr of [this.bones.irisL, this.bones.irisR]) arr.forEach((m) => { m.visible = false; });
    const grin = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 8, 20, Math.PI), basicMat(0x1D3934));
    grin.rotation.x = Math.PI; grin.position.set(0, -0.05, 0.34); this.bones.head.add(grin);
    this.skinExtras.push(grin);
  }

  // ---- Diamond Hands: diamond metal body + gem crown ----
  _diamondExtras(s) {
    this.bones.headMesh.material = metalMat(0xB3E5FC, 0.95, 0.05); this.bones.headMesh.material.needsUpdate = true;
    this.bones.torsoMesh.material = metalMat(0xB3E5FC, 0.95, 0.05); this.bones.torsoMesh.material.needsUpdate = true;
    const gemCrown = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), metalMat(0x4F8CFF, 0.9, 0.08));
    gemCrown.position.set(0, 0.42, 0); gemCrown.rotation.y = Math.PI / 4; this.bones.head.add(gemCrown);
    for (const arr of [this.bones.irisL, this.bones.irisR]) arr.forEach((m) => { m.material = basicMat(0xA3E635); m.scale.multiplyScalar(1.2); });
    const handMat = metalMat(0x4F8CFF, 1.0, 0.02);
    for (const side of ['l_hand', 'r_hand']) {
      const handGroup = this.bones[side];
      while (handGroup.children.length > 0) handGroup.remove(handGroup.children[0]);
      const diamondHand = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), handMat);
      handGroup.add(diamondHand); this.skinExtras.push(diamondHand);
    }
    this.skinExtras.push(gemCrown);
  }

  // ---- Shiller: glasses + tie + megaphone ----
  _shillerExtras(s) {
    const glasses = this._part(new THREE.BoxGeometry(0.30, 0.09, 0.035), basicMat(0x000000), this.bones.head, 0, 0.04, 0.35);
    const tie = this._part(new THREE.BoxGeometry(0.07, 0.27, 0.03), basicMat(s.accent), this.bones.chest, 0, 0, 0.20);
    const cone = this._part(new THREE.ConeGeometry(0.16, 0.30, 14), basicMat(0xff6b00), this.bones.l_hand, 0, -0.18, 0.09);
    cone.rotation.x = Math.PI / 2;
    this.skinExtras.push(glasses, tie, cone);
  }

  // ---- Devsus: hood + mask + laptop ----
  _devsusExtras(s) {
    const hood = this._part(new THREE.SphereGeometry(0.40, 22, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), vinylMat(0x202028), this.bones.head, 0, 0.05, -0.02);
    const mask = this._part(new THREE.PlaneGeometry(0.44, 0.36), basicMat(0xf0f0f0), this.bones.head, 0, 0, 0.36);
    for (const arr of [this.bones.irisL, this.bones.irisR]) arr.forEach((m) => { m.material = basicMat(0x00ff88); m.scale.multiplyScalar(1.3); });
    const laptop = this._part(new THREE.BoxGeometry(0.36, 0.24, 0.03), basicMat(0x111111), this.bones.chest, 0, 0.05, -0.22);
    this.skinExtras.push(hood, mask, laptop);
  }

  // ---- Trojan: red visor ----
  _trojanExtras(s) {
    const visor = this._part(new THREE.BoxGeometry(0.46, 0.07, 0.05), basicMat(0xff0000), this.bones.head, 0, 0.05, 0.35);
    for (const arr of [this.bones.irisL, this.bones.irisR]) arr.forEach((m) => m.visible = false);
    this.skinExtras.push(visor);
  }

  // ---- Paperhand: tee + sweat drops ----
  _paperhandExtras(s) {
    this.setFace('sweating');
    const tee = this._part(new THREE.CylinderGeometry(0.25, 0.30, 0.42, 22), basicMat(0xffffff), this.bones.chest, 0, -0.05, 0);
    this.sweatDrops = [];
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), basicMat(0x9bd6ff));
      d.position.set(0.18 + i * 0.05, 0.18, 0.36); d.material.transparent = true; d.material.opacity = 0.85;
      this.bones.head.add(d); this.sweatDrops.push(d); this.skinExtras.push(d);
    }
  }

  // ---- Generic: headband ----
  _genericExtras(s) {
    const bandMat = vinylMat(s.accent);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.375, 0.07, 28, 1, false), bandMat);
    band.position.y = 0.18; this.bones.head.add(band);
    this.skinExtras.push(band);
  }

  setFace(state) {
    this.faceState = state;
    const mouth = this.bones.mouth;
    const browL = this.bones.browL, browR = this.bones.browR;
    if (!mouth) return;
    switch (state) {
      case 'normal':
        mouth.scale.set(1, 1, 1); mouth.material.color.setHex(0x3a1a1a);
        if (browL) browL.rotation.z = Math.PI / 2; if (browR) browR.rotation.z = Math.PI / 2;
        break;
      case 'sweating':
        mouth.scale.set(0.6, 1.6, 1); mouth.material.color.setHex(0x2a1a2a);
        if (browL) browL.rotation.z = Math.PI / 2 - 0.3; if (browR) browR.rotation.z = Math.PI / 2 + 0.3;
        break;
      case 'shocked':
        mouth.scale.set(0.5, 2.2, 1); mouth.material.color.setHex(0x1a0a0a);
        if (browL) browL.position.y = 0.2; if (browR) browR.position.y = 0.2;
        break;
      case 'celebrating':
        mouth.scale.set(1.6, 1.4, 1); mouth.material.color.setHex(0x6a1a1a);
        if (browL) browL.position.y = 0.18; if (browR) browR.position.y = 0.18;
        break;
    }
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
    if (this.root.parent) this.root.parent.remove(this.root);
  }
}
