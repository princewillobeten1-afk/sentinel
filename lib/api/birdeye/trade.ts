import { birdeye } from './client';

export interface AllTimeTradesData {
  address: string;
  total_volume: number;
  total_volume_usd: number;
  volume_buy_usd: number;
  volume_sell_usd: number;
  volume_buy: number;
  volume_sell: number;
  total_trade: number;
  buy: number;
  sell: number;
}

export interface AllTimeTradesResponse {
  data: AllTimeTradesData[];
  success: boolean;
}

export async function getTokenAllTimeTrades(
  tokenAddress: string,
  timeFrame: string = '24h',
  chain: string = 'solana',
  uiAmountMode: 'raw' | 'scaled' | 'both' = 'raw'
): Promise<AllTimeTradesData[]> {
  const url = new URL('/defi/v3/all-time/trades/single', 'https://public-api.birdeye.so');
  url.searchParams.set('address', tokenAddress);
  url.searchParams.set('time_frame', timeFrame);
  if (uiAmountMode !== 'raw') {
    url.searchParams.set('ui_amount_mode', uiAmountMode);
  }
  
  return birdeye.fetch<AllTimeTradesData[]>(url.pathname + url.search, {
    headers: {
      'x-chain': chain
    }
  });
}

export async function getTokenAllTimeTradesMultiple(
  tokenAddresses: string[],
  timeFrame: string = '24h',
  chain: string = 'solana',
  uiAmountMode: 'raw' | 'scaled' | 'both' = 'raw'
): Promise<AllTimeTradesData[]> {
  const url = new URL('/defi/v3/all-time/trades/multiple', 'https://public-api.birdeye.so');
  url.searchParams.set('list_address', tokenAddresses.join(','));
  url.searchParams.set('time_frame', timeFrame);
  if (uiAmountMode !== 'raw') {
    url.searchParams.set('ui_amount_mode', uiAmountMode);
  }
  
  return birdeye.fetch<AllTimeTradesData[]>(url.pathname + url.search, {
    method: 'POST',
    headers: {
      'x-chain': chain
    }
  });
}
