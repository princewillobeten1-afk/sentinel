import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetLifecycle, applyCurveReading, recordMigration, recordPairCreated } from '@/lib/market/lifecycle/lifecycle-engine';
import { INITIAL_REAL_TOKEN_RESERVES } from '@/lib/market/lifecycle/bonding-curve';
import type { BondingCurveState } from '@/lib/market/lifecycle/types';
import { __resetLifecycleFeed } from '../lifecycle-feed';
import { __resetLiveSolanaFeedForTests, getLiveDiscoveryTokens } from '../live-solana-feed';
import { fetchJupiterFeed, fetchJupiterTokensByMint, mapJupiterToken, type JupiterToken } from '../jupiter-feed';
import { fetchDexPairSnapshots } from '../dexscreener-market';
import { getBitqueryRecentLaunches } from '../bitquery-launch-feed';

vi.mock('../jupiter-feed', async (original) => ({
  ...await original<typeof import('../jupiter-feed')>(),
  fetchJupiterFeed: vi.fn(), fetchJupiterTokensByMint: vi.fn(),
}));
vi.mock('../dexscreener-market', async (original) => ({
  ...await original<typeof import('../dexscreener-market')>(), fetchDexPairSnapshots: vi.fn(),
}));
vi.mock('../bitquery-launch-feed', () => ({ getBitqueryRecentLaunches: vi.fn() }));

const now = Date.parse('2026-09-21T10:00:00Z');
const token = (id: string, extras: Partial<JupiterToken> = {}): JupiterToken => ({
  id, name: 'Same name', symbol: 'SAME', launchpad: 'pump.fun', liquidity: 5000,
  firstPool: { id, createdAt: new Date(now - 60_000).toISOString() }, ...extras,
});
const curve = (progress: number, readAt = now): BondingCurveState => ({
  progress, readAt, complete: false, baselineRealTokenReserves: INITIAL_REAL_TOKEN_RESERVES,
  realTokenReserves: INITIAL_REAL_TOKEN_RESERVES - BigInt(Math.floor(Number(INITIAL_REAL_TOKEN_RESERVES) * progress)),
  virtualTokenReserves: 1_000n, virtualSolReserves: 30_000_000_000n,
  realSolReserves: 0n, tokenTotalSupply: 1_000_000_000_000_000n,
});
const migrate = (mint: string, at = now - 60_000) => recordMigration(mint, {
  signature: `confirmed-${mint}`, poolAddress: `pool-${mint}`, dex: 'PumpSwap', migratedAt: at,
});

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv('LIFECYCLE_FINAL_STRETCH_PCT', '80');
  vi.clearAllMocks(); __resetLifecycle(); __resetLifecycleFeed(); __resetLiveSolanaFeedForTests();
  vi.mocked(fetchJupiterTokensByMint).mockImplementation(async (mints) => mints.map((mint) => token(mint)));
  vi.mocked(fetchJupiterFeed).mockResolvedValue([token('ordinary-dex', { launchpad: undefined })]);
  vi.mocked(fetchDexPairSnapshots).mockResolvedValue(new Map());
  vi.mocked(getBitqueryRecentLaunches).mockResolvedValue([]);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('real Discover endpoint column selection', () => {
  it('uses measured near-complete curves, not the recent list or market cap', async () => {
    applyCurveReading('low-21-percent', curve(0.219));
    applyCurveReading('threshold', curve(0.8));
    applyCurveReading('near', curve(0.97));
    recordPairCreated('unknown', 'pump.fun');
    applyCurveReading('stale', curve(0.96, now - 121_000));
    applyCurveReading('complete-unconfirmed', { ...curve(1), complete: true });
    const rows = await getLiveDiscoveryTokens({ section: 'migrating' });
    expect(rows.map((row) => row.mint)).toEqual(['stale', 'near', 'threshold']);
    expect(rows.map((row) => row.bondingCurveProgress)).toEqual([96, 97, 80]);
    expect(rows[0].lifecycleEvidence?.status).toBe('stale');
    expect(rows.every((row) => row.lifecycleEvidence?.source === 'solana-bonding-curve')).toBe(true);
    expect(fetchJupiterFeed).not.toHaveBeenCalled();
  });

  it('retains the last confirmed migrations regardless of a two-hour clock window', async () => {
    migrate('old-launch-new-migration', now - 10_000);
    migrate('new-launch-older-migration', now - 50_000);
    migrate('expired', now - 3 * 60 * 60_000);
    vi.mocked(fetchJupiterTokensByMint).mockImplementation(async (mints) => [
      ...mints.map((mint) => token(mint, { firstPool: { createdAt: new Date(now - 30 * 86400_000).toISOString() } })),
      token('unrequested-dex-pair', { launchpad: undefined }),
    ]);
    const rows = await getLiveDiscoveryTokens({ section: 'graduated' });
    expect(rows.map((row) => row.mint)).toEqual(['old-launch-new-migration', 'new-launch-older-migration', 'expired']);
    expect(rows[0]).toMatchObject({ migrationSignature: 'confirmed-old-launch-new-migration',
      migratedPool: 'pool-old-launch-new-migration', lifecycleState: 'migrated', bondingStatus: 'graduated' });
    expect(rows[0].ageMinutes).toBeGreaterThan(1000);
    expect(rows[0].bondingCurveProgress).toBeUndefined();
  });

  it('does not collapse different confirmed mints sharing a name or require indexed liquidity', async () => {
    migrate('a'); migrate('b');
    vi.mocked(fetchJupiterTokensByMint).mockResolvedValue([token('a', { liquidity: 0 }), token('b', { liquidity: undefined })]);
    expect((await getLiveDiscoveryTokens({ section: 'graduated' })).map((row) => row.mint)).toEqual(['a', 'b']);
  });

  it('removes a token that migrates while metadata is loading', async () => {
    applyCurveReading('racing', curve(0.99));
    vi.mocked(fetchJupiterTokensByMint).mockImplementation(async () => {
      migrate('racing'); return [token('racing')];
    });
    expect(await getLiveDiscoveryTokens({ section: 'migrating' })).toEqual([]);
    expect((await getLiveDiscoveryTokens({ section: 'graduated' }))[0].mint).toBe('racing');
  });

  it('does not advertise a completed curve as migrated without a transaction', async () => {
    applyCurveReading('awaiting-proof', { ...curve(1), complete: true });
    expect(await getLiveDiscoveryTokens({ section: 'graduated' })).toEqual([]);
  });

  it('keeps confirmed rows with unknown metadata and deduplicates overlapping reads', async () => {
    migrate('real');
    vi.mocked(fetchJupiterTokensByMint).mockResolvedValue([]);
    const fallback = await getLiveDiscoveryTokens({ section: 'graduated' });
    expect(fallback[0]).toMatchObject({ mint: 'real', marketEvidence: { status: 'unavailable' } });
    vi.mocked(fetchJupiterTokensByMint).mockResolvedValue([token('real')]);
    vi.mocked(fetchJupiterTokensByMint).mockClear();
    await Promise.all([getLiveDiscoveryTokens({ section: 'graduated' }), getLiveDiscoveryTokens({ section: 'graduated' })]);
    expect(fetchJupiterTokensByMint).toHaveBeenCalledTimes(1);
  });

  it('retains real lifecycle rows and marks metadata stale across a provider outage', async () => {
    migrate('real');
    vi.mocked(fetchJupiterTokensByMint).mockResolvedValue([token('real')]);
    const first = (await getLiveDiscoveryTokens({ section: 'graduated' }))[0];
    expect(first.lifecycleEvidence?.status).toBe('measured');
    const observedAt = first.marketEvidence?.observedAt;
    await vi.advanceTimersByTimeAsync(61_000);
    vi.mocked(fetchJupiterTokensByMint).mockResolvedValue([]);
    const retained = (await getLiveDiscoveryTokens({ section: 'graduated' }))[0];
    expect(retained.mint).toBe('real');
    expect(retained.marketEvidence).toMatchObject({ status: 'stale', observedAt });
    expect(retained.lifecycleEvidence?.status).toBe('measured');
  });

  it('decorates confirmed migrations from a measured Dex pair when Jupiter is limited', async () => {
    migrate('real');
    vi.mocked(fetchJupiterTokensByMint).mockResolvedValue([]);
    vi.mocked(fetchDexPairSnapshots).mockResolvedValue(new Map([['real', {
      chainId: 'solana', pairAddress: 'measured-pool',
      baseToken: { address: 'real', name: 'Real Token', symbol: 'REAL' },
      quoteToken: { address: 'So11111111111111111111111111111111111111112' },
      priceUsd: '0.001', marketCap: 100_000, liquidity: { usd: 50_000 },
      volume: { h1: 1200 }, txns: { h1: { buys: 7, sells: 4 } },
    }]]));
    const row = (await getLiveDiscoveryTokens({ section: 'graduated' }))[0];
    expect(row).toMatchObject({ mint: 'real', name: 'Real Token', priceUsd: '0.001',
      buysCount1h: 7, sellsCount1h: 4, migrationSignature: 'confirmed-real',
      migratedPool: 'pool-real', marketEvidence: { source: 'dexscreener-token-rest' } });
    expect(row.ageFormatted).toBe('—');
    expect(row.holdersCount).toBeUndefined();
  });

  it('renders every confirmed mint when metadata is only partially indexed', async () => {
    migrate('a'); migrate('b');
    vi.mocked(fetchJupiterTokensByMint).mockResolvedValue([token('a')]);
    const rows = await getLiveDiscoveryTokens({ section: 'graduated' });
    expect(rows.map((row) => row.mint)).toEqual(['a', 'b']);
    expect(rows[1].marketEvidence?.status).toBe('unavailable');
  });

  it('leaves New Pairs on the existing recent-token source', async () => {
    expect((await getLiveDiscoveryTokens({ section: 'new' })).map((row) => row.mint)).toEqual(['ordinary-dex']);
    expect(fetchJupiterFeed).toHaveBeenCalledWith('recent', { limit: 30 });
  });

  it('uses measured Bitquery pump launches only when Jupiter recent is unavailable', async () => {
    vi.mocked(fetchJupiterFeed).mockRejectedValue(new Error('Jupiter HTTP 429'));
    const raw = token('bitquery-launch', { createdAt: new Date(now - 5_000).toISOString(), liquidity: undefined });
    const mapped = mapJupiterToken(raw);
    mapped.lifecycleEvidence = { status: 'measured', source: 'bitquery-pump-creation', observedAt: raw.createdAt! };
    vi.mocked(getBitqueryRecentLaunches).mockResolvedValue([{ raw, token: mapped }]);
    const rows = await getLiveDiscoveryTokens({ section: 'new' });
    expect(rows.map(row => row.mint)).toEqual(['bitquery-launch']);
    expect(rows[0].liquidityUsd).toBe('');
    expect(rows[0].lifecycleEvidence?.source).toBe('bitquery-pump-creation');
    expect(getBitqueryRecentLaunches).toHaveBeenCalledOnce();
  });

  it('never repeats a known final-stretch or migrated mint in New Pairs', async () => {
    applyCurveReading('near', curve(0.91));
    migrate('moved');
    vi.mocked(fetchJupiterFeed).mockResolvedValue([
      token('fresh'), token('near'), token('moved'),
      token('graduated-by-jupiter', { graduatedPool: 'verified-pool' }),
    ]);
    const rows = await getLiveDiscoveryTokens({ section: 'new' });
    expect(rows.map(row => row.mint)).toEqual(['fresh']);
  });
});
