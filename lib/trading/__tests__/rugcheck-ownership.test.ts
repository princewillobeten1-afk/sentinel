import { describe, expect, it } from 'vitest';
import { parseRugcheckOwnership } from '../rugcheck-ownership';

describe('parseRugcheckOwnership', () => {
  it('returns null for null or non-object body', () => {
    expect(parseRugcheckOwnership('mint', null)).toBeNull();
    expect(parseRugcheckOwnership('mint', undefined)).toBeNull();
    expect(parseRugcheckOwnership('mint', 'string')).toBeNull();
  });

  it('calculates reported concentration and creator balance without inferring all insiders', () => {
    const rawReport = {
      mint: 'test-mint',
      creator: 'CreatorWalletAddress123',
      totalHolders: 420,
      topHolders: [
        { address: 'Holder1', pct: 15.5, insider: false },
        { address: 'Holder2', pct: 10.2, insider: true },
        { address: 'CreatorWalletAddress123', pct: 4.8, insider: false },
        { address: 'Holder4', pct: 3.5, insider: false },
        { address: 'Holder5', pct: 2.1, insider: true },
        { address: 'Holder6', pct: 1.9, insider: false },
        { address: 'Holder7', pct: 1.5, insider: false },
        { address: 'Holder8', pct: 1.2, insider: false },
        { address: 'Holder9', pct: 1.1, insider: false },
        { address: 'Holder10', pct: 0.9, insider: false },
        { address: 'Holder11', pct: 0.8, insider: false },
      ],
    };

    const parsed = parseRugcheckOwnership('test-mint', rawReport);
    expect(parsed).not.toBeNull();
    // Sum of first 10: 15.5 + 10.2 + 4.8 + 3.5 + 2.1 + 1.9 + 1.5 + 1.2 + 1.1 + 0.9 = 42.7
    expect(parsed?.top10Pct).toBe(42.7);
    expect(parsed?.devPct).toBe(4.8);
    // Insider flags cover only the capped top-holder list, not every holder.
    expect(parsed?.insidersPct).toBeNull();
    expect(parsed?.totalHolders).toBe(420);
    expect(parsed?.source).toBe('rugcheck-report');
  });

  it('leaves devPct unknown when creator is not in the capped top-holder list', () => {
    const rawReport = {
      mint: 'test-mint',
      creator: 'DevNotInTopHolders',
      totalHolders: 1500,
      topHolders: [
        { address: 'Holder1', pct: 5.0, insider: false },
        { address: 'Holder2', pct: 4.0, insider: false },
      ],
    };

    const parsed = parseRugcheckOwnership('test-mint', rawReport);
    expect(parsed).not.toBeNull();
    expect(parsed?.devPct).toBeNull();
  });
});
