import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbPool } from '@/lib/server/db/pool';
import { getMarketAggregates, getMarketMovers } from '../market-aggregates';

vi.mock('@/lib/server/db/pool', () => ({ dbPool: { query: vi.fn() } }));

describe('market analytics observations', () => {
  beforeEach(() => vi.mocked(dbPool.query).mockReset());

  it('uses only covered volume as the organic percentage denominator', async () => {
    vi.mocked(dbPool.query)
      .mockResolvedValueOnce({ rows: [{ token_count: '10', total_volume: '1000', buy_volume: '400', sell_volume: '500',
        organic_volume: '100', organic_eligible_volume: '200', organic_coverage_tokens: '2',
        total_liquidity: '5000', median_depth: '500', trader_count: null, new_mints_24h: '1',
        advancing: '4', declining: '3', unchanged: '1', updated_at: '2026-09-28T00:00:00Z' }] })
      .mockResolvedValueOnce({ rows: [{ price_change_24h: null }] });
    const data = await getMarketAggregates();
    expect(data.organicVolumePct).toBe(50);
    expect(data.suspectedWashVolumeUsd).toBe(100);
    expect(data.organicCoverageTokens).toBe(2);
    expect(data.advancingCount).toBe(4);
    expect(data.solanaPriceChange24hPct).toBeNull();
  });

  it('keeps organic share unknown when no comparable denominator exists', async () => {
    vi.mocked(dbPool.query)
      .mockResolvedValueOnce({ rows: [{ token_count: '1', total_volume: '1000', organic_volume: null,
        organic_eligible_volume: null, organic_coverage_tokens: '0', advancing: '0', declining: '0',
        unchanged: '0', new_mints_24h: '0', updated_at: null }] })
      .mockResolvedValueOnce({ rows: [] });
    const data = await getMarketAggregates();
    expect(data.organicVolumePct).toBeNull();
    expect(data.suspectedWashVolumeUsd).toBeNull();
  });

  it('maps positive and negative movers without turning missing liquidity into zero', async () => {
    vi.mocked(dbPool.query)
      .mockResolvedValueOnce({ rows: [{ mint: 'UP', symbol: 'UP', name: 'Up', change_text: '12.5',
        volume_24h_usd: '200', liquidity_usd: '1000', enriched_at: '2026-09-28T00:00:00Z' }] })
      .mockResolvedValueOnce({ rows: [{ mint: 'DOWN', symbol: 'DOWN', name: 'Down', change_text: '-4.25',
        volume_24h_usd: '300', liquidity_usd: null, enriched_at: null }] });
    const data = await getMarketMovers();
    expect(data.gainers[0]).toMatchObject({ change24hPct: 12.5, liquidityUsd: 1000 });
    expect(data.decliners[0]).toMatchObject({ change24hPct: -4.25, liquidityUsd: null, observedAt: null });
    expect(vi.mocked(dbPool.query).mock.calls[1][0]).toContain('ORDER BY realtime_tokens.price_change_24h ASC');
  });
});
