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

    // Default Party Game Backpack (adds detail so they aren't plain capsules)
    const packGeo = new THREE.BoxGeometry(0.3, 0.4, 0.15);
    const packMat = s.metal ? metalMat(s.accent, 0.8, 0.3) : toonMat(s.accent);
    const backpack = this._part(packGeo, packMat, chest, 0, 0.05, -0.25, true);
    // little pocket on the backpack
    const pocketGeo = new THREE.BoxGeometry(0.2, 0.2, 0.05);
    const pocketMat = toonMat(s.body);
    this._part(pocketGeo, pocketMat, backpack, 0, -0.05, -0.08, true);

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
    else if (this.skinKey === 'percent') this._percentExtras(s);   // Cented
    else if (this.skinKey === 'frogdegen') this._frogExtras(s);    // mr.frog
    else if (this.skinKey === 'diamond') this._diamondExtras(s);   // Diamond Hands
    else this._genericExtras(s);
  }

  // ---- Ansem (@blknoiz06 / Zion Thomas): young Black trader, boxer build,
  //      signature fitted baseball cap (often backwards), iced-out chain,
  //      diamond stud earrings. Skin tone warm brown. ----
  _ansemExtras(s) {
    this.bones.headMesh.material = toonMat(0x8d5524);
    this.bones.headMesh.material.needsUpdate = true;
    // fitted cap crown (navy with mint visor stitch)
    const capBase = new THREE.Mesh(new THREE.SphereGeometry(0.44, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), toonMat(0x1B1D27));
    capBase.position.y = 0.08; this.bones.head.add(capBase);
    // cap button on top
    const capBtn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), toonMat(0x2E3142));
    capBtn.position.set(0, 0.32, 0); this.bones.head.add(capBtn);
    // curved brim
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 20, 1, false, 0, Math.PI), toonMat(0x1B1D27));
    brim.rotation.x = -Math.PI / 2; brim.position.set(0, 0.08, 0.34); this.bones.head.add(brim);
    // mint logo dot on cap front
    const capLogo = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), basicMat(0x5FCB88));
    capLogo.position.set(0, 0.18, 0.30); this.bones.head.add(capLogo);
    // iced-out Cuban link chain (multi-link torus + pendant)
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.028, 8, 24), metalMat(0xffd700, 0.95, 0.15));
    chain.rotation.x = Math.PI / 2; chain.position.set(0, 0.18, 0.20); this.bones.chest.add(chain);
    // SOL pendant
    const pendant = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.02), metalMat(0xA77BFF, 0.9, 0.2));
    pendant.position.set(0, 0.02, 0.25); this.bones.chest.add(pendant);
    // diamond stud earrings (both ears)
    for (const sx of [-1, 1]) {
      const stud = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), metalMat(0xffffff, 1.0, 0.05));
      stud.position.set(sx * 0.40, -0.02, 0.05); this.bones.head.add(stud);
      this.skinExtras.push(stud);
    }
    // Solana gradient chest badge (purple→green)
    const badge = this._part(new THREE.CircleGeometry(0.1, 24), basicMat(0x9945FF), this.bones.chest, 0, 0.05, 0.24);
    badge.material.emissive = new THREE.Color(0x14F195); badge.material.emissiveIntensity = 0.4;
    this.skinExtras.push(capBase, capBtn, brim, capLogo, chain, pendant, badge);
  }

  // ---- Toly (Anatoly Yakovenko, Solana co-founder): bald shaved head,
  //      short salt-and-pepper beard, thin rectangular glasses, fair skin. ----
  _tolyExtras(s) {
    this.bones.headMesh.material = metalMat(0xe8c9a0, 0.2, 0.55);
    this.bones.headMesh.material.needsUpdate = true;
    // short beard wrap (lower face)
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 14, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42), toonMat(0x4A4036));
    beard.position.y = -0.05; this.bones.head.add(beard);
    // mustache
    const must = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.06), toonMat(0x4A4036));
    must.position.set(0, -0.06, 0.38); this.bones.head.add(must);
    // thin rectangular glasses (frame + arms)
    const glassMat = toonMat(0x1A1A2A);
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.03), glassMat);
      lens.position.set(sx * 0.17, 0.05, 0.40); this.bones.head.add(lens);
      // arm
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.015), glassMat);
      arm.position.set(sx * 0.27, 0.05, 0.36); this.bones.head.add(arm);
      this.skinExtras.push(lens, arm);
    }
    // bridge
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.02), glassMat);
    bridge.position.set(0, 0.05, 0.41); this.bones.head.add(bridge);
    // Solana gradient logo badge (purple→green) — signature Solana
    const badge = this._part(new THREE.CircleGeometry(0.12, 24), basicMat(0x9945FF), this.bones.chest, 0, 0.05, 0.24);
    badge.material.emissive = new THREE.Color(0x14F195); badge.material.emissiveIntensity = 0.4;
    this.skinExtras.push(beard, must, bridge, badge);
  }

  // ---- Mert (@ummtqt, Helius CEO): hoodie + beanie + round glasses.
  //      Dark hair tufts visible under beanie. Helius badge. ----
  _mertExtras(s) {
    // hoodie over torso
    const hoodie = this._part(new THREE.CylinderGeometry(0.26, 0.32, 0.6, 14), toonMat(0x2FAE6A), this.bones.chest, 0, -0.02, 0);
    // hoodie pocket
    const pocket = this._part(new THREE.BoxGeometry(0.3, 0.12, 0.02), toonMat(0x1D3934), this.bones.chest, 0, -0.12, 0.24);
    // hood collar around neck
    const hood = this._part(new THREE.SphereGeometry(0.48, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), toonMat(0x2FAE6A), this.bones.head, 0, 0.02, -0.05);
    // beanie (folded cuff visible)
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), toonMat(0x1B1D27));
    beanie.position.y = 0.10; this.bones.head.add(beanie);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.06, 8, 20), toonMat(0x2E3142));
    cuff.rotation.x = Math.PI / 2; cuff.position.set(0, 0.08, 0); this.bones.head.add(cuff);
    // dark hair tuft peeking under beanie
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.2), toonMat(0x2A2018));
    hair.position.set(0, 0.04, -0.08); this.bones.head.add(hair);
    // round thin glasses
    for (const sx of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.014, 8, 16), metalMat(0x11141F, 0.4, 0.5));
      ring.position.set(sx * 0.17, 0.05, 0.41); this.bones.head.add(ring); this.skinExtras.push(ring);
    }
    // Helius mint badge
    const badge = this._part(new THREE.CircleGeometry(0.1, 20), basicMat(0xA3E635), this.bones.chest, 0, 0.05, 0.25);
    this.skinExtras.push(hoodie, pocket, hood, beanie, cuff, hair, badge);
  }

  _orangieExtras(s) {
    // bright orange skin (the meme)
    this.bones.headMesh.material = toonMat(0xFF8A3D);
    this.bones.headMesh.material.needsUpdate = true;
    // orange beanie
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), toonMat(0xFF8A3D));
    beanie.position.y = 0.10; this.bones.head.add(beanie);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.06, 8, 20), toonMat(0xE0631A));
    cuff.rotation.x = Math.PI / 2; cuff.position.set(0, 0.08, 0); this.bones.head.add(cuff);
    // BTC-orange pin on chest
    const pin = this._part(new THREE.CircleGeometry(0.08, 16), basicMat(0xFF8A3D), this.bones.chest, 0, 0.05, 0.24);
    this.skinExtras.push(beanie, cuff, pin);
  }

  _cigarchadExtras(s) {
    // sharp dark suit with lapels
    const suit = this._part(new THREE.CylinderGeometry(0.24, 0.3, 0.5, 14), toonMat(0x1B1D27), this.bones.chest, 0, -0.04, 0);
    // white shirt collar V
    const collar = this._part(new THREE.ConeGeometry(0.14, 0.18, 4), basicMat(0xF4F6FB), this.bones.chest, 0, 0.06, 0.22);
    collar.rotation.y = Math.PI / 4;
    // gold tie
    const tie = this._part(new THREE.BoxGeometry(0.07, 0.28, 0.03), metalMat(0xFFD23F, 0.8, 0.25), this.bones.chest, 0, -0.02, 0.23);
    // lapels (two angled boxes)
    for (const sx of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.02), toonMat(0x11141F));
      lapel.position.set(sx * 0.10, 0.02, 0.23); lapel.rotation.z = sx * 0.4; this.bones.chest.add(lapel); this.skinExtras.push(lapel);
    }
    // lit cigar (tan body + white band + glowing ember)
    const cigar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 10), toonMat(0x6B3A1A));
    cigar.rotation.z = Math.PI / 2; cigar.position.set(0.12, -0.15, 0.40); this.bones.head.add(cigar);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.05, 10), metalMat(0xFFD23F, 0.9, 0.2));
    band.rotation.z = Math.PI / 2; band.position.set(0.06, -0.15, 0.40); this.bones.head.add(band);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), basicMat(0xFF5151));
    ember.position.set(0.26, -0.15, 0.40); this.bones.head.add(ember);
    // gold watch on left wrist
    const watch = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12), metalMat(0xFFD23F, 0.95, 0.15));
    watch.rotation.x = Math.PI / 2; watch.position.set(0, -0.06, 0.06); this.bones.l_lowerarm.add(watch);
    // gold chain
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 22), metalMat(0xFFD23F, 0.9, 0.2));
    chain.rotation.x = Math.PI / 2; chain.position.set(0, 0.18, 0.20); this.bones.chest.add(chain);
    this.skinExtras.push(suit, collar, tie, cigar, band, ember, watch, chain);
  }

  _cupseyExtras(s) {
    // paper cup body (white with mint sip lid)
    const cup = this._part(new THREE.CylinderGeometry(0.3, 0.22, 0.5, 18, 1, true), toonMat(0xF4F6FB), this.bones.chest, 0, -0.02, 0);
    cup.material.side = THREE.DoubleSide;
    // coffee sleeve (kraft band)
    const sleeve = this._part(new THREE.CylinderGeometry(0.27, 0.27, 0.14, 18, 1, true), toonMat(0xC97A2A), this.bones.chest, 0, -0.06, 0);
    sleeve.material.side = THREE.DoubleSide;
    // mint sip lid
    const lid = this._part(new THREE.CylinderGeometry(0.31, 0.31, 0.06, 18), toonMat(0x5FCB88), this.bones.chest, 0, 0.22, 0);
    // straw sticking up
    const straw = this._part(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 10), toonMat(0xA3E635), this.bones.head, 0.1, 0.5, 0);
    straw.rotation.z = 0.3;
    this.skinExtras.push(cup, sleeve, lid, straw);
  }

  // ---- Cented (percent): chart-percent themed trader, green visor cap,
  //      "% " chest patch, monocular HUD lens over one eye. ----
  _percentExtras(s) {
    // green cap with brim
    const capBase = new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), toonMat(0x2FAE6A));
    capBase.position.y = 0.08; this.bones.head.add(capBase);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 18, 1, false, 0, Math.PI), toonMat(0x1D3934));
    brim.rotation.x = -Math.PI / 2; brim.position.set(0, 0.08, 0.34); this.bones.head.add(brim);
    // % emblem on cap
    const pct = this._part(new THREE.CircleGeometry(0.07, 16), basicMat(0xFFD23F), this.bones.head, 0, 0.18, 0.30);
    // monocular HUD over right eye
    const hud = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 14), metalMat(0x11141F, 0.7, 0.3));
    hud.rotation.x = Math.PI / 2; hud.position.set(0.17, 0.05, 0.40); this.bones.head.add(hud);
    const hudLens = new THREE.Mesh(new THREE.CircleGeometry(0.06, 14), basicMat(0xA3E635));
    hudLens.position.set(0.17, 0.05, 0.435); this.bones.head.add(hudLens);
    // % chest patch
    const patch = this._part(new THREE.CircleGeometry(0.1, 18), basicMat(0x2FAE6A), this.bones.chest, 0, 0.05, 0.24);
    this.skinExtras.push(capBase, brim, pct, hud, hudLens, patch);
  }

  // ---- mr.frog (frogdegen): green amphibian, bulbous eyes on top of head. ----
  _frogExtras(s) {
    this.bones.headMesh.material = toonMat(0x5FCB88);
    this.bones.headMesh.material.needsUpdate = true;
    // two bulbous frog eyes on top
    for (const sx of [-1, 1]) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), toonMat(0xA3E635));
      bulb.position.set(sx * 0.15, 0.38, 0.05); this.bones.head.add(bulb);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), basicMat(0x0B0E1A));
      pupil.position.set(sx * 0.15, 0.40, 0.15); this.bones.head.add(pupil);
      // hide default eyes
      this.skinExtras.push(bulb, pupil);
    }
    for (const arr of [this.bones.irisL, this.bones.irisR]) arr.forEach((m) => { m.visible = false; });
    // wide frog grin
    const grin = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.04), basicMat(0x1D3934));
    grin.position.set(0, -0.16, 0.36); this.bones.head.add(grin);
    // lily-pad shoulder pads
    for (const sx of [-1, 1]) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 8), toonMat(0x1D3934));
      pad.position.set(sx * 0.28, 0.16, 0); pad.rotation.z = sx * 0.3; this.bones.chest.add(pad);
      this.skinExtras.push(pad);
    }
    this.skinExtras.push(grin);
  }

  // ---- Diamond Hands (diamond): crystalline blue body, faceted gem head,
  //      shimmering facets, diamond-shine eyes. ----
  _diamondExtras(s) {
    this.bones.headMesh.material = metalMat(0xB3E5FC, 0.85, 0.1);
    this.bones.headMesh.material.needsUpdate = true;
    // gem facets on head (octahedron crown)
    const gemCrown = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), metalMat(0x4F8CFF, 0.9, 0.08));
    gemCrown.position.set(0, 0.42, 0); gemCrown.rotation.y = Math.PI / 4; this.bones.head.add(gemCrown);
    // sparkle eyes (cyan diamonds)
    for (const arr of [this.bones.irisL, this.bones.irisR]) {
      arr.forEach((m) => { m.material = basicMat(0xA3E635); m.scale.multiplyScalar(1.2); });
    }
    // crystalline shoulder gems
    for (const sx of [-1, 1]) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), metalMat(0xA3E635, 0.95, 0.05));
      shard.position.set(sx * 0.30, 0.14, 0); shard.rotation.y = Math.PI / 4; this.bones.chest.add(shard);
      this.skinExtras.push(shard);
    }
    // 💎 badge on chest
    const badge = this._part(new THREE.CircleGeometry(0.1, 16), basicMat(0x4F8CFF), this.bones.chest, 0, 0.05, 0.24);
    this.skinExtras.push(gemCrown, badge);
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
    // accent stripe + emoji badge on chest
    const badge = this._part(new THREE.CircleGeometry(0.1, 16), basicMat(s.accent), this.bones.chest, 0, 0.05, 0.24);
    // Add a basic sweatband to all generic characters so they aren't plain
    const bandGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.08, 18, 1, false);
    const bandMat = toonMat(s.accent);
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = 0.22;
    this.bones.head.add(band);
    this.skinExtras.push(band);

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
