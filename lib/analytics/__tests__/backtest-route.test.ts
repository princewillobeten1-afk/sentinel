import { describe, expect, it, vi } from 'vitest';
import { getChartHistory } from '@/lib/market/chart-history';
import { POST } from '@/app/api/v1/analytics/backtest/route';

vi.mock('@/lib/market/chart-history', () => ({ getChartHistory: vi.fn() }));
const mint = 'So11111111111111111111111111111111111111112';

describe('measured backtest API', () => {
  it('rejects requests without an exact mint', async () => {
    const response = await POST(new Request('http://localhost/api/v1/analytics/backtest', {
      method: 'POST', body: JSON.stringify({ mint: 'SOL', timeframe: '1h' }),
    }));
    expect(response.status).toBe(400);
    expect(getChartHistory).not.toHaveBeenCalled();
  });

  it('reports insufficient real history without an invented win rate', async () => {
    vi.mocked(getChartHistory).mockResolvedValueOnce({ address: mint, timeframe: '1h', chain: 'solana',
      currency: 'usd', market: 'token-aggregate', candles: [], hasMore: false, oldestTime: null,
      observedAt: 1_700_000_000_000, source: 'birdeye-ohlcv-v3', status: 'measured' });
    const response = await POST(new Request('http://localhost/api/v1/analytics/backtest', {
      method: 'POST', body: JSON.stringify({ mint, timeframe: '1h', costPerSidePct: 0.3 }),
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.result).toMatchObject({ status: 'insufficient', bars: 0, trades: [] });
    expect(body.result.winRatePct).toBeUndefined();
  });
});
