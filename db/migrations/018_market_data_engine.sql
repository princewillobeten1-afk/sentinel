-- ============================================================================
-- Sprint 45 — Canonical Market Data Engine & Token Discovery Schema
-- Multi-Market Architecture, Reserves, Swaps, OHLCV Candles, Snapshots & Rankings
-- ============================================================================

-- 1. Canonical Markets Table (1 Token -> N Markets)
CREATE TABLE IF NOT EXISTS markets (
    id VARCHAR(64) PRIMARY KEY, -- Deterministic ID: chain_id:protocol:address
    chain_id VARCHAR(32) NOT NULL,
    protocol VARCHAR(64) NOT NULL, -- raydium_cpmm, orca_whirlpool, uniswap_v3, etc.
    market_type VARCHAR(32) NOT NULL DEFAULT 'CPMM', -- CPMM, CONCENTRATED, ORDERBOOK, STABLE_SWAP
    address VARCHAR(128) NOT NULL,
    base_token_id VARCHAR(128) NOT NULL,
    quote_token_id VARCHAR(128) NOT NULL,
    fee_bps INTEGER NOT NULL DEFAULT 25,
    status VARCHAR(32) NOT NULL DEFAULT 'DISCOVERED', -- DISCOVERED, ACTIVE, INACTIVE, SUSPICIOUS, DEPRECATED
    source VARCHAR(32) NOT NULL DEFAULT 'ONCHAIN', -- ONCHAIN, REGISTRY, INDEXER, MANUAL, EXTERNAL_PROVIDER
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_market_identity UNIQUE (chain_id, protocol, address)
);

CREATE INDEX IF NOT EXISTS idx_markets_identity ON markets (chain_id, protocol, address);
CREATE INDEX IF NOT EXISTS idx_markets_base_token ON markets (base_token_id);
CREATE INDEX IF NOT EXISTS idx_markets_quote_token ON markets (quote_token_id);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets (status);

-- 2. Market Reserves & Liquidity State
CREATE TABLE IF NOT EXISTS market_reserves (
    id VARCHAR(64) PRIMARY KEY,
    market_id VARCHAR(64) NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    base_reserve NUMERIC(38, 18) NOT NULL DEFAULT 0,
    quote_reserve NUMERIC(38, 18) NOT NULL DEFAULT 0,
    base_price_usd NUMERIC(24, 8) NOT NULL DEFAULT 0,
    quote_price_usd NUMERIC(24, 8) NOT NULL DEFAULT 0,
    liquidity_usd NUMERIC(24, 4) NOT NULL DEFAULT 0,
    slot_or_block BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_reserves_market ON market_reserves (market_id);

-- 3. Normalized Market Swaps (Deduplicated across indexers)
CREATE TABLE IF NOT EXISTS market_swaps (
    id VARCHAR(128) PRIMARY KEY, -- Deterministic: sha256(tx_hash + log_index + market_id)
    market_id VARCHAR(64) NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    tx_hash VARCHAR(128) NOT NULL,
    sender_wallet VARCHAR(128) NOT NULL,
    side VARCHAR(8) NOT NULL, -- BUY, SELL
    base_amount NUMERIC(38, 18) NOT NULL,
    quote_amount NUMERIC(38, 18) NOT NULL,
    price_usd NUMERIC(24, 8) NOT NULL,
    volume_usd NUMERIC(24, 4) NOT NULL,
    slot_or_block BIGINT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_swaps_market_time ON market_swaps (market_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_swaps_tx ON market_swaps (tx_hash);

-- 4. OHLCV Candlesticks
CREATE TABLE IF NOT EXISTS ohlcv_candles (
    id VARCHAR(128) PRIMARY KEY, -- market_id:interval:timestamp
    market_id VARCHAR(64) NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    interval VARCHAR(8) NOT NULL, -- 1m, 5m, 15m, 1h, 4h, 1d
    timestamp BIGINT NOT NULL, -- Bucket Unix timestamp (seconds)
    open NUMERIC(24, 8) NOT NULL,
    high NUMERIC(24, 8) NOT NULL,
    low NUMERIC(24, 8) NOT NULL,
    close NUMERIC(24, 8) NOT NULL,
    volume_usd NUMERIC(24, 4) NOT NULL DEFAULT 0,
    trade_count INTEGER NOT NULL DEFAULT 0,
    is_final BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ohlcv_lookup ON ohlcv_candles (market_id, interval, timestamp DESC);

-- 5. Market Snapshots
CREATE TABLE IF NOT EXISTS market_snapshots (
    id VARCHAR(64) PRIMARY KEY,
    market_id VARCHAR(64) NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    price_usd NUMERIC(24, 8) NOT NULL,
    volume_24h_usd NUMERIC(24, 4) NOT NULL DEFAULT 0,
    liquidity_usd NUMERIC(24, 4) NOT NULL DEFAULT 0,
    price_change_24h NUMERIC(10, 4) NOT NULL DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE market_snapshots
    ADD COLUMN IF NOT EXISTS price_change_24h NUMERIC(10, 4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_market_snapshots_market_ts ON market_snapshots (market_id, timestamp DESC);

-- 6. Canonical Token Market Snapshots (Aggregated across all markets)
CREATE TABLE IF NOT EXISTS token_market_snapshots (
    id VARCHAR(64) PRIMARY KEY,
    token_id VARCHAR(128) NOT NULL,
    canonical_price_usd NUMERIC(24, 8) NOT NULL,
    price_change_1m NUMERIC(10, 4) NOT NULL DEFAULT 0,
    price_change_5m NUMERIC(10, 4) NOT NULL DEFAULT 0,
    price_change_1h NUMERIC(10, 4) NOT NULL DEFAULT 0,
    price_change_6h NUMERIC(10, 4) NOT NULL DEFAULT 0,
    price_change_24h NUMERIC(10, 4) NOT NULL DEFAULT 0,
    price_change_7d NUMERIC(10, 4) NOT NULL DEFAULT 0,
    volume_5m_usd NUMERIC(24, 4) NOT NULL DEFAULT 0,
    volume_1h_usd NUMERIC(24, 4) NOT NULL DEFAULT 0,
    volume_24h_usd NUMERIC(24, 4) NOT NULL DEFAULT 0,
    total_liquidity_usd NUMERIC(24, 4) NOT NULL DEFAULT 0,
    market_cap_usd NUMERIC(24, 4) NOT NULL DEFAULT 0,
    fdv_usd NUMERIC(24, 4),
    market_count INTEGER NOT NULL DEFAULT 1,
    confidence_score NUMERIC(4, 3) NOT NULL DEFAULT 1.0,
    data_quality_score INTEGER NOT NULL DEFAULT 100,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_token_snapshots_token_ts ON token_market_snapshots (token_id, timestamp DESC);

-- 7. Token Supplies & Confidence
CREATE TABLE IF NOT EXISTS token_supplies (
    token_id VARCHAR(128) PRIMARY KEY,
    total_supply NUMERIC(38, 18) NOT NULL,
    circulating_supply NUMERIC(38, 18) NOT NULL,
    max_supply NUMERIC(38, 18),
    supply_confidence NUMERIC(4, 3) NOT NULL DEFAULT 1.0,
    source VARCHAR(32) NOT NULL DEFAULT 'ONCHAIN_RPC',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Token Leaderboards / Rankings Cache
CREATE TABLE IF NOT EXISTS token_rankings_cache (
    category VARCHAR(32) NOT NULL, -- trending, gainers, losers, liquid, volume, new
    timeframe VARCHAR(8) NOT NULL DEFAULT '24h', -- 1h, 6h, 24h
    rank INTEGER NOT NULL,
    token_id VARCHAR(128) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    price_usd NUMERIC(24, 8) NOT NULL,
    change_pct NUMERIC(10, 4) NOT NULL,
    volume_usd NUMERIC(24, 4) NOT NULL,
    liquidity_usd NUMERIC(24, 4) NOT NULL,
    score NUMERIC(16, 4) NOT NULL,
    score_breakdown_json TEXT NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (category, timeframe, rank)
);

CREATE INDEX IF NOT EXISTS idx_token_rankings ON token_rankings_cache (category, timeframe, rank);

-- 9. Market Data Quality Audit Logs
CREATE TABLE IF NOT EXISTS market_data_quality_logs (
    id VARCHAR(64) PRIMARY KEY,
    token_id VARCHAR(128) NOT NULL,
    quality_score INTEGER NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL,
    divergence_status VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
    anomalies_json TEXT NOT NULL DEFAULT '[]',
    checked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quality_logs_token ON market_data_quality_logs (token_id, checked_at DESC);
