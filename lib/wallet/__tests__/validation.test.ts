import { describe, expect, it } from 'vitest';
import { isValidSolanaAddress, checkBalanceSufficiency, computeMaxSendable, SOL_FEE_HEADROOM } from '../validation';

describe('isValidSolanaAddress', () => {
  it('accepts a real, valid base58 Solana address', () => {
    expect(isValidSolanaAddress('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')).toBe(true);
    expect(isValidSolanaAddress('So11111111111111111111111111111111111111112')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isValidSolanaAddress('')).toBe(false);
  });

  it('rejects a too-short string (structurally not a real pubkey)', () => {
    // The demo/mock address seeded elsewhere in this codebase — confirms it
    // was never a real key, exactly the gap this feature closes.
    expect(isValidSolanaAddress('7xK99zK8mP2xQ5wN3a19')).toBe(false);
  });

  it('rejects non-base58 characters', () => {
    expect(isValidSolanaAddress('0xNotASolanaAddress0000000000000000000000')).toBe(false);
  });

  it('rejects an obviously malformed string', () => {
    expect(isValidSolanaAddress('not-an-address')).toBe(false);
  });
});

describe('checkBalanceSufficiency', () => {
  it('is sufficient when balance covers amount + SOL fee headroom', () => {
    const result = checkBalanceSufficiency(1, 1.5, 'SOL');
    expect(result.sufficient).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  it('is insufficient when balance is exactly the amount for SOL (no room for fee)', () => {
    const result = checkBalanceSufficiency(1, 1, 'SOL');
    expect(result.sufficient).toBe(false);
    expect(result.shortfall).toBeCloseTo(SOL_FEE_HEADROOM, 10);
  });

  it('USDC has no fee headroom — exact balance match is sufficient', () => {
    const result = checkBalanceSufficiency(100, 100, 'USDC');
    expect(result.sufficient).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  it('reports the exact shortfall when insufficient', () => {
    const result = checkBalanceSufficiency(100, 40, 'USDC');
    expect(result.sufficient).toBe(false);
    expect(result.shortfall).toBe(60);
  });

  it('never reports a negative shortfall', () => {
    const result = checkBalanceSufficiency(1, 1000, 'SOL');
    expect(result.shortfall).toBe(0);
  });
});

describe('computeMaxSendable', () => {
  it('reserves fee headroom for SOL', () => {
    expect(computeMaxSendable(1, 'SOL')).toBeCloseTo(1 - SOL_FEE_HEADROOM, 10);
  });

  it('does not reserve headroom for USDC', () => {
    expect(computeMaxSendable(500, 'USDC')).toBe(500);
  });

  it('never returns a negative amount for a near-zero SOL balance', () => {
    expect(computeMaxSendable(0, 'SOL')).toBe(0);
  });
});
