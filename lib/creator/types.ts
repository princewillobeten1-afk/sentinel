/**
 * Creator Reputation System — Core Type System
 * Sprint 6
 *
 * Defines all domain types for creator identification, launch history,
 * behavior analysis, cross-token pattern detection, and reputation scoring.
 *
 * Core principle: Association ≠ confirmed ownership.
 * Avoid emotionally loaded labels (SCAMMER, FRAUD, RUGGER).
 * Use neutral, evidence-based classifications.
 */

import type { OwnershipEvidence, WalletRelationshipEdge } from '../ownership/types';

// ────────────────────────────────────────────────────────────────────────────
// Creator Outcome Types (§24 — neutral labels only)
// ────────────────────────────────────────────────────────────────────────────

export type CreatorOutcomeType =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'LIQUIDITY_WITHDRAWN'
  | 'SEVERE_ACTIVITY_DECLINE'
  | 'UNKNOWN';

// ────────────────────────────────────────────────────────────────────────────
// Creator Liquidity Event Types (§27)
// ────────────────────────────────────────────────────────────────────────────

export type LiquidityEventType = 'ADDED' | 'REMOVED' | 'MIGRATED';

// ────────────────────────────────────────────────────────────────────────────
// Creator Selling Event (§26)
// ────────────────────────────────────────────────────────────────────────────

export interface CreatorSellingEvent {
  id: string;
  timestamp: string;
  /** Percentage of creator's observed position sold */
  amountPct: number;
  amountTokens?: number;
  estimatedValueUsd?: number;
  txSignature?: string;
  /** Factual context — not a judgment */
  context: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Creator Liquidity Event (§27)
// ────────────────────────────────────────────────────────────────────────────

export interface CreatorLiquidityEvent {
  id: string;
  type: LiquidityEventType;
  amountUsd: number;
  /** Percentage of total pool liquidity affected */
  poolPctAffected?: number;
  timestamp: string;
  txSignature?: string;
  poolId?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Creator Launch Record (§23)
// ────────────────────────────────────────────────────────────────────────────

export interface CreatorLaunchRecord {
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  tokenAddress: string;
  chain: string;
  launchedAt: string;             // ISO

  // Market metrics at peak and current
  initialLiquidityUsd?: number;
  peakLiquidityUsd?: number;
  currentLiquidityUsd?: number;
  peakMarketCapUsd?: number;

  /** Duration in days from launch to last observable activity */
  tradingDurationDays: number;

  // Events
  liquidityEvents: CreatorLiquidityEvent[];
  sellingEvents: CreatorSellingEvent[];

  // Creator wallet activity
  creatorRetainedPct?: number;     // % still held by creator
  creatorSoldPct?: number;         // % sold by creator

  // Outcome (§24 — neutral labels)
  outcome: CreatorOutcomeType;
  outcomeConfidence: number;       // 0.0 – 1.0

  observedAt: string;              // ISO
}

// ────────────────────────────────────────────────────────────────────────────
// Creator Behavior (§25)
// ────────────────────────────────────────────────────────────────────────────

export interface CreatorBehaviorProfile {
  /** Average % of tokens retained across launches */
  avgRetentionPct: number;
  /** Average selling speed (days from launch to first sell) */
  avgDaysToFirstSell: number | null;
  /** Total selling events across all launches */
  totalSellingEvents: number;
  /** Average liquidity retention (days before first withdrawal) */
  avgDaysToLiquidityWithdrawal: number | null;
  /** Number of launches where liquidity was fully removed */
  fullLiquidityRemovals: number;
  /** Creator-associated wallets */
  associatedWalletCount: number;
  /** Summary evidence */
  evidence: OwnershipEvidence[];
}

// ────────────────────────────────────────────────────────────────────────────
// Creator Pattern Detection (§34, §35)
// ────────────────────────────────────────────────────────────────────────────

export type CreatorPatternType =
  | 'REPEATED_EARLY_DISTRIBUTION'
  | 'REPEATED_CREATOR_SELLING'
  | 'REPEATED_LIQUIDITY_WITHDRAWAL'
  | 'REPEATED_WALLET_CLUSTERS'
  | 'REPEATED_FUNDING_STRUCTURES'
  | 'CONSISTENT_RETENTION'
  | 'CONSISTENT_LIQUIDITY_PROVISION';

export interface CreatorPattern {
  type: CreatorPatternType;
  /** How many launches exhibit this pattern */
  occurrenceCount: number;
  /** Total launches analyzed */
  totalLaunches: number;
  /** Time period of observations */
  timePeriod: { from: string; to: string };
  evidence: OwnershipEvidence[];
  confidence: number;           // 0.0 – 1.0
}

// ────────────────────────────────────────────────────────────────────────────
// Reputation Dimensions (§28)
// ────────────────────────────────────────────────────────────────────────────

export type ReputationDimensionName =
  | 'LAUNCH_HISTORY'
  | 'LIQUIDITY_BEHAVIOR'
  | 'TOKEN_RETENTION'
  | 'OBSERVED_SELLING'
  | 'CREATOR_TRANSPARENCY'
  | 'ASSOCIATED_WALLET_BEHAVIOR'
  | 'HISTORICAL_ANOMALIES'
  | 'DATA_CONFIDENCE';

export interface ReputationDimension {
  name: ReputationDimensionName;
  score: number;                // 0–100
  weight: number;               // 0.0 – 1.0 (dimension weight)
  evidence: OwnershipEvidence[];
  description: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Creator Reputation (§28, §29, §30, §31)
// ────────────────────────────────────────────────────────────────────────────

export type ReputationLevel =
  | 'STRONG'         // 90–100
  | 'FAVORABLE'      // 75–89
  | 'MIXED'          // 60–74
  | 'ELEVATED'       // 40–59
  | 'HIGH_CONCERN'   // 20–39
  | 'SEVERE'         // 0–19
  | 'UNKNOWN';       // Insufficient data

export type ReputationConfidenceLevel = 'HIGH' | 'MODERATE' | 'LOW' | 'INSUFFICIENT';

export interface CreatorReputation {
  score: number | null;          // 0–100, null if insufficient data
  level: ReputationLevel;
  confidence: number;            // 0.0 – 1.0
  confidenceLevel: ReputationConfidenceLevel;
  dimensions: ReputationDimension[];
  patterns: CreatorPattern[];
  limitations: string[];
  sampleSize: number;            // number of launches analyzed
  methodologyVersion: string;
  generatedAt: string;           // ISO
}

// ────────────────────────────────────────────────────────────────────────────
// Creator Reputation Snapshot (§45)
// ────────────────────────────────────────────────────────────────────────────

export interface CreatorReputationSnapshot {
  id: string;
  creatorAddress: string;
  score: number | null;
  confidence: number;
  confidenceLevel: ReputationConfidenceLevel;
  dimensionScores: Record<ReputationDimensionName, number>;
  sampleSize: number;
  methodologyVersion: string;
  snapshotAt: string;            // ISO
}

// ────────────────────────────────────────────────────────────────────────────
// Creator Entity (§22)
// ────────────────────────────────────────────────────────────────────────────

export interface CreatorEntity {
  creatorId: string;
  /** Primary creator address */
  primaryAddress: string;
  chain: string;
  /** All known addresses associated with this creator */
  knownAddresses: string[];
  /** Launch history */
  launches: CreatorLaunchRecord[];
  /** Associated wallets with relationship evidence */
  associatedWallets: {
    address: string;
    relationship: WalletRelationshipEdge;
  }[];
  /** Behavior profile summary */
  behaviorProfile: CreatorBehaviorProfile;
  /** Reputation assessment */
  reputation: CreatorReputation;
  /** Evidence for creator identification */
  identificationEvidence: OwnershipEvidence[];
  /** Confidence in creator identification (§21) */
  identificationConfidence: number;
  /** Methodology version */
  methodologyVersion: string;
  updatedAt: string;             // ISO
}

// ────────────────────────────────────────────────────────────────────────────
// Creator Association Signals (§32, §33)
// ────────────────────────────────────────────────────────────────────────────

export interface CreatorAssociationSignal {
  walletAddress: string;
  associationType: 'FUNDING' | 'TRANSFER' | 'BEHAVIOR' | 'LAUNCH_COORDINATION' | 'HISTORICAL';
  strength: number;             // 0.0 – 1.0
  evidence: OwnershipEvidence[];
  confidence: number;           // 0.0 – 1.0
}
