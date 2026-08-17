import { birdeye } from './client';

export interface WalletPortfolioItem {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  logoURI: string;
  balance: number;
  uiAmount: number;
  priceUsd: number;
  valueUsd: number;
}

export interface WalletPortfolio {
  wallet: string;
  totalUsd: number;
  items: WalletPortfolioItem[];
}

export async function getWalletPortfolio(walletAddress: string): Promise<WalletPortfolio> {
  const response = await birdeye.fetch<{ totalUsd: number; items: WalletPortfolioItem[] }>(
    `/v1/wallet/token_list?wallet=${walletAddress}`
  );
  return {
    wallet: walletAddress,
    totalUsd: response.totalUsd,
    items: response.items || []
  };
}

export interface WalletPnLSummary {
  wallet: string;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  winRate: number;
  tradeCount: number;
  volumeUsd: number;
}

export async function getWalletPnL(walletAddress: string): Promise<WalletPnLSummary> {
  // Using the V2 PnL endpoint
  return birdeye.fetch<WalletPnLSummary>(`/defi/v2/wallet/pnl_summary?wallet=${walletAddress}`);
}

export interface TopTrader {
  address: string;
  pnl: number;
  volume: number;
  tradeCount: number;
  winRate: number;
}

export async function getTokenTopTraders(tokenAddress: string, limit: number = 10): Promise<TopTrader[]> {
  const response = await birdeye.fetch<{ items: TopTrader[] }>(
    `/defi/v2/tokens/top_traders?address=${tokenAddress}&limit=${limit}`
  );
  return response.items;
}

// Helper to build query strings
function buildQueryString(params: Record<string, any>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => query.append(key, String(v)));
      } else {
        query.append(key, String(value));
      }
    }
  }
  return query.toString();
}

// Interfaces for V2 endpoints

export interface WalletTokenHoldingV2 {
  address?: string;
  decimals?: number;
  balance?: number | string;
  uiAmount?: number;
  chainId?: string;
  network?: string;
  name?: string;
  symbol?: string;
  icon?: string;
  logoURI?: string;
  logo_uri?: string;
  priceUsd?: number;
  price?: number;
  valueUsd?: number;
  value?: number | string;
  amount?: number;
  isScaledUiToken?: boolean;
  multiplier?: number | null;
}

export interface WalletCurrentNetWorthResponse {
  wallet_address: string;
  currency: string;
  total_value: number | string;
  current_timestamp: string;
  items: WalletTokenHoldingV2[];
}

export interface WalletNetWorthHistoryItem {
  timestamp: string;
  net_worth: number | string;
  net_worth_change: number | string;
  net_worth_change_percent: number | string;
}

export interface WalletNetWorthHistoryResponse {
  wallet_address: string;
  currency: string;
  current_timestamp: string;
  past_timestamp: string;
  history: WalletNetWorthHistoryItem[];
}

export interface MultipleNetworthSummaryResponse {
  currency: string;
  current_timestamp: string;
  wallets: Record<string, { value: number | string }>;
}

export interface WalletNetWorthDetailAsset {
  symbol?: string;
  token_address?: string;
  decimal?: number;
  balance?: number | string;
  price?: number | string;
  value?: number | string;
}

export interface WalletNetWorthDetailResponse {
  wallet_address: string;
  currency: string;
  net_worth: number;
  requested_timestamp: string;
  resolved_timestamp: string;
  net_assets: WalletNetWorthDetailAsset[];
}

export interface WalletPnlSummaryResponse {
  summary: {
    unique_tokens?: number;
    counts?: {
      total_buy?: number | string;
      total_sell?: number | string;
      total_trade?: number | string;
      total_win?: number | string;
      total_loss?: number | string;
      win_rate?: number | string;
    };
    cashflow_usd?: {
      total_invested?: number | string;
      total_sold?: number | string;
      current_value?: number | string;
    };
    pnl?: {
      realized_profit_usd?: number | string;
      realized_profit_percent?: number | string;
      unrealized_usd?: number | string;
      total_usd?: number | string;
      avg_profit_per_trade_usd?: number | string;
    };
  };
}

export interface WalletPnlToken {
  symbol?: string;
  decimals?: number;
  address?: string;
  counts?: {
    total_buy?: number | string;
    total_sell?: number | string;
    total_trade?: number | string;
    total_win?: number | string;
    total_loss?: number | string;
    win_rate?: number | string;
  };
  quantity?: {
    total_bought_amount?: number | string;
    total_sold_amount?: number | string;
    holding?: number | string;
  };
  cashflow_usd?: {
    cost_of_quantity_sold?: number | string;
    total_invested?: number | string;
    total_sold?: number | string;
    current_value?: number | string;
  };
  pnl?: {
    realized_profit_usd?: number | string;
    realized_profit_percent?: number | string;
    unrealized_usd?: number | string;
    unrealized_percent?: number | string;
    total_usd?: number | string;
    total_percent?: number | string;
    avg_profit_per_trade_usd?: number | string;
  };
  pricing?: {
    current_price?: number | null;
    avg_buy_cost?: number | null;
    avg_sell_cost?: number | null;
  };
}

export interface WalletPnlDetailsResponse {
  meta: {
    address: string;
    currency: string;
    holding_check: boolean;
    time: string;
  };
  tokens: WalletPnlToken[];
  summary: WalletPnlSummaryResponse['summary'];
}

export interface WalletPnlPerTokenResponse {
  meta: {
    address: string;
    currency: string;
    holding_check: boolean;
    time: string;
  };
  tokens: Record<string, WalletPnlToken>;
}

export interface MultipleWalletPnlResponse {
  token_metadata: {
    symbol: string;
    decimals: number;
  };
  data: Record<string, Omit<WalletPnlToken, 'symbol' | 'decimals' | 'address'>>;
}

export interface WalletTxFirstFundedResponse {
  [walletAddress: string]: {
    tx_hash: string;
    block_unix_time: number;
    block_number: number;
    balance_change: string | number;
    token_address: string;
    token_decimals: number;
  };
}


// Endpoints

// Wallet - Portfolio (V2)
export async function getWalletPortfolioV2(
  wallet: string,
  params: {
    filter_value?: number;
    sort_by?: 'value';
    sort_type?: 'asc' | 'desc';
    flags?: ('include_low_liquidity')[];
    limit?: number;
    offset?: number;
  } = {}
): Promise<WalletCurrentNetWorthResponse> {
  const sort_type = params.sort_type || 'desc';
  const queryString = buildQueryString({ wallet, ...params, sort_type });
  return birdeye.fetch<WalletCurrentNetWorthResponse>(`/wallet/v2/current-net-worth?${queryString}`);
}

// Wallet - Net Worth Chart
export async function getWalletNetWorthChart(
  wallet: string,
  params: {
    count?: number;
    direction?: 'back' | 'forward';
    time?: string;
    type?: '1h' | '1d';
    sort_type?: 'asc' | 'desc';
  } = {}
): Promise<WalletNetWorthHistoryResponse> {
  const sort_type = params.sort_type || 'desc';
  const queryString = buildQueryString({ wallet, ...params, sort_type });
  return birdeye.fetch<WalletNetWorthHistoryResponse>(`/wallet/v2/net-worth?${queryString}`);
}

// Wallet - Current Net Worth Summary (Multiple)
export async function getWalletNetWorthSummaryMultiple(
  wallets: string[]
): Promise<MultipleNetworthSummaryResponse> {
  return birdeye.fetch<MultipleNetworthSummaryResponse>(`/wallet/v2/net-worth-summary/multiple`, {
    method: 'POST',
    body: JSON.stringify({ wallets })
  });
}

// Wallet - Net Worth Details
export async function getWalletNetWorthDetails(
  wallet: string,
  params: {
    time?: string;
    type?: '1h' | '1d';
    sort_type?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  } = {}
): Promise<WalletNetWorthDetailResponse> {
  const sort_type = params.sort_type || 'desc';
  const queryString = buildQueryString({ wallet, ...params, sort_type });
  return birdeye.fetch<WalletNetWorthDetailResponse>(`/wallet/v2/net-worth-details?${queryString}`);
}

// Wallet - PnL
export async function getWalletPnlSummary(
  wallet: string,
  params: {
    duration?: 'all' | '90d' | '30d' | '7d' | '24h';
    position_scope?: 'duration_only' | 'cumulative';
    chain?: string;
  } = {}
): Promise<WalletPnlSummaryResponse> {
  const { chain, ...restParams } = params;
  const queryString = buildQueryString({ wallet, ...restParams });
  
  const options: RequestInit = {};
  if (chain) {
    options.headers = { 'x-chain': chain };
  }
  
  return birdeye.fetch<WalletPnlSummaryResponse>(`/wallet/v2/pnl/summary?${queryString}`, options);
}

// Wallet - PnL Details
export async function getWalletPnlDetails(
  wallet: string,
  params: {
    token_addresses?: string[];
    duration?: 'all' | '90d' | '30d' | '7d' | '24h';
    position_scope?: 'duration_only' | 'cumulative';
    sort_type?: 'asc' | 'desc';
    sort_by?: 'last_trade';
    limit?: number;
    offset?: number;
    chain?: string;
  } = {}
): Promise<WalletPnlDetailsResponse> {
  const { chain, ...bodyParams } = params;
  const body = { wallet, ...bodyParams };
  
  const options: RequestInit = {
    method: 'POST',
    body: JSON.stringify(body)
  };
  if (chain) {
    options.headers = { 'x-chain': chain };
  }
  
  return birdeye.fetch<WalletPnlDetailsResponse>(`/wallet/v2/pnl/details`, options);
}

// Wallet - PnL (Per Token)
export async function getWalletPnlPerToken(
  wallet: string,
  token_addresses: string,
  chain?: string
): Promise<WalletPnlPerTokenResponse> {
  const queryString = buildQueryString({ wallet, token_addresses });
  const options: RequestInit = {};
  if (chain) {
    options.headers = { 'x-chain': chain };
  }
  
  return birdeye.fetch<WalletPnlPerTokenResponse>(`/wallet/v2/pnl?${queryString}`, options);
}

// Wallet - PnL (Per Wallet)
export async function getWalletPnlPerWallet(
  token_address: string,
  wallets: string,
  chain?: string
): Promise<MultipleWalletPnlResponse> {
  const queryString = buildQueryString({ token_address, wallets });
  const options: RequestInit = {};
  if (chain) {
    options.headers = { 'x-chain': chain };
  }
  
  return birdeye.fetch<MultipleWalletPnlResponse>(`/wallet/v2/pnl/multiple?${queryString}`, options);
}

// Wallet - First Tx Funded
export async function getWalletFirstTxFunded(
  wallets: string[],
  token_address?: string
): Promise<WalletTxFirstFundedResponse> {
  const body: any = { wallets };
  if (token_address) {
    body.token_address = token_address;
  }
  
  return birdeye.fetch<WalletTxFirstFundedResponse>(`/wallet/v2/tx/first-funded`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

