import { DiscoveryToken, DiscoveryFilter, TimeWindow } from './types';
import { calculateDiscoveryScore } from './score-engine';
import { calculateTrendingScore } from './trending-engine';

export function getMockDiscoveryTokens(filter?: Partial<DiscoveryFilter>): DiscoveryToken[] {
  const window: TimeWindow = filter?.timeWindow || '15m';

  const rawList: Omit<DiscoveryToken, 'discoveryScore'>[] = [
    {
      id: 'dt_sentinel',
      name: 'Solana Sentinel Token',
      symbol: 'SENT',
      mint: '7xK99zK8mP2xQ5wN3a19',
      chain: 'solana',
      source: 'Raydium',
      ageMinutes: 42,
      ageFormatted: '42m ago',
      priceUsd: '3.450000000000000000',
      priceChange1m: 1.20,
      priceChange5m: 4.50,
      priceChange15m: 18.50,
      priceChange1h: 42.00,
      priceChange24h: 185.00,
      volume5mUsd: '145200.00',
      volume1hUsd: '1850000.00',
      volume24hUsd: '42500000.00',
      volumeChange15mPct: 420,
      liquidityUsd: '18500000.00',
      liquidityChange1hPct: 38.5,
      marketCapUsd: '345000005.00',
      buysCount: 1420,
      sellsCount: 310,
      txCount15m: 1730,
      txCount1h: 5700,
      buySellImbalancePct: 62.4,
      buyPressureRatio: 0.82,
      txAccelerationPct: 52.8,
      isNewToken: false,
      holdersCount: 42100,
      holderGrowth1hPct: 24.5,
      migrationProgress: 100,
      bondingStatus: 'graduated',
      devHoldingsPct: 1.8,
      top10HoldingsPct: 18.4,
      insiderHoldingsPct: 3.2,
      sniperPercentage: 4.5,
      bundlerPercentage: 1.2,
      riskScore: 94,
      riskTier: 'low',
      isMintRenounced: true,
      isLiquidityLocked: true,
      isFreezeDisabled: true,
      aiSignalScore: 92,
      aiSignalLabel: 'Bullish',
      aiSignalReason: 'Strong organic buyer velocity and rising liquidity depth',
      smartMoneyCount: 14,
      smartMoneyNetFlowUsd: 185000,
      twitterUrl: 'https://x.com/search?q=SENT',
      telegramUrl: 'https://t.me/sentinel_terminal',
    },
    {
      id: 'dt_quantum',
      name: 'Cyber Quantum AI',
      symbol: 'QUANT',
      mint: '3mR8z9K2xP5wN1a84mP2xQ5wN3a19TestMint',
      chain: 'solana',
      source: 'Pump.fun',
      ageMinutes: 18,
      ageFormatted: '18m ago',
      priceUsd: '0.041200000000000000',
      priceChange1m: 5.40,
      priceChange5m: 12.80,
      priceChange15m: 45.00,
      priceChange1h: 110.00,
      priceChange24h: 340.00,
      volume5mUsd: '89000.00',
      volume1hUsd: '640000.00',
      volume24hUsd: '3200000.00',
      volumeChange15mPct: 680,
      liquidityUsd: '120000.00',
      liquidityChange1hPct: 15.0,
      marketCapUsd: '840000.00',
      buysCount: 840,
      sellsCount: 190,
      txCount15m: 1030,
      txCount1h: 3600,
      buySellImbalancePct: 52.4,
      buyPressureRatio: 0.82,
      txAccelerationPct: 65.0,
      isNewToken: true,
      holdersCount: 1840,
      holderGrowth1hPct: 62.0,
      migrationProgress: 88,
      bondingStatus: 'migrating',
      devHoldingsPct: 4.2,
      top10HoldingsPct: 24.1,
      insiderHoldingsPct: 6.5,
      sniperPercentage: 8.2,
      bundlerPercentage: 2.1,
      riskScore: 86,
      riskTier: 'low',
      isMintRenounced: true,
      isLiquidityLocked: true,
      isFreezeDisabled: true,
      aiSignalScore: 88,
      aiSignalLabel: 'Breakout',
      aiSignalReason: 'Accelerating buy transactions with low dev sell volume',
      smartMoneyCount: 8,
      smartMoneyNetFlowUsd: 64000,
      twitterUrl: 'https://x.com/search?q=QUANT',
    },
    {
      id: 'dt_bonk',
      name: 'Bonk Doge Token',
      symbol: 'BONK',
      mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      chain: 'solana',
      source: 'Meteora',
      ageMinutes: 1440,
      ageFormatted: '1d ago',
      priceUsd: '0.000028450000000000',
      priceChange1m: 0.10,
      priceChange5m: 0.80,
      priceChange15m: 2.40,
      priceChange1h: 5.10,
      priceChange24h: 12.40,
      volume5mUsd: '89000.00',
      volume1hUsd: '1120000.00',
      volume24hUsd: '19800000.00',
      volumeChange15mPct: 45,
      liquidityUsd: '24100000.00',
      liquidityChange1hPct: 4.2,
      marketCapUsd: '1840000000.00',
      buysCount: 3200,
      sellsCount: 2150,
      txCount15m: 5350,
      txCount1h: 20500,
      buySellImbalancePct: 35.0,
      buyPressureRatio: 0.60,
      txAccelerationPct: 12.0,
      isNewToken: false,
      holdersCount: 689000,
      holderGrowth1hPct: 2.1,
      migrationProgress: 100,
      bondingStatus: 'graduated',
      devHoldingsPct: 0.0,
      top10HoldingsPct: 12.0,
      insiderHoldingsPct: 1.0,
      sniperPercentage: 1.0,
      bundlerPercentage: 0.0,
      riskScore: 98,
      riskTier: 'low',
      isMintRenounced: true,
      isLiquidityLocked: true,
      isFreezeDisabled: true,
      aiSignalScore: 78,
      aiSignalLabel: 'Neutral',
      aiSignalReason: 'Established liquid trading pair with sustained volume',
      smartMoneyCount: 22,
      smartMoneyNetFlowUsd: 420000,
      twitterUrl: 'https://x.com/search?q=BONK',
    },
    {
      id: 'dt_alpha',
      name: 'Alpha Matrix AI',
      symbol: 'ALPHA',
      mint: '1aM3z9K2xP5wN1a84mP2xQ5wN3a19Alpha',
      chain: 'solana',
      source: 'Pump.fun',
      ageMinutes: 7,
      ageFormatted: '7m ago',
      priceUsd: '0.125000000000000000',
      priceChange1m: 8.20,
      priceChange5m: 24.50,
      priceChange15m: 85.00,
      priceChange1h: 195.00,
      priceChange24h: 420.00,
      volume5mUsd: '45000.00',
      volume1hUsd: '320000.00',
      volume24hUsd: '1850000.00',
      volumeChange15mPct: 820,
      liquidityUsd: '64000.00',
      liquidityChange1hPct: 24.0,
      marketCapUsd: '420000.00',
      buysCount: 420,
      sellsCount: 65,
      txCount15m: 485,
      txCount1h: 1850,
      buySellImbalancePct: 73.2,
      buyPressureRatio: 0.87,
      txAccelerationPct: 92.0,
      isNewToken: true,
      holdersCount: 620,
      holderGrowth1hPct: 180.0,
      migrationProgress: 54,
      bondingStatus: 'bonding',
      devHoldingsPct: 6.8,
      top10HoldingsPct: 32.5,
      insiderHoldingsPct: 12.0,
      sniperPercentage: 14.0,
      bundlerPercentage: 4.2,
      riskScore: 74,
      riskTier: 'medium',
      isMintRenounced: true,
      isLiquidityLocked: false,
      isFreezeDisabled: true,
      aiSignalScore: 84,
      aiSignalLabel: 'Bullish',
      aiSignalReason: 'Early momentum surge with rapid unique wallet accumulation',
      smartMoneyCount: 5,
      smartMoneyNetFlowUsd: 38000,
      twitterUrl: 'https://x.com/search?q=ALPHA',
    },
    {
      id: 'dt_solfly',
      name: 'Sol Fly Network',
      symbol: 'FLY',
      mint: '2RjVZ4p7Wv8K9xM2nQ1a4pL6yJ8uE3sT5wR7vP9qPump',
      chain: 'solana',
      source: 'Pump.fun',
      ageMinutes: 2,
      ageFormatted: '2s ago',
      priceUsd: '0.000752000000000000',
      priceChange1m: 14.2,
      priceChange5m: 14.2,
      priceChange15m: 14.2,
      priceChange1h: 14.2,
      priceChange24h: 14.2,
      volume5mUsd: '752.00',
      volume1hUsd: '752.00',
      volume24hUsd: '752.00',
      volumeChange15mPct: 100,
      liquidityUsd: '2130.00',
      liquidityChange1hPct: 10.0,
      marketCapUsd: '2130.00',
      buysCount: 1,
      sellsCount: 0,
      txCount15m: 1,
      txCount1h: 1,
      buySellImbalancePct: 100.0,
      buyPressureRatio: 1.0,
      txAccelerationPct: 100.0,
      isNewToken: true,
      holdersCount: 1,
      holderGrowth1hPct: 100.0,
      migrationProgress: 4,
      bondingStatus: 'bonding',
      devHoldingsPct: 10.0,
      top10HoldingsPct: 100.0,
      insiderHoldingsPct: 0.0,
      sniperPercentage: 0.0,
      bundlerPercentage: 0.0,
      riskScore: 68,
      riskTier: 'medium',
      isMintRenounced: true,
      isLiquidityLocked: false,
      isFreezeDisabled: true,
      aiSignalScore: 70,
      aiSignalLabel: 'Neutral',
      aiSignalReason: 'New launch detection',
      smartMoneyCount: 1,
      smartMoneyNetFlowUsd: 752,
    },
    {
      id: 'dt_campeones',
      name: 'Campeones World Cup',
      symbol: 'CAMPEONES',
      mint: 'Ef1fP8xQ5wN3a19TestMintPumpFunCampeones',
      chain: 'solana',
      source: 'Pump.fun',
      ageMinutes: 240,
      ageFormatted: '4h ago',
      priceUsd: '0.002010000000000000',
      priceChange1m: 2.1,
      priceChange5m: 8.4,
      priceChange15m: 22.0,
      priceChange1h: 47.0,
      priceChange24h: 180.0,
      volume5mUsd: '5400.00',
      volume1hUsd: '23000.00',
      volume24hUsd: '145000.00',
      volumeChange15mPct: 240,
      liquidityUsd: '12400.00',
      liquidityChange1hPct: 18.0,
      marketCapUsd: '27000.00',
      buysCount: 310,
      sellsCount: 172,
      txCount15m: 482,
      txCount1h: 1240,
      buySellImbalancePct: 47.0,
      buyPressureRatio: 0.64,
      txAccelerationPct: 44.0,
      isNewToken: false,
      holdersCount: 47,
      holderGrowth1hPct: 22.0,
      migrationProgress: 92,
      bondingStatus: 'migrating',
      devHoldingsPct: 3.5,
      top10HoldingsPct: 22.0,
      insiderHoldingsPct: 5.0,
      sniperPercentage: 6.0,
      bundlerPercentage: 1.0,
      riskScore: 82,
      riskTier: 'low',
      isMintRenounced: true,
      isLiquidityLocked: true,
      isFreezeDisabled: true,
      aiSignalScore: 85,
      aiSignalLabel: 'Bullish',
      aiSignalReason: 'Approaching graduation migration threshold with strong community support',
      smartMoneyCount: 4,
      smartMoneyNetFlowUsd: 12000,
    },
    {
      id: 'dt_dealer',
      name: 'Shadow Dealer',
      symbol: 'DEALER',
      mint: '93XSz9K2xP5wN1a84mP2xQ5wN3a19DealerPump',
      chain: 'solana',
      source: 'Raydium',
      ageMinutes: 1,
      ageFormatted: '11s ago',
      priceUsd: '0.000495000000000000',
      priceChange1m: 78.4,
      priceChange5m: 78.4,
      priceChange15m: 78.4,
      priceChange1h: 78.4,
      priceChange24h: 78.4,
      volume5mUsd: '36100.00',
      volume1hUsd: '36100.00',
      volume24hUsd: '36100.00',
      volumeChange15mPct: 780,
      liquidityUsd: '48000.00',
      liquidityChange1hPct: 78.0,
      marketCapUsd: '610000.00',
      buysCount: 7,
      sellsCount: 0,
      txCount15m: 7,
      txCount1h: 7,
      buySellImbalancePct: 100.0,
      buyPressureRatio: 1.0,
      txAccelerationPct: 100.0,
      isNewToken: true,
      holdersCount: 5,
      holderGrowth1hPct: 100.0,
      migrationProgress: 100,
      bondingStatus: 'graduated',
      devHoldingsPct: 0.0,
      top10HoldingsPct: 79.0,
      insiderHoldingsPct: 8.0,
      sniperPercentage: 12.0,
      bundlerPercentage: 3.0,
      riskScore: 78,
      riskTier: 'medium',
      isMintRenounced: true,
      isLiquidityLocked: true,
      isFreezeDisabled: true,
      aiSignalScore: 86,
      aiSignalLabel: 'Breakout',
      aiSignalReason: 'Raydium listing with immediate buy impulse',
      smartMoneyCount: 2,
      smartMoneyNetFlowUsd: 18000,
    },
    {
      id: 'dt_kima',
      name: 'Kima Ape Monkey',
      symbol: 'KIMA',
      mint: '8NAwz9K2xP5wN1a84mP2xQ5wN3a19KimaPump',
      chain: 'solana',
      source: 'Pump.fun',
      ageMinutes: 1,
      ageFormatted: '1s ago',
      priceUsd: '0.000990000000000000',
      priceChange1m: 27.0,
      priceChange5m: 27.0,
      priceChange15m: 27.0,
      priceChange1h: 27.0,
      priceChange24h: 27.0,
      volume5mUsd: '566.00',
      volume1hUsd: '566.00',
      volume24hUsd: '566.00',
      volumeChange15mPct: 100,
      liquidityUsd: '2830.00',
      liquidityChange1hPct: 27.0,
      marketCapUsd: '2830.00',
      buysCount: 2,
      sellsCount: 0,
      txCount15m: 2,
      txCount1h: 2,
      buySellImbalancePct: 100.0,
      buyPressureRatio: 1.0,
      txAccelerationPct: 100.0,
      isNewToken: true,
      holdersCount: 2,
      holderGrowth1hPct: 100.0,
      migrationProgress: 6,
      bondingStatus: 'bonding',
      devHoldingsPct: 5.0,
      top10HoldingsPct: 27.0,
      insiderHoldingsPct: 0.0,
      sniperPercentage: 0.0,
      bundlerPercentage: 0.0,
      riskScore: 72,
      riskTier: 'medium',
      isMintRenounced: true,
      isLiquidityLocked: false,
      isFreezeDisabled: true,
      aiSignalScore: 71,
      aiSignalLabel: 'Neutral',
      aiSignalReason: 'New bonding curve launch',
      smartMoneyCount: 1,
      smartMoneyNetFlowUsd: 566,
    },
    {
      id: 'dt_ocapi',
      name: 'Ocapi Giraffe',
      symbol: 'OCAPI',
      mint: 'Hmo2z9K2xP5wN1a84mP2xQ5wN3a19OcapiPump',
      chain: 'solana',
      source: 'Pump.fun',
      ageMinutes: 1440,
      ageFormatted: '1d ago',
      priceUsd: '0.001790000000000000',
      priceChange1m: 1.5,
      priceChange5m: 6.2,
      priceChange15m: 13.0,
      priceChange1h: 32.0,
      priceChange24h: 95.0,
      volume5mUsd: '1800.00',
      volume1hUsd: '6130.00',
      volume24hUsd: '38000.00',
      volumeChange15mPct: 140,
      liquidityUsd: '9800.00',
      liquidityChange1hPct: 12.0,
      marketCapUsd: '26800.00',
      buysCount: 180,
      sellsCount: 114,
      txCount15m: 294,
      txCount1h: 680,
      buySellImbalancePct: 44.0,
      buyPressureRatio: 0.61,
      txAccelerationPct: 28.0,
      isNewToken: false,
      holdersCount: 109,
      holderGrowth1hPct: 13.0,
      migrationProgress: 84,
      bondingStatus: 'migrating',
      devHoldingsPct: 2.1,
      top10HoldingsPct: 13.0,
      insiderHoldingsPct: 3.0,
      sniperPercentage: 4.0,
      bundlerPercentage: 0.0,
      riskScore: 88,
      riskTier: 'low',
      isMintRenounced: true,
      isLiquidityLocked: true,
      isFreezeDisabled: true,
      aiSignalScore: 82,
      aiSignalLabel: 'Bullish',
      aiSignalReason: 'Consolidating near graduation with distributed holders',
      smartMoneyCount: 3,
      smartMoneyNetFlowUsd: 8400,
    },
    {
      id: 'dt_manlet',
      name: 'Manlet Chad',
      symbol: 'MANLET',
      mint: 'CrBqz9K2xP5wN1a84mP2xQ5wN3a19ManletPump',
      chain: 'solana',
      source: 'Raydium',
      ageMinutes: 1,
      ageFormatted: '32s ago',
      priceUsd: '0.043600000000000000',
      priceChange1m: 29.0,
      priceChange5m: 72.0,
      priceChange15m: 140.0,
      priceChange1h: 290.0,
      priceChange24h: 840.0,
      volume5mUsd: '84000.00',
      volume1hUsd: '332000.00',
      volume24hUsd: '1850000.00',
      volumeChange15mPct: 620,
      liquidityUsd: '92000.00',
      liquidityChange1hPct: 48.0,
      marketCapUsd: '224000.00',
      buysCount: 1820,
      sellsCount: 800,
      txCount15m: 2620,
      txCount1h: 6400,
      buySellImbalancePct: 72.0,
      buyPressureRatio: 0.69,
      txAccelerationPct: 88.0,
      isNewToken: false,
      holdersCount: 513,
      holderGrowth1hPct: 72.0,
      migrationProgress: 100,
      bondingStatus: 'graduated',
      devHoldingsPct: 0.8,
      top10HoldingsPct: 29.0,
      insiderHoldingsPct: 4.0,
      sniperPercentage: 5.0,
      bundlerPercentage: 1.0,
      riskScore: 92,
      riskTier: 'low',
      isMintRenounced: true,
      isLiquidityLocked: true,
      isFreezeDisabled: true,
      aiSignalScore: 94,
      aiSignalLabel: 'Bullish',
      aiSignalReason: 'Heavy Raydium volume and aggressive buy-side demand',
      smartMoneyCount: 11,
      smartMoneyNetFlowUsd: 142000,
    }
  ];

  // Score each token using the scoring engine
  const scoredTokens: DiscoveryToken[] = rawList.map((token) => {
    const rawInput = {
      ageMinutes: token.ageMinutes,
      priceChangeWindow: token.priceChange15m,
      volumeWindowUsd: parseFloat(token.volume1hUsd || '10000'),
      volumeAccelerationPct: token.volumeChange15mPct,
      liquidityUsd: parseFloat(token.liquidityUsd || '50000'),
      liquidityChangePct: token.liquidityChange1hPct,
      buysCount: token.buysCount,
      sellsCount: token.sellsCount,
      holdersCount: token.holdersCount,
      holderGrowthPct: token.holderGrowth1hPct,
      txCount1h: token.txCount1h,
      buySellImbalancePct: token.buySellImbalancePct,
      buyPressureRatio: token.buyPressureRatio,
      txAccelerationPct: token.txAccelerationPct,
      isNewToken: token.isNewToken,
    };
    const discoveryScore = calculateDiscoveryScore(rawInput, window);
    return {
      ...token,
      discoveryScore,
    };
  });

  // Apply Range Filters first
  const filtered = filterDiscoveryTokens(scoredTokens, filter);

  // Section-specific routing and sorting
  if (filter?.section === 'trending') {
    return [...filtered].sort((a, b) => {
      const scoreA = calculateTrendingScore(a, window).trendingRankScore;
      const scoreB = calculateTrendingScore(b, window).trendingRankScore;
      return scoreB - scoreA;
    });
  } else if (filter?.section === 'new') {
    return [...filtered].sort((a, b) => a.ageMinutes - b.ageMinutes);
  } else if (filter?.section === 'migrating') {
    return filtered
      .filter((t) => (t.migrationProgress ?? 0) >= 40 && (t.migrationProgress ?? 0) < 100)
      .sort((a, b) => (b.migrationProgress ?? 0) - (a.migrationProgress ?? 0));
  } else if (filter?.section === 'graduated') {
    return filtered
      .filter((t) => (t.migrationProgress ?? 0) >= 100 || t.bondingStatus === 'graduated')
      .sort((a, b) => parseFloat(b.marketCapUsd) - parseFloat(a.marketCapUsd));
  } else if (filter?.section === 'smart-money') {
    return [...filtered].sort((a, b) => (b.smartMoneyCount ?? 0) - (a.smartMoneyCount ?? 0));
  } else if (filter?.section === 'ai-picks') {
    return [...filtered].sort((a, b) => (b.aiSignalScore ?? 0) - (a.aiSignalScore ?? 0));
  } else if (filter?.section === 'top-gainers') {
    return [...filtered].sort((a, b) => b.priceChange24h - a.priceChange24h);
  } else if (filter?.section === 'top-losers') {
    return [...filtered].sort((a, b) => a.priceChange24h - b.priceChange24h);
  } else if (filter?.section === 'momentum') {
    return filtered.filter((t) => t.priceChange15m > 10.0);
  } else if (filter?.section === 'volume') {
    return filtered.filter((t) => t.volumeChange15mPct > 100);
  } else if (filter?.section === 'liquidity') {
    return filtered.filter((t) => t.liquidityChange1hPct > 10);
  }

  // Default: Sort by composite total score descending
  return filtered.sort((a, b) => b.discoveryScore.totalScore - a.discoveryScore.totalScore);
}

export function filterDiscoveryTokens(
  tokens: DiscoveryToken[],
  filter?: Partial<DiscoveryFilter>
): DiscoveryToken[] {
  if (!filter) return tokens;

  return tokens.filter((t) => {
    const mcap = parseFloat(t.marketCapUsd);
    const liq = parseFloat(t.liquidityUsd);
    const vol = parseFloat(t.volume24hUsd);

    // Market Cap
    if (filter.marketCapMin !== undefined && mcap < filter.marketCapMin) return false;
    if (filter.marketCapMax !== undefined && mcap > filter.marketCapMax) return false;

    // Liquidity
    if (filter.liquidityMin !== undefined && liq < filter.liquidityMin) return false;
    if (filter.liquidityMax !== undefined && liq > filter.liquidityMax) return false;

    // Volume (24h)
    if (filter.volumeMin !== undefined && vol < filter.volumeMin) return false;
    if (filter.volumeMax !== undefined && vol > filter.volumeMax) return false;

    // Token Age (minutes)
    if (filter.ageMinutesMin !== undefined && t.ageMinutes < filter.ageMinutesMin) return false;
    if (filter.ageMinutesMax !== undefined && t.ageMinutes > filter.ageMinutesMax) return false;

    // Price Change (15m %)
    if (filter.priceChangeMin !== undefined && t.priceChange15m < filter.priceChangeMin) return false;
    if (filter.priceChangeMax !== undefined && t.priceChange15m > filter.priceChangeMax) return false;

    // Volume Change (15m %)
    if (filter.volumeChangeMin !== undefined && t.volumeChange15mPct < filter.volumeChangeMin) return false;
    if (filter.volumeChangeMax !== undefined && t.volumeChange15mPct > filter.volumeChangeMax) return false;

    // Holders
    if (filter.holdersMin !== undefined && t.holdersCount < filter.holdersMin) return false;
    if (filter.holdersMax !== undefined && t.holdersCount > filter.holdersMax) return false;

    // Top 10 & Dev Holdings
    if (filter.top10HoldingsMax !== undefined && (t.top10HoldingsPct ?? 0) > filter.top10HoldingsMax) return false;
    if (filter.devHoldingsMax !== undefined && (t.devHoldingsPct ?? 0) > filter.devHoldingsMax) return false;

    // Safety / Risk
    if (filter.minRiskScore !== undefined && (t.riskScore ?? 0) < filter.minRiskScore) return false;
    if (filter.mintRenouncedOnly && !t.isMintRenounced) return false;
    if (filter.liquidityLockedOnly && !t.isLiquidityLocked) return false;

    // Launchpads
    if (filter.launchpads && filter.launchpads.length > 0 && !filter.launchpads.includes(t.source)) {
      return false;
    }

    // Discovery Score
    if (filter.discoveryScoreMin !== undefined && t.discoveryScore.totalScore < filter.discoveryScoreMin) return false;
    if (filter.discoveryScoreMax !== undefined && t.discoveryScore.totalScore > filter.discoveryScoreMax) return false;

    // Search query matches token name, symbol, or mint
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase().trim();
      const matchesQuery =
        t.name.toLowerCase().includes(query) ||
        t.symbol.toLowerCase().includes(query) ||
        t.mint.toLowerCase().includes(query);
      if (!matchesQuery) return false;
    }

    return true;
  });
}
