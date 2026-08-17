/**
 * Creator Intelligence Engine (Foundation)
 *
 * Records creator address, creation timestamp/tx, associated token.
 * Prepares data structures for the future Creator Reputation System.
 * Does NOT produce a sophisticated reputation score in Sprint 5.
 * Missing creator data results in "Unknown" status, not automatic high risk.
 */

import type {
  EngineResult,
  IntelligenceSignal,
  Evidence,
  MissingDataEntry,
  RiskDimension,
  CreatorObservation,
} from '../types';

const METHODOLOGY_VERSION = 'creator-v1.0.0';

export interface CreatorInput {
  creatorAddress?: string;
  creationTimestamp?: string;
  creationTx?: string;
  knownLaunches?: number;
  historyAvailable?: boolean;
  dataTimestamp: string;
}

export interface CreatorResult extends EngineResult {
  creatorObservation: CreatorObservation;
}

export function analyzeCreator(input: CreatorInput, tokenId: string): CreatorResult {
  const now = new Date().toISOString();
  const signals: IntelligenceSignal[] = [];
  const evidence: Evidence[] = [];
  const missingData: MissingDataEntry[] = [];

  const hasCreator = !!input.creatorAddress;
  const hasHistory = input.historyAvailable === true;

  if (hasCreator) {
    evidence.push({
      fact: `Creator address: ${input.creatorAddress}`,
      source: 'blockchain',
      observedAt: input.dataTimestamp,
      value: input.creatorAddress,
      confidence: 0.98,
    });

    if (input.creationTimestamp) {
      evidence.push({
        fact: `Token created at ${input.creationTimestamp}`,
        source: 'blockchain',
        observedAt: input.dataTimestamp,
        confidence: 0.98,
      });
    }

    if (input.creationTx) {
      evidence.push({
        fact: `Creation transaction: ${input.creationTx}`,
        source: 'blockchain',
        observedAt: input.dataTimestamp,
        value: input.creationTx,
        confidence: 0.99,
      });
    }

    // Known launches
    if (input.knownLaunches != null && input.knownLaunches > 0) {
      evidence.push({
        fact: `Creator has ${input.knownLaunches} known previous launch(es)`,
        source: 'blockchain',
        observedAt: input.dataTimestamp,
        value: input.knownLaunches,
        confidence: 0.80,
      });

      if (input.knownLaunches > 10) {
        signals.push({
          id: `sig_cre_many_launches_${Date.now()}`,
          type: 'MANY_CREATOR_LAUNCHES',
          category: 'CREATOR',
          severity: 'LOW',
          polarity: 'NEUTRAL',
          value: input.knownLaunches,
          confidence: 0.78,
          evidence: [{
            fact: `Creator has launched ${input.knownLaunches} tokens — high launch volume may warrant review`,
            source: 'blockchain',
            observedAt: input.dataTimestamp,
            confidence: 0.78,
          }],
          observedAt: now,
          methodologyVersion: METHODOLOGY_VERSION,
          metadata: {},
        });
      }
    }

    if (!hasHistory) {
      missingData.push({
        category: 'CREATOR',
        description: 'Creator launch history unavailable — reputation cannot be assessed',
        impact: 'LIMITS_ANALYSIS',
      });
    }
  } else {
    // Creator unknown — this is a valid state
    missingData.push({
      category: 'CREATOR',
      description: 'Creator address unknown',
      impact: 'REDUCES_CONFIDENCE',
    });
  }

  // ── Score ──
  // Missing data → "Unknown", not high risk.
  // Score defaults to 50 (neutral) when data is unavailable.
  let score = 50;
  let confidence: number;

  if (!hasCreator) {
    confidence = 0.10;
  } else if (!hasHistory) {
    confidence = 0.35;
  } else {
    confidence = 0.70;
    // With full history we could adjust score, but Sprint 5 doesn't compute reputation
    score = 55; // Slightly above neutral when creator is identifiable with history
  }

  const level = hasCreator ? (hasHistory ? 'MODERATE' : 'UNKNOWN') : 'UNKNOWN';

  const creatorObservation: CreatorObservation = {
    tokenId,
    creatorAddress: input.creatorAddress,
    creationTimestamp: input.creationTimestamp,
    creationTx: input.creationTx,
    knownLaunches: input.knownLaunches ?? 0,
    historyAvailable: hasHistory,
    observedAt: now,
  };

  return {
    dimension: {
      category: 'CREATOR',
      score,
      level: level as 'MODERATE' | 'UNKNOWN',
      confidence,
      evidence,
      signals,
      lastUpdated: now,
    },
    signals,
    missingData,
    creatorObservation,
  };
}
