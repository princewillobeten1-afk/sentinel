import { birdeye } from './client';

export interface SmartMoneyTokenItem {
  token: string;
  price: number;
  liquidity: number;
  market_cap: number;
  net_flow: number;
  smart_traders_no: number;
  trader_style: string;
  volume_usd: number;
  volume_buy_usd: number;
  volume_sell_usd: number;
  symbol: string;
  name: string;
  logo_uri?: string;
  price_change_percent: number;
  [key: string]: any;
}

export interface SmartMoneyTokenListParams {
  interval?: '1d' | '7d' | '30d';
  trader_style?: 'all' | 'risk_averse' | 'risk_balancers' | 'trenchers';
  sort_by?: 'net_flow' | 'smart_traders_no' | 'market_cap';
  sort_type?: 'desc' | 'asc';
  offset?: number;
  limit?: number;
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

export async function getSmartMoneyTokenList(
  params: SmartMoneyTokenListParams = {},
  chain: string = 'solana'
): Promise<SmartMoneyTokenItem[]> {
  const queryString = buildQueryString(params);
  const endpoint = `/smart-money/v1/token/list${queryString ? `?${queryString}` : ''}`;
  return birdeye.fetch<SmartMoneyTokenItem[]>(endpoint, {
    headers: { 'x-chain': chain }
  });
}
