-- ============================================================================
-- Sprint 9 — Portfolio Intelligence & Position Risk Engine Schema
--
-- Design notes that the column types encode:
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

CREATE TYPE portfolio_alert_type_enum AS ENUM (
  'POSITION_RISK_INCREASED', 'POSITION_RISK_DECREASED',
  'EXITABILITY_DROP', 'LIQUIDITY_DROP',
  'WHALE_EXIT', 'CREATOR_SELL', 'POTENTIAL_COORDINATION',
  'LARGE_PNL_MOVE', 'CONCENTRATION_WARNING'
);

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

-- ── 13. Portfolio alerts (spec §31, §32) ──

CREATE TABLE portfolio_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio_intelligence(id) ON DELETE CASCADE,
  position_id uuid REFERENCES positions(id) ON DELETE CASCADE,
  type portfolio_alert_type_enum NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'info',
  title text NOT NULL,
  -- Permanently false: the intelligence layer observes, it does not advise.
  is_advisory boolean NOT NULL DEFAULT false CHECK (is_advisory = false),
  confidence numeric(4, 3) NOT NULL DEFAULT 1.000,
  evidence_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at timestamptz,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portfolio_alerts_time_idx ON portfolio_alerts (portfolio_id, occurred_at DESC);
CREATE INDEX portfolio_alerts_unack_idx ON portfolio_alerts (portfolio_id) WHERE acknowledged_at IS NULL;

CREATE TABLE portfolio_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  portfolio_id uuid NOT NULL REFERENCES portfolio_intelligence(id) ON DELETE CASCADE,
  metric text NOT NULL,
  operator text NOT NULL CHECK (operator IN ('LT', 'LTE', 'GT', 'GTE')),
  threshold numeric(20, 6) NOT NULL,
  min_allocation_pct numeric(10, 6),
  token_ref text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portfolio_alert_rules_portfolio_idx
  ON portfolio_alert_rules (portfolio_id) WHERE enabled;

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
