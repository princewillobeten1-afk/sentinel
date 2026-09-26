import { describe, expect, it } from 'vitest';
import {
  formatCompactUsd,
  formatTokenPrice,
  formatPercent,
  formatCount,
  formatAge,
  shortenAddress,
  buyPressurePct,
  formatDisplaySource,
} from '../format';

describe('provider provenance', () => {
  it('shows each provider in a composed measured source', () => {
    expect(formatDisplaySource('rugcheck-report+solana-rpc-supply'))
      .toBe('Rugcheck + Solana RPC');
    expect(formatDisplaySource('birdeye-holder-profile')).toBe('Birdeye holders');
  });
});

describe('formatCompactUsd', () => {
  it('abbreviates by magnitude', () => {
    expect(formatCompactUsd(1_200)).toBe('1.20K');
    expect(formatCompactUsd(48_300_000)).toBe('48.3M');
    expect(formatCompactUsd(2_100_000_000)).toBe('2.10B');
    expect(formatCompactUsd(1_500_000_000_000)).toBe('1.50T');
  });

  it('keeps the rendered width roughly constant', () => {
    // The property that lets a column of these stay visually aligned.
    for (const v of [1_234, 12_345, 123_456, 1_234_567, 12_345_678, 123_456_789]) {
      expect(formatCompactUsd(v).length).toBeLessThanOrEqual(6);
    }
  });

  it('drops decimals as the leading digits grow', () => {
    expect(formatCompactUsd(1_234)).toBe('1.23K');
    expect(formatCompactUsd(12_345)).toBe('12.3K');
    expect(formatCompactUsd(123_456)).toBe('123K');
  });

  it('handles sub-dollar amounts without abbreviating', () => {
    expect(formatCompactUsd(0.5)).toBe('0.50');
    expect(formatCompactUsd(0.0042)).toBe('0.0042');
    expect(formatCompactUsd(0)).toBe('0');
  });

  it('preserves sign', () => {
    expect(formatCompactUsd(-48_300_000)).toBe('-48.3M');
  });

  it('accepts numeric strings, since money arrives as strings', () => {
    expect(formatCompactUsd('48300000')).toBe('48.3M');
  });

  it('renders missing data as an em dash, never as zero', () => {
    // A missing market cap is not a market cap of zero.
    expect(formatCompactUsd(undefined)).toBe('—');
    expect(formatCompactUsd(null)).toBe('—');
    expect(formatCompactUsd('')).toBe('—');
    expect(formatCompactUsd('not-a-number')).toBe('—');
  });
});

describe('formatTokenPrice', () => {
  it('formats ordinary prices plainly', () => {
    expect(formatTokenPrice(1.5)).toBe('1.50');
    expect(formatTokenPrice(0.0425)).toBe('0.0425');
  });

  it('groups thousands', () => {
    expect(formatTokenPrice(1245.5)).toBe('1,245.50');
  });

  it('truncates rather than rounds the significant digits', () => {
    // Rounding 0.00002845 to …285 would state a price the token never had.
    expect(formatTokenPrice(0.00002845)).toBe('0.0₄284');
  });

  it('compresses long zero runs into a subscript count', () => {
    // 0.0000000123 → 0.0₇123: the zero count becomes one glyph.
    expect(formatTokenPrice(0.0000000123)).toMatch(/^0\.0₇/);
    expect(formatTokenPrice(0.000001234)).toMatch(/^0\.0₅/);
  });

  it('keeps small prices short enough for a dense row', () => {
    expect(formatTokenPrice(0.0000000123).length).toBeLessThanOrEqual(10);
  });

  it('distinguishes prices that differ only in magnitude', () => {
    // The reason for the notation: these must not look identical.
    expect(formatTokenPrice(0.0000123)).not.toBe(formatTokenPrice(0.000000123));
  });

  it('handles zero and missing values', () => {
    expect(formatTokenPrice(0)).toBe('0');
    expect(formatTokenPrice(undefined)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('signs positive values explicitly', () => {
    expect(formatPercent(12.44)).toBe('+12.4%');
    expect(formatPercent(-3)).toBe('-3.0%');
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('renders missing data as an em dash', () => {
    expect(formatPercent(undefined)).toBe('—');
  });
});

describe('formatCount', () => {
  it('shows small counts exactly', () => {
    expect(formatCount(847)).toBe('847');
  });

  it('abbreviates past a thousand, coarsening as it grows', () => {
    // Deliberately coarser than the USD formatter: the hundreds digit of a
    // holder count changes constantly and means nothing at a glance.
    expect(formatCount(1_840)).toBe('1.8K');
    expect(formatCount(42_100)).toBe('42K');
    expect(formatCount(689_000)).toBe('689K');
    expect(formatCount(2_400_000)).toBe('2.4M');
  });

  it('shows zero as zero, not as one', () => {
    // The implementation this replaced returned '1' for both 0 and undefined.
    expect(formatCount(0)).toBe('0');
    expect(formatCount(undefined)).toBe('—');
  });
});

describe('formatAge', () => {
  it('uses the narrowest unit that stays unambiguous', () => {
    expect(formatAge(0.7)).toBe('42s');
    expect(formatAge(7)).toBe('7m');
    expect(formatAge(180)).toBe('3h');
    expect(formatAge(2880)).toBe('2d');
  });

  it('never renders a zero-second age', () => {
    expect(formatAge(0)).toBe('1s');
  });

  it('rejects negatives rather than showing a future age', () => {
    expect(formatAge(-5)).toBe('—');
  });
});

describe('shortenAddress', () => {
  it('truncates the middle', () => {
    expect(shortenAddress('So11111111111111111111111111111111111111112')).toBe('So11…1112');
  });

  it('leaves already-short strings alone', () => {
    expect(shortenAddress('abc')).toBe('abc');
  });

  it('handles missing addresses', () => {
    expect(shortenAddress(undefined)).toBe('—');
  });
});

describe('buyPressurePct', () => {
  it('computes the buy share of total trades', () => {
    expect(buyPressurePct(75, 25)).toBe(75);
    expect(buyPressurePct(1, 1)).toBe(50);
  });

  it('returns null with no trades rather than defaulting to balanced', () => {
    // A half-filled bar would imply real two-sided activity that never happened.
    expect(buyPressurePct(0, 0)).toBeNull();
    expect(buyPressurePct(undefined, undefined)).toBeNull();
  });

  it('handles one-sided activity', () => {
    expect(buyPressurePct(10, 0)).toBe(100);
    expect(buyPressurePct(0, 10)).toBe(0);
  });
});
