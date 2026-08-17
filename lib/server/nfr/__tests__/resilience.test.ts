import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  DEFAULT_DEPENDENCY_CONFIGS,
  getCircuitBreaker,
  withTimeout,
  withRetry,
  executeResilientCall,
  resetResilienceState,
} from '../resilience';
import { ApiError } from '../../errors';

describe('Dependency Failure Resilience & Circuit Breaker', () => {
  beforeEach(() => {
    resetResilienceState();
  });

  it('starts in CLOSED state and allows calls', () => {
    const breaker = new CircuitBreaker(DEFAULT_DEPENDENCY_CONFIGS.rpc);
    expect(breaker.getState()).toBe('CLOSED');
    expect(breaker.isCallPermitted()).toBe(true);
  });

  it('trips to OPEN after reaching failureThreshold', () => {
    const breaker = new CircuitBreaker({
      dependency: 'rpc',
      failureThreshold: 3,
      recoveryTimeoutMs: 5000,
      halfOpenMaxTrials: 2,
      requestTimeoutMs: 1000,
    });

    const now = Date.now();
    breaker.recordFailure('Timeout 1', now);
    expect(breaker.getState(now)).toBe('CLOSED');

    breaker.recordFailure('Timeout 2', now);
    expect(breaker.getState(now)).toBe('CLOSED');

    breaker.recordFailure('Timeout 3', now);
    expect(breaker.getState(now)).toBe('OPEN');
    expect(breaker.isCallPermitted(now)).toBe(false);
  });

  it('transitions from OPEN to HALF_OPEN after recoveryTimeoutMs', () => {
    const breaker = new CircuitBreaker({
      dependency: 'rpc',
      failureThreshold: 2,
      recoveryTimeoutMs: 1000,
      halfOpenMaxTrials: 2,
      requestTimeoutMs: 1000,
    });

    const t0 = 1000;
    breaker.recordFailure('Err 1', t0);
    breaker.recordFailure('Err 2', t0);
    expect(breaker.getState(t0)).toBe('OPEN');

    // Before recovery window expires
    expect(breaker.getState(t0 + 500)).toBe('OPEN');
    expect(breaker.isCallPermitted(t0 + 500)).toBe(false);

    // After recovery window expires
    expect(breaker.getState(t0 + 1001)).toBe('HALF_OPEN');
    expect(breaker.isCallPermitted(t0 + 1001)).toBe(true);
  });

  it('recloses in HALF_OPEN after consecutive successes', () => {
    const breaker = new CircuitBreaker({
      dependency: 'rpc',
      failureThreshold: 2,
      recoveryTimeoutMs: 1000,
      halfOpenMaxTrials: 2,
      requestTimeoutMs: 1000,
    });

    const t0 = 1000;
    breaker.recordFailure('Err 1', t0);
    breaker.recordFailure('Err 2', t0);
    expect(breaker.getState(t0)).toBe('OPEN');

    const t1 = t0 + 1001; // enters HALF_OPEN
    expect(breaker.getState(t1)).toBe('HALF_OPEN');

    breaker.recordSuccess(t1);
    expect(breaker.getState(t1)).toBe('HALF_OPEN');

    breaker.recordSuccess(t1 + 10);
    expect(breaker.getState(t1 + 10)).toBe('CLOSED');
  });

  it('immediately re-trips to OPEN if a trial fails during HALF_OPEN', () => {
    const breaker = new CircuitBreaker({
      dependency: 'rpc',
      failureThreshold: 2,
      recoveryTimeoutMs: 1000,
      halfOpenMaxTrials: 2,
      requestTimeoutMs: 1000,
    });

    const t0 = 1000;
    breaker.recordFailure('Err 1', t0);
    breaker.recordFailure('Err 2', t0);
    expect(breaker.getState(t0)).toBe('OPEN');

    const t1 = t0 + 1001;
    expect(breaker.getState(t1)).toBe('HALF_OPEN');

    breaker.recordFailure('Trial failed', t1);
    expect(breaker.getState(t1)).toBe('OPEN');
  });

  it('withTimeout aborts slow operations and throws 504', async () => {
    const slowPromise = new Promise((resolve) => setTimeout(resolve, 200));
    await expect(withTimeout(slowPromise, 20, 'SlowTest')).rejects.toThrow('timed out after 20ms');
  });

  it('withRetry retries failed attempts with backoff and succeeds on eventual success', async () => {
    let calls = 0;
    const flakeyFn = async () => {
      calls++;
      if (calls < 3) throw new Error('Temporary glitch');
      return 'SUCCESS';
    };

    const result = await withRetry(flakeyFn, { maxRetries: 3, initialDelayMs: 5, maxDelayMs: 20 });
    expect(result).toBe('SUCCESS');
    expect(calls).toBe(3);
  });

  it('executeResilientCall executes fallback when circuit breaker is open', async () => {
    const breaker = getCircuitBreaker('oracle');
    const now = Date.now();
    breaker.recordFailure('err1', now);
    breaker.recordFailure('err2', now);
    breaker.recordFailure('err3', now);
    expect(breaker.getState(now)).toBe('OPEN');

    const fallbackResult = await executeResilientCall(
      'oracle',
      async () => 'real-price',
      {
        fallback: () => 'cached-fallback-price',
        now,
      }
    );

    expect(fallbackResult).toBe('cached-fallback-price');
  });
});
