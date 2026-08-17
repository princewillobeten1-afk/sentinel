/**
 * Effective Ownership Calculator
 * Sprint 6
 *
 * The core ownership engine.
 * Transforms raw holders + clusters + creator data into a layered ownership assessment.
 *
 * Four ownership layers: Direct → Related → Cluster → Unknown
 *
 * Double-counting protection: maintains Set<string> of already-counted addresses.
 * Each layer checks membership before adding balances.
 *
 * Methodology version: ownership-v2.0.0
 */

import type {
  OwnershipEntity,
  OwnershipEntityType,
  OwnershipLayer,
  EffectiveOwnershipReport,
  OwnershipConcentration,
  OwnershipTimelineEntry,
  WalletClusterV2,
  OwnershipEvidence,
} from './types';
import type { CreatorEntity } from '../creator/types';

const METHODOLOGY_VERSION = 'ownership-v2.0.0';

// ────────────────────────────────────────────────────────────────────────────
// Input Types
// ────────────────────────────────────────────────────────────────────────────

export interface HolderRecord {
  address: string;
  balance: number;
  /** Labels (e.g. "program", "liquidity_pool", "burn_address") */
  labels?: string[];
}

export interface OwnershipInput {
  tokenId: string;
  chain: string;
  totalSupply: number;
  circulatingSupply?: number;
  holders: HolderRecord[];
  clusters: WalletClusterV2[];
  creatorEntity?: CreatorEntity;
  /** Previous timeline for change detection */
  previousTimeline?: OwnershipTimelineEntry[];
}

// ────────────────────────────────────────────────────────────────────────────
// Main Calculator
// ────────────────────────────────────────────────────────────────────────────

export function calculateEffectiveOwnership(input: OwnershipInput): EffectiveOwnershipReport {
  const now = new Date().toISOString();
  const entities: OwnershipEntity[] = [];
  const limitations: string[] = [];
  const timeline: OwnershipTimelineEntry[] = [];

  // Double-counting protection
  const countedAddresses = new Set<string>();

  const supplyBase = input.circulatingSupply ?? input.totalSupply;
  if (supplyBase <= 0) {
    limitations.push('Supply data unavailable — percentages cannot be calculated');
  }

  // Build holder balance lookup
  const balanceMap = new Map<string, number>();
  for (const h of input.holders) {
    balanceMap.set(h.address, h.balance);
  }

  // Build label lookup
  const labelMap = new Map<string, string[]>();
  for (const h of input.holders) {
    if (h.labels?.length) labelMap.set(h.address, h.labels);
  }

  // ── Step 1: Creator-Associated Wallets (RELATED layer) ──
  if (input.creatorEntity) {
    const creatorEntity = buildCreatorEntity(
      input.creatorEntity, balanceMap, countedAddresses, supplyBase, now,
    );
    if (creatorEntity) {
      entities.push(creatorEntity);
    }
  } else {
    limitations.push('Creator data unavailable — creator-associated ownership cannot be determined');
  }

  // ── Step 2: Wallet Clusters (CLUSTER layer) ──
  const clusterEntities = buildClusterEntities(
    input.clusters, balanceMap, countedAddresses, supplyBase, now,
  );
  entities.push(...clusterEntities);

  if (input.clusters.length === 0) {
    limitations.push('No wallet clusters available — grouped ownership cannot be assessed');
  }

  // ── Step 3: Remaining Individual Holders (DIRECT layer) ──
  const directEntities = buildDirectEntities(
    input.holders, countedAddresses, supplyBase, now,
  );
  entities.push(...directEntities);

  // ── Layer 4: UNKNOWN — Remaining supply ──
  const knownHeldSupply = entities.reduce((s, e) => s + e.estimatedEffectiveBalance, 0);
  const unknownSupply = Math.max(0, supplyBase - knownHeldSupply);

  // ── Concentration Metrics ──
  const concentration = calculateConcentration(entities, supplyBase, input.creatorEntity);

  // ── Overall Confidence ──
  const dataCoverage = supplyBase > 0 ? knownHeldSupply / supplyBase : 0;
  const clusterConfidence = input.clusters.length > 0
    ? input.clusters.reduce((s, c) => s + c.clusterConfidence.score, 0) / input.clusters.length
    : 0;
  const overallConfidence = Math.min(0.95,
    dataCoverage * 0.40 +
    clusterConfidence * 0.30 +
    (input.creatorEntity ? 0.15 : 0) +
    0.15, // base
  );

  // Sort entities by effective balance descending
  entities.sort((a, b) => b.estimatedEffectiveBalance - a.estimatedEffectiveBalance);

  return {
    tokenId: input.tokenId,
    chain: input.chain,
    generatedAt: now,
    methodologyVersion: METHODOLOGY_VERSION,
    totalSupply: input.totalSupply,
    circulatingSupply: input.circulatingSupply,
    knownHeldSupply,
    unknownSupply,
    entities,
    concentration,
    timeline,
    confidence: Math.round(overallConfidence * 100) / 100,
    limitations,
    uniqueAddressesCounted: countedAddresses.size,
    totalAddressesProcessed: input.holders.length,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Layer 1: Direct Entities
// ────────────────────────────────────────────────────────────────────────────

function buildDirectEntities(
  holders: HolderRecord[],
  counted: Set<string>,
  supplyBase: number,
  now: string,
): OwnershipEntity[] {
  const entities: OwnershipEntity[] = [];

  // Only create entities for significant holders (top holders or > 1% of supply)
  const significantThreshold = supplyBase * 0.01;

  for (const holder of holders) {
    if (counted.has(holder.address)) continue;
    if (holder.balance < significantThreshold && holders.indexOf(holder) >= 20) continue;

    counted.add(holder.address);

    const pct = supplyBase > 0 ? (holder.balance / supplyBase) * 100 : 0;

    const evidence: OwnershipEvidence[] = [{
      fact: `Holds ${holder.balance.toLocaleString()} tokens (${pct.toFixed(2)}% of supply)`,
      source: 'holder_data',
      observedAt: now,
      value: holder.balance,
      confidence: 0.95,
    }];

    if (holder.labels?.length) {
      evidence.push({
        fact: `Wallet labels: ${holder.labels.join(', ')}`,
        source: 'wallet_labels',
        observedAt: now,
        confidence: 0.80,
      });
    }

    entities.push({
      entityId: `entity_direct_${holder.address.slice(0, 12)}`,
      type: 'WALLET',
      addresses: [holder.address],
      directBalance: holder.balance,
      relatedBalance: 0,
      estimatedEffectiveBalance: holder.balance,
      supplyPercentage: pct,
      layer: 'DIRECT',
      confidence: 0.95,
      evidence,
      updatedAt: now,
    });
  }

  return entities;
}

// ────────────────────────────────────────────────────────────────────────────
// Layer 2: Creator Entity
// ────────────────────────────────────────────────────────────────────────────

function buildCreatorEntity(
  creator: CreatorEntity,
  balanceMap: Map<string, number>,
  counted: Set<string>,
  supplyBase: number,
  now: string,
): OwnershipEntity | null {
  const creatorAddresses = [creator.primaryAddress, ...creator.knownAddresses];
  const uniqueAddresses = [...new Set(creatorAddresses)];

  let directBalance = 0;
  let relatedBalance = 0;
  const uncountedAddresses: string[] = [];

  // Primary address = direct
  if (!counted.has(creator.primaryAddress)) {
    directBalance = balanceMap.get(creator.primaryAddress) || 0;
    counted.add(creator.primaryAddress);
    uncountedAddresses.push(creator.primaryAddress);
  }

  // Associated addresses = related
  for (const addr of uniqueAddresses) {
    if (addr === creator.primaryAddress) continue;
    if (counted.has(addr)) continue;

    const balance = balanceMap.get(addr) || 0;
    relatedBalance += balance;
    counted.add(addr);
    uncountedAddresses.push(addr);
  }

  // Associated wallets from relationship edges
  for (const assoc of creator.associatedWallets) {
    if (counted.has(assoc.address)) continue;
    const balance = balanceMap.get(assoc.address) || 0;
    relatedBalance += balance;
    counted.add(assoc.address);
    uncountedAddresses.push(assoc.address);
  }

  const total = directBalance + relatedBalance;
  if (total === 0 && uncountedAddresses.length === 0) return null;

  const pct = supplyBase > 0 ? (total / supplyBase) * 100 : 0;

  const evidence: OwnershipEvidence[] = [{
    fact: `Creator-associated addresses hold ${total.toLocaleString()} tokens (${pct.toFixed(2)}% of supply) across ${uncountedAddresses.length} wallets`,
    source: 'creator_analysis',
    observedAt: now,
    value: total,
    confidence: creator.identificationConfidence * 0.9,
  }];

  return {
    entityId: `entity_creator_${creator.primaryAddress.slice(0, 12)}`,
    type: 'CREATOR',
    addresses: uncountedAddresses,
    directBalance,
    relatedBalance,
    estimatedEffectiveBalance: total,
    supplyPercentage: pct,
    layer: 'RELATED',
    confidence: creator.identificationConfidence * 0.85,
    evidence,
    updatedAt: now,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Layer 3: Cluster Entities
// ────────────────────────────────────────────────────────────────────────────

function buildClusterEntities(
  clusters: WalletClusterV2[],
  balanceMap: Map<string, number>,
  counted: Set<string>,
  supplyBase: number,
  now: string,
): OwnershipEntity[] {
  const entities: OwnershipEntity[] = [];

  for (const cluster of clusters) {
    let clusterBalance = 0;
    const uncountedWallets: string[] = [];

    for (const wallet of cluster.wallets) {
      if (counted.has(wallet)) continue;
      const balance = balanceMap.get(wallet) || 0;
      clusterBalance += balance;
      counted.add(wallet);
      uncountedWallets.push(wallet);
    }

    if (clusterBalance === 0 && uncountedWallets.length === 0) continue;

    const pct = supplyBase > 0 ? (clusterBalance / supplyBase) * 100 : 0;

    const evidence: OwnershipEvidence[] = [{
      fact: `Cluster of ${cluster.wallets.length} wallets (${uncountedWallets.length} with uncounted balance) holds ${clusterBalance.toLocaleString()} tokens (${pct.toFixed(2)}% of supply)`,
      source: 'cluster_analysis',
      observedAt: now,
      value: clusterBalance,
      confidence: cluster.clusterConfidence.score * 0.85,
    }];

    if (cluster.clusterConfidence.strongestEvidence) {
      evidence.push(cluster.clusterConfidence.strongestEvidence);
    }

    if (cluster.clusterConfidence.conflictingEvidence.length > 0) {
      evidence.push(...cluster.clusterConfidence.conflictingEvidence);
    }

    entities.push({
      entityId: `entity_cluster_${cluster.id}`,
      type: 'CLUSTER',
      addresses: uncountedWallets,
      directBalance: 0,
      relatedBalance: clusterBalance,
      estimatedEffectiveBalance: clusterBalance,
      supplyPercentage: pct,
      layer: 'CLUSTER',
      confidence: cluster.clusterConfidence.score * 0.80,
      evidence,
      updatedAt: now,
    });
  }

  return entities;
}

// ────────────────────────────────────────────────────────────────────────────
// Concentration Metrics
// ────────────────────────────────────────────────────────────────────────────

function calculateConcentration(
  entities: OwnershipEntity[],
  supplyBase: number,
  creator?: CreatorEntity,
): OwnershipConcentration {
  // Top holder (largest single entity)
  const topHolderPct = entities.length > 0
    ? Math.max(...entities.map(e => e.supplyPercentage))
    : 0;

  // Top cluster
  const clusterEntities = entities.filter(e => e.type === 'CLUSTER');
  const topClusterPct = clusterEntities.length > 0
    ? Math.max(...clusterEntities.map(e => e.supplyPercentage))
    : 0;

  // Creator-associated
  const creatorEntities = entities.filter(e => e.type === 'CREATOR');
  const creatorAssociatedPct = creatorEntities.reduce((s, e) => s + e.supplyPercentage, 0);

  // Known entities total
  const knownEntityPct = entities.reduce((s, e) => s + e.supplyPercentage, 0);
  const unknownPct = Math.max(0, 100 - knownEntityPct);

  // Concentration level
  const maxConcentration = Math.max(topHolderPct, topClusterPct, creatorAssociatedPct);
  let level: OwnershipConcentration['level'];
  if (maxConcentration > 70) level = 'EXTREME';
  else if (maxConcentration > 50) level = 'HIGH';
  else if (maxConcentration > 30) level = 'ELEVATED';
  else if (maxConcentration > 15) level = 'MODERATE';
  else level = 'LOW';

  return {
    topHolderPct: Math.round(topHolderPct * 100) / 100,
    topClusterPct: Math.round(topClusterPct * 100) / 100,
    creatorAssociatedPct: Math.round(creatorAssociatedPct * 100) / 100,
    knownEntityPct: Math.round(knownEntityPct * 100) / 100,
    unknownPct: Math.round(unknownPct * 100) / 100,
    level,
  };
}
