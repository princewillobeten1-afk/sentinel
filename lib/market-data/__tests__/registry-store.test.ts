import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { marketToUpsertInput } from '../registry-store';
import type { Market } from '../types';

function market(overrides: Partial<Market> = {}): Market {
  return {
    marketId: 'solana:raydium_cpmm:POOLADDR',
    chainId: 'solana',
    protocol: 'raydium_cpmm',
    marketType: 'CPMM',
    address: 'POOLADDR',
    baseTokenId: 'So11111111111111111111111111111111111111112',
    quoteTokenId: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    feeBps: 25,
    status: 'ACTIVE',
    source: 'ONCHAIN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('marketToUpsertInput', () => {
  it('carries the identity triple the UNIQUE constraint is built on', () => {
    const input = marketToUpsertInput(market());
    expect(input.chainId).toBe('solana');
    expect(input.protocol).toBe('raydium_cpmm');
    expect(input.address).toBe('POOLADDR');
  });

  it('defaults missing metadata to an empty object rather than undefined', () => {
    const input = marketToUpsertInput(market({ metadata: undefined }));
    expect(input.metadata).toEqual({});
  });

  it('preserves supplied metadata', () => {
    const input = marketToUpsertInput(market({ metadata: { tickSpacing: 64 } }));
    expect(input.metadata).toEqual({ tickSpacing: 64 });
  });

  it('does not forward the derived marketId — the repository composes it', () => {
    const input = marketToUpsertInput(market());
    expect('marketId' in input).toBe(false);
    expect('id' in input).toBe(false);
  });

  it('keeps base and quote distinct and in order', () => {
    const input = marketToUpsertInput(market());
    expect(input.baseTokenId).not.toBe(input.quoteTokenId);
    expect(input.baseTokenId).toContain('So111');
  });

  it('two markets for the same pair on different protocols are distinct identities', () => {
    // "1 token ≠ 1 market": the same pair on Raydium and Orca must not collapse.
    const raydium = marketToUpsertInput(market({ protocol: 'raydium_cpmm', address: 'A1' }));
    const orca = marketToUpsertInput(market({ protocol: 'orca_whirlpool', address: 'A2' }));
    const key = (m: ReturnType<typeof marketToUpsertInput>) => `${m.chainId}:${m.protocol}:${m.address}`;
    expect(key(raydium)).not.toBe(key(orca));
  });
});
