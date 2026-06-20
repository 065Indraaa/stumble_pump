// ============================================================
// STUMBLE PUMP — Auth store (localStorage profile persistence)
// Register / login / guest. Profile schema owns currency, skins,
// stats. Ported from legacy Auth IIFE.
// ============================================================
import { LS_USERS, LS_SESSION } from '../config/constants.js';

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function users() { try { return JSON.parse(localStorage.getItem(LS_USERS)) || {}; } catch (e) { return {}; } }
function saveUsers(u) { localStorage.setItem(LS_USERS, JSON.stringify(u)); }
function newProfile(name) {
  return {
    name, level: 1, coins: 500, gems: 10,
    skin: 'shiller', emote: 'dance', trail: 'rocket',
    wins: 0, games: 0, guest: false, solana: '',
    ownedSkins: ['shiller', 'devsus', 'trojan', 'paperhand'],
  };
}

export function register(u, p, sol) {
  u = (u || '').trim();
  if (u.length < 3) return { err: 'Username min 3 characters' };
  if ((p || '').length < 3) return { err: 'Password min 3 characters' };
  const all = users();
  if (all[u.toLowerCase()]) return { err: 'Username already taken' };
  const prof = newProfile(u);
  prof.solana = (sol || '').trim();
  all[u.toLowerCase()] = { pass: hash(p), profile: prof };
  saveUsers(all);
  localStorage.setItem(LS_SESSION, u.toLowerCase());
  return { ok: true, profile: prof };
}

export function login(u, p) {
  u = (u || '').trim();
  const rec = users()[u.toLowerCase()];
  if (!rec) return { err: 'No account with that name' };
  if (rec.pass !== hash(p)) return { err: 'Wrong password' };
  localStorage.setItem(LS_SESSION, u.toLowerCase());
  return { ok: true, profile: rec.profile };
}

export function updateSolana(sol) {
  const s = localStorage.getItem(LS_SESSION);
  if (!s) return;
  const all = users();
  if (all[s]) { all[s].profile.solana = (sol || '').trim(); saveUsers(all); }
}

export function guest() {
  const prof = newProfile('Degen' + Math.floor(Math.random() * 9000 + 1000));
  prof.guest = true;
  return { ok: true, profile: prof };
}

export function session() {
  const s = localStorage.getItem(LS_SESSION);
  if (!s) return null;
  const rec = users()[s];
  return rec ? rec.profile : null;
}

export function save(prof) {
  if (!prof || prof.guest) return;
  const all = users();
  const k = prof.name.toLowerCase();
  if (all[k]) { all[k].profile = prof; saveUsers(all); }
}

export function logout() { localStorage.removeItem(LS_SESSION); }
