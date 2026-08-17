-- ============================================================================
-- 027 — Real-time token feed storage
--
-- This migration previously read `CREATE TABLE IF NOT EXISTS tokens (...)`,
-- `... trades (...)` and `... wallets (...)`. All three of those tables already
-- exist with entirely different, in-use schemas:
--
--   * `tokens`  — the canonical registry from 026 (id/chain_id/address PK by id)
--   * `trades`  — a pool swap ledger from 013 (token_in/token_out/pool_id, all
--                 NOT NULL), which a log-derived event cannot populate
--   * `wallets` — user identity wallets from 013/020, owned by a user_id
--
-- So `IF NOT EXISTS` made the whole migration a silent no-op, and the realtime
-- repository's INSERTs then failed against the wrong schema on every event
-- ("column \"signature\" of relation \"trades\" does not exist"), falling back
-- to an in-memory store. Persistence appeared to work and stored nothing.
-- This is the same failure mode 020 had against 013's tables.
--
-- The fix is separate, explicitly-named tables rather than reshaping the
-- existing ones. These hold *observed* stream data at `processed` commitment:
-- fast, possibly reorged, deliberately distinct from the reconciled ledger.
-- Merging the two would mean either inventing NOT NULL pool/chain values for
-- every log-derived trade, or weakening constraints the reconciled ledger
-- depends on.
-- ============================================================================

-- Latest observed market state per mint, keyed by mint because that is the only
-- identifier a detection event reliably carries.
CREATE TABLE IF NOT EXISTS realtime_tokens (
    mint             VARCHAR(128) PRIMARY KEY,
    name             VARCHAR(128),
    symbol           VARCHAR(64),
    decimals         INTEGER,
    image_url        TEXT,
    platform         VARCHAR(32),
    pool_address     VARCHAR(128),
    first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_seen_slot  BIGINT,
    first_signature  VARCHAR(128),
    -- NUMERIC, never float: these are read back as strings and wrapped in
    -- lib/math/decimal.ts, matching every other money column in this schema.
    price_usd        NUMERIC(36,18),
    liquidity_usd    NUMERIC(24,6),
    market_cap_usd   NUMERIC(24,6),
    volume_24h_usd   NUMERIC(24,6),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Directional buy/sell observations. One row per (signature, mint, side): a
-- single transaction can legitimately trade several mints, and can both buy
-- and sell within one route, so the signature alone is not unique.
CREATE TABLE IF NOT EXISTS realtime_trades (
    id          BIGSERIAL PRIMARY KEY,
    signature   VARCHAR(128) NOT NULL,
    mint        VARCHAR(128) NOT NULL,
    wallet      VARCHAR(128),
    side        VARCHAR(8)   NOT NULL,
    amount      NUMERIC(36,18),
    amount_sol  NUMERIC(36,18),
    price_usd   NUMERIC(36,18),
    slot        BIGINT,
    timestamp   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    -- Commitment is recorded, not assumed. A `processed` row may still be
    -- reorged away; pretending otherwise is what §25 of the brief warns about.
    commitment  VARCHAR(16)  NOT NULL DEFAULT 'processed',
    source      VARCHAR(32),
    CONSTRAINT chk_realtime_trades_side CHECK (side IN ('BUY', 'SELL')),
    CONSTRAINT chk_realtime_trades_commitment
        CHECK (commitment IN ('processed', 'confirmed', 'finalized')),
    CONSTRAINT uq_realtime_trades UNIQUE (signature, mint, side)
);

-- Wallets the platform watches for activity. Distinct from `wallets`, which is
-- a user's own linked custody wallets — a tracked wallet belongs to nobody and
-- is observed, not owned.
CREATE TABLE IF NOT EXISTS tracked_wallets (
    address     VARCHAR(128) PRIMARY KEY,
    label       VARCHAR(128),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_realtime_tokens_updated ON realtime_tokens (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtime_tokens_platform ON realtime_tokens (platform);
CREATE INDEX IF NOT EXISTS idx_realtime_tokens_first_seen ON realtime_tokens (first_seen_at DESC);

-- Feed reads are "recent trades for this mint", so the index is ordered to
-- serve that directly rather than needing a sort.
CREATE INDEX IF NOT EXISTS idx_realtime_trades_mint_time ON realtime_trades (mint, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_realtime_trades_time ON realtime_trades (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_realtime_trades_slot ON realtime_trades (slot DESC);
CREATE INDEX IF NOT EXISTS idx_realtime_trades_wallet_time ON realtime_trades (wallet, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_realtime_trades_signature ON realtime_trades (signature);
