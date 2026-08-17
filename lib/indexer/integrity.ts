/**
 * Data Integrity Worker & Blockchain Reconciliation Service (Sprint 44 §56-57).
 *
 * Implements:
 *   - Automated data integrity audit across indexed blocks and transactions
 *   - Detection of missing block heights, orphaned blocks, duplicate transactions
 *   - On-chain state reconciliation against database records
 */

import { SupportedChain, BlockModel, NormalizedTransaction } from '@/lib/blockchain/types';
import { DataIntegrityReport } from './types';
import { reorgDetector } from './reorg';
import { blockchainService } from '@/lib/blockchain/blockchain-service';
import { logger } from '@/lib/server/logger';

export class DataIntegrityWorker {
  /**
   * Performs an integrity scan over a range of stored blocks and transactions.
   */
  public async performIntegrityAudit(
    chainId: SupportedChain,
    storedBlocks: BlockModel[],
    storedTxs: NormalizedTransaction[]
  ): Promise<DataIntegrityReport> {
    const missingBlocks: number[] = [];
    const duplicateTxHashes: string[] = [];
    const seenTxHashes = new Set<string>();

    // 1. Check for duplicate transactions
    for (const tx of storedTxs) {
      if (seenTxHashes.has(tx.hash)) {
        duplicateTxHashes.push(tx.hash);
      } else {
        seenTxHashes.add(tx.hash);
      }
    }

    // 2. Check for missing blocks in continuous sequence
    if (storedBlocks.length > 1) {
      const sorted = [...storedBlocks].sort((a, b) => a.number - b.number);
      const minBlock = sorted[0].number;
      const maxBlock = sorted[sorted.length - 1].number;
      const blockSet = new Set(sorted.map((b) => b.number));

      for (let num = minBlock; num <= maxBlock; num++) {
        if (!blockSet.has(num)) {
          missingBlocks.push(num);
        }
      }
    }

    const orphaned = reorgDetector.getOrphanedBlocks(chainId).length;
    const healthy = missingBlocks.length === 0 && duplicateTxHashes.length === 0;

    const report: DataIntegrityReport = {
      timestamp: Date.now(),
      chainId,
      missingBlocks,
      orphanedBlocks: orphaned,
      duplicateTransactions: duplicateTxHashes,
      brokenForeignKeys: 0,
      invalidTokenReferences: [],
      healthy,
    };

    if (!healthy) {
      logger.warn(`[INTEGRITY_AUDIT] Integrity issues detected on ${chainId}:`, { ...report });
    }

    return report;
  }
}

export class ReconciliationService {
  /**
   * Reconciles an internal transaction against the live blockchain state.
   */
  public async reconcileTransaction(
    chainId: SupportedChain,
    txHash: string,
    internalTx: NormalizedTransaction
  ): Promise<{ reconciled: boolean; onChainStatus?: string; discrepancyDetected: boolean }> {
    const adapter = blockchainService.getAdapter(chainId);
    const onChainTx = await adapter.getTransaction(txHash);

    if (!onChainTx) {
      return {
        reconciled: false,
        discrepancyDetected: true,
      };
    }

    const discrepancyDetected = internalTx.status !== onChainTx.status;
    return {
      reconciled: true,
      onChainStatus: onChainTx.status,
      discrepancyDetected,
    };
  }
}

export const dataIntegrityWorker = new DataIntegrityWorker();
export const reconciliationService = new ReconciliationService();
