-- ============================================================================
-- Migration 026 — Canonical Market Registry & Snapshots (Phase 5)
--
-- Gives the market-data engines a real home. `lib/market-data/**` (~3,000
-- lines across pricing, liquidity, volume, OHLCV, rankings, search, quality)
-- is genuine computation, but every result lived in per-process Maps —
-- `CanonicalMarketRegistry` seeded three hardcoded pools into a
-- `Map<string, Market>` on construction and lost everything on restart.
--
-- The engines' computation is NOT changed by this phase. Only where their
-- output lives changes: Map → Postgres.
--
-- KEY MODELLING POINT: one token is not one market. A token trades on many
-- pools (Raydium, Orca, Meteora), each with its own price, liquidity and fee
-- tier. `markets` is therefore keyed independently of `tokens`, with
-- (chain_id, protocol, address) as the deterministic identity — the same pool
-- discovered twice from different sources must collapse to one row
-- (Sprint 44 §41).
-- ============================================================================

CREATE TABLE IF NOT EXISTS markets (
    id VARCHAR(160) PRIMARY KEY,              -- `${chainId}:${protocol}:${address}`
    chain_id VARCHAR(64) NOT NULL,
    protocol VARCHAR(64) NOT NULL,
    market_type VARCHAR(32) NOT NULL,
    address VARCHAR(128) NOT NULL,
    base_token_id VARCHAR(128) NOT NULL,
    quote_token_id VARCHAR(128) NOT NULL,
    fee_bps INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'DISCOVERED',
    source VARCHAR(32) NOT NULL DEFAULT 'ONCHAIN',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Deduplication is a database guarantee, not an application convention.
    CONSTRAINT uq_markets_identity UNIQUE (chain_id, protocol, address),
    CONSTRAINT chk_markets_status CHECK (status IN ('DISCOVERED', 'ACTIVE', 'INACTIVE', 'SUSPICIOUS', 'DEPRECATED')),
    CONSTRAINT chk_markets_type CHECK (market_type IN ('CPMM', 'CONCENTRATED', 'ORDERBOOK', 'STABLE_SWAP'))
);

-- Time-series observations, kept OUT of the `markets` row (Sprint 42 §14):
-- current state and history are different access patterns, and appending a
-- price tick must never rewrite the market's identity row.
--
-- Numeric precision: price/liquidity/volume are NUMERIC, never float —
-- a token priced at 0.000000000123 must not round to zero.
CREATE TABLE IF NOT EXISTS market_snapshots (
    id VARCHAR(64) PRIMARY KEY,
    market_id VARCHAR(160) NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    price NUMERIC(38, 18),
    price_usd NUMERIC(38, 18),
    liquidity_usd NUMERIC(38, 6),
    volume_24h_usd NUMERIC(38, 6),
    base_reserve NUMERIC(38, 18),
    quote_reserve NUMERIC(38, 18),
    -- How much this observation should be trusted (quality-service.ts).
    confidence NUMERIC(5, 4),
    source VARCHAR(32),
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The engines' token lifecycle (`TokenLifecycleStatus`) is richer than the
-- bare 'ACTIVE' the tokens table was seeded with, and Sprint 44 §35 is
-- explicit that a boolean `isToken` is not enough.
ALTER TABLE tokens
    DROP CONSTRAINT IF EXISTS chk_tokens_status,
    ADD CONSTRAINT chk_tokens_status CHECK (status IN ('DISCOVERED', 'VALIDATED', 'ACTIVE', 'INACTIVE', 'SUSPICIOUS', 'DELISTED'));

-- Metadata enrichment is asynchronous and allowed to fail without discarding
-- the token (Sprint 44 §38) — so its outcome is tracked separately.
ALTER TABLE tokens
    ADD COLUMN IF NOT EXISTS metadata_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS metadata_last_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS metadata_error TEXT,
    ADD COLUMN IF NOT EXISTS discovery_source VARCHAR(32);

ALTER TABLE tokens
    DROP CONSTRAINT IF EXISTS chk_tokens_metadata_status,
    ADD CONSTRAINT chk_tokens_metadata_status CHECK (metadata_status IN ('PENDING', 'OK', 'FAILED', 'UNAVAILABLE'));

CREATE INDEX IF NOT EXISTS idx_markets_base_token ON markets (base_token_id);
CREATE INDEX IF NOT EXISTS idx_markets_quote_token ON markets (quote_token_id);
CREATE INDEX IF NOT EXISTS idx_markets_chain_status ON markets (chain_id, status);
-- Latest-snapshot-per-market is the hottest read in the whole domain.
CREATE INDEX IF NOT EXISTS idx_market_snapshots_latest ON market_snapshots (market_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON tokens (symbol);
CREATE INDEX IF NOT EXISTS idx_tokens_chain_status ON tokens (chain_id, status);
