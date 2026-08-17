import type {
  MarketDataProvider,
  MarketDataSubscription,
} from './provider';
import { MockMarketDataProvider } from './mock-provider';
import { SolanaMarketDataProvider } from './solana-provider';
import type {
  MarketSummary,
  TokenMarketData,
  CandlestickPoint,
  TokenTradeRecord,
} from './types';

// The client-side hooks use this module. 
// We cannot use SolanaMarketDataProvider here directly without a build error due to `server-only`.
let provider: MarketDataProvider = new MockMarketDataProvider();

export function setMarketDataProvider(nextProvider: MarketDataProvider) {
  provider = nextProvider;
}

export async function getMarketSummary(): Promise<MarketSummary> {
  return provider.getMarketSummary();
}

export async function getTokenMarketData(symbol: string): Promise<TokenMarketData> {
  return provider.getTokenMarketData(symbol);
}

export async function getTokenCandles(symbol: string, timeframe: string): Promise<CandlestickPoint[]> {
  return provider.getTokenCandles(symbol, timeframe);
}

export async function getRecentTrades(symbol: string): Promise<TokenTradeRecord[]> {
  return provider.getRecentTrades(symbol);
}

export function subscribeToMarketSummary(
  onUpdate: (summary: MarketSummary) => void,
  onError?: (reason: unknown) => void,
): MarketDataSubscription {
  return provider.subscribeToMarketSummary?.(onUpdate, onError) ?? { unsubscribe: () => {} };
}

export function subscribeToTokenMarketData(
  symbol: string,
  onUpdate: (tokenData: TokenMarketData) => void,
  onError?: (reason: unknown) => void,
): MarketDataSubscription {
  return provider.subscribeToTokenMarketData?.(symbol, onUpdate, onError) ?? { unsubscribe: () => {} };
}
