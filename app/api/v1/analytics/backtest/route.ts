import { NextResponse } from 'next/server';
import { HistoricalBacktestEngine, BacktestParameterConfig } from '@/lib/analytics';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config: BacktestParameterConfig = {
      signalName: body.signalName || 'ORGANIC_VOLUME_SURGE',
      thresholdValue: body.thresholdValue || 80,
      targetHorizon: body.targetHorizon || '24h',
      datasetTimeRange: body.datasetTimeRange || {
        start: '2026-01-01T00:00:00Z',
        end: '2026-06-01T00:00:00Z',
      },
      simulatedSlippagePct: body.simulatedSlippagePct || 1.2,
      simulatedFeeDeductionPct: body.simulatedFeeDeductionPct || 0.6,
    };

    // Synthetic point-in-time evaluation dataset with strict T <= point
    const dataset = Array.from({ length: 40 }).map((_, i) => ({
      tokenAddress: `HistoricalToken_${i}`,
      timestamp: Date.now() - (40 - i) * 86400000,
      signalScoreAtT: 60 + (i % 35),
      priceAtT: 1.0 + (i % 5) * 0.2,
      priceAtHorizon: (1.0 + (i % 5) * 0.2) * (1 + (i % 2 === 0 ? 0.45 : -0.15)),
      maxDrawdownDuringHorizonPct: 12 + (i % 15),
    }));

    const result = HistoricalBacktestEngine.runBacktest({
      config,
      dataset,
    });

    return NextResponse.json({
      success: true,
      backtestMetrics: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to execute backtest' },
      { status: 400 }
    );
  }
}
