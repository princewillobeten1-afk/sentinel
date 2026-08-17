import { DiscoveryScore, SignalResult, TimeWindow } from './types';
import { calculateMomentumAcceleration } from './momentum-engine';
import { detectVolumeSurge } from './volume-surge';
import { detectLiquidityChanges } from './liquidity-detector';

interface RawTokenInput {
  ageMinutes: number;
  priceChangeWindow: number; // % change for active time window
  volumeWindowUsd: number;
  volumeAccelerationPct: number;
  liquidityUsd: number;
  liquidityChangePct: number;
  buysCount: number;
  sellsCount: number;
  holdersCount: number;
  holderGrowthPct: number;
  txCount1h: number;
  buySellImbalancePct: number;
  buyPressureRatio: number;
  txAccelerationPct: number;
  isNewToken: boolean;
}

/**
 * Composite Normalized Discovery Score Engine (0 - 100)
 * Integrates Momentum Acceleration, Rolling Baseline Volume Surges, Liquidity Change Detection, and Market-side signal weighting.
 */
export function calculateDiscoveryScore(input: RawTokenInput, window: TimeWindow): DiscoveryScore {
  const momentumRes = calculateMomentumAcceleration({
    priceChange15m: input.priceChangeWindow,
    priceChange1h: input.priceChangeWindow * 1.5,
    volume15mUsd: input.volumeWindowUsd / 4,
    volume1hUsd: input.volumeWindowUsd,
    txCount15m: input.buysCount + input.sellsCount,
    buysCount: input.buysCount,
    sellsCount: input.sellsCount,
    holderGrowth1hPct: input.holderGrowthPct,
  });

  const volumeSurgeRes = detectVolumeSurge({
    current5mVolumeUsd: input.volumeWindowUsd / 12,
    historical1hVolumeUsd: input.volumeWindowUsd,
    historical24hVolumeUsd: input.volumeWindowUsd * 24,
  });

  const liquidityRes = detectLiquidityChanges({
    currentLiquidityUsd: input.liquidityUsd,
    previousLiquidityUsd: input.liquidityUsd / (1 + input.liquidityChangePct / 100),
    liquidityChange1hPct: input.liquidityChangePct,
  });

const imbalanceScore = Math.min(100, Math.max(0, input.buySellImbalancePct * 1.2));
    const txAccelScore = Math.min(100, Math.max(0, 20 + input.txAccelerationPct * 0.5));
    const ageScore = input.isNewToken ? 100 : input.ageMinutes <= 60 ? 85 : 30;
    const ageExplanation = input.isNewToken
      ? `Fresh launch detected with ${input.ageMinutes}m time-on-market`
      : input.ageMinutes <= 60
      ? `Newly active token (${input.ageMinutes}m old)`
      : `Token age: ${input.ageMinutes}m`;

    const signals: SignalResult[] = [
    {
      signalName: 'Momentum Acceleration',
      score: momentumRes.accelerationScore,
      weight: 0.22,
      confidence: 0.88,
      rawInput: `${momentumRes.accelerationScore}/100 accel`,
      explanation: momentumRes.explanation,
      timestamp: new Date().toISOString(),
    },
    {
      signalName: 'Volume Anomaly Surge',
      score: volumeSurgeRes.volumeAnomalyScore,
      weight: 0.18,
      confidence: volumeSurgeRes.confidence,
      rawInput: `${volumeSurgeRes.volumeAcceleration}x baseline`,
      explanation: volumeSurgeRes.explanation,
      timestamp: new Date().toISOString(),
    },
    {
      signalName: 'Market-side Imbalance',
      score: imbalanceScore,
      weight: 0.18,
      confidence: 0.92,
      rawInput: `${input.buyPressureRatio.toFixed(2)} buy ratio`,
      explanation: input.buyPressureRatio >= 0.55
        ? `Buy-side pressure dominates with ${input.buyPressureRatio.toFixed(2)} ratio`
        : `Balanced market activity with ${input.buyPressureRatio.toFixed(2)} buy ratio`,
      timestamp: new Date().toISOString(),
    },
    {
      signalName: 'Transaction Acceleration',
      score: txAccelScore,
      weight: 0.17,
      confidence: 0.90,
      rawInput: `${input.txAccelerationPct.toFixed(1)}% faster`,
      explanation: input.txAccelerationPct >= 20
        ? `Transaction activity accelerating rapidly over prior periods`
        : `Steady trade flow with ${input.txAccelerationPct.toFixed(1)}% acceleration`,
      timestamp: new Date().toISOString(),
    },
    {
      signalName: 'Liquidity Health',
      score: liquidityRes.isRapidWithdrawal ? 0 : Math.min(100, Math.max(0, 45 + input.liquidityChangePct)),
      weight: 0.14,
      confidence: 0.94,
      rawInput: liquidityRes.formattedChange,
      explanation: liquidityRes.explanation,
      timestamp: new Date().toISOString(),
    },
    {
      signalName: input.isNewToken ? 'New Token Freshness' : 'Recency Detection',
      score: ageScore,
      weight: 0.11,
      confidence: 1.0,
      rawInput: `${input.ageMinutes}m old`,
      explanation: ageExplanation,
      timestamp: new Date().toISOString(),
    },
  ];

  // Weighted score sum
  let weightedScore = signals.reduce((sum, s) => sum + s.score * s.weight, 0);

  // Normalization Guard: Rapid Liquidity Withdrawal Penalty
  if (liquidityRes.isRapidWithdrawal) {
    weightedScore = Math.max(0, weightedScore - 50.0);
  }

  // Time decay: older tokens are less likely to dominate indefinitely.
  const decayFactor = Math.max(0.75, Math.min(1.0, 1 - input.ageMinutes / 600));
  weightedScore = weightedScore * decayFactor;

  const finalScore = Math.min(100, Math.max(0, Math.round(weightedScore)));

  let grade: DiscoveryScore['grade'] = 'LOW_SIGNAL';
  if (finalScore >= 80) grade = 'CRITICAL_SIGNAL';
  else if (finalScore >= 60) grade = 'HIGH_SIGNAL';
  else if (finalScore >= 40) grade = 'MODERATE_SIGNAL';

  const explanations = signals
    .filter((s) => s.score > 35 || liquidityRes.isRapidWithdrawal)
    .map((s) => s.explanation);

  if (explanations.length === 0) {
    explanations.push('Normal market metrics baseline active');
  }

  return {
    totalScore: finalScore,
    confidence: Number(
      (signals.reduce((sum, s) => sum + s.confidence * s.weight, 0) /
        signals.reduce((sum, s) => sum + s.weight, 0)).toFixed(2)
    ),
    grade,
    factors: {
      volumeAcceleration: volumeSurgeRes.volumeAnomalyScore,
      transactionAcceleration: txAccelScore,
      liquidityChange: liquidityRes.isRapidWithdrawal ? 0 : Math.min(100, Math.max(0, 45 + input.liquidityChangePct)),
      buySellImbalance: imbalanceScore,
      holderGrowth: Math.min(100, Math.max(0, input.holderGrowthPct * 0.8)),
      recency: ageScore,
      priceVelocity: momentumRes.priceVelocity,
    },
    rawInputs: {
      ageMinutes: input.ageMinutes,
      priceChangeWindow: input.priceChangeWindow,
      volumeWindowUsd: input.volumeWindowUsd,
      volumeAccelerationPct: input.volumeAccelerationPct,
      liquidityChangePct: input.liquidityChangePct,
      buysCount: input.buysCount,
      sellsCount: input.sellsCount,
      holdersCount: input.holdersCount,
      holderGrowthPct: input.holderGrowthPct,
      buySellImbalancePct: input.buySellImbalancePct,
      buyPressureRatio: input.buyPressureRatio,
      txAccelerationPct: input.txAccelerationPct,
      isNewToken: input.isNewToken,
    },
    signals,
    explanations,
    calculatedAt: new Date().toISOString(),
  };
}
