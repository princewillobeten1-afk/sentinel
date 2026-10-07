export type NarrativeCategory =
  | 'AI Agents & Bots'
  | 'Cult Memes & Internet Lore'
  | 'Viral TikTok & Reels'
  | 'Animals & Mascots'
  | 'Political Satire & News'
  | 'Gaming & Anime Culture'
  | 'Community Takeovers (CTO)'
  | 'DeSci & Bio-Memes'
  | 'Abstract Degen Metas';

export type RunnerBadgeVariant = 'og' | 'secondary' | 'copycat';

export interface RunnerInfo {
  mint: string;
  symbol: string;
  name: string;
  runnerRank: number; // 1 = First Runner (OG), 2 = Runner #2, etc.
  marketCapUsd?: number;
  pairCreatedAt?: number;
  isCurrent: boolean;
  statusLabel: string;
  dexId?: string;
}

export interface RunnerStatus {
  isFirstRunner: boolean;
  runnerRank: number;
  badgeLabel: string; // e.g. "FIRST RUNNER (OG)", "RUNNER #2 (SECONDARY)", "COPYCAT DERIVATIVE"
  badgeVariant: RunnerBadgeVariant;
  confidenceScore: number; // 0 - 100
  totalRunnersInCohort: number;
  ogMint?: string;
  ogSymbol?: string;
  ogPairCreatedAt?: number;
  timeDeltaAfterOgSec?: number;
  flippedOg?: boolean;
  explanation: string;
}

export interface OriginSpark {
  source: 'X / Twitter' | 'TikTok' | 'Reddit' | 'Mainstream News' | 'Pump.fun Community' | 'AI Model Output';
  creatorHandle?: string;
  creatorName?: string;
  sparkDate?: string;
  sparkUrl?: string;
  sparkQuote?: string;
}

export interface TokenLoreData {
  mint: string;
  symbol: string;
  name: string;
  headline: string;
  narrativeCategory: NarrativeCategory;
  categoryThemeColor: string; // e.g. 'purple', 'emerald', 'sky', 'amber', 'rose'
  runnerStatus: RunnerStatus;
  loreSummary: string;
  originSpark: OriginSpark;
  whyItsFlying: string[];
  viralityScore: number; // 0 - 100
  sentiment: 'BULLISH_CULT' | 'VIRAL_SURGE' | 'COMMUNITY_TAKEOVER' | 'HIGH_MOMENTUM' | 'SPECULATIVE_RUNNER';
  otherRunners: RunnerInfo[];
  communityVibe: {
    conviction: 'EXTREME' | 'HIGH' | 'MODERATE' | 'SPECULATIVE';
    narrativeMoat: 'UNSHAKABLE_PIONEER' | 'STRONG_META' | 'RISING_CHALLENGER' | 'FAST_COPYCAT';
    keyThemes: string[];
  };
  aiAnalysis?: string;
  generatedAt: string;
}
