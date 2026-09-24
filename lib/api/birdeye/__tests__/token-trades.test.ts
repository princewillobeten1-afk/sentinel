import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('../client', () => ({ birdeye: { fetch: fetchMock } }));
import { getTokenTrades, getTokenTradesByVolume } from '../transactions';

describe('Birdeye token trades', () => {
  beforeEach(() => { vi.clearAllMocks(); fetchMock.mockResolvedValue({ items: [{ tx_hash: 'signature' }] }); });

  it('uses the transaction list rather than aggregate trade stats', async () => {
    expect(await getTokenTrades('mint', 0, 20)).toEqual([{ tx_hash: 'signature' }]);
    expect(fetchMock.mock.calls[0][0]).toContain('/defi/v3/token/txs?');
    expect(fetchMock.mock.calls[0][0]).toContain('address=mint');
    expect(fetchMock.mock.calls[0][0]).not.toContain('trade-data/single');
  });

  it('sends required USD volume filters to the volume endpoint', async () => {
    await getTokenTradesByVolume('mint', 10_000, 0, 30);
    const path = fetchMock.mock.calls[0][0] as string;
    expect(path).toContain('/defi/v3/token/txs-by-volume?');
    expect(path).toContain('token_address=mint');
    expect(path).toContain('volume_type=usd');
    expect(path).toContain('min_volume=10000');
    expect(path).toContain('sort_type=desc');
  });
});
