// ============================================================
// STUMBLE PUMP — Season 1 Tokenomics ($SP engine) — D1-backed
// Balance + earns + withdrawals are authoritative on the Cloudflare D1
// backend (functions/api/sp/*). This module is a thin client that keeps a
// synchronous in-memory cache so the HUD can read balance() without awaits,
// plus the static tokenomics metadata for the landing/docs UI.
//
// Public API:
//   SP.balance()                → cached $SP balance (sync, HUD-friendly)
//   SP.totalEarned()            → cached season-earned total (sync)
//   SP.refresh()                → async; pulls /api/me and updates the cache
//   SP.earnSP(amount, reason)   → async; POST /api/sp/earn
//   SP.withdrawRequest(addr)    → async; POST /api/sp/withdraw
//   SP.txLog()                  → async; GET /api/sp/txlog
//   SP.canWithdraw() / SP.progressPct() / SP.season() / SP.prizePool() / ...
//   SP.onUpdate(fn)             → subscribe to balance changes
// ============================================================
import { API, setSPCache, spBalanceCached, spSeasonEarnedCached, spSeasonSeenCached } from './api.js';

// ---- Token supply & funding model (Season 1) ----
export const TOKEN_NAME         = 'Stumble Pump';
export const TOKEN_SYMBOL       = '$SP';
export const CONTRACT_ADDRESS   = 'COMING SOON';   // SPL mint published with the season
export const CHAIN              = 'Solana (SPL)';
export const SEASON1_CAP        = 1_000_000_000;   // total public supply (from pump.fun)
export const PRIZE_POOL_SEASON1 = 50_000_000;      // 100% creator-fee funded, no airdrop
export const CREATOR_FEE_PCT    = 5;               // % of platform fee routed to the pool
export const WITHDRAW_THRESHOLD = 10_000;          // min $SP to unlock withdrawal

// ---- Earn rates (must match functions/_lib.js SP constants) ----
export const SP_WIN_REWARD       = 100;   // $SP per match win
export const SP_QUALIFY_REWARD   = 30;    // $SP per non-final round qualified
export const SP_ELIM_REWARD      = 5;     // $SP for participating
export const COIN_WIN_REWARD     = 100;   // in-game coins per match win
export const COIN_QUALIFY_REWARD = 60;    // coins per non-final round qualified
export const COIN_ELIM_REWARD    = 20;    // coins for participating

// ---- Prize pool split (NO airdrop — 100% creator fee, paid to winners) ----
export const PRIZE_SPLIT_WIN        = 0.55;   // 55% → match-winners
export const PRIZE_SPLIT_TOURNAMENT = 0.35;   // 35% → tournament winners
export const PRIZE_SPLIT_LIQUIDITY  = 0.10;   // 10% → liquidity reserve

// ---- Tournaments ----
export const TOURNAMENT_ENTRY_FEE  = 1_500;
export const TOURNAMENT_MIN_HOLD   = 1_500;
export const TOURNAMENT_PRIZE_TOP3 = 25_000;

// ---- Tokenomics distribution (for the docs section; airdrop removed) ----
export const TOKEN_DISTRIBUTION = [
  { label: 'Play-to-Earn Rewards',   pct: 55, color: '#5FCB88', note: 'Match wins, qualifications, events' },
  { label: 'Prize Pool & Tournaments', pct: 25, color: '#FFD23F', note: 'Creator-fee funded, paid to winners' },
  { label: 'Liquidity & Market Making', pct: 10, color: '#4F8CFF', note: 'DEX liquidity, stable pairs' },
  { label: 'Team & Development',      pct: 6,  color: '#A77BFF', note: 'Vested over 18 months' },
  { label: 'Community & Marketing',   pct: 4,  color: '#FF8A3D', note: 'Early supporters, KOLs' },
];

// ---- Scheduled tournaments (rotating weekly) ----
export const TOURNAMENTS = [
  { id: 'sp-friday-frenzy', name: 'Friday Frenzy', day: 'Fri', time: '20:00 UTC', prize: 5_000_000, players: 32 },
  { id: 'sp-weekend-war',   name: 'Weekend War',   day: 'Sat', time: '18:00 UTC', prize: 7_500_000, players: 32 },
  { id: 'sp-pump-mania',    name: 'Pump Mania',    day: 'Sun', time: '21:00 UTC', prize: 4_000_000, players: 16 },
];

// ---- Anti-exploit constants (mirrored server-side; documented client-side) ----
export const EARN_COOLDOWN_MS = 20_000;
export const EARN_HOURLY_MAX  = 500;

// ============================================================
// In-memory state (synced from server via SP.refresh())
// ============================================================
const _listeners = new Set();
let _lastSeasonMeta = { circulating: 0, remaining: PRIZE_POOL_SEASON1, distributed: 0 };

function _notify(payload) {
  for (const fn of _listeners) { try { fn(payload); } catch {} }
}

// ============================================================
// Public API
// ============================================================
export const SP = {
  /** Current cached $SP balance (sync — HUD reads this every frame). */
  balance() { return spBalanceCached(); },

  /** Cached total $SP earned this season. */
  totalEarned() { return spSeasonEarnedCached(); },

  /** 0-100 progress toward WITHDRAW_THRESHOLD (sync). */
  progressPct() {
    return Math.min(100, Math.round((this.balance() / WITHDRAW_THRESHOLD) * 100));
  },

  /** True if the player meets the minimum hold to withdraw (sync). */
  canWithdraw() { return this.balance() >= WITHDRAW_THRESHOLD; },

  /**
   * Pull the authoritative balance + season meta from the server and update
   * the in-memory cache. Called on login, on a 3s realtime poller, and after
   * any earn/withdraw. Safe to call repeatedly.
   */
  async refresh() {
    const r = await API.me();
    if (r.ok && r.profile) {
      const prev = spBalanceCached();
      setSPCache({
        balance: r.profile.sp_balance ?? 0,
        seasonEarned: r.profile.sp_season1_earned ?? 0,
        seasonSeen: r.profile.season1_seen ?? false,
      });
      if (r.season) _lastSeasonMeta = {
        circulating: r.season.circulating,
        remaining: r.season.prizeRemaining,
        distributed: r.season.prizeDistributed,
      };
      const now = spBalanceCached();
      if (now !== prev) _notify({ type: 'change', prev, balance: now });
    }
    return r;
  },

  /**
   * Earn $SP. Server-side anti-exploit (cooldown + hourly cap + season cap).
   * @param {number} amount
   * @param {'win'|'qualify'|'participate'|'tournament_entry'} reason
   * @returns {Promise<{ok, earned?, balance?, reason?}>}
   */
  async earnSP(amount, reason = 'win') {
    const r = await API.earnSP(amount, reason);
    if (r.ok) {
      const prev = spBalanceCached();
      setSPCache({ balance: r.balance });
      _notify({ type: 'earn', amount, prev, balance: r.balance, reason });
    }
    return r;
  },

  /**
   * Record a withdraw request (admin-reviewed). Deducts balance immediately
   * (optimistic hold); admin restores it on rejection.
   */
  async withdrawRequest(solAddress) {
    const r = await API.withdraw(solAddress);
    if (r.ok) {
      const prev = spBalanceCached();
      setSPCache({ balance: 0 });
      _notify({ type: 'withdraw', amount: r.amount, prev, balance: 0, solAddress });
    }
    return r;
  },

  /** Transaction history (async — pulled from /api/sp/txlog). */
  async txLog() {
    const r = await API.spTxLog();
    return r.ok ? (r.log || []) : [];
  },

  /** Has the player seen the Season 1 onboarding/landing? */
  hasSeenOnboarding() { return spSeasonSeenCached(); },

  /** Mark Season 1 as seen (persisted server-side via saveProfile season_seen). */
  async markOnboardingSeen() {
    await API.saveProfile({ season_seen: true });
    setSPCache({ seasonSeen: true });
  },

  /** Subscribe to balance changes. Returns an unsubscribe fn. */
  onUpdate(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  // ---- Static metadata (no async) ----
  season() {
    return {
      name: 'Season 1',
      title: 'The Pump Begins',
      cap: SEASON1_CAP,
      circulating: _lastSeasonMeta.circulating,
      remaining: SEASON1_CAP - _lastSeasonMeta.circulating,
      withdrawThreshold: WITHDRAW_THRESHOLD,
      winReward: SP_WIN_REWARD,
    };
  },

  prizePool() {
    return {
      total: PRIZE_POOL_SEASON1,
      funded: PRIZE_POOL_SEASON1,
      distributed: _lastSeasonMeta.distributed,
      remaining: _lastSeasonMeta.remaining,
      creatorFeePct: CREATOR_FEE_PCT,
      split: [
        { label: 'Match Winners', pct: PRIZE_SPLIT_WIN,        color: '#5FCB88' },
        { label: 'Tournaments',   pct: PRIZE_SPLIT_TOURNAMENT, color: '#FFD23F' },
        { label: 'Liquidity',     pct: PRIZE_SPLIT_LIQUIDITY,  color: '#4F8CFF' },
      ],
    };
  },

  tournamentInfo() {
    return {
      schedule: TOURNAMENTS,
      entryFee: TOURNAMENT_ENTRY_FEE,
      minHold: TOURNAMENT_MIN_HOLD,
      basePrize: TOURNAMENT_PRIZE_TOP3,
      eligible: this.balance() >= TOURNAMENT_MIN_HOLD,
    };
  },

  distribution() { return TOKEN_DISTRIBUTION.map((d) => ({ ...d })); },

  howItWorks() {
    return [
      { step: 1, icon: '🎮', title: 'Play & Win', body: `Win any match to earn <strong>+${SP_WIN_REWARD} $SP</strong> and <strong>+${COIN_WIN_REWARD} coins</strong>. Every qualification also rewards $SP. No daily caps on fun.` },
      { step: 2, icon: '🔒', title: 'Hold Your Bags', body: `Stack at least <strong>${WITHDRAW_THRESHOLD.toLocaleString()} $SP</strong> in your in-game balance. Holding proves commitment and protects the ecosystem from dump-and-run apes.` },
      { step: 3, icon: '🏆', title: 'Join Tournaments', body: `Scheduled weekly tournament rooms on the official @stumble X account. Entry <strong>${TOURNAMENT_ENTRY_FEE.toLocaleString()} $SP</strong> · top splits from the prize pool.` },
      { step: 4, icon: '⚡', title: 'Withdraw to SPL', body: `Once eligible, request a withdrawal to your Solana wallet. An admin reviews it and sends the SPL tokens on-chain. Your keys, your coins.` },
    ];
  },

  faq() {
    return [
      { q: 'Where do the rewards come from?',
        a: `100% of the platform <strong>creator fee (${CREATOR_FEE_PCT}%)</strong> is routed into the Season 1 prize pool (${PRIZE_POOL_SEASON1.toLocaleString()} $SP seeded). Winnings are distributed from that real, auditable pool — not minted from nothing. No airdrops; every token is earned or paid out to winners.` },
      { q: 'Is $SP a real token?',
        a: `$SP is an in-game reward token that converts to a Solana SPL token once you reach the ${WITHDRAW_THRESHOLD.toLocaleString()} $SP withdrawal threshold. The SPL mint contract address is published with the season (<strong>${CONTRACT_ADDRESS}</strong> — finalizing).` },
      { q: 'Why the 10,000 $SP minimum?',
        a: `It prevents sybil farming and keeps the reward pool sustainable for genuine players. Diamond hands get rewarded; paper hands wait.` },
      { q: 'How do withdrawals work?',
        a: `When you request a withdrawal, it goes into a review queue. An admin verifies it and sends the SPL transfer to your Solana wallet. The balance is held (deducted) while pending and refunded if rejected.` },
      { q: 'How are tournaments fair?',
        a: `Tournament rooms are hosted on the official @stumble account with fixed schedules. Results are recorded to match history and the prize split is public.` },
    ];
  },

  /** No-op init kept for backward-compat (cache is populated by refresh()). */
  init() {},
};
