import { birdeye } from './client';

export interface MemeInfoEvent {
  block_time?: number | null;
  slot?: number | null;
  tx_hash?: string | null;
}

export interface MemeInfoPool {
  address?: string | null;
  real_sol_reserves?: string | null;
  real_token_reserves?: string | null;
  virtual_token_reserves?: string | null;
  token_total_supply?: string | null;
}

export interface MemeInfo {
  created_at?: MemeInfoEvent;
  creator?: string;
  address?: string;
  creation_time?: number;
  graduated?: boolean;
  pool?: MemeInfoPool;
  progress_percent?: number;
  source?: string;
  platform_id?: string;
  graduated_time?: number | null;
  updated_at?: MemeInfoEvent;
  graduated_at?: MemeInfoEvent;
}

export interface MemeTokenItem {
  address?: string;
  logo_uri?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  extensions?: Record<string, string | number | boolean | null> | null;
  market_cap?: number;
  fdv?: number;
  total_supply?: number;
  circulating_supply?: number;
  liquidity?: number;
  last_trade_unix_time?: number;
  global_fees_paid?: number;
  holder?: number;
  recent_listing_time?: number;
  price?: number;
  meme_info?: MemeInfo;
  
  // Dynamic fields like volume_1m_usd, price_change_1h_percent, trade_24h_count etc.
  [key: string]: any; 
}

export async function getMemeTokenDetailSingle(
  address: string,
  chain: string = 'solana'
): Promise<MemeTokenItem> {
  return birdeye.fetch<MemeTokenItem>(
    `/defi/v3/token/meme/detail/single?address=${address}`,
    { headers: { 'x-chain': chain } }
  );
}

// Helper to build query strings
function buildQueryString(params: Record<string, any>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      query.append(key, String(value));
    }
  }
  return query.toString();
}

export interface MemeTokenListResponse {
  items: MemeTokenItem[];
  has_next?: boolean;
}

export interface MemeTokenListParams {
  sort_by: string;
  sort_type: 'asc' | 'desc';
  source?: string;
  creator?: string;
  platform_id?: string;
  graduated?: boolean;
  min_progress_percent?: number;
  max_progress_percent?: number;
  min_graduated_time?: number;
  max_graduated_time?: number;
  min_creation_time?: number;
  max_creation_time?: number;
  offset?: number;
  limit?: number;
  [key: string]: any; // Allow dynamic numeric filters
}

export async function getMemeTokenList(
  params: MemeTokenListParams,
  chain: string = 'solana'
): Promise<MemeTokenListResponse> {
  const queryString = buildQueryString(params);
  return birdeye.fetch<MemeTokenListResponse>(
    `/defi/v3/token/meme/list?${queryString}`,
    { headers: { 'x-chain': chain } }
  );
}
