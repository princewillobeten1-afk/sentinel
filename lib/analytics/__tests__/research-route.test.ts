import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbPool } from '@/lib/server/db/pool';
import { GET } from '@/app/api/v1/analytics/research/route';

vi.mock('@/lib/server/db/pool', () => ({ dbPool: { query: vi.fn() } }));

describe('measured research API', () => {
  beforeEach(() => vi.mocked(dbPool.query).mockReset());

  it('returns stored values and preserves unknown measurements', async () => {
    vi.mocked(dbPool.query).mockResolvedValueOnce({ rows: [{ mint: 'So11111111111111111111111111111111111111112',
      name: 'Token', symbol: 'TKN', price_usd: '0.000012', price_change_24h: '-12.5',
      market_cap_usd: null, liquidity_usd: '1500', volume_24h_usd: '200',
      buy_volume_24h_usd: null, sell_volume_24h_usd: null,
      organic_volume_24h_usd: null, holder_count: null, pool_address: null,
      enriched_at: '2026-09-28T00:00:00Z' }] });
    const response = await GET(new Request('http://localhost/api/v1/analytics/research?sort=decliners'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ranked[0]).toMatchObject({ change24hPct: -12.5, liquidityUsd: 1500,
      marketCapUsd: null, buyVolume24hUsd: null, holderCount: null });
    expect(vi.mocked(dbPool.query).mock.calls[0][0]).toContain('ORDER BY realtime_tokens.price_change_24h ASC');
  });

  it('rejects arbitrary sort expressions without querying', async () => {
    const response = await GET(new Request('http://localhost/api/v1/analytics/research?sort=drop'));
    expect(response.status).toBe(400);
    expect(dbPool.query).not.toHaveBeenCalled();
  });

  it('labels processed wallet observations as provisional', async () => {
    vi.mocked(dbPool.query)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ wallet: 'WalletAddress', buys: '2', sells: '1',
        provisional: '1', last_seen: '2026-09-28T00:00:00Z' }] });
    const mint = 'So11111111111111111111111111111111111111112';
    const response = await GET(new Request(`http://localhost/api/v1/analytics/research?mint=${mint}`));
    const body = await response.json();
    expect(body.observedWallets[0]).toMatchObject({ buys: 2, sells: 1, provisional: 1 });
  });

  it('does not leak database failures', async () => {
    vi.mocked(dbPool.query).mockRejectedValueOnce(new Error('private host'));
    const response = await GET(new Request('http://localhost/api/v1/analytics/research'));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('private host');
  });
});
