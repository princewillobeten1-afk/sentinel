import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateXTrackerFeed, getXTrackerStats, _resetXTrackerCacheForTesting } from '../x-tracker-service';
import { fetchJupiterFeed } from '@/lib/discovery/jupiter-feed';

vi.mock('@/lib/discovery/jupiter-feed', () => ({
  fetchJupiterFeed: vi.fn(),
  hasGraduated: vi.fn((token: any) => Boolean(token.graduatedPool)),
}));

describe('X Tracker Service & Feed Pipeline', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchJupiterFeed).mockResolvedValue([]);
    _resetXTrackerCacheForTesting();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const mockDexProfiles = [
    {
      chainId: 'solana',
      tokenAddress: 'FOMONPC111111111111111111111111111111111111',
      icon: 'https://dd.dexscreener.com/ds-data/tokens/solana/fomonpc.png',
      description: 'FOMO NPC community on Solana',
      links: [
        { type: 'twitter', url: 'https://x.com/fomonpc_sol' },
        { type: 'telegram', url: 'https://t.me/fomonpc' },
      ],
    },
    {
      chainId: 'solana',
      tokenAddress: 'GX111111111111111111111111111111111111111111',
      icon: 'https://dd.dexscreener.com/ds-data/tokens/solana/gx.png',
      description: 'Guangxi token',
      links: [
        { type: 'twitter', url: 'https://x.com/Guangxi_Cheng/status/2104065972193857708' },
      ],
    },
  ];

  const mockDexPairs = [
    {
      chainId: 'solana',
      dexId: 'raydium',
      url: 'https://dexscreener.com/solana/fomonpc-pair',
      pairAddress: 'PAIR111111111111111111111111111111111111111',
      baseToken: {
        address: 'FOMONPC111111111111111111111111111111111111',
        name: 'FOMO NPC',
        symbol: 'FNPC',
      },
      priceUsd: '0.0452',
      marketCap: 452000,
      liquidity: { usd: 120000 },
      volume: { h24: 85000, m5: 1200 },
      priceChange: { m5: 8.5, h1: 15.2, h24: 42.1 },
      txns: {
        m5: { buys: 14, sells: 6 },
        h1: { buys: 110, sells: 45 },
        h24: { buys: 1200, sells: 800 },
      },
    },
    {
      chainId: 'solana',
      dexId: 'pumpswap',
      url: 'https://dexscreener.com/solana/gx-pair',
      pairAddress: 'PAIR222222222222222222222222222222222222222',
      baseToken: {
        address: 'GX111111111111111111111111111111111111111111',
        name: 'Guangxi',
        symbol: 'GX',
      },
      priceUsd: '0.0012',
      marketCap: 12000,
      liquidity: { usd: 5000 },
      volume: { h24: 15000, m5: 300 },
      priceChange: { m5: -2.1, h1: 5.4, h24: -10.2 },
      txns: {
        m5: { buys: 2, sells: 3 },
        h1: { buys: 20, sells: 15 },
        h24: { buys: 150, sells: 180 },
      },
    },
  ];

  it('generates real-time callouts from live DexScreener profiles and pairs', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('token-profiles')) {
        return Promise.resolve({ ok: true, json: async () => mockDexProfiles });
      }
      if (url.includes('token-boosts')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('/latest/dex/tokens/')) {
        return Promise.resolve({ ok: true, json: async () => ({ pairs: mockDexPairs }) });
      }
      return Promise.reject(new Error('Unknown url'));
    }) as any;

    const feed = await generateXTrackerFeed({ category: 'all' });
    expect(feed.length).toBe(2);

    const fnpcCall = feed.find((c) => c.token.symbol === 'FNPC');
    expect(fnpcCall).toBeDefined();
    expect(fnpcCall?.token.chain).toBe('solana');
    expect(fnpcCall?.token.launchpad).toBe('raydium');
    expect(fnpcCall?.caller.handle).toBe('@fomonpc_sol');
    expect(fnpcCall?.metrics.currentMcap).toBe(452000);
    expect(fnpcCall?.token.priceUsd).toBe(0.0452);
    expect(fnpcCall?.metrics.pnlPercent).toBe(8.5);
    expect(fnpcCall?.metrics.multiplier).toBeGreaterThan(1.0);
    expect(fnpcCall?.tweetUrl).toBe('https://x.com/fomonpc_sol');

    const gxCall = feed.find((c) => c.token.symbol === 'GX');
    expect(gxCall).toBeDefined();
    expect(gxCall?.caller.handle).toBe('@Guangxi_Cheng');
    expect(gxCall?.tweetUrl).toBe('https://x.com/Guangxi_Cheng/status/2104065972193857708');
  });

  it('filters by category (kol, trending, minPnl)', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('token-profiles')) {
        return Promise.resolve({ ok: true, json: async () => mockDexProfiles });
      }
      if (url.includes('token-boosts')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('/latest/dex/tokens/')) {
        return Promise.resolve({ ok: true, json: async () => ({ pairs: mockDexPairs }) });
      }
      return Promise.reject(new Error('Unknown url'));
    }) as any;

    const kolFeed = await generateXTrackerFeed({ category: 'kol' });
    expect(kolFeed.length).toBeGreaterThanOrEqual(1);
    for (const call of kolFeed) {
      expect(call.isKOL || call.caller.isVerified).toBe(true);
    }

    const pnlFeed = await generateXTrackerFeed({ category: 'all', minPnl: 5 });
    expect(pnlFeed.length).toBe(1);
    expect(pnlFeed[0].token.symbol).toBe('FNPC');
    expect(pnlFeed[0].metrics.pnlPercent).toBe(8.5);
  });

  it('filters by search query matching token symbol or caller handle', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('token-profiles')) {
        return Promise.resolve({ ok: true, json: async () => mockDexProfiles });
      }
      if (url.includes('token-boosts')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('/latest/dex/tokens/')) {
        return Promise.resolve({ ok: true, json: async () => ({ pairs: mockDexPairs }) });
      }
      return Promise.reject(new Error('Unknown url'));
    }) as any;

    const fnpcSearch = await generateXTrackerFeed({ category: 'all', searchQuery: 'FNPC' });
    expect(fnpcSearch.length).toBe(1);
    expect(fnpcSearch[0].token.symbol).toBe('FNPC');

    const handleSearch = await generateXTrackerFeed({ category: 'all', searchQuery: 'Guangxi' });
    expect(handleSearch.length).toBe(1);
    expect(handleSearch[0].caller.handle).toBe('@Guangxi_Cheng');
  });

  it('falls back to Jupiter token feed when DexScreener is unavailable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

    vi.mocked(fetchJupiterFeed).mockResolvedValue([
      {
        id: 'JUP111111111111111111111111111111111111111',
        symbol: 'JUPCOIN',
        name: 'Jupiter Backed Token',
        mcap: 50000,
        usdPrice: 0.05,
        launchpad: 'pump.fun',
      } as any,
    ]);

    const feed = await generateXTrackerFeed({ category: 'all' });
    expect(feed.length).toBe(1);
    expect(feed[0].token.symbol).toBe('JUPCOIN');
    expect(feed[0].metrics.currentMcap).toBe(50000);
    expect(feed[0].token.chain).toBe('solana');
  });

  it('returns valid aggregate tracker statistics', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('token-profiles')) {
        return Promise.resolve({ ok: true, json: async () => mockDexProfiles });
      }
      if (url.includes('token-boosts')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes('/latest/dex/tokens/')) {
        return Promise.resolve({ ok: true, json: async () => ({ pairs: mockDexPairs }) });
      }
      return Promise.reject(new Error('Unknown url'));
    }) as any;

    await generateXTrackerFeed({ category: 'all' });
    const stats = getXTrackerStats();
    expect(stats.totalCallsToday).toBeGreaterThan(0);
    expect(stats.averageMultiplier).toBeGreaterThanOrEqual(1.0);
    expect(stats.topCaller.handle).toBeDefined();
  });
});
