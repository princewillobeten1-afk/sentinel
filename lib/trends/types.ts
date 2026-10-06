export type TrendSource = 'tiktok' | 'x' | 'news' | 'culture' | 'reddit';

export type TrendCategory =
  | 'all'
  | 'meme'
  | 'pop_culture'
  | 'ai'
  | 'politics'
  | 'animals'
  | 'gaming';

export type TrendVelocity = 'exploding' | 'surging' | 'rising' | 'peaking';

export interface TrendToken {
  mint: string;
  symbol: string;
  name: string;
  avatarUrl?: string;
  priceUsd: number;
  priceChange24h: number;
  priceChange1h?: number;
  marketCapUsd: number;
  volume24hUsd: number;
  launchpad: 'pump.fun' | 'raydium' | 'meteora' | 'unknown';
  relationship: string;
}

export interface TrendMetrics {
  impressions?: string;
  postCount?: string;
  growthPct?: number;
  hashtags?: string[];
}

export interface TrendItem {
  id: string;
  title: string;
  source: TrendSource;
  category: TrendCategory;
  viralityScore: number; // 0 - 100
  velocity: TrendVelocity;
  metrics: TrendMetrics;
  summary: string;
  catalyst: string;
  publishedAt: string;
  timeAgo: string;
  sourceUrl?: string;
  associatedToken: TrendToken;
}

export interface TrendStats {
  totalTrends: number;
  topViralityScore: number;
  tiktokCount: number;
  xCount: number;
  newsCount: number;
  cultureCount: number;
  lastUpdated: string;
}
