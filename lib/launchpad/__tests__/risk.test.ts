import { describe, expect, it } from 'vitest';
import { LaunchRiskEngine } from '../risk';
import { LaunchMode, type LaunchConfig } from '../types';

function buildConfig(symbol: string, allocationPct = 5): LaunchConfig {
  return {
    name: `${symbol} Test Launch`,
    symbol,
    description: 'test',
    totalSupply: '1000000000',
    creatorAllocation: { walletAddress: '0xTestCreator', percentage: allocationPct, isVested: false },
    launchMode: LaunchMode.BONDING_CURVE,
  };
}

describe('LaunchRiskEngine.analyzePreLaunch — known creator/token (SENT)', () => {
  it('uses the real creator-reputation and ownership engines, not flat stub values', async () => {
    const engine = new LaunchRiskEngine();
    const result = await engine.analyzePreLaunch(buildConfig('SENT'), 'unrelated-wallet');

    // The old stubs always returned exactly 85 / 10 regardless of input — a real
    // engine result should differ from at least one of those flat values for SENT
    // (has real launch history and real holder/cluster mock data).
    expect(result.creatorReputationScore === 85 && result.walletClusteringScore === 10).toBe(false);
    expect(result.primaryConcern ?? '').not.toMatch(/could not be verified/);
  });
});

describe('LaunchRiskEngine.analyzePreLaunch — insufficient-sample creator (QUANT)', () => {
  it('falls back to the neutral unverified default when reputation score is null', async () => {
    const engine = new LaunchRiskEngine();
    const result = await engine.analyzePreLaunch(buildConfig('QUANT'), 'unrelated-wallet');

    // QUANT's real reputation score is null (insufficient sample) — the engine
    // must not silently substitute the old stub's flat optimistic 85.
    expect(result.creatorReputationScore).toBe(50);
  });
});

describe('LaunchRiskEngine.analyzePreLaunch — unknown symbol', () => {
  it('flags an unrecognized creator/symbol as unverified with cautious neutral defaults', async () => {
    const engine = new LaunchRiskEngine();
    const result = await engine.analyzePreLaunch(buildConfig('TOTALLY_UNKNOWN_SYMBOL_XYZ'), 'never-seen-wallet');

    expect(result.creatorReputationScore).toBe(50);
    expect(result.walletClusteringScore).toBe(25);
    expect(result.primaryConcern).toMatch(/could not be verified/);
  });

  it('does not read as trustworthy as the old stub default (85/10) for an unknown launch', async () => {
    const engine = new LaunchRiskEngine();
    const result = await engine.analyzePreLaunch(buildConfig('ANOTHER_UNKNOWN', 3), 'never-seen-wallet');

    expect(result.creatorReputationScore).toBeLessThan(85);
  });
});

describe('LaunchRiskEngine.analyzePreLaunch — allocation risk', () => {
  // Threshold moved from >10% to >15% in Sprint 36 (reconciling three
  // conflicting caps found across risk.ts/validator.ts/the architecture
  // docs — see docs/contracts/09-creator-accountability-and-reputation.md).
  // 16% is now the smallest input that trips the hard-cap wording.
  it('flags allocation above the 15% hard cap regardless of reputation', async () => {
    const engine = new LaunchRiskEngine();
    const result = await engine.analyzePreLaunch(buildConfig('SENT', 16), 'unrelated-wallet');
    expect(result.primaryConcern).toMatch(/exceeds the platform's 15% hard cap/i);
  });

  it('flags allocation between 10% and 15% as approaching the cap, not exceeding it', async () => {
    const engine = new LaunchRiskEngine();
    const result = await engine.analyzePreLaunch(buildConfig('SENT', 12), 'unrelated-wallet');
    expect(result.primaryConcern).toMatch(/approaching the 15% cap/i);
    expect(result.primaryConcern).not.toMatch(/exceeds/i);
  });

  it('does not trigger the hard-cap concern at exactly 15% (boundary is > not >=)', async () => {
    const engine = new LaunchRiskEngine();
    const result = await engine.analyzePreLaunch(buildConfig('SENT', 15), 'unrelated-wallet');
    expect(result.primaryConcern ?? '').not.toMatch(/hard cap/i);
  });
});
