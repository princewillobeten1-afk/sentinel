import type { DiscoveryToken } from './types';

export type AnomalyType =
  | 'VOLUME_SPIKE'
  | 'TRANSACTION_SPIKE'
  | 'LIQUIDITY_SPIKE'
  | 'LIQUIDITY_WITHDRAWAL'
  | 'BUY_SELL_IMBALANCE'
  | 'HOLDER_GROWTH_SPIKE'
  | 'PRICE_ACCELERATION';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DetectedAnomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  confidence: number; // 0.0 - 1.0
  detectedAt: string; // ISO timestamp
  token: { id: string; symbol: string };
  supportingMetrics: Record<string, number | string>;
  label: string; // Human-readable label (NOT a judgment — purely descriptive)
}

/**
 * Anomaly Detection Framework
 *
 * Detects unusual observable events across 7 dimensions.
 * Anomalies are NOT labeled as "scams" — they are simply unusual patterns
 * that may warrant a trader's attention.
 */
export function detectAnomalies(token: DiscoveryToken): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  const now = new Date().toISOString();
  const tokenRef = { id: token.id, symbol: token.symbol };

  // 1. VOLUME SPIKE — 5m volume > 5× rolling 1h baseline
  const volume5m = parseFloat(token.volume5mUsd);
  const volume1h = parseFloat(token.volume1hUsd);
  const baseline5m = volume1h / 12; // Normalized 5m slice from 1h
  const volumeRatio = baseline5m > 0 ? volume5m / baseline5m : 0;

  if (volumeRatio >= 5.0) {
    anomalies.push({
      type: 'VOLUME_SPIKE',
      severity: volumeRatio >= 15 ? 'critical' : volumeRatio >= 10 ? 'high' : 'medium',
      confidence: Math.min(1.0, 0.7 + (volumeRatio - 5) * 0.03),
      detectedAt: now,
      token: tokenRef,
      supportingMetrics: {
        volume5mUsd: token.volume5mUsd,
        baseline5mUsd: baseline5m.toFixed(2),
        ratio: volumeRatio.toFixed(1),
      },
      label: `Volume ${volumeRatio.toFixed(1)}× above baseline`,
    });
  }

  // 2. TRANSACTION SPIKE — txCount15m > 3× normalized hourly rate
  const expectedTx15m = token.txCount1h / 4;
  const txRatio = expectedTx15m > 0 ? token.txCount15m / expectedTx15m : 0;

  if (txRatio >= 3.0) {
    anomalies.push({
      type: 'TRANSACTION_SPIKE',
      severity: txRatio >= 8 ? 'critical' : txRatio >= 5 ? 'high' : 'medium',
      confidence: Math.min(1.0, 0.75 + (txRatio - 3) * 0.05),
      detectedAt: now,
      token: tokenRef,
      supportingMetrics: {
        txCount15m: token.txCount15m,
        expected15m: Math.round(expectedTx15m),
        ratio: txRatio.toFixed(1),
      },
      label: `TX activity ${txRatio.toFixed(1)}× expected rate`,
    });
  }

  // 3. LIQUIDITY SPIKE — Liquidity change > +50% in 1h
  if (token.liquidityChange1hPct >= 50) {
    anomalies.push({
      type: 'LIQUIDITY_SPIKE',
      severity: token.liquidityChange1hPct >= 200 ? 'high' : 'medium',
      confidence: 0.90,
      detectedAt: now,
      token: tokenRef,
      supportingMetrics: {
        liquidityUsd: token.liquidityUsd,
        changePct: token.liquidityChange1hPct,
      },
      label: `Liquidity +${token.liquidityChange1hPct.toFixed(0)}%`,
    });
  }

  // 4. LIQUIDITY WITHDRAWAL — Liquidity drop > −30% in 1h
  if (token.liquidityChange1hPct <= -30) {
    anomalies.push({
      type: 'LIQUIDITY_WITHDRAWAL',
      severity: token.liquidityChange1hPct <= -60 ? 'critical' : 'high',
      confidence: 0.92,
      detectedAt: now,
      token: tokenRef,
      supportingMetrics: {
        liquidityUsd: token.liquidityUsd,
        changePct: token.liquidityChange1hPct,
      },
      label: `Liquidity ${token.liquidityChange1hPct.toFixed(0)}%`,
    });
  }

  // 5. BUY/SELL IMBALANCE — Ratio > 80% or < 20%
  const totalTx = token.buysCount + token.sellsCount;
  const buyPct = totalTx > 0 ? (token.buysCount / totalTx) * 100 : 50;

  if (buyPct >= 80 || buyPct <= 20) {
    const side = buyPct >= 80 ? 'Buy' : 'Sell';
    anomalies.push({
      type: 'BUY_SELL_IMBALANCE',
      severity: buyPct >= 90 || buyPct <= 10 ? 'high' : 'medium',
      confidence: Math.min(1.0, 0.8 + Math.abs(buyPct - 50) * 0.004),
      detectedAt: now,
      token: tokenRef,
      supportingMetrics: {
        buysCount: token.buysCount,
        sellsCount: token.sellsCount,
        buyPct: buyPct.toFixed(1),
      },
      label: `${side} dominance ${buyPct.toFixed(0)}%`,
    });
  }

  // 6. HOLDER GROWTH SPIKE — Holder growth > 50% in 1h.
  //
  // Skipped entirely when growth is unknown. Treating an absent figure as 0
  // would silently report "no holder spike" for every token the data source
  // does not cover, which reads as a checked-and-clear result rather than an
  // unchecked one.
  const holderGrowth = token.holderGrowth1hPct;
  if (holderGrowth !== undefined && holderGrowth >= 50) {
    anomalies.push({
      type: 'HOLDER_GROWTH_SPIKE',
      severity: holderGrowth >= 150 ? 'high' : 'medium',
      confidence: 0.85,
      detectedAt: now,
      token: tokenRef,
      supportingMetrics: {
        holdersCount: token.holdersCount ?? 0,
        growthPct: holderGrowth,
      },
      label: `Holders +${holderGrowth.toFixed(0)}%`,
    });
  }

  // 7. PRICE ACCELERATION — Price change 15m > 50%
  if (Math.abs(token.priceChange15m) >= 50) {
    const direction = token.priceChange15m > 0 ? 'up' : 'down';
    anomalies.push({
      type: 'PRICE_ACCELERATION',
      severity: Math.abs(token.priceChange15m) >= 100 ? 'critical' : 'high',
      confidence: 0.88,
      detectedAt: now,
      token: tokenRef,
      supportingMetrics: {
        priceChange15m: token.priceChange15m,
        priceUsd: token.priceUsd,
      },
      label: `Price ${direction} ${Math.abs(token.priceChange15m).toFixed(0)}% in 15m`,
    });
  }

  return anomalies;
}

/**
 * Returns the highest-severity anomaly from a list, for badge display.
 */
export function getHighestSeverity(anomalies: DetectedAnomaly[]): AnomalySeverity | null {
  if (anomalies.length === 0) return null;
  const order: AnomalySeverity[] = ['critical', 'high', 'medium', 'low'];
  for (const sev of order) {
    if (anomalies.some((a) => a.severity === sev)) return sev;
  }
  return 'low';
}

/**
 * Maps anomaly type to a short icon/emoji for UI display.
 */
export function getAnomalyIcon(type: AnomalyType): string {
  switch (type) {
    case 'VOLUME_SPIKE': return '⚡';
    case 'TRANSACTION_SPIKE': return '🔥';
    case 'LIQUIDITY_SPIKE': return '💧';
    case 'LIQUIDITY_WITHDRAWAL': return '🚨';
    case 'BUY_SELL_IMBALANCE': return '⚖️';
    case 'HOLDER_GROWTH_SPIKE': return '👥';
    case 'PRICE_ACCELERATION': return '🚀';
    default: return '⚠️';
  }
}
