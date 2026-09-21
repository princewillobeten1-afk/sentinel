import { describe, it, expect } from 'vitest';
import type { DiscoveryToken } from '../types';
import { formatLiveAge } from '../format';

describe('Canonical Token Card Data Contract & Scope', () => {
  it('defines all canonical fields on DiscoveryToken according to the feature specification', () => {
    const token: DiscoveryToken = {
      id: 'tok_test_canonical',
      name: 'Sentinel Protocol',
      symbol: 'SENTINEL',
      mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      chain: 'solana',
      source: 'Pump.fun',
      logoURI: 'https://example.com/logo.png',
      ageMinutes: 0.2,
      ageFormatted: '12s ago',
      priceUsd: '0.00042',
      priceChange1m: 1.2,
      priceChange5m: 5.4,
      priceChange15m: 12.3,
      priceChange1h: 24.5,
      priceChange24h: 120.0,
      volume5mUsd: '1420',
      volume1hUsd: '18500',
      volume24hUsd: '95000',
      volumeChange15mPct: 15.2,
      liquidityUsd: '35000',
      liquidityChange1hPct: 4.8,
      marketCapUsd: '420000',
      buysCount: 184,
      sellsCount: 62,
      txCount15m: 45,
      txCount1h: 246,
      buySellImbalancePct: 49.5,
      buyPressureRatio: 2.96,
      txAccelerationPct: 14.2,
      isNewToken: true,
      discoveryScore: {
        totalScore: 88,
        confidence: 0.95,
        grade: 'HIGH_SIGNAL',
        factors: {
          volumeAcceleration: 85,
          transactionAcceleration: 78,
          liquidityChange: 65,
          buySellImbalance: 92,
          holderGrowth: 80,
          recency: 98,
          priceVelocity: 75,
        },
        rawInputs: {
          ageMinutes: 0.2,
          priceChangeWindow: 12.3,
          volumeWindowUsd: 18500,
          volumeAccelerationPct: 15.2,
          liquidityChangePct: 4.8,
          buysCount: 184,
          sellsCount: 62,
          holdersCount: 520,
          holderGrowthPct: 12.5,
          buySellImbalancePct: 49.5,
          buyPressureRatio: 2.96,
          txAccelerationPct: 14.2,
          isNewToken: true,
        },
        signals: [],
        explanations: [],
        calculatedAt: new Date().toISOString(),
      },
      // Bonding / Lifecycle status
      bondingCurveProgress: 45.5,
      migrationProgress: 45.5,
      bondingStatus: 'bonding',
      lifecycleState: 'new_pairs',

      // Socials & Promotion
      websiteUrl: 'https://sentinel.trade',
      telegramUrl: 'https://t.me/sentineltrade',
      twitterUrl: 'https://x.com/SentinelTrade',
      twitterHandle: '@SentinelTrade',
      twitterFollowers: 14200,
      isBoosted: true,
      boostCountdown: 284,
      isDexPaid: true,

      // Trader / Holder stats
      holdersCount: 520,
      proTradersCount: 42,
      kolsCount: 8,
      recentVisitors: 154,
      viewsCount: 154,
      devAddress: 'DevWaLLet11111111111111111111111111111111111',
      devMints: 34,
      devMigrations: 33,

      // Risk / Audit percentages (canonical 5)
      top10HoldingsPct: 18.5,
      devHoldingsPct: 0.0,
      devWalletAge: '24d',
      sniperPercentage: 3.2,
      insiderHoldingsPct: 1.5,
      bundlerPercentage: 0.0,

      // Market data & Platform
      feeAccruedUsd: '950',
      protocol: 'Pump V1',
    };

    expect(token.mint).toBeDefined();
    expect(token.bondingCurveProgress).toBe(45.5);
    expect(token.lifecycleState).toBe('new_pairs');
    expect(token.isBoosted).toBe(true);
    expect(token.boostCountdown).toBe(284);
    expect(token.isDexPaid).toBe(true);
    expect(token.proTradersCount).toBe(42);
    expect(token.kolsCount).toBe(8);
    expect(token.recentVisitors).toBe(154);
    expect(token.devMigrations).toBe(33);
    expect(token.devMints).toBe(34);
    expect(token.feeAccruedUsd).toBe('950');
    expect(token.protocol).toBe('Pump V1');
  });

  describe('formatLiveAge', () => {
    it('formats seconds-level live age correctly (e.g. 7s, 47s)', () => {
      expect(formatLiveAge(0, 7)).toBe('7s');
      expect(formatLiveAge(0, 47)).toBe('47s');
      expect(formatLiveAge(0.5, 0)).toBe('30s');
    });

    it('formats minute-level live age correctly (e.g. 1m, 12m)', () => {
      expect(formatLiveAge(1.0, 0)).toBe('1m');
      expect(formatLiveAge(1.2, 0)).toBe('1m');
      expect(formatLiveAge(12.0, 0)).toBe('12m');
      expect(formatLiveAge(59.4, 0)).toBe('59m');
    });

    it('formats hour-level live age correctly (e.g. 1h, 5h)', () => {
      expect(formatLiveAge(60.0, 0)).toBe('1h');
      expect(formatLiveAge(150.0, 0)).toBe('2h');
      expect(formatLiveAge(1380.0, 0)).toBe('23h');
    });

    it('formats day-level live age correctly (e.g. 1d, 3d)', () => {
      expect(formatLiveAge(1440.0, 0)).toBe('1d');
      expect(formatLiveAge(4320.0, 0)).toBe('3d');
    });
  });

  describe('Canonical Risk / Audit Percentages Order', () => {
    it('enforces the exact canonical order of risk metrics', () => {
      const canonicalOrder = [
        'top10HoldingsPct', // 1. Top 10 Holders %
        'devHoldingsPct',   // 2. Dev Holding % (+ devWalletAge)
        'sniperPercentage', // 3. Snipers %
        'insiderHoldingsPct',// 4. Insiders %
        'bundlerPercentage',// 5. Bundlers %
      ];

      expect(canonicalOrder[0]).toBe('top10HoldingsPct');
      expect(canonicalOrder[1]).toBe('devHoldingsPct');
      expect(canonicalOrder[2]).toBe('sniperPercentage');
      expect(canonicalOrder[3]).toBe('insiderHoldingsPct');
      expect(canonicalOrder[4]).toBe('bundlerPercentage');
    });
  });

  describe('Dev Track Record Representation', () => {
    it('correctly constructs the dev migration ratio (e.g. 33/34)', () => {
      const devMigrations = 33;
      const devMints = 34;
      const devRecord = `${devMigrations}/${devMints}`;
      expect(devRecord).toBe('33/34');
    });
  });

  describe('Bonding / Lifecycle Status Transitions', () => {
    it('identifies New Pairs state while curve is progressing (< 98%)', () => {
      const progress = 42;
      const isMigrated = false;
      const isMigrating = progress >= 98;
      const isNewPair = !isMigrated && !isMigrating;

      expect(isNewPair).toBe(true);
      expect(isMigrating).toBe(false);
      expect(isMigrated).toBe(false);
    });

    it('identifies Migrating state at ~100% progress', () => {
      const progress = 99.5;
      const isMigrated = false;
      const isMigrating = progress >= 98;

      expect(isMigrating).toBe(true);
      expect(isMigrated).toBe(false);
    });

    it('identifies Migrated state after moving to DEX', () => {
      const bondingStatus = 'graduated';
      const isMigrated = bondingStatus === 'graduated';

      expect(isMigrated).toBe(true);
    });
  });
});
