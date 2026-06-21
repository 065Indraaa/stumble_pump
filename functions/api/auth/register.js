// POST /api/auth/register
// Body: { username, password, solana? }
// Returns: { ok, profile, token } or { err }
import { json, corsPreflight, djb2Hash, validUsername, validPassword, validSolana, makeSession, parseBody } from '../../_lib.js';

export async function onRequestPost({ env, request }) {
  const pre = corsPreflight(request); if (pre) return pre;
  const { username, password, solana } = await parseBody(request);
  const u = (username || '').trim();

  if (!validUsername(u)) return json({ err: 'Username must be 3-16 characters' }, 400);
  if (!validPassword(password)) return json({ err: 'Password must be 3-64 characters' }, 400);
  if (!validSolana(solana)) return json({ err: 'Invalid Solana address' }, 400);

  // Check username availability
  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(u).first();
  if (existing) return json({ err: 'Username already taken' }, 409);

  const passHash = djb2Hash(password);
  const ownedDefault = '["shiller","devsus","trojan","paperhand"]';
  const result = await env.DB.prepare(
    `INSERT INTO users (username, pass_hash, solana, owned_skins) VALUES (?, ?, ?, ?)`
  ).bind(u, passHash, (solana || '').trim(), ownedDefault).run();
  const userId = result.meta.last_row_id;

  // Initialize SP state row
  await env.DB.prepare('INSERT INTO sp_state (user_id) VALUES (?)').bind(userId).run();

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  const token = await makeSession(env, user);
  return json({ ok: true, profile: profileFromUser(user), token });
}

// Shape the DB user row into the client Profile schema
function profileFromUser(u) {
  let ownedSkins = ['shiller', 'devsus', 'trojan', 'paperhand'];
  try { ownedSkins = JSON.parse(u.owned_skins || '[]'); } catch {}
  return {
    name: u.username,
    level: u.level,
    coins: u.coins,
    gems: u.gems,
    skin: u.skin,
    emote: u.emote,
    trail: u.trail,
    wins: u.wins,
    games: u.games,
    guest: false,
    solana: u.solana || '',
    ownedSkins,
    sp_balance: 0,
    sp_season1_earned: 0,
    season1_seen: false,
  };
}
