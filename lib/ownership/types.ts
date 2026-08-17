/**
 * Effective Ownership Engine — Core Type System
 * Sprint 6
 *
 * Defines all domain types for wallet relationships, funding analysis,
 * behavioral correlation, clustering, and effective ownership calculation.
 *
 * Core principle: Never present inference as fact.
 * Every relationship, cluster, and ownership estimate carries evidence + confidence.
 */

// ────────────────────────────────────────────────────────────────────────────
// Ownership Layers
// ────────────────────────────────────────────────────────────────────────────

/** The 4 ownership layers (§4) */
export type OwnershipLayer = 'DIRECT' | 'RELATED' | 'CLUSTER' | 'UNKNOWN';

/** Entity types for ownership attribution */
export type OwnershipEntityType = 'WALLET' | 'CLUSTER' | 'CREATOR' | 'UNKNOWN';

// ────────────────────────────────────────────────────────────────────────────
// Wallet Relationship Types (§7 — expanded from Sprint 5)
// ────────────────────────────────────────────────────────────────────────────

export type WalletRelationshipTypeV2 =
  | 'SHARED_FUNDING'
  | 'DIRECT_TRANSFER'
  | 'COMMON_FUNDING_PATH'
  | 'COORDINATED_ACQUISITION'
  | 'COORDINATED_DISPOSAL'
  | 'COMMON_PROGRAM'
  | 'TEMPORAL_CORRELATION'
  | 'SHARED_INFRASTRUCTURE';

// ────────────────────────────────────────────────────────────────────────────
// Evidence (re-exported from intelligence types for convenience)
// ────────────────────────────────────────────────────────────────────────────

export interface OwnershipEvidence {
  fact: string;
  source: string;
  observedAt: string;
  value?: string | number;
  confidence: number; // 0.0 – 1.0
}

// ────────────────────────────────────────────────────────────────────────────
// Wallet Relationship Edge (§6)
// ────────────────────────────────────────────────────────────────────────────

export interface WalletRelationshipEdge {
  id: string;
  source: string;         // wallet address
  target: string;         // wallet address
  type: WalletRelationshipTypeV2;
  strength: number;       // 0.0 – 1.0 normalized
  evidence: OwnershipEvidence[];
  firstObserved: string;  // ISO timestamp
  lastObserved: string;   // ISO timestamp
  confidence: number;     // 0.0 – 1.0
  methodologyVersion: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Funding Events & Relationships (§8, §9)
// ────────────────────────────────────────────────────────────────────────────

export interface FundingEvent {
  id: string;
  source: string;         // source wallet
  recipient: string;      // recipient wallet
  amountSol: number;      // amount in SOL
  amountUsd?: number;     // estimated USD at time
  timestamp: string;      // ISO
  txSignature: string;
}

export interface FundingRelationship {
  sourceWallet: string;
  recipientWallet: string;
  events: FundingEvent[];
  totalAmountSol: number;
  eventCount: number;
  /** Percentage of recipient wallet's initial funding from this source */
  initialFundingPct: number;
  /** Normalized relationship strength (0.0 – 1.0) */
  strength: number;
  firstEvent: string;     // ISO
  lastEvent: string;      // ISO
  /** Whether the relationship persists (events within last 30 days) */
  isPersistent: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Behavioral Correlation (§10, §11)
// ────────────────────────────────────────────────────────────────────────────

export type BehavioralSignalType =
  | 'SIMILAR_ENTRY_TIMING'
  | 'SIMILAR_EXIT_TIMING'
  | 'SIMILAR_TOKEN_SELECTION'
  | 'SIMILAR_TX_PATTERNS'
  | 'REPEATED_COORDINATION'
  | 'SIMILAR_FUNDING_SEQUENCES';

export interface BehavioralCorrelation {
  walletA: string;
  walletB: string;
  signalType: BehavioralSignalType;
  correlationScore: number;  // 0.0 – 1.0 (statistical measure)
  observationCount: number;
  tokenContext?: string;     // token ID if token-specific
  evidence: OwnershipEvidence[];
  confidence: number;        // 0.0 – 1.0
  methodologyVersion: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Wallet Cluster V2 (§13, §14)
// ────────────────────────────────────────────────────────────────────────────

export interface ClusterConfidence {
  score: number;             // 0.0 – 1.0
  evidenceCount: number;
  strongestEvidence: OwnershipEvidence | null;
  conflictingEvidence: OwnershipEvidence[];
  methodologyVersion: string;
}

export interface WalletClusterV2 {
  id: string;
  wallets: string[];
  edges: WalletRelationshipEdge[];
  clusterConfidence: ClusterConfidence;
  /** Optional human label — never a real-world identity */
  label?: string;
  /** Whether this cluster is token-specific or global */
  scope: 'GLOBAL' | 'TOKEN_SPECIFIC';
  tokenContext?: string;     // token ID if TOKEN_SPECIFIC
  createdAt: string;         // ISO
  methodologyVersion: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Ownership Entity (§5)
// ────────────────────────────────────────────────────────────────────────────

export interface OwnershipEntity {
  entityId: string;
  type: OwnershipEntityType;
  addresses: string[];
  /** Tokens held directly by the primary address */
  directBalance: number;
  /** Tokens held by addresses with strong observable relationships */
  relatedBalance: number;
  /** Total estimated effective balance (direct + related + cluster) */
  estimatedEffectiveBalance: number;
  /** Percentage of circulating supply */
  supplyPercentage: number;
  /** Ownership layer this entity was resolved from */
  layer: OwnershipLayer;
  confidence: number;        // 0.0 – 1.0
  evidence: OwnershipEvidence[];
  updatedAt: string;         // ISO
}

// ────────────────────────────────────────────────────────────────────────────
// Ownership Concentration (§18)
// ────────────────────────────────────────────────────────────────────────────

export interface OwnershipConcentration {
  topHolderPct: number;
  topClusterPct: number;
  creatorAssociatedPct: number;
  knownEntityPct: number;
  unknownPct: number;
  level: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'EXTREME';
}

// ────────────────────────────────────────────────────────────────────────────
// Ownership Timeline (§19)
// ────────────────────────────────────────────────────────────────────────────

export type OwnershipChangeType =
  | 'ACCUMULATION'
  | 'DISTRIBUTION'
  | 'SUDDEN_TRANSFER'
  | 'CLUSTER_CONSOLIDATION'
  | 'LARGE_TRANSFER';

export interface OwnershipTimelineEntry {
  id: string;
  timestamp: string;         // ISO
  entityId: string;
  entityLabel?: string;
  previousPct: number;
  currentPct: number;
  changeType: OwnershipChangeType;
  evidence: OwnershipEvidence[];
}

// ────────────────────────────────────────────────────────────────────────────
// Effective Ownership Report — the master output (§15, §16, §17)
// ────────────────────────────────────────────────────────────────────────────

export interface EffectiveOwnershipReport {
  tokenId: string;
  chain: string;
  generatedAt: string;       // ISO
  methodologyVersion: string;

  // Supply context
  totalSupply: number;
  circulatingSupply?: number;
  knownHeldSupply: number;
  unknownSupply: number;

  // Entities (sorted by estimatedEffectiveBalance desc)
  entities: OwnershipEntity[];

  // Concentration metrics
  concentration: OwnershipConcentration;

  // Timeline
  timeline: OwnershipTimelineEntry[];

  // Confidence
  confidence: number;        // 0.0 – 1.0
  limitations: string[];

  // Double-counting protection metadata
  uniqueAddressesCounted: number;
  totalAddressesProcessed: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Ownership Alerts (§20) — signals for Token Intelligence Engine
// ────────────────────────────────────────────────────────────────────────────

export type OwnershipAlertType =
  | 'LARGE_CLUSTER_ACCUMULATION'
  | 'LARGE_CLUSTER_DISTRIBUTION'
  | 'CREATOR_ASSOCIATED_SELLING'
  | 'CONCENTRATION_INCREASE'
  | 'CONCENTRATION_DECREASE'
  | 'LARGE_WALLET_TRANSFER'
  | 'EFFECTIVE_CONCENTRATION_HIGH'
  | 'FUNDING_CONCENTRATION'
  | 'COORDINATED_WALLET_ACTIVITY';

// ────────────────────────────────────────────────────────────────────────────
// Unknown & Conflicting States (§42, §43)
// ────────────────────────────────────────────────────────────────────────────

export type EvidenceState =
  | 'KNOWN_FACT'
  | 'OBSERVED_RELATIONSHIP'
  | 'STRONG_INFERENCE'
  | 'WEAK_INFERENCE'
  | 'UNKNOWN'
  | 'INSUFFICIENT_EVIDENCE'
  | 'CONFLICTING_EVIDENCE'
  | 'DATA_UNAVAILABLE';
