// ============================================================
// STUMBLE PUMP — CharacterRig
// Procedural chibi humanoid built from Three.js primitives.
// Upgraded to AAA Stumble Guys quality: high poly count, 
// detailed limbs with thumbs, highly specific 3D sculpted extras 
// for KOLs to match their profile pictures perfectly.
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
    // Shifting hips down by 0.06 so feet perfectly touch Y=0
    const hips = this._bone('hips', this.root, 0, 0.86, 0);
    // Smoother, high-poly hips
    const hipMesh = this._part(new THREE.SphereGeometry(0.24, 24, 24), bodyMat, hips, 0, 0, 0, true);
    hipMesh.scale.y = 0.8;

    const spine = this._bone('spine', hips, 0, 0.12, 0);
    const chest = this._bone('chest', spine, 0, 0.22, 0);
    // Smooth tapered torso (capsule-like blending)
    const torso = this._part(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 24), bodyMat, chest, 0, -0.05, 0, true);
    this.bones.torsoMesh = torso;

    const neck = this._bone('neck', chest, 0, 0.2, 0);
    const head = this._bone('head', neck, 0, 0.34, 0);
    // Perfect sphere head
    const headMesh = this._part(new THREE.SphereGeometry(0.42, 32, 32), bodyMat, head, 0, 0, 0, true);
    this.bones.headMesh = headMesh;

    this._buildFace(head);
    this._buildArms(chest, limbMat);
    this._buildLegs(hips, limbMat);

    // Default Party Game Backpack
    const packGeo = new THREE.BoxGeometry(0.3, 0.4, 0.15, 4, 4, 4);
    const packMat = s.metal ? metalMat(s.accent, 0.8, 0.3) : toonMat(s.accent);
    const backpack = this._part(packGeo, packMat, chest, 0, 0.05, -0.25, true);
    const pocketGeo = new THREE.BoxGeometry(0.2, 0.2, 0.05, 2, 2, 2);
    const pocketMat = toonMat(s.body);
    this._part(pocketGeo, pocketMat, backpack, 0, -0.05, -0.08, true);

    this._applySkin(s);
  }

  _buildFace(head) {
    const eyeWhiteMat = basicMat(0xffffff);
    const irisMat = basicMat(0x1b6fd8);
    const pupilMat = basicMat(0x0a0a14);
    const browMat = toonMat(0x241a12);
    this.bones.eyeGroups = {};
    this.bones.irisL = []; this.bones.irisR = [];
    
    // Create large, expressive 3D eyes
    for (const sx of [-1, 1]) {
      const side = sx < 0 ? 'L' : 'R';
      const eyeG = new THREE.Object3D();
      eyeG.position.set(sx * 0.17, 0.05, 0.33);
      head.add(eyeG);
      this.bones.eyeGroups[side] = eyeG;
      
      const eg = this._part(new THREE.SphereGeometry(0.12, 24, 24), eyeWhiteMat, eyeG, 0, 0, 0);
      eg.scale.z = 0.5;
      
      const iris = this._part(new THREE.SphereGeometry(0.065, 16, 16), irisMat, eyeG, 0, 0, 0.06);
      iris.scale.z = 0.3;
      
      const pupil = this._part(new THREE.SphereGeometry(0.035, 16, 16), pupilMat, eyeG, 0, 0, 0.09);
      pupil.scale.z = 0.2;
      
      // Eye reflection highlight (anime/cute style)
      const highlight = this._part(new THREE.SphereGeometry(0.015, 8, 8), basicMat(0xffffff), eyeG, -0.02, 0.02, 0.10);
      highlight.scale.z = 0.2;

      if (side === 'L') this.bones.irisL = [iris, pupil, highlight]; 
      else this.bones.irisR = [iris, pupil, highlight];
      
      // Curved expressive eyebrow
      const browGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 8);
      const brow = this._part(browGeo, browMat, eyeG, 0, 0.16, 0.04);
      brow.rotation.z = Math.PI / 2;
      // Slight arch
      brow.rotation.y = sx * 0.2;
      this.bones['brow' + side] = brow;
    }
    
    // Cute curved mouth
    const mouthGeo = new THREE.TorusGeometry(0.08, 0.015, 8, 16, Math.PI);
    const mouth = this._part(mouthGeo, basicMat(0x3a1a1a), head, 0, -0.15, 0.39);
    mouth.rotation.x = Math.PI;
    this.bones.mouth = mouth;
  }

  _buildArms(chest, limbMat) {
    for (const sx of [-1, 1]) {
      const side = sx < 0 ? 'L' : 'R';
      const shoulder = this._bone('shoulder' + side, chest, sx * 0.28, 0.12, 0);
      const upper = this._bone(side.toLowerCase() + '_upperarm', shoulder, 0, -0.05, 0);
      this._part(new THREE.CapsuleGeometry(0.09, 0.28, 8, 16), limbMat, upper, 0, -0.18, 0, true);
      
      const lower = this._bone(side.toLowerCase() + '_lowerarm', upper, 0, -0.36, 0);
      this._part(new THREE.CapsuleGeometry(0.075, 0.24, 8, 16), limbMat, lower, 0, -0.16, 0, true);
      
      // Detailed hand with thumb
      const handGroup = new THREE.Group();
      handGroup.position.set(0, -0.34, 0);
      this._part(new THREE.SphereGeometry(0.1, 16, 16), limbMat, handGroup, 0, 0, 0, true);
      // Thumb
      const thumb = this._part(new THREE.CapsuleGeometry(0.03, 0.06, 8, 8), limbMat, handGroup, sx * -0.08, 0.03, 0.05);
      thumb.rotation.z = sx * Math.PI / 4;
      lower.add(handGroup);
      this.bones[side.toLowerCase() + '_hand'] = handGroup;
    }
  }

  _buildLegs(hips, limbMat) {
    for (const sx of [-1, 1]) {
      const side = sx < 0 ? 'L' : 'R';
      const hip = this._bone('hip' + side, hips, sx * 0.14, -0.05, 0);
      const upper = this._bone(side.toLowerCase() + '_upperleg', hip, 0, -0.05, 0);
      this._part(new THREE.CapsuleGeometry(0.11, 0.26, 8, 16), limbMat, upper, 0, -0.18, 0, true);
      
      const lower = this._bone(side.toLowerCase() + '_lowerleg', upper, 0, -0.36, 0);
      this._part(new THREE.CapsuleGeometry(0.09, 0.22, 8, 16), limbMat, lower, 0, -0.15, 0, true);
      
      // Stumble Guys style chunky feet (rounded)
      const footGeo = new THREE.CapsuleGeometry(0.1, 0.16, 8, 16);
      const foot = this._part(footGeo, limbMat, lower, 0, -0.3, 0.08, true);
      foot.rotation.x = Math.PI / 2;
      this.bones[side.toLowerCase() + '_foot'] = foot;
    }
  }

  _applySkin(s) {
    if (this.skinKey === 'shiller') this._shillerExtras(s);
    else if (this.skinKey === 'devsus') this._devsusExtras(s);
    else if (this.skinKey === 'trojan') this._trojanExtras(s);
    else if (this.skinKey === 'paperhand') this._paperhandExtras(s);
    
    // AAA KOL Models
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

  // ---- Ansem (@blknoiz06): High-detail backward cap, thick cuban chain, detailed earrings ----
  _ansemExtras(s) {
    this.bones.headMesh.material = toonMat(0x7c4921); // Warm rich brown
    this.bones.headMesh.material.needsUpdate = true;
    
    // High-poly backward cap
    const capBase = new THREE.Mesh(new THREE.SphereGeometry(0.44, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), toonMat(0x111424));
    capBase.position.y = 0.08; 
    this.bones.head.add(capBase);
    
    // Cap strap on the back (which is now on the front because it's backwards)
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.03, 8, 16, Math.PI*0.4), toonMat(0x111424));
    strap.rotation.x = Math.PI/2;
    strap.rotation.z = -Math.PI*0.2;
    strap.position.set(0, 0.12, 0);
    this.bones.head.add(strap);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 32, 1, false, 0, Math.PI), toonMat(0x111424));
    brim.rotation.x = -Math.PI / 2; 
    brim.rotation.z = Math.PI; // Face backwards
    brim.position.set(0, 0.08, -0.34); 
    this.bones.head.add(brim);

    // Thick 3D Cuban Link Chain
    const chainGroup = new THREE.Group();
    chainGroup.position.set(0, 0.18, 0.18);
    chainGroup.rotation.x = Math.PI / 2 + 0.2;
    const linkGeo = new THREE.TorusGeometry(0.04, 0.015, 8, 16);
    const goldMat = metalMat(0xffd700, 0.95, 0.15);
    for(let i=0; i<20; i++) {
        const link = new THREE.Mesh(linkGeo, goldMat);
        const a = (i/20) * Math.PI*2;
        link.position.set(Math.cos(a)*0.22, Math.sin(a)*0.22, 0);
        link.rotation.x = (i%2===0) ? Math.PI/2 : 0;
        link.rotation.y = a;
        chainGroup.add(link);
    }
    this.bones.chest.add(chainGroup);

    // SOL pendant
    const pendant = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), metalMat(0xA77BFF, 0.9, 0.2));
    pendant.position.set(0, 0.02, 0.27); 
    this.bones.chest.add(pendant);

    // Diamond stud earrings
    for (const sx of [-1, 1]) {
      const stud = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), metalMat(0xffffff, 1.0, 0.05));
      stud.position.set(sx * 0.41, -0.02, 0.05); 
      this.bones.head.add(stud);
      this.skinExtras.push(stud);
    }
    
    this.skinExtras.push(capBase, strap, brim, chainGroup, pendant);
  }

  // ---- Toly: Detailed sculpted beard, thick frame glasses, bald head ----
  _tolyExtras(s) {
    this.bones.headMesh.material = toonMat(0xf1c27d);
    this.bones.headMesh.material.needsUpdate = true;
    
    // High-poly sculpted beard
    const beardGeo = new THREE.SphereGeometry(0.44, 32, 24, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45);
    const beardMat = toonMat(0x3d332c);
    const beard = new THREE.Mesh(beardGeo, beardMat);
    beard.position.y = -0.02; 
    this.bones.head.add(beard);
    
    const must = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.16, 8, 16), beardMat);
    must.rotation.z = Math.PI/2;
    must.position.set(0, -0.06, 0.41); 
    this.bones.head.add(must);

    // Thick frame glasses
    const glassMat = toonMat(0x1A1A2A);
    const lensMat = metalMat(0x88CCFF, 0.4, 0.2); // slight reflection
    for (const sx of [-1, 1]) {
      // Frame
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 24), glassMat);
      frame.position.set(sx * 0.17, 0.06, 0.40); 
      // Shape it into a rounded rectangle
      frame.scale.set(1, 0.6, 1);
      this.bones.head.add(frame);
      // Lens
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.01, 24), lensMat);
      lens.rotation.x = Math.PI/2;
      lens.position.set(sx * 0.17, 0.06, 0.40); 
      lens.scale.set(1, 1, 0.6);
      this.bones.head.add(lens);
      // Arm
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.25), glassMat);
      arm.position.set(sx * 0.28, 0.06, 0.28); 
      this.bones.head.add(arm);
      this.skinExtras.push(frame, lens, arm);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.02), glassMat);
    bridge.position.set(0, 0.06, 0.41); 
    this.bones.head.add(bridge);

    this.skinExtras.push(beard, must, bridge);
  }

  // ---- Mert: Beanie with folds, thick hoodie, round glasses ----
  _mertExtras(s) {
    const hoodieMat = toonMat(0x1e3a8a); // Dark blue hoodie
    const torso = this.bones.torsoMesh;
    torso.material = hoodieMat;
    torso.scale.set(1.1, 1, 1.1); // Thicker torso

    // Hoodie pocket
    const pocket = this._part(new THREE.BoxGeometry(0.3, 0.15, 0.05), hoodieMat, this.bones.chest, 0, -0.1, 0.26, true);
    
    // Hood collar
    const hood = this._part(new THREE.TorusGeometry(0.26, 0.08, 16, 24), hoodieMat, this.bones.head, 0, -0.3, 0.05);
    hood.rotation.x = Math.PI / 2;

    // Beanie with realistic folds
    const beanieMat = toonMat(0x1B1D27);
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.5), beanieMat);
    beanie.position.y = 0.10; 
    // Add fold wrinkles
    beanie.scale.set(1, 1.1, 1);
    this.bones.head.add(beanie);
    
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.07, 16, 32), toonMat(0x2E3142));
    cuff.rotation.x = Math.PI / 2; 
    cuff.position.set(0, 0.08, 0); 
    this.bones.head.add(cuff);

    // Dark hair sticking out
    const hair = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.05, 8, 16, Math.PI), toonMat(0x111111));
    hair.rotation.x = Math.PI/2;
    hair.position.set(0, 0.03, 0.05); 
    this.bones.head.add(hair);

    // Round glasses
    const ringMat = metalMat(0x11141F, 0.5, 0.5);
    for (const sx of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 16, 24), ringMat);
      ring.position.set(sx * 0.17, 0.05, 0.41); 
      this.bones.head.add(ring); 
      this.skinExtras.push(ring);
    }
    
    this.skinExtras.push(pocket, hood, beanie, cuff, hair);
  }

  // ---- Orangie: Pure orange, high-quality meme eyes ----
  _orangieExtras(s) {
    this.bones.headMesh.material = toonMat(0xFF7A00);
    this.bones.headMesh.material.needsUpdate = true;
    this.bones.torsoMesh.material = toonMat(0xFF7A00);
    
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.5), toonMat(0xFF7A00));
    beanie.position.y = 0.10; this.bones.head.add(beanie);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.06, 16, 32), toonMat(0xCC5A00));
    cuff.rotation.x = Math.PI / 2; cuff.position.set(0, 0.08, 0); this.bones.head.add(cuff);
    
    this.skinExtras.push(beanie, cuff);
  }

  _cigarchadExtras(s) {
    const suit = this._part(new THREE.CylinderGeometry(0.25, 0.31, 0.5, 24), toonMat(0x1B1D27), this.bones.chest, 0, -0.04, 0);
    const collar = this._part(new THREE.ConeGeometry(0.14, 0.18, 4), basicMat(0xF4F6FB), this.bones.chest, 0, 0.06, 0.22);
    collar.rotation.y = Math.PI / 4;
    const tie = this._part(new THREE.BoxGeometry(0.07, 0.28, 0.03), metalMat(0xFFD23F, 0.8, 0.25), this.bones.chest, 0, -0.02, 0.23);
    
    const cigar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 16), toonMat(0x6B3A1A));
    cigar.rotation.z = Math.PI / 2; cigar.position.set(0.12, -0.15, 0.40); this.bones.head.add(cigar);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.05, 16), metalMat(0xFFD23F, 0.9, 0.2));
    band.rotation.z = Math.PI / 2; band.position.set(0.06, -0.15, 0.40); this.bones.head.add(band);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), basicMat(0xFF5151));
    ember.position.set(0.26, -0.15, 0.40); this.bones.head.add(ember);

    // Gold Sunglasses
    const frameGeo = new THREE.BoxGeometry(0.35, 0.12, 0.04);
    const frameMat = metalMat(0xFFD23F, 0.9, 0.1);
    const lensGeo = new THREE.BoxGeometry(0.14, 0.08, 0.05);
    const lensMat = basicMat(0x111111);
    const shadesGroup = new THREE.Group();
    shadesGroup.position.set(0, 0.05, 0.42);
    this._part(frameGeo, frameMat, shadesGroup, 0, 0, 0);
    this._part(lensGeo, lensMat, shadesGroup, -0.09, 0, 0);
    this._part(lensGeo, lensMat, shadesGroup, 0.09, 0, 0);
    this.bones.head.add(shadesGroup);
    
    this.skinExtras.push(suit, collar, tie, cigar, band, ember, shadesGroup);
  }

  _cupseyExtras(s) {
    const cup = this._part(new THREE.CylinderGeometry(0.3, 0.22, 0.5, 24, 1, false), toonMat(0xF4F6FB), this.bones.chest, 0, -0.02, 0);
    const sleeve = this._part(new THREE.CylinderGeometry(0.275, 0.275, 0.14, 24, 1, false), toonMat(0xC97A2A), this.bones.chest, 0, -0.06, 0);
    const lid = this._part(new THREE.CylinderGeometry(0.31, 0.31, 0.06, 24), toonMat(0x5FCB88), this.bones.chest, 0, 0.25, 0);
    const straw = this._part(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 12), toonMat(0xA3E635), this.bones.head, 0.1, 0.5, 0);
    straw.rotation.z = 0.3;
    this.skinExtras.push(cup, sleeve, lid, straw);
  }

  _percentExtras(s) {
    const capBase = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), toonMat(0x2FAE6A));
    capBase.position.y = 0.08; this.bones.head.add(capBase);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 24, 1, false, 0, Math.PI), toonMat(0x1D3934));
    brim.rotation.x = -Math.PI / 2; brim.position.set(0, 0.08, 0.34); this.bones.head.add(brim);
    const hud = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 24), metalMat(0x11141F, 0.7, 0.3));
    hud.rotation.x = Math.PI / 2; hud.position.set(0.17, 0.05, 0.40); this.bones.head.add(hud);
    const hudLens = new THREE.Mesh(new THREE.CircleGeometry(0.08, 24), basicMat(0xA3E635));
    hudLens.position.set(0.17, 0.05, 0.435); this.bones.head.add(hudLens);
    this.skinExtras.push(capBase, brim, hud, hudLens);
  }

  _frogExtras(s) {
    this.bones.headMesh.material = toonMat(0x5FCB88);
    this.bones.headMesh.material.needsUpdate = true;
    for (const sx of [-1, 1]) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 24), toonMat(0xA3E635));
      bulb.position.set(sx * 0.18, 0.38, 0.15); this.bones.head.add(bulb);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), basicMat(0x0B0E1A));
      pupil.position.set(sx * 0.18, 0.42, 0.28); this.bones.head.add(pupil);
      this.skinExtras.push(bulb, pupil);
    }
    for (const arr of [this.bones.irisL, this.bones.irisR]) arr.forEach((m) => { m.visible = false; });
    const grinGeo = new THREE.TorusGeometry(0.15, 0.02, 8, 24, Math.PI);
    const grin = new THREE.Mesh(grinGeo, basicMat(0x1D3934));
    grin.rotation.x = Math.PI;
    grin.position.set(0, -0.05, 0.4); this.bones.head.add(grin);
    this.skinExtras.push(grin);
  }

  _diamondExtras(s) {
    this.bones.headMesh.material = metalMat(0xB3E5FC, 0.95, 0.05);
    this.bones.headMesh.material.needsUpdate = true;
    this.bones.torsoMesh.material = metalMat(0xB3E5FC, 0.95, 0.05);
    this.bones.torsoMesh.material.needsUpdate = true;
    
    const gemCrown = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), metalMat(0x4F8CFF, 0.9, 0.08));
    gemCrown.position.set(0, 0.45, 0); gemCrown.rotation.y = Math.PI / 4; this.bones.head.add(gemCrown);
    for (const arr of [this.bones.irisL, this.bones.irisR]) {
      arr.forEach((m) => { m.material = basicMat(0xA3E635); m.scale.multiplyScalar(1.2); });
    }

    // Convert hands to shiny blue diamonds
    const handMat = metalMat(0x4F8CFF, 1.0, 0.02);
    for (const side of ['l_hand', 'r_hand']) {
      const handGroup = this.bones[side];
      // clear default hand
      while(handGroup.children.length > 0){ 
          handGroup.remove(handGroup.children[0]); 
      }
      // Add diamond
      const diamondHand = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), handMat);
      handGroup.add(diamondHand);
      this.skinExtras.push(diamondHand);
    }
    
    this.skinExtras.push(gemCrown);
  }

  _shillerExtras(s) {
    const glasses = this._part(new THREE.BoxGeometry(0.32, 0.1, 0.04), basicMat(0x000000), this.bones.head, 0, 0.05, 0.4);
    const tie = this._part(new THREE.BoxGeometry(0.08, 0.3, 0.03), basicMat(s.accent), this.bones.chest, 0, 0, 0.22);
    const cone = this._part(new THREE.ConeGeometry(0.18, 0.34, 16), basicMat(0xff6b00), this.bones.l_hand, 0, -0.2, 0.1);
    cone.rotation.x = Math.PI / 2;
    this.skinExtras.push(glasses, tie, cone);
  }

  _devsusExtras(s) {
    const hood = this._part(new THREE.SphereGeometry(0.46, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), toonMat(0x202028), this.bones.head, 0, 0.05, -0.02);
    const mask = this._part(new THREE.PlaneGeometry(0.5, 0.4), basicMat(0xf0f0f0), this.bones.head, 0, 0, 0.41);
    for (const arr of [this.bones.irisL, this.bones.irisR]) {
      arr.forEach((m) => { m.material = basicMat(0x00ff88); m.scale.multiplyScalar(1.3); });
    }
    const laptop = this._part(new THREE.BoxGeometry(0.4, 0.26, 0.03), basicMat(0x111111), this.bones.chest, 0, 0.05, -0.24);
    this.skinExtras.push(hood, mask, laptop);
  }

  _trojanExtras(s) {
    const visor = this._part(new THREE.BoxGeometry(0.5, 0.08, 0.06), basicMat(0xff0000), this.bones.head, 0, 0.06, 0.4);
    for (const arr of [this.bones.irisL, this.bones.irisR]) arr.forEach((m) => m.visible = false);
    this.skinExtras.push(visor);
  }

  _paperhandExtras(s) {
    this.setFace('sweating');
    const tee = this._part(new THREE.CylinderGeometry(0.24, 0.3, 0.45, 24), basicMat(0xffffff), this.bones.chest, 0, -0.05, 0);
    this.sweatDrops = [];
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), basicMat(0x9bd6ff));
      d.position.set(0.2 + i * 0.05, 0.2, 0.4);
      d.material.transparent = true; d.material.opacity = 0.8;
      this.bones.head.add(d);
      this.sweatDrops.push(d);
      this.skinExtras.push(d);
    }
  }

  _genericExtras(s) {
    const bandGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.08, 32, 1, false);
    const bandMat = toonMat(s.accent);
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = 0.22;
    this.bones.head.add(band);
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
        if (browL) browL.rotation.z = Math.PI/2; if (browR) browR.rotation.z = Math.PI/2;
        break;
      case 'sweating':
        mouth.scale.set(0.6, 1.6, 1); mouth.material.color.setHex(0x2a1a2a);
        if (browL) browL.rotation.z = Math.PI/2 - 0.3; if (browR) browR.rotation.z = Math.PI/2 + 0.3;
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
