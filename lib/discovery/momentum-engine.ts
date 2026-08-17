export interface MomentumInput {
  priceChange15m: number;
  priceChange1h: number;
  volume15mUsd: number;
  volume1hUsd: number;
  txCount15m: number;
  buysCount: number;
  sellsCount: number;
  holderGrowth1hPct: number;
}

export interface MomentumResult {
  accelerationScore: number; // 0 - 100
  priceVelocity: number;
  volumeVelocity: number;
  txVelocity: number;
  buyPressureVelocity: number;
  isAccelerating: boolean;
  explanation: string;
}

/**
 * Momentum Engine — Detects rate of change in activity (acceleration) rather than static volume.
 */
export function calculateMomentumAcceleration(input: MomentumInput): MomentumResult {
  // 1. Price velocity (% change acceleration rate)
  const priceVelocity = Math.max(0, input.priceChange15m * 4 - input.priceChange1h);

  // 2. Volume velocity (15m volume extrapolated to 1h vs actual 1h volume)
  const annualized15mVol = input.volume15mUsd * 4;
  const volumeVelocity = input.volume1hUsd > 0
    ? ((annualized15mVol - input.volume1hUsd) / input.volume1hUsd) * 100
    : 0;

  // 3. Buy pressure velocity (Buy ratio shift)
  const totalTx = input.buysCount + input.sellsCount;
  const buyRatio = totalTx > 0 ? input.buysCount / totalTx : 0.5;
  const buyPressureVelocity = (buyRatio - 0.5) * 200; // -100 to +100

  // 4. Combined Acceleration Vector Score
  let score = 0;
  score += Math.min(30, Math.max(0, priceVelocity * 0.8));
  score += Math.min(35, Math.max(0, volumeVelocity * 0.15));
  score += Math.min(20, Math.max(0, buyPressureVelocity * 0.2));
  score += Math.min(15, Math.max(0, input.holderGrowth1hPct * 0.3));

  const accelerationScore = Math.min(100, Math.max(0, Math.round(score)));
  const isAccelerating = accelerationScore >= 50;

  let explanation = 'Baseline activity velocity';
  if (accelerationScore >= 75) {
    explanation = `High momentum acceleration: Volume velocity +${volumeVelocity.toFixed(0)}% with strong buy pressure`;
  } else if (isAccelerating) {
    explanation = `Moderate momentum acceleration detected in last 15m`;
  }

  return {
    accelerationScore,
    priceVelocity: Number(priceVelocity.toFixed(2)),
    volumeVelocity: Number(volumeVelocity.toFixed(2)),
    txVelocity: input.txCount15m,
    buyPressureVelocity: Number(buyPressureVelocity.toFixed(2)),
    isAccelerating,
    explanation,
  };
}
