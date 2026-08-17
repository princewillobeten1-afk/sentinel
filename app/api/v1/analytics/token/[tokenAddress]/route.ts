import { NextResponse } from 'next/server';
import {
  VolumeDecompositionEngine,
  ExitabilitySimulator,
  DataLineageTracer,
  AnalyticsTimeframe,
} from '@/lib/analytics';

export async function GET(
  request: Request,
  { params }: { params: { tokenAddress: string } }
) {
  const { tokenAddress } = params;
  const { searchParams } = new URL(request.url);
  const timeframe = (searchParams.get('timeframe') as AnalyticsTimeframe) || '24h';

  const volume = VolumeDecompositionEngine.decomposeVolume({
    tokenAddress,
    timeframe,
    trades: [],
    baselineTotalVolumeUsd: 1_450_000,
  });

  const exitability = ExitabilitySimulator.simulateExitability({
    tokenAddress,
    poolLiquidityUsd: 380_000,
    dailyVolumeUsd: volume.totalVolumeUsd,
    poolVolatility24hPct: 18.2,
  });

  const lineage = DataLineageTracer.traceScoreLineage({
    insightId: `ins_${tokenAddress.slice(0, 6)}`,
    scoreName: 'Exitability Score',
    computedScore: exitability.overallTokenExitabilityScore,
    tokenAddress,
  });

  return NextResponse.json({
    tokenAddress,
    timeframe,
    volumeDecomposition: volume,
    positionExitability: exitability,
    lineageTrace: lineage,
    timestamp: new Date().toISOString(),
  });
}
