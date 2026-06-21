// POST /api/sp/withdraw
// Body: { solAddress }
// Creates a withdraw_request (status='pending') and zeroes the balance.
// Admin reviews it manually in D1 (or via /api/admin/withdrawals) before the
// on-chain SPL transfer happens. The balance is deducted here (optimistic hold)
// so the player can't double-withdraw while the request is pending.
import { json, corsPreflight, requireUser, parseBody, SP } from '../../_lib.js';

export async function onRequestPost({ env, request }) {
  const pre = corsPreflight(request); if (pre) return pre;
  const { err, user } = await requireUser(env, request);
  if (err) return err;
  const { solAddress } = await parseBody(request);
  const addr = (solAddress || '').trim();

  if (!addr || addr.length < 32 || addr.length > 44) {
    return json({ ok: false, reason: 'invalid_address' }, 400);
  }

  let sp = await env.DB.prepare('SELECT * FROM sp_state WHERE user_id = ?').bind(user.id).first();
  if (!sp) return json({ ok: false, reason: 'no_state' }, 400);
  if (sp.balance < SP.WITHDRAW_THRESHOLD) {
    return json({ ok: false, reason: 'below_threshold' });
  }

  const amount = sp.balance;

  // Deduct balance (optimistic hold — admin restores on reject)
  await env.DB.prepare('UPDATE sp_state SET balance = 0 WHERE user_id = ?').bind(user.id).run();

  // Record the pending request
  const res = await env.DB.prepare(
    `INSERT INTO withdraw_requests (user_id, amount, sol_address, status) VALUES (?, ?, ?, 'pending')`
  ).bind(user.id, amount, addr).run();

  // tx log (negative)
  await env.DB.prepare(
    `INSERT INTO sp_tx (user_id, amount, reason, balance_after) VALUES (?, ?, 'withdraw', 0)`
  ).bind(user.id, -amount).run();

  // Decrement prize pool remaining (the funds are now committed to payout)
  await env.DB.prepare(
    `UPDATE season_global SET prize_remaining = MAX(0, prize_remaining - ?), prize_distributed = prize_distributed + ?, updated_at = ? WHERE id = 1`
  ).bind(amount, amount, Date.now()).run();

  return json({
    ok: true, amount,
    message: 'Withdrawal request recorded. An admin will review and process the SPL transfer.',
    request_id: res.meta?.last_row_id,
  });
}
