/**
 * Master Market Data Types & Contracts (Sprint 45).
 */

export type MarketStatus = 'DISCOVERED' | 'ACTIVE' | 'INACTIVE' | 'SUSPICIOUS' | 'DEPRECATED';

export type MarketDiscoverySource = 'ONCHAIN' | 'REGISTRY' | 'INDEXER' | 'MANUAL' | 'EXTERNAL_PROVIDER';

export type MarketType = 'CPMM' | 'CONCENTRATED' | 'ORDERBOOK' | 'STABLE_SWAP';

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type RankingCategory = 'trending' | 'gainers' | 'losers' | 'liquid' | 'volume' | 'new';

export type DivergenceStatus = 'NORMAL' | 'WARNING' | 'ANOMALOUS';

export interface Market {
  marketId: string; // `${chainId}:${protocol}:${address}`
  chainId: string;
  protocol: string;
  marketType: MarketType;
  address: string;
  baseTokenId: string;
  quoteTokenId: string;
  feeBps: number;
  status: MarketStatus;
  source: MarketDiscoverySource;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReserveState {
  marketId: string;
  baseReserve: number;
  quoteReserve: number;
  basePriceUsd: number;
  quotePriceUsd: number;
  liquidityUsd: number;
  slotOrBlock: number;
  timestamp: string;
}

export interface SwapEvent {
  id: string; // Deterministic hash: `${txHash}:${logIndex}:${marketId}`
  marketId: string;
  txHash: string;
  senderWallet: string;
  side: 'BUY' | 'SELL';
  baseAmount: number;
  quoteAmount: number;
  priceUsd: number;
  volumeUsd: number;
  slotOrBlock: number;
  timestamp: string;
}

export interface LiquidityEvent {
  id: string;
  marketId: string;
  txHash: string;
  providerWallet: string;
  type: 'ADD' | 'REMOVE';
  baseAmount: number;
  quoteAmount: number;
  liquidityUsd: number;
  slotOrBlock: number;
  timestamp: string;
}

export interface MarketPrice {
  marketId: string;
  priceUsd: number;
  status: 'FRESH' | 'STALE';
  source: string;
  confidence: number; // 0.0 - 1.0
  liquidityUsd: number;
  volume24hUsd: number;
  timestamp: string;
}

export interface CanonicalTokenPrice {
  tokenId: string;
  priceUsd: number;
  confidence: number; // 0.0 - 1.0
  marketCount: number;
  dominantMarketId: string;
  divergenceStatus: DivergenceStatus;
  sourceMarkets: Array<{ marketId: string; priceUsd: number; weight: number }>;
  calculationVersion: string;
  timestamp: string;
}

export interface OhlcvCandle {
  id: string; // `${marketId}:${interval}:${timestamp}`
  marketId: string;
  interval: CandleInterval;
  timestamp: number; // Bucket Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsd: number;
  tradeCount: number;
  isFinal: boolean;
}

export interface MarketSnapshot {
  marketId: string;
  priceUsd: number;
  volume24hUsd: number;
  liquidityUsd: number;
  priceChange24h: number;
  timestamp: string;
}

export interface TokenMarketSnapshot {
  tokenId: string;
  symbol: string;
  name: string;
  priceUsd: number;
  priceChange1m: number;
  priceChange5m: number;
  priceChange1h: number;
  priceChange6h: number;
  priceChange24h: number;
  priceChange7d: number;
  volume5mUsd: number;
  volume1hUsd: number;
  volume24hUsd: number;
  totalLiquidityUsd: number;
  marketCapUsd: number;
  fdvUsd: number | null;
  marketCount: number;
  confidence: number;
  dataQualityScore: number;
  timestamp: string;
}

export interface TokenSupplyInfo {
  tokenId: string;
  totalSupply: number;
  circulatingSupply: number;
  maxSupply: number | null;
  supplyConfidence: number;
  source: string;
  updatedAt: string;
}

export interface TokenTrendBreakdown {
  volumeMomentum: number;
  priceMomentum: number;
  activityMomentum: number;
  liquidityFactor: number;
  finalScore: number;
}

export interface RankedTokenItem {
  rank: number;
  tokenId: string;
  symbol: string;
  name: string;
  priceUsd: number;
  changePct: number;
  volumeUsd: number;
  liquidityUsd: number;
  score: number;
  trendBreakdown?: TokenTrendBreakdown;
}

export interface MarketDataQualityReport {
  tokenId: string;
  dataQualityScore: number; // 0 - 100
  dataConfidence: number; // 0.0 - 1.0
  freshnessScore: number;
  marketCoverageScore: number;
  divergenceStatus: DivergenceStatus;
  anomaliesDetected: Array<'LIQUIDITY_DROP' | 'VOLUME_SPIKE' | 'PRICE_DISCONNECT' | 'STALE_FEED'>;
  lastEvaluatedAt: string;
}
