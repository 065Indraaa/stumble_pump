// POST /api/auth/login
// Body: { username, password }
// Returns: { ok, profile, token } or { err }
import { json, corsPreflight, djb2Hash, parseBody, makeSession } from '../../_lib.js';

export async function onRequestPost({ env, request }) {
  const pre = corsPreflight(request); if (pre) return pre;
  const { username, password } = await parseBody(request);
  const u = (username || '').trim();
  if (!u || !password) return json({ err: 'Username and password required' }, 400);

  const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(u).first();
  if (!user) return json({ err: 'No account with that name' }, 404);

  const passHash = djb2Hash(password);
  if (user.pass_hash !== passHash) return json({ err: 'Wrong password' }, 401);

  const token = await makeSession(env, user);
  return json({ ok: true, profile: profileFromUser(user), token });
}

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
