import { beforeEach, expect, it, vi } from 'vitest';
import { queueDexMarketReconciliation } from '../dexscreener-market';

const cards = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/market/live/card-cache', () => ({
  getTokenCardPatch: cards.get, updateTokenCard: cards.update,
}));

beforeEach(() => { vi.clearAllMocks(); cards.get.mockReturnValue(undefined); });

it('fills measured five-minute transactions when Birdeye and Bitquery have no value', async () => {
  const mint = '4NLjoZAt6Sd47oTs2hb2JRA7qiJzHmWQfDeNvtJPpump';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{
    chainId: 'solana', baseToken: { address: mint }, priceUsd: '0.001',
    volume: { m5: 25 }, txns: { m5: { buys: 3, sells: 2 } },
  }] }));
  queueDexMarketReconciliation([mint]);
  await vi.waitFor(() => expect(cards.update).toHaveBeenCalled());
  expect(cards.update.mock.calls[0][1]).toMatchObject({ volume5mUsd: '25', buysCount5m: 3,
    sellsCount5m: 2, txCount5m: 5, activityEvidence: { source: 'dexscreener-batch-rest' } });
  vi.unstubAllGlobals();
});

it('does not overwrite measured Birdeye fields in a mixed card', async () => {
  const mint = '7NQi2HRrV7rfUoi2ei5CdUhvwdBYpxhyecKoSrxjpump';
  cards.get.mockReturnValue({ fieldSources: { priceUsd: 'birdeye-token-stats', buysCount5m: 'birdeye-token-stats' },
    changedFields: { priceUsd: '0.002', buysCount5m: 9,
      marketEvidence: { source: 'birdeye-token-stats', status: 'measured' },
      activityEvidence: { source: 'birdeye-token-stats', status: 'measured' } } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{
    chainId: 'solana', baseToken: { address: mint }, priceUsd: '0.001',
    volume: { m5: 25 }, txns: { m5: { buys: 3, sells: 2 } },
  }] }));
  queueDexMarketReconciliation([mint]);
  await vi.waitFor(() => expect(cards.update).toHaveBeenCalled());
  expect(cards.update.mock.calls[0][1].priceUsd).toBeUndefined();
  expect(cards.update.mock.calls[0][1].buysCount5m).toBeUndefined();
  expect(cards.update.mock.calls[0][1].sellsCount5m).toBe(2);
  expect(cards.update.mock.calls[0][1].activityEvidence.source).toContain('birdeye-token-stats');
  vi.unstubAllGlobals();
});
