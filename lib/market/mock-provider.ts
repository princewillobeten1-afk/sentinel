import type {
  MarketDataProvider,
  MarketDataSubscription,
} from './provider';
import type {
  MarketSummary as MarketSummaryType,
  TokenMarketData as TokenMarketDataType,
  CandlestickPoint,
  TokenTradeRecord,
} from './types';
import {
  mockMarketSummary,
  mockTokenMarketData,
  mockTokenCandles,
  mockRecentTrades,
} from '@/lib/mocks/market';

function randomDelta(value: number, volatility: number) {
  return value * (1 + (Math.random() - 0.5) * volatility);
}

function normalizeFreshness(updatedAt: string): 'fresh' | 'delayed' | 'stale' | 'unavailable' {
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  if (ageMs < 10_000) return 'fresh';
  if (ageMs < 30_000) return 'delayed';
  if (ageMs < 60_000) return 'stale';
  return 'unavailable';
}

export class MockMarketDataProvider implements MarketDataProvider {
  private currentMarketSummary: MarketSummaryType = {
    ...mockMarketSummary,
    updatedAt: new Date().toISOString(),
    freshness: 'fresh',
  };

  private currentTokenData = Object.fromEntries(
    Object.entries(mockTokenMarketData).map(([symbol, data]) => [
      symbol,
      {
        ...data,
        updatedAt: new Date().toISOString(),
        freshness: 'fresh',
      },
    ]),
  ) as Record<string, TokenMarketDataType>;

  async getMarketSummary(): Promise<MarketSummaryType> {
    return Promise.resolve(this.currentMarketSummary);
  }

  async getTokenMarketData(symbol: string): Promise<TokenMarketDataType> {
    const token = this.currentTokenData[symbol.toUpperCase()];
    if (!token) {
      throw new Error(`Token market data not found for ${symbol}`);
    }
    return Promise.resolve(token);
  }

  async getTokenCandles(symbol: string, timeframe: string): Promise<CandlestickPoint[]> {
    return Promise.resolve(mockTokenCandles[symbol.toUpperCase()] ?? mockTokenCandles.SENT);
  }

  async getRecentTrades(symbol: string): Promise<TokenTradeRecord[]> {
    return Promise.resolve(mockRecentTrades[symbol.toUpperCase()] ?? mockRecentTrades.SENT);
  }

  subscribeToMarketSummary(
    onUpdate: (summary: MarketSummaryType) => void,
    onError?: (reason: unknown) => void,
  ): MarketDataSubscription {
    const refresh = () => {
      try {
        this.currentMarketSummary = {
          ...this.currentMarketSummary,
          solPriceUsd: Number(randomDelta(this.currentMarketSummary.solPriceUsd ?? 0, 0.014).toFixed(5)),
          solChange24h: Number(randomDelta(this.currentMarketSummary.solChange24h ?? 0, 0.02).toFixed(2)),
          totalVolume24hUsd: Number(randomDelta(this.currentMarketSummary.totalVolume24hUsd ?? 0, 0.03).toFixed(0)),
          totalLiquidityUsd: Number(randomDelta(this.currentMarketSummary.totalLiquidityUsd ?? 0, 0.02).toFixed(0)),
          averageSpread: Number(randomDelta(this.currentMarketSummary.averageSpread ?? 0, 0.1).toFixed(2)),
          updatedAt: new Date().toISOString(),
          freshness: 'fresh',
        };
        onUpdate(this.currentMarketSummary);
      } catch (error) {
        onError?.(error);
      }
    };

    const timerId = typeof window !== 'undefined' ? window.setInterval(refresh, 4_200) : undefined;
    refresh();

    return {
      unsubscribe: () => {
        if (typeof window !== 'undefined' && timerId !== undefined) {
          window.clearInterval(timerId);
        }
      },
    };
  }

  subscribeToTokenMarketData(
    symbol: string,
    onUpdate: (tokenData: TokenMarketDataType) => void,
    onError?: (reason: unknown) => void,
  ): MarketDataSubscription {
    const key = symbol.toUpperCase();
    if (!this.currentTokenData[key]) {
      onError?.(new Error(`Token market data not found for ${symbol}`));
      return { unsubscribe: () => {} };
    }

    const refresh = () => {
      try {
        const existing = this.currentTokenData[key];
        const next = {
          ...existing,
          priceUsd: Number(randomDelta(existing.priceUsd, 0.03).toFixed(5)),
          priceChange24h: Number(randomDelta(existing.priceChange24h, 0.05).toFixed(2)),
          volume24hUsd: Number(randomDelta(existing.volume24hUsd, 0.04).toFixed(0)),
          liquidityUsd: Number(randomDelta(existing.liquidityUsd, 0.02).toFixed(0)),
          marketDepthUsd: Number(randomDelta(existing.marketDepthUsd, 0.02).toFixed(0)),
          updatedAt: new Date().toISOString(),
          freshness: normalizeFreshness(new Date().toISOString()),
        };
        this.currentTokenData[key] = next;
        onUpdate(next);
      } catch (error) {
        onError?.(error);
      }
    };

    const timerId = typeof window !== 'undefined' ? window.setInterval(refresh, 3_800) : undefined;
    refresh();

    return {
      unsubscribe: () => {
        if (typeof window !== 'undefined' && timerId !== undefined) {
          window.clearInterval(timerId);
        }
      },
    };
  }
}
