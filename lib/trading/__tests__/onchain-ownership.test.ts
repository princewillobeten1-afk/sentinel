import { describe, expect, it, vi } from 'vitest';
import { fetchOnChainOwnership } from '../onchain-ownership';

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual<typeof import('@solana/web3.js')>('@solana/web3.js');
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(function () {
      return {
        getTokenSupply: vi.fn().mockResolvedValue({
          value: { uiAmountString: '1000000000' },
        }),
        getTokenLargestAccounts: vi.fn().mockResolvedValue({
          value: [
            { uiAmountString: '150000000' },
            { uiAmountString: '100000000' },
            { uiAmountString: '80000000' },
            { uiAmountString: '50000000' },
            { uiAmountString: '40000000' },
            { uiAmountString: '30000000' },
            { uiAmountString: '20000000' },
            { uiAmountString: '15000000' },
            { uiAmountString: '10000000' },
            { uiAmountString: '5000000' },
          ],
        }),
        getParsedTokenAccountsByOwner: vi.fn().mockResolvedValue({
          value: [],
        }),
      };
    }),
  };
});

describe('fetchOnChainOwnership', () => {
  it('computes top10 percentage from largest accounts and supply', async () => {
    // Sum = 150 + 100 + 80 + 50 + 40 + 30 + 20 + 15 + 10 + 5 = 500M out of 1000M = 50%
    const profile = await fetchOnChainOwnership('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    expect(profile).not.toBeNull();
    expect(profile?.top10Pct).toBe(50);
    expect(profile?.source).toBe('solana-rpc-largest-token-accounts');
  });

  it('returns null for empty mint', async () => {
    const profile = await fetchOnChainOwnership('');
    expect(profile).toBeNull();
  });
});
