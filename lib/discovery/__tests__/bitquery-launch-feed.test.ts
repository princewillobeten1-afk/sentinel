import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { getBitqueryRecentLaunches, parseBitqueryLaunches, resetBitqueryLaunchesForTests } from '../bitquery-launch-feed';

vi.mock('../dexscreener-market', async (original) => ({
  ...await original<typeof import('../dexscreener-market')>(), queueDexMarketReconciliation: vi.fn(),
}));

const mint = '4NLjoZAt6Sd47oTs2hb2JRA7qiJzHmWQfDeNvtJPpump';
const creator = 'So11111111111111111111111111111111111111112';
const now = Date.parse('2026-09-25T10:00:00Z');
const row = (time: string, address = mint) => ({ Block: { Time: time }, Transaction: { Signer: creator },
  TokenSupplyUpdate: { Currency: { MintAddress: address, Name: 'Measured token', Symbol: 'REAL' } } });

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv('BITQUERY_ACCESS_TOKEN', 'test-server-secret');
  resetBitqueryLaunchesForTests();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

it('accepts only recent, distinct on-chain pump creations with valid mints', () => {
  const fresh = new Date(now - 5_000).toISOString();
  const stale = new Date(now - 20 * 60_000).toISOString();
  expect(parseBitqueryLaunches({ data: { Solana: { TokenSupplyUpdates: [row(fresh), row(fresh), row(stale, creator), row(fresh, 'bad')] } } }, now))
    .toMatchObject([{ id: mint, dev: creator, name: 'Measured token', createdAt: fresh }]);
  expect(parseBitqueryLaunches({ errors: [{ message: 'quota' }] }, now)).toBeNull();
  expect(parseBitqueryLaunches({ data: { Solana: { TokenSupplyUpdates: [] } } }, now)).toEqual([]);
});

it('returns provider-backed launches without inventing missing price or holder metrics', async () => {
  const createdAt = new Date(now - 5_000).toISOString();
  const fetcher = vi.fn(async (url: string, _options?: RequestInit) => url.startsWith('https://streaming.bitquery.io')
    ? { ok: true, json: async () => ({ data: { Solana: { TokenSupplyUpdates: [row(createdAt)] } } }) }
    : { ok: true, json: async () => [] });
  vi.stubGlobal('fetch', fetcher);
  const rows = await getBitqueryRecentLaunches();
  expect(rows).toHaveLength(1);
  expect(rows[0].token).toMatchObject({ mint, lifecycleEvidence: { source: 'bitquery-pump-creation' },
    creatorEvidence: { source: 'bitquery-pump-creation' } });
  expect(rows[0].token.priceUsd).toBe('');
  expect(rows[0].token.holdersCount).toBeUndefined();
  expect(rows[0].token.marketEvidence).toBeUndefined();
  expect(String(fetcher.mock.calls[0][0])).not.toContain('test-server-secret');
  expect((fetcher.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer test-server-secret');
});
