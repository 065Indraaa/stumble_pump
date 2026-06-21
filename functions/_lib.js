// ============================================================
// STUMBLE PUMP — Cloudflare Pages Functions shared helpers
// Used by every /api/* endpoint. Pure JS (no deps), Web Crypto.
// ============================================================

// ---- JSON helpers ----
export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  });
}

// ---- CORS preflight for all /api routes ----
export function corsPreflight(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  return null;
}

// ---- djb2 hash → base36 (matches the client's auth.js hash()) ----
// We replicate the exact client algorithm so existing accounts keep working
// and so the seeded admin row is recognized by /api/auth/login.
export function djb2Hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

// ---- input validation ----
export function validUsername(u) {
  return typeof u === 'string' && u.trim().length >= 3 && u.trim().length <= 16;
}
export function validPassword(p) {
  return typeof p === 'string' && p.length >= 3 && p.length <= 64;
}
// Solana base58 addresses are 32-44 chars. We accept empty (not required).
export function validSolana(s) {
  if (!s) return true;
  return typeof s === 'string' && s.length >= 32 && s.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}

// ---- session token (JWT-lite, signed with SESSION_SECRET) ----
// Format: base64url(payload).base64url(hmac). HMAC-SHA256 over payload.
// Payload: { uid, name, iat, exp }
const enc64 = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const dec64 = (s) => JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));

export async function makeSession(env, user) {
  const payload = {
    uid: user.id,
    name: user.username,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days
  };
  const payloadB64 = enc64(payload);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.SESSION_SECRET || 'dev-insecure-secret'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = `${payloadB64}.${sigB64}`;
  // Store in KV for revocation / lookup (keyed by token hash)
  await env.SESSIONS.put(`sess:${token}`, String(user.id), { expirationTtl: 60 * 60 * 24 * 30 });
  return token;
}

export async function verifySession(env, token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  try {
    const payload = dec64(payloadB64);
    if (payload.exp < Date.now()) return null;
    // verify signature
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.SESSION_SECRET || 'dev-insecure-secret'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadB64));
    if (!ok) return null;
    // confirm KV still has it (revocation support)
    const uid = await env.SESSIONS.get(`sess:${token}`);
    if (uid === null) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// ---- extract bearer token from request ----
export function bearerToken(req) {
  const h = req.headers.get('Authorization') || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  // also accept cookie-style header
  const c = req.headers.get('X-Session') || '';
  return c || null;
}

// ---- middleware: require a valid session, return {user, payload} or 401 ----
export async function requireUser(env, req) {
  const token = bearerToken(req);
  const payload = await verifySession(env, token);
  if (!payload) return { err: json({ err: 'unauthorized' }, 401) };
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.uid).first();
  if (!row) return { err: json({ err: 'unauthorized' }, 401) };
  return { user: row, payload };
}

// ---- parse JSON body safely ----
export async function parseBody(req) {
  try {
    return await req.json();
  } catch (e) {
    return {};
  }
}

// ---- $SP tokenomics constants (must match src/store/tokenomics.js) ----
export const SP = {
  WIN_REWARD: 100,
  QUALIFY_REWARD: 30,
  ELIM_REWARD: 5,
  WITHDRAW_THRESHOLD: 10_000,
  SEASON_CAP: 1_000_000_000,
  EARN_COOLDOWN_MS: 20_000,
  EARN_HOURLY_MAX: 500,
  VALID_REASONS: ['win', 'qualify', 'participate', 'tournament_entry'],
};

// ---- server-side anti-farm rate-limit check ----
// Returns {ok:true} or {ok:false, reason}. Mutates state in the row object
// (caller persists it back).
export function checkRateLimit(stateRow, amount) {
  const now = Date.now();
  if (now - (stateRow.last_earn_ms || 0) < SP.EARN_COOLDOWN_MS) {
    return { ok: false, reason: 'cooldown' };
  }
  let window;
  try { window = JSON.parse(stateRow.earn_window || '{"start":0,"total":0}'); }
  catch { window = { start: 0, total: 0 }; }
  const age = now - (window.start || 0);
  if (age > 3_600_000) { window = { start: now, total: 0 }; }
  if ((window.total || 0) + amount > SP.EARN_HOURLY_MAX) {
    return { ok: false, reason: 'hourly_cap' };
  }
  window.total = (window.total || 0) + amount;
  stateRow.earn_window = JSON.stringify(window);
  stateRow.last_earn_ms = now;
  return { ok: true };
}
