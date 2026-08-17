/**
 * Sprint 8 — Exitability Score Engine & Advanced Execution Intelligence
 *
 * Core type system. No business logic lives here.
 *
 * Design principle: exitability is never a single liquidity number. It is a
 * position-specific, evidence-backed synthesis of usable liquidity, price
 * impact, slippage, liquidity stability, holder pressure, pool structure, and
 * execution route quality.
 */

import type { Evidence } from '@/lib/intelligence/types';

export type Chain = string;

export type TradeSide = 'BUY' | 'SELL';

// ────────────────────────────────────────────────────────────────────────────
// AMM / Pool model
// ────────────────────────────────────────────────────────────────────────────

export type AmmKind =
  | 'CONSTANT_PRODUCT'
  | 'CONCENTRATED_LIQUIDITY'
  | 'STABLE'
  | 'WEIGHTED';

/**
 * A single concentrated-liquidity band expressed relative to the current price.
 * `liquidityUsd` is the notional depth positioned inside the band.
 */
export interface LiquidityBand {
  /** Lower bound as a fraction of current price, e.g. 0.9 for -10%. */
  lowerPriceRatio: number;
  /** Upper bound as a fraction of current price, e.g. 1.1 for +10%. */
  upperPriceRatio: number;
  liquidityUsd: number;
}

export interface PoolState {
  poolId: string;
  dex: string;
  kind: AmmKind;
  /** Reserve of the token being analyzed, in token units. */
  baseReserve: number;
  /** Reserve of the quote asset (e.g. SOL/USDC), in quote units. */
  quoteReserve: number;
  /** Current mid price of the token in USD. */
  priceUsd: number;
  /** Displayed total value locked in USD. */
  tvlUsd: number;
  feeTierPct: number;
  /** For CLMM pools: liquidity active at the current price, in USD. */
  activeLiquidityUsd?: number;
  /** For CLMM pools: liquidity distribution across price bands. */
  bands?: LiquidityBand[];
  /** Pool age in hours, where observable. */
  ageHours?: number;
  /** Whether LP is locked/burned, where observable. */
  lpLocked?: boolean;
  lpLockedPct?: number;
  observedAt: string; // ISO
}

// ────────────────────────────────────────────────────────────────────────────
// Quote / Simulation
// ────────────────────────────────────────────────────────────────────────────

export interface PoolQuote {
  poolId: string;
  dex: string;
  kind: AmmKind;
  side: TradeSide;
  inputUsd: number;
  /** Gross output before fees, in USD-equivalent. */
  grossOutputUsd: number;
  /** Net output after fees, in USD-equivalent. */
  outputUsd: number;
  priceImpactPct: number;
  feeUsd: number;
  /** Fraction of pool usable liquidity consumed by this order (0–1). */
  liquidityConsumedPct: number;
  /** Confidence in the quote given pool data quality (0–1). */
  confidence: number;
}

export interface RouteStep {
  poolId: string;
  dex: string;
  kind: AmmKind;
  inputUsd: number;
  outputUsd: number;
  priceImpactPct: number;
  feeUsd: number;
}

export interface ExecutionRoute {
  id: string;
  side: TradeSide;
  steps: RouteStep[];
  inputUsd: number;
  /** Net output after fees + gas, in USD. */
  outputUsd: number;
  priceImpactPct: number;
  slippagePct: number;
  feeUsd: number;
  gasUsd: number;
  /** Aggregate execution reliability score (0–1). */
  confidence: number;
  /** Composite score used to rank routes (higher = better). */
  routeScore: number;
}

/**
 * Quotes are estimates. They are never guarantees of execution. Every quote
 * carries freshness metadata so the UI can distinguish a stale quote from a
 * live one, and separate quoting from execution (spec §42).
 */
export interface ExecutionQuote {
  id: string;
  chain: Chain;
  tokenId: string;
  side: TradeSide;
  inputUsd: number;
  route: ExecutionRoute;
  expectedOutputUsd: number;
  minimumReceivedUsd: number;
  priceImpactPct: number;
  slippagePct: number;
  feeUsd: number;
  gasUsd: number;
  mevRisk: MevRisk;
  warnings: string[];
  isSimulation: true;
  quotedAt: string; // ISO
  expiresAt: string; // ISO
  slot?: number;
  confidence: number;
}

export type SimulationStatus =
  | 'SIMULATED'
  | 'INSUFFICIENT_LIQUIDITY'
  | 'SLIPPAGE_EXCEEDED'
  | 'QUOTE_EXPIRED'
  | 'POOL_CHANGED'
  | 'SIMULATION_FAILED'
  | 'VALIDATION_FAILED';

export interface ExecutionSimulation {
  id: string;
  chain: Chain;
  tokenId: string;
  side: TradeSide;
  inputUsd: number;
  route: ExecutionRoute;
  expectedOutputUsd: number;
  minimumReceivedUsd: number;
  priceImpactPct: number;
  slippagePct: number;
  feeUsd: number;
  gasUsd: number;
  status: SimulationStatus;
  warnings: string[];
  validations: ExecutionValidation[];
  quotedAt: string;
  expiresAt: string;
}

export interface ExecutionValidation {
  check: string;
  passed: boolean;
  detail: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Transaction State Machine (spec §41)
// ────────────────────────────────────────────────────────────────────────────

export type TransactionState =
  | 'CREATED'
  | 'SIMULATING'
  | 'SIMULATED'
  | 'SUBMITTING'
  | 'SUBMITTED'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'SIMULATION_FAILED'
  | 'SUBMISSION_FAILED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REORGED'
  | 'UNKNOWN';

export interface TransactionTransition {
  from: TransactionState;
  to: TransactionState;
  at: string; // ISO
  reason?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Slippage
// ────────────────────────────────────────────────────────────────────────────

export interface SlippageEstimate {
  expectedSlippagePct: number;
  /** Upper bound under recent volatility. */
  worstCaseSlippagePct: number;
  confidence: number;
  volatilityAdjustmentPct: number;
  evidence: Evidence[];
}

// ────────────────────────────────────────────────────────────────────────────
// MEV
// ────────────────────────────────────────────────────────────────────────────

export type MevRiskLevel = 'LOW' | 'MODERATE' | 'HIGH';

export interface MevRisk {
  level: MevRiskLevel;
  score: number; // 0–100
  factors: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Liquidity Quality
// ────────────────────────────────────────────────────────────────────────────

export interface LiquidityChange {
  window: '5m' | '15m' | '1h' | '4h' | '24h';
  changePct: number;
}

export interface LiquidityQuality {
  tokenId: string;
  chain: Chain;
  totalLiquidityUsd: number;
  /** Immediately executable liquidity near the current price. */
  usableLiquidityUsd: number;
  /** Liquidity active at current price (CLMM-aware). */
  activeLiquidityUsd: number;
  poolCount: number;
  poolDepthUsd: number;
  /** Herfindahl index of pool TVL shares (0–1). */
  poolConcentration: number;
  /** Share of usable liquidity held by the single largest pool (0–1). */
  topPoolShare: number;
  liquidityChanges: LiquidityChange[];
  stabilityScore: number; // 0–100
  lpLocked?: boolean;
  lpLockedPct?: number;
  /** Depth available across bands below the current price (CLMM). */
  bandDepth: { priceDropPct: number; liquidityUsd: number }[];
  signals: ExitabilitySignal[];
  confidence: number;
  limitations: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Exitability
// ────────────────────────────────────────────────────────────────────────────

export interface ExitSimulationResult {
  positionUsd: number;
  expectedProceedsUsd: number;
  minimumProceedsUsd: number;
  priceImpactPct: number;
  slippagePct: number;
  liquidityConsumedPct: number;
  route: ExecutionRoute;
  exitabilityScore: number;
  confidence: number;
  isSimulation: true;
}

export interface ExitabilityCurvePoint {
  positionUsd: number;
  exitabilityScore: number;
  priceImpactPct: number;
  slippagePct: number;
  expectedProceedsUsd: number;
}

export interface ExitDepthPoint {
  impactPct: number; // threshold e.g. 1, 5, 10, 20
  absorbableUsd: number; // sell volume absorbable before reaching threshold
}

export interface ExitabilitySignal {
  type: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  polarity: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'INFO';
  value: string | number;
  confidence: number;
  evidence: Evidence[];
}

export type ExitabilityInterpretation =
  | 'VERY_STRONG'
  | 'STRONG'
  | 'MODERATE'
  | 'WEAK'
  | 'POOR'
  | 'SEVERE';

export interface ExitabilityReport {
  tokenId: string;
  chain: Chain;
  /** Reference position used for the headline score. */
  referencePositionUsd: number;
  score: number; // 0–100
  interpretation: ExitabilityInterpretation;
  confidence: number;
  /** Score under simultaneous-exit stress. */
  stressScore: number;
  liquidity: LiquidityQuality;
  curve: ExitabilityCurvePoint[];
  exitDepth: ExitDepthPoint[];
  referenceSimulation: ExitSimulationResult;
  holderPressure: HolderPressure;
  signals: ExitabilitySignal[];
  warnings: string[];
  explanation: string;
  limitations: string[];
  exitabilityVersion: string;
  generatedAt: string; // ISO
}

// ────────────────────────────────────────────────────────────────────────────
// Holder pressure & stress testing
// ────────────────────────────────────────────────────────────────────────────

export interface HolderPosition {
  wallet: string;
  balanceUsd: number;
  supplyPct: number;
  clusterId?: string;
  creatorAssociated?: boolean;
  earlyParticipant?: boolean;
}

export type ExitPressureLevel = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'SEVERE';

export interface HolderPressure {
  top10SupplyPct: number;
  clusterSupplyPct: number;
  creatorSupplyPct: number;
  /** Total notional supply held by significant holders, in USD. */
  potentiallyMovableUsd: number;
  usableLiquidityUsd: number;
  /** movable supply / usable liquidity. */
  pressureRatio: number;
  level: ExitPressureLevel;
  evidence: Evidence[];
}

export interface StressScenario {
  id: string;
  label: string;
  /** Total sell notional injected in the scenario, in USD. */
  sellUsd: number;
  expectedProceedsUsd: number;
  priceImpactPct: number;
  remainingLiquidityUsd: number;
  expectedExecutionPriceUsd: number;
  isSimulation: true;
}

export interface StressTestReport {
  tokenId: string;
  chain: Chain;
  normalExitability: number;
  stressExitability: number;
  largeHolderScenarios: StressScenario[];
  massExitScenarios: StressScenario[];
  liquidityShockDetected: boolean;
  signals: ExitabilitySignal[];
  limitations: string[];
  generatedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Alerts
// ────────────────────────────────────────────────────────────────────────────

export type ExitabilityAlertType =
  | 'EXITABILITY_DROP'
  | 'LIQUIDITY_DROP'
  | 'EXIT_DEPTH_COLLAPSE'
  | 'SLIPPAGE_SPIKE'
  | 'POOL_CONCENTRATION_CHANGE'
  | 'LARGE_LIQUIDITY_WITHDRAWAL'
  | 'STRESS_EXITABILITY_DROP';

export interface ExitabilityAlertEvent {
  type: ExitabilityAlertType;
  tokenId: string;
  chain: Chain;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  evidence: Evidence[];
  confidence: number;
  metadata: Record<string, unknown>;
  occurredAt: string; // ISO
}

// ────────────────────────────────────────────────────────────────────────────
// Pipeline
// ────────────────────────────────────────────────────────────────────────────

export interface ExitabilityContext {
  tokenId: string;
  chain: Chain;
  pools: PoolState[];
  holders: HolderPosition[];
  /** Recent price move magnitude (fraction, e.g. 0.12 for 12%) for volatility. */
  recentPriceVolatility?: number;
  circulatingSupplyUsd?: number;
  /** User's own position for personalized analysis (spec §32). */
  userPositionUsd?: number;
  previousExitability?: ExitabilityReport;
  observedAt: string; // ISO
  dataCompleteFrom?: string;
  dataCompleteTo?: string;
}

export interface ExitabilityPipelineResult {
  tokenId: string;
  chain: Chain;
  exitability: ExitabilityReport;
  stress: StressTestReport;
  liquidity: LiquidityQuality;
  alertEvents: ExitabilityAlertEvent[];
  processedAt: string;
}
