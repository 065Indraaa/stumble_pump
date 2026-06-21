// POST /api/me/save
// Body: partial profile fields (skin, emote, trail, ownedSkins, coins, gems,
// level, wins, games, solana). Only whitelisted fields are written.
// Returns the updated profile.
import { json, corsPreflight, requireUser, parseBody } from '../../_lib.js';

const WRITABLE = ['skin', 'emote', 'trail', 'coins', 'gems', 'level', 'wins', 'games', 'solana', 'owned_skins'];

export async function onRequestPost({ env, request }) {
  const pre = corsPreflight(request); if (pre) return pre;
  const { err, user } = await requireUser(env, request);
  if (err) return err;
  const body = await parseBody(request);

  // season_seen is a boolean that lives in sp_state, not users — handle it
  // specially before the generic user-column update below.
  if (typeof body.season_seen === 'boolean') {
    await env.DB.prepare(
      `INSERT INTO sp_state (user_id, season_seen) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET season_seen = excluded.season_seen`
    ).bind(user.id, body.season_seen ? 1 : 0).run();
  }

  const sets = [];
  const vals = [];
  for (const k of WRITABLE) {
    if (body[k] === undefined) continue;
    if (k === 'owned_skins') {
      // JSON array
      let arr = body[k];
      if (Array.isArray(arr)) vals.push(JSON.stringify(arr));
      else continue;
    } else if (typeof body[k] === 'number') {
      vals.push(body[k]);
    } else if (typeof body[k] === 'string') {
      vals.push(body[k]);
    } else continue;
    sets.push(`${k} = ?`);
  }
  if (sets.length === 0) {
    return json({ ok: true, changed: 0 });
  }
  vals.push(user.id);
  await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();

  const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  let sp = await env.DB.prepare('SELECT * FROM sp_state WHERE user_id = ?').bind(user.id).first();
  if (!sp) sp = { balance: 0, season_earned: 0, season_seen: 0 };

  let ownedSkins = ['shiller', 'devsus', 'trojan', 'paperhand'];
  try { ownedSkins = JSON.parse(updated.owned_skins || '[]'); } catch {}
  return json({
    ok: true, changed: sets.length,
    profile: {
      name: updated.username,
      level: updated.level, coins: updated.coins, gems: updated.gems,
      skin: updated.skin, emote: updated.emote, trail: updated.trail,
      wins: updated.wins, games: updated.games, guest: false,
      solana: updated.solana || '',
      ownedSkins,
      sp_balance: sp.balance,
      sp_season1_earned: sp.season_earned,
      season1_seen: !!sp.season_seen,
    },
  });
}
