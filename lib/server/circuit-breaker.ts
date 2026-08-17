/**
 * Circuit breaker (Sprint 30 — Tier 4): one concrete, bounded trigger —
 * repeated extreme simulated price impact on the same pair — not a generic
 * every-possible-trigger framework.
 *
 * `recordPriceImpactSample` is pure and deterministic given `now`, so it's
 * directly unit-testable. The side-effecting part (actually pausing the kill
 * switch on trip) lives in the route that calls this, not here.
 */

const EXTREME_IMPACT_THRESHOLD_PCT = 12; // just under the quote provider's own 15% clamp
const TRIP_THRESHOLD_COUNT = 3;
const WINDOW_MS = 60_000;

interface Sample {
  pairKey: string;
  at: number;
}

const recentExtremeSamples: Sample[] = [];

export interface CircuitBreakerCheck {
  tripped: boolean;
  recentExtremeCount: number;
}

/**
 * Records a price-impact observation for a pair and reports whether the
 * breaker should trip — 3 or more extreme-impact samples for the same pair
 * within a rolling 60s window.
 */
export function recordPriceImpactSample(pairKey: string, priceImpactPct: number, now: number = Date.now()): CircuitBreakerCheck {
  // Prune anything outside the window regardless of pair, so this doesn't grow unbounded.
  const cutoff = now - WINDOW_MS;
  for (let i = recentExtremeSamples.length - 1; i >= 0; i--) {
    if (recentExtremeSamples[i].at < cutoff) recentExtremeSamples.splice(i, 1);
  }

  if (priceImpactPct <= EXTREME_IMPACT_THRESHOLD_PCT) {
    const recentExtremeCount = recentExtremeSamples.filter((s) => s.pairKey === pairKey).length;
    return { tripped: false, recentExtremeCount };
  }

  recentExtremeSamples.push({ pairKey, at: now });
  const recentExtremeCount = recentExtremeSamples.filter((s) => s.pairKey === pairKey).length;

  return { tripped: recentExtremeCount >= TRIP_THRESHOLD_COUNT, recentExtremeCount };
}

/** Test-only reset. */
export function resetCircuitBreakerState(): void {
  recentExtremeSamples.length = 0;
}
