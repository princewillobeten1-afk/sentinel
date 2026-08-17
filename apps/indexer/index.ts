/**
 * Indexer Application Daemon (Sprint 44 §9-14, §81).
 *
 * Spawns and supervises multi-chain indexers (Solana, Ethereum, Base).
 */

import { BlockIndexer } from '@/lib/indexer/block-indexer';
import { logger } from '@/lib/server/logger';

export class IndexerSupervisor {
  private indexers: Map<string, BlockIndexer> = new Map();

  constructor() {
    this.indexers.set('solana', new BlockIndexer({ chainId: 'solana', pollIntervalMs: 2000, batchSize: 20 }));
    this.indexers.set('ethereum', new BlockIndexer({ chainId: 'ethereum', pollIntervalMs: 6000, batchSize: 10 }));
    this.indexers.set('base', new BlockIndexer({ chainId: 'base', pollIntervalMs: 2000, batchSize: 15 }));
  }

  public async startAll(): Promise<void> {
    logger.info('[INDEXER_SUPERVISOR] Starting all blockchain indexers...');
    for (const [chainId, indexer] of this.indexers.entries()) {
      try {
        await indexer.start();
        logger.info(`[INDEXER_SUPERVISOR] Indexer for ${chainId} started successfully.`);
      } catch (err: any) {
        logger.error(`[INDEXER_SUPERVISOR] Failed to start indexer for ${chainId}: ${err.message}`);
      }
    }
  }

  public stopAll(): void {
    for (const indexer of this.indexers.values()) {
      indexer.stop();
    }
    logger.info('[INDEXER_SUPERVISOR] All indexers stopped.');
  }

  public getIndexer(chainId: string): BlockIndexer | undefined {
    return this.indexers.get(chainId);
  }
}

export const indexerSupervisor = new IndexerSupervisor();
