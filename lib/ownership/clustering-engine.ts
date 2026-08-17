/**
 * Wallet Clustering Engine
 * Sprint 6
 *
 * Algorithm: Weighted connected components with configurable minimum edge strength threshold.
 *
 * Design decision: Community detection algorithms (Louvain, Leiden) are designed for large
 * social graphs. At our scale, weighted connected components with a minimum edge strength
 * threshold provide deterministic, explainable clusters.
 *
 * Each edge has a normalized strength score (0.0–1.0).
 * Only edges above the clustering threshold (default 0.4) form cluster connections.
 *
 * Does NOT automatically merge every connected wallet into one cluster.
 * Requires meaningful edge weight.
 *
 * Methodology version: wallet-clustering-v1.0
 */

import type {
  WalletClusterV2,
  ClusterConfidence,
  WalletRelationshipEdge,
  OwnershipEvidence,
} from './types';
import { WalletGraph } from './relationship-graph';

const METHODOLOGY_VERSION = 'wallet-clustering-v1.0';

/** Default minimum edge strength to include in clustering */
const DEFAULT_MIN_STRENGTH = 0.4;

/** Maximum cluster size before splitting is recommended */
const MAX_CLUSTER_SIZE = 50;

/** Minimum edges required to form a meaningful cluster */
const MIN_EDGES_FOR_CLUSTER = 1;

export interface ClusteringOptions {
  /** Minimum edge strength to consider (default: 0.4) */
  minStrength?: number;
  /** Scope of clustering */
  scope?: 'GLOBAL' | 'TOKEN_SPECIFIC';
  /** Token context for TOKEN_SPECIFIC scope */
  tokenContext?: string;
  /** Maximum cluster size before warning (default: 50) */
  maxClusterSize?: number;
}

/**
 * Generate wallet clusters from a relationship graph.
 *
 * Algorithm:
 * 1. Filter graph to edges above minStrength threshold
 * 2. Find connected components via BFS
 * 3. Filter out single-wallet components and components without enough edges
 * 4. Calculate cluster confidence for each component
 * 5. Sort by confidence descending
 */
export function generateClusters(
  graph: WalletGraph,
  options: ClusteringOptions = {},
): WalletClusterV2[] {
  const {
    minStrength = DEFAULT_MIN_STRENGTH,
    scope = 'GLOBAL',
    tokenContext,
    maxClusterSize = MAX_CLUSTER_SIZE,
  } = options;

  // 1. Build a filtered adjacency from edges above threshold
  const filteredEdges: WalletRelationshipEdge[] = graph
    .getAllEdges()
    .filter(e => e.strength >= minStrength);

  if (filteredEdges.length === 0) return [];

  // Build adjacency from filtered edges
  const adjacency = new Map<string, { neighbor: string; edge: WalletRelationshipEdge }[]>();

  for (const edge of filteredEdges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, []);
    adjacency.get(edge.source)!.push({ neighbor: edge.target, edge });
    adjacency.get(edge.target)!.push({ neighbor: edge.source, edge });
  }

  // 2. Find connected components via BFS
  const visited = new Set<string>();
  const components: { wallets: string[]; edges: WalletRelationshipEdge[] }[] = [];

  for (const wallet of adjacency.keys()) {
    if (visited.has(wallet)) continue;

    const componentWallets: string[] = [];
    const componentEdgeIds = new Set<string>();
    const queue: string[] = [wallet];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      componentWallets.push(current);

      const neighbors = adjacency.get(current) || [];
      for (const { neighbor, edge } of neighbors) {
        componentEdgeIds.add(edge.id);
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    // Collect unique edges for this component
    const componentEdges = filteredEdges.filter(e => componentEdgeIds.has(e.id));

    components.push({
      wallets: componentWallets,
      edges: componentEdges,
    });
  }

  // 3. Filter: require ≥2 wallets and minimum edges
  const validComponents = components.filter(
    c => c.wallets.length >= 2 && c.edges.length >= MIN_EDGES_FOR_CLUSTER,
  );

  // 4. Build clusters with confidence
  const clusters: WalletClusterV2[] = validComponents.map((comp, idx) => {
    const confidence = calculateClusterConfidence(comp.edges);

    // Generate label based on cluster characteristics
    let label: string | undefined;
    if (comp.wallets.length > maxClusterSize) {
      label = `Large cluster (${comp.wallets.length} wallets — may contain false connections)`;
    }

    return {
      id: `cluster_${scope.toLowerCase()}_${idx}_${Date.now()}`,
      wallets: comp.wallets,
      edges: comp.edges,
      clusterConfidence: confidence,
      label,
      scope,
      tokenContext,
      createdAt: new Date().toISOString(),
      methodologyVersion: METHODOLOGY_VERSION,
    };
  });

  // 5. Sort by confidence descending
  return clusters.sort((a, b) => b.clusterConfidence.score - a.clusterConfidence.score);
}

/**
 * Calculate cluster confidence from its edges.
 *
 * Confidence incorporates:
 * - Number of edges (more edges = more evidence)
 * - Average edge strength (stronger edges = higher confidence)
 * - Edge type diversity (multiple relationship types = stronger)
 * - Presence of conflicting evidence
 */
export function calculateClusterConfidence(
  edges: WalletRelationshipEdge[],
): ClusterConfidence {
  if (edges.length === 0) {
    return {
      score: 0,
      evidenceCount: 0,
      strongestEvidence: null,
      conflictingEvidence: [],
      methodologyVersion: METHODOLOGY_VERSION,
    };
  }

  // Average edge strength
  const avgStrength = edges.reduce((sum, e) => sum + e.strength, 0) / edges.length;

  // Edge type diversity bonus
  const uniqueTypes = new Set(edges.map(e => e.type));
  const diversityBonus = Math.min(0.15, (uniqueTypes.size - 1) * 0.05);

  // Edge count factor (diminishing returns after 5)
  const edgeCountFactor = Math.min(1.0, edges.length / 5);

  // Confidence score
  const score = Math.min(1.0,
    avgStrength * 0.50 +
    edgeCountFactor * 0.30 +
    diversityBonus +
    0.05, // base
  );

  // Find strongest evidence
  const allEvidence = edges.flatMap(e => e.evidence);
  const strongest = allEvidence.length > 0
    ? allEvidence.reduce((best, ev) => ev.confidence > best.confidence ? ev : best)
    : null;

  // Conflicting evidence: edges with very low strength mixed with high
  const conflicting: OwnershipEvidence[] = [];
  const minEdgeStrength = Math.min(...edges.map(e => e.strength));
  const maxEdgeStrength = Math.max(...edges.map(e => e.strength));

  if (maxEdgeStrength - minEdgeStrength > 0.5 && edges.length > 2) {
    conflicting.push({
      fact: `Edge strength variance is high (${minEdgeStrength.toFixed(2)} to ${maxEdgeStrength.toFixed(2)}) — some connections are significantly weaker`,
      source: 'clustering_engine',
      observedAt: new Date().toISOString(),
      confidence: 0.85,
    });
  }

  return {
    score: Math.round(score * 100) / 100,
    evidenceCount: allEvidence.length,
    strongestEvidence: strongest,
    conflictingEvidence: conflicting,
    methodologyVersion: METHODOLOGY_VERSION,
  };
}
