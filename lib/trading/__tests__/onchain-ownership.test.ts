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
  it('does not mislabel largest token-account concentration as unique-holder concentration', async () => {
    const profile = await fetchOnChainOwnership('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    expect(profile).not.toBeNull();
    expect(profile?.top10Pct).toBeNull();
    expect(profile?.source).toMatch(/^(helius|solana)-rpc-supply$/);
  });

  it('returns null for empty mint', async () => {
    const profile = await fetchOnChainOwnership('');
    expect(profile).toBeNull();
  });
});
