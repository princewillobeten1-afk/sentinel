import { describe, it, expect } from 'vitest';
import { toAtomic, fromAtomic, toSwapQuote, SOL_MINT, type JupiterQuoteResponse } from '../jupiter-quote';

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

describe('atomic conversion', () => {
  it('converts SOL amounts at 9 decimals', () => {
    expect(toAtomic('0.1', 9)).toBe(100_000_000n);
    expect(toAtomic('1', 9)).toBe(1_000_000_000n);
    expect(toAtomic(0.5, 9)).toBe(500_000_000n);
  });

  it('converts USDC amounts at 6 decimals', () => {
    // Using SOL's 9 decimals here would misquote by 1000x, which is why an
    // unresolvable mint is an error rather than a default.
    expect(toAtomic('9.603429', 6)).toBe(9_603_429n);
  });

  it('does not drift on values floating point cannot hold exactly', () => {
    // 0.1 + 0.2 style error would corrupt an on-chain amount.
    expect(toAtomic('0.000000001', 9)).toBe(1n);
    expect(toAtomic('123456.789012345', 9)).toBe(123_456_789_012_345n);
  });

  it('truncates precision beyond the mint decimals rather than rounding up', () => {
    // Rounding up could quote more than the wallet holds.
    expect(toAtomic('1.9999999999', 9)).toBe(1_999_999_999n);
  });

  it('round-trips', () => {
    expect(fromAtomic(toAtomic('42.5', 6), 6)).toBe('42.5');
    expect(fromAtomic(toAtomic('0.000001', 6), 6)).toBe('0.000001');
  });

  it('formats whole amounts without a trailing point', () => {
    expect(fromAtomic(1_000_000_000n, 9)).toBe('1');
    expect(fromAtomic(0n, 9)).toBe('0');
  });

  it('rejects input that is not a number', () => {
    expect(() => toAtomic('abc', 9)).toThrow();
    expect(() => toAtomic('', 9)).toThrow();
  });
});

describe('toSwapQuote', () => {
  const raw: JupiterQuoteResponse = {
    inputMint: SOL_MINT,
    outputMint: USDC,
    inAmount: '100000000',
    outAmount: '9603429',
    otherAmountThreshold: '9555412',
    swapMode: 'ExactIn',
    slippageBps: 50,
    priceImpactPct: '0.0012',
    routePlan: [{ swapInfo: { label: 'Raydium CLMM' } }, { swapInfo: { label: 'Whirlpool' } }],
  };

  it('scales both sides by their own decimals', () => {
    const quote = toSwapQuote(raw, 9, 6);
    expect(quote.inputAmount).toBe('0.1');
    expect(quote.outputAmount).toBe('9.603429');
  });

  it('computes the implied rate from the scaled amounts', () => {
    // The bug this replaces used one constant (41.3043) for every pair.
    expect(Number(toSwapQuote(raw, 9, 6).rate)).toBeCloseTo(96.03429, 4);
  });

  it('carries the worst-case output', () => {
    expect(toSwapQuote(raw, 9, 6).minimumReceived).toBe('9.555412');
  });

  it('names the venues actually routed through', () => {
    expect(toSwapQuote(raw, 9, 6).route).toEqual(['Raydium CLMM', 'Whirlpool']);
  });

  it('reports an unmeasured price impact as null, not zero', () => {
    // "No impact measured" and "zero impact" are different claims, and the
    // second is a strong one to make on a trade screen.
    const quote = toSwapQuote({ ...raw, priceImpactPct: undefined }, 9, 6);
    expect(quote.priceImpactPct).toBeNull();
  });

  it('keeps a real zero impact as zero', () => {
    expect(toSwapQuote({ ...raw, priceImpactPct: '0' }, 9, 6).priceImpactPct).toBe(0);
  });
});
