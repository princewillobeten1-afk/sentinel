import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBitqueryDexChartHistory, parseBitqueryDexCandles, resetBitqueryDexChartForTests } from '../bitquery-dex-chart';

const mint = '7NQi2HRrV7rfUoi2ei5CdUhvwdBYpxhyecKoSrxjpump';
const row = {
  Block: { bucket: '2026-09-25T09:53:00Z' },
  Trade: { open: 0.00000330, high: 0.00000332, low: 0.00000329, close: 0.00000331 },
  volume: '3000', volumeUsd: '2.33',
};
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetBitqueryDexChartForTests(); });

describe('Bitquery raw DEX candles', () => {
  it('accepts measured OHLCV and rejects malformed or duplicate buckets', () => {
    const body = { data: { Solana: { DEXTradeByTokens: [row] } } };
    expect(parseBitqueryDexCandles(body, '1m')).toMatchObject([{ open: 0.00000330, volumeUsd: 2.33 }]);
    expect(parseBitqueryDexCandles({ data: { Solana: { DEXTradeByTokens: [row, row] } } }, '1m')).toBeNull();
    expect(parseBitqueryDexCandles({ errors: [{ message: 'quota' }] }, '1m')).toBeNull();
  });

  it('queries native SOL alongside wrapped SOL and stable quotes for fresh bonding curves', async () => {
    vi.stubEnv('BITQUERY_ACCESS_TOKEN', 'server-only-test-token');
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { Solana: { DEXTradeByTokens: [row] } } }) });
    vi.stubGlobal('fetch', fetcher);
    const result = await getBitqueryDexChartHistory(mint, '1m', 30);
    expect(result).toMatchObject({ source: 'bitquery-dex-ohlcv', market: 'token-aggregate', candles: [{ volume: 3000 }] });
    const [, options] = fetcher.mock.calls[0];
    const query = JSON.parse(options.body).query as string;
    expect(query).toContain('11111111111111111111111111111111');
    expect(query).toContain('aggregates: no');
    expect(query).not.toContain('server-only-test-token');
  });
});
