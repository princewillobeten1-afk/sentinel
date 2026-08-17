import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkLiveness,
  checkReadiness,
  getDetailedHealthReport,
} from '../health';
import { killSwitch } from '../../kill-switch';
import { resetResilienceState, getCircuitBreaker } from '../resilience';
import { resetDegradationState } from '../degradation';

describe('Health, Liveness & Readiness Engine', () => {
  beforeEach(() => {
    killSwitch.resume('TRADING', { triggeredBy: 'test' });
    killSwitch.resume('LAUNCHPAD', { triggeredBy: 'test' });
    resetResilienceState();
    resetDegradationState();
  });

  it('checks process liveness', async () => {
    const liveness = await checkLiveness();
    expect(liveness.alive).toBe(true);
    expect(liveness.memoryMb).toBeGreaterThan(0);
    expect(liveness.eventLoopLagMs).toBeLessThan(2000);
  });

  it('checks service readiness when kill-switch is inactive', async () => {
    const readiness = await checkReadiness();
    expect(readiness.ready).toBe(true);
    expect(readiness.reasons.length).toBe(0);
  });

  it('fails readiness check when platform kill-switch is active', async () => {
    killSwitch.pause('TRADING', { reason: 'Test emergency pause', triggeredBy: 'admin', source: 'ADMIN' });
    const readiness = await checkReadiness();
    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toContain('Platform kill-switch is active');
  });

  it('fails readiness check when RPC circuit breaker is open', async () => {
    const breaker = getCircuitBreaker('rpc');
    const now = Date.now();
    breaker.recordFailure('err1', now);
    breaker.recordFailure('err2', now);
    breaker.recordFailure('err3', now);
    expect(breaker.getState(now)).toBe('OPEN');

    const readiness = await checkReadiness();
    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toContain('Core Solana RPC circuit breaker is OPEN');
  });

  it('generates detailed multi-component health report', async () => {
    const report = await getDetailedHealthReport();
    expect(report.status).toBe('healthy');
    expect(report.version).toBe('1.32.0');
    expect(report.components.database).toBeDefined();
    expect(report.components.solana_rpc).toBeDefined();
    expect(report.components.trading_engine).toBeDefined();
    expect(report.components.market_data).toBeDefined();
    expect(report.components.intelligence_engine).toBeDefined();
    expect(report.circuitBreakers).toBeDefined();
    expect(report.degradation).toBeDefined();
  });
});
