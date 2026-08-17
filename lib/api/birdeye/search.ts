import { birdeye } from './client';

export interface SearchTokenResult {
  name: string;
  symbol: string;
  address: string;
  network: string;
  decimals: number;
  logo_uri?: string;
  verified?: boolean;
  fdv: number;
  market_cap?: number;
  liquidity: number;
  price: number;
  price_change_24h_percent: number;
  sell_24h?: number;
  sell_24h_change_percent?: number | null;
  buy_24h?: number;
  buy_24h_change_percent?: number | null;
  unique_wallet_24h?: number;
  unique_wallet_24h_change_percent?: number | null;
  trade_24h?: number;
  trade_24h_change_percent?: number | null;
  volume_24h_change_percent: number | null;
  volume_24h_usd: number;
  last_trade_unix_time?: number;
  last_trade_human_time?: string;
  supply?: number;
  updated_time?: number;
  creation_time?: string;
  is_scaled_ui_token?: boolean;
  multiplier?: number | null;
  [key: string]: any;
}

export interface SearchMarketResult {
  name: string;
  address: string;
  network: string;
  liquidity: number;
  unique_wallet_24h?: number;
  unique_wallet_24h_change_percent?: number | null;
  trade_24h?: number;
  trade_24h_change_percent?: number | null;
  volume_24h_usd?: number;
  last_trade_unix_time?: number;
  last_trade_human_time?: string;
  source?: string;
  base_mint: string;
  quote_mint: string;
  amount_base?: number;
  amount_quote?: number;
  creation_time?: string;
  [key: string]: any;
}

export interface SearchItemGroup {
  type: 'token' | 'market' | string;
  result: SearchTokenResult[] | SearchMarketResult[] | any[];
}

export interface SearchResponse {
  items: SearchItemGroup[];
}

export interface SearchParams {
  keyword?: string;
  chain?: string;
  target?: 'all' | 'token' | 'market';
  search_mode?: 'exact' | 'fuzzy';
  search_by?: 'combination' | 'address' | 'name' | 'symbol';
  sort_by?: string;
  sort_type?: 'desc' | 'asc';
  verify_token?: boolean;
  markets?: string; // comma-separated
  offset?: number;
  limit?: number; // max 20
  ui_amount_mode?: 'raw' | 'scaled';
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

export async function search(params: SearchParams = {}): Promise<SearchResponse> {
  const queryString = buildQueryString(params);
  const endpoint = `/defi/v3/search${queryString ? `?${queryString}` : ''}`;
  return birdeye.fetch<SearchResponse>(endpoint);
}
