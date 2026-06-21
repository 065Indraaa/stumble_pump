// GET  /api/history        — list current user's match history
// POST /api/history        — record a finished match { map, rounds, players, winnerName, winnerSol, isRoom, finishPos, qualified }
import { json, corsPreflight, requireUser, parseBody } from '../../_lib.js';

export async function onRequestGet({ env, request }) {
  const pre = corsPreflight(request); if (pre) return pre;
  const { err, user } = await requireUser(env, request);
  if (err) return err;

  const res = await env.DB.prepare(
    `SELECT m.id, m.map, m.rounds, m.players, m.winner_name, m.winner_sol, m.is_room, m.created_at,
            mp.finish_pos, mp.qualified, mp.earned_sp
     FROM match_players mp
     JOIN matches m ON m.id = mp.match_id
     WHERE mp.user_id = ?
     ORDER BY m.created_at DESC LIMIT 50`
  ).bind(user.id).all();

  return json({ ok: true, history: (res.results || []).map(rowFromMatch) });
}

export async function onRequestPost({ env, request }) {
  const pre = corsPreflight(request); if (pre) return pre;
  const { err, user } = await requireUser(env, request);
  if (err) return err;
  const b = await parseBody(request);

  const matchId = 'm_' + Math.random().toString(36).slice(2, 10);
  await env.DB.prepare(
    `INSERT INTO matches (id, map, rounds, players, winner_name, winner_sol, is_room) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    matchId,
    b.map || 'Unknown',
    b.rounds || 3,
    b.players || 0,
    b.winnerName || null,
    b.winnerSol || null,
    b.isRoom ? 1 : 0
  ).run();

  await env.DB.prepare(
    `INSERT INTO match_players (match_id, user_id, username, finish_pos, qualified, earned_sp) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(matchId, user.id, user.username, b.finishPos || null, b.qualified ? 1 : 0, b.earnedSP || 0).run();

  return json({ ok: true, matchId });
}

function rowFromMatch(r) {
  return {
    id: r.id,
    map: r.map,
    rounds: r.rounds,
    players: r.players,
    winnerName: r.winner_name,
    winnerSol: r.winner_sol,
    isRoom: !!r.is_room,
    date: new Date(r.created_at).toISOString(),
    finishPos: r.finish_pos,
    qualified: !!r.qualified,
    earnedSP: r.earned_sp || 0,
  };
}
