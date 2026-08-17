/**
 * Production Multi-RPC Provider Abstraction & Failover Pool (Sprint 44 §5-8).
 *
 * Implements:
 *   - Tiered failover: Primary -> Secondary -> Fallback
 *   - Real-time provider health tracking (HEALTHY, DEGRADED, UNAVAILABLE)
 *   - Request throttling & token-bucket rate limits per provider
 *   - Exponential backoff with jitter and provider rotation
 *   - Request ID tracing & audit logs (requestId, chain, provider, method, duration, status)
 */

import {
  SupportedChain,
  RPCProviderConfig,
  RPCProviderMetrics,
  RPCRequestTrace,
  ProviderHealthStatus,
} from './types';
import { logger } from '@/lib/server/logger';

export class RpcProviderPool {
  private providers: Map<string, RPCProviderConfig> = new Map();
  private metrics: Map<string, RPCProviderMetrics> = new Map();
  private traces: RPCRequestTrace[] = [];
  private rateLimiterBuckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
  private maxTraceHistory = 500;

  constructor(initialConfigs: RPCProviderConfig[] = []) {
    for (const cfg of initialConfigs) {
      this.registerProvider(cfg);
    }
  }

  public registerProvider(config: RPCProviderConfig): void {
    this.providers.set(config.id, config);
    this.metrics.set(config.id, {
      providerId: config.id,
      chainId: config.chainId,
      latencyMs: 20,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitedRequests: 0,
      consecutiveFailures: 0,
      status: 'HEALTHY',
    });
    this.rateLimiterBuckets.set(config.id, {
      tokens: config.maxRps,
      lastRefill: Date.now(),
    });
  }

  public getProvidersForChain(chainId: SupportedChain): RPCProviderConfig[] {
    return Array.from(this.providers.values())
      .filter((p) => p.chainId === chainId)
      .sort((a, b) => {
        const tierOrder = { primary: 0, secondary: 1, fallback: 2 };
        if (tierOrder[a.tier] !== tierOrder[b.tier]) {
          return tierOrder[a.tier] - tierOrder[b.tier];
        }
        return b.weight - a.weight;
      });
  }

  public getMetrics(providerId?: string): RPCProviderMetrics[] {
    if (providerId) {
      const metric = this.metrics.get(providerId);
      return metric ? [metric] : [];
    }
    return Array.from(this.metrics.values());
  }

  public getTraces(limit: number = 50): RPCRequestTrace[] {
    return this.traces.slice(-limit);
  }

  /**
   * Token bucket rate limiting check.
   */
  private checkAndConsumeRateLimit(provider: RPCProviderConfig): boolean {
    const bucket = this.rateLimiterBuckets.get(provider.id);
    if (!bucket) return true;

    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(provider.maxRps, bucket.tokens + elapsedSeconds * provider.maxRps);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }

  /**
   * Updates health status for a provider based on latency, error rates, and consecutive failures.
   */
  private updateHealthScore(providerId: string): void {
    const m = this.metrics.get(providerId);
    if (!m) return;

    const errorRate = m.totalRequests > 0 ? m.failedRequests / m.totalRequests : 0;

    if (m.consecutiveFailures >= 3 || errorRate > 0.4 || m.latencyMs > 2000) {
      m.status = 'UNAVAILABLE';
    } else if (m.consecutiveFailures > 0 || errorRate > 0.1 || m.latencyMs > 500) {
      m.status = 'DEGRADED';
    } else {
      m.status = 'HEALTHY';
    }
  }

  /**
   * Executes an RPC call across providers with automatic failover (Primary -> Secondary -> Fallback),
   * exponential backoff, rate limiting, and request tracing.
   */
  public async executeWithFailover<T>(
    chainId: SupportedChain,
    method: string,
    operation: (provider: RPCProviderConfig, requestId: string) => Promise<T>,
    options?: { maxRetriesPerProvider?: number; backoffMs?: number }
  ): Promise<{ result: T; usedProvider: RPCProviderConfig; trace: RPCRequestTrace }> {
    const candidates = this.getProvidersForChain(chainId);
    if (candidates.length === 0) {
      throw new Error(`No RPC providers registered for chain: ${chainId}`);
    }

    const maxRetries = options?.maxRetriesPerProvider ?? 2;
    const baseBackoff = options?.backoffMs ?? 50;
    let lastError: Error | null = null;

    for (const provider of candidates) {
      const metric = this.metrics.get(provider.id)!;
      if (metric.status === 'UNAVAILABLE') {
        // Skip unavailable provider unless all candidates are unavailable
        const allUnavailable = candidates.every(
          (c) => this.metrics.get(c.id)?.status === 'UNAVAILABLE'
        );
        if (!allUnavailable) continue;
      }

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const requestId = `rpc_${chainId}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
        const start = Date.now();

        // Rate limit check
        if (!this.checkAndConsumeRateLimit(provider)) {
          metric.totalRequests++;
          metric.rateLimitedRequests++;
          const trace: RPCRequestTrace = {
            requestId,
            chainId,
            provider: provider.name,
            method,
            startedAt: start,
            durationMs: 0,
            status: 'RATE_LIMITED',
            error: 'Provider rate limit exceeded',
          };
          this.recordTrace(trace);
          // Wait brief backoff and try next attempt or provider
          await new Promise((r) => setTimeout(r, baseBackoff * Math.pow(2, attempt)));
          continue;
        }

        metric.totalRequests++;

        try {
          // Timeout promise
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`RPC request timeout after ${provider.timeoutMs}ms`)), provider.timeoutMs)
          );

          const result = await Promise.race([
            operation(provider, requestId),
            timeoutPromise,
          ]);

          const durationMs = Date.now() - start;
          metric.successfulRequests++;
          metric.consecutiveFailures = 0;
          metric.lastSuccessfulRequest = Date.now();
          metric.latencyMs = Math.round(metric.latencyMs * 0.7 + durationMs * 0.3);
          this.updateHealthScore(provider.id);

          const trace: RPCRequestTrace = {
            requestId,
            chainId,
            provider: provider.name,
            method,
            startedAt: start,
            durationMs,
            status: 'SUCCESS',
          };
          this.recordTrace(trace);

          return { result, usedProvider: provider, trace };
        } catch (err: any) {
          const durationMs = Date.now() - start;
          metric.failedRequests++;
          metric.consecutiveFailures++;
          metric.lastFailure = Date.now();
          this.updateHealthScore(provider.id);

          lastError = err instanceof Error ? err : new Error(String(err));
          const isTimeout = lastError.message.includes('timeout');

          const trace: RPCRequestTrace = {
            requestId,
            chainId,
            provider: provider.name,
            method,
            startedAt: start,
            durationMs,
            status: isTimeout ? 'TIMEOUT' : 'FAILURE',
            error: lastError.message,
          };
          this.recordTrace(trace);

          logger.warn(
            `[RPC_FAILOVER] ${provider.name} failed (${method}) on attempt ${attempt + 1}: ${lastError.message}`
          );

          if (attempt < maxRetries) {
            const delay = baseBackoff * Math.pow(2, attempt) + Math.floor(Math.random() * 20);
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }
    }

    throw new Error(
      `All RPC providers failed for chain ${chainId} on method ${method}. Last error: ${lastError?.message}`
    );
  }

  private recordTrace(trace: RPCRequestTrace): void {
    this.traces.push(trace);
    if (this.traces.length > this.maxTraceHistory) {
      this.traces.shift();
    }
  }

  public reset(): void {
    this.traces = [];
    for (const [id, m] of this.metrics) {
      m.totalRequests = 0;
      m.successfulRequests = 0;
      m.failedRequests = 0;
      m.rateLimitedRequests = 0;
      m.consecutiveFailures = 0;
      m.latencyMs = 20;
      m.status = 'HEALTHY';
    }
  }
}

export const defaultRpcPool = new RpcProviderPool([
  {
    id: 'solana_primary',
    name: 'Solana Foundation Mainnet',
    chainId: 'solana',
    url: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    tier: 'primary',
    weight: 100,
    maxRps: 50,
    timeoutMs: 8000,
  },
  {
    id: 'solana_secondary',
    name: 'Helius Laserstream Cluster',
    chainId: 'solana',
    url: `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY || 'ba0b20f1-f08d-4949-b128-2be4eff7fe2c'}`,
    tier: 'secondary',
    weight: 95,
    maxRps: 100,
    timeoutMs: 6000,
  },
  {
    id: 'solana_fallback',
    name: 'QuickNode Solana Fallback',
    chainId: 'solana',
    url: 'https://sentinel-solana.quiknode.pro/fallback/',
    tier: 'fallback',
    weight: 70,
    maxRps: 30,
    timeoutMs: 10000,
  },
  {
    id: 'ethereum_primary',
    name: 'Ethereum Mainnet Primary RPC',
    chainId: 'ethereum',
    url: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
    tier: 'primary',
    weight: 100,
    maxRps: 50,
    timeoutMs: 8000,
  },
  {
    id: 'ethereum_secondary',
    name: 'Ethereum Infura Secondary',
    chainId: 'ethereum',
    url: 'https://mainnet.infura.io/v3/sentinel-backup',
    tier: 'secondary',
    weight: 85,
    maxRps: 40,
    timeoutMs: 8000,
  },
  {
    id: 'base_primary',
    name: 'Base Mainnet Official RPC',
    chainId: 'base',
    url: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    tier: 'primary',
    weight: 100,
    maxRps: 60,
    timeoutMs: 6000,
  },
  {
    id: 'base_secondary',
    name: 'Base Public Backup RPC',
    chainId: 'base',
    url: 'https://base.llamarpc.com',
    tier: 'secondary',
    weight: 80,
    maxRps: 40,
    timeoutMs: 8000,
  },
]);
