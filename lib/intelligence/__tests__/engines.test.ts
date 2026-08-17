import { describe, it, expect } from 'vitest';
import {
  analyzeMarketHealth,
  analyzeLiquidity,
  analyzeOwnership,
  analyzeCreator,
  analyzeActivity,
  analyzeContract,
  analyzeExitability,
} from '../engines';

const now = new Date().toISOString();

describe('Token Intelligence Engines (Sprint 5 Spec §52 Scenarios)', () => {
  // ── Scenario 1: Healthy observable profile ──
  it('Scenario 1 — Healthy observable profile shows balanced signals and high score', () => {
    const market = analyzeMarketHealth({
      priceUsd: 3.45,
      priceChange1h: 1.2,
      priceChange24h: 4.5,
      volume1hUsd: 1_000_000,
      volume24hUsd: 20_000_000,
      liquidityUsd: 10_000_000,
      marketCapUsd: 100_000_000,
      buysCount: 1500,
      sellsCount: 1200,
      holdersCount: 25000,
      volatility24h: 4.2,
      averageTradeSizeUsd: 1500,
      buySellRatio: 1.25,
      bidAskSpread: 0.1,
      dataTimestamp: now,
    });

    expect(market.dimension.score).toBeGreaterThanOrEqual(75);
    expect(market.dimension.level).toBe('STRONG');
    expect(market.dimension.confidence).toBeGreaterThan(0.8);
  });

  // ── Scenario 2: Rapid liquidity decline ──
  it('Scenario 2 — Rapid liquidity decline increases liquidity risk and includes evidence', () => {
    const liquidity = analyzeLiquidity({
      totalLiquidityUsd: 20_000,
      liquidityChange1hPct: -65.0, // Severe drop
      liquidityChange24hPct: -80.0,
      pools: [{ id: 'p1', dex: 'Raydium', tvlUsd: 20_000, feeTier: 0.25, shareOfTotal: 1.0 }],
      dataTimestamp: now,
    });

    expect(liquidity.withdrawalSeverity).toBe('SEVERE');
    expect(liquidity.signals.some(s => s.type === 'SEVERE_LIQUIDITY_WITHDRAWAL')).toBe(true);
    expect(liquidity.dimension.score).toBeLessThan(40);
    expect(liquidity.dimension.evidence.length).toBeGreaterThan(0);
  });

  // ── Scenario 3: Concentrated ownership ──
  it('Scenario 3 — Concentrated ownership increases ownership risk', () => {
    const ownership = analyzeOwnership({
      holdersCount: 150,
      top1HolderPct: 65.0, // Over 50%
      top5HolderPct: 85.0,
      top10HolderPct: 92.0,
      holderGrowthPct: -5.0,
      dataTimestamp: now,
      dataCompleteness: 0.9,
    }, 'test_token');

    expect(ownership.signals.some(s => s.type === 'EXTREME_CONCENTRATION')).toBe(true);
    expect(ownership.dimension.score).toBeLessThan(40);
    expect(ownership.holderSnapshot.top1Pct).toBe(65.0);
  });

  // ── Scenario 4: Missing creator data ──
  it('Scenario 4 — Missing creator data results in "Unknown" status, not automatic high risk', () => {
    const creator = analyzeCreator({
      dataTimestamp: now,
    }, 'test_token');

    expect(creator.dimension.level).toBe('UNKNOWN');
    expect(creator.dimension.score).toBe(50); // Default neutral
    expect(creator.missingData.length).toBeGreaterThan(0);
    expect(creator.creatorObservation.historyAvailable).toBe(false);
  });

  // ── Scenario 5: Active mint authority ──
  it('Scenario 5 — Active mint authority reports fact without declaring malicious intent', () => {
    const contract = analyzeContract({
      tokenId: 'test_token',
      chain: 'solana',
      name: 'Test Token',
      symbol: 'TEST',
      mintAuthorityStatus: 'ACTIVE',
      mintAuthorityAddress: 'Auth123456789',
      freezeAuthorityStatus: 'REVOKED',
      totalSupply: '1000000000',
      supplyChangeable: true,
      metadataChangeable: false,
      dataTimestamp: now,
    });

    const mintSignal = contract.signals.find(s => s.type === 'MINT_AUTHORITY_ACTIVE');
    expect(mintSignal).toBeDefined();
    expect(mintSignal?.polarity).toBe('NEUTRAL'); // Fact, not automatically malicious
    expect(mintSignal?.severity).toBe('INFO');
    expect(mintSignal?.evidence[0].fact).toContain('Mint authority remains active');
  });

  // ── Scenario 6: Unusual transaction activity ──
  it('Scenario 6 — Unusual transaction activity identifies anomaly without claiming fraud', () => {
    const activity = analyzeActivity({
      totalTransactions: 500,
      uniqueWallets: 20, // Very low unique wallets for 500 txs
      repeatWalletRatio: 0.85,
      topWalletTxShare: 0.40,
      buysCount: 450,
      sellsCount: 50,
      avgTxSizeUsd: 100,
      txSizeStdDev: 10,
      volumeConcentration: 0.80,
      temporalClustering: 0.90,
      dataTimestamp: now,
    });

    expect(activity.signals.some(s => s.type === 'HIGH_REPEAT_WALLETS')).toBe(true);
    expect(activity.signals.some(s => s.type === 'TX_CONCENTRATION')).toBe(true);
    expect(activity.activityQuality).toBe('LOW');
    // Check that signal polarity is NEGATIVE/NEUTRAL, but text does not say "fake volume"
    for (const sig of activity.signals) {
      expect(sig.evidence[0].fact.toLowerCase()).not.toContain('fake');
      expect(sig.evidence[0].fact.toLowerCase()).not.toContain('scam');
    }
  });

  // ── Engine Unit Tests: Exitability ──
  it('Exitability engine correctly calculates price impact simulations', () => {
    const exit = analyzeExitability({
      liquidityUsd: 100_000,
      poolDepthUsd: 100_000,
      volume24hUsd: 500_000,
      volume1hUsd: 50_000,
      priceUsd: 1.0,
      feeTierPct: 0.3,
      dataTimestamp: now,
    });

    expect(exit.priceImpactEstimates.length).toBe(5); // $100, $500, $1K, $5K, $10K
    const sim10k = exit.priceImpactEstimates.find(e => e.sellAmountUsd === 10_000);
    expect(sim10k?.isSimulation).toBe(true);
    expect(sim10k?.priceImpactPct).toBeGreaterThan(0);
    expect(sim10k?.estimatedOutputUsd).toBeLessThan(10_000);
  });
});
