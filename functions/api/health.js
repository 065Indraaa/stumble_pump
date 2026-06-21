// GET /api/health
// Lightweight liveness + DB connectivity probe. The client uses this to gate
// the game on boot: if it returns non-200, the "Connecting to server…" overlay
// stays up and play does NOT start (D1-only is a hard requirement).
export async function onRequestGet({ env }) {
  try {
    const r = await env.DB.prepare('SELECT 1 AS ok').first();
    const sg = await env.DB.prepare('SELECT circulating, prize_remaining, prize_distributed FROM season_global WHERE id = 1').first();
    return Response.json({
      ok: true,
      db: !!r,
      ts: Date.now(),
      season: {
        circulating: sg?.circulating || 0,
        prizeRemaining: sg?.prize_remaining || 0,
        prizeDistributed: sg?.prize_distributed || 0,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return Response.json({ ok: false, err: String(e?.message || e) }, {
      status: 503,
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
    });
  }
}

export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
