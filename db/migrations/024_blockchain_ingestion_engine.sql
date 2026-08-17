-- Migration 024: Blockchain Ingestion Engine, Normalization & Discovery (Sprint 44)

-- 1. Indexer Cursor State
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

-- 2. Blockchain Blocks
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

-- 3. Normalized Transactions
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

-- 4. Normalized Events
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

-- 5. Token Discovery Registry
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

-- 6. Discovered Markets
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

-- 7. Ingestion DLQ
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

-- 8. Wallet Activity Feed
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
