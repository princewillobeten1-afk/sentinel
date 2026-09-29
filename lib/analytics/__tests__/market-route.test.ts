import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/v1/analytics/market/route';
import { getMarketAggregates, getMarketMovers } from '@/lib/analytics/market-aggregates';

vi.mock('@/lib/analytics/market-aggregates', () => ({
  getMarketAggregates: vi.fn(),
  getMarketMovers: vi.fn(),
}));

const aggregate = {
  totalVolumeUsd: 1000, buyVolumeUsd: 400, sellVolumeUsd: 500,
  organicVolumeUsd: null, organicEligibleVolumeUsd: null, organicCoverageTokens: 0,
  organicVolumePct: null, washTradingProbabilityPct: null,
  suspectedWashVolumeUsd: null, medianPoolDepthUsd: 2000,
  newMintsCount24h: 2, advanceDeclineRatio: 2, solanaPriceChange24hPct: null,
  totalLiquidityUsd: 8000, traderCount24h: null, tokenCount: 12,
  advancingCount: 6, decliningCount: 3, unchangedCount: 1,
  updatedAt: '2026-09-28T00:00:00.000Z',
};

describe('measured analytics market response', () => {
  beforeEach(() => {
    vi.mocked(getMarketAggregates).mockReset().mockResolvedValue(aggregate);
    vi.mocked(getMarketMovers).mockReset().mockResolvedValue({
      gainers: [{ mint: 'MintUp', symbol: 'UP', name: 'Up', change24hPct: 12,
        volume24hUsd: 300, liquidityUsd: 2000, observedAt: aggregate.updatedAt }],
      decliners: [{ mint: 'MintDown', symbol: 'DOWN', name: 'Down', change24hPct: -4,
        volume24hUsd: 200, liquidityUsd: 1500, observedAt: aggregate.updatedAt }],
    });
  });

  it('returns measured breadth, movers and unknown organic volume without inventing values', async () => {
    const response = await GET(new Request('http://localhost/api/v1/analytics/market?timeframe=24h'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.breadth).toEqual({ advancing: 6, declining: 3, unchanged: 1, unknown: 2 });
    expect(body.movers.gainers[0]).toMatchObject({ mint: 'MintUp', change24hPct: 12 });
    expect(body.movers.decliners[0]).toMatchObject({ mint: 'MintDown', change24hPct: -4 });
    expect(body.volumeDecomposition.organicVolumePct).toBeNull();
  });

  it('rejects unsupported windows instead of relabelling a 24h snapshot', async () => {
    const response = await GET(new Request('http://localhost/api/v1/analytics/market?timeframe=1h'));
    expect(response.status).toBe(400);
    expect(vi.mocked(getMarketAggregates)).not.toHaveBeenCalled();
  });

  it('returns a neutral failure without leaking a database error', async () => {
    vi.mocked(getMarketAggregates).mockRejectedValue(new Error('private database host name'));
    const response = await GET(new Request('http://localhost/api/v1/analytics/market'));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('private database host name');
  });
});
