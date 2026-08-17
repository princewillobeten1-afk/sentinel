// lib/intelligence/insider/types.ts

export type RelationshipStrength = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type InsiderRiskProfile = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DataConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export enum InsiderCategory {
  PRE_LAUNCH_ACCUMULATION = 'PRE_LAUNCH_ACCUMULATION',
  CREATOR_LINK = 'CREATOR_LINK',
  TEAM_LINK = 'TEAM_LINK',
  FUNDING_CLUSTER = 'FUNDING_CLUSTER',
  COORDINATED_BUYING = 'COORDINATED_BUYING',
  COORDINATED_SELLING = 'COORDINATED_SELLING',
  WALLET_ROTATION = 'WALLET_ROTATION',
  SUPPLY_CONCENTRATION = 'SUPPLY_CONCENTRATION',
  SUSPICIOUS_TIMING = 'SUSPICIOUS_TIMING',
  CROSS_TOKEN_PATTERN = 'CROSS_TOKEN_PATTERN'
}

export interface WalletRelationship {
  sourceWallet: string;
  targetWallet: string;
  type: string;
  strength: RelationshipStrength;
  evidence: Record<string, any>;
}

export interface WalletCluster {
  id: string;
  wallets: string[];
  confidence: number; // 0-100
  riskProfile: InsiderRiskProfile;
  evidenceSummary: string;
}

export interface InsiderEvidence {
  description: string;
  weight: number;
  metadata?: Record<string, any>;
}

export interface InsiderSignal {
  id: string;
  tokenId: string;
  clusterId?: string;
  category: InsiderCategory;
  confidence: number;
  timeWindow?: string;
  evidence: InsiderEvidence[];
}

export interface TokenInsiderRisk {
  tokenId: string;
  riskScore: InsiderRiskProfile;
  confidence: DataConfidence;
  signals: InsiderSignal[];
  clusteredOwnershipPct: number;
}
