import { birdeye } from './client';

export interface TrendingToken {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  logoURI: string;
  liquidity: number;
  volume24hUSD: number;
  volume24hChangePercent?: number;
  rank: number;
  price: number;
  price24hChangePercent?: number;
  fdv?: number;
  marketcap?: number;
}

export interface TrendingTokenResponse {
  updateUnixTime: number;
  updateTime: string;
  total: number;
  tokens: TrendingToken[];
}

export async function getTrendingTokens(params: {
  sort_by?: 'rank' | 'volumeUSD' | 'liquidity';
  sort_type?: 'asc' | 'desc';
  interval?: '1h' | '4h' | '24h';
  offset?: number;
  limit?: number;
  ui_amount_mode?: 'raw' | 'scaled';
  chain?: string;
} = {}): Promise<TrendingTokenResponse> {
  const { chain, ...restParams } = params;
  const queryString = buildQueryString(restParams);
  const options: RequestInit = {};
  if (chain) {
    options.headers = { 'x-chain': chain };
  }
  
  return birdeye.fetch<TrendingTokenResponse>(
    `/defi/token_trending?${queryString}`,
    options
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

export interface TokenListV3Item {
  address: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  logo_uri?: string;
  market_cap?: number;
  fdv?: number;
  liquidity?: number;
  price?: number;
  holder?: number;
  recent_listing_time?: number;
  global_fees_paid?: number;
  [key: string]: any;
}

export interface TokenListV3Response {
  items: TokenListV3Item[];
  has_next?: boolean;
}

export async function getTokenListV3(params: {
  sort_by?: string;
  sort_type?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
  min_liquidity?: number;
  [key: string]: any;
} = {}): Promise<TokenListV3Response> {
  const queryString = buildQueryString(params);
  return birdeye.fetch<TokenListV3Response>(`/defi/v3/token/list?${queryString}`);
}

export interface TokenListV3ScrollResponse {
  items: TokenListV3Item[];
  next_scroll_id?: string;
  scroll_time?: string;
}

export async function getTokenListV3Scroll(params: {
  scroll_id?: string;
  limit?: number;
  sort_by?: string;
  sort_type?: 'asc' | 'desc';
  min_liquidity?: number;
  [key: string]: any;
} = {}): Promise<TokenListV3ScrollResponse> {
  const queryString = buildQueryString(params);
  return birdeye.fetch<TokenListV3ScrollResponse>(`/defi/v3/token/list/scroll?${queryString}`);
}

export interface TokenListV1Item {
  address: string;
  decimals: number;
  lastTradeUnixTime: number;
  liquidity: number;
  logoURI: string;
  mc: number;
  name: string;
  symbol: string;
  v24hChangePercent: number;
  v24hUSD: number;
}

export interface TokenListV1Response {
  updateUnixTime: number;
  updateTime: string;
  total: number;
  tokens: TokenListV1Item[];
}

export async function getTokenListV1(params: {
  sort_by?: 'mc' | 'v24hUSD' | 'v24hChangePercent' | 'liquidity';
  sort_type?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
  min_liquidity?: number;
} = {}): Promise<TokenListV1Response> {
  const queryString = buildQueryString(params);
  return birdeye.fetch<TokenListV1Response>(`/defi/tokenlist?${queryString}`);
}

export interface TokenNewListingItem {
  address: string;
  symbol: string;
  name: string;
  source: string;
  liquidityAddedAt: string;
  logoURI: string;
  liquidity: number;
}

export async function getNewTokenListings(params: {
  limit?: number;
  time_to?: number;
  meme_platform_enabled?: boolean;
} = {}): Promise<TokenNewListingItem[]> {
  const queryString = buildQueryString(params);
  const response = await birdeye.fetch<{ items: TokenNewListingItem[] }>(`/defi/v2/tokens/new_listing?${queryString}`);
  return response.items;
}

export interface TokenMarketItem {
  address?: string;
  liquidity?: number;
  name?: string;
  price?: number;
  source?: string;
  volume24h?: number;
  trade24h?: number;
  trade24hChangePercent?: number;
  uniqueWallet24h?: number;
  uniqueWallet24hChangePercent?: number;
  createdAt?: string;
  [key: string]: any;
}

export async function getTokenMarkets(
  address: string, 
  params: {
    sort_by?: 'liquidity' | 'volume24h';
    sort_type?: 'asc' | 'desc';
    offset?: number;
    limit?: number;
  } = {}
): Promise<{ items: TokenMarketItem[], total: number }> {
  const queryString = buildQueryString({ address, ...params });
  return birdeye.fetch<{ items: TokenMarketItem[], total: number }>(`/defi/v2/markets?${queryString}`);
}

// ----------------------------------------------------------------------------
// Token - Creation Token Info
// ----------------------------------------------------------------------------

export interface TokenCreationInfo {
  txHash: string;
  slot: number;
  tokenAddress: string;
  decimals: number;
  owner: string;
  blockUnixTime: number;
  blockHumanTime: string;
}

export async function getTokenCreationInfo(
  address: string,
  chain: string = 'solana'
): Promise<TokenCreationInfo> {
  return birdeye.fetch<TokenCreationInfo>(
    `/defi/token_creation_info?address=${address}`,
    { headers: { 'x-chain': chain } }
  );
}
