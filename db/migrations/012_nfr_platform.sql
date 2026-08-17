-- ============================================================================
-- Sprint 32 — Non-Functional Requirements Platform Schema
-- Database Scalability, Table Partitioning, Data Retention, SLO Tracking & Reconciliation
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table Partitioning: High-Volume Operational Ledgers
-- Partitioned by month using range partitioning on created_at
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trade_executions_partitioned (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  wallet_address VARCHAR(64) NOT NULL,
  token_in VARCHAR(64) NOT NULL,
  token_out VARCHAR(64) NOT NULL,
  amount_in NUMERIC(36, 18) NOT NULL,
  amount_out NUMERIC(36, 18) NOT NULL,
  price_usd NUMERIC(18, 6) NOT NULL,
  slippage_pct NUMERIC(6, 4) NOT NULL,
  state VARCHAR(32) NOT NULL,
  tx_hash VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS market_ticks_partitioned (
  id BIGSERIAL,
  pair_address VARCHAR(64) NOT NULL,
  token_mint VARCHAR(64) NOT NULL,
  price_usd NUMERIC(24, 12) NOT NULL,
  volume_usd NUMERIC(24, 6) NOT NULL,
  liquidity_usd NUMERIC(24, 6) NOT NULL,
  source_provider VARCHAR(32) NOT NULL,
  tick_timestamp TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, tick_timestamp)
) PARTITION BY RANGE (tick_timestamp);

CREATE TABLE IF NOT EXISTS audit_logs_partitioned (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64),
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64),
  ip_address VARCHAR(45),
  user_agent TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ----------------------------------------------------------------------------
-- 2. Data Retention & Archiving Governance Policies (Sprint 32 §41)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS data_retention_policies (
  data_domain VARCHAR(64) PRIMARY KEY,
  description TEXT NOT NULL,
  hot_storage_retention_days INT NOT NULL,
  cold_archive_retention_days INT NOT NULL,
  auto_purge_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  compliance_justification TEXT NOT NULL,
  last_purged_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO data_retention_policies 
  (data_domain, description, hot_storage_retention_days, cold_archive_retention_days, auto_purge_enabled, compliance_justification)
VALUES
  ('trading_records', 'Immutable swap and order trade executions', 365, 2555, TRUE, 'Financial record-keeping compliance (7 years)'),
  ('audit_logs', 'Security and authorization audit trail', 180, 1095, TRUE, 'Security and SOC2 auditability requirement (3 years)'),
  ('security_events', 'MFA, authentication challenges, and rate limit triggers', 90, 365, TRUE, 'Incident investigation and threat forensics'),
  ('analytics_data', 'Aggregated volume, discovery ticks, and liquidity samples', 90, 365, TRUE, 'Operational analysis and historical trend modeling'),
  ('session_tokens', 'User session and ephemeral auth challenge nonces', 30, 0, TRUE, 'Session hygiene and token revocation safety')
ON CONFLICT (data_domain) DO UPDATE SET
  hot_storage_retention_days = EXCLUDED.hot_storage_retention_days,
  cold_archive_retention_days = EXCLUDED.cold_archive_retention_days;

-- Cold storage archive tables
CREATE TABLE IF NOT EXISTS archived_trade_history (
  archive_id VARCHAR(64) PRIMARY KEY,
  original_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  wallet_address VARCHAR(64) NOT NULL,
  trade_payload JSONB NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. SLO Metrics & Error Budget Historical Snapshots (Sprint 32 §2)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS slo_metrics_snapshots (
  id VARCHAR(64) PRIMARY KEY,
  service_name VARCHAR(64) NOT NULL,
  window_type VARCHAR(16) NOT NULL, -- '1h', '24h', '7d', '30d'
  availability_target NUMERIC(6, 4) NOT NULL,
  measured_availability NUMERIC(6, 4) NOT NULL,
  target_latency_p95_ms INT NOT NULL,
  measured_latency_p95_ms INT NOT NULL,
  error_budget_burn_rate NUMERIC(6, 2) NOT NULL,
  slo_met BOOLEAN NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slo_snapshots_service_date 
  ON slo_metrics_snapshots (service_name, recorded_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Eventual Blockchain Reconciliation Discrepancy Log (Sprint 32 §10)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reconciliation_discrepancies (
  id VARCHAR(64) PRIMARY KEY,
  transaction_id VARCHAR(64) NOT NULL,
  tx_hash VARCHAR(128),
  wallet_address VARCHAR(64) NOT NULL,
  discrepancy_type VARCHAR(64) NOT NULL,
  internal_state VARCHAR(32) NOT NULL,
  onchain_state VARCHAR(32) NOT NULL,
  corrected BOOLEAN NOT NULL DEFAULT FALSE,
  correction_note TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  corrected_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_tx_detected 
  ON reconciliation_discrepancies (transaction_id, detected_at DESC);

-- ----------------------------------------------------------------------------
-- 5. Feature Flags & Progressive Canary Rollout Registry (Sprint 32 §36-37)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS feature_flags (
  key VARCHAR(64) PRIMARY KEY,
  description TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percentage INT NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  allowed_roles TEXT[] DEFAULT '{}',
  whitelisted_user_ids TEXT[] DEFAULT '{}',
  disabled_user_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
