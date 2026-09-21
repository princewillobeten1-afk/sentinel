import { describe, it, expect, beforeEach } from 'vitest';
import { realtimeRepository } from '../realtime-repository';

/**
 * `getInMemoryTradesForMint` backs the fallback path `/live-trades` and
 * `/top-traders` use when Postgres is unreachable -- see those routes'
 * module headers. No DB is available in this test environment either, which
 * is exactly the condition being covered: `saveTrade` must still leave the
 * trade readable from memory.
 */
describe('realtimeRepository.getInMemoryTradesForMint', () => {
  const MINT_A = 'MintAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const MINT_B = 'MintBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

  it('returns trades captured for the given mint, even with no DB reachable', async () => {
    await realtimeRepository.saveTrade({
      signature: 'sig1',
      mint: MINT_A,
      wallet: 'walletA',
      side: 'BUY',
      amount: 100,
      timestamp: new Date('2026-01-01T00:00:00Z').toISOString(),
    });
    await realtimeRepository.saveTrade({
      signature: 'sig2',
      mint: MINT_A,
      wallet: 'walletB',
      side: 'SELL',
      amount: 50,
      timestamp: new Date('2026-01-01T00:01:00Z').toISOString(),
    });

    const rows = realtimeRepository.getInMemoryTradesForMint(MINT_A);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.signature).sort()).toEqual(['sig1', 'sig2']);
  });

  it('does not return trades for a different mint', async () => {
    await realtimeRepository.saveTrade({
      signature: 'sig3',
      mint: MINT_B,
      side: 'BUY',
      timestamp: new Date().toISOString(),
    });

    const rowsForA = realtimeRepository.getInMemoryTradesForMint(MINT_A);
    expect(rowsForA.some((r) => r.signature === 'sig3')).toBe(false);
  });

  it('returns an empty array for a mint nothing has traded', () => {
    expect(realtimeRepository.getInMemoryTradesForMint('NeverTradedMintXXXXXXXXXXXXXXXXXXXXXXXXXXX')).toEqual([]);
  });
});
