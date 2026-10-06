export type LiveAlertType =
  | 'CALL'
  | 'WHALE_TRADE'
  | 'SMART_MONEY'
  | 'INSIDER_ACTIVITY'
  | 'DEV_ACTIVITY'
  | 'LAUNCHPAD_MILESTONE'
  | 'RISK_ALERT';

export type LiveAlertCategory =
  | 'all'
  | 'calls'
  | 'trades'
  | 'smart_money'
  | 'insiders'
  | 'developers'
  | 'launchpad'
  | 'risks';

export type LiveAlertLaunchpad = 'pump.fun' | 'raydium' | 'moonshot' | 'meteora' | 'unknown';

export interface LiveAlertToken {
  mint: string;
  symbol: string;
  name: string;
  avatarUrl?: string;
  priceUsd: number;
  marketCapUsd: number;
  launchpad: LiveAlertLaunchpad;
  priceChange24h?: number;
  liquidityUsd?: number;
}

export interface LiveAlertCaller {
  id: string;
  name: string;
  handle: string;
  channelName?: string;
  avatarUrl?: string;
  isVerified: boolean;
  winRate?: number; // e.g. 78.5 for 78.5%
  avgMultiplier?: number; // e.g. 4.2 for 4.2x
  totalCalls?: number;
  sourceUrl?: string;
}

export interface LiveAlertTrade {
  traderAddress: string;
  traderLabel?: string; // e.g. "Top 10 PnL Whale", "Smart Sniper"
  direction: 'BUY' | 'SELL' | 'TRANSFER';
  amountSol: number;
  amountUsd: number;
  tokenAmount?: number;
  winRate30d?: number;
  pnl30dUsd?: number;
  txSignature?: string;
  isSniper?: boolean;
}

export interface LiveAlertMilestone {
  type: 'KOTH' | 'MIGRATION' | 'CURVE_PROGRESS' | 'VOLUME_SPIKE';
  curvePercent?: number; // 0 - 100
  rank?: number;
  description: string;
}

export interface LiveAlertRisk {
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  reason: string;
  devHoldingsPercent?: number;
  isHoneypot?: boolean;
  isMintable?: boolean;
}

export interface LiveTradeAlert {
  id: string;
  type: LiveAlertType;
  headline: string;
  message: string;
  timestamp: number; // Unix timestamp in ms
  urgency: 'high' | 'medium' | 'normal';
  token: LiveAlertToken;
  caller?: LiveAlertCaller;
  trade?: LiveAlertTrade;
  milestone?: LiveAlertMilestone;
  risk?: LiveAlertRisk;
  quickBuyDefaultSol?: number;
  sourceUrl?: string;
}

export interface LiveAlertFilterConfig {
  category: LiveAlertCategory;
  minSol: number; // 0, 1, 5, 10
  searchQuery?: string;
  verifiedOnly?: boolean;
}

export interface LiveAlertStats {
  callsCount: number;
  whaleBuysCount: number;
  smartMoneyCount: number;
  insiderActivityCount: number;
  devActivityCount: number;
  milestonesCount: number;
  risksCount: number;
  totalAlertsToday: number;
}
