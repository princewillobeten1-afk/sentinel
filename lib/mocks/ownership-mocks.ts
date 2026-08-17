/**
 * Ownership Mock Data
 * Sprint 6
 *
 * Rich mock data for all 4 tokens covering:
 * - SENT: Healthy ownership, broad distribution, no concerning clusters
 * - QUANT: Concentrated ownership, suspicious cluster patterns
 * - BONK: Established token, large holder clusters
 * - ALPHA: New launch, coordinated wallet activity
 */

import type {
  WalletRelationshipEdge,
  FundingEvent,
  EffectiveOwnershipReport,
  WalletClusterV2,
  OwnershipEntity,
  OwnershipConcentration,
} from '../ownership/types';
import type { HolderRecord } from '../ownership/effective-ownership';

const now = new Date().toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();
const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();

// ────────────────────────────────────────────────────────────────────────────
// Mock Holder Records
// ────────────────────────────────────────────────────────────────────────────

export const MOCK_HOLDERS: Record<string, HolderRecord[]> = {
  SENT: [
    { address: 'SENTh1a2b3c4d5e6f7g8h9i0j', balance: 15_000_000, labels: ['liquidity_pool'] },
    { address: 'SENTa1b2c3d4e5f6g7h8i9j0k', balance: 8_500_000 },
    { address: 'SENTb2c3d4e5f6g7h8i9j0k1l', balance: 4_200_000 },
    { address: 'SENTc3d4e5f6g7h8i9j0k1l2m', balance: 2_800_000 },
    { address: 'SENTd4e5f6g7h8i9j0k1l2m3n', balance: 1_500_000 },
    { address: 'SENTe5f6g7h8i9j0k1l2m3n4o', balance: 900_000 },
    { address: 'SENTf6g7h8i9j0k1l2m3n4o5p', balance: 600_000 },
    { address: 'SENTg7h8i9j0k1l2m3n4o5p6q', balance: 350_000 },
  ],
  QUANT: [
    { address: 'QUANh1a2b3c4d5e6f7g8h9i0j', balance: 35_000_000 },
    { address: 'QUANa1b2c3d4e5f6g7h8i9j0k', balance: 18_000_000 },
    { address: 'QUANb2c3d4e5f6g7h8i9j0k1l', balance: 12_000_000 },
    { address: 'QUANc3d4e5f6g7h8i9j0k1l2m', balance: 8_000_000 },
    { address: 'QUANd4e5f6g7h8i9j0k1l2m3n', balance: 5_000_000 },
    { address: 'QUANe5f6g7h8i9j0k1l2m3n4o', balance: 3_000_000 },
  ],
  BONK: [
    { address: 'BONKh1a2b3c4d5e6f7g8h9i0j', balance: 50_000_000_000, labels: ['liquidity_pool'] },
    { address: 'BONKa1b2c3d4e5f6g7h8i9j0k', balance: 25_000_000_000 },
    { address: 'BONKb2c3d4e5f6g7h8i9j0k1l', balance: 15_000_000_000 },
    { address: 'BONKc3d4e5f6g7h8i9j0k1l2m', balance: 10_000_000_000 },
    { address: 'BONKd4e5f6g7h8i9j0k1l2m3n', balance: 5_000_000_000 },
    { address: 'BONKe5f6g7h8i9j0k1l2m3n4o', balance: 3_000_000_000 },
    { address: 'BONKf6g7h8i9j0k1l2m3n4o5p', balance: 2_000_000_000 },
  ],
  ALPHA: [
    { address: 'ALPHh1a2b3c4d5e6f7g8h9i0j', balance: 45_000_000 },
    { address: 'ALPHa1b2c3d4e5f6g7h8i9j0k', balance: 20_000_000 },
    { address: 'ALPHb2c3d4e5f6g7h8i9j0k1l', balance: 12_000_000 },
    { address: 'ALPHc3d4e5f6g7h8i9j0k1l2m', balance: 8_000_000 },
    { address: 'ALPHd4e5f6g7h8i9j0k1l2m3n', balance: 5_000_000 },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// Mock Wallet Relationships
// ────────────────────────────────────────────────────────────────────────────

export const MOCK_EDGES: Record<string, WalletRelationshipEdge[]> = {
  SENT: [
    {
      id: 'edge_sent_1', source: 'SENTa1b2c3d4e5f6g7h8i9j0k', target: 'SENTb2c3d4e5f6g7h8i9j0k1l',
      type: 'SHARED_FUNDING', strength: 0.35, evidence: [{ fact: 'Low-strength shared funding source', source: 'funding_analysis', observedAt: lastWeek, confidence: 0.60 }],
      firstObserved: lastWeek, lastObserved: now, confidence: 0.55, methodologyVersion: 'funding-analysis-v1.0',
    },
  ],
  QUANT: [
    {
      id: 'edge_quant_1', source: 'QUANh1a2b3c4d5e6f7g8h9i0j', target: 'QUANa1b2c3d4e5f6g7h8i9j0k',
      type: 'SHARED_FUNDING', strength: 0.82, evidence: [{ fact: '90% of wallet B funded by wallet A', source: 'funding_analysis', observedAt: yesterday, confidence: 0.92 }],
      firstObserved: lastWeek, lastObserved: now, confidence: 0.90, methodologyVersion: 'funding-analysis-v1.0',
    },
    {
      id: 'edge_quant_2', source: 'QUANh1a2b3c4d5e6f7g8h9i0j', target: 'QUANb2c3d4e5f6g7h8i9j0k1l',
      type: 'SHARED_FUNDING', strength: 0.75, evidence: [{ fact: '78% of wallet C funded by wallet A', source: 'funding_analysis', observedAt: yesterday, confidence: 0.88 }],
      firstObserved: lastWeek, lastObserved: now, confidence: 0.85, methodologyVersion: 'funding-analysis-v1.0',
    },
    {
      id: 'edge_quant_3', source: 'QUANa1b2c3d4e5f6g7h8i9j0k', target: 'QUANb2c3d4e5f6g7h8i9j0k1l',
      type: 'COORDINATED_ACQUISITION', strength: 0.68, evidence: [{ fact: 'Coordinated purchases within 3-minute windows on 5 occasions', source: 'behavioral_analysis', observedAt: yesterday, confidence: 0.82 }],
      firstObserved: lastWeek, lastObserved: yesterday, confidence: 0.78, methodologyVersion: 'behavioral-correlation-v1.0',
    },
  ],
  BONK: [
    {
      id: 'edge_bonk_1', source: 'BONKa1b2c3d4e5f6g7h8i9j0k', target: 'BONKb2c3d4e5f6g7h8i9j0k1l',
      type: 'SHARED_FUNDING', strength: 0.55, evidence: [{ fact: 'Common funding source (62% overlap)', source: 'funding_analysis', observedAt: lastWeek, confidence: 0.78 }],
      firstObserved: lastWeek, lastObserved: now, confidence: 0.72, methodologyVersion: 'funding-analysis-v1.0',
    },
    {
      id: 'edge_bonk_2', source: 'BONKc3d4e5f6g7h8i9j0k1l2m', target: 'BONKd4e5f6g7h8i9j0k1l2m3n',
      type: 'TEMPORAL_CORRELATION', strength: 0.48, evidence: [{ fact: 'Similar entry/exit timing on 4 occasions', source: 'behavioral_analysis', observedAt: lastWeek, confidence: 0.68 }],
      firstObserved: lastWeek, lastObserved: yesterday, confidence: 0.65, methodologyVersion: 'behavioral-correlation-v1.0',
    },
  ],
  ALPHA: [
    {
      id: 'edge_alpha_1', source: 'ALPHh1a2b3c4d5e6f7g8h9i0j', target: 'ALPHa1b2c3d4e5f6g7h8i9j0k',
      type: 'SHARED_FUNDING', strength: 0.90, evidence: [{ fact: '95% of wallet B funded by wallet A within 2 hours of token creation', source: 'funding_analysis', observedAt: yesterday, confidence: 0.95 }],
      firstObserved: yesterday, lastObserved: now, confidence: 0.93, methodologyVersion: 'funding-analysis-v1.0',
    },
    {
      id: 'edge_alpha_2', source: 'ALPHh1a2b3c4d5e6f7g8h9i0j', target: 'ALPHb2c3d4e5f6g7h8i9j0k1l',
      type: 'SHARED_FUNDING', strength: 0.85, evidence: [{ fact: '88% of wallet C funded by wallet A', source: 'funding_analysis', observedAt: yesterday, confidence: 0.92 }],
      firstObserved: yesterday, lastObserved: now, confidence: 0.90, methodologyVersion: 'funding-analysis-v1.0',
    },
    {
      id: 'edge_alpha_3', source: 'ALPHa1b2c3d4e5f6g7h8i9j0k', target: 'ALPHb2c3d4e5f6g7h8i9j0k1l',
      type: 'COORDINATED_ACQUISITION', strength: 0.78, evidence: [{ fact: 'Simultaneous purchases within 30-second windows across 8 transactions', source: 'behavioral_analysis', observedAt: yesterday, confidence: 0.88 }],
      firstObserved: yesterday, lastObserved: now, confidence: 0.85, methodologyVersion: 'behavioral-correlation-v1.0',
    },
    {
      id: 'edge_alpha_4', source: 'ALPHc3d4e5f6g7h8i9j0k1l2m', target: 'ALPHd4e5f6g7h8i9j0k1l2m3n',
      type: 'SHARED_FUNDING', strength: 0.65, evidence: [{ fact: 'Common funding source (70% overlap)', source: 'funding_analysis', observedAt: yesterday, confidence: 0.80 }],
      firstObserved: yesterday, lastObserved: now, confidence: 0.77, methodologyVersion: 'funding-analysis-v1.0',
    },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// Mock Clusters
// ────────────────────────────────────────────────────────────────────────────

export const MOCK_CLUSTERS: Record<string, WalletClusterV2[]> = {
  SENT: [], // Healthy — no significant clusters
  QUANT: [
    {
      id: 'cluster_quant_1', wallets: ['QUANh1a2b3c4d5e6f7g8h9i0j', 'QUANa1b2c3d4e5f6g7h8i9j0k', 'QUANb2c3d4e5f6g7h8i9j0k1l'],
      edges: MOCK_EDGES.QUANT, clusterConfidence: { score: 0.82, evidenceCount: 3, strongestEvidence: { fact: '90% shared funding', source: 'funding_analysis', observedAt: yesterday, confidence: 0.92 }, conflictingEvidence: [], methodologyVersion: 'wallet-clustering-v1.0' },
      scope: 'TOKEN_SPECIFIC', tokenContext: 'dt_quantum', createdAt: now, methodologyVersion: 'wallet-clustering-v1.0',
    },
  ],
  BONK: [
    {
      id: 'cluster_bonk_1', wallets: ['BONKa1b2c3d4e5f6g7h8i9j0k', 'BONKb2c3d4e5f6g7h8i9j0k1l'],
      edges: [MOCK_EDGES.BONK[0]], clusterConfidence: { score: 0.58, evidenceCount: 1, strongestEvidence: { fact: 'Common funding source', source: 'funding_analysis', observedAt: lastWeek, confidence: 0.78 }, conflictingEvidence: [], methodologyVersion: 'wallet-clustering-v1.0' },
      scope: 'TOKEN_SPECIFIC', tokenContext: 'dt_bonk', createdAt: now, methodologyVersion: 'wallet-clustering-v1.0',
    },
  ],
  ALPHA: [
    {
      id: 'cluster_alpha_1', wallets: ['ALPHh1a2b3c4d5e6f7g8h9i0j', 'ALPHa1b2c3d4e5f6g7h8i9j0k', 'ALPHb2c3d4e5f6g7h8i9j0k1l'],
      edges: MOCK_EDGES.ALPHA.slice(0, 3), clusterConfidence: { score: 0.88, evidenceCount: 3, strongestEvidence: { fact: '95% shared funding within 2 hours', source: 'funding_analysis', observedAt: yesterday, confidence: 0.95 }, conflictingEvidence: [], methodologyVersion: 'wallet-clustering-v1.0' },
      scope: 'TOKEN_SPECIFIC', tokenContext: 'dt_alpha', createdAt: now, methodologyVersion: 'wallet-clustering-v1.0',
    },
    {
      id: 'cluster_alpha_2', wallets: ['ALPHc3d4e5f6g7h8i9j0k1l2m', 'ALPHd4e5f6g7h8i9j0k1l2m3n'],
      edges: [MOCK_EDGES.ALPHA[3]], clusterConfidence: { score: 0.62, evidenceCount: 1, strongestEvidence: { fact: 'Common funding source', source: 'funding_analysis', observedAt: yesterday, confidence: 0.80 }, conflictingEvidence: [], methodologyVersion: 'wallet-clustering-v1.0' },
      scope: 'TOKEN_SPECIFIC', tokenContext: 'dt_alpha', createdAt: now, methodologyVersion: 'wallet-clustering-v1.0',
    },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// Pre-computed Mock Ownership Reports
// ────────────────────────────────────────────────────────────────────────────

export function getMockOwnershipReport(symbol: string): EffectiveOwnershipReport | null {
  switch (symbol.toUpperCase()) {
    case 'SENT': return SENT_OWNERSHIP;
    case 'QUANT': return QUANT_OWNERSHIP;
    case 'BONK': return BONK_OWNERSHIP;
    case 'ALPHA': return ALPHA_OWNERSHIP;
    default: return null;
  }
}

const SENT_OWNERSHIP: EffectiveOwnershipReport = {
  tokenId: 'dt_sentinel', chain: 'solana', generatedAt: now, methodologyVersion: 'ownership-v2.0.0',
  totalSupply: 100_000_000, circulatingSupply: 85_000_000, knownHeldSupply: 33_850_000, unknownSupply: 51_150_000,
  entities: [
    { entityId: 'entity_direct_SENTh1a2b3c4', type: 'WALLET', addresses: ['SENTh1a2b3c4d5e6f7g8h9i0j'], directBalance: 15_000_000, relatedBalance: 0, estimatedEffectiveBalance: 15_000_000, supplyPercentage: 17.65, layer: 'DIRECT', confidence: 0.95, evidence: [{ fact: 'Holds 15M tokens (17.65% of supply)', source: 'holder_data', observedAt: now, confidence: 0.95 }], updatedAt: now },
    { entityId: 'entity_direct_SENTa1b2c3d4', type: 'WALLET', addresses: ['SENTa1b2c3d4e5f6g7h8i9j0k'], directBalance: 8_500_000, relatedBalance: 0, estimatedEffectiveBalance: 8_500_000, supplyPercentage: 10.0, layer: 'DIRECT', confidence: 0.95, evidence: [{ fact: 'Holds 8.5M tokens (10% of supply)', source: 'holder_data', observedAt: now, confidence: 0.95 }], updatedAt: now },
  ],
  concentration: { topHolderPct: 17.65, topClusterPct: 0, creatorAssociatedPct: 5.5, knownEntityPct: 39.82, unknownPct: 60.18, level: 'MODERATE' },
  timeline: [], confidence: 0.72, limitations: [],
  uniqueAddressesCounted: 8, totalAddressesProcessed: 8,
};

const QUANT_OWNERSHIP: EffectiveOwnershipReport = {
  tokenId: 'dt_quantum', chain: 'solana', generatedAt: now, methodologyVersion: 'ownership-v2.0.0',
  totalSupply: 100_000_000, circulatingSupply: 90_000_000, knownHeldSupply: 81_000_000, unknownSupply: 9_000_000,
  entities: [
    { entityId: 'entity_cluster_cluster_quant_1', type: 'CLUSTER', addresses: ['QUANh1a2b3c4d5e6f7g8h9i0j', 'QUANa1b2c3d4e5f6g7h8i9j0k', 'QUANb2c3d4e5f6g7h8i9j0k1l'], directBalance: 0, relatedBalance: 65_000_000, estimatedEffectiveBalance: 65_000_000, supplyPercentage: 72.22, layer: 'CLUSTER', confidence: 0.70, evidence: [{ fact: 'Cluster of 3 wallets holds 65M tokens (72.22% of supply) — shared funding and coordinated activity', source: 'cluster_analysis', observedAt: now, confidence: 0.82 }], updatedAt: now },
    { entityId: 'entity_direct_QUANc3d4e5f6', type: 'WALLET', addresses: ['QUANc3d4e5f6g7h8i9j0k1l2m'], directBalance: 8_000_000, relatedBalance: 0, estimatedEffectiveBalance: 8_000_000, supplyPercentage: 8.89, layer: 'DIRECT', confidence: 0.95, evidence: [{ fact: 'Holds 8M tokens (8.89% of supply)', source: 'holder_data', observedAt: now, confidence: 0.95 }], updatedAt: now },
  ],
  concentration: { topHolderPct: 38.89, topClusterPct: 72.22, creatorAssociatedPct: 0, knownEntityPct: 90.0, unknownPct: 10.0, level: 'EXTREME' },
  timeline: [], confidence: 0.65, limitations: ['Creator data unavailable — creator-associated ownership cannot be determined'],
  uniqueAddressesCounted: 6, totalAddressesProcessed: 6,
};

const BONK_OWNERSHIP: EffectiveOwnershipReport = {
  tokenId: 'dt_bonk', chain: 'solana', generatedAt: now, methodologyVersion: 'ownership-v2.0.0',
  totalSupply: 100_000_000_000, circulatingSupply: 93_000_000_000, knownHeldSupply: 110_000_000_000, unknownSupply: 0,
  entities: [
    { entityId: 'entity_direct_BONKh1a2b3c4', type: 'WALLET', addresses: ['BONKh1a2b3c4d5e6f7g8h9i0j'], directBalance: 50_000_000_000, relatedBalance: 0, estimatedEffectiveBalance: 50_000_000_000, supplyPercentage: 53.76, layer: 'DIRECT', confidence: 0.95, evidence: [{ fact: 'Liquidity pool holds 50B tokens', source: 'holder_data', observedAt: now, confidence: 0.95 }], updatedAt: now },
    { entityId: 'entity_cluster_cluster_bonk_1', type: 'CLUSTER', addresses: ['BONKa1b2c3d4e5f6g7h8i9j0k', 'BONKb2c3d4e5f6g7h8i9j0k1l'], directBalance: 0, relatedBalance: 40_000_000_000, estimatedEffectiveBalance: 40_000_000_000, supplyPercentage: 43.01, layer: 'CLUSTER', confidence: 0.50, evidence: [{ fact: 'Cluster of 2 wallets', source: 'cluster_analysis', observedAt: now, confidence: 0.58 }], updatedAt: now },
  ],
  concentration: { topHolderPct: 53.76, topClusterPct: 43.01, creatorAssociatedPct: 2.5, knownEntityPct: 100.0, unknownPct: 0, level: 'HIGH' },
  timeline: [], confidence: 0.68, limitations: [],
  uniqueAddressesCounted: 7, totalAddressesProcessed: 7,
};

const ALPHA_OWNERSHIP: EffectiveOwnershipReport = {
  tokenId: 'dt_alpha', chain: 'solana', generatedAt: now, methodologyVersion: 'ownership-v2.0.0',
  totalSupply: 100_000_000, circulatingSupply: 95_000_000, knownHeldSupply: 90_000_000, unknownSupply: 5_000_000,
  entities: [
    { entityId: 'entity_cluster_cluster_alpha_1', type: 'CLUSTER', addresses: ['ALPHh1a2b3c4d5e6f7g8h9i0j', 'ALPHa1b2c3d4e5f6g7h8i9j0k', 'ALPHb2c3d4e5f6g7h8i9j0k1l'], directBalance: 0, relatedBalance: 77_000_000, estimatedEffectiveBalance: 77_000_000, supplyPercentage: 81.05, layer: 'CLUSTER', confidence: 0.75, evidence: [{ fact: 'Cluster of 3 wallets (95% shared funding, coordinated 30s windows) holds 77M tokens — 81.05% of supply', source: 'cluster_analysis', observedAt: now, confidence: 0.88 }], updatedAt: now },
    { entityId: 'entity_cluster_cluster_alpha_2', type: 'CLUSTER', addresses: ['ALPHc3d4e5f6g7h8i9j0k1l2m', 'ALPHd4e5f6g7h8i9j0k1l2m3n'], directBalance: 0, relatedBalance: 13_000_000, estimatedEffectiveBalance: 13_000_000, supplyPercentage: 13.68, layer: 'CLUSTER', confidence: 0.52, evidence: [{ fact: 'Cluster of 2 wallets', source: 'cluster_analysis', observedAt: now, confidence: 0.62 }], updatedAt: now },
  ],
  concentration: { topHolderPct: 47.37, topClusterPct: 81.05, creatorAssociatedPct: 47.37, knownEntityPct: 94.74, unknownPct: 5.26, level: 'EXTREME' },
  timeline: [], confidence: 0.60, limitations: ['Creator-associated wallets overlap with primary cluster — deduplication applied'],
  uniqueAddressesCounted: 5, totalAddressesProcessed: 5,
};
