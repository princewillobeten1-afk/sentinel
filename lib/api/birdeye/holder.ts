import { birdeye } from './client';

export interface TokenHolderItem {
  amount: number | string; // raw token balance
  amountUsd?: number; // wallet mode
  decimals: number;
  mint: string;
  owner: string;
  token_account: string;
  ui_amount: number;
  isScaledUiToken: boolean;
  multiplier: number | null;
  // Wallet mode specific:
  holdAvgPrice?: number;
  avgBuyPrice?: number;
  avgSellPrice?: number;
  firstTradeUnixTime?: number;
  lastTradeUnixTime?: number;
  netWorth?: number;
  solBalance?: number;
  funding?: {
    funder: string;
    unixTime: number;
    amount: number;
    txHash: string;
  };
}

export interface TokenHolderResponse {
  holder: number;
  top10HoldPercent: number;
  items: TokenHolderItem[];
}

export async function getTokenHolders(
  tokenAddress: string,
  mode: 'token_account' | 'wallet' = 'wallet',
  offset: number = 0,
  limit: number = 100,
  getHolderInfos: boolean = false
): Promise<TokenHolderResponse> {
  const url = new URL('/defi/v3/token/holder', 'https://public-api.birdeye.so');
  url.searchParams.set('address', tokenAddress);
  url.searchParams.set('mode', mode);
  url.searchParams.set('offset', offset.toString());
  url.searchParams.set('limit', limit.toString());
  
  if (mode === 'wallet' && getHolderInfos) {
    url.searchParams.set('get_holder_infos', 'true');
  }

  return birdeye.fetch<TokenHolderResponse>(url.pathname + url.search);
}

export interface TokenHolderBatchItem {
  balance: string;
  decimals: number;
  mint: string;
  owner: string;
  amount: number;
}

export async function getTokenHolderBatch(tokenAddress: string, wallets: string[]): Promise<TokenHolderBatchItem[]> {
  if (wallets.length === 0) return [];
  if (wallets.length > 500) {
    throw new Error('Birdeye API error: Max 500 wallets per batch request');
  }
  
  const response = await birdeye.fetch<{ items: TokenHolderBatchItem[] }>(
    `/token/v1/holder/batch`,
    {
      method: 'POST',
      body: JSON.stringify({
        token_address: tokenAddress,
        wallets: wallets
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.items;
}

export interface TokenHolderDistributionItem {
  wallet?: string;
  token_account?: string;
  holding: string;
  percent_of_supply: number;
}

export interface TokenHolderDistributionSummary {
  wallet_count: number;
  total_holding: string;
  percent_of_supply: number;
}

export interface TokenHolderDistributionResponse {
  token_address: string;
  mode: 'percent' | 'top';
  summary: TokenHolderDistributionSummary;
  holders: TokenHolderDistributionItem[];
}

export async function getTokenHolderDistribution(
  tokenAddress: string,
  mode: 'top' | 'percent' = 'top',
  addressType: 'wallet' | 'token_account' = 'wallet',
  includeList: boolean = true,
  topN: number = 10,
  minPercent?: number,
  maxPercent?: number,
  offset: number = 0,
  limit: number = 50
): Promise<TokenHolderDistributionResponse> {
  const url = new URL('/holder/v1/distribution', 'https://public-api.birdeye.so');
  url.searchParams.set('token_address', tokenAddress);
  url.searchParams.set('mode', mode);
  url.searchParams.set('address_type', addressType);
  url.searchParams.set('include_list', includeList.toString());
  
  if (includeList) {
    url.searchParams.set('offset', offset.toString());
    url.searchParams.set('limit', limit.toString());
  }

  if (mode === 'top') {
    url.searchParams.set('top_n', topN.toString());
  } else if (mode === 'percent') {
    if (minPercent !== undefined) url.searchParams.set('min_percent', minPercent.toString());
    if (maxPercent !== undefined) url.searchParams.set('max_percent', maxPercent.toString());
  }

  return birdeye.fetch<TokenHolderDistributionResponse>(url.pathname + url.search);
}

export interface TokenHolderProfileTag {
  tag: 'bundler' | 'sniper' | 'insider' | 'dev' | 'smart_trader';
  holder_count: number;
  hold_amount: string;
  percent_of_supply: number;
  buy_volume: string;
  sell_volume: string;
  buy_volume_usd: string;
  sell_volume_usd: string;
  avg_buy_price: string;
  pnl: string;
}

export interface TokenHolderProfileResponse {
  token: {
    creation_time: number;
    market_cap: number;
    liquidity: number;
    volume_1h: number;
    volume_1h_usd: number;
    buy_volume_1h: number;
    buy_volume_1h_usd: number;
    sell_volume_1h: number;
    sell_volume_1h_usd: number;
    is_scaled_ui_token: boolean;
    top10_holder: {
      hold_amount: string;
      percent_of_supply: number;
    }
  };
  holder_summary: {
    total_holder: number;
    total_holding: number;
    percent_of_supply: number;
  };
  tags: TokenHolderProfileTag[];
}

export async function getTokenHolderProfile(
  tokenAddress: string,
  includeZeroBalance: boolean = true
): Promise<TokenHolderProfileResponse> {
  const url = new URL('/token/v1/holder-profile', 'https://public-api.birdeye.so');
  url.searchParams.set('token_address', tokenAddress);
  url.searchParams.set('include_zero_balance', includeZeroBalance.toString());
  
  return birdeye.fetch<TokenHolderProfileResponse>(url.pathname + url.search);
}

export interface TokenHolderPositionItem {
  wallet_address: string;
  hold_amount: string;
  percent_of_supply: number;
  buy_volume: string;
  sell_volume: string;
  buy_volume_usd: string;
  sell_volume_usd: string;
  avg_buy_price: string;
  pnl: string;
  buy_count: number;
  sell_count: number;
  first_trade_at: string;
  labels: ('bundler' | 'sniper' | 'insider' | 'dev' | 'smart_trader')[];
}

export async function getTokenHolderPositions(
  tokenAddress: string,
  labels: ('bundler' | 'sniper' | 'insider' | 'dev' | 'smart_trader')[] = ['bundler'],
  includeZeroBalance: boolean = true,
  offset: number = 0,
  limit: number = 50
): Promise<TokenHolderPositionItem[]> {
  const url = new URL('/token/v1/holder-positions', 'https://public-api.birdeye.so');
  url.searchParams.set('token_address', tokenAddress);
  url.searchParams.set('labels', labels.join(','));
  url.searchParams.set('include_zero_balance', includeZeroBalance.toString());
  url.searchParams.set('offset', offset.toString());
  url.searchParams.set('limit', limit.toString());
  
  return birdeye.fetch<TokenHolderPositionItem[]>(url.pathname + url.search);
}

export interface TokenHolderChartItem {
  timestamp: number;
  holder: number;
  net_change: number;
  percent_change: number;
}

export async function getTokenHolderChart(
  tokenAddress: string,
  chartType: '1d' | '1h' | '1m' | '1s' = '1h',
  mode: 'no_fill' | 'padding' = 'padding',
  percentMode: 'beginning' | 'previous' = 'beginning',
  count: number = 20,
  from?: number,
  to?: number
): Promise<TokenHolderChartItem[]> {
  const url = new URL('/token/v1/holder/chart', 'https://public-api.birdeye.so');
  url.searchParams.set('token_address', tokenAddress);
  url.searchParams.set('chart_type', chartType);
  url.searchParams.set('mode', mode);
  url.searchParams.set('percent_mode', percentMode);
  url.searchParams.set('count', count.toString());
  
  if (from !== undefined) url.searchParams.set('from', from.toString());
  if (to !== undefined) url.searchParams.set('to', to.toString());
  
  return birdeye.fetch<TokenHolderChartItem[]>(url.pathname + url.search);
}

export interface TokenTagHoldingChartPoint {
  total_holder: number;
  total_holding: number;
  time: number;
}

export interface TokenTagHoldingsChartResponse {
  bundler?: TokenTagHoldingChartPoint[];
  sniper?: TokenTagHoldingChartPoint[];
  [key: string]: TokenTagHoldingChartPoint[] | undefined;
}

export async function getTokenTagHoldingsChart(
  tokenAddress: string,
  chartType: '1d' | '1h' | '1m' = '1d',
  tagType?: ('bundler' | 'sniper')[],
  from?: number,
  to?: number
): Promise<TokenTagHoldingsChartResponse> {
  const url = new URL('/token/v1/chart/tag-holdings', 'https://public-api.birdeye.so');
  url.searchParams.set('token_address', tokenAddress);
  url.searchParams.set('chart_type', chartType);
  
  if (tagType && tagType.length > 0) {
    url.searchParams.set('tag_type', tagType.join(','));
  }
  
  if (from !== undefined) url.searchParams.set('time_from', from.toString());
  if (to !== undefined) url.searchParams.set('time_to', to.toString());
  
  return birdeye.fetch<TokenTagHoldingsChartResponse>(url.pathname + url.search);
}

export interface TokenFirstBuyer {
  wallet_address: string;
  block_number: number;
  block_unix_time: number;
  first_buy_volume: number;
  first_buy_volume_usd: number;
  total_buy_volume: number;
  total_buy_volume_usd: number;
  initial_holding: number;
  current_holding: number;
  position_status: 'buy_more' | 'hold' | 'sell_partial' | 'sell_all';
  tags: ('bundler' | 'sniper' | 'insider' | 'dev' | 'smart_trader')[];
}

export interface TokenFirstBuyersResponse {
  token_address: string;
  flow: 'buy';
  page_summary: {
    total_wallets: number;
    buy_more: number;
    hold: number;
    sell_partial: number;
    sell_all: number;
  };
  buyers: TokenFirstBuyer[];
}

export async function getTokenFirstBuyers(
  tokenAddress: string,
  offset: number = 0,
  limit: number = 70
): Promise<TokenFirstBuyersResponse> {
  const url = new URL('/token/v1/first-buyers', 'https://public-api.birdeye.so');
  url.searchParams.set('token_address', tokenAddress);
  url.searchParams.set('offset', offset.toString());
  url.searchParams.set('limit', limit.toString());
  
  return birdeye.fetch<TokenFirstBuyersResponse>(url.pathname + url.search);
}

export interface WalletTagsTrackerBucket {
  unix_time: number;
  volume_buy: number;
  volume_sell: number;
  volume_buy_usd: number;
  volume_sell_usd: number;
  wallet_buy_count: number;
  wallet_sell_count: number;
  tx_buy_count: number;
  tx_sell_count: number;
}

export interface TokenWalletTagsTrackerResponse {
  token_address: string;
  time_frame: string;
  groups: {
    tags?: Record<string, WalletTagsTrackerBucket[]>;
    tag_combinations?: Record<string, WalletTagsTrackerBucket[]>;
    top_10_holder?: WalletTagsTrackerBucket[];
  };
  has_more: boolean;
  next_time_from?: number;
}

export async function getTokenWalletTagsTracker(
  tokenAddress: string,
  timeFrom: number,
  timeTo?: number,
  timeFrame: string = '1D',
  tags?: ('dev' | 'sniper' | 'smart_trader')[],
  top10Holder: boolean = false,
  includeTagCombinations: boolean = false
): Promise<TokenWalletTagsTrackerResponse> {
  const url = new URL('/token/v1/wallet-tags-tracker', 'https://public-api.birdeye.so');
  url.searchParams.set('token_address', tokenAddress);
  url.searchParams.set('time_from', timeFrom.toString());
  
  if (timeTo) url.searchParams.set('time_to', timeTo.toString());
  url.searchParams.set('time_frame', timeFrame);
  
  if (tags && tags.length > 0) {
    url.searchParams.set('tags', tags.join(','));
  }
  
  url.searchParams.set('top_10_holder', top10Holder.toString());
  url.searchParams.set('include_tag_combinations', includeTagCombinations.toString());
  
  return birdeye.fetch<TokenWalletTagsTrackerResponse>(url.pathname + url.search);
}

export interface WalletTagsTrackerDetailWallet {
  wallet: string;
  volume_buy: number;
  volume_sell: number;
  volume_buy_usd: number;
  volume_sell_usd: number;
  tx_buy_count: number;
  tx_sell_count: number;
  tags: ('dev' | 'sniper' | 'smart_trader')[];
  is_top_10_holder?: boolean;
}

export interface WalletTagsTrackerDetailBucket {
  unix_time: number;
  wallets: WalletTagsTrackerDetailWallet[];
}

export interface TokenWalletTagsTrackerDetailsResponse {
  token_address: string;
  time_frame: string;
  items: WalletTagsTrackerDetailBucket[];
  has_more: boolean;
  next_time_from?: number;
}

export async function getTokenWalletTagsTrackerDetails(
  tokenAddress: string,
  timeFrom: number,
  timeFrame: string,
  timeTo?: number,
  tags?: ('dev' | 'sniper' | 'smart_trader')[],
  wallets?: string[],
  minVolumeUsd: number = 0,
  top10Holder: boolean = false,
  limitWallet: number = 10,
  limitBucket: number = 300
): Promise<TokenWalletTagsTrackerDetailsResponse> {
  const url = new URL('/token/v1/wallet-tags-tracker/details', 'https://public-api.birdeye.so');
  url.searchParams.set('token_address', tokenAddress);
  url.searchParams.set('time_from', timeFrom.toString());
  url.searchParams.set('time_frame', timeFrame);
  
  if (timeTo) url.searchParams.set('time_to', timeTo.toString());
  
  if (tags && tags.length > 0) {
    url.searchParams.set('tags', tags.join(','));
  }
  
  if (wallets && wallets.length > 0) {
    url.searchParams.set('wallets', wallets.join(','));
  }
  
  url.searchParams.set('min_volume_usd', minVolumeUsd.toString());
  url.searchParams.set('top_10_holder', top10Holder.toString());
  url.searchParams.set('limit_wallet', limitWallet.toString());
  url.searchParams.set('limit_bucket', limitBucket.toString());
  
  return birdeye.fetch<TokenWalletTagsTrackerDetailsResponse>(url.pathname + url.search);
}
