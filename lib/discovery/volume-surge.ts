export interface VolumeSurgeInput {
  current5mVolumeUsd: number;
  historical1hVolumeUsd: number;
  historical24hVolumeUsd: number;
}

export interface VolumeSurgeResult {
  volumeChange: number; // % change vs rolling average
  volumeAcceleration: number; // Acceleration factor e.g. 4.2x
  volumeAnomalyScore: number; // 0 - 100
  confidence: number; // 0.0 - 1.0
  isSurge: boolean;
  explanation: string;
}

/**
 * Volume Surge Detector — Compares current 5m volume against rolling historical baselines.
 */
export function detectVolumeSurge(input: VolumeSurgeInput): VolumeSurgeResult {
  // Baseline 5m average calculated from 1h rolling volume
  const baseline5mUsd = input.historical1hVolumeUsd > 0
    ? input.historical1hVolumeUsd / 12
    : (input.historical24hVolumeUsd / 288);

  if (baseline5mUsd <= 0) {
    return {
      volumeChange: 0,
      volumeAcceleration: 1.0,
      volumeAnomalyScore: 0,
      confidence: 0.5,
      isSurge: false,
      explanation: 'Insufficient historical baseline volume data',
    };
  }

  const ratio = input.current5mVolumeUsd / baseline5mUsd;
  const volumeChange = ((input.current5mVolumeUsd - baseline5mUsd) / baseline5mUsd) * 100;
  const volumeAcceleration = Number(ratio.toFixed(2));

  // Anomaly score: 1.0x = 0 score, 5.0x = 80 score, 10.0x+ = 100 score
  const score = Math.min(100, Math.max(0, (ratio - 1.0) * 20));
  const volumeAnomalyScore = Math.round(score);

  // Confidence increases with higher baseline volume depth
  const confidence = Math.min(1.0, Math.max(0.6, Math.log10(Math.max(100, input.historical1hVolumeUsd)) / 6));

  const isSurge = volumeAnomalyScore >= 40;
  const explanation = isSurge
    ? `Volume surge: 5m volume is ${volumeAcceleration}x above 1h rolling baseline (+${volumeChange.toFixed(0)}%)`
    : `Normal volume activity relative to 1h baseline`;

  return {
    volumeChange: Number(volumeChange.toFixed(1)),
    volumeAcceleration,
    volumeAnomalyScore,
    confidence: Number(confidence.toFixed(2)),
    isSurge,
    explanation,
  };
}
