export type TimeWindow = '1m' | '5m' | '15m' | '1h' | '4h' | '24h';

export type DiscoverySection =
  | 'trending'
  | 'new'
  | 'momentum'
  | 'volume'
  | 'liquidity'
  | 'movers'
  | 'watchlist'
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
  holdersCount: number;
  holderGrowth1hPct: number;
  discoveryScore: DiscoveryScore;
}

export interface DiscoveryFilter {
  section: DiscoverySection;
  timeWindow: TimeWindow;
  chain: string;
  searchQuery?: string;
  minLiquidityUsd?: number;
  minVolumeUsd?: number;

  // Range Filters (Section 24)
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

  // Sprint 7 Activity Intelligence Filters
  organicVolumeMin?: number;     // 0 - 100
  top5VolumeShareMax?: number;  // 0.0 - 1.0
  noCoordinatedSignals?: boolean;
  creatorReputation?: number;  // Future: 0 - 100
  insiderRisk?: number;       // 0 - 100
  ownershipConcentration?: number; // 0 - 100
  organicVolume?: number;     // 0 - 100
  exitability?: number;       // 0 - 100
  liquidityLock?: boolean;    // locked/unlocked
  contractRisk?: number;      // 0 - 100
}


