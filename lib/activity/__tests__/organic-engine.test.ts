import { describe, expect, it } from 'vitest';
import { analyzeOrganicActivity, assessWindow } from '../organic-engine';
import type { ActivityContext, NormalizedTrade } from '../types';
import { buildWindowFeatures } from '../feature-store';

describe('Organic Volume Detection Engine', () => {
  const now = new Date().toISOString();
  const launchTime = new Date(Date.now() - 3600 * 1000 * 2).toISOString();

  const mockContext: ActivityContext = {
    tokenId: 'dt_test_organic',
    chain: 'solana',
    tokenCreatedAt: launchTime,
    tradingOpenedAt: launchTime,
    observedAt: now,
    dataCompleteFrom: launchTime,
    dataCompleteTo: now,
    creatorWallets: ['5CreatorAddressPK'],
  };

  it('calculates score within 0-100 range and assigns valid interpretation', () => {
    const trades: NormalizedTrade[] = Array.from({ length: 40 }, (_, i) => ({
      id: `tr_${i}`,
      tokenId: 'dt_test_organic',
      chain: 'solana',
      wallet: `5Wallet_${i % 15}`,
      side: i % 2 === 0 ? 'BUY' : 'SELL',
      amountUsd: 100 + i * 5,
      timestamp: new Date(Date.now() - (i + 1) * 60 * 1000).toISOString(),
    }));

    const features = buildWindowFeatures(trades, mockContext, '1h');
    const assessment = assessWindow(mockContext, features);

    expect(assessment.score).toBeGreaterThanOrEqual(0);
    expect(assessment.score).toBeLessThanOrEqual(100);
    expect(typeof assessment.interpretation).toBe('string');
    expect(assessment.interpretation.length).toBeGreaterThan(10);
    expect(assessment.organicVolumeVersion).toBe('sentinel-organic-v1.0.0');
  });

  it('penalizes high volume concentration', () => {
    const concentratedTrades: NormalizedTrade[] = Array.from({ length: 50 }, (_, i) => ({
      id: `tr_conc_${i}`,
      tokenId: 'dt_test_organic',
      chain: 'solana',
      wallet: i < 40 ? '5DominantWhalePK' : `5SmallWallet_${i}`,
      side: 'BUY',
      amountUsd: i < 40 ? 10_000 : 50,
      timestamp: new Date(Date.now() - (i + 1) * 30 * 1000).toISOString(),
    }));

    const broadTrades: NormalizedTrade[] = Array.from({ length: 50 }, (_, i) => ({
      id: `tr_broad_${i}`,
      tokenId: 'dt_test_organic',
      chain: 'solana',
      wallet: `5BroadWallet_${i}`,
      side: i % 2 === 0 ? 'BUY' : 'SELL',
      amountUsd: 200 + (i % 5) * 50,
      timestamp: new Date(Date.now() - (i + 1) * 30 * 1000).toISOString(),
    }));

    const concFeatures = buildWindowFeatures(concentratedTrades, mockContext, '1h');
    const concAssessment = assessWindow(mockContext, concFeatures);

    const broadFeatures = buildWindowFeatures(broadTrades, mockContext, '1h');
    const broadAssessment = assessWindow(mockContext, broadFeatures);

    expect(broadAssessment.score).toBeGreaterThan(concAssessment.score);
  });

  it('detects repeated trade size anomaly signals', () => {
    const repeatedTrades: NormalizedTrade[] = Array.from({ length: 40 }, (_, i) => ({
      id: `tr_rep_${i}`,
      tokenId: 'dt_test_organic',
      chain: 'solana',
      wallet: `5Bot_${i % 5}`,
      side: 'BUY',
      amountUsd: 500, // Fixed size
      timestamp: new Date(Date.now() - (i + 1) * 20 * 1000).toISOString(),
    }));

    const result = analyzeOrganicActivity({ trades: repeatedTrades, context: mockContext });
    const primary = result.primaryAssessment;

    expect(primary).toBeDefined();
    const repeatedSignal = primary?.signals.find((s) => s.type === 'REPEATED_TRADE_SIZES');
    expect(repeatedSignal).toBeDefined();
    expect(repeatedSignal?.dimension).toBe('AUTOMATED');
  });
});
