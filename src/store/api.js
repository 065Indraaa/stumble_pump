// ============================================================
// STUMBLE PUMP — API client (Cloudflare D1 backend)
// Thin fetch wrapper used by auth/tokenomics/rooms/history stores.
// D1-only: no localStorage fallback. On network/5xx errors, callers surface
// a clear "Connecting to server…" state — the game never silently degrades.
// ============================================================

// Base URL: same origin in production (Pages Functions live alongside the
// static build). In local Vite dev without Functions, requests fail fast and
// the boot gate stays up — operator runs `wrangler pages dev` to enable them.
const BASE = '';

// ---- session token storage ----
const TOKEN_KEY = 'stumblePump_session_token';
export function getToken() { return sessionStorage.getItem(TOKEN_KEY) || ''; }
export function setToken(t) { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); }

// ---- core request ----
async function request(path, { method = 'GET', body, auth = true, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { 'Content-Type': 'application/json' };
  if (auth && getToken()) headers['Authorization'] = 'Bearer ' + getToken();
  try {
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      return { ok: false, status: res.status, err: data.err || `HTTP ${res.status}` };
    }
    return data;
  } catch (e) {
    clearTimeout(timer);
    const aborted = e?.name === 'AbortError';
    return { ok: false, status: 0, err: aborted ? 'timeout' : 'network', network: true };
  }
}

// ============================================================
// Public API surface — grouped by domain
// ============================================================
export const API = {
  // ---- health (used by boot gate) ----
  async health() {
    return request('/api/health', { auth: false, timeoutMs: 6000 });
  },

  // ---- auth ----
  async register(username, password, solana) {
    const r = await request('/api/auth/register', { method: 'POST', auth: false, body: { username, password, solana } });
    if (r.ok && r.token) setToken(r.token);
    return r;
  },
  async login(username, password) {
    const r = await request('/api/auth/login', { method: 'POST', auth: false, body: { username, password } });
    if (r.ok && r.token) setToken(r.token);
    return r;
  },
  logout() { setToken(''); },

  // ---- profile ----
  async me() { return request('/api/me'); },
  async saveProfile(fields) { return request('/api/me/save', { method: 'POST', body: fields }); },

  // ---- $SP tokenomics ----
  async earnSP(amount, reason) { return request('/api/sp/earn', { method: 'POST', body: { amount, reason } }); },
  async withdraw(solAddress) { return request('/api/sp/withdraw', { method: 'POST', body: { solAddress } }); },
  async spTxLog() { return request('/api/sp/txlog'); },

  // ---- history ----
  async getHistory() { return request('/api/history'); },
  async addHistory(entry) { return request('/api/history', { method: 'POST', body: entry }); },

  // ---- presence (online count) ----
  async heartbeat() { return request('/api/presence', { method: 'POST' }); },
  async onlineCount() { return request('/api/presence', { auth: false }); },

  // ---- admin (manual withdrawal review) ----
  async adminListWithdrawals(status = 'pending') {
    return request(`/api/admin/withdrawals?status=${encodeURIComponent(status)}`);
  },
};

// ---- in-memory $SP balance cache (for synchronous HUD reads) ----
// The HUD reads balance frequently via SP.balance(); we cache the last known
// value from /api/me and refresh it via the realtime poller. earnSP/withdraw
// also update this cache optimistically before the server confirms.
let _spBalanceCache = 0;
let _spSeasonEarnedCache = 0;
let _spSeasonSeenCache = false;
export function setSPCache({ balance, seasonEarned, seasonSeen } = {}) {
  if (typeof balance === 'number') _spBalanceCache = balance;
  if (typeof seasonEarned === 'number') _spSeasonEarnedCache = seasonEarned;
  if (typeof seasonSeen === 'boolean') _spSeasonSeenCache = seasonSeen;
}
export function spBalanceCached() { return _spBalanceCache; }
export function spSeasonEarnedCached() { return _spSeasonEarnedCache; }
export function spSeasonSeenCached() { return _spSeasonSeenCache; }
