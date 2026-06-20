// ============================================================
// STUMBLE PUMP — Rooms store (localStorage room persistence)
// Create / list / join / leave rooms with scheduled start times.
// Finished rooms are kept (status='finished') and surfaced via listFinished()
// so the Rooms screen can show a match history.
// ============================================================
import { LS_ROOMS } from '../config/constants.js';

function allRooms() { try { return JSON.parse(localStorage.getItem(LS_ROOMS)) || []; } catch (e) { return []; } }
function save(r) { localStorage.setItem(LS_ROOMS, JSON.stringify(r)); }

export const Rooms = {
  /** Active (joinable) rooms — purged after 24h, excludes finished ones. */
  list() {
    const now = Date.now();
    const fresh = allRooms().filter((r) => now - (r.created || now) < 86400000 && r.status !== 'finished');
    save(fresh.concat(allRooms().filter((r) => r.status === 'finished'))); // keep tombstones
    return fresh;
  },
  /** Finished rooms (local match history). */
  listFinished() {
    const now = Date.now();
    const fresh = allRooms().filter((r) => r.status === 'finished' && now - (r.ended || now) < 86400000);
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
  /** Mark a room finished with results (called when a match completes). */
  finish(id, results) {
    const list = allRooms();
    const i = list.findIndex((r) => r.id === id);
    if (i >= 0) {
      list[i].status = 'finished';
      list[i].ended = Date.now();
      list[i].winnerName = results?.winnerName || null;
      list[i].map = results?.map || null;
      list[i].players = results?.players || list[i].players?.length || 0;
      save(list);
    }
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
    // Only prune a room fully if it's still waiting AND empty. Finished rooms
    // are retained as history, so we never auto-delete them here.
    r.players = r.players.filter((p) => p.name !== playerName);
    if (r.players.length === 0 && r.status !== 'finished') {
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
  if (isNaN(target)) return 'Starts when full';
  const diff = target - Date.now();
  if (diff <= 0) return 'Starting now…';
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `Starts in ${mins}m ${secs.toString().padStart(2, '0')}s`;
}
