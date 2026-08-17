import { describe, expect, it } from 'vitest';
import { analyzeOrganicActivity } from '../organic-engine';
import { analyzeInsiderCandidates } from '../insider-engine';
import type { ActivityContext, NormalizedTrade, WalletFundingEvent } from '../types';

describe('Sprint 7 — Adversarial & Corner-Case Test Suite (Section 60)', () => {
  const now = new Date().toISOString();
  const launchTime = new Date(Date.now() - 3600 * 1000).toISOString();

  const baseContext: ActivityContext = {
    tokenId: 'dt_adversarial',
    chain: 'solana',
    tokenCreatedAt: launchTime,
    tradingOpenedAt: launchTime,
    observedAt: now,
    dataCompleteFrom: launchTime,
    dataCompleteTo: now,
  };

  // ── Test 1 — Split wallet activity ──
  it('Test 1 — Split wallet activity: detects cluster concentration when 20 wallets belong to 1 cluster', () => {
    const clusterWallets = Array.from({ length: 20 }, (_, i) => `5SplitWallet_${i + 1}_PK`);
    const clusterId = 'cluster_split_entity_1';

    const trades: NormalizedTrade[] = clusterWallets.map((wallet, i) => ({
      id: `tr_split_${i}`,
      tokenId: 'dt_adversarial',
      chain: 'solana',
      wallet,
      side: 'BUY',
      amountUsd: 10_000,
      timestamp: new Date(Date.now() - (i + 1) * 20 * 1000).toISOString(),
      clusterId,
    }));

    const contextWithCluster: ActivityContext = {
      ...baseContext,
      clusters: [
        {
          id: clusterId,
          scope: 'TOKEN_SPECIFIC',
          tokenContext: 'dt_adversarial',
          wallets: clusterWallets,
          edges: [],
          clusterConfidence: {
            score: 0.85,
            evidenceCount: 1,
            strongestEvidence: null,
            conflictingEvidence: [],
            methodologyVersion: 'v1',
          },
          label: 'Coordinated Wallet Group',
          methodologyVersion: 'v1',
          createdAt: launchTime,
        },
      ],
    };

    const result = analyzeOrganicActivity({ trades, context: contextWithCluster });
    const primary = result.primaryAssessment;

    expect(primary).toBeDefined();
    // Top cluster share should be 100% despite 20 unique wallets
    expect(primary?.features.concentration.topClusterVolumeShare).toBe(1.0);
    const clusterSignal = primary?.signals.find((s) => s.type === 'CLUSTER_CONCENTRATION');
    expect(clusterSignal).toBeDefined();
  });

  // ── Test 2 — Fake diversity ──
  it('Test 2 — Fake diversity: recognizes that high wallet count with tiny volume does not equal high organic score if top wallets dominate', () => {
    // 50 wallets doing $1 trades, 1 whale doing $500,000
    const trades: NormalizedTrade[] = [
      {
        id: 'tr_whale_1',
        tokenId: 'dt_adversarial',
        chain: 'solana',
        wallet: '5WhaleDominantPK',
        side: 'BUY',
        amountUsd: 500_000,
        timestamp: new Date(Date.now() - 600 * 1000).toISOString(),
      },
      ...Array.from({ length: 50 }, (_, i) => ({
        id: `tr_tiny_${i}`,
        tokenId: 'dt_adversarial',
        chain: 'solana',
        wallet: `5TinyWallet_${i + 1}`,
        side: 'BUY' as const,
        amountUsd: 1,
        timestamp: new Date(Date.now() - (i + 1) * 10 * 1000).toISOString(),
      })),
    ];

    const result = analyzeOrganicActivity({ trades, context: baseContext });
    const primary = result.primaryAssessment;

    expect(primary).toBeDefined();
    // Top 1 wallet share will be ~99.9%
    expect(primary?.features.concentration.topWalletVolumeShare).toBeGreaterThan(0.95);
    expect(primary?.score).toBeLessThan(60);
  });

  // ── Test 3 — Bot trading ──
  it('Test 3 — Bot trading: flags bot-like activity without labelling as insider', () => {
    const botTrades: NormalizedTrade[] = Array.from({ length: 60 }, (_, i) => ({
      id: `tr_bot_${i}`,
      tokenId: 'dt_adversarial',
      chain: 'solana',
      wallet: '5HighFreqBotPK',
      side: i % 2 === 0 ? 'BUY' : 'SELL',
      amountUsd: 250, // Repeated fixed amount
      timestamp: new Date(Date.now() - (60 - i) * 2 * 1000).toISOString(), // Regular 2s interval
    }));

    const result = analyzeOrganicActivity({ trades: botTrades, context: baseContext });
    const primary = result.primaryAssessment;

    expect(primary?.features.botLikeScore).toBeGreaterThan(60);

    const insiderReport = analyzeInsiderCandidates({ trades: botTrades, context: baseContext });
    const candidate = insiderReport.candidates.find((c) => c.wallet === '5HighFreqBotPK');

    if (candidate) {
      expect(candidate.labels).toContain('Bot-Like');
      expect(candidate.explanation).toContain('does not establish insider status');
    }
  });

  // ── Test 4 — Market maker ──
  it('Test 4 — Market maker: recognizes two-sided liquidity provision and suppresses insider flags', () => {
    const mmTrades: NormalizedTrade[] = Array.from({ length: 40 }, (_, i) => ({
      id: `tr_mm_${i}`,
      tokenId: 'dt_adversarial',
      chain: 'solana',
      wallet: '5LegitMarketMakerPK',
      side: i % 2 === 0 ? 'BUY' : 'SELL', // Exactly balanced two-sided
      amountUsd: 5_000,
      timestamp: new Date(Date.now() - (40 - i) * 30 * 1000).toISOString(),
    }));

    const result = analyzeOrganicActivity({ trades: mmTrades, context: baseContext });
    const primary = result.primaryAssessment;

    expect(primary?.features.marketMakerLikeScore).toBeGreaterThan(60);

    const insiderReport = analyzeInsiderCandidates({ trades: mmTrades, context: baseContext });
    const candidate = insiderReport.candidates.find((c) => c.wallet === '5LegitMarketMakerPK');

    if (candidate) {
      expect(candidate.labels).toContain('Market-Maker-Like');
      // Market maker false positive control reduces candidate score
      expect(candidate.score).toBeLessThan(50);
    }
  });

  // ── Test 5 — Creator-funded wallets ──
  it('Test 5 — Creator-funded wallets: increases insider confidence when multiple evidence layers agree', () => {
    const creator = '5CreatorPK';
    const funder = '5PreLaunchFunderPK';
    const earlyBuyer = '5CreatorBuyerPK';

    const fundingEvents: WalletFundingEvent[] = [
      {
        sourceWallet: funder,
        recipientWallet: earlyBuyer,
        amountUsd: 20_000,
        timestamp: new Date(new Date(launchTime).getTime() - 600 * 1000).toISOString(),
        relationshipToCreator: true,
      },
    ];

    const trades: NormalizedTrade[] = [
      {
        id: 'tr_creator_funded_1',
        tokenId: 'dt_adversarial',
        chain: 'solana',
        wallet: earlyBuyer,
        side: 'BUY',
        amountUsd: 30_000,
        timestamp: new Date(new Date(launchTime).getTime() + 15 * 1000).toISOString(), // 15s after launch
        creatorAssociated: true,
        clusterId: 'cluster_creator_associates',
      },
    ];

    const context: ActivityContext = {
      ...baseContext,
      creatorWallets: [creator, funder],
      fundingEvents,
    };

    const report = analyzeInsiderCandidates({ trades, context });
    const candidate = report.candidates.find((c) => c.wallet === earlyBuyer);

    expect(candidate).toBeDefined();
    expect(candidate?.score).toBeGreaterThan(60);
    expect(candidate?.confidence).toBeGreaterThan(60);
    expect(candidate?.signals.some((s) => s.category === 'PRE_LAUNCH_FUNDING')).toBe(true);
    expect(candidate?.signals.some((s) => s.category === 'CREATOR_RELATIONSHIP')).toBe(true);
  });

  // ── Test 6 — Legitimate sniper ──
  it('Test 6 — Legitimate sniper: detects early entry but maintains low insider confidence without supporting links', () => {
    const sniperWallet = '5FastSniperPK';
    const trades: NormalizedTrade[] = [
      {
        id: 'tr_sniper_1',
        tokenId: 'dt_adversarial',
        chain: 'solana',
        wallet: sniperWallet,
        side: 'BUY',
        amountUsd: 300,
        timestamp: new Date(new Date(launchTime).getTime() + 5 * 1000).toISOString(), // 5s after launch
      },
    ];

    const contextNoLinks: ActivityContext = {
      ...baseContext,
      fundingEvents: [],
      creatorWallets: [],
      relationships: [],
    };

    const report = analyzeInsiderCandidates({ trades, context: contextNoLinks });
    const candidate = report.candidates.find((c) => c.wallet === sniperWallet);

    if (candidate) {
      // Single early entry without funding or creator links has capped score & confidence
      expect(candidate.confidence).toBeLessThanOrEqual(50);
      expect(candidate.score).toBeLessThanOrEqual(45);
    }
  });

  // ── Test 7 — Circular trading ──
  it('Test 7 — Circular trading: detects potential circular activity for two-way trading between wallet pairs', () => {
    const trades: NormalizedTrade[] = [
      {
        id: 'tr_circ_1',
        tokenId: 'dt_adversarial',
        chain: 'solana',
        wallet: '5WalletA',
        counterparty: '5WalletB',
        side: 'BUY',
        amountUsd: 10_000,
        timestamp: new Date(Date.now() - 300 * 1000).toISOString(),
      },
      {
        id: 'tr_circ_2',
        tokenId: 'dt_adversarial',
        chain: 'solana',
        wallet: '5WalletB',
        counterparty: '5WalletA',
        side: 'SELL',
        amountUsd: 10_000,
        timestamp: new Date(Date.now() - 250 * 1000).toISOString(),
      },
      {
        id: 'tr_circ_3',
        tokenId: 'dt_adversarial',
        chain: 'solana',
        wallet: '5WalletA',
        counterparty: '5WalletB',
        side: 'BUY',
        amountUsd: 10_000,
        timestamp: new Date(Date.now() - 200 * 1000).toISOString(),
      },
    ];

    const result = analyzeOrganicActivity({ trades, context: baseContext });
    const primary = result.primaryAssessment;

    expect(primary).toBeDefined();
    expect(primary?.features.pairInteractions.length).toBeGreaterThan(0);
    const pair = primary?.features.pairInteractions[0];
    expect(pair?.direction).toBe('TWO_WAY');
  });

  // ── Test 8 — Missing data ──
  it('Test 8 — Missing data: decreases confidence score when sample size or coverage is low', () => {
    const sparseTrades: NormalizedTrade[] = [
      {
        id: 'tr_sparse_1',
        tokenId: 'dt_adversarial',
        chain: 'solana',
        wallet: '5TraderPK',
        side: 'BUY',
        amountUsd: 100,
        timestamp: new Date(Date.now() - 60 * 1000).toISOString(),
      },
    ];

    const incompleteContext: ActivityContext = {
      tokenId: 'dt_adversarial',
      chain: 'solana',
      observedAt: now,
      // Missing data bounds and coverage info
    };

    const result = analyzeOrganicActivity({ trades: sparseTrades, context: incompleteContext });
    const primary = result.primaryAssessment;

    expect(primary).toBeDefined();
    expect(primary?.status).toBe('INSUFFICIENT_DATA');
    expect(primary?.confidence).toBeLessThan(50);
    expect(primary?.limitations.length).toBeGreaterThan(0);
  });
});
