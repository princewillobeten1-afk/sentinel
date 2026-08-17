import { describe, it, expect } from 'vitest';
import { analyzeCreatorBehavior } from '../creator-behavior';
import type { CreatorLaunchRecord } from '../types';

describe('Creator Behavior Analyzer', () => {
  const mockLaunches: CreatorLaunchRecord[] = [
    {
      tokenId: 't1', tokenSymbol: 'T1', tokenName: 'Token 1', tokenAddress: 'addr1',
      chain: 'solana', launchedAt: '2026-01-01T00:00:00Z', tradingDurationDays: 5,
      liquidityEvents: [{ id: 'l1', type: 'REMOVED', amountUsd: 10000, poolPctAffected: 95, timestamp: '2026-01-05T00:00:00Z' }],
      sellingEvents: [{ id: 's1', timestamp: '2026-01-02T00:00:00Z', amountPct: 40, context: 'Early sell' }],
      creatorRetainedPct: 0, creatorSoldPct: 100, outcome: 'LIQUIDITY_WITHDRAWN', outcomeConfidence: 0.9, observedAt: '2026-01-06T00:00:00Z',
    },
    {
      tokenId: 't2', tokenSymbol: 'T2', tokenName: 'Token 2', tokenAddress: 'addr2',
      chain: 'solana', launchedAt: '2026-02-01T00:00:00Z', tradingDurationDays: 3,
      liquidityEvents: [{ id: 'l2', type: 'REMOVED', amountUsd: 15000, poolPctAffected: 98, timestamp: '2026-02-04T00:00:00Z' }],
      sellingEvents: [{ id: 's2', timestamp: '2026-02-02T00:00:00Z', amountPct: 50, context: 'Early sell' }],
      creatorRetainedPct: 0, creatorSoldPct: 100, outcome: 'LIQUIDITY_WITHDRAWN', outcomeConfidence: 0.9, observedAt: '2026-02-05T00:00:00Z',
    },
  ];

  it('detects recurring patterns across multiple launches', () => {
    const patterns = analyzeCreatorBehavior(mockLaunches);
    expect(patterns.length).toBeGreaterThan(0);

    const liqPattern = patterns.find(p => p.type === 'REPEATED_LIQUIDITY_WITHDRAWAL');
    expect(liqPattern).toBeDefined();
    expect(liqPattern?.occurrenceCount).toBe(2);

    const sellPattern = patterns.find(p => p.type === 'REPEATED_CREATOR_SELLING');
    expect(sellPattern).toBeDefined();
    expect(sellPattern?.occurrenceCount).toBe(2);
  });
});
