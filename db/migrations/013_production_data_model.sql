-- ============================================================================
-- Sprint 35 — Production Data Model & Domain Schemas
-- Multi-Domain PostgreSQL Production DDL (§9 to §78)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Identity Domain (§9 - §13)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  username VARCHAR(64) UNIQUE,
  password_hash VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'deactivated'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(128),
  avatar_url TEXT,
  bio TEXT,
  country VARCHAR(2),
  timezone VARCHAR(64) DEFAULT 'UTC',
  language VARCHAR(8) DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(16) DEFAULT 'dark',
  default_chain VARCHAR(32) DEFAULT 'solana',
  default_slippage NUMERIC(6, 4) DEFAULT 0.0100, -- 1%
  default_currency VARCHAR(8) DEFAULT 'USD',
  notification_preferences JSONB DEFAULT '{}',
  trading_preferences JSONB DEFAULT '{}',
  privacy_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name VARCHAR(128) NOT NULL,
  platform VARCHAR(32) NOT NULL, -- 'web', 'ios', 'android', 'desktop'
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(64) REFERENCES devices(id) ON DELETE SET NULL,
  ip_hash VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Wallet Domain (§14 - §17)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wallets (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain VARCHAR(32) NOT NULL, -- 'solana', 'ethereum', 'base'
  address VARCHAR(128) NOT NULL,
  label VARCHAR(128),
  wallet_type VARCHAR(32) NOT NULL DEFAULT 'external', -- 'external', 'watch_only', 'embedded'
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_wallet_user_chain_addr UNIQUE (user_id, chain, address)
);

CREATE TABLE IF NOT EXISTS wallet_addresses (
  id VARCHAR(64) PRIMARY KEY,
  wallet_id VARCHAR(64) NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  chain VARCHAR(32) NOT NULL,
  address VARCHAR(128) NOT NULL,
  verified_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'unverified', -- 'unverified', 'verified', 'revoked'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_verifications (
  id VARCHAR(64) PRIMARY KEY,
  wallet_id VARCHAR(64) NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  challenge VARCHAR(255) NOT NULL,
  signature TEXT,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watched_wallets (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain VARCHAR(32) NOT NULL,
  address VARCHAR(128) NOT NULL,
  label VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_watched_user_chain_addr UNIQUE (user_id, chain, address)
);

-- ----------------------------------------------------------------------------
-- 3. Chains & Token Core Domain (§18 - §22, §27)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS chains (
  id VARCHAR(32) PRIMARY KEY, -- 'solana', 'ethereum', 'base'
  name VARCHAR(64) NOT NULL,
  chain_id VARCHAR(64) NOT NULL UNIQUE,
  native_asset VARCHAR(16) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tokens (
  id VARCHAR(64) PRIMARY KEY,
  chain_id VARCHAR(32) NOT NULL REFERENCES chains(id),
  address VARCHAR(128) NOT NULL,
  symbol VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  decimals INT NOT NULL CHECK (decimals >= 0 AND decimals <= 18),
  logo_url TEXT,
  metadata_uri TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_token_chain_address UNIQUE (chain_id, address)
);

CREATE TABLE IF NOT EXISTS token_metadata (
  token_id VARCHAR(64) PRIMARY KEY REFERENCES tokens(id) ON DELETE CASCADE,
  description TEXT,
  website TEXT,
  twitter TEXT,
  telegram TEXT,
  discord TEXT,
  github TEXT,
  metadata_source VARCHAR(64) DEFAULT 'onchain',
  metadata_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_contracts (
  id VARCHAR(64) PRIMARY KEY,
  token_id VARCHAR(64) NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  program_address VARCHAR(128) NOT NULL,
  contract_type VARCHAR(64) NOT NULL, -- 'spl_token', 'erc20', 'spl_token_2022'
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_source VARCHAR(64),
  verification_date TIMESTAMPTZ,
  risk_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_holders (
  id VARCHAR(64) PRIMARY KEY,
  token_id VARCHAR(64) NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  wallet_address VARCHAR(128) NOT NULL,
  balance NUMERIC(36, 18) NOT NULL,
  percentage NUMERIC(8, 5) NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_token_holder UNIQUE (token_id, wallet_address)
);

-- ----------------------------------------------------------------------------
-- 4. Creator & Reputation Domain (§23 - §26, §68)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS creators (
  id VARCHAR(64) PRIMARY KEY,
  chain VARCHAR(32) NOT NULL,
  wallet_address VARCHAR(128) NOT NULL,
  display_name VARCHAR(128),
  reputation_score INT NOT NULL DEFAULT 50 CHECK (reputation_score >= 0 AND reputation_score <= 100),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_creator_chain_wallet UNIQUE (chain, wallet_address)
);

CREATE TABLE IF NOT EXISTS creator_launches (
  id VARCHAR(64) PRIMARY KEY,
  creator_id VARCHAR(64) NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  token_id VARCHAR(64) NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  launch_time TIMESTAMPTZ NOT NULL,
  initial_liquidity NUMERIC(24, 6),
  peak_market_cap NUMERIC(24, 6),
  final_market_cap NUMERIC(24, 6),
  liquidity_removed_at TIMESTAMPTZ,
  outcome VARCHAR(32) NOT NULL DEFAULT 'active' -- 'graduated', 'active', 'rugged', 'abandoned'
);

CREATE TABLE IF NOT EXISTS creator_reputation (
  creator_id VARCHAR(64) PRIMARY KEY REFERENCES creators(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 0 AND score <= 100),
  successful_launches INT NOT NULL DEFAULT 0,
  failed_launches INT NOT NULL DEFAULT 0,
  abandoned_launches INT NOT NULL DEFAULT 0,
  liquidity_events INT NOT NULL DEFAULT 0,
  rug_indicators INT NOT NULL DEFAULT 0,
  model_version VARCHAR(64) NOT NULL,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS creator_reputation_snapshots (
  id VARCHAR(64) PRIMARY KEY,
  creator_id VARCHAR(64) NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  score INT NOT NULL,
  factors JSONB NOT NULL,
  model_version VARCHAR(64) NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reputation_events (
  id VARCHAR(64) PRIMARY KEY,
  subject_type VARCHAR(32) NOT NULL, -- 'creator', 'trader', 'wallet'
  subject_id VARCHAR(128) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  impact INT NOT NULL, -- positive or negative points
  evidence JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. Wallet Clustering & Effective Ownership Domain (§28 - §31)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wallet_clusters (
  id VARCHAR(64) PRIMARY KEY,
  chain VARCHAR(32) NOT NULL,
  cluster_type VARCHAR(64) NOT NULL, -- 'funding_source', 'coordinated_trading', 'creator_linked'
  confidence NUMERIC(5, 4) NOT NULL, -- 0.0000 to 1.0000
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_cluster_members (
  cluster_id VARCHAR(64) NOT NULL REFERENCES wallet_clusters(id) ON DELETE CASCADE,
  wallet_address VARCHAR(128) NOT NULL,
  relationship_type VARCHAR(64) NOT NULL,
  confidence NUMERIC(5, 4) NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cluster_id, wallet_address)
);

CREATE TABLE IF NOT EXISTS effective_ownership (
  id VARCHAR(64) PRIMARY KEY,
  token_id VARCHAR(64) NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  subject_wallet VARCHAR(128) NOT NULL,
  direct_percentage NUMERIC(8, 5) NOT NULL,
  associated_percentage NUMERIC(8, 5) NOT NULL,
  effective_percentage NUMERIC(8, 5) NOT NULL,
  confidence NUMERIC(5, 4) NOT NULL,
  model_version VARCHAR(64) NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ownership_evidence (
  id VARCHAR(64) PRIMARY KEY,
  ownership_record_id VARCHAR(64) NOT NULL REFERENCES effective_ownership(id) ON DELETE CASCADE,
  wallet_address VARCHAR(128) NOT NULL,
  evidence_type VARCHAR(64) NOT NULL,
  evidence_reference TEXT NOT NULL,
  confidence NUMERIC(5, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. Liquidity Pools & DEX Domain (§32 - §34)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS dexes (
  id VARCHAR(64) PRIMARY KEY,
  chain_id VARCHAR(32) NOT NULL REFERENCES chains(id),
  name VARCHAR(64) NOT NULL,
  protocol VARCHAR(64) NOT NULL, -- 'raydium_clmm', 'orca_whirlpool', 'uniswap_v3', 'meteora_dlmm'
  status VARCHAR(32) NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS liquidity_pools (
  id VARCHAR(64) PRIMARY KEY,
  chain_id VARCHAR(32) NOT NULL REFERENCES chains(id),
  dex_id VARCHAR(64) NOT NULL REFERENCES dexes(id),
  pool_address VARCHAR(128) NOT NULL,
  token_a VARCHAR(64) NOT NULL REFERENCES tokens(id),
  token_b VARCHAR(64) NOT NULL REFERENCES tokens(id),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pool_chain_address UNIQUE (chain_id, pool_address)
);

CREATE TABLE IF NOT EXISTS liquidity_snapshots (
  id VARCHAR(64) PRIMARY KEY,
  pool_id VARCHAR(64) NOT NULL REFERENCES liquidity_pools(id) ON DELETE CASCADE,
  reserve_a NUMERIC(36, 18) NOT NULL,
  reserve_b NUMERIC(36, 18) NOT NULL,
  usd_liquidity NUMERIC(24, 6) NOT NULL,
  price NUMERIC(24, 12) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL
);

-- ----------------------------------------------------------------------------
-- 7. Blockchain Core & Trading Execution Domain (§35 - §38, §50)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS blocks (
  chain_id VARCHAR(32) NOT NULL REFERENCES chains(id),
  block_number BIGINT NOT NULL,
  block_hash VARCHAR(128) NOT NULL,
  parent_hash VARCHAR(128) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, block_number)
);

CREATE TABLE IF NOT EXISTS blockchain_transactions (
  id VARCHAR(64) PRIMARY KEY,
  chain_id VARCHAR(32) NOT NULL REFERENCES chains(id),
  hash VARCHAR(128) NOT NULL,
  block_number BIGINT NOT NULL,
  sender VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL, -- 'confirmed', 'failed'
  fee NUMERIC(24, 12) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  raw_reference TEXT,
  CONSTRAINT uq_chain_tx_hash UNIQUE (chain_id, hash)
);

CREATE TABLE IF NOT EXISTS blockchain_events (
  id VARCHAR(64) PRIMARY KEY,
  chain_id VARCHAR(32) NOT NULL REFERENCES chains(id),
  transaction_id VARCHAR(64) NOT NULL REFERENCES blockchain_transactions(id) ON DELETE CASCADE,
  block_number BIGINT NOT NULL,
  event_index INT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_chain_tx_event UNIQUE (chain_id, transaction_id, event_index)
);

CREATE TABLE IF NOT EXISTS trades (
  id VARCHAR(64) PRIMARY KEY,
  chain_id VARCHAR(32) NOT NULL REFERENCES chains(id),
  transaction_hash VARCHAR(128) NOT NULL,
  block_number BIGINT NOT NULL,
  pool_id VARCHAR(64) NOT NULL REFERENCES liquidity_pools(id),
  token_in VARCHAR(64) NOT NULL REFERENCES tokens(id),
  token_out VARCHAR(64) NOT NULL REFERENCES tokens(id),
  trader_address VARCHAR(128) NOT NULL,
  amount_in NUMERIC(36, 18) NOT NULL,
  amount_out NUMERIC(36, 18) NOT NULL,
  price NUMERIC(24, 12) NOT NULL,
  usd_value NUMERIC(24, 6) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL
);

-- ----------------------------------------------------------------------------
-- 8. Token Intelligence & Risk Engine Domain (§41 - §47)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS token_intelligence (
  token_id VARCHAR(64) PRIMARY KEY REFERENCES tokens(id) ON DELETE CASCADE,
  risk_score INT NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  confidence INT NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  ownership_score INT NOT NULL,
  creator_score INT NOT NULL,
  organic_volume_score INT NOT NULL,
  insider_score INT NOT NULL,
  exitability_score INT NOT NULL,
  liquidity_score INT NOT NULL,
  contract_score INT NOT NULL,
  model_version VARCHAR(64) NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_intelligence_snapshots (
  id VARCHAR(64) PRIMARY KEY,
  token_id VARCHAR(64) NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  scores JSONB NOT NULL,
  factors JSONB NOT NULL,
  confidence INT NOT NULL,
  model_version VARCHAR(64) NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_signals (
  id VARCHAR(64) PRIMARY KEY,
  token_id VARCHAR(64) NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  signal_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  confidence NUMERIC(5, 4) NOT NULL,
  evidence JSONB NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS organic_volume_analysis (
  id VARCHAR(64) PRIMARY KEY,
  token_id VARCHAR(64) NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  period VARCHAR(16) NOT NULL, -- '1h', '24h', '7d'
  total_volume NUMERIC(24, 6) NOT NULL,
  estimated_organic_volume NUMERIC(24, 6) NOT NULL,
  estimated_suspicious_volume NUMERIC(24, 6) NOT NULL,
  organic_ratio NUMERIC(5, 4) NOT NULL,
  confidence NUMERIC(5, 4) NOT NULL,
  model_version VARCHAR(64) NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insider_signals (
  id VARCHAR(64) PRIMARY KEY,
  token_id VARCHAR(64) NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  wallet_address VARCHAR(128) NOT NULL,
  signal_type VARCHAR(64) NOT NULL,
  confidence NUMERIC(5, 4) NOT NULL,
  estimated_profit NUMERIC(24, 6),
  evidence JSONB NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exitability_scores (
  id VARCHAR(64) PRIMARY KEY,
  token_id VARCHAR(64) NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score >= 0 AND score <= 100),
  estimated_slippage NUMERIC(6, 4) NOT NULL,
  liquidity_depth NUMERIC(24, 6) NOT NULL,
  sell_capacity NUMERIC(24, 6) NOT NULL,
  confidence NUMERIC(5, 4) NOT NULL,
  model_version VARCHAR(64) NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_reports (
  id VARCHAR(64) PRIMARY KEY,
  token_id VARCHAR(64) NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  report_type VARCHAR(32) NOT NULL, -- 'security_audit', 'risk_summary', 'creator_deepdive'
  summary TEXT NOT NULL,
  risk_level VARCHAR(16) NOT NULL,
  evidence JSONB NOT NULL,
  model_version VARCHAR(64) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. Orders, Positions & Portfolio Domain (§48 - §55)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id VARCHAR(64) NOT NULL REFERENCES wallets(id),
  token_id VARCHAR(64) NOT NULL REFERENCES tokens(id),
  order_type VARCHAR(32) NOT NULL, -- 'MARKET', 'LIMIT', 'STOP_LOSS'
  side VARCHAR(8) NOT NULL, -- 'BUY', 'SELL'
  quantity NUMERIC(36, 18) NOT NULL,
  limit_price NUMERIC(24, 12),
  stop_price NUMERIC(24, 12),
  slippage_limit NUMERIC(6, 4) NOT NULL DEFAULT 0.0100,
  status VARCHAR(32) NOT NULL DEFAULT 'CREATED', -- 'CREATED', 'VALIDATED', 'SUBMITTED', 'FILLED', 'CANCELLED', 'FAILED'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_events (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type VARCHAR(32) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS executions (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  transaction_id VARCHAR(64) REFERENCES blockchain_transactions(id),
  quantity NUMERIC(36, 18) NOT NULL,
  price NUMERIC(24, 12) NOT NULL,
  fees NUMERIC(24, 12) NOT NULL,
  slippage NUMERIC(6, 4) NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id VARCHAR(64) NOT NULL REFERENCES wallets(id),
  token_id VARCHAR(64) NOT NULL REFERENCES tokens(id),
  quantity NUMERIC(36, 18) NOT NULL,
  average_entry_price NUMERIC(24, 12) NOT NULL,
  realized_pnl NUMERIC(24, 6) NOT NULL DEFAULT 0,
  unrealized_pnl NUMERIC(24, 6) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_position_user_wallet_token UNIQUE (user_id, wallet_id, token_id)
);

CREATE TABLE IF NOT EXISTS portfolios (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL DEFAULT 'Main Portfolio',
  base_currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_holdings (
  portfolio_id VARCHAR(64) NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  token_id VARCHAR(64) NOT NULL REFERENCES tokens(id),
  quantity NUMERIC(36, 18) NOT NULL,
  average_cost NUMERIC(24, 12) NOT NULL,
  current_value NUMERIC(24, 6) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (portfolio_id, token_id)
);

CREATE TABLE IF NOT EXISTS pnl_events (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id VARCHAR(64) NOT NULL REFERENCES wallets(id),
  token_id VARCHAR(64) NOT NULL REFERENCES tokens(id),
  event_type VARCHAR(32) NOT NULL, -- 'TRADE_CLOSE', 'AIRDROP', 'FEE'
  quantity NUMERIC(36, 18) NOT NULL,
  value NUMERIC(24, 6) NOT NULL,
  fees NUMERIC(24, 6) NOT NULL,
  realized_pnl NUMERIC(24, 6) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fee_events (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id VARCHAR(64) REFERENCES orders(id) ON DELETE SET NULL,
  fee_type VARCHAR(32) NOT NULL, -- 'protocol_fee', 'network_gas', 'priority_tip'
  amount NUMERIC(36, 18) NOT NULL,
  asset VARCHAR(32) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_rules (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_type VARCHAR(64) NOT NULL, -- 'max_trade_size', 'max_slippage', 'max_daily_loss', 'minimum_token_score'
  configuration JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 10. Alerts, Notifications & Copy Trading (§56 - §64)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS alerts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_conditions (
  id VARCHAR(64) PRIMARY KEY,
  alert_id VARCHAR(64) NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  condition_type VARCHAR(64) NOT NULL,
  configuration JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_events (
  id VARCHAR(64) PRIMARY KEY,
  alert_id VARCHAR(64) NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'triggered'
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'unread',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id VARCHAR(64) PRIMARY KEY,
  notification_id VARCHAR(64) NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel VARCHAR(32) NOT NULL, -- 'in_app', 'push', 'telegram', 'discord', 'webhook'
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  provider_reference VARCHAR(128),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS copy_strategies (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  max_trade_size NUMERIC(24, 6) NOT NULL,
  max_daily_loss NUMERIC(24, 6) NOT NULL,
  risk_configuration JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS copy_targets (
  id VARCHAR(64) PRIMARY KEY,
  strategy_id VARCHAR(64) NOT NULL REFERENCES copy_strategies(id) ON DELETE CASCADE,
  wallet_address VARCHAR(128) NOT NULL,
  allocation_percentage NUMERIC(5, 2) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS copied_trades (
  id VARCHAR(64) PRIMARY KEY,
  strategy_id VARCHAR(64) NOT NULL REFERENCES copy_strategies(id) ON DELETE CASCADE,
  source_transaction VARCHAR(128) NOT NULL,
  source_wallet VARCHAR(128) NOT NULL,
  follower_order_id VARCHAR(64) REFERENCES orders(id),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 11. Launchpad Domain (§65 - §67)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS launchpads (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  chain_id VARCHAR(32) NOT NULL REFERENCES chains(id),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  configuration JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS launch_projects (
  id VARCHAR(64) PRIMARY KEY,
  creator_id VARCHAR(64) NOT NULL REFERENCES creators(id),
  launchpad_id VARCHAR(64) NOT NULL REFERENCES launchpads(id),
  token_id VARCHAR(64) REFERENCES tokens(id),
  name VARCHAR(128) NOT NULL,
  symbol VARCHAR(32) NOT NULL,
  supply NUMERIC(36, 18) NOT NULL,
  configuration JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS launch_events (
  id VARCHAR(64) PRIMARY KEY,
  launch_project_id VARCHAR(64) NOT NULL REFERENCES launch_projects(id) ON DELETE CASCADE,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 12. API, Social & Audit Domain (§69 - §75)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api_keys (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  key_hash VARCHAR(128) NOT NULL UNIQUE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS api_usage (
  id VARCHAR(64) PRIMARY KEY,
  api_key_id VARCHAR(64) NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  request_count INT NOT NULL DEFAULT 1,
  compute_units INT NOT NULL DEFAULT 1,
  period TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
  id VARCHAR(64) PRIMARY KEY,
  referrer_user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  referred_user_id VARCHAR(64) NOT NULL REFERENCES users(id) UNIQUE,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reward_events (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_type VARCHAR(64) NOT NULL,
  amount NUMERIC(24, 6) NOT NULL,
  source VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'granted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  actor_type VARCHAR(32) NOT NULL, -- 'user', 'admin', 'system', 'api_key'
  actor_id VARCHAR(64),
  action VARCHAR(64) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(128),
  metadata JSONB NOT NULL DEFAULT '{}',
  ip_reference VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id VARCHAR(64) PRIMARY KEY,
  admin_user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(128) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 13. AI Layer Domain (§76 - §78)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_models (
  id VARCHAR(64) PRIMARY KEY,
  provider VARCHAR(64) NOT NULL, -- 'anthropic', 'google', 'openai', 'local'
  model_name VARCHAR(128) NOT NULL,
  version VARCHAR(64) NOT NULL,
  configuration_version VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_requests (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  feature VARCHAR(64) NOT NULL, -- 'trading_copilot', 'risk_explanation', 'token_summary'
  model VARCHAR(64) NOT NULL,
  model_version VARCHAR(64) NOT NULL,
  input_reference VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ai_outputs (
  id VARCHAR(64) PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL REFERENCES ai_requests(id) ON DELETE CASCADE,
  output_type VARCHAR(64) NOT NULL,
  output TEXT NOT NULL,
  confidence NUMERIC(5, 4) NOT NULL,
  evidence JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 14. Performance Indexes (§88)
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_chain_address ON tokens(chain_id, address);
CREATE INDEX IF NOT EXISTS idx_trades_token_time ON trades(token_in, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_trader_time ON trades(trader_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_positions_user_token ON positions(user_id, token_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_enabled ON alerts(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_risk_signals_token ON risk_signals(token_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id, created_at DESC);
