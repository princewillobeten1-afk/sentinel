import type { DiscoveryToken } from '@/lib/discovery/types';
import type { TrendingToken, TokenListV3Item } from './discovery';
import { calculateDiscoveryScore } from '@/lib/discovery/score-engine';

export function mapBirdeyeToDiscoveryToken(
  token: any, // Can be TrendingToken, TokenListV3Item, etc.
  chain: string = 'solana'
): DiscoveryToken {
  // Try to parse basic properties
  const address = token.address || token.mint || token.token || '';
  const name = token.name || 'Unknown';
  const symbol = token.symbol || 'UNK';
  const price = token.price || 0;
  const volume24h = token.volume_usd || token.volume24hUSD || token.v24hUSD || 0;
  const liquidity = token.liquidity || token.liquidityUsd || 0;
  const mcap = token.marketcap || token.market_cap || token.fdv || 0;
  const rank = token.rank || 50;

  // Age calculation if recent_listing_time exists
  let ageMinutes = 0;
  let ageFormatted = 'N/A';
  if (token.recent_listing_time) {
    const ageMs = Date.now() - (token.recent_listing_time * 1000);
    ageMinutes = Math.floor(ageMs / 60000);
    if (ageMinutes < 60) ageFormatted = `${ageMinutes}m ago`;
    else if (ageMinutes < 1440) ageFormatted = `${Math.floor(ageMinutes / 60)}h ago`;
    else ageFormatted = `${Math.floor(ageMinutes / 1440)}d ago`;
  }

  // Generate a mock discovery score based on rank or raw data since we don't have all metrics initially
  // We'll give higher scores to better ranks or higher volumes
  const baseScore = Math.max(0, 100 - rank);
  
  return {
    id: address,
    name,
    symbol,
    mint: address,
    chain,
    source: 'Raydium', // Default source
    ageMinutes,
    ageFormatted,
    priceUsd: price.toString(),
    priceChange1m: 0,
    priceChange5m: 0,
    priceChange15m: 0,
    priceChange1h: 0,
    priceChange24h: token.price24hChangePercent || token.price_change_percent || 0,
    volume5mUsd: '0',
    volume1hUsd: '0',
    volume24hUsd: volume24h.toString(),
    volumeChange15mPct: 0,
    liquidityUsd: liquidity.toString(),
    liquidityChange1hPct: 0,
    marketCapUsd: mcap.toString(),
    buysCount: 0,
    sellsCount: 0,
    txCount15m: 0,
    txCount1h: 0,
    buySellImbalancePct: 50,
    buyPressureRatio: 0.5,
    txAccelerationPct: 0,
    isNewToken: ageMinutes < 1440 && ageMinutes > 0,
    holdersCount: token.holder || 0,
    holderGrowth1hPct: 0,
    discoveryScore: {
      totalScore: baseScore,
      confidence: 0.8,
      grade: baseScore >= 80 ? 'CRITICAL_SIGNAL' : baseScore >= 60 ? 'HIGH_SIGNAL' : 'MODERATE_SIGNAL',
      factors: { volumeAcceleration: 0, transactionAcceleration: 0, liquidityChange: 0, buySellImbalance: 0, holderGrowth: 0, recency: 0, priceVelocity: 0 },
      rawInputs: { ageMinutes, priceChangeWindow: 0, volumeWindowUsd: 0, volumeAccelerationPct: 0, liquidityChangePct: 0, buysCount: 0, sellsCount: 0, holdersCount: token.holder || 0, holderGrowthPct: 0, buySellImbalancePct: 0, buyPressureRatio: 0, txAccelerationPct: 0, isNewToken: ageMinutes < 1440 && ageMinutes > 0 },
      signals: [],
      explanations: [],
      calculatedAt: new Date().toISOString()
    }
  };
}
