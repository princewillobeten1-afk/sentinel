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

  it('ranks unique owners before summing their top-ten concentration', () => {
    const parsed = parseRugcheckOwnership('test-mint', {
      mint: 'test-mint',
      totalHolders: 20,
      topHolders: [
        { owner: 'wallet-a', address: 'account-a1', pct: 18 },
        { owner: 'wallet-a', address: 'account-a2', pct: 17 },
        { owner: 'wallet-b', address: 'account-b', pct: 15 },
        { owner: 'wallet-c', address: 'account-c', pct: 12 },
        { owner: 'wallet-d', address: 'account-d', pct: 10 },
        { owner: 'wallet-e', address: 'account-e', pct: 8 },
        { owner: 'wallet-f', address: 'account-f', pct: 6 },
        { owner: 'wallet-g', address: 'account-g', pct: 5 },
        { owner: 'wallet-h', address: 'account-h', pct: 4 },
        { owner: 'wallet-i', address: 'account-i', pct: 3 },
        { owner: 'wallet-j', address: 'account-j', pct: 2 },
      ],
    });
    // Ten distinct owners account for 100%, despite the first wallet appearing twice.
    expect(parsed?.top10Pct).toBe(100);
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

  it('uses only explicit category percentages and leaves unsupported classifications unknown', () => {
    const rawReport = {
      mint: 'test-mint',
      creator: 'CreatorWalletAddress123',
      totalHolders: 1000,
      graphInsidersDetected: 12,
      risks: [
        { name: 'Insider holdings', value: '4.93%' },
        { name: 'Bundled supply', value: '5.22%' },
        { name: 'Sniper activity', value: '0.49%' },
      ],
      topHolders: [
        { address: 'Holder1', amount: '5000', pct: 0.5, insider: false },
        { address: 'Holder2', amount: '5000', pct: 0.5, insider: false },
        { address: 'Holder3', amount: '5000', pct: 0.5, insider: false },
        { address: 'Holder4', amount: '1000', pct: 0.1, insider: false },
      ],
    };

    const parsed = parseRugcheckOwnership('test-mint', rawReport);
    expect(parsed).not.toBeNull();
    expect(parsed?.insidersPct).toBe(4.93);
    expect(parsed?.bundlersPct).toBe(5.22);
    expect(parsed?.snipersPct).toBe(0.49);
    expect(parsed?.proTraders).toBeNull();
    expect(parsed?.kols).toBeNull();
  });

  it('does not turn absent risk categories, graph counts, or matching holder amounts into zero percentages', () => {
    const parsed = parseRugcheckOwnership('test-mint', {
      mint: 'test-mint',
      totalHolders: 1000,
      graphInsidersDetected: 0,
      risks: [{ name: 'High holder correlation', value: '(3)', description: '3 top users hold identical amounts' }],
      topHolders: [
        { address: 'Holder1', amount: '5000', pct: 0.5 },
        { address: 'Holder2', amount: '5000', pct: 0.5 },
        { address: 'Holder3', amount: '5000', pct: 0.5 },
      ],
    });
    expect(parsed).toMatchObject({
      insidersPct: null,
      bundlersPct: null,
      snipersPct: null,
      proTraders: null,
      kols: null,
    });
  });
});
