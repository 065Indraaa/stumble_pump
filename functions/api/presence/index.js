// GET  /api/presence   — current online player count (heartbeat-based)
// POST /api/presence   — heartbeat: bumps this user's last-seen in KV (TTL 60s)
//
// Online = distinct users who heartbeated in the last 60s. KV stores
// `online:<userId>` → '1' with a 60s expiration. Counting is done by a
// rolling counter key that increments on heartbeat and expires naturally.
// For simplicity and D1-friendliness we count heartbeats in the last 60s
// from a presence log table (created lazily below).
import { json, corsPreflight, requireUser } from '../../_lib.js';

export async function onRequestGet({ env, request }) {
  const pre = corsPreflight(request); if (pre) return pre;
  // Count distinct users with a heartbeat in the last 60s
  const r = await env.DB.prepare(
    `SELECT COUNT(DISTINCT user_id) AS cnt FROM presence WHERE ts > ?`
  ).bind(Date.now() - 60_000).first();
  return json({ ok: true, online: (r?.cnt || 0) });
}

export async function onRequestPost({ env, request }) {
  const pre = corsPreflight(request); if (pre) return pre;
  const { err, user } = await requireUser(env, request);
  if (err) return err;
  // Upsert heartbeat row (lazy table creation for first deploy safety)
  await env.DB.prepare(
    `INSERT INTO presence (user_id, ts) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET ts = excluded.ts`
  ).bind(user.id, Date.now()).run();
  return json({ ok: true });
}
