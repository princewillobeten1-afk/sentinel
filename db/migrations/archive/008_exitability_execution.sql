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
