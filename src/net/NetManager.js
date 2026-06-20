// ============================================================
// STUMBLE PUMP — NetManager (real-time MQTT multiplayer)
// Public EMQX broker. Handles:
//   1) Presence (online count on menu)
//   2) Room directory (cross-device create/list/join via broadcast)
//   3) Lobby + arena position sync (real players move live in 3D)
// Graceful failure — game stays fully playable offline with bots.
// ============================================================
import { MQTT_URL, TOPIC_PRESENCE, TOPIC_ROOM_JOIN, TOPIC_ROOM_LEAVE, TOPIC_ROOM_START, MAX_ROOM, ROOM_TIMEOUT } from '../config/constants.js';

const id = 'p' + Math.random().toString(36).slice(2, 9);
let client = null, connected = false, failed = false;
let lastPresence = 0, lastRoomBeat = 0, lastState = 0;

// presence: everyone online (drives the menu "X ONLINE" counter)
const peers = new Map();
// room peers: players in the SAME room/lobby/match as us
const roomPeers = new Map();
// remote room directory (rooms created by OTHER devices)
const remoteRooms = new Map();
// live state per peer: { pos, anim, facing, last } — used to move 3D avatars
const peerStates = new Map();

const local = { pos: { x: 0, y: 0, z: 0 }, anim: 'idle', facing: 0, skin: 'shiller', name: 'Player' };
let myRoomId = null;
let myRoomMeta = null;   // { name, max, rounds, host } of the room we created/joined
let inArena = false;     // when true, we broadcast position every ~80ms

function connect() {
  if (client || failed) return;
  if (!window.mqtt) { failed = true; return; }
  try {
    client = window.mqtt.connect(MQTT_URL, { clientId: id, connectTimeout: 5000, reconnectPeriod: 4000, clean: true });
    const to = setTimeout(() => { if (!connected) failed = true; }, 7000);
    client.on('connect', () => {
      connected = true; clearTimeout(to);
      client.subscribe(TOPIC_PRESENCE);
      client.subscribe(TOPIC_ROOM_JOIN);
      client.subscribe(TOPIC_ROOM_LEAVE);
      client.subscribe(TOPIC_ROOM_START);
      // announce we are online immediately
      try { client.publish(TOPIC_PRESENCE, JSON.stringify({ id, name: local.name })); } catch (e) {}
    });
    client.on('message', (t, msg) => {
      try {
        const d = JSON.parse(msg.toString());
        if (d.id === id) return;
        const now = performance.now();
        d.last = now;
        if (t === TOPIC_PRESENCE) {
          peers.set(d.id, d);
        } else if (t === TOPIC_ROOM_JOIN) {
          // a peer is in (or heartbeat-refreshes) a room
          roomPeers.set(d.id, {
            roomId: d.roomId, name: d.name, skin: d.skin,
            host: !!d.host, last: now,
          });
          // capture remote room metadata so others can list it
          if (d.roomMeta) {
            remoteRooms.set(d.roomId, {
              id: d.roomId, name: d.roomMeta.name, max: d.roomMeta.max,
              rounds: d.roomMeta.rounds, start: d.roomMeta.start || null,
              hostName: d.name, last: now,
            });
          }
          // also treat as a live state packet if pos included
          if (d.pos) peerStates.set(d.id, { pos: d.pos, anim: d.anim, facing: d.facing, last: now });
        } else if (t === TOPIC_ROOM_LEAVE) {
          roomPeers.delete(d.id);
          peerStates.delete(d.id);
        } else if (t === TOPIC_ROOM_START) {
          // host triggered a match start; peers in the same room should follow
          if (d.roomId === myRoomId) {
            window.dispatchEvent(new CustomEvent('sp_room_start', { detail: { roomId: d.roomId, host: d.host } }));
          }
        }
      } catch (e) {}
    });
    client.on('error', () => {});
    client.on('close', () => { connected = false; });
  } catch (e) { failed = true; }
}

// ---- Room directory: broadcast our room so others can discover it ----
function hostRoom(room) {
  myRoomId = room.id;
  myRoomMeta = {
    name: room.name, max: room.max, rounds: room.rounds, start: room.start || null, host: true,
  };
  beatRoom(true);
}
function joinRoomRemote(roomId, playerName, skin) {
  myRoomId = roomId;
  myRoomMeta = { name: 'Room', max: 32, rounds: 3, start: null, host: false };
  local.name = playerName; local.skin = skin;
  beatRoom(true);
}

function beatRoom(force = false) {
  if (!connected || !client || !myRoomId) return;
  const now = performance.now();
  if (!force && now - lastRoomBeat < 1500) return;
  lastRoomBeat = now;
  const payload = {
    id, roomId: myRoomId, name: local.name || 'Player', skin: local.skin,
    host: !!(myRoomMeta && myRoomMeta.host),
    roomMeta: myRoomMeta,
    // piggyback lobby position so waiting-room avatars can move
    pos: local.pos, anim: local.anim, facing: local.facing,
  };
  try { client.publish(TOPIC_ROOM_JOIN, JSON.stringify(payload)); } catch (e) {}
}

// ---- Matchmaking: auto-pick or create a public room for PLAY button ----
function joinMatchmaking() {
  if (!connected || !client) return null;
  const roomCounts = {};
  for (const [pid, rp] of roomPeers) {
    if (performance.now() - rp.last > ROOM_TIMEOUT) continue;
    if (rp.host) continue; // don't pile into hosted rooms from quick-play
    roomCounts[rp.roomId] = (roomCounts[rp.roomId] || 0) + 1;
  }
  let chosenRoom = null;
  for (const rid in roomCounts) { if (roomCounts[rid] < MAX_ROOM) { chosenRoom = rid; break; } }
  if (!chosenRoom) chosenRoom = 'qp_' + Math.random().toString(36).slice(2, 8);
  myRoomId = chosenRoom;
  myRoomMeta = { name: 'Quick Play', max: MAX_ROOM, rounds: 3, start: null, host: false };
  beatRoom(true);
  return myRoomId;
}

function leaveRoom() {
  if (myRoomId && connected && client) {
    try { client.publish(TOPIC_ROOM_LEAVE, JSON.stringify({ id, roomId: myRoomId })); } catch (e) {}
  }
  roomPeers.delete(id);
  peerStates.delete(id);
  myRoomId = null;
  myRoomMeta = null;
}

function announceRoomStart() {
  if (myRoomId && connected && client) {
    try { client.publish(TOPIC_ROOM_START, JSON.stringify({ id, roomId: myRoomId, host: id })); } catch (e) {}
  }
}

// ---- Room queries used by UI ----
function roomPlayerCount() {
  if (!myRoomId) return 1;
  let count = 1;
  for (const [pid, rp] of roomPeers) {
    if (rp.roomId === myRoomId && performance.now() - rp.last < ROOM_TIMEOUT && pid !== id) count++;
  }
  return count;
}
function roomPeersList() {
  const list = [];
  for (const [pid, rp] of roomPeers) {
    if (rp.roomId === myRoomId && performance.now() - rp.last < ROOM_TIMEOUT && pid !== id) {
      list.push({ id: pid, name: rp.name, skin: rp.skin, host: rp.host });
    }
  }
  return list;
}
/** Rooms visible across devices = remote rooms + locally-created ones. */
function visibleRooms() {
  const now = performance.now();
  const out = [];
  for (const [rid, r] of remoteRooms) {
    if (now - r.last > ROOM_TIMEOUT) continue;
    // count live players in this room
    let n = 0;
    for (const [, rp] of roomPeers) if (rp.roomId === rid && now - rp.last < ROOM_TIMEOUT) n++;
    out.push({
      id: rid, name: r.name, max: r.max, rounds: r.rounds, start: r.start,
      players: new Array(Math.max(1, n)).fill(0).map(() => ({ name: '?' })),
    });
  }
  return out;
}

// ---- Presence tick (menu online counter) ----
function publish(force) {
  if (!connected || !client) return;
  const now = performance.now();
  if (!force && now - lastPresence < 1500) return;
  lastPresence = now;
  try { client.publish(TOPIC_PRESENCE, JSON.stringify({ id, name: local.name })); } catch (e) {}
  // keep heartbeating our room so peers don't prune us
  if (myRoomId) beatRoom();
}

// ---- Arena state broadcast: real-time player position ----
function publishState() {
  if (!connected || !client || !myRoomId || !inArena) return;
  const now = performance.now();
  if (now - lastState < 70) return;  // ~14Hz is enough for third-person movement
  lastState = now;
  const payload = {
    id, roomId: myRoomId, name: local.name || 'Player', skin: local.skin,
    pos: local.pos, anim: local.anim, facing: local.facing,
    host: !!(myRoomMeta && myRoomMeta.host), roomMeta: myRoomMeta,
  };
  try { client.publish(TOPIC_ROOM_JOIN, JSON.stringify(payload)); } catch (e) {}
}

function setArena(on) { inArena = !!on; }

/** Live snapshot of every remote peer in our room — for moving 3D avatars. */
function peerStateList() {
  if (!myRoomId) return [];
  const now = performance.now();
  const out = [];
  for (const [pid, st] of peerStates) {
    const rp = roomPeers.get(pid);
    if (!rp || rp.roomId !== myRoomId) continue;
    if (now - st.last > 2500) continue; // stale — drop
    out.push({
      id: pid, name: rp.name, skin: rp.skin,
      pos: st.pos, anim: st.anim, facing: st.facing,
    });
  }
  return out;
}

function prune() {
  const now = performance.now();
  for (const [k, v] of peers) { if (now - v.last > 4500) peers.delete(k); }
  for (const [k, v] of roomPeers) { if (now - v.last > ROOM_TIMEOUT) { roomPeers.delete(k); peerStates.delete(k); } }
  for (const [k, v] of remoteRooms) { if (now - v.last > ROOM_TIMEOUT) remoteRooms.delete(k); }
  for (const [k, v] of peerStates) { if (now - v.last > 3000) peerStates.delete(k); }
}

function setLocal(o) { Object.assign(local, o); }
function realCount() { return 1 + peers.size; }

export const Net = {
  id, connect, publish, prune, peers, setLocal, realCount,
  joinMatchmaking, leaveRoom, announceRoomStart,
  roomPlayerCount, roomPeersList, visibleRooms,
  hostRoom, joinRoomRemote, beatRoom,
  publishState, setArena, peerStateList,
  get roomId() { return myRoomId; },
  get roomMeta() { return myRoomMeta; },
  get connected() { return connected; },
  get failed() { return failed; },
};
