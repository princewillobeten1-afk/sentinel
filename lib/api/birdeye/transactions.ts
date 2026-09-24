import { birdeye } from './client';

export interface Trade {
  txHash: string;
  source: string;
  blockNumber: number;
  blockTime: number;
  owner: string;
  from: {
    address: string;
    symbol: string;
    decimals: number;
    amount: number;
  };
  to: {
    address: string;
    symbol: string;
    decimals: number;
    amount: number;
  };
  side: 'buy' | 'sell';
  volumeUSD: number;
}

export async function getTokenTrades(
  address: string, 
  offset: number = 0, 
  limit: number = 50,
  txType: 'all' | 'swap' = 'swap'
): Promise<V3TradeItem[]> {
  // trade-data/single is an aggregate stats endpoint, not a transaction list.
  const response = await getTokenTxsV3(address, {
    offset, limit, tx_type: txType, sort_by: 'block_unix_time', sort_type: 'desc',
  });
  return response.items;
}

export async function getTokenTradesByVolume(
  address: string,
  minVolumeUsd: number = 10000,
  offset: number = 0,
  limit: number = 50
): Promise<V3TradeItem[]> {
  const query = buildQueryString({ token_address: address, volume_type: 'usd', min_volume: minVolumeUsd,
    sort_type: 'desc', offset, limit });
  const response = await birdeye.fetch<V3TradeListResponse>(`/defi/v3/token/txs-by-volume?${query}`);
  return response.items;
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

export interface V3AssetMovement {
  symbol?: string;
  name?: string;
  address?: string;
  decimals?: number;
  price?: number | null;
  amount?: number | string;
  ui_amount?: number;
  ui_change_amount?: number;
  nearest_price?: number | null;
  change_amount?: number | string;
  type?: string;
  type_swap?: string;
  is_scaled_ui_token?: boolean;
  multiplier?: number | null;
}

export interface V3TradeItem {
  base?: V3AssetMovement;
  quote?: V3AssetMovement;
  from?: V3AssetMovement;
  to?: V3AssetMovement;
  tx_type?: string;
  tx_hash?: string;
  ins_index?: number | null;
  inner_ins_index?: number | null;
  block_unix_time?: number;
  block_number?: number;
  volume_usd?: number;
  volume?: number;
  owner?: string;
  signers?: string[];
  source?: string;
  side?: string;
  alias?: string | null;
  price_pair?: number | null;
  base_price?: number | null;
  quote_price?: number | null;
  pool_id?: string | null;
  address?: string | null;
  interacted_program_id?: string | null;
}

export interface V3TradeListResponse {
  items: V3TradeItem[];
  has_next?: boolean;
  hasNext?: boolean;
}

export interface LegacyAssetMovement {
  symbol?: string;
  name?: string;
  decimals?: number;
  address?: string;
  mint?: string;
  amount?: number | string;
  uiAmount?: number;
  price?: number | null;
  nearestPrice?: number | null;
  changeAmount?: number | string;
  uiChangeAmount?: number;
  feeInfo?: any | null;
  type?: string;
  typeSwap?: string;
  type_swap?: string;
  isScaledUiToken?: boolean;
  multiplier?: number | null;
}

export interface LegacyTokenTradeItem {
  quote?: LegacyAssetMovement;
  base?: LegacyAssetMovement;
  from?: LegacyAssetMovement;
  to?: LegacyAssetMovement;
  basePrice?: number | null;
  quotePrice?: number | null;
  txHash?: string;
  source?: string;
  blockUnixTime?: number;
  txType?: string;
  owner?: string;
  side?: string;
  alias?: string | null;
  pricePair?: number | null;
  tokenPrice?: number | null;
  poolId?: string | null;
}

export interface LegacyPairTradeItem {
  txHash?: string;
  source?: string;
  blockUnixTime?: number;
  txType?: string;
  address?: string;
  owner?: string;
  from?: LegacyAssetMovement;
  to?: LegacyAssetMovement;
}

export interface LegacyTradeListResponse<T> {
  items: T[];
  hasNext?: boolean;
}

// Trades - Token (V3)
export async function getTokenTxsV3(
  address: string,
  params: {
    offset?: number;
    limit?: number;
    sort_by?: 'block_unix_time' | 'block_number';
    sort_type?: 'desc';
    tx_type?: 'swap' | 'buy' | 'sell' | 'add' | 'remove' | 'all';
    source?: string;
    owner?: string;
    pool_id?: string;
    before_time?: number;
    after_time?: number;
    before_block_number?: number;
    after_block_number?: number;
    ui_amount_mode?: 'raw' | 'scaled';
  } = {}
): Promise<V3TradeListResponse> {
  const queryString = buildQueryString({ address, ...params });
  return birdeye.fetch<V3TradeListResponse>(`/defi/v3/token/txs?${queryString}`);
}

// Trades - All (V3)
export async function getAllTxsV3(
  params: {
    offset?: number;
    limit?: number;
    sort_by?: 'block_unix_time' | 'block_number';
    sort_type?: 'desc';
    tx_type?: 'swap' | 'add' | 'remove' | 'all';
    source?: string;
    owner?: string;
    pool_id?: string;
    before_time?: number;
    after_time?: number;
    before_block_number?: number;
    after_block_number?: number;
    ui_amount_mode?: 'raw' | 'scaled';
  } = {}
): Promise<V3TradeListResponse> {
  const queryString = buildQueryString(params);
  return birdeye.fetch<V3TradeListResponse>(`/defi/v3/txs?${queryString}`);
}

// Trades - Recent (V3)
export async function getRecentTxsV3(
  params: {
    offset?: number;
    limit?: number;
    tx_type?: 'swap' | 'add' | 'remove' | 'all';
    owner?: string;
    before_time?: number;
    after_time?: number;
    before_block_number?: number;
    after_block_number?: number;
    ui_amount_mode?: 'raw' | 'scaled';
  } = {}
): Promise<V3TradeListResponse> {
  const queryString = buildQueryString(params);
  return birdeye.fetch<V3TradeListResponse>(`/defi/v3/txs/recent?${queryString}`);
}

// Trades - Token
export async function getLegacyTokenTxs(
  address: string,
  params: {
    offset?: number;
    limit?: number;
    tx_type?: 'swap' | 'add' | 'remove' | 'all';
    sort_type?: 'asc' | 'desc';
    ui_amount_mode?: 'raw' | 'scaled';
  } = {}
): Promise<LegacyTradeListResponse<LegacyTokenTradeItem>> {
  const sort_type = params.sort_type || 'desc';
  const queryString = buildQueryString({ address, ...params, sort_type });
  return birdeye.fetch<LegacyTradeListResponse<LegacyTokenTradeItem>>(`/defi/txs/token?${queryString}`);
}

// Trades - Pair
export async function getLegacyPairTxs(
  address: string,
  params: {
    offset?: number;
    limit?: number;
    tx_type?: 'swap' | 'add' | 'remove' | 'all';
    sort_type?: 'asc' | 'desc';
    ui_amount_mode?: 'raw' | 'scaled';
  } = {}
): Promise<LegacyTradeListResponse<LegacyPairTradeItem>> {
  const sort_type = params.sort_type || 'desc';
  const queryString = buildQueryString({ address, ...params, sort_type });
  return birdeye.fetch<LegacyTradeListResponse<LegacyPairTradeItem>>(`/defi/txs/pair?${queryString}`);
}

// Trades - Token Seek By Time
export async function getLegacyTokenTxsSeekByTime(
  address: string,
  params: {
    offset?: number;
    limit?: number;
    tx_type?: 'swap' | 'add' | 'remove' | 'all';
    before_time?: number;
    after_time?: number;
    ui_amount_mode?: 'raw' | 'scaled';
  } = {}
): Promise<LegacyTradeListResponse<LegacyTokenTradeItem>> {
  const queryString = buildQueryString({ address, ...params });
  return birdeye.fetch<LegacyTradeListResponse<LegacyTokenTradeItem>>(`/defi/txs/token/seek_by_time?${queryString}`);
}
