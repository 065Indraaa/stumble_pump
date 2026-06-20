// ============================================================
// STUMBLE PUMP — CharacterRig
// Procedural chibi humanoid built from Three.js primitives.
// Bone hierarchy (Object3D). NO GLTF — per brief.
//
// Proportions (Stumble Guys style, big head):
//   head ~0.42 radius, torso tapered cylinder, capsule-ish limbs.
//
// Exposes: bones map, setFace(state), skin-specific accessor methods,
// and skinFx flags (jerky/trembling/sweatDrops) consumed by AnimationController.
// ============================================================
import * as THREE from 'three';
import { toonMat, basicMat, metalMat, addOutline } from '../core/AssetFactory.js';
import { SKINS } from './skins.js';

export class CharacterRig {
  constructor(skinKey, isPlayer = false) {
    this.skinKey = skinKey;
    this.isPlayer = isPlayer;
    this.skin = SKINS[skinKey] || SKINS.shiller;
    this.root = new THREE.Object3D();
    this.bones = {};
    this.faceState = 'normal';
    this.skinExtras = [];
    // animation-affecting flags
    this.jerky = this.skinKey === 'trojan';        // rigid robot motion
    this.trembling = this.skinKey === 'paperhand'; // panic shake
    this.sweatDrops = null;
    this._build();
  }

  _part(geo, mat, parent, x = 0, y = 0, z = 0, outline = false) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    if (outline) addOutline(m, 0.05);
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
    const bodyMat = s.metal ? metalMat(s.body, 0.9, 0.12) : toonMat(s.body);
    const limbMat = s.metal ? metalMat(s.body, 0.9, 0.12) : toonMat(s.body);
    this.bodyMat = bodyMat;
    this.limbMat = limbMat;

    // ---- spine chain ----
    const hips = this._bone('hips', this.root, 0, 0.92, 0);
    const hipMesh = this._part(new THREE.SphereGeometry(0.24, 12, 10), bodyMat, hips, 0, 0, 0, true);
    hipMesh.scale.y = 0.7;

    const spine = this._bone('spine', hips, 0, 0.12, 0);
    const chest = this._bone('chest', spine, 0, 0.22, 0);
    const torso = this._part(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 14), bodyMat, chest, 0, -0.05, 0, true);
    this.bones.torsoMesh = torso;

    const neck = this._bone('neck', chest, 0, 0.2, 0);
    const head = this._bone('head', neck, 0, 0.34, 0);
    const headMesh = this._part(new THREE.SphereGeometry(0.42, 18, 18), bodyMat, head, 0, 0, 0, true);
    this.bones.headMesh = headMesh;

    this._buildFace(head);
    this._buildArms(chest, limbMat);
    this._buildLegs(hips, limbMat);

    // per-skin accessories + flags
    this._applySkin(s);
  }

  _buildFace(head) {
    const eyeWhiteMat = basicMat(0xffffff);
    const irisMat = basicMat(0x1b6fd8);
    const pupilMat = basicMat(0x0a0a14);
    const browMat = toonMat(0x241a12);
    this.bones.eyeGroups = {};
    this.bones.irisL = []; this.bones.irisR = [];
    for (const sx of [-1, 1]) {
      const side = sx < 0 ? 'L' : 'R';
      const eyeG = new THREE.Object3D();
      eyeG.position.set(sx * 0.17, 0.05, 0.33);
      head.add(eyeG);
      this.bones.eyeGroups[side] = eyeG;
      const eg = this._part(new THREE.SphereGeometry(0.115, 16, 16), eyeWhiteMat, eyeG, 0, 0, 0);
      eg.scale.z = 0.55;
      const iris = this._part(new THREE.SphereGeometry(0.06, 12, 12), irisMat, eyeG, 0, 0, 0.06);
      iris.scale.z = 0.3;
      const pupil = this._part(new THREE.SphereGeometry(0.032, 8, 8), pupilMat, eyeG, 0, 0, 0.1);
      if (side === 'L') this.bones.irisL = [iris, pupil]; else this.bones.irisR = [iris, pupil];
      // eyebrow
      const brow = this._part(new THREE.BoxGeometry(0.14, 0.03, 0.05), browMat, eyeG, 0, 0.14, 0.04);
      this.bones['brow' + side] = brow;
    }
    // mouth (small box, recolored per face state)
    const mouth = this._part(new THREE.BoxGeometry(0.16, 0.05, 0.04), basicMat(0x3a1a1a), head, 0, -0.18, 0.38);
    this.bones.mouth = mouth;
  }

  _buildArms(chest, limbMat) {
    for (const sx of [-1, 1]) {
      const side = sx < 0 ? 'L' : 'R';
      const shoulder = this._bone('shoulder' + side, chest, sx * 0.28, 0.12, 0);
      const upper = this._bone(side.toLowerCase() + '_upperarm', shoulder, 0, -0.05, 0);
      this._part(new THREE.CapsuleGeometry(0.09, 0.28, 4, 8), limbMat, upper, 0, -0.18, 0, true);
      const lower = this._bone(side.toLowerCase() + '_lowerarm', upper, 0, -0.36, 0);
      this._part(new THREE.CapsuleGeometry(0.075, 0.24, 4, 8), limbMat, lower, 0, -0.16, 0, true);
      const hand = this._part(new THREE.SphereGeometry(0.1, 10, 10), limbMat, lower, 0, -0.34, 0, true);
      this.bones[side.toLowerCase() + '_hand'] = hand;
    }
  }

  _buildLegs(hips, limbMat) {
    for (const sx of [-1, 1]) {
      const side = sx < 0 ? 'L' : 'R';
      const hip = this._bone('hip' + side, hips, sx * 0.13, -0.05, 0);
      const upper = this._bone(side.toLowerCase() + '_upperleg', hip, 0, -0.05, 0);
      this._part(new THREE.CapsuleGeometry(0.11, 0.26, 4, 8), limbMat, upper, 0, -0.18, 0, true);
      const lower = this._bone(side.toLowerCase() + '_lowerleg', upper, 0, -0.36, 0);
      this._part(new THREE.CapsuleGeometry(0.09, 0.22, 4, 8), limbMat, lower, 0, -0.15, 0, true);
      const foot = this._part(new THREE.BoxGeometry(0.18, 0.1, 0.28), limbMat, lower, 0, -0.3, 0.05, true);
      this.bones[side.toLowerCase() + '_foot'] = foot;
    }
  }

  _applySkin(s) {
    if (this.skinKey === 'shiller') this._shillerExtras(s);
    else if (this.skinKey === 'devsus') this._devsusExtras(s);
    else if (this.skinKey === 'trojan') this._trojanExtras(s);
    else if (this.skinKey === 'paperhand') this._paperhandExtras(s);
    // ---- KOL caricatures (ciri signature dari foto profil X) ----
    else if (this.skinKey === 'whale') this._ansemExtras(s);       // Ansem @blknoiz06
    else if (this.skinKey === 'validator') this._tolyExtras(s);    // Toly Anatoly Yakovenko
    else if (this.skinKey === 'rpcwiz') this._mertExtras(s);       // Mert @ummtqt (Helius)
    else if (this.skinKey === 'orange') this._orangieExtras(s);    // Orangie
    else if (this.skinKey === 'cigarchad') this._cigarchadExtras(s);
    else if (this.skinKey === 'cupsey') this._cupseyExtras(s);
    else this._genericExtras(s);
  }

  // ---- Ansem (@blknoiz06 / Zion Thomas): young Black trader, boxer build,
  //      signature baseball cap. Skin tone warm brown. ----
  _ansemExtras(s) {
    this.bones.headMesh.material = toonMat(0x8d5524);
    this.bones.headMesh.material.needsUpdate = true;
    const capBase = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), toonMat(0x1b4fd8));
    capBase.position.y = 0.08; this.bones.head.add(capBase);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 16, 1, false, 0, Math.PI), toonMat(0x1b4fd8));
    brim.rotation.x = -Math.PI / 2; brim.position.set(0, 0.08, 0.34); this.bones.head.add(brim);
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 20), metalMat(0xffd700, 0.9, 0.2));
    chain.rotation.x = Math.PI / 2; chain.position.set(0, 0.18, 0.2); this.bones.chest.add(chain);
    const badge = this._part(new THREE.CircleGeometry(0.1, 16), basicMat(0x35d6ff), this.bones.chest, 0, 0.05, 0.24);
    this.skinExtras.push(capBase, brim, chain, badge);
  }

  // ---- Toly (Anatoly Yakovenko): bald shaved head + short beard + glasses. ----
  _tolyExtras(s) {
    this.bones.headMesh.material = metalMat(0xe8c9a0, 0.2, 0.55);
    this.bones.headMesh.material.needsUpdate = true;
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), toonMat(0x3a2a1a));
    beard.position.y = -0.05; this.bones.head.add(beard);
    const badge = this._part(new THREE.CircleGeometry(0.12, 24), basicMat(0x9945ff), this.bones.chest, 0, 0.05, 0.24);
    badge.material.emissive = new THREE.Color(0x14f195); badge.material.emissiveIntensity = 0.4;
    for (const sx of [-1, 1]) {
      const lens = this._part(new THREE.BoxGeometry(0.16, 0.1, 0.03), basicMat(0x1a1a2a));
      lens.position.set(sx * 0.17, 0.05, 0.4); this.bones.head.add(lens); this.skinExtras.push(lens);
    }
    this.skinExtras.push(beard, badge);
  }

  // ---- Mert (@ummtqt, Helius): hoodie + round glasses + wizard hat. ----
  _mertExtras(s) {
    const hoodie = this._part(new THREE.CylinderGeometry(0.26, 0.32, 0.6, 12), toonMat(0x3a2a70), this.bones.chest, 0, -0.02, 0);
    const hood = this._part(new THREE.SphereGeometry(0.48, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), toonMat(0x3a2a70), this.bones.head, 0, 0.02, -0.05);
    for (const sx of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 12), metalMat(0xffd24a, 0.8, 0.3));
      ring.position.set(sx * 0.17, 0.05, 0.41); this.bones.head.add(ring); this.skinExtras.push(ring);
    }
    const wizHat = this._part(new THREE.ConeGeometry(0.3, 0.5, 12), metalMat(0xffd24a, 0.5, 0.4), this.bones.head, 0, 0.55, 0);
    wizHat.rotation.x = 0.1;
    this.skinExtras.push(hoodie, hood, wizHat);
  }

  _orangieExtras(s) {
    this.bones.headMesh.material = toonMat(0xff7a18);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), toonMat(0xff7a18));
    cap.position.y = 0.08; this.bones.head.add(cap);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 16, 1, false, 0, Math.PI), toonMat(0xff7a18));
    brim.rotation.x = -Math.PI / 2; brim.position.set(0, 0.08, 0.34); this.bones.head.add(brim);
    this.skinExtras.push(cap, brim);
  }

  _cigarchadExtras(s) {
    const suit = this._part(new THREE.CylinderGeometry(0.24, 0.3, 0.5, 12), toonMat(0x2a2a33), this.bones.chest, 0, -0.04, 0);
    const tie = this._part(new THREE.BoxGeometry(0.08, 0.28, 0.03), metalMat(0xffd700), this.bones.chest, 0, 0, 0.22);
    const cigar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.25, 8), toonMat(0x4a2a1a));
    cigar.rotation.z = Math.PI / 2; cigar.position.set(0.12, -0.15, 0.4); this.bones.head.add(cigar);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), basicMat(0xff3300));
    ember.position.set(0.24, -0.15, 0.4); this.bones.head.add(ember);
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 20), metalMat(0xffd700, 0.9, 0.2));
    chain.rotation.x = Math.PI / 2; chain.position.set(0, 0.18, 0.2); this.bones.chest.add(chain);
    this.skinExtras.push(suit, tie, cigar, ember, chain);
  }

  _cupseyExtras(s) {
    const cup = this._part(new THREE.CylinderGeometry(0.3, 0.22, 0.5, 16, 1, true), toonMat(0xe8e8f0), this.bones.chest, 0, -0.02, 0);
    cup.material.side = THREE.DoubleSide;
    const straw = this._part(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), toonMat(0x18c0b0), this.bones.head, 0.1, 0.5, 0);
    straw.rotation.z = 0.3;
    this.skinExtras.push(cup, straw);
  }


  _shillerExtras(s) {
    // suit jacket + tie + sunglasses + megaphone in left hand
    const head = this.bones.head;
    const glasses = this._part(new THREE.BoxGeometry(0.32, 0.1, 0.04), basicMat(0x000000), head, 0, 0.05, 0.4);
    const tie = this._part(new THREE.BoxGeometry(0.08, 0.3, 0.03), basicMat(s.accent), this.bones.chest, 0, 0, 0.22);
    // megaphone
    const hand = this.bones.l_hand;
    const cone = this._part(new THREE.ConeGeometry(0.18, 0.34, 12), basicMat(0xff6b00), hand, 0, -0.2, 0.1);
    cone.rotation.x = Math.PI / 2;
    this.skinExtras.push(glasses, tie, cone);
  }

  _devsusExtras(s) {
    // hoodie hood + hacker mask (white plane over face) + glowing green eyes
    const head = this.bones.head;
    const hood = this._part(new THREE.SphereGeometry(0.46, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), toonMat(0x202028), head, 0, 0.05, -0.02);
    const mask = this._part(new THREE.PlaneGeometry(0.5, 0.4), basicMat(0xf0f0f0), head, 0, 0, 0.41);
    // glowing eyes replace iris color
    for (const arr of [this.bones.irisL, this.bones.irisR]) {
      arr.forEach((m) => { m.material = basicMat(0x00ff88); m.scale.multiplyScalar(1.3); });
    }
    // laptop on back
    const laptop = this._part(new THREE.BoxGeometry(0.4, 0.26, 0.03), basicMat(0x111111), this.bones.chest, 0, 0.05, -0.24);
    const screen = this._part(new THREE.PlaneGeometry(0.34, 0.2), basicMat(0x00ff88), laptop, 0, 0, 0.02);
    this.skinExtras.push(hood, mask, laptop, screen);
  }

  _trojanExtras(s) {
    // exhaust pipes + joint covers + red visor eyes
    const chest = this.bones.chest;
    for (const sx of [-1, 1]) {
      const pipe = this._part(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), metalMat(0x888888), chest, sx * 0.2, 0.25, -0.18);
      this.skinExtras.push(pipe);
    }
    // red visor across eyes
    const visor = this._part(new THREE.BoxGeometry(0.5, 0.08, 0.05), basicMat(0xff0000), this.bones.head, 0, 0.06, 0.4);
    for (const arr of [this.bones.irisL, this.bones.irisR]) arr.forEach((m) => m.visible = false);
    this.skinExtras.push(visor);
  }

  _paperhandExtras(s) {
    // white "SELL" tee + animated sweat drops + panicky face
    this.setFace('sweating');
    const tee = this._part(new THREE.CylinderGeometry(0.24, 0.3, 0.45, 12), basicMat(0xffffff), this.bones.chest, 0, -0.05, 0);
    // sweat drops (3) — positioned around head, animated by AnimController
    this.sweatDrops = [];
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), basicMat(0x9bd6ff));
      d.position.set(0.2 + i * 0.05, 0.2, 0.4);
      d.material.transparent = true; d.material.opacity = 0.8;
      this.bones.head.add(d);
      this.sweatDrops.push(d);
      this.skinExtras.push(d);
    }
  }

  _genericExtras(s) {
    // accent stripe + emoji badge on chest for unlockable KOL skins
    const badge = this._part(new THREE.CircleGeometry(0.1, 16), basicMat(s.accent), this.bones.chest, 0, 0.05, 0.24);
    // hat cone for legendary
    if (s.rarity === 'legendary') {
      const hat = this._part(new THREE.ConeGeometry(0.22, 0.3, 12), metalMat(s.accent, 0.6, 0.3), this.bones.head, 0, 0.5, 0);
      this.skinExtras.push(hat);
    }
    this.skinExtras.push(badge);
  }

  setFace(state) {
    this.faceState = state;
    const mouth = this.bones.mouth;
    const browL = this.bones.browL, browR = this.bones.browR;
    if (!mouth) return;
    switch (state) {
      case 'normal':
        mouth.scale.set(1, 1, 1); mouth.material.color.setHex(0x3a1a1a);
        if (browL) browL.rotation.z = 0; if (browR) browR.rotation.z = 0;
        break;
      case 'sweating':
        mouth.scale.set(0.6, 1.6, 1); mouth.material.color.setHex(0x2a1a2a);
        if (browL) browL.rotation.z = -0.3; if (browR) browR.rotation.z = 0.3;
        break;
      case 'shocked':
        mouth.scale.set(0.5, 2.2, 1); mouth.material.color.setHex(0x1a0a0a);
        if (browL) browL.position.y += 0.05; if (browR) browR.position.y += 0.05;
        break;
      case 'celebrating':
        mouth.scale.set(1.6, 1.4, 1); mouth.material.color.setHex(0x6a1a1a);
        if (browL) browL.position.y += 0.04; if (browR) browR.position.y += 0.04;
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
