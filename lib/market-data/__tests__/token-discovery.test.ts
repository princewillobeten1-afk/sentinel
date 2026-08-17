import { describe, it, expect, beforeEach } from 'vitest';
import { tokenDiscoveryPipeline } from '../discovery/token-discovery-pipeline';
import { poolDiscoveryPipeline } from '../discovery/pool-discovery-pipeline';

describe('Token Discovery Pipeline & Supply Confidence (Sprint 45 §12-16)', () => {
  beforeEach(() => {
    tokenDiscoveryPipeline.reset();
  });

  it('validates on-chain token addresses by chain format', () => {
    expect(tokenDiscoveryPipeline.validateAddress('So11111111111111111111111111111111111111112', 'solana')).toBe(true);
    expect(tokenDiscoveryPipeline.validateAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'base')).toBe(true);
    expect(tokenDiscoveryPipeline.validateAddress('invalid', 'solana')).toBe(false);
  });

  it('registers token with supply confidence scoring', () => {
    const token = tokenDiscoveryPipeline.registerOrUpdateToken({
      tokenId: 'new_token_mint_1234567890abcdef',
      chainId: 'solana',
      symbol: 'ALPHA',
      name: 'Alpha Coin',
      decimals: 9,
      totalSupply: 1_000_000,
      circulatingSupply: 800_000,
      maxSupply: 1_000_000,
      supplyConfidence: 0.95,
      supplySource: 'ONCHAIN_RPC',
    });

    expect(token.status).toBe('DISCOVERED');
    expect(token.supply.circulatingSupply).toBe(800_000);
    expect(token.supply.supplyConfidence).toBe(0.95);
  });

  it('pool discovery pipeline tags unverifiable candidates as SUSPICIOUS', () => {
    const res = poolDiscoveryPipeline.validateCandidate({
      chainId: 'solana',
      protocol: 'raydium_cpmm',
      marketType: 'CPMM',
      address: '', // invalid
      baseTokenId: 'same_token',
      quoteTokenId: 'same_token', // invalid
      feeBps: 25,
    });

    expect(res.isValid).toBe(false);
    expect(res.assignedStatus).toBe('SUSPICIOUS');
    expect(res.reasons.length).toBeGreaterThan(0);
  });
});
