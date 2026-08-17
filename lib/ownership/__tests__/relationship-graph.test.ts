import { describe, it, expect } from 'vitest';
import { WalletGraph } from '../relationship-graph';
import type { WalletRelationshipEdge } from '../types';

describe('WalletGraph', () => {
  const edge1: WalletRelationshipEdge = {
    id: 'e1', source: 'walletA', target: 'walletB', type: 'SHARED_FUNDING',
    strength: 0.8, evidence: [], firstObserved: '2026-01-01', lastObserved: '2026-01-02',
    confidence: 0.9, methodologyVersion: 'v1',
  };

  const edge2: WalletRelationshipEdge = {
    id: 'e2', source: 'walletB', target: 'walletC', type: 'COORDINATED_ACQUISITION',
    strength: 0.6, evidence: [], firstObserved: '2026-01-01', lastObserved: '2026-01-02',
    confidence: 0.7, methodologyVersion: 'v1',
  };

  const edge3: WalletRelationshipEdge = {
    id: 'e3', source: 'walletC', target: 'walletA', type: 'DIRECT_TRANSFER',
    strength: 0.9, evidence: [], firstObserved: '2026-01-01', lastObserved: '2026-01-02',
    confidence: 0.95, methodologyVersion: 'v1',
  };

  it('adds edges and updates vertex count', () => {
    const graph = new WalletGraph();
    graph.addEdge(edge1);
    graph.addEdge(edge2);

    expect(graph.walletCount).toBe(3);
    expect(graph.edgeCount).toBe(2);
    expect(graph.getNeighbors('walletB').length).toBe(2);
  });

  it('finds strongest path using BFS', () => {
    const graph = new WalletGraph();
    graph.addEdge(edge1);
    graph.addEdge(edge2);

    const path = graph.getStrongestPath('walletA', 'walletC');
    expect(path).not.toBeNull();
    expect(path?.path).toEqual(['walletA', 'walletB', 'walletC']);
    expect(path?.minStrength).toBe(0.6);
  });

  it('detects cycles in funding graph', () => {
    const graph = new WalletGraph();
    graph.addEdge(edge1);
    graph.addEdge(edge2);
    graph.addEdge(edge3);

    const cycles = graph.detectCycles('walletA');
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0][0]).toBe('walletA');
  });

  it('prunes weak edges', () => {
    const graph = new WalletGraph();
    graph.addEdge(edge1); // 0.8
    graph.addEdge(edge2); // 0.6

    const removed = graph.removeWeak(0.7);
    expect(removed).toBe(1);
    expect(graph.edgeCount).toBe(1);
  });
});
