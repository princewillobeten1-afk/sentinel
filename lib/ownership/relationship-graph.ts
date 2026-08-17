/**
 * Wallet Relationship Graph
 * Sprint 6
 *
 * In-memory graph representation using adjacency lists.
 * Stores weighted, typed edges between wallet addresses.
 *
 * Architecture decision: Relational storage + in-memory adjacency lists.
 * No dedicated graph database — justified at this scale (thousands of tokens × hundreds of wallets).
 * Graph is rebuilt from relationship store on demand.
 */

import type { WalletRelationshipEdge } from './types';

interface AdjacencyEntry {
  neighbor: string;
  edge: WalletRelationshipEdge;
}

export class WalletGraph {
  private adjacency: Map<string, AdjacencyEntry[]> = new Map();
  private edgeIndex: Map<string, WalletRelationshipEdge> = new Map();

  // ── Vertex Operations ──

  /** Get all wallet addresses in the graph */
  getAllWallets(): string[] {
    return Array.from(this.adjacency.keys());
  }

  /** Get the number of wallets in the graph */
  get walletCount(): number {
    return this.adjacency.size;
  }

  /** Get the total number of edges */
  get edgeCount(): number {
    return this.edgeIndex.size;
  }

  // ── Edge Operations ──

  /** Add a weighted, typed edge between two wallets (bidirectional) */
  addEdge(edge: WalletRelationshipEdge): void {
    // Prevent duplicate edges
    if (this.edgeIndex.has(edge.id)) return;
    this.edgeIndex.set(edge.id, edge);

    // Add to adjacency list (bidirectional)
    this.ensureVertex(edge.source);
    this.ensureVertex(edge.target);

    this.adjacency.get(edge.source)!.push({ neighbor: edge.target, edge });
    this.adjacency.get(edge.target)!.push({ neighbor: edge.source, edge });
  }

  /** Get all neighbors of a wallet with their edge data */
  getNeighbors(wallet: string): AdjacencyEntry[] {
    return this.adjacency.get(wallet) || [];
  }

  /** Get all edges between two specific wallets */
  getEdges(walletA: string, walletB: string): WalletRelationshipEdge[] {
    const neighbors = this.adjacency.get(walletA) || [];
    return neighbors
      .filter(n => n.neighbor === walletB)
      .map(n => n.edge);
  }

  /** Get the strongest single edge between two wallets */
  getStrongestEdge(walletA: string, walletB: string): WalletRelationshipEdge | null {
    const edges = this.getEdges(walletA, walletB);
    if (edges.length === 0) return null;
    return edges.reduce((best, e) => e.strength > best.strength ? e : best, edges[0]);
  }

  /** Get all edges in the graph */
  getAllEdges(): WalletRelationshipEdge[] {
    return Array.from(this.edgeIndex.values());
  }

  // ── Graph Analysis ──

  /**
   * Find the strongest path between two wallets using BFS.
   * Returns the path (wallet addresses) and the minimum edge strength along it.
   * maxHops limits search depth to prevent expensive traversals.
   */
  getStrongestPath(
    start: string,
    end: string,
    maxHops = 4,
  ): { path: string[]; minStrength: number } | null {
    if (start === end) return { path: [start], minStrength: 1.0 };
    if (!this.adjacency.has(start) || !this.adjacency.has(end)) return null;

    // BFS with path tracking
    const visited = new Set<string>();
    const queue: { wallet: string; path: string[]; minStrength: number }[] = [
      { wallet: start, path: [start], minStrength: 1.0 },
    ];

    let bestResult: { path: string[]; minStrength: number } | null = null;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.path.length > maxHops + 1) continue;

      const neighbors = this.getNeighbors(current.wallet);
      for (const { neighbor, edge } of neighbors) {
        if (visited.has(neighbor)) continue;

        const pathStrength = Math.min(current.minStrength, edge.strength);
        const newPath = [...current.path, neighbor];

        if (neighbor === end) {
          if (!bestResult || pathStrength > bestResult.minStrength) {
            bestResult = { path: newPath, minStrength: pathStrength };
          }
          continue;
        }

        if (newPath.length <= maxHops) {
          queue.push({ wallet: neighbor, path: newPath, minStrength: pathStrength });
        }
      }

      visited.add(current.wallet);
    }

    return bestResult;
  }

  /**
   * Get the degree (number of connections) for a wallet.
   */
  getDegree(wallet: string): number {
    return (this.adjacency.get(wallet) || []).length;
  }

  /**
   * Get the aggregate relationship strength for a wallet.
   * Sum of all edge strengths connected to this wallet.
   */
  getAggregateStrength(wallet: string): number {
    const neighbors = this.adjacency.get(wallet) || [];
    return neighbors.reduce((sum, n) => sum + n.edge.strength, 0);
  }

  // ── Graph Mutation ──

  /**
   * Remove all edges below a strength threshold.
   * Returns the number of edges removed.
   */
  removeWeak(threshold: number): number {
    const edgesToRemove: string[] = [];

    for (const [id, edge] of this.edgeIndex) {
      if (edge.strength < threshold) {
        edgesToRemove.push(id);
      }
    }

    for (const id of edgesToRemove) {
      const edge = this.edgeIndex.get(id)!;
      this.edgeIndex.delete(id);

      // Remove from adjacency
      const sourceList = this.adjacency.get(edge.source);
      if (sourceList) {
        const idx = sourceList.findIndex(e => e.edge.id === id);
        if (idx >= 0) sourceList.splice(idx, 1);
      }

      const targetList = this.adjacency.get(edge.target);
      if (targetList) {
        const idx = targetList.findIndex(e => e.edge.id === id);
        if (idx >= 0) targetList.splice(idx, 1);
      }
    }

    // Clean up isolated vertices
    for (const [wallet, entries] of this.adjacency) {
      if (entries.length === 0) {
        this.adjacency.delete(wallet);
      }
    }

    return edgesToRemove.length;
  }

  /**
   * Create a subgraph containing only edges related to a specific token context.
   */
  subgraphForToken(tokenId: string, relevantWallets: Set<string>): WalletGraph {
    const sub = new WalletGraph();
    for (const edge of this.edgeIndex.values()) {
      if (relevantWallets.has(edge.source) || relevantWallets.has(edge.target)) {
        sub.addEdge(edge);
      }
    }
    return sub;
  }

  /**
   * Detect cycles in the funding graph starting from a wallet.
   * Returns paths that form cycles (useful for circular funding detection §58).
   */
  detectCycles(startWallet: string, maxDepth = 5): string[][] {
    const cycles: string[][] = [];

    const dfs = (wallet: string, path: string[], visited: Set<string>) => {
      if (path.length > maxDepth) return;

      const neighbors = this.getNeighbors(wallet);
      for (const { neighbor } of neighbors) {
        if (neighbor === startWallet && path.length >= 3) {
          cycles.push([...path, neighbor]);
          continue;
        }
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          dfs(neighbor, [...path, neighbor], visited);
          visited.delete(neighbor);
        }
      }
    };

    const visited = new Set<string>([startWallet]);
    dfs(startWallet, [startWallet], visited);
    return cycles;
  }

  // ── Internal ──

  private ensureVertex(wallet: string): void {
    if (!this.adjacency.has(wallet)) {
      this.adjacency.set(wallet, []);
    }
  }
}
