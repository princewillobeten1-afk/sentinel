/**
 * Fault Isolation & Graceful Degradation Coordinator (Sprint 32 §4-5).
 *
 * Ensures that non-critical subsystem failures (e.g., Token Intelligence, Analytics, Launchpad)
 * are cleanly isolated and never take down core operations (Trading, Wallet, Authentication, Market Data).
 *
 * When degraded:
 *   - Clear status indicators are provided to the frontend.
 *   - Safe fallback behavior is engaged (e.g. basic market view without AI clusters, or cached reports).
 */

import { ServiceName } from './slo';
import { getCircuitBreaker, DependencyType } from './resilience';

export type SubsystemStatus = 'operational' | 'degraded' | 'unavailable';

export interface DegradationState {
  service: ServiceName;
  status: SubsystemStatus;
  fallbackActive: boolean;
  message?: string;
  lastUpdated: string;
}

const serviceHealthOverrides = new Map<ServiceName, { status: SubsystemStatus; message?: string; updatedAt: number }>();

export function setServiceDegradationOverride(
  service: ServiceName,
  status: SubsystemStatus,
  message?: string
): void {
  serviceHealthOverrides.set(service, {
    status,
    message,
    updatedAt: Date.now(),
  });
}

export function clearServiceDegradationOverride(service: ServiceName): void {
  serviceHealthOverrides.delete(service);
}

export function getServiceDegradationStatus(service: ServiceName, now: number = Date.now()): DegradationState {
  const override = serviceHealthOverrides.get(service);
  if (override) {
    return {
      service,
      status: override.status,
      fallbackActive: override.status !== 'operational',
      message: override.message,
      lastUpdated: new Date(override.updatedAt).toISOString(),
    };
  }

  // Check corresponding dependency circuit breakers
  let depType: DependencyType | null = null;
  if (service === 'intelligence') depType = 'intelligence';
  else if (service === 'analytics') depType = 'analytics';
  else if (service === 'trading_api') depType = 'rpc';
  else if (service === 'market_data') depType = 'oracle';
  else if (service === 'authentication') depType = 'auth_provider';

  if (depType) {
    const breaker = getCircuitBreaker(depType);
    const state = breaker.getState(now);

    if (state === 'OPEN') {
      return {
        service,
        status: service === 'intelligence' || service === 'analytics' ? 'degraded' : 'unavailable',
        fallbackActive: true,
        message: `Dependency '${depType}' circuit breaker is open. Fallback mode active.`,
        lastUpdated: new Date(now).toISOString(),
      };
    } else if (state === 'HALF_OPEN') {
      return {
        service,
        status: 'degraded',
        fallbackActive: true,
        message: `Dependency '${depType}' is in recovery trial mode (half-open).`,
        lastUpdated: new Date(now).toISOString(),
      };
    }
  }

  return {
    service,
    status: 'operational',
    fallbackActive: false,
    lastUpdated: new Date(now).toISOString(),
  };
}

export function getPlatformDegradationOverview(now: number = Date.now()): {
  isDegraded: boolean;
  coreOperational: boolean;
  subsystems: Record<ServiceName, DegradationState>;
  safeTradingPermitted: boolean;
} {
  const allServices: ServiceName[] = [
    'authentication',
    'trading_api',
    'market_data',
    'portfolio',
    'discovery',
    'intelligence',
    'analytics',
  ];

  const subsystems: Partial<Record<ServiceName, DegradationState>> = {};
  let isDegraded = false;
  let coreOperational = true;

  for (const s of allServices) {
    const state = getServiceDegradationStatus(s, now);
    subsystems[s] = state;
    if (state.status !== 'operational') {
      isDegraded = true;
      if (s === 'trading_api' || s === 'market_data' || s === 'authentication') {
        coreOperational = false;
      }
    }
  }

  // Safe trading is permitted as long as core trading & market data are healthy,
  // even if Intelligence / Analytics are completely degraded.
  const safeTradingPermitted =
    subsystems.trading_api?.status === 'operational' &&
    subsystems.market_data?.status !== 'unavailable';

  return {
    isDegraded,
    coreOperational,
    safeTradingPermitted,
    subsystems: subsystems as Record<ServiceName, DegradationState>,
  };
}

/** Test-only reset */
export function resetDegradationState(): void {
  serviceHealthOverrides.clear();
}
