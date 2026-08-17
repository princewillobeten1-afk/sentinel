/**
 * TypeScript Production Database Schema Contracts (Sprint 35 §9-78).
 *
 * Strongly-typed definitions matching the PostgreSQL production schema across all 16 domains.
 */

export interface DbUser {
  id: string;
  email?: string;
  username?: string;
  password_hash?: string;
  display_name?: string;
  avatar_url?: string;
  email_verified_at?: string;
  status: 'active' | 'suspended' | 'deactivated' | 'deleted' | 'closed' | 'inactive';
  role: 'user' | 'admin' | 'analyst';
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface DbWallet {
  id: string;
  user_id: string;
  chain: 'solana' | 'ethereum' | 'base' | string;
  address: string;
  label?: string;
  wallet_type?: 'external' | 'watch_only' | 'embedded';
  is_primary: boolean;
  status?: 'active' | 'disconnected' | 'suspended' | 'revoked' | string;
  created_at: string;
  updated_at: string;
}

export interface DbToken {
  id: string;
  chain_id: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo_url?: string;
  metadata_uri?: string;
  status: string;
  first_seen_at: string;
  created_at: string;
}

export interface DbOrder {
  id: string;
  user_id: string;
  wallet_id: string;
  token_id: string;
  order_type: 'MARKET' | 'LIMIT' | 'STOP_LOSS';
  side: 'BUY' | 'SELL';
  quantity: string;
  limit_price?: string;
  stop_price?: string;
  slippage_limit: number;
  status: 'CREATED' | 'VALIDATED' | 'SUBMITTED' | 'FILLED' | 'CANCELLED' | 'FAILED';
  created_at: string;
  updated_at: string;
}

export interface DbTrade {
  id: string;
  chain_id: string;
  transaction_hash: string;
  block_number: number;
  pool_id: string;
  token_in: string;
  token_out: string;
  trader_address: string;
  amount_in: string;
  amount_out: string;
  price: string;
  usd_value: string;
  timestamp: string;
}

export interface DbPosition {
  id: string;
  user_id: string;
  wallet_id: string;
  token_id: string;
  quantity: string;
  average_entry_price: string;
  realized_pnl: string;
  unrealized_pnl: string;
  updated_at: string;
}

export interface DbPortfolio {
  id: string;
  user_id: string;
  name: string;
  base_currency: string;
  created_at: string;
  updated_at: string;
}

export interface DbTokenIntelligence {
  token_id: string;
  risk_score: number;
  confidence: number;
  ownership_score: number;
  creator_score: number;
  organic_volume_score: number;
  insider_score: number;
  exitability_score: number;
  liquidity_score: number;
  contract_score: number;
  model_version: string;
  calculated_at: string;
}

export interface DbRiskSignal {
  id: string;
  token_id: string;
  signal_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  evidence: Record<string, any>;
  detected_at: string;
  expires_at?: string;
  status: string;
}

export interface DbCreator {
  id: string;
  chain: string;
  wallet_address: string;
  display_name?: string;
  reputation_score: number;
  status: string;
  first_seen_at: string;
}

export interface DbLaunchProject {
  id: string;
  creator_id: string;
  launchpad_id: string;
  token_id?: string;
  name: string;
  symbol: string;
  supply: string;
  configuration: Record<string, any>;
  status: 'pending' | 'active' | 'graduated' | 'failed';
  created_at: string;
}

export interface DbAuditLog {
  id: string;
  actor_type: 'user' | 'admin' | 'system' | 'api_key';
  actor_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  metadata: Record<string, any>;
  ip_reference?: string;
  created_at: string;
}

// ── Sprint 37: AI System Schema Contracts ──

export interface DbAiFeature {
  feature_id: string;
  name: string;
  description?: string;
  model_category: string;
  model_policy: string;
  max_latency_ms: number;
  max_cost_usd: string;
  max_tokens: number;
  cache_ttl_seconds: number;
  priority: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbAiEvaluationRun {
  id: string;
  model_version: string;
  prompt_version: string;
  total_cases: number;
  passed_cases: number;
  average_grounding_score: string;
  hallucination_rate_pct: string;
  average_latency_ms: number;
  total_cost_usd: string;
  status: 'PASSED' | 'REGRESSION_DETECTED' | 'FAILED';
  executed_at: string;
}

export interface DbAiTokenReport {
  id: string;
  token_address: string;
  data_snapshot_hash: string;
  overall_risk_level: string;
  report_json: Record<string, any>;
  model_version: string;
  prompt_version: string;
  generated_at: string;
  invalidated_at?: string;
}

export interface DbAiCustomRiskRule {
  id: string;
  user_id: string;
  profile_type: string;
  min_exitability_score: number;
  max_insider_concentration_pct: number;
  max_top10_holder_pct: number;
  max_price_impact_pct: string;
  require_mint_revoked: boolean;
  custom_rules_json: any[];
  updated_at: string;
}

export interface DbAiTradeJournal {
  id: string;
  trade_id: string;
  user_id: string;
  token_symbol: string;
  entry_price_usd: string;
  exit_price_usd: string;
  pnl_pct: string;
  net_pnl_usd: string;
  fees_paid_usd: string;
  hold_duration_minutes: number;
  review_json: Record<string, any>;
  created_at: string;
}

export interface DbAiUsageMetric {
  id: string;
  feature_id: string;
  model_id: string;
  tokens_consumed: number;
  estimated_cost_usd: string;
  latency_ms: number;
  cached: boolean;
  grounding_score: string;
  created_at: string;
}

// ── Sprint 38: Analytics & Data Intelligence Entities ──

export interface DbAnalyticsVolumeSnapshot {
  id: string;
  token_address: string;
  timeframe: string;
  total_volume_usd: string;
  buy_volume_usd: string;
  sell_volume_usd: string;
  organic_volume_usd: string;
  suspected_wash_volume_usd: string;
  organic_score: number;
  wash_trading_probability_pct: string;
  snapshot_timestamp: string;
}

export interface DbAnalyticsWashTradingEvent {
  id: string;
  token_address: string;
  pattern_type: string;
  participating_wallets: string[];
  estimated_wash_volume_usd: string;
  confidence_score: number;
  detected_at: string;
}

export interface DbAnalyticsWalletProfile {
  wallet_address: string;
  total_trades: number;
  tokens_interacted: number;
  win_rate_pct: string;
  realized_pnl_usd: string;
  average_holding_duration_minutes: number;
  average_entry_latency_minutes: number;
  primary_classification: string;
  cluster_id?: string;
  is_smart_money: boolean;
  smart_money_alpha_score?: number;
  updated_at: string;
}

export interface DbAnalyticsCreatorOutcome {
  creator_address: string;
  reputation_score: number;
  total_launches: number;
  successful_launches: number;
  failed_launches: number;
  liquidity_drain_incidents: number;
  median_peak_market_cap_usd: string;
  outcomes_by_horizon: any[];
  status: string;
  updated_at: string;
}

export interface DbAnalyticsBacktestRun {
  run_id: string;
  signal_name: string;
  total_signals_triggered: number;
  win_rate_pct: string;
  average_profit_pct: string;
  profit_factor: string;
  max_drawdown_pct: string;
  no_look_ahead_verified: boolean;
  executed_at: string;
}

// ── Sprint 39: Admin Dashboard & Platform Operations Contracts ──

export interface DbAdminRole {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface DbAdminPermission {
  id: string;
  domain: string;
  action: string;
  description?: string;
  created_at: string;
}

export interface DbAdminSession {
  id: string;
  user_id: string;
  device_fingerprint: string;
  ip_address: string;
  geo_location?: string;
  user_agent?: string;
  mfa_verified: boolean;
  last_active_at: string;
  expires_at: string;
  revoked_at?: string;
  created_at: string;
}

export interface DbAdminAuditLog {
  id: string;
  sequence_num?: number;
  previous_hash: string;
  event_hash: string;
  actor_id: string;
  actor_role: string;
  action: string;
  domain: string;
  resource_type: string;
  resource_id?: string;
  reason: string;
  ip_address?: string;
  geo_location?: string;
  user_agent?: string;
  session_id?: string;
  changes_before?: Record<string, any>;
  changes_after?: Record<string, any>;
  created_at: string;
}

export interface DbAdminDualApproval {
  id: string;
  action_type: string;
  payload: Record<string, any>;
  requested_by: string;
  requested_at: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  expires_at: string;
  executed_at?: string;
}

export interface DbAdminEmergencyState {
  id: string;
  mode: 'NORMAL' | 'DEGRADED' | 'TRADING_RESTRICTED' | 'TRADING_PAUSED' | 'FULL_EMERGENCY';
  pause_new_trades: boolean;
  pause_withdrawals: boolean;
  pause_copy_trading: boolean;
  pause_launchpad: boolean;
  disabled_chains: string[];
  disabled_routers: string[];
  circuit_breakers: Record<string, any>;
  updated_by: string;
  reason: string;
  updated_at: string;
}

export interface DbAdminInvestigation {
  id: string;
  title: string;
  entity_type: 'TOKEN' | 'WALLET' | 'USER' | 'CREATOR' | 'ORDER' | 'FAILED_TRADE' | 'INCIDENT';
  entity_id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'ARCHIVED';
  assigned_to?: string;
  ai_summary?: string;
  evidence_links: any[];
  timeline: any[];
  admin_notes: any[];
  created_at: string;
  updated_at: string;
}

export interface DbAdminSecurityIncident {
  id: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'ARCHIVED';
  title: string;
  description: string;
  affected_systems: string[];
  affected_users_count: number;
  timeline: any[];
  evidence: any[];
  mitigation_steps: any[];
  assigned_team?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DbAdminFeatureFlag {
  flag_key: string;
  name: string;
  description?: string;
  enabled: boolean;
  rollout_pct: number;
  target_roles: string[];
  target_users: string[];
  target_regions: string[];
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface DbAdminConfigSetting {
  config_key: string;
  config_group: string;
  value_json: any;
  previous_value_json?: any;
  version: number;
  is_dangerous: boolean;
  updated_by: string;
  reason: string;
  updated_at: string;
}

export interface DbAdminRiskOverride {
  id: string;
  entity_type: string;
  entity_id: string;
  override_rules: Record<string, any>;
  admin_id: string;
  reason: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export interface DbAdminAbuseReport {
  id: string;
  reporter_wallet: string;
  target_type: 'TOKEN' | 'CREATOR' | 'USER' | 'MESSAGE';
  target_id: string;
  category: 'SCAM' | 'IMPERSONATION' | 'MANIPULATION' | 'RUG_PULL' | 'HARASSMENT';
  evidence_json: Record<string, any>;
  status: 'PENDING' | 'INVESTIGATING' | 'ACTIONED' | 'DISMISSED';
  resolution?: string;
  reviewed_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DbAdminSupportTicket {
  id: string;
  user_id?: string;
  wallet_address?: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';
  subject: string;
  description?: string;
  internal_notes: any[];
  assigned_agent?: string;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// Sprint 45 — Canonical Market Data Engine & Token Discovery Interfaces
// ----------------------------------------------------------------------------

export interface DbMarket {
  id: string;
  chain_id: string;
  protocol: string;
  market_type: 'CPMM' | 'CONCENTRATED' | 'ORDERBOOK' | 'STABLE_SWAP' | string;
  address: string;
  base_token_id: string;
  quote_token_id: string;
  fee_bps: number;
  status: 'DISCOVERED' | 'ACTIVE' | 'INACTIVE' | 'SUSPICIOUS' | 'DEPRECATED';
  source: 'ONCHAIN' | 'REGISTRY' | 'INDEXER' | 'MANUAL' | 'EXTERNAL_PROVIDER';
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

export interface DbMarketReserve {
  id: string;
  market_id: string;
  base_reserve: string;
  quote_reserve: string;
  base_price_usd: number;
  quote_price_usd: number;
  liquidity_usd: number;
  slot_or_block: number;
  updated_at: string;
}

export interface DbMarketSwap {
  id: string;
  market_id: string;
  tx_hash: string;
  sender_wallet: string;
  side: 'BUY' | 'SELL';
  base_amount: string;
  quote_amount: string;
  price_usd: number;
  volume_usd: number;
  slot_or_block: number;
  timestamp: string;
  created_at: string;
}

export interface DbOhlcvCandle {
  id: string;
  market_id: string;
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume_usd: number;
  trade_count: number;
  is_final: boolean;
  updated_at: string;
}

export interface DbMarketSnapshot {
  id: string;
  market_id: string;
  price_usd: number;
  volume_24h_usd: number;
  liquidity_usd: number;
  price_change_24h: number;
  timestamp: string;
}

export interface DbTokenMarketSnapshot {
  id: string;
  token_id: string;
  canonical_price_usd: number;
  price_change_1m: number;
  price_change_5m: number;
  price_change_1h: number;
  price_change_6h: number;
  price_change_24h: number;
  price_change_7d: number;
  volume_5m_usd: number;
  volume_1h_usd: number;
  volume_24h_usd: number;
  total_liquidity_usd: number;
  market_cap_usd: number;
  fdv_usd?: number | null;
  market_count: number;
  confidence_score: number;
  data_quality_score: number;
  timestamp: string;
}

export interface DbTokenSupply {
  token_id: string;
  total_supply: string;
  circulating_supply: string;
  max_supply?: string | null;
  supply_confidence: number;
  source: string;
  updated_at: string;
}

export interface DbTokenRankingCache {
  category: 'trending' | 'gainers' | 'losers' | 'liquid' | 'volume' | 'new';
  timeframe: string;
  rank: number;
  token_id: string;
  symbol: string;
  name: string;
  price_usd: number;
  change_pct: number;
  volume_usd: number;
  liquidity_usd: number;
  score: number;
  score_breakdown_json: string;
  updated_at: string;
}

export interface DbMarketDataQualityLog {
  id: string;
  token_id: string;
  quality_score: number;
  confidence: number;
  divergence_status: 'NORMAL' | 'WARNING' | 'ANOMALOUS';
  anomalies_json: string;
  checked_at: string;
}

// ----------------------------------------------------------------------------
// Sprint 47 — Swap Execution Engine Interfaces
// ----------------------------------------------------------------------------

export interface DbExecution {
  execution_id: string;
  user_id: string;
  wallet_address: string;
  chain_id: string;
  quote_id: string;
  status: 'CREATED' | 'ROUTE_SELECTED' | 'TRANSACTION_BUILT' | 'SIMULATED' | 'READY_FOR_SIGNATURE' | 'SIGNED' | 'SUBMITTED' | 'PENDING' | 'CONFIRMING' | 'CONFIRMED' | 'FAILED' | 'REPLACED' | 'EXPIRED';
  token_in: string;
  token_out: string;
  amount_in: string;
  expected_output: string;
  actual_output?: string | null;
  slippage: number;
  route: string;
  created_at: string;
  updated_at: string;
}

export interface DbTransactionIntent {
  intent_id: string;
  execution_id: string;
  user_id: string;
  wallet_address: string;
  chain_id: string;
  idempotency_key: string;
  payload_json: string;
  status: string;
  created_at: string;
}

export interface DbExecutionAttempt {
  attempt_id: string;
  execution_id: string;
  provider: string;
  transaction_hash?: string | null;
  attempt_number: number;
  status: string;
  created_at: string;
}

export interface DbTransactionReceipt {
  receipt_id: string;
  execution_id: string;
  transaction_hash: string;
  block_number: number;
  block_hash?: string | null;
  gas_used: string;
  effective_gas_price: string;
  status: 'SUCCESS' | 'REVERTED' | 'FAILED';
  timestamp: string;
}

export interface DbExecutionEvent {
  event_id: string;
  execution_id: string;
  event_type: string;
  payload_json: string;
  timestamp: string;
}

export interface DbTokenApproval {
  approval_id: string;
  user_id: string;
  wallet_address: string;
  token_address: string;
  spender_address: string;
  amount_approved: string;
  status: 'PENDING' | 'APPROVED' | 'REVOKED' | 'FAILED';
  created_at: string;
}

export interface DbExecutionBlocklist {
  id: string;
  target_type: 'TOKEN' | 'CONTRACT';
  target_value: string;
  reason: string;
  created_by: string;
  created_at: string;
  expires_at?: string | null;
}

// Sprint 43: Authentication, Identity & Wallet Connection Models
export interface DbUserSession {
  id: string;
  user_id: string;
  token_hash?: string;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  revoked_at?: string | null;
  revoked_reason?: string | null;
}

export interface DbWalletVerification {
  id: string;
  wallet_id: string;
  challenge_id: string;
  verified_at: string;
  method: 'SIWS' | 'SIWE';
  metadata?: string | Record<string, any>;
}

export interface DbAuthChallenge {
  id: string;
  user_id?: string | null;
  wallet_address: string;
  chain_id: string;
  nonce: string;
  message: string;
  message_hash?: string;
  expires_at: string;
  used_at?: string | null;
  created_at: string;
}

export interface DbPasswordResetToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at?: string | null;
  created_at: string;
}

export interface DbEmailVerificationToken {
  id: string;
  user_id: string;
  token_hash: string;
  new_email?: string | null;
  expires_at: string;
  used_at?: string | null;
  created_at: string;
}

export interface DbSecurityAuditEvent {
  id: string;
  user_id?: string | null;
  action: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  entity_type: string;
  entity_id?: string | null;
  metadata?: string | Record<string, any>;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}
