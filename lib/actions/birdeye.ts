'use server';

import { getTokenOverview, TokenOverview, TokenOverviewOptions } from '@/lib/api/birdeye/stats';
import { getSmartMoneyTokenList, SmartMoneyTokenItem, SmartMoneyTokenListParams } from '@/lib/api/birdeye/smartMoney';
import { getTokenSecurity, TokenSecurityData } from '@/lib/api/birdeye/security';
import { getTokenMarketData, TokenMarketData, TokenMarketDataOptions } from '@/lib/api/birdeye/stats';

export async function getBirdeyeWsToken(): Promise<string> {
  // In a real production app, we would authenticate the user here before returning the API key
  // to prevent unauthorized usage of our Birdeye quota.
  // We might also want to set up a dedicated WebSocket proxy instead of exposing the key directly.
  return process.env.BIRDEYE_API_KEY || '';
}

export async function fetchTokenOverview(options: TokenOverviewOptions | string): Promise<TokenOverview> {
  return getTokenOverview(options);
}

export async function fetchTokenSecurity(address: string): Promise<TokenSecurityData> {
  return getTokenSecurity(address);
}

export async function fetchTokenMarketData(options: string | TokenMarketDataOptions): Promise<TokenMarketData> {
  return getTokenMarketData(options);
}

export async function fetchSmartMoney(params?: SmartMoneyTokenListParams, chain?: string): Promise<SmartMoneyTokenItem[]> {
  return getSmartMoneyTokenList(params, chain);
}

export async function searchBirdeye(params: any): Promise<any> {
  const { search } = await import('@/lib/api/birdeye/search');
  return search(params);
}
