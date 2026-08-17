import { describe, it, expect, beforeEach } from 'vitest';
import { RpcHealthPool, DEFAULT_RPC_PROVIDERS } from '../rpc-pool';

describe('Multi-RPC Health Scoring & Dynamic Failover Pool', () => {
  let pool: RpcHealthPool;

  beforeEach(() => {
    pool = new RpcHealthPool(DEFAULT_RPC_PROVIDERS);
  });

  it('initializes all RPC providers with healthy scores', () => {
    const providers = pool.getActiveProviders();
    expect(providers.length).toBe(3);
    for (const p of providers) {
      expect(p.metrics.compositeScore).toBe(100);
      expect(p.metrics.status).toBe('healthy');
    }
  });

  it('penalizes composite score on high latency and high error rate', () => {
    const primaryId = 'solana_mainnet_primary';

    // Record high latency and failures
    pool.recordRequest(primaryId, 450, false);
    pool.recordRequest(primaryId, 500, false);

    const score = pool.computeCompositeScore(primaryId);
    expect(score).toBeLessThan(70);
  });

  it('automatically routes to best provider and executes failover when primary fails', async () => {
    let callCount = 0;
    const flakeyRpcCall = async (provider: any) => {
      callCount++;
      if (provider.id === 'solana_mainnet_primary') {
        throw new Error('504 Gateway Timeout on primary');
      }
      return { slot: 289104999 };
    };

    const { result, usedProvider } = await pool.executeWithFailover(flakeyRpcCall);
    expect(result.slot).toBe(289104999);
    expect(usedProvider.id).not.toBe('solana_mainnet_primary'); // seamlessly failed over to secondary
    expect(callCount).toBe(2);
  });
});
