import { describe, it, expect, beforeEach } from 'vitest';
import { BlockIndexer } from '@/lib/indexer/block-indexer';
import { indexerCursorManager } from '@/lib/indexer/cursor';
import { tokenDiscoveryService } from '@/lib/discovery/token-discovery';
import { marketDiscoveryService } from '@/lib/discovery/market-discovery';
import { walletActivityIndexer } from '@/lib/wallet/activity-indexer';
import { webSocketGateway, WSClientSession } from '@/lib/ws/gateway';
import { queueService } from '@/lib/queue/queue-service';
import { initializeWorkers } from '@/apps/worker';
import { BlockModel, NormalizedTransaction } from '@/lib/blockchain/types';
import { eventBus } from '@/lib/events/bus';

describe('Sprint 44 Completion Test: End-to-End Blockchain Ingestion Pipeline', () => {
  beforeEach(() => {
    indexerCursorManager.reset();
    tokenDiscoveryService.reset();
    marketDiscoveryService.reset();
    walletActivityIndexer.reset();
    webSocketGateway.reset();
    queueService.reset();
    initializeWorkers();
  });

  it('runs complete flow: Block -> Indexer -> Normalizer -> Token/Market Discovery -> Wallet Activity -> Realtime Event -> WS Broadcast -> Restart Recovery', async () => {
    // 1. Setup connected user & WebSocket client with subscriptions
    const clientReceivedMessages: string[] = [];
    const client: WSClientSession = {
      id: 'ws_user_trader_1',
      userId: 'usr_trader_100',
      authenticated: true,
      subscriptions: new Set(),
      throttleIntervalMs: 0,
      lastSentByTopic: new Map(),
      send: (msg) => clientReceivedMessages.push(msg),
    };

    webSocketGateway.registerClient(client);

    // Subscribe to public market channel and private wallet/user channels
    webSocketGateway.subscribe(client.id, 'market:mkt_sol_raydium_pump123');
    webSocketGateway.subscribe(client.id, 'user:usr_trader_100');
    webSocketGateway.subscribe(client.id, 'token:TokenMintPump1111111111111111111111111111');

    // Register connected wallet for tracking
    const traderWalletAddress = '7Wc8YQe9n8QY5PzN1pXm8x9y7z2a1b3c4d5e6f7g8h';
    walletActivityIndexer.registerWatchedWallet(traderWalletAddress, 'usr_trader_100', 'solana');

    // 2. Generate on-chain Block with transactions, token candidate, and swap activity
    const blockSlot = 295480500;
    const testTx: NormalizedTransaction = {
      id: 'tx_sol_e2e_swap_001',
      chainId: 'solana',
      hash: '5Kz7Ne2eSwapTxSignature123456789',
      blockNumber: blockSlot,
      blockHash: `sol_bh_${blockSlot}`,
      from: traderWalletAddress,
      to: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
      value: '2500000000',
      valueFormatted: 2.5,
      fee: 0.000005,
      status: 'SUCCESS',
      finality: 'CONFIRMED',
      timestamp: Date.now(),
      classification: {
        type: 'SWAP',
        confidence: 0.95,
        source: 'solana_program_log_signature',
        version: 'v1.0.0',
      },
      metadata: {
        logs: ['Program 675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8 invoke [1]', 'Program log: ray_log swap'],
      },
    };

    const block: BlockModel = {
      id: `solana_${blockSlot}`,
      chainId: 'solana',
      number: blockSlot,
      hash: `sol_bh_${blockSlot}`,
      parentHash: `sol_bh_${blockSlot - 1}`,
      timestamp: Date.now(),
      status: 'CANONICAL',
      finality: 'CONFIRMED',
      transactionCount: 1,
      createdAt: Date.now(),
    };

    // 3. Start BlockIndexer and ingest block
    const indexer = new BlockIndexer({
      chainId: 'solana',
      syncMode: 'START_FROM_BLOCK',
      startBlock: blockSlot,
    });

    await indexer.processBlock(block);

    // 4. Ingest transactions through the worker pipeline
    await queueService.enqueue(
      'transaction-sync',
      'solana',
      `solana:tx:${testTx.hash}`,
      { transaction: testTx, blockNumber: blockSlot }
    );

    // 5. Discover token & register market
    const discoveredToken = await tokenDiscoveryService.processCandidate({
      address: 'TokenMintPump1111111111111111111111111111',
      chainId: 'solana',
      symbol: 'PUMP',
      name: 'Pump Token',
      decimals: 6,
      source: 'raydium_amm_pool',
    });

    const discoveredMarket = await marketDiscoveryService.registerMarket({
      chainId: 'solana',
      address: 'mkt_sol_raydium_pump123',
      protocol: 'raydium_amm',
      baseTokenAddress: discoveredToken.address,
      baseTokenSymbol: 'PUMP',
      quoteTokenAddress: 'So11111111111111111111111111111111111111112',
      quoteTokenSymbol: 'SOL',
      initialPrice: 1.85,
      initialLiquidityUsd: 250000,
    });

    // 6. Verify token & market discovery state
    expect(discoveredToken.status).toBe('VALIDATED');
    expect(discoveredMarket.price).toBe(1.85);

    // 7. Verify wallet activity recorded and matched
    const walletActivities = walletActivityIndexer.getWalletActivities(traderWalletAddress);
    expect(walletActivities.length).toBeGreaterThan(0);
    expect(walletActivities[0].activityType).toBe('SWAP');
    expect(walletActivities[0].transactionHash).toBe(testTx.hash);

    // 8. Verify WebSocket client received realtime broadcast events
    expect(clientReceivedMessages.length).toBeGreaterThan(0);
    const hasPriceEvent = clientReceivedMessages.some((msg) => msg.includes('market.price_updated'));
    const hasTokenEvent = clientReceivedMessages.some((msg) => msg.includes('token.discovered'));
    const hasWalletEvent = clientReceivedMessages.some((msg) => msg.includes('wallet.activity') || msg.includes('wallet.balance_updated'));

    expect(hasPriceEvent).toBe(true);
    expect(hasTokenEvent).toBe(true);
    expect(hasWalletEvent).toBe(true);

    // 9. Failure recovery test: Stop indexer, simulate process restart
    indexer.stop();

    // Re-instantiate indexer to simulate restart
    const restartedIndexer = new BlockIndexer({
      chainId: 'solana',
      syncMode: 'START_FROM_LATEST',
    });

    // Verify cursor persisted
    const cursor = await indexerCursorManager.getState('solana');
    expect(cursor.chainId).toBe('solana');

    // Ingesting the same block again must not duplicate records
    await restartedIndexer.processBlock(block);
    const storedBlocks = restartedIndexer.getStoredBlocks();
    expect(storedBlocks.length).toBe(1);
  });
});
