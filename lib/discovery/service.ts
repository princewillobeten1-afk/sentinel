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
    },
    {
      id: 'dt_alpha',
      name: 'Alpha Matrix AI',
      symbol: 'ALPHA',
      mint: '1aM3z9K2xP5wN1a84mP2xQ5wN3a19Alpha',
      chain: 'solana',
      source: 'Orca',
      ageMinutes: 7,
      ageFormatted: '7m ago',
      priceUsd: '0.125000000000000000',
      priceChange1m: 8.20,
      priceChange5m: 24.50,
      priceChange15m: 85.00,
      priceChange1h: 180.00,
      priceChange24h: 420.00,
      volume5mUsd: '210000.00',
      volume1hUsd: '950000.00',
      volume24hUsd: '1850000.00',
      volumeChange15mPct: 920,
      liquidityUsd: '450000.00',
      liquidityChange1hPct: 88.0,
      marketCapUsd: '2500000.00',
      buysCount: 1850,
      sellsCount: 210,
      txCount15m: 2060,
      txCount1h: 9600,
      buySellImbalancePct: 78.0,
      buyPressureRatio: 0.90,
      txAccelerationPct: 145.0,
      isNewToken: true,
      holdersCount: 3410,
      holderGrowth1hPct: 140.0,
    },
  ];

  // Calculate dynamic normalized discovery scores
  const scoredTokens: DiscoveryToken[] = rawList.map((t) => {
    let pChange = t.priceChange15m;
    if (window === '1m') pChange = t.priceChange1m;
    else if (window === '5m') pChange = t.priceChange5m;
    else if (window === '1h') pChange = t.priceChange1h;
    else if (window === '24h') pChange = t.priceChange24h;

    const score = calculateDiscoveryScore(
      {
        ageMinutes: t.ageMinutes,
        priceChangeWindow: pChange,
        volumeWindowUsd: parseFloat(t.volume1hUsd),
        volumeAccelerationPct: t.volumeChange15mPct,
        liquidityUsd: parseFloat(t.liquidityUsd),
        liquidityChangePct: t.liquidityChange1hPct,
        buysCount: t.buysCount,
        sellsCount: t.sellsCount,
        holdersCount: t.holdersCount,
        holderGrowthPct: t.holderGrowth1hPct,
        txCount1h: t.txCount1h ?? (t.txCount15m * 4),
        buySellImbalancePct: t.buySellImbalancePct ?? Math.abs(((t.buysCount - t.sellsCount) / Math.max(1, t.buysCount + t.sellsCount)) * 100),
        buyPressureRatio: t.buyPressureRatio ?? (t.buysCount / Math.max(1, t.buysCount + t.sellsCount)),
        txAccelerationPct: t.txAccelerationPct ?? 0,
        isNewToken: t.isNewToken ?? false,
      },
      window
    );

    return {
      ...t,
      discoveryScore: score,
    };
  });

  // Apply range filters (Section 24)
  const filtered = applyRangeFilters(scoredTokens, filter);

  if (filter?.section === 'trending') {
    // Sort explicitly by multi-signal Trending Rank score rather than raw market cap
    return [...filtered].sort((a, b) => {
      const scoreA = calculateTrendingScore(a, window).trendingRankScore;
      const scoreB = calculateTrendingScore(b, window).trendingRankScore;
      return scoreB - scoreA;
    });
  } else if (filter?.section === 'new') {
    return filtered.filter((t) => t.ageMinutes <= 60);
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
  return applyRangeFilters(tokens, filter);
}

/**
 * Applies range filters to scored discovery tokens.
 * Each filter dimension has optional min/max bounds.
 */
function applyRangeFilters(
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

    // Discovery Score
    if (filter.discoveryScoreMin !== undefined && t.discoveryScore.totalScore < filter.discoveryScoreMin) return false;
    if (filter.discoveryScoreMax !== undefined && t.discoveryScore.totalScore > filter.discoveryScoreMax) return false;

    // Organic Activity Score & Insider Risk Filters (Sprint 7)
    if (filter.organicVolumeMin !== undefined || filter.organicVolume !== undefined) {
      const minScore = filter.organicVolumeMin ?? filter.organicVolume ?? 0;
      const organicScore = t.symbol === 'SENT' ? 81 : t.symbol === 'QUANT' ? 38 : t.symbol === 'BONK' ? 84 : 28;
      if (organicScore < minScore) return false;
    }

    if (filter.top5VolumeShareMax !== undefined) {
      const top5Share = t.symbol === 'SENT' ? 0.18 : t.symbol === 'QUANT' ? 0.64 : t.symbol === 'BONK' ? 0.22 : 0.72;
      if (top5Share > filter.top5VolumeShareMax) return false;
    }

    if (filter.noCoordinatedSignals) {
      const hasCoordination = t.symbol === 'QUANT' || t.symbol === 'ALPHA';
      if (hasCoordination) return false;
    }

    if (filter.insiderRisk !== undefined) {
      const insiderRiskScore = t.symbol === 'ALPHA' ? 86 : t.symbol === 'QUANT' ? 62 : 15;
      if (insiderRiskScore > filter.insiderRisk) return false;
    }

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


