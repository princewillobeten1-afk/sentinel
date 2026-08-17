-- ============================================================================
-- Sprint 37 — AI System Schema
--
-- DDL definitions for the Sentinel AI Intelligence Layer:
--   - ai_features: Registry of controlled AI features and SLA policies (§6)
--   - ai_evaluation_golden_dataset: Benchmark test cases for regression testing (§49)
--   - ai_evaluation_runs: Continuous evaluation audit logs (§47-50)
--   - ai_token_reports: Cached structured reports with evidence hashes (§15, §55)
--   - ai_custom_risk_rules: Personalized trader risk configurations (§25-26)
--   - ai_trade_journals: Post-trade learning reviews and feedback loops (§65-67)
--   - ai_usage_metrics: Observability, token budgeting, and cost tracking (§53-54)
-- ============================================================================

-- ── 1. AI Feature Registry (spec §6) ──
CREATE TABLE IF NOT EXISTS ai_features (
  feature_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  model_category VARCHAR(32) NOT NULL, -- 'FAST_MODEL' | 'REASONING_MODEL' | 'EMBEDDING_MODEL' | 'CLASSIFICATION_MODEL' | 'SPECIALIZED_MODEL'
  model_policy VARCHAR(64) NOT NULL,
  max_latency_ms INT NOT NULL DEFAULT 2000,
  max_cost_usd NUMERIC(8, 5) NOT NULL DEFAULT 0.01,
  max_tokens INT NOT NULL DEFAULT 500,
  cache_ttl_seconds INT NOT NULL DEFAULT 300,
  priority VARCHAR(32) NOT NULL DEFAULT 'P1_RISK_EXPLANATION',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Golden Evaluation Dataset (spec §49) ──
CREATE TABLE IF NOT EXISTS ai_evaluation_golden_dataset (
  id VARCHAR(64) PRIMARY KEY,
  category VARCHAR(32) NOT NULL, -- 'KNOWN_SAFE' | 'KNOWN_RISKY' | 'KNOWN_INSIDER' | 'KNOWN_LIQUIDITY_DRAIN' | 'KNOWN_ANOMALY'
  title VARCHAR(255) NOT NULL,
  input_evidence_json JSONB NOT NULL,
  expected_risk_level VARCHAR(16) NOT NULL, -- 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  required_warning_keywords TEXT[],
  forbidden_hallucinations TEXT[],
  min_grounding_score NUMERIC(3, 2) NOT NULL DEFAULT 0.85,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. AI Evaluation Runs (spec §47-50, §76) ──
CREATE TABLE IF NOT EXISTS ai_evaluation_runs (
  id VARCHAR(64) PRIMARY KEY,
  model_version VARCHAR(64) NOT NULL,
  prompt_version VARCHAR(64) NOT NULL,
  total_cases INT NOT NULL,
  passed_cases INT NOT NULL,
  average_grounding_score NUMERIC(3, 2) NOT NULL,
  hallucination_rate_pct NUMERIC(5, 2) NOT NULL,
  average_latency_ms INT NOT NULL,
  total_cost_usd NUMERIC(8, 5) NOT NULL,
  status VARCHAR(32) NOT NULL, -- 'PASSED' | 'REGRESSION_DETECTED' | 'FAILED'
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_eval_runs_executed
  ON ai_evaluation_runs (executed_at DESC);

-- ── 4. Structured AI Token Reports (spec §15, §55) ──
CREATE TABLE IF NOT EXISTS ai_token_reports (
  id VARCHAR(64) PRIMARY KEY,
  token_address VARCHAR(128) NOT NULL,
  data_snapshot_hash VARCHAR(128) NOT NULL,
  overall_risk_level VARCHAR(16) NOT NULL,
  report_json JSONB NOT NULL,
  model_version VARCHAR(64) NOT NULL,
  prompt_version VARCHAR(64) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invalidated_at TIMESTAMPTZ,
  CONSTRAINT uq_token_snapshot UNIQUE (token_address, data_snapshot_hash)
);

CREATE INDEX IF NOT EXISTS idx_ai_token_reports_lookup
  ON ai_token_reports (token_address, generated_at DESC);

-- ── 5. Personalized AI Risk Rules (spec §25-26) ──
CREATE TABLE IF NOT EXISTS ai_custom_risk_rules (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  profile_type VARCHAR(32) NOT NULL DEFAULT 'BALANCED', -- 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'CUSTOM'
  min_exitability_score INT NOT NULL DEFAULT 50,
  max_insider_concentration_pct INT NOT NULL DEFAULT 40,
  max_top10_holder_pct INT NOT NULL DEFAULT 45,
  max_price_impact_pct NUMERIC(4, 2) NOT NULL DEFAULT 6.0,
  require_mint_revoked BOOLEAN NOT NULL DEFAULT TRUE,
  custom_rules_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_risk_profile UNIQUE (user_id)
);

-- ── 6. AI Post-Trade Journals (spec §65-66) ──
CREATE TABLE IF NOT EXISTS ai_trade_journals (
  id VARCHAR(64) PRIMARY KEY,
  trade_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  token_symbol VARCHAR(32) NOT NULL,
  entry_price_usd NUMERIC(16, 8) NOT NULL,
  exit_price_usd NUMERIC(16, 8) NOT NULL,
  pnl_pct NUMERIC(8, 2) NOT NULL,
  net_pnl_usd NUMERIC(12, 2) NOT NULL,
  fees_paid_usd NUMERIC(10, 2) NOT NULL,
  hold_duration_minutes INT NOT NULL,
  review_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_trade_journals_user
  ON ai_trade_journals (user_id, created_at DESC);

-- ── 7. AI Usage & Observability Metrics (spec §53-54) ──
CREATE TABLE IF NOT EXISTS ai_usage_metrics (
  id VARCHAR(64) PRIMARY KEY,
  feature_id VARCHAR(64) NOT NULL,
  model_id VARCHAR(64) NOT NULL,
  tokens_consumed INT NOT NULL,
  estimated_cost_usd NUMERIC(8, 5) NOT NULL,
  latency_ms INT NOT NULL,
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  grounding_score NUMERIC(3, 2) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_feature_time
  ON ai_usage_metrics (feature_id, created_at DESC);
