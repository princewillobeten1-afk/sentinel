-- ============================================================================
-- Sprint 7 — Organic Volume & Insider Detection Engine Schema Extensions
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
