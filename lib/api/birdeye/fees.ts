import { birdeye } from './client';

export interface DefiTokenFeeSummaryObject {
  sum_global_fee_paid_amount_sol?: number;
  sum_network_fee_amount_sol?: number;
  sum_priority_fee_amount_sol?: number;
  sum_tips_fee_amount_sol?: number;
  sum_trading_platform_fee_amount_sol?: number;
  sum_trading_platform_fee_amount_stablecoins?: number;
}

export interface DefiTokenFeeDetailsObject {
  tips_fee_amount_sol?: Record<string, number>;
  trading_platform_fee_amount_sol?: Record<string, number>;
  trading_platform_fee_amout_stablecoins?: Record<string, number>; // intentionally 'amout' due to API spelling
}

export interface DefiTokenFeeTimeframeObject {
  summary?: DefiTokenFeeSummaryObject;
  details?: DefiTokenFeeDetailsObject;
  unix_start?: number;
  unix_end?: number;
}

// Key is the interval (e.g. "24h", "5m")
export type DefiTokenFeeSingleResponseData = Record<string, DefiTokenFeeTimeframeObject>;

// Outer key is the token address, inner key is the interval
export type DefiTokenFeeMultipleResponseData = Record<string, Record<string, DefiTokenFeeTimeframeObject>>;

export async function getTokenFeeSingle(
  address: string,
  interval: string = '24h',
  chain: string = 'solana'
): Promise<DefiTokenFeeSingleResponseData> {
  return birdeye.fetch<DefiTokenFeeSingleResponseData>(
    `/defi/v3/token/fee/single?address=${address}&interval=${interval}`,
    { headers: { 'x-chain': chain } }
  );
}

export async function getTokenFeeMultiple(
  list_address: string, // Comma-separated token addresses
  interval: string = '24h',
  chain: string = 'solana'
): Promise<DefiTokenFeeMultipleResponseData> {
  return birdeye.fetch<DefiTokenFeeMultipleResponseData>(
    `/defi/v3/token/fee/multiple?list_address=${list_address}&interval=${interval}`,
    { headers: { 'x-chain': chain } }
  );
}
