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

export type EvidenceStatus = 'loading' | 'measured' | 'stale' | 'unavailable';

/** Provenance carried with every independently refreshed card data group. */
export interface MetricEvidence {
  status: EvidenceStatus;
  source: string;
  observedAt: string;
  expiresAt?: string;
  reason?: string;
}

export interface RugRiskEvidence {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  version: string;
  /** Partial means at least one scoring input has not been measured yet. */
  completeness: 'partial' | 'complete';
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
  buysCount5m?: number;
  sellsCount5m?: number;
  buysCount1h?: number;
  sellsCount1h?: number;
  buysCount24h?: number;
  sellsCount24h?: number;
  txCount24h?: number;
  txCount15m: number;
  txCount5m?: number;
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
  marketEvidence?: MetricEvidence;
  /** Provenance for the selected rolling trade/volume window. */
  activityEvidence?: MetricEvidence;
  ownershipEvidence?: MetricEvidence;
  securityEvidence?: MetricEvidence;
  /** Pool-lock provenance is separate from mint-authority evidence. */
  liquidityEvidence?: MetricEvidence;
  creatorEvidence?: MetricEvidence;
  lifecycleEvidence?: MetricEvidence;
  auditVersion?: string;
  rugRisk?: RugRiskEvidence;
  /**
   * The name or symbol carried invisible Unicode and was cleaned at ingest.
   *
   * Bidi overrides and zero-width characters let a token render as a different
   * name than the chain stores — one observed live displaying as a well-known
   * reserve currency. The characters are stripped in `mapJupiterToken`; this
   * flag keeps the attempt visible, because trying it is itself a signal.
   */
  hasDeceptiveName?: boolean;
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
  /**
   * Where a migrated token's liquidity landed, and the proof it did.
   *
   * Populated only for confirmed migrations. The engine has held these since
   * migrations were first detected; the API exposed none of them, so a
   * "migrated" badge could not be checked against anything. With the signature
   * present, a reader can verify the claim on chain.
   */
  migratedPool?: string;
  /** Provider-confirmed pool or bonding-curve venue used to gate Quick Buy. */
  liquidityPoolAddress?: string;
  migratedDex?: string;
  migratedAt?: number;
  migrationSignature?: string;
  /** Canonical bonding curve progress percentage (0 - 100) while in New Pairs / Final Stretch */
  bondingCurveProgress?: number;
  bondingStatus?: 'bonding' | 'migrating' | 'graduated';
  /** Canonical lifecycle state */
  lifecycleState?: 'new_pairs' | 'final_stretch' | 'migrating' | 'migrated';
  devHoldingsPct?: number;
  top10HoldingsPct?: number;
  insiderHoldingsPct?: number;
  sniperPercentage?: number;
  bundlerPercentage?: number;
  /** The creator's wallet, so the dev's holding can be checked independently. */
  devAddress?: string;
  /**
   * The creator's launch history, from Jupiter's audit.
   *
   * A wallet on its 2308th mint and one on its first are very different
   * counterparties, and neither is visible from this token's own metrics. Shown
   * as a fact about the creator; deliberately not folded into `riskScore`,
   * which stays about the token.
   */
  devMints?: number;
  devMigrations?: number;
  /**
   * Jupiter's organic-activity score (0-100).
   *
   * Their measure of how much of the volume looks like real demand rather than
   * wash trading. Carried through as-is and attributed to Jupiter in the UI —
   * it is not our computation and should not be presented as one.
   */
  organicScore?: number;
  organicScoreLabel?: string;
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
  /** Pro Traders: count of wallets our system tags as historically profitable/experienced */
  proTradersCount?: number;
  /** KOLs: count of known influencer wallets currently holding */
  kolsCount?: number;
  twitterUrl?: string;
  twitterHandle?: string;
  twitterFollowers?: number;
  telegramUrl?: string;
  websiteUrl?: string;
  userPositionSol?: number;
  userPositionTokens?: number;
  /** Axiom-style Dev Wallet Age (e.g. '2m', '1y', '3d') */
  devWalletAge?: string;
  /**
   * The team paid DexScreener for a token profile, and it was approved.
   *
   * From `/orders/v1/{chain}/{mint}` — a different purchase from a boost. This
   * was previously set to `true` for anything boosted, so the badge appeared on
   * tokens whose listing nobody had checked.
   */
  isDexPaid?: boolean;
  /** Epoch ms of the earliest approved DexScreener payment, when reported. */
  dexPaidAt?: number;
  /** Remaining seconds on an active paid bump/boost promotion */
  bumpCountdown?: number;
  /** Boost indicator: whether token has paid promotion active */
  isBoosted?: boolean;
  /**
   * Boost amount as reported by DexScreener, when reported.
   *
   * `/token-boosts/top/v1` omits `amount` entirely, so this is often absent —
   * it previously defaulted to 10, inventing a purchase size for every token
   * in that feed.
   */
  boostAmount?: number;
  /**
   * Remaining seconds on a boost, **only if a real expiry is ever reported**.
   *
   * DexScreener publishes no expiry — the payload is `url, chainId,
   * tokenAddress, description, icon, header, openGraph, links, totalAmount,
   * amount` and nothing else. This was being filled with `now + 24h` at every
   * sighting, producing a confident countdown toward an end nobody had stated.
   * Nothing sets it today; the card shows that a token is boosted, not a timer.
   */
  boostCountdown?: number;
  /** Views / impressions count on the token card (legacy alias) */
  viewsCount?: number;
  /** Recent Visitors: count of recent unique viewers of the token's page (first-party analytics metric) */
  recentVisitors?: number;
  /** Fee accrued: fees accrued from trading activity in USD */
  feeAccruedUsd?: string | number;
  /** Specific protocol / bonding curve version (e.g. 'Pump V1', 'Raydium CPMM', 'Meteora') */
  protocol?: string;
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
  bundlersMax?: number;
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
