import { describe, expect, it } from 'vitest';
import { finite, selectDexPair } from '../dexscreener-market';

describe('DexScreener market contract', () => {
  it.each([null, undefined, '', ' ', false, {}, 'invalid', Infinity])('does not turn %j into a measured zero', (value) => {
    expect(finite(value)).toBeUndefined();
  });
  it('preserves measured zero', () => {
    expect(finite('0')).toBe(0);
    expect(finite(0)).toBe(0);
  });
  it('never prices a quote token using the base token price', () => {
    const quoteMatch = { baseToken: { address: 'OTHER' }, quoteToken: { address: 'MINT' }, priceUsd: '99', liquidity: { usd: 999 } };
    const baseMatch = { baseToken: { address: 'MINT' }, priceUsd: '2', liquidity: { usd: 1 } };
    expect(selectDexPair([quoteMatch, baseMatch], 'MINT')).toBe(baseMatch);
    expect(selectDexPair([quoteMatch], 'MINT')).toBeUndefined();
  });
});
