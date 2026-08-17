import type { Evidence } from '@/lib/intelligence/types';
import type { WalletClusterV2, WalletRelationshipEdge } from '@/lib/ownership/types';

export type ActivityWindow = '1m' | '5m' | '15m' | '1h' | '4h' | '24h' | '7d';

export type WindowAssessmentStatus = 'AVAILABLE' | 'INSUFFICIENT_DATA' | 'STALE' | 'UNKNOWN';

export type TradeSide = 'BUY' | 'SELL';

export type ActivityPersistence = 'PERSISTENT' | 'TEMPORARY' | 'SPIKE_DRIVEN' | 'DECLINING' | 'GROWING' | 'UNKNOWN';

export type TemporalPattern = 'CONTINUOUS' | 'BURSTY' | 'PERIODIC' | 'CLUSTERED' | 'EVENT_DRIVEN' | 'UNKNOWN';

export type ActivityDimensionState = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'UNKNOWN';

export type ParticipationDimension = 'ORGANIC' | 'AUTOMATED' | 'COORDINATED' | 'UNKNOWN';

export type WalletActivityLabel =
  | 'Early Participant'
  | 'High-Volume Trader'
  | 'Frequent Trader'
  | 'Potentially Coordinated'
  | 'Creator-Associated'
  | 'Market-Maker-Like'
  | 'Bot-Like'
  | 'Unknown';

export type InsiderSignalCategory =
  | 'EARLY_ENTRY'
  | 'CREATOR_RELATIONSHIP'
  | 'FUNDING_RELATIONSHIP'
  | 'PRE_LAUNCH_FUNDING'
  | 'COORDINATED_ENTRY'
  | 'UNUSUAL_POSITION_SIZE'
  | 'COORDINATED_EXIT'
  | 'REPEATED_HISTORICAL_PATTERN'
  | 'CLUSTER_ASSOCIATION';

export type InsiderCandidateStatus =
  | 'OBSERVED_PATTERN'
  | 'POTENTIAL_CONNECTION'
  | 'HIGH_CONFIDENCE_PATTERN'
  | 'VERIFIED_RELATIONSHIP';

export type ActivityAlertEventType =
  | 'ORGANIC_ACTIVITY_CHANGED'
  | 'VOLUME_CONCENTRATION_SPIKE'
  | 'COORDINATED_ACTIVITY_DETECTED'
  | 'EARLY_LARGE_BUY'
  | 'CREATOR_LINKED_ACTIVITY'
  | 'POTENTIAL_INSIDER_PATTERN'
  | 'COORDINATED_EXIT';

export interface NormalizedTrade {
  id: string;
  tokenId: string;
  chain: string;
  wallet: string;
  side: TradeSide;
  amountUsd: number;
  tokenAmount?: number;
  priceUsd?: number;
  timestamp: string;
  txHash?: string;
  counterparty?: string;
  clusterId?: string;
  fundingSource?: string;
  creatorAssociated?: boolean;
  supplyPct?: number;
  liquidityPct?: number;
}

export interface WalletFundingEvent {
  sourceWallet: string;
  recipientWallet: string;
  amountUsd: number;
  timestamp: string;
  txHash?: string;
  relationshipToCreator?: boolean;
}

export interface HistoricalWalletPattern {
  wallet: string;
  earlyEntries: number;
  profitableEarlyExits: number;
  observedLaunches: number;
  averageReturnPct?: number;
  evidence: Evidence[];
}

export interface ActivityContext {
  tokenId: string;
  chain: string;
  tokenCreatedAt?: string;
  firstLiquidityAt?: string;
  tradingOpenedAt?: string;
  observedAt: string;
  dataCompleteFrom?: string;
  dataCompleteTo?: string;
  creatorWallets?: string[];
  clusters?: WalletClusterV2[];
  relationships?: WalletRelationshipEdge[];
  fundingEvents?: WalletFundingEvent[];
  historicalPatterns?: HistoricalWalletPattern[];
}

export interface ParticipationMetrics {
  totalVolumeUsd: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  buyCount: number;
  sellCount: number;
  totalTransactions: number;
  uniqueBuyers: number;
  uniqueSellers: number;
  uniqueActiveWallets: number;
  walletsOnlyBuy: number;
  walletsOnlySell: number;
  walletsBothBuySell: number;
  newParticipantRatio: number;
  returningParticipantRatio: number;
  volumePerWallet: Record<string, number>;
  medianVolumePerWallet: number;
  meanVolumePerWallet: number;
  top1WalletShare: number;
  top5WalletShare: number;
  top10WalletShare: number;
}

export interface ConcentrationMetrics {
  topWalletVolumeShare: number;
  topClusterVolumeShare: number;
  hhi: number;
  gini: number;
  percentileDistribution: Record<'p50' | 'p75' | 'p90' | 'p95' | 'p99', number>;
}

export interface TransactionDistribution {
  medianTradeSizeUsd: number;
  meanTradeSizeUsd: number;
  stdDevTradeSizeUsd: number;
  percentiles: Record<'p10' | 'p25' | 'p50' | 'p75' | 'p90' | 'p95' | 'p99', number>;
  repeatedSizeRatio: number;
  repeatedSizeSignificance: number;
  tradeSizeBuckets: {
    small: { count: number; volumeUsd: number; share: number };
    medium: { count: number; volumeUsd: number; share: number };
    large: { count: number; volumeUsd: number; share: number };
  };
}

export interface RepeatWalletMetrics {
  oneTransaction: number;
  twoToFiveTransactions: number;
  sixToTwentyTransactions: number;
  overTwentyTransactions: number;
  repeatWalletRatio: number;
}

export interface TemporalMetrics {
  pattern: TemporalPattern;
  burstScore: number;
  periodicityScore: number;
  inactivityGapCount: number;
  averageInterTradeSeconds: number;
  activityPersistence: ActivityPersistence;
}

export interface WalletPairInteraction {
  walletA: string;
  walletB: string;
  interactions: number;
  volumeUsd: number;
  direction: 'ONE_WAY' | 'TWO_WAY';
  firstObserved: string;
  lastObserved: string;
  evidence: Evidence[];
}

export interface ClusterActivity {
  clusterId: string;
  wallets: string[];
  volumeUsd: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
  transactions: number;
  shareOfVolume: number;
  timingSpreadSeconds: number;
  confidence: number;
  evidence: Evidence[];
}

export interface ActivityQualityFeatureSet {
  window: ActivityWindow;
  status: WindowAssessmentStatus;
  sampleSize: number;
  freshnessSeconds: number;
  dataCoverage: number;
  participation: ParticipationMetrics;
  concentration: ConcentrationMetrics;
  transactionDistribution: TransactionDistribution;
  repeatWallets: RepeatWalletMetrics;
  temporal: TemporalMetrics;
  pairInteractions: WalletPairInteraction[];
  clusterActivity: ClusterActivity[];
  creatorLinkedVolumeUsd: number;
  creatorLinkedVolumeShare: number;
  botLikeScore: number;
  marketMakerLikeScore: number;
  circularActivityScore: number;
  featureVersion: string;
  limitations: string[];
}

export interface OrganicActivitySignal {
  type: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dimension: ParticipationDimension;
  value: string | number;
  evidence: Evidence[];
  confidence: number;
}

export interface OrganicActivityAssessment {
  tokenId: string;
  chain: string;
  window: ActivityWindow;
  status: WindowAssessmentStatus;
  score: number;
  interpretation: string;
  confidence: number;
  dataCoverage: number;
  freshness: WindowAssessmentStatus;
  sampleSize: number;
  features: ActivityQualityFeatureSet;
  signals: OrganicActivitySignal[];
  limitations: string[];
  organicVolumeVersion: string;
  featureVersion: string;
  generatedAt: string;
}

export interface ActivityFeatureStoreSnapshot {
  tokenId: string;
  chain: string;
  windows: Partial<Record<ActivityWindow, ActivityQualityFeatureSet>>;
  generatedAt: string;
  featureVersion: string;
}

export interface EarlyParticipant {
  wallet: string;
  tokenId: string;
  chain: string;
  entryTime: string;
  secondsFromLaunch: number;
  entryPriceUsd?: number;
  initialSizeUsd: number;
  percentOfSupply?: number;
  liquidityPct?: number;
  currentPositionUsd?: number;
  realizedPnlUsd?: number;
  unrealizedPnlUsd?: number;
  fundingSource?: string;
  relationshipSignals: InsiderSignalCategory[];
  earlyParticipationScore: number;
  evidence: Evidence[];
}

export interface InsiderSignal {
  category: InsiderSignalCategory;
  strength: number;
  confidence: number;
  evidence: Evidence[];
}

export interface InsiderCandidate {
  wallet: string;
  token: string;
  score: number;
  confidence: number;
  signals: InsiderSignal[];
  evidence: Evidence[];
  firstObserved: string;
  lastObserved: string;
  status: InsiderCandidateStatus;
  labels: WalletActivityLabel[];
  explanation: string;
}

export interface InsiderDetectionReport {
  tokenId: string;
  chain: string;
  candidates: InsiderCandidate[];
  earlyParticipants: EarlyParticipant[];
  coordinatedEntryGroups: InsiderCandidate[][];
  coordinatedExitGroups: InsiderCandidate[][];
  highestConfidencePattern?: InsiderCandidate;
  confidence: number;
  limitations: string[];
  insiderDetectionVersion: string;
  featureVersion: string;
  generatedAt: string;
}

export interface ActivityAlertEvent {
  type: ActivityAlertEventType;
  tokenId: string;
  chain: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  evidence: Evidence[];
  confidence: number;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface WalletActivityProfile {
  walletAddress: string;
  chain: string;
  labels: WalletActivityLabel[];
  observedLaunches: number;
  earlyEntriesCount: number;
  profitableExitsCount: number;
  winRatePct?: number;
  averageReturnPct?: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  earlyEntries: EarlyParticipant[];
  fundingRelationships: WalletFundingEvent[];
  clusterMemberships: string[];
  recentTrades: NormalizedTrade[];
  activitySummary: Record<string, unknown>;
  updatedAt: string;
}

export interface ActivityPipelineResult {
  tokenId: string;
  chain: string;
  organicAssessment: OrganicActivityAssessment;
  insiderReport: InsiderDetectionReport;
  featureStore: ActivityFeatureStoreSnapshot;
  alertEvents: ActivityAlertEvent[];
  processedAt: string;
}

