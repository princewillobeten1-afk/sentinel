import { describe, it, expect } from 'vitest';
import { analyzeFundingRelationships, calculateFundingStrength } from '../funding-analyzer';
import type { FundingEvent } from '../types';

describe('Funding Graph Analyzer', () => {
  const mockEvents: FundingEvent[] = [
    { id: 'f1', source: 'sourceA', recipient: 'recipientB', amountSol: 10, timestamp: '2026-01-01T00:00:00Z', txSignature: 'tx1' },
    { id: 'f2', source: 'sourceA', recipient: 'recipientB', amountSol: 5, timestamp: '2026-01-02T00:00:00Z', txSignature: 'tx2' },
    { id: 'f3', source: 'sourceA', recipient: 'recipientC', amountSol: 0.001, timestamp: '2026-01-01T00:00:00Z', txSignature: 'tx3' }, // micro transfer
  ];

  it('aggregates raw funding events into relationships and ignores micro transfers', () => {
    const relationships = analyzeFundingRelationships(mockEvents);
    expect(relationships.length).toBe(1);
    expect(relationships[0].sourceWallet).toBe('sourceA');
    expect(relationships[0].recipientWallet).toBe('recipientB');
    expect(relationships[0].eventCount).toBe(2);
    expect(relationships[0].totalAmountSol).toBe(15);
  });

  it('calculates normalized funding relationship strength between 0.0 and 1.0', () => {
    const rel = analyzeFundingRelationships(mockEvents)[0];
    const strength = calculateFundingStrength(rel);
    expect(strength).toBeGreaterThan(0);
    expect(strength).toBeLessThanOrEqual(1.0);
  });
});
