import { describe, it, expect, beforeEach } from 'vitest';
import { QueueService, queueService } from '../queue-service';

describe('Sprint 44: Queue Architecture, Worker Retries & Dead Letter Queue (DLQ)', () => {
  beforeEach(() => {
    queueService.reset();
  });

  it('enqueues and processes jobs with deterministic job IDs and deduplication', async () => {
    let processedCount = 0;

    queueService.registerWorker('block-sync', async (job) => {
      processedCount++;
    });

    // Enqueue job 1
    const job1 = await queueService.enqueue('block-sync', 'solana', 'solana:block:100', { number: 100 });
    expect(job1.status).toBe('COMPLETED');
    expect(processedCount).toBe(1);

    // Enqueue duplicate job with same ID
    const duplicateJob = await queueService.enqueue('block-sync', 'solana', 'solana:block:100', { number: 100 });
    expect(duplicateJob.status).toBe('COMPLETED');
    expect(processedCount).toBe(1); // Not processed twice!
  });

  it('retries failing jobs with exponential backoff and routes to DLQ upon exhausting maxAttempts', async () => {
    let attempts = 0;

    queueService.registerWorker('transaction-sync', async (job) => {
      attempts++;
      throw new Error('Database temporary connection failure');
    });

    const failingJob = await queueService.enqueue(
      'transaction-sync',
      'ethereum',
      'eth:tx:0xfail123',
      { txHash: '0xfail123' },
      { maxAttempts: 3, backoffMs: 10 }
    );

    // After exhaustion, DLQ should contain the failed record
    const dlq = queueService.getDLQRecords();
    expect(dlq.length).toBe(1);
    expect(dlq[0].jobId).toBe('eth:tx:0xfail123');
    expect(dlq[0].chainId).toBe('ethereum');
    expect(dlq[0].error).toContain('Database temporary connection failure');
    expect(dlq[0].attempts).toBe(3);
    expect(attempts).toBe(3);
  });
});
