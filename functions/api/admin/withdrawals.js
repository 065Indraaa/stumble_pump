// GET  /api/admin/withdrawals?status=pending  — list requests (default: pending)
// POST /api/admin/withdrawals/review          — { id, status: 'approved'|'rejected'|'paid', txSignature? }
//
// Auth: requires the ADMIN_TOKEN secret in the Authorization: Bearer header
// (set via `npx wrangler pages secret put ADMIN_TOKEN`).
//
// This is the manual-review surface the operator uses to approve SPL payouts:
// 1. GET the pending list
// 2. Send the on-chain SPL transfer from the treasury wallet
// 3. POST review with status='paid' + txSignature
// On 'rejected', the held balance is refunded to the user's sp_state.
import { json, corsPreflight, parseBody } from '../../_lib.js';

function requireAdmin(env, request) {
  const h = request.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token || token !== (env.ADMIN_TOKEN || '')) {
    return { err: json({ err: 'forbidden' }, 403) };
  }
  return { ok: true };
}

export async function onRequestGet({ env, request }) {
  const pre = corsPreflight(request); if (pre) return pre;
  const a = requireAdmin(env, request);
  if (a.err) return a.err;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pending';
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10)));

  const res = await env.DB.prepare(
    `SELECT wr.id, wr.user_id, wr.amount, wr.sol_address, wr.status, wr.created_at,
            wr.reviewed_at, wr.reviewed_by, wr.tx_signature,
            u.username
     FROM withdraw_requests wr
     JOIN users u ON u.id = wr.user_id
     WHERE wr.status = ?
     ORDER BY wr.created_at DESC LIMIT ?`
  ).bind(status, limit).all();

  return json({
    ok: true,
    status,
    requests: (res.results || []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      amount: r.amount,
      solAddress: r.sol_address,
      status: r.status,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
      reviewedBy: r.reviewed_by,
      txSignature: r.tx_signature,
    })),
  });
}

// Nested review route handled via the /review.js file (Pages Functions file
// routing: /api/admin/withdrawals/review → functions/api/admin/withdrawals/review.js)
export async function onRequestPost({ env, request }) {
  const pre = corsPreflight(request); if (pre) return pre;
  // POST on /api/admin/withdrawals is an alias for the review endpoint
  return review(env, request);
}

export async function review(env, request) {
  const a = requireAdmin(env, request);
  if (a.err) return a.err;
  const { id, status, txSignature, reviewerName } = await parseBody(request);
  if (!id || !['approved', 'rejected', 'paid'].includes(status)) {
    return json({ err: 'invalid params (id, status required)' }, 400);
  }
  const req = await env.DB.prepare(
    'SELECT * FROM withdraw_requests WHERE id = ?'
  ).bind(id).first();
  if (!req) return json({ err: 'request not found' }, 404);
  if (req.status !== 'pending' && req.status !== 'approved') {
    return json({ err: `request already ${req.status}` }, 409);
  }

  await env.DB.prepare(
    `UPDATE withdraw_requests SET status = ?, reviewed_at = ?, reviewed_by = ?, tx_signature = ? WHERE id = ?`
  ).bind(status, Date.now(), reviewerName || 'admin', txSignature || null, id).run();

  // Refund on reject (restore the held balance to the user)
  if (status === 'rejected') {
    await env.DB.prepare(
      `UPDATE sp_state SET balance = balance + ? WHERE user_id = ?`
    ).bind(req.amount, req.user_id).run();
    await env.DB.prepare(
      `INSERT INTO sp_tx (user_id, amount, reason, balance_after) VALUES (?, ?, 'refund', (SELECT balance FROM sp_state WHERE user_id = ?))`
    ).bind(req.user_id, req.amount, req.user_id).run();
  }

  return json({ ok: true, id, status });
}
