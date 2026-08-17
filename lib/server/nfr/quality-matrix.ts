/**
 * Master Platform Quality Matrix & Criticality Classification (Sprint 33 §1-15, §50).
 *
 * Establishes the single, cross-platform engineering quality matrix across all Project Sentinel subsystems.
 *
 * Classifications:
 *   - Criticality: P0 (Financially Critical), P1 (Trading Critical), P2 (Intelligence Critical), P3 (Product), P4 (Non-Critical)
 *   - Availability: 99.99%, 99.95%, 99.90%, 99.50%
 *   - Latency: L0 Ultra-Critical (<500ms), L1 Real-Time (<250ms), L2 Interactive (<500ms), L3 Background (async)
 *   - Consistency: Strong Consistency vs. Eventual Consistency
 *   - Data Freshness: Real-Time, Near Real-Time, Periodic
 *   - Security Class: Public, Authenticated, Financial, Administrative
 *   - Disaster Recovery Tier: Tier A (RPO ≤ 1 min, RTO ≤ 15 min), Tier B (RPO ≤ 5 min, RTO ≤ 30 min), Tier C (RPO ≤ 1 hr, RTO ≤ 2 hr)
 */

export type CriticalityLevel = 'P0_FINANCIAL' | 'P1_TRADING' | 'P2_INTELLIGENCE' | 'P3_PRODUCT' | 'P4_NON_CRITICAL';
export type LatencyClass = 'L0_ULTRA_CRITICAL' | 'L1_REAL_TIME' | 'L2_INTERACTIVE' | 'L3_BACKGROUND';
export type ConsistencyModel = 'STRONG_CONSISTENCY' | 'EVENTUAL_CONSISTENCY';
export type FreshnessClass = 'REAL_TIME' | 'NEAR_REAL_TIME' | 'PERIODIC';
export type SecurityClass = 'PUBLIC' | 'AUTHENTICATED' | 'FINANCIAL' | 'ADMINISTRATIVE';
export type DisasterRecoveryTier = 'TIER_A_FINANCIAL' | 'TIER_B_OPERATIONAL' | 'TIER_C_ANALYTICAL';

export interface ServiceQualityProfile {
  serviceId: string;
  name: string;
  criticality: CriticalityLevel;
  availabilityTarget: number; // e.g. 0.9999 for 99.99%
  latencyClass: LatencyClass;
  maxPlatformLatencyMs: number; // max allowable platform-side latency
  consistencyModel: ConsistencyModel;
  freshnessClass: FreshnessClass;
  securityClass: SecurityClass;
  drTier: DisasterRecoveryTier;
  rpoMinutes: number;
  rtoMinutes: number;
  description: string;
}

export const PLATFORM_QUALITY_PROFILES: Record<string, ServiceQualityProfile> = {
  // P0 — Financially Critical Services
  trading_execution: {
    serviceId: 'trading_execution',
    name: 'Trading & Swap Execution',
    criticality: 'P0_FINANCIAL',
    availabilityTarget: 0.9999,
    latencyClass: 'L0_ULTRA_CRITICAL',
    maxPlatformLatencyMs: 500,
    consistencyModel: 'STRONG_CONSISTENCY',
    freshnessClass: 'REAL_TIME',
    securityClass: 'FINANCIAL',
    drTier: 'TIER_A_FINANCIAL',
    rpoMinutes: 1,
    rtoMinutes: 15,
    description: 'Preflight simulation, route build, transaction signing, and broadcast dispatch.',
  },
  order_management: {
    serviceId: 'order_management',
    name: 'Order Management System',
    criticality: 'P0_FINANCIAL',
    availabilityTarget: 0.9999,
    latencyClass: 'L0_ULTRA_CRITICAL',
    maxPlatformLatencyMs: 500,
    consistencyModel: 'STRONG_CONSISTENCY',
    freshnessClass: 'REAL_TIME',
    securityClass: 'FINANCIAL',
    drTier: 'TIER_A_FINANCIAL',
    rpoMinutes: 1,
    rtoMinutes: 15,
    description: 'Limit orders, stop-loss trigger monitoring, and open order state transitions.',
  },
  wallet_service: {
    serviceId: 'wallet_service',
    name: 'Wallet & Account State',
    criticality: 'P0_FINANCIAL',
    availabilityTarget: 0.9999,
    latencyClass: 'L0_ULTRA_CRITICAL',
    maxPlatformLatencyMs: 500,
    consistencyModel: 'STRONG_CONSISTENCY',
    freshnessClass: 'REAL_TIME',
    securityClass: 'FINANCIAL',
    drTier: 'TIER_A_FINANCIAL',
    rpoMinutes: 1,
    rtoMinutes: 15,
    description: 'Wallet linking, balance queries, primary address management, and SIWS verification.',
  },
  authentication: {
    serviceId: 'authentication',
    name: 'Authentication & Session Engine',
    criticality: 'P0_FINANCIAL',
    availabilityTarget: 0.9999,
    latencyClass: 'L0_ULTRA_CRITICAL',
    maxPlatformLatencyMs: 300,
    consistencyModel: 'STRONG_CONSISTENCY',
    freshnessClass: 'REAL_TIME',
    securityClass: 'AUTHENTICATED',
    drTier: 'TIER_A_FINANCIAL',
    rpoMinutes: 1,
    rtoMinutes: 15,
    description: 'Cryptographic challenge generation, JWT issuance, MFA validation, and session store.',
  },

  // P1 — Trading Critical Services
  market_data: {
    serviceId: 'market_data',
    name: 'Market Data & WebSocket Stream',
    criticality: 'P1_TRADING',
    availabilityTarget: 0.9999,
    latencyClass: 'L1_REAL_TIME',
    maxPlatformLatencyMs: 250,
    consistencyModel: 'STRONG_CONSISTENCY',
    freshnessClass: 'REAL_TIME',
    securityClass: 'PUBLIC',
    drTier: 'TIER_B_OPERATIONAL',
    rpoMinutes: 5,
    rtoMinutes: 30,
    description: 'Real-time price ticks, pool liquidity telemetry, and WebSocket broadcast channels.',
  },
  portfolio: {
    serviceId: 'portfolio',
    name: 'Portfolio & P&L Engine',
    criticality: 'P1_TRADING',
    availabilityTarget: 0.9995,
    latencyClass: 'L2_INTERACTIVE',
    maxPlatformLatencyMs: 500,
    consistencyModel: 'STRONG_CONSISTENCY',
    freshnessClass: 'NEAR_REAL_TIME',
    securityClass: 'AUTHENTICATED',
    drTier: 'TIER_B_OPERATIONAL',
    rpoMinutes: 5,
    rtoMinutes: 30,
    description: 'Realized/unrealized P&L calculations, cost basis tracking, and multi-wallet rollups.',
  },
  risk_engine: {
    serviceId: 'risk_engine',
    name: 'Pre-Trade Risk Engine',
    criticality: 'P1_TRADING',
    availabilityTarget: 0.9995,
    latencyClass: 'L0_ULTRA_CRITICAL',
    maxPlatformLatencyMs: 250,
    consistencyModel: 'STRONG_CONSISTENCY',
    freshnessClass: 'NEAR_REAL_TIME',
    securityClass: 'FINANCIAL',
    drTier: 'TIER_B_OPERATIONAL',
    rpoMinutes: 5,
    rtoMinutes: 30,
    description: 'Personal circuit breakers, slippage bounds, max loss caps, and trade sanction checks.',
  },

  // P2 — Intelligence Critical Services
  token_intelligence: {
    serviceId: 'token_intelligence',
    name: 'Token Intelligence & Graph Analyzer',
    criticality: 'P2_INTELLIGENCE',
    availabilityTarget: 0.9990,
    latencyClass: 'L2_INTERACTIVE',
    maxPlatformLatencyMs: 600,
    consistencyModel: 'EVENTUAL_CONSISTENCY',
    freshnessClass: 'NEAR_REAL_TIME',
    securityClass: 'PUBLIC',
    drTier: 'TIER_B_OPERATIONAL',
    rpoMinutes: 15,
    rtoMinutes: 60,
    description: 'Holder cluster detection, creator provenance, organic volume score, and exitability.',
  },

  // P3 — Product Services
  discovery: {
    serviceId: 'discovery',
    name: 'Token Discovery & Scanner',
    criticality: 'P3_PRODUCT',
    availabilityTarget: 0.9990,
    latencyClass: 'L2_INTERACTIVE',
    maxPlatformLatencyMs: 500,
    consistencyModel: 'EVENTUAL_CONSISTENCY',
    freshnessClass: 'NEAR_REAL_TIME',
    securityClass: 'PUBLIC',
    drTier: 'TIER_C_ANALYTICAL',
    rpoMinutes: 30,
    rtoMinutes: 120,
    description: 'Real-time new token feeds, graduated pair scanners, and custom filter queries.',
  },
  alerts: {
    serviceId: 'alerts',
    name: 'Real-Time Alerting Engine',
    criticality: 'P3_PRODUCT',
    availabilityTarget: 0.9990,
    latencyClass: 'L1_REAL_TIME',
    maxPlatformLatencyMs: 300,
    consistencyModel: 'STRONG_CONSISTENCY',
    freshnessClass: 'REAL_TIME',
    securityClass: 'AUTHENTICATED',
    drTier: 'TIER_C_ANALYTICAL',
    rpoMinutes: 15,
    rtoMinutes: 60,
    description: 'Price threshold notifications, insider cluster alerts, and webhook triggers.',
  },

  // P4 — Non-Critical Services
  analytics: {
    serviceId: 'analytics',
    name: 'Historical Analytics & Reporting',
    criticality: 'P4_NON_CRITICAL',
    availabilityTarget: 0.9950,
    latencyClass: 'L3_BACKGROUND',
    maxPlatformLatencyMs: 1500,
    consistencyModel: 'EVENTUAL_CONSISTENCY',
    freshnessClass: 'PERIODIC',
    securityClass: 'PUBLIC',
    drTier: 'TIER_C_ANALYTICAL',
    rpoMinutes: 60,
    rtoMinutes: 240,
    description: 'Long-term volume trends, whale trade indexes, and aggregate platform telemetry.',
  },
  admin: {
    serviceId: 'admin',
    name: 'Admin & System Controls',
    criticality: 'P4_NON_CRITICAL',
    availabilityTarget: 0.9950,
    latencyClass: 'L2_INTERACTIVE',
    maxPlatformLatencyMs: 600,
    consistencyModel: 'STRONG_CONSISTENCY',
    freshnessClass: 'REAL_TIME',
    securityClass: 'ADMINISTRATIVE',
    drTier: 'TIER_C_ANALYTICAL',
    rpoMinutes: 15,
    rtoMinutes: 60,
    description: 'System configuration, role management, and emergency kill-switch controls.',
  },
};

export function getServiceQualityProfile(serviceId: string): ServiceQualityProfile | undefined {
  return PLATFORM_QUALITY_PROFILES[serviceId];
}

export function getAllQualityProfiles(): ServiceQualityProfile[] {
  return Object.values(PLATFORM_QUALITY_PROFILES);
}

export function getServicesByCriticality(level: CriticalityLevel): ServiceQualityProfile[] {
  return getAllQualityProfiles().filter((p) => p.criticality === level);
}
