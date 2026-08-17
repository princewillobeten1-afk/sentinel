import type { ActivityWindow, NormalizedTrade } from './types';

export const FEATURE_VERSION = 'sentinel-features-v1.0.0';
export const ORGANIC_VOLUME_VERSION = 'sentinel-organic-v1.0.0';
export const INSIDER_DETECTION_VERSION = 'sentinel-insider-v1.0.0';

export const WINDOW_SECONDS: Record<ActivityWindow, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3_600,
  '4h': 14_400,
  '24h': 86_400,
  '7d': 604_800,
};

export const DEFAULT_WINDOWS = Object.keys(WINDOW_SECONDS) as ActivityWindow[];

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function filterTradesForWindow(
  trades: NormalizedTrade[],
  observedAt: string,
  window: ActivityWindow,
): NormalizedTrade[] {
  const end = toTimestamp(observedAt);
  const start = end - WINDOW_SECONDS[window] * 1000;

  return trades
    .filter((trade) => {
      const timestamp = toTimestamp(trade.timestamp);
      return timestamp >= start && timestamp <= end;
    })
    .sort((a, b) => toTimestamp(a.timestamp) - toTimestamp(b.timestamp));
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

export function median(values: number[]): number {
  return percentile(values, 50);
}

export function percentile(values: number[], percentileRank: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentileRank / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

export function giniCoefficient(values: number[]): number {
  const positive = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (positive.length === 0) return 0;
  const total = sum(positive);
  let weightedSum = 0;
  positive.forEach((value, index) => {
    weightedSum += (index + 1) * value;
  });
  return (2 * weightedSum) / (positive.length * total) - (positive.length + 1) / positive.length;
}

export function herfindahlIndex(shares: number[]): number {
  return sum(shares.map((share) => share ** 2));
}

export function share(part: number, total: number): number {
  return total <= 0 ? 0 : part / total;
}

export function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function scoreFromPenalty(base: number, penalties: number[], bonuses: number[] = []): number {
  return Math.round(clamp(base - sum(penalties) + sum(bonuses)));
}

export function confidenceLevelFromScore(score: number): 'HIGH' | 'MODERATE' | 'LOW' | 'INSUFFICIENT' {
  if (score >= 75) return 'HIGH';
  if (score >= 50) return 'MODERATE';
  if (score >= 25) return 'LOW';
  return 'INSUFFICIENT';
}

export function uniqueValues(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => !!value)));
}

export function secondsBetween(a: string, b: string): number {
  return Math.abs(toTimestamp(a) - toTimestamp(b)) / 1000;
}
