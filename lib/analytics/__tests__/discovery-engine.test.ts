import { describe, it, expect } from 'vitest';
import { DiscoveryEngine } from '../discovery-engine';

describe('Multi-Mode Discovery Engine (Sprint 38 §38-40)', () => {
  const candidates = [
    {
      tokenAddress: 'SafeToken1',
      symbol: 'SAFE',
      name: 'Safe Protocol',
      priceUsd: 1.5,
      marketCapUsd: 10_000_000,
      volume24hUsd: 5_000_000,
      priceChange24hPct: 15.0,
      organicVolumePct: 92.0,
      exitabilityScore: 90,
      liquidityHealthScore: 88,
      creatorReputationScore: 85,
      holderGrowth24hPct: 12.0,
    },
    {
      tokenAddress: 'HighWashMeme',
      symbol: 'WASH',
      name: 'Wash Token',
      priceUsd: 0.1,
      marketCapUsd: 1_000_000,
      volume24hUsd: 20_000_000,
      priceChange24hPct: 200.0,
      organicVolumePct: 25.0,
      exitabilityScore: 35,
      liquidityHealthScore: 40,
      creatorReputationScore: 20,
      holderGrowth24hPct: 150.0,
    },
  ];

  it('ranks SafeToken1 as #1 in SAFEST mode due to high creator reputation and exitability', () => {
    const ranked = DiscoveryEngine.rankCandidates({
      candidates,
      mode: 'SAFEST',
    });

    expect(ranked[0].symbol).toBe('SAFE');
  });

  it('ranks SafeToken1 as #1 in HIGHEST_ORGANIC_VOLUME mode due to clean volume', () => {
    const ranked = DiscoveryEngine.rankCandidates({
      candidates,
      mode: 'HIGHEST_ORGANIC_VOLUME',
    });

    expect(ranked[0].symbol).toBe('SAFE');
  });
});
