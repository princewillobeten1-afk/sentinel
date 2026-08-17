import type { InsiderDetectionReport, OrganicActivityAssessment } from '@/lib/activity/types';

/**
 * Sentinel Token Intelligence Engine — Core Type System
 * Sprint 5
 *
 * Every intelligence domain type lives here. No business logic.
 * Future sprints may extend but should not break these interfaces.
 */

// ────────────────────────────────────────────────────────────────────────────
// Enums & Literals
// ────────────────────────────────────────────────────────────────────────────

export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RiskLevel =
  | 'STRONG'
  | 'FAVORABLE'
  | 'MIXED'
  | 'ELEVATED'
  | 'HIGH_CONCERN'
  | 'SEVERE';

export type FreshnessLevel = 'CURRENT' | 'RECENT' | 'DELAYED' | 'STALE' | 'MISSING';

export type RiskCategory =
  | 'MARKET'
  | 'LIQUIDITY'
  | 'OWNERSHIP'
  | 'CREATOR'
  | 'ACTIVITY'
  | 'CONTRACT'
  | 'EXIT';

export type SignalPolarity = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'INFO';

export type ConfidenceLevel = 'HIGH' | 'MODERATE' | 'LOW' | 'INSUFFICIENT';

export type LiquidityWithdrawalSeverity = 'NORMAL' | 'ELEVATED' | 'SIGNIFICANT' | 'SEVERE';

export type ActivityQuality = 'HIGH' | 'MODERATE' | 'LOW' | 'UNKNOWN';

export type DimensionStatus = 'STRONG' | 'MODERATE' | 'ELEVATED' | 'UNKNOWN';

// ────────────────────────────────────────────────────────────────────────────
// Evidence
// ────────────────────────────────────────────────────────────────────────────

export interface Evidence {
  fact: string;
  source: string;
  observedAt: string; // ISO timestamp
  value?: string | number;
  confidence: number; // 0.0 – 1.0
}

// ────────────────────────────────────────────────────────────────────────────
// Intelligence Signal
// ────────────────────────────────────────────────────────────────────────────

export interface IntelligenceSignal {
  id: string;
  type: string;
  category: RiskCategory;
  severity: Severity;
  polarity: SignalPolarity;
  value: string | number;
  confidence: number; // 0.0 – 1.0
  evidence: Evidence[];
  observedAt: string; // ISO timestamp
  expiresAt?: string; // ISO timestamp — signal may become irrelevant
  methodologyVersion: string;
  metadata: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// Risk Dimension (per-category risk score)
// ────────────────────────────────────────────────────────────────────────────

export interface RiskDimension {
  category: RiskCategory;
  score: number; // 0–100 (100 = best / lowest risk)
  level: DimensionStatus;
  confidence: number; // 0.0 – 1.0
  evidence: Evidence[];
  signals: IntelligenceSignal[];
  lastUpdated: string; // ISO timestamp
}

// ────────────────────────────────────────────────────────────────────────────
// Confidence
// ────────────────────────────────────────────────────────────────────────────

export interface Confidence {
  score: number; // 0–100
  level: ConfidenceLevel;
  dataCoverage: number; // 0.0 – 1.0 fraction of dimensions with data
  freshness: FreshnessLevel;
  limitations: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Data Freshness
// ────────────────────────────────────────────────────────────────────────────

export interface DataSourceFreshness {
  source: string;
  lastUpdated: string; // ISO timestamp
  level: FreshnessLevel;
}

export interface DataFreshness {
  overall: FreshnessLevel;
  sources: DataSourceFreshness[];
  stalestSource?: string;
  lastChecked: string; // ISO timestamp
}

// ────────────────────────────────────────────────────────────────────────────
// Token Intelligence Report — the master output
// ────────────────────────────────────────────────────────────────────────────

export interface TokenIntelligenceReport {
  // Identity
  token: TokenIdentity;
  chain: string;

  // Timestamps & Versioning
  generatedAt: string; // ISO timestamp
  methodologyVersion: string;
  dataVersion: string;

  // Freshness
  dataFreshness: DataFreshness;

  // Scores
  overallScore: number; // 0–100
  riskLevel: RiskLevel;
  confidence: Confidence;

  // Signals (categorized)
  signals: IntelligenceSignal[];
  warnings: IntelligenceSignal[];
  positives: IntelligenceSignal[];
  missingData: MissingDataEntry[];

  // Risk dimensions
  riskDimensions: Record<RiskCategory, RiskDimension>;

  // Exitability
  priceImpactEstimates: PriceImpactEstimate[];

  // Structured observations
  holderSnapshot?: HolderSnapshot;
  contractObservation?: ContractObservation;
  creatorObservation?: CreatorObservation;
  organicActivity?: OrganicActivityAssessment;
  insiderReport?: InsiderDetectionReport;

  // Explanation
  explanation: string;

  // Timeline
  recentTimeline: IntelligenceTimelineEvent[];
}

// ────────────────────────────────────────────────────────────────────────────
// Token Identity (lightweight, for embedding in reports)
// ────────────────────────────────────────────────────────────────────────────

export interface TokenIdentity {
  id: string;
  symbol: string;
  name: string;
  address: string;
  chain: string;
  logoUri?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Missing Data
// ────────────────────────────────────────────────────────────────────────────

export interface MissingDataEntry {
  category: RiskCategory | 'GENERAL';
  description: string;
  impact: 'REDUCES_CONFIDENCE' | 'LIMITS_ANALYSIS' | 'INFORMATIONAL';
}

// ────────────────────────────────────────────────────────────────────────────
// Timeline Events
// ────────────────────────────────────────────────────────────────────────────

export interface IntelligenceTimelineEvent {
  id: string;
  timestamp: string; // ISO
  category: RiskCategory | 'GENERAL';
  severity: Severity;
  title: string;
  description: string;
  evidence: Evidence[];
  metadata?: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// Intelligence Snapshot (historical)
// ────────────────────────────────────────────────────────────────────────────

export interface IntelligenceSnapshot {
  id: string;
  tokenId: string;
  overallScore: number;
  riskLevel: RiskLevel;
  confidence: number;
  riskScores: Record<RiskCategory, number>;
  signalCount: number;
  warningCount: number;
  positiveCount: number;
  methodologyVersion: string;
  snapshotAt: string; // ISO
}

// ────────────────────────────────────────────────────────────────────────────
// Price Impact / Exitability
// ────────────────────────────────────────────────────────────────────────────

export interface PriceImpactEstimate {
  sellAmountUsd: number;
  estimatedOutputUsd: number;
  priceImpactPct: number;
  liquidityConsumedPct: number;
  isSimulation: true; // Always — these are never guarantees
}

// ────────────────────────────────────────────────────────────────────────────
// Holder Analysis
// ────────────────────────────────────────────────────────────────────────────

export interface HolderSnapshot {
  tokenId: string;
  holderCount: number;
  top1Pct: number;
  top5Pct: number;
  top10Pct: number;
  holderGrowthPct: number;
  distribution: HolderBucket[];
  snapshotAt: string; // ISO
  dataCompleteness: number; // 0.0 – 1.0
}

export interface HolderBucket {
  label: string; // e.g. ">1%", "0.1-1%", "<0.01%"
  count: number;
  totalSharePct: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Contract / Program Observation
// ────────────────────────────────────────────────────────────────────────────

export interface ContractObservation {
  tokenId: string;
  chain: string;

  // Authorities
  mintAuthority: AuthorityState;
  freezeAuthority: AuthorityState;

  // Supply
  totalSupply: string;
  circulatingSupply?: string;
  supplyChangeable: boolean;

  // Metadata
  metadataUri?: string;
  metadataChangeable: boolean;
  name: string;
  symbol: string;

  // Program
  programId?: string;
  isUpgradeable?: boolean;

  observedAt: string; // ISO
  dataCompleteness: number; // 0.0 – 1.0
}

export interface AuthorityState {
  status: 'ACTIVE' | 'REVOKED' | 'UNKNOWN';
  address?: string;
  explanation: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Creator Observation (foundation — Sprint 5)
// ────────────────────────────────────────────────────────────────────────────

export interface CreatorObservation {
  tokenId: string;
  creatorAddress?: string;
  creationTimestamp?: string; // ISO
  creationTx?: string;
  knownLaunches: number;
  historyAvailable: boolean;
  observedAt: string; // ISO
}

// Future Sprint 6+ data structures (typed but not fully populated)
export interface CreatorLaunch {
  tokenId: string;
  tokenSymbol: string;
  launchedAt: string;
  outcome?: 'ACTIVE' | 'INACTIVE' | 'LIQUIDITY_REMOVED' | 'SUSPICIOUS' | 'UNKNOWN';
}

export interface CreatorOutcome {
  creatorAddress: string;
  launches: CreatorLaunch[];
  reputationScore?: number; // Not computed in Sprint 5
}

// ────────────────────────────────────────────────────────────────────────────
// Wallet Cluster Foundation (Sprint 5 groundwork)
// ────────────────────────────────────────────────────────────────────────────

export type WalletRelationshipType =
  | 'SHARED_FUNDING'
  | 'SIMILAR_TIMING'
  | 'COMMON_INTERACTION'
  | 'KNOWN_PROGRAM'
  | 'TRANSFER';

export interface WalletEntity {
  address: string;
  chain: string;
  labels: string[];
  firstSeen?: string;
  lastSeen?: string;
}

export interface WalletRelationship {
  id: string;
  walletA: string;
  walletB: string;
  relationshipType: WalletRelationshipType;
  confidence: number; // 0.0 – 1.0
  evidence: Evidence[];
  observedAt: string;
}

export interface WalletCluster {
  id: string;
  wallets: string[];
  relationships: WalletRelationship[];
  clusterConfidence: number;
  label?: string;
  createdAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Organic Volume Foundation (interface only — Sprint 5)
// ────────────────────────────────────────────────────────────────────────────

export interface OrganicVolumeFeatures {
  uniqueActiveWallets: number;
  repeatWalletRatio: number;
  txSizeDistribution: { bucket: string; count: number }[];
  volumeConcentration: number; // 0.0 – 1.0
  temporalClustering: number; // 0.0 – 1.0
  buySellDiversity: number; // 0.0 – 1.0
  walletAgeDistribution: { bucket: string; count: number }[];
}

// ────────────────────────────────────────────────────────────────────────────
// Insider Detection Foundation (interface only — Sprint 5)
// ────────────────────────────────────────────────────────────────────────────

export interface InsiderDetectionInput {
  walletRelationships: WalletRelationship[];
  fundingRelationships: WalletRelationship[];
  tokenAcquisitionTiming: { wallet: string; acquiredAt: string; amount: number }[];
  positionChanges: { wallet: string; changedAt: string; delta: number }[];
  transferRelationships: WalletRelationship[];
  clusterBehavior: WalletCluster[];
  launchTimeActivity: { wallet: string; action: string; timestamp: string }[];
}

// ────────────────────────────────────────────────────────────────────────────
// Risk Rule
// ────────────────────────────────────────────────────────────────────────────

export interface RiskRuleDefinition {
  id: string;
  category: RiskCategory;
  severity: Severity;
  explanation: string;
  methodologyVersion: string;
}

// ────────────────────────────────────────────────────────────────────────────
// AI Explanation Interface (Sprint 5 stub)
// ────────────────────────────────────────────────────────────────────────────

export interface AIExplanationInput {
  report: TokenIntelligenceReport;
  maxLength?: number;
  audience: 'beginner' | 'intermediate' | 'advanced';
}

export interface AIExplanationOutput {
  summary: string;
  highlights: string[];
  citedSignalIds: string[];
  generatedAt: string;
  disclaimer: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Engine Result (common output shape from each engine)
// ────────────────────────────────────────────────────────────────────────────

export interface EngineResult {
  dimension: RiskDimension;
  signals: IntelligenceSignal[];
  missingData: MissingDataEntry[];
}
