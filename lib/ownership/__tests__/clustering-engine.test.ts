import { describe, it, expect } from 'vitest';
import { generateClusters, calculateClusterConfidence } from '../clustering-engine';
import { WalletGraph } from '../relationship-graph';
import type { WalletRelationshipEdge } from '../types';

describe('Wallet Clustering Engine', () => {
  const edgeHigh: WalletRelationshipEdge = {
    id: 'e_high', source: 'walletA', target: 'walletB', type: 'SHARED_FUNDING',
    strength: 0.85, evidence: [], firstObserved: '2026-01-01', lastObserved: '2026-01-02',
    confidence: 0.9, methodologyVersion: 'v1',
  };

  const edgeLow: WalletRelationshipEdge = {
    id: 'e_low', source: 'walletB', target: 'walletC', type: 'TEMPORAL_CORRELATION',
    strength: 0.20, evidence: [], firstObserved: '2026-01-01', lastObserved: '2026-01-02',
    confidence: 0.3, methodologyVersion: 'v1',
  };

  it('filters edges below minimum strength threshold', () => {
    const graph = new WalletGraph();
    graph.addEdge(edgeHigh);
    graph.addEdge(edgeLow);

    const clusters = generateClusters(graph, { minStrength: 0.4 });
    expect(clusters.length).toBe(1);
    expect(clusters[0].wallets).toContain('walletA');
    expect(clusters[0].wallets).toContain('walletB');
    expect(clusters[0].wallets).not.toContain('walletC');
  });

  it('calculates cluster confidence with edge count and average strength', () => {
    const confidence = calculateClusterConfidence([edgeHigh]);
    expect(confidence.score).toBeGreaterThan(0.4);
    expect(confidence.score).toBeLessThanOrEqual(1.0);
  });
});
