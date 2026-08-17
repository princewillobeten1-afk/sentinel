import { describe, it, expect } from 'vitest';
import { CreatorAiAnalyst } from '../creator-analyst';
import { WalletAiAnalyst } from '../wallet-analyst';

describe('Creator & Wallet Behavioral Profiler (Sprint 37 §32-34)', () => {
  it('analyzes creator history and flags serial liquidity drains', () => {
    const analysis = CreatorAiAnalyst.analyzeCreator({
      creatorAddress: 'creator_bad_actor_99',
      reputationScore: 18,
      totalLaunches: 8,
      successfulLaunches: 1,
      rugPullCount: 5,
    });

    expect(analysis.overallVerdict).toBe('KNOWN_BAD_ACTOR');
    expect(analysis.observedFacts.length).toBeGreaterThan(0);
    expect(analysis.inferences.length).toBeGreaterThan(0);
    expect(analysis.confidence).toBe('HIGH');
  });

  it('profiles wallet behavior separating observed facts from inferences', () => {
    const analysis = WalletAiAnalyst.analyzeWallet({
      walletAddress: 'wallet_sniper_001',
      totalTokensTraded: 50,
      earlyEntryCount: 38,
      clusterSize: 4,
      creatorLinkDetected: true,
    });

    expect(analysis.observedFacts.some((f) => f.includes('38'))).toBe(true);
    expect(analysis.creatorLinkProbabilityPct).toBeGreaterThan(90);
    expect(analysis.confidence).toBe('HIGH');
  });
});
