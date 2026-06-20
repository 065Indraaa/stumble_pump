import * as THREE from './three.module.js';
// Post-processing imports removed — bloom/neon disabled for clean bright look

// ============================================================
// STUMBLE PUMP — single-page WebGL party royale (Stumble Guys clone)
// ============================================================

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile(), powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 6, 12);

// lights — bright cheerful outdoor lighting (Stumble Guys style) ----
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(20, 30, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 160;
sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(sun.target);
const ambient = new THREE.AmbientLight(0xB0D8F0, 1.0);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0x87CEEB, 0x8FD4A0, 0.8);
scene.add(hemi);

// No post-processing bloom — clean, bright, non-neon look
let composer = null, bloomPass = null, BLOOM_ON = false;
function initComposer(){ /* no-op, bloom disabled */ }
function renderFrame(){ renderer.render(scene, camera); }

function isMobile(){ return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent); }
const MOBILE = isMobile();

// 3-step toon gradient ramp --------------------------------------
function makeGradientMap(){
  const g = new THREE.DataTexture(new Uint8Array([120,200,255]), 3, 1, THREE.RedFormat);
  g.magFilter = THREE.NearestFilter; g.minFilter = THREE.NearestFilter; g.needsUpdate = true;
  return g;
}
const GRAD = makeGradientMap();

function toonMat(color){ return new THREE.MeshToonMaterial({ color, gradientMap: GRAD }); }
function basicMat(color){ return new THREE.MeshBasicMaterial({ color }); }
function metalMat(color){ return new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.15 }); }

// texture loader + cache --------------------------------------------
const TEXLOADER = new THREE.TextureLoader();
const TEXCACHE = {};
function tex(url){
  if (!TEXCACHE[url]){
    const t = TEXLOADER.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    TEXCACHE[url] = t;
  }
  return TEXCACHE[url];
}
const ARENA_BG = {
  bonding: 'assets/textures/bonding_bg.jpeg',
  rugpull: 'assets/textures/rugpull_bg.jpeg',
  moon: 'assets/textures/moon_bg.jpeg',
  liquidation: 'assets/textures/liquidation_bg.jpeg',
  menu_bg: 'assets/textures/menu_bg.jpeg',
};
// ---- bright stylized sky themes (Stumble Guys cheerful outdoor look) ----
// Vertical gradient sky — clean, colorful, no neon, no dark moody tones.
const SKY_THEMES = {
  [ARENA_BG.bonding]:     { top:'#5BC0F8', mid:'#7DD3F0', bot:'#A8E6F5', glow:'#E0F4FA', stars:false },
  [ARENA_BG.rugpull]:     { top:'#7C3AED', mid:'#A78BFA', bot:'#DDD6FE', glow:'#F5F3FF', stars:false },
  [ARENA_BG.moon]:        { top:'#1E3A8A', mid:'#3B82F6', bot:'#93C5FD', glow:'#DBEAFE', stars:true  },
  [ARENA_BG.liquidation]: { top:'#F97316', mid:'#FB923C', bot:'#FED7AA', glow:'#FFF7ED', stars:false },
  [ARENA_BG.menu_bg]:     { top:'#5BC0F8', mid:'#7DD3F0', bot:'#A8E6F5', glow:'#E0F4FA', stars:false },
};
const SKY_TEX_CACHE = {};
function makeSkyTexture(key){
  if (SKY_TEX_CACHE[key]) return SKY_TEX_CACHE[key];
  const th = SKY_THEMES[key] || SKY_THEMES[ARENA_BG.menu_bg];
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 512; const cx = cv.getContext('2d');
  const g = cx.createLinearGradient(0,0,0,512);
  g.addColorStop(0, th.top); g.addColorStop(0.55, th.mid); g.addColorStop(0.85, th.bot); g.addColorStop(1, th.glow);
  cx.fillStyle = g; cx.fillRect(0,0,16,512);
  if (th.stars){ cx.fillStyle = '#ffffff'; for (let i=0;i<60;i++){ const y=Math.random()*340; const a=0.25+Math.random()*0.6; cx.globalAlpha=a; cx.fillRect(Math.random()*16, y, 1, 1); } cx.globalAlpha=1; }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  SKY_TEX_CACHE[key] = t; return t;
}
// curved panoramic sky dome placed far behind an arena (full cylinder facing inward)
function makeBackdrop(url, opts={}){
  const radius = opts.radius || 240;
  const height = opts.height || 150;
  const yPos = opts.y != null ? opts.y : 30;
  const startAngle = opts.start != null ? opts.start : 0;
  const lenAngle = opts.len != null ? opts.len : Math.PI*2;
  const geo = new THREE.CylinderGeometry(radius, radius, height, 48, 1, true, startAngle, lenAngle);
  const mat = new THREE.MeshBasicMaterial({ map: makeSkyTexture(url), side: THREE.BackSide, fog:false, depthWrite:false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(opts.x||0, yPos, opts.z||0);
  mesh.rotation.y = opts.rot || 0;
  mesh.renderOrder = -10;
  return mesh;
}
// flat billboard backdrop (for distant wall behind a race lane)
function makeBackWall(url, w, h, x, y, z){
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({ map: tex(url), fog:false, depthWrite:false, transparent:true }));
  m.position.set(x,y,z); m.renderOrder=-9; return m;
}

// black back-face outline -----------------------------------------
function addOutline(mesh, thickness = 0.06){
  const m = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide }));
  m.scale.multiplyScalar(1 + thickness);
  m.raycast = () => {};
  mesh.add(m);
  return m;
}

// global clock + state -------------------------------------------
const clock = new THREE.Clock();
let GAME = null;            // current state controller
const shared = {
  scene, camera, renderer, sun, GRAD,
  selectedSkin: 'shiller',
  selectedEmote: 'moon',
  selectedTrail: 'rocket',
  round: 1,
  mute: localStorage.getItem('stumblePump_mute') === '1',
  quality: localStorage.getItem('stumblePump_quality') || 'high',
  bestFinish: 99,
  user: null,
};

// ============================================================
// AUTH — local register / login (persists profile in localStorage)
// ============================================================
const Auth = (() => {
  const UKEY='stumblePump_users', SKEY='stumblePump_session';
  function hash(s){ let h=5381; for(let i=0;i<s.length;i++) h=(((h<<5)+h)^s.charCodeAt(i))>>>0; return h.toString(36); }
  function users(){ try{ return JSON.parse(localStorage.getItem(UKEY))||{}; }catch(e){ return {}; } }
  function saveUsers(u){ localStorage.setItem(UKEY, JSON.stringify(u)); }
  function newProfile(name){ return { name, level:1, coins:500, gems:10, skin:'shiller', emote:'moon', trail:'rocket', wins:0, games:0, guest:false, solana:'', ownedSkins:['shiller','devsus','trojan','paperhand'] }; }
  function register(u,p,sol){ u=(u||'').trim(); if(u.length<3) return {err:'Username min 3 characters'}; if((p||'').length<3) return {err:'Password min 3 characters'}; const all=users(); if(all[u.toLowerCase()]) return {err:'Username already taken'}; const prof=newProfile(u); prof.solana=(sol||'').trim(); all[u.toLowerCase()]={pass:hash(p), profile:prof}; saveUsers(all); localStorage.setItem(SKEY,u.toLowerCase()); return {ok:true, profile:prof}; }
  function login(u,p){ u=(u||'').trim(); const rec=users()[u.toLowerCase()]; if(!rec) return {err:'No account with that name'}; if(rec.pass!==hash(p)) return {err:'Wrong password'}; localStorage.setItem(SKEY,u.toLowerCase()); return {ok:true, profile:rec.profile }; }
  function updateSolana(sol){ const s=localStorage.getItem(SKEY); if(!s) return; const all=users(); if(all[s]){ all[s].profile.solana=(sol||'').trim(); saveUsers(all); } }
  function guest(){ const prof=newProfile('Degen'+Math.floor(Math.random()*9000+1000)); prof.guest=true; return {ok:true, profile:prof}; }
  function session(){ const s=localStorage.getItem(SKEY); if(!s) return null; const rec=users()[s]; return rec?rec.profile:null; }
  function save(prof){ if(!prof||prof.guest) return; const all=users(); const k=prof.name.toLowerCase(); if(all[k]){ all[k].profile=prof; saveUsers(all); } }
  function logout(){ localStorage.removeItem(SKEY); }
  return { register, login, guest, session, save, logout, updateSolana };
})();

function applyProfile(prof){
  shared.user = prof;
  // migrate older profiles that predate the unlockable roster
  if (!Array.isArray(prof.ownedSkins)) prof.ownedSkins = ['shiller','devsus','trojan','paperhand'];
  shared.selectedSkin = prof.skin || 'shiller';
  shared.selectedEmote = prof.emote || 'moon';
  shared.selectedTrail = prof.trail || 'rocket';
  updateTopBar();
}

// ---- skin ownership / store ----
function skinOwned(key){
  const s = SKINS[key]; if (!s) return false;
  if (s.cost === 0 || s.owned) return true;
  const u = shared.user;
  return !!(u && Array.isArray(u.ownedSkins) && u.ownedSkins.includes(key));
}
function buySkin(key){
  const s = SKINS[key]; const u = shared.user;
  if (!s || !u) return { err:'No profile' };
  if (skinOwned(key)) return { ok:true, already:true };
  if ((u.coins||0) < s.cost) return { err:'Not enough coins' };
  u.coins -= s.cost;
  if (!Array.isArray(u.ownedSkins)) u.ownedSkins = [];
  u.ownedSkins.push(key);
  Auth.save(u); updateTopBar();
  return { ok:true };
}
function updateTopBar(){
  const u = shared.user; if (!u) return;
  document.querySelector('.pi-name').textContent = u.name;
  document.getElementById('player-level').textContent = u.level;
  document.getElementById('gem-count').textContent = u.gems;
  document.getElementById('coin-count').textContent = (u.coins||0).toLocaleString();
}

// resize ----------------------------------------------------------
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer?.setSize(innerWidth, innerHeight);
  bloomPass?.resolution.set(innerWidth, innerHeight);
});

// camera shake helper --------------------------------------------
const camShake = { t: 0, intensity: 0, dur: 0 };
function shakeCamera(intensity, duration){ camShake.intensity = intensity; camShake.dur = duration; camShake.t = duration; }
function applyCamShake(dt){
  if (camShake.t > 0){
    camShake.t -= dt;
    const k = Math.max(0, camShake.t / camShake.dur) * camShake.intensity;
    camera.position.x += (Math.random()-0.5) * k;
    camera.position.y += (Math.random()-0.5) * k;
  }
}

// ============================================================
// AUDIO MANAGER — procedural Web Audio
// ============================================================
const Audio = (() => {
  let ctx = null, master = null, ambientNodes = [];
  function ensure(){
    if (!ctx){
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = shared.mute ? 0 : 0.6;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  function setMute(m){ shared.mute = m; localStorage.setItem('stumblePump_mute', m?'1':'0'); if (master) master.gain.value = m?0:0.6; }
  function tone(freq, freq2, dur, type='sine', gain=0.3){
    ensure(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }
  function noise(dur, gain=0.5){
    ensure(); if (!ctx) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = gain;
    const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1800;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  const SFX = {
    jump(){ tone(440,660,0.12,'sine',0.3); },
    land(){ noise(0.1,0.4); },
    hit(){ noise(0.32,0.6); tone(120,40,0.3,'sawtooth',0.25); },
    qualify(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,f,0.18,'sine',0.3),i*90)); },
    eliminate(){ tone(440,110,0.7,'sawtooth',0.3); },
    beep(){ tone(880,880,0.07,'square',0.25); },
    go(){ tone(660,1320,0.3,'square',0.35); },
    spin(){ tone(1400,300,1.6,'sawtooth',0.18); },
    ding(){ tone(1568,1568,0.4,'sine',0.3); },
    bounce(){ tone(300,900,0.18,'sine',0.35); },
    coin(){ tone(988,1318,0.12,'square',0.2); },
    click(){ tone(660,440,0.06,'square',0.2); },
  };
  function startAmbient(){
    ensure(); if (!ctx) return; stopAmbient();
    [110,164.81,220].forEach(f=>{
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type='sine'; o.frequency.value=f; g.gain.value=0.04;
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value=0.1; lg.gain.value=0.02; lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(master); o.start(); lfo.start();
      ambientNodes.push(o, lfo);
    });
  }
  function stopAmbient(){ ambientNodes.forEach(n=>{try{n.stop()}catch(e){}}); ambientNodes=[]; }
  return { SFX, setMute, startAmbient, stopAmbient, ensure };
})();

// ============================================================
// INPUT MANAGER
// ============================================================
const Input = {
  keys: {}, move: new THREE.Vector2(), // x=strafe, y=forward
  jump: false, dive: false, emote: false,
  camYaw: 0.0, camPitch: 0.28,
  _dragging: false, _lastX: 0, _lastY: 0,
  consumeJump(){ if (this.jump){ this.jump=false; return true; } return false; },
  consumeDive(){ if (this.dive){ this.dive=false; return true; } return false; },
  consumeEmote(){ if (this.emote){ this.emote=false; return true; } return false; },
};
addEventListener('keydown', e => {
  Input.keys[e.code] = true;
  if (e.code === 'Space'){ Input.jump = true; e.preventDefault(); }
  if (e.code === 'ShiftLeft' || e.code === 'ControlLeft') Input.dive = true;
  if (e.code === 'KeyE') Input.emote = true;
});
addEventListener('keyup', e => { Input.keys[e.code] = false; });

function readKeyboardMove(){
  let x=0,y=0;
  if (Input.keys['KeyW']||Input.keys['ArrowUp']) y+=1;
  if (Input.keys['KeyS']||Input.keys['ArrowDown']) y-=1;
  if (Input.keys['KeyA']||Input.keys['ArrowLeft']) x-=1;
  if (Input.keys['KeyD']||Input.keys['ArrowRight']) x+=1;
  if (!MOBILE){ Input.move.set(x,y); if (Input.move.lengthSq()>1) Input.move.normalize(); }
}

// mouse orbit
canvas.addEventListener('pointerdown', e=>{ Input._dragging=true; Input._lastX=e.clientX; Input._lastY=e.clientY; });
addEventListener('pointerup', ()=> Input._dragging=false);
addEventListener('pointermove', e=>{
  if (!Input._dragging) return;
  Input.camYaw -= (e.clientX-Input._lastX)*0.006;
  Input.camPitch = Math.max(0.05, Math.min(0.9, Input.camPitch + (e.clientY-Input._lastY)*0.004));
  Input._lastX=e.clientX; Input._lastY=e.clientY;
});

// mobile joystick
function initMobileControls(){
  if (!MOBILE) return;
  const joy = document.getElementById('joystick');
  const knob = document.getElementById('joy-knob');
  let active=false, cx=0, cy=0, id=null;
  joy.addEventListener('touchstart', e=>{ active=true; const r=joy.getBoundingClientRect(); cx=r.left+r.width/2; cy=r.top+r.height/2; id=e.changedTouches[0].identifier; e.preventDefault(); });
  joy.addEventListener('touchmove', e=>{
    if(!active) return;
    for (const t of e.changedTouches){ if (t.identifier!==id) continue;
      let dx=t.clientX-cx, dy=t.clientY-cy; const max=45; const d=Math.hypot(dx,dy);
      if (d>max){ dx=dx/d*max; dy=dy/d*max; }
      knob.style.transform=`translate(${dx}px,${dy}px)`;
      Input.move.set(dx/max, -dy/max);
    } e.preventDefault();
  });
  const end=()=>{ active=false; knob.style.transform='translate(0,0)'; Input.move.set(0,0); };
  joy.addEventListener('touchend', end); joy.addEventListener('touchcancel', end);
  document.getElementById('btn-jump').addEventListener('touchstart', e=>{ Input.jump=true; e.preventDefault(); });
  document.getElementById('btn-dive').addEventListener('touchstart', e=>{ Input.dive=true; e.preventDefault(); });
  document.getElementById('btn-emote').addEventListener('touchstart', e=>{ Input.emote=true; e.preventDefault(); });
  // swipe camera on right side
  let sx=0, sActive=false;
  addEventListener('touchstart', e=>{ const t=e.touches[0]; if (t.clientX > innerWidth*0.5){ sActive=true; sx=t.clientX; } });
  addEventListener('touchmove', e=>{ if(!sActive)return; const t=e.touches[0]; Input.camYaw -= (t.clientX-sx)*0.01; sx=t.clientX; });
  addEventListener('touchend', ()=> sActive=false);
}

// ============================================================
// CHARACTER RIG — procedural chibi humanoid
// ============================================================
// Base roster (free / owned by default) + unlockable Solana-KOL caricature archetypes.
// KOL skins are stylized parody archetypes (NOT literal likenesses) inspired by
// prominent Solana traders, kept safely within the cartoon art style.
const SKINS = {
  shiller:  { name:'THE SHILLER', rarity:'common',    emoji:'📢', body:0x1a3a8f, accent:0x3a6fd8, owned:true, cost:0 },
  devsus:   { name:'DEV (SUS)',   rarity:'rare',      emoji:'🥷', body:0x111111, accent:0x00ff88, owned:true, cost:0 },
  trojan:   { name:'TROJAN BOT',  rarity:'epic',      emoji:'🤖', body:0xc0c0c0, accent:0xff0000, owned:true, metal:true, cost:0 },
  paperhand:{ name:'PAPERHAND',   rarity:'legendary', emoji:'🧻', body:0xf5deb3, accent:0xffffff, owned:true, cost:0 },
  // ---- Solana KOL caricature archetypes (unlockable) ----
  whale:    { name:'THE BLUE WHALE', rarity:'legendary', emoji:'🐳', body:0x1b4fd8, accent:0x35d6ff, owned:false, cost:1200, kol:'Ansem-inspired' },
  cigarchad:{ name:'CIGAR CHAD',     rarity:'epic',      emoji:'🚬', body:0x2a2a33, accent:0xffd700, owned:false, cost:800,  kol:'Mitch-inspired' },
  orange:   { name:'ORANGE PILLED',  rarity:'rare',      emoji:'🟠', body:0xff7a18, accent:0xffffff, owned:false, cost:400,  kol:'Orangie-inspired' },
  cupsey:   { name:'THE CUP',        rarity:'epic',      emoji:'🥤', body:0xe8e8f0, accent:0x18c0b0, owned:false, cost:800,  kol:'Cupsey-inspired' },
  percent:  { name:'PERCENT',        rarity:'rare',      emoji:'📊', body:0x16c060, accent:0x0a2a18, owned:false, cost:450,  kol:'Cented-inspired' },
  validator:{ name:'THE VALIDATOR',  rarity:'legendary', emoji:'🟣', body:0x9945ff, accent:0x14f195, owned:false, cost:1500, kol:'Toly-inspired' },
  rpcwiz:   { name:'RPC WIZARD',     rarity:'epic',      emoji:'🧙', body:0x3a2a70, accent:0xffd24a, owned:false, cost:900,  kol:'Mert-inspired' },
  frogdegen:{ name:'FROG DEGEN',     rarity:'rare',      emoji:'🐸', body:0x4caf50, accent:0x1f5f24, owned:false, cost:350,  kol:'mr.frog-inspired' },
};

class Character {
  constructor(skinKey, isPlayer=false){
    this.skinKey = skinKey;
    this.isPlayer = isPlayer;
    this.skin = SKINS[skinKey] || SKINS.shiller;
    this.root = new THREE.Object3D();
    this.bones = {};
    this.faceState = 'normal';
    this.skinExtras = [];
    this._build();
  }

  _part(geo, mat, parent, x=0,y=0,z=0, outline=false){
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x,y,z);
    m.castShadow = true;
    parent.add(m);
    if (outline) addOutline(m, 0.05);
    return m;
  }

  _bone(name, parent, x=0,y=0,z=0){
    const b = new THREE.Object3D(); b.position.set(x,y,z); parent.add(b); this.bones[name]=b; return b;
  }

  _build(){
    const s = this.skin;
    const bodyMat = s.metal ? metalMat(s.body) : toonMat(s.body);
    const limbMat = s.metal ? metalMat(s.body) : toonMat(s.body);
    this.bodyMat = bodyMat;

    const hips = this._bone('hips', this.root, 0, 0.92, 0);
    // hips visual (flattened sphere)
    const hipMesh = this._part(new THREE.SphereGeometry(0.24,12,10), bodyMat, hips, 0,0,0, true);
    hipMesh.scale.y = 0.7;

    const spine = this._bone('spine', hips, 0, 0.12, 0);
    const chest = this._bone('chest', spine, 0, 0.22, 0);
    // torso (tapered cylinder)
    const torso = this._part(new THREE.CylinderGeometry(0.22,0.28,0.5,14), bodyMat, chest, 0,-0.05,0, true);
    this.bones.torsoMesh = torso;

    const neck = this._bone('neck', chest, 0, 0.2, 0);
    const head = this._bone('head', neck, 0, 0.34, 0);
    const headMesh = this._part(new THREE.SphereGeometry(0.42,18,18), bodyMat, head, 0,0,0, true);
    this.bones.headMesh = headMesh;

    // ----- expressive cartoon face -----
    const eyeWhiteMat = basicMat(0xffffff);
    const irisMat = basicMat(0x1b6fd8);
    const pupilMat = basicMat(0x0a0a14);
    const browMat = toonMat(0x241a12);
    this.bones.eyeGroups = {};
    for (const sx of [-1,1]){
      const side = sx<0?'L':'R';
      const eyeG = new THREE.Object3D(); eyeG.position.set(sx*0.17, 0.05, 0.33); head.add(eyeG);
      this.bones.eyeGroups[side] = eyeG;
      // big white eyeball
      const eg = this._part(new THREE.SphereGeometry(0.115,16,16), eyeWhiteMat, eyeG, 0,0,0);
      eg.scale.z = 0.55;
      // colored iris
      const iris = this._part(new THREE.CircleGeometry(0.06,16), irisMat, eyeG, 0,0,0.085);
      // pupil
      const pup = this._part(new THREE.CircleGeometry(0.032,12), pupilMat, eyeG, 0,0,0.092);
      // glint highlight
      const glint = this._part(new THREE.CircleGeometry(0.016,8), basicMat(0xffffff), eyeG, 0.025,0.03,0.095);
      // eyebrow (tiltable)
      const brow = this._part(new THREE.BoxGeometry(0.13,0.028,0.05), browMat, head, sx*0.17, 0.21, 0.36);
      this.bones['eye'+side] = eg;
      this.bones['iris'+side] = iris;
      this.bones['pupil'+side] = pup;
      this.bones['glint'+side] = glint;
      this.bones['brow'+side] = brow;
    }
    // small nose
    this._part(new THREE.SphereGeometry(0.045,10,10), toonMat(s.metal?0x999999:0xe8a878), head, 0, -0.02, 0.42).scale.set(1,0.8,0.7);
    // blush cheeks
    for (const sx of [-1,1]){
      const blush = this._part(new THREE.CircleGeometry(0.05,12), new THREE.MeshBasicMaterial({color:0xff7a9a,transparent:true,opacity:0.45}), head, sx*0.26,-0.08,0.34);
      this.bones['blush'+(sx<0?'L':'R')] = blush;
    }
    // mouth (smile arc) + open-mouth disc for shock/panic states
    const mouth = this._part(new THREE.TorusGeometry(0.085,0.024,8,18,Math.PI), basicMat(0x351515), head, 0,-0.14,0.39);
    mouth.rotation.z = Math.PI; this.bones.mouth = mouth;
    const mouthO = this._part(new THREE.CircleGeometry(0.06,16), basicMat(0x200808), head, 0,-0.16,0.4);
    mouthO.visible = false; this.bones.mouthO = mouthO;

    // arms
    for (const side of [['L',-1],['R',1]]){
      const [tag, dir] = side;
      const sh = this._bone(tag+'_shoulder', chest, dir*0.26, 0.06, 0);
      const ua = this._bone(tag+'_upperarm', sh, 0, -0.18, 0);
      this._part(new THREE.CapsuleGeometry(0.1,0.3,6,10), limbMat, ua, 0,-0.05,0, true);
      const la = this._bone(tag+'_lowerarm', ua, 0, -0.28, 0);
      this._part(new THREE.CapsuleGeometry(0.085,0.24,6,8), limbMat, la, 0,-0.04,0);
      const hand = this._bone(tag+'_hand', la, 0, -0.24, 0);
      this._part(new THREE.SphereGeometry(0.1,10,10), limbMat, hand, 0,0,0);
    }

    // legs
    for (const side of [['L',-1],['R',1]]){
      const [tag, dir] = side;
      const hip = this._bone(tag+'_hip', hips, dir*0.13, -0.1, 0);
      const ul = this._bone(tag+'_upperleg', hip, 0, -0.16, 0);
      this._part(new THREE.CapsuleGeometry(0.13,0.28,6,10), limbMat, ul, 0,-0.06,0, true);
      const ll = this._bone(tag+'_lowerleg', ul, 0, -0.3, 0);
      this._part(new THREE.CapsuleGeometry(0.11,0.24,6,8), limbMat, ll, 0,-0.05,0);
      const foot = this._bone(tag+'_foot', ll, 0, -0.26, 0.04);
      // shoe = cylinder + box merged feel
      const shoe = this._part(new THREE.BoxGeometry(0.2,0.12,0.3), toonMat(0x222230), foot, 0,-0.04,0.06);
      this._part(new THREE.CylinderGeometry(0.1,0.1,0.2,10), toonMat(0x222230), foot, 0,-0.04,-0.04).rotation.z=Math.PI/2;
    }

    this._applySkin();
    this.root.traverse(o=>{ if (o.isMesh) o.castShadow = true; });
    // soft contact shadow blob
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.5,20), new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.32,depthWrite:false}));
    blob.rotation.x=-Math.PI/2; blob.position.y=0.03; blob.castShadow=false; blob.raycast=()=>{}; this.root.add(blob); this.shadowBlob=blob;
  }

  _applySkin(){
    const s = this.skin, b = this.bones;
    if (this.skinKey === 'shiller'){
      // sharp blue suit jacket + lapels + gold tie
      this._part(new THREE.BoxGeometry(0.52,0.52,0.38), toonMat(0x3a6fd8), b.chest, 0,-0.05,0.02, true);
      for (const sx of [-1,1]) this._part(new THREE.BoxGeometry(0.12,0.34,0.06), toonMat(0x2a55b8), b.chest, sx*0.18,-0.02,0.21).rotation.z=sx*0.25;
      this._part(new THREE.BoxGeometry(0.18,0.16,0.05), basicMat(0xffffff), b.chest, 0,0.08,0.21); // shirt collar
      this._part(new THREE.BoxGeometry(0.07,0.32,0.06), toonMat(0xffd700), b.chest, 0,-0.1,0.22);
      // slicked hair
      this._part(new THREE.SphereGeometry(0.43,16,16,0,Math.PI*2,0,Math.PI*0.55), toonMat(0x140d08), b.head, 0,0.1,-0.02).scale.set(1.02,0.9,1.05);
      // sunglasses: dark lenses + bridge + gold frame
      const glass = this._part(new THREE.BoxGeometry(0.46,0.14,0.06), basicMat(0x0a0a12), b.head, 0,0.06,0.4);
      this._part(new THREE.BoxGeometry(0.46,0.03,0.07), metalMat(0xffd700), b.head, 0,0.13,0.41);
      this.glasses = glass;
      // megaphone in L hand
      const meg = new THREE.Group();
      meg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.16,10), metalMat(0xff6b00)));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.17,0.22,14,1,true), toonMat(0xff8a30)); cone.position.y=0.19;
      meg.add(cone); meg.rotation.z = Math.PI/2; meg.position.set(0,-0.05,0.12);
      b.L_hand.add(meg);
      this.megaphone = meg;
    } else if (this.skinKey === 'devsus'){
      // dark hoodie body + raised hood
      this._part(new THREE.BoxGeometry(0.58,0.58,0.44), toonMat(0x1c1c22), b.chest, 0,-0.02,0, true);
      this._part(new THREE.TorusGeometry(0.2,0.06,8,16), toonMat(0x16161c), b.chest, 0,0.18,0.16).rotation.x=Math.PI/2; // hood collar
      const hood = this._part(new THREE.SphereGeometry(0.5,16,16,0,Math.PI*2,0,Math.PI*0.62), toonMat(0x1c1c22), b.head, 0,0.08,-0.04);
      hood.scale.set(1.08,1.05,1.12);
      // white mask plate with spiral
      this._part(new THREE.CircleGeometry(0.34,24), basicMat(0xf2f2f2), b.head, 0,0.0,0.43);
      this._part(new THREE.RingGeometry(0.1,0.13,20), basicMat(0x9a9a9a), b.head, 0,0.04,0.44);
      // glowing green eyes through mask
      ['iris','pupil','glint'].forEach(p=>{ if(b[p+'L'])b[p+'L'].visible=false; if(b[p+'R'])b[p+'R'].visible=false; });
      b.eyeL.material = basicMat(0x00ff88); b.eyeR.material = basicMat(0x00ff88);
      b.eyeL.scale.set(1.1,0.55,0.5); b.eyeR.scale.set(1.1,0.55,0.5);
      b.eyeL.position.z+=0.12; b.eyeR.position.z+=0.12;
      if(b.blushL){b.blushL.visible=false;b.blushR.visible=false;}
      // glowing laptop on back
      this._part(new THREE.BoxGeometry(0.36,0.26,0.03), toonMat(0x222), b.chest, 0,0,-0.25);
      const scr = this._part(new THREE.PlaneGeometry(0.3,0.2), basicMat(0x00ff88), b.chest, 0,0,-0.27);
      this.laptopScreen = scr;
    } else if (this.skinKey === 'trojan'){
      // metallic chest plate + panel lines
      this._part(new THREE.BoxGeometry(0.5,0.5,0.38), metalMat(0xb8b8c4), b.chest, 0,-0.05,0.02);
      this._part(new THREE.BoxGeometry(0.3,0.06,0.06), metalMat(0x6a6a78), b.chest, 0,0.05,0.22);
      // antenna
      this._part(new THREE.CylinderGeometry(0.012,0.012,0.22,6), metalMat(0x888), b.head, 0.18,0.42,-0.02);
      this._part(new THREE.SphereGeometry(0.035,8,8), basicMat(0xff2200), b.head, 0.18,0.55,-0.02);
      // glowing red LED bar eyes
      ['iris','pupil','glint','blush'].forEach(p=>{ if(b[p+'L'])b[p+'L'].visible=false; if(b[p+'R'])b[p+'R'].visible=false; });
      b.eyeL.material = basicMat(0xff0000); b.eyeR.material = basicMat(0xff0000);
      b.eyeL.scale.set(1.35,0.5,0.5); b.eyeR.scale.set(1.35,0.5,0.5);
      b.browL.material = metalMat(0x6a6a78); b.browR.material = metalMat(0x6a6a78);
      // joint covers
      ['L_shoulder','R_shoulder','L_hip','R_hip'].forEach(j=> this._part(new THREE.SphereGeometry(0.13,12,12), metalMat(0x8a8a96), b[j], 0,0,0));
      // exhaust pipes
      for (const dir of [-1,1]) this._part(new THREE.CylinderGeometry(0.055,0.055,0.22,8), metalMat(0x555560), b.chest, dir*0.18,0.12,-0.2);
      this.jerky = true;
      this.exhaustL = b.chest;
    } else if (this.skinKey === 'paperhand'){
      // plain white tee + messy hair
      this._part(new THREE.BoxGeometry(0.5,0.5,0.37), toonMat(0xf4f4f0), b.chest, 0,-0.05,0.02, true);
      this._part(new THREE.SphereGeometry(0.43,16,16,0,Math.PI*2,0,Math.PI*0.5), toonMat(0x6b4423), b.head, 0,0.12,-0.02).scale.set(1.04,0.85,1.06);
      // red SELL text plate
      this._part(new THREE.PlaneGeometry(0.3,0.14), this._sellPlate(), b.chest, 0,-0.04,0.21);
      // permanent worried face
      b.eyeL.scale.set(0.95,1.35,0.55); b.eyeR.scale.set(0.95,1.35,0.55);
      b.browL.rotation.z=-0.4; b.browR.rotation.z=0.4; // worried brows
      this.trembling = true;
      this.sweatDrops = [];
      for (let i=0;i<3;i++){ const d=this._part(new THREE.SphereGeometry(0.045,8,8), new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:0.85}), b.head, (i-1)*0.22,0.18,0.32); this.sweatDrops.push(d); }
    } else if (this.skinKey === 'whale'){
      // Ansem-inspired "blue whale" caricature: sleek jacket + whale hat + cyan visor
      this._part(new THREE.BoxGeometry(0.52,0.52,0.38), toonMat(s.body), b.chest, 0,-0.05,0.02, true);
      this._part(new THREE.BoxGeometry(0.18,0.16,0.05), basicMat(0xeaf6ff), b.chest, 0,0.08,0.21); // collar
      // whale hat sitting on head
      const whale = this._part(new THREE.SphereGeometry(0.3,16,12), toonMat(0x1b6fe0), b.head, 0,0.4,0.02); whale.scale.set(1.25,0.7,1.0);
      this._part(new THREE.SphereGeometry(0.12,10,10), basicMat(0xeaf6ff), b.head, 0.2,0.42,0.26).scale.set(1,0.7,0.7); // belly highlight
      this._part(new THREE.ConeGeometry(0.14,0.18,4), toonMat(0x1b6fe0), b.head, -0.32,0.46,0).rotation.z=-1.1; // tail fin
      const spout=this._part(new THREE.CylinderGeometry(0.02,0.05,0.18,8), basicMat(0x9fe8ff), b.head, 0.12,0.62,0.05);
      // cyan visor shades
      this._part(new THREE.BoxGeometry(0.46,0.13,0.06), basicMat(0x0a1830), b.head, 0,0.06,0.4);
      this._part(new THREE.BoxGeometry(0.44,0.08,0.05), basicMat(s.accent), b.head, 0,0.06,0.42);
    } else if (this.skinKey === 'cigarchad'){
      // Mitch-inspired "cigar chad": tailored suit, slick hair, gold chain, cigar
      this._part(new THREE.BoxGeometry(0.54,0.54,0.4), toonMat(s.body), b.chest, 0,-0.05,0.02, true);
      for (const sx of [-1,1]) this._part(new THREE.BoxGeometry(0.12,0.34,0.06), toonMat(0x16161c), b.chest, sx*0.18,-0.02,0.21).rotation.z=sx*0.22;
      this._part(new THREE.BoxGeometry(0.16,0.16,0.05), basicMat(0xffffff), b.chest, 0,0.08,0.21);
      this._part(new THREE.TorusGeometry(0.14,0.025,8,20), metalMat(s.accent), b.chest, 0,0.12,0.16).rotation.x=Math.PI/2; // gold chain
      // slicked-back hair
      this._part(new THREE.SphereGeometry(0.43,16,16,0,Math.PI*2,0,Math.PI*0.5), toonMat(0x100b06), b.head, 0,0.12,-0.02).scale.set(1.03,0.9,1.05);
      // sunglasses
      this._part(new THREE.BoxGeometry(0.46,0.13,0.06), basicMat(0x0a0a12), b.head, 0,0.07,0.4);
      // cigar from mouth + glowing tip
      this._part(new THREE.CylinderGeometry(0.03,0.03,0.26,8), toonMat(0x5a3a1a), b.head, 0.12,-0.14,0.45).rotation.set(Math.PI/2,0,0.2);
      this.cigarTip=this._part(new THREE.SphereGeometry(0.035,8,8), basicMat(0xff6b00), b.head, 0.18,-0.13,0.57);
    } else if (this.skinKey === 'orange'){
      // Orangie-inspired: orange hoodie, beanie, round tinted shades
      this._part(new THREE.BoxGeometry(0.56,0.56,0.42), toonMat(s.body), b.chest, 0,-0.03,0, true);
      this._part(new THREE.TorusGeometry(0.2,0.06,8,16), toonMat(0xe06a10), b.chest, 0,0.18,0.16).rotation.x=Math.PI/2;
      // beanie
      this._part(new THREE.SphereGeometry(0.45,16,12,0,Math.PI*2,0,Math.PI*0.55), toonMat(0xe06a10), b.head, 0,0.1,0).scale.set(1.05,0.85,1.05);
      this._part(new THREE.TorusGeometry(0.4,0.06,8,24), toonMat(0xffae5c), b.head, 0,0.06,0).rotation.x=Math.PI/2;
      // round shades
      for (const sx of [-1,1]) this._part(new THREE.CircleGeometry(0.1,18), basicMat(0x251005), b.head, sx*0.17,0.05,0.41);
    } else if (this.skinKey === 'cupsey'){
      // Cupsey-inspired: a giant soda cup as a head/helmet with lid + straw
      this._part(new THREE.BoxGeometry(0.5,0.5,0.37), toonMat(0xf2f2f7), b.chest, 0,-0.05,0.02, true);
      const cup=this._part(new THREE.CylinderGeometry(0.4,0.32,0.5,18), basicMat(s.accent), b.head, 0,0.34,0); cup.scale.set(1,1,1);
      this._part(new THREE.CylinderGeometry(0.42,0.42,0.06,18), basicMat(0xffffff), b.head, 0,0.6,0); // lid
      this._part(new THREE.CylinderGeometry(0.025,0.025,0.4,8), basicMat(0xff4d6d), b.head, 0.08,0.78,0).rotation.z=0.25; // straw
      // band/logo stripe
      this._part(new THREE.CylinderGeometry(0.41,0.41,0.12,18,1,true), basicMat(0xffffff), b.head, 0,0.34,0);
    } else if (this.skinKey === 'percent'){
      // Cented-inspired: green trader jacket, visor, chart bars on chest
      this._part(new THREE.BoxGeometry(0.52,0.52,0.4), toonMat(s.body), b.chest, 0,-0.05,0.02, true);
      // rising green chart bars
      for (let i=0;i<3;i++) this._part(new THREE.BoxGeometry(0.07,0.1+i*0.1,0.04), basicMat(0x9dffba), b.chest, (i-1)*0.12,-0.06+i*0.05,0.22);
      // visor
      this._part(new THREE.BoxGeometry(0.48,0.12,0.07), basicMat(0x0a2a18), b.head, 0,0.08,0.39);
      this._part(new THREE.BoxGeometry(0.5,0.04,0.08), basicMat(s.body), b.head, 0,0.15,0.4); // brim
    } else if (this.skinKey === 'validator'){
      // Toly/Anatoly-inspired: Solana purple+green, glowing validator halo
      this._part(new THREE.BoxGeometry(0.52,0.52,0.4), toonMat(s.body), b.chest, 0,-0.05,0.02, true);
      // Solana gradient stripes
      for (const sx of [-1,1]) this._part(new THREE.BoxGeometry(0.1,0.4,0.05), basicMat(s.accent), b.chest, sx*0.16,-0.04,0.21).rotation.z=sx*0.4;
      // cap
      this._part(new THREE.SphereGeometry(0.44,16,12,0,Math.PI*2,0,Math.PI*0.45), toonMat(0x6a2fb8), b.head, 0,0.12,0).scale.set(1.04,0.8,1.05);
      // glowing validator halo ring
      this.halo=this._part(new THREE.TorusGeometry(0.34,0.04,10,30), basicMat(s.accent), b.head, 0,0.55,0); this.halo.rotation.x=Math.PI/2;
    } else if (this.skinKey === 'rpcwiz'){
      // Mert/Helius-inspired: wizard robe + hat + glowing staff
      this._part(new THREE.ConeGeometry(0.34,0.55,16), toonMat(s.body), b.chest, 0,-0.1,0, true); // robe
      // wizard hat
      this._part(new THREE.ConeGeometry(0.36,0.7,18), toonMat(0x2a1c58), b.head, 0,0.7,0);
      this._part(new THREE.TorusGeometry(0.4,0.06,8,24), toonMat(0x2a1c58), b.head, 0,0.38,0).rotation.x=Math.PI/2; // brim
      this._part(new THREE.SphereGeometry(0.06,10,10), basicMat(s.accent), b.head, 0,1.05,0); // hat tip star
      // staff in right hand with glowing orb
      const staff=this._part(new THREE.CylinderGeometry(0.03,0.03,0.7,8), toonMat(0x6b4a1a), b.R_hand, 0,-0.2,0);
      this.staffOrb=this._part(new THREE.SphereGeometry(0.1,12,12), basicMat(s.accent), b.R_hand, 0,0.18,0);
    } else if (this.skinKey === 'frogdegen'){
      // mr.frog / pepe-inspired: green hoodie + frog hood with bulging eyes
      this._part(new THREE.BoxGeometry(0.56,0.56,0.42), toonMat(s.body), b.chest, 0,-0.03,0, true);
      this._part(new THREE.SphereGeometry(0.48,16,14,0,Math.PI*2,0,Math.PI*0.62), toonMat(0x3f9442), b.head, 0,0.08,-0.02).scale.set(1.1,1.05,1.12); // hood
      // frog eyes on top of hood
      for (const sx of [-1,1]){
        this._part(new THREE.SphereGeometry(0.13,12,12), basicMat(0xffffff), b.head, sx*0.2,0.42,0.04);
        this._part(new THREE.SphereGeometry(0.06,10,10), basicMat(0x0a0a0a), b.head, sx*0.2,0.45,0.14);
      }
    }
  }

  _sellPlate(){
    const cv=document.createElement('canvas'); cv.width=128; cv.height=64; const cx=cv.getContext('2d');
    cx.fillStyle='#f4f4f0'; cx.fillRect(0,0,128,64);
    cx.font='bold 34px Inter, sans-serif'; cx.fillStyle='#e01030'; cx.textAlign='center'; cx.textBaseline='middle'; cx.fillText('SELL',64,34);
    return new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(cv) });
  }

  setFace(state){ if(this.faceState===state)return; this.faceState = state; this._applyExpression(state); }

  _applyExpression(state){
    const b = this.bones; if (!b.brow) {} // guard
    const baseScaleL = (this.skinKey==='paperhand')? new THREE.Vector3(0.95,1.35,0.55) : (this.skinKey==='devsus'||this.skinKey==='trojan')? null : new THREE.Vector3(1,1,0.55);
    const setBrow = (lz,rz)=>{ if(b.browL){b.browL.rotation.z=lz; b.browR.rotation.z=rz;} };
    const showMouthO = (v,sc=1)=>{ if(b.mouthO){ b.mouthO.visible=v; b.mouthO.scale.setScalar(sc);} if(b.mouth) b.mouth.visible=!v; };
    if (this.skinKey==='devsus'||this.skinKey==='trojan'){ showMouthO(false); return; } // masked/robot: no face change
    if (state==='shocked'){ if(baseScaleL){b.eyeL.scale.set(1.25,1.3,0.55);b.eyeR.scale.set(1.25,1.3,0.55);} setBrow(0.5,-0.5); showMouthO(true,1.2); }
    else if (state==='sweating'){ if(baseScaleL){b.eyeL.scale.set(0.9,1.2,0.55);b.eyeR.scale.set(0.9,1.2,0.55);} setBrow(-0.4,0.4); showMouthO(true,0.7); }
    else if (state==='celebrating'){ if(baseScaleL){b.eyeL.scale.set(1,0.6,0.55);b.eyeR.scale.set(1,0.6,0.55);} setBrow(0.3,-0.3); showMouthO(true,1); }
    else { if(baseScaleL && this.skinKey!=='paperhand'){b.eyeL.scale.set(1,1,0.55);b.eyeR.scale.set(1,1,0.55);} setBrow(this.skinKey==='paperhand'?-0.4:0, this.skinKey==='paperhand'?0.4:0); showMouthO(false); }
  }
  dispose(){ this.root.traverse(o=>{ if (o.isMesh){ o.geometry?.dispose?.(); } }); }
}

// ============================================================
// ANIMATION CONTROLLER — manual procedural state machine
// ============================================================
class AnimController {
  constructor(char){
    this.c = char; this.b = char.bones;
    this.state = 'idle'; this.t = 0; this.jumpT = 0; this.diveT = 0;
    this.ragdollT = 0; this.recoverT = 0; this.idleTimer = 0; this.subIdle = 0;
    this.speed = 0; // 0..1 normalized for run blend
    this.stars = [];
  }
  set(state){
    if (this.state === state) return;
    if (state === 'jump') this.jumpT = 0;
    if (state === 'dive') this.diveT = 0;
    if (state === 'ragdoll'){ this.ragdollT = 0; this._initRagdoll(); }
    if (state === 'recover'){ this.recoverT = 0; this._spawnStars(); }
    this.state = state;
  }
  _lerpRot(bone, x,y,z, k=0.25){
    bone.rotation.x += (x-bone.rotation.x)*k;
    bone.rotation.y += (y-bone.rotation.y)*k;
    bone.rotation.z += (z-bone.rotation.z)*k;
  }
  _resetPose(k=0.2){
    const b=this.b;
    ['L_upperarm','R_upperarm','L_lowerarm','R_lowerarm','L_upperleg','R_upperleg','L_lowerleg','R_lowerleg','chest','head','hips'].forEach(n=>{
      if (b[n]) this._lerpRot(b[n],0,0,0,k);
    });
    b.hips.scale.lerp(new THREE.Vector3(1,1,1), k);
  }

  update(dt, t){
    this.t += dt;
    const b = this.b, jk = this.c.jerky ? 0.5 : 0.28; // jerky skins use harder lerp
    if (this.c.jerky) this.lerpK = 0.55; else this.lerpK = 0.25;

    switch(this.state){
      case 'idle': this._idle(t, dt); break;
      case 'run':  this._run(t); break;
      case 'jump': this._jump(dt); break;
      case 'dive': this._dive(dt); break;
      case 'fall': this._fall(t); break;
      case 'ragdoll': this._ragdoll(dt); break;
      case 'recover': this._recover(dt); break;
      case 'celebrate': this._celebrate(t); break;
    }
    this._skinFx(t);
    this._updateStars(dt);
  }

  _idle(t, dt){
    const b=this.b;
    b.hips.position.y = 0.92 + Math.sin(t*1.2)*0.05;
    this._lerpRot(b.head, 0, Math.sin(t*0.4)*0.18, 0, 0.1);
    this._lerpRot(b.L_upperarm, Math.sin(t*0.8)*0.06, 0, 0.16, 0.15);
    this._lerpRot(b.R_upperarm, Math.sin(t*0.8+1)*0.06, 0, -0.16, 0.15);
    this._lerpRot(b.chest, 0,0,0,0.1);
    this._lerpRot(b.L_upperleg,0,0,0,0.1); this._lerpRot(b.R_upperleg,0,0,0,0.1);
    b.hips.scale.lerp(new THREE.Vector3(1,1,1),0.1);
    // sub-idle: phone
    this.idleTimer += dt;
    if (this.idleTimer > 8){ this.subIdle = 2; this.idleTimer = 0; }
    if (this.subIdle > 0){
      this.subIdle -= dt;
      this._lerpRot(b.L_lowerarm, -1.8, 0, 0, 0.18);
      this._lerpRot(b.head, 0.3, 0, 0, 0.12);
    }
  }

  _run(t){
    const b=this.b, cyc = 9 + this.speed*6, amp = 0.85 + this.speed*0.25;
    this._lerpRot(b.L_upperleg, Math.sin(t*cyc)*amp, 0,0, this.lerpK);
    this._lerpRot(b.R_upperleg, -Math.sin(t*cyc)*amp, 0,0, this.lerpK);
    this._lerpRot(b.L_lowerleg, Math.max(0,Math.cos(t*cyc))*0.7,0,0,this.lerpK);
    this._lerpRot(b.R_lowerleg, Math.max(0,-Math.cos(t*cyc))*0.7,0,0,this.lerpK);
    this._lerpRot(b.L_upperarm, -Math.sin(t*cyc)*1.1, 0, 0.12, this.lerpK);
    this._lerpRot(b.R_upperarm, Math.sin(t*cyc)*1.1, 0, -0.12, this.lerpK);
    this._lerpRot(b.L_lowerarm, -0.5+Math.sin(t*cyc)*0.3,0,0,this.lerpK);
    this._lerpRot(b.R_lowerarm, -0.5-Math.sin(t*cyc)*0.3,0,0,this.lerpK);
    this._lerpRot(b.chest, -0.18, 0,0, 0.2);
    b.hips.position.y = 0.92 + Math.abs(Math.sin(t*cyc))*0.05;
    b.hips.scale.lerp(new THREE.Vector3(1,1,1),0.2);
  }

  _jump(dt){
    this.jumpT += dt; const b=this.b; const p=this.jumpT;
    if (p < 0.1){ b.hips.scale.lerp(new THREE.Vector3(1.15,0.78,1.15),0.4); }
    else if (p < 0.3){ b.hips.scale.lerp(new THREE.Vector3(0.9,1.25,0.9),0.4); this._lerpRot(b.L_upperarm,-2.2,0,0.2,0.3); this._lerpRot(b.R_upperarm,-2.2,0,-0.2,0.3); }
    else { b.hips.scale.lerp(new THREE.Vector3(1,1,1),0.2); this._lerpRot(b.L_upperleg,0.7,0,0,0.2); this._lerpRot(b.R_upperleg,0.7,0,0,0.2); this._lerpRot(b.L_upperarm,0,0,0.5,0.2); this._lerpRot(b.R_upperarm,0,0,-0.5,0.2); }
  }

  _dive(dt){
    this.diveT += dt; const b=this.b;
    this._lerpRot(b.hips, -1.0, 0, 0, 0.3);
    this._lerpRot(b.L_upperarm, -2.6,0,0.15,0.3); this._lerpRot(b.R_upperarm,-2.6,0,-0.15,0.3);
    this._lerpRot(b.L_upperleg, 0.4,0,0,0.3); this._lerpRot(b.R_upperleg,0.4,0,0,0.3);
  }

  _fall(t){
    const b=this.b;
    this._lerpRot(b.L_upperarm, -1.6, 0, 0.3, 0.2); this._lerpRot(b.R_upperarm,-1.6,0,-0.3,0.2);
    this._lerpRot(b.L_upperleg, Math.sin(t*12)*0.4,0,0.1,0.2);
    this._lerpRot(b.R_upperleg, -Math.sin(t*12)*0.4,0,-0.1,0.2);
    this._lerpRot(b.head, -0.3,0,0,0.15);
    b.hips.scale.lerp(new THREE.Vector3(1,1,1),0.2);
  }

  _initRagdoll(){
    // randomized tumble velocity stored on root userData
    this.ragVel = new THREE.Vector3((Math.random()-0.5)*2, 6+Math.random()*2, (Math.random()-0.5)*2);
    this.ragSpin = new THREE.Vector3((Math.random()-0.5)*8,(Math.random()-0.5)*8,(Math.random()-0.5)*8);
    this.c.setFace('shocked');
  }
  _ragdoll(dt){
    this.ragdollT += dt; const b=this.b;
    // flail limbs dramatically
    const t=this.t*9;
    b.L_upperarm.rotation.set(Math.sin(t)*1.5, 0, 0.5+Math.sin(t*1.3));
    b.R_upperarm.rotation.set(Math.cos(t)*1.5, 0, -0.5-Math.cos(t*1.1));
    b.L_upperleg.rotation.set(Math.sin(t*0.8)*1.2,0,0.3);
    b.R_upperleg.rotation.set(Math.cos(t*0.9)*1.2,0,-0.3);
    b.head.rotation.set(Math.sin(t)*0.5, Math.cos(t)*0.5, 0);
    if (this.ragdollT > 1.5) this.set('recover');
  }

  _recover(dt){
    this.recoverT += dt; const b=this.b;
    this._resetPose(0.15);
    this._lerpRot(b.head, 0, Math.sin(this.t*16)*0.4, 0, 0.3); // dizzy shake
    if (this.recoverT > 0.8){ this.c.setFace('normal'); this.set('idle'); }
  }

  _celebrate(t){
    const b=this.b;
    this._lerpRot(b.L_upperarm, -2.6, 0, 0.3+Math.sin(t*4)*0.3, 0.2);
    this._lerpRot(b.R_upperarm, -2.6, 0, -0.3-Math.sin(t*4)*0.3, 0.2);
    b.hips.position.y = 0.92 + Math.abs(Math.sin(t*4))*0.12;
    this._lerpRot(b.hips, 0, Math.sin(t*2)*0.3, 0, 0.2);
    this.c.setFace('celebrating');
  }

  _spawnStars(){
    this.stars = [];
    for (let i=0;i<5;i++){
      const star = new THREE.Mesh(new THREE.TetrahedronGeometry(0.06), basicMat(0xffd700));
      this.c.bones.head.add(star); this.stars.push({mesh:star, ang:i/5*Math.PI*2});
    }
  }
  _updateStars(dt){
    if (!this.stars.length) return;
    if (this.state !== 'recover'){ this.stars.forEach(s=>s.mesh.parent?.remove(s.mesh)); this.stars=[]; return; }
    this.stars.forEach(s=>{ s.ang += dt*6; s.mesh.position.set(Math.cos(s.ang)*0.4, 0.35, Math.sin(s.ang)*0.4); s.mesh.rotation.x += dt*8; });
  }

  _skinFx(t){
    const c=this.c, b=this.b;
    if (c.trembling && (this.state==='idle')){ b.hips.position.x = Math.sin(t*15)*0.012; b.hips.position.z = Math.cos(t*13)*0.01; }
    if (c.sweatDrops){ c.sweatDrops.forEach((d,i)=>{ d.position.y = 0.2 + Math.sin(t*4+i)*0.06; }); }
    if (c.skinKey==='trojan' && this.state==='idle'){ b.head.rotation.y = (t*0.6)%(Math.PI*2); }
  }
}

// ============================================================
// PARTICLE POOL
// ============================================================
class ParticlePool {
  constructor(count, geo, makeMat){
    this.items = [];
    for (let i=0;i<count;i++){
      const mat = makeMat();
      const m = new THREE.Mesh(geo, mat);
      m.visible=false; scene.add(m);
      this.items.push({ mesh:m, life:0, maxLife:1, vel:new THREE.Vector3(), spin:new THREE.Vector3(), baseScale:1, fade:true, gravity:0 });
    }
  }
  spawn(pos, vel, life, scale=1, color=null, gravity=0, spin=null){
    const p = this.items.find(i=>i.life<=0);
    if (!p) return;
    p.mesh.position.copy(pos); p.vel.copy(vel); p.life=life; p.maxLife=life; p.baseScale=scale; p.gravity=gravity;
    p.spin.copy(spin||new THREE.Vector3());
    p.mesh.scale.setScalar(scale); p.mesh.visible=true;
    if (color!=null && p.mesh.material.color) p.mesh.material.color.setHex(color);
    if (p.mesh.material.opacity!==undefined){ p.mesh.material.transparent=true; p.mesh.material.opacity=1; }
  }
  update(dt){
    for (const p of this.items){
      if (p.life<=0) continue;
      p.life -= dt;
      p.vel.y -= p.gravity*dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += p.spin.x*dt; p.mesh.rotation.y += p.spin.y*dt; p.mesh.rotation.z += p.spin.z*dt;
      const k = Math.max(0, p.life/p.maxLife);
      p.mesh.scale.setScalar(p.baseScale*(0.3+0.7*k));
      if (p.mesh.material.opacity!==undefined) p.mesh.material.opacity = k;
      if (p.life<=0) p.mesh.visible=false;
    }
  }
  clear(){ this.items.forEach(p=>{p.life=0;p.mesh.visible=false;}); }
  dispose(){ this.items.forEach(p=>scene.remove(p.mesh)); this.items=[]; }
}

// shared pools (lazy)
let FX = {};
function initFX(){
  FX.spark = new ParticlePool(60, new THREE.SphereGeometry(0.07,6,6), ()=>new THREE.MeshBasicMaterial({color:0xff6600,transparent:true}));
  FX.dust  = new ParticlePool(40, new THREE.SphereGeometry(0.12,6,6), ()=>new THREE.MeshBasicMaterial({color:0xccccdd,transparent:true,opacity:0.6}));
  FX.confetti = new ParticlePool(90, new THREE.BoxGeometry(0.1,0.3,0.1), ()=>new THREE.MeshBasicMaterial({color:0xffd700}));
}
function disposeFX(){ Object.values(FX).forEach(p=>p.dispose()); FX={}; }
function updateFX(dt){ Object.values(FX).forEach(p=>p.update(dt)); }
const CONFETTI_COLORS = [0xEF4444,0xFBBF24,0x22C55E,0x3B82F6,0xFF6B35,0x8B5CF6];

// ============================================================
// ENVIRONMENT BUILDERS
// ============================================================
function clearScene(){
  // remove everything except lights
  const keep = new Set([sun, sun.target, ambient, hemi]);
  for (let i=scene.children.length-1;i>=0;i--){ const o=scene.children[i]; if (!keep.has(o)) scene.remove(o); }
}

function setSynthwaveBackground(){
  renderer.setClearColor(0x7DD3F0);
  scene.fog = new THREE.Fog(0xA8E6F5, 80, 260);
}

// bright checkered floor (Stumble Guys style — solid, colorful, no neon)
function makeGridFloor(size=400, y=-6, color=0x88CCEE){
  const grid = new THREE.GridHelper(size, 40, 0xFFFFFF, 0xB0E0E6);
  grid.position.y = y;
  grid.material.transparent = true; grid.material.opacity = 0.5;
  return grid;
}

// soft fluffy clouds (replaces glowing moons)
function makeMoons(){
  const g = new THREE.Group();
  const cols = [0xFFFFFF, 0xF0F8FF, 0xE6F3FF];
  const data = [[-40,26,-90,14],[55,34,-110,11],[10,46,-130,9]];
  data.forEach((d,i)=>{
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(d[3],16,12), new THREE.MeshLambertMaterial({color:cols[i]}));
    cloud.position.set(d[0],d[1],d[2]);
    cloud.scale.y = 0.6;
    g.add(cloud);
  });
  return g;
}

// floating orbs (lobby ambiance — bright bubbles, not neon)
function makeOrbs(count=50, range=40, yBase=2){
  const grp = new THREE.Group();
  const orbs = [];
  const palette = [0xFF6B35, 0xFBBF24, 0x22C55E, 0x3B82F6, 0xEC4899, 0x8B5CF6];
  for (let i=0;i<count;i++){
    const c = palette[Math.floor(Math.random()*palette.length)];
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.12,8,8), new THREE.MeshLambertMaterial({color:c}));
    o.position.set((Math.random()-0.5)*range, yBase+Math.random()*16, (Math.random()-0.5)*range);
    grp.add(o); orbs.push({mesh:o, sp:0.3+Math.random()*0.6, ph:Math.random()*7});
  }
  grp.userData.update = (t)=> orbs.forEach(o=>{ o.mesh.position.y += Math.sin(t*o.sp+o.ph)*0.004; o.mesh.rotation.y += 0.01; });
  return grp;
}

// distant rolling hills (replaces dark mountains)
function makeMountains(z=-80, color=0x6BB077){
  const geo = new THREE.PlaneGeometry(260, 50, 40, 1);
  const pos = geo.attributes.position;
  for (let i=0;i<pos.count;i++){ const x=pos.getX(i); if (pos.getY(i)>0) pos.setY(i, 10 + Math.sin(x*0.3)*6 + Math.random()*8); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({color}));
  m.position.set(0, 4, z);
  return m;
}

// hex platform floor with bright checkered pattern (replaces dark order-book shader)
function makeOrderBookFloor(radius=30){
  const uniforms = { uTime:{value:0} };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`
      varying vec2 vUv; uniform float uTime;
      void main(){
        // bright cheerful checkerboard — soft pastel tiles
        vec2 g = fract(vUv*12.0);
        float cell = floor(vUv.x*12.0)+floor(vUv.y*12.0);
        vec3 c1 = vec3(0.95,0.93,0.88); // warm white
        vec3 c2 = vec3(0.76,0.87,0.94); // soft blue
        vec3 base = mod(cell,2.0)>0.5 ? c1 : c2;
        // gentle soft grid lines
        float line = smoothstep(0.92,0.99,g.x)+smoothstep(0.92,0.99,g.y);
        vec3 col = base - line * 0.08;
        gl_FragColor = vec4(col,1.0);
      }`,
  });
  const geo = new THREE.CylinderGeometry(radius, radius, 1, 6);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.userData.update = (t)=> uniforms.uTime.value = t;
  return mesh;
}

// colorful decorative pillars around hexagon (replaces neon poles)
function makeNeonPoles(radius=29){
  const g = new THREE.Group();
  const cols = [0xFF6B35, 0xFBBF24, 0x22C55E, 0x3B82F6, 0xEC4899, 0x8B5CF6];
  for (let i=0;i<6;i++){
    const a = i/6*Math.PI*2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.45,8,10), new THREE.MeshLambertMaterial({color:cols[i]}));
    pole.position.set(Math.cos(a)*radius, 4.5, Math.sin(a)*radius);
    pole.castShadow = true;
    g.add(pole);
    // small rounded cap on top
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5,10,8), new THREE.MeshLambertMaterial({color:cols[i]}));
    cap.position.set(Math.cos(a)*radius, 8.5, Math.sin(a)*radius);
    g.add(cap);
  }
  return g;
}

// ============================================================
// BUILDING FACTORY — solid multi-part 3D buildings (not flat boxes)
// Each building has: stone base, colored body with window rows,
// door, roof (cone/pyramid/dome), optional flag/pole.
// ============================================================
function makeBuilding(opts={}){
  const g = new THREE.Group();
  const w = opts.w || 6, d = opts.d || 6, h = opts.h || 10;
  const bodyColor = opts.color || 0xFF6B35;
  const roofColor = opts.roofColor || 0xE0531C;
  const roofType = opts.roofType || 'cone'; // 'cone','pyramid','dome','flat'
  const winColor = opts.winColor || 0xFBBF24;
  const baseColor = opts.baseColor || 0x64748B;
  const hasFlag = opts.flag !== false;

  // --- stone base (wider than body, ground anchor) ---
  const baseH = 1.2;
  const base = new THREE.Mesh(new THREE.BoxGeometry(w+1.2, baseH, d+1.2), new THREE.MeshLambertMaterial({color:baseColor}));
  base.position.y = baseH/2; base.castShadow = true; base.receiveShadow = true; g.add(base);
  // base trim line
  const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(w+1.4, 0.2, d+1.4), new THREE.MeshLambertMaterial({color:roofColor}));
  baseTrim.position.y = baseH; g.add(baseTrim);

  // --- main body ---
  const bodyH = h - baseH;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), new THREE.MeshLambertMaterial({color:bodyColor}));
  body.position.y = baseH + bodyH/2; body.castShadow = true; body.receiveShadow = true; g.add(body);

  // --- window rows (emissive yellow squares on all 4 sides) ---
  const winRows = Math.max(2, Math.floor(bodyH / 2.2));
  const winCols = Math.max(2, Math.floor(w / 1.8));
  const winMat = new THREE.MeshLambertMaterial({color:winColor, emissive:winColor, emissiveIntensity:0.3});
  const winGeo = new THREE.PlaneGeometry(0.7, 0.7);
  for (let row=0; row<winRows; row++){
    const wy = baseH + 1.2 + row * (bodyH-1.5) / Math.max(1, winRows-1);
    for (let col=0; col<winCols; col++){
      const wx = -w/2 + 1 + col * (w-2) / Math.max(1, winCols-1);
      // front face
      const wf = new THREE.Mesh(winGeo, winMat); wf.position.set(wx, wy, d/2+0.01); g.add(wf);
      // back face
      const wb = new THREE.Mesh(winGeo, winMat); wb.position.set(wx, wy, -d/2-0.01); wb.rotation.y = Math.PI; g.add(wb);
    }
    // side windows
    const sideCols = Math.max(2, Math.floor(d / 1.8));
    for (let col=0; col<sideCols; col++){
      const wz = -d/2 + 1 + col * (d-2) / Math.max(1, sideCols-1);
      const wl = new THREE.Mesh(winGeo, winMat); wl.position.set(-w/2-0.01, wy, wz); wl.rotation.y = -Math.PI/2; g.add(wl);
      const wr = new THREE.Mesh(winGeo, winMat); wr.position.set(w/2+0.01, wy, wz); wr.rotation.y = Math.PI/2; g.add(wr);
    }
  }

  // --- door (front center, arched with cylinder top) ---
  const doorH = 2.0, doorW = 1.2;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), new THREE.MeshLambertMaterial({color:0x4A2A10}));
  door.position.set(0, baseH + doorH/2, d/2+0.02); g.add(door);
  const doorArch = new THREE.Mesh(new THREE.CylinderGeometry(doorW/2, doorW/2, 0.1, 12, 1, false, 0, Math.PI), new THREE.MeshLambertMaterial({color:0x4A2A10}));
  doorArch.rotation.z = Math.PI/2; doorArch.rotation.y = Math.PI/2; doorArch.position.set(0, baseH+doorH, d/2+0.02); g.add(doorArch);

  // --- roof ---
  const roofY = h;
  if (roofType === 'cone'){
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w*0.75, h*0.35, 8), new THREE.MeshLambertMaterial({color:roofColor}));
    roof.position.y = roofY + h*0.175; roof.castShadow = true; g.add(roof);
  } else if (roofType === 'pyramid'){
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w*0.72, h*0.3, 4), new THREE.MeshLambertMaterial({color:roofColor}));
    roof.position.y = roofY + h*0.15; roof.rotation.y = Math.PI/4; roof.castShadow = true; g.add(roof);
  } else if (roofType === 'dome'){
    const roof = new THREE.Mesh(new THREE.SphereGeometry(w*0.55, 16, 12, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshLambertMaterial({color:roofColor}));
    roof.position.y = roofY; roof.castShadow = true; g.add(roof);
  } else { // flat
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w+0.6, 0.5, d+0.6), new THREE.MeshLambertMaterial({color:roofColor}));
    roof.position.y = roofY + 0.25; roof.castShadow = true; g.add(roof);
    // railing
    for (let i=0;i<4;i++){ const r=new THREE.Mesh(new THREE.BoxGeometry(w+0.6, 0.8, 0.1), new THREE.MeshLambertMaterial({color:bodyColor})); r.position.set(0, roofY+0.8, (i<2?1:-1)*(d/2+0.3)); r.rotation.y = i%2?Math.PI/2:0; g.add(r); }
  }

  // --- flag pole on top ---
  if (hasFlag){
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), new THREE.MeshLambertMaterial({color:0x888888}));
    pole.position.y = roofY + h*0.35 + 1.25; g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), new THREE.MeshLambertMaterial({color:bodyColor, side:THREE.DoubleSide}));
    flag.position.set(0.5, roofY + h*0.35 + 2.0, 0); g.add(flag);
  }

  return g;
}

// Build a cluster of varied buildings (city skyline / arena surroundings)
function makeBuildingCluster(centerX, centerZ, count, radius, palette){
  const g = new THREE.Group();
  const roofTypes = ['cone','pyramid','dome','flat','cone','pyramid'];
  for (let i=0;i<count;i++){
    const a = (i/count)*Math.PI*2 + Math.random()*0.3;
    const r = radius * (0.7 + Math.random()*0.5);
    const bx = centerX + Math.cos(a)*r;
    const bz = centerZ + Math.sin(a)*r;
    const bw = 4 + Math.random()*4;
    const bd = 4 + Math.random()*4;
    const bh = 6 + Math.random()*10;
    const col = palette[i % palette.length];
    const roofCol = palette[(i+3) % palette.length];
    const b = makeBuilding({w:bw, d:bd, h:bh, color:col, roofColor:roofCol, roofType:roofTypes[i%roofTypes.length], winColor:palette[(i+1)%palette.length]});
    b.position.set(bx, 0, bz);
    b.rotation.y = Math.random() * Math.PI * 0.5;
    g.add(b);
  }
  return g;
}

// ============================================================
// ACTOR — character + physics + control (player / bot)
// ============================================================
const GRAVITY = 26, MOVE_SPEED = 7.5, JUMP_VELOCITY = 11;

class Actor {
  constructor(skinKey, isPlayer, brain='player'){
    this.char = new Character(skinKey, isPlayer);
    this.anim = new AnimController(this.char);
    this.isPlayer = isPlayer;
    this.brain = brain;
    this.root = this.char.root;
    this.pos = this.root.position;
    this.vel = new THREE.Vector3();
    this.grounded = true;
    this.facing = 0;
    this.diveLock = 0; this.jumpHeld=false;
    this.ragdoll = false; this.ragTimer = 0;
    this.skill = 0.7 + Math.random()*0.3;
    this.qualified = false; this.eliminated = false; this.finishPos = 0;
    this.target = new THREE.Vector3(); this.repick = 0;
    this.trailTimer = 0;
    // checkpoint respawn state (race rounds)
    this.checkpoint = new THREE.Vector3(0, 2, 0);
    this.respawnStun = 0; this.respawns = 0; this.parked = false;
    scene.add(this.root);
  }

  startRagdoll(dir){
    if (this.ragdoll) return;
    this.ragdoll = true; this.ragTimer = 0;
    this.anim.set('ragdoll');
    const d = dir || new THREE.Vector3((Math.random()-0.5),1,(Math.random()-0.5));
    this.vel.set(d.x*8, 9, d.z*8);
    if (this.isPlayer){ Audio.SFX.hit(); shakeCamera(0.6, 0.3); }
  }

  _decideMove(dt, t, ctx){
    const m = new THREE.Vector2();
    if (this.brain === 'player'){
      if (!MOBILE) readKeyboardMove();
      m.copy(Input.move);
    } else if (this.brain === 'lobbyBot'){
      this.repick -= dt;
      if (this.repick<=0 || this.pos.distanceTo(this.target)<1.5){ this.repick = 2+Math.random()*3; const a=Math.random()*Math.PI*2, r=Math.random()*24; this.target.set(Math.cos(a)*r,0,Math.sin(a)*r); }
      const dx=this.target.x-this.pos.x, dz=this.target.z-this.pos.z; const d=Math.hypot(dx,dz);
      if (d>0.5){ m.set(dx/d, -dz/d); }
    } else if (this.brain === 'raceBot'){
      // run toward +Z finish, weave to dodge
      const goalZ = ctx.finishZ;
      let strafe = Math.sin(t*0.8 + this.skill*6)*0.4;
      m.set(strafe, this.pos.z < goalZ ? 1 : 0);
      // occasional stumble
      if (Math.random() < 0.0006) this.startRagdoll();
    } else if (this.brain === 'survivalBot'){
      // flee from warning platforms
      this.repick -= dt;
      const safe = ctx.safeTargetFor(this);
      if (safe){ const dx=safe.x-this.pos.x, dz=safe.z-this.pos.z; const d=Math.hypot(dx,dz); if (d>0.4) m.set(dx/d,-dz/d); }
    }
    return m;
  }

  update(dt, t, ctx){
    // qualified/finished actors are parked at the line celebrating — no physics
    if (this.parked){ this.anim.set('celebrate'); this.anim.update(dt, t); return; }
    if (this.ragdoll){ this._updateRagdoll(dt, ctx); this.anim.update(dt, t); return; }
    if (this.respawnStun > 0) this.respawnStun -= dt;
    const stunned = this.respawnStun > 0;

    const m = this._decideMove(dt, t, ctx);
    if (stunned) m.set(0,0);
    // camera-relative movement for player — W = forward (away from camera), S = backward
    let wishX = m.x, wishZ = m.y;
    if (this.isPlayer && this.brain==='player'){
      // camera is behind player looking forward, so:
      // W (m.y=+1) = move forward = +Z direction (away from camera)
      // S (m.y=-1) = move backward = -Z
      // A (m.x=-1) = strafe left = -X
      // D (m.x=+1) = strafe right = +X
      // adjust for camera yaw so movement is always relative to view
      const yaw = Input.camYaw;
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
      // forward vector based on camera yaw
      wishX = m.x * cosY + m.y * sinY;
      wishZ = -m.x * sinY + m.y * cosY;
    }
    const wish = new THREE.Vector3(wishX, 0, wishZ);
    const moving = wish.lengthSq() > 0.01;

    if (this.diveLock > 0){ this.diveLock -= dt; }

    // jump
    let jumpReq = false;
    if (this.brain==='player') jumpReq = Input.consumeJump();
    else if ((this.brain==='lobbyBot') && Math.random()<0.002) jumpReq=true;
    if (jumpReq && this.grounded && this.diveLock<=0 && !stunned){ this.vel.y = JUMP_VELOCITY; this.grounded=false; this.anim.set('jump'); Audio.SFX.jump(); }

    // dive
    let diveReq = this.brain==='player' ? Input.consumeDive() : false;
    if (diveReq && this.diveLock<=0 && this.grounded && !stunned){ this.diveLock=0.5; const f=new THREE.Vector3(Math.sin(this.facing),0,Math.cos(this.facing)); this.vel.x=f.x*13; this.vel.z=f.z*13; this.anim.set('dive'); if (this.isPlayer) this._spawnSpeedLines(); }

    // horizontal movement
    const spd = MOVE_SPEED * (this.brain.includes('Bot') && this.brain!=='lobbyBot' ? this.skill : (this.brain==='lobbyBot'?0.55:1));
    if (this.diveLock<=0){
      if (moving){ wish.normalize(); this.vel.x = wish.x*spd; this.vel.z = wish.z*spd; this.facing = Math.atan2(wish.x, wish.z); }
      else { this.vel.x *= 0.8; this.vel.z *= 0.8; }
    }

    // gravity
    this.vel.y -= GRAVITY*dt;
    this.pos.addScaledVector(this.vel, dt);

    // ground collision
    const gh = ctx.groundHeightAt(this.pos.x, this.pos.z);
    if (gh !== null && this.pos.y <= gh + 0.001){
      if (!this.grounded && this.vel.y < -4 && this.isPlayer){ this._spawnDust(); Audio.SFX.land(); }
      this.pos.y = gh; this.vel.y = 0; this.grounded = true;
      // record last SAFE checkpoint (solid terrain only — not movers, not pit edges)
      if (ctx.solidGroundAt){ const sg = ctx.solidGroundAt(this.pos.x, this.pos.z); if (sg !== null) this.checkpoint.set(this.pos.x, sg, this.pos.z); }
    } else {
      this.grounded = false;
      // SOLID BOUNDARY vs REAL GAP:
      // groundHeightAt returning null can mean two things — an intentional gap/pit
      // (player MUST fall through it) or the outer arena boundary (a solid wall).
      // We only push the actor back when ctx.isWall() says this is a true boundary.
      // Inside real gaps isWall() is false, so gravity carries the actor down the hole.
      if (gh === null && !this.ragdoll && ctx.isWall && ctx.isWall(this.pos.x, this.pos.z)){
        const samples = [[1,0],[-1,0],[0,1],[0,-1],[0.7,0.7],[-0.7,0.7],[0.7,-0.7],[-0.7,-0.7]];
        let best = null, bestDist = 2.0;
        for (const [dx,dz] of samples){
          for (const step of [0.5,1.0,1.6,2.0]){
            if (ctx.groundHeightAt(this.pos.x+dx*step, this.pos.z+dz*step) !== null){ if (step<bestDist){ bestDist=step; best={x:dx,z:dz}; } break; }
          }
        }
        if (best){
          // firmly push back inside the wall and kill outward velocity (slide along it)
          this.pos.x += best.x * 0.6;
          this.pos.z += best.z * 0.6;
          this.vel.x *= 0.15;
          this.vel.z *= 0.15;
        }
      }
    }

    // obstacle solid collision: prevent passing through candle/trampoline bodies
    if (ctx.solidObstacles && !this.ragdoll){
      for (const obs of ctx.solidObstacles){
        const dx = this.pos.x - obs.x, dz = this.pos.z - obs.z;
        const distXZ = Math.hypot(dx, dz);
        const minDist = obs.r + 0.4; // character radius ~0.4
        if (distXZ < minDist && Math.abs(this.pos.y - obs.y) < obs.h * 0.5 + 0.5){
          const push = (minDist - distXZ) / distXZ;
          this.pos.x += dx * push;
          this.pos.z += dz * push;
          this.vel.x *= 0.5;
          this.vel.z *= 0.5;
        }
      }
    }

    // fall off world
    if (this.pos.y < ctx.killY){ ctx.onFell(this); }

    // map obstacle interactions
    ctx.checkActor?.(this);

    // facing smoothing — only Y rotation, lock X and Z to prevent tilting
    this.root.rotation.y += ((-this.facing) - this.root.rotation.y) * 0.2;
    if (!this.ragdoll){ this.root.rotation.x = 0; this.root.rotation.z = 0; }

    // animation state selection
    if (this.diveLock>0) this.anim.set('dive');
    else if (!this.grounded){ this.anim.set(this.vel.y<-1 ? 'fall' : 'jump'); }
    else if (moving){ this.anim.set('run'); this.anim.speed = Math.min(1, (Math.hypot(this.vel.x,this.vel.z))/MOVE_SPEED); }
    else this.anim.set('idle');

    // emote
    if (this.isPlayer && Input.consumeEmote()) this.anim.set('celebrate');
    if (this.anim.state==='celebrate' && (moving||jumpReq)) this.anim.set('idle');

    // shiller rocket trail while running
    if (this.char.skinKey==='shiller' && this.anim.state==='run' && FX.spark){
      this.trailTimer -= dt; if (this.trailTimer<=0){ this.trailTimer=0.04;
        FX.spark.spawn(new THREE.Vector3(this.pos.x,this.pos.y+0.4,this.pos.z), new THREE.Vector3((Math.random()-0.5),1.5,(Math.random()-0.5)), 0.5, 0.8+Math.random()*0.4, Math.random()>0.5?0xff6b00:0xffd700);
      }
    }

    this.anim.update(dt, t);
  }

  _updateRagdoll(dt, ctx){
    this.ragTimer += dt;
    this.vel.y -= GRAVITY*dt;
    this.pos.addScaledVector(this.vel, dt);
    this.vel.x *= 0.96; this.vel.z *= 0.96;
    const gh = ctx.groundHeightAt(this.pos.x, this.pos.z);
    if (gh!==null && this.pos.y <= gh){ this.pos.y=gh; this.vel.y*=-0.3; this.vel.x*=0.7; this.vel.z*=0.7; }
    this.root.rotation.z += this.anim.ragSpin.z*dt*0.3;
    this.root.rotation.x += this.anim.ragSpin.x*dt*0.3;
    if (this.pos.y < ctx.killY){ ctx.onFell(this); }
    if (this.ragTimer > 1.5){ this.ragdoll=false; this.root.rotation.set(0,this.root.rotation.y,0); this.anim.set('recover'); }
  }

  _spawnDust(){ if(!FX.dust)return; for(let i=0;i<6;i++) FX.dust.spawn(new THREE.Vector3(this.pos.x,this.pos.y+0.05,this.pos.z), new THREE.Vector3((Math.random()-0.5)*2,1+Math.random(),(Math.random()-0.5)*2),0.5,1.0,0xccccdd,4); }
  _spawnSpeedLines(){ if(!FX.spark)return; const f=new THREE.Vector3(Math.sin(this.facing),0,Math.cos(this.facing)); for(let i=0;i<8;i++) FX.spark.spawn(new THREE.Vector3(this.pos.x+f.x,this.pos.y+0.5+Math.random(),this.pos.z+f.z), f.clone().multiplyScalar(6),0.3,0.6,0xFBBF24); }

  dispose(){ scene.remove(this.root); this.char.dispose(); }
}

// ============================================================
// MAPS
// ============================================================
function buildLobby(){
  clearScene(); setSynthwaveBackground();
  const group = new THREE.Group(); scene.add(group);
  group.add(makeBackdrop(ARENA_BG.menu_bg, {radius:200, height:160, y:40}));
  // solid hex floor with thick base
  const floor = makeOrderBookFloor(26); floor.position.y = -0.5; group.add(floor);
  // solid base under the hex floor so there's no void
  const base = new THREE.Mesh(new THREE.CylinderGeometry(27, 28, 3, 6), new THREE.MeshLambertMaterial({color:0x4A90D9})); base.position.y = -2.5; base.receiveShadow = true; group.add(base);
  // colorful edge ring around platform
  const edgeRing = new THREE.Mesh(new THREE.TorusGeometry(26.5, 0.4, 10, 48), new THREE.MeshLambertMaterial({color:0xFF6B35})); edgeRing.rotation.x = -Math.PI/2; edgeRing.position.y = 0.1; group.add(edgeRing);
  group.add(makeNeonPoles(25));
  const grid = makeGridFloor(400,-7); group.add(grid);
  const moons = makeMoons(); group.add(moons);
  group.add(makeMountains(-90, 0x6BB077));
  const orbs = makeOrbs(50, 50, 1); group.add(orbs);
  makeFloatingCandles(group, 60, 30, 18);
  // solid 3D buildings around the lobby (multi-part, not flat boxes)
  const buildingCols = [0xFF6B35, 0xFBBF24, 0x22C55E, 0x3B82F6, 0xEC4899, 0x8B5CF6];
  const roofTypes = ['cone','pyramid','dome','flat','cone','pyramid'];
  for (let i=0;i<6;i++){
    const a = i/6*Math.PI*2 + 0.3;
    const bx = Math.cos(a)*40, bz = Math.sin(a)*40;
    const bh = 8 + (i%3)*4;
    const b = makeBuilding({w:6, d:6, h:bh, color:buildingCols[i], roofColor:buildingCols[(i+2)%6], roofType:roofTypes[i], winColor:0xFBBF24});
    b.position.set(bx, 0, bz);
    b.rotation.y = -a + Math.PI/2;
    group.add(b);
  }
  // extra smaller buildings for density
  const cluster = makeBuildingCluster(0, 0, 8, 55, buildingCols);
  cluster.children.forEach(c=>{ if(c.position.lengthSq() < 35*35) c.visible=false; }); // hide ones too close to platform
  group.add(cluster);
  // ambient coins rising
  let coinT = 0;
  const R = 25;
  return {
    type:'lobby', group, killY:-30, solidObstacles: [],
    groundHeightAt(x,z){ return (x*x+z*z) < R*R ? 0 : null; },
    // the lobby platform edge is a solid boundary — keep players on the disk
    isWall(x,z){ return (x*x+z*z) >= R*R; },
    onFell(a){ a.pos.set((Math.random()-0.5)*8,6,(Math.random()-0.5)*8); a.vel.set(0,0,0); },
    update(dt,t){ floor.userData.update(t); orbs.userData.update(t); coinT-=dt; if(coinT<=0&&FX.spark){coinT=0.3; FX.spark.spawn(new THREE.Vector3((Math.random()-0.5)*40,-1,(Math.random()-0.5)*40),new THREE.Vector3(0,3,0),1.5,1.2,0xffd700,1); Audio.SFX.coin&&0;} },
    dispose(){ scene.remove(group); }
  };
}

// ============================================================
// RACE COURSE SYSTEM — long, varied, themed multi-obstacle tracks
// ============================================================
function makeFloatingCandles(group, L, W, count){
  for (let i=0;i<count;i++){
    const z=Math.random()*L, x=(Math.random()-0.5)*W*4 + (Math.random()>0.5?W*2:-W*2);
    const up=Math.random()>0.4; const h=2+Math.random()*5;
    const c=new THREE.Mesh(new THREE.BoxGeometry(0.9,h,0.9), new THREE.MeshLambertMaterial({color:up?0x22C55E:0xEF4444}));
    c.position.set(x, 6+Math.random()*22, z); c.castShadow=true; group.add(c);
    const wick=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,h*0.5,6), c.material); wick.position.y=h*0.7; c.add(wick);
  }
}
function makeChartLine(group, L, W, y0, color){
  const pts=[]; for(let i=0;i<=20;i++){ const z=i/20*L; pts.push(new THREE.Vector3((Math.random()-0.5)*W*1.4, y0+Math.sin(i*0.8)*2+i*0.3, z)); }
  const curve=new THREE.CatmullRomCurve3(pts);
  const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,80,0.18,8,false), new THREE.MeshLambertMaterial({color})); 
  group.add(tube); return tube;
}

// Checkpoint respawn for RACE rounds.
// A fall NEVER eliminates a racer or resets the whole match — the individual actor
// simply respawns at their last safe checkpoint and keeps going. Elimination only
// happens at the end of the round (qualify cap filled or the round timer expires).
function ctx_raceRespawn(a, mapctx){
  if (a.qualified){ a.parked = true; a.root.visible = false; return; } // already finished
  const cp = a.checkpoint || new THREE.Vector3(0, (mapctx.heightFn?mapctx.heightFn(2):2), 0);
  a.ragdoll = false; a.ragTimer = 0;
  a.pos.set(cp.x, cp.y + 0.5, cp.z);
  a.vel.set(0,0,0);
  a.grounded = false;
  a.respawnStun = 0.5;
  a.respawns = (a.respawns||0) + 1;
  a.root.visible = true;
  a.root.rotation.set(0, a.root.rotation.y, 0);
  a.anim.set('recover');
  if (a.isPlayer){ if (Audio.SFX.land) Audio.SFX.land(); shakeCamera(0.35, 0.2); flashRespawn(); }
}
function flashRespawn(){
  const el = document.getElementById('action-banner'); if (!el) return;
  el.textContent = '↺ RESPAWN'; el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'bannerPop .8s ease';
  clearTimeout(flashRespawn._t); flashRespawn._t = setTimeout(()=>el.classList.add('hidden'), 800);
}

// Unified builder. cfg drives theme + which obstacles spawn.
function buildRaceCourse(cfg){
  clearScene();
  renderer.setClearColor(cfg.clear);
  scene.fog = new THREE.Fog(cfg.fog, 90, 300);
  const group = new THREE.Group(); scene.add(group);
  const L = cfg.L, W = cfg.W, H = cfg.H;
  const heightFn = cfg.heightFn;

  // backdrop panorama — full 360 cylinder for solid enclosed feel
  if (cfg.backdrop) {
    group.add(makeBackdrop(cfg.backdrop, {radius:230, height:170, y:40, z:L*0.5, start:0, len:Math.PI*2}));
    // also add a second closer backdrop for depth
    group.add(makeBackdrop(cfg.backdrop, {radius:180, height:120, y:25, z:L*0.5, start:0, len:Math.PI*2}));
  }

  // terrain mesh — solid thick track (bright colorful surface)
  const geo = new THREE.PlaneGeometry(W*2, L, 28, 120);
  geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position;
  for (let i=0;i<pos.count;i++){ const z = pos.getZ(i) + L/2; pos.setY(i, heightFn(z)); }
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({color:cfg.terrainColor}));
  terrain.position.z = L/2; terrain.receiveShadow = true; group.add(terrain);
  // solid side walls — prevent falling off sides and give enclosed feel
  for (const sx of [-1,1]){
    const wallH = 8;
    const wallGeo = new THREE.BoxGeometry(1.5, wallH, L);
    const wall = new THREE.Mesh(wallGeo, new THREE.MeshLambertMaterial({color:cfg.terrainColor})); 
    wall.position.set(sx*(W+0.5), heightFn(L*0.5)+wallH*0.5-2, L/2); wall.castShadow=true; wall.receiveShadow=true; group.add(wall);
    // colorful edge stripe on top of wall (solid, not glowing)
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,L), new THREE.MeshLambertMaterial({color:cfg.edgeColor}));
    edge.position.set(sx*(W+0.5), heightFn(L*0.5)+wallH-2, L/2); group.add(edge);
    // posts
    for (let z=4; z<L; z+=12){ const p=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,2.4,6), new THREE.MeshLambertMaterial({color:cfg.edgeColor})); p.position.set(sx*(W+0.5), heightFn(z)+1.2, z); group.add(p); }
  }
  // solid floor underneath everything (fills the void below track)
  const underGeo = new THREE.PlaneGeometry(W*4, L);
  underGeo.rotateX(-Math.PI/2);
  const underFloor = new THREE.Mesh(underGeo, new THREE.MeshLambertMaterial({color:0x3A6FA0})); underFloor.position.set(0, -12, L/2); group.add(underFloor);

  group.add(makeGridFloor(540,-34,cfg.gridColor));
  group.add(makeMoons());
  const orbs = makeOrbs(36,90,8); group.add(orbs);
  makeFloatingCandles(group, L, W, 22);
  const chart = makeChartLine(group, L, W, 4, cfg.edgeColor);
  // solid 3D buildings along the track sides (arena city feel)
  const bPalette = [cfg.terrainColor, cfg.edgeColor, 0xFBBF24, 0x22C55E, 0xEC4899, 0x8B5CF6];
  const bTypes = ['cone','pyramid','dome','flat'];
  for (let z=15; z<L-10; z+=28){
    for (const sx of [-1,1]){
      const bh = 5 + Math.random()*6;
      const bw = 4 + Math.random()*2;
      const b = makeBuilding({w:bw, d:bw, h:bh, color:bPalette[Math.floor(z)%bPalette.length], roofColor:bPalette[(Math.floor(z)+2)%bPalette.length], roofType:bTypes[Math.floor(z/28)%bTypes.length], winColor:0xFBBF24, flag:z%56===0});
      b.position.set(sx*(W+6+Math.random()*3), 0, z);
      b.rotation.y = Math.random()*Math.PI;
      group.add(b);
    }
  }
  // grandstand buildings near finish line
  const grandstand = makeBuilding({w:W*2.2, d:5, h:12, color:cfg.edgeColor, roofColor:cfg.terrainColor, roofType:'flat', winColor:0xFBBF24, flag:false});
  grandstand.position.set(0, 0, L+8); group.add(grandstand);

  // start gate — solid archway (bright)
  const sgate = new THREE.Group();
  for (const sx of [-1,1]){ const p=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,6,10), new THREE.MeshLambertMaterial({color:0xFF6B35})); p.position.set(sx*(W-1),heightFn(0)+3,0); sgate.add(p);}
  const sgTop = new THREE.Mesh(new THREE.BoxGeometry(W*2,1,0.8), new THREE.MeshLambertMaterial({color:0xFBBF24})); sgTop.position.set(0, heightFn(0)+6, 0); sgate.add(sgTop);
  group.add(sgate);

  // finish gate — solid arch with confetti area
  const gate = new THREE.Group();
  for (const sx of [-1,1]){ const p=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,8,12), new THREE.MeshLambertMaterial({color:0x22C55E})); p.position.set(sx*(W-1),heightFn(L)+4,L); gate.add(p);}
  const beam = new THREE.Mesh(new THREE.BoxGeometry(W*2,1.1,0.5), new THREE.MeshLambertMaterial({color:0x22C55E})); beam.position.set(0,heightFn(L)+8,L); gate.add(beam);
  const gTop = new THREE.Mesh(new THREE.BoxGeometry(W*2,0.8,0.8), new THREE.MeshLambertMaterial({color:0xFBBF24})); gTop.position.set(0, heightFn(L)+9, L); gate.add(gTop);
  group.add(gate);
  const finishText = makeBillboard(cfg.finishText||'TO THE MOON 🚀', 0xffd700); finishText.position.set(0, heightFn(L)+11, L+3); finishText.scale.setScalar(7); group.add(finishText);

  // ---- obstacle systems ----
  const candles=[]; let candleTimer=1.5;
  function spawnRedCandle(){
    const c=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.9,6,1.9), new THREE.MeshLambertMaterial({color:0xEF4444})); body.castShadow=true; c.add(body);
    const wickU=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,2,8), new THREE.MeshLambertMaterial({color:0xDC2626})); wickU.position.y=4; c.add(wickU);
    const x=(Math.random()-0.5)*W*1.7; const z=L*0.9;
    c.position.set(x, heightFn(z)+3, z); group.add(c);
    candles.push({grp:c,z,x,vz:-(6+Math.random()*5),roll:0});
  }
  if (cfg.candles){ for(let i=0;i<5;i++) spawnRedCandle(); }

  // green trampolines (bright springy)
  const tramps=[];
  if (cfg.tramps){ for(let i=0;i<cfg.tramps;i++){ const z=L*(0.18+i*(0.62/cfg.tramps)); const x=(i%2?1:-1)*(W*0.45);
    const tg=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(2,4,2),new THREE.MeshLambertMaterial({color:0x16A34A})); body.castShadow=true; tg.add(body);
    const top=new THREE.Mesh(new THREE.CircleGeometry(1.1,16),new THREE.MeshLambertMaterial({color:0x4ADE80})); top.rotation.x=-Math.PI/2; top.position.y=2.02; tg.add(top);
    tg.position.set(x,heightFn(z)+2,z); group.add(tg); tramps.push({grp:tg,x,z,squash:0}); } }

  // spinning sweeper bars (rotating beam knocks players)
  const sweepers=[];
  (cfg.sweepers||[]).forEach(sd=>{
    const pivot=new THREE.Group(); pivot.position.set(0,heightFn(sd.z)+1.2,sd.z); group.add(pivot);
    const post=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,2,10), new THREE.MeshLambertMaterial({color:0x64748B})); post.position.y=0; pivot.add(post);
    const bar=new THREE.Mesh(new THREE.BoxGeometry(sd.len||W*1.7,0.55,0.55), new THREE.MeshLambertMaterial({color:0xEF4444})); bar.position.y=0.9; pivot.add(bar);
    for (const e of [-1,1]){ const cap=new THREE.Mesh(new THREE.SphereGeometry(0.45,12,12), new THREE.MeshLambertMaterial({color:0xF87171})); cap.position.set(e*(sd.len||W*1.7)/2,0.9,0); pivot.add(cap); }
    sweepers.push({pivot,bar,z:sd.z,y:heightFn(sd.z)+2.1,len:(sd.len||W*1.7)/2,sp:sd.sp||1.8,ang:Math.random()*6});
  });

  // swinging pendulum wrecking balls
  const pendulums=[];
  (cfg.pendulums||[]).forEach(pd=>{
    const piv=new THREE.Group(); piv.position.set(pd.x||0, heightFn(pd.z)+8, pd.z); group.add(piv);
    const rope=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,6,6), new THREE.MeshLambertMaterial({color:0x78350F})); rope.position.y=-3; piv.add(rope);
    const ball=new THREE.Mesh(new THREE.SphereGeometry(1.1,16,16), new THREE.MeshLambertMaterial({color:0x8B5CF6})); ball.position.y=-6; piv.add(ball);
    pendulums.push({piv,ball,z:pd.z,x:pd.x||0,baseY:heightFn(pd.z)+8,amp:pd.amp||1.1,sp:pd.sp||1.4,ph:Math.random()*6});
  });

  // pits — gaps in the ground (must jump). ground returns null inside.
  const pits = cfg.pits||[];
  // moving platforms over pits/lava
  const movers=[];
  (cfg.movers||[]).forEach(md=>{
    const pl=new THREE.Mesh(new THREE.BoxGeometry(md.w||3,0.5,md.d||3), new THREE.MeshLambertMaterial({color:md.color||0x3B82F6})); pl.receiveShadow=true; pl.castShadow=true;
    pl.position.set(md.x0, heightFn(md.z)+0.25, md.z); group.add(pl);
    movers.push({pl, z:md.z, x0:md.x0, x1:md.x1, w:md.w||3, d:md.d||3, sp:md.sp||0.6, ph:Math.random()*6, y:heightFn(md.z)});
  });
  // lava (decorative + lethal handled by pit kill) — warm orange, not neon
  if (cfg.lava){ const lava=new THREE.Mesh(new THREE.PlaneGeometry(W*2.4,L), new THREE.MeshLambertMaterial({color:0xF97316,transparent:true,opacity:0.7})); lava.rotation.x=-Math.PI/2; lava.position.set(0,-8,L/2); group.add(lava); }

  const finishZ = L - 4;
  function groundHeightAt(x,z){
    if (Math.abs(x)>W || z<-6 || z>L+6) return null;
    const cz = THREE.MathUtils.clamp(z,0,L);
    // pit check
    for (const p of pits){ if (z>p.z0 && z<p.z1 && Math.abs(x) < (p.halfW!=null?p.halfW:W+1)) {
      // moving platform may bridge it
      for (const mv of movers){ if (Math.abs(mv.z-z)<mv.d/2){ if (Math.abs(x-mv.pl.position.x)<mv.w/2) return mv.y+0.5; } }
      return null;
    } }
    // standing on a mover anywhere
    for (const mv of movers){ if (Math.abs(mv.z-z)<mv.d/2 && Math.abs(x-mv.pl.position.x)<mv.w/2) return Math.max(heightFn(cz), mv.y+0.5); }
    return heightFn(cz);
  }

  return {
    type:'race', group, killY:cfg.killY||-40, finishZ, qualifyTarget:16, startZ:0, length:L,
    spawnPoints: spawnGrid(32, 0, 0, 1),
    solidObstacles: (()=> {
      const obs=[];
      tramps.forEach(tr=>obs.push({x:tr.x, z:tr.z, y:heightFn(tr.z)+2, r:1.2, h:4}));
      return obs;
    })(),
    groundHeightAt,
    // True arena boundary: the side walls and the area behind the start gate.
    // Pits/gaps inside the track are intentionally NOT walls, so players fall through them.
    isWall(x,z){ return Math.abs(x) > W || z < -2; },
    isPitAt(x,z){ for (const p of pits){ if (z>p.z0 && z<p.z1 && Math.abs(x) < (p.halfW!=null?p.halfW:W+1)) return true; } return false; },
    // height of SOLID terrain only (excludes movers + a safety margin around pits) — used for respawn checkpoints
    solidGroundAt(x,z){ if (Math.abs(x) > W-0.6 || z < 1 || z > L-1) return null; for (const p of pits){ if (z>p.z0-1.5 && z<p.z1+1.5 && Math.abs(x) < (p.halfW!=null?p.halfW:W+1)) return null; } return heightFn(THREE.MathUtils.clamp(z,0,L)); },
    onFell(a){ ctx_raceRespawn(a, this); },
    checkActor(a){
      for (const c of candles){ const dx=a.pos.x-c.x, dz=a.pos.z-c.z; if (Math.abs(dx)<1.5 && Math.abs(dz)<1.5 && !a.ragdoll){ a.startRagdoll(new THREE.Vector3(Math.sign(dx)||1,1,-0.5)); } }
      for (const tr of tramps){ const dx=a.pos.x-tr.x, dz=a.pos.z-tr.z; if (Math.abs(dx)<1.3 && Math.abs(dz)<1.3 && a.pos.y<heightFn(tr.z)+0.4 && a.vel.y<=0){ a.vel.y=19; a.grounded=false; tr.squash=1; if(a.isPlayer)Audio.SFX.bounce(); } }
      for (const sw of sweepers){ if (Math.abs(a.pos.z-sw.z)<1.0 && !a.ragdoll){ const tip=Math.cos(sw.ang)*sw.len; if (Math.abs(a.pos.x - tip)<1.4 || Math.abs(a.pos.x + tip)<1.4){ a.startRagdoll(new THREE.Vector3(Math.sin(sw.ang),0.6,0)); } } }
      for (const pd of pendulums){ const ballWorld=new THREE.Vector3(); pd.ball.getWorldPosition(ballWorld); const dx=a.pos.x-ballWorld.x, dz=a.pos.z-ballWorld.z, dy=a.pos.y-ballWorld.y; if (dx*dx+dz*dz+dy*dy < 2.4 && !a.ragdoll){ a.startRagdoll(new THREE.Vector3(Math.sign(dx)||1,0.9,Math.sign(dz)||0)); } }
      if (!a.qualified && a.pos.z >= finishZ){ a.qualified=true; a.parked=true; a.vel.set(0,0,0); }
    },
    update(dt,t){
      orbs.userData.update(t);
      if (cfg.candles){ candleTimer-=dt; if(candleTimer<=0){ candleTimer=1.5+Math.random()*1.8; if(candles.length<10) spawnRedCandle(); } }
      for (let i=candles.length-1;i>=0;i--){ const c=candles[i]; c.z+=c.vz*dt; c.roll+=dt*4.5; c.x+=Math.sin(c.roll*0.5)*0.05;
        c.grp.position.set(c.x, heightFn(THREE.MathUtils.clamp(c.z,0,L))+2.6, c.z); c.grp.rotation.x=c.roll;
        if (c.z<-6){ group.remove(c.grp); candles.splice(i,1); } }
      tramps.forEach(tr=>{ tr.squash*=0.85; tr.grp.scale.y=1-tr.squash*0.4; });
      sweepers.forEach(sw=>{ sw.ang+=dt*sw.sp; sw.pivot.rotation.y=sw.ang; });
      pendulums.forEach(pd=>{ pd.piv.rotation.x = Math.sin(t*pd.sp+pd.ph)*pd.amp; });
      movers.forEach(mv=>{ const k=(Math.sin(t*mv.sp+mv.ph)+1)/2; mv.pl.position.x=mv.x0+(mv.x1-mv.x0)*k; });
      finishText.lookAt(camera.position);
    },
    dispose(){ scene.remove(group); }
  };
}

// ---- MAP 1: Bonding Curve Climb (sigmoid climb, candles + tramps + sweepers) ----
// Longer (280), more obstacles, pendulums, pits, moving platforms
function buildBondingCurve(){
  const L=280,W=14,H=24;
  return buildRaceCourse({
    name:'BONDING CURVE CLIMB', clear:0x7DD3F0, fog:0xA8E6F5, terrainColor:0x4A90D9, edgeColor:0xFF6B35, gridColor:0x88CCEE,
    backdrop:ARENA_BG.bonding, L,W,H,
    heightFn:(z)=>{ const u=THREE.MathUtils.clamp(z/L,0,1); return H/(1+Math.exp(-(u-0.5)*11)) + Math.sin(u*Math.PI*5)*1.2; },
    candles:true, tramps:7,
    sweepers:[{z:L*0.25,sp:1.7},{z:L*0.42,sp:-2.1},{z:L*0.58,sp:2.4},{z:L*0.72,sp:-2.8},{z:L*0.85,sp:3.0}],
    pendulums:[{z:L*0.35,x:0,amp:1.0,sp:1.6},{z:L*0.65,x:2,amp:1.2,sp:1.9},{z:L*0.80,x:-2,amp:1.1,sp:2.2}],
    pits:[{z0:L*0.50,z1:L*0.56}],
    movers:[{z:L*0.53,x0:-8,x1:8,w:4,d:5,sp:0.9,color:0x3B82F6}],
    finishText:'TO THE MOON 🚀', killY:-40,
  });
}

// ---- MAP 3: Moon Mission (space ramp, gaps + moving platforms + pendulums) ----
// Longer (300), more gaps, more pendulums, harder sweepers
function buildMoonMission(){
  const L=300,W=13,H=30;
  return buildRaceCourse({
    name:'MOON MISSION', clear:0x3B82F6, fog:0x93C5FD, terrainColor:0x60A5FA, edgeColor:0xFBBF24, gridColor:0x88CCEE,
    backdrop:ARENA_BG.moon, L,W,H,
    heightFn:(z)=>{ const u=THREE.MathUtils.clamp(z/L,0,1); return u*H + Math.sin(u*Math.PI*4)*2; },
    candles:false, tramps:4,
    pits:[{z0:L*0.20,z1:L*0.28},{z0:L*0.38,z1:L*0.46},{z0:L*0.60,z1:L*0.68},{z0:L*0.78,z1:L*0.84}],
    movers:[{z:L*0.24,x0:-7,x1:7,w:4,d:5,sp:0.8,color:0x3B82F6},{z:L*0.42,x0:7,x1:-7,w:4,d:5,sp:0.7,color:0x22C55E},{z:L*0.64,x0:-6,x1:6,w:3.5,d:4,sp:1.0,color:0x3B82F6},{z:L*0.81,x0:6,x1:-6,w:3.5,d:4,sp:1.1,color:0x22C55E}],
    pendulums:[{z:L*0.33,x:0,amp:1.0,sp:1.5},{z:L*0.52,x:3,amp:1.2,sp:1.8},{z:L*0.72,x:-3,amp:1.1,sp:2.0},{z:L*0.90,x:0,amp:1.3,sp:2.4}],
    sweepers:[{z:L*0.15,sp:2.0},{z:L*0.55,sp:-2.5},{z:L*0.88,sp:3.0}],
    finishText:'MOON LANDED 🌙', killY:-45,
  });
}

// ---- MAP 4: Liquidation Lane (downhill canyon, lava pits + heavy sweepers) ----
// Longer (260), more lava pits, harder sweepers, more movers
function buildLiquidationLane(){
  const L=260,W=11,H=16;
  return buildRaceCourse({
    name:'LIQUIDATION LANE', clear:0xFB923C, fog:0xFED7AA, terrainColor:0xF97316, edgeColor:0xEF4444, gridColor:0x88CCEE,
    backdrop:ARENA_BG.liquidation, L,W,H,
    heightFn:(z)=>{ const u=THREE.MathUtils.clamp(z/L,0,1); return H*(1-u) + Math.sin(u*Math.PI*5)*2.5; },
    candles:true, tramps:3, lava:true,
    pits:[{z0:L*0.18,z1:L*0.26},{z0:L*0.35,z1:L*0.43},{z0:L*0.52,z1:L*0.60},{z0:L*0.70,z1:L*0.78},{z0:L*0.85,z1:L*0.92}],
    movers:[{z:L*0.22,x0:-6,x1:6,w:3.5,d:4,sp:1.0,color:0x22C55E},{z:L*0.39,x0:6,x1:-6,w:3.5,d:4,sp:1.1,color:0x22C55E},{z:L*0.56,x0:-5,x1:5,w:3.5,d:4,sp:1.2,color:0x22C55E},{z:L*0.74,x0:5,x1:-5,w:3,d:3.5,sp:1.3,color:0x22C55E},{z:L*0.89,x0:-4,x1:4,w:3,d:3.5,sp:1.4,color:0x22C55E}],
    sweepers:[{z:L*0.30,sp:2.6},{z:L*0.48,sp:-3.0},{z:L*0.65,sp:3.2},{z:L*0.82,sp:-3.5}],
    pendulums:[{z:L*0.45,x:0,amp:1.1,sp:2.0},{z:L*0.80,x:0,amp:1.2,sp:2.4}],
    finishText:'SURVIVED 💀', killY:-30,
  });
}

// ---- Survival: Rugpull Roulette ----
// Overhauled: larger arena (7x7=49 platforms), 60s survival, progressive difficulty,
// clear elimination (fall = eliminated, no respawn), shrinking safe zone,
// bonus coin pickups, visual warning system with countdown numbers.
function buildRugpull(){
  clearScene(); setSynthwaveBackground();
  scene.fog = new THREE.Fog(0xA78BFA, 50, 150);
  renderer.setClearColor(0xA78BFA);
  const group = new THREE.Group(); scene.add(group);
  // full 360 backdrop for enclosed arena feel
  group.add(makeBackdrop(ARENA_BG.rugpull, {radius:140, height:130, y:30, start:0, len:Math.PI*2}));
  group.add(makeGridFloor(320,-22));
  group.add(makeMoons());
  const orbs = makeOrbs(30,50,6); group.add(orbs);
  // solid floor far below (fills the void) — warm purple
  const voidFloor = new THREE.Mesh(new THREE.PlaneGeometry(240,240), new THREE.MeshLambertMaterial({color:0x7C3AED})); voidFloor.rotation.x=-Math.PI/2; voidFloor.position.y=-20; group.add(voidFloor);
  // arena boundary ring (colorful)
  const arenaRing = new THREE.Mesh(new THREE.TorusGeometry(28, 0.4, 10, 64), new THREE.MeshLambertMaterial({color:0x8B5CF6})); arenaRing.rotation.x=-Math.PI/2; arenaRing.position.y=-0.5; group.add(arenaRing);
  // arena boundary walls (solid, prevent walking off edge)
  for (let i=0;i<12;i++){
    const a = i/12*Math.PI*2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1), new THREE.MeshLambertMaterial({color:0x8B5CF6}));
    wall.position.set(Math.cos(a)*28, 1, Math.sin(a)*28);
    wall.rotation.y = -a + Math.PI/2;
    wall.castShadow = true; group.add(wall);
  }
  // 3D buildings around the arena (solid city backdrop)
  const bPalette = [0xFBBF24, 0x22C55E, 0x3B82F6, 0xEC4899, 0xFF6B35, 0x8B5CF6];
  for (let i=0;i<8;i++){
    const a = i/8*Math.PI*2;
    const bx = Math.cos(a)*42, bz = Math.sin(a)*42;
    const bh = 7 + (i%3)*4;
    const b = makeBuilding({w:5, d:5, h:bh, color:bPalette[i%6], roofColor:bPalette[(i+2)%6], roofType:['cone','pyramid','dome','flat'][i%4], winColor:0xFBBF24});
    b.position.set(bx, 0, bz); b.rotation.y = -a; group.add(b);
  }

  // 7x7 grid of platforms (49 total — bigger, more strategic)
  const plats = [];
  const N=7, gap=6.5;
  const platColors = [0xFBBF24, 0x22C55E, 0x3B82F6, 0xEC4899, 0xFF6B35, 0x8B5CF6];
  for (let i=0;i<N;i++) for (let j=0;j<N;j++){
    const x=(i-(N-1)/2)*gap, z=(j-(N-1)/2)*gap;
    const col = platColors[(i+j)%platColors.length];
    const mat = new THREE.MeshLambertMaterial({color:0xE2E8F0, emissive:0x000000});
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.6,2.6,0.6,6), mat); top.receiveShadow=true; top.castShadow=true;
    // chamfer base (thicker, solid look)
    const cham = new THREE.Mesh(new THREE.CylinderGeometry(2.4,2.7,0.2,6), new THREE.MeshLambertMaterial({color:col})); cham.position.y=-0.4; top.add(cham);
    // solid stem below platform (connects to void floor, no floating)
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 20, 6), new THREE.MeshLambertMaterial({color:0x6B5B95})); stem.position.y=-10.3; top.add(stem);
    // colorful edge ring on each platform
    const pRing = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.1, 8, 24), new THREE.MeshLambertMaterial({color:col})); pRing.rotation.x=-Math.PI/2; pRing.position.y=0.31; top.add(pRing);
    const grp = new THREE.Group(); grp.add(top); grp.position.set(x,-0.3,z); group.add(grp);
    plats.push({grp, mat, top, pRing, x, z, state:'idle', y0:-0.3, fallV:0, warnT:0, respawnT:0, baseY:-0.3, col});
  }
  // coin pickups on random platforms
  const coins = [];
  for (let i=0;i<8;i++){
    const p = plats[Math.floor(Math.random()*plats.length)];
    if (p.state !== 'idle') continue;
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 12), new THREE.MeshLambertMaterial({color:0xFBBF24, emissive:0xFBBF24, emissiveIntensity:0.4}));
    coin.position.set(p.x, 1.5, p.z); coin.rotation.x = Math.PI/2; group.add(coin);
    coins.push({mesh:coin, px:p.x, pz:p.z, collected:false, spin:0});
  }

  let rugTimer = 4;
  let totalRugged = 0;
  let waveNum = 0;

  function warn(p, duration){ if(p.state!=='idle')return; p.state='warning'; p.warnT=duration||1.5; }
  return {
    type:'survival', group, killY:-18, qualifyTarget:0, surviveTime:60,
    spawnPoints: plats.slice(0,32).map(p=>new THREE.Vector3(p.x,2,p.z)),
    solidObstacles: [],
    groundHeightAt(x,z){ for(const p of plats){ if(p.state==='falling'||p.state==='gone')continue; const dx=x-p.x,dz=z-p.z; if(dx*dx+dz*dz < 2.6*2.6) return p.baseY+0.3; } return null; },
    onFell(a){ if(!a.eliminated){ a.eliminated=true; a.dead=true; } a.root.visible=false; },
    safeTargetFor(a){ let best=null,bd=1e9; for(const p of plats){ if(p.state!=='idle')continue; const d=(p.x-a.pos.x)**2+(p.z-a.pos.z)**2; if(d<bd){bd=d;best=p;} } return best?{x:best.x,z:best.z}:null; },
    checkActor(a){
      // coin pickup
      for (const c of coins){ if(c.collected) continue; const dx=a.pos.x-c.px, dz=a.pos.z-c.pz; if(dx*dx+dz*dz<1.5 && Math.abs(a.pos.y-1.5)<2){ c.collected=true; c.mesh.visible=false; if(a.isPlayer){ Audio.SFX.coin&&Audio.SFX.coin(); } } }
    },
    update(dt,t){
      orbs.userData.update(t);
      arenaRing.rotation.z += 0.002;
      // spin coins
      coins.forEach(c=>{ if(!c.collected){ c.spin+=dt*3; c.mesh.rotation.z = c.spin; c.mesh.position.y = 1.5 + Math.sin(t*2+c.spin)*0.2; } });
      rugTimer-=dt;
      if (rugTimer<=0){
        waveNum++;
        const elapsed = 60 - (G.data.timer||60);
        // progressive difficulty: more platforms drop, faster intervals
        const intensity = Math.min(5, 1 + Math.floor(elapsed/12));
        rugTimer = Math.max(0.8, 3.5 - elapsed*0.04);
        for(let n=0;n<intensity;n++){ const live=plats.filter(p=>p.state==='idle'); if(live.length>6) warn(live[Math.floor(Math.random()*live.length)], Math.max(0.8, 1.8 - elapsed*0.01)); }
      }
      for (const p of plats){
        if (p.state==='warning'){
          p.warnT-=dt;
          const blink = Math.sin(p.warnT*22)>0;
          p.mat.emissive = p.mat.emissive || new THREE.Color();
          p.mat.emissive.setHex(blink?0xCC0000:0x000000);
          const s = 1 + (blink?0.08:0);
          p.grp.scale.set(s,1,s);
          if (p.pRing) p.pRing.material.color.setHex(blink?0xEF4444:p.col);
          if (p.warnT<=0){
            p.state='falling'; p.fallV=0;
            p.mat.emissive.setHex(0x330000);
            if (p.pRing) p.pRing.material.color.setHex(0x991B1B);
            totalRugged++;
          }
        }
        else if (p.state==='falling'){
          p.fallV += dt*12;
          p.baseY -= p.fallV*dt;
          p.grp.position.y = p.baseY;
          p.grp.rotation.x += dt*0.8;
          p.grp.rotation.z += dt*0.5;
          if (p.baseY < -16){ p.state='gone'; p.grp.visible=false; }
        }
        // gone platforms do NOT respawn — permanent elimination (harder, more strategic)
      }
    },
    dispose(){ scene.remove(group); }
  };
}

// helpers
function spawnGrid(n, baseX, baseZ, spacing){
  const pts=[]; const cols=8;
  for (let i=0;i<n;i++){ const r=Math.floor(i/cols), c=i%cols; pts.push(new THREE.Vector3(baseX+(c-cols/2)*1.6, 2, baseZ - r*2 - 2)); }
  return pts;
}
function makeLabel(text){
  const cv=document.createElement('canvas'); cv.width=256; cv.height=64; const cx=cv.getContext('2d');
  cx.font='bold 30px Inter, sans-serif'; cx.textAlign='center'; cx.textBaseline='middle';
  cx.lineWidth=6; cx.strokeStyle='rgba(0,0,0,0.85)'; cx.strokeText(text,128,32);
  cx.fillStyle='#ffffff'; cx.fillText(text,128,32);
  const tex=new THREE.CanvasTexture(cv);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
  sp.scale.set(1.7,0.42,1); sp.position.y=2.55; sp.renderOrder=999; return sp;
}
function makeBillboard(text, color){
  const cv=document.createElement('canvas'); cv.width=512; cv.height=128; const cx=cv.getContext('2d');
  cx.font='bold 70px Fredoka One, sans-serif'; cx.fillStyle='#'+color.toString(16).padStart(6,'0'); cx.textAlign='center'; cx.textBaseline='middle';
  cx.fillText(text,256,64);
  const tex=new THREE.CanvasTexture(cv); const mat=new THREE.SpriteMaterial({map:tex,transparent:true});
  const sp=new THREE.Sprite(mat); sp.scale.set(4,1,1); return sp;
}

// ============================================================
// NET MANAGER — realtime lobby presence + room matchmaking over public MQTT broker
// (no backend/keys; players opening the same link share a room)
// Room matchmaking: players auto-join the first available room with space.
// When a room fills to MAX_ROOM, a new room is created for the next players.
// ============================================================
const MIN_PLAYERS = 2; // real users required before a match can fill & start
const MAX_ROOM = 32;   // max players per match room
const ROOM_TIMEOUT = 12000; // ms before a room peer is considered stale
const Net = (() => {
  const id = 'p' + Math.random().toString(36).slice(2, 9);
  let client = null, connected = false, failed = false, lastPub = 0;
  const peers = new Map();        // presence peers (in-lobby avatars)
  const roomPeers = new Map();    // room matchmaking peers
  const topic = 'stumblepump/v3/global';
  const roomTopic = 'stumblepump/v3/rooms';
  const local = { pos:{x:0,y:0,z:0}, anim:'idle', facing:0, skin:'shiller' };
  let myRoomId = null;
  let roomJoinSent = false;

  function connect(){
    if (client || failed) return;
    if (!window.mqtt){ failed = true; return; }
    try {
      client = window.mqtt.connect('wss://broker.emqx.io:8084/mqtt', { clientId: id, connectTimeout: 5000, reconnectPeriod: 4000, clean: true });
      const to = setTimeout(() => { if (!connected) failed = true; }, 7000);
      client.on('connect', () => {
        connected = true; clearTimeout(to);
        client.subscribe(topic + '/presence');
        client.subscribe(roomTopic + '/join');
        client.subscribe(roomTopic + '/leave');
        client.subscribe(roomTopic + '/start');
      });
      client.on('message', (t, msg) => {
        try {
          const d = JSON.parse(msg.toString());
          if (d.id === id) return;
          d.last = performance.now();
          if (t === topic + '/presence'){
            peers.set(d.id, d);
          } else if (t === roomTopic + '/join'){
            // room join announcement — track room membership
            roomPeers.set(d.id, { roomId: d.roomId, name: d.name, skin: d.skin, last: performance.now() });
          } else if (t === roomTopic + '/leave'){
            roomPeers.delete(d.id);
          } else if (t === roomTopic + '/start'){
            // a room started its match — remove those peers from matchmaking
            if (d.roomId && myRoomId !== d.roomId){
              for (const [pid, rp] of [...roomPeers]){ if (rp.roomId === d.roomId) roomPeers.delete(pid); }
            }
          }
        } catch(e){}
      });
      client.on('error', () => {});
      client.on('close', () => { connected = false; });
    } catch(e){ failed = true; }
  }

  // Room matchmaking: find or create a room with available space
  function joinMatchmaking(){
    if (!connected || !client) return null;
    // Count players per room from roomPeers
    const roomCounts = {};
    for (const [pid, rp] of roomPeers){
      if (performance.now() - rp.last > ROOM_TIMEOUT) continue;
      roomCounts[rp.roomId] = (roomCounts[rp.roomId] || 0) + 1;
    }
    // Find first room with space
    let chosenRoom = null;
    for (const rid in roomCounts){
      if (roomCounts[rid] < MAX_ROOM){ chosenRoom = rid; break; }
    }
    // If no room has space (or no rooms exist), create a new one
    if (!chosenRoom){
      chosenRoom = 'room_' + Math.random().toString(36).slice(2, 8);
    }
    myRoomId = chosenRoom;
    // Announce our join
    const joinMsg = { id, roomId: myRoomId, name: (local.name||'Player'), skin: local.skin };
    try { client.publish(roomTopic + '/join', JSON.stringify(joinMsg)); } catch(e){}
    roomPeers.set(id, { roomId: myRoomId, name: joinMsg.name, skin: joinMsg.skin, last: performance.now() });
    roomJoinSent = true;
    return myRoomId;
  }

  function leaveRoom(){
    if (myRoomId && connected && client){
      try { client.publish(roomTopic + '/leave', JSON.stringify({ id, roomId: myRoomId })); } catch(e){}
    }
    roomPeers.delete(id);
    myRoomId = null;
    roomJoinSent = false;
  }

  function announceRoomStart(){
    if (myRoomId && connected && client){
      try { client.publish(roomTopic + '/start', JSON.stringify({ id, roomId: myRoomId })); } catch(e){}
    }
  }

  // Count real players in our room
  function roomPlayerCount(){
    if (!myRoomId) return 1;
    let count = 1; // ourselves
    for (const [pid, rp] of roomPeers){
      if (rp.roomId === myRoomId && performance.now() - rp.last < ROOM_TIMEOUT && pid !== id) count++;
    }
    return count;
  }

  // Get all room peer data (for spawning real players in match)
  function roomPeersList(){
    const list = [];
    for (const [pid, rp] of roomPeers){
      if (rp.roomId === myRoomId && performance.now() - rp.last < ROOM_TIMEOUT && pid !== id){
        list.push({ id: pid, name: rp.name, skin: rp.skin });
      }
    }
    return list;
  }

  function publish(force){
    if (!connected || !client) return;
    const now = performance.now(); if (!force && now - lastPub < 120) return; lastPub = now;
    try { client.publish(topic + '/presence', JSON.stringify({ id, ...local })); } catch(e){}
    // Re-announce room join periodically so new players see us
    if (myRoomId && now - (publish._lastRoomPub||0) > 2000){
      publish._lastRoomPub = now;
      try { client.publish(roomTopic + '/join', JSON.stringify({ id, roomId: myRoomId, name: (local.name||'Player'), skin: local.skin })); } catch(e){}
    }
  }
  function prune(){
    const now = performance.now();
    for (const [k,v] of peers){ if (now - v.last > 4500) peers.delete(k); }
    for (const [k,v] of roomPeers){ if (now - v.last > ROOM_TIMEOUT) roomPeers.delete(k); }
  }
  function setLocal(o){ Object.assign(local, o); }
  function realCount(){ return 1 + peers.size; }
  return { id, connect, publish, prune, peers, setLocal, realCount,
    joinMatchmaking, leaveRoom, announceRoomStart, roomPlayerCount, roomPeersList,
    get roomId(){ return myRoomId; },
    get connected(){ return connected; }, get failed(){ return failed; } };
})();

// remote players (display-only avatars driven by network)
function syncRemotes(){
  for (const [pid, d] of Net.peers){
    let a = G.remotes.get(pid);
    if (!a){ a = new Actor(d.skin || 'shiller', false, 'remote'); a.pos.set(d.pos.x, d.pos.y, d.pos.z); a.root.add(makeLabel(d.name||'Player')); G.remotes.set(pid, a); G.actors.push(a); }
    a._net = d;
  }
  for (const [pid, a] of [...G.remotes]){
    if (!Net.peers.has(pid)){ a.dispose(); G.remotes.delete(pid); const i = G.actors.indexOf(a); if (i>=0) G.actors.splice(i,1); }
  }
}
function updateRemote(a, dt, t){
  const d = a._net; if (d){ a.pos.lerp(new THREE.Vector3(d.pos.x, d.pos.y, d.pos.z), 0.25); a.root.rotation.y += ((-(d.facing||0)) - a.root.rotation.y) * 0.2; a.anim.set(d.anim || 'idle'); }
  a.anim.update(dt, t);
}

// ============================================================
// GAME CONTROLLER / STATE MACHINE
// ============================================================
const G = {
  mode:'boot', map:null, actors:[], player:null, preview:null,
  modeT:0, data:{}, fov:70, remotes:new Map(),
};
const screens = ['auth-screen','main-menu','customize','lobby-ui','roulette-ui','match-hud','result-ui','rooms-screen','room-waiting','winner-screen','history-screen'];
function showScreen(id){ screens.forEach(s=>document.getElementById(s).classList.add('hidden')); if(id) document.getElementById(id).classList.remove('hidden');
  if (id!=='match-hud'){ ['objective-badge','race-progress'].forEach(e=>document.getElementById(e)?.classList.add('hidden')); document.getElementById('arena-intro')?.classList.remove('show'); }
}

let authTab='login';
function showAuth(){ disposeActors(); disposeMap(); showScreen('auth-screen'); G.mode='auth';
  document.getElementById('auth-user').value=''; document.getElementById('auth-pass').value=''; document.getElementById('auth-msg').textContent=''; }
function authResult(r){
  const msg=document.getElementById('auth-msg');
  if (r.err){ msg.className='auth-msg'; msg.textContent=r.err; return; }
  msg.className='auth-msg ok'; msg.textContent='Welcome, '+r.profile.name+'!';
  applyProfile(r.profile); Audio.ensure();
  setTimeout(()=>enterMenu(), 300);
}
function wireAuth(){
  document.querySelectorAll('.auth-tab').forEach(t=> t.onclick=()=>{ authTab=t.dataset.atab; document.querySelectorAll('.auth-tab').forEach(x=>x.classList.toggle('active',x===t)); document.getElementById('auth-submit').textContent=authTab.toUpperCase(); document.getElementById('auth-msg').textContent=''; const solField=document.getElementById('auth-sol'); solField.style.display = authTab==='register' ? '' : 'none'; });
  document.getElementById('auth-sol').style.display='none'; // hidden on login by default
  document.getElementById('auth-submit').onclick=()=>{ Audio.SFX.click(); const u=document.getElementById('auth-user').value, p=document.getElementById('auth-pass').value, sol=document.getElementById('auth-sol').value; authResult(authTab==='register'?Auth.register(u,p,sol):Auth.login(u,p)); };
  document.getElementById('auth-pass').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('auth-submit').click(); });
  document.getElementById('auth-guest').onclick=()=>{ Audio.SFX.click(); authResult(Auth.guest()); };
}

function disposeActors(){ G.actors.forEach(a=>a.dispose()); G.actors=[]; G.player=null; G.remotes=new Map(); }
function disposeMap(){ if(G.map){ G.map.dispose(); G.map=null; } }

function randomBotSkin(){ const k=Object.keys(SKINS); return k[Math.floor(Math.random()*k.length)]; }

// ---------------- MENU / CUSTOMIZE preview ----------------
function buildPreview(){
  clearScene(); setSynthwaveBackground();
  const group = new THREE.Group(); scene.add(group);
  // solid panoramic backdrop
  group.add(makeBackdrop(ARENA_BG.menu_bg || ARENA_BG.bonding, {radius:80, height:90, y:20}));
  // solid floor — large circular platform with visible edge (bright)
  const floorGeo = new THREE.CylinderGeometry(18, 18, 1.5, 32);
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({color:0x4A90D9})); floor.position.y = -0.8; floor.receiveShadow = true; group.add(floor);
  // solid base under floor
  const floorBase = new THREE.Mesh(new THREE.CylinderGeometry(19, 20, 2, 32), new THREE.MeshLambertMaterial({color:0x3A6FA0})); floorBase.position.y = -2.5; group.add(floorBase);
  // colorful edge ring
  const edgeRing = new THREE.Mesh(new THREE.TorusGeometry(18, 0.3, 8, 64), new THREE.MeshLambertMaterial({color:0xFF6B35})); edgeRing.rotation.x = -Math.PI/2; edgeRing.position.y = -0.05; group.add(edgeRing);
  // 3D buildings around the preview platform (solid, multi-part)
  const bPalette = [0xFF6B35, 0xFBBF24, 0x22C55E, 0x3B82F6, 0xEC4899, 0x8B5CF6];
  const bTypes = ['cone','pyramid','dome','flat','cone','pyramid'];
  for (let i=0;i<6;i++){
    const a=i/6*Math.PI*2;
    const bh = 6 + (i%3)*3;
    const b = makeBuilding({w:4, d:4, h:bh, color:bPalette[i], roofColor:bPalette[(i+2)%6], roofType:bTypes[i], winColor:0xFBBF24});
    b.position.set(Math.cos(a)*24, 0, Math.sin(a)*24);
    b.rotation.y = -a + Math.PI/2;
    group.add(b);
  }
  // grid below
  group.add(makeGridFloor(300,-6));
  group.add(makeMoons());
  group.add(makeMountains(-70, 0x6BB077));
  const orbs = makeOrbs(40,30,0); group.add(orbs);
  makeFloatingCandles(group, 40, 24, 14);
  // podium (bright) — solid multi-tier
  const podiumBase = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.2, 0.4, 8), new THREE.MeshLambertMaterial({color:0xE0531C})); podiumBase.position.y=-0.4; podiumBase.receiveShadow=true; group.add(podiumBase);
  const podium = new THREE.Mesh(new THREE.CylinderGeometry(2,2.4,0.6,8), new THREE.MeshLambertMaterial({color:0xFBBF24})); podium.position.y=-0.1; podium.receiveShadow=true; group.add(podium);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1,0.08,8,40), new THREE.MeshLambertMaterial({color:0xFF6B35})); ring.rotation.x=-Math.PI/2; ring.position.y=0.22; group.add(ring);
  G.map = { group, dispose(){ scene.remove(group); }, update(t){ orbs.userData.update(t); edgeRing.rotation.z += 0.003; } };
  const a = new Actor(shared.selectedSkin, true, 'player'); a.pos.set(0,0,0); a.brain='preview';
  G.preview = a;
}
function setPreviewSkin(key){
  if (!G.preview) return;
  const old=G.preview; const pos=old.pos.clone(); old.dispose();
  const a = new Actor(key, true, 'preview'); a.pos.copy(pos); G.preview=a;
}

// ---------------- LOBBY ----------------
function enterLobby(){
  disposeActors(); disposeMap();
  G.map = buildLobby(); initFX();
  G.player = new Actor(shared.selectedSkin, true, 'player');
  G.player.pos.set(0,0,4); G.actors=[G.player]; G.remotes=new Map();
  G.player.root.add(makeLabel((shared.user&&shared.user.name)||'You'));
  G.data = { spawnTimer:0.2, target:32, countdown:-1, cdTimer:0, minReached:false, forceStart:false, matchmade:false };
  Net.connect();
  // Join room matchmaking — auto-join first available room, or create new if all full
  setTimeout(()=>{ if (Net.connected && !G.data.matchmade){ Net.joinMatchmaking(); G.data.matchmade = true; } }, 800);
  Audio.startAmbient();
  showScreen('lobby-ui');
  document.getElementById('countdown-overlay').classList.add('hidden');
  document.getElementById('force-start').classList.add('hidden');
  G.mode='lobby'; G.modeT=0;
}
function spawnLobbyBot(){
  const b=new Actor(randomBotSkin(), false, 'lobbyBot');
  const a=Math.random()*Math.PI*2, r=Math.random()*20; b.pos.set(Math.cos(a)*r, 14, Math.sin(a)*r); G.actors.push(b);
}
function updateLobby(dt,t){
  const d=G.data;
  Net.connect(); Net.prune();
  Net.setLocal({ pos:{x:G.player.pos.x,y:G.player.pos.y,z:G.player.pos.z}, anim:G.player.anim.state, facing:G.player.facing, skin:shared.selectedSkin, name:(shared.user&&shared.user.name)||'Player' });
  Net.publish();
  syncRemotes();

  // Try to join matchmaking if not yet done
  if (Net.connected && !d.matchmade){ Net.joinMatchmaking(); d.matchmade = true; }

  // updates
  G.player.update(dt,t,G.map);
  G.actors.forEach(a=>{ if (a.brain==='lobbyBot') a.update(dt,t,G.map); });
  for (const a of G.remotes.values()) updateRemote(a,dt,t);
  G.map.update(dt,t);

  // Count real players in our room (networked matchmaking)
  const roomReal = Net.roomPlayerCount();
  const botCount = G.actors.filter(a=>a.brain==='lobbyBot').length;
  const total = Math.min(32, roomReal + botCount);
  document.getElementById('lobby-count').textContent = total;
  const statusEl=document.getElementById('net-status'), fs=document.getElementById('force-start');

  // ---- GATING: need MIN_PLAYERS real users before match fills ----
  if (!d.minReached){
    if (Net.failed) statusEl.textContent='⚠ Offline — start a solo match vs bots';
    else if (!Net.connected) statusEl.textContent='Connecting to lobby server…';
    else {
      const roomId = Net.roomId ? Net.roomId.slice(-4).toUpperCase() : '----';
      statusEl.textContent=`Room #${roomId} · Waiting ${roomReal}/${MAX_ROOM}`;
    }
    if (Net.failed || G.modeT>6) fs.classList.remove('hidden');
    if (roomReal>=MIN_PLAYERS || d.forceStart){ d.minReached=true; fs.classList.add('hidden'); statusEl.textContent='Match found — filling lobby…'; }
    return;
  }

  // ---- FILL to 32 with bots, then countdown ----
  if (roomReal+botCount<32 && d.countdown<0){ d.spawnTimer-=dt; if(d.spawnTimer<=0){ d.spawnTimer=0.18; spawnLobbyBot(); } }
  if (roomReal+botCount>=32 && d.countdown<0){ d.countdown=5; document.getElementById('countdown-overlay').classList.remove('hidden'); }
  if (d.countdown>=0){ d.cdTimer-=dt; if(d.cdTimer<=0){ d.cdTimer=1; const v=Math.ceil(d.countdown); document.getElementById('lobby-cd').textContent=Math.max(1,v); if(v>0)Audio.SFX.beep(); d.countdown-=1; if(d.countdown<0){ Net.announceRoomStart(); enterRoulette(); return; } } }
}

// ---------------- ROULETTE ----------------
const MAPS = [
  {name:'BONDING CURVE CLIMB', type:'RACE', emoji:'📈', build:buildBondingCurve, goal:'First 16 to climb the curve qualify', tip:'Dodge red candles · bounce green pads · jump the sweepers · time the wrecking balls'},
  {name:'RUGPULL ROULETTE', type:'SURVIVAL', emoji:'🕳️', build:buildRugpull, goal:'Survive 60 seconds — don\'t fall when platforms rug', tip:'Platforms flash red before they drop. Grab coins! Keep moving!'},
  {name:'MOON MISSION', type:'RACE', emoji:'🌙', build:buildMoonMission, goal:'First 16 to reach the moon qualify', tip:'Jump the gaps · ride the movers · time the wrecking balls'},
  {name:'LIQUIDATION LANE', type:'RACE', emoji:'💀', build:buildLiquidationLane, goal:'First 16 down the canyon survive', tip:'Don\'t fall in the lava · hop the green platforms · dodge the hammers'},
];
function enterRoulette(){
  disposeActors(); showScreen('roulette-ui');
  document.getElementById('round-announce').classList.add('hidden');
  const reel=document.getElementById('reel'); reel.innerHTML='';
  // pick map: round 2 favors rugpull survival sometimes
  const pick = Math.floor(Math.random()*MAPS.length);
  G.data.pickedMap = MAPS[pick];
  // build a long reel ending on pick
  const seq=[]; for(let i=0;i<24;i++) seq.push(MAPS[Math.floor(Math.random()*MAPS.length)]); seq.push(MAPS[pick]);
  seq.forEach(m=>{ const c=document.createElement('div'); c.className='slot-card'; c.innerHTML=`<div class="sc-emoji">${m.emoji}</div><div class="sc-name">${m.name}</div><div class="sc-type">${m.type}</div>`; reel.appendChild(c); });
  const cardH=150, finalY=-(seq.length-1)*cardH;
  reel.style.transition='none'; reel.style.transform='translateY(0)';
  Audio.SFX.spin();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ reel.style.transition='transform 3.4s cubic-bezier(.12,.78,.18,1)'; reel.style.transform=`translateY(${finalY}px)`; }));
  G.mode='roulette'; G.modeT=0; G.data.announceAt=3.6; G.data.startedMatch=false;
}
function updateRoulette(dt,t){
  if (!G.data.startedMatch && G.modeT>G.data.announceAt){
    Audio.SFX.ding();
    const m=G.data.pickedMap;
    document.getElementById('round-label').textContent='ROUND '+shared.round;
    document.getElementById('map-label').textContent=m.name;
    document.getElementById('round-announce').classList.remove('hidden');
    G.data.startedMatch=true; G.data.matchAt=G.modeT+1.8;
  }
  if (G.data.startedMatch && G.modeT>G.data.matchAt){ enterMatch(G.data.pickedMap); }
}

// ---------------- MATCH ----------------
function enterMatch(mapDef){
  disposeActors(); disposeMap();
  G.map = mapDef.build(); initFX();
  G.map.def = mapDef;
  const sp = G.map.spawnPoints;
  // player
  G.player = new Actor(shared.selectedSkin, true, 'player');
  G.player.pos.copy(sp[0]); G.player.checkpoint.copy(sp[0]); G.actors=[G.player];
  // start the camera directly behind the player, looking down the track (+Z = forward)
  Input.camYaw = 0; Input.camPitch = 0.28;
  const botBrain = G.map.type==='race' ? 'raceBot' : 'survivalBot';
  const fieldSize = Math.max(8, G.data.fieldSize || 32);
  // Spawn real room peers first (networked players), then fill rest with bots
  const realPeers = Net.roomPeersList();
  let spawnIdx = 1;
  for (const peer of realPeers){
    if (spawnIdx >= fieldSize) break;
    const a = new Actor(peer.skin || randomBotSkin(), false, botBrain);
    a.pos.copy(sp[spawnIdx%sp.length]); a.pos.x+=(Math.random()-0.5);
    a.checkpoint.copy(a.pos);
    a.root.add(makeLabel(peer.name || 'Player'));
    a._isRealPeer = true;
    G.actors.push(a);
    spawnIdx++;
  }
  // Fill remaining slots with bots
  for (let i=spawnIdx;i<fieldSize;i++){ const b=new Actor(randomBotSkin(), false, botBrain); b.pos.copy(sp[i%sp.length]); b.pos.x+=(Math.random()-0.5); b.checkpoint.copy(b.pos); G.actors.push(b); }
  G.map.finishZ = G.map.finishZ; G.map.killY = G.map.killY;
  // qualify target
  G.data.qualifyTarget = G.map.type==='race' ? Math.ceil(fieldSize/2) : Math.ceil(fieldSize/2);
  G.data.survive = G.map.type==='survival';
  G.data.timer = G.map.surviveTime||45;
  // race round time limit (safety net) — generous, scales with course length
  G.data.raceTimer = G.map.type==='race' ? Math.ceil((G.map.length||200)/MOVE_SPEED) + 40 : null;
  G.data.qualified = 0; G.data.locked=true; G.data.finishOrder=0;
  document.getElementById('q-max').textContent=G.data.qualifyTarget;
  document.getElementById('q-cur').textContent=0;
  document.getElementById('round-num').textContent=shared.round;
  document.getElementById('survive-timer').classList.toggle('hidden', !G.data.survive);
  document.getElementById('qualify-counter').classList.toggle('hidden', G.data.survive);
  if (MOBILE) document.getElementById('mobile-controls').classList.remove('hidden');
  showScreen('match-hud');
  // objective badge + race progress
  const objBadge=document.getElementById('objective-badge'), objText=document.getElementById('objective-text');
  const rprog=document.getElementById('race-progress');
  objBadge.classList.remove('hidden');
  if (G.data.survive){ objText.textContent='⏱ Survive '+(G.map.surviveTime||45)+'s — don\'t fall'; rprog.classList.add('hidden'); }
  else { objText.textContent='🏁 Reach the finish — top '+G.data.qualifyTarget+' qualify'; rprog.classList.remove('hidden'); document.getElementById('rp-fill').style.width='0%'; }
  // arena intro banner
  showArenaIntro(mapDef);
  // countdown
  G.data.phase='countdown'; G.data.cd=3.9; G.data.cdShown=4;
  document.getElementById('big-countdown').classList.remove('hidden');
  G.mode='match'; G.modeT=0;
}

function showArenaIntro(mapDef){
  const ai=document.getElementById('arena-intro');
  document.getElementById('ai-round').textContent='ROUND '+shared.round+' OF 3';
  document.getElementById('ai-map').textContent=mapDef.name;
  document.getElementById('ai-goal').textContent=(mapDef.type==='SURVIVAL'?'🕳️ ':'🏁 ')+(mapDef.goal||'');
  document.getElementById('ai-tip').textContent=MOBILE?'Joystick to move · JUMP · DIVE':(mapDef.tip||'WASD · SPACE · SHIFT');
  ai.classList.add('show');
  setTimeout(()=>ai.classList.remove('show'), 2600);
}

function updateMatch(dt,t){
  const d=G.data, ctx=G.map;
  if (d.phase==='end'){ G.actors.forEach(a=>{ if(!a.dead) a.update(dt,t,ctx); }); ctx.update(dt,t); return; }
  // countdown phase
  if (d.phase==='countdown'){
    d.cd-=dt; const n=Math.ceil(d.cd-0.9);
    const el=document.getElementById('big-countdown');
    if (n!==d.cdShown){ d.cdShown=n; if(n>0){ el.textContent=n; Audio.SFX.beep(); el.style.animation='none'; void el.offsetWidth; el.style.animation='popcd .5s';} else if(n===0){ el.textContent='GO!'; Audio.SFX.go(); shakeCamera(0.8,0.4);} }
    if (d.cd<=0){ d.phase='run'; d.locked=false; el.classList.add('hidden'); }
    // idle animate
    G.actors.forEach(a=>a.anim.update(dt,t));
    return;
  }
  // running
  ctx.killY = ctx.killY;
  G.actors.forEach(a=>{ if(!a.dead) a.update(dt,t,ctx); });

  // race finish order
  if (ctx.type==='race'){
    G.actors.forEach(a=>{ if(a.qualified && !a._counted){ a._counted=true; d.finishOrder++; a.finishPos=d.finishOrder; d.qualified++; if(a.isPlayer)Audio.SFX.qualify(); bumpCounter(); } });
    document.getElementById('q-cur').textContent=d.qualified;
    if (G.player && !G.player.dead && ctx.finishZ){ const prog=THREE.MathUtils.clamp((G.player.pos.z-(ctx.startZ||0))/(ctx.finishZ-(ctx.startZ||0)),0,1); document.getElementById('rp-fill').style.width=(prog*100).toFixed(1)+'%'; }
    // round-end safety net: if the time limit is hit, racers who never finished are eliminated
    if (d.raceTimer!=null){ d.raceTimer-=dt; if (d.raceTimer<=0){ G.actors.forEach(a=>{ if(!a.qualified && !a.dead){ a.eliminated=true; a.dead=true; a.root.visible=false; } }); endMatch(); return; } }
    if (d.qualified>=d.qualifyTarget){ endMatch(); }
  } else {
    // survival
    d.timer-=dt; document.getElementById('timer-val').textContent=Math.max(0,Math.ceil(d.timer));
    const alive=G.actors.filter(a=>!a.dead);
    document.getElementById('q-cur').textContent=alive.length;
    if (d.timer<=0 || alive.length<=d.qualifyTarget){
      alive.forEach(a=>{ a.qualified=true; }); endMatch();
    }
  }
}

function bumpCounter(){ const el=document.getElementById('qualify-counter'); el.style.animation='none'; void el.offsetWidth; el.style.animation='bump .3s'; }

function endMatch(){
  G.data.phase='end';
  // determine player result
  const p=G.player;
  const playerQualified = p.qualified && !p.dead;
  // confetti burst
  if (FX.confetti) for(let i=0;i<60;i++) FX.confetti.spawn(new THREE.Vector3(p.pos.x+(Math.random()-0.5)*6, p.pos.y+8, p.pos.z+(Math.random()-0.5)*6), new THREE.Vector3((Math.random()-0.5)*3,-(2+Math.random()*3),(Math.random()-0.5)*3),2.5,1,CONFETTI_COLORS[i%6],3, new THREE.Vector3(5,5,5));
  setTimeout(()=>showResult(playerQualified), 1400);
}

// ---------------- RESULT ----------------
function showResult(qualified){
  G.mode='result'; G.modeT=0; showScreen('result-ui');
  const ui=document.getElementById('result-ui');
  const p=G.player;
  const maxRounds = G.data.roomRounds || 3;
  const isFinalRound = shared.round>=maxRounds;
  ui.className='screen';
  const stats=document.getElementById('result-stats');
  const contBtn=document.getElementById('result-continue');
  const quitBtn=document.getElementById('result-quit');
  if (qualified && isFinalRound){
    // Show winner screen with Solana address
    showWinnerScreen();
    return;
  } else if (qualified){
    ui.classList.add('qualified');
    document.getElementById('result-text').textContent='✅ QUALIFIED!';
    stats.innerHTML=`<div class="rs-big">#${p.finishPos||'-'}</div>Round ${shared.round} cleared · WAGMI`;
    p.anim.set('celebrate'); contBtn.textContent='CONTINUE'; quitBtn.classList.add('hidden');
    Audio.SFX.qualify();
  } else {
    ui.classList.add('eliminated');
    document.getElementById('result-text').textContent='❌ REKT';
    stats.innerHTML=`<div class="rs-big">Round ${shared.round}</div>You got rugged. Paper hands never make it.`;
    p.anim.set('ragdoll'); contBtn.textContent='RETRY'; quitBtn.classList.remove('hidden');
    Audio.SFX.eliminate();
  }
  const u=shared.user;
  if (u){ u.games=(u.games||0)+1;
    if (qualified){ u.coins=(u.coins||0)+(isFinalRound?300:60); if(isFinalRound){ u.wins=(u.wins||0)+1; u.level=(u.level||1)+1; } }
    else { u.coins=(u.coins||0)+20; }
    Auth.save(u); updateTopBar();
  }
  G.data.lastQualified=qualified;
}

function showWinnerScreen(){
  G.mode='winner'; G.modeT=0;
  const p = G.player;
  const u = shared.user;
  // Build podium from actors sorted by finish position / qualification
  const ranked = G.actors.filter(a=>!a.dead).sort((a,b)=>{
    if (a.qualified && !b.qualified) return -1;
    if (!a.qualified && b.qualified) return 1;
    return (a.finishPos||99) - (b.finishPos||99);
  });
  const podium = ranked.slice(0,3);
  // Winner info
  const winnerName = u ? u.name : 'Degen';
  const winnerSol = u ? (u.solana||'') : '';
  document.getElementById('winner-name').textContent = '👑 ' + winnerName;
  document.getElementById('winner-sol').textContent = winnerSol ? '💳 '+winnerSol : '💳 No Solana address set';
  document.getElementById('winner-stats').textContent = `PUMP KING of ${G.actors.length} degens · ${G.data.roomRounds||3} rounds survived`;
  // Podium list
  const podiumEl = document.getElementById('winner-podium'); podiumEl.innerHTML='';
  const medals=['🥇','🥈','🥉']; const cls=['gold','silver','bronze'];
  podium.forEach((a,i)=>{
    const row = document.createElement('div'); row.className='podium-row '+cls[i];
    const name = a.isPlayer ? winnerName : ((SKINS[a.char.skinKey] && SKINS[a.char.skinKey].name) || 'Degen');
    const sol = a.isPlayer ? winnerSol : '';
    row.innerHTML = `<span class="pr-rank">${medals[i]}</span><span class="pr-name">${name}</span><span class="pr-sol">${sol?'💳 '+sol.slice(0,8)+'…'+sol.slice(-4):''}</span>`;
    podiumEl.appendChild(row);
  });
  showScreen('winner-screen');
  Audio.SFX.qualify(); confettiStorm();
  // Save to history
  const entry = {
    date: new Date().toISOString(),
    winnerName: winnerName,
    winnerSol: winnerSol,
    players: G.actors.length,
    rounds: G.data.roomRounds||3,
    map: G.map && G.map.def ? G.map.def.name : 'Unknown',
    isRoom: !!G.data.isRoomMatch,
  };
  History.add(entry);
  // Update room status if room match
  if (G.data.isRoomMatch && currentRoom){
    currentRoom.status='finished'; Rooms.update(currentRoom);
    // add winner to room record
    currentRoom.winner = { name: winnerName, sol: winnerSol };
    Rooms.update(currentRoom);
  }
  // Update user stats
  if (u){ u.games=(u.games||0)+1; u.coins=(u.coins||0)+300; u.wins=(u.wins||0)+1; u.level=(u.level||1)+1; Auth.save(u); updateTopBar(); }
  p.anim.set('celebrate');
}

function showHistory(){
  showScreen('history-screen'); G.mode='history';
  const list = document.getElementById('history-list'); list.innerHTML='';
  const hist = History.all();
  if (hist.length===0){ list.innerHTML='<div class="hist-empty">No games played yet. Go win some! 🏆</div>'; return; }
  hist.forEach(h=>{
    const el = document.createElement('div'); el.className='hist-entry';
    const d = new Date(h.date);
    const dateStr = d.toLocaleDateString()+' '+d.toLocaleTimeString();
    const solShort = h.winnerSol ? h.winnerSol.slice(0,8)+'…'+h.winnerSol.slice(-4) : '—';
    el.innerHTML = `<div class="he-date">${dateStr}${h.isRoom?' · 🏠 Room':''}</div>
      <div class="he-winner">👑 ${h.winnerName}</div>
      <div class="he-sol">💳 ${h.winnerSol || 'No address'}</div>
      <div class="he-detail">${h.players} degens · ${h.rounds} rounds · ${h.map}</div>`;
    list.appendChild(el);
  });
}
function confettiStorm(){ if(!FX.confetti)return; let n=0; const iv=setInterval(()=>{ for(let i=0;i<10;i++) FX.confetti.spawn(new THREE.Vector3((Math.random()-0.5)*14, 16, (Math.random()-0.5)*14), new THREE.Vector3((Math.random()-0.5)*2,-3,(Math.random()-0.5)*2),3,1,CONFETTI_COLORS[i%6],2,new THREE.Vector3(6,6,6)); if(++n>10)clearInterval(iv); },150); }

// ---------------- MENU ----------------
function enterMenu(){
  disposeActors(); disposeMap(); buildPreview(); showScreen('main-menu');
  Audio.startAmbient(); G.mode='menu'; G.modeT=0; shared.round=1;
}
function enterCustomize(){ showScreen('customize'); buildCustomGrid('skins'); G.mode='customize'; }

// ============================================================
// CAMERA
// ============================================================
const _camTarget = new THREE.Vector3();
function updateCamera(dt){
  let targetFov = 70;
  if (G.mode==='menu' || G.mode==='customize'){
    const a = G.modeT*0.4;
    _camTarget.set(Math.sin(a)*5, 2.2, Math.cos(a)*5);
    camera.position.lerp(_camTarget, 0.05);
    camera.lookAt(0,1.1,0);
    return;
  }
  if (G.mode==='roulette'){ camera.position.lerp(new THREE.Vector3(0,3,9),0.05); camera.lookAt(0,2,0); return; }
  if (G.mode==='winner'){ camera.position.lerp(new THREE.Vector3(0,4,8),0.05); camera.lookAt(0,2,0); return; }
  if (!G.player){ return; }
  const p=G.player.pos;
  if (G.mode==='result'){
    const a=G.modeT*0.7; _camTarget.set(p.x+Math.sin(a)*5, p.y+2.5, p.z+Math.cos(a)*5);
    camera.position.lerp(_camTarget,0.06); camera.lookAt(p.x,p.y+1,p.z); applyCamShake(dt); return;
  }
  // follow camera — behind player looking forward (Z+ direction)
  const yaw=Input.camYaw, pitch=Input.camPitch;
  const dist=8, h=4;
  const ox=Math.sin(yaw)*dist, oz=Math.cos(yaw)*dist;
  _camTarget.set(p.x-ox, p.y+h+pitch*3, p.z-oz);
  if (G.player.diveLock>0) targetFov=80;
  if (G.player.ragdoll){ targetFov=76; _camTarget.addScaledVector(new THREE.Vector3(ox,0,oz).normalize(),-2); }
  camera.position.lerp(_camTarget, 0.1);
  camera.lookAt(p.x, p.y+1.2, p.z);
  camera.fov += (targetFov-camera.fov)*0.1; camera.updateProjectionMatrix();
  applyCamShake(dt);
}

// ============================================================
// HUD: fps, ping, minimap
// ============================================================
let fpsAcc=0, fpsFrames=0, pingVal=32, hudTimer=0;
const miniCtx = document.getElementById('minimap').getContext('2d');
function updateHUD(dt){
  fpsAcc+=dt; fpsFrames++;
  hudTimer-=dt;
  if (hudTimer<=0){ hudTimer=0.5;
    document.getElementById('fps').textContent=Math.round(fpsFrames/fpsAcc); fpsAcc=0; fpsFrames=0;
    pingVal=Math.max(18,Math.min(80,pingVal+(Math.random()-0.5)*14)); document.getElementById('ping').textContent=Math.round(pingVal);
  }
  if (G.mode==='match') drawMinimap();
}
function drawMinimap(){
  const c=miniCtx; c.clearRect(0,0,120,120); c.fillStyle='rgba(0,0,0,0.4)'; c.fillRect(0,0,120,120);
  let minX=-15,maxX=15,minZ=-15,maxZ=175;
  if (G.map.type==='survival'){ minX=-16;maxX=16;minZ=-16;maxZ=16; }
  const sx=v=>(v-minX)/(maxX-minX)*120, sz=v=>(v-minZ)/(maxZ-minZ)*120;
  for (const a of G.actors){ if(a.dead)continue; c.beginPath(); c.fillStyle=a.isPlayer?'#ffd700':'#ffffff'; c.arc(sx(a.pos.x), sz(a.pos.z), a.isPlayer?4:2.5, 0, 7); c.fill(); }
}

// ============================================================
// CUSTOMIZE GRID
// ============================================================
const EMOTES=[{k:'moon',n:'MOON POINT',e:'🌙',r:'common'},{k:'rug',n:'RUG DANCE',e:'🪅',r:'rare'},{k:'hodl',n:'HODL STANCE',e:'💎',r:'epic'},{k:'escape',n:'DEV ESCAPE',e:'🏃',r:'legendary'}];
const TRAILS=[{k:'rocket',n:'ROCKET',e:'🚀',r:'common'},{k:'fire',n:'FIRE',e:'🔥',r:'rare'},{k:'money',n:'MONEY',e:'💸',r:'epic'},{k:'rainbow',n:'RAINBOW',e:'🌈',r:'legendary'}];
function buildCustomGrid(tab){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
  const grid=document.getElementById('cust-grid'); grid.innerHTML='';
  const hex=n=>'#'+(n>>>0).toString(16).padStart(6,'0').slice(-6);
  if (tab==='skins'){
    Object.entries(SKINS).forEach(([k,v])=>{
      const owned=skinOwned(k), sel=shared.selectedSkin===k;
      const card=document.createElement('div'); card.className='cust-card'+(sel?' selected':'')+(owned?'':' locked');
      // clean procedural portrait: body/accent gradient + emoji (replaces the old warped jpeg portraits)
      const swatch=`<div class="cc-swatch" style="background:radial-gradient(circle at 50% 35%, ${hex(v.accent)} 0%, ${hex(v.body)} 70%)"><span class="cc-face">${v.emoji}</span></div>`;
      const tag = owned ? '' : `<div class="cc-cost">🪙 ${v.cost.toLocaleString()}</div>`;
      const kolBadge = v.kol ? `<div class="cc-kol">${v.kol}</div>` : '';
      card.innerHTML=`${swatch}<div class="cc-name">${v.name}</div>${kolBadge}<div class="cc-rar rarity ${v.rarity}" style="display:inline-block">${v.rarity.toUpperCase()}</div>${tag}`;
      card.onclick=()=>{ Audio.SFX.click();
        if (!skinOwned(k)){
          const res=buySkin(k);
          if (res.err){ const rb=document.getElementById('cust-rarity'); rb.className='rarity'; rb.textContent='❌ '+res.err; Audio.SFX.eliminate&&Audio.SFX.eliminate(); buildCustomGrid('skins'); return; }
          Audio.SFX.qualify&&Audio.SFX.qualify();
        }
        // equip (now owned)
        shared.selectedSkin=k; setPreviewSkin(k);
        document.getElementById('cust-selected-name').textContent=v.name;
        const rb=document.getElementById('cust-rarity'); rb.className='rarity '+v.rarity; rb.textContent=v.rarity.toUpperCase();
        if (shared.user){ shared.user.skin=shared.selectedSkin; shared.user.emote=shared.selectedEmote; shared.user.trail=shared.selectedTrail; Auth.save(shared.user); }
        buildCustomGrid('skins');
      };
      grid.appendChild(card);
    });
    return;
  }
  let items;
  if (tab==='emotes') items=EMOTES.map(v=>({...v,sel:shared.selectedEmote===v.k}));
  else items=TRAILS.map(v=>({...v,sel:shared.selectedTrail===v.k}));
  items.forEach(it=>{
    const card=document.createElement('div'); card.className='cust-card'+(it.sel?' selected':'');
    card.innerHTML=`<div class="cust-emoji">${it.e}</div><div class="cc-name">${it.n}</div><div class="cc-rar rarity ${it.r}" style="display:inline-block">${it.r.toUpperCase()}</div>`;
    card.onclick=()=>{ Audio.SFX.click();
      if (tab==='emotes') shared.selectedEmote=it.k;
      else shared.selectedTrail=it.k;
      if (shared.user){ shared.user.skin=shared.selectedSkin; shared.user.emote=shared.selectedEmote; shared.user.trail=shared.selectedTrail; Auth.save(shared.user); }
      buildCustomGrid(tab);
    };
    grid.appendChild(card);
  });
}

// ============================================================
// ROOM SYSTEM — create/join rooms with UTC scheduled start
// ============================================================
const RKEY='stumblePump_rooms', HKEY='stumblePump_history';
const Rooms = (() => {
  function all(){ try{ return JSON.parse(localStorage.getItem(RKEY))||[]; }catch(e){ return []; } }
  function save(r){ localStorage.setItem(RKEY, JSON.stringify(r)); }
  function genId(){ return 'room_'+Math.random().toString(36).slice(2,8); }
  function create(name, max, startUTC, rounds){
    const u = shared.user;
    const room = {
      id: genId(), name: name||'Degen Room', max: max||32, rounds: rounds||3,
      startUTC: startUTC || null, // ISO string
      hostId: u ? u.name : 'host', hostName: u ? u.name : 'Host',
      players: [{ name: u?u.name:'Host', solana: u?u.solana:'', skin: shared.selectedSkin, isHost: true }],
      status: 'waiting', createdAt: new Date().toISOString(),
    };
    const rooms = all(); rooms.push(room); save(rooms);
    return room;
  }
  function get(id){ return all().find(r=>r.id===id); }
  function join(id, player){
    const rooms = all(); const r = rooms.find(x=>x.id===id); if(!r) return null;
    if (r.players.length >= r.max) return {err:'Room is full'};
    if (r.players.some(p=>p.name===player.name)) return r; // already in
    r.players.push(player); save(rooms); return r;
  }
  function leave(id, playerName){
    const rooms = all(); const r = rooms.find(x=>x.id===id); if(!r) return;
    r.players = r.players.filter(p=>p.name!==playerName);
    if (r.players.length===0){ // delete empty room
      const idx = rooms.indexOf(r); rooms.splice(idx,1);
    } else if (r.hostId===playerName){ // transfer host
      r.hostId = r.players[0].name; r.hostName = r.players[0].name; r.players[0].isHost = true;
    }
    save(rooms);
  }
  function remove(id){ const rooms = all().filter(r=>r.id!==id); save(rooms); }
  function update(room){ const rooms = all(); const i=rooms.findIndex(r=>r.id===room.id); if(i>=0){ rooms[i]=room; save(rooms); } }
  return { all, create, get, join, leave, remove, update };
})();

const History = (() => {
  function all(){ try{ return JSON.parse(localStorage.getItem(HKEY))||[]; }catch(e){ return []; } }
  function add(entry){ const h=all(); h.unshift(entry); if(h.length>50) h.pop(); localStorage.setItem(HKEY, JSON.stringify(h)); }
  function clear(){ localStorage.removeItem(HKEY); }
  return { all, add, clear };
})();

let currentRoom = null;
let roomPollInterval = null;

function enterRooms(){
  showScreen('rooms-screen'); G.mode='rooms'; G.modeT=0;
  renderRoomList();
}
function renderRoomList(){
  const list = document.getElementById('room-list'); list.innerHTML='';
  const rooms = Rooms.all().filter(r=>r.status==='waiting');
  if (rooms.length===0){ list.innerHTML='<div class="room-empty">No active rooms yet. Create one! 🏠</div>'; return; }
  rooms.forEach(r=>{
    const card = document.createElement('div'); card.className='room-card';
    const startStr = r.startUTC ? new Date(r.startUTC).toUTCString().replace(':00 GMT',' GMT') : 'Manual start';
    const cd = r.startUTC ? roomCountdownStr(r.startUTC) : '';
    card.innerHTML = `<div class="rc-name">🏠 ${r.name}</div>
      <div class="rc-meta"><span>👥 ${r.players.length}/${r.max}</span><span>🔄 ${r.rounds} rounds</span><span>👑 ${r.hostName}</span></div>
      <div class="rc-start">⏰ ${startStr}${cd?' · '+cd:''}</div>`;
    card.onclick = ()=>{ Audio.SFX.click(); joinRoom(r.id); };
    list.appendChild(card);
  });
}
function roomCountdownStr(startISO){
  const now = Date.now(); const start = new Date(startISO).getTime();
  const diff = start - now;
  if (diff<=0) return 'STARTING NOW';
  const h=Math.floor(diff/3600000), m=Math.floor((diff%3600000)/60000), s=Math.floor((diff%60000)/1000);
  if (h>0) return `in ${h}h ${m}m`;
  if (m>0) return `in ${m}m ${s}s`;
  return `in ${s}s`;
}
function joinRoom(id){
  const u = shared.user;
  const player = { name: u?u.name:'Guest', solana: u?u.solana:'', skin: shared.selectedSkin, isHost: false };
  const r = Rooms.join(id, player);
  if (r && r.err){ alert(r.err); return; }
  currentRoom = r || Rooms.get(id);
  showRoomWaiting();
  startRoomPolling();
}
function showRoomWaiting(){
  showScreen('room-waiting'); G.mode='room-waiting'; G.modeT=0;
  const r = currentRoom; if(!r) return;
  const isHost = r.hostId === (shared.user?shared.user.name:'');
  document.getElementById('rw-title').textContent = '🏠 ' + r.name;
  document.getElementById('rw-host-badge').style.display = isHost ? '' : 'none';
  document.getElementById('rw-force-start').classList.toggle('hidden', !isHost);
  renderRoomPlayers();
  updateRoomInfo();
}
function renderRoomPlayers(){
  const r = currentRoom; if(!r) return;
  const list = document.getElementById('rw-player-list'); list.innerHTML='';
  document.getElementById('rw-count').textContent = r.players.length;
  document.getElementById('rw-max').textContent = r.max;
  r.players.forEach(p=>{
    const el = document.createElement('div'); el.className = 'rw-player' + (p.isHost?' host':'');
    const solShort = p.solana ? p.solana.slice(0,8)+'…'+p.solana.slice(-4) : '—';
    el.innerHTML = `<span class="rw-avatar">${SKINS[p.skin]?SKINS[p.skin].emoji:'🦍'}</span>
      <span class="rw-pname">${p.name}${p.isHost?' <span class="rw-host-tag">HOST</span>':''}</span>
      <span class="rw-sol">💳 ${solShort}</span>`;
    list.appendChild(el);
  });
}
function updateRoomInfo(){
  const r = currentRoom; if(!r) return;
  const startStr = r.startUTC ? new Date(r.startUTC).toUTCString() : 'Manual start (host starts)';
  document.getElementById('rw-name').textContent = '🏠 ' + r.name;
  document.getElementById('rw-meta').textContent = `${r.players.length}/${r.max} players · ${r.rounds} rounds · Host: ${r.hostName}`;
  document.getElementById('rw-start-time').textContent = '⏰ ' + startStr;
  const cdEl = document.getElementById('rw-countdown');
  if (r.startUTC){
    const diff = new Date(r.startUTC).getTime() - Date.now();
    if (diff<=0){ cdEl.classList.remove('hidden'); cdEl.textContent='STARTING!'; }
    else { cdEl.classList.remove('hidden'); cdEl.textContent='Starts in ' + roomCountdownStr(r.startUTC); }
  } else { cdEl.classList.add('hidden'); }
}
function startRoomPolling(){
  stopRoomPolling();
  roomPollInterval = setInterval(()=>{
    if (!currentRoom) { stopRoomPolling(); return; }
    const r = Rooms.get(currentRoom.id);
    if (!r) { stopRoomPolling(); enterRooms(); return; }
    currentRoom = r;
    renderRoomPlayers(); updateRoomInfo();
    // auto-start when UTC time reached
    if (r.startUTC && r.status==='waiting'){
      const diff = new Date(r.startUTC).getTime() - Date.now();
      if (diff<=0){ startRoomMatch(); }
    }
    // auto-start if full
    if (r.players.length>=r.max && r.status==='waiting'){
      startRoomMatch();
    }
  }, 1000);
}
function stopRoomPolling(){ if(roomPollInterval){ clearInterval(roomPollInterval); roomPollInterval=null; } }
function startRoomMatch(){
  if (!currentRoom) return;
  const r = Rooms.get(currentRoom.id);
  if (!r) return;
  r.status = 'playing'; Rooms.update(r);
  stopRoomPolling();
  shared.round = 1;
  G.data.fieldSize = Math.min(r.max, r.players.length);
  G.data.isRoomMatch = true;
  G.data.roomPlayers = r.players.slice();
  G.data.roomRounds = r.rounds;
  enterRoulette();
}
function leaveRoom(){
  if (currentRoom){
    const u = shared.user;
    Rooms.leave(currentRoom.id, u?u.name:'Guest');
  }
  stopRoomPolling(); currentRoom=null;
  enterMenu();
}

// ============================================================
// UI WIRING
// ============================================================
function wireUI(){
  document.getElementById('btn-play').onclick=()=>{ Audio.ensure(); Audio.SFX.click(); shared.round=1; G.data.fieldSize=32; G.data.isRoomMatch=false; enterLobby(); };
  document.getElementById('btn-customize').onclick=()=>{ Audio.SFX.click(); enterCustomize(); };
  document.getElementById('btn-rooms').onclick=()=>{ Audio.SFX.click(); enterRooms(); };
  document.getElementById('btn-history').onclick=()=>{ Audio.SFX.click(); showHistory(); };
  document.getElementById('cust-back').onclick=()=>{ Audio.SFX.click(); enterMenu(); };
  document.getElementById('force-start').onclick=()=>{ Audio.SFX.click(); G.data.forceStart=true; };
  document.querySelectorAll('.tab').forEach(t=> t.onclick=()=>{ Audio.SFX.click(); buildCustomGrid(t.dataset.tab); });

  document.getElementById('result-continue').onclick=()=>{ Audio.SFX.click();
    const maxRounds = G.data.roomRounds || 3;
    if (G.data.lastQualified){
      if (shared.round>=maxRounds){ enterMenu(); }
      else { shared.round++; G.data.fieldSize=G.data.qualifyTarget; G.actors.forEach(a=>a.dispose()); G.actors=[]; enterRoulette(); }
    } else { enterMenu(); }
  };
  document.getElementById('result-quit').onclick=()=>{ Audio.SFX.click(); enterMenu(); };

  // rooms
  document.getElementById('rooms-back').onclick=()=>{ Audio.SFX.click(); enterMenu(); };
  document.getElementById('room-refresh').onclick=()=>{ Audio.SFX.click(); renderRoomList(); };
  document.getElementById('room-create-btn').onclick=()=>{ Audio.SFX.click();
    const name=document.getElementById('room-name').value.trim() || 'Degen Room';
    const max=parseInt(document.getElementById('room-max').value)||32;
    const startVal=document.getElementById('room-start').value;
    const rounds=parseInt(document.getElementById('room-rounds').value)||3;
    const startUTC = startVal ? new Date(startVal).toISOString() : null;
    const r = Rooms.create(name, max, startUTC, rounds);
    currentRoom = r; showRoomWaiting(); startRoomPolling();
  };
  document.getElementById('rw-leave').onclick=()=>{ Audio.SFX.click(); leaveRoom(); };
  document.getElementById('rw-force-start').onclick=()=>{ Audio.SFX.click(); startRoomMatch(); };

  // winner screen
  document.getElementById('winner-continue').onclick=()=>{ Audio.SFX.click(); enterMenu(); };

  // history
  document.getElementById('history-back').onclick=()=>{ Audio.SFX.click(); document.getElementById('settings-modal').classList.add('hidden'); showScreen('main-menu'); G.mode='menu'; };
  document.getElementById('btn-history').onclick=()=>{ Audio.SFX.click(); showHistory(); };

  // settings
  const sm=document.getElementById('settings-modal');
  document.getElementById('settings-btn').onclick=()=>sm.classList.remove('hidden');
  document.getElementById('settings-close').onclick=()=>sm.classList.add('hidden');
  document.getElementById('logout-btn').onclick=()=>{ Audio.SFX.click(); sm.classList.add('hidden'); Auth.logout(); shared.user=null; disposeActors(); disposeMap(); showAuth(); };
  const mt=document.getElementById('mute-toggle');
  mt.classList.toggle('on',!shared.mute); mt.textContent=shared.mute?'OFF':'ON';
  mt.onclick=()=>{ Audio.setMute(!shared.mute); mt.classList.toggle('on',!shared.mute); mt.textContent=shared.mute?'OFF':'ON'; };
  const qt=document.getElementById('quality-toggle');
  qt.onclick=()=>{ shared.quality=shared.quality==='high'?'low':'high'; localStorage.setItem('stumblePump_quality',shared.quality); qt.textContent=shared.quality.toUpperCase(); renderer.shadowMap.enabled=shared.quality==='high'; BLOOM_ON=shared.quality==='high'; renderer.setPixelRatio(shared.quality==='high'?Math.min(devicePixelRatio,2):1); composer?.setSize(innerWidth,innerHeight); };
}

// ============================================================
// MAIN LOOP
// ============================================================
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(0.05, clock.getDelta()), t=clock.elapsedTime;
  G.modeT+=dt;
  updateFX(dt);
  switch(G.mode){
    case 'menu': case 'customize': if(G.preview){ G.preview.anim.set('idle'); G.preview.anim.update(dt,t); } G.map?.update?.(t); break;
    case 'lobby': updateLobby(dt,t); break;
    case 'roulette': updateRoulette(dt,t); break;
    case 'match': updateMatch(dt,t); break;
    case 'result': if(G.player){ G.player.anim.update(dt,t); G.map?.update?.(dt,t); } break;
    case 'winner': if(G.player){ G.player.anim.update(dt,t); G.map?.update?.(dt,t); } break;
    case 'rooms': case 'room-waiting': case 'history': break;
  }
  updateCamera(dt);
  updateHUD(dt);
  renderFrame();
}

// ============================================================
// BOOT
// ============================================================
const LOAD_TIPS=['Loading degen physics…','Calibrating bonding curves…','Charging the green candles…','Bribing the dev (sus)…','Inflating the bags…','Aping in 3… 2… 1…','Summoning 32 degens…'];
// mobile landscape detection
function checkOrientation(){
  if (!MOBILE) return;
  const rp = document.getElementById('rotate-prompt');
  const isPortrait = innerHeight > innerWidth;
  if (isPortrait){ rp.classList.remove('hidden'); }
  else { rp.classList.add('hidden'); }
}
addEventListener('orientationchange', ()=> setTimeout(checkOrientation, 100));
addEventListener('resize', checkOrientation);

function boot(){
  initMobileControls(); wireUI(); wireAuth(); checkOrientation();
  let p=0; const fill=document.getElementById('loader-fill');
  const pctEl=document.getElementById('loader-pct');
  const tipEl=document.getElementById('loader-tip'); let ti=0;
  const tipIv=setInterval(()=>{ ti=(ti+1)%LOAD_TIPS.length; if(tipEl)tipEl.textContent=LOAD_TIPS[ti]; }, 700);
  setTimeout(()=>clearInterval(tipIv), 4000);
  const iv=setInterval(()=>{ p+=8+Math.random()*14; const capped=Math.min(100,p); fill.style.width=capped+'%'; if(pctEl)pctEl.textContent=Math.floor(capped)+'%';
    if (p>=100){ clearInterval(iv); if(pctEl)pctEl.textContent='100%';
      setTimeout(()=>{ const ls=document.getElementById('loading-screen'); ls.style.transition='opacity .5s'; ls.style.opacity='0'; setTimeout(()=>ls.classList.add('hidden'),500);
      const prof=Auth.session(); if(prof){ applyProfile(prof); enterMenu(); } else { showAuth(); }
      animate(); },400); }
  },110);
}
boot();
