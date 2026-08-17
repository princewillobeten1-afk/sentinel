-- Real-Time Solana Token Feed — Persistent Database Schema (Section 15)

CREATE TABLE IF NOT EXISTS tokens (
    mint TEXT PRIMARY KEY,
    name TEXT,
    symbol TEXT,
    decimals INTEGER DEFAULT 9,
    image_url TEXT,
    platform TEXT,
    pool_address TEXT,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_seen_slot BIGINT,
    first_signature TEXT,
    price_usd NUMERIC,
    liquidity_usd NUMERIC,
    market_cap_usd NUMERIC,
    volume_24h_usd NUMERIC,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trades (
    id BIGSERIAL PRIMARY KEY,
    signature TEXT NOT NULL,
    mint TEXT NOT NULL,
    wallet TEXT,
    side TEXT NOT NULL,
    amount NUMERIC,
    amount_sol NUMERIC,
    price_usd NUMERIC,
    slot BIGINT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(signature, mint, side)
);

CREATE TABLE IF NOT EXISTS wallets (
    address TEXT PRIMARY KEY,
    label TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_updated_at ON tokens(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_platform ON tokens(platform);
CREATE INDEX IF NOT EXISTS idx_trades_mint ON trades(mint);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_slot ON trades(slot DESC);
CREATE INDEX IF NOT EXISTS idx_trades_wallet ON trades(wallet);
CREATE INDEX IF NOT EXISTS idx_trades_signature ON trades(signature);
