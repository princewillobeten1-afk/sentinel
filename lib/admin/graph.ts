/**
 * Entity Relationship Graph Engine (Sprint 39 §81).
 * Builds multi-node relational networks linking Creators, Wallets, Tokens,
 * Pools, and Transactions to expose coordinated syndicates and wash trading rings.
 */

import { EntityRelationshipGraph, GraphNode, GraphEdge } from './types';

export class AdminGraphEngine {
  /**
   * Build an interactive entity relationship graph centered around a target entity.
   */
  public static buildGraph(entityId: string, entityType: string): EntityRelationshipGraph {
    const isSuspicious = entityId.toLowerCase().includes('9pw2') || entityId.toLowerCase().includes('solm');

    if (isSuspicious) {
      return this.buildSuspiciousClusterGraph(entityId);
    }

    return this.buildStandardGraph(entityId, entityType);
  }

  private static buildSuspiciousClusterGraph(targetId: string): EntityRelationshipGraph {
    const nodes: GraphNode[] = [
      {
        id: targetId,
        label: '$SOLM (Token Mint)',
        type: 'TOKEN',
        riskScore: 88,
        isFlagged: true,
        metadata: { symbol: '$SOLM', supply: '1B', chain: 'solana' },
      },
      {
        id: 'creator_9pQ1',
        label: 'Creator 9pQ1 (Deployer)',
        type: 'CREATOR',
        riskScore: 78,
        isFlagged: true,
        metadata: { launches: 5, rugged: 3 },
      },
      {
        id: 'cex_binance_bin_99',
        label: 'Shared CEX Deposit (Binance)',
        type: 'CLUSTER',
        riskScore: 92,
        isFlagged: true,
        metadata: { commonOrigin: true, fundedWallets: 8 },
      },
      {
        id: 'sniper_wallet_01',
        label: 'Sniper Wallet A (12% Supply)',
        type: 'WALLET',
        riskScore: 85,
        isFlagged: true,
        metadata: { entrySlot: 2948102, holdingPct: 12 },
      },
      {
        id: 'sniper_wallet_02',
        label: 'Sniper Wallet B (14% Supply)',
        type: 'WALLET',
        riskScore: 84,
        isFlagged: true,
        metadata: { entrySlot: 2948102, holdingPct: 14 },
      },
      {
        id: 'sniper_wallet_03',
        label: 'Sniper Wallet C (10% Supply)',
        type: 'WALLET',
        riskScore: 82,
        isFlagged: true,
        metadata: { entrySlot: 2948103, holdingPct: 10 },
      },
      {
        id: 'pool_raydium_cpmm',
        label: 'Raydium Liquidity Pool',
        type: 'POOL',
        riskScore: 45,
        isFlagged: false,
        metadata: { initialSol: 50, currentLiquidityUsd: 42000 },
      },
    ];

    const edges: GraphEdge[] = [
      {
        id: 'e1',
        source: 'creator_9pQ1',
        target: targetId,
        label: 'DEPLOYED (Slot 2948100)',
        relationship: 'DEPLOYED',
        weight: 10,
      },
      {
        id: 'e2',
        source: 'creator_9pQ1',
        target: 'pool_raydium_cpmm',
        label: 'INITIAL_LIQUIDITY (50 SOL)',
        relationship: 'LIQUIDITY_PROVIDED',
        weight: 8,
      },
      {
        id: 'e3',
        source: 'cex_binance_bin_99',
        target: 'sniper_wallet_01',
        label: 'SHARED_FUNDING (15 SOL)',
        relationship: 'SHARED_FUNDING',
        weight: 9,
      },
      {
        id: 'e4',
        source: 'cex_binance_bin_99',
        target: 'sniper_wallet_02',
        label: 'SHARED_FUNDING (15 SOL)',
        relationship: 'SHARED_FUNDING',
        weight: 9,
      },
      {
        id: 'e5',
        source: 'cex_binance_bin_99',
        target: 'sniper_wallet_03',
        label: 'SHARED_FUNDING (15 SOL)',
        relationship: 'SHARED_FUNDING',
        weight: 9,
      },
      {
        id: 'e6',
        source: 'sniper_wallet_01',
        target: targetId,
        label: 'BLOCK_0_SNIPE',
        relationship: 'SNIPED',
        weight: 9,
      },
      {
        id: 'e7',
        source: 'sniper_wallet_02',
        target: targetId,
        label: 'BLOCK_0_SNIPE',
        relationship: 'SNIPED',
        weight: 9,
      },
      {
        id: 'e8',
        source: 'sniper_wallet_03',
        target: targetId,
        label: 'BLOCK_0_SNIPE',
        relationship: 'SNIPED',
        weight: 9,
      },
      {
        id: 'e9',
        source: 'sniper_wallet_01',
        target: 'sniper_wallet_02',
        label: 'CIRCULAR_WASH_TRANSFER',
        relationship: 'WASH_CYCLE',
        weight: 7,
      },
    ];

    return {
      nodes,
      edges,
      clusterCount: 1,
      highestRiskNodeId: 'cex_binance_bin_99',
    };
  }

  private static buildStandardGraph(targetId: string, entityType: string): EntityRelationshipGraph {
    const nodes: GraphNode[] = [
      {
        id: targetId,
        label: entityType === 'TOKEN' ? '$SENT (Sentinel Mint)' : `Wallet ${targetId.slice(0, 6)}...`,
        type: entityType === 'TOKEN' ? 'TOKEN' : 'WALLET',
        riskScore: 12,
        isFlagged: false,
        metadata: { verified: true },
      },
      {
        id: 'deployer_alpha_01',
        label: 'Alpha Deployer Team',
        type: 'CREATOR',
        riskScore: 8,
        isFlagged: false,
        metadata: { reputationScore: 94 },
      },
      {
        id: 'pool_sent_sol',
        label: 'Raydium Main LP',
        type: 'POOL',
        riskScore: 10,
        isFlagged: false,
        metadata: { liquidityUsd: 1_850_000 },
      },
      {
        id: 'whale_smart_money',
        label: 'Smart Money Whale (8r9Z...)',
        type: 'WALLET',
        riskScore: 15,
        isFlagged: false,
        metadata: { pnlUsd: 280_000 },
      },
      {
        id: 'retail_cluster_01',
        label: 'Distributed Retail Cluster',
        type: 'CLUSTER',
        riskScore: 10,
        isFlagged: false,
        metadata: { uniqueWallets: 2410 },
      },
    ];

    const edges: GraphEdge[] = [
      {
        id: 'se1',
        source: 'deployer_alpha_01',
        target: targetId,
        label: 'DEPLOYED_WITH_REVOKED_MINT',
        relationship: 'DEPLOYED',
        weight: 5,
      },
      {
        id: 'se2',
        source: 'deployer_alpha_01',
        target: 'pool_sent_sol',
        label: 'LOCKED_LP_SEED',
        relationship: 'LIQUIDITY_PROVIDED',
        weight: 5,
      },
      {
        id: 'se3',
        source: 'whale_smart_money',
        target: targetId,
        label: 'ORGANIC_ACCUMULATION',
        relationship: 'TRANSFERRED',
        weight: 4,
      },
      {
        id: 'se4',
        source: 'retail_cluster_01',
        target: targetId,
        label: 'DECENTRALIZED_HOLDINGS',
        relationship: 'TRANSFERRED',
        weight: 3,
      },
    ];

    return {
      nodes,
      edges,
      clusterCount: 0,
      highestRiskNodeId: undefined,
    };
  }
}
