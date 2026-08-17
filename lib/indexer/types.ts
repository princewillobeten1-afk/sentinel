/**
 * Indexer Types, States & Interfaces (Sprint 44 §9-14, §27-31).
 *
 * Defines:
 *   - IndexerState and SyncMode (START_FROM_LATEST, START_FROM_BLOCK, START_FROM_TIMESTAMP)
 *   - BackfillJob chunking models
 *   - Reorg events & reconciliation models
 *   - Data integrity report models
 */

import { SupportedChain, BlockStatus, FinalityStatus } from '@/lib/blockchain/types';

export type IndexerStatus = 'IDLE' | 'SYNCING' | 'LAGGING' | 'ERROR' | 'REORGANIZING';

export type SyncMode = 'START_FROM_LATEST' | 'START_FROM_BLOCK' | 'START_FROM_TIMESTAMP';

export interface IndexerState {
  chainId: SupportedChain;
  currentBlock: number;
  targetBlock: number;
  status: IndexerStatus;
  syncMode: SyncMode;
  lagBlocks: number;
  lagSeconds: number;
  lastSuccessfulSync: number; // Unix ms
  lastError?: string;
  updatedAt: number;
}

export interface BackfillJob {
  id: string;
  chainId: SupportedChain;
  fromBlock: number;
  toBlock: number;
  chunkSize: number;
  currentBlock: number;
  processedBlocks: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
}

export interface ReorgEvent {
  id: string;
  chainId: SupportedChain;
  divergentBlock: number;
  canonicalParentHash: string;
  divergentParentHash: string;
  rolledBackBlocks: number;
  affectedTransactionHashes: string[];
  reconciledAt: number;
}

export interface DataIntegrityReport {
  timestamp: number;
  chainId: SupportedChain;
  missingBlocks: number[];
  orphanedBlocks: number;
  duplicateTransactions: string[];
  brokenForeignKeys: number;
  invalidTokenReferences: string[];
  healthy: boolean;
}

export interface IndexerConfig {
  chainId: SupportedChain;
  pollIntervalMs: number;
  batchSize: number;
  confirmationDepth: number;
  backfillChunkSize: number;
  syncMode: SyncMode;
  startBlock?: number;
  startTimestamp?: number;
}
