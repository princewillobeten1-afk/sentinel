import { describe, it, expect, beforeEach } from 'vitest';
import { broadcaster } from '../broadcaster';
import { dbRepository } from '../../db/repository';

describe('Broadcaster & RPC Failover (Sprint 47 §40-42, §75-76, §97)', () => {
  beforeEach(() => {
    dbRepository.reset();
    broadcaster.reset();
  });

  it('broadcasts to primary RPC under normal conditions', async () => {
    const res = await broadcaster.broadcast('exec_001', '0xSignedPayloadExample');

    expect(res.success).toBe(true);
    expect(res.transactionHash).toBeDefined();
    expect(res.providerUsed).toBe('PRIMARY_RPC_HELIUS_ALCHEMY');
  });

  it('fails over to secondary and tertiary RPCs when primary provider fails', async () => {
    // Simulate Primary RPC failure
    broadcaster.setPrimaryRpcHealth(false);

    const resSecondary = await broadcaster.broadcast('exec_002', '0xSignedPayloadExample');
    expect(resSecondary.success).toBe(true);
    expect(resSecondary.providerUsed).toBe('SECONDARY_RPC_QUICKNODE');

    // Simulate Secondary RPC failure too
    broadcaster.setSecondaryRpcHealth(false);

    const resTertiary = await broadcaster.broadcast('exec_003', '0xSignedPayloadExample');
    expect(resTertiary.success).toBe(true);
    expect(resTertiary.providerUsed).toBe('TERTIARY_PUBLIC_FALLBACK');
  });

  it('enforces broadcast idempotency on previously confirmed execution attempt', async () => {
    const res1 = await broadcaster.broadcast('exec_idem', '0xSignedPayload');
    expect(res1.attemptNumber).toBe(1);

    // Re-broadcasting same execution ID returns previously confirmed hash
    const res2 = await broadcaster.broadcast('exec_idem', '0xSignedPayload');
    expect(res2.transactionHash).toBe(res1.transactionHash);
  });
});
