import { describe, expect, it } from 'vitest';
import { calculateFeeSplit, type FeeConfig } from '../fee-controller';

const evenSplit: FeeConfig = { buyFeeBps: 100, sellFeeBps: 100, protocolShareBps: 5000, creatorShareBps: 5000 };

describe('calculateFeeSplit', () => {
  it('splits an evenly-divisible fee exactly', () => {
    const result = calculateFeeSplit('1000', evenSplit);
    expect(result.totalFee).toBe('1000');
    expect(result.protocolAmount).toBe('500');
    expect(result.creatorAmount).toBe('500');
  });

  it('protocolAmount + creatorAmount always equals totalFee, including odd amounts', () => {
    const result = calculateFeeSplit('1001', evenSplit);
    expect(BigInt(result.protocolAmount) + BigInt(result.creatorAmount)).toBe(BigInt(result.totalFee));
  });

  it('assigns rounding remainder to the protocol share, never drops it', () => {
    // 1001 * 5000 / 10000 = 500.5 -> creator gets floor(500.5) = 500, protocol gets the remaining 501.
    const result = calculateFeeSplit('1001', evenSplit);
    expect(result.creatorAmount).toBe('500');
    expect(result.protocolAmount).toBe('501');
  });

  it('respects an uneven split (e.g. 70/30)', () => {
    const config: FeeConfig = { buyFeeBps: 100, sellFeeBps: 100, protocolShareBps: 7000, creatorShareBps: 3000 };
    const result = calculateFeeSplit('10000', config);
    expect(result.protocolAmount).toBe('7000');
    expect(result.creatorAmount).toBe('3000');
  });

  it('handles a zero fee amount', () => {
    const result = calculateFeeSplit('0', evenSplit);
    expect(result.totalFee).toBe('0');
    expect(result.protocolAmount).toBe('0');
    expect(result.creatorAmount).toBe('0');
  });

  it('handles large amounts without floating-point precision loss', () => {
    const result = calculateFeeSplit('123456789012345678', evenSplit);
    expect(BigInt(result.protocolAmount) + BigInt(result.creatorAmount)).toBe(123456789012345678n);
  });

  it('throws if the fee shares do not sum to 10000 bps', () => {
    const badConfig: FeeConfig = { buyFeeBps: 100, sellFeeBps: 100, protocolShareBps: 6000, creatorShareBps: 5000 };
    expect(() => calculateFeeSplit('1000', badConfig)).toThrow(/must sum to 10000/);
  });
});
