export interface NansenPagination {
  page: number;
  per_page: number;
  is_last_page: boolean;
}

export interface NansenRateLimitStatus {
  creditsRemaining: number | null;
  creditsLastCost: number | null;
  creditsLastUsed: number | null;
  rateLimitRemaining: number | null;
  coolingDown: boolean;
  insufficientCredits: boolean;
  authFailed: boolean;
}

export interface NansenAccountInfo {
  plan?: string;
  tier?: string;
  credits_remaining?: number;
  credits_limit?: number;
  [key: string]: unknown;
}

export interface NansenSmartMoneyNetflowItem {
  token_address: string;
  token_symbol: string;
  net_flow_1h_usd: number;
  net_flow_24h_usd: number;
  net_flow_7d_usd: number;
  net_flow_30d_usd: number;
  chain: string;
  token_sectors: string[];
  trader_count: number;
  token_age_days: number;
  market_cap_usd?: number | null;
}

export interface NansenSmartMoneyHoldingItem {
  chain: string;
  token_address: string;
  token_symbol: string;
  token_sectors: string[];
  value_usd?: number | null;
  balance_24h_percent_change?: number | null;
  holders_count: number;
  share_of_holdings_percent?: number | null;
  token_age_days: number;
  market_cap_usd?: number | null;
}

export interface NansenSmartMoneyDexTradeItem {
  chain: string;
  block_timestamp: string;
  transaction_hash: string;
  trader_address: string;
  trader_address_label: string;
  token_bought_address: string;
  token_sold_address: string;
  token_bought_amount?: number | null;
  token_sold_amount?: number | null;
  token_bought_symbol: string;
  token_sold_symbol: string;
  token_bought_age_days: number;
  token_sold_age_days: number;
  token_bought_market_cap?: number | null;
  token_sold_market_cap?: number | null;
  token_bought_fdv?: number | null;
  token_sold_fdv?: number | null;
  trade_value_usd?: number | null;
}

export interface NansenSmartMoneyPnlLeaderboardItem {
  address: string;
  address_label?: string | null;
  realized_pnl_usd: number;
  unrealized_pnl_usd: number;
  total_pnl_usd: number;
  avg_trade_roi?: number | null;
  roi_percent_unrealised?: number | null;
  win_rate?: number | null;
  n_trades: number;
  n_tokens: number;
  open_trades: number;
  held_tokens_count: number;
  top_traded_tokens_info?: Array<Record<string, unknown>>;
  top_5_balance_tokens_info?: Array<Record<string, unknown>>;
}

export interface NansenTokenScreenerItem {
  chain: string;
  token_address: string;
  token_symbol: string;
  token_age_days?: number | null;
  token_age_hours?: number | null;
  token_deployment_date?: string | null;
  market_cap_usd?: number | null;
  liquidity?: number | null;
  price_usd?: number | null;
  price_change?: number | null;
  fdv?: number | null;
  fdv_mc_ratio?: number | null;
  buy_volume?: number | null;
  sell_volume?: number | null;
  volume?: number | null;
  netflow?: number | null;
  inflow_fdv_ratio?: number | null;
  outflow_fdv_ratio?: number | null;
  nof_traders?: number | null;
  nof_buyers?: number | null;
  nof_sellers?: number | null;
  nof_buys?: number | null;
  nof_sells?: number | null;
}

export interface NansenTgmFlowIntelligenceItem {
  smart_trader_net_flow_usd?: number | null;
  smart_trader_avg_flow_usd?: number | null;
  smart_trader_wallet_count?: number | null;
  top_pnl_net_flow_usd?: number | null;
  top_pnl_avg_flow_usd?: number | null;
  top_pnl_wallet_count?: number | null;
  whale_net_flow_usd?: number | null;
  whale_avg_flow_usd?: number | null;
  whale_wallet_count?: number | null;
  public_figure_net_flow_usd?: number | null;
  public_figure_avg_flow_usd?: number | null;
  public_figure_wallet_count?: number | null;
  exchange_net_flow_usd?: number | null;
  exchange_avg_flow_usd?: number | null;
  exchange_wallet_count?: number | null;
  fresh_wallets_net_flow_usd?: number | null;
  fresh_wallets_avg_flow_usd?: number | null;
  fresh_wallets_wallet_count?: number | null;
}

export interface NansenTgmWhoBoughtSoldItem {
  address: string;
  address_label?: string | null;
  bought_token_volume?: number | null;
  sold_token_volume?: number | null;
  token_trade_volume?: number | null;
  bought_volume_usd?: number | null;
  sold_volume_usd?: number | null;
  trade_volume_usd?: number | null;
  net_token_volume?: number | null;
  net_volume_usd?: number | null;
}

export interface NansenTgmDexTradeItem {
  block_timestamp: string;
  transaction_hash: string;
  trader_address: string;
  trader_address_label?: string | null;
  action: 'BUY' | 'SELL';
  token_address: string;
  token_name: string;
  token_amount: number;
  traded_token_address: string;
  traded_token_name: string;
  traded_token_amount: number;
  estimated_swap_price_usd: number;
  estimated_value_usd: number;
}

export interface NansenTgmHolderItem {
  address?: string | null;
  address_label?: string | null;
  token_amount?: number | null;
  total_outflow?: number | null;
  total_inflow?: number | null;
  balance_change_24h?: number | null;
  balance_change_7d?: number | null;
  balance_change_30d?: number | null;
  ownership_percentage?: number | null;
  value_usd?: number | null;
}

export type NansenRadarView =
  | 'screener'
  | 'netflow'
  | 'holdings'
  | 'dex-trades'
  | 'leaderboard';

export type NansenTokenDetailLevel = 'core' | 'trades' | 'holders';

export type NansenTgmTimeframe = '5m' | '1h' | '6h' | '12h' | '1d' | '7d';

export interface NansenTokenSmartMoneyResponse {
  configured: boolean;
  chain: string;
  tokenAddress: string;
  timeframe: NansenTgmTimeframe;
  detail: NansenTokenDetailLevel;
  nativeRestricted: boolean;
  dexTradesRestricted: boolean;
  flowIntelligence: NansenTgmFlowIntelligenceItem | null;
  smartBuyers: NansenTgmWhoBoughtSoldItem[];
  smartSellers: NansenTgmWhoBoughtSoldItem[];
  dexTrades: NansenTgmDexTradeItem[];
  smartHolders: NansenTgmHolderItem[];
  rateLimit: NansenRateLimitStatus;
  fetchedAt: string;
}

export interface NansenSmartMoneyRadarResponse {
  configured: boolean;
  chain: string;
  view: NansenRadarView;
  timeframe: string;
  screener: NansenTokenScreenerItem[];
  netflows: NansenSmartMoneyNetflowItem[];
  holdings: NansenSmartMoneyHoldingItem[];
  dexTrades: NansenSmartMoneyDexTradeItem[];
  leaderboard: NansenSmartMoneyPnlLeaderboardItem[];
  pagination: NansenPagination | null;
  rateLimit: NansenRateLimitStatus;
  fetchedAt: string;
}
