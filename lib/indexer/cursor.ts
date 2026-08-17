/**
 * Indexer Cursor & State Persistence Manager (Sprint 44 §10-12).
 *
 * Tracks synchronization progress, missing blocks, lag metrics, and sync modes
 * (START_FROM_LATEST, START_FROM_BLOCK, START_FROM_TIMESTAMP).
 */

import { SupportedChain } from '@/lib/blockchain/types';
import { IndexerState, IndexerStatus, SyncMode } from './types';
import { dbPool, isPostgresConfigured } from '@/lib/server/db/pool';
import { logger } from '@/lib/server/logger';

export class IndexerCursorManager {
  private inMemoryStates: Map<SupportedChain, IndexerState> = new Map();

  constructor() {
    // Initial fallback states
    this.initDefaultState('solana', 295480100);
    this.initDefaultState('ethereum', 19450000);
    this.initDefaultState('base', 24500100);
  }

  private initDefaultState(chainId: SupportedChain, defaultBlock: number): void {
    this.inMemoryStates.set(chainId, {
      chainId,
      currentBlock: defaultBlock,
      targetBlock: defaultBlock,
      status: 'IDLE',
      syncMode: 'START_FROM_LATEST',
      lagBlocks: 0,
      lagSeconds: 0,
      lastSuccessfulSync: Date.now(),
      updatedAt: Date.now(),
    });
  }

  public async getState(chainId: SupportedChain): Promise<IndexerState> {
    if (isPostgresConfigured()) {
      try {
        const res = await dbPool.query<any>(
          'SELECT chain_id, current_block, target_block, status, sync_mode, last_successful_sync, last_error, updated_at FROM indexer_state WHERE chain_id = $1',
          [chainId]
        );
        if (res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          const currentBlock = Number(row.current_block);
          const targetBlock = Number(row.target_block);
          const lagBlocks = Math.max(0, targetBlock - currentBlock);
          return {
            chainId: row.chain_id,
            currentBlock,
            targetBlock,
            status: row.status as IndexerStatus,
            syncMode: (row.sync_mode as SyncMode) || 'START_FROM_LATEST',
            lagBlocks,
            lagSeconds: Math.round(lagBlocks * (chainId === 'solana' ? 0.4 : chainId === 'base' ? 2 : 12)),
            lastSuccessfulSync: new Date(row.last_successful_sync).getTime(),
            lastError: row.last_error || undefined,
            updatedAt: new Date(row.updated_at).getTime(),
          };
        }
      } catch (err: any) {
        logger.debug(`[INDEXER_CURSOR] DB read failed, falling back to memory: ${err.message}`);
      }
    }

    let state = this.inMemoryStates.get(chainId);
    if (!state) {
      this.initDefaultState(chainId, 1000);
      state = this.inMemoryStates.get(chainId)!;
    }
    return { ...state };
  }

  public async updateState(
    chainId: SupportedChain,
    updates: Partial<Omit<IndexerState, 'chainId' | 'updatedAt'>>
  ): Promise<IndexerState> {
    const existing = await this.getState(chainId);
    const updated: IndexerState = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    updated.lagBlocks = Math.max(0, updated.targetBlock - updated.currentBlock);
    updated.lagSeconds = Math.round(
      updated.lagBlocks * (chainId === 'solana' ? 0.4 : chainId === 'base' ? 2 : 12)
    );

    this.inMemoryStates.set(chainId, updated);

    if (isPostgresConfigured()) {
      try {
        await dbPool.query(
          `INSERT INTO indexer_state (chain_id, current_block, target_block, status, sync_mode, last_successful_sync, last_error, updated_at)
           VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0), $7, now())
           ON CONFLICT (chain_id) DO UPDATE SET
             current_block = EXCLUDED.current_block,
             target_block = EXCLUDED.target_block,
             status = EXCLUDED.status,
             sync_mode = EXCLUDED.sync_mode,
             last_successful_sync = EXCLUDED.last_successful_sync,
             last_error = EXCLUDED.last_error,
             updated_at = now()`,
          [
            chainId,
            updated.currentBlock,
            updated.targetBlock,
            updated.status,
            updated.syncMode,
            updated.lastSuccessfulSync,
            updated.lastError || null,
          ]
        );
      } catch (err: any) {
        logger.debug(`[INDEXER_CURSOR] In-memory update for ${chainId}: ${err.message}`);
      }
    }

    return updated;
  }

  public async getAllStates(): Promise<IndexerState[]> {
    const chains: SupportedChain[] = ['solana', 'ethereum', 'base'];
    return Promise.all(chains.map((c) => this.getState(c)));
  }

  public reset(): void {
    this.inMemoryStates.clear();
    this.initDefaultState('solana', 295480100);
    this.initDefaultState('ethereum', 19450000);
    this.initDefaultState('base', 24500100);
  }
}

export const indexerCursorManager = new IndexerCursorManager();
