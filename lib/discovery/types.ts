export type TimeWindow = '1m' | '5m' | '15m' | '1h' | '4h' | '24h';

export type DiscoverySection =
  | 'trending'
  | 'new'
  | 'migrating'
  | 'graduated'
  /** High organic-score tokens — Jupiter's own wash-vs-genuine measurement. */
  | 'hot'
  | 'momentum'
  | 'volume'
  | 'liquidity'
  | 'movers'
  | 'watchlist'
  | 'smart-money'
  | 'ai-picks'
  | 'top-gainers'
  | 'top-losers'
  | 'personalized';

export interface SignalResult {
  signalName: string;
  score: number; // 0 - 100
  weight: number;
  confidence: number; // 0.0 - 1.0
  rawInput: string | number;
  explanation: string;
  timestamp: string;
}

export interface DiscoveryScore {
  totalScore: number; // Normalized 0 - 100
  confidence: number; // 0.0 - 1.0
  grade: 'CRITICAL_SIGNAL' | 'HIGH_SIGNAL' | 'MODERATE_SIGNAL' | 'LOW_SIGNAL';
  factors: {
    volumeAcceleration: number;
    transactionAcceleration: number;
    liquidityChange: number;
    buySellImbalance: number;
    holderGrowth: number;
    recency: number;
    priceVelocity: number;
  };
  rawInputs: {
    ageMinutes: number;
    priceChangeWindow: number;
    volumeWindowUsd: number;
    volumeAccelerationPct: number;
    liquidityChangePct: number;
    buysCount: number;
    sellsCount: number;
    holdersCount: number;
    holderGrowthPct: number;
    buySellImbalancePct: number;
    buyPressureRatio: number;
    txAccelerationPct: number;
    isNewToken: boolean;
  };
  signals: SignalResult[];
  explanations: string[];
  calculatedAt: string;
}

export interface DiscoveryToken {
  id: string;
  name: string;
  symbol: string;
  mint: string;
  chain: string;
  source: 'Pump.fun' | 'Raydium' | 'Meteora' | 'Orca';
  logoURI?: string;
  ageMinutes: number;
  ageFormatted: string;
  priceUsd: string;
  priceChange1m: number;
  priceChange5m: number;
  priceChange15m: number;
  priceChange1h: number;
  priceChange24h: number;
  volume5mUsd: string;
  volume1hUsd: string;
  volume24hUsd: string;
  volumeChange15mPct: number;
  liquidityUsd: string;
  liquidityChange1hPct: number;
  marketCapUsd: string;
  buysCount: number;
  sellsCount: number;
  txCount15m: number;
  txCount1h: number;
  buySellImbalancePct: number;
  buyPressureRatio: number;
  txAccelerationPct: number;
  isNewToken: boolean;
  /**
   * Optional because it is genuinely unknown for many tokens.
   *
   * These were previously required, which forced every code path to supply a
   * number — and the live feed obliged by deriving them from the token's index
   * in the response array (`Math.floor(65 + rankIdx * 28)`). A required field
   * with no real source guarantees invention; `undefined` renders as `—`.
   */
  holdersCount?: number;
  holderGrowth1hPct?: number;
  /**
   * True while the ownership audit for this token is still being computed.
   *
   * Lets a row render immediately and its audit fields fill in behind it, with
   * the two states visibly different — a pending value must not look like one
   * that will never arrive.
   */
  auditPending?: boolean;
  /**
   * How many simultaneous launches this row represents.
   *
   * A burst of identical name/symbol deploys seconds apart is itself a signal —
   * measured at ten copies of one name inside a single 30-row response — so the
   * count is surfaced rather than the duplicates being silently discarded.
   */
  duplicateCount?: number;
  discoveryScore: DiscoveryScore;

  // Pro-Terminal & Trenches Metrics
  migrationProgress?: number; // 0 - 100 (%)
  bondingStatus?: 'bonding' | 'migrating' | 'graduated';
  devHoldingsPct?: number;
  top10HoldingsPct?: number;
  insiderHoldingsPct?: number;
  sniperPercentage?: number;
  bundlerPercentage?: number;
  riskScore?: number; // 0 - 100
  riskTier?: 'low' | 'medium' | 'high' | 'critical';
  isMintRenounced?: boolean;
  isLiquidityLocked?: boolean;
  isFreezeDisabled?: boolean;
  aiSignalScore?: number; // 0 - 100
  aiSignalLabel?: 'Bullish' | 'Neutral' | 'Bearish' | 'Breakout';
  aiSignalReason?: string;
  smartMoneyCount?: number;
  smartMoneyNetFlowUsd?: number;
  twitterUrl?: string;
  telegramUrl?: string;
  websiteUrl?: string;
  userPositionSol?: number;
  userPositionTokens?: number;
}

export interface DiscoveryFilter {
  section: DiscoverySection;
  /**
   * Include launches with zero liquidity. Off by default: a token with no pool
   * cannot be traded, and 12 of 30 rows in a measured response were these.
   */
  includeZeroLiquidity?: boolean;
  timeWindow: TimeWindow;
  chain: string;
  searchQuery?: string;
  minLiquidityUsd?: number;
  minVolumeUsd?: number;

  // Range Filters
  marketCapMin?: number;
  marketCapMax?: number;
  liquidityMin?: number;
  liquidityMax?: number;
  volumeMin?: number;
  volumeMax?: number;
  ageMinutesMin?: number;
  ageMinutesMax?: number;
  priceChangeMin?: number;
  priceChangeMax?: number;
  volumeChangeMin?: number;
  volumeChangeMax?: number;
  holdersMin?: number;
  holdersMax?: number;
  discoveryScoreMin?: number;
  discoveryScoreMax?: number;

  // Distribution & Safety Filters
  top10HoldingsMax?: number;
  devHoldingsMax?: number;
  snipersMax?: number;
  insidersMax?: number;
  minRiskScore?: number;
  mintRenouncedOnly?: boolean;
  liquidityLockedOnly?: boolean;
  launchpads?: string[];

  // Activity Intelligence Filters
  organicVolumeMin?: number;     // 0 - 100
  top5VolumeShareMax?: number;  // 0.0 - 1.0
  noCoordinatedSignals?: boolean;
  creatorReputation?: number;  // 0 - 100
  insiderRisk?: number;       // 0 - 100
  ownershipConcentration?: number; // 0 - 100
  organicVolume?: number;     // 0 - 100
  exitability?: number;       // 0 - 100
  liquidityLock?: boolean;    // locked/unlocked
  contractRisk?: number;      // 0 - 100
}

export type ColumnSortOption =
  | 'newest'
  | 'oldest'
  | 'volume'
  | 'volume-accel'
  | 'liquidity'
  | 'market-cap'
  | 'price-change'
  | 'tx-count'
  | 'buy-pressure'
  | 'migration-progress'
  | 'score'
  | 'risk';

export interface DiscoveryColumnConfig {
  id: string;
  type: DiscoverySection;
  title: string;
  icon?: string;
  sortBy?: ColumnSortOption;
  sortDirection?: 'asc' | 'desc';
  filters?: Partial<DiscoveryFilter>;
  customQuickBuySol?: number;
  isCollapsed?: boolean;
}

export interface QuickBuySettings {
  presetsSol: number[]; // e.g. [0.05, 0.1, 0.5, 1.0]
  presetsUsd: number[]; // e.g. [10, 25, 50, 100]
  mode: 'sol' | 'usd';
  defaultSlippageBps: number; // e.g. 100 (1%)
  autoApproveSmallTrades: boolean;
}
