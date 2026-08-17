import type {
  MarketSummary,
  TokenMarketData,
  CandlestickPoint,
  TokenTradeRecord,
} from './types';

export interface MarketDataSubscription {
  unsubscribe(): void;
}

export interface MarketDataProvider {
  getMarketSummary(): Promise<MarketSummary>;
  getTokenMarketData(symbol: string): Promise<TokenMarketData>;
  getTokenCandles(symbol: string, timeframe: string): Promise<CandlestickPoint[]>;
  getRecentTrades(symbol: string): Promise<TokenTradeRecord[]>;
  subscribeToMarketSummary?(
    onUpdate: (summary: MarketSummary) => void,
    onError?: (reason: unknown) => void,
  ): MarketDataSubscription;
  subscribeToTokenMarketData?(
    symbol: string,
    onUpdate: (tokenData: TokenMarketData) => void,
    onError?: (reason: unknown) => void,
  ): MarketDataSubscription;
}
