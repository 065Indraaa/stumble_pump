// ============================================================
// STUMBLE PUMP — GameController
// Orchestrates the whole game: owns the shared player profile/round
// state, drives SceneManager modes (menu, customize, lobby, roulette,
// match, result, winner, rooms, room-waiting, history), wires DOM UI,
// and drives camera + HUD per mode.
// ============================================================
import * as THREE from 'three';
import { scene, camera, shakeCamera, tickCamShake, MOBILE } from './core/Engine.js';
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
import { makeBackdrop, lambertMat } from './core/AssetFactory.js';
import { clearScene } from './levels/env.js';
import { MOVE_SPEED } from './config/constants.js';

import { buildLobby } from './levels/lobby.js';
import { buildBondingCurve } from './levels/bondingCurve.js';
import { buildMoonMission } from './levels/moonMission.js';
import { buildLiquidationLane } from './levels/liquidationLane.js';
import { buildRugpull } from './levels/rugpullRoulette.js';

const MAPS = [
  { name: 'BONDING CURVE CLIMB', type: 'RACE', emoji: '📈', build: buildBondingCurve, goal: 'First 16 to climb the curve qualify', tip: 'Dodge red candles · bounce green pads · jump the sweepers' },
  { name: 'RUGPULL ROULETTE', type: 'SURVIVAL', emoji: '🕳️', build: buildRugpull, goal: "Survive 60 seconds — don't fall when platforms rug", tip: 'Platforms flash red before they drop. Grab coins!' },
  { name: 'MOON MISSION', type: 'RACE', emoji: '🌙', build: buildMoonMission, goal: 'First 16 to reach the moon qualify', tip: 'Jump the gaps · ride the movers · time the wrecking balls' },
  { name: 'LIQUIDATION LANE', type: 'RACE', emoji: '💀', build: buildLiquidationLane, goal: 'First 16 down the canyon survive', tip: "Don't fall in the lava · hop the green platforms" },
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
// MENU / CUSTOMIZE preview
// ============================================================
function buildPreview() {
  clearScene();
  const group = new THREE.Group(); scene.add(group);
  group.add(makeBackdrop('menu_bg', { radius: 80, height: 90, y: 20 }));
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 1.5, 32), lambertMat(0x4A90D9));
  floor.position.y = -0.8; floor.receiveShadow = true; group.add(floor);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(18, 0.3, 8, 64), lambertMat(0xFF6B35));
  edge.rotation.x = -Math.PI / 2; edge.position.y = -0.05; group.add(edge);
  if (G.preview) { G.preview.dispose(); }
  G.preview = new Actor(shared.selectedSkin, true, 'player');
  G.preview.pos.set(0, 0, 0);
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
  G.data = { spawnTimer: 0.2, target: 32, countdown: -1, cdTimer: 0, minReached: false, forceStart: false, matchmade: false };
  showScreen('lobby-ui');
  document.getElementById('lobby-count').textContent = '1';
  Net.connect();
  Net.setLocal({ name: shared.user?.name || 'Player', skin: shared.selectedSkin });
  for (let i = 0; i < 5; i++) spawnLobbyBot();
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
  d.spawnTimer -= dt;
  if (d.spawnTimer <= 0 && G.actors.length < d.target) {
    d.spawnTimer = 0.6 + Math.random() * 0.8;
    spawnLobbyBot();
  }
  G.actors.forEach((a) => a.update(dt, t, G.map));
  G.map.update(dt, t);
  if (Net.connected) {
    Net.setLocal({ pos: { x: G.player.pos.x, y: G.player.pos.y, z: G.player.pos.z }, anim: G.player.anim.state, facing: G.player.facing });
    Net.publish();
    Net.prune();
    document.getElementById('lobby-count').textContent = Math.min(1 + Net.peers.size + (G.actors.length - 1), 32);
  } else {
    document.getElementById('lobby-count').textContent = G.actors.length;
  }
  const total = G.actors.length;
  const statusEl = document.getElementById('net-status');
  const fs = document.getElementById('force-start');
  if (total >= 32) statusEl.textContent = 'Lobby full — match starting!';
  else if (Net.connected) statusEl.textContent = `Searching for degens… ${total}/32`;
  else statusEl.textContent = Net.failed ? 'Offline mode — bots only' : 'Connecting…';
  if ((Net.failed || total >= 8) && total < 32) fs.classList.remove('hidden');
  else fs.classList.add('hidden');
  if (total >= 32 || d.forceStart) {
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
    c.innerHTML = `<div class="sc-emoji">${m.emoji}</div><div class="sc-name">${m.name}</div><div class="sc-type">${m.type}</div>`;
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
  const realPeers = Net.roomPeersList();
  let spawnIdx = 1;
  for (const peer of realPeers) {
    if (spawnIdx >= fieldSize) break;
    const a = new Actor(peer.skin || randomBotSkinLocal(), false, botBrain);
    a.pos.copy(sp[spawnIdx % sp.length]); a.pos.x += (Math.random() - 0.5);
    a.checkpoint.copy(a.pos);
    a.addNameplate(peer.name || 'Player');
    a._isRealPeer = true;
    G.actors.push(a); spawnIdx++;
  }
  for (let i = spawnIdx; i < fieldSize; i++) {
    const b = new Actor(randomBotSkinLocal(), false, botBrain);
    b.pos.copy(sp[i % sp.length]); b.pos.x += (Math.random() - 0.5);
    b.checkpoint.copy(b.pos);
    G.actors.push(b);
  }
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
  if (G.data.survive) { objText.textContent = `⏱ Survive ${G.map.surviveTime || 45}s — don't fall`; rprog.classList.add('hidden'); }
  else { objText.textContent = `🏁 Reach the finish — top ${G.data.qualifyTarget} qualify`; rprog.classList.remove('hidden'); document.getElementById('rp-fill').style.width = '0%'; }
  showArenaIntro(mapDef);
  G.data.phase = 'countdown'; G.data.cd = 3.9; G.data.cdShown = 4;
  document.getElementById('big-countdown').classList.remove('hidden');
  setMode('match');
}

function showArenaIntro(mapDef) {
  const ai = document.getElementById('arena-intro');
  document.getElementById('ai-round').textContent = 'ROUND ' + shared.round + ' OF 3';
  document.getElementById('ai-map').textContent = mapDef.name;
  document.getElementById('ai-goal').textContent = (mapDef.type === 'SURVIVAL' ? '🕳️ ' : '🏁 ') + (mapDef.goal || '');
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
    document.getElementById('result-text').textContent = '✅ QUALIFIED!';
    stats.innerHTML = `<div class="rs-big">#${p.finishPos || '-'}</div>Round ${shared.round} cleared · WAGMI`;
    p.anim.set('celebrate'); contBtn.textContent = 'CONTINUE'; quitBtn.classList.add('hidden');
    SFX.qualify();
  } else {
    ui.classList.add('eliminated');
    document.getElementById('result-text').textContent = '❌ REKT';
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
  document.getElementById('winner-name').textContent = '👑 ' + winnerName;
  document.getElementById('winner-sol').textContent = winnerSol ? '💳 ' + winnerSol : '💳 No Solana address set';
  document.getElementById('winner-stats').textContent = `PUMP KING of ${G.actors.length} degens · ${G.data.roomRounds || 3} rounds survived`;
  const podiumEl = document.getElementById('winner-podium'); podiumEl.innerHTML = '';
  const medals = ['🥇', '🥈', '🥉']; const cls = ['gold', 'silver', 'bronze'];
  podium.forEach((a, i) => {
    const row = document.createElement('div'); row.className = 'podium-row ' + cls[i];
    const name = a.isPlayer ? winnerName : ((SKINS[a.rig.skinKey] && SKINS[a.rig.skinKey].name) || 'Degen');
    const sol = a.isPlayer ? winnerSol : '';
    row.innerHTML = `<span class="pr-rank">${medals[i]}</span><span class="pr-name">${name}</span><span class="pr-sol">${sol ? '💳 ' + sol.slice(0, 8) + '…' + sol.slice(-4) : ''}</span>`;
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
    cell.className = 'cust-cell ' + (item.rarity || 'common') + (selected ? ' sel' : '') + (owned ? '' : ' locked');
    cell.innerHTML = `<div class="cc-emoji">${item.emoji}</div><div class="cc-name">${item.name || item.n}</div><div class="cc-cost">${owned ? (selected ? 'EQUIPPED' : 'OWNED') : (item.cost + '🪙')}</div>`;
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
function enterRooms() { showScreen('rooms-screen'); renderRoomList(); setMode('rooms'); }

function renderRoomList() {
  const list = Rooms.list();
  const el = document.getElementById('room-list'); el.innerHTML = '';
  if (list.length === 0) { el.innerHTML = '<div class="empty-hint">No active rooms. Create one! 🏠</div>'; return; }
  list.forEach((r) => {
    const row = document.createElement('div'); row.className = 'room-row';
    row.innerHTML = `<div class="rr-name">${r.name}</div><div class="rr-meta">${r.players.length}/${r.max} · ${r.rounds} rounds · ${roomCountdownStr(r.start)}</div><button class="nav-btn secondary small">JOIN</button>`;
    row.querySelector('button').onclick = () => { SFX.click(); const joined = Rooms.join(r.id, shared.user?.name || 'Player'); if (joined) { currentRoom = joined; showRoomWaiting(); startRoomPolling(); } };
    el.appendChild(row);
  });
}

function showRoomWaiting() { showScreen('room-waiting'); renderRoomPlayers(); updateRoomInfo(); setMode('room-waiting'); }

function renderRoomPlayers() {
  if (!currentRoom) return;
  const el = document.getElementById('rw-player-list'); el.innerHTML = '';
  currentRoom.players.forEach((p) => {
    const row = document.createElement('div'); row.className = 'rw-player';
    row.innerHTML = `<span class="rw-p-name">${p.name}${p.host ? ' 👑' : ''}</span>`;
    el.appendChild(row);
  });
  document.getElementById('rw-count').textContent = currentRoom.players.length;
  document.getElementById('rw-max').textContent = currentRoom.max;
}

function updateRoomInfo() {
  if (!currentRoom) return;
  document.getElementById('rw-name').textContent = currentRoom.name;
  document.getElementById('rw-meta').textContent = `${currentRoom.players.length}/${currentRoom.max} players · ${currentRoom.rounds} rounds`;
  document.getElementById('rw-start-time').textContent = roomCountdownStr(currentRoom.start);
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
      if (diff <= 0) startRoomMatch();
    } else cdEl.classList.add('hidden');
  }
}

function startRoomPolling() {
  stopRoomPolling();
  roomPollInterval = setInterval(() => {
    if (!currentRoom) return;
    const fresh = Rooms.get(currentRoom.id);
    if (fresh) { currentRoom = fresh; renderRoomPlayers(); updateRoomInfo(); }
    else { stopRoomPolling(); enterMenu(); }
  }, 2000);
}
function stopRoomPolling() { if (roomPollInterval) { clearInterval(roomPollInterval); roomPollInterval = null; } }

function startRoomMatch() {
  if (!currentRoom) return;
  stopRoomPolling();
  G.data.roomRounds = currentRoom.rounds;
  G.data.isRoomMatch = true;
  G.data.fieldSize = Math.max(8, currentRoom.players.length);
  shared.round = 1;
  enterLobby();
}

function leaveRoom() {
  if (currentRoom) Rooms.leave(currentRoom.id, shared.user?.name || 'Player');
  currentRoom = null;
  stopRoomPolling();
  enterMenu();
}

function showHistory() {
  showScreen('history-screen');
  const list = History.all();
  const el = document.getElementById('history-list'); el.innerHTML = '';
  if (list.length === 0) { el.innerHTML = '<div class="empty-hint">No matches yet. Go win some! 🏆</div>'; return; }
  list.forEach((h) => {
    const row = document.createElement('div'); row.className = 'history-row';
    const d = new Date(h.date);
    row.innerHTML = `<div class="hr-crown">👑</div><div class="hr-info"><div class="hr-name">${h.winnerName}</div><div class="hr-meta">${h.map || 'Unknown'} · ${h.players} degens · ${h.rounds} rounds</div></div><div class="hr-date">${d.toLocaleDateString()}</div>`;
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
      camera.position.lerp(_camTarget.set(Math.sin(a) * 6, 2.5, Math.cos(a) * 6), 0.04);
      camera.lookAt(0, 1.2, 0);
    }
    return;
  }
  if (G.mode === 'lobby' || G.mode === 'match') {
    const p = G.player.pos;
    _camTarget.set(p.x + Math.sin(Input.camYaw) * 9, p.y + 4 + Input.camPitch * 3, p.z + Math.cos(Input.camYaw) * 9);
    camera.position.lerp(_camTarget, G.mode === 'match' ? 0.12 : 0.08);
    camera.lookAt(p.x, p.y + 1, p.z);
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
    cx.fillStyle = a.isPlayer ? '#FBBF24' : '#ffffff';
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
  register('menu', { update: (dt, t) => { if (G.preview) { G.preview.anim.set('idle'); G.preview.anim.update(dt, t); } G.map?.update?.(t); } });
  register('customize', { update: (dt, t) => { if (G.preview) { G.preview.anim.set('idle'); G.preview.anim.update(dt, t); } } });
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
  click('force-start', () => { G.data.forceStart = true; });
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
