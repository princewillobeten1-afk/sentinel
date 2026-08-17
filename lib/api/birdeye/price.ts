import { birdeye } from './client';

export interface TokenPrice {
  value: number;
  updateUnixTime: number;
  updateHumanTime: string;
  priceChange24h?: number;
  priceInNative?: number;
  liquidity?: number;
  isScaledUiToken?: boolean;
  scaledValue?: number;
  multiplier?: number;
  scaledPriceInNative?: number;
}

export interface OHLCV {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  unixTime: number;
  type: string;
}

export interface OHLCVV3 {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  v_usd: number;
  unix_time: number;
  address: string;
  type: string;
  currency: string;
  scaled_o?: number;
  scaled_h?: number;
  scaled_l?: number;
  scaled_c?: number;
  scaled_v?: number;
}

export interface OHLCVV3Options {
  address: string;
  type?: string;
  currency?: 'usd' | 'native';
  time_from?: number;
  time_to?: number;
  ui_amount_mode?: 'raw' | 'scaled' | 'both';
  mode?: 'range' | 'count';
  count_limit?: number;
  padding?: boolean;
  outlier?: boolean;
}

export interface OHLCVPairV3Options {
  address: string;
  type?: string;
  time_from?: number;
  time_to?: number;
  mode?: 'range' | 'count';
  count_limit?: number;
  padding?: boolean;
  outlier?: boolean;
  inversion?: boolean;
}

export interface HistoryPriceItem {
  unixTime: number;
  value: number;
  scaledValue?: number;
}

export interface HistoryPriceResponse {
  isScaledUiToken?: boolean;
  multiplier?: number;
  items: HistoryPriceItem[];
}

export interface HistoryPriceOptions {
  address: string;
  address_type: 'token' | 'pair';
  type: string;
  time_from: number;
  time_to: number;
  ui_amount_mode?: 'raw' | 'scaled' | 'both';
}

export interface HistoricalPriceUnix {
  isScaledUiToken?: boolean;
  value: number;
  updateUnixTime: number;
  priceChange24h: number;
  scaledValue?: number;
  multiplier?: number;
}

export interface HistoricalPriceUnixOptions {
  address: string;
  unixtime?: number;
  ui_amount_mode?: 'raw' | 'scaled' | 'both';
}

export interface PriceVolumeSingle {
  price: number;
  updateUnixTime: number;
  updateHumanTime: string;
  volumeUSD: number;
  volumeChangePercent: number | null;
  priceChangePercent: number;
  isScaledUiToken?: boolean;
  scaledValue?: number;
  multiplier?: number;
}

export interface PriceVolumeSingleOptions {
  address: string;
  type?: '1h' | '2h' | '4h' | '8h' | '24h';
  ui_amount_mode?: 'raw' | 'scaled' | 'both';
}

export interface PriceVolumeMultiOptions {
  list_address: string;
  type?: '1h' | '2h' | '4h' | '8h' | '24h';
  ui_amount_mode?: 'raw' | 'scaled' | 'both';
}

export async function getTokenPrice(
  address: string,
  includeLiquidity?: boolean
): Promise<TokenPrice> {
  const queryParams = new URLSearchParams({ address });
  if (includeLiquidity !== undefined) {
    queryParams.append('include_liquidity', includeLiquidity.toString());
  }
  return birdeye.fetch<TokenPrice>(`/defi/price?${queryParams.toString()}`);
}

export async function getMultiTokenPrice(
  addresses: string[],
  includeLiquidity?: boolean
): Promise<Record<string, TokenPrice | null>> {
  if (addresses.length === 0) return {};
  
  const queryParams = new URLSearchParams();
  if (includeLiquidity !== undefined) {
    queryParams.append('include_liquidity', includeLiquidity.toString());
  }

  const url = `/defi/multi_price${queryParams.size > 0 ? `?${queryParams.toString()}` : ''}`;
  
  return birdeye.fetch<Record<string, TokenPrice | null>>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ list_address: addresses.join(',') })
  });
}

export async function getOHLCV(address: string, type: string = '15m', timeFrom?: number, timeTo?: number): Promise<OHLCV[]> {
  let url = `/defi/ohlcv?address=${address}&type=${type}`;
  if (timeFrom) url += `&time_from=${timeFrom}`;
  if (timeTo) url += `&time_to=${timeTo}`;
  
  const response = await birdeye.fetch<{ items: OHLCV[] }>(url);
  return response.items;
}

// V3 for no padding and finer intervals
export async function getOHLCVV3(options: OHLCVV3Options): Promise<OHLCVV3[]> {
  const queryParams = new URLSearchParams();
  
  queryParams.append('address', options.address);
  queryParams.append('type', options.type || '15m');
  
  if (options.currency) queryParams.append('currency', options.currency);
  if (options.time_from) queryParams.append('time_from', options.time_from.toString());
  if (options.time_to) queryParams.append('time_to', options.time_to.toString());
  if (options.ui_amount_mode) queryParams.append('ui_amount_mode', options.ui_amount_mode);
  if (options.mode) queryParams.append('mode', options.mode);
  if (options.count_limit !== undefined) queryParams.append('count_limit', options.count_limit.toString());
  if (options.padding !== undefined) queryParams.append('padding', options.padding.toString());
  if (options.outlier !== undefined) queryParams.append('outlier', options.outlier.toString());

  const url = `/defi/v3/ohlcv?${queryParams.toString()}`;
  
  const response = await birdeye.fetch<{ items: OHLCVV3[] }>(url);
  return response.items;
}

// V3 Pair for pair-specific precise candles
export async function getOHLCVPairV3(options: OHLCVPairV3Options): Promise<OHLCVV3[]> {
  const queryParams = new URLSearchParams();
  
  queryParams.append('address', options.address);
  queryParams.append('type', options.type || '15m');
  
  if (options.time_from) queryParams.append('time_from', options.time_from.toString());
  if (options.time_to) queryParams.append('time_to', options.time_to.toString());
  if (options.mode) queryParams.append('mode', options.mode);
  if (options.count_limit !== undefined) queryParams.append('count_limit', options.count_limit.toString());
  if (options.padding !== undefined) queryParams.append('padding', options.padding.toString());
  if (options.outlier !== undefined) queryParams.append('outlier', options.outlier.toString());
  if (options.inversion !== undefined) queryParams.append('inversion', options.inversion.toString());

  const url = `/defi/v3/ohlcv/pair?${queryParams.toString()}`;
  
  const response = await birdeye.fetch<{ items: OHLCVV3[] }>(url);
  return response.items;
}

export async function getHistoryPrice(options: HistoryPriceOptions): Promise<HistoryPriceResponse> {
  const queryParams = new URLSearchParams();
  queryParams.append('address', options.address);
  queryParams.append('address_type', options.address_type);
  queryParams.append('type', options.type);
  queryParams.append('time_from', options.time_from.toString());
  queryParams.append('time_to', options.time_to.toString());
  if (options.ui_amount_mode) queryParams.append('ui_amount_mode', options.ui_amount_mode);

  const url = `/defi/history_price?${queryParams.toString()}`;
  return birdeye.fetch<HistoryPriceResponse>(url);
}

export async function getHistoricalPriceUnix(options: HistoricalPriceUnixOptions): Promise<HistoricalPriceUnix | null> {
  const queryParams = new URLSearchParams();
  queryParams.append('address', options.address);
  if (options.unixtime !== undefined) queryParams.append('unixtime', options.unixtime.toString());
  if (options.ui_amount_mode) queryParams.append('ui_amount_mode', options.ui_amount_mode);

  const url = `/defi/historical_price_unix?${queryParams.toString()}`;
  return birdeye.fetch<HistoricalPriceUnix | null>(url);
}

export async function getPriceVolumeSingle(options: PriceVolumeSingleOptions): Promise<PriceVolumeSingle> {
  const queryParams = new URLSearchParams();
  queryParams.append('address', options.address);
  if (options.type) queryParams.append('type', options.type);
  if (options.ui_amount_mode) queryParams.append('ui_amount_mode', options.ui_amount_mode);

  const url = `/defi/price_volume/single?${queryParams.toString()}`;
  return birdeye.fetch<PriceVolumeSingle>(url);
}

export async function getPriceVolumeMulti(options: PriceVolumeMultiOptions): Promise<Record<string, PriceVolumeSingle | null>> {
  const queryParams = new URLSearchParams();
  if (options.ui_amount_mode) queryParams.append('ui_amount_mode', options.ui_amount_mode);

  const url = `/defi/price_volume/multi${queryParams.size > 0 ? `?${queryParams.toString()}` : ''}`;
  
  const body = {
    list_address: options.list_address,
    ...(options.type ? { type: options.type } : {})
  };

  return birdeye.fetch<Record<string, PriceVolumeSingle | null>>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}
