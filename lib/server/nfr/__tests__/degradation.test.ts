import { describe, it, expect, beforeEach } from 'vitest';
import {
  setServiceDegradationOverride,
  clearServiceDegradationOverride,
  getServiceDegradationStatus,
  getPlatformDegradationOverview,
  resetDegradationState,
} from '../degradation';
import { getCircuitBreaker, resetResilienceState } from '../resilience';

describe('Fault Isolation & Graceful Degradation Coordinator', () => {
  beforeEach(() => {
    resetDegradationState();
    resetResilienceState();
  });

  it('reports operational status across all subsystems by default', () => {
    const overview = getPlatformDegradationOverview();
    expect(overview.isDegraded).toBe(false);
    expect(overview.coreOperational).toBe(true);
    expect(overview.safeTradingPermitted).toBe(true);
    expect(overview.subsystems.trading_api.status).toBe('operational');
    expect(overview.subsystems.intelligence.status).toBe('operational');
  });

  it('isolates intelligence failure while keeping core trading operational', () => {
    // Open intelligence circuit breaker
    const breaker = getCircuitBreaker('intelligence');
    const now = Date.now();
    breaker.recordFailure('timeout 1', now);
    breaker.recordFailure('timeout 2', now);
    breaker.recordFailure('timeout 3', now);
    breaker.recordFailure('timeout 4', now);
    expect(breaker.getState(now)).toBe('OPEN');

    const overview = getPlatformDegradationOverview(now);
    expect(overview.isDegraded).toBe(true);
    expect(overview.subsystems.intelligence.status).toBe('degraded');
    expect(overview.subsystems.intelligence.fallbackActive).toBe(true);

    // Critical services remain operational!
    expect(overview.coreOperational).toBe(true);
    expect(overview.safeTradingPermitted).toBe(true);
    expect(overview.subsystems.trading_api.status).toBe('operational');
    expect(overview.subsystems.authentication.status).toBe('operational');
  });

  it('supports explicit administrative degradation override', () => {
    setServiceDegradationOverride('discovery', 'degraded', 'Scheduled maintenance on trending cluster');

    const status = getServiceDegradationStatus('discovery');
    expect(status.status).toBe('degraded');
    expect(status.fallbackActive).toBe(true);
    expect(status.message).toBe('Scheduled maintenance on trending cluster');

    clearServiceDegradationOverride('discovery');
    expect(getServiceDegradationStatus('discovery').status).toBe('operational');
  });
});
