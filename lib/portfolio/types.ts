/**
 * Sprint 9 — Portfolio Intelligence & Position Risk Engine
 *
 * Core type system. No business logic lives here.
 *
 * Design principles enforced by these types:
 *  1. Blockchain facts are kept separate from calculated estimates. Anything
 *     Sentinel derived carries `isEstimate` / `confidence` / `evidence`.
 *  2. `0`, `Unknown` and `Unavailable` are three different things (spec §44).
 *     Every monetary quantity that can be missing is a `MonetaryValue`, never a
 *     bare number that silently defaults to zero.
 *  3. Displayed (mark) value is never conflated with realistic exit value
 *     (spec §12, §13, §20, §43).
 */

import type { Evidence } from '@/lib/intelligence/types';
import type { ExitabilityReport } from '@/lib/exitability/types';

export type Chain = string;

// ────────────────────────────────────────────────────────────────────────────
// Missing-data model (spec §42, §44)
// ────────────────────────────────────────────────────────────────────────────

/**
 * KNOWN        — we have a value we stand behind.
 * ESTIMATED    — derived/modelled, not an observed fact.
 * STALE        — we have a value but it is older than the freshness budget.
 * UNKNOWN      — the fact exists on-chain but Sentinel could not determine it
 *                (e.g. airdrop with no acquisition cost).
 * UNAVAILABLE  — no data source could serve it (e.g. no price feed).
 */
export type ValueStatus = 'KNOWN' | 'ESTIMATED' | 'STALE' | 'UNKNOWN' | 'UNAVAILABLE';

export interface MonetaryValue {
  status: ValueStatus;
  /** null whenever status is UNKNOWN or UNAVAILABLE. Never coerce to 0. */
  usd: number | null;
  confidence: number; // 0–1
  source?: string;
  observedAt?: string; // ISO
  note?: string;
}

export interface PriceQuote {
  tokenId: string;
  chain: Chain;
  priceUsd: number | null;
  priceSource: string;
  priceTimestamp: string; // ISO
  confidence: number; // 0–1
  status: ValueStatus;
  /** Age of the quote in seconds at read time. */
  ageSeconds?: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Raw ledger input (blockchain facts)
// ────────────────────────────────────────────────────────────────────────────

export type LedgerDirection = 'IN' | 'OUT';

export type LedgerSource =
  | 'DEX_SWAP'
  | 'TRANSFER'
  | 'AIRDROP'
  | 'BRIDGE'
  | 'MIGRATION'
  | 'STAKING_REWARD'
  | 'UNKNOWN';

/** Confirmation state of the underlying chain event (spec §49, §50, §51). */
export type LedgerStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'DROPPED'
  | 'REORGED';

export type StrategyTag =
  | 'MANUAL'
  | 'COPY_TRADE'
  | 'LIMIT_ORDER'
  | 'STOP_LOSS'
  | 'MARKET_ORDER'
  | 'LAUNCH_PARTICIPATION'
  | 'UNTAGGED';

/**
 * A single observed movement of a token in or out of a tracked wallet.
 * This is the raw fact layer. Nothing here is inferred by Sentinel except the
 * optional hint fields, which are explicitly labelled as hints.
 */
export interface RawLedgerEvent {
  id: string;
  txHash: string;
  chain: Chain;
  wallet: string;
  tokenId: string;
  symbol: string;
  /** True for the chain's native asset (SOL, ETH, Base ETH) — spec §41. */
  isNative?: boolean;
  direction: LedgerDirection;
  /** Token units moved. Always a blockchain fact. */
  quantity: number;
  /** Executed price in USD where the venue reported one. */
  pricePerTokenUsd?: number | null;
  /** Price the user was quoted before execution (spec §24). */
  quotedPricePerTokenUsd?: number | null;
  /** Quantity the user asked for, when partial fills matter (spec §4). */
  requestedQuantity?: number;
  counterpartyWallet?: string;
  counterpartyChain?: Chain;
  /** Platform/trading fee in USD. */
  tradingFeeUsd?: number;
  /** Network / gas fee in USD. */
  networkFeeUsd?: number;
  /** DEX/LP fee in USD where the venue exposes it. */
  dexFeeUsd?: number;
  source: LedgerSource;
  status: LedgerStatus;
  strategy?: StrategyTag;
  timestamp: string; // ISO
  /** Hints supplied by ingestion; classification treats them as evidence, not truth. */
  hints?: {
    bridgeId?: string;
    bridgeProtocol?: string;
    migrationFromTokenId?: string;
    migrationRatio?: number;
    knownAirdropProgram?: string;
    /** Chain event that this event supersedes after a reorg. */
    replacesEventId?: string;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Classification (spec §8, §9, §10, §11)
// ────────────────────────────────────────────────────────────────────────────

export type TransactionClass =
  | 'BUY'
  | 'SELL'
  | 'INTERNAL_TRANSFER_IN'
  | 'INTERNAL_TRANSFER_OUT'
  | 'EXTERNAL_TRANSFER_IN'
  | 'EXTERNAL_TRANSFER_OUT'
  | 'AIRDROP'
  | 'UNKNOWN_ACQUISITION'
  | 'UNKNOWN_DISPOSAL'
  | 'BRIDGE_IN'
  | 'BRIDGE_OUT'
  | 'MIGRATION_IN'
  | 'MIGRATION_OUT'
  | 'STAKING_REWARD'
  | 'IGNORED';

/** How certain we are about the cost basis attached to an acquisition. */
export type CostBasisCertainty = 'KNOWN' | 'ESTIMATED' | 'CARRIED_OVER' | 'UNKNOWN';

export interface ClassifiedEvent {
  event: RawLedgerEvent;
  classification: TransactionClass;
  /** Confidence in the classification itself (0–1). */
  confidence: number;
  costBasisCertainty: CostBasisCertainty;
  /** True when this event must not create realized P&L (spec §8, §10). */
  pnlNeutral: boolean;
  evidence: Evidence[];
  reasons: string[];
}

export interface ClassificationContext {
  /** Wallets the user has explicitly grouped (spec §39). */
  ownedWallets: string[];
  /**
   * Wallets seen on the other side of transfers that are not user-owned but
   * for which strong internal-transfer evidence exists.
   */
  relatedWallets?: string[];
  /** Token id pairs describing supported migrations (old → new). */
  migrationMap?: Record<string, { toTokenId: string; ratio: number }>;
  /** Maximum seconds between the two legs of a transfer/bridge to pair them. */
  pairingWindowSeconds?: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Lots & cost basis (spec §6, §7)
// ────────────────────────────────────────────────────────────────────────────

export type AccountingMethod = 'FIFO' | 'LIFO' | 'HIFO' | 'AVERAGE';

export type LotSource =
  | 'BUY'
  | 'AIRDROP'
  | 'TRANSFER_IN'
  | 'BRIDGE_IN'
  | 'MIGRATION_IN'
  | 'STAKING_REWARD'
  | 'UNKNOWN';

export interface PositionLot {
  id: string;
  positionId: string;
  tokenId: string;
  chain: Chain;
  wallet: string;
  /** Original acquired quantity. */
  quantity: number;
  /** Quantity still held from this lot. */
  remainingQuantity: number;
  /** Per-token acquisition price in USD; null when unknown (airdrop). */
  acquisitionPriceUsd: number | null;
  /** Total acquisition cost in USD including acquisition-side fees. */
  acquisitionCost: MonetaryValue;
  /** Fees capitalised into this lot. */
  feesUsd: number;
  timestamp: string; // ISO
  transactionHash: string;
  eventId: string;
  source: LotSource;
  certainty: CostBasisCertainty;
  /** Set when a lot's basis was carried across a bridge or migration. */
  carriedFrom?: { tokenId: string; chain: Chain; lotId: string };
}

export interface LotConsumption {
  lotId: string;
  quantity: number;
  /** Cost basis released by this consumption; UNKNOWN for unknown-basis lots. */
  costBasis: MonetaryValue;
  /** Acquisition-side fees attributable to the consumed slice. */
  acquisitionFeesUsd: number;
  acquisitionTimestamp: string;
  /** Holding period in hours for this consumed slice. */
  holdingHours: number;
}

export interface CostBasisState {
  positionId: string;
  tokenId: string;
  chain: Chain;
  method: AccountingMethod;
  /** Total quantity ever acquired. */
  acquiredQuantity: number;
  /** Total quantity ever disposed. */
  disposedQuantity: number;
  /** Quantity currently held. */
  remainingQuantity: number;
  /** Cost of everything acquired. */
  acquisitionCost: MonetaryValue;
  /** Weighted average cost per token for remaining quantity. */
  averageCostUsd: MonetaryValue;
  /** Cost basis still attached to held tokens. */
  remainingCostBasis: MonetaryValue;
  /** Cost basis already released through disposals. */
  realizedCostBasis: MonetaryValue;
  /** Quantity held whose basis Sentinel could not determine. */
  unknownBasisQuantity: number;
  lots: PositionLot[];
}

// ────────────────────────────────────────────────────────────────────────────
// P&L (spec §4, §5)
// ────────────────────────────────────────────────────────────────────────────

export interface FeeBreakdown {
  tradingFeesUsd: number;
  networkFeesUsd: number;
  dexFeesUsd: number;
  totalUsd: number;
}

export interface RealizedPnlEntry {
  eventId: string;
  transactionHash: string;
  timestamp: string;
  quantity: number;
  proceeds: MonetaryValue;
  costBasis: MonetaryValue;
  /** proceeds − costBasis, before fees. */
  grossPnl: MonetaryValue;
  fees: FeeBreakdown;
  /** grossPnl − fees. */
  netPnl: MonetaryValue;
  holdingHours: number;
  consumptions: LotConsumption[];
  strategy: StrategyTag;
  /** Portion of the disposal whose basis was unknown. */
  unknownBasisQuantity: number;
}

export interface PnlBreakdown {
  realized: MonetaryValue;
  unrealized: MonetaryValue;
  /** realized + unrealized, before fees. */
  total: MonetaryValue;
  fees: FeeBreakdown;
  /** True net: total − fees. This is the headline number (spec §4). */
  net: MonetaryValue;
  /** Net P&L as a fraction of invested capital, when computable. */
  netReturnPct: number | null;
  /** Set when part of the position has unknown cost basis (spec §9). */
  hasUnknownBasis: boolean;
  limitations: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Position (spec §12, §29, §46)
// ────────────────────────────────────────────────────────────────────────────

export type PositionStatus = 'OPEN' | 'CLOSED' | 'DUST';

export interface PendingChange {
  eventId: string;
  transactionHash: string;
  kind: 'PENDING_BUY' | 'PENDING_SELL' | 'PENDING_TRANSFER';
  quantity: number;
  estimatedValue: MonetaryValue;
  status: LedgerStatus;
  submittedAt: string;
  /** Never treat a pending event as final (spec §49). */
  isFinal: false;
}

export interface PositionValuation {
  price: PriceQuote;
  /** quantity × price. What most apps call "portfolio value". */
  markValue: MonetaryValue;
  /** What Sprint 8 says this position could realistically be exited for. */
  estimatedExitValue: MonetaryValue;
  /** Exit value under simultaneous-exit stress. */
  stressExitValue: MonetaryValue;
  /** (mark − exit) / mark, when computable. */
  exitDiscountPct: number | null;
  isEstimate: true;
}

export interface PositionRiskComponent {
  key: string;
  label: string;
  /** 0–100 where higher = more risk contributed. */
  score: number;
  weight: number;
  status: ValueStatus;
  detail: string;
  evidence: Evidence[];
}

export type RiskBand = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'SEVERE';

export interface PositionRiskScore {
  positionId: string;
  tokenId: string;
  /** 0–100, higher = riskier (spec §14). */
  score: number;
  band: RiskBand;
  confidence: number; // 0–1
  components: PositionRiskComponent[];
  drivers: string[];
  limitations: string[];
  version: string;
  generatedAt: string;
}

export type PositionEventType =
  | 'OPENED'
  | 'ADDED'
  | 'PARTIAL_EXIT'
  | 'CLOSED'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'AIRDROP_RECEIVED'
  | 'BRIDGED_IN'
  | 'BRIDGED_OUT'
  | 'MIGRATED'
  | 'PRICE_MOVE'
  | 'RISK_INCREASED'
  | 'RISK_DECREASED'
  | 'LIQUIDITY_DROP'
  | 'EXITABILITY_DROP'
  | 'WHALE_EXIT'
  | 'CREATOR_SELL'
  | 'CORRECTION';

export interface PositionEvent {
  id: string;
  positionId: string;
  type: PositionEventType;
  /** BLOCKCHAIN facts vs SENTINEL-derived observations (spec §28). */
  origin: 'BLOCKCHAIN' | 'SENTINEL';
  title: string;
  detail?: string;
  quantity?: number;
  valueUsd?: number | null;
  transactionHash?: string;
  confidence: number;
  evidence: Evidence[];
  occurredAt: string; // ISO
}

export interface Position {
  id: string;
  portfolioId: string;
  tokenId: string;
  symbol: string;
  name?: string;
  chain: Chain;
  isNative: boolean;
  /** Wallets contributing to this position. */
  wallets: string[];
  status: PositionStatus;
  quantity: number;
  costBasis: CostBasisState;
  valuation: PositionValuation;
  pnl: PnlBreakdown;
  realizedEntries: RealizedPnlEntry[];
  /** Share of portfolio mark value, 0–1. */
  allocationPct: number | null;
  risk: PositionRiskScore;
  exitability?: PositionExitability;
  liquidityAdjusted?: LiquidityAdjustedExposure;
  pending: PendingChange[];
  timeline: PositionEvent[];
  executionCosts: ExecutionCostRecord[];
  tradingVolumeUsd: number;
  firstAcquiredAt?: string;
  lastActivityAt?: string;
  /** Average holding time of currently held lots, in hours. */
  averageHoldingHours: number | null;
  strategyTags: StrategyTag[];
  limitations: string[];
}

export interface PositionExitability {
  score: number; // 0–100
  stressScore: number;
  interpretation: string;
  usableLiquidityUsd: number;
  priceImpactPct: number;
  slippagePct: number;
  confidence: number;
  generatedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Exposure & concentration (spec §17, §18, §19)
// ────────────────────────────────────────────────────────────────────────────

export interface ExposureBucket {
  key: string;
  label: string;
  valueUsd: number;
  /** Share of total measured exposure, 0–1. */
  sharePct: number;
  positionIds: string[];
  confidence: number;
}

export type RiskClass = 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';

export interface LiquidityAdjustedExposure {
  positionId: string;
  tokenId: string;
  positionValueUsd: number;
  usableLiquidityUsd: number | null;
  /** position / executable liquidity. null when liquidity is unknown. */
  liquidityRatio: number | null;
  /** Notional absorbable before the 5% impact threshold. */
  exitDepth5PctUsd: number | null;
  /** position / exitDepth5Pct. */
  depthRatio: number | null;
  band: RiskBand;
  note: string;
}

export interface ConcentrationAnalysis {
  largestPositionPct: number | null;
  largestPositionId?: string;
  top3Pct: number | null;
  top5Pct: number | null;
  /** Herfindahl–Hirschman index over position shares, 0–1. */
  herfindahl: number;
  /** Effective number of independent positions (1 / HHI). */
  effectivePositions: number | null;
  /** Observation only. Never a trade instruction (spec §18, §63). */
  observations: string[];
  measuredValueUsd: number;
  unmeasuredPositionIds: string[];
}

export interface ExposureReport {
  portfolioId: string;
  totalMeasuredValueUsd: number;
  /** Value we could not classify because price/liquidity data was missing. */
  unmeasuredValueUsd: number;
  byToken: ExposureBucket[];
  byChain: ExposureBucket[];
  byRiskClass: ExposureBucket[];
  byCreator: ExposureBucket[];
  concentration: ConcentrationAnalysis;
  liquidityAdjusted: LiquidityAdjustedExposure[];
  /** Share of portfolio in positions whose position/liquidity ratio is high. */
  illiquidSharePct: number;
  limitations: string[];
  generatedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Portfolio risk (spec §15, §16)
// ────────────────────────────────────────────────────────────────────────────

export interface PortfolioRiskDriver {
  key: string;
  label: string;
  /** Contribution to the portfolio score in points. */
  contribution: number;
  detail: string;
  affectedPositionIds: string[];
  evidence: Evidence[];
}

export interface PortfolioRiskScore {
  portfolioId: string;
  score: number; // 0–100, higher = riskier
  band: RiskBand;
  confidence: number;
  /** Value-weighted average of position risk, for reference only. */
  weightedPositionRisk: number;
  concentrationPenalty: number;
  liquidityPenalty: number;
  correlationPenalty: number;
  drivers: PortfolioRiskDriver[];
  limitations: string[];
  version: string;
  generatedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Performance (spec §21–§26, §35, §36, §37)
// ────────────────────────────────────────────────────────────────────────────

export type PerformanceWindow = 'TODAY' | '7D' | '30D' | 'ALL';

export type SampleAdequacy = 'INSUFFICIENT' | 'LOW' | 'MODERATE' | 'ADEQUATE';

export interface SampleSize {
  count: number;
  adequacy: SampleAdequacy;
  /** Minimum count at which the metric is considered publishable. */
  minimumForConfidence: number;
  note: string;
}

/** A metric that always travels with its sample size (spec §37). */
export interface SampledMetric {
  value: number | null;
  status: ValueStatus;
  sample: SampleSize;
  unit?: 'USD' | 'PCT' | 'RATIO' | 'HOURS' | 'COUNT';
}

export type HoldingBucket = 'SCALP' | 'INTRADAY' | 'SWING' | 'LONG_TERM';

export interface HoldingPeriodStats {
  averageHours: SampledMetric;
  medianHours: SampledMetric;
  bestHours: number | null;
  worstHours: number | null;
  buckets: Array<{
    bucket: HoldingBucket;
    trades: number;
    netPnlUsd: number;
    winRate: SampledMetric;
  }>;
  thresholds: HoldingThresholds;
}

export interface HoldingThresholds {
  scalpMaxHours: number;
  intradayMaxHours: number;
  swingMaxHours: number;
}

export interface TradingPerformance {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: SampledMetric;
  averageReturnPct: SampledMetric;
  medianReturnPct: SampledMetric;
  averageWinnerUsd: SampledMetric;
  averageLoserUsd: SampledMetric;
  bestTradeUsd: number | null;
  worstTradeUsd: number | null;
  profitFactor: SampledMetric;
  expectancyUsd: SampledMetric;
  /** Sharpe-like: mean return / stdev of returns. Suppressed at low n. */
  sharpeLike: SampledMetric;
  /** Sortino-like: mean return / downside deviation. Suppressed at low n. */
  sortinoLike: SampledMetric;
}

export interface AttributionEntry {
  key: string;
  label: string;
  netPnlUsd: number;
  realizedUsd: number;
  unrealizedUsd: number;
  feesUsd: number;
  trades: number;
  /** Share of the total gain (or loss) pool, 0–1. */
  sharePct: number;
  confidence: number;
  note?: string;
}

export interface AttributionReport {
  /** What made money (spec §22). */
  gains: AttributionEntry[];
  /** What cost money (spec §23). */
  losses: AttributionEntry[];
  byStrategy: AttributionEntry[];
  /** Cost centres: fees, slippage, execution. Descriptive, not causal. */
  costCentres: AttributionEntry[];
  limitations: string[];
}

export interface ExecutionCostRecord {
  eventId: string;
  positionId: string;
  tokenId: string;
  transactionHash: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  quotedPriceUsd: number | null;
  executedPriceUsd: number | null;
  /** executed − quoted, per token. */
  priceDifferenceUsd: number | null;
  /** Signed slippage as a fraction; negative = worse than quote. */
  slippagePct: number | null;
  fees: FeeBreakdown;
  /** Total USD cost vs a perfect fill at the quoted price. */
  executionCostUsd: MonetaryValue;
  /** Quantity requested vs filled (spec §4). */
  fillRatio: number | null;
  timestamp: string;
  status: ValueStatus;
}

export interface ExecutionCostSummary {
  records: ExecutionCostRecord[];
  totalExecutionCostUsd: MonetaryValue;
  averageSlippagePct: SampledMetric;
  worstSlippagePct: number | null;
  totalFeesUsd: number;
  /** Descriptive only — we do not claim causality (spec §23). */
  observations: string[];
}

export interface DrawdownAnalysis {
  peakValueUsd: number | null;
  peakAt?: string;
  currentValueUsd: number | null;
  maxDrawdownPct: number | null;
  maxDrawdownUsd: number | null;
  maxDrawdownAt?: string;
  currentDrawdownPct: number | null;
  sample: SampleSize;
}

export interface WindowPerformance {
  window: PerformanceWindow;
  from: string;
  to: string;
  netPnl: MonetaryValue;
  realizedPnl: MonetaryValue;
  unrealizedPnl: MonetaryValue;
  fees: FeeBreakdown;
  tradingVolumeUsd: number;
  trading: TradingPerformance;
  holding: HoldingPeriodStats;
  drawdown: DrawdownAnalysis;
  sample: SampleSize;
}

export interface PerformanceReport {
  portfolioId: string;
  windows: WindowPerformance[];
  attribution: AttributionReport;
  executionCosts: ExecutionCostSummary;
  limitations: string[];
  version: string;
  generatedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Portfolio & wallet grouping (spec §3, §38, §39, §40)
// ────────────────────────────────────────────────────────────────────────────

export type WalletRole = 'TRADING' | 'MAIN' | 'BOT' | 'COLD' | 'OTHER';

export interface PortfolioWallet {
  address: string;
  chain: Chain;
  label: string;
  role: WalletRole;
  /** Explicit user grouping is required (spec §39). */
  linkedBy: 'USER' | 'INTERNAL_TRANSFER_EVIDENCE';
  linkConfidence: number;
  addedAt: string;
}

export interface WalletGroup {
  id: string;
  userId: string;
  name: string;
  wallets: PortfolioWallet[];
  /** Private by default (spec §53). */
  visibility: 'PRIVATE' | 'SHARED';
  createdAt: string;
}

export interface WalletLinkSuggestion {
  walletA: string;
  walletB: string;
  confidence: number;
  transferCount: number;
  evidence: Evidence[];
  /** Never auto-applied (spec §39). */
  requiresUserConfirmation: true;
}

export interface ChainBreakdown {
  chain: Chain;
  markValue: MonetaryValue;
  estimatedExitValue: MonetaryValue;
  nativeBalance: { symbol: string; quantity: number; value: MonetaryValue } | null;
  positionCount: number;
  feesUsd: number;
  status: 'OK' | 'PARTIAL' | 'UNAVAILABLE';
  note?: string;
}

export interface PortfolioOverview {
  portfolioId: string;
  walletGroupId?: string;
  wallets: string[];
  chains: Chain[];
  /** Mark-to-market total (spec §13). */
  totalValue: MonetaryValue;
  /** Realistic exit total (spec §13, §20). */
  estimatedExitValue: MonetaryValue;
  stressExitValue: MonetaryValue;
  /** Native + stable balances that are immediately deployable. */
  availableBalance: MonetaryValue;
  /** Capital currently sitting in open positions at cost. */
  investedCapital: MonetaryValue;
  realizedPnl: MonetaryValue;
  unrealizedPnl: MonetaryValue;
  netPnl: MonetaryValue;
  fees: FeeBreakdown;
  todayChange: MonetaryValue;
  todayChangePct: number | null;
  positionCount: number;
  openPositionCount: number;
  highRiskPositionCount: number;
  exitabilityIssueCount: number;
  pendingCount: number;
  riskScore: number;
  riskBand: RiskBand;
  exposureSummary: {
    largestToken?: { symbol: string; sharePct: number };
    lowestExitability?: { symbol: string; score: number };
    highestRisk?: { symbol: string; score: number };
  };
  /** Positions whose value could not be determined (spec §42, §43). */
  unvaluedPositionIds: string[];
  limitations: string[];
  generatedAt: string;
}

export interface PortfolioResult {
  overview: PortfolioOverview;
  positions: Position[];
  exposure: ExposureReport;
  risk: PortfolioRiskScore;
  performance: PerformanceReport;
  changes: PositionChange[];
  alertEvents: PortfolioAlertEvent[];
  reconciliation: ReconciliationReport;
  snapshots: {
    portfolio: PortfolioSnapshot;
    pnl: PnlSnapshot;
    risk: RiskSnapshot;
    exposure: ExposureSnapshot;
  };
  limitations: string[];
  processedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Change detection & alerts (spec §30, §31, §32)
// ────────────────────────────────────────────────────────────────────────────

export type PositionChangeType =
  | 'RISK_INCREASED'
  | 'RISK_DECREASED'
  | 'EXITABILITY_DROP'
  | 'LIQUIDITY_DROP'
  | 'WHALE_EXIT'
  | 'WHALE_ACCUMULATION'
  | 'CREATOR_SELL'
  | 'ORGANIC_ACTIVITY_DECLINE'
  | 'POTENTIAL_COORDINATION'
  | 'LARGE_PNL_MOVE'
  | 'VALUE_UNAVAILABLE';

export interface PositionChange {
  type: PositionChangeType;
  positionId: string;
  tokenId: string;
  symbol: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  previousValue?: number;
  currentValue?: number;
  deltaPct?: number;
  confidence: number;
  evidence: Evidence[];
  detectedAt: string;
}

export type PortfolioAlertType =
  | 'POSITION_RISK_INCREASED'
  | 'POSITION_RISK_DECREASED'
  | 'EXITABILITY_DROP'
  | 'LIQUIDITY_DROP'
  | 'WHALE_EXIT'
  | 'CREATOR_SELL'
  | 'POTENTIAL_COORDINATION'
  | 'LARGE_PNL_MOVE'
  | 'CONCENTRATION_WARNING';

export interface PortfolioAlertEvent {
  type: PortfolioAlertType;
  portfolioId: string;
  positionId?: string;
  tokenId?: string;
  symbol?: string;
  chain?: Chain;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  /** Surfaced observation only — never an instruction to trade (spec §63). */
  isAdvisory: false;
  evidence: Evidence[];
  confidence: number;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

/** Declarative rule shape for Smart Alerts (spec §32). */
export interface PortfolioAlertRule {
  id: string;
  userId: string;
  portfolioId: string;
  metric:
    | 'POSITION_EXITABILITY'
    | 'POSITION_RISK'
    | 'POSITION_ALLOCATION_PCT'
    | 'POSITION_LIQUIDITY_RATIO'
    | 'PORTFOLIO_RISK'
    | 'PORTFOLIO_CONCENTRATION_PCT'
    | 'POSITION_NET_PNL_PCT';
  operator: 'LT' | 'LTE' | 'GT' | 'GTE';
  threshold: number;
  /** Optional scope: only fire for positions above this allocation. */
  minAllocationPct?: number;
  tokenId?: string;
  enabled: boolean;
  createdAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Snapshots (spec §34, §47)
// ────────────────────────────────────────────────────────────────────────────

export interface PortfolioSnapshot {
  portfolioId: string;
  markValueUsd: number | null;
  estimatedExitValueUsd: number | null;
  stressExitValueUsd: number | null;
  investedCapitalUsd: number | null;
  positionCount: number;
  riskScore: number;
  confidence: number;
  capturedAt: string;
}

export interface PnlSnapshot {
  portfolioId: string;
  realizedUsd: number | null;
  unrealizedUsd: number | null;
  netUsd: number | null;
  feesUsd: number;
  capturedAt: string;
}

export interface RiskSnapshot {
  portfolioId: string;
  score: number;
  band: RiskBand;
  weightedPositionRisk: number;
  concentrationPenalty: number;
  liquidityPenalty: number;
  correlationPenalty: number;
  capturedAt: string;
}

export interface ExposureSnapshot {
  portfolioId: string;
  largestPositionPct: number | null;
  top3Pct: number | null;
  top5Pct: number | null;
  herfindahl: number;
  byChain: Array<{ chain: Chain; sharePct: number }>;
  byRiskClass: Array<{ riskClass: RiskClass; sharePct: number }>;
  capturedAt: string;
}

export interface ValuePoint {
  at: string;
  markValueUsd: number | null;
  estimatedExitValueUsd: number | null;
  netPnlUsd: number | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Reconciliation (spec §51)
// ────────────────────────────────────────────────────────────────────────────

export interface ReconciliationCorrection {
  eventId: string;
  transactionHash: string;
  reason: 'REORGED' | 'DROPPED' | 'FAILED' | 'DUPLICATE' | 'SUPERSEDED';
  removedQuantity: number;
  detail: string;
  correctedAt: string;
}

export interface ReconciliationReport {
  portfolioId: string;
  acceptedEvents: number;
  rejectedEvents: number;
  duplicateEvents: number;
  pendingEvents: number;
  corrections: ReconciliationCorrection[];
  /** Set when derived state was rebuilt from scratch after a correction. */
  rebuilt: boolean;
  generatedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Engine input
// ────────────────────────────────────────────────────────────────────────────

export interface TokenMetaInput {
  tokenId: string;
  symbol: string;
  name?: string;
  chain: Chain;
  isNative?: boolean;
  creatorId?: string;
  creatorLabel?: string;
  /** 0–100 token intelligence score (higher = healthier). */
  intelligenceScore?: number;
  /** 0–100 (higher = more organic). */
  organicScore?: number;
  /** 0–100 (higher = more concentrated ownership). */
  ownershipConcentration?: number;
  /** 0–100 creator reputation (higher = better). */
  creatorReputation?: number;
  /** 0–100 insider risk (higher = more insider signal). */
  insiderRisk?: number;
  /** Fractional recent volatility, e.g. 0.25 for 25%. */
  volatility?: number;
  /** Treated as available balance rather than a risk position (spec §3). */
  isStable?: boolean;
  /** Correlation group id — positions in the same group move together. */
  correlationGroup?: string;
}

export interface PortfolioContext {
  portfolioId: string;
  userId: string;
  walletGroupId?: string;
  wallets: PortfolioWallet[];
  events: RawLedgerEvent[];
  tokens: Record<string, TokenMetaInput>;
  prices: Record<string, PriceQuote>;
  /** Keyed by tokenId. Supplied by Sprint 8's exitability pipeline. */
  exitability?: Record<string, ExitabilityReport>;
  /** Prior snapshots used for change detection & drawdown (spec §30, §35). */
  history?: ValuePoint[];
  previousPositions?: Position[];
  previousRisk?: PortfolioRiskScore;
  method?: AccountingMethod;
  holdingThresholds?: HoldingThresholds;
  /** Max acceptable price age in seconds before a quote is STALE. */
  priceFreshnessSeconds?: number;
  observedAt: string; // ISO
}
