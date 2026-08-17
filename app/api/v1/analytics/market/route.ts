import { NextResponse } from 'next/server';
import {
  VolumeDecompositionEngine,
  MarketRegimeClassifier,
  AnalyticsTimeframe,
} from '@/lib/analytics';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = (searchParams.get('timeframe') as AnalyticsTimeframe) || '24h';

  // Aggregate simulated market telemetry
  const decomposition = VolumeDecompositionEngine.decomposeVolume({
    tokenAddress: 'So11111111111111111111111111111111111111112',
    timeframe,
    trades: [],
    baselineTotalVolumeUsd: 148_250_000,
  });

  const regime = MarketRegimeClassifier.classifyRegime({
    activeSolanaVolume24hUsd: 148_250_000,
    newMintsCount24h: 1840,
    medianPoolDepthUsd: 185_000,
    averageWashTradingPct: decomposition.washTradingProbabilityPct,
    advanceDeclineRatio: 2.1,
    solanaPriceChange24hPct: 4.8,
  });

  return NextResponse.json({
    timeframe,
    marketRegime: regime,
    volumeDecomposition: decomposition,
    timestamp: new Date().toISOString(),
  });
}
