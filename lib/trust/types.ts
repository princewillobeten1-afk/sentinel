export enum EntityType {
  CREATOR = 'CREATOR',
  WALLET = 'WALLET',
  TOKEN = 'TOKEN',
  LAUNCH = 'LAUNCH',
  TRADER = 'TRADER'
}

export enum ConfidenceLevel {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH'
}

export enum ReputationCategory {
  UNKNOWN = 'UNKNOWN',
  NEW = 'NEW',
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  GOOD = 'GOOD',
  HIGH = 'HIGH',
  EXCELLENT = 'EXCELLENT'
}

export interface ReputationDimension {
  dimension: 'INTEGRITY' | 'RELIABILITY' | 'TRANSPARENCY' | 'LONGEVITY' | 'MARKET_BEHAVIOR';
  score: number;
}

export interface ReputationEvidence {
  id: string;
  claim: string;
  source: string;
  confidenceScore: number;
  timestamp: string;
  impact: number;
}

export interface ReputationProfile {
  entityId: string;
  entityType: EntityType;
  overallScore: number | null;
  confidenceLevel: ConfidenceLevel;
  reputationCategory: ReputationCategory;
  dimensions: ReputationDimension[];
  topEvidence: ReputationEvidence[];
  badges: string[];
}

export interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  reputation?: number;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  relationshipType: string;
  confidence: number;
  evidence: string[];
}

export interface TrustGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
