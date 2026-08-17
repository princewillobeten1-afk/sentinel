import { describe, it, expect } from 'vitest';
import { HistoricalBacktestEngine } from '../backtest-engine';

describe('Historical Backtesting Engine (Sprint 38 §48-51, §88-91)', () => {
  it('runs point-in-time backtest simulation and validates no-look-ahead guarantee', () => {
    const dataset = [
      {
        tokenAddress: 'TokenHistorical1',
        timestamp: 1000000,
        signalScoreAtT: 85, // Triggers threshold
        priceAtT: 1.0,
        priceAtHorizon: 1.4, // +40%
        maxDrawdownDuringHorizonPct: 10,
      },
      {
        tokenAddress: 'TokenHistorical2',
        timestamp: 2000000,
        signalScoreAtT: 82, // Triggers threshold
        priceAtT: 2.0,
        priceAtHorizon: 2.2, // +10%
        maxDrawdownDuringHorizonPct: 8,
      },
      {
        tokenAddress: 'TokenHistorical3',
        timestamp: 3000000,
        signalScoreAtT: 45, // Does not trigger
        priceAtT: 1.0,
        priceAtHorizon: 0.5,
        maxDrawdownDuringHorizonPct: 50,
      },
    ];

    const metrics = HistoricalBacktestEngine.runBacktest({
      config: {
        signalName: 'ORGANIC_VOLUME_SURGE',
        thresholdValue: 80,
        targetHorizon: '24h',
        datasetTimeRange: { start: '2026-01-01', end: '2026-06-01' },
        simulatedSlippagePct: 1.0,
        simulatedFeeDeductionPct: 0.5,
      },
      dataset,
    });

    expect(metrics.totalSignalsTriggered).toBe(2);
    expect(metrics.winRatePct).toBe(100);
    expect(metrics.noLookAheadVerified).toBe(true);
    expect(metrics.profitFactor).toBeGreaterThanOrEqual(1.0);
  });
});
