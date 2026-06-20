// ============================================================
// STUMBLE PUMP — NetManager (MQTT lobby presence + room matchmaking)
// Connects to public EMQX broker. Presence peers shown as lobby
// avatars; room peers fill match slots before bots. Graceful failure
// (game stays fully playable offline with bots).
// ============================================================
import { MQTT_URL, TOPIC_PRESENCE, TOPIC_ROOM_JOIN, TOPIC_ROOM_LEAVE, TOPIC_ROOM_START, MAX_ROOM, ROOM_TIMEOUT } from '../config/constants.js';

const id = 'p' + Math.random().toString(36).slice(2, 9);
let client = null, connected = false, failed = false, lastPub = 0;
const peers = new Map();
const roomPeers = new Map();
const local = { pos: { x: 0, y: 0, z: 0 }, anim: 'idle', facing: 0, skin: 'shiller', name: 'Player' };
let myRoomId = null;

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
    });
    client.on('message', (t, msg) => {
      try {
        const d = JSON.parse(msg.toString());
        if (d.id === id) return;
        d.last = performance.now();
        if (t === TOPIC_PRESENCE) peers.set(d.id, d);
        else if (t === TOPIC_ROOM_JOIN) roomPeers.set(d.id, { roomId: d.roomId, name: d.name, skin: d.skin, last: performance.now() });
        else if (t === TOPIC_ROOM_LEAVE) roomPeers.delete(d.id);
        else if (t === TOPIC_ROOM_START) {
          if (d.roomId && myRoomId !== d.roomId) {
            for (const [pid, rp] of [...roomPeers]) { if (rp.roomId === d.roomId) roomPeers.delete(pid); }
          }
        }
      } catch (e) {}
    });
    client.on('error', () => {});
    client.on('close', () => { connected = false; });
  } catch (e) { failed = true; }
}

function joinMatchmaking() {
  if (!connected || !client) return null;
  const roomCounts = {};
  for (const [pid, rp] of roomPeers) {
    if (performance.now() - rp.last > ROOM_TIMEOUT) continue;
    roomCounts[rp.roomId] = (roomCounts[rp.roomId] || 0) + 1;
  }
  let chosenRoom = null;
  for (const rid in roomCounts) { if (roomCounts[rid] < MAX_ROOM) { chosenRoom = rid; break; } }
  if (!chosenRoom) chosenRoom = 'room_' + Math.random().toString(36).slice(2, 8);
  myRoomId = chosenRoom;
  const joinMsg = { id, roomId: myRoomId, name: (local.name || 'Player'), skin: local.skin };
  try { client.publish(TOPIC_ROOM_JOIN, JSON.stringify(joinMsg)); } catch (e) {}
  roomPeers.set(id, { roomId: myRoomId, name: joinMsg.name, skin: joinMsg.skin, last: performance.now() });
  return myRoomId;
}

function leaveRoom() {
  if (myRoomId && connected && client) {
    try { client.publish(TOPIC_ROOM_LEAVE, JSON.stringify({ id, roomId: myRoomId })); } catch (e) {}
  }
  roomPeers.delete(id);
  myRoomId = null;
}

function announceRoomStart() {
  if (myRoomId && connected && client) {
    try { client.publish(TOPIC_ROOM_START, JSON.stringify({ id, roomId: myRoomId })); } catch (e) {}
  }
}

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
      list.push({ id: pid, name: rp.name, skin: rp.skin });
    }
  }
  return list;
}

function publish(force) {
  if (!connected || !client) return;
  const now = performance.now();
  if (!force && now - lastPub < 120) return;
  lastPub = now;
  try { client.publish(TOPIC_PRESENCE, JSON.stringify({ id, ...local })); } catch (e) {}
  if (myRoomId && now - (publish._lastRoomPub || 0) > 2000) {
    publish._lastRoomPub = now;
    try { client.publish(TOPIC_ROOM_JOIN, JSON.stringify({ id, roomId: myRoomId, name: (local.name || 'Player'), skin: local.skin })); } catch (e) {}
  }
}

function prune() {
  const now = performance.now();
  for (const [k, v] of peers) { if (now - v.last > 4500) peers.delete(k); }
  for (const [k, v] of roomPeers) { if (now - v.last > ROOM_TIMEOUT) roomPeers.delete(k); }
}

function setLocal(o) { Object.assign(local, o); }
function realCount() { return 1 + peers.size; }

export const Net = {
  id, connect, publish, prune, peers, setLocal, realCount,
  joinMatchmaking, leaveRoom, announceRoomStart, roomPlayerCount, roomPeersList,
  get roomId() { return myRoomId; },
  get connected() { return connected; },
  get failed() { return failed; },
};
