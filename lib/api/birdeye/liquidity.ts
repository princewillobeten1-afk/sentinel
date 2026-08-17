import { birdeye } from './client';

export interface LiquidityOhlcPairItem {
  pair_address: string;
  base_mint: string;
  quote_mint: string;
  timestamp: string;
  unix_time: number;
  open_liquidity_usd: number;
  high_liquidity_usd: number;
  low_liquidity_usd: number;
  close_liquidity_usd: number;
  open_base_balance: number;
  high_base_balance: number;
  low_base_balance: number;
  close_base_balance: number;
  open_quote_balance: number;
  high_quote_balance: number;
  low_quote_balance: number;
  close_quote_balance: number;
  open_base_amount_ui: number;
  high_base_amount_ui: number;
  low_base_amount_ui: number;
  close_base_amount_ui: number;
  open_quote_amount_ui: number;
  high_quote_amount_ui: number;
  low_quote_amount_ui: number;
  close_quote_amount_ui: number;
  base_open_price: number;
  base_high_price: number;
  base_low_price: number;
  base_close_price: number;
  quote_open_price: number;
  quote_high_price: number;
  quote_low_price: number;
  quote_close_price: number;
}

export interface DefiLiquidityOhlcResponse<T> {
  items: T[];
  direction: 'next' | 'prev';
  limit: number;
  next_cursor: number | null;
  prev_cursor: number | null;
  has_more: boolean;
}

export interface LiquidityOhlcPairOptions {
  address: string;
  time?: number;
  direction?: 'back' | 'forward';
  count?: number;
}

export async function getLiquidityOhlcPair(options: LiquidityOhlcPairOptions): Promise<DefiLiquidityOhlcResponse<LiquidityOhlcPairItem>> {
  const queryParams = new URLSearchParams();
  queryParams.append('address', options.address);
  if (options.time !== undefined) queryParams.append('time', options.time.toString());
  if (options.direction !== undefined) queryParams.append('direction', options.direction);
  if (options.count !== undefined) queryParams.append('count', options.count.toString());

  const url = `/defi/v3/liquidity/ohlc/pair?${queryParams.toString()}`;
  return birdeye.fetch<DefiLiquidityOhlcResponse<LiquidityOhlcPairItem>>(url);
}

export interface LiquidityOhlcTokenItem {
  token: string;
  timestamp: string;
  unix_time: number;
  open_liquidity_usd: number;
  high_liquidity_usd: number;
  low_liquidity_usd: number;
  close_liquidity_usd: number;
  open_exit_liquidity_usd: number;
  high_exit_liquidity_usd: number;
  low_exit_liquidity_usd: number;
  close_exit_liquidity_usd: number;
  open_stable_liquidity_usd: number;
  high_stable_liquidity_usd: number;
  low_stable_liquidity_usd: number;
  close_stable_liquidity_usd: number;
  total_pairs: number;
}

export interface LiquidityOhlcTokenOptions {
  address: string;
  resolution?: '1m' | '4h' | '1D';
  time?: number;
  direction?: 'back' | 'forward';
  count?: number;
}

export async function getLiquidityOhlcToken(options: LiquidityOhlcTokenOptions): Promise<DefiLiquidityOhlcResponse<LiquidityOhlcTokenItem>> {
  const queryParams = new URLSearchParams();
  queryParams.append('address', options.address);
  if (options.resolution !== undefined) queryParams.append('resolution', options.resolution);
  if (options.time !== undefined) queryParams.append('time', options.time.toString());
  if (options.direction !== undefined) queryParams.append('direction', options.direction);
  if (options.count !== undefined) queryParams.append('count', options.count.toString());

  const url = `/defi/v3/liquidity/ohlc/token?${queryParams.toString()}`;
  return birdeye.fetch<DefiLiquidityOhlcResponse<LiquidityOhlcTokenItem>>(url);
}

export interface LiquidityHistoryTokenItem {
  unix_time: number;
  liquidity_usd: number;
  exit_liquidity_usd: number;
  stable_liquidity_usd: number;
  total_pairs: number;
}

export interface LiquidityHistoryTokenOptions {
  address: string;
  resolution?: '1m' | '4h' | '1D';
  time?: number;
  direction?: 'back' | 'forward';
  count?: number;
}

export async function getLiquidityHistoryToken(options: LiquidityHistoryTokenOptions): Promise<DefiLiquidityOhlcResponse<LiquidityHistoryTokenItem>> {
  const queryParams = new URLSearchParams();
  queryParams.append('address', options.address);
  if (options.resolution !== undefined) queryParams.append('resolution', options.resolution);
  if (options.time !== undefined) queryParams.append('time', options.time.toString());
  if (options.direction !== undefined) queryParams.append('direction', options.direction);
  if (options.count !== undefined) queryParams.append('count', options.count.toString());

  const url = `/defi/v3/liquidity/history/token?${queryParams.toString()}`;
  return birdeye.fetch<DefiLiquidityOhlcResponse<LiquidityHistoryTokenItem>>(url);
}

export interface LiquidityLatestTokenItem {
  token: string;
  liquidity_usd: number;
  exit_liquidity_usd: number;
  stable_liquidity_usd: number;
  price: number | null;
}

export interface DefiLatestTokenLiquidityResponse {
  items: LiquidityLatestTokenItem[];
}

export async function getLiquidityLatestToken(addresses: string[]): Promise<DefiLatestTokenLiquidityResponse> {
  const url = '/defi/v3/liquidity/latest/token';
  return birdeye.fetch<DefiLatestTokenLiquidityResponse>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ addresses })
  });
}
