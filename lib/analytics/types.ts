/**
 * Sprint 38 — Analytics & Data Intelligence Data Contracts & Types
 *
 * Core architectural principle:
 *   RAW DATA -> METRICS -> SIGNALS -> SCORES -> INSIGHTS
 *   with full bidirectional lineage and zero look-ahead bias.
 */

// ── 1. Pipeline & Lineage Types (§1-9) ──

export type AnalyticsTimeframe =
  | '1m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '4h'
  | '12h'
  | '24h'
  | '7d'
  | '30d'
  | 'ALL';

export type DataFreshnessStatus = 'LIVE' | 'NEAR_REALTIME' | 'DELAYED' | 'STALE';

export interface TimestampAudit {
  blockTime: string;
  observedAt: string;
  processedAt: string;
  calculatedAt: string;
  ingestionLagMs: number;
}

export interface DataLineageNode {
  layer: 'RAW_BLOCK' | 'TRANSACTION' | 'NORMALIZED_EVENT' | 'METRIC' | 'SIGNAL' | 'SCORE' | 'INSIGHT';
  identifier: string;
  description: string;
  timestamp: string;
  sourceProvider?: string;
  metadata?: Record<string, any>;
}

export interface DataLineageTrace {
  insightId: string;
  scoreName: string;
  computedScore: number | string;
  lineagePath: DataLineageNode[];
  rootBlockNumber?: number;
  rootTxHash?: string;
  verified: boolean;
}

// ── 2. Market & Volume Decomposition Types (§10-16) ──

export interface OhlcvCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsd: number;
  vwap: number;
  tradesCount: number;
}

export interface VolumeDecomposition {
  tokenAddress: string;
  timeframe: AnalyticsTimeframe;
  totalVolumeUsd: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  uniqueBuyerVolumeUsd: number;
  uniqueSellerVolumeUsd: number;
  repeatWalletVolumeUsd: number;
  newWalletVolumeUsd: number;
  creatorLinkedVolumeUsd: number;
  insiderLinkedVolumeUsd: number;
  suspectedWashVolumeUsd: number;
  organicVolumeUsd: number;
  organicVolumePct: number; // 0 - 100
  organicScore: number; // 0 - 100
  washTradingProbabilityPct: number; // 0 - 100
}

export interface WashTradingPattern {
  patternId: string;
  patternType: 'CIRCULAR_RING' | 'SAME_SIZE_SYNC' | 'RAPID_FLIP_FLOP' | 'FUNDED_CLUSTER';
  participatingWallets: string[];
  estimatedWashVolumeUsd: number;
  confidenceScore: number; // 0 - 100
  firstDetectedAt: string;
  lastDetectedAt: string;
}

// ── 3. Wallet Analytics & Clustering Types (§17-20, §41-42) ──

export type WalletBehaviorClassification =
  | 'EARLY_BUYER'
  | 'MOMENTUM_TRADER'
  | 'SCALPER'
  | 'WHALE'
  | 'LIQUIDITY_PROVIDER'
  | 'SNIPER'
  | 'MARKET_MAKER'
  | 'LONG_TERM_HOLDER'
  | 'HIGH_FREQUENCY_TRADER';

export interface WalletAnalyticsSummary {
  walletAddress: string;
  totalTrades: number;
  tokensInteracted: number;
  winRatePct: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  averageHoldingDurationMinutes: number;
  averageEntryLatencyMinutes: number; // minutes after token pool launch
  primaryClassification: WalletBehaviorClassification;
  classifications: WalletBehaviorClassification[];
  clusterId?: string;
  clusterConfidencePct?: number;
  isSmartMoney: boolean;
  smartMoneyAlphaScore?: number; // 0 - 100
  preferredMarketCapTier: 'MICRO' | 'MID' | 'LARGE';
}

export interface WalletClusterNode {
  clusterId: string;
  memberWallets: string[];
  commonFundingSource?: string;
  collectiveOwnershipPct: number;
  similarityConfidencePct: number;
  reasoning: string[];
  disclaimer: string;
}

export interface SmartMoneySignal {
  tokenAddress: string;
  smartWalletsCount: number;
  participatingWallets: string[];
  totalAccumulatedUsd: number;
  timeWindowMinutes: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  timestamp: string;
}

// ── 4. Creator Outcomes & Reputation Types (§21-23) ──

export interface CreatorOutcomeHorizon {
  horizon: '1h' | '6h' | '24h' | '7d' | '30d';
  medianPriceChangePct: number;
  medianDrawdownPct: number;
  medianLiquidityRetentionPct: number;
  activeVolumeSurvivalRatePct: number;
}

export interface CreatorAnalyticsRecord {
  creatorAddress: string;
  reputationScore: number; // 0 - 100
  totalLaunches: number;
  successfulLaunches: number; // Graduated / active > 30d
  failedLaunches: number;
  liquidityDrainIncidents: number;
  medianPeakMarketCapUsd: number;
  averageTokenLifespanDays: number;
  outcomesByHorizon: CreatorOutcomeHorizon[];
  status: 'TRUSTED' | 'MODERATE_RISK' | 'HIGH_RISK' | 'KNOWN_BAD_ACTOR';
}

// ── 5. Liquidity & Exitability Simulation Types (§27-31) ──

export interface PositionExitabilitySimulation {
  tokenAddress: string;
  simulatedTradeSizesUsd: Array<{
    tradeSizeUsd: number;
    estimatedPriceImpactPct: number;
    estimatedSlippagePct: number;
    executionCostUsd: number;
    exitabilityScore: number; // 0 - 100 for this specific position size
    isSafeExit: boolean;
  }>;
  overallTokenExitabilityScore: number;
  poolLiquidityUsd: number;
  poolVolatility24hPct: number;
  liquidityHealthScore: number; // 0 - 100
}

// ── 6. True Net P&L & Trader Analytics (§32-37) ──

export interface TrueNetPnlBreakdown {
  tradeId: string;
  tokenSymbol: string;
  grossProfitUsd: number;
  dexTradingFeesUsd: number;
  networkGasFeesUsd: number;
  slippageCostUsd: number;
  priceImpactCostUsd: number;
  totalFrictionCostsUsd: number;
  netPnlUsd: number;
  netPnlPct: number;
  realizedAt: string;
}

export interface TraderSelfAnalytics {
  userId: string;
  totalTradesExecuted: number;
  winRatePct: number;
  netPnlUsd: number;
  grossPnlUsd: number;
  totalFrictionFeesPaidUsd: number;
  averageEntryTimingMinutes: number; // Avg minutes after token creation
  averageHoldDurationMinutes: number;
  averageWinnerGainPct: number;
  averageLoserLossPct: number;
  lossAttribution: {
    lowExitabilityTrapsPct: number;
    slippageDragPct: number;
    lateEntryPumpsPct: number;
  };
  behavioralHabitObservations: string[];
}

// ── 7. Discovery Multi-Mode Ranking & Anomalies (§38-45) ──

export type DiscoveryRankingMode =
  | 'TRENDING'
  | 'SAFEST'
  | 'FASTEST_GROWTH'
  | 'HIGHEST_ORGANIC_VOLUME'
  | 'BEST_EXITABILITY'
  | 'NEW_LAUNCHES'
  | 'SMART_MONEY'
  | 'HIGH_CONVICTION'
  | 'UNDERVALUED_SIGNALS';

export interface DiscoveryTokenRankItem {
  tokenAddress: string;
  symbol: string;
  name: string;
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  organicVolumePct: number;
  exitabilityScore: number;
  liquidityHealthScore: number;
  creatorReputationScore: number;
  compositeDiscoveryScore: number;
  rankMode: DiscoveryRankingMode;
  riskFlags: string[];
}

export interface StatisticalAnomalyEvent {
  id: string;
  tokenAddress: string;
  metric: 'VOLUME' | 'HOLDERS' | 'LIQUIDITY' | 'CREATOR_TRANSFER' | 'PRICE_IMPACT';
  observedValue: number;
  baselineValue: number;
  zScore: number; // standard deviations
  sampleSize: number;
  deviationPct: number;
  detectedAt: string;
  severity: 'INFO' | 'WATCH' | 'WARNING' | 'HIGH' | 'CRITICAL';
}

export type MarketRegimeType =
  | 'HIGH_LIQUIDITY'
  | 'LOW_LIQUIDITY'
  | 'HIGH_VOLATILITY'
  | 'RISK_ON'
  | 'RISK_OFF'
  | 'MEME_FRENZY'
  | 'BROAD_SELLOFF';

export interface MarketRegimeStatus {
  regime: MarketRegimeType;
  confidenceScore: number;
  activeSolanaVolume24hUsd: number;
  newMintsCount24h: number;
  medianPoolDepthUsd: number;
  averageWashTradingPct: number;
  updatedAt: string;
}

// ── 8. Backtesting & Signal Evaluation (§48-51, §88-91) ──

export interface BacktestParameterConfig {
  signalName: string;
  thresholdValue: number;
  targetHorizon: '1h' | '6h' | '24h' | '7d';
  datasetTimeRange: { start: string; end: string };
  simulatedSlippagePct: number;
  simulatedFeeDeductionPct: number;
}

export interface BacktestRunMetrics {
  runId: string;
  signalName: string;
  totalSignalsTriggered: number;
  precisionPct: number;
  recallPct: number;
  winRatePct: number;
  averageProfitPct: number;
  maxDrawdownPct: number;
  profitFactor: number;
  noLookAheadVerified: boolean;
  executedAt: string;
}

// ── 9. Data Quality & Multi-Source Validation (§52-54, §83-84) ──

export interface DataQualityReport {
  timestamp: string;
  overallHealthStatus: 'HEALTHY' | 'DEGRADED' | 'DISCREPANCY_DETECTED' | 'OUTAGE';
  activeRpcProviders: Array<{
    name: string;
    status: 'ONLINE' | 'LATENT' | 'OFFLINE';
    latencyMs: number;
    blockLag: number;
  }>;
  indexerLagMs: number;
  eventDiscrepanciesCount: number;
  dataConfidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  activeDiscrepancies: Array<{
    metric: string;
    providerAValue: string | number;
    providerBValue: string | number;
    deltaPct: number;
    raisedAt: string;
  }>;
}
