import { describe, it, expect } from 'vitest';
import { calculateEffectiveOwnership } from '../effective-ownership';
import type { WalletClusterV2 } from '../types';

describe('Effective Ownership Calculator', () => {
  const mockHolders = [
    { address: 'w1', balance: 50_000_000 },
    { address: 'w2', balance: 20_000_000 },
    { address: 'w3', balance: 10_000_000 },
  ];

  const mockClusters: WalletClusterV2[] = [
    {
      id: 'cluster_1',
      wallets: ['w1', 'w2'],
      edges: [],
      clusterConfidence: { score: 0.85, evidenceCount: 2, strongestEvidence: null, conflictingEvidence: [], methodologyVersion: 'v1' },
      scope: 'GLOBAL',
      createdAt: '2026-01-01',
      methodologyVersion: 'v1',
    },
  ];

  it('prevents double-counting across layers using address set', () => {
    const report = calculateEffectiveOwnership({
      tokenId: 'test_token',
      chain: 'solana',
      totalSupply: 100_000_000,
      circulatingSupply: 100_000_000,
      holders: mockHolders,
      clusters: mockClusters,
    });

    expect(report.uniqueAddressesCounted).toBe(3);
    // w1 and w2 were added via cluster layer, so direct layer only has w3
    const clusterEntity = report.entities.find(e => e.type === 'CLUSTER');
    expect(clusterEntity?.estimatedEffectiveBalance).toBe(70_000_000);
    expect(report.knownHeldSupply).toBe(80_000_000);
    expect(report.unknownSupply).toBe(20_000_000);
  });

  it('calculates concentration levels correctly', () => {
    const report = calculateEffectiveOwnership({
      tokenId: 'test_token',
      chain: 'solana',
      totalSupply: 100_000_000,
      circulatingSupply: 100_000_000,
      holders: mockHolders,
      clusters: mockClusters,
    });

    expect(report.concentration.level).toBe('HIGH'); // 70% cluster
    expect(report.concentration.topClusterPct).toBe(70);
  });
});
