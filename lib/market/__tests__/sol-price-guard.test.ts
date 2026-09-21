import { describe, it, expect, beforeEach } from 'vitest';
import { acceptSolPrice, __resetSolPriceGuard } from '../solana-provider';

describe('acceptSolPrice — a bad tick must not scale the page', () => {
  beforeEach(() => __resetSolPriceGuard());

  it('accepts the first reading it sees', () => {
    expect(acceptSolPrice(104.93)).toBe(104.93);
  });

  it('rejects the implausible jump that was observed live', () => {
    // The status bar alternated $105 and $184 as two sources took turns. SOL
    // does not move 76% in a minute; the second reading is a different source,
    // not a price move.
    acceptSolPrice(105.05);
    expect(acceptSolPrice(184.65)).toBe(105.05);
  });

  it('keeps the last good value rather than blanking', () => {
    acceptSolPrice(104.9);
    expect(acceptSolPrice(null)).toBe(104.9);
    expect(acceptSolPrice(0)).toBe(104.9);
    expect(acceptSolPrice(Number.NaN)).toBe(104.9);
  });

  it('allows a real move inside the bound', () => {
    acceptSolPrice(100);
    // 8% is a large but entirely possible minute for SOL.
    expect(acceptSolPrice(108)).toBe(108);
  });

  it('accepts a large move once the window has passed', () => {
    // Outside the window a big change is a real trend, not a bad tick.
    acceptSolPrice(100);
    const now = Date.now();
    const realNow = Date.now;
    try {
      Date.now = () => now + 120_000;
      expect(acceptSolPrice(180)).toBe(180);
    } finally {
      Date.now = realNow;
    }
  });

  it('returns null when nothing good has ever been seen', () => {
    expect(acceptSolPrice(null)).toBeNull();
  });
});
