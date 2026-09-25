import { afterEach, expect, it, vi } from 'vitest';

// Opt-in read-only provider smoke. Normal test runs never consume Bitquery points.
vi.mock('@/lib/server/env', () => ({ env: { BIRDEYE_API_KEY: '' } }));
vi.mock('../geckoterminal-chart', () => ({ getGeckoChartHistory: vi.fn().mockResolvedValue(null) }));
import { getChartHistory, resetChartHistoryForTests } from '../chart-history';

afterEach(() => vi.unstubAllEnvs());

it.skipIf(process.env.BITQUERY_LIVE_SMOKE !== 'true' || !process.env.BITQUERY_ACCESS_TOKEN)(
  'returns Bitquery candles through the chart-history fallback with Birdeye unavailable', async () => {
    vi.stubEnv('BIRDEYE_API_KEY', '');
    vi.stubEnv('QUICKNODE_SOLANA_WSS_URL', '');
    resetChartHistoryForTests();
    const snapshot = await getChartHistory('So11111111111111111111111111111111111111112', '15m', 2);
    expect(snapshot).toMatchObject({ source: 'bitquery-token-ohlcv', market: 'token-aggregate', status: 'measured' });
    expect(snapshot.candles.length).toBeGreaterThan(0);
    expect(snapshot.candles.every(bar => Number.isInteger(bar.time) && bar.close > 0)).toBe(true);
  },
);
