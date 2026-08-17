import { describe, it, expect } from 'vitest';
import { confirmationMonitor } from '../confirmation-monitor';

describe('Confirmation Monitor & Reorg Handler (Sprint 47 §43-50, §98)', () => {
  it('monitors block confirmations according to per-chain policy', async () => {
    // Solana: 32 slots required
    const solPending = await confirmationMonitor.monitor('solana', '0xTxSol', 10);
    expect(solPending.isConfirmed).toBe(false);

    const solConfirmed = await confirmationMonitor.monitor('solana', '0xTxSol', 32);
    expect(solConfirmed.isConfirmed).toBe(true);
    expect(solConfirmed.isFinalized).toBe(true);

    // Base: 12 blocks required
    const basePending = await confirmationMonitor.monitor('base', '0xTxBase', 5);
    expect(basePending.isConfirmed).toBe(false);

    const baseConfirmed = await confirmationMonitor.monitor('base', '0xTxBase', 12);
    expect(baseConfirmed.isConfirmed).toBe(true);
  });

  it('detects and handles blockchain reorganizations (REORG_DETECTED)', async () => {
    const reorgStatus = await confirmationMonitor.monitor('ethereum', '0xOrphanedTx', 64, true);

    expect(reorgStatus.isConfirmed).toBe(false);
    expect(reorgStatus.isReorged).toBe(true);
  });
});
