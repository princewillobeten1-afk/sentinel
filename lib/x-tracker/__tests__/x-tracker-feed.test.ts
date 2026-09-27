import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateXTrackerFeed, getXTrackerStats } from '../x-tracker-service';
import { fetchJupiterFeed } from '@/lib/discovery/jupiter-feed';

vi.mock('@/lib/discovery/jupiter-feed', () => ({
  fetchJupiterFeed: vi.fn(),
}));

describe('X Tracker Service & Feed Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTokens = [
    {
      id: 'HSE1111111111111111111111111111111111111111',
      symbol: 'HSE',
      name: 'Horse Token',
      mcap: 3420,
      usdPrice: 0.00342,
      launchpad: 'pump.fun',
    },
    {
      id: 'TPAD111111111111111111111111111111111111111',
      symbol: 'TPAD',
      name: 'Telegram Launchpad',
      mcap: 83300,
      usdPrice: 0.0833,
      launchpad: 'pump.fun',
    },
    {
      id: 'MOON111111111111111111111111111111111111111',
      symbol: 'MOONCOIN',
      name: 'Moon Coin',
      mcap: 742000,
      usdPrice: 0.742,
      graduatedPool: 'pool-moon-1',
    },
  ];

  it('generates real-time callouts from live Jupiter tokens', async () => {
    vi.mocked(fetchJupiterFeed).mockResolvedValue(mockTokens as any);

    const feed = await generateXTrackerFeed({ category: 'all' });
    expect(feed.length).toBeGreaterThanOrEqual(3);

    const hseCall = feed.find((c) => c.token.symbol === 'HSE');
    expect(hseCall).toBeDefined();
    expect(hseCall?.token.chain).toBe('solana');
    expect(hseCall?.token.launchpad).toBe('pump.fun');
    expect(hseCall?.caller.handle).toBeDefined();
    expect(hseCall?.metrics.currentMcap).toBe(3420);
    expect(hseCall?.metrics.positionSizeUsd).toBeGreaterThan(0);
    expect(hseCall?.tweetUrl).toContain('https://x.com/');
  });

  it('filters by verified KOL category', async () => {
    vi.mocked(fetchJupiterFeed).mockResolvedValue(mockTokens as any);

    const kolFeed = await generateXTrackerFeed({ category: 'kol' });
    expect(kolFeed.length).toBeGreaterThan(0);
    for (const call of kolFeed) {
      expect(call.isKOL).toBe(true);
    }
  });

  it('filters by search query matching token symbol or caller handle', async () => {
    vi.mocked(fetchJupiterFeed).mockResolvedValue(mockTokens as any);

    const tpadFeed = await generateXTrackerFeed({ category: 'all', searchQuery: 'TPAD' });
    expect(tpadFeed.length).toBeGreaterThan(0);
    for (const call of tpadFeed) {
      expect(
        call.token.symbol.toLowerCase().includes('tpad') ||
          call.token.name.toLowerCase().includes('tpad') ||
          call.text.toLowerCase().includes('tpad')
      ).toBe(true);
    }
  });

  it('computes positive PnL and multipliers accurately', async () => {
    vi.mocked(fetchJupiterFeed).mockResolvedValue(mockTokens as any);

    const feed = await generateXTrackerFeed({ category: 'all' });
    const moonCall = feed.find((c) => c.token.symbol === 'MOONCOIN');

    expect(moonCall).toBeDefined();
    if (moonCall) {
      expect(moonCall.metrics.multiplier).toBeGreaterThanOrEqual(1.0);
      expect(moonCall.metrics.pnlPercent).toBeGreaterThanOrEqual(0);
      expect(moonCall.metrics.currentMcap).toBe(742000);
    }
  });

  it('returns valid aggregate tracker statistics', () => {
    const stats = getXTrackerStats();
    expect(stats.totalCallsToday).toBeGreaterThan(0);
    expect(stats.averageMultiplier).toBeGreaterThanOrEqual(1.0);
    expect(stats.topCaller.handle).toBeDefined();
  });
});
