-- ============================================================================
-- Migration 016: Sprint 38 — Analytics & Data Intelligence Platform Schema
-- ============================================================================

-- 1. Volume Decomposition & Wash Trading Snapshots
CREATE TABLE IF NOT EXISTS analytics_volume_snapshots (
    id VARCHAR(64) PRIMARY KEY,
    token_address VARCHAR(64) NOT NULL,
    timeframe VARCHAR(16) NOT NULL,
    total_volume_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    buy_volume_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    sell_volume_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    organic_volume_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    suspected_wash_volume_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    organic_score INT NOT NULL DEFAULT 50,
    wash_trading_probability_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
    snapshot_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_vol_token_tf ON analytics_volume_snapshots(token_address, timeframe);

-- 2. Wash Trading Pattern Events
CREATE TABLE IF NOT EXISTS analytics_wash_trading_events (
    id VARCHAR(64) PRIMARY KEY,
    token_address VARCHAR(64) NOT NULL,
    pattern_type VARCHAR(32) NOT NULL,
    participating_wallets JSONB NOT NULL DEFAULT '[]',
    estimated_wash_volume_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    confidence_score INT NOT NULL DEFAULT 80,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_wash_token ON analytics_wash_trading_events(token_address);

-- 3. Wallet Analytics & Behavioral Profiles
CREATE TABLE IF NOT EXISTS analytics_wallet_profiles (
    wallet_address VARCHAR(64) PRIMARY KEY,
    total_trades INT NOT NULL DEFAULT 0,
    tokens_interacted INT NOT NULL DEFAULT 0,
    win_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 50,
    realized_pnl_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    average_holding_duration_minutes INT NOT NULL DEFAULT 0,
    average_entry_latency_minutes INT NOT NULL DEFAULT 0,
    primary_classification VARCHAR(32) NOT NULL DEFAULT 'MOMENTUM_TRADER',
    cluster_id VARCHAR(64),
    is_smart_money BOOLEAN NOT NULL DEFAULT FALSE,
    smart_money_alpha_score INT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_wallet_cluster ON analytics_wallet_profiles(cluster_id);
CREATE INDEX IF NOT EXISTS idx_analytics_wallet_smart ON analytics_wallet_profiles(is_smart_money);

-- 4. Creator Outcomes & Reputations
CREATE TABLE IF NOT EXISTS analytics_creator_outcomes (
    creator_address VARCHAR(64) PRIMARY KEY,
    reputation_score INT NOT NULL DEFAULT 50,
    total_launches INT NOT NULL DEFAULT 0,
    successful_launches INT NOT NULL DEFAULT 0,
    failed_launches INT NOT NULL DEFAULT 0,
    liquidity_drain_incidents INT NOT NULL DEFAULT 0,
    median_peak_market_cap_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    outcomes_by_horizon JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(32) NOT NULL DEFAULT 'MODERATE_RISK',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Historical Backtest Records
CREATE TABLE IF NOT EXISTS analytics_backtest_runs (
    run_id VARCHAR(64) PRIMARY KEY,
    signal_name VARCHAR(64) NOT NULL,
    total_signals_triggered INT NOT NULL DEFAULT 0,
    win_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
    average_profit_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
    profit_factor NUMERIC(6, 2) NOT NULL DEFAULT 0,
    max_drawdown_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
    no_look_ahead_verified BOOLEAN NOT NULL DEFAULT TRUE,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
