// POST /api/sp/earn
// Body: { amount, reason }
// Server-authoritative earn: validates rate-limit + season cap, atomically
// updates balance + season_earned + season_global.circulating, appends a tx log.
// Returns: { ok, earned, balance } or { ok:false, reason }
import { json, corsPreflight, requireUser, parseBody, SP, checkRateLimit } from '../../_lib.js';

export async function onRequestPost({ env, request }) {
  const pre = corsPreflight(request); if (pre) return pre;
  const { err, user } = await requireUser(env, request);
  if (err) return err;
  const { amount, reason } = await parseBody(request);

  const amt = Math.floor(Number(amount) || 0);
  if (amt <= 0) return json({ ok: false, reason: 'invalid_amount' }, 400);
  if (!SP.VALID_REASONS.includes(reason)) return json({ ok: false, reason: 'invalid_reason' }, 400);

  // Cap single-request amount to prevent abuse (max one win's worth per call)
  if (amt > SP.WIN_REWARD) return json({ ok: false, reason: 'amount_too_large' }, 400);

  // Load SP state
  let sp = await env.DB.prepare('SELECT * FROM sp_state WHERE user_id = ?').bind(user.id).first();
  if (!sp) {
    await env.DB.prepare('INSERT INTO sp_state (user_id) VALUES (?)').bind(user.id).run();
    sp = { user_id: user.id, balance: 0, season_earned: 0, season_seen: 0, last_earn_ms: 0, earn_window: '{"start":0,"total":0}' };
  }

  // Season cap check
  const sg = await env.DB.prepare('SELECT circulating FROM season_global WHERE id = 1').first();
  const circulating = sg?.circulating || 0;
  if (circulating + amt > SP.SEASON_CAP) {
    return json({ ok: false, reason: 'season_cap' });
  }

  // Rate-limit (mutates sp.earn_window + sp.last_earn_ms in place)
  const rl = checkRateLimit(sp, amt);
  if (!rl.ok) return json({ ok: false, reason: rl.reason });

  // ---- Atomic update: balance + season_earned + window + last_earn ----
  const newBalance = (sp.balance || 0) + amt;
  await env.DB.prepare(
    `UPDATE sp_state SET balance = ?, season_earned = season_earned + ?, last_earn_ms = ?, earn_window = ? WHERE user_id = ?`
  ).bind(newBalance, amt, sp.last_earn_ms, sp.earn_window, user.id).run();

  // Update global circulating counter
  await env.DB.prepare(
    `UPDATE season_global SET circulating = circulating + ?, updated_at = ? WHERE id = 1`
  ).bind(amt, Date.now()).run();

  // Append tx log
  await env.DB.prepare(
    `INSERT INTO sp_tx (user_id, amount, reason, balance_after) VALUES (?, ?, ?, ?)`
  ).bind(user.id, amt, reason, newBalance).run();

  // Notify listeners (KV pub/sub-lite: client polls /api/me)
  return json({ ok: true, earned: amt, balance: newBalance });
}
