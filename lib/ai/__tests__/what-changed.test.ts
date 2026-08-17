import { describe, it, expect } from 'vitest';
import { WhatChangedEngine } from '../what-changed';
import { EvidenceBuilder } from '../evidence-builder';

describe('"What Changed?" State Diff Engine (Sprint 37 §17-18)', () => {
  const current = EvidenceBuilder.buildEvidencePackage({
    tokenAddress: 'So11111111111111111111111111111111111111112',
    liquidity: { totalLiquidityUsd: 420_000 },
    holders: { top10HoldersPct: 47.0, creatorLinkedWalletsPct: 8.4 },
    volume: { uniqueTraders24h: 310 },
    exitability: { exitabilityScore: 41 },
  });

  it('detects liquidity drops, creator transfers, and exitability degradation', () => {
    const previous = {
      liquidity: { totalLiquidityUsd: 520_000 },
      holders: { top10HoldersPct: 42.0, creatorLinkedWalletsPct: 12.0 },
      volume: { uniqueTraders24h: 270 },
      exitability: { exitabilityScore: 67 },
    };

    const diff = WhatChangedEngine.compareSnapshots({
      previous,
      current,
      timeframe: '15m',
    });

    expect(diff.timeframe).toBe('15m');
    expect(diff.overallRiskTrend).toBe('INCREASED');
    expect(diff.changes.length).toBeGreaterThanOrEqual(4);

    const liqChange = diff.changes.find((c) => c.metric === 'Pool Liquidity');
    expect(liqChange?.type).toBe('WARNING');
    expect(liqChange?.deltaDescription).toContain('decreased');

    const exitChange = diff.changes.find((c) => c.metric === 'Exitability Score');
    expect(exitChange?.type).toBe('WARNING');
    expect(exitChange?.deltaDescription).toContain('67 → 41');
  });
});
