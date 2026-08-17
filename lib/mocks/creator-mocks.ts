/**
 * Creator Mock Data
 * Sprint 6
 *
 * Creator entities with launch histories, behavior patterns, and reputation data.
 *
 * Scenarios:
 * - SENT creator: Known creator, 4 launches, good history, favorable reputation
 * - QUANT creator: Unknown creator
 * - BONK creator: Known creator, long history, 12 launches, mixed outcomes
 * - ALPHA creator: Known creator, 8 launches, concerning pattern (repeated early selling + liquidity withdrawal)
 */

import type { CreatorEntity, CreatorReputation, CreatorLaunchRecord, CreatorPattern } from '../creator/types';

const now = new Date().toISOString();
const oneMonthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
const threeMonthsAgo = new Date(Date.now() - 90 * 86400000).toISOString();
const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString();
const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString();

// ────────────────────────────────────────────────────────────────────────────
// Mock Creator Entities
// ────────────────────────────────────────────────────────────────────────────

export function getMockCreatorEntity(symbol: string): CreatorEntity | null {
  switch (symbol.toUpperCase()) {
    case 'SENT': return SENT_CREATOR;
    case 'QUANT': return QUANT_CREATOR;
    case 'BONK': return BONK_CREATOR;
    case 'ALPHA': return ALPHA_CREATOR;
    default: return null;
  }
}

// ── SENT Creator — Good reputation ──

const SENT_CREATOR: CreatorEntity = {
  creatorId: 'creator_SENTcreator1234',
  primaryAddress: 'SENTcreator1234abcd5678efgh9012',
  chain: 'solana',
  knownAddresses: ['SENTcreator1234abcd5678efgh9012'],
  launches: [
    mkLaunch('prev_sent_1', 'BETA', 'Beta Protocol', oneYearAgo, 50000, 120000, 45000, 800000, 365, 'ACTIVE', 0.92, 70, 10),
    mkLaunch('prev_sent_2', 'GAMMA', 'Gamma Finance', sixMonthsAgo, 30000, 85000, 35000, 500000, 180, 'ACTIVE', 0.88, 65, 15),
    mkLaunch('prev_sent_3', 'DELTA', 'Delta Network', threeMonthsAgo, 20000, 60000, 55000, 350000, 90, 'ACTIVE', 0.85, 80, 5),
    mkLaunch('dt_sentinel', 'SENT', 'Solana Sentinel Token', oneMonthAgo, 40000, 150000, 140000, 1200000, 30, 'ACTIVE', 0.90, 85, 5),
  ],
  associatedWallets: [],
  behaviorProfile: {
    avgRetentionPct: 75.0,
    avgDaysToFirstSell: 45.0,
    totalSellingEvents: 8,
    avgDaysToLiquidityWithdrawal: null,
    fullLiquidityRemovals: 0,
    associatedWalletCount: 0,
    evidence: [{ fact: 'Analyzed 4 launches: avg retention 75%, 8 total selling events', source: 'creator_analysis', observedAt: now, confidence: 0.85 }],
  },
  reputation: {
    score: 78,
    level: 'FAVORABLE',
    confidence: 0.65,
    confidenceLevel: 'MODERATE',
    dimensions: [
      { name: 'LAUNCH_HISTORY', score: 90, weight: 0.20, evidence: [{ fact: '4 launches: 4 active, 0 withdrawn', source: 'reputation_engine', observedAt: now, confidence: 0.85 }], description: '4 launches — all currently active' },
      { name: 'LIQUIDITY_BEHAVIOR', score: 85, weight: 0.18, evidence: [{ fact: '0 out of 4 launches had full liquidity removal', source: 'reputation_engine', observedAt: now, confidence: 0.88 }], description: '0/4 launches with liquidity removal' },
      { name: 'TOKEN_RETENTION', score: 85, weight: 0.15, evidence: [{ fact: 'Average token retention: 75%', source: 'reputation_engine', observedAt: now, confidence: 0.82 }], description: 'Average 75% token retention' },
      { name: 'OBSERVED_SELLING', score: 75, weight: 0.12, evidence: [{ fact: '8 selling events, avg 45 days to first sell', source: 'reputation_engine', observedAt: now, confidence: 0.85 }], description: 'Avg 45 days to first sell' },
      { name: 'CREATOR_TRANSPARENCY', score: 80, weight: 0.10, evidence: [{ fact: 'Creator identified, on-chain history available', source: 'reputation_engine', observedAt: now, confidence: 0.80 }], description: 'Creator address identified' },
      { name: 'ASSOCIATED_WALLET_BEHAVIOR', score: 70, weight: 0.10, evidence: [{ fact: '0 wallets associated with creator', source: 'reputation_engine', observedAt: now, confidence: 0.75 }], description: '0 associated wallets' },
      { name: 'HISTORICAL_ANOMALIES', score: 80, weight: 0.08, evidence: [{ fact: '1 positive pattern detected (consistent retention)', source: 'reputation_engine', observedAt: now, confidence: 0.80 }], description: '0 concerns, 1 positive' },
      { name: 'DATA_CONFIDENCE', score: 72, weight: 0.07, evidence: [{ fact: '4 launches with 100% data completeness', source: 'reputation_engine', observedAt: now, confidence: 0.90 }], description: '4 launches, 100% data coverage' },
    ],
    patterns: [
      { type: 'CONSISTENT_RETENTION', occurrenceCount: 4, totalLaunches: 4, timePeriod: { from: oneYearAgo, to: oneMonthAgo }, evidence: [{ fact: 'All 4 launches show >50% token retention', source: 'creator_behavior', observedAt: now, confidence: 0.85 }], confidence: 0.82 },
    ],
    limitations: [],
    sampleSize: 4,
    methodologyVersion: 'creator-reputation-v1.0',
    generatedAt: now,
  },
  identificationEvidence: [{ fact: 'Token deployed by SENTcreator1234abcd', source: 'blockchain', observedAt: now, value: 'SENTcreator1234abcd5678efgh9012', confidence: 0.98 }],
  identificationConfidence: 0.95,
  methodologyVersion: 'creator-entity-v1.0',
  updatedAt: now,
};

// ── QUANT Creator — Unknown ──

const QUANT_CREATOR: CreatorEntity = {
  creatorId: 'creator_unknown_quant',
  primaryAddress: '',
  chain: 'solana',
  knownAddresses: [],
  launches: [],
  associatedWallets: [],
  behaviorProfile: {
    avgRetentionPct: 0, avgDaysToFirstSell: null, totalSellingEvents: 0,
    avgDaysToLiquidityWithdrawal: null, fullLiquidityRemovals: 0, associatedWalletCount: 0,
    evidence: [{ fact: 'Creator could not be identified', source: 'creator_analysis', observedAt: now, confidence: 0.10 }],
  },
  reputation: {
    score: null, level: 'UNKNOWN', confidence: 0, confidenceLevel: 'INSUFFICIENT',
    dimensions: [], patterns: [], limitations: ['Creator address unknown — reputation cannot be assessed'],
    sampleSize: 0, methodologyVersion: 'creator-reputation-v1.0', generatedAt: now,
  },
  identificationEvidence: [{ fact: 'Creator address unknown', source: 'creator_analysis', observedAt: now, confidence: 0.10 }],
  identificationConfidence: 0.0,
  methodologyVersion: 'creator-entity-v1.0',
  updatedAt: now,
};

// ── BONK Creator — Long history, mixed ──

const BONK_CREATOR: CreatorEntity = {
  creatorId: 'creator_BONKcreator5678',
  primaryAddress: 'BONKcreator5678abcd1234efgh5678',
  chain: 'solana',
  knownAddresses: ['BONKcreator5678abcd1234efgh5678'],
  launches: [
    mkLaunch('prev_bonk_1', 'WOOF', 'Woof Coin', oneYearAgo, 10000, 45000, 0, 200000, 45, 'INACTIVE', 0.75, 20, 60),
    mkLaunch('prev_bonk_2', 'BARK', 'Bark Token', oneYearAgo, 15000, 80000, 0, 400000, 60, 'LIQUIDITY_WITHDRAWN', 0.88, 0, 90),
    mkLaunch('prev_bonk_3', 'PAWS', 'Paws Protocol', sixMonthsAgo, 25000, 150000, 120000, 800000, 180, 'ACTIVE', 0.85, 55, 25),
    mkLaunch('dt_bonk', 'BONK', 'Bonk Doge Token', threeMonthsAgo, 100000, 500000, 450000, 5000000, 90, 'ACTIVE', 0.90, 60, 20),
  ],
  associatedWallets: [
    { address: 'BONKassoc1234abcd', relationship: { id: 'edge_bonk_assoc', source: 'BONKcreator5678abcd1234efgh5678', target: 'BONKassoc1234abcd', type: 'DIRECT_TRANSFER', strength: 0.72, evidence: [{ fact: 'Direct transfer of 5 SOL', source: 'funding_analysis', observedAt: now, confidence: 0.88 }], firstObserved: sixMonthsAgo, lastObserved: now, confidence: 0.85, methodologyVersion: 'funding-analysis-v1.0' } },
  ],
  behaviorProfile: {
    avgRetentionPct: 33.75,
    avgDaysToFirstSell: 12.0,
    totalSellingEvents: 18,
    avgDaysToLiquidityWithdrawal: 45.0,
    fullLiquidityRemovals: 1,
    associatedWalletCount: 1,
    evidence: [{ fact: 'Analyzed 4 launches: avg retention 33.75%, 18 total selling events', source: 'creator_analysis', observedAt: now, confidence: 0.85 }],
  },
  reputation: {
    score: 58,
    level: 'ELEVATED',
    confidence: 0.65,
    confidenceLevel: 'MODERATE',
    dimensions: [
      { name: 'LAUNCH_HISTORY', score: 55, weight: 0.20, evidence: [{ fact: '4 launches: 2 active, 1 inactive, 1 withdrawn', source: 'reputation_engine', observedAt: now, confidence: 0.85 }], description: '4 launches — 2 active, 1 withdrawn' },
      { name: 'LIQUIDITY_BEHAVIOR', score: 52, weight: 0.18, evidence: [{ fact: '1 out of 4 launches had full liquidity removal', source: 'reputation_engine', observedAt: now, confidence: 0.88 }], description: '1/4 launches with liquidity removal' },
      { name: 'TOKEN_RETENTION', score: 40, weight: 0.15, evidence: [{ fact: 'Average retention: 33.75%', source: 'reputation_engine', observedAt: now, confidence: 0.82 }], description: 'Average 33.75% token retention' },
      { name: 'OBSERVED_SELLING', score: 50, weight: 0.12, evidence: [{ fact: '18 selling events, avg 12 days to first sell', source: 'reputation_engine', observedAt: now, confidence: 0.85 }], description: 'Avg 12 days to first sell' },
      { name: 'CREATOR_TRANSPARENCY', score: 80, weight: 0.10, evidence: [{ fact: 'Creator identified', source: 'reputation_engine', observedAt: now, confidence: 0.80 }], description: 'Creator address identified' },
      { name: 'ASSOCIATED_WALLET_BEHAVIOR', score: 60, weight: 0.10, evidence: [{ fact: '1 associated wallet', source: 'reputation_engine', observedAt: now, confidence: 0.75 }], description: '1 associated wallet' },
      { name: 'HISTORICAL_ANOMALIES', score: 55, weight: 0.08, evidence: [{ fact: 'Mixed patterns', source: 'reputation_engine', observedAt: now, confidence: 0.75 }], description: '1 concern, 0 positives' },
      { name: 'DATA_CONFIDENCE', score: 72, weight: 0.07, evidence: [{ fact: '4 launches, 100% data completeness', source: 'reputation_engine', observedAt: now, confidence: 0.90 }], description: '4 launches, 100% coverage' },
    ],
    patterns: [],
    limitations: [],
    sampleSize: 4,
    methodologyVersion: 'creator-reputation-v1.0',
    generatedAt: now,
  },
  identificationEvidence: [{ fact: 'Token deployed by BONKcreator5678', source: 'blockchain', observedAt: now, confidence: 0.98 }],
  identificationConfidence: 0.95,
  methodologyVersion: 'creator-entity-v1.0',
  updatedAt: now,
};

// ── ALPHA Creator — Concerning patterns ──

const ALPHA_CREATOR: CreatorEntity = {
  creatorId: 'creator_ALPHcreator9012',
  primaryAddress: 'ALPHcreator9012abcd3456efgh7890',
  chain: 'solana',
  knownAddresses: ['ALPHcreator9012abcd3456efgh7890', 'ALPHh1a2b3c4d5e6f7g8h9i0j'],
  launches: [
    mkLaunch('prev_alpha_1', 'NOVA', 'Nova AI', oneYearAgo, 5000, 30000, 0, 100000, 5, 'LIQUIDITY_WITHDRAWN', 0.92, 0, 95, true),
    mkLaunch('prev_alpha_2', 'STAR', 'Star Protocol', oneYearAgo, 8000, 45000, 0, 180000, 7, 'LIQUIDITY_WITHDRAWN', 0.90, 0, 90, true),
    mkLaunch('prev_alpha_3', 'MOON', 'Moon Dex', sixMonthsAgo, 10000, 55000, 0, 250000, 4, 'LIQUIDITY_WITHDRAWN', 0.93, 0, 92, true),
    mkLaunch('prev_alpha_4', 'ORBIT', 'Orbit Chain', sixMonthsAgo, 12000, 70000, 500, 300000, 14, 'SEVERE_ACTIVITY_DECLINE', 0.80, 5, 85, true),
    mkLaunch('prev_alpha_5', 'PULSE', 'Pulse Network', threeMonthsAgo, 15000, 90000, 0, 450000, 3, 'LIQUIDITY_WITHDRAWN', 0.95, 0, 95, true),
    mkLaunch('prev_alpha_6', 'WAVE', 'Wave Finance', threeMonthsAgo, 8000, 40000, 2000, 200000, 21, 'INACTIVE', 0.72, 10, 75),
    mkLaunch('prev_alpha_7', 'FLUX', 'Flux Protocol', oneMonthAgo, 20000, 120000, 0, 600000, 6, 'LIQUIDITY_WITHDRAWN', 0.91, 0, 93, true),
    mkLaunch('dt_alpha', 'ALPHA', 'Alpha Matrix AI', now, 25000, 180000, 170000, 900000, 1, 'ACTIVE', 0.60, 90, 3),
  ],
  associatedWallets: [
    { address: 'ALPHa1b2c3d4e5f6g7h8i9j0k', relationship: { id: 'edge_alpha_assoc_1', source: 'ALPHcreator9012abcd3456efgh7890', target: 'ALPHa1b2c3d4e5f6g7h8i9j0k', type: 'SHARED_FUNDING', strength: 0.92, evidence: [{ fact: '95% of wallet funded by creator', source: 'funding_analysis', observedAt: now, confidence: 0.95 }], firstObserved: now, lastObserved: now, confidence: 0.93, methodologyVersion: 'funding-analysis-v1.0' } },
    { address: 'ALPHb2c3d4e5f6g7h8i9j0k1l', relationship: { id: 'edge_alpha_assoc_2', source: 'ALPHcreator9012abcd3456efgh7890', target: 'ALPHb2c3d4e5f6g7h8i9j0k1l', type: 'SHARED_FUNDING', strength: 0.87, evidence: [{ fact: '88% of wallet funded by creator', source: 'funding_analysis', observedAt: now, confidence: 0.92 }], firstObserved: now, lastObserved: now, confidence: 0.90, methodologyVersion: 'funding-analysis-v1.0' } },
  ],
  behaviorProfile: {
    avgRetentionPct: 13.1,
    avgDaysToFirstSell: 1.5,
    totalSellingEvents: 42,
    avgDaysToLiquidityWithdrawal: 5.2,
    fullLiquidityRemovals: 5,
    associatedWalletCount: 2,
    evidence: [{ fact: 'Analyzed 8 launches: avg retention 13.1%, 42 selling events, avg 1.5 days to first sell', source: 'creator_analysis', observedAt: now, confidence: 0.90 }],
  },
  reputation: {
    score: 22,
    level: 'HIGH_CONCERN',
    confidence: 0.78,
    confidenceLevel: 'MODERATE',
    dimensions: [
      { name: 'LAUNCH_HISTORY', score: 18, weight: 0.20, evidence: [{ fact: '8 launches: 1 active, 1 inactive, 5 withdrawn, 1 severe decline', source: 'reputation_engine', observedAt: now, confidence: 0.90 }], description: '8 launches — 5 with liquidity withdrawal' },
      { name: 'LIQUIDITY_BEHAVIOR', score: 12, weight: 0.18, evidence: [{ fact: '5 out of 8 launches had full liquidity removal, avg 5.2 days', source: 'reputation_engine', observedAt: now, confidence: 0.92 }], description: '5/8 launches — liquidity removed avg 5.2 days' },
      { name: 'TOKEN_RETENTION', score: 20, weight: 0.15, evidence: [{ fact: 'Average retention: 13.1%', source: 'reputation_engine', observedAt: now, confidence: 0.88 }], description: 'Average 13.1% token retention' },
      { name: 'OBSERVED_SELLING', score: 15, weight: 0.12, evidence: [{ fact: '42 selling events, avg 1.5 days to first sell', source: 'reputation_engine', observedAt: now, confidence: 0.90 }], description: 'Avg 1.5 days to first sell' },
      { name: 'CREATOR_TRANSPARENCY', score: 65, weight: 0.10, evidence: [{ fact: 'Creator identified with on-chain history', source: 'reputation_engine', observedAt: now, confidence: 0.80 }], description: 'Creator address identified' },
      { name: 'ASSOCIATED_WALLET_BEHAVIOR', score: 30, weight: 0.10, evidence: [{ fact: '2 associated wallets with high funding correlation', source: 'reputation_engine', observedAt: now, confidence: 0.85 }], description: '2 associated wallets' },
      { name: 'HISTORICAL_ANOMALIES', score: 10, weight: 0.08, evidence: [{ fact: '3 concerning patterns: repeated early selling, repeated liquidity withdrawal, repeated early distribution', source: 'reputation_engine', observedAt: now, confidence: 0.88 }], description: '3 concerns, 0 positives' },
      { name: 'DATA_CONFIDENCE', score: 82, weight: 0.07, evidence: [{ fact: '8 launches with 100% data completeness', source: 'reputation_engine', observedAt: now, confidence: 0.95 }], description: '8 launches, 100% coverage' },
    ],
    patterns: [
      { type: 'REPEATED_CREATOR_SELLING', occurrenceCount: 7, totalLaunches: 8, timePeriod: { from: oneYearAgo, to: now }, evidence: [{ fact: 'Creator sold >50% within 7 days on 7 of 8 launches', source: 'creator_behavior', observedAt: now, confidence: 0.88 }], confidence: 0.88 },
      { type: 'REPEATED_LIQUIDITY_WITHDRAWAL', occurrenceCount: 5, totalLaunches: 8, timePeriod: { from: oneYearAgo, to: now }, evidence: [{ fact: 'Full liquidity removed on 5 of 8 launches', source: 'creator_behavior', observedAt: now, confidence: 0.90 }], confidence: 0.85 },
      { type: 'REPEATED_EARLY_DISTRIBUTION', occurrenceCount: 6, totalLaunches: 8, timePeriod: { from: oneYearAgo, to: now }, evidence: [{ fact: '>30% of creator position distributed within 7 days on 6 of 8 launches', source: 'creator_behavior', observedAt: now, confidence: 0.85 }], confidence: 0.82 },
    ],
    limitations: [],
    sampleSize: 8,
    methodologyVersion: 'creator-reputation-v1.0',
    generatedAt: now,
  },
  identificationEvidence: [{ fact: 'Token deployed by ALPHcreator9012', source: 'blockchain', observedAt: now, value: 'ALPHcreator9012abcd3456efgh7890', confidence: 0.98 }],
  identificationConfidence: 0.95,
  methodologyVersion: 'creator-entity-v1.0',
  updatedAt: now,
};

// ────────────────────────────────────────────────────────────────────────────
// Helper
// ────────────────────────────────────────────────────────────────────────────

function mkLaunch(
  tokenId: string, symbol: string, name: string,
  launchedAt: string, initialLiq: number, peakLiq: number,
  currentLiq: number, peakMcap: number, durationDays: number,
  outcome: CreatorLaunchRecord['outcome'], outcomeConfidence: number,
  retainedPct: number, soldPct: number, earlySellingFlag = false,
): CreatorLaunchRecord {
  const liquidityEvents: CreatorLaunchRecord['liquidityEvents'] = [];
  if (outcome === 'LIQUIDITY_WITHDRAWN') {
    liquidityEvents.push({
      id: `liq_${tokenId}_removal`, type: 'REMOVED', amountUsd: peakLiq,
      poolPctAffected: 95, timestamp: new Date(new Date(launchedAt).getTime() + durationDays * 86400000).toISOString(),
    });
  }
  liquidityEvents.unshift({
    id: `liq_${tokenId}_add`, type: 'ADDED', amountUsd: initialLiq,
    timestamp: launchedAt,
  });

  const sellingEvents: CreatorLaunchRecord['sellingEvents'] = [];
  if (earlySellingFlag) {
    sellingEvents.push({
      id: `sell_${tokenId}_early`, timestamp: new Date(new Date(launchedAt).getTime() + 1 * 86400000).toISOString(),
      amountPct: soldPct * 0.6, context: `Sold ${(soldPct * 0.6).toFixed(1)}% of observed position within 24 hours`,
    });
    sellingEvents.push({
      id: `sell_${tokenId}_follow`, timestamp: new Date(new Date(launchedAt).getTime() + 3 * 86400000).toISOString(),
      amountPct: soldPct * 0.4, context: `Sold additional ${(soldPct * 0.4).toFixed(1)}% within 3 days`,
    });
  } else if (soldPct > 10) {
    sellingEvents.push({
      id: `sell_${tokenId}_gradual`, timestamp: new Date(new Date(launchedAt).getTime() + 30 * 86400000).toISOString(),
      amountPct: soldPct, context: `Sold ${soldPct}% of observed position over ~30 days`,
    });
  }

  return {
    tokenId, tokenSymbol: symbol, tokenName: name, tokenAddress: `${tokenId}_address`,
    chain: 'solana', launchedAt, initialLiquidityUsd: initialLiq, peakLiquidityUsd: peakLiq,
    currentLiquidityUsd: currentLiq, peakMarketCapUsd: peakMcap, tradingDurationDays: durationDays,
    liquidityEvents, sellingEvents, creatorRetainedPct: retainedPct, creatorSoldPct: soldPct,
    outcome, outcomeConfidence, observedAt: now,
  };
}
