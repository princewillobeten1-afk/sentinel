'use server';

import { SolanaMarketDataProvider } from '@/lib/market/solana-provider';
import type { MarketSummary, TokenMarketData } from '@/lib/market/types';

const provider = new SolanaMarketDataProvider();

export async function fetchLiveMarketSummary(): Promise<MarketSummary> {
  return provider.getMarketSummary();
}

export async function fetchLiveTokenData(symbol: string): Promise<TokenMarketData> {
  return provider.getTokenMarketData(symbol);
}

export async function fetchLiveTrendingTokens(): Promise<TokenMarketData[]> {
  const summary = await provider.getMarketSummary();
  const tokenPromises = summary.trendingTokens.map((symbol) => provider.getTokenMarketData(symbol));
  const tokens = await Promise.all(tokenPromises);
  // Filter out unavailable tokens
  return tokens.filter((t) => t.freshness !== 'unavailable');
}
