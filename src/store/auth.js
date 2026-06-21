// ============================================================
// STUMBLE PUMP — Auth store (D1-backed)
// register / login / me / save. All async against the Cloudflare D1 API.
// Session token lives in sessionStorage (see store/api.js). D1-only: there is
// no localStorage fallback — the game boots only after /api/health succeeds.
// ============================================================
import { API } from './api.js';

// ---- in-memory profile cache (synchronous reads for HUD) ----
let _profile = null;
export function profile() { return _profile; }
export function setProfile(p) { _profile = p; }

export async function register(u, p, sol) {
  u = (u || '').trim();
  if (u.length < 3) return { err: 'Username min 3 characters' };
  if ((p || '').length < 3) return { err: 'Password min 3 characters' };
  const r = await API.register(u, p, sol);
  if (r.err) return r;
  _profile = r.profile;
  return { ok: true, profile: r.profile };
}

export async function login(u, p) {
  u = (u || '').trim();
  const r = await API.login(u, p);
  if (r.err) return r;
  _profile = r.profile;
  return { ok: true, profile: r.profile };
}

export async function me() {
  const r = await API.me();
  if (r.err) return null;
  _profile = r.profile;
  return r.profile;
}

export async function save(prof) {
  if (!prof || prof.guest) return;
  // Persist only the mutable fields the server accepts
  const r = await API.saveProfile({
    skin: prof.skin, emote: prof.emote, trail: prof.trail,
    coins: prof.coins, gems: prof.gems, level: prof.level,
    wins: prof.wins, games: prof.games, solana: prof.solana,
    owned_skins: prof.ownedSkins,
  });
  if (r.ok && r.profile) _profile = r.profile;
  return r;
}

export function updateSolana(sol) {
  if (!_profile) return;
  _profile.solana = (sol || '').trim();
  return save(_profile);
}

export function logout() {
  API.logout();
  _profile = null;
}

// Keep the old session() name for callers that just want the cached profile
export function session() { return _profile; }
