import { describe, it, expect } from 'vitest';
import { WalletProfiler } from '../wallet-profiler';

describe('Wallet Behavioral Profiler & Clustering Engine (Sprint 38 §17-20)', () => {
  it('classifies a rapid launch buyer as a Sniper / Early Buyer', () => {
    const profile = WalletProfiler.profileWallet({
      walletAddress: 'SolSniperWallet123',
      trades: [
        {
          tradeId: 't1',
          tokenMint: 'TokenA',
          entryTimestamp: 1000000 + 60000, // 1 min after pool launch
          exitTimestamp: 1000000 + 300000,
          poolCreationTimestamp: 1000000,
          buyAmountUsd: 12000,
          sellAmountUsd: 18000,
          realizedPnlUsd: 6000,
        },
      ],
    });

    expect(profile.classifications).toContain('SNIPER');
    expect(profile.classifications).toContain('EARLY_BUYER');
    expect(profile.averageEntryLatencyMinutes).toBe(1);
    expect(profile.winRatePct).toBe(100);
  });

  it('builds an explainable cluster node with explicit non-identity disclaimer', () => {
    const cluster = WalletProfiler.buildClusterNode({
      clusterId: 'cluster_alpha_7x',
      memberWallets: ['Wallet1', 'Wallet2', 'Wallet3'],
      commonFundingSource: 'MasterFunder7xK',
      collectiveOwnershipPct: 14.5,
    });

    expect(cluster.similarityConfidencePct).toBeGreaterThanOrEqual(80);
    expect(cluster.disclaimer).toContain('behavioral transaction similarity');
    expect(cluster.reasoning.length).toBeGreaterThan(0);
  });
});
