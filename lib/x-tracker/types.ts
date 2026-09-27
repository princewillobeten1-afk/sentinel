export type XLaunchpad = 'pump.fun' | 'raydium' | 'moonshot' | 'meteora' | 'unknown';
export type XCallCategory = 'all' | 'kol' | 'trending' | 'mylist';

export interface XTokenSummary {
  mint: string;
  symbol: string;
  name: string;
  avatarUrl: string;
  chain: 'solana';
  launchpad: XLaunchpad;
  priceUsd: number;
  marketCapUsd: number;
  liquidityUsd?: number;
}

export interface XCallerProfile {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  isVerified: boolean;
  followers?: number;
  walletAddress?: string;
  winRate?: number;
  averageMultiplier?: number;
}

export interface XPostMetrics {
  likes: number;
  replies: number;
  retweets: number;
}

export interface XCallMetrics {
  entryMcap: number;
  currentMcap: number;
  positionSizeUsd: number;
  pnlPercent: number;
  multiplier: number;
  peakMultiplier?: number;
}

export interface XTrackerCall {
  id: string;
  token: XTokenSummary;
  caller: XCallerProfile;
  text: string;
  tweetUrl: string;
  createdAt: number; // unix timestamp ms
  relativeTime: string; // e.g. "2s", "3s", "1m"
  metrics: XCallMetrics;
  socialMetrics: XPostMetrics;
  isKOL: boolean;
  isTrending: boolean;
  highlightWords?: string[];
}

export interface XTrackerFilter {
  category: XCallCategory;
  searchQuery?: string;
  minMcap?: number;
  maxMcap?: number;
  minPnl?: number;
  verifiedOnly?: boolean;
}

export interface XTrackerStats {
  totalCallsToday: number;
  averageMultiplier: number;
  bestPerformingMultiplier: number;
  topCaller: {
    handle: string;
    name: string;
    winRate: number;
  };
  lastUpdatedAt: number;
}
