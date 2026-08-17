/**
 * Funding Graph Analyzer
 * Sprint 6
 *
 * Analyzes funding relationships between wallets.
 * Calculates normalized relationship strength from:
 * - Percentage of wallet's initial funding from source
 * - Number of funding events
 * - Timing patterns
 * - Amount significance
 * - Recurrence and persistence
 *
 * One tiny transfer must not establish a strong relationship (§9).
 * Methodology version: funding-analysis-v1.0
 */

import type {
  FundingEvent,
  FundingRelationship,
  WalletRelationshipEdge,
  OwnershipEvidence,
} from './types';

const METHODOLOGY_VERSION = 'funding-analysis-v1.0';

/** Minimum SOL amount for a funding event to be considered meaningful */
const MIN_MEANINGFUL_AMOUNT_SOL = 0.01;

/** Time window in ms for "persistent" relationship (30 days) */
const PERSISTENCE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Analyze raw funding events into structured funding relationships.
 */
export function analyzeFundingRelationships(events: FundingEvent[]): FundingRelationship[] {
  // Group events by source → recipient pair
  const pairMap = new Map<string, FundingEvent[]>();

  for (const event of events) {
    if (event.amountSol < MIN_MEANINGFUL_AMOUNT_SOL) continue;
    const key = `${event.source}::${event.recipient}`;
    const existing = pairMap.get(key) || [];
    existing.push(event);
    pairMap.set(key, existing);
  }

  const relationships: FundingRelationship[] = [];

  for (const [key, pairEvents] of pairMap) {
    const [source, recipient] = key.split('::');
    const sorted = [...pairEvents].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    const totalAmount = sorted.reduce((sum, e) => sum + e.amountSol, 0);
    const firstEvent = sorted[0].timestamp;
    const lastEvent = sorted[sorted.length - 1].timestamp;
    const isPersistent =
      Date.now() - new Date(lastEvent).getTime() < PERSISTENCE_WINDOW_MS;

    // Calculate initial funding percentage
    // (approximation: first event as % of total received by recipient from all sources)
    const recipientTotalFromAllSources = events
      .filter(e => e.recipient === recipient)
      .reduce((sum, e) => sum + e.amountSol, 0);

    const initialFundingPct = recipientTotalFromAllSources > 0
      ? (totalAmount / recipientTotalFromAllSources) * 100
      : 0;

    const strength = calculateFundingStrength({
      sourceWallet: source,
      recipientWallet: recipient,
      events: sorted,
      totalAmountSol: totalAmount,
      eventCount: sorted.length,
      initialFundingPct,
      strength: 0, // placeholder, calculated below
      firstEvent,
      lastEvent,
      isPersistent,
    });

    relationships.push({
      sourceWallet: source,
      recipientWallet: recipient,
      events: sorted,
      totalAmountSol: totalAmount,
      eventCount: sorted.length,
      initialFundingPct,
      strength,
      firstEvent,
      lastEvent,
      isPersistent,
    });
  }

  return relationships.sort((a, b) => b.strength - a.strength);
}

/**
 * Calculate normalized relationship strength (0.0 – 1.0).
 *
 * Weighted components:
 * - Initial funding percentage (35%) — high % of wallet funding from source = strong
 * - Event count (20%) — more events = more established
 * - Amount significance (20%) — larger amounts relative to typical = stronger
 * - Persistence (15%) — ongoing vs one-time
 * - Timing pattern (10%) — consistent intervals = stronger
 */
export function calculateFundingStrength(rel: FundingRelationship): number {
  let score = 0;

  // 1. Initial funding percentage (35%)
  const fundingScore = Math.min(1.0, rel.initialFundingPct / 100);
  score += fundingScore * 0.35;

  // 2. Event count (20%) — diminishing returns after 5 events
  const eventScore = Math.min(1.0, rel.eventCount / 5);
  score += eventScore * 0.20;

  // 3. Amount significance (20%) — log scale, > 10 SOL is significant
  const amountScore = Math.min(1.0, Math.log10(Math.max(1, rel.totalAmountSol * 10)) / 3);
  score += amountScore * 0.20;

  // 4. Persistence (15%)
  score += (rel.isPersistent ? 1.0 : 0.3) * 0.15;

  // 5. Timing consistency (10%)
  if (rel.events.length >= 2) {
    const intervals = [];
    for (let i = 1; i < rel.events.length; i++) {
      intervals.push(
        new Date(rel.events[i].timestamp).getTime() -
        new Date(rel.events[i - 1].timestamp).getTime(),
      );
    }
    // Lower coefficient of variation = more consistent timing
    const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    const stddev = Math.sqrt(
      intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length,
    );
    const cv = mean > 0 ? stddev / mean : 1;
    const timingScore = Math.max(0, 1.0 - cv);
    score += timingScore * 0.10;
  }

  return Math.max(0, Math.min(1.0, score));
}

/**
 * Convert a funding relationship into a wallet relationship edge.
 */
export function fundingToEdge(rel: FundingRelationship): WalletRelationshipEdge {
  const evidence: OwnershipEvidence[] = [];

  if (rel.initialFundingPct > 50) {
    evidence.push({
      fact: `${rel.initialFundingPct.toFixed(1)}% of wallet's observed funding originated from this source`,
      source: 'funding_analysis',
      observedAt: rel.lastEvent,
      value: rel.initialFundingPct,
      confidence: 0.90,
    });
  }

  if (rel.eventCount > 1) {
    evidence.push({
      fact: `${rel.eventCount} funding events totaling ${rel.totalAmountSol.toFixed(2)} SOL`,
      source: 'funding_analysis',
      observedAt: rel.lastEvent,
      value: rel.eventCount,
      confidence: 0.95,
    });
  }

  if (rel.isPersistent) {
    evidence.push({
      fact: 'Funding relationship is ongoing (active within last 30 days)',
      source: 'funding_analysis',
      observedAt: rel.lastEvent,
      confidence: 0.85,
    });
  }

  return {
    id: `edge_fund_${rel.sourceWallet.slice(0, 8)}_${rel.recipientWallet.slice(0, 8)}_${Date.now()}`,
    source: rel.sourceWallet,
    target: rel.recipientWallet,
    type: 'SHARED_FUNDING',
    strength: rel.strength,
    evidence,
    firstObserved: rel.firstEvent,
    lastObserved: rel.lastEvent,
    confidence: Math.min(0.95, rel.strength + 0.1),
    methodologyVersion: METHODOLOGY_VERSION,
  };
}
