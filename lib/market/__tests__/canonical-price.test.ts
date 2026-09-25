import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTokenPriceUsd, resetCanonicalPriceForTests, SOL_MINT } from '../canonical-price';

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

describe('canonical SOL/USD price failover', () => {
  beforeEach(() => resetCanonicalPriceForTests());
  afterEach(() => { vi.unstubAllGlobals(); resetCanonicalPriceForTests(); });

  it('uses a measured, liquid SOL/USDC pair when Jupiter is rate-limited and caches it', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { chainId: 'solana', baseToken: { address: SOL_MINT }, quoteToken: { address: USDC },
          priceUsd: '116.25', liquidity: { usd: 20_000_000 }, priceChange: { h24: 1.4 } },
      ]), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const first = await getTokenPriceUsd(SOL_MINT);
    const second = await getTokenPriceUsd(SOL_MINT);
    expect(first).toMatchObject({ usdPrice: 116.25, priceChange24h: 1.4,
      source: 'dexscreener-sol-usd' });
    expect(second?.usdPrice).toBe(116.25);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not price SOL from another base token or an illiquid pool', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { chainId: 'solana', baseToken: { address: 'other' }, quoteToken: { address: USDC },
          priceUsd: '999', liquidity: { usd: 30_000_000 } },
        { chainId: 'solana', baseToken: { address: SOL_MINT }, quoteToken: { address: USDC },
          priceUsd: '100', liquidity: { usd: 50 } },
      ]), { status: 200 })));
    expect(await getTokenPriceUsd(SOL_MINT)).toBeNull();
  });

  it('does not apply the SOL pool fallback to another mint', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 }));
    vi.stubGlobal('fetch', fetcher);
    expect(await getTokenPriceUsd('CzhWkiwzxk6RxcfY5LgzsCvJzfwwP26xxkaU8ouNpump')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
