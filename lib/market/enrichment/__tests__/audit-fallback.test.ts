import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  birdeye: vi.fn(), tracker: vi.fn(), update: vi.fn(),
}));
vi.mock('../holder-profile', () => ({ fetchHolderProfileResult: mocks.birdeye }));
vi.mock('@/lib/trading/solana-tracker', () => ({
  fetchTrackerOwnership: mocks.tracker,
  trackerConfigured: () => true,
}));
vi.mock('@/lib/server/redis', () => ({ redis: { claim: vi.fn().mockResolvedValue(true) } }));
vi.mock('@/lib/market/live/card-cache', () => ({ getTokenCardPatch: vi.fn(), updateTokenCard: mocks.update }));
vi.mock('@/lib/server/db/token-card-evidence-repository', () => ({ saveTokenCardEvidence: vi.fn().mockResolvedValue(undefined) }));

describe('audit provider fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.birdeye.mockResolvedValue({ kind: 'failed', status: 401 });
    mocks.tracker.mockResolvedValue({ mint: 'mint', top10Pct: 17, totalHolders: 30,
      snipersPct: 0, insidersPct: 2, bundlersPct: null, devPct: 1,
      proTraders: null, kols: null, source: 'solana-tracker-token-risk', fetchedAt: Date.now() });
  });

  it('publishes measured fallback fields but leaves absent classes unknown', async () => {
    const worker = await import('../audit-worker');
    worker.__resetAudit();
    worker.queueAudit(['mint']);
    await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledWith('mint',
      expect.objectContaining({
        top10HoldingsPct: 17, sniperPercentage: 0, insiderHoldingsPct: 2,
        bundlerPercentage: undefined,
        ownershipEvidence: expect.objectContaining({ status: 'measured', source: 'solana-tracker-token-risk' }),
      }), 'solana-tracker-token-risk', 'fresh', expect.any(String)), { timeout: 5000 });
    expect(mocks.birdeye).toHaveBeenCalledTimes(1);
    expect(mocks.tracker).toHaveBeenCalledTimes(1);
  });
});
