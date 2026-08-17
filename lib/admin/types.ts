/**
 * Sprint 39 — Admin Dashboard & Platform Operations Types & Contracts
 * Governs RBAC, 11 roles, granular permissions, 5 emergency modes,
 * P0-P3 security incidents, investigations, graph topologies, and audit provenance.
 */

// ── 1. Admin Roles & Permissions ──

export type AdminRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'TRADING_OPERATIONS'
  | 'RISK_ANALYST'
  | 'COMPLIANCE'
  | 'SUPPORT'
  | 'MODERATOR'
  | 'FINANCE'
  | 'ANALYST'
  | 'DEVELOPER'
  | 'READ_ONLY';

export type PermissionDomain =
  | 'users'
  | 'trading'
  | 'tokens'
  | 'wallets'
  | 'launchpad'
  | 'finance'
  | 'security'
  | 'ai'
  | 'analytics'
  | 'system'
  | 'support';

export type AdminPermission =
  // Users
  | 'users.view'
  | 'users.manage'
  | 'users.restrict'
  | 'users.terminate'
  // Trading
  | 'trading.view'
  | 'trading.cancel'
  | 'trading.pause'
  // Tokens
  | 'tokens.view'
  | 'tokens.restrict'
  | 'tokens.freeze'
  // Wallets
  | 'wallets.view'
  | 'wallets.flag'
  // Launchpad
  | 'launchpad.view'
  | 'launchpad.manage'
  | 'launchpad.pause'
  // Finance & Treasury
  | 'treasury.view'
  | 'treasury.manage'
  | 'fees.modify'
  // Security
  | 'security.view'
  | 'incidents.manage'
  // AI
  | 'ai.view'
  | 'ai.manage'
  // Analytics
  | 'analytics.view'
  | 'analytics.export'
  // System
  | 'system.view'
  | 'system.config'
  | 'system.emergency'
  // Support
  | 'support.view'
  | 'support.act';

export interface AdminUserIdentity {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  mfaEnrolled: boolean;
  assignedPermissions: AdminPermission[];
  lastLoginAt: string;
  createdAt: string;
}

// ── 2. Admin 6-Point Provenance Audit System ──

export interface AdminAuditEvent {
  id: string;
  sequenceNum: number;
  previousHash: string;
  eventHash: string;
  actorId: string;
  actorRole: AdminRole;
  actorDisplayName?: string;
  action: string;
  domain: PermissionDomain;
  resourceType: string;
  resourceId?: string;
  reason: string;
  ipAddress?: string;
  geoLocation?: string;
  userAgent?: string;
  sessionId?: string;
  changesBefore?: Record<string, any>;
  changesAfter?: Record<string, any>;
  timestamp: string;
}

export interface AuditVerificationResult {
  isValid: boolean;
  totalVerified: number;
  brokenIndex?: number;
  brokenEventId?: string;
  message: string;
}

// ── 3. Platform Emergency Modes & Circuit Breakers ──

export type TradingEmergencyMode =
  | 'NORMAL'
  | 'DEGRADED'
  | 'TRADING_RESTRICTED'
  | 'TRADING_PAUSED'
  | 'FULL_EMERGENCY';

export interface EmergencyKillSwitches {
  pauseNewTrades: boolean;
  pauseWithdrawals: boolean;
  pauseCopyTrading: boolean;
  pauseLaunchpad: boolean;
  disabledChains: string[]; // e.g. ['solana', 'base', 'ethereum']
  disabledRouters: string[]; // e.g. ['raydium', 'jupiter', 'orca', 'uniswap_v3']
}

export interface EmergencyPlatformState {
  mode: TradingEmergencyMode;
  killSwitches: EmergencyKillSwitches;
  circuitBreakers: Record<string, { tripped: boolean; trippedAt?: string; reason?: string }>;
  updatedBy: string;
  updatedByRole: AdminRole;
  reason: string;
  updatedAt: string;
}

// ── 4. Enterprise Dual-Approval Governance ──

export type DualApprovalActionType =
  | 'TREASURY_TRANSFER'
  | 'GLOBAL_TRADING_PAUSE'
  | 'GLOBAL_TRADING_RESUME'
  | 'FULL_EMERGENCY_TRIGGER'
  | 'FEE_RATE_CHANGE'
  | 'RISK_ENGINE_GLOBAL_OVERRIDE'
  | 'DATABASE_ROLLBACK';

export type DualApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED';

export interface DualApprovalProposal {
  id: string;
  actionType: DualApprovalActionType;
  payload: Record<string, any>;
  requestedBy: string;
  requestedByRole: AdminRole;
  requestedAt: string;
  reason: string;
  status: DualApprovalStatus;
  approvedBy: string | null;
  approvedByRole: AdminRole | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  expiresAt: string;
  executedAt: string | null;
}

// ── 5. Action Simulation & Impact Forecast ──

export interface SimulationResult {
  actionType: string;
  target: string;
  currentState: Record<string, any>;
  proposedState: Record<string, any>;
  estimatedImpact: {
    revenueChangePct: number;
    volumeChangePct: number;
    affectedUsersCount: number;
    liquidityStressRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    summary: string;
  };
  warnings: string[];
}

// ── 6. Multi-Entity Investigation Dossiers ──

export type InvestigationEntityType =
  | 'TOKEN'
  | 'WALLET'
  | 'USER'
  | 'CREATOR'
  | 'LAUNCH'
  | 'ORDER'
  | 'FAILED_TRADE'
  | 'INCIDENT';

export interface InvestigationTimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'ALERT' | 'CRITICAL';
  source: 'ON_CHAIN' | 'INTERNAL_ENGINE' | 'AI_SIGNAL' | 'ADMIN_ACTION';
  metadata?: Record<string, any>;
}

export interface TraceableEvidenceItem {
  id: string;
  type: 'TRANSACTION' | 'CLUSTER' | 'ANOMALY_SCORE' | 'CONTRACT_EVENT' | 'USER_REPORT';
  reference: string; // e.g. tx hash, cluster id, metric name
  verified: boolean;
  timestamp: string;
  details: string;
}

export interface InvestigationDossier {
  entityType: InvestigationEntityType;
  entityId: string;
  title: string;
  riskScore: number; // 0-100
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  status: 'ACTIVE' | 'WATCH' | 'RESTRICTED' | 'HIDDEN' | 'BLOCKED' | 'ARCHIVED';
  summary: Record<string, any>;
  timeline: InvestigationTimelineEvent[];
  evidence: TraceableEvidenceItem[];
  detectedSignals: string[];
  aiAnalysis?: {
    summary: string;
    confidencePct: number;
    recommendedActions: string[];
    groundedEvidenceCount: number;
  };
  adminNotes: Array<{ author: string; note: string; timestamp: string }>;
}

// ── 7. Entity Relationship Graph ──

export interface GraphNode {
  id: string;
  label: string;
  type: 'CREATOR' | 'WALLET' | 'TOKEN' | 'POOL' | 'ORDER' | 'CLUSTER';
  riskScore?: number;
  isFlagged?: boolean;
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  weight?: number;
  relationship:
    | 'DEPLOYED'
    | 'TRANSFERRED'
    | 'SNIPED'
    | 'SHARED_FUNDING'
    | 'LIQUIDITY_PROVIDED'
    | 'WASH_CYCLE';
}

export interface EntityRelationshipGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusterCount: number;
  highestRiskNodeId?: string;
}

// ── 8. Security Incidents & Moderation ──

export type IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'ARCHIVED';

export interface SecurityIncident {
  id: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  affectedSystems: string[];
  affectedUsersCount: number;
  detectedAt: string;
  assignedTeam: string;
  timeline: Array<{ timestamp: string; note: string; author: string }>;
  evidence: TraceableEvidenceItem[];
  resolutionNotes?: string;
  resolvedAt?: string;
}

export interface AbuseReport {
  id: string;
  reporterWallet: string;
  targetType: 'TOKEN' | 'CREATOR' | 'USER' | 'MESSAGE';
  targetId: string;
  category: 'SCAM' | 'IMPERSONATION' | 'MANIPULATION' | 'RUG_PULL' | 'HARASSMENT';
  evidence: Record<string, any>;
  status: 'PENDING' | 'INVESTIGATING' | 'ACTIONED' | 'DISMISSED';
  resolution?: string;
  reviewedBy?: string;
  createdAt: string;
}

// ── 9. Feature Flags & Configuration ──

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPct: number; // 0-100
  targetRoles: AdminRole[];
  targetUsers: string[];
  targetRegions: string[];
  updatedBy: string;
  updatedAt: string;
}

export interface ConfigSetting {
  key: string;
  group: 'FEE' | 'RISK' | 'ALERT' | 'AI' | 'RATE_LIMIT' | 'SYSTEM';
  value: any;
  previousValue?: any;
  version: number;
  isDangerous: boolean;
  updatedBy: string;
  reason: string;
  updatedAt: string;
}

export interface RiskOverride {
  id: string;
  entityType: 'TOKEN' | 'WALLET' | 'CREATOR';
  entityId: string;
  overrideRules: Record<string, any>;
  adminId: string;
  adminRole: AdminRole;
  reason: string;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
}

// ── 10. Platform Health & Operations Feed ──

export interface SystemServiceHealth {
  name: string;
  category: 'API' | 'DATABASE' | 'INDEXER' | 'RPC' | 'TRADING_ENGINE' | 'AI' | 'NOTIFICATIONS';
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  latencyMs: number;
  uptimePct: number;
  lastCheckedAt: string;
}

export interface InfrastructureMetrics {
  cpuUsagePct: number;
  memoryUsagePct: number;
  diskUsagePct: number;
  requestsPerSecond: number;
  errorRatePct: number;
  activeWebsocketConnections: number;
  eventBusQueueDepth: number;
  solanaRpcLatencyMs: number;
  solanaBlockLag: number;
  reorgDetected: boolean;
}

export interface OperationsFeedEvent {
  id: string;
  timestamp: string;
  category: 'TRADING' | 'LAUNCHPAD' | 'SECURITY' | 'INTELLIGENCE' | 'SYSTEM' | 'AI';
  severity: 'INFO' | 'WARNING' | 'ALERT' | 'CRITICAL';
  headline: string;
  details: string;
  entityLink?: { type: InvestigationEntityType; id: string };
}
