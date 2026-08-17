/**
 * Queue Service & Worker Reliability Framework (Sprint 44 §21-26).
 *
 * Implements:
 *   - Strongly-typed queues: block-sync, transaction-sync, event-processing,
 *     token-discovery, market-discovery, realtime-events
 *   - Exponential backoff retry policies
 *   - Dead Letter Queue (DLQ) with inspection & audit fields
 *   - Deterministic job idempotency (chain:blockNumber, chain:txHash)
 */

import { SupportedChain } from '@/lib/blockchain/types';
import { logger } from '@/lib/server/logger';

export type QueueName =
  | 'block-sync'
  | 'transaction-sync'
  | 'event-processing'
  | 'token-discovery'
  | 'market-discovery'
  | 'realtime-events';

export interface QueueJob<T = any> {
  id: string; // Deterministic job ID e.g. "solana:block:295480120"
  queue: QueueName;
  chainId: SupportedChain;
  payload: T;
  attempts: number;
  maxAttempts: number;
  backoffMs: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DLQ';
  createdAt: number;
  updatedAt: number;
  lastError?: string;
  metadata?: Record<string, any>;
}

export interface DLQRecord {
  jobId: string;
  queue: QueueName;
  chainId: SupportedChain;
  blockNumber?: number;
  transactionHash?: string;
  payload: any;
  error: string;
  attempts: number;
  failedAt: number;
}

export type JobHandler<T = any> = (job: QueueJob<T>) => Promise<void>;

export class QueueService {
  private static instance: QueueService;
  private queues: Map<QueueName, QueueJob[]> = new Map();
  private handlers: Map<QueueName, JobHandler> = new Map();
  private dlq: DLQRecord[] = [];
  private processedJobIds: Set<string> = new Set();
  private isProcessing = false;

  private constructor() {
    const queueNames: QueueName[] = [
      'block-sync',
      'transaction-sync',
      'event-processing',
      'token-discovery',
      'market-discovery',
      'realtime-events',
    ];
    for (const q of queueNames) {
      this.queues.set(q, []);
    }
  }

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  /**
   * Enqueues a job with deterministic idempotency.
   * If a job with the exact same ID is already processed or pending, duplicate insertion is skipped.
   */
  public async enqueue<T = any>(
    queue: QueueName,
    chainId: SupportedChain,
    id: string,
    payload: T,
    options?: { maxAttempts?: number; backoffMs?: number; metadata?: Record<string, any> }
  ): Promise<QueueJob<T>> {
    const q = this.queues.get(queue)!;

    // Deduplication check
    const existing = q.find((j) => j.id === id);
    if (existing) {
      return existing as QueueJob<T>;
    }

    if (this.processedJobIds.has(id)) {
      logger.debug(`[QUEUE] Job ${id} already processed. Skipping duplicate enqueue.`);
      return {
        id,
        queue,
        chainId,
        payload,
        attempts: 1,
        maxAttempts: options?.maxAttempts ?? 3,
        backoffMs: options?.backoffMs ?? 50,
        status: 'COMPLETED',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    const job: QueueJob<T> = {
      id,
      queue,
      chainId,
      payload,
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? 3,
      backoffMs: options?.backoffMs ?? 50,
      status: 'PENDING',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: options?.metadata,
    };

    q.push(job);
    await this.triggerProcessing();
    return job;
  }

  public registerWorker<T = any>(queue: QueueName, handler: JobHandler<T>): void {
    this.handlers.set(queue, handler as JobHandler);
    this.triggerProcessing();
  }

  /**
   * Processes available queue items with exponential backoff and DLQ routing on terminal failure.
   */
  private async triggerProcessing(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      for (const [queueName, jobs] of this.queues.entries()) {
        const handler = this.handlers.get(queueName);
        if (!handler || jobs.length === 0) continue;

        while (jobs.length > 0) {
          const job = jobs[0];
          if (job.status === 'PROCESSING') break;

          job.status = 'PROCESSING';
          job.attempts++;
          job.updatedAt = Date.now();

          try {
            await handler(job);
            job.status = 'COMPLETED';
            this.processedJobIds.add(job.id);
            jobs.shift(); // Remove completed job
          } catch (err: any) {
            job.lastError = err?.message || String(err);
            job.updatedAt = Date.now();

            if (job.attempts >= job.maxAttempts) {
              // Terminal failure -> Move to DLQ
              job.status = 'DLQ';
              this.dlq.push({
                jobId: job.id,
                queue: job.queue,
                chainId: job.chainId,
                blockNumber: job.metadata?.blockNumber,
                transactionHash: job.metadata?.transactionHash,
                payload: job.payload,
                error: job.lastError!,
                attempts: job.attempts,
                failedAt: Date.now(),
              });

              logger.error(
                `[QUEUE_DLQ] Job ${job.id} on queue ${job.queue} failed permanently after ${job.attempts} attempts: ${job.lastError}`
              );
              jobs.shift();
            } else {
              // Exponential backoff delay
              job.status = 'PENDING';
              const delay = job.backoffMs * Math.pow(2, job.attempts - 1);
              logger.warn(
                `[QUEUE_RETRY] Job ${job.id} failed attempt ${job.attempts}/${job.maxAttempts}. Retrying in ${delay}ms: ${job.lastError}`
              );
              await new Promise((r) => setTimeout(r, delay));
            }
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public getQueueDepth(queue?: QueueName): Record<string, number> {
    if (queue) {
      return { [queue]: this.queues.get(queue)?.length || 0 };
    }
    const depths: Record<string, number> = {};
    for (const [name, jobs] of this.queues.entries()) {
      depths[name] = jobs.length;
    }
    return depths;
  }

  public getDLQRecords(limit: number = 50): DLQRecord[] {
    return this.dlq.slice(-limit);
  }

  public clearDLQ(): void {
    this.dlq = [];
  }

  public reset(): void {
    for (const q of this.queues.values()) {
      q.length = 0;
    }
    this.dlq = [];
    this.processedJobIds.clear();
    this.isProcessing = false;
  }
}

export const queueService = QueueService.getInstance();
