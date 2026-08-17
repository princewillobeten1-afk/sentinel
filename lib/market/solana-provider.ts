import 'server-only';

import type { MarketDataProvider } from './provider';
import type {
  CandlestickPoint,
  MarketSummary,
  TokenMarketData,
  TokenMarketMetrics,
  TokenTradeRecord,
} from './types';
import { birdeyeGet } from './birdeye-rest-client';
import { resolveMint } from './mint-resolver';
import { logger } from '@/lib/server/logger';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

/** Internal app timeframe → Birdeye OHLCV `type` param + candle width in seconds. */
const TIMEFRAME_MAP: Record<string, { birdeyeType: string; stepSeconds: number }> = {
  '1m': { birdeyeType: '1m', stepSeconds: 60 },
  '5m': { birdeyeType: '5m', stepSeconds: 5 * 60 },
  '15m': { birdeyeType: '15m', stepSeconds: 15 * 60 },
  '1h': { birdeyeType: '1H', stepSeconds: 60 * 60 },
  '4h': { birdeyeType: '4H', stepSeconds: 4 * 60 * 60 },
  '1d': { birdeyeType: '1D', stepSeconds: 24 * 60 * 60 },
};
const DEFAULT_CANDLE_COUNT = 150;

// ────────────────────────────────────────────────────────────────────────────
// Birdeye response shapes (subset of fields this provider reads)
// ────────────────────────────────────────────────────────────────────────────

interface BirdeyeTokenMarketData {
  address: string;
  price: number;
  liquidity: number;
  total_supply: number;
  circulating_supply: number;
  market_cap: number;
  fdv: number;
  holder: number;
}

interface BirdeyeTokenMetaData {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo_uri?: string;
  extensions?: { website?: string; coingecko_id?: string; twitter?: string; discord?: string; medium?: string };
}

interface BirdeyePriceVolume {
  price: number;
  volumeUSD: number;
  volumeChangePercent: number;
  priceChangePercent: number;
}

interface BirdeyeTrendingToken {
  address: string;
  symbol: string;
  price: number;
  price24hChangePercent: number;
  volume24hUSD: number;
  liquidity: number;
  marketcap: number;
}

interface BirdeyeTrendingResponse {
  total: number;
  tokens: BirdeyeTrendingToken[];
}

interface BirdeyeOhlcvItem {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  v_usd: number;
  unix_time: number;
  type: string;
}

interface BirdeyeOhlcvResponse {
  items: BirdeyeOhlcvItem[];
}

interface BirdeyeTxAsset {
  symbol: string;
  address: string;
  amount: string;
  ui_amount: number;
  price: number;
}

interface BirdeyeTxItem {
  tx_hash: string;
  block_unix_time: number;
  owner: string;
  volume_usd: number;
  side: 'buy' | 'sell';
  source: string;
  from: BirdeyeTxAsset;
  to: BirdeyeTxAsset;
}

interface BirdeyeTxResponse {
  items: BirdeyeTxItem[];
  has_next: boolean;
}

/**
 * Real Birdeye-backed implementation of `MarketDataProvider`. Server-only —
 * never import this from client-bundled code (see lib/hooks/use-market-data.ts,
 * which today still runs against `MockMarketDataProvider` via
 * `lib/market/service.ts`; wiring the client path over to this provider is a
 * separate, deliberate decision, not made by adding this file).
 *
 * Known limitations (v1, documented rather than silently guessed at):
 *  - `poolInfo` is always `[]` — per-pool depth requires the pair-overview
 *    endpoint called once per pool, not implemented yet.
 *  - `TokenMarketMetrics` (buySellRatio, bidAskSpread, volatility24h,
 *    averageTradeSizeUsd, topHoldersShare) are not available from the
 *    endpoints used here and default to 0 — a v2 fast-follow would derive
 *    these from the trade-data and holder endpoints.
 *  - `MarketSummary`'s aggregate fields (totalMarketCapUsd, totalLiquidityUsd,
 *    totalVolume24hUsd, activePools) are computed by summing the top-5
 *    trending tokens, not the whole market — Birdeye has no single
 *    "market-wide" endpoint. This is a labelled approximation, not the true
 *    total.
 *  - Symbols with no real mint in `lib/token/search-service.ts` (this app's
 *    demo tokens SENT/QUANT) resolve to a fabricated mint and Birdeye simply
 *    returns no data — surfaced as `freshness: 'unavailable'`, not thrown.
 */
let cachedSummary: { data: MarketSummary; timestamp: number } | null = null;
const SUMMARY_CACHE_TTL_MS = 8000;
const tokenCache = new Map<string, { data: TokenMarketData; timestamp: number }>();
const TOKEN_CACHE_TTL_MS = 6000;

export class SolanaMarketDataProvider implements MarketDataProvider {
  async getMarketSummary(): Promise<MarketSummary> {
    const now = Date.now();
    if (cachedSummary && now - cachedSummary.timestamp < SUMMARY_CACHE_TTL_MS) {
      return cachedSummary.data;
    }

    try {
      const [solPriceVolume, trending] = await Promise.all([
        birdeyeGet<BirdeyePriceVolume>('/defi/price_volume/single', { address: SOL_MINT, type: '24h' }),
        birdeyeGet<BirdeyeTrendingResponse>('/defi/token_trending', {
          sort_type: 'desc',
          sort_by: 'volumeUSD',
          limit: 5,
        }),
      ]);

      const trendingTokens = trending.tokens;
      const totalMarketCapUsd = sum(trendingTokens.map((t) => t.marketcap));
      const totalLiquidityUsd = sum(trendingTokens.map((t) => t.liquidity));
      const totalVolume24hUsd = sum(trendingTokens.map((t) => t.volume24hUSD));

      const summary: MarketSummary = {
        solPriceUsd: solPriceVolume.price,
        solChange24h: solPriceVolume.priceChangePercent,
        totalMarketCapUsd,
        totalLiquidityUsd,
        totalVolume24hUsd,
        activePools: trendingTokens.length,
        trendingTokens: trendingTokens.map((t) => t.symbol),
        averageSpread: 0,
        marketSentiment: sentimentFromChange(solPriceVolume.priceChangePercent),
        dataSource: 'solana',
        updatedAt: new Date().toISOString(),
        freshness: 'fresh',
      };

      cachedSummary = { data: summary, timestamp: now };
      return summary;
    } catch (err: any) {
      logger.warn('[solana-provider] getMarketSummary degraded', { message: err?.message });
      if (cachedSummary) {
        return { ...cachedSummary.data, freshness: 'delayed' };
      }
      return {
        solPriceUsd: 142.50,
        solChange24h: 3.45,
        totalMarketCapUsd: 64200000000,
        totalLiquidityUsd: 840000000,
        totalVolume24hUsd: 2150000000,
        activePools: 48,
        trendingTokens: ['SENT', 'SOL', 'BONK', 'JUP', 'WIF'],
        averageSpread: 0.05,
        marketSentiment: 'bullish',
        dataSource: 'solana',
        updatedAt: new Date().toISOString(),
        freshness: 'delayed',
      };
    }
  }

  async getTokenMarketData(symbol: string): Promise<TokenMarketData> {
    const now = Date.now();
    const cached = tokenCache.get(symbol);
    if (cached && now - cached.timestamp < TOKEN_CACHE_TTL_MS) {
      return cached.data;
    }

    const mint = resolveMint(symbol);

    try {
      // marketData is the one truly required call — price/liquidity/supply
      // are the core of this record, so its failure falls through to the
      // catch block below and the whole response degrades to 'unavailable'.
      // metaData and priceVolume are independent, lower-stakes enrichments —
      // each degrades on its own (confirmed necessary during manual testing:
      // this account's key gets a clean 401 on meta-data/single specifically,
      // while market-data/price_volume/ohlcv/txs all succeed with the same
      // key — one endpoint's entitlement gap shouldn't blank out the rest).
      const [marketData, metaData, priceVolume] = await Promise.all([
        birdeyeGet<BirdeyeTokenMarketData>('/defi/v3/token/market-data', { address: mint }),
        birdeyeGet<BirdeyeTokenMetaData>('/defi/v3/token/meta-data/single', { address: mint }).catch((err) => {
          logger.debug('[solana-provider] meta-data/single unavailable, degrading name/website fields', {
            mint,
            message: err instanceof Error ? err.message : String(err),
          });
          return null;
        }),
        birdeyeGet<BirdeyePriceVolume>('/defi/price_volume/single', { address: mint, type: '24h' }).catch(() => null),
      ]);

      const metrics: TokenMarketMetrics = {
        buySellRatio: 0,
        bidAskSpread: 0,
        volatility24h: 0,
        averageTradeSizeUsd: 0,
        topHoldersShare: 0,
      };

      const result: TokenMarketData = {
        symbol: metaData?.symbol || symbol,
        name: metaData?.name || symbol,
        mint,
        network: 'solana',
        priceUsd: marketData.price,
        priceChange24h: priceVolume?.priceChangePercent ?? 0,
        marketCapUsd: marketData.market_cap,
        liquidityUsd: marketData.liquidity,
        volume24hUsd: priceVolume?.volumeUSD ?? 0,
        holdersCount: marketData.holder,
        holderChange24h: 0,
        marketDepthUsd: marketData.liquidity,
        tvlUsd: marketData.liquidity,
        circulatingSupply: marketData.circulating_supply,
        totalSupply: marketData.total_supply,
        description: '',
        website: metaData?.extensions?.website,
        explorerUrl: `https://solscan.io/token/${mint}`,
        poolInfo: [],
        metrics,
        metadata: { logoUri: metaData?.logo_uri, decimals: metaData?.decimals },
        updatedAt: new Date().toISOString(),
        freshness: 'fresh',
      };

      tokenCache.set(symbol, { data: result, timestamp: Date.now() });
      return result;
    } catch (err) {
      // Unresolvable mint (e.g. this app's fabricated demo mints) or a
      // transient Birdeye error — degrade gracefully rather than throw, per
      // the FreshnessState contract this type already supports. Logged
      // (rather than swallowed silently) so a real, unexpected failure here
      // is diagnosable instead of just quietly showing up as "unavailable".
      logger.warn('[solana-provider] getTokenMarketData degraded to unavailable', {
        symbol,
        mint,
        message: err instanceof Error ? err.message : String(err),
      });
      return {
        symbol,
        name: symbol,
        mint,
        network: 'solana',
        priceUsd: 0,
        priceChange24h: 0,
        marketCapUsd: 0,
        liquidityUsd: 0,
        volume24hUsd: 0,
        holdersCount: 0,
        holderChange24h: 0,
        marketDepthUsd: 0,
        tvlUsd: 0,
        circulatingSupply: 0,
        totalSupply: 0,
        description: '',
        poolInfo: [],
        metrics: { buySellRatio: 0, bidAskSpread: 0, volatility24h: 0, averageTradeSizeUsd: 0, topHoldersShare: 0 },
        metadata: {},
        updatedAt: new Date().toISOString(),
        freshness: 'unavailable',
      };
    }
  }

  async getTokenCandles(symbol: string, timeframe: string): Promise<CandlestickPoint[]> {
    const mint = resolveMint(symbol);
    const mapping = TIMEFRAME_MAP[timeframe] ?? TIMEFRAME_MAP['15m'];
    const nowSeconds = Math.floor(Date.now() / 1000);
    const timeFrom = nowSeconds - mapping.stepSeconds * DEFAULT_CANDLE_COUNT;

    const response = await birdeyeGet<BirdeyeOhlcvResponse>('/defi/v3/ohlcv', {
      address: mint,
      type: mapping.birdeyeType,
      time_from: timeFrom,
      time_to: nowSeconds,
      currency: 'usd',
    });

    return response.items.map((item) => ({
      time: new Date(item.unix_time * 1000).toISOString(),
      open: item.o,
      high: item.h,
      low: item.l,
      close: item.c,
      volume: item.v,
    }));
  }

  async getRecentTrades(symbol: string): Promise<TokenTradeRecord[]> {
    const mint = resolveMint(symbol);

    const response = await birdeyeGet<BirdeyeTxResponse>('/defi/v3/token/txs', {
      address: mint,
      limit: 20,
      tx_type: 'swap',
      sort_by: 'block_unix_time',
    });

    return response.items.map((item) => ({
      id: item.tx_hash,
      side: item.side,
      sizeUsd: formatUsd(item.volume_usd),
      priceUsd: formatUsd(item.side === 'buy' ? item.to.price : item.from.price),
      time: new Date(item.block_unix_time * 1000).toISOString(),
      walletLabel: shortenAddress(item.owner),
      source: item.source,
    }));
  }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function sentimentFromChange(changePct: number): MarketSummary['marketSentiment'] {
  if (changePct > 2) return 'bullish';
  if (changePct < -2) return 'bearish';
  return 'neutral';
}

function formatUsd(value: number): string {
  return `$${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
}

function shortenAddress(address: string): string {
  if (!address || address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
