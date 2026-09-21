import { describe, it, expect, beforeEach } from 'vitest';
import {
  DexScreenerBoostsService,
  dexScreenerBoostsService,
  DEXSCREENER_BOOSTS_LATEST_WS_URL,
  DEXSCREENER_BOOSTS_TOP_WS_URL,
  type DexBoostPayload,
} from '../dexscreener-boosts';
import { formatBoostCountdown } from '../format';
import type { DiscoveryToken } from '../types';

/**
 * A complete `DiscoveryToken` with only the fields a test cares about varying.
 *
 * These fixtures were annotated `: DiscoveryToken` while carrying about a third
 * of the required fields, so the file did not typecheck. Filling the rest here
 * keeps the annotation honest without repeating 20 fields per case.
 */
function makeToken(over: Partial<DiscoveryToken> = {}): DiscoveryToken {
  return {
    id: 'TestMint1111111111111111111111111111111111',
    mint: 'TestMint1111111111111111111111111111111111',
    name: 'Test Token',
    symbol: 'TEST',
    chain: 'solana',
    source: 'Pump.fun',
    priceUsd: '1.00',
    liquidityUsd: '1000',
    marketCapUsd: '10000',
    volume5mUsd: '0',
    volume1hUsd: '0',
    volume24hUsd: '0',
    volumeChange15mPct: 0,
    liquidityChange1hPct: 0,
    priceChange1m: 0,
    priceChange5m: 0,
    priceChange15m: 0,
    priceChange1h: 0,
    priceChange24h: 0,
    buysCount: 0,
    sellsCount: 0,
    txCount15m: 0,
    txCount1h: 0,
    buySellImbalancePct: 0,
    buyPressureRatio: 0,
    txAccelerationPct: 0,
    isNewToken: true,
    ageMinutes: 10,
    ageFormatted: '10m',
    discoveryScore: {
      totalScore: 0,
      momentumScore: 0,
      liquidityScore: 0,
      communityScore: 0,
      safetyScore: 0,
segments: [],
    } as unknown as DiscoveryToken['discoveryScore'],
    ...over,
  };
}

describe('formatBoostCountdown', () => {
  it('returns null for null, undefined, zero or negative values', () => {
    expect(formatBoostCountdown(null)).toBeNull();
    expect(formatBoostCountdown(undefined)).toBeNull();
    expect(formatBoostCountdown(0)).toBeNull();
    expect(formatBoostCountdown(-15)).toBeNull();
  });

  it('formats sub-hour countdown as m:ss', () => {
    expect(formatBoostCountdown(45)).toBe('0:45');
    expect(formatBoostCountdown(65)).toBe('1:05');
    expect(formatBoostCountdown(272)).toBe('4:32');
    expect(formatBoostCountdown(3599)).toBe('59:59');
  });

  it('formats multi-hour countdown as Xh Ym', () => {
    expect(formatBoostCountdown(3600)).toBe('1h 00m');
    expect(formatBoostCountdown(3665)).toBe('1h 01m');
    expect(formatBoostCountdown(7200)).toBe('2h 00m');
    expect(formatBoostCountdown(52200)).toBe('14h 30m');
  });
});

describe('DexScreenerBoostsService', () => {
  beforeEach(() => {
    dexScreenerBoostsService.__resetForTesting();
  });

  it('handles initial snapshot frame with { limit, data: [...] }', () => {
    const rawSnapshot = JSON.stringify({
      limit: 90,
      data: [
        {
          chainId: 'solana',
          tokenAddress: 'So11111111111111111111111111111111111111112',
          totalAmount: 50,
          amount: 10,
          links: [{ type: 'twitter', url: 'https://x.com/solana' }],
        },
      ],
    });

    dexScreenerBoostsService.handleRawMessage(rawSnapshot);

    expect(dexScreenerBoostsService.isBoosted('So11111111111111111111111111111111111111112')).toBe(true);
    // Elapsed observation time, not a countdown. There is no expiry to count
    // toward: verified against both boost endpoints, whose payloads carry no
    // expiry, duration or end-time field of any kind.
    expect(
      dexScreenerBoostsService.getBoostAgeSeconds('So11111111111111111111111111111111111111112'),
    ).toBeGreaterThanOrEqual(0);
  });

  it('performs case-insensitive address lookup', () => {
    const rawUpdate = JSON.stringify([
      {
        chainId: 'solana',
        tokenAddress: '5VdyRSpeFrgZuwiBK4yPegurzNtUiLdxiXAevt8gpump',
        totalAmount: 100,
        amount: 20,
      },
    ]);

    dexScreenerBoostsService.handleRawMessage(rawUpdate);

    // Exact case
    expect(dexScreenerBoostsService.isBoosted('5VdyRSpeFrgZuwiBK4yPegurzNtUiLdxiXAevt8gpump')).toBe(true);
    // Lowercase
    expect(dexScreenerBoostsService.isBoosted('5vdyrspefrgzuwibk4ypegurzntuildxixaevt8gpump')).toBe(true);
  });

  it('ignores heartbeat frames safely', () => {
    const heartbeat = JSON.stringify({ type: 'heartbeat' });
    expect(() => dexScreenerBoostsService.handleRawMessage(heartbeat)).not.toThrow();
    expect(dexScreenerBoostsService.getAllBoosts()).toHaveLength(0);
  });

  it('enriches DiscoveryToken with isBoosted, isDexPaid, countdown, and missing socials', () => {
    const boostData: DexBoostPayload = {
      chainId: 'solana',
      tokenAddress: 'BoostMint1234567890Pump',
      totalAmount: 30,
      amount: 10,
      links: [
        { type: 'twitter', url: 'https://x.com/boosted_token' },
        { type: 'telegram', url: 'https://t.me/boosted_community' },
        { url: 'https://boosted.io' },
      ],
    };

    dexScreenerBoostsService.ingestBoost(boostData, false);

    const token = makeToken({
      id: 'BoostMint1234567890Pump',
      mint: 'BoostMint1234567890Pump',
      name: 'Boosted Token',
      symbol: 'BOOST',
      priceUsd: '1.25',
      liquidityUsd: '50000',
      marketCapUsd: '250000',
      volume24hUsd: '120000',
      priceChange1h: 5.2,
      priceChange24h: 18.4,
      bondingStatus: 'bonding',
    });

    const enriched = dexScreenerBoostsService.enrichToken(token);

    expect(enriched.isBoosted).toBe(true);
    // Dex Paid is a separate purchase resolved by `/orders/v1`, so enrichment
    // from a boost must not assert it. It used to be hardcoded true here.
    expect(enriched.isDexPaid).toBeUndefined();
    // No fabricated countdown; the reported amount is carried instead.
    expect(enriched.boostCountdown).toBeUndefined();
    expect(enriched.boostAmount).toBe(30);
    expect(enriched.twitterUrl).toBe('https://x.com/boosted_token');
    expect(enriched.twitterHandle).toBe('@boosted_token');
    expect(enriched.telegramUrl).toBe('https://t.me/boosted_community');
    expect(enriched.websiteUrl).toBe('https://boosted.io');
  });

  it('preserves existing socials if token already has them', () => {
    const boostData: DexBoostPayload = {
      chainId: 'solana',
      tokenAddress: 'CustomSocialsMint123',
      totalAmount: 40,
      amount: 10,
      links: [
        { type: 'twitter', url: 'https://x.com/dexscreener_link' },
        { type: 'telegram', url: 'https://t.me/dexscreener_tg' },
      ],
    };

    dexScreenerBoostsService.ingestBoost(boostData, false);

    const token = makeToken({
      id: 'CustomSocialsMint123',
      mint: 'CustomSocialsMint123',
      name: 'Original Token',
      symbol: 'ORIG',
      priceUsd: '0.05',
      liquidityUsd: '10000',
      marketCapUsd: '50000',
      volume24hUsd: '5000',
      priceChange1h: 1.0,
      priceChange24h: 2.0,
      ageMinutes: 5,
      ageFormatted: '5m',
      bondingStatus: 'bonding',
      twitterUrl: 'https://x.com/original_creator',
      telegramUrl: 'https://t.me/original_chat',
    });

    const enriched = dexScreenerBoostsService.enrichToken(token);

    expect(enriched.isBoosted).toBe(true);
    expect(enriched.twitterUrl).toBe('https://x.com/original_creator');
    expect(enriched.telegramUrl).toBe('https://t.me/original_chat');
  });

  it('notifies onBoost listeners when a live boost arrives', () => {
    let notifiedAddress = '';
    const unsubscribe = dexScreenerBoostsService.onBoost((boost) => {
      notifiedAddress = boost.tokenAddress;
    });

    dexScreenerBoostsService.handleRawMessage(
      JSON.stringify([
        {
          chainId: 'solana',
          tokenAddress: 'LiveMint999999999999999',
          totalAmount: 15,
          amount: 5,
        },
      ]),
    );

    expect(notifiedAddress).toBe('LiveMint999999999999999');

    unsubscribe();

    // After unsubscribe, no further notifications
    notifiedAddress = '';
    dexScreenerBoostsService.handleRawMessage(
      JSON.stringify([
        {
          chainId: 'solana',
          tokenAddress: 'AnotherMint8888888888',
          totalAmount: 10,
          amount: 5,
        },
      ]),
    );

    expect(notifiedAddress).toBe('');
  });

  it('filters boosts by chain in getAllBoosts', () => {
    dexScreenerBoostsService.ingestBoost(
      { chainId: 'solana', tokenAddress: 'SolanaMintA', totalAmount: 50 },
      false,
    );
    dexScreenerBoostsService.ingestBoost(
      { chainId: 'ethereum', tokenAddress: '0xEthAddressB', totalAmount: 20 },
      false,
    );
    dexScreenerBoostsService.ingestBoost(
      { chainId: 'base', tokenAddress: '0xBaseAddressC', totalAmount: 30 },
      false,
    );

    expect(dexScreenerBoostsService.getAllBoosts('solana')).toHaveLength(1);
    expect(dexScreenerBoostsService.getAllBoosts('solana')[0].tokenAddress).toBe('SolanaMintA');

    expect(dexScreenerBoostsService.getAllBoosts('ethereum')).toHaveLength(1);
    expect(dexScreenerBoostsService.getAllBoosts()).toHaveLength(3);
  });

  it('exports correct WebSocket URLs for both latest and top endpoints', () => {
    expect(DEXSCREENER_BOOSTS_LATEST_WS_URL).toBe('wss://api.dexscreener.com/token-boosts/latest/v1');
    expect(DEXSCREENER_BOOSTS_TOP_WS_URL).toBe('wss://api.dexscreener.com/token-boosts/top/v1');
  });

  it('merges data from concurrent top and latest WebSocket feeds', () => {
    // 1. Top feed snapshot arrives with high totalAmount and no amount
    const topSnapshot = JSON.stringify({
      limit: 90,
      data: [
        {
          chainId: 'solana',
          tokenAddress: 'DualStreamToken111111111111111111111111',
          totalAmount: 500,
          links: [{ type: 'website', url: 'https://dualstream.com' }],
        },
      ],
    });
    dexScreenerBoostsService.handleRawMessage(topSnapshot, 'top');

    const initial = dexScreenerBoostsService.getBoost('DualStreamToken111111111111111111111111');
    expect(initial).toBeDefined();
    expect(initial?.totalAmount).toBe(500);
    expect(initial?.amount).toBeUndefined();

    // 2. Latest feed update arrives for the same token with amount increment
    const latestUpdate = JSON.stringify([
      {
        chainId: 'solana',
        tokenAddress: 'DualStreamToken111111111111111111111111',
        totalAmount: 550,
        amount: 50,
        links: [{ type: 'twitter', url: 'https://x.com/dualstream' }],
      },
    ]);
    dexScreenerBoostsService.handleRawMessage(latestUpdate, 'latest');

    const merged = dexScreenerBoostsService.getBoost('DualStreamToken111111111111111111111111');
    expect(merged?.totalAmount).toBe(550);
    expect(merged?.amount).toBe(50);
    expect(merged?.links).toEqual([{ type: 'twitter', url: 'https://x.com/dualstream' }]);
  });

  it('reports granular health metrics for both latest and top streams', () => {
    const healthBefore = dexScreenerBoostsService.getHealth();
    expect(healthBefore.streams).toBeDefined();
    expect(healthBefore.streams?.latest.status).toBe('idle');
    expect(healthBefore.streams?.top.status).toBe('idle');

    // Simulate receiving message on top stream
    dexScreenerBoostsService.handleRawMessage(
      JSON.stringify([{ chainId: 'solana', tokenAddress: 'TokenA', totalAmount: 100 }]),
      'top',
    );

    const healthAfter = dexScreenerBoostsService.getHealth();
    expect(healthAfter.streams?.top.lastMessageAt).toBeGreaterThan(0);
    expect(healthAfter.streams?.latest.lastMessageAt).toBeNull();
  });

  it('captures errors per stream without cross-contamination', () => {
    dexScreenerBoostsService.handleRawMessage('invalid-json{{{', 'top');

    const health = dexScreenerBoostsService.getHealth();
    expect(health.streams?.top.lastError).toBeDefined();
    expect(health.streams?.latest.lastError).toBeUndefined();
  });

  it('manages concurrent start and stop lifecycle cleanly', () => {
    dexScreenerBoostsService.start();
    const healthStarted = dexScreenerBoostsService.getHealth();
    expect(['connecting', 'connected']).toContain(healthStarted.streams?.latest.status);
    expect(['connecting', 'connected']).toContain(healthStarted.streams?.top.status);

    dexScreenerBoostsService.stop();
    const healthStopped = dexScreenerBoostsService.getHealth();
    expect(healthStopped.status).toBe('idle');
    expect(healthStopped.streams?.latest.status).toBe('idle');
    expect(healthStopped.streams?.top.status).toBe('idle');
  });
});
