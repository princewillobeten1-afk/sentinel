/**
 * Dependency Failure Resilience & Multi-State Circuit Breakers (Sprint 32 §3, §6).
 *
 * Implements standard reliability patterns for external and internal dependencies:
 *   - Circuit Breaker Pattern (CLOSED, OPEN, HALF_OPEN states)
 *   - Exponential Backoff with Full Jitter
 *   - Configurable Timeout Bounding
 *   - Fallback Execution
 *   - Health & Trial Probing
 */

import { ApiError } from '../errors';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type DependencyType =
  | 'rpc'
  | 'oracle'
  | 'notifications'
  | 'cloud_storage'
  | 'analytics'
  | 'intelligence'
  | 'auth_provider';

export interface CircuitBreakerConfig {
  dependency: DependencyType;
  failureThreshold: number; // consecutive failures to trip
  recoveryTimeoutMs: number; // duration to stay OPEN before HALF_OPEN probe
  halfOpenMaxTrials: number; // successful trials needed in HALF_OPEN to reclose
  requestTimeoutMs: number; // default timeout for calls to this dependency
}

export const DEFAULT_DEPENDENCY_CONFIGS: Record<DependencyType, CircuitBreakerConfig> = {
  rpc: {
    dependency: 'rpc',
    failureThreshold: 3,
    recoveryTimeoutMs: 15_000,
    halfOpenMaxTrials: 2,
    requestTimeoutMs: 4_000,
  },
  oracle: {
    dependency: 'oracle',
    failureThreshold: 3,
    recoveryTimeoutMs: 20_000,
    halfOpenMaxTrials: 2,
    requestTimeoutMs: 3_000,
  },
  notifications: {
    dependency: 'notifications',
    failureThreshold: 5,
    recoveryTimeoutMs: 30_000,
    halfOpenMaxTrials: 1,
    requestTimeoutMs: 5_000,
  },
  cloud_storage: {
    dependency: 'cloud_storage',
    failureThreshold: 4,
    recoveryTimeoutMs: 30_000,
    halfOpenMaxTrials: 2,
    requestTimeoutMs: 6_000,
  },
  analytics: {
    dependency: 'analytics',
    failureThreshold: 5,
    recoveryTimeoutMs: 45_000,
    halfOpenMaxTrials: 2,
    requestTimeoutMs: 5_000,
  },
  intelligence: {
    dependency: 'intelligence',
    failureThreshold: 4,
    recoveryTimeoutMs: 30_000,
    halfOpenMaxTrials: 2,
    requestTimeoutMs: 8_000,
  },
  auth_provider: {
    dependency: 'auth_provider',
    failureThreshold: 3,
    recoveryTimeoutMs: 15_000,
    halfOpenMaxTrials: 2,
    requestTimeoutMs: 3_000,
  },
};

export class CircuitBreaker {
  public readonly config: CircuitBreakerConfig;
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private consecutiveSuccessesInHalfOpen = 0;
  private lastStateChangeTimestamp: number = Date.now();
  private lastFailureReason?: string;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  public getState(now: number = Date.now()): CircuitState {
    if (this.state === 'OPEN') {
      if (now - this.lastStateChangeTimestamp >= this.config.recoveryTimeoutMs) {
        this.transitionTo('HALF_OPEN', now);
      }
    }
    return this.state;
  }

  public isCallPermitted(now: number = Date.now()): boolean {
    const currentState = this.getState(now);
    return currentState === 'CLOSED' || currentState === 'HALF_OPEN';
  }

  public recordSuccess(now: number = Date.now()): void {
    const currentState = this.getState(now);
    if (currentState === 'HALF_OPEN') {
      this.consecutiveSuccessesInHalfOpen++;
      if (this.consecutiveSuccessesInHalfOpen >= this.config.halfOpenMaxTrials) {
        this.transitionTo('CLOSED', now);
        this.failureCount = 0;
        this.consecutiveSuccessesInHalfOpen = 0;
        this.lastFailureReason = undefined;
      }
    } else if (currentState === 'CLOSED') {
      this.failureCount = 0;
      this.lastFailureReason = undefined;
    }
  }

  public recordFailure(reason: string, now: number = Date.now()): void {
    this.lastFailureReason = reason;
    const currentState = this.getState(now);

    if (currentState === 'HALF_OPEN') {
      // Any failure during trial immediately re-trips back to OPEN
      this.transitionTo('OPEN', now);
      this.consecutiveSuccessesInHalfOpen = 0;
    } else if (currentState === 'CLOSED') {
      this.failureCount++;
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo('OPEN', now);
      }
    }
  }

  private transitionTo(newState: CircuitState, now: number): void {
    this.state = newState;
    this.lastStateChangeTimestamp = now;
  }

  public getTelemetry(now: number = Date.now()) {
    return {
      dependency: this.config.dependency,
      state: this.getState(now),
      failureCount: this.failureCount,
      consecutiveSuccessesInHalfOpen: this.consecutiveSuccessesInHalfOpen,
      lastStateChange: new Date(this.lastStateChangeTimestamp).toISOString(),
      lastFailureReason: this.lastFailureReason,
      recoveryRemainingMs:
        this.state === 'OPEN'
          ? Math.max(0, this.config.recoveryTimeoutMs - (now - this.lastStateChangeTimestamp))
          : 0,
    };
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.consecutiveSuccessesInHalfOpen = 0;
    this.lastStateChangeTimestamp = Date.now();
    this.lastFailureReason = undefined;
  }
}

// Registry of dependency circuit breakers
const circuitBreakers = new Map<DependencyType, CircuitBreaker>();

export function getCircuitBreaker(dependency: DependencyType): CircuitBreaker {
  let breaker = circuitBreakers.get(dependency);
  if (!breaker) {
    breaker = new CircuitBreaker(DEFAULT_DEPENDENCY_CONFIGS[dependency]);
    circuitBreakers.set(dependency, breaker);
  }
  return breaker;
}

export function getAllCircuitBreakersTelemetry(now: number = Date.now()) {
  const result: Record<string, ReturnType<CircuitBreaker['getTelemetry']>> = {};
  for (const dep of Object.keys(DEFAULT_DEPENDENCY_CONFIGS) as DependencyType[]) {
    result[dep] = getCircuitBreaker(dep).getTelemetry(now);
  }
  return result;
}

/**
 * Wraps an async call with a deterministic timeout.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName = 'Operation'
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ApiError(`${operationName} timed out after ${timeoutMs}ms`, 504, 'DEPENDENCY_TIMEOUT'));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return result;
  } catch (error) {
    clearTimeout(timer!);
    throw error;
  }
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Executes an async function with exponential backoff and full jitter.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 200;
  const maxDelayMs = options.maxDelayMs ?? 3000;
  const backoffFactor = options.backoffFactor ?? 2;
  const shouldRetry = options.shouldRetry ?? (() => true);

  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt > maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate exponential delay with full jitter
      const expDelay = Math.min(maxDelayMs, initialDelayMs * Math.pow(backoffFactor, attempt - 1));
      const jitterDelay = Math.floor(Math.random() * expDelay);

      await new Promise((resolve) => setTimeout(resolve, jitterDelay));
    }
  }
}

/**
 * High-level protected call executor using circuit breaker, timeout, retry, and fallback.
 */
export async function executeResilientCall<T>(
  dependency: DependencyType,
  operation: () => Promise<T>,
  options?: {
    timeoutMs?: number;
    retries?: number;
    fallback?: () => Promise<T> | T;
    now?: number;
  }
): Promise<T> {
  const breaker = getCircuitBreaker(dependency);
  const now = options?.now ?? Date.now();

  if (!breaker.isCallPermitted(now)) {
    if (options?.fallback) {
      return await options.fallback();
    }
    throw new ApiError(
      `Service dependency '${dependency}' is currently unavailable (Circuit Breaker OPEN).`,
      503,
      'CIRCUIT_BREAKER_OPEN',
      { dependency }
    );
  }

  const timeoutMs = options?.timeoutMs ?? breaker.config.requestTimeoutMs;

  try {
    const result = await withRetry(
      () => withTimeout(operation(), timeoutMs, `Call to ${dependency}`),
      { maxRetries: options?.retries ?? 2 }
    );

    breaker.recordSuccess(Date.now());
    return result;
  } catch (error: any) {
    breaker.recordFailure(error?.message || 'Unknown failure', Date.now());

    if (options?.fallback) {
      return await options.fallback();
    }
    throw error;
  }
}

/** Test-only reset */
export function resetResilienceState(): void {
  for (const breaker of circuitBreakers.values()) {
    breaker.reset();
  }
  circuitBreakers.clear();
}
