// ============================================================
// STUMBLE PUMP — Rooms store (localStorage room persistence)
// Create / list / join / leave rooms with scheduled start times.
// ============================================================
import { LS_ROOMS } from '../config/constants.js';

function allRooms() { try { return JSON.parse(localStorage.getItem(LS_ROOMS)) || []; } catch (e) { return []; } }
function save(r) { localStorage.setItem(LS_ROOMS, JSON.stringify(r)); }

export const Rooms = {
  list() {
    const now = Date.now();
    // purge rooms older than 24h
    const fresh = allRooms().filter((r) => now - (r.created || now) < 86400000 && r.status !== 'finished');
    save(fresh);
    return fresh;
  },
  create(name, max, startISO, rounds) {
    const r = {
      id: 'r_' + Math.random().toString(36).slice(2, 9),
      name: name || 'Degen Room',
      max: max || 32,
      start: startISO,
      rounds: rounds || 3,
      status: 'waiting',
      players: [{ name: 'You', host: true }],
      winner: null,
      created: Date.now(),
    };
    const list = allRooms(); list.push(r); save(list);
    return r;
  },
  get(id) { return allRooms().find((r) => r.id === id); },
  update(room) {
    const list = allRooms();
    const i = list.findIndex((r) => r.id === room.id);
    if (i >= 0) { list[i] = room; save(list); }
  },
  join(id, playerName) {
    const r = this.get(id);
    if (!r) return null;
    if (r.players.length >= r.max) return null;
    r.players.push({ name: playerName });
    this.update(r);
    return r;
  },
  leave(id, playerName) {
    const r = this.get(id);
    if (!r) return;
    r.players = r.players.filter((p) => p.name !== playerName);
    if (r.players.length === 0) {
      const list = allRooms().filter((x) => x.id !== id);
      save(list);
    } else {
      this.update(r);
    }
  },
};

export function roomCountdownStr(startISO) {
  if (!startISO) return 'Starts when full';
  const target = new Date(startISO).getTime();
  const diff = target - Date.now();
  if (diff <= 0) return 'Starting now…';
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `Starts in ${mins}m ${secs.toString().padStart(2, '0')}s`;
}
