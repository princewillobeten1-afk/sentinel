import { NextResponse } from 'next/server';
import { CreatorOutcomeTracker } from '@/lib/analytics';

export async function GET(
  request: Request,
  { params }: { params: { creatorAddress: string } }
) {
  const { creatorAddress } = params;

  const record = CreatorOutcomeTracker.analyzeCreatorTrackRecord({
    creatorAddress,
    launches: [
      {
        tokenAddress: 'MintAlpha111',
        symbol: 'ALPHA',
        launchedAt: new Date(Date.now() - 86400000 * 45).toISOString(),
        peakMarketCapUsd: 1_850_000,
        drawdown24hPct: 35,
        liquidityRemoved48h: false,
        graduatedOrLiquid30d: true,
      },
      {
        tokenAddress: 'MintBeta222',
        symbol: 'BETA',
        launchedAt: new Date(Date.now() - 86400000 * 20).toISOString(),
        peakMarketCapUsd: 620_000,
        drawdown24hPct: 45,
        liquidityRemoved48h: false,
        graduatedOrLiquid30d: true,
      },
      {
        tokenAddress: 'MintGamma333',
        symbol: 'GAMMA',
        launchedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        peakMarketCapUsd: 110_000,
        drawdown24hPct: 82,
        liquidityRemoved48h: false,
        graduatedOrLiquid30d: false,
      },
    ],
  });

  return NextResponse.json({
    creatorAnalytics: record,
    timestamp: new Date().toISOString(),
  });
}
