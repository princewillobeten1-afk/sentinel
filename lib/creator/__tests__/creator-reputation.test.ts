import { describe, it, expect } from 'vitest';
import { calculateReputation } from '../creator-reputation';
import type { CreatorLaunchRecord } from '../types';

describe('Creator Reputation Engine', () => {
  const mkMockLaunch = (id: string, outcome: CreatorLaunchRecord['outcome']): CreatorLaunchRecord => ({
    tokenId: id, tokenSymbol: id.toUpperCase(), tokenName: id, tokenAddress: `addr_${id}`,
    chain: 'solana', launchedAt: '2026-01-01', initialLiquidityUsd: 10000, peakLiquidityUsd: 50000,
    currentLiquidityUsd: 20000, peakMarketCapUsd: 200000, tradingDurationDays: 90,
    liquidityEvents: [], sellingEvents: [], creatorRetainedPct: 70, creatorSoldPct: 10,
    outcome, outcomeConfidence: 0.85, observedAt: '2026-01-02',
  });

  it('gates numeric score with INSUFFICIENT confidence when sample size < 3', () => {
    const rep = calculateReputation({
      launches: [mkMockLaunch('t1', 'ACTIVE')],
      behaviorProfile: {
        avgRetentionPct: 70, avgDaysToFirstSell: 30, totalSellingEvents: 1,
        avgDaysToLiquidityWithdrawal: null, fullLiquidityRemovals: 0, associatedWalletCount: 0,
        evidence: [],
      },
      patterns: [],
      associatedWalletCount: 0,
      creatorIdentified: true,
      hasOnChainHistory: true,
    });

    expect(rep.score).toBeNull();
    expect(rep.confidenceLevel).toBe('INSUFFICIENT');
    expect(rep.limitations.length).toBeGreaterThan(0);
  });

  it('calculates score with 8 weighted dimensions when sample size >= 3', () => {
    const rep = calculateReputation({
      launches: [
        mkMockLaunch('t1', 'ACTIVE'),
        mkMockLaunch('t2', 'ACTIVE'),
        mkMockLaunch('t3', 'ACTIVE'),
      ],
      behaviorProfile: {
        avgRetentionPct: 70, avgDaysToFirstSell: 30, totalSellingEvents: 3,
        avgDaysToLiquidityWithdrawal: null, fullLiquidityRemovals: 0, associatedWalletCount: 0,
        evidence: [],
      },
      patterns: [],
      associatedWalletCount: 0,
      creatorIdentified: true,
      hasOnChainHistory: true,
    });

    expect(rep.score).not.toBeNull();
    expect(rep.score).toBeGreaterThan(40);
    expect(rep.dimensions.length).toBe(8);
  });
});
