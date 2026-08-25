import type { FreshnessState, MarketDataSource } from '@/lib/types/shared';
import type { TokenModel } from '@/lib/token/model';

export interface MarketSnapshot {
  tokenId: string;
  symbol: string;
  price: string;
  priceRaw: bigint;
  priceChange1m: number;
  priceChange5m: number;
  priceChange1h: number;
  priceChange24h: number;
  volume5m: string;
  volume1h: string;
  volume24h: string;
  liquidity: string;
  marketCap: string;
  buys: number;
  sells: number;
  holders: number;
  timestamp: string;
}

/**
 * Every figure is nullable, because every one of them can genuinely be
 * unavailable.
 *
 * These were all required numbers, which is exactly why the provider's failure
 * path invented a full set of them — SOL at $142.50, a 3.45% change, 48 active
 * pools, a "SENT" trending token. A required field with no guaranteed source
 * forces the code to make something up. `null` renders as an em-dash.
 */
export interface MarketSummary {
  solPriceUsd: number | null;
  solChange24h: number | null;
  totalMarketCapUsd: number | null;
  totalLiquidityUsd: number | null;
  totalVolume24hUsd: number | null;
  activePools: number | null;
  trendingTokens: string[];
  averageSpread: number | null;
  marketSentiment: 'bullish' | 'neutral' | 'bearish' | null;
  dataSource: MarketDataSource;
  updatedAt: string;
  freshness: FreshnessState;
}

export interface TokenMarketData {
  symbol: string;
  name: string;
  mint: string;
  network: string;
  priceUsd: number;
  priceChange24h: number;
  marketCapUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  holdersCount: number;
  holderChange24h: number;
  marketDepthUsd: number;
  tvlUsd: number;
  circulatingSupply: number;
  totalSupply: number;
  description: string;
  website?: string;
  explorerUrl?: string;
  poolInfo: TokenPoolInfo[];
  metrics: TokenMarketMetrics;
  metadata: Record<string, unknown>;
  tokenModel?: TokenModel;
  updatedAt: string;
  freshness: FreshnessState;
}

export interface TokenPoolInfo {
  id: string;
  dex: string;
  feeTier: string;
  baseSymbol: string;
  quoteSymbol: string;
  tvlUsd: number;
  feeUsd: number;
  depthUsd: number;
  minOrderSizeUsd: number;
  maxOrderSizeUsd: number;
}

export interface TokenMarketMetrics {
  buySellRatio: number;
  bidAskSpread: number;
  volatility24h: number;
  averageTradeSizeUsd: number;
  topHoldersShare: number;
}

export interface CandlestickPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TokenTradeRecord {
  id: string;
  side: 'buy' | 'sell';
  sizeUsd: string;
  priceUsd: string;
  time: string;
  walletLabel: string;
  source: string;
}
