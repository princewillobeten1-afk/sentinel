import { describe, it, expect } from 'vitest';
import { tokenDiscoveryPipeline } from '../../market-data/discovery/token-discovery-pipeline';
import { canonicalMarketRegistry } from '../../market-data/discovery/market-registry';

describe('Token Detail & Multi-Market Inspection (Sprint 46 §7-11, §22-24)', () => {
  it('distinguishes token verification status from speculative risk', () => {
    const sent = tokenDiscoveryPipeline.getToken('So11111111111111111111111111111111111111112');
    expect(sent).toBeDefined();
    expect(sent?.status).toBe('ACTIVE');

    const meme = tokenDiscoveryPipeline.getToken('9pW2...8b11');
    expect(meme).toBeDefined();
    expect(meme?.status).toBe('SUSPICIOUS');
  });

  it('maps multi-market pools and identifies primary canonical pool', () => {
    const sentMint = 'So11111111111111111111111111111111111111112';
    const markets = canonicalMarketRegistry.getMarketsForToken(sentMint);

    expect(markets.length).toBeGreaterThanOrEqual(3);
    expect(markets[0].protocol).toBe('raydium_cpmm');
  });
});
