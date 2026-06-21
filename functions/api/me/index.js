// GET /api/me
// Returns the full hydrated profile (user fields + $SP state + pending
// withdraw count) in one call. The client polls this every ~3s for realtime
// sync (balance changes from wins, tournament-entry deductions, admin actions).
import { json, corsPreflight, requireUser } from '../../_lib.js';

export async function onRequestGet({ env, request }) {
  const pre = corsPreflight(request); if (pre) return pre;
  const { err, user } = await requireUser(env, request);
  if (err) return err;

  // SP state (create lazily if missing — defensive)
  let sp = await env.DB.prepare('SELECT * FROM sp_state WHERE user_id = ?').bind(user.id).first();
  if (!sp) {
    await env.DB.prepare('INSERT INTO sp_state (user_id) VALUES (?)').bind(user.id).run();
    sp = { balance: 0, season_earned: 0, season_seen: 0 };
  }

  // Pending withdraw requests (count + most recent)
  const pending = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM withdraw_requests WHERE user_id = ? AND status = ?'
  ).bind(user.id, 'pending').first();
  const recentPending = await env.DB.prepare(
    'SELECT id, amount, sol_address, status, created_at FROM withdraw_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 5'
  ).bind(user.id).all();

  return json({
    ok: true,
    profile: profileFromUser(user, sp),
    sp: {
      balance: sp.balance,
      season_earned: sp.season_earned,
      season_seen: !!sp.season_seen,
    },
    pending_withdraws: pending?.cnt || 0,
    withdraw_history: recentPending?.results || [],
  });
}

function profileFromUser(u, sp) {
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
    sp_balance: sp.balance,
    sp_season1_earned: sp.season_earned,
    season1_seen: !!sp.season_seen,
  };
}
