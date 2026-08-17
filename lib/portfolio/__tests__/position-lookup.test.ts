import { describe, expect, it } from 'vitest';
import { dedupePortfolioIds, findDirectPortfolioMatch } from '../service';

describe('dedupePortfolioIds', () => {
  it('collapses wallets that share a portfolio id to a single map entry', () => {
    // Mirrors MOCK_WALLETS today: every known wallet resolves to 'pf_sentinel_primary'.
    const knownWallet = '7xK99zK8mP2xQ5wN3a19';
    const map = dedupePortfolioIds([knownWallet, knownWallet, knownWallet]);
    expect(map.size).toBe(1);
  });

  it('does not produce duplicate entries for a duplicate wallet address in the input', () => {
    const wallet = 'SomeUnknownWalletAddress111111111';
    const map = dedupePortfolioIds([wallet, wallet]);
    expect(map.size).toBe(1);
  });

  it('keeps distinct portfolio ids for wallets that resolve to different portfolios', () => {
    // portfolioIdForWallet slices the first 12 chars of an unknown wallet as its id —
    // these two must differ within that prefix to land in different portfolios.
    const map = dedupePortfolioIds(['AAAAAAAAAAAA1111111111', 'BBBBBBBBBBBB2222222222']);
    expect(map.size).toBe(2);
  });

  it('keeps one representative wallet per portfolio id', () => {
    const knownWallet = '7xK99zK8mP2xQ5wN3a19';
    const map = dedupePortfolioIds([knownWallet]);
    expect([...map.values()]).toContain(knownWallet);
  });
});

describe('findDirectPortfolioMatch', () => {
  it('matches the correct portfolio id among several candidates', () => {
    const positionId = 'pos_pf_sentinel_primary_solana_dt_sentinel';
    const match = findDirectPortfolioMatch(positionId, ['pf_other', 'pf_sentinel_primary', 'pf_another']);
    expect(match).toBe('pf_sentinel_primary');
  });

  it('returns undefined when no candidate matches', () => {
    const positionId = 'pos_pf_unrelated_solana_dt_sentinel';
    const match = findDirectPortfolioMatch(positionId, ['pf_a', 'pf_b']);
    expect(match).toBeUndefined();
  });

  it('does not false-positive on a portfolio id that is a substring but not a proper prefix segment', () => {
    // 'pf_abc' must not match a positionId actually namespaced under 'pf_abcdef'.
    const positionId = 'pos_pf_abcdef_solana_dt_x';
    const match = findDirectPortfolioMatch(positionId, ['pf_abc']);
    expect(match).toBeUndefined();
  });

  it('returns the first matching candidate when multiple happen to match', () => {
    const positionId = 'pos_pf_x_solana_dt_y';
    const match = findDirectPortfolioMatch(positionId, ['pf_x', 'pf_x']);
    expect(match).toBe('pf_x');
  });
});
