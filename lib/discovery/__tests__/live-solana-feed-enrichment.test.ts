import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLiveDiscoveryTokens } from '../live-solana-feed';

vi.mock('../jupiter-feed', async (original) => ({
  ...await original<typeof import('../jupiter-feed')>(),
  fetchJupiterFeed: vi.fn().mockResolvedValue([
    {
      id: 'test-mint-1',
      name: 'Alpha Token',
      symbol: 'ALPHA',
      launchpad: 'pump.fun',
      usdPrice: '0.005',
      mcap: 50000,
      liquidity: 10000,
      holderCount: 250,
      audit: {
        devBalancePercentage: 2.5,
        mintAuthorityDisabled: true,
        freezeAuthorityDisabled: true,
      },
    },
  ]),
}));

vi.mock('@/lib/market/live/card-cache', () => ({
  hydrateTokenCards: vi.fn().mockResolvedValue(undefined),
  getTokenCardPatch: vi.fn((mint: string) => {
    if (mint === 'test-mint-1') {
      return {
        mint,
        sequence: 1,
        source: 'birdeye-holder-profile',
        freshness: 'fresh',
        observedAt: new Date().toISOString(),
        changedFields: {
          top10HoldingsPct: 45.2,
          devHoldingsPct: 2.5,
          sniperPercentage: 1.1,
          insiderHoldingsPct: 0.5,
          bundlerPercentage: 12.0,
          proTradersCount: 2,
          kolsCount: 1,
          rugRisk: { score: 25, level: 'low', factors: [], version: '1.0' },
          ownershipEvidence: { status: 'measured', source: 'birdeye-holder-profile', observedAt: new Date().toISOString() },
        },
      };
    }
    return undefined;
  }),
}));

vi.mock('@/lib/market/enrichment/audit-worker', () => ({
  getAudit: vi.fn(),
  isAuditPending: vi.fn().mockReturnValue(false),
  queueAudit: vi.fn(),
}));

describe('live solana feed audit enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges card cache ownership metrics and evidence into discovery tokens', async () => {
    const tokens = await getLiveDiscoveryTokens({ section: 'hot' });
    expect(tokens.length).toBeGreaterThan(0);
    const token = tokens.find((t) => t.mint === 'test-mint-1');
    expect(token).toBeDefined();
    expect(token?.top10HoldingsPct).toBe(45.2);
    expect(token?.devHoldingsPct).toBe(2.5);
    expect(token?.sniperPercentage).toBe(1.1);
    expect(token?.insiderHoldingsPct).toBe(0.5);
    expect(token?.bundlerPercentage).toBe(12.0);
    expect(token?.proTradersCount).toBe(2);
    expect(token?.kolsCount).toBe(1);
    expect(token?.ownershipEvidence?.status).toBe('measured');
    expect(token?.rugRisk?.score).toBe(25);
  });
});
