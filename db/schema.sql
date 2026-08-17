-- Initial PostgreSQL schema for Project Sentinel

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Initial PostgreSQL schema for Project Sentinel

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Role and status enums
CREATE TYPE user_role AS ENUM ('user', 'admin', 'analyst');
CREATE TYPE account_status AS ENUM ('active', 'inactive', 'suspended', 'closed');
CREATE TYPE order_side AS ENUM ('buy', 'sell');
CREATE TYPE order_status AS ENUM ('pending', 'filled', 'cancelled', 'rejected', 'partial');
CREATE TYPE order_type AS ENUM ('market', 'limit', 'stop', 'stop_limit');
CREATE TYPE alert_category AS ENUM ('PRICE', 'VOLUME', 'LIQUIDITY', 'OWNERSHIP', 'CREATOR', 'INSIDER', 'ORGANIC_VOLUME', 'EXITABILITY', 'RISK', 'WALLET', 'COPY_TRADE', 'PORTFOLIO', 'ORDER', 'EXECUTION', 'LAUNCH', 'SECURITY', 'MARKET');
CREATE TYPE alert_severity AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE alert_confidence AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE alert_read_state AS ENUM ('UNREAD', 'READ', 'ACTIONED', 'DISMISSED');
CREATE TYPE notification_channel AS ENUM ('IN_APP', 'PUSH', 'EMAIL', 'TELEGRAM', 'DISCORD', 'WEBHOOK');
CREATE TYPE launch_state AS ENUM ('DRAFT', 'VALIDATING', 'READY', 'DEPLOYING', 'DEPLOYED', 'LAUNCHING', 'TRADING', 'MIGRATING', 'MIGRATED', 'VALIDATION_FAILED', 'DEPLOYMENT_FAILED', 'LAUNCH_FAILED', 'MIGRATION_FAILED');
CREATE TYPE launch_mode AS ENUM ('STANDARD', 'FAIR', 'COMMUNITY', 'VERIFIED', 'EXPERIMENTAL');
CREATE TYPE intelligence_source AS ENUM ('onchain', 'social', 'market', 'external');

-- Users and accounts
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE,
  password_hash text,
  display_name text,
  role user_role NOT NULL DEFAULT 'user',
  status account_status NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_role_idx ON users (role);
CREATE INDEX users_status_idx ON users (status);

-- Wallets
CREATE TABLE wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address text NOT NULL,
  network text NOT NULL DEFAULT 'solana',
  label text,
  is_primary boolean NOT NULL DEFAULT false,
  balance numeric(30, 10) NOT NULL DEFAULT 0,
  status account_status NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (address, network)
);

CREATE INDEX wallets_user_idx ON wallets (user_id);
CREATE INDEX wallets_network_idx ON wallets (network);
CREATE INDEX wallets_address_idx ON wallets (address);

-- SIWS Auth Challenges
CREATE TABLE auth_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  nonce text NOT NULL UNIQUE,
  statement text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_challenges_address_idx ON auth_challenges (address);

-- User Preferences
CREATE TABLE user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  slippage_tolerance numeric(5, 2) NOT NULL DEFAULT 0.50,
  risk_level text NOT NULL DEFAULT 'moderate',
  currency_display text NOT NULL DEFAULT 'USD',
  rpc_endpoint text NOT NULL DEFAULT 'mainnet',
  custom_rpc_url text,
  theme text NOT NULL DEFAULT 'dark',
  density text NOT NULL DEFAULT 'standard',
  auto_lock_minutes integer NOT NULL DEFAULT 30,
  notifications_enabled jsonb NOT NULL DEFAULT '{"security": true, "priceAlerts": true, "tradeExecution": true, "system": true}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tokens
CREATE TABLE tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  name text NOT NULL,
  network text NOT NULL,
  contract_address text,
  decimals integer NOT NULL DEFAULT 0,
  category text,
  description text,
  market_cap numeric(30, 2),
  website text,
  status account_status NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (symbol, network),
  UNIQUE (network, contract_address)
);

CREATE INDEX tokens_network_idx ON tokens (network);
CREATE INDEX tokens_status_idx ON tokens (status);

-- Creators
CREATE TABLE creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  handle text NOT NULL UNIQUE,
  website text,
  bio text,
  verified boolean NOT NULL DEFAULT false,
  status account_status NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX creators_verified_idx ON creators (verified);
CREATE INDEX creators_status_idx ON creators (status);

-- Portfolios
CREATE TABLE portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  strategy text,
  risk_profile text,
  status account_status NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portfolios_user_idx ON portfolios (user_id);
CREATE INDEX portfolios_status_idx ON portfolios (status);

-- Holdings
CREATE TABLE holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
  token_id uuid REFERENCES tokens(id) ON DELETE SET NULL,
  quantity numeric(36, 18) NOT NULL DEFAULT 0,
  average_cost numeric(30, 10) NOT NULL DEFAULT 0,
  market_value numeric(30, 10) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE (portfolio_id, wallet_id, token_id)
);

CREATE INDEX holdings_portfolio_idx ON holdings (portfolio_id);
CREATE INDEX holdings_token_idx ON holdings (token_id);

-- Orders
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE RESTRICT,
  side order_side NOT NULL,
  type order_type NOT NULL DEFAULT 'market',
  quantity numeric(36, 18) NOT NULL,
  price numeric(30, 10),
  fee numeric(30, 10) DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pending',
  exchange text,
  placed_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX orders_portfolio_idx ON orders (portfolio_id);
CREATE INDEX orders_status_idx ON orders (status);
CREATE INDEX orders_token_idx ON orders (token_id);

-- Alerts
CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
  token_id uuid REFERENCES tokens(id) ON DELETE SET NULL,
  creator_id uuid REFERENCES creators(id) ON DELETE SET NULL,
  type alert_type NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'info',
  threshold jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_triggered timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX alerts_user_idx ON alerts (user_id);
CREATE INDEX alerts_type_idx ON alerts (type);
CREATE INDEX alerts_active_idx ON alerts (is_active);

-- Launchpad Core
CREATE TABLE launches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES users(id) ON DELETE SET NULL,
  token_id uuid REFERENCES tokens(id) ON DELETE SET NULL,
  mode launch_mode NOT NULL DEFAULT 'STANDARD',
  state launch_state NOT NULL DEFAULT 'DRAFT',
  fairness_score integer,
  risk_score integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX launches_creator_idx ON launches (creator_id);
CREATE INDEX launches_state_idx ON launches (state);

-- Launch Configurations
CREATE TABLE launch_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id uuid REFERENCES launches(id) ON DELETE CASCADE,
  name text NOT NULL,
  symbol text NOT NULL,
  description text,
  logo_url text,
  website_url text,
  social_links jsonb DEFAULT '{}'::jsonb,
  total_supply numeric NOT NULL,
  decimals integer NOT NULL DEFAULT 18,
  mint_authority_enabled boolean NOT NULL DEFAULT false,
  freeze_authority_enabled boolean NOT NULL DEFAULT false,
  metadata_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Token Allocations
CREATE TABLE token_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id uuid REFERENCES launches(id) ON DELETE CASCADE,
  category text NOT NULL, -- e.g. 'Liquidity', 'Creator', 'Community', 'Treasury'
  percentage numeric NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Vesting Schedules
CREATE TABLE vesting_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid REFERENCES token_allocations(id) ON DELETE CASCADE,
  cliff_days integer NOT NULL,
  vesting_days integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Liquidity Positions
CREATE TABLE liquidity_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id uuid REFERENCES launches(id) ON DELETE CASCADE,
  initial_usd numeric NOT NULL,
  lock_type text NOT NULL, -- 'FIXED', 'PERMANENT'
  lock_duration_days integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Launch Phases (Anti-Bot / Cooldowns)
CREATE TABLE launch_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id uuid REFERENCES launches(id) ON DELETE CASCADE,
  phase_number integer NOT NULL,
  max_wallet_pct numeric,
  max_tx_usd numeric,
  cooldown_seconds integer,
  duration_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Launch Events (On-Chain tracking)
CREATE TABLE launch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id uuid REFERENCES launches(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  tx_hash text,
  block_number bigint,
  wallet_address text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Launch Snapshots (Fairness, Risk)
CREATE TABLE launch_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id uuid REFERENCES launches(id) ON DELETE CASCADE,
  fairness_score integer,
  risk_score integer,
  organic_volume_score integer,
  snapshot_date timestamptz NOT NULL DEFAULT now()
);

-- Intelligence snapshots
CREATE TABLE intelligence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES tokens(id) ON DELETE SET NULL,
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE SET NULL,
  wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
  source intelligence_source NOT NULL,
  snapshot_date timestamptz NOT NULL DEFAULT now(),
  metrics jsonb NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX intelligence_snapshots_token_idx ON intelligence_snapshots (token_id);
CREATE INDEX intelligence_snapshots_portfolio_idx ON intelligence_snapshots (portfolio_id);
CREATE INDEX intelligence_snapshots_wallet_idx ON intelligence_snapshots (wallet_id);

-- Audit logs
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  changes jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_user_idx ON audit_logs (user_id);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id);

-- Normalized Market Snapshots
CREATE TABLE market_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES tokens(id) ON DELETE CASCADE,
  price numeric(38, 18) NOT NULL,
  price_change_1m numeric(8, 4) DEFAULT 0,
  price_change_5m numeric(8, 4) DEFAULT 0,
  price_change_1h numeric(8, 4) DEFAULT 0,
  price_change_24h numeric(8, 4) DEFAULT 0,
  volume_5m numeric(38, 18) NOT NULL DEFAULT 0,
  volume_1h numeric(38, 18) NOT NULL DEFAULT 0,
  volume_24h numeric(38, 18) NOT NULL DEFAULT 0,
  liquidity numeric(38, 18) NOT NULL DEFAULT 0,
  market_cap numeric(38, 18) NOT NULL DEFAULT 0,
  buys integer NOT NULL DEFAULT 0,
  sells integer NOT NULL DEFAULT 0,
  holders integer NOT NULL DEFAULT 0,
  snapshot_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX market_snapshots_token_idx ON market_snapshots (token_id);
CREATE INDEX market_snapshots_snapshot_at_idx ON market_snapshots (snapshot_at);

-- Liquidity Pools
CREATE TABLE liquidity_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  dex_name text NOT NULL,
  pair_address text NOT NULL,
  tvl_usd numeric(38, 18) NOT NULL DEFAULT 0,
  fee_tier_percent numeric(5, 4) NOT NULL DEFAULT 0.3000,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dex_name, pair_address)
);

CREATE INDEX liquidity_pools_token_idx ON liquidity_pools (token_id);

-- Price Candles
CREATE TABLE price_candles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  timeframe text NOT NULL,
  open numeric(38, 18) NOT NULL,
  high numeric(38, 18) NOT NULL,
  low numeric(38, 18) NOT NULL,
  close numeric(38, 18) NOT NULL,
  volume numeric(38, 18) NOT NULL DEFAULT 0,
  candle_timestamp timestamptz NOT NULL
);

CREATE INDEX candles_token_time_idx ON price_candles (token_id, candle_timestamp);

-- Market Events
CREATE TABLE market_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES tokens(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_provider text NOT NULL DEFAULT 'solana_rpc',
  event_timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX market_events_timestamp_idx ON market_events (event_timestamp);

-- Trades
CREATE TABLE trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE RESTRICT,
  side order_side NOT NULL,
  input_amount numeric(38, 18) NOT NULL,
  output_amount numeric(38, 18) NOT NULL,
  price_usd numeric(38, 18) NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  tx_hash text NOT NULL UNIQUE,
  fee_sol numeric(38, 18) NOT NULL DEFAULT 0,
  route_summary text,
  placed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trades_wallet_time_idx ON trades (wallet_id, placed_at);
CREATE INDEX trades_user_idx ON trades (user_id);

-- Blockchain Transactions
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_signature text NOT NULL UNIQUE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  wallet_address text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  block_time timestamptz NOT NULL DEFAULT now(),
  logs jsonb DEFAULT '[]'::jsonb
);

CREATE INDEX tx_signature_idx ON transactions (tx_signature);

-- Watchlist Items
CREATE TABLE watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token_id)
);

CREATE INDEX watchlist_items_user_idx ON watchlist_items (user_id);

-- Discovery Snapshots (Point-in-time composite discovery scores per token)
CREATE TABLE discovery_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  market_snapshot_id uuid REFERENCES market_snapshots(id) ON DELETE SET NULL,
  discovery_score integer NOT NULL CHECK (discovery_score >= 0 AND discovery_score <= 100),
  trending_rank_score integer NOT NULL DEFAULT 0,
  raw_trending_score integer NOT NULL DEFAULT 0,
  decay_factor numeric(5, 4) NOT NULL DEFAULT 1.0000,
  grade text NOT NULL,
  signals_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  anomalies jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX discovery_snapshots_token_idx ON discovery_snapshots (token_id);
CREATE INDEX discovery_snapshots_score_idx ON discovery_snapshots (discovery_score DESC);
CREATE INDEX discovery_snapshots_trending_idx ON discovery_snapshots (trending_rank_score DESC);

-- Discovery Signals (Individual signal records produced by signal processor)
CREATE TABLE discovery_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX discovery_signals_token_time_idx ON discovery_signals (token_id, created_at DESC);
CREATE INDEX discovery_signals_type_idx ON discovery_signals (signal_type);

-- Discovery Events (New tokens, anomalies, rank shifts)
CREATE TABLE discovery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES tokens(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX discovery_events_token_idx ON discovery_events (token_id);
CREATE INDEX discovery_events_time_idx ON discovery_events (occurred_at DESC);

-- Discovery Presets (User-saved filter configurations)
CREATE TABLE discovery_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text DEFAULT '⚙️',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX discovery_presets_user_idx ON discovery_presets (user_id);

-- ============================================================================
-- Sprint 5 — Token Intelligence Engine Schema Extensions
-- ============================================================================

-- Intelligence Enums
CREATE TYPE risk_category AS ENUM ('MARKET', 'LIQUIDITY', 'OWNERSHIP', 'CREATOR', 'ACTIVITY', 'CONTRACT', 'EXIT');
CREATE TYPE severity_level AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE freshness_level AS ENUM ('CURRENT', 'RECENT', 'DELAYED', 'STALE', 'MISSING');
CREATE TYPE risk_level_enum AS ENUM ('STRONG', 'FAVORABLE', 'MIXED', 'ELEVATED', 'HIGH_CONCERN', 'SEVERE');

-- Full Token Intelligence Reports
CREATE TABLE intelligence_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  chain text NOT NULL DEFAULT 'solana',
  overall_score integer NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  risk_level risk_level_enum NOT NULL,
  confidence_score integer NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  confidence_level text NOT NULL,
  freshness_level freshness_level NOT NULL DEFAULT 'CURRENT',
  methodology_version text NOT NULL,
  data_version text NOT NULL,
  report_json jsonb NOT NULL,
  explanation text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX intelligence_reports_token_idx ON intelligence_reports (token_id);
CREATE INDEX intelligence_reports_generated_idx ON intelligence_reports (generated_at DESC);

-- Individual Intelligence Signals with Evidence
CREATE TABLE intelligence_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  report_id uuid REFERENCES intelligence_reports(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  category risk_category NOT NULL,
  severity severity_level NOT NULL,
  polarity text NOT NULL CHECK (polarity IN ('POSITIVE', 'NEGATIVE', 'NEUTRAL', 'INFO')),
  value text NOT NULL,
  confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  methodology_version text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX intelligence_signals_token_cat_idx ON intelligence_signals (token_id, category);
CREATE INDEX intelligence_signals_report_idx ON intelligence_signals (report_id);

-- Per-Dimension Risk Assessments
CREATE TABLE risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  report_id uuid REFERENCES intelligence_reports(id) ON DELETE CASCADE,
  category risk_category NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  level text NOT NULL,
  confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  assessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX risk_assessments_token_cat_idx ON risk_assessments (token_id, category);

-- Intelligence Timeline Events
CREATE TABLE intelligence_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  category risk_category NOT NULL,
  severity severity_level NOT NULL DEFAULT 'INFO',
  title text NOT NULL,
  description text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  event_timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX intelligence_timeline_token_time_idx ON intelligence_timeline (token_id, event_timestamp DESC);

-- Contract / Program Observations
CREATE TABLE contract_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  mint_authority_status text NOT NULL DEFAULT 'UNKNOWN',
  mint_authority_address text,
  freeze_authority_status text NOT NULL DEFAULT 'UNKNOWN',
  freeze_authority_address text,
  total_supply text NOT NULL,
  circulating_supply text,
  supply_changeable boolean NOT NULL DEFAULT false,
  metadata_uri text,
  metadata_changeable boolean NOT NULL DEFAULT false,
  is_upgradeable boolean,
  program_id text,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contract_obs_token_idx ON contract_observations (token_id);

-- Holder Distribution Snapshots
CREATE TABLE holder_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  holder_count integer NOT NULL DEFAULT 0,
  top1_pct numeric(5, 2) NOT NULL DEFAULT 0.00,
  top5_pct numeric(5, 2) NOT NULL DEFAULT 0.00,
  top10_pct numeric(5, 2) NOT NULL DEFAULT 0.00,
  holder_growth_pct numeric(8, 2) NOT NULL DEFAULT 0.00,
  distribution jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX holder_snapshots_token_time_idx ON holder_snapshots (token_id, snapshot_at DESC);

-- Creator Observations
CREATE TABLE creator_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  creator_address text,
  creation_timestamp timestamptz,
  creation_tx text,
  known_launches integer NOT NULL DEFAULT 0,
  history_available boolean NOT NULL DEFAULT false,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX creator_obs_token_idx ON creator_observations (token_id);
CREATE INDEX creator_obs_address_idx ON creator_observations (creator_address);

-- Wallet Relationships (Cluster Foundation)
CREATE TABLE wallet_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_a text NOT NULL,
  wallet_b text NOT NULL,
  relationship_type text NOT NULL,
  confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wallet_rel_wallets_idx ON wallet_relationships (wallet_a, wallet_b);


-- ============================================================================
-- Sprint 6 — Effective Ownership Engine & Creator Reputation System Schema
-- ============================================================================

-- Creator Outcome Enum
CREATE TYPE creator_outcome_enum AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'LIQUIDITY_WITHDRAWN',
  'SEVERE_ACTIVITY_DECLINE',
  'UNKNOWN'
);

-- Wallet Entities
CREATE TABLE wallet_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL UNIQUE,
  chain text NOT NULL DEFAULT 'solana',
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wallet_entities_address_idx ON wallet_entities (address);

-- Wallet Clusters V2
CREATE TABLE wallet_clusters_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id text NOT NULL UNIQUE,
  scope text NOT NULL CHECK (scope IN ('GLOBAL', 'TOKEN_SPECIFIC')),
  token_id uuid REFERENCES tokens(id) ON DELETE CASCADE,
  cluster_confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  label text,
  methodology_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wallet_clusters_token_idx ON wallet_clusters_v2 (token_id);

-- Cluster Members
CREATE TABLE cluster_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES wallet_clusters_v2(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cluster_id, wallet_address)
);

CREATE INDEX cluster_members_wallet_idx ON cluster_members (wallet_address);

-- Funding Events
CREATE TABLE funding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_wallet text NOT NULL,
  recipient_wallet text NOT NULL,
  amount_sol numeric(16, 6) NOT NULL,
  amount_usd numeric(16, 2),
  tx_signature text NOT NULL UNIQUE,
  event_timestamp timestamptz NOT NULL
);

CREATE INDEX funding_events_pair_idx ON funding_events (source_wallet, recipient_wallet);

-- Behavioral Correlations
CREATE TABLE behavioral_correlations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_a text NOT NULL,
  wallet_b text NOT NULL,
  signal_type text NOT NULL,
  correlation_score numeric(4, 3) NOT NULL,
  observation_count integer NOT NULL DEFAULT 1,
  token_id uuid REFERENCES tokens(id) ON DELETE SET NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  methodology_version text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX behavioral_correlations_pair_idx ON behavioral_correlations (wallet_a, wallet_b);

-- Effective Ownership Reports (persistent snapshots)
CREATE TABLE ownership_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  total_supply text NOT NULL,
  circulating_supply text,
  known_held_supply text NOT NULL,
  unknown_supply text NOT NULL,
  concentration_json jsonb NOT NULL,
  confidence_score numeric(4, 3) NOT NULL,
  entities_json jsonb NOT NULL,
  methodology_version text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ownership_snapshots_token_time_idx ON ownership_snapshots (token_id, generated_at DESC);

-- Creator Entities
CREATE TABLE creator_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id text NOT NULL UNIQUE,
  primary_address text NOT NULL,
  chain text NOT NULL DEFAULT 'solana',
  known_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  identification_confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  identification_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  methodology_version text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX creator_entities_primary_idx ON creator_entities (primary_address);

-- Creator Launch Records
CREATE TABLE creator_launches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creator_entities(id) ON DELETE CASCADE,
  token_id uuid REFERENCES tokens(id) ON DELETE SET NULL,
  token_symbol text NOT NULL,
  token_name text NOT NULL,
  token_address text NOT NULL,
  chain text NOT NULL DEFAULT 'solana',
  launched_at timestamptz NOT NULL,
  initial_liquidity_usd numeric(16, 2),
  peak_liquidity_usd numeric(16, 2),
  current_liquidity_usd numeric(16, 2),
  peak_market_cap_usd numeric(16, 2),
  trading_duration_days numeric(8, 2) NOT NULL DEFAULT 0,
  creator_retained_pct numeric(5, 2),
  creator_sold_pct numeric(5, 2),
  outcome creator_outcome_enum NOT NULL DEFAULT 'UNKNOWN',
  outcome_confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX creator_launches_creator_idx ON creator_launches (creator_id);
CREATE INDEX creator_launches_token_addr_idx ON creator_launches (token_address);

-- Creator Reputation Snapshots
CREATE TABLE creator_reputation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creator_entities(id) ON DELETE CASCADE,
  score integer CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  level text NOT NULL,
  confidence numeric(4, 3) NOT NULL,
  confidence_level text NOT NULL,
  sample_size integer NOT NULL DEFAULT 0,
  dimensions_json jsonb NOT NULL,
  patterns_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  methodology_version text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX creator_rep_snapshots_creator_time_idx ON creator_reputation_snapshots (creator_id, generated_at DESC);


-- ============================================================================
-- Sprint 7 — Organic Volume Detection & Insider Detection Engine Schema
-- ============================================================================

-- Activity Window Enum
CREATE TYPE activity_window_enum AS ENUM ('1m', '5m', '15m', '1h', '4h', '24h', '7d');

-- Window Assessment Status Enum
CREATE TYPE window_assessment_status_enum AS ENUM ('AVAILABLE', 'INSUFFICIENT_DATA', 'STALE', 'UNKNOWN');

-- Activity Temporal Pattern Enum
CREATE TYPE temporal_pattern_enum AS ENUM ('CONTINUOUS', 'BURSTY', 'PERIODIC', 'CLUSTERED', 'EVENT_DRIVEN', 'UNKNOWN');

-- Activity Persistence Enum
CREATE TYPE activity_persistence_enum AS ENUM ('PERSISTENT', 'TEMPORARY', 'SPIKE_DRIVEN', 'DECLINING', 'GROWING', 'UNKNOWN');

-- Insider Candidate Status Enum
CREATE TYPE insider_candidate_status_enum AS ENUM (
  'OBSERVED_PATTERN',
  'POTENTIAL_CONNECTION',
  'HIGH_CONFIDENCE_PATTERN',
  'VERIFIED_RELATIONSHIP'
);

-- 1. Rolling Activity Feature Snapshots
CREATE TABLE activity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  chain text NOT NULL DEFAULT 'solana',
  window activity_window_enum NOT NULL,
  status window_assessment_status_enum NOT NULL DEFAULT 'AVAILABLE',
  sample_size integer NOT NULL DEFAULT 0,
  freshness_seconds integer NOT NULL DEFAULT 0,
  data_coverage numeric(4, 3) NOT NULL DEFAULT 1.000,
  features_json jsonb NOT NULL,
  feature_version text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_id, window, generated_at)
);

CREATE INDEX activity_snapshots_token_window_idx ON activity_snapshots (token_id, window, generated_at DESC);

-- 2. Organic Activity Assessments
CREATE TABLE organic_activity_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  chain text NOT NULL DEFAULT 'solana',
  window activity_window_enum NOT NULL,
  status window_assessment_status_enum NOT NULL DEFAULT 'AVAILABLE',
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  interpretation text NOT NULL,
  confidence integer NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  data_coverage numeric(4, 3) NOT NULL DEFAULT 1.000,
  sample_size integer NOT NULL DEFAULT 0,
  signals_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  organic_volume_version text NOT NULL,
  feature_version text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX organic_assessments_token_window_idx ON organic_activity_assessments (token_id, window, generated_at DESC);

-- 3. Organic Activity Signals
CREATE TABLE organic_activity_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES organic_activity_assessments(id) ON DELETE CASCADE,
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  severity severity_level NOT NULL,
  dimension text NOT NULL,
  signal_value text NOT NULL,
  confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX organic_signals_assessment_idx ON organic_activity_signals (assessment_id);
CREATE INDEX organic_signals_token_idx ON organic_activity_signals (token_id);

-- 4. Insider Reports
CREATE TABLE insider_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  chain text NOT NULL DEFAULT 'solana',
  confidence integer NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  candidate_count integer NOT NULL DEFAULT 0,
  early_participant_count integer NOT NULL DEFAULT 0,
  highest_confidence_candidate jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  insider_detection_version text NOT NULL,
  feature_version text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX insider_reports_token_idx ON insider_reports (token_id, generated_at DESC);

-- 5. Insider Candidates
CREATE TABLE insider_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES insider_reports(id) ON DELETE CASCADE,
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  confidence integer NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  status insider_candidate_status_enum NOT NULL DEFAULT 'OBSERVED_PATTERN',
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  signals_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL,
  first_observed timestamptz NOT NULL,
  last_observed timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX insider_candidates_token_idx ON insider_candidates (token_id);
CREATE INDEX insider_candidates_wallet_idx ON insider_candidates (wallet_address);

-- 6. Early Participants
CREATE TABLE early_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  entry_time timestamptz NOT NULL,
  seconds_from_launch numeric(12, 2) NOT NULL,
  entry_price_usd numeric(30, 10),
  initial_size_usd numeric(16, 2) NOT NULL,
  percent_of_supply numeric(5, 4),
  liquidity_pct numeric(5, 4),
  current_position_usd numeric(16, 2),
  realized_pnl_usd numeric(16, 2),
  unrealized_pnl_usd numeric(16, 2),
  funding_source text,
  early_participation_score integer NOT NULL,
  relationship_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX early_participants_token_time_idx ON early_participants (token_id, entry_time);
CREATE INDEX early_participants_wallet_idx ON early_participants (wallet_address);

-- 7. Wallet Activity Profiles
CREATE TABLE wallet_activity_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL UNIQUE,
  chain text NOT NULL DEFAULT 'solana',
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  observed_launches integer NOT NULL DEFAULT 0,
  early_entries_count integer NOT NULL DEFAULT 0,
  profitable_exits_count integer NOT NULL DEFAULT 0,
  win_rate_pct numeric(5, 2),
  average_return_pct numeric(8, 2),
  realized_pnl_usd numeric(16, 2) NOT NULL DEFAULT 0,
  unrealized_pnl_usd numeric(16, 2) NOT NULL DEFAULT 0,
  activity_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wallet_activity_profiles_address_idx ON wallet_activity_profiles (wallet_address);

-- 8. Wallet Pair Interactions
CREATE TABLE wallet_pair_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES tokens(id) ON DELETE CASCADE,
  wallet_a text NOT NULL,
  wallet_b text NOT NULL,
  interaction_count integer NOT NULL DEFAULT 1,
  volume_usd numeric(16, 2) NOT NULL DEFAULT 0,
  direction text NOT NULL CHECK (direction IN ('ONE_WAY', 'TWO_WAY')),
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_observed timestamptz NOT NULL,
  last_observed timestamptz NOT NULL
);

CREATE INDEX pair_interactions_wallets_idx ON wallet_pair_interactions (wallet_a, wallet_b);
CREATE INDEX pair_interactions_token_idx ON wallet_pair_interactions (token_id);

-- 9. Cluster Activity Snapshots
CREATE TABLE cluster_activity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  cluster_id text NOT NULL,
  window activity_window_enum NOT NULL,
  volume_usd numeric(16, 2) NOT NULL DEFAULT 0,
  buy_volume_usd numeric(16, 2) NOT NULL DEFAULT 0,
  sell_volume_usd numeric(16, 2) NOT NULL DEFAULT 0,
  transaction_count integer NOT NULL DEFAULT 0,
  share_of_volume numeric(5, 4) NOT NULL DEFAULT 0,
  timing_spread_seconds numeric(10, 2) NOT NULL DEFAULT 0,
  wallets_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cluster_activity_token_window_idx ON cluster_activity_snapshots (token_id, window, snapshot_at DESC);

-- 10. Activity Timeline Events
CREATE TABLE activity_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  chain text NOT NULL DEFAULT 'solana',
  event_type text NOT NULL,
  severity severity_level NOT NULL DEFAULT 'INFO',
  title text NOT NULL,
  confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_timeline_token_time_idx ON activity_timeline_events (token_id, occurred_at DESC);




-- ============================================================================
-- Sprint 8 — Exitability Score & Advanced Execution Intelligence Schema
-- ============================================================================

-- AMM kind
CREATE TYPE amm_kind_enum AS ENUM ('CONSTANT_PRODUCT', 'CONCENTRATED_LIQUIDITY', 'STABLE', 'WEIGHTED');

-- Execution / simulation status
CREATE TYPE simulation_status_enum AS ENUM (
  'SIMULATED',
  'INSUFFICIENT_LIQUIDITY',
  'SLIPPAGE_EXCEEDED',
  'QUOTE_EXPIRED',
  'POOL_CHANGED',
  'SIMULATION_FAILED',
  'VALIDATION_FAILED'
);

-- Transaction lifecycle state (spec §41)
CREATE TYPE transaction_state_enum AS ENUM (
  'CREATED', 'SIMULATING', 'SIMULATED', 'SUBMITTING', 'SUBMITTED', 'CONFIRMING', 'CONFIRMED',
  'SIMULATION_FAILED', 'SUBMISSION_FAILED', 'REJECTED', 'EXPIRED', 'REORGED', 'UNKNOWN'
);

CREATE TYPE exit_pressure_level_enum AS ENUM ('LOW', 'MODERATE', 'ELEVATED', 'HIGH', 'SEVERE');
CREATE TYPE mev_risk_level_enum AS ENUM ('LOW', 'MODERATE', 'HIGH');

-- 1. Liquidity Pools V2 (execution-grade pool registry)
CREATE TABLE liquidity_pools_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  pool_id text NOT NULL,
  dex text NOT NULL,
  kind amm_kind_enum NOT NULL DEFAULT 'CONSTANT_PRODUCT',
  fee_tier_pct numeric(6, 4) NOT NULL DEFAULT 0.3000,
  tvl_usd numeric(20, 2) NOT NULL DEFAULT 0,
  active_liquidity_usd numeric(20, 2),
  lp_locked boolean,
  lp_locked_pct numeric(5, 2),
  age_hours numeric(12, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, dex)
);

CREATE INDEX liquidity_pools_v2_token_idx ON liquidity_pools_v2 (token_id);

-- 2. Liquidity Snapshots (rolling pool state + band layout)
CREATE TABLE liquidity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  pool_id text NOT NULL,
  base_reserve numeric(40, 10) NOT NULL DEFAULT 0,
  quote_reserve numeric(40, 10) NOT NULL DEFAULT 0,
  price_usd numeric(38, 18) NOT NULL DEFAULT 0,
  tvl_usd numeric(20, 2) NOT NULL DEFAULT 0,
  active_liquidity_usd numeric(20, 2),
  bands_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX liquidity_snapshots_token_time_idx ON liquidity_snapshots (token_id, snapshot_at DESC);
CREATE INDEX liquidity_snapshots_pool_idx ON liquidity_snapshots (pool_id);

-- 3. Liquidity Events (adds / removes / migrations)
CREATE TABLE liquidity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  pool_id text NOT NULL,
  event_type text NOT NULL,
  amount_usd numeric(20, 2) NOT NULL DEFAULT 0,
  change_pct numeric(8, 2),
  actor_wallet text,
  creator_associated boolean NOT NULL DEFAULT false,
  cluster_id text,
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX liquidity_events_token_time_idx ON liquidity_events (token_id, occurred_at DESC);

-- 4. Pool Positions (LP-level, where observable)
CREATE TABLE pool_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  pool_id text NOT NULL,
  owner_wallet text NOT NULL,
  liquidity_usd numeric(20, 2) NOT NULL DEFAULT 0,
  lower_price_ratio numeric(10, 6),
  upper_price_ratio numeric(10, 6),
  in_range boolean,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pool_positions_token_idx ON pool_positions (token_id, pool_id);

-- 5. Execution Quotes (estimates — never guarantees)
CREATE TABLE execution_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  chain text NOT NULL DEFAULT 'solana',
  side order_side NOT NULL,
  input_usd numeric(20, 2) NOT NULL,
  expected_output_usd numeric(20, 2) NOT NULL,
  minimum_received_usd numeric(20, 2) NOT NULL,
  price_impact_pct numeric(8, 4) NOT NULL,
  slippage_pct numeric(8, 4) NOT NULL,
  fee_usd numeric(20, 2) NOT NULL DEFAULT 0,
  gas_usd numeric(20, 6) NOT NULL DEFAULT 0,
  mev_level mev_risk_level_enum NOT NULL DEFAULT 'LOW',
  route_json jsonb NOT NULL,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  quoted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  slot bigint
);

CREATE INDEX execution_quotes_token_time_idx ON execution_quotes (token_id, quoted_at DESC);

-- 6. Execution Simulations (validated pre-execution checks)
CREATE TABLE execution_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES execution_quotes(id) ON DELETE SET NULL,
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  chain text NOT NULL DEFAULT 'solana',
  side order_side NOT NULL,
  input_usd numeric(20, 2) NOT NULL,
  expected_output_usd numeric(20, 2) NOT NULL,
  minimum_received_usd numeric(20, 2) NOT NULL,
  price_impact_pct numeric(8, 4) NOT NULL,
  slippage_pct numeric(8, 4) NOT NULL,
  status simulation_status_enum NOT NULL,
  validations_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX execution_simulations_token_idx ON execution_simulations (token_id, created_at DESC);

-- 7. Execution Routes (candidate route archive)
CREATE TABLE execution_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES execution_quotes(id) ON DELETE CASCADE,
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  side order_side NOT NULL,
  steps_json jsonb NOT NULL,
  input_usd numeric(20, 2) NOT NULL,
  output_usd numeric(20, 2) NOT NULL,
  price_impact_pct numeric(8, 4) NOT NULL,
  fee_usd numeric(20, 2) NOT NULL DEFAULT 0,
  gas_usd numeric(20, 6) NOT NULL DEFAULT 0,
  route_score numeric(24, 6) NOT NULL DEFAULT 0,
  confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX execution_routes_quote_idx ON execution_routes (quote_id);

-- 8. Exitability Snapshots (historical exitability — spec §50)
CREATE TABLE exitability_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  chain text NOT NULL DEFAULT 'solana',
  reference_position_usd numeric(20, 2) NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  interpretation text NOT NULL,
  confidence integer NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  stress_score integer NOT NULL CHECK (stress_score >= 0 AND stress_score <= 100),
  usable_liquidity_usd numeric(20, 2) NOT NULL DEFAULT 0,
  active_liquidity_usd numeric(20, 2) NOT NULL DEFAULT 0,
  stability_score integer NOT NULL DEFAULT 0,
  exit_pressure exit_pressure_level_enum NOT NULL DEFAULT 'LOW',
  curve_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  exit_depth_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  signals_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL,
  exitability_version text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exitability_snapshots_token_time_idx ON exitability_snapshots (token_id, generated_at DESC);
CREATE INDEX exitability_snapshots_score_idx ON exitability_snapshots (score DESC);

-- 9. Exitability Scenarios (stress-test results)
CREATE TABLE exitability_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES exitability_snapshots(id) ON DELETE CASCADE,
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  scenario_id text NOT NULL,
  label text NOT NULL,
  sell_usd numeric(20, 2) NOT NULL,
  expected_proceeds_usd numeric(20, 2) NOT NULL,
  price_impact_pct numeric(8, 4) NOT NULL,
  remaining_liquidity_usd numeric(20, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exitability_scenarios_snapshot_idx ON exitability_scenarios (snapshot_id);

-- 10. Liquidity Risk Events (feeds Smart Alerts — spec §51)
CREATE TABLE liquidity_risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  chain text NOT NULL DEFAULT 'solana',
  event_type text NOT NULL,
  severity severity_level NOT NULL DEFAULT 'INFO',
  title text NOT NULL,
  confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX liquidity_risk_events_token_time_idx ON liquidity_risk_events (token_id, occurred_at DESC);


-- ============================================================================
-- Sprint 9 — Portfolio Intelligence & Position Risk Engine Schema
-- (mirrors db/migrations/009_portfolio_intelligence.sql)
-- ============================================================================

--   * Monetary columns that can legitimately be "unknown" are NULLable and
--     paired with a *_status column. NULL means unknown/unavailable — it is
--     never the same as 0 (spec §44).
--   * Cost basis is stored at lot granularity so accounting methods can be
--     changed without re-deriving positions (spec §6, §7).
--   * Every performance metric row carries its sample size (spec §37).
-- ============================================================================

-- ── Enums ──

CREATE TYPE value_status_enum AS ENUM ('KNOWN', 'ESTIMATED', 'STALE', 'UNKNOWN', 'UNAVAILABLE');

CREATE TYPE accounting_method_enum AS ENUM ('FIFO', 'LIFO', 'HIFO', 'AVERAGE');

CREATE TYPE position_status_enum AS ENUM ('OPEN', 'CLOSED', 'DUST');

CREATE TYPE risk_band_enum AS ENUM ('LOW', 'MODERATE', 'ELEVATED', 'HIGH', 'SEVERE');

CREATE TYPE risk_class_enum AS ENUM ('LOW', 'MODERATE', 'HIGH', 'UNKNOWN');

CREATE TYPE transaction_class_enum AS ENUM (
  'BUY', 'SELL',
  'INTERNAL_TRANSFER_IN', 'INTERNAL_TRANSFER_OUT',
  'EXTERNAL_TRANSFER_IN', 'EXTERNAL_TRANSFER_OUT',
  'AIRDROP', 'UNKNOWN_ACQUISITION', 'UNKNOWN_DISPOSAL',
  'BRIDGE_IN', 'BRIDGE_OUT',
  'MIGRATION_IN', 'MIGRATION_OUT',
  'STAKING_REWARD', 'IGNORED'
);

CREATE TYPE cost_basis_certainty_enum AS ENUM ('KNOWN', 'ESTIMATED', 'CARRIED_OVER', 'UNKNOWN');

CREATE TYPE lot_source_enum AS ENUM (
  'BUY', 'AIRDROP', 'TRANSFER_IN', 'BRIDGE_IN', 'MIGRATION_IN', 'STAKING_REWARD', 'UNKNOWN'
);

CREATE TYPE ledger_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'DROPPED', 'REORGED');

CREATE TYPE strategy_tag_enum AS ENUM (
  'MANUAL', 'COPY_TRADE', 'LIMIT_ORDER', 'STOP_LOSS', 'MARKET_ORDER', 'LAUNCH_PARTICIPATION', 'UNTAGGED'
);

CREATE TYPE wallet_role_enum AS ENUM ('TRADING', 'MAIN', 'BOT', 'COLD', 'OTHER');

CREATE TYPE wallet_link_source_enum AS ENUM ('USER', 'INTERNAL_TRANSFER_EVIDENCE');

CREATE TYPE portfolio_visibility_enum AS ENUM ('PRIVATE', 'SHARED');

CREATE TYPE performance_window_enum AS ENUM ('TODAY', '7D', '30D', 'ALL');

CREATE TYPE sample_adequacy_enum AS ENUM ('INSUFFICIENT', 'LOW', 'MODERATE', 'ADEQUATE');

CREATE TYPE position_event_type_enum AS ENUM (
  'OPENED', 'ADDED', 'PARTIAL_EXIT', 'CLOSED',
  'TRANSFER_IN', 'TRANSFER_OUT', 'AIRDROP_RECEIVED',
  'BRIDGED_IN', 'BRIDGED_OUT', 'MIGRATED',
  'PRICE_MOVE', 'RISK_INCREASED', 'RISK_DECREASED',
  'LIQUIDITY_DROP', 'EXITABILITY_DROP', 'WHALE_EXIT', 'CREATOR_SELL', 'CORRECTION'
);

CREATE TYPE position_event_origin_enum AS ENUM ('BLOCKCHAIN', 'SENTINEL');

-- portfolio_alert_type_enum removed for unified alert system

CREATE TYPE reconciliation_reason_enum AS ENUM (
  'REORGED', 'DROPPED', 'FAILED', 'DUPLICATE', 'SUPERSEDED'
);

-- ── 1. Wallet groups (spec §38, §39, §53) ──
-- Private by default. Membership is explicit; Sentinel never auto-merges.

CREATE TABLE wallet_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  visibility portfolio_visibility_enum NOT NULL DEFAULT 'PRIVATE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX wallet_groups_user_idx ON wallet_groups (user_id);

-- ── 2. Portfolios (extends the Sprint 1 portfolios table concept) ──

CREATE TABLE portfolio_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_group_id uuid REFERENCES wallet_groups(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Primary Portfolio',
  accounting_method accounting_method_enum NOT NULL DEFAULT 'FIFO',
  -- Holding-period bucket thresholds are configurable (spec §26).
  scalp_max_hours numeric(10, 2) NOT NULL DEFAULT 1,
  intraday_max_hours numeric(10, 2) NOT NULL DEFAULT 24,
  swing_max_hours numeric(10, 2) NOT NULL DEFAULT 336,
  price_freshness_seconds integer NOT NULL DEFAULT 120,
  visibility portfolio_visibility_enum NOT NULL DEFAULT 'PRIVATE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portfolio_intelligence_user_idx ON portfolio_intelligence (user_id);

-- ── 3. Portfolio wallets (spec §38, §39) ──

CREATE TABLE portfolio_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio_intelligence(id) ON DELETE CASCADE,
  wallet_group_id uuid REFERENCES wallet_groups(id) ON DELETE CASCADE,
  address text NOT NULL,
  chain text NOT NULL,
  label text NOT NULL DEFAULT 'Wallet',
  role wallet_role_enum NOT NULL DEFAULT 'OTHER',
  linked_by wallet_link_source_enum NOT NULL DEFAULT 'USER',
  link_confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, chain, address)
);

CREATE INDEX portfolio_wallets_portfolio_idx ON portfolio_wallets (portfolio_id);
CREATE INDEX portfolio_wallets_address_idx ON portfolio_wallets (address);

-- Suggested links are surfaced for confirmation, never applied automatically.
CREATE TABLE wallet_link_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_a text NOT NULL,
  wallet_b text NOT NULL,
  confidence numeric(4, 3) NOT NULL,
  transfer_count integer NOT NULL DEFAULT 0,
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  accepted boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, wallet_a, wallet_b)
);

-- ── 4. Ledger events (blockchain facts + classification) ──

CREATE TABLE portfolio_ledger_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio_intelligence(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  tx_hash text NOT NULL,
  chain text NOT NULL,
  wallet text NOT NULL,
  token_id uuid REFERENCES tokens(id) ON DELETE SET NULL,
  token_ref text NOT NULL,
  symbol text NOT NULL,
  is_native boolean NOT NULL DEFAULT false,
  direction text NOT NULL CHECK (direction IN ('IN', 'OUT')),
  quantity numeric(40, 18) NOT NULL,
  requested_quantity numeric(40, 18),
  price_per_token_usd numeric(38, 18),
  quoted_price_per_token_usd numeric(38, 18),
  counterparty_wallet text,
  counterparty_chain text,
  trading_fee_usd numeric(20, 6) NOT NULL DEFAULT 0,
  network_fee_usd numeric(20, 6) NOT NULL DEFAULT 0,
  dex_fee_usd numeric(20, 6) NOT NULL DEFAULT 0,
  source text NOT NULL,
  status ledger_status_enum NOT NULL DEFAULT 'CONFIRMED',
  strategy strategy_tag_enum NOT NULL DEFAULT 'UNTAGGED',
  classification transaction_class_enum,
  classification_confidence numeric(4, 3),
  cost_basis_certainty cost_basis_certainty_enum,
  pnl_neutral boolean NOT NULL DEFAULT false,
  classification_evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  hints_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  -- Deduplication key: the same chain movement can be ingested repeatedly.
  UNIQUE (portfolio_id, tx_hash, chain, wallet, token_ref, direction, quantity)
);

CREATE INDEX portfolio_ledger_events_portfolio_time_idx
  ON portfolio_ledger_events (portfolio_id, occurred_at DESC);
CREATE INDEX portfolio_ledger_events_token_idx ON portfolio_ledger_events (portfolio_id, token_ref);
CREATE INDEX portfolio_ledger_events_status_idx ON portfolio_ledger_events (portfolio_id, status);

-- ── 5. Positions ──

CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio_intelligence(id) ON DELETE CASCADE,
  token_id uuid REFERENCES tokens(id) ON DELETE SET NULL,
  token_ref text NOT NULL,
  symbol text NOT NULL,
  name text,
  chain text NOT NULL,
  is_native boolean NOT NULL DEFAULT false,
  wallets jsonb NOT NULL DEFAULT '[]'::jsonb,
  status position_status_enum NOT NULL DEFAULT 'OPEN',
  quantity numeric(40, 18) NOT NULL DEFAULT 0,

  -- Valuation. NULL + status is how "unavailable" is stored (spec §42, §44).
  mark_value_usd numeric(24, 6),
  mark_value_status value_status_enum NOT NULL DEFAULT 'UNAVAILABLE',
  price_usd numeric(38, 18),
  price_source text,
  price_timestamp timestamptz,
  price_confidence numeric(4, 3) NOT NULL DEFAULT 0,
  estimated_exit_value_usd numeric(24, 6),
  estimated_exit_value_status value_status_enum NOT NULL DEFAULT 'UNAVAILABLE',
  stress_exit_value_usd numeric(24, 6),
  exit_discount_pct numeric(10, 6),

  -- P&L (spec §5): realized + unrealized − fees = net.
  realized_pnl_usd numeric(24, 6),
  realized_pnl_status value_status_enum NOT NULL DEFAULT 'KNOWN',
  unrealized_pnl_usd numeric(24, 6),
  unrealized_pnl_status value_status_enum NOT NULL DEFAULT 'UNKNOWN',
  net_pnl_usd numeric(24, 6),
  net_pnl_status value_status_enum NOT NULL DEFAULT 'UNKNOWN',
  net_return_pct numeric(12, 6),
  trading_fees_usd numeric(20, 6) NOT NULL DEFAULT 0,
  network_fees_usd numeric(20, 6) NOT NULL DEFAULT 0,
  dex_fees_usd numeric(20, 6) NOT NULL DEFAULT 0,
  total_fees_usd numeric(20, 6) NOT NULL DEFAULT 0,
  has_unknown_basis boolean NOT NULL DEFAULT false,

  allocation_pct numeric(10, 6),
  risk_score numeric(5, 2) NOT NULL DEFAULT 0,
  risk_band risk_band_enum NOT NULL DEFAULT 'LOW',
  risk_confidence numeric(4, 3) NOT NULL DEFAULT 0,
  exitability_score integer,
  exitability_stress_score integer,
  usable_liquidity_usd numeric(24, 2),
  liquidity_ratio numeric(14, 6),
  depth_ratio numeric(14, 6),
  average_holding_hours numeric(14, 4),
  strategy_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_acquired_at timestamptz,
  last_activity_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, chain, token_ref)
);

CREATE INDEX positions_portfolio_idx ON positions (portfolio_id, status);
CREATE INDEX positions_value_idx ON positions (portfolio_id, mark_value_usd DESC NULLS LAST);
CREATE INDEX positions_risk_idx ON positions (portfolio_id, risk_score DESC);

-- ── 6. Cost basis (position-level summary) ──

CREATE TABLE cost_basis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  method accounting_method_enum NOT NULL DEFAULT 'FIFO',
  acquired_quantity numeric(40, 18) NOT NULL DEFAULT 0,
  disposed_quantity numeric(40, 18) NOT NULL DEFAULT 0,
  remaining_quantity numeric(40, 18) NOT NULL DEFAULT 0,
  acquisition_cost_usd numeric(24, 6),
  acquisition_cost_status value_status_enum NOT NULL DEFAULT 'KNOWN',
  average_cost_usd numeric(38, 18),
  average_cost_status value_status_enum NOT NULL DEFAULT 'KNOWN',
  remaining_cost_basis_usd numeric(24, 6),
  remaining_cost_basis_status value_status_enum NOT NULL DEFAULT 'KNOWN',
  realized_cost_basis_usd numeric(24, 6),
  unknown_basis_quantity numeric(40, 18) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position_id)
);

-- ── 7. Position lots (spec §7) ──

CREATE TABLE position_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  token_ref text NOT NULL,
  chain text NOT NULL,
  wallet text NOT NULL,
  quantity numeric(40, 18) NOT NULL,
  remaining_quantity numeric(40, 18) NOT NULL,
  acquisition_price_usd numeric(38, 18),
  acquisition_cost_usd numeric(24, 6),
  acquisition_cost_status value_status_enum NOT NULL DEFAULT 'KNOWN',
  fees_usd numeric(20, 6) NOT NULL DEFAULT 0,
  source lot_source_enum NOT NULL DEFAULT 'BUY',
  certainty cost_basis_certainty_enum NOT NULL DEFAULT 'KNOWN',
  ledger_event_id uuid REFERENCES portfolio_ledger_events(id) ON DELETE SET NULL,
  transaction_hash text NOT NULL,
  -- Set when basis was carried across a bridge or migration (spec §10, §11).
  carried_from_token_ref text,
  carried_from_chain text,
  carried_from_lot_id uuid REFERENCES position_lots(id) ON DELETE SET NULL,
  acquired_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX position_lots_position_idx ON position_lots (position_id, acquired_at);
CREATE INDEX position_lots_open_idx ON position_lots (position_id) WHERE remaining_quantity > 0;

-- ── 8. Realized P&L entries + lot consumption ──

CREATE TABLE realized_pnl_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  ledger_event_id uuid REFERENCES portfolio_ledger_events(id) ON DELETE SET NULL,
  transaction_hash text NOT NULL,
  quantity numeric(40, 18) NOT NULL,
  proceeds_usd numeric(24, 6),
  proceeds_status value_status_enum NOT NULL DEFAULT 'KNOWN',
  cost_basis_usd numeric(24, 6),
  cost_basis_status value_status_enum NOT NULL DEFAULT 'KNOWN',
  gross_pnl_usd numeric(24, 6),
  net_pnl_usd numeric(24, 6),
  net_pnl_status value_status_enum NOT NULL DEFAULT 'KNOWN',
  trading_fees_usd numeric(20, 6) NOT NULL DEFAULT 0,
  network_fees_usd numeric(20, 6) NOT NULL DEFAULT 0,
  dex_fees_usd numeric(20, 6) NOT NULL DEFAULT 0,
  total_fees_usd numeric(20, 6) NOT NULL DEFAULT 0,
  holding_hours numeric(14, 4) NOT NULL DEFAULT 0,
  unknown_basis_quantity numeric(40, 18) NOT NULL DEFAULT 0,
  strategy strategy_tag_enum NOT NULL DEFAULT 'UNTAGGED',
  occurred_at timestamptz NOT NULL
);

CREATE INDEX realized_pnl_entries_position_idx ON realized_pnl_entries (position_id, occurred_at DESC);

CREATE TABLE lot_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realized_entry_id uuid NOT NULL REFERENCES realized_pnl_entries(id) ON DELETE CASCADE,
  lot_id uuid NOT NULL REFERENCES position_lots(id) ON DELETE CASCADE,
  quantity numeric(40, 18) NOT NULL,
  cost_basis_usd numeric(24, 6),
  cost_basis_status value_status_enum NOT NULL DEFAULT 'KNOWN',
  acquisition_fees_usd numeric(20, 6) NOT NULL DEFAULT 0,
  holding_hours numeric(14, 4) NOT NULL DEFAULT 0,
  acquired_at timestamptz NOT NULL
);

CREATE INDEX lot_consumptions_entry_idx ON lot_consumptions (realized_entry_id);

-- ── 9. Position events / timeline (spec §28) ──

CREATE TABLE position_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  type position_event_type_enum NOT NULL,
  origin position_event_origin_enum NOT NULL DEFAULT 'BLOCKCHAIN',
  title text NOT NULL,
  detail text,
  quantity numeric(40, 18),
  value_usd numeric(24, 6),
  transaction_hash text,
  confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  occurred_at timestamptz NOT NULL
);

CREATE INDEX position_events_position_time_idx ON position_events (position_id, occurred_at DESC);

-- ── 10. Execution costs (spec §24) ──

CREATE TABLE execution_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  ledger_event_id uuid REFERENCES portfolio_ledger_events(id) ON DELETE SET NULL,
  transaction_hash text NOT NULL,
  side order_side NOT NULL,
  quantity numeric(40, 18) NOT NULL,
  quoted_price_usd numeric(38, 18),
  executed_price_usd numeric(38, 18),
  price_difference_usd numeric(38, 18),
  slippage_pct numeric(12, 6),
  fees_usd numeric(20, 6) NOT NULL DEFAULT 0,
  execution_cost_usd numeric(24, 6),
  execution_cost_status value_status_enum NOT NULL DEFAULT 'UNKNOWN',
  fill_ratio numeric(10, 6),
  occurred_at timestamptz NOT NULL
);

CREATE INDEX execution_costs_position_idx ON execution_costs (position_id, occurred_at DESC);

-- ── 11. Snapshots (spec §34, §35, §47) ──

CREATE TABLE portfolio_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio_intelligence(id) ON DELETE CASCADE,
  mark_value_usd numeric(24, 6),
  estimated_exit_value_usd numeric(24, 6),
  stress_exit_value_usd numeric(24, 6),
  invested_capital_usd numeric(24, 6),
  position_count integer NOT NULL DEFAULT 0,
  risk_score numeric(5, 2) NOT NULL DEFAULT 0,
  confidence numeric(4, 3) NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portfolio_snapshots_time_idx ON portfolio_snapshots (portfolio_id, captured_at DESC);

CREATE TABLE pnl_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio_intelligence(id) ON DELETE CASCADE,
  realized_usd numeric(24, 6),
  unrealized_usd numeric(24, 6),
  net_usd numeric(24, 6),
  fees_usd numeric(20, 6) NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pnl_snapshots_time_idx ON pnl_snapshots (portfolio_id, captured_at DESC);

CREATE TABLE risk_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio_intelligence(id) ON DELETE CASCADE,
  score numeric(5, 2) NOT NULL,
  band risk_band_enum NOT NULL,
  weighted_position_risk numeric(5, 2) NOT NULL DEFAULT 0,
  concentration_penalty numeric(5, 2) NOT NULL DEFAULT 0,
  liquidity_penalty numeric(5, 2) NOT NULL DEFAULT 0,
  correlation_penalty numeric(5, 2) NOT NULL DEFAULT 0,
  drivers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX risk_snapshots_time_idx ON risk_snapshots (portfolio_id, captured_at DESC);

CREATE TABLE exposure_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio_intelligence(id) ON DELETE CASCADE,
  largest_position_pct numeric(10, 6),
  top3_pct numeric(10, 6),
  top5_pct numeric(10, 6),
  herfindahl numeric(10, 6) NOT NULL DEFAULT 0,
  by_chain_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  by_risk_class_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  by_token_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  by_creator_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  illiquid_share_pct numeric(10, 6) NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exposure_snapshots_time_idx ON exposure_snapshots (portfolio_id, captured_at DESC);

-- ── 12. Performance metrics — every metric stores its sample size (spec §37) ──

CREATE TABLE performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio_intelligence(id) ON DELETE CASCADE,
  window performance_window_enum NOT NULL,
  metric text NOT NULL,
  value numeric(24, 8),
  value_status value_status_enum NOT NULL DEFAULT 'KNOWN',
  sample_count integer NOT NULL DEFAULT 0,
  sample_adequacy sample_adequacy_enum NOT NULL DEFAULT 'INSUFFICIENT',
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, window, metric, captured_at)
);

CREATE INDEX performance_metrics_lookup_idx
  ON performance_metrics (portfolio_id, window, metric, captured_at DESC);

-- ── 13. Portfolio alerts (Migrated to Unified Smart Alerts system) ──

-- ── 14. Reconciliation log (spec §51) ──
-- Corrections are appended, never applied destructively, so portfolio history
-- can always be replayed and audited.

CREATE TABLE portfolio_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio_intelligence(id) ON DELETE CASCADE,
  ledger_event_id uuid REFERENCES portfolio_ledger_events(id) ON DELETE SET NULL,
  transaction_hash text NOT NULL,
  reason reconciliation_reason_enum NOT NULL,
  removed_quantity numeric(40, 18) NOT NULL DEFAULT 0,
  detail text NOT NULL,
  rebuilt boolean NOT NULL DEFAULT false,
  corrected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portfolio_reconciliations_time_idx
  ON portfolio_reconciliations (portfolio_id, corrected_at DESC);

-- ── 15. Position risk detail (component-level, for the Risk Center) ──

CREATE TABLE position_risk_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  score numeric(5, 2) NOT NULL,
  band risk_band_enum NOT NULL,
  confidence numeric(4, 3) NOT NULL DEFAULT 0,
  components_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  drivers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  version text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX position_risk_snapshots_time_idx
  ON position_risk_snapshots (position_id, captured_at DESC);

-- ── 16. Audit log for portfolio access (spec §52) ──

CREATE TABLE portfolio_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  portfolio_id uuid REFERENCES portfolio_intelligence(id) ON DELETE SET NULL,
  wallet text,
  action text NOT NULL,
  authorized boolean NOT NULL,
  ip_address text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portfolio_access_log_user_idx ON portfolio_access_log (user_id, occurred_at DESC);
CREATE INDEX portfolio_access_log_denied_idx
  ON portfolio_access_log (occurred_at DESC) WHERE NOT authorized;

-- -----------------------------------------------------------------------------
-- WALLET EXECUTION & INTELLIGENCE SYSTEM (SPRINT 10)
-- -----------------------------------------------------------------------------

-- Core Wallet record
CREATE TABLE wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  address text NOT NULL,
  chain text NOT NULL,
  label text,
  status text NOT NULL DEFAULT 'active', -- active, suspended, disconnected
  added_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz,
  UNIQUE(user_id, address, chain)
);

-- Cryptographic Authentication Sessions for Wallets
CREATE TABLE wallet_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES wallets(id) ON DELETE CASCADE,
  nonce text NOT NULL UNIQUE,
  domain text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text
);

-- Categorize wallets (Portfolio, Trading, Launchpad)
CREATE TABLE wallet_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Link wallets to groups
CREATE TABLE wallet_group_members (
  group_id uuid REFERENCES wallet_groups(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES wallets(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, wallet_id)
);

-- Explicit capability maps (VIEW, TRADE, TRANSFER)
CREATE TABLE wallet_permissions (
  wallet_id uuid REFERENCES wallets(id) ON DELETE CASCADE,
  permission text NOT NULL, -- VIEW, TRADE, TRANSFER, ADMIN
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet_id, permission)
);

-- Derived intelligence on trader type and preferences
CREATE TABLE wallet_profiles (
  wallet_id uuid PRIMARY KEY REFERENCES wallets(id) ON DELETE CASCADE,
  trader_type text, -- e.g., 'sniper', 'swing', 'lp'
  activity_level text, -- 'high', 'moderate', 'low'
  typical_trade_size numeric,
  win_rate numeric,
  realized_pnl numeric,
  holding_style text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Computed risk metrics
CREATE TABLE wallet_risk_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES wallets(id) ON DELETE CASCADE,
  risk_score integer NOT NULL, -- 0-100
  concentration_level text,
  suspicious_interaction_count integer DEFAULT 0,
  snapshot_at timestamptz NOT NULL DEFAULT now()
);

-- Wallet Relationships (Clustering / Funding sources)
CREATE TABLE wallet_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_wallet text NOT NULL,
  target_wallet text NOT NULL,
  relationship_type text NOT NULL, -- e.g., 'funded_by', 'shared_counterparty'
  confidence_score numeric,
  evidence text,
  detected_at timestamptz NOT NULL DEFAULT now()
);

-- For the watchlist feature
CREATE TABLE wallet_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  watched_address text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, watched_address)
);

-- wallet_alerts migrated to Unified Smart Alerts system

-- Transaction state machine and tracking
CREATE TABLE transaction_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
  chain text NOT NULL,
  intent_type text NOT NULL, -- SWAP, TRANSFER, APPROVE, etc
  transaction_hash text,
  status text NOT NULL, -- CREATED, PREPARING, SIMULATING, SIGNED, BROADCASTING, CONFIRMED, FAILED
  amount_in numeric,
  amount_out numeric,
  token_in text,
  token_out text,
  estimated_fee numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  confirmed_at timestamptz,
  error_message text
);

-- Pre-flight simulation tracking
CREATE TABLE transaction_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES transaction_records(id) ON DELETE CASCADE,
  success boolean NOT NULL,
  expected_out numeric,
  price_impact numeric,
  error_reason text,
  simulated_at timestamptz NOT NULL DEFAULT now()
);

-- Track exposed allowances
CREATE TABLE token_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES wallets(id) ON DELETE CASCADE,
  chain text NOT NULL,
  token_address text NOT NULL,
  spender_address text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

-- Indexes for Wallet System
CREATE INDEX wallets_user_idx ON wallets(user_id);
CREATE INDEX wallet_sessions_wallet_idx ON wallet_sessions(wallet_id, expires_at);
CREATE INDEX transaction_records_wallet_idx ON transaction_records(wallet_id, created_at DESC);
CREATE INDEX token_approvals_wallet_idx ON token_approvals(wallet_id, chain);
CREATE INDEX wallet_relationships_source_idx ON wallet_relationships(source_wallet);
CREATE INDEX wallet_relationships_target_idx ON wallet_relationships(target_wallet);

-- ==========================================
-- Sprint 11: Order Management System
-- ==========================================

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  wallet_id uuid REFERENCES wallets(id),
  chain text NOT NULL,
  token_in text NOT NULL,
  token_out text NOT NULL,
  side text NOT NULL, -- 'BUY', 'SELL'
  type text NOT NULL, -- 'MARKET', 'LIMIT', etc.
  quantity numeric NOT NULL,
  quantity_type text NOT NULL, -- 'EXACT_IN', 'EXACT_OUT'
  status text NOT NULL, -- 'CREATED', 'QUOTING', 'RISK_CHECK', 'SIMULATING', 'AWAITING_SIGNATURE', 'SIGNED', 'SUBMITTED', 'EXECUTING', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'EXPIRED', 'REJECTED', 'FAILED'
  slippage numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  metadata jsonb
);

CREATE TABLE order_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  attempt_number integer NOT NULL,
  status text NOT NULL,
  transaction_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE order_fills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  execution_id uuid NOT NULL REFERENCES order_executions(id),
  quantity numeric NOT NULL,
  price numeric NOT NULL,
  fee numeric,
  slippage numeric,
  transaction_hash text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  expected_output numeric NOT NULL,
  minimum_output numeric NOT NULL,
  price_impact numeric NOT NULL,
  fees numeric,
  gas numeric,
  execution_price numeric NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  quote_id uuid NOT NULL REFERENCES order_quotes(id),
  route_data jsonb NOT NULL,
  score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_risk_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  decision text NOT NULL, -- 'ALLOW', 'WARN', 'BLOCK'
  reasoning text,
  factors jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orders_user_idx ON orders(user_id, created_at DESC);
CREATE INDEX orders_wallet_idx ON orders(wallet_id);
CREATE INDEX orders_status_idx ON orders(status);
CREATE INDEX order_executions_order_idx ON order_executions(order_id);
CREATE INDEX order_fills_order_idx ON order_fills(order_id);
CREATE INDEX order_events_order_idx ON order_events(order_id, created_at ASC);

-- ==========================================
-- SPRINT 12: CONDITIONAL ORDERS
-- ==========================================

CREATE TABLE conditional_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  wallet_id uuid NOT NULL REFERENCES user_wallets(id),
  chain text NOT NULL,
  token_in text NOT NULL,
  token_out text NOT NULL,
  side text NOT NULL, -- 'BUY' or 'SELL'
  quantity_type text NOT NULL, -- 'ABSOLUTE', 'PERCENT_POSITION', 'PERCENT_BALANCE'
  quantity_value numeric NOT NULL,
  order_type text NOT NULL, -- 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT'
  status text NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'MONITORING', 'TRIGGER_DETECTED', 'TRIGGER_VALIDATING', 'TRIGGERED', 'EXECUTION_PENDING', 'EXECUTING', 'FILLED', 'CANCELLED', 'EXPIRED', 'REJECTED', 'TRIGGER_FAILED'
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trigger_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conditional_order_id uuid NOT NULL REFERENCES conditional_orders(id),
  source text NOT NULL, -- 'POOL_PRICE', 'DEX_AGGREGATED', 'ORACLE'
  operator text NOT NULL, -- '>', '>=', '<', '<=', 'CROSSES_ABOVE', 'CROSSES_BELOW'
  target_price numeric NOT NULL,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conditional_order_id uuid NOT NULL REFERENCES conditional_orders(id),
  wallet_id uuid NOT NULL REFERENCES user_wallets(id),
  token text NOT NULL,
  reserved_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'RELEASED', 'CONSUMED'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trigger_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conditional_order_id uuid NOT NULL REFERENCES conditional_orders(id),
  trigger_price numeric NOT NULL,
  actual_price numeric NOT NULL,
  source text NOT NULL,
  validation_status text NOT NULL, -- 'PASSED', 'REJECTED'
  rejection_reason text,
  detected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conditional_order_id uuid NOT NULL REFERENCES conditional_orders(id),
  version integer NOT NULL,
  changed_fields jsonb NOT NULL,
  previous_values jsonb NOT NULL,
  new_values jsonb NOT NULL,
  changed_by text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE automation_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  wallet_id uuid NOT NULL REFERENCES user_wallets(id),
  max_trade_size_usd numeric,
  max_daily_size_usd numeric,
  allowed_chains text[],
  allowed_contracts text[],
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED', 'EXPIRED'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conditional_orders_user_idx ON conditional_orders(user_id, status);
CREATE INDEX conditional_orders_status_idx ON conditional_orders(status);
CREATE INDEX trigger_conditions_order_idx ON trigger_conditions(conditional_order_id);
CREATE INDEX order_reservations_wallet_idx ON order_reservations(wallet_id, token, status);

-- SPRINT 13: COPY TRADING & SMART WALLET FOLLOWING

CREATE TABLE smart_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL UNIQUE,
  chain text NOT NULL,
  score_overall numeric NOT NULL DEFAULT 0,
  score_consistency numeric NOT NULL DEFAULT 0,
  score_risk numeric NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  total_realized_pnl numeric NOT NULL DEFAULT 0,
  trade_count integer NOT NULL DEFAULT 0,
  style_classification text,
  confidence_level text NOT NULL DEFAULT 'LOW', -- 'LOW', 'MEDIUM', 'HIGH'
  last_analyzed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallet_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  leader_wallet text NOT NULL,
  follow_type text NOT NULL, -- 'WATCH', 'ALERT_ONLY', 'COPY'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, leader_wallet)
);

CREATE TABLE copy_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  leader_wallet text NOT NULL,
  mode text NOT NULL, -- 'CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'
  allocation_usd numeric NOT NULL,
  max_trade_usd numeric NOT NULL,
  max_token_exposure_percent numeric NOT NULL,
  max_token_risk_score numeric NOT NULL,
  min_exitability_score numeric NOT NULL,
  max_price_deviation_percent numeric NOT NULL,
  copy_buys boolean NOT NULL DEFAULT true,
  copy_sells boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'PAUSED', 'STOPPED'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE copy_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_profile_id uuid NOT NULL REFERENCES copy_profiles(id),
  leader_wallet text NOT NULL,
  follower_wallet_id uuid NOT NULL REFERENCES user_wallets(id),
  source_trade_id text NOT NULL, -- The hash/ID of the leader's trade
  token text NOT NULL,
  side text NOT NULL, -- 'BUY', 'SELL'
  requested_amount_usd numeric NOT NULL,
  approved_amount_usd numeric,
  leader_price numeric NOT NULL,
  follower_price numeric,
  status text NOT NULL, -- 'DETECTED', 'EVALUATING', 'APPROVED', 'QUEUED', 'EXECUTING', 'FILLED', 'SKIPPED', 'BLOCKED', 'FAILED'
  skip_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE copied_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  leader_wallet text NOT NULL,
  token text NOT NULL,
  original_allocation_usd numeric NOT NULL,
  current_quantity numeric NOT NULL,
  cost_basis_usd numeric NOT NULL,
  copied_percentage numeric NOT NULL, -- How much of the leader's position we copied
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, leader_wallet, token)
);

CREATE INDEX smart_wallets_score_idx ON smart_wallets(score_overall DESC);
CREATE INDEX copy_profiles_leader_idx ON copy_profiles(leader_wallet, status);
CREATE INDEX copy_trades_profile_idx ON copy_trades(copy_profile_id, status);
CREATE INDEX copied_positions_user_token_idx ON copied_positions(user_id, token);

-- -----------------------------------------------------------------------------
-- INSIDER DETECTION & INTELLIGENCE ENGINE (SPRINT 16)
-- -----------------------------------------------------------------------------

CREATE TYPE relationship_strength AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');
CREATE TYPE insider_category AS ENUM (
  'PRE_LAUNCH_ACCUMULATION', 'CREATOR_LINK', 'TEAM_LINK', 'FUNDING_CLUSTER', 
  'COORDINATED_BUYING', 'COORDINATED_SELLING', 'WALLET_ROTATION', 
  'SUPPLY_CONCENTRATION', 'SUSPICIOUS_TIMING', 'CROSS_TOKEN_PATTERN'
);

CREATE TABLE known_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL UNIQUE,
  chain text NOT NULL,
  label text NOT NULL, -- e.g., 'Exchange', 'Bridge', 'Creator'
  is_excluded_from_clustering boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallet_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_wallet text NOT NULL,
  target_wallet text NOT NULL,
  relationship_type text NOT NULL, -- FUNDED_BY, TRADES_WITH, TRANSFERRED_TO
  strength relationship_strength NOT NULL,
  evidence jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_wallet, target_wallet, relationship_type)
);
CREATE INDEX idx_wallet_rel_source ON wallet_relationships(source_wallet);
CREATE INDEX idx_wallet_rel_target ON wallet_relationships(target_wallet);

CREATE TABLE wallet_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confidence numeric NOT NULL, -- 0-100
  risk_profile text NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
  evidence_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cluster_members (
  cluster_id uuid REFERENCES wallet_clusters(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cluster_id, wallet_address)
);

CREATE TABLE insider_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES tokens(id) ON DELETE CASCADE,
  cluster_id uuid REFERENCES wallet_clusters(id) ON DELETE SET NULL,
  category insider_category NOT NULL,
  confidence numeric NOT NULL, -- 0-100
  time_window text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_insider_signals_token ON insider_signals(token_id);

CREATE TABLE insider_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid REFERENCES insider_signals(id) ON DELETE CASCADE,
  description text NOT NULL,
  weight integer NOT NULL, -- e.g. +28
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- EXITABILITY SCORE ENGINE (SPRINT 17)
-- -----------------------------------------------------------------------------

CREATE TABLE liquidity_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES tokens(id) ON DELETE CASCADE,
  pool_address text NOT NULL,
  dex_name text NOT NULL,
  pool_type text NOT NULL, -- e.g. 'AMM', 'CONCENTRATED', 'BONDING_CURVE'
  total_liquidity_usd numeric NOT NULL DEFAULT 0,
  executable_liquidity_usd numeric NOT NULL DEFAULT 0, -- Liquidity active within ±5%
  is_locked boolean NOT NULL DEFAULT false,
  locked_until timestamptz,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(token_id, pool_address)
);

CREATE TABLE exitability_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES tokens(id) ON DELETE CASCADE,
  score integer NOT NULL, -- 0 to 100
  market_cap_usd numeric NOT NULL,
  total_liquidity_usd numeric NOT NULL,
  executable_liquidity_usd numeric NOT NULL,
  price_impact_10k numeric NOT NULL,
  price_impact_50k numeric NOT NULL,
  stress_score integer NOT NULL, -- Exitability drop under whale pressure
  data_confidence text NOT NULL, -- 'HIGH', 'MEDIUM', 'LOW'
  snapshot_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_exitability_snapshots_token_time ON exitability_snapshots(token_id, snapshot_at DESC);

CREATE TABLE token_restrictions (
  token_id uuid PRIMARY KEY REFERENCES tokens(id) ON DELETE CASCADE,
  can_buy boolean NOT NULL DEFAULT true,
  can_sell boolean NOT NULL DEFAULT true,
  can_transfer boolean NOT NULL DEFAULT true,
  buy_tax_pct numeric NOT NULL DEFAULT 0,
  sell_tax_pct numeric NOT NULL DEFAULT 0,
  is_tax_dynamic boolean NOT NULL DEFAULT false,
  max_sell_amount numeric,
  last_checked_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- PORTFOLIO INTELLIGENCE SYSTEM (SPRINT 18)
-- -----------------------------------------------------------------------------

CREATE TABLE portfolio_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL, -- e.g. 'Trading', 'Long-term'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE TABLE portfolio_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  token_id uuid REFERENCES tokens(id),
  category text NOT NULL, -- 'BUY', 'SELL', 'TRANSFER', 'DEPOSIT', 'WITHDRAWAL', 'AIRDROP', 'REWARD'
  quantity numeric NOT NULL,
  price_usd numeric,
  fees_usd numeric NOT NULL DEFAULT 0,
  gas_usd numeric NOT NULL DEFAULT 0,
  estimated_slippage_usd numeric NOT NULL DEFAULT 0,
  tx_hash text,
  executed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portfolio_transactions_user ON portfolio_transactions(user_id, executed_at DESC);

CREATE TABLE portfolio_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  token_id uuid REFERENCES tokens(id) ON DELETE CASCADE,
  quantity numeric NOT NULL,
  average_cost_usd numeric NOT NULL,
  realized_pnl_usd numeric NOT NULL DEFAULT 0,
  total_fees_paid_usd numeric NOT NULL DEFAULT 0,
  total_gas_paid_usd numeric NOT NULL DEFAULT 0,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, token_id)
);

CREATE TABLE portfolio_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  total_reported_value_usd numeric NOT NULL,
  estimated_executable_value_usd numeric NOT NULL,
  true_net_pnl_usd numeric NOT NULL,
  realized_pnl_usd numeric NOT NULL,
  unrealized_pnl_usd numeric NOT NULL,
  known_costs_usd numeric NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portfolio_snapshots_user ON portfolio_snapshots(user_id, snapshot_at DESC);

-- -----------------------------------------------------------------------------
-- WALLET SYSTEM (SPRINT 19)
-- -----------------------------------------------------------------------------

CREATE TABLE wallet_permissions (
  wallet_id uuid PRIMARY KEY REFERENCES wallets(id) ON DELETE CASCADE,
  wallet_type text NOT NULL DEFAULT 'WATCH_ONLY', -- 'TRADING', 'WATCH_ONLY', 'COPY', 'BOT', 'VAULT'
  can_trade boolean NOT NULL DEFAULT false,
  can_transfer boolean NOT NULL DEFAULT false,
  can_copy_trade boolean NOT NULL DEFAULT false,
  can_use_automation boolean NOT NULL DEFAULT false,
  max_trade_usd numeric,
  daily_limit_usd numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallet_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES wallets(id) ON DELETE CASCADE,
  device_info text,
  ip_address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_sessions_active ON wallet_sessions(wallet_id, is_active);

-- -----------------------------------------------------------------------------
-- ORDER MANAGEMENT SYSTEM (SPRINT 20)
-- -----------------------------------------------------------------------------

CREATE TYPE order_execution_status AS ENUM (
  'DRAFT', 
  'VALIDATING', 
  'QUOTING', 
  'RISK_BLOCKED', 
  'AWAITING_SIGNATURE', 
  'SIGNED', 
  'BROADCASTING', 
  'PENDING', 
  'CONFIRMED', 
  'PARTIALLY_FILLED', 
  'FAILED', 
  'REVERTED', 
  'EXPIRED', 
  'CANCELLED'
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES wallets(id),
  chain_id text NOT NULL DEFAULT 'solana',
  token_in text NOT NULL,
  token_out text NOT NULL,
  side order_side NOT NULL,
  type order_type NOT NULL DEFAULT 'market',
  amount_in numeric NOT NULL,
  expected_out numeric,
  minimum_out numeric,
  slippage_bps integer NOT NULL DEFAULT 100,
  status order_execution_status NOT NULL DEFAULT 'DRAFT',
  transaction_hash text,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_user ON orders(user_id, status);
CREATE INDEX idx_orders_wallet ON orders(wallet_id);

CREATE TABLE order_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  route text[],
  expected_output numeric NOT NULL,
  price_impact_pct numeric NOT NULL,
  network_fee_usd numeric NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_quotes_order ON order_quotes(order_id);

CREATE TABLE order_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  status order_execution_status NOT NULL,
  actual_output numeric,
  fees_paid_usd numeric,
  gas_paid_usd numeric,
  tx_hash text,
  error_reason text,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_executions_order ON order_executions(order_id);

-- -----------------------------------------------------------------------------
-- INTELLIGENT LIMIT ORDERS (SPRINT 21)
-- -----------------------------------------------------------------------------

CREATE TYPE limit_order_status AS ENUM (
  'OPEN',
  'MONITORING',
  'TRIGGERED',
  'WAITING_FOR_SAFETY',
  'EXECUTING',
  'FILLED',
  'PARTIALLY_FILLED',
  'CANCELLED',
  'EXPIRED',
  'INVALID'
);

CREATE TYPE limit_order_health AS ENUM (
  'HEALTHY',
  'WARNING',
  'BLOCKED',
  'INVALID'
);

CREATE TABLE limit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES wallets(id),
  chain_id text NOT NULL DEFAULT 'solana',
  token_in text NOT NULL,
  token_out text NOT NULL,
  side order_side NOT NULL,
  target_price numeric NOT NULL,
  amount_in numeric NOT NULL,
  filled_amount numeric DEFAULT 0,
  slippage_bps integer NOT NULL DEFAULT 100,
  status limit_order_status NOT NULL DEFAULT 'OPEN',
  health limit_order_health NOT NULL DEFAULT 'HEALTHY',
  version integer NOT NULL DEFAULT 1,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_limit_orders_user ON limit_orders(user_id, status);
CREATE INDEX idx_limit_orders_token ON limit_orders(token_in, token_out);

CREATE TABLE limit_order_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_order_id uuid REFERENCES limit_orders(id) ON DELETE CASCADE,
  min_liquidity_usd numeric,
  min_exitability_score integer,
  max_insider_risk_level text, -- 'Low', 'Medium', 'High', 'Critical'
  min_organic_volume_ratio numeric,
  min_creator_rep_score integer,
  max_price_impact_pct numeric DEFAULT 3.0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_limit_order_conditions_order ON limit_order_conditions(limit_order_id);

CREATE TABLE limit_order_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_order_id uuid REFERENCES limit_orders(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES wallets(id),
  token text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'RELEASED', 'CONSUMED'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_limit_order_reservations_wallet ON limit_order_reservations(wallet_id, token, status);

CREATE TABLE limit_order_trigger_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_order_id uuid REFERENCES limit_orders(id) ON DELETE CASCADE,
  trigger_price numeric NOT NULL,
  conditions_passed boolean NOT NULL,
  condition_snapshots jsonb NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE limit_order_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_order_id uuid REFERENCES limit_orders(id) ON DELETE CASCADE,
  version integer NOT NULL,
  target_price numeric NOT NULL,
  amount_in numeric NOT NULL,
  conditions_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- STOP LOSS & TAKE PROFIT ENGINE (SPRINT 22)
-- -----------------------------------------------------------------------------

CREATE TYPE protection_mode AS ENUM (
  'BEST_EXECUTION',
  'BALANCED',
  'EMERGENCY'
);

CREATE TYPE protection_health AS ENUM (
  'HEALTHY',
  'WARNING',
  'BLOCKED',
  'INVALID'
);

CREATE TABLE position_protections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id text NOT NULL, -- Links to position in portfolio
  wallet_id uuid REFERENCES wallets(id),
  token_id text NOT NULL,
  protection_mode protection_mode NOT NULL DEFAULT 'BALANCED',
  health protection_health NOT NULL DEFAULT 'HEALTHY',
  auto_break_even boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_position_protections_pos ON position_protections(position_id);

CREATE TABLE stop_loss_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protection_id uuid REFERENCES position_protections(id) ON DELETE CASCADE,
  stop_type text NOT NULL DEFAULT 'PERCENTAGE', -- 'FIXED', 'PERCENTAGE', 'TRAILING', 'BREAK_EVEN'
  stop_price numeric NOT NULL,
  percentage numeric,
  trail_pct numeric,
  highest_observed_price numeric,
  portion_pct numeric NOT NULL DEFAULT 100.0,
  is_triggered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE take_profit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protection_id uuid REFERENCES position_protections(id) ON DELETE CASCADE,
  tp_level integer NOT NULL DEFAULT 1,
  target_price numeric NOT NULL,
  portion_pct numeric NOT NULL, -- e.g. 25.0 for 25%
  status text NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'EXECUTED', 'CANCELLED'
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE protection_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protection_id uuid REFERENCES position_protections(id) ON DELETE CASCADE,
  trigger_type text NOT NULL, -- 'STOP_LOSS', 'TAKE_PROFIT_1', 'EMERGENCY_EXIT', etc.
  executed_price numeric NOT NULL,
  actual_output numeric NOT NULL,
  gross_pnl_usd numeric NOT NULL,
  net_pnl_usd numeric NOT NULL,
  fees_paid_usd numeric NOT NULL,
  tx_hash text,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE protection_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protection_id uuid REFERENCES position_protections(id) ON DELETE CASCADE,
  version integer NOT NULL,
  config_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);



-- ==========================================
-- SPRINT 23: COPY TRADING & SMART WALLET FOLLOWING
-- ==========================================

CREATE TABLE TrackedWallet (
    id TEXT PRIMARY KEY,
    address TEXT NOT NULL UNIQUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE WalletClassification (
    id TEXT PRIMARY KEY,
    walletId TEXT NOT NULL REFERENCES TrackedWallet(id),
    classification TEXT NOT NULL, -- TRADER, SNIPER, SWING_TRADER, BOT, etc.
    confidence TEXT, -- HIGH, MEDIUM, LOW
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE TraderProfile (
    id TEXT PRIMARY KEY,
    walletId TEXT NOT NULL REFERENCES TrackedWallet(id),
    score INTEGER NOT NULL,
    riskScore INTEGER NOT NULL,
    riskLevel TEXT, -- LOW, MODERATE, HIGH
    tradingStyle TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE TraderMetric (
    id TEXT PRIMARY KEY,
    walletId TEXT NOT NULL REFERENCES TrackedWallet(id),
    period TEXT NOT NULL, -- 24H, 7D, 30D, ALL
    netPnl REAL,
    roi REAL,
    winRate REAL,
    maxDrawdown REAL,
    tradeCount INTEGER,
    avgHoldTime REAL,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE TraderScore (
    id TEXT PRIMARY KEY,
    walletId TEXT NOT NULL REFERENCES TrackedWallet(id),
    performanceScore INTEGER,
    consistencyScore INTEGER,
    riskScore INTEGER,
    executionScore INTEGER,
    tokenSelectionScore INTEGER,
    liquidityDisciplineScore INTEGER,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE TraderTrade (
    id TEXT PRIMARY KEY,
    walletId TEXT NOT NULL REFERENCES TrackedWallet(id),
    tokenId TEXT NOT NULL,
    side TEXT NOT NULL, -- BUY, SELL
    price REAL NOT NULL,
    sizeUsd REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE TraderPosition (
    id TEXT PRIMARY KEY,
    walletId TEXT NOT NULL REFERENCES TrackedWallet(id),
    tokenId TEXT NOT NULL,
    averageEntry REAL,
    sizeUsd REAL,
    unrealizedPnl REAL,
    realizedPnl REAL,
    status TEXT -- OPEN, CLOSED
);

CREATE TABLE TraderStrategy (
    id TEXT PRIMARY KEY,
    walletId TEXT NOT NULL REFERENCES TrackedWallet(id),
    preferredTokens TEXT,
    avgPositionSize REAL,
    maxPositionSize REAL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE CopyStrategy (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    traderWalletId TEXT NOT NULL REFERENCES TrackedWallet(id),
    allocation REAL NOT NULL,
    mode TEXT NOT NULL, -- FIXED, PROPORTIONAL, MULTIPLIER, ALLOCATION
    maxPosition REAL,
    maxDailyLoss REAL,
    maxTokenExposurePercent REAL,
    minExitabilityScore REAL,
    maxSlippage REAL,
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, STOPPED
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE CopyStrategyVersion (
    id TEXT PRIMARY KEY,
    copyStrategyId TEXT NOT NULL REFERENCES CopyStrategy(id),
    versionData TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE CopyAllocation (
    id TEXT PRIMARY KEY,
    copyStrategyId TEXT NOT NULL REFERENCES CopyStrategy(id),
    allocated REAL NOT NULL,
    available REAL NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE CopyTrade (
    id TEXT PRIMARY KEY,
    copyStrategyId TEXT NOT NULL REFERENCES CopyStrategy(id),
    sourceTradeId TEXT NOT NULL REFERENCES TraderTrade(id),
    decision TEXT NOT NULL, -- COPY, COPY_BLOCKED
    reason TEXT,
    executedSizeUsd REAL,
    executedPrice REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE CopyPosition (
    id TEXT PRIMARY KEY,
    copyStrategyId TEXT NOT NULL REFERENCES CopyStrategy(id),
    tokenId TEXT NOT NULL,
    averageEntry REAL,
    sizeUsd REAL,
    status TEXT, -- OPEN, CLOSED
    attribution TEXT, -- COPY, MANUAL
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE CopyDecision (
    id TEXT PRIMARY KEY,
    copyTradeId TEXT REFERENCES CopyTrade(id),
    checksPassed BOOLEAN,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE CopyRiskCheck (
    id TEXT PRIMARY KEY,
    copyTradeId TEXT REFERENCES CopyTrade(id),
    riskType TEXT, -- TOKEN_RISK, LIQUIDITY, EXPOSURE
    passed BOOLEAN,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE CopyExecution (
    id TEXT PRIMARY KEY,
    copyTradeId TEXT REFERENCES CopyTrade(id),
    slippage REAL,
    latencyMs INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE CopyDivergence (
    id TEXT PRIMARY KEY,
    copyStrategyId TEXT NOT NULL REFERENCES CopyStrategy(id),
    tokenId TEXT NOT NULL,
    expectedPositionUsd REAL,
    actualPositionUsd REAL,
    cause TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE CopyAlert (
    id TEXT PRIMARY KEY,
    copyStrategyId TEXT NOT NULL REFERENCES CopyStrategy(id),
    alertType TEXT NOT NULL,
    message TEXT NOT NULL,
    isRead BOOLEAN DEFAULT FALSE,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- SPRINT 24: SMART ALERTS & REAL-TIME INTELLIGENCE
-- ==========================================

CREATE TABLE AlertRule (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    name TEXT,
    category TEXT NOT NULL, -- MARKET, TOKEN, RISK, WALLET, PORTFOLIO, COPY_TRADING
    conditions TEXT NOT NULL, -- JSON string of MultiConditionGroup
    severity TEXT NOT NULL, -- INFO, LOW, MEDIUM, HIGH, CRITICAL
    channels TEXT NOT NULL, -- JSON array of channels
    cooldownMinutes INTEGER DEFAULT 0,
    isEnabled BOOLEAN DEFAULT TRUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE AlertCondition (
    id TEXT PRIMARY KEY,
    ruleId TEXT REFERENCES AlertRule(id),
    field TEXT NOT NULL,
    operator TEXT NOT NULL,
    value TEXT NOT NULL
);

CREATE TABLE AlertEvent (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    ruleId TEXT REFERENCES AlertRule(id),
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    confidence TEXT,
    relevanceScore INTEGER,
    message TEXT NOT NULL,
    evidence TEXT, -- JSON
    snapshot TEXT, -- JSON
    readState TEXT DEFAULT 'UNREAD', -- UNREAD, READ, ACTIONED, DISMISSED
    groupId TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    readAt DATETIME,
    actionedAt DATETIME,
    dismissedAt DATETIME
);

CREATE TABLE AlertFact (
    id TEXT PRIMARY KEY,
    eventId TEXT REFERENCES AlertEvent(id),
    metricName TEXT NOT NULL,
    previousValue TEXT,
    newValue TEXT,
    confidence INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE AlertDelivery (
    id TEXT PRIMARY KEY,
    eventId TEXT REFERENCES AlertEvent(id),
    channel TEXT NOT NULL,
    status TEXT NOT NULL, -- PENDING, SUCCESS, FAILED, RETRY
    attempts INTEGER DEFAULT 0,
    errorMessage TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE AlertPreference (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    channelPreferences TEXT NOT NULL, -- JSON object mapping categories to channels
    quietHoursStart TEXT,
    quietHoursEnd TEXT,
    quietHoursTimezone TEXT,
    overrideCritical BOOLEAN DEFAULT TRUE,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE AlertFeedback (
    id TEXT PRIMARY KEY,
    eventId TEXT REFERENCES AlertEvent(id),
    userId TEXT NOT NULL,
    feedbackType TEXT NOT NULL, -- USEFUL, NOT_USEFUL, TOO_FREQUENT, WRONG
    comments TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE AlertSuppression (
    id TEXT PRIMARY KEY,
    ruleId TEXT REFERENCES AlertRule(id),
    suppressedUntil DATETIME NOT NULL,
    reason TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE AlertCorrelation (
    id TEXT PRIMARY KEY,
    parentEventId TEXT REFERENCES AlertEvent(id),
    childEventId TEXT REFERENCES AlertEvent(id),
    correlationReason TEXT
);

CREATE TABLE AlertSubscription (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    targetType TEXT NOT NULL, -- TOKEN, WALLET, WATCHLIST
    targetId TEXT NOT NULL,
    channels TEXT NOT NULL, -- JSON array
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE AlertTemplate (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    defaultConditions TEXT NOT NULL, -- JSON
    defaultSeverity TEXT NOT NULL
);

-- ==========================================
-- SPRINT 25: ADVANCED EXECUTION & SMART ROUTING
-- ==========================================

CREATE TABLE Execution (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    walletAddress TEXT NOT NULL,
    tokenIn TEXT NOT NULL,
    tokenOut TEXT NOT NULL,
    amountIn TEXT NOT NULL,
    side TEXT NOT NULL, -- BUY, SELL, SWAP
    orderType TEXT NOT NULL, -- LIMIT, STOP, MARKET
    executionPolicy TEXT NOT NULL, -- BEST_PRICE, FASTEST, PROTECTED, etc.
    status TEXT NOT NULL, -- CREATED, SIMULATING, READY, SUBMITTED, CONFIRMED, FAILED
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ExecutionQuote (
    id TEXT PRIMARY KEY,
    executionId TEXT REFERENCES Execution(id),
    dexVenue TEXT NOT NULL,
    expectedOutput TEXT NOT NULL,
    priceImpact DECIMAL NOT NULL,
    gasEstimate TEXT NOT NULL,
    mevRisk TEXT NOT NULL, -- LOW, MEDIUM, HIGH
    executionScore INTEGER,
    expiresAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ExecutionRoute (
    id TEXT PRIMARY KEY,
    quoteId TEXT REFERENCES ExecutionQuote(id),
    hops INTEGER NOT NULL,
    splitPercentage DECIMAL NOT NULL
);

CREATE TABLE ExecutionLeg (
    id TEXT PRIMARY KEY,
    routeId TEXT REFERENCES ExecutionRoute(id),
    legIndex INTEGER NOT NULL,
    tokenIn TEXT NOT NULL,
    tokenOut TEXT NOT NULL,
    poolAddress TEXT NOT NULL,
    dexVenue TEXT NOT NULL
);

CREATE TABLE TransactionSimulation (
    id TEXT PRIMARY KEY,
    executionId TEXT REFERENCES Execution(id),
    willRevert BOOLEAN NOT NULL,
    expectedTokenOutput TEXT,
    estimatedGasUsage TEXT,
    warnings TEXT, -- JSON
    simulatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE TransactionAttempt (
    id TEXT PRIMARY KEY,
    executionId TEXT REFERENCES Execution(id),
    txHash TEXT,
    nonce INTEGER,
    priorityFee TEXT,
    baseFee TEXT,
    status TEXT NOT NULL, -- PENDING, CONFIRMED, FAILED, REPLACED
    errorMessage TEXT,
    submittedAt DATETIME,
    confirmedAt DATETIME
);

CREATE TABLE ExecutionFill (
    id TEXT PRIMARY KEY,
    executionId TEXT REFERENCES Execution(id),
    actualOutput TEXT NOT NULL,
    actualGasCost TEXT NOT NULL,
    actualPriceImpact DECIMAL,
    actualSlippage DECIMAL,
    executionQualityScore INTEGER,
    reconciledAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE DEXVenue (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    adapterIdentifier TEXT NOT NULL,
    isActive BOOLEAN DEFAULT TRUE
);

CREATE TABLE DEXHealth (
    id TEXT PRIMARY KEY,
    dexId TEXT REFERENCES DEXVenue(id),
    latencyMs INTEGER,
    failureRate DECIMAL,
    liquidityAvailabilityScore INTEGER,
    recordedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- SPRINT 26: TOKEN LAUNCHPAD
-- ==========================================

CREATE TABLE Launch (
    id TEXT PRIMARY KEY,
    creatorId TEXT NOT NULL,
    tokenId TEXT,
    launchMode TEXT NOT NULL, -- FAIR, BONDING_CURVE, SCHEDULED
    state TEXT NOT NULL, -- CREATED, DEPLOYED, LIVE, GRADUATING, GRADUATED, PAUSED, CANCELLED
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE LaunchConfig (
    launchId TEXT PRIMARY KEY REFERENCES Launch(id),
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    description TEXT,
    logoUrl TEXT,
    websiteUrl TEXT,
    totalSupply TEXT NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 18,
    isLocked BOOLEAN DEFAULT FALSE
);

CREATE TABLE CreatorAllocation (
    id TEXT PRIMARY KEY,
    launchId TEXT REFERENCES Launch(id),
    walletAddress TEXT NOT NULL,
    amount TEXT NOT NULL,
    percentage DECIMAL NOT NULL,
    isVested BOOLEAN DEFAULT FALSE
);

CREATE TABLE VestingSchedule (
    allocationId TEXT PRIMARY KEY REFERENCES CreatorAllocation(id),
    cliffDays INTEGER,
    vestingDays INTEGER,
    nextUnlockAt DATETIME,
    amountUnlocked TEXT DEFAULT '0'
);

CREATE TABLE LaunchRisk (
    launchId TEXT PRIMARY KEY REFERENCES Launch(id),
    overallScore INTEGER NOT NULL,
    riskLevel TEXT NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
    effectiveOwnershipPercentage DECIMAL,
    walletClusteringScore INTEGER,
    creatorReputationScore INTEGER,
    liquidityCommitmentScore INTEGER,
    primaryConcern TEXT,
    calculatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE LaunchIntegrity (
    launchId TEXT PRIMARY KEY REFERENCES Launch(id),
    integrityScore INTEGER NOT NULL,
    fairnessScore INTEGER,
    transparencyScore INTEGER,
    insiderActivityScore INTEGER,
    contractSafetyScore INTEGER,
    evaluatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE BondingCurveState (
    launchId TEXT PRIMARY KEY REFERENCES Launch(id),
    currentPrice TEXT NOT NULL,
    circulatingSupply TEXT NOT NULL,
    reserveBalance TEXT NOT NULL,
    marketCap TEXT NOT NULL,
    graduationTarget TEXT NOT NULL,
    buyFeePercentage DECIMAL NOT NULL,
    sellFeePercentage DECIMAL NOT NULL,
    protocolFeePercentage DECIMAL NOT NULL,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE LiquidityPosition (
    id TEXT PRIMARY KEY,
    launchId TEXT REFERENCES Launch(id),
    amount TEXT NOT NULL,
    isLocked BOOLEAN DEFAULT TRUE,
    lockedUntil DATETIME,
    ownerAddress TEXT NOT NULL
);

CREATE TABLE Graduation (
    id TEXT PRIMARY KEY,
    launchId TEXT REFERENCES Launch(id),
    targetMetAt DATETIME,
    status TEXT NOT NULL, -- PREPARING, MIGRATING, COMPLETED, FAILED
    migratedLiquidity TEXT,
    dexPoolAddress TEXT
);

CREATE TABLE LaunchParticipant (
    id TEXT PRIMARY KEY,
    launchId TEXT REFERENCES Launch(id),
    walletAddress TEXT NOT NULL,
    totalBought TEXT DEFAULT '0',
    totalSold TEXT DEFAULT '0',
    currentHolding TEXT DEFAULT '0',
    firstParticipatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE LaunchEvent (
    id TEXT PRIMARY KEY,
    launchId TEXT REFERENCES Launch(id),
    eventType TEXT NOT NULL, -- BUY, SELL, RISK_CHANGED, GRADUATED
    eventData TEXT, -- JSON
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- SPRINT 27: REPUTATION & TRUST LAYER
-- ==========================================

CREATE TABLE ReputationProfile (
    entityId TEXT PRIMARY KEY,
    entityType TEXT NOT NULL, -- CREATOR, WALLET, TOKEN, LAUNCH
    overallScore INTEGER, -- Nullable if insufficient history
    confidenceLevel TEXT NOT NULL, -- LOW, MODERATE, HIGH
    reputationCategory TEXT NOT NULL, -- UNKNOWN, NEW, LOW, MODERATE, GOOD, HIGH, EXCELLENT
    version TEXT NOT NULL DEFAULT '1.0.0',
    lastCalculatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ReputationDimension (
    entityId TEXT REFERENCES ReputationProfile(entityId),
    dimension TEXT NOT NULL, -- INTEGRITY, RELIABILITY, TRANSPARENCY, LONGEVITY, MARKET_BEHAVIOR
    score INTEGER NOT NULL,
    PRIMARY KEY (entityId, dimension)
);

CREATE TABLE ReputationSnapshot (
    id TEXT PRIMARY KEY,
    entityId TEXT REFERENCES ReputationProfile(entityId),
    snapshotDate DATE NOT NULL,
    overallScore INTEGER,
    confidenceLevel TEXT,
    reputationCategory TEXT
);

CREATE TABLE ReputationEvent (
    id TEXT PRIMARY KEY,
    entityId TEXT REFERENCES ReputationProfile(entityId),
    eventType TEXT NOT NULL, -- LIQUIDITY_REMOVAL, SUCCESSFUL_LAUNCH, FAILED_LAUNCH, WASH_TRADING, EXPLOIT
    impact INTEGER NOT NULL, -- e.g., -14, +5
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    evidenceId TEXT
);

CREATE TABLE ReputationEvidence (
    id TEXT PRIMARY KEY,
    entityId TEXT REFERENCES ReputationProfile(entityId),
    claim TEXT NOT NULL,
    source TEXT NOT NULL,
    confidenceScore INTEGER NOT NULL,
    evidenceData TEXT, -- JSON
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE EntityRelationship (
    id TEXT PRIMARY KEY,
    sourceEntityId TEXT NOT NULL,
    sourceEntityType TEXT NOT NULL,
    targetEntityId TEXT NOT NULL,
    targetEntityType TEXT NOT NULL,
    relationshipType TEXT NOT NULL, -- OWNS, FUNDED_BY, DEPLOYED, TRADED, ASSOCIATED_WITH
    confidenceScore INTEGER NOT NULL,
    discoveredAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE RelationshipEvidence (
    id TEXT PRIMARY KEY,
    relationshipId TEXT REFERENCES EntityRelationship(id),
    evidenceType TEXT NOT NULL, -- SHARED_FUNDING, TIMING, INFRASTRUCTURE
    description TEXT NOT NULL
);

CREATE TABLE TrustCluster (
    id TEXT PRIMARY KEY,
    clusterType TEXT NOT NULL, -- SYBIL_FARM, RELATED_WALLETS
    confidenceScore INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE TrustClusterMember (
    clusterId TEXT REFERENCES TrustCluster(id),
    entityId TEXT NOT NULL,
    PRIMARY KEY (clusterId, entityId)
);

CREATE TABLE TrustBadge (
    id TEXT PRIMARY KEY,
    entityId TEXT REFERENCES ReputationProfile(entityId),
    badgeType TEXT NOT NULL, -- ESTABLISHED_CREATOR, VERIFIED_CONTRACT, HIGH_INSIDER_RISK
    grantedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE TrustBadgeRule (
    badgeType TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    version TEXT NOT NULL
);

CREATE TABLE Appeal (
    id TEXT PRIMARY KEY,
    entityId TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL, -- PENDING, REVIEWING, RESOLVED, REJECTED
    evidenceSubmitted TEXT, -- JSON
    submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Review (
    id TEXT PRIMARY KEY,
    appealId TEXT REFERENCES Appeal(id),
    adminId TEXT NOT NULL,
    actionTaken TEXT NOT NULL,
    justification TEXT NOT NULL,
    reviewedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SPRINT 37: AI INTELLIGENCE LAYER & SYSTEM ENGINE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_features (
    feature_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    model_category TEXT NOT NULL, -- FAST_MODEL, REASONING_MODEL, EMBEDDING_MODEL, CLASSIFICATION_MODEL, SPECIALIZED_MODEL
    model_policy TEXT NOT NULL,
    max_latency_ms INTEGER NOT NULL DEFAULT 2000,
    max_cost_usd NUMERIC(8, 5) NOT NULL DEFAULT 0.01,
    max_tokens INTEGER NOT NULL DEFAULT 500,
    cache_ttl_seconds INTEGER NOT NULL DEFAULT 300,
    priority TEXT NOT NULL DEFAULT 'P1_RISK_EXPLANATION',
    enabled BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_evaluation_golden_dataset (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL, -- KNOWN_SAFE, KNOWN_RISKY, KNOWN_INSIDER, KNOWN_LIQUIDITY_DRAIN, KNOWN_ANOMALY
    title TEXT NOT NULL,
    input_evidence_json TEXT NOT NULL,
    expected_risk_level TEXT NOT NULL,
    required_warning_keywords TEXT, -- JSON array
    forbidden_hallucinations TEXT, -- JSON array
    min_grounding_score NUMERIC(3, 2) NOT NULL DEFAULT 0.85,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_evaluation_runs (
    id TEXT PRIMARY KEY,
    model_version TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    total_cases INTEGER NOT NULL,
    passed_cases INTEGER NOT NULL,
    average_grounding_score NUMERIC(3, 2) NOT NULL,
    hallucination_rate_pct NUMERIC(5, 2) NOT NULL,
    average_latency_ms INTEGER NOT NULL,
    total_cost_usd NUMERIC(8, 5) NOT NULL,
    status TEXT NOT NULL, -- PASSED, REGRESSION_DETECTED, FAILED
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_token_reports (
    id TEXT PRIMARY KEY,
    token_address TEXT NOT NULL,
    data_snapshot_hash TEXT NOT NULL,
    overall_risk_level TEXT NOT NULL,
    report_json TEXT NOT NULL,
    model_version TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    invalidated_at DATETIME,
    UNIQUE(token_address, data_snapshot_hash)
);

CREATE TABLE IF NOT EXISTS ai_custom_risk_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    profile_type TEXT NOT NULL DEFAULT 'BALANCED', -- CONSERVATIVE, BALANCED, AGGRESSIVE, CUSTOM
    min_exitability_score INTEGER NOT NULL DEFAULT 50,
    max_insider_concentration_pct INTEGER NOT NULL DEFAULT 40,
    max_top10_holder_pct INTEGER NOT NULL DEFAULT 45,
    max_price_impact_pct NUMERIC(4, 2) NOT NULL DEFAULT 6.0,
    require_mint_revoked BOOLEAN NOT NULL DEFAULT 1,
    custom_rules_json TEXT NOT NULL DEFAULT '[]',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_trade_journals (
    id TEXT PRIMARY KEY,
    trade_id TEXT NOT NULL,
CREATE TABLE LaunchEvent (
    id TEXT PRIMARY KEY,
    launchId TEXT REFERENCES Launch(id),
    eventType TEXT NOT NULL, -- BUY, SELL, RISK_CHANGED, GRADUATED
    eventData TEXT, -- JSON
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- SPRINT 27: REPUTATION & TRUST LAYER
-- ==========================================

CREATE TABLE ReputationProfile (
    entityId TEXT PRIMARY KEY,
    entityType TEXT NOT NULL, -- CREATOR, WALLET, TOKEN, LAUNCH
    overallScore INTEGER, -- Nullable if insufficient history
    confidenceLevel TEXT NOT NULL, -- LOW, MODERATE, HIGH
    reputationCategory TEXT NOT NULL, -- UNKNOWN, NEW, LOW, MODERATE, GOOD, HIGH, EXCELLENT
    version TEXT NOT NULL DEFAULT '1.0.0',
    lastCalculatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ReputationDimension (
    entityId TEXT REFERENCES ReputationProfile(entityId),
    dimension TEXT NOT NULL, -- INTEGRITY, RELIABILITY, TRANSPARENCY, LONGEVITY, MARKET_BEHAVIOR
    score INTEGER NOT NULL,
    PRIMARY KEY (entityId, dimension)
);

CREATE TABLE ReputationSnapshot (
    id TEXT PRIMARY KEY,
    entityId TEXT REFERENCES ReputationProfile(entityId),
    snapshotDate DATE NOT NULL,
    overallScore INTEGER,
    confidenceLevel TEXT,
    reputationCategory TEXT
);

CREATE TABLE ReputationEvent (
    id TEXT PRIMARY KEY,
    entityId TEXT REFERENCES ReputationProfile(entityId),
    eventType TEXT NOT NULL, -- LIQUIDITY_REMOVAL, SUCCESSFUL_LAUNCH, FAILED_LAUNCH, WASH_TRADING, EXPLOIT
    impact INTEGER NOT NULL, -- e.g., -14, +5
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    evidenceId TEXT
);

CREATE TABLE ReputationEvidence (
    id TEXT PRIMARY KEY,
    entityId TEXT REFERENCES ReputationProfile(entityId),
    claim TEXT NOT NULL,
    source TEXT NOT NULL,
    confidenceScore INTEGER NOT NULL,
    evidenceData TEXT, -- JSON
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE EntityRelationship (
    id TEXT PRIMARY KEY,
    sourceEntityId TEXT NOT NULL,
    sourceEntityType TEXT NOT NULL,
    targetEntityId TEXT NOT NULL,
    targetEntityType TEXT NOT NULL,
    relationshipType TEXT NOT NULL, -- OWNS, FUNDED_BY, DEPLOYED, TRADED, ASSOCIATED_WITH
    confidenceScore INTEGER NOT NULL,
    discoveredAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE RelationshipEvidence (
    id TEXT PRIMARY KEY,
    relationshipId TEXT REFERENCES EntityRelationship(id),
    evidenceType TEXT NOT NULL, -- SHARED_FUNDING, TIMING, INFRASTRUCTURE
    description TEXT NOT NULL
);

CREATE TABLE TrustCluster (
    id TEXT PRIMARY KEY,
    clusterType TEXT NOT NULL, -- SYBIL_FARM, RELATED_WALLETS
    confidenceScore INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE TrustClusterMember (
    clusterId TEXT REFERENCES TrustCluster(id),
    entityId TEXT NOT NULL,
    PRIMARY KEY (clusterId, entityId)
);

CREATE TABLE TrustBadge (
    id TEXT PRIMARY KEY,
    entityId TEXT REFERENCES ReputationProfile(entityId),
    badgeType TEXT NOT NULL, -- ESTABLISHED_CREATOR, VERIFIED_CONTRACT, HIGH_INSIDER_RISK
    grantedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE TrustBadgeRule (
    badgeType TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    version TEXT NOT NULL
);

CREATE TABLE Appeal (
    id TEXT PRIMARY KEY,
    entityId TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL, -- PENDING, REVIEWING, RESOLVED, REJECTED
    evidenceSubmitted TEXT, -- JSON
    submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Review (
    id TEXT PRIMARY KEY,
    appealId TEXT REFERENCES Appeal(id),
    adminId TEXT NOT NULL,
    actionTaken TEXT NOT NULL,
    justification TEXT NOT NULL,
    reviewedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SPRINT 37: AI INTELLIGENCE LAYER & SYSTEM ENGINE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_features (
    feature_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    model_category TEXT NOT NULL, -- FAST_MODEL, REASONING_MODEL, EMBEDDING_MODEL, CLASSIFICATION_MODEL, SPECIALIZED_MODEL
    model_policy TEXT NOT NULL,
    max_latency_ms INTEGER NOT NULL DEFAULT 2000,
    max_cost_usd NUMERIC(8, 5) NOT NULL DEFAULT 0.01,
    max_tokens INTEGER NOT NULL DEFAULT 500,
    cache_ttl_seconds INTEGER NOT NULL DEFAULT 300,
    priority TEXT NOT NULL DEFAULT 'P1_RISK_EXPLANATION',
    enabled BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_evaluation_golden_dataset (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL, -- KNOWN_SAFE, KNOWN_RISKY, KNOWN_INSIDER, KNOWN_LIQUIDITY_DRAIN, KNOWN_ANOMALY
    title TEXT NOT NULL,
    input_evidence_json TEXT NOT NULL,
    expected_risk_level TEXT NOT NULL,
    required_warning_keywords TEXT, -- JSON array
    forbidden_hallucinations TEXT, -- JSON array
    min_grounding_score NUMERIC(3, 2) NOT NULL DEFAULT 0.85,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_evaluation_runs (
    id TEXT PRIMARY KEY,
    model_version TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    total_cases INTEGER NOT NULL,
    passed_cases INTEGER NOT NULL,
    average_grounding_score NUMERIC(3, 2) NOT NULL,
    hallucination_rate_pct NUMERIC(5, 2) NOT NULL,
    average_latency_ms INTEGER NOT NULL,
    total_cost_usd NUMERIC(8, 5) NOT NULL,
    status TEXT NOT NULL, -- PASSED, REGRESSION_DETECTED, FAILED
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_token_reports (
    id TEXT PRIMARY KEY,
    token_address TEXT NOT NULL,
    data_snapshot_hash TEXT NOT NULL,
    overall_risk_level TEXT NOT NULL,
    report_json TEXT NOT NULL,
    model_version TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    invalidated_at DATETIME,
    UNIQUE(token_address, data_snapshot_hash)
);

CREATE TABLE IF NOT EXISTS ai_custom_risk_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    profile_type TEXT NOT NULL DEFAULT 'BALANCED', -- CONSERVATIVE, BALANCED, AGGRESSIVE, CUSTOM
    min_exitability_score INTEGER NOT NULL DEFAULT 50,
    max_insider_concentration_pct INTEGER NOT NULL DEFAULT 40,
    max_top10_holder_pct INTEGER NOT NULL DEFAULT 45,
    max_price_impact_pct NUMERIC(4, 2) NOT NULL DEFAULT 6.0,
    require_mint_revoked BOOLEAN NOT NULL DEFAULT 1,
    custom_rules_json TEXT NOT NULL DEFAULT '[]',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_trade_journals (
    id TEXT PRIMARY KEY,
    trade_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    token_symbol TEXT NOT NULL,
    entry_price_usd NUMERIC(16, 8) NOT NULL,
    exit_price_usd NUMERIC(16, 8) NOT NULL,
    pnl_pct NUMERIC(8, 2) NOT NULL,
    net_pnl_usd NUMERIC(12, 2) NOT NULL,
    fees_paid_usd NUMERIC(10, 2) NOT NULL,
    hold_duration_minutes INTEGER NOT NULL,
    review_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_usage_metrics (
    id TEXT PRIMARY KEY,
    feature_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    tokens_consumed INTEGER NOT NULL,
    estimated_cost_usd NUMERIC(8, 5) NOT NULL,
    latency_ms INTEGER NOT NULL,
    cached BOOLEAN NOT NULL DEFAULT 0,
    grounding_score NUMERIC(3, 2) NOT NULL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Sprint 38 — Analytics & Data Intelligence Platform Schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_volume_snapshots (
    id TEXT PRIMARY KEY,
    token_address TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    total_volume_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    buy_volume_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    sell_volume_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    organic_volume_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    suspected_wash_volume_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    organic_score INTEGER NOT NULL DEFAULT 50,
    wash_trading_probability_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
    snapshot_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_wash_trading_events (
    id TEXT PRIMARY KEY,
    token_address TEXT NOT NULL,
    pattern_type TEXT NOT NULL,
    participating_wallets TEXT NOT NULL DEFAULT '[]',
    estimated_wash_volume_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    confidence_score INTEGER NOT NULL DEFAULT 80,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_wallet_profiles (
    wallet_address TEXT PRIMARY KEY,
    total_trades INTEGER NOT NULL DEFAULT 0,
    tokens_interacted INTEGER NOT NULL DEFAULT 0,
    win_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 50,
    realized_pnl_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    average_holding_duration_minutes INTEGER NOT NULL DEFAULT 0,
    average_entry_latency_minutes INTEGER NOT NULL DEFAULT 0,
    primary_classification TEXT NOT NULL DEFAULT 'MOMENTUM_TRADER',
    cluster_id TEXT,
    is_smart_money BOOLEAN NOT NULL DEFAULT 0,
    smart_money_alpha_score INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_creator_outcomes (
    creator_address TEXT PRIMARY KEY,
    reputation_score INTEGER NOT NULL DEFAULT 50,
    total_launches INTEGER NOT NULL DEFAULT 0,
    successful_launches INTEGER NOT NULL DEFAULT 0,
    failed_launches INTEGER NOT NULL DEFAULT 0,
    liquidity_drain_incidents INTEGER NOT NULL DEFAULT 0,
    median_peak_market_cap_usd NUMERIC(20, 4) NOT NULL DEFAULT 0,
    outcomes_by_horizon TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'MODERATE_RISK',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_backtest_runs (
    run_id TEXT PRIMARY KEY,
    signal_name TEXT NOT NULL,
    total_signals_triggered INTEGER NOT NULL DEFAULT 0,
    win_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
    average_profit_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
    profit_factor NUMERIC(6, 2) NOT NULL DEFAULT 0,
    max_drawdown_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
    no_look_ahead_verified BOOLEAN NOT NULL DEFAULT 1,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Sprint 39 — Admin Dashboard & Platform Operations Schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_permissions (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS admin_user_assignments (
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    assigned_by TEXT NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    geo_location TEXT,
    user_agent TEXT,
    mfa_verified BOOLEAN NOT NULL DEFAULT 0,
    last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id TEXT PRIMARY KEY,
    sequence_num INTEGER PRIMARY KEY AUTOINCREMENT,
    previous_hash TEXT NOT NULL,
    event_hash TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    domain TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    reason TEXT NOT NULL,
    ip_address TEXT,
    geo_location TEXT,
    user_agent TEXT,
    session_id TEXT,
    changes_before TEXT,
    changes_after TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_dual_approvals (
    id TEXT PRIMARY KEY,
    action_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    approved_by TEXT,
    approved_at DATETIME,
    rejection_reason TEXT,
    expires_at DATETIME NOT NULL,
    executed_at DATETIME
);

CREATE TABLE IF NOT EXISTS admin_emergency_state (
    id TEXT PRIMARY KEY DEFAULT 'primary',
    mode TEXT NOT NULL DEFAULT 'NORMAL',
    pause_new_trades BOOLEAN NOT NULL DEFAULT 0,
    pause_withdrawals BOOLEAN NOT NULL DEFAULT 0,
    pause_copy_trading BOOLEAN NOT NULL DEFAULT 0,
    pause_launchpad BOOLEAN NOT NULL DEFAULT 0,
    disabled_chains TEXT NOT NULL DEFAULT '[]',
    disabled_routers TEXT NOT NULL DEFAULT '[]',
    circuit_breakers TEXT NOT NULL DEFAULT '{}',
    updated_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_investigations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM',
    status TEXT NOT NULL DEFAULT 'OPEN',
    assigned_to TEXT,
    ai_summary TEXT,
    evidence_links TEXT NOT NULL DEFAULT '[]',
    timeline TEXT NOT NULL DEFAULT '[]',
    admin_notes TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_security_incidents (
    id TEXT PRIMARY KEY,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    affected_systems TEXT NOT NULL DEFAULT '[]',
    affected_users_count INTEGER NOT NULL DEFAULT 0,
    timeline TEXT NOT NULL DEFAULT '[]',
    evidence TEXT NOT NULL DEFAULT '[]',
    mitigation_steps TEXT NOT NULL DEFAULT '[]',
    assigned_team TEXT,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_feature_flags (
    flag_key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT 0,
    rollout_pct INTEGER NOT NULL DEFAULT 0,
    target_roles TEXT NOT NULL DEFAULT '[]',
    target_users TEXT NOT NULL DEFAULT '[]',
    target_regions TEXT NOT NULL DEFAULT '[]',
    updated_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_config_settings (
    config_key TEXT PRIMARY KEY,
    config_group TEXT NOT NULL,
    value_json TEXT NOT NULL,
    previous_value_json TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    is_dangerous BOOLEAN NOT NULL DEFAULT 0,
    updated_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_risk_overrides (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    override_rules TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_abuse_reports (
    id TEXT PRIMARY KEY,
    reporter_wallet TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    category TEXT NOT NULL,
    evidence_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'PENDING',
    resolution TEXT,
    reviewed_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_support_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    wallet_address TEXT,
    category TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'MEDIUM',
    status TEXT NOT NULL DEFAULT 'OPEN',
    subject TEXT NOT NULL,
    description TEXT,
    internal_notes TEXT NOT NULL DEFAULT '[]',
    assigned_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Sprint 45 — Canonical Market Data Engine & Token Discovery Schema
-- Multi-Market Architecture, Reserves, Swaps, OHLCV Candles, Snapshots & Rankings
-- ============================================================================

CREATE TABLE IF NOT EXISTS markets (
    id VARCHAR(64) PRIMARY KEY,
    chain_id VARCHAR(32) NOT NULL,
    protocol VARCHAR(64) NOT NULL,
    market_type VARCHAR(32) NOT NULL DEFAULT 'CPMM',
    address VARCHAR(128) NOT NULL,
    base_token_id VARCHAR(128) NOT NULL,
    quote_token_id VARCHAR(128) NOT NULL,
    fee_bps INTEGER NOT NULL DEFAULT 25,
    status VARCHAR(32) NOT NULL DEFAULT 'DISCOVERED',
    source VARCHAR(32) NOT NULL DEFAULT 'ONCHAIN',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_market_identity UNIQUE (chain_id, protocol, address)
);

CREATE INDEX IF NOT EXISTS idx_markets_identity ON markets (chain_id, protocol, address);
CREATE INDEX IF NOT EXISTS idx_markets_base_token ON markets (base_token_id);
CREATE INDEX IF NOT EXISTS idx_markets_quote_token ON markets (quote_token_id);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets (status);

CREATE TABLE IF NOT EXISTS market_reserves (
    id VARCHAR(64) PRIMARY KEY,
    market_id VARCHAR(64) NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    base_reserve NUMERIC(38, 18) NOT NULL DEFAULT 0,
    quote_reserve NUMERIC(38, 18) NOT NULL DEFAULT 0,
    base_price_usd NUMERIC(24, 8) NOT NULL DEFAULT 0,
    quote_price_usd NUMERIC(24, 8) NOT NULL DEFAULT 0,
    liquidity_usd NUMERIC(24, 4) NOT NULL DEFAULT 0,
    slot_or_block BIGINT NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_reserves_market ON market_reserves (market_id);

CREATE TABLE IF NOT EXISTS market_swaps (
    id VARCHAR(128) PRIMARY KEY,
    market_id VARCHAR(64) NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    tx_hash VARCHAR(128) NOT NULL,
    sender_wallet VARCHAR(128) NOT NULL,
    side VARCHAR(8) NOT NULL,
    base_amount NUMERIC(38, 18) NOT NULL,
    quote_amount NUMERIC(38, 18) NOT NULL,
    price_usd NUMERIC(24, 8) NOT NULL,
    volume_usd NUMERIC(24, 4) NOT NULL,
    slot_or_block BIGINT NOT NULL,
    timestamp DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_swaps_market_time ON market_swaps (market_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_swaps_tx ON market_swaps (tx_hash);

CREATE TABLE IF NOT EXISTS ohlcv_candles (
    id VARCHAR(128) PRIMARY KEY,
    market_id VARCHAR(64) NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    interval VARCHAR(8) NOT NULL,
    timestamp BIGINT NOT NULL,
    open NUMERIC(24, 8) NOT NULL,
    high NUMERIC(24, 8) NOT NULL,
    low NUMERIC(24, 8) NOT NULL,
    close NUMERIC(24, 8) NOT NULL,
    volume_usd NUMERIC(24, 4) NOT NULL DEFAULT 0,
    trade_count INTEGER NOT NULL DEFAULT 0,
    is_final BOOLEAN NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ohlcv_lookup ON ohlcv_candles (market_id, interval, timestamp DESC);

CREATE TABLE IF NOT EXISTS market_snapshots (
    id VARCHAR(64) PRIMARY KEY,
    market_id VARCHAR(64) NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    price_usd NUMERIC(24, 8) NOT NULL,
    volume_24h_usd NUMERIC(24, 4) NOT NULL DEFAULT 0,
    liquidity_usd NUMERIC(24, 4) NOT NULL DEFAULT 0,
    price_change_24h NUMERIC(10, 4) NOT NULL DEFAULT 0,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_market_ts ON market_snapshots (market_id, timestamp DESC);

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
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_token_snapshots_token_ts ON token_market_snapshots (token_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS token_supplies (
    token_id VARCHAR(128) PRIMARY KEY,
    total_supply NUMERIC(38, 18) NOT NULL,
    circulating_supply NUMERIC(38, 18) NOT NULL,
    max_supply NUMERIC(38, 18),
    supply_confidence NUMERIC(4, 3) NOT NULL DEFAULT 1.0,
    source VARCHAR(32) NOT NULL DEFAULT 'ONCHAIN_RPC',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS token_rankings_cache (
    category VARCHAR(32) NOT NULL,
    timeframe VARCHAR(8) NOT NULL DEFAULT '24h',
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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (category, timeframe, rank)
);

CREATE INDEX IF NOT EXISTS idx_token_rankings ON token_rankings_cache (category, timeframe, rank);

CREATE TABLE IF NOT EXISTS market_data_quality_logs (
    id VARCHAR(64) PRIMARY KEY,
    token_id VARCHAR(128) NOT NULL,
    quality_score INTEGER NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL,
    divergence_status VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
    anomalies_json TEXT NOT NULL DEFAULT '[]',
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quality_logs_token ON market_data_quality_logs (token_id, checked_at DESC);

-- Sprint 44: Blockchain Ingestion Engine, Normalization & Discovery
CREATE TABLE IF NOT EXISTS indexer_state (
  chain_id text PRIMARY KEY,
  current_block bigint NOT NULL DEFAULT 0,
  target_block bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'IDLE',
  sync_mode text NOT NULL DEFAULT 'START_FROM_LATEST',
  last_successful_sync timestamptz NOT NULL DEFAULT now(),
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blockchain_blocks (
  id text PRIMARY KEY,
  chain_id text NOT NULL,
  number bigint NOT NULL,
  hash text NOT NULL,
  parent_hash text NOT NULL,
  timestamp bigint NOT NULL,
  status text NOT NULL DEFAULT 'CANONICAL',
  finality text NOT NULL DEFAULT 'CONFIRMED',
  transaction_count int NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_block_chain_num_hash UNIQUE (chain_id, number, hash)
);

CREATE INDEX IF NOT EXISTS idx_blocks_chain_number ON blockchain_blocks (chain_id, number DESC);
CREATE INDEX IF NOT EXISTS idx_blocks_chain_hash ON blockchain_blocks (chain_id, hash);

CREATE TABLE IF NOT EXISTS normalized_transactions (
  id text PRIMARY KEY,
  chain_id text NOT NULL,
  hash text NOT NULL,
  block_number bigint NOT NULL,
  block_hash text NOT NULL,
  from_address text NOT NULL,
  to_address text,
  value_raw text NOT NULL DEFAULT '0',
  value_formatted numeric(36, 18) NOT NULL DEFAULT 0,
  fee numeric(24, 12) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'SUCCESS',
  finality text NOT NULL DEFAULT 'CONFIRMED',
  timestamp bigint NOT NULL,
  classification jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_tx_chain_hash UNIQUE (chain_id, hash)
);

CREATE INDEX IF NOT EXISTS idx_norm_tx_chain_block ON normalized_transactions (chain_id, block_number DESC);
CREATE INDEX IF NOT EXISTS idx_norm_tx_from ON normalized_transactions (from_address);
CREATE INDEX IF NOT EXISTS idx_norm_tx_to ON normalized_transactions (to_address);

CREATE TABLE IF NOT EXISTS normalized_events (
  id text PRIMARY KEY,
  chain_id text NOT NULL,
  transaction_hash text NOT NULL,
  block_number bigint NOT NULL,
  event_type text NOT NULL,
  contract_address text NOT NULL,
  address text NOT NULL,
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  data text NOT NULL DEFAULT '',
  log_index int NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_tx_log_idx UNIQUE (transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_norm_evt_contract ON normalized_events (chain_id, contract_address);
CREATE INDEX IF NOT EXISTS idx_norm_evt_type ON normalized_events (event_type);

CREATE TABLE IF NOT EXISTS token_discovery_registry (
  id text PRIMARY KEY,
  address text NOT NULL,
  chain_id text NOT NULL,
  symbol text NOT NULL,
  name text NOT NULL,
  decimals int NOT NULL DEFAULT 6,
  total_supply text,
  status text NOT NULL DEFAULT 'DISCOVERED',
  source text NOT NULL DEFAULT 'onchain',
  metadata_status text NOT NULL DEFAULT 'PENDING',
  last_attempt bigint,
  error text,
  discovered_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  CONSTRAINT uq_token_chain_addr UNIQUE (chain_id, address)
);

CREATE INDEX IF NOT EXISTS idx_token_discovery_status ON token_discovery_registry (chain_id, status);

CREATE TABLE IF NOT EXISTS discovered_markets (
  id text PRIMARY KEY,
  chain_id text NOT NULL,
  address text NOT NULL,
  protocol text NOT NULL,
  base_token_address text NOT NULL,
  quote_token_address text NOT NULL,
  liquidity_usd numeric(24, 6) NOT NULL DEFAULT 0,
  reserve_base numeric(36, 18) NOT NULL DEFAULT 0,
  reserve_quote numeric(36, 18) NOT NULL DEFAULT 0,
  price numeric(36, 18) NOT NULL DEFAULT 0,
  volume_24h numeric(24, 6) NOT NULL DEFAULT 0,
  discovered_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  CONSTRAINT uq_market_chain_proto_addr UNIQUE (chain_id, protocol, address)
);

CREATE INDEX IF NOT EXISTS idx_disc_market_base ON discovered_markets (chain_id, base_token_address);
CREATE INDEX IF NOT EXISTS idx_disc_market_quote ON discovered_markets (chain_id, quote_token_address);

CREATE TABLE IF NOT EXISTS ingestion_dlq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id text NOT NULL,
  queue_name text NOT NULL,
  chain_id text NOT NULL,
  block_number bigint,
  transaction_hash text,
  payload jsonb NOT NULL,
  error_message text NOT NULL,
  attempts int NOT NULL,
  failed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_activity_feed (
  id text PRIMARY KEY,
  wallet_address text NOT NULL,
  chain_id text NOT NULL,
  transaction_hash text NOT NULL,
  block_number bigint NOT NULL,
  activity_type text NOT NULL,
  amount numeric(36, 18) NOT NULL DEFAULT 0,
  token_address text,
  timestamp bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_feed_addr ON wallet_activity_feed (wallet_address, timestamp DESC);

