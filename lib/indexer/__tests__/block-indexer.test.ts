import { describe, it, expect, beforeEach } from 'vitest';
import { BlockIndexer } from '../block-indexer';
import { indexerCursorManager } from '../cursor';
import { reorgDetector } from '../reorg';
import { dataIntegrityWorker, reconciliationService } from '../integrity';
import { BlockModel, NormalizedTransaction } from '@/lib/blockchain/types';

describe('Sprint 44: Block Indexer, Cursor, Reorg Handling & Integrity Checks', () => {
  beforeEach(() => {
    indexerCursorManager.reset();
    reorgDetector.reset();
  });

  it('initializes indexer cursor from target start block and persists progress', async () => {
    const indexer = new BlockIndexer({
      chainId: 'solana',
      syncMode: 'START_FROM_BLOCK',
      startBlock: 295480100,
      batchSize: 5,
    });

    const stepResult = await indexer.syncStep();
    expect(stepResult.processedBlocks).toBeGreaterThanOrEqual(0);

    const cursor = await indexerCursorManager.getState('solana');
    expect(cursor.currentBlock).toBeGreaterThanOrEqual(295480100);
    expect(cursor.lastSuccessfulSync).toBeGreaterThan(0);
  });

  it('executes chunked historical backfill jobs without overwhelming node', async () => {
    const indexer = new BlockIndexer({
      chainId: 'base',
      backfillChunkSize: 10,
    });

    const job = await indexer.createBackfillJob(24500000, 24500025, 10);
    expect(job.status).toBe('PENDING');
    expect(job.chunkSize).toBe(10);

    const completedJob = await indexer.executeBackfillJob(job.id);
    expect(completedJob.status).toBe('COMPLETED');
    expect(completedJob.processedBlocks).toBe(26); // inclusive 24500000 to 24500025
  });

  it('detects blockchain reorganization and marks divergent block as orphaned (A -> B -> C vs A -> B -> D -> E)', async () => {
    // Canonical chain: Block 100 (A) -> Block 101 (B) -> Block 102 (C)
    const block100: BlockModel = {
      id: 'sol_100',
      chainId: 'solana',
      number: 100,
      hash: 'hash_100_A',
      parentHash: 'hash_99',
      timestamp: Date.now() - 3000,
      status: 'CANONICAL',
      finality: 'CONFIRMED',
      transactionCount: 50,
      createdAt: Date.now(),
    };

    const block101_B: BlockModel = {
      id: 'sol_101_B',
      chainId: 'solana',
      number: 101,
      hash: 'hash_101_B',
      parentHash: 'hash_100_A',
      timestamp: Date.now() - 2000,
      status: 'CANONICAL',
      finality: 'CONFIRMED',
      transactionCount: 60,
      createdAt: Date.now(),
    };

    const block102_C: BlockModel = {
      id: 'sol_102_C',
      chainId: 'solana',
      number: 102,
      hash: 'hash_102_C',
      parentHash: 'hash_101_B',
      timestamp: Date.now() - 1000,
      status: 'CANONICAL',
      finality: 'CONFIRMED',
      transactionCount: 40,
      createdAt: Date.now(),
    };

    reorgDetector.detectReorg(block100);
    reorgDetector.detectReorg(block101_B);
    reorgDetector.detectReorg(block102_C);

    expect(reorgDetector.getOrphanedBlocks().length).toBe(0);

    // Reorg occurs: Block 102 arrives with parent hash 'hash_101_D' (diverged from 101_B)
    const block102_E: BlockModel = {
      id: 'sol_102_E',
      chainId: 'solana',
      number: 102,
      hash: 'hash_102_E',
      parentHash: 'hash_101_D', // Mismatch!
      timestamp: Date.now(),
      status: 'CANONICAL',
      finality: 'CONFIRMED',
      transactionCount: 75,
      createdAt: Date.now(),
    };

    const reorg = reorgDetector.detectReorg(block102_E);
    expect(reorg).not.toBeNull();
    expect(reorg?.divergentBlock).toBe(101);
    expect(reorg?.canonicalParentHash).toBe('hash_101_D');
    expect(reorg?.divergentParentHash).toBe('hash_101_B');

    // Verify orphaned records
    const orphaned = reorgDetector.getOrphanedBlocks('solana');
    expect(orphaned.length).toBe(1);
    expect(orphaned[0].hash).toBe('hash_101_B');
    expect(orphaned[0].status).toBe('ORPHANED');
  });

  it('DataIntegrityWorker detects missing blocks and duplicate transactions in audit report', async () => {
    const blocks: BlockModel[] = [
      { id: 'b_1', chainId: 'ethereum', number: 100, hash: 'h100', parentHash: 'h99', timestamp: 1, status: 'CANONICAL', finality: 'FINALIZED', transactionCount: 1, createdAt: 1 },
      { id: 'b_3', chainId: 'ethereum', number: 102, hash: 'h102', parentHash: 'h101', timestamp: 3, status: 'CANONICAL', finality: 'FINALIZED', transactionCount: 1, createdAt: 3 },
      // Block 101 is missing!
    ];

    const txs: NormalizedTransaction[] = [
      { id: 'tx1', chainId: 'ethereum', hash: '0xhash1', blockNumber: 100, blockHash: 'h100', from: '0xa', to: '0xb', value: '1', valueFormatted: 1, fee: 0.001, status: 'SUCCESS', finality: 'FINALIZED', timestamp: 1, classification: { type: 'TRANSFER', confidence: 1, source: 'test', version: '1' }, metadata: {} },
      { id: 'tx2', chainId: 'ethereum', hash: '0xhash1', blockNumber: 100, blockHash: 'h100', from: '0xa', to: '0xb', value: '1', valueFormatted: 1, fee: 0.001, status: 'SUCCESS', finality: 'FINALIZED', timestamp: 1, classification: { type: 'TRANSFER', confidence: 1, source: 'test', version: '1' }, metadata: {} }, // duplicate!
    ];

    const report = await dataIntegrityWorker.performIntegrityAudit('ethereum', blocks, txs);
    expect(report.healthy).toBe(false);
    expect(report.missingBlocks).toContain(101);
    expect(report.duplicateTransactions).toContain('0xhash1');
  });

  it('ReconciliationService compares internal state against on-chain reality', async () => {
    const internalTx: NormalizedTransaction = {
      id: 'tx_int_1',
      chainId: 'ethereum',
      hash: '0xabc123',
      blockNumber: 19450000,
      blockHash: '0xeth_block_19450000',
      from: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      to: '0x388C818CA8B9251b393131C08a73682949733474',
      value: '1500000000000000000',
      valueFormatted: 1.5,
      fee: 0.0005,
      status: 'SUCCESS',
      finality: 'FINALIZED',
      timestamp: Date.now(),
      classification: { type: 'TRANSFER', confidence: 0.99, source: 'native', version: '1' },
      metadata: {},
    };

    const reconciliation = await reconciliationService.reconcileTransaction('ethereum', '0xabc123', internalTx);
    expect(reconciliation.reconciled).toBe(true);
    expect(reconciliation.onChainStatus).toBe('SUCCESS');
    expect(reconciliation.discrepancyDetected).toBe(false);
  });
});
