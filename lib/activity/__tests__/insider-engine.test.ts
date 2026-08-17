import { describe, expect, it } from 'vitest';
import { analyzeInsiderCandidates } from '../insider-engine';
import type { ActivityContext, NormalizedTrade, WalletFundingEvent } from '../types';

describe('Insider Detection Engine', () => {
  const launchTime = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 hour ago
  const creator = '5CreatorWalletPK';
  const funder = '5PreLaunchFunderPK';

  const mockContext: ActivityContext = {
    tokenId: 'dt_insider_test',
    chain: 'solana',
    tokenCreatedAt: launchTime,
    tradingOpenedAt: launchTime,
    observedAt: new Date().toISOString(),
    creatorWallets: [creator],
    fundingEvents: [
      {
        sourceWallet: funder,
        recipientWallet: '5EarlyBuyer1PK',
        amountUsd: 10_000,
        timestamp: new Date(new Date(launchTime).getTime() - 300 * 1000).toISOString(), // Pre-launch
        relationshipToCreator: true,
      },
    ],
  };

  it('identifies early participants within the launch window', () => {
    const trades: NormalizedTrade[] = [
      {
        id: 'tr_early_1',
        tokenId: 'dt_insider_test',
        chain: 'solana',
        wallet: '5EarlyBuyer1PK',
        side: 'BUY',
        amountUsd: 15_000,
        timestamp: new Date(new Date(launchTime).getTime() + 20 * 1000).toISOString(), // 20s post launch
      },
    ];

    const report = analyzeInsiderCandidates({ trades, context: mockContext });

    expect(report.earlyParticipants.length).toBeGreaterThan(0);
    const early = report.earlyParticipants.find((p) => p.wallet === '5EarlyBuyer1PK');
    expect(early).toBeDefined();
    expect(early?.secondsFromLaunch).toBeLessThanOrEqual(30);
  });

  it('enforces multi-signal caps for single-category flags', () => {
    const trades: NormalizedTrade[] = [
      {
        id: 'tr_early_only',
        tokenId: 'dt_insider_test',
        chain: 'solana',
        wallet: '5SingleSignalWalletPK',
        side: 'BUY',
        amountUsd: 200,
        timestamp: new Date(new Date(launchTime).getTime() + 10 * 1000).toISOString(),
      },
    ];

    const contextNoFunding: ActivityContext = {
      ...mockContext,
      fundingEvents: [],
      creatorWallets: [],
    };

    const report = analyzeInsiderCandidates({ trades, context: contextNoFunding });
    const candidate = report.candidates.find((c) => c.wallet === '5SingleSignalWalletPK');

    if (candidate) {
      // Single signal category (EARLY_ENTRY alone) must be capped below 45 score and 50 confidence
      expect(candidate.score).toBeLessThanOrEqual(45);
      expect(candidate.confidence).toBeLessThanOrEqual(50);
    }
  });

  it('boosts candidate confidence when multiple independent signals agree', () => {
    const trades: NormalizedTrade[] = [
      {
        id: 'tr_multi_1',
        tokenId: 'dt_insider_test',
        chain: 'solana',
        wallet: '5EarlyBuyer1PK',
        side: 'BUY',
        amountUsd: 25_000,
        timestamp: new Date(new Date(launchTime).getTime() + 15 * 1000).toISOString(),
        creatorAssociated: true,
        clusterId: 'cluster_launch_insiders',
      },
    ];

    const report = analyzeInsiderCandidates({ trades, context: mockContext });
    const candidate = report.candidates.find((c) => c.wallet === '5EarlyBuyer1PK');

    expect(candidate).toBeDefined();
    expect(candidate?.signals.length).toBeGreaterThanOrEqual(2);
    expect(candidate?.confidence).toBeGreaterThan(50);
  });
});
