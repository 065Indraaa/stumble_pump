// ============================================================
// STUMBLE PUMP — GameController
// Orchestrates the whole game: owns the shared player profile/round
// state, drives SceneManager modes (menu, customize, lobby, roulette,
// match, result, winner, rooms, room-waiting, history), wires DOM UI,
// and drives camera + HUD per mode.
// ============================================================
import * as THREE from 'three';
import { scene, renderer, camera, shakeCamera, tickCamShake, MOBILE } from './core/Engine.js';
import { initFX, updateFX, spawnConfettiBurst } from './core/FX.js';
import { SFX, startAmbient, stopAmbient, isMuted, setMute as setAudioMute } from './core/AudioManager.js';
import { state as G, register, showScreen, setMode, tick as smTick, disposeActors, disposeMap } from './core/SceneManager.js';
import { Input } from './core/InputManager.js';
import { Net } from './net/NetManager.js';
import * as Auth from './store/auth.js';
import { Rooms, roomCountdownStr } from './store/rooms.js';
import { History } from './store/history.js';
import { Actor } from './character/Actor.js';
import { spawnBot } from './character/BotController.js';
import { SKINS, EMOTES, TRAILS } from './character/skins.js';
import { lambertMat } from './core/AssetFactory.js';
import { clearScene, make3DClouds, makeFloatingIslands, makeGroundDisc, makeHillsRing, makeForestScatter, makeBannerArch } from './levels/env.js';
import { MOVE_SPEED, SP_PALETTE } from './config/constants.js';

import { buildLobby } from './levels/lobby.js';
import { buildBondingCurve } from './levels/bondingCurve.js';
import { buildMoonMission } from './levels/moonMission.js';
import { buildLiquidationLane } from './levels/liquidationLane.js';
import { buildRugpull } from './levels/rugpullRoulette.js';

const MAPS = [
  { name: 'BONDING CURVE CLIMB', type: 'RACE', build: buildBondingCurve, goal: 'First 16 to climb the curve qualify', tip: 'Dodge red candles · bounce green pads · jump the sweepers' },
  { name: 'RUGPULL ROULETTE', type: 'SURVIVAL', build: buildRugpull, goal: "Survive 60 seconds — don't fall when platforms rug", tip: 'Platforms flash red before they drop. Grab coins!' },
  { name: 'MOON MISSION', type: 'RACE', build: buildMoonMission, goal: 'First 16 to reach the moon qualify', tip: 'Jump the gaps · ride the movers · time the wrecking balls' },
  { name: 'LIQUIDATION LANE', type: 'RACE', build: buildLiquidationLane, goal: 'First 16 down the canyon survive', tip: "Don't fall in the lava · hop the green platforms" },
];

export const shared = {
  user: null,
  selectedSkin: 'shiller',
  selectedEmote: 'moon',
  selectedTrail: 'rocket',
  round: 1,
};

let currentRoom = null;
let roomPollInterval = null;

const _camTarget = new THREE.Vector3();
const _v1 = new THREE.Vector3();

// Walk the preview stage group and call any userData.update(t) hooks so
// clouds/islands in the menu/customize backdrop keep drifting.
function _updateSky(parent, t) {
  if (!parent) return;
  for (const child of parent.children) {
    if (typeof child.userData?.update === 'function') child.userData.update(t);
  }
}

function randomBotSkinLocal() { const k = Object.keys(SKINS); return k[Math.floor(Math.random() * k.length)]; }

export function applyProfile(prof) {
  shared.user = prof;
  if (!Array.isArray(prof.ownedSkins)) prof.ownedSkins = ['shiller', 'devsus', 'trojan', 'paperhand'];
  shared.selectedSkin = prof.skin || 'shiller';
  shared.selectedEmote = prof.emote || 'moon';
  shared.selectedTrail = prof.trail || 'rocket';
  updateTopBar();
}

export function updateTopBar() {
  const u = shared.user; if (!u) return;
  document.querySelector('.pi-name').textContent = u.name;
  document.getElementById('player-level').textContent = u.level;
  document.getElementById('gem-count').textContent = u.gems;
  document.getElementById('coin-count').textContent = (u.coins || 0).toLocaleString();
}

// ============================================================
// MENU / CUSTOMIZE preview — Stumble Guys-style showcase plaza.
// Character stands on a raised hex stage that sits on a solid grass
// ground disc, surrounded by trees/bushes/rocks/flowers, with distant
// rolling hills + floating clouds filling the sky so there is no empty
// space — a real 3D party-royale lobby backdrop, not a floating void.
// ============================================================
function buildPreview() {
  clearScene();
  renderer.setClearColor(SP_PALETTE.sky);
  scene.fog = new THREE.Fog(SP_PALETTE.fog, 55, 240);
  const group = new THREE.Group(); scene.add(group);

  // ── SKY DECOR ───────────────────────────────────────────────────────
  group.add(make3DClouds(22, 120, 42));
  group.add(makeFloatingIslands(5, 95));
  // distant rolling hills ring fills the horizon (no empty sky backdrop)
  group.add(makeHillsRing(85, 16));

  // ── GROUND DISC (solid grass world, no floating void) ───────────────
  group.add(makeGroundDisc(70, SP_PALETTE.terrain, SP_PALETTE.dirt));

  // ── SURROUNDING FOREST (trees/bushes/rocks/flowers around stage) ───
  group.add(makeForestScatter(13, 62, 7777));

  // ── STAGE PLATFORM (hexagonal showcase) ───────────────────────────
  // Hex disc: top surface at Y=0.4 (slightly raised above grass so it
  // reads as a distinct podium). Character stands on top.
  const STAGE_TOP_Y = 0.4;
  const stageDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6.5, STAGE_TOP_Y + 0.8, 6),
    new THREE.MeshLambertMaterial({ color: SP_PALETTE.floor1 })
  );
  stageDisc.position.y = (STAGE_TOP_Y - 0.8) / 2; // top surface at STAGE_TOP_Y
  stageDisc.castShadow = true; stageDisc.receiveShadow = true;
  group.add(stageDisc);

  // Hex edge trim (top ring, sits on top surface)
  const stageTrim = new THREE.Mesh(
    new THREE.TorusGeometry(6, 0.22, 8, 6),
    new THREE.MeshLambertMaterial({ color: SP_PALETTE.floor2 })
  );
  stageTrim.rotation.x = -Math.PI / 2; stageTrim.position.y = STAGE_TOP_Y + 0.02;
  group.add(stageTrim);

  // Under-pedestal (tapers down to the grass)
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 3.2, 2.5, 6),
    new THREE.MeshLambertMaterial({ color: SP_PALETTE.edge })
  );
  pedestal.position.y = STAGE_TOP_Y - 2.05;
  pedestal.castShadow = true; group.add(pedestal);

  // Stage base ring (decorative ring on the grass)
  const baseRing = new THREE.Mesh(
    new THREE.TorusGeometry(5.2, 0.3, 8, 6),
    new THREE.MeshLambertMaterial({ color: SP_PALETTE.floor2 })
  );
  baseRing.rotation.x = -Math.PI / 2; baseRing.position.y = -0.1;
  group.add(baseRing);

  // ── SPOTLIGHT COLUMNS (3 columns around the stage) ────────────────
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const cr = 9.5;
    const cx = Math.cos(a) * cr, cz = Math.sin(a) * cr;
    const colColor = [SP_PALETTE.floor1, SP_PALETTE.terrain, SP_PALETTE.edge][i];

    // Column shaft base sits on grass (Y=0), top at Y=5
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.5, 5, 10),
      new THREE.MeshLambertMaterial({ color: colColor })
    );
    shaft.position.set(cx, 2.5, cz); shaft.castShadow = true; group.add(shaft);

    // Column base block (so shaft meets ground cleanly, no floating)
    const shaftBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.3, 1.0),
      new THREE.MeshLambertMaterial({ color: SP_PALETTE.dirt })
    );
    shaftBase.position.set(cx, 0.15, cz); group.add(shaftBase);

    // Column capital (top)
    const capital = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.4, 0.7, 10),
      new THREE.MeshLambertMaterial({ color: SP_PALETTE.floor2 })
    );
    capital.position.set(cx, 5.35, cz); group.add(capital);

    // Lamp globe on top
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 12, 10),
      new THREE.MeshLambertMaterial({ color: 0xFFFADD })
    );
    lamp.position.set(cx, 6.1, cz); group.add(lamp);
  }

  // ── TWO CHEERFUL BANNER ARCHES flanking the stage ──────────────────
  const archL = makeBannerArch(14, 6, SP_PALETTE.edge, SP_PALETTE.floor2);
  archL.position.set(0, 0, 11);
  archL.rotation.y = Math.PI; // face the camera
  group.add(archL);
  const archR = makeBannerArch(14, 6, SP_PALETTE.terrain, SP_PALETTE.floor1);
  archR.position.set(0, 0, -11);
  group.add(archR);

  // ── TROPHY / CHAMPION CUP (to the right of character) ─────────────
  const trophyGroup = new THREE.Group();
  trophyGroup.position.set(5, STAGE_TOP_Y, -2);
  group.add(trophyGroup);

  // Cup body
  const cupBody = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 0.8, 3, 12),
    new THREE.MeshLambertMaterial({ color: SP_PALETTE.floor2 })
  );
  cupBody.position.y = 1.5; cupBody.castShadow = true; trophyGroup.add(cupBody);

  // Cup mouth (wider top)
  const cupMouth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 1.4, 0.5, 12),
    new THREE.MeshLambertMaterial({ color: SP_PALETTE.floor2 })
  );
  cupMouth.position.y = 3.25; trophyGroup.add(cupMouth);

  // Cup base
  const cupBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.4, 0.5, 12),
    new THREE.MeshLambertMaterial({ color: SP_PALETTE.edge })
  );
  cupBase.position.y = 0.25; trophyGroup.add(cupBase);

  // Cup handles (half-torus each side)
  for (const sx of [-1, 1]) {
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.12, 6, 8, Math.PI),
      new THREE.MeshLambertMaterial({ color: SP_PALETTE.floor2 })
    );
    handle.position.set(sx * 1.9, 1.8, 0);
    handle.rotation.z = sx * Math.PI / 2;
    trophyGroup.add(handle);
  }

  // Star on top of cup
  const starSphere = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.5, 0),
    new THREE.MeshLambertMaterial({ color: SP_PALETTE.floor2 })
  );
  starSphere.position.y = 4; trophyGroup.add(starSphere);

  // ── PUMP PEDESTAL TEXT PLATE ───────────────────────────────────────
  const textPlate = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 0.8, 0.3),
    new THREE.MeshLambertMaterial({ color: SP_PALETTE.terrain })
  );
  textPlate.position.set(0, -1.6, 3.2);
  group.add(textPlate);

  if (G.preview) { G.preview.dispose(); }
  G.preview = new Actor(shared.selectedSkin, true, 'player');
  G.preview.pos.set(0, STAGE_TOP_Y, 0);
  // update menu skin tag
  const skinNameEl = document.getElementById('skin-name');
  if (skinNameEl && SKINS[shared.selectedSkin]) skinNameEl.textContent = SKINS[shared.selectedSkin].name;
}

export function enterMenu() {
  stopAmbient(); startAmbient();
  disposeActors(); disposeMap();
  buildPreview();
  showScreen('main-menu');
  updateTopBar();
  setMode('menu');
}

export function enterCustomize() {
  showScreen('customize');
  buildPreview();
  buildCustomGrid('skins');
  setMode('customize');
}

// ============================================================
// LOBBY
// ============================================================
export function enterLobby() {
  disposeActors(); disposeMap();
  G.map = buildLobby();
  G.player = new Actor(shared.selectedSkin, true, 'player');
  G.player.pos.set(0, 2, 0);
  G.player.checkpoint.copy(G.player.pos);
  G.actors = [G.player];
  // 60s waiting timer: real players join via matchmaking; bots trickle in
  // only after a grace window so the lobby doesn't feel instantly flooded.
  G.data = {
    spawnTimer: 6.0,      // grace period before first bot (let real players join)
    target: 32,
    countdown: -1,
    cdTimer: 0,
    waitTimer: 60,        // 60s lobby waiting clock
    waitStarted: true,
    forceStart: false,
    matchmade: false,
  };
  showScreen('lobby-ui');
  document.getElementById('lobby-count').textContent = '1';
  Net.connect();
  Net.setLocal({ name: shared.user?.name || 'Player', skin: shared.selectedSkin });
  // matchmaking: this fills an EXISTING public room first (Net.joinMatchmaking
  // picks a room with free slots; only creates a new one if none exist)
  if (!G.data.isRoomMatch) Net.joinMatchmaking();
  Net.setArena(true);   // broadcast our position so real peers see us
  setMode('lobby');
}

function spawnLobbyBot() {
  if (G.actors.length >= 32) return;
  const sp = new THREE.Vector3((Math.random() - 0.5) * 20, 8, (Math.random() - 0.5) * 20);
  const b = spawnBot(sp, 'lobbyBot');
  G.actors.push(b);
}

function updateLobby(dt, t) {
  const d = G.data;
  // ---- broadcast our lobby position for real-time peer sync ----
  if (Net.connected) {
    Net.setLocal({ pos: { x: G.player.pos.x, y: G.player.pos.y, z: G.player.pos.z }, anim: G.player.anim.state, facing: G.player.facing });
    Net.publishState();
    Net.publish();
    Net.prune();
    syncRemoteActors(dt, t, G.map, 'lobbyBot');
  }
  const realPeerCount = Net.roomPeersList ? Net.roomPeersList().length : 0;
  const totalActors = G.actors.length;

  // ---- 60s waiting clock ----
  if (d.waitStarted && d.countdown < 0) {
    d.waitTimer -= dt;
    if (d.waitTimer <= 0) {
      // time's up — start the match with whoever is here
      d.waitTimer = 0;
      d.forceStart = true;
    }
  }

  // ---- bot trickle: ONLY in public quick-play (never in private rooms).
  //      In a room match, the lobby is real-players-only — bots are disabled
  //      so friends actually play against each other. ----
  d.spawnTimer -= dt;
  if (!G.data.isRoomMatch) {
    const gracePassed = (60 - d.waitTimer) > 6;
    const maxBots = Net.connected ? Math.max(0, 6 - realPeerCount) : 28; // offline: fill up
    const botCount = G.actors.filter((a) => !a.isPlayer && !a._remote).length;
    if (gracePassed && d.spawnTimer <= 0 && totalActors < d.target && botCount < maxBots) {
      d.spawnTimer = 2.5 + Math.random() * 2.0;  // slow trickle (every ~3-4s)
      spawnLobbyBot();
    }
  }

  G.actors.forEach((a) => a.update(dt, t, G.map));
  G.map.update(dt, t);

  // ---- HUD ----
  document.getElementById('lobby-count').textContent = Math.min(1 + realPeerCount + (totalActors - 1 - (G.actors.filter((a) => !a.isPlayer && !a._remote).length)), 32);
  const statusEl = document.getElementById('net-status');
  const fs = document.getElementById('force-start');
  if (G.data.isRoomMatch) {
    // private room: show waiting-for-friends state, host can start anytime
    if (realPeerCount > 0) statusEl.textContent = `${realPeerCount + 1} players in room · waiting to start`;
    else statusEl.textContent = `Waiting for friends… ${Math.ceil(d.waitTimer)}s`;
    const isRoomHost = Net.roomMeta && Net.roomMeta.host;
    fs.classList.toggle('hidden', !isRoomHost);
    fs.textContent = isRoomHost ? 'START MATCH' : 'START WITH BOTS';
  } else if (Net.connected) {
    if (realPeerCount > 0) statusEl.textContent = `${realPeerCount + 1} live players · waiting…`;
    else statusEl.textContent = `Searching for players… ${Math.ceil(d.waitTimer)}s`;
    const canForce = realPeerCount >= 1 || (60 - d.waitTimer) > 20;
    fs.classList.toggle('hidden', !canForce);
    fs.textContent = 'START WITH BOTS';
  } else {
    statusEl.textContent = Net.failed ? 'Offline mode — bots only' : 'Connecting…';
    fs.classList.toggle('hidden', totalActors < 2);
    fs.textContent = 'START WITH BOTS';
  }

  // ---- start trigger: room full, force-start, OR 60s elapsed ----
  if (totalActors >= 32 || d.forceStart) {
    if (d.countdown < 0) { d.countdown = 5; d.cdTimer = 0; }
    d.cdTimer += dt;
    const cdEl = document.getElementById('countdown-overlay');
    cdEl.classList.remove('hidden');
    const n = Math.max(0, Math.ceil(5 - d.cdTimer));
    document.getElementById('lobby-cd').textContent = n;
    if (n > 0 && Math.floor(d.cdTimer) !== d._lastBeep) { d._lastBeep = Math.floor(d.cdTimer); SFX.beep(); }
    if (d.cdTimer >= 5) { cdEl.classList.add('hidden'); enterRoulette(); }
  }
}

// ============================================================
// REAL-TIME PEER SYNC — spawn/move/remove avatars for live MQTT players.
// Remote actors are tagged _remote=true and skip local physics control;
// we directly drive their pos/facing/anim from the network snapshot.
// ============================================================
function syncRemoteActors(dt, t, map, fallbackBrain) {
  if (!Net.peerStateList) return;
  let snapshots = [];
  try { snapshots = Net.peerStateList(); } catch (e) { return; }
  const liveIds = new Set(snapshots.map((s) => s.id));
  // remove remote actors whose peer dropped
  for (let i = G.actors.length - 1; i >= 0; i--) {
    const a = G.actors[i];
    if (a._remote && !liveIds.has(a._peerId)) {
      a.dispose(); G.actors.splice(i, 1);
    }
  }
  // upsert + drive each live remote
  snapshots.forEach((s) => {
    let a = G.actors.find((x) => x._remote && x._peerId === s.id);
    if (!a) {
      a = new Actor(s.skin || randomBotSkinLocal(), false, fallbackBrain || 'lobbyBot');
      a._remote = true;
      a._peerId = s.id;
      a.addNameplate(s.name || 'Player');
      G.actors.push(a);
    }
    // smooth interpolation toward the networked position (avoid jitter)
    const tx = s.pos.x, ty = s.pos.y, tz = s.pos.z;
    const k = Math.min(1, 14 * dt);
    a.pos.x += (tx - a.pos.x) * k;
    a.pos.y += (ty - a.pos.y) * k;
    a.pos.z += (tz - a.pos.z) * k;
    // facing
    if (typeof s.facing === 'number') a.facing = s.facing;
    a.root.rotation.y = -a.facing;
    // animation
    try { a.anim.set(s.anim || 'idle'); a.anim.update(dt, t); } catch (e) {}
  });
}

// ============================================================
// ROULETTE
// ============================================================
function enterRoulette() {
  disposeActors(); disposeMap();
  showScreen('roulette-ui');
  document.getElementById('round-announce').classList.add('hidden');
  const reel = document.getElementById('reel'); reel.innerHTML = '';
  const pick = Math.floor(Math.random() * MAPS.length);
  G.data.pickedMap = MAPS[pick];
  const seq = [];
  for (let i = 0; i < 24; i++) seq.push(MAPS[Math.floor(Math.random() * MAPS.length)]);
  seq.push(MAPS[pick]);
  seq.forEach((m) => {
    const c = document.createElement('div'); c.className = 'slot-card';
    c.innerHTML = `<div class="sc-name">${m.name}</div><div class="sc-type">${m.type}</div>`;
    reel.appendChild(c);
  });
  const cardH = 150, finalY = -(seq.length - 1) * cardH;
  reel.style.transition = 'none'; reel.style.transform = 'translateY(0)';
  SFX.spin();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    reel.style.transition = 'transform 3.4s cubic-bezier(.12,.78,.18,1)';
    reel.style.transform = `translateY(${finalY}px)`;
  }));
  G.data.announceAt = 3.6; G.data.startedMatch = false;
  setMode('roulette');
}

function updateRoulette(dt, t) {
  if (!G.data.startedMatch && G.modeT > G.data.announceAt) {
    SFX.ding();
    const m = G.data.pickedMap;
    document.getElementById('round-label').textContent = 'ROUND ' + shared.round;
    document.getElementById('map-label').textContent = m.name;
    document.getElementById('round-announce').classList.remove('hidden');
    G.data.startedMatch = true; G.data.matchAt = G.modeT + 1.8;
  }
  if (G.data.startedMatch && G.modeT > G.data.matchAt) {
    enterMatch(G.data.pickedMap);
  }
}

// ============================================================
// MATCH
// ============================================================
function enterMatch(mapDef) {
  disposeActors(); disposeMap();
  G.map = mapDef.build(); initFX();
  G.map.def = mapDef;
  if (G.map.timerRef !== undefined) G.map.timerRef = G.map.surviveTime;
  const sp = G.map.spawnPoints;
  G.player = new Actor(shared.selectedSkin, true, 'player');
  G.player.pos.copy(sp[0]); G.player.checkpoint.copy(sp[0]);
  G.actors = [G.player];
  Input.camYaw = 0; Input.camPitch = 0.28;
  const botBrain = G.map.type === 'race' ? 'raceBot' : 'survivalBot';
  const fieldSize = Math.max(8, G.data.fieldSize || 32);
  // Real MQTT peers: spawn as _remote avatars (driven by syncRemoteActors
  // every frame, so real cross-device players move live in the arena).
  const realPeers = Net.roomPeersList ? Net.roomPeersList() : [];
  let spawnIdx = 1;
  for (const peer of realPeers) {
    if (spawnIdx >= fieldSize) break;
    const a = new Actor(peer.skin || randomBotSkinLocal(), false, botBrain);
    a.pos.copy(sp[spawnIdx % sp.length]); a.pos.x += (Math.random() - 0.5);
    a.checkpoint.copy(a.pos);
    a.addNameplate(peer.name || 'Player');
    a._isRealPeer = true;
    a._remote = true;
    a._peerId = peer.id;
    G.actors.push(a); spawnIdx++;
  }
  // Fill remaining slots with bots — BUT NOT in private room matches,
  // where friends play exclusively against each other (no bots).
  if (!G.data.isRoomMatch) {
    for (let i = spawnIdx; i < fieldSize; i++) {
      const b = new Actor(randomBotSkinLocal(), false, botBrain);
      b.pos.copy(sp[i % sp.length]); b.pos.x += (Math.random() - 0.5);
      b.checkpoint.copy(b.pos);
      G.actors.push(b);
    }
  }
  // ensure net is in arena-broadcast mode so peers see us move
  Net.setArena(true);
  G.data.qualifyTarget = Math.ceil(fieldSize / 2);
  G.data.survive = G.map.type === 'survival';
  G.data.timer = G.map.surviveTime || 45;
  G.data.raceTimer = G.map.type === 'race' ? Math.ceil((G.map.length || 200) / MOVE_SPEED) + 40 : null;
  G.data.qualified = 0; G.data.locked = true; G.data.finishOrder = 0;
  document.getElementById('q-max').textContent = G.data.qualifyTarget;
  document.getElementById('q-cur').textContent = 0;
  document.getElementById('round-num').textContent = shared.round;
  document.getElementById('survive-timer').classList.toggle('hidden', !G.data.survive);
  document.getElementById('qualify-counter').classList.toggle('hidden', G.data.survive);
  if (MOBILE) document.getElementById('mobile-controls').classList.remove('hidden');
  showScreen('match-hud');
  const objBadge = document.getElementById('objective-badge'), objText = document.getElementById('objective-text');
  const rprog = document.getElementById('race-progress');
  objBadge.classList.remove('hidden');
  if (G.data.survive) { objText.textContent = `Survive ${G.map.surviveTime || 45}s — don't fall`; rprog.classList.add('hidden'); }
  else { objText.textContent = `Reach the finish — top ${G.data.qualifyTarget} qualify`; rprog.classList.remove('hidden'); document.getElementById('rp-fill').style.width = '0%'; }
  showArenaIntro(mapDef);
  G.data.phase = 'countdown'; G.data.cd = 3.9; G.data.cdShown = 4;
  document.getElementById('big-countdown').classList.remove('hidden');
  setMode('match');
}

function showArenaIntro(mapDef) {
  const ai = document.getElementById('arena-intro');
  document.getElementById('ai-round').textContent = 'ROUND ' + shared.round + ' OF 3';
  document.getElementById('ai-map').textContent = mapDef.name;
  document.getElementById('ai-goal').textContent = mapDef.goal || '';
  document.getElementById('ai-tip').textContent = MOBILE ? 'Joystick to move · JUMP · DIVE' : (mapDef.tip || 'WASD · SPACE · SHIFT');
  ai.classList.add('show');
  setTimeout(() => ai.classList.remove('show'), 2600);
}

function updateMatch(dt, t) {
  const d = G.data, ctx = G.map;
  if (d.phase === 'end') {
    G.actors.forEach((a) => { if (!a.dead) a.update(dt, t, ctx); });
    ctx.update(dt, t);
    return;
  }
  if (d.phase === 'countdown') {
    d.cd -= dt;
    const n = Math.ceil(d.cd - 0.9);
    const el = document.getElementById('big-countdown');
    if (n !== d.cdShown) {
      d.cdShown = n;
      if (n > 0) { el.textContent = n; SFX.beep(); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'popcd .5s'; }
      else if (n === 0) { el.textContent = 'GO!'; SFX.go(); shakeCamera(0.8, 0.4); }
    }
    if (d.cd <= 0) { d.phase = 'run'; d.locked = false; el.classList.add('hidden'); }
    G.actors.forEach((a) => { a.anim.set('idle'); a.anim.update(dt, t); });
    ctx.update(dt, t);
    return;
  }
  // RUN
  if (d.survive) {
    d.timer -= dt;
    document.getElementById('timer-val').textContent = Math.max(0, Math.ceil(d.timer));
    if (ctx.timerRef !== undefined) ctx.timerRef = d.timer;
    if (d.timer <= 0) { d.timer = 0; endMatch(); return; }
  } else if (d.raceTimer != null) {
    d.raceTimer -= dt;
    if (d.raceTimer <= 0) { endMatch(); return; }
  }
  G.actors.forEach((a) => {
    if (a.dead || a.eliminated) return;
    if (!d.locked) a.update(dt, t, ctx);
    if (a.qualified && !a.finishPos) { d.finishOrder++; a.finishPos = d.finishOrder; }
    if (a.qualified && a.isPlayer && !a.parked) { a.parked = true; if (d.qualified === 0) spawnConfettiBurst(a.pos); }
  });
  if (!d.survive) {
    const q = G.actors.filter((a) => a.qualified).length;
    if (q !== d.qualified) { d.qualified = q; document.getElementById('q-cur').textContent = q; bumpCounter(); }
    if (G.player.qualified || G.player.dead || G.player.eliminated) { endMatch(); return; }
    if (G.actors.length - countEliminated() <= d.qualifyTarget) { endMatch(); return; }
    if (ctx.finishZ) {
      const prog = Math.max(0, Math.min(1, G.player.pos.z / ctx.finishZ));
      document.getElementById('rp-fill').style.width = (prog * 100) + '%';
    }
  } else {
    const alive = G.actors.filter((a) => !a.dead && !a.eliminated).length;
    if (G.player.dead || G.player.eliminated || alive <= d.qualifyTarget) { endMatch(); return; }
  }
  ctx.update(dt, t);
}

function countEliminated() { return G.actors.filter((a) => a.dead || a.eliminated).length; }
function bumpCounter() { const el = document.getElementById('qualify-counter'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'bump .3s'; }

function endMatch() {
  G.data.phase = 'end';
  const p = G.player;
  const playerQualified = p.qualified && !p.dead;
  if (playerQualified) spawnConfettiBurst(p.pos, 60);
  setTimeout(() => showResult(playerQualified), 1400);
}

// ============================================================
// RESULT / WINNER
// ============================================================
function showResult(qualified) {
  showScreen('result-ui');
  const ui = document.getElementById('result-ui');
  const p = G.player;
  const maxRounds = G.data.roomRounds || 3;
  const isFinalRound = shared.round >= maxRounds;
  ui.className = 'screen';
  const stats = document.getElementById('result-stats');
  const contBtn = document.getElementById('result-continue');
  const quitBtn = document.getElementById('result-quit');
  if (qualified && isFinalRound) { showWinnerScreen(); return; }
  if (qualified) {
    ui.classList.add('qualified');
    document.getElementById('result-text').textContent = 'QUALIFIED';
    stats.innerHTML = `<div class="rs-big">#${p.finishPos || '-'}</div>Round ${shared.round} cleared · WAGMI`;
    p.anim.set('celebrate'); contBtn.textContent = 'CONTINUE'; quitBtn.classList.add('hidden');
    SFX.qualify();
  } else {
    ui.classList.add('eliminated');
    document.getElementById('result-text').textContent = 'REKT';
    stats.innerHTML = `<div class="rs-big">Round ${shared.round}</div>You got rugged. Paper hands never make it.`;
    p.anim.set('ragdoll'); contBtn.textContent = 'RETRY'; quitBtn.classList.remove('hidden');
    SFX.eliminate();
  }
  const u = shared.user;
  if (u) {
    u.games = (u.games || 0) + 1;
    if (qualified) { u.coins = (u.coins || 0) + (isFinalRound ? 300 : 60); if (isFinalRound) { u.wins = (u.wins || 0) + 1; u.level = (u.level || 1) + 1; } }
    else { u.coins = (u.coins || 0) + 20; }
    Auth.save(u); updateTopBar();
  }
  G.data.lastQualified = qualified;
  setMode('result');
}

function showWinnerScreen() {
  const p = G.player;
  const u = shared.user;
  const ranked = G.actors.slice().sort((a, b) => {
    if (a.qualified && !b.qualified) return -1;
    if (!a.qualified && b.qualified) return 1;
    return (a.finishPos || 99) - (b.finishPos || 99);
  });
  const podium = ranked.slice(0, 3);
  const winnerName = u ? u.name : 'Degen';
  const winnerSol = u ? (u.solana || '') : '';
  document.getElementById('winner-name').textContent = winnerName;
  document.getElementById('winner-sol').textContent = winnerSol ? winnerSol : 'No Solana address set';
  document.getElementById('winner-stats').textContent = `PUMP KING of ${G.actors.length} degens · ${G.data.roomRounds || 3} rounds survived`;
  const podiumEl = document.getElementById('winner-podium'); podiumEl.innerHTML = '';
  const ranks = ['1', '2', '3']; const cls = ['gold', 'silver', 'bronze'];
  podium.forEach((a, i) => {
    const row = document.createElement('div'); row.className = 'podium-row ' + cls[i];
    const name = a.isPlayer ? winnerName : ((SKINS[a.rig.skinKey] && SKINS[a.rig.skinKey].name) || 'Degen');
    const sol = a.isPlayer ? winnerSol : '';
    row.innerHTML = `<span class="pr-rank">${ranks[i]}</span><span class="pr-name">${name}</span><span class="pr-sol">${sol ? sol.slice(0, 8) + '…' + sol.slice(-4) : ''}</span>`;
    podiumEl.appendChild(row);
  });
  showScreen('winner-screen');
  SFX.qualify(); SFX.win();
  spawnConfettiBurst(p.pos, 120);
  History.add({
    date: new Date().toISOString(),
    winnerName, winnerSol,
    players: G.actors.length,
    rounds: G.data.roomRounds || 3,
    map: G.map && G.map.def ? G.map.def.name : 'Unknown',
    isRoom: !!G.data.isRoomMatch,
  });
  if (u) { u.games = (u.games || 0) + 1; u.coins = (u.coins || 0) + 300; u.wins = (u.wins || 0) + 1; u.level = (u.level || 1) + 1; Auth.save(u); updateTopBar(); }
  p.anim.set('celebrate');
  setMode('winner');
}

// ============================================================
// CUSTOMIZE grid
// ============================================================
function buildCustomGrid(tab) {
  const grid = document.getElementById('cust-grid'); grid.innerHTML = '';
  const items = tab === 'skins' ? Object.entries(SKINS).map(([k, v]) => ({ k, ...v })) : tab === 'emotes' ? EMOTES : TRAILS;
  items.forEach((item) => {
    const cell = document.createElement('div');
    const owned = tab === 'skins' ? skinOwned(item.k) : true;
    const selected = tab === 'skins' ? shared.selectedSkin === item.k : tab === 'emotes' ? shared.selectedEmote === item.k : shared.selectedTrail === item.k;
    cell.className = 'cust-card rarity-' + (item.rarity || 'common') + (selected ? ' selected' : '') + (owned ? '' : ' locked');
    // build a CSS color swatch using the item's body color (no emoji)
    const bodyHex = '#' + (item.body || 0x2F66E0).toString(16).padStart(6, '0');
    const accentHex = '#' + (item.accent || 0x5FCB88).toString(16).padStart(6, '0');
    const swatchStyle = `background:linear-gradient(135deg,${bodyHex},${accentHex});`;
    let badge;
    if (!owned) badge = `<div class="cc-cost">${item.cost}</div>`;
    else if (selected) badge = `<div class="cc-equipped">EQUIPPED</div>`;
    else badge = '';
    const name = item.name || item.n;
    const kol = item.kol ? `<div class="cc-kol">${item.kol}</div>` : '';
    cell.innerHTML = `<div class="cc-swatch" style="${swatchStyle}"></div><div class="cc-name">${name}</div>${kol}<div class="cc-rar rarity ${item.rarity || 'common'}">${(item.rarity || 'common').toUpperCase()}</div>${badge}`;
    cell.onclick = () => onCustomSelect(tab, item);
    grid.appendChild(cell);
  });
}

function skinOwned(key) {
  const s = SKINS[key]; if (!s) return false;
  if (s.cost === 0 || s.owned) return true;
  const u = shared.user;
  return !!(u && Array.isArray(u.ownedSkins) && u.ownedSkins.includes(key));
}

function onCustomSelect(tab, item) {
  SFX.click();
  if (tab === 'skins') {
    if (!skinOwned(item.k)) {
      const u = shared.user;
      if (!u) return;
      if ((u.coins || 0) < item.cost) { toast('Not enough coins!'); return; }
      u.coins -= item.cost;
      if (!Array.isArray(u.ownedSkins)) u.ownedSkins = [];
      u.ownedSkins.push(item.k);
      Auth.save(u); updateTopBar();
    }
    shared.selectedSkin = item.k;
    if (shared.user) { shared.user.skin = item.k; Auth.save(shared.user); }
    document.getElementById('cust-selected-name').textContent = item.name;
    document.getElementById('cust-rarity').textContent = (item.rarity || 'common').toUpperCase();
    document.getElementById('cust-rarity').className = 'rarity ' + (item.rarity || 'common');
    buildPreview();
  } else if (tab === 'emotes') {
    shared.selectedEmote = item.k;
    if (shared.user) { shared.user.emote = item.k; Auth.save(shared.user); }
  } else {
    shared.selectedTrail = item.k;
    if (shared.user) { shared.user.trail = item.k; Auth.save(shared.user); }
  }
  buildCustomGrid(tab);
}

function toast(msg) {
  const el = document.getElementById('action-banner');
  if (!el) return;
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.add('hidden'), 1800);
}

// ============================================================
// ROOMS / HISTORY
// ============================================================
function enterRooms() {
  showScreen('rooms-screen');
  Net.connect();
  renderRoomList();
  // refresh the visible-room directory periodically while on this screen
  stopRoomPolling();
  roomPollInterval = setInterval(renderRoomList, 2000);
  setMode('rooms');
}

function renderRoomList() {
  // merge local rooms + cross-device MQTT-discovered rooms
  const localList = Rooms.list().map((r) => ({ ...r, _local: true }));
  let remoteList = [];
  try { remoteList = Net.visibleRooms(); } catch (e) {}
  // de-dup by id (a local room may also be visible remotely)
  const seen = new Set();
  const merged = [...localList, ...remoteList].filter((r) => {
    if (seen.has(r.id)) return false; seen.add(r.id); return true;
  });
  const el = document.getElementById('room-list'); el.innerHTML = '';
  if (merged.length === 0) {
    el.innerHTML = '<div class="room-empty">No active rooms yet.<br>Create one to invite friends — rooms are live across devices!</div>';
    return;
  }
  merged.forEach((r) => {
    const row = document.createElement('div'); row.className = 'room-card';
    const cd = roomCountdownStr(r.start);
    const n = r.players ? r.players.length : 1;
    row.innerHTML = `<div class="rc-info"><div class="rc-name">${r.name}</div><div class="rc-meta"><span>${n}/${r.max || 32} players</span><span>${r.rounds || 3} rounds</span>${cd ? `<span class="rc-start">${cd}</span>` : ''}</div></div><button class="nav-btn primary small rc-join">JOIN</button>`;
    row.querySelector('button').onclick = (ev) => { ev.stopPropagation(); SFX.click(); joinAnyRoom(r); };
    el.appendChild(row);
  });
}

function joinAnyRoom(r) {
  const name = shared.user?.name || 'Player';
  // try local first (same device)
  const joined = r._local ? Rooms.join(r.id, name) : null;
  if (joined) {
    currentRoom = joined;
  } else {
    // cross-device join via MQTT
    Net.joinRoomRemote(r.id, name, shared.selectedSkin);
    currentRoom = { id: r.id, name: r.name, max: r.max || 32, rounds: r.rounds || 3, start: r.start || null, players: [{ name, host: false }] };
  }
  showRoomWaiting();
  startRoomPolling();
}

function showRoomWaiting() { showScreen('room-waiting'); Net.connect(); renderRoomPlayers(); updateRoomInfo(); setMode('room-waiting'); }

function renderRoomPlayers() {
  if (!currentRoom) return;
  const el = document.getElementById('rw-player-list'); el.innerHTML = '';
  const myName = shared.user?.name || 'Player';
  // local me + local players
  const seen = new Set();
  currentRoom.players.forEach((p) => {
    if (seen.has(p.name)) return; seen.add(p.name);
    const isHost = p.host || currentRoom.players[0]?.name === p.name;
    const isMe = p.name === myName;
    const row = document.createElement('div'); row.className = 'rw-player' + (isHost ? ' host' : '');
    row.innerHTML = `<div class="rw-avatar"></div><div class="rw-pname">${p.name}${isMe ? ' (You)' : ''}</div>${isHost ? '<span class="rw-host-tag">HOST</span>' : ''}`;
    el.appendChild(row);
  });
  // live MQTT peers in this room (real cross-device players)
  let peers = [];
  try { peers = Net.roomPeersList(); } catch (e) {}
  peers.forEach((rp) => {
    if (seen.has(rp.name)) return; seen.add(rp.name);
    const row = document.createElement('div'); row.className = 'rw-player' + (rp.host ? ' host' : '');
    row.innerHTML = `<div class="rw-avatar"></div><div class="rw-pname">${rp.name}</div>${rp.host ? '<span class="rw-host-tag">HOST</span>' : ''}`;
    el.appendChild(row);
  });
  const total = seen.size;
  document.getElementById('rw-count').textContent = total;
  document.getElementById('rw-max').textContent = currentRoom.max;
}

function updateRoomInfo() {
  if (!currentRoom) return;
  document.getElementById('rw-name').textContent = currentRoom.name;
  const count = 1 + (Net.roomPeersList?.().length || 0);
  document.getElementById('rw-meta').textContent = `${count}/${currentRoom.max} players · ${currentRoom.rounds} rounds`;
  document.getElementById('rw-start-time').textContent = roomCountdownStr(currentRoom.start);
  // host = first local player, OR the room host flag from MQTT
  const isHost = currentRoom.players[0]?.name === (shared.user?.name || 'Player');
  document.getElementById('rw-force-start').classList.toggle('hidden', !isHost);
  if (currentRoom.start) {
    const target = new Date(currentRoom.start).getTime();
    const diff = target - Date.now();
    const cdEl = document.getElementById('rw-countdown');
    if (diff <= 300000 && diff > 0) {
      cdEl.classList.remove('hidden');
      const mins = Math.floor(diff / 60000), secs = Math.floor((diff % 60000) / 1000);
      cdEl.textContent = `Auto-start in ${mins}m ${secs.toString().padStart(2, '0')}s`;
    } else cdEl.classList.add('hidden');
  }
}

// listen for host-initiated starts so guests auto-launch the match
window.addEventListener('sp_room_start', (e) => {
  if (G.mode === 'room-waiting' && currentRoom && e.detail?.roomId === currentRoom.id) {
    startRoomMatch();
  }
});

function startRoomPolling() {
  stopRoomPolling();
  roomPollInterval = setInterval(() => {
    if (!currentRoom) return;
    // refresh local copy
    const fresh = currentRoom._local === false ? null : Rooms.get(currentRoom.id);
    if (fresh) currentRoom = fresh;
    // heartbeat our presence + refresh peer list
    try { Net.beatRoom(true); Net.prune(); } catch (e) {}
    renderRoomPlayers();
    updateRoomInfo();
  }, 1000);
}
function stopRoomPolling() { if (roomPollInterval) { clearInterval(roomPollInterval); roomPollInterval = null; } }

function startRoomMatch() {
  if (!currentRoom) return;
  stopRoomPolling();
  G.data.roomRounds = currentRoom.rounds;
  G.data.isRoomMatch = true;
  // count real MQTT peers so the field is sized to live players
  const peerCount = 1 + (Net.roomPeersList?.().length || 0);
  G.data.fieldSize = Math.max(8, peerCount);
  // broadcast start to all peers in this room so guests launch too
  Net.announceRoomStart();
  shared.round = 1;
  enterLobby();
}

function leaveRoom() {
  if (currentRoom) Rooms.leave(currentRoom.id, shared.user?.name || 'Player');
  Net.leaveRoom();
  currentRoom = null;
  stopRoomPolling();
  enterMenu();
}

function showHistory() {
  showScreen('history-screen');
  const list = History.all();
  const el = document.getElementById('history-list'); el.innerHTML = '';
  if (list.length === 0) { el.innerHTML = '<div class="room-empty">No matches yet.<br>Go win some!</div>'; return; }
  list.forEach((h) => {
    const row = document.createElement('div'); row.className = 'he-row';
    const d = new Date(h.date);
    row.innerHTML = `<div class="he-crown"></div><div class="he-info"><div class="he-name">${h.winnerName}</div><div class="he-meta">${h.map || 'Unknown'} · ${h.players} degens · ${h.rounds} rounds</div></div><div class="he-date">${d.toLocaleDateString()}</div>`;
    el.appendChild(row);
  });
  setMode('history');
}

// ============================================================
// CAMERA + HUD
// ============================================================
function updateCamera(dt) {
  if (G.mode === 'menu' || G.mode === 'customize') {
    if (G.preview) {
      const a = G.modeT * 0.4;
      camera.position.lerp(_camTarget.set(Math.sin(a) * 6, 2.9, Math.cos(a) * 6), 0.04);
      camera.lookAt(0, 1.6, 0);
    }
    return;
  }
  if (G.mode === 'lobby' || G.mode === 'match') {
    const p = G.player.pos;
    // look-ahead: shift camera target slightly in player's movement direction
    const vx = G.player.vel.x, vz = G.player.vel.z;
    const speed = Math.hypot(vx, vz);
    const laScale = G.mode === 'match' ? 0.6 : 0.3;
    const laX = speed > 0.1 ? (vx / speed) * Math.min(speed, 4) * laScale : 0;
    const laZ = speed > 0.1 ? (vz / speed) * Math.min(speed, 4) * laScale : 0;
    // Portrait phones are tall+thin → pull the camera a bit closer + higher so
    // the player stays nicely framed without the action drifting off-screen.
    const portrait = window.innerHeight > window.innerWidth * 1.15;
    const camDist = portrait ? 7.0 : 9;
    const camHeight = portrait ? 4.6 : 4;
    _camTarget.set(p.x + laX + Math.sin(Input.camYaw) * camDist, p.y + camHeight + Input.camPitch * 3, p.z + laZ + Math.cos(Input.camYaw) * camDist);
    // frame-rate-independent smooth lerp (slightly slower for cinematic feel)
    const k = 1 - Math.exp(-(G.mode === 'match' ? 8 : 6) * dt);
    camera.position.lerp(_camTarget, k);
    camera.lookAt(p.x + laX * 0.5, p.y + 1, p.z + laZ * 0.5);
    return;
  }
  if (G.mode === 'roulette' || G.mode === 'winner') { camera.position.lerp(_v1.set(0, 4, 8), 0.05); camera.lookAt(0, 2, 0); return; }
  if (G.mode === 'result') {
    const p = G.player.pos;
    const a = G.modeT * 0.7;
    _camTarget.set(p.x + Math.sin(a) * 5, p.y + 2.5, p.z + Math.cos(a) * 5);
    camera.position.lerp(_camTarget, 0.05);
    camera.lookAt(p.x, p.y + 1, p.z);
    return;
  }
}

let _fpsAcc = 0, _fpsFrames = 0, _pingT = 0, _ping = 32;
function updateHUD(dt) {
  _fpsAcc += dt; _fpsFrames++;
  if (_fpsAcc >= 0.5) { const fps = Math.round(_fpsFrames / _fpsAcc); _fpsAcc = 0; _fpsFrames = 0; const el = document.getElementById('fps'); if (el) el.textContent = fps; }
  _pingT += dt;
  if (_pingT >= 1) { _pingT = 0; _ping = Math.max(18, Math.min(80, _ping + (Math.random() - 0.5) * 12)); const el = document.getElementById('ping'); if (el) el.textContent = Math.round(_ping); }
  if (G.mode === 'match') drawMinimap();
}

function drawMinimap() {
  const cv = document.getElementById('minimap'); if (!cv) return;
  const cx = cv.getContext('2d');
  cx.clearRect(0, 0, 120, 120);
  cx.fillStyle = 'rgba(20,30,50,0.6)'; cx.fillRect(0, 0, 120, 120);
  const scale = G.map && G.map.length ? 100 / G.map.length : 0.5;
  G.actors.forEach((a) => {
    if (a.dead || a.eliminated) return;
    cx.fillStyle = a.isPlayer ? '#5FCB88' : '#F4F6FB';
    const x = 60 + a.pos.x * 1.5;
    const z = 10 + a.pos.z * scale;
    cx.beginPath(); cx.arc(x, Math.min(110, z), a.isPlayer ? 4 : 2.5, 0, Math.PI * 2); cx.fill();
  });
}

// ============================================================
// FRAME callback
// ============================================================
export function frame(dt, t) {
  smTick(dt, t);
  updateFX(dt);
  updateCamera(dt);
  updateHUD(dt);
  tickCamShake();
}

// ============================================================
// AUTH
// ============================================================
export function showAuth() {
  disposeActors(); disposeMap();
  showScreen('auth-screen');
  document.getElementById('auth-user').value = '';
  document.getElementById('auth-pass').value = '';
  document.getElementById('auth-msg').textContent = '';
  setMode('auth');
}

function authResult(r) {
  const msg = document.getElementById('auth-msg');
  if (r.err) { msg.className = 'auth-msg'; msg.textContent = r.err; return; }
  msg.className = 'auth-msg ok'; msg.textContent = 'Welcome, ' + r.profile.name + '!';
  applyProfile(r.profile);
  setTimeout(() => enterMenu(), 300);
}

// ============================================================
// WIRE EVERYTHING
// ============================================================
export function wireAll() {
  register('menu', { update: (dt, t) => { if (G.preview) { G.preview.anim.set('idle'); G.preview.anim.update(dt, t); _updateSky(G.preview.root.parent, t); } } });
  register('customize', { update: (dt, t) => { if (G.preview) { G.preview.anim.set('idle'); G.preview.anim.update(dt, t); _updateSky(G.preview.root.parent, t); } } });
  register('lobby', { update: updateLobby });
  register('roulette', { update: updateRoulette });
  register('match', { update: updateMatch });
  register('result', { update: (dt, t) => { if (G.player) G.player.anim.update(dt, t); G.map?.update?.(dt, t); } });
  register('winner', { update: (dt, t) => { if (G.player) G.player.anim.update(dt, t); G.map?.update?.(dt, t); } });

  const click = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = () => { SFX.click(); fn(); }; };

  click('btn-play', () => { shared.round = 1; G.data.fieldSize = 32; G.data.isRoomMatch = false; G.data.roomRounds = 3; enterLobby(); });
  click('btn-customize', enterCustomize);
  click('btn-rooms', enterRooms);
  click('btn-history', showHistory);
  click('cust-back', enterMenu);
  click('force-start', () => {
    G.data.forceStart = true;
    // if host of a private room, tell all peers to launch the match too
    if (G.data.isRoomMatch && Net.roomMeta && Net.roomMeta.host) Net.announceRoomStart();
  });
  document.querySelectorAll('.tab').forEach((tb) => tb.onclick = () => { SFX.click(); buildCustomGrid(tb.dataset.tab); });

  click('result-continue', () => {
    const maxRounds = G.data.roomRounds || 3;
    if (G.data.lastQualified) {
      if (shared.round >= maxRounds) { enterMenu(); }
      else { shared.round++; G.data.fieldSize = G.data.qualifyTarget; disposeActors(); enterRoulette(); }
    } else { enterMenu(); }
  });
  click('result-quit', enterMenu);
  click('rooms-back', enterMenu);
  click('room-refresh', renderRoomList);
  click('room-create-btn', () => {
    const name = document.getElementById('room-name').value.trim() || 'Degen Room';
    const max = parseInt(document.getElementById('room-max').value) || 32;
    const startVal = document.getElementById('room-start').value;
    const rounds = parseInt(document.getElementById('room-rounds').value) || 3;
    const startUTC = startVal ? new Date(startVal).toISOString() : null;
    currentRoom = Rooms.create(name, max, startUTC, rounds);
    currentRoom._local = true;
    // broadcast this room cross-device so friends on other devices can see+join
    Net.connect();
    Net.hostRoom(currentRoom);
    showRoomWaiting(); startRoomPolling();
  });
  click('rw-leave', leaveRoom);
  click('rw-force-start', startRoomMatch);
  click('winner-continue', enterMenu);
  click('history-back', () => { document.getElementById('settings-modal').classList.add('hidden'); enterMenu(); });

  // settings
  const sm = document.getElementById('settings-modal');
  click('settings-btn', () => sm.classList.remove('hidden'));
  click('settings-close', () => sm.classList.add('hidden'));
  click('logout-btn', () => { sm.classList.add('hidden'); Auth.logout(); shared.user = null; disposeActors(); disposeMap(); showAuth(); });
  const mt = document.getElementById('mute-toggle');
  mt.classList.toggle('on', !isMuted());
  mt.textContent = isMuted() ? 'OFF' : 'ON';
  mt.onclick = () => { const m = !isMuted(); setAudioMute(m); mt.classList.toggle('on', !m); mt.textContent = m ? 'OFF' : 'ON'; };

  // auth
  let authTab = 'login';
  document.querySelectorAll('.auth-tab').forEach((t) => t.onclick = () => {
    authTab = t.dataset.atab;
    document.querySelectorAll('.auth-tab').forEach((x) => x.classList.toggle('active', x === t));
    document.getElementById('auth-submit').textContent = authTab.toUpperCase();
    document.getElementById('auth-msg').textContent = '';
    document.getElementById('auth-sol').style.display = authTab === 'register' ? '' : 'none';
  });
  document.getElementById('auth-sol').style.display = 'none';
  document.getElementById('auth-submit').onclick = () => {
    SFX.click();
    const u = document.getElementById('auth-user').value, p = document.getElementById('auth-pass').value, sol = document.getElementById('auth-sol').value;
    authResult(authTab === 'register' ? Auth.register(u, p, sol) : Auth.login(u, p));
  };
  document.getElementById('auth-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('auth-submit').click(); });
  document.getElementById('auth-guest').onclick = () => { SFX.click(); authResult(Auth.guest()); };
}
