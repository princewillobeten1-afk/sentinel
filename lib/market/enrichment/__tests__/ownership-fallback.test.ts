import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  tracker: vi.fn(),
  rugcheck: vi.fn(),
  onchain: vi.fn(),
  trackerConfigured: vi.fn(),
  bitquery: vi.fn(),
}));

vi.mock('@/lib/trading/solana-tracker', () => ({
  fetchTrackerOwnership: mocks.tracker,
  trackerConfigured: mocks.trackerConfigured,
}));

vi.mock('@/lib/trading/rugcheck-ownership', () => ({
  fetchRugcheckOwnership: mocks.rugcheck,
}));

vi.mock('@/lib/trading/onchain-ownership', () => ({
  fetchOnChainOwnership: mocks.onchain,
}));

vi.mock('../bitquery-ownership', () => ({
  fetchBitqueryOwnership: mocks.bitquery,
}));

describe('ownership fallback orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.trackerConfigured.mockReturnValue(false);
    mocks.tracker.mockResolvedValue(null);
    mocks.rugcheck.mockResolvedValue(null);
    mocks.onchain.mockResolvedValue(null);
    mocks.bitquery.mockResolvedValue(null);
  });

  it('uses tracker when configured and successful', async () => {
    mocks.trackerConfigured.mockReturnValue(true);
    mocks.tracker.mockResolvedValue({
      mint: 'test-mint',
      top10Pct: 25.5,
      totalHolders: 150,
      snipersPct: 1.2,
      insidersPct: 0,
      bundlersPct: null,
      devPct: 0,
      proTraders: null,
      kols: null,
      source: 'solana-tracker-token-risk',
      fetchedAt: Date.now(),
    });

    const { resolveOwnershipFallback } = await import('../ownership-fallback');
    const result = await resolveOwnershipFallback('test-mint');

    expect(result).not.toBeNull();
    expect(result?.top10Pct).toBe(25.5);
    expect(result?.source).toBe('solana-tracker-token-risk');
    expect(mocks.rugcheck).not.toHaveBeenCalled();
    expect(mocks.onchain).not.toHaveBeenCalled();
  });

  it('falls back to Rugcheck when tracker is not configured', async () => {
    mocks.trackerConfigured.mockReturnValue(false);
    mocks.rugcheck.mockResolvedValue({
      mint: 'test-mint',
      top10Pct: 35.0,
      totalHolders: 88,
      snipersPct: null,
      insidersPct: 4.5,
      bundlersPct: null,
      devPct: 1.5,
      proTraders: null,
      kols: null,
      source: 'rugcheck-report',
      fetchedAt: Date.now(),
    });

    const { resolveOwnershipFallback } = await import('../ownership-fallback');
    const result = await resolveOwnershipFallback('test-mint');

    expect(result).not.toBeNull();
    expect(result?.top10Pct).toBe(35.0);
    expect(result?.devPct).toBe(1.5);
    expect(result?.source).toBe('rugcheck-report');
    expect(mocks.onchain).not.toHaveBeenCalled();
  });

  it('falls back to on-chain RPC when Rugcheck is unavailable', async () => {
    mocks.trackerConfigured.mockReturnValue(false);
    mocks.rugcheck.mockResolvedValue(null);
    mocks.onchain.mockResolvedValue({
      mint: 'test-mint',
      top10Pct: 42.1,
      totalHolders: null,
      snipersPct: null,
      insidersPct: null,
      bundlersPct: null,
      devPct: 0,
      proTraders: null,
      kols: null,
      source: 'solana-rpc',
      fetchedAt: Date.now(),
    });

    const { resolveOwnershipFallback } = await import('../ownership-fallback');
    const result = await resolveOwnershipFallback('test-mint');

    expect(result).not.toBeNull();
    expect(result?.top10Pct).toBe(42.1);
    expect(result?.source).toBe('solana-rpc');
  });

  it('joins only missing fields when Rugcheck returns a partial profile', async () => {
    mocks.rugcheck.mockResolvedValue({
      mint: 'test-mint',
      top10Pct: null,
      totalHolders: 200,
      snipersPct: null,
      insidersPct: 2.1,
      bundlersPct: null,
      devPct: 3.0,
      proTraders: null,
      kols: null,
      source: 'rugcheck-report',
      fetchedAt: Date.now(),
    });

    mocks.onchain.mockResolvedValue({
      mint: 'test-mint',
      top10Pct: 48.2,
      totalHolders: null,
      snipersPct: null,
      insidersPct: null,
      bundlersPct: null,
      devPct: 3.0,
      proTraders: null,
      kols: null,
      source: 'solana-rpc',
      fetchedAt: Date.now(),
    });

    const { resolveOwnershipFallback } = await import('../ownership-fallback');
    const result = await resolveOwnershipFallback('test-mint', 'creator-wallet');
    expect(result?.top10Pct).toBe(48.2);
    expect(result?.devPct).toBe(3.0);
    expect(result?.source).toBe('rugcheck-report+solana-rpc');
    expect(mocks.onchain).toHaveBeenCalled();
  });

  it('fills a missing holder count from a complete Bitquery snapshot', async () => {
    mocks.onchain.mockResolvedValue({
      mint: 'test-mint', top10Pct: 42, totalHolders: null, snipersPct: null,
      insidersPct: null, bundlersPct: null, devPct: null, proTraders: null,
      kols: null, source: 'quicknode-rpc', fetchedAt: Date.now(),
    });
    mocks.bitquery.mockResolvedValue({
      mint: 'test-mint', top10Pct: 41, totalHolders: 27, snipersPct: null,
      insidersPct: null, bundlersPct: null, devPct: 3, proTraders: null,
      kols: null, source: 'bitquery-balance-updates+solana-rpc-supply', fetchedAt: Date.now(),
    });
    const { resolveOwnershipFallback } = await import('../ownership-fallback');
    const result = await resolveOwnershipFallback('test-mint', 'creator-wallet');
    expect(result?.top10Pct).toBe(42);
    expect(result?.totalHolders).toBe(27);
    expect(result?.devPct).toBe(3);
    expect(result?.source).toContain('bitquery-balance-updates');
  });
});
