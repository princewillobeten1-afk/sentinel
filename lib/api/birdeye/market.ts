import { birdeye } from './client';

export interface MarketHistoryItem {
  unix_time: number;
  volume_usd: number;
  trade_count: number;
  active_trading_tokens: number;
  stable_coin_market_cap: number;
}

export interface MarketHistoryResponseData {
  items: MarketHistoryItem[];
  has_more: boolean;
}

export interface BlockchainMarketMetricsParams {
  time_frame?: '1D';
  time?: number; // Unix timestamp in seconds
  direction?: 'backward' | 'forward';
  count?: number; // Limit the number of data records returned (1 to 10)
}

function buildQueryString(params: Record<string, any>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      query.append(key, String(value));
    }
  }
  return query.toString();
}

export async function getBlockchainMarketMetrics(
  params: BlockchainMarketMetricsParams = {},
  chain: string = 'solana'
): Promise<MarketHistoryResponseData> {
  const queryString = buildQueryString(params);
  const endpoint = `/market/v1/blockchain-metrics${queryString ? `?${queryString}` : ''}`;
  return birdeye.fetch<MarketHistoryResponseData>(endpoint, {
    headers: { 'x-chain': chain }
  });
}
