/**
 * Service-Level Objectives (SLO) & Service-Level Indicators (SLI) Engine (Sprint 32 §1-2).
 *
 * Defines explicit availability targets, latency thresholds, and error budget calculations
 * across all Sentinel platform services.
 *
 * Service Availability Targets:
 *   - Authentication: 99.99% (0.01% error budget)
 *   - Trading API:    99.99% (0.01% error budget)
 *   - Market Data:    99.99% (0.01% error budget)
 *   - Portfolio:      99.95% (0.05% error budget)
 *   - Discovery:      99.95% (0.05% error budget)
 *   - Intelligence:   99.90% (0.10% error budget)
 *   - Analytics:      99.50% (0.50% error budget)
 */

export type ServiceName =
  | 'authentication'
  | 'trading_api'
  | 'market_data'
  | 'portfolio'
  | 'discovery'
  | 'intelligence'
  | 'analytics';

export interface SloTarget {
  service: ServiceName;
  displayName: string;
  isCritical: boolean;
  availabilityTarget: number; // e.g. 0.9999 for 99.99%
  targetLatencyP95Ms: number;
  targetLatencyP99Ms: number;
  description: string;
}

export const SLO_TARGETS: Record<ServiceName, SloTarget> = {
  authentication: {
    service: 'authentication',
    displayName: 'Authentication Service',
    isCritical: true,
    availabilityTarget: 0.9999, // 99.99%
    targetLatencyP95Ms: 150,
    targetLatencyP99Ms: 300,
    description: 'SIWS cryptographic challenge verification, session issuance, and MFA verification.',
  },
  trading_api: {
    service: 'trading_api',
    displayName: 'Trading API & Order Execution',
    isCritical: true,
    availabilityTarget: 0.9999, // 99.99%
    targetLatencyP95Ms: 100,
    targetLatencyP99Ms: 250,
    description: 'Swap execution, preflight simulation, and transaction submission path.',
  },
  market_data: {
    service: 'market_data',
    displayName: 'Market Data & WebSocket Feeds',
    isCritical: true,
    availabilityTarget: 0.9999, // 99.99%
    targetLatencyP95Ms: 50,
    targetLatencyP99Ms: 150,
    description: 'Real-time price ticks, pool liquidity telemetry, and WebSocket broadcast channel.',
  },
  portfolio: {
    service: 'portfolio',
    displayName: 'Portfolio & P&L Engine',
    isCritical: true,
    availabilityTarget: 0.9995, // 99.95%
    targetLatencyP95Ms: 200,
    targetLatencyP99Ms: 500,
    description: 'Multi-wallet aggregation, cost basis tracking, and realized/unrealized P&L calculations.',
  },
  discovery: {
    service: 'discovery',
    displayName: 'Token Discovery Platform',
    isCritical: false,
    availabilityTarget: 0.9995, // 99.95%
    targetLatencyP95Ms: 250,
    targetLatencyP99Ms: 600,
    description: 'Real-time token scanning, graduated pairs, trending lists, and filter queries.',
  },
  intelligence: {
    service: 'intelligence',
    displayName: 'Token Intelligence & Risk Engine',
    isCritical: false,
    availabilityTarget: 0.9990, // 99.90%
    targetLatencyP95Ms: 400,
    targetLatencyP99Ms: 1000,
    description: 'Holder cluster detection, creator provenance, and exitability scoring.',
  },
  analytics: {
    service: 'analytics',
    displayName: 'Historical Analytics & Reporting',
    isCritical: false,
    availabilityTarget: 0.9950, // 99.50%
    targetLatencyP95Ms: 500,
    targetLatencyP99Ms: 1500,
    description: 'Historical volume breakdowns, whale activity index, and aggregate usage telemetry.',
  },
};

export interface ServiceEventSample {
  service: ServiceName;
  timestamp: number;
  success: boolean;
  latencyMs: number;
  errorCode?: string;
}

export interface SliReport {
  service: ServiceName;
  displayName: string;
  isCritical: boolean;
  availabilityTarget: number;
  currentAvailability: number;
  sloMet: boolean;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorBudgetTotal: number;
  errorBudgetRemaining: number;
  errorBudgetBurnRate: number; // 1.0 = normal burn, >1.0 = burning faster than allowed
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  latencySloMet: boolean;
  evaluatedWindowMs: number;
}

// In-memory sliding window store for service SLI samples
const serviceSamples = new Map<ServiceName, ServiceEventSample[]>();
const MAX_SAMPLES_PER_SERVICE = 10_000;

export function recordServiceSample(sample: ServiceEventSample): void {
  let list = serviceSamples.get(sample.service);
  if (!list) {
    list = [];
    serviceSamples.set(sample.service, list);
  }
  list.push(sample);
  if (list.length > MAX_SAMPLES_PER_SERVICE) {
    list.splice(0, list.length - MAX_SAMPLES_PER_SERVICE);
  }
}

export function computeServiceSli(service: ServiceName, windowMs: number = 3600_000, now: number = Date.now()): SliReport {
  const target = SLO_TARGETS[service];
  const list = serviceSamples.get(service) ?? [];
  const cutoff = now - windowMs;
  const activeSamples = list.filter((s) => s.timestamp >= cutoff);

  const total = activeSamples.length;
  if (total === 0) {
    // Default baseline when no traffic in window
    return {
      service,
      displayName: target.displayName,
      isCritical: target.isCritical,
      availabilityTarget: target.availabilityTarget,
      currentAvailability: 1.0,
      sloMet: true,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errorBudgetTotal: 1 - target.availabilityTarget,
      errorBudgetRemaining: 1 - target.availabilityTarget,
      errorBudgetBurnRate: 0,
      latencyP50Ms: 0,
      latencyP95Ms: 0,
      latencyP99Ms: 0,
      latencySloMet: true,
      evaluatedWindowMs: windowMs,
    };
  }

  let successful = 0;
  const latencies: number[] = [];

  for (const s of activeSamples) {
    if (s.success) successful++;
    latencies.push(s.latencyMs);
  }

  const failed = total - successful;
  const availability = successful / total;
  const sloMet = availability >= target.availabilityTarget;

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] ?? 0;

  const allowedFailureRate = 1 - target.availabilityTarget;
  const actualFailureRate = failed / total;
  const burnRate = allowedFailureRate > 0 ? actualFailureRate / allowedFailureRate : 0;
  const errorBudgetRemaining = Math.max(0, allowedFailureRate - actualFailureRate);

  const latencySloMet = p95 <= target.targetLatencyP95Ms && p99 <= target.targetLatencyP99Ms;

  return {
    service,
    displayName: target.displayName,
    isCritical: target.isCritical,
    availabilityTarget: target.availabilityTarget,
    currentAvailability: Math.round(availability * 10000) / 10000,
    sloMet,
    totalRequests: total,
    successfulRequests: successful,
    failedRequests: failed,
    errorBudgetTotal: Math.round(allowedFailureRate * 10000) / 10000,
    errorBudgetRemaining: Math.round(errorBudgetRemaining * 10000) / 10000,
    errorBudgetBurnRate: Math.round(burnRate * 100) / 100,
    latencyP50Ms: p50,
    latencyP95Ms: p95,
    latencyP99Ms: p99,
    latencySloMet,
    evaluatedWindowMs: windowMs,
  };
}

export function computePlatformSloOverview(windowMs: number = 3600_000, now: number = Date.now()): {
  timestamp: string;
  allSloMet: boolean;
  criticalSloMet: boolean;
  services: Record<ServiceName, SliReport>;
} {
  const services: Partial<Record<ServiceName, SliReport>> = {};
  let allMet = true;
  let criticalMet = true;

  for (const key of Object.keys(SLO_TARGETS) as ServiceName[]) {
    const report = computeServiceSli(key, windowMs, now);
    services[key] = report;
    if (!report.sloMet || !report.latencySloMet) {
      allMet = false;
      if (report.isCritical) {
        criticalMet = false;
      }
    }
  }

  return {
    timestamp: new Date(now).toISOString(),
    allSloMet: allMet,
    criticalSloMet: criticalMet,
    services: services as Record<ServiceName, SliReport>,
  };
}

/** Test-only reset helper */
export function resetSliState(): void {
  serviceSamples.clear();
}
