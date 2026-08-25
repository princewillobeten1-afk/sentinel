import { describe, it, expect } from 'vitest';
import { buildHolderConcentration, type RawLargestAccount } from '../holder-analysis';

const RAYDIUM_AMM = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';

const acct = (address: string, amount: number): RawLargestAccount => ({
  address,
  uiAmountString: String(amount),
});

describe('buildHolderConcentration', () => {
  it('computes each holder share against total supply', () => {
    const out = buildHolderConcentration([acct('ta1', 250), acct('ta2', 100)], 1000);
    expect(out.holders[0].percent).toBe(25);
    expect(out.holders[1].percent).toBe(10);
  });

  it('reports percent as null when supply is unknown, not zero', () => {
    // A 0% holder and an unmeasurable one are different claims.
    const out = buildHolderConcentration([acct('ta1', 250)], null);
    expect(out.holders[0].percent).toBeNull();
    expect(out.top10Pct).toBeNull();
  });

  it('resolves the owning wallet rather than reporting the token account', () => {
    // getTokenLargestAccounts returns token accounts. Presenting those as
    // holders overstates dispersion, since one owner can hold several.
    const out = buildHolderConcentration([acct('ta1', 10)], 100, { ta1: 'OwnerWallet111' });
    expect(out.holders[0].address).toBe('OwnerWallet111');
    expect(out.holders[0].tokenAccount).toBe('ta1');
  });

  it('falls back to the token account when the owner cannot be resolved', () => {
    const out = buildHolderConcentration([acct('ta1', 10)], 100, {});
    expect(out.holders[0].address).toBe('ta1');
  });

  it('marks pool accounts and excludes them from headline concentration', () => {
    // Liquidity sitting in an AMM is not a holder's position, but hiding it
    // would misrepresent where supply sits — so both figures are returned.
    const out = buildHolderConcentration(
      [acct('pool', 500), acct('ta1', 200), acct('ta2', 100)],
      1000,
      { pool: 'PoolOwner', ta1: 'W1', ta2: 'W2' },
      { pool: RAYDIUM_AMM },
    );

    expect(out.holders[0].isPool).toBe(true);
    expect(out.holders[0].poolLabel).toBe('Raydium AMM');
    expect(out.top10Pct).toBe(30);
    expect(out.top10IncludingPoolsPct).toBe(80);
  });

  it('limits the headline figure to ten holders', () => {
    const accounts = Array.from({ length: 15 }, (_, i) => acct(`ta${i}`, 10));
    const out = buildHolderConcentration(accounts, 1000);
    // 10 x 1% each, not 15.
    expect(out.top10Pct).toBe(10);
  });

  it('never estimates the total holder count', () => {
    // The RPC caps at 20 accounts, so the real total is not observable here.
    const out = buildHolderConcentration([acct('ta1', 10)], 100);
    expect(out.totalHolders).toBeNull();
  });

  it('treats a malformed balance as zero rather than NaN', () => {
    const out = buildHolderConcentration([{ address: 'ta1', uiAmountString: 'not-a-number' }], 100);
    expect(out.holders[0].balance).toBe(0);
    expect(Number.isNaN(out.holders[0].balance)).toBe(false);
  });

  it('ranks in the order the chain returned', () => {
    const out = buildHolderConcentration([acct('a', 5), acct('b', 3)], 10);
    expect(out.holders.map((h) => h.rank)).toEqual([1, 2]);
  });
});
