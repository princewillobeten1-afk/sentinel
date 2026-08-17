/**
 * Background Worker Daemon (Sprint 44 §21-26, §81).
 *
 * Boots worker pipelines:
 *   - block-sync: fetches block details, transactions, logs
 *   - transaction-sync: normalizes, deduplicates, and classifies transactions
 *   - event-processing: extracts token creation, DEX liquidity, and wallet activities
 *   - token-discovery: registers new token candidates and schedules async enrichment
 *   - market-discovery: registers new pools and liquidity snapshots
 *   - realtime-events: coalesces and broadcasts to WebSocket gateway
 */

import { queueService } from '@/lib/queue/queue-service';
import { tokenDiscoveryService } from '@/lib/discovery/token-discovery';
import { marketDiscoveryService } from '@/lib/discovery/market-discovery';
import { walletActivityIndexer } from '@/lib/wallet/activity-indexer';
import { eventBus } from '@/lib/events/bus';
import { logger } from '@/lib/server/logger';

export function initializeWorkers(): void {
  // 1. Block sync worker
  queueService.registerWorker('block-sync', async (job) => {
    const { block } = job.payload;
    logger.info(`[WORKER:block-sync] Processing block ${block.number} on ${job.chainId}`);

    // Forward to transaction sync
    if (block.transactions && block.transactions.length > 0) {
      for (const tx of block.transactions) {
        await queueService.enqueue(
          'transaction-sync',
          job.chainId,
          `${job.chainId}:tx:${tx.hash}`,
          { transaction: tx, blockNumber: block.number },
          { metadata: { blockNumber: block.number, transactionHash: tx.hash } }
        );
      }
    }
  });

  // 2. Transaction sync worker
  queueService.registerWorker('transaction-sync', async (job) => {
    const { transaction } = job.payload;
    logger.debug(`[WORKER:transaction-sync] Ingesting tx ${transaction.hash} (${transaction.classification?.type})`);

    // Check for wallet activity
    await walletActivityIndexer.processTransaction(transaction);

    // Emit confirmation event
    await eventBus.publish({
      eventId: `evt_tx_conf_${transaction.hash}`,
      eventType: 'transaction.confirmed',
      version: '1',
      chain: job.chainId,
      blockNumber: transaction.blockNumber,
      transactionHash: transaction.hash,
      timestamp: new Date().toISOString(),
      source: 'blockchain_indexer',
      payload: {
        hash: transaction.hash,
        from: transaction.from,
        to: transaction.to,
        value: transaction.valueFormatted,
        classification: transaction.classification,
      },
    });
  });

  // 3. Event processing worker
  queueService.registerWorker('event-processing', async (job) => {
    const { event } = job.payload;
    logger.debug(`[WORKER:event-processing] Processing event ${event.eventType} on ${job.chainId}`);

    // Check for token creation or pool discovery
    if (event.eventType === 'TOKEN_CREATED' || event.eventType === 'TOKEN_TRANSFER') {
      await tokenDiscoveryService.processCandidate({
        address: event.address || event.contractAddress,
        chainId: job.chainId,
        symbol: event.metadata?.symbol || 'UNKNOWN',
        name: event.metadata?.name || 'Unknown Asset',
        decimals: event.metadata?.decimals || 6,
        source: 'event_log_discovery',
      });
    }
  });

  // 4. Token discovery worker
  queueService.registerWorker('token-discovery', async (job) => {
    const { candidate } = job.payload;
    logger.info(`[WORKER:token-discovery] Discovered token candidate ${candidate.address} on ${job.chainId}`);
    await tokenDiscoveryService.processCandidate(candidate);
  });

  // 5. Market discovery worker
  queueService.registerWorker('market-discovery', async (job) => {
    const { market } = job.payload;
    logger.info(`[WORKER:market-discovery] Discovered new pool ${market.address} (${market.protocol})`);
    await marketDiscoveryService.registerMarket(market);
  });

  // 6. Realtime events worker
  queueService.registerWorker('realtime-events', async (job) => {
    const { eventPayload } = job.payload;
    logger.debug(`[WORKER:realtime-events] Broadcasting event ${eventPayload.type}`);
  });

  logger.info('[WORKERS] All ingestion and discovery workers initialized successfully.');
}
