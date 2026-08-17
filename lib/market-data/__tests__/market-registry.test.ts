import { describe, it, expect, beforeEach } from 'vitest';
import { canonicalMarketRegistry } from '../discovery/market-registry';

describe('Canonical Market Registry & Identity (Sprint 45 §3-7)', () => {
  beforeEach(() => {
    canonicalMarketRegistry.reset();
  });

  it('enforces 1 Token != 1 Market by indexing multiple pools per token', () => {
    const sentMint = 'So11111111111111111111111111111111111111112';
    const markets = canonicalMarketRegistry.getMarketsForToken(sentMint);

    expect(markets.length).toBeGreaterThanOrEqual(3);
    const protocols = markets.map((m) => m.protocol);
    expect(protocols).toContain('raydium_cpmm');
    expect(protocols).toContain('orca_whirlpool');
    expect(protocols).toContain('meteora');
  });

  it('guarantees canonical market identity uniqueness (chainId + protocol + address)', () => {
    const m1 = canonicalMarketRegistry.registerMarket({
      chainId: 'solana',
      protocol: 'pump_fun',
      marketType: 'CPMM',
      address: 'PumpFunBondingCurve99a1',
      baseTokenId: 'token_alpha',
      quoteTokenId: 'token_beta',
    });

    const m2 = canonicalMarketRegistry.registerMarket({
      chainId: 'solana',
      protocol: 'pump_fun',
      marketType: 'CPMM',
      address: 'PumpFunBondingCurve99a1', // Duplicate identity
      baseTokenId: 'token_alpha',
      quoteTokenId: 'token_beta',
    });

    expect(m1.marketId).toBe(m2.marketId);
  });

  it('transitions market lifecycle status without discarding historical registry data', () => {
    const m = canonicalMarketRegistry.registerMarket({
      chainId: 'base',
      protocol: 'uniswap_v2',
      marketType: 'CPMM',
      address: '0xTestBasePool001',
      baseTokenId: 'base_tok_1',
      quoteTokenId: 'base_tok_2',
      status: 'DISCOVERED',
    });

    expect(m.status).toBe('DISCOVERED');

    const updated = canonicalMarketRegistry.updateMarketStatus(m.marketId, 'ACTIVE');
    expect(updated.status).toBe('ACTIVE');

    const deprecated = canonicalMarketRegistry.updateMarketStatus(m.marketId, 'DEPRECATED');
    expect(deprecated.status).toBe('DEPRECATED');
    expect(canonicalMarketRegistry.getMarket(m.marketId)).toBeDefined();
  });
});
