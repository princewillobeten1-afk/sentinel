/**
 * Creator Entity & Launch History
 * Sprint 6
 *
 * Creator identification and launch history construction.
 * Uses the most authoritative observable source.
 * If ambiguous → Creator: Unknown.
 *
 * Avoids emotionally loaded labels.
 * Does not define "success" solely by price.
 */

import type {
  CreatorEntity,
  CreatorLaunchRecord,
  CreatorOutcomeType,
  CreatorBehaviorProfile,
  CreatorLiquidityEvent,
  CreatorSellingEvent,
  CreatorReputation,
} from './types';
import type { OwnershipEvidence, WalletRelationshipEdge } from '../ownership/types';

const METHODOLOGY_VERSION = 'creator-entity-v1.0';

// ────────────────────────────────────────────────────────────────────────────
// Input Types
// ────────────────────────────────────────────────────────────────────────────

export interface CreatorIdentificationInput {
  /** Address that deployed/created the token */
  deployerAddress?: string;
  /** Transaction that created the token */
  creationTx?: string;
  /** Chain */
  chain: string;
  /** Wallet addresses with known relationships to deployer */
  relatedWallets?: {
    address: string;
    relationship: WalletRelationshipEdge;
  }[];
  /** Known launches by this creator */
  launches?: CreatorLaunchInput[];
  /** Timestamp of data observation */
  dataTimestamp: string;
}

export interface CreatorLaunchInput {
  tokenId: string;
  tokenSymbol: string;
  tokenName: string;
  tokenAddress: string;
  chain: string;
  launchedAt: string;
  initialLiquidityUsd?: number;
  peakLiquidityUsd?: number;
  currentLiquidityUsd?: number;
  peakMarketCapUsd?: number;
  tradingDurationDays: number;
  liquidityEvents?: CreatorLiquidityEvent[];
  sellingEvents?: CreatorSellingEvent[];
  creatorRetainedPct?: number;
  creatorSoldPct?: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Creator Identification
// ────────────────────────────────────────────────────────────────────────────

/**
 * Identify a creator entity from available data.
 * Uses the deployer address as the authoritative identifier.
 * If no deployer is known, returns an "Unknown" creator entity.
 */
export function identifyCreator(input: CreatorIdentificationInput): CreatorEntity {
  const now = new Date().toISOString();

  if (!input.deployerAddress) {
    return createUnknownCreator(input.chain, now);
  }

  const launches = (input.launches || []).map(l => classifyLaunch(l, now));
  const associatedWallets = input.relatedWallets || [];

  const identificationEvidence: OwnershipEvidence[] = [{
    fact: `Token deployed by address ${input.deployerAddress}`,
    source: 'blockchain',
    observedAt: input.dataTimestamp,
    value: input.deployerAddress,
    confidence: 0.98,
  }];

  if (input.creationTx) {
    identificationEvidence.push({
      fact: `Creation transaction: ${input.creationTx}`,
      source: 'blockchain',
      observedAt: input.dataTimestamp,
      value: input.creationTx,
      confidence: 0.99,
    });
  }

  const behaviorProfile = buildBehaviorProfile(launches, associatedWallets);

  return {
    creatorId: `creator_${input.deployerAddress.slice(0, 16)}`,
    primaryAddress: input.deployerAddress,
    chain: input.chain,
    knownAddresses: [input.deployerAddress],
    launches,
    associatedWallets,
    behaviorProfile,
    reputation: createPendingReputation(),
    identificationEvidence,
    identificationConfidence: 0.95,
    methodologyVersion: METHODOLOGY_VERSION,
    updatedAt: now,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Launch Classification
// ────────────────────────────────────────────────────────────────────────────

/**
 * Classify a launch with a neutral outcome.
 * Outcome is determined by observable facts, not price judgment.
 */
function classifyLaunch(input: CreatorLaunchInput, now: string): CreatorLaunchRecord {
  const outcome = determineOutcome(input);

  return {
    tokenId: input.tokenId,
    tokenSymbol: input.tokenSymbol,
    tokenName: input.tokenName,
    tokenAddress: input.tokenAddress,
    chain: input.chain,
    launchedAt: input.launchedAt,
    initialLiquidityUsd: input.initialLiquidityUsd,
    peakLiquidityUsd: input.peakLiquidityUsd,
    currentLiquidityUsd: input.currentLiquidityUsd,
    peakMarketCapUsd: input.peakMarketCapUsd,
    tradingDurationDays: input.tradingDurationDays,
    liquidityEvents: input.liquidityEvents || [],
    sellingEvents: input.sellingEvents || [],
    creatorRetainedPct: input.creatorRetainedPct,
    creatorSoldPct: input.creatorSoldPct,
    outcome: outcome.type,
    outcomeConfidence: outcome.confidence,
    observedAt: now,
  };
}

/**
 * Determine launch outcome based on observable facts.
 * Never uses price alone to define success or failure.
 */
function determineOutcome(
  input: CreatorLaunchInput,
): { type: CreatorOutcomeType; confidence: number } {
  // Check for full liquidity removal
  const fullRemoval = (input.liquidityEvents || []).some(
    e => e.type === 'REMOVED' && e.poolPctAffected != null && e.poolPctAffected > 90,
  );
  if (fullRemoval) {
    return { type: 'LIQUIDITY_WITHDRAWN', confidence: 0.92 };
  }

  // Check for current liquidity vs initial
  if (
    input.initialLiquidityUsd != null &&
    input.currentLiquidityUsd != null &&
    input.initialLiquidityUsd > 0
  ) {
    const liquidityRatio = input.currentLiquidityUsd / input.initialLiquidityUsd;
    if (liquidityRatio < 0.05) {
      return { type: 'LIQUIDITY_WITHDRAWN', confidence: 0.85 };
    }
  }

  // Check for severe activity decline
  if (input.tradingDurationDays < 7 && input.tradingDurationDays > 0) {
    return { type: 'SEVERE_ACTIVITY_DECLINE', confidence: 0.75 };
  }

  // Check if currently active
  if (input.currentLiquidityUsd != null && input.currentLiquidityUsd > 100) {
    return { type: 'ACTIVE', confidence: 0.80 };
  }

  // Check if inactive (trading duration > 30 days but low current liquidity)
  if (input.tradingDurationDays > 30 && (!input.currentLiquidityUsd || input.currentLiquidityUsd < 100)) {
    return { type: 'INACTIVE', confidence: 0.70 };
  }

  return { type: 'UNKNOWN', confidence: 0.30 };
}

// ────────────────────────────────────────────────────────────────────────────
// Behavior Profile
// ────────────────────────────────────────────────────────────────────────────

function buildBehaviorProfile(
  launches: CreatorLaunchRecord[],
  associatedWallets: { address: string; relationship: WalletRelationshipEdge }[],
): CreatorBehaviorProfile {
  const evidence: OwnershipEvidence[] = [];
  const now = new Date().toISOString();

  if (launches.length === 0) {
    return {
      avgRetentionPct: 0,
      avgDaysToFirstSell: null,
      totalSellingEvents: 0,
      avgDaysToLiquidityWithdrawal: null,
      fullLiquidityRemovals: 0,
      associatedWalletCount: associatedWallets.length,
      evidence: [{
        fact: 'No launch history available for behavior analysis',
        source: 'creator_analysis',
        observedAt: now,
        confidence: 0.50,
      }],
    };
  }

  // Average retention
  const retentions = launches
    .filter(l => l.creatorRetainedPct != null)
    .map(l => l.creatorRetainedPct!);
  const avgRetention = retentions.length > 0
    ? retentions.reduce((s, v) => s + v, 0) / retentions.length
    : 0;

  // Days to first sell
  const firstSellDays: number[] = [];
  for (const launch of launches) {
    if (launch.sellingEvents.length > 0) {
      const launchTime = new Date(launch.launchedAt).getTime();
      const firstSell = new Date(launch.sellingEvents[0].timestamp).getTime();
      firstSellDays.push((firstSell - launchTime) / (1000 * 60 * 60 * 24));
    }
  }
  const avgDaysToFirstSell = firstSellDays.length > 0
    ? firstSellDays.reduce((s, v) => s + v, 0) / firstSellDays.length
    : null;

  // Total selling events
  const totalSellingEvents = launches.reduce((s, l) => s + l.sellingEvents.length, 0);

  // Days to liquidity withdrawal
  const liqWithdrawalDays: number[] = [];
  for (const launch of launches) {
    const removals = launch.liquidityEvents.filter(e => e.type === 'REMOVED');
    if (removals.length > 0) {
      const launchTime = new Date(launch.launchedAt).getTime();
      const firstRemoval = new Date(removals[0].timestamp).getTime();
      liqWithdrawalDays.push((firstRemoval - launchTime) / (1000 * 60 * 60 * 24));
    }
  }
  const avgDaysToLiquidityWithdrawal = liqWithdrawalDays.length > 0
    ? liqWithdrawalDays.reduce((s, v) => s + v, 0) / liqWithdrawalDays.length
    : null;

  // Full liquidity removals
  const fullLiquidityRemovals = launches.filter(
    l => l.outcome === 'LIQUIDITY_WITHDRAWN',
  ).length;

  evidence.push({
    fact: `Analyzed ${launches.length} launches: avg retention ${avgRetention.toFixed(1)}%, ${totalSellingEvents} total selling events`,
    source: 'creator_analysis',
    observedAt: now,
    value: launches.length,
    confidence: Math.min(0.90, 0.5 + launches.length * 0.1),
  });

  return {
    avgRetentionPct: Math.round(avgRetention * 100) / 100,
    avgDaysToFirstSell: avgDaysToFirstSell != null ? Math.round(avgDaysToFirstSell * 100) / 100 : null,
    totalSellingEvents,
    avgDaysToLiquidityWithdrawal: avgDaysToLiquidityWithdrawal != null ? Math.round(avgDaysToLiquidityWithdrawal * 100) / 100 : null,
    fullLiquidityRemovals,
    associatedWalletCount: associatedWallets.length,
    evidence,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function createUnknownCreator(chain: string, now: string): CreatorEntity {
  return {
    creatorId: `creator_unknown_${Date.now()}`,
    primaryAddress: '',
    chain,
    knownAddresses: [],
    launches: [],
    associatedWallets: [],
    behaviorProfile: {
      avgRetentionPct: 0,
      avgDaysToFirstSell: null,
      totalSellingEvents: 0,
      avgDaysToLiquidityWithdrawal: null,
      fullLiquidityRemovals: 0,
      associatedWalletCount: 0,
      evidence: [{
        fact: 'Creator could not be identified from available data',
        source: 'creator_analysis',
        observedAt: now,
        confidence: 0.10,
      }],
    },
    reputation: createPendingReputation(),
    identificationEvidence: [{
      fact: 'Creator address unknown — insufficient data for identification',
      source: 'creator_analysis',
      observedAt: now,
      confidence: 0.10,
    }],
    identificationConfidence: 0.0,
    methodologyVersion: METHODOLOGY_VERSION,
    updatedAt: now,
  };
}

function createPendingReputation(): CreatorReputation {
  return {
    score: null,
    level: 'UNKNOWN',
    confidence: 0,
    confidenceLevel: 'INSUFFICIENT',
    dimensions: [],
    patterns: [],
    limitations: ['Reputation has not been calculated yet'],
    sampleSize: 0,
    methodologyVersion: 'pending',
    generatedAt: new Date().toISOString(),
  };
}
