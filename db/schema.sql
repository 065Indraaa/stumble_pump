-- ============================================================
-- STUMBLE PUMP — Cloudflare D1 schema
-- Run once after creating the DB:
--   npx wrangler d1 create stumble-pump-db
--   (paste the returned database_id into wrangler.toml)
--   npx wrangler d1 execute stumble-pump-db --file=db/schema.sql
--   npx wrangler d1 execute stumble-pump-db --env production --file=db/schema.sql
-- ============================================================

-- ---- USERS ----------------------------------------------------
-- One row per account. coins/gems/level/wins/games are the live profile.
-- owned_skins is a JSON array of skin keys the player owns.
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash    TEXT NOT NULL,
  solana       TEXT NOT NULL DEFAULT '',
  coins        INTEGER NOT NULL DEFAULT 500,
  gems         INTEGER NOT NULL DEFAULT 10,
  level        INTEGER NOT NULL DEFAULT 1,
  wins         INTEGER NOT NULL DEFAULT 0,
  games        INTEGER NOT NULL DEFAULT 0,
  skin         TEXT NOT NULL DEFAULT 'shiller',
  emote        TEXT NOT NULL DEFAULT 'dance',
  trail        TEXT NOT NULL DEFAULT 'rocket',
  owned_skins  TEXT NOT NULL DEFAULT '["shiller","devsus","trojan","paperhand"]',
  is_admin     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ---- $SP TOKEN STATE (per user) -------------------------------
-- balance is the authoritative in-game $SP balance.
-- season_earned is cumulative earnings for Season 1 (for the docs/leaderboard).
-- last_earn_ms + earn_window enforce server-side anti-farm rate limits
-- (20s cooldown, 500 $SP/hour) so clients can't mint by replaying requests.
CREATE TABLE IF NOT EXISTS sp_state (
  user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance       INTEGER NOT NULL DEFAULT 0,
  season_earned INTEGER NOT NULL DEFAULT 0,
  season_seen   INTEGER NOT NULL DEFAULT 0,
  last_earn_ms  INTEGER NOT NULL DEFAULT 0,
  earn_window   TEXT NOT NULL DEFAULT '{"start":0,"total":0}'
);

-- ---- $SP TRANSACTION LOG --------------------------------------
-- Append-only ledger of every earn/withdraw event. Capped client-side to
-- last 200; admin can query the full history here.
CREATE TABLE IF NOT EXISTS sp_tx (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount         INTEGER NOT NULL,            -- positive = earn, negative = withdraw
  reason         TEXT NOT NULL,               -- win | qualify | participate | withdraw | tournament_entry
  balance_after  INTEGER NOT NULL,
  ts             INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_sp_tx_user ON sp_tx(user_id, ts DESC);

-- ---- WITHDRAW REQUESTS (admin-reviewed) -----------------------
-- Players request a withdrawal once balance >= 10,000 $SP. The request is
-- recorded here with status='pending'. An admin reviews it manually in the
-- DB (or via /api/admin/withdrawals) and sets status to 'approved'|'rejected'.
-- The on-chain SPL transfer happens AFTER admin approval.
CREATE TABLE IF NOT EXISTS withdraw_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,
  sol_address  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | paid
  created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  reviewed_at  INTEGER,
  reviewed_by  TEXT,
  tx_signature TEXT                            -- filled when admin marks 'paid'
);
CREATE INDEX IF NOT EXISTS idx_withdraw_status ON withdraw_requests(status, created_at DESC);

-- ---- MATCHES + MATCH PLAYERS (history) ------------------------
CREATE TABLE IF NOT EXISTS matches (
  id           TEXT PRIMARY KEY,               -- 'm_' + random
  map          TEXT NOT NULL,
  rounds       INTEGER NOT NULL DEFAULT 3,
  players      INTEGER NOT NULL DEFAULT 0,
  winner_name  TEXT,
  winner_sol   TEXT,
  is_room      INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_matches_created ON matches(created_at DESC);

CREATE TABLE IF NOT EXISTS match_players (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id     TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username     TEXT NOT NULL,
  finish_pos   INTEGER,
  qualified    INTEGER NOT NULL DEFAULT 0,
  earned_sp    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_match_players_user ON match_players(user_id, id DESC);

-- ---- SEASON-GLOBAL COUNTERS (singleton) -----------------------
-- The prize pool / circulating counters. Updated atomically on every earn
-- (UPDATE season_global SET circulating = circulating + ?). prize_remaining
-- starts at the full Season 1 prize pool and decreases as it's paid out.
CREATE TABLE IF NOT EXISTS season_global (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  circulating      INTEGER NOT NULL DEFAULT 0,   -- total $SP minted to players
  prize_remaining  INTEGER NOT NULL DEFAULT 50000000,  -- 50M Season 1 prize pool
  prize_distributed INTEGER NOT NULL DEFAULT 0,
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
INSERT OR IGNORE INTO season_global (id) VALUES (1);

-- ---- SEED: default admin (CHANGE PASSWORD AFTER FIRST LOGIN) --
-- username: admin | password: changeme123
-- The pass_hash uses the same djb2-base36 scheme as the client so it works
-- with the existing /api/auth/login flow. Replace this immediately in prod.
INSERT OR IGNORE INTO users (username, pass_hash, solana, coins, gems, level, is_admin)
VALUES ('admin', '1d8fb0', '', 0, 0, 99, 1);

-- ---- PRESENCE (online player heartbeat) -----------------------
-- One row per user, upserted on each /api/presence POST. "Online" =
-- distinct users with ts within the last 60s. Keep it pruned by the upsert.
CREATE TABLE IF NOT EXISTS presence (
  user_id  INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ts       INTEGER NOT NULL
);
