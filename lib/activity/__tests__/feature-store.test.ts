import { describe, expect, it } from 'vitest';
import { RollingActivityFeatureStore, buildActivityFeatureStore } from '../feature-store';
import type { ActivityContext, NormalizedTrade } from '../types';
import { giniCoefficient, herfindahlIndex } from '../utils';

describe('Activity Feature Store', () => {
  const now = new Date().toISOString();
  const mockContext: ActivityContext = {
    tokenId: 'dt_feature_test',
    chain: 'solana',
    observedAt: now,
  };

  it('correctly computes mathematical Herfindahl and Gini indices', () => {
    const equalShares = [0.25, 0.25, 0.25, 0.25];
    const concentratedShares = [0.9, 0.05, 0.03, 0.02];

    const equalHHI = herfindahlIndex(equalShares);
    const concHHI = herfindahlIndex(concentratedShares);

    expect(concHHI).toBeGreaterThan(equalHHI);
    expect(equalHHI).toBeCloseTo(0.25, 2);

    const equalVolumes = [100, 100, 100, 100];
    const concVolumes = [9000, 50, 30, 20];

    const equalGini = giniCoefficient(equalVolumes);
    const concGini = giniCoefficient(concVolumes);

    expect(concGini).toBeGreaterThan(equalGini);
    expect(equalGini).toBeCloseTo(0, 2);
  });

  it('ingests trades incrementally into RollingActivityFeatureStore', () => {
    const store = new RollingActivityFeatureStore();
    const tradeTime = new Date(Date.now() - 10_000).toISOString();

    const trade1: NormalizedTrade = {
      id: 't1',
      tokenId: 'dt_feature_test',
      chain: 'solana',
      wallet: '5WalletA',
      side: 'BUY',
      amountUsd: 500,
      timestamp: tradeTime,
    };

    const trade2: NormalizedTrade = {
      id: 't2',
      tokenId: 'dt_feature_test',
      chain: 'solana',
      wallet: '5WalletB',
      side: 'SELL',
      amountUsd: 300,
      timestamp: tradeTime,
    };

    store.ingestTrade(trade1);
    store.ingestTrade(trade2);

    const snapshot = store.snapshot(mockContext, { windows: ['1h', '24h'] });

    expect(snapshot.tokenId).toBe('dt_feature_test');
    expect(snapshot.windows['1h']).toBeDefined();
    expect(snapshot.windows['1h']?.participation.totalTransactions).toBe(2);
    expect(snapshot.windows['1h']?.participation.uniqueActiveWallets).toBe(2);
  });
});
