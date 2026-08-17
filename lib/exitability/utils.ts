import type { Evidence } from '@/lib/intelligence/types';
import type { ExitabilityInterpretation } from './types';

export const EXITABILITY_VERSION = 'sentinel-exitability-v1.0.0';
export const LIQUIDITY_QUALITY_VERSION = 'sentinel-liquidity-quality-v1.0.0';
export const EXECUTION_VERSION = 'sentinel-execution-v1.0.0';
export const SLIPPAGE_VERSION = 'sentinel-slippage-v1.0.0';
export const STRESS_VERSION = 'sentinel-stress-v1.0.0';

/** Default multi-size simulation presets (spec §6). */
export const PRESET_POSITION_SIZES = [100, 500, 1_000, 5_000, 10_000, 25_000, 50_000, 100_000];

/** Exit-depth impact thresholds in percent (spec §21). */
export const EXIT_DEPTH_THRESHOLDS = [1, 5, 10, 20];

/** How long a quote is considered fresh, in seconds (spec §14). */
export const QUOTE_TTL_SECONDS = 20;

/** Approximate Solana network fee per swap, in USD (illustrative). */
export const DEFAULT_GAS_USD = 0.03;

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function share(part: number, total: number): number {
  return total <= 0 ? 0 : part / total;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function herfindahl(shares: number[]): number {
  return sum(shares.map((value) => value ** 2));
}

export function toTimestamp(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

export function isoAfter(baseIso: string, seconds: number): string {
  return new Date(toTimestamp(baseIso) + seconds * 1000).toISOString();
}

export function interpretExitability(score: number): ExitabilityInterpretation {
  if (score >= 90) return 'VERY_STRONG';
  if (score >= 75) return 'STRONG';
  if (score >= 60) return 'MODERATE';
  if (score >= 40) return 'WEAK';
  if (score >= 20) return 'POOR';
  return 'SEVERE';
}

export function interpretationLabel(interpretation: ExitabilityInterpretation): string {
  switch (interpretation) {
    case 'VERY_STRONG':
      return 'Very strong exitability';
    case 'STRONG':
      return 'Strong exitability';
    case 'MODERATE':
      return 'Moderate exitability';
    case 'WEAK':
      return 'Weak exitability';
    case 'POOR':
      return 'Poor exitability';
    case 'SEVERE':
      return 'Severe exit difficulty';
  }
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  if (Math.abs(value) >= 1_000_000) return `$${round(value / 1_000_000, 2)}M`;
  if (Math.abs(value) >= 1_000) return `$${round(value / 1_000, 1)}K`;
  return `$${round(value, 2)}`;
}

export function evidence(
  fact: string,
  source: string,
  observedAt: string,
  value: string | number,
  confidence: number,
): Evidence {
  return { fact, source, observedAt, value, confidence };
}
