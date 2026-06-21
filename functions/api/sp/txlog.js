// GET /api/sp/txlog
// Returns the user's $SP transaction history (last 50, newest first).
import { json, corsPreflight, requireUser } from '../../_lib.js';

export async function onRequestGet({ env, request }) {
  const pre = corsPreflight(request); if (pre) return pre;
  const { err, user } = await requireUser(env, request);
  if (err) return err;

  const res = await env.DB.prepare(
    `SELECT id, amount, reason, balance_after, ts FROM sp_tx WHERE user_id = ? ORDER BY ts DESC LIMIT 50`
  ).bind(user.id).all();

  return json({
    ok: true,
    log: (res.results || []).map((r) => ({
      id: r.id,
      amount: r.amount,
      reason: r.reason,
      balance: r.balance_after,
      ts: r.ts,
    })),
  });
}
